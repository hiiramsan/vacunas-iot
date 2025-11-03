import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { InfluxService } from './influx.service';

@Controller()
export class CargamentoService {
  constructor(private influxService: InfluxService) {}

  @MessagePattern('cargamento_data')
  async handleCargamentoData(@Payload() data: any) {
    console.log('received data:', data);
    await this.influxService.writeMeasurement(data);
  }
}