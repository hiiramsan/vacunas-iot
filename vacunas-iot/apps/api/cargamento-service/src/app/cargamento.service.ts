import { Injectable, OnModuleInit } from '@nestjs/common';
import * as amqp from 'amqplib';
import { InfluxService } from './influx.service';

@Injectable()
export class CargamentoService implements OnModuleInit {
  constructor(private influxService: InfluxService) {}

  async onModuleInit() {
    try {
      const connection = await amqp.connect(
        process.env.RABBITMQ_URL || 'amqp://guest:guest@rabbitmq:5672'
      );
      const channel = await connection.createChannel();

      const queue = 'cargamento_queue';
      await channel.assertQueue(queue, { durable: true });

      console.log('Esperando mensajes de RabbitMQ en:', queue);

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
    } catch (error) {
      console.error('Error conectando a RabbitMQ:', error);
    }
  }
}