import amqp from 'amqplib';
import dotenv from 'dotenv';
dotenv.config();

let channel;

export const connectRabbitMQ = async (retries = 10, delay = 5000) => {
  for (let i = 1; i <= retries; i++) {
    try {
      const connection = await amqp.connect(process.env.RABBITMQ_URL);
      channel = await connection.createChannel();
      console.log('✅ Conectado a RabbitMQ');
      return;
    } catch (error) {
      console.warn(`⚠️  Intento ${i} de ${retries} fallido para conectar a RabbitMQ`);
      if (i === retries) {
        console.error('❌ No se pudo conectar a RabbitMQ después de varios intentos');
        throw error;
      }
      await new Promise((res) => setTimeout(res, delay));
    }
  }
};

export const getChannel = () => channel;
