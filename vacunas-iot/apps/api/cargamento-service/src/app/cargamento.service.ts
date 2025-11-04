import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import * as amqp from 'amqplib';
import { InfluxService } from './influx.service';
import { QualityAssuranceService } from './quality-assurance.service';
import { NotificationService } from './notification.service';

@Injectable()
export class CargamentoService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CargamentoService.name);
  private connectivityCheckInterval: NodeJS.Timeout | undefined;
  private alertCleanupInterval: NodeJS.Timeout | undefined;

  constructor(
    private influxService: InfluxService,
    private qaService: QualityAssuranceService,
    private notificationService: NotificationService,
  ) {}

  async onModuleInit() {
    await this.connectWithRetry();
    this.startConnectivityMonitoring();
    this.startAlertCleanup();
  }

  onModuleDestroy() {
    if (this.connectivityCheckInterval) {
      clearInterval(this.connectivityCheckInterval);
    }
    if (this.alertCleanupInterval) {
      clearInterval(this.alertCleanupInterval);
    }
  }

  private async connectWithRetry(maxRetries = 10, delay = 5000) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        this.logger.log(`🔄 Intento ${i + 1}/${maxRetries} de conexión a RabbitMQ...`);
        
        const connection = await amqp.connect(
          process.env.RABBITMQ_URL || 'amqp://guest:guest@rabbitmq:5672'
        );
        const channel = await connection.createChannel();

        const queue = 'cargamento_queue';
        
        await channel.assertQueue(queue, { durable: true });

        this.logger.log('✅ Conectado a RabbitMQ exitosamente');
        this.logger.log(`📡 Esperando mensajes en: ${queue}`);
        
        // Configurar prefetch para procesar mensajes de uno en uno
        await channel.prefetch(1);

        channel.consume(
          queue,
          async (msg) => {
            if (msg) {
              await this.procesarMensaje(msg, channel);
            }
          },
          { noAck: false }
        );
        
        return;
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.error(`❌ Error en intento ${i + 1}: ${errorMessage}`);
        
        if (i < maxRetries - 1) {
          this.logger.log(`⏳ Reintentando en ${delay / 1000} segundos...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          this.logger.error('💥 No se pudo conectar a RabbitMQ después de varios intentos');
          throw new Error('Failed to connect to RabbitMQ');
        }
      }
    }
  }

  /**
   * Procesa cada mensaje recibido de RabbitMQ
   * Aplica validaciones de QA antes de guardar en InfluxDB
   */
  private async procesarMensaje(msg: amqp.ConsumeMessage, channel: amqp.Channel) {
    const startTime = Date.now();
    
    try {
      // 1. Parsear mensaje
      const content = msg.content.toString();
      this.logger.log(`📨 Mensaje recibido: ${content}`);

      const data = JSON.parse(content);
      const deviceId = data.device || data.device_id || 'UNKNOWN';

      // 2. ASEGURAMIENTO DE CALIDAD
      // Aplica todas las validaciones definidas
      const validation = this.qaService.validateData(data);

      // 3. COMPONENTE DE NOTIFICACIONES
      // Si hay alertas, enviarlas según su nivel
      if (validation.alerts.length > 0) {
        this.logger.warn(`⚠️  ${validation.alerts.length} alertas detectadas para ${deviceId}`);
        await this.notificationService.enviarMultiplesAlertas(validation.alerts);
      }

      // 4. Guardar en InfluxDB solo si pasa validaciones CRÍTICAS
      // Los warnings no impiden el guardado
      if (validation.isValid) {
        await this.influxService.writeMeasurement(validation.data);
        
        const processingTime = Date.now() - startTime;
        this.logger.log(`✅ Datos procesados y guardados para ${deviceId} (${processingTime}ms)`);
        
        // Acknowledge del mensaje
        channel.ack(msg);
      } else {
        this.logger.error(`❌ Datos rechazados para ${deviceId} - No cumplen validaciones críticas`);
        
        // Rechazar mensaje sin requeue (se descarta)
        channel.nack(msg, false, false);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`💥 Error procesando mensaje: ${errorMessage}`);
      
      // Rechazar mensaje con requeue para reintento
      channel.nack(msg, false, true);
    }
  }

  /**
   * Monitoreo de conectividad cada minuto
   * Detecta dispositivos sin comunicación por más de 5 minutos
   */
  private startConnectivityMonitoring() {
    this.connectivityCheckInterval = setInterval(async () => {
      try {
        const alerts = this.qaService.checkConnectivity();
        
        if (alerts.length > 0) {
          this.logger.warn(`🔌 Detectadas ${alerts.length} alertas de conectividad`);
          await this.notificationService.enviarMultiplesAlertas(alerts);
        }
      } catch (error) {
        this.logger.error(`Error en monitoreo de conectividad: ${error}`);
      }
    }, 60000); // 1 minuto

    this.logger.log('🔍 Monitoreo de conectividad iniciado');
  }

  /**
   * Limpieza de historial de alertas cada 10 minutos
   */
  private startAlertCleanup() {
    this.alertCleanupInterval = setInterval(() => {
      this.notificationService.clearOldAlertHistory();
    }, 10 * 60 * 1000); // 10 minutos
  }

  // Métodos públicos para gestión de dispositivos
  registerDevice(deviceId: string): void {
    this.qaService.registerDevice(deviceId);
  }

  unregisterDevice(deviceId: string): void {
    this.qaService.unregisterDevice(deviceId);
  }

  getDeviceStatus(deviceId: string) {
    return this.qaService.getDeviceStatus(deviceId);
  }

  getRegisteredDevices() {
    return this.qaService.getRegisteredDevices();
  }
}