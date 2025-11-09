import amqp from 'amqplib';
import dotenv from 'dotenv';
dotenv.config();

let channel;

// 🟢 Conectar a RabbitMQ con reintentos
export const connectRabbitMQ = async (retries = 10, delay = 5000) => {
  for (let i = 1; i <= retries; i++) {
    try {
      const connection = await amqp.connect(process.env.RABBITMQ_URL);
      channel = await connection.createChannel();

      // Aseguramos que la conexión se cierre bien
      connection.on('close', () => {
        console.warn('⚠️ Conexión a RabbitMQ cerrada');
        channel = null;
      });

      connection.on('error', (err) => {
        console.error('❌ Error en conexión RabbitMQ:', err);
        channel = null;
      });

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

// 🔹 Obtener canal actual
export const getChannel = () => channel;

// 📨 Publicar un mensaje en una cola (para tus endpoints)
export const publishToQueue = async (routingKey, message) => {
  if (!channel) {
    console.error('❌ No hay canal RabbitMQ activo');
    return;
  }

  try {
    const exchange = 'order_events';
    await channel.assertExchange(exchange, 'topic', { durable: true });

    // 🔹 Construimos un mensaje al estilo MassTransit
    const massTransitMessage = {
      messageId: crypto.randomUUID(),
      messageType: ['urn:message:InventoryService.Src.Messages:OrderCreatedMessage'],
      message: {
        OrderId: message.orderId,
        TrackingNumber: message.trackingNumber || null,
        UserId: message.userId,
        Items: message.items || [],
        CreatedAt: new Date().toISOString(),
      },
    };

    channel.publish(
      exchange,
      routingKey, // ejemplo: 'order.created'
      Buffer.from(JSON.stringify(massTransitMessage)),
      { persistent: true }
    );

    console.log(`📦 Mensaje MassTransit publicado en "${exchange}" con routingKey "${routingKey}"`);
    console.log(massTransitMessage);
  } catch (error) {
    console.error('❌ Error publicando mensaje en RabbitMQ:', error);
  }
};

