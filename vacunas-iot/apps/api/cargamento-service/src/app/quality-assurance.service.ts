import { Injectable, Logger } from '@nestjs/common';

export interface ValidationResult {
  isValid: boolean;
  alerts: Alert[];
  data: any;
}

export interface Alert {
  level: 'WARNING' | 'CRITICAL' | 'INFO';
  type: 'TEMPERATURA' | 'HUMEDAD' | 'CONECTIVIDAD' | 'INTEGRIDAD' | 'GPS';
  message: string;
  timestamp: Date;
  deviceId: string;
  value?: number;
}

@Injectable()
export class QualityAssuranceService {
  private readonly logger = new Logger(QualityAssuranceService.name);
  
  // Registro de última comunicación por dispositivo
  private lastCommunication = new Map<string, number>();
  
  // Dispositivos válidos registrados (incluye el del simulador actual)
  private validDevices = new Set([
    'ESP32-001', 
    'ESP32-002',
    'sensor-001', // Del simulador actual
  ]);

  // Rangos de validación según requerimientos
  private readonly TEMP_MIN = 2;
  private readonly TEMP_MAX = 8;
  private readonly TEMP_CRITICAL_MIN = 0;
  private readonly TEMP_CRITICAL_MAX = 10;
  
  private readonly HUMIDITY_MIN = 40;
  private readonly HUMIDITY_MAX = 70;
  
  private readonly TIMEOUT_MS = 5 * 60 * 1000; // 5 minutos

  /**
   * Valida datos recibidos del sensor
   * Aplica todas las técnicas de QA requeridas
   */
  validateData(data: any): ValidationResult {
    const alerts: Alert[] = [];
    let isValid = true;

    // 1. VALIDACIÓN DE INTEGRIDAD BÁSICA
    if (!data.device && !data.device_id) {
      alerts.push({
        level: 'CRITICAL',
        type: 'INTEGRIDAD',
        message: 'Datos sin identificador de dispositivo',
        timestamp: new Date(),
        deviceId: 'UNKNOWN',
      });
      return { isValid: false, alerts, data };
    }

    const deviceId = data.device || data.device_id;

    // 2. INTEGRIDAD REFERENCIAL
    // Verifica que el device_id existe y está registrado
    if (!this.validDevices.has(deviceId)) {
      alerts.push({
        level: 'CRITICAL',
        type: 'INTEGRIDAD',
        message: `Device ID no reconocido: ${deviceId}`,
        timestamp: new Date(),
        deviceId,
      });
      isValid = false;
    }

    // 3. VALIDACIÓN DE RANGO - TEMPERATURA
    // Rango óptimo: 2-8°C, Rango operativo: 0-10°C
    if (data.temperatura !== undefined) {
      const temp = parseFloat(data.temperatura);
      
      if (isNaN(temp)) {
        alerts.push({
          level: 'CRITICAL',
          type: 'TEMPERATURA',
          message: 'Valor de temperatura inválido',
          timestamp: new Date(),
          deviceId,
          value: data.temperatura,
        });
        isValid = false;
      } else if (temp < this.TEMP_CRITICAL_MIN || temp > this.TEMP_CRITICAL_MAX) {
        // Fuera del rango operativo - CRÍTICO
        alerts.push({
          level: 'CRITICAL',
          type: 'TEMPERATURA',
          message: `Temperatura CRÍTICA: ${temp}°C (Fuera de rango operativo 0-10°C)`,
          timestamp: new Date(),
          deviceId,
          value: temp,
        });
        isValid = false;
      } else if (temp < this.TEMP_MIN || temp > this.TEMP_MAX) {
        // Fuera del rango óptimo pero dentro del operativo - WARNING
        alerts.push({
          level: 'WARNING',
          type: 'TEMPERATURA',
          message: `Temperatura fuera de rango óptimo: ${temp}°C (Óptimo: 2-8°C)`,
          timestamp: new Date(),
          deviceId,
          value: temp,
        });
        // No invalida los datos, solo genera warning
      }
    }

    // 4. VALIDACIÓN DE RANGO - HUMEDAD
    if (data.humedad !== undefined) {
      const humidity = parseFloat(data.humedad);
      
      if (!isNaN(humidity) && (humidity < this.HUMIDITY_MIN || humidity > this.HUMIDITY_MAX)) {
        alerts.push({
          level: 'WARNING',
          type: 'HUMEDAD',
          message: `Humedad fuera de rango: ${humidity}% (Rango: 40-70%)`,
          timestamp: new Date(),
          deviceId,
          value: humidity,
        });
      }
    }

    // 5. VALIDACIÓN DE GPS
    if (data.latitud !== undefined && data.longitud !== undefined) {
      const lat = parseFloat(data.latitud);
      const lon = parseFloat(data.longitud);
      
      if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        alerts.push({
          level: 'WARNING',
          type: 'GPS',
          message: 'Coordenadas GPS inválidas',
          timestamp: new Date(),
          deviceId,
        });
      }
    }

    // 6. ACTUALIZAR ÚLTIMA COMUNICACIÓN
    // Para el monitoreo de conectividad
    this.lastCommunication.set(deviceId, Date.now());

    this.logger.log(`Validación completada para ${deviceId}: ${alerts.length} alertas`);
    
    return { isValid, alerts, data };
  }

  /**
   * VALIDACIÓN DE INTEGRIDAD (Latencia/Conectividad)
   * Verifica si hay dispositivos sin comunicación por más de 5 minutos
   */
  checkConnectivity(): Alert[] {
    const alerts: Alert[] = [];
    const now = Date.now();

    for (const [deviceId, lastComm] of this.lastCommunication.entries()) {
      if (now - lastComm > this.TIMEOUT_MS) {
        alerts.push({
          level: 'CRITICAL',
          type: 'CONECTIVIDAD',
          message: `Pérdida de conectividad - Sin datos desde hace ${Math.round((now - lastComm) / 60000)} minutos`,
          timestamp: new Date(),
          deviceId,
        });
      }
    }

    return alerts;
  }

  /**
   * Registra un nuevo dispositivo en el sistema
   */
  registerDevice(deviceId: string): void {
    this.validDevices.add(deviceId);
    this.lastCommunication.set(deviceId, Date.now());
    this.logger.log(`✅ Dispositivo registrado: ${deviceId}`);
  }

  /**
   * Elimina un dispositivo del sistema
   */
  unregisterDevice(deviceId: string): void {
    this.validDevices.delete(deviceId);
    this.lastCommunication.delete(deviceId);
    this.logger.log(`❌ Dispositivo eliminado: ${deviceId}`);
  }

  /**
   * Obtiene la lista de dispositivos registrados
   */
  getRegisteredDevices(): string[] {
    return Array.from(this.validDevices);
  }

  /**
   * Obtiene el estado de un dispositivo específico
   */
  getDeviceStatus(deviceId: string): { 
    registered: boolean; 
    lastCommunication?: Date;
    minutesSinceLastComm?: number;
  } {
    const lastComm = this.lastCommunication.get(deviceId);
    const minutesSinceLastComm = lastComm 
      ? Math.round((Date.now() - lastComm) / 60000) 
      : undefined;

    return {
      registered: this.validDevices.has(deviceId),
      lastCommunication: lastComm ? new Date(lastComm) : undefined,
      minutesSinceLastComm,
    };
  }
}