import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CargamentoService } from './cargamento.service';
import { InfluxService } from './influx.service';
import { QualityAssuranceService } from './quality-assurance.service';
import { NotificationService } from './notification.service';

@Module({
  imports: [],
  controllers: [
    AppController,
  ],
  providers: [
    AppService,
    CargamentoService,
    InfluxService,
    QualityAssuranceService, 
    NotificationService,   
  ],
})
export class AppModule {}