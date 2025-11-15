// Importar la librería amqplib para conectar con RabbitMQ
import amqp from 'amqplib';
// Importar dotenv para cargar variables de entorno
import dotenv from 'dotenv';
dotenv.config();

// Variable global que almacena el canal de RabbitMQ
let channel;

/**
 * Conecta a RabbitMQ con sistema de reintentos automáticos
 * Intenta reconectarse múltiples veces antes de fallar definitivamente
 * @async
 * @param {number} retries - Número máximo de intentos de conexión (por defecto 10)
 * @param {number} delay - Tiempo en milisegundos entre reintentos (por defecto 5000ms)
 * @returns {Promise<void>}
 * @throws {Error} Si no logra conectar después de todos los intentos
 */
export const connectRabbitMQ = async (retries = 10, delay = 5000) => {
  for (let i = 1; i <= retries; i++) {
    try {
      // Establece conexión con RabbitMQ usando la URL desde variables de entorno
      const connection = await amqp.connect(process.env.RABBITMQ_URL);
      // Crea un canal para comunicarse con RabbitMQ
      channel = await connection.createChannel();

      // Escucha cuando se cierra la conexión
      connection.on('close', () => {
        console.warn('⚠️ Conexión a RabbitMQ cerrada');
        channel = null;
      });

      // Escucha errores en la conexión
      connection.on('error', (err) => {
        console.error('❌ Error en conexión RabbitMQ:', err);
        channel = null;
      });

      console.log('✅ Conectado a RabbitMQ');
      return;
    } catch (error) {
      // Muestra intento fallido
      console.warn(`⚠️  Intento ${i} de ${retries} fallido para conectar a RabbitMQ`);
      // Si es el último intento, lanza error
      if (i === retries) {
        console.error('❌ No se pudo conectar a RabbitMQ después de varios intentos');
        throw error;
      }
      // Espera antes de reintentar
      await new Promise((res) => setTimeout(res, delay));
    }
  }
};

/**
 * Obtiene el canal activo de RabbitMQ
 * @returns {Object|null} El canal de RabbitMQ o null si no está conectado
 */
export const getChannel = () => channel;

/**
 * Publica un mensaje en una cola de RabbitMQ con formato MassTransit
 * Utiliza un exchange de tipo "topic" para enrutamiento dinámico
 * @async
 * @param {string} routingKey - Clave de enrutamiento (ej: 'order.created')
 * @param {Object} message - Objeto con datos del mensaje
 * @param {string} message.orderId - ID de la orden
 * @param {string} [message.trackingNumber] - Número de seguimiento (opcional)
 * @param {string} message.userId - ID del usuario
 * @param {Array} [message.items] - Lista de items en la orden (opcional)
 * @returns {Promise<void>}
 */
export const publishToQueue = async (routingKey, message) => {
  // Verifica que el canal esté activo
  if (!channel) {
    console.error('❌ No hay canal RabbitMQ activo');
    return;
  }

  try {
    const exchange = 'order_events';
    // Asegura que el exchange existe y es de tipo "topic"
    await channel.assertExchange(exchange, 'topic', { durable: true });

    // Construye mensaje con formato compatible con MassTransit
    const massTransitMessage = {
      messageId: crypto.randomUUID(),  // ID único del mensaje
      messageType: ['urn:message:InventoryService.Src.Messages:OrderCreatedMessage'],  // Tipo de mensaje
      message: {
        OrderId: message.orderId,
        TrackingNumber: message.trackingNumber || null,
        UserId: message.userId,
        Items: message.items || [],
        CreatedAt: new Date().toISOString(),
      },
    };

    // Publica el mensaje en el exchange
    channel.publish(
      exchange,
      routingKey,  // Define qué suscriptores reciben este mensaje
      Buffer.from(JSON.stringify(massTransitMessage)),
      { persistent: true }  // Persiste el mensaje en disco
    );

    console.log(`📦 Mensaje MassTransit publicado en "${exchange}" con routingKey "${routingKey}"`);
    console.log(massTransitMessage);
  } catch (error) {
    console.error('❌ Error publicando mensaje en RabbitMQ:', error);
  }
};