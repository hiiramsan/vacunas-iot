import { Injectable, Logger } from '@nestjs/common';
import { Alert } from './quality-assurance.service';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  
  // Almacena alertas recientes para evitar spam
  private alertHistory = new Map<string, number>();
  
  // Cooldown de 2 minutos entre alertas del mismo tipo para el mismo dispositivo
  private readonly ALERT_COOLDOWN = 2 * 60 * 1000;

  /**
   * Envía una alerta individual
   * Aplica cooldown para evitar spam
   */
  async enviarAlerta(alert: Alert): Promise<void> {
    // Crear key única para la alerta
    const alertKey = `${alert.deviceId}-${alert.type}`;
    const lastAlert = this.alertHistory.get(alertKey);
    
    // Verificar cooldown
    if (lastAlert && Date.now() - lastAlert < this.ALERT_COOLDOWN) {
      this.logger.debug(`Alerta ${alertKey} en cooldown, omitiendo...`);
      return;
    }

    // Registrar nueva alerta
    this.alertHistory.set(alertKey, Date.now());

    // Enviar según nivel de criticidad
    switch (alert.level) {
      case 'CRITICAL':
        await this.enviarNotificacionCritica(alert);
        break;
      case 'WARNING':
        await this.enviarNotificacionWarning(alert);
        break;
      case 'INFO':
        await this.enviarNotificacionInfo(alert);
        break;
    }
  }

  /**
   * Envía múltiples alertas
   */
  async enviarMultiplesAlertas(alerts: Alert[]): Promise<void> {
    for (const alert of alerts) {
      await this.enviarAlerta(alert);
    }
  }

  /**
   * Maneja alertas CRÍTICAS
   * - Log en consola con nivel ERROR
   * - Preparado para WebSocket (cuando se implemente)
   * - Preparado para Email (cuando se implemente)
   */
  private async enviarNotificacionCritica(alert: Alert): Promise<void> {
    this.logger.error(`🚨 ALERTA CRÍTICA: ${alert.message}`);
    this.logger.error(`   Dispositivo: ${alert.deviceId}`);
    this.logger.error(`   Tipo: ${alert.type}`);
    if (alert.value !== undefined) {
      this.logger.error(`   Valor: ${alert.value}`);
    }

    // TODO: Implementar WebSocket
    // this.alertsGateway?.emitAlert(alert);

    // TODO: Implementar Email
    // if (alert.type === 'TEMPERATURA' || alert.type === 'CONECTIVIDAD') {
    //   await this.emailService.sendCriticalAlert(alert);
    // }
  }

  /**
   * Maneja alertas WARNING
   * - Log en consola con nivel WARN
   * - WebSocket para dashboard en tiempo real
   */
  private async enviarNotificacionWarning(alert: Alert): Promise<void> {
    this.logger.warn(`⚠️  ALERTA WARNING: ${alert.message}`);
    this.logger.warn(`   Dispositivo: ${alert.deviceId}`);
    
    // TODO: Implementar WebSocket
    // this.alertsGateway?.emitAlert(alert);
  }

  /**
   * Maneja alertas INFO
   * - Solo log en consola
   */
  private async enviarNotificacionInfo(alert: Alert): Promise<void> {
    this.logger.log(`ℹ️  ALERTA INFO: ${alert.message}`);
  }

  /**
   * Limpia historial de alertas antiguas
   * Evita que el Map crezca indefinidamente
   */
  clearOldAlertHistory(): void {
    const now = Date.now();
    for (const [key, timestamp] of this.alertHistory.entries()) {
      if (now - timestamp > this.ALERT_COOLDOWN * 2) {
        this.alertHistory.delete(key);
      }
    }
  }
}
