import { InfluxDB, Point } from "@influxdata/influxdb-client";

export class InfluxService {
  private influx;
  private writeApi;

  constructor() {
    const url = process.env.INFLUX_URL || 'http://influxdb:8086';
    const token = process.env.INFLUX_TOKEN || 'mytoken';
    const org = process.env.INFLUX_ORG || 'myorg';
    const bucket = process.env.INFLUX_BUCKET || 'cargamentos';

    this.influx = new InfluxDB({ url, token });
    this.writeApi = this.influx.getWriteApi(org, bucket);
  }

  async writeMeasurement(data: any) {
    const point = new Point('cargamento')
      .tag('device', data.device)
      .floatField('peso', data.peso)
      .floatField('temperatura', data.temperatura)
      .timestamp(new Date());

    this.writeApi.writePoint(point);
    await this.writeApi.flush();
  }
}