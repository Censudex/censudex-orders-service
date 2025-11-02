import amqp from 'amqplib';
import dotenv from 'dotenv';
dotenv.config();

let channel;

export const connectRabbitMQ = async () => {
  try {
    const connection = await amqp.connect(process.env.RABBITMQ_URL);
    channel = await connection.createChannel();
    console.log('✅ Conectado a RabbitMQ');
  } catch (err) {
    console.error('❌ Error conectando a RabbitMQ:', err);
  }
};

export const getChannel = () => channel;
