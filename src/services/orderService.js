// Importar modelos de datos
import { Order, OrderItem } from '../models/index.js';
// Importar función para obtener el canal de RabbitMQ
import { getChannel } from '../config/rabbitmq.js';
// Importar función para enviar correos
import { sendEmail } from '../config/sendgrid.js';

/**
 * 📝 Crea una nueva orden con sus items asociados
 * Guarda la orden en la base de datos, publica evento en RabbitMQ 
 * y envía correo de confirmación al cliente
 * 
 * @async
 * @param {Object} orderData - Datos de la orden a crear
 * @param {string} orderData.clientId - ID del cliente
 * @param {number} orderData.totalAmount - Monto total de la orden
 * @param {Array} orderData.items - Array de items del pedido
 * @param {string} orderData.items[].productId - ID del producto
 * @param {number} orderData.items[].quantity - Cantidad del producto
 * @param {number} orderData.items[].price - Precio unitario
 * @param {string} orderData.email - Email del cliente para notificación
 * @returns {Promise<Order>} Orden creada con sus datos
 * @throws {Error} Si hay error al crear la orden o enviar notificaciones
 * 
 * @example
 * const newOrder = await createOrder({
 *   clientId: '123e4567-e89b-12d3-a456-426614174000',
 *   totalAmount: 99.98,
 *   items: [
 *     { productId: 'prod1', quantity: 2, price: 49.99 }
 *   ],
 *   email: 'cliente@example.com'
 * });
 */
export const createOrder = async (orderData) => {
  // 📦 Crear la orden en la base de datos
  const order = await Order.create({
    clientId: orderData.clientId,
    totalAmount: orderData.totalAmount,
  });

  // 🔁 Iterar sobre cada item y crear registros en la tabla OrderItem
  for (const item of orderData.items) {
    await OrderItem.create({
      orderId: order.id,                // Vincular item con la orden creada
      productId: item.productId,        // ID del producto
      quantity: item.quantity,          // Cantidad del producto
      price: item.price,                // Precio unitario
    });
  }

  // 📤 Publicar evento en RabbitMQ para notificar a otros servicios
  // El canal debe estar activo (conectado previamente)
  const channel = getChannel();
  
  // Asegurar que la cola existe
  await channel.assertQueue('order.created');
  
  // Enviar mensaje a la cola con los datos de la orden
  channel.sendToQueue(
    'order.created', 
    Buffer.from(JSON.stringify(orderData))
  );
  console.log(`📤 Evento enviado: order.created`);

  // 📧 Enviar correo de confirmación al cliente
  await sendEmail(
    orderData.email,                              // Destinatario
    'Pedido creado',                              // Asunto
    `Tu pedido ${order.id} fue creado con éxito.` // Contenido
  );

  // ✅ Retornar la orden creada
  return order;
};

/**
 * 🔍 Obtiene todas las órdenes con sus items asociados
 * Carga las órdenes desde la base de datos incluyendo sus artículos
 * 
 * @async
 * @returns {Promise<Array<Order>>} Array con todas las órdenes
 * @throws {Error} Si hay error al consultar la base de datos
 * 
 * @example
 * const allOrders = await getOrders();
 * console.log(allOrders[0].items); // Items de la primera orden
 */
export const getOrders = async () => {
  return await Order.findAll({ 
    include: 'items'  // Incluir los items asociados a cada orden
  });
};

/**
 * 🆔 Obtiene una orden específica por su ID
 * Carga la orden y todos sus items asociados
 * 
 * @async
 * @param {string} id - ID de la orden a buscar (UUID)
 * @returns {Promise<Order|null>} Orden encontrada o null si no existe
 * @throws {Error} Si hay error al consultar la base de datos
 * 
 * @example
 * const order = await getOrderById('123e4567-e89b-12d3-a456-426614174000');
 * if (order) {
 *   console.log(`Orden: ${order.id}`);
 *   console.log(`Items: ${order.items.length}`);
 * }
 */
export const getOrderById = async (id) => {
  return await Order.findByPk(id, { 
    include: 'items'  // Incluir los items asociados a la orden
  });
};

/**
 * 🔄 Actualiza el estado de una orden existente
 * 
 * @async
 * @param {string} id - ID de la orden a actualizar
 * @param {Object} updateData - Datos a actualizar
 * @param {string} [updateData.status] - Nuevo estado de la orden
 * @returns {Promise<Order>} Orden actualizada
 * @throws {Error} Si la orden no existe o hay error en la base de datos
 * 
 * @example
 * const updated = await updateOrder('123e4567-e89b-12d3-a456-426614174000', {
 *   status: 'enviado'
 * });
 */
export const updateOrder = async (id, updateData) => {
  // Buscar la orden por ID
  const order = await Order.findByPk(id);
  
  if (!order) {
    throw new Error(`Orden con ID ${id} no encontrada`);
  }
  
  // Actualizar los campos especificados
  await order.update(updateData);
  
  return order;
};

/**
 * ❌ Elimina una orden y todos sus items asociados
 * 
 * @async
 * @param {string} id - ID de la orden a eliminar
 * @returns {Promise<boolean>} true si se eliminó exitosamente
 * @throws {Error} Si la orden no existe o hay error en la base de datos
 * 
 * @example
 * const deleted = await deleteOrder('123e4567-e89b-12d3-a456-426614174000');
 * if (deleted) {
 *   console.log('Orden eliminada');
 * }
 */
export const deleteOrder = async (id) => {
  // Buscar la orden por ID
  const order = await Order.findByPk(id);
  
  if (!order) {
    throw new Error(`Orden con ID ${id} no encontrada`);
  }
  
  // Eliminar la orden (los items se eliminan automáticamente por cascada)
  await order.destroy();
  
  return true;
};