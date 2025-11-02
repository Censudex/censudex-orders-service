import { Order, OrderItem } from '../models/index.js';
import { getChannel } from '../config/rabbitmq.js';
import { sendEmail } from '../config/sendgrid.js';

export const createOrder = async (orderData) => {
  const order = await Order.create({
    clientId: orderData.clientId,
    totalAmount: orderData.totalAmount,
  });

  for (const item of orderData.items) {
    await OrderItem.create({
      orderId: order.id,
      productId: item.productId,
      quantity: item.quantity,
      price: item.price,
    });
  }

  // Publicar evento en RabbitMQ
  const channel = getChannel();
  await channel.assertQueue('order.created');
  channel.sendToQueue('order.created', Buffer.from(JSON.stringify(orderData)));
  console.log(`📤 Evento enviado: order.created`);

  // Enviar correo de confirmación
  await sendEmail(orderData.email, 'Pedido creado', `Tu pedido ${order.id} fue creado con éxito.`);

  return order;
};

export const getOrders = async () => await Order.findAll({ include: 'items' });
export const getOrderById = async (id) => await Order.findByPk(id, { include: 'items' });
