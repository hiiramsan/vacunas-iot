import { Injectable, Logger } from '@nestjs/common';
import { InfluxDB, Point } from '@influxdata/influxdb-client';

@Injectable()
export class InfluxService {
  private readonly logger = new Logger(InfluxService.name);
  private influx;
  private writeApi;

  constructor() {
    const url = process.env.INFLUX_URL || 'http://influxdb:8086';
    const token = process.env.INFLUX_TOKEN || 'mytoken';
    const org = process.env.INFLUX_ORG || 'myorg';
    const bucket = process.env.INFLUX_BUCKET || 'cargamentos';

    this.influx = new InfluxDB({ url, token });
    this.writeApi = this.influx.getWriteApi(org, bucket);
    
    this.logger.log('✅ InfluxDB Service inicializado');
  }

  /**
   * Escribe una medición en InfluxDB
   * Ahora soporta todos los campos del simulador mejorado
   */
  async writeMeasurement(data: any) {
    try {
      const deviceId = data.device || data.device_id;
      
      const point = new Point('sensor_data')
        .tag('device_id', deviceId);

      // Campos obligatorios
      if (data.temperatura !== undefined) {
        point.floatField('temperatura', parseFloat(data.temperatura));
      }
      
      if (data.peso !== undefined) {
        point.floatField('peso', parseFloat(data.peso));
      }

      // Campos opcionales (para simulador mejorado)
      if (data.humedad !== undefined) {
        point.floatField('humedad', parseFloat(data.humedad));
      }

      if (data.latitud !== undefined) {
        point.floatField('latitud', parseFloat(data.latitud));
      }

      if (data.longitud !== undefined) {
        point.floatField('longitud', parseFloat(data.longitud));
      }

      // Timestamp
      if (data.timestamp) {
        point.timestamp(new Date(data.timestamp));
      } else {
        point.timestamp(new Date());
      }

      this.writeApi.writePoint(point);
      await this.writeApi.flush();
      
    } catch (error) {
      this.logger.error(`Error escribiendo en InfluxDB: ${error}`);
      throw error;
    }
  }
}