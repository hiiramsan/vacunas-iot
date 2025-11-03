import amqp from 'amqplib';

const data = { device: 'ESP32-01', peso: 42.5, temperatura: 24.7 };

const run = async () => {
  const conn = await amqp.connect('amqp://localhost');
  const ch = await conn.createChannel();

  const exchange = 'amq.topic';
  const routingKey = 'cargamento_data';

  await ch.assertExchange(exchange, 'topic', { durable: true });
  ch.publish(exchange, routingKey, Buffer.from(JSON.stringify(data)));

  console.log('sending data:', data);

  await ch.close();
  await conn.close();
};

run();
