import { Injectable, OnModuleInit } from '@nestjs/common';
import * as amqp from 'amqplib';
import { InfluxService } from './influx.service';

@Injectable()
export class CargamentoService implements OnModuleInit {
  constructor(private influxService: InfluxService) {}

  async onModuleInit() {
    await this.connectWithRetry();
  }

  private async connectWithRetry(maxRetries = 10, delay = 5000) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        console.log(`🔄 Intento ${i + 1}/${maxRetries} de conexión a RabbitMQ...`);
        
        const connection = await amqp.connect(
          process.env.RABBITMQ_URL || 'amqp://guest:guest@rabbitmq:5672'
        );
        const channel = await connection.createChannel();

        const queue = 'cargamento_queue';
        
        // Asegura que la cola exista
        await channel.assertQueue(queue, { durable: true });

        console.log('Conectado a RabbitMQ exitosamente');
        console.log('Esperando mensajes de RabbitMQ en:', queue);        
        // Se suscribe al broker
        channel.consume(
          queue,
          async (msg) => {
            if (msg) {
              try {
                const content = msg.content.toString();
                console.log('Mensaje recibido:', content);

                const data = JSON.parse(content);
                console.log('Datos parseados:', data);

                await this.influxService.writeMeasurement(data);
                console.log('Datos guardados en InfluxDB');

                channel.ack(msg);
              } catch (error) {
                console.error('Error procesando mensaje:', error);
                channel.nack(msg, false, false);
              }
            }
          },
          { noAck: false }
        );
        
        // Conexión exitosa, salir del bucle de reintentos
        return;
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Error en intento ${i + 1}:`, errorMessage);
        
        if (i < maxRetries - 1) {
          console.log(`Reintentando en ${delay / 1000} segundos...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          console.error('No se pudo conectar a RabbitMQ después de varios intentos');
        }
      }
    }
  }
}