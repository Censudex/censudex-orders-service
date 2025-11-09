import * as orderService from '../services/orderService.js';

import { Order } from '../models/order.js';
import { OrderItem } from '../models/orderItem.js';
import { sendOrderEmail } from '../config/sendgrid.js'; // función auxiliar para enviar correos
import { publishToQueue } from '../config/rabbitmq.js'; // para publicar eventos
import { faker } from '@faker-js/faker';

export const createOrder = async (req, res) => {
  try {
    const { userId, clientName, items, shippingAddress } = req.body;

    // 🔹 Validar datos básicos
    if (!userId || !clientName || !items || items.length === 0) {
      return res.status(400).json({ error: 'Faltan datos obligatorios: userId, clientName o items.' });
    }


    // 🔹 Calcular total del pedido
    const totalAmount = items.reduce((acc, item) => acc + item.price * item.quantity, 0);

    // 🔹 Generar número de seguimiento
    const trackingNumber = `TRK-${faker.string.alphanumeric(10).toUpperCase()}`;

    // 🔹 Crear pedido con sus items
    const order = await Order.create(
      {
        shippingAddress,
        clientId: userId,
        clientName,
        totalAmount,
        trackingNumber,
        status: 'pendiente',
        items: items.map(i => ({
          productId: i.productId,
          quantity: i.quantity,
          price: i.price
        })),
      },
      { include: [{ model: OrderItem, as: 'items' }] }
    );

    // 🔹 Publicar evento RabbitMQ
    await publishToQueue('order.created', {
      orderId: order.id,
      trackingNumber,
      userId,
      items,
    });

    // 🔹 Enviar correo con SendGrid
    await sendOrderEmail(order, 'created');

    res.status(201).json({
      message: 'Pedido creado con éxito',
      order
    });

  } catch (error) {
    console.error('❌ Error al crear el pedido:', error);
    res.status(500).json({ error: 'Error al crear el pedido.' });
  }
};


// 🔵 Consultar estado de pedido
export const getOrderStatus = async (req, res) => {
  try {
    const { trackingNumber } = req.params;

    // Buscar el pedido por trackingNumber
    const order = await Order.findOne({ where: { trackingNumber } });

    if (!order) {
      return res.status(404).json({ error: 'Pedido no encontrado.' });
    }

    res.json({
      trackingNumber: order.trackingNumber,
      status: order.status,
      clientName: order.clientName,
      totalAmount: order.totalAmount,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al consultar estado del pedido.' });
  }
};

export const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, trackingNumber } = req.body;

    const order = await Order.findByPk(id);
    if (!order) return res.status(404).json({ error: 'Pedido no encontrado.' });

    // 🔹 Actualizar estado
    order.status = status;

    // 🔹 Solo actualizar o generar trackingNumber si el estado es "enviado"
    if (status === 'enviado') {
      order.trackingNumber = trackingNumber || order.trackingNumber || `TRK-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    }

    // 🔹 Si se cancela el pedido, se puede borrar el trackingNumber opcionalmente
    if (status === 'cancelado') {
      order.trackingNumber = null;
    }

    await order.save();

    // 🔹 Enviar correo (usa el trackingNumber actual del pedido)
    await sendOrderEmail(order, 'status', order.trackingNumber);

    // 🔹 Publicar evento (con trackingNumber actual si existe)
    await publishToQueue('order.updated', {
      orderId: id,
      status,
      trackingNumber: order.trackingNumber,
    });

    res.json({ message: 'Estado actualizado correctamente.', order });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar estado.' });
  }
};


// 🔴 Cancelar pedido por ID o Tracking Number con validación de rol
export const cancelOrder = async (req, res) => {
  try {
    const { idOrTracking } = req.params; // 👈 puede ser id o trackingNumber
    const { role, reason } = req.body; // 👈 Recibe rol y motivo opcional

    if (!role) {
      return res.status(400).json({ error: 'Debe especificar el rol (user o admin).' });
    }

    // 🔍 Buscar pedido por id o trackingNumber
    const order =
      (await Order.findByPk(idOrTracking)) ||
      (await Order.findOne({ where: { trackingNumber: idOrTracking } }));

    if (!order) {
      return res.status(404).json({ error: 'Pedido no encontrado.' });
    }

    // 🔹 Caso 1: user
    if (role === 'user') {
      if (order.status !== 'pendiente' && order.status !== 'en procesamiento') {
        return res.status(403).json({
          error: 'El usuario solo puede cancelar pedidos pendientes o en procesamiento.',
        });
      }

      order.status = 'cancelado';
      await order.save();

      await sendOrderEmail(order, 'cancelled', 'Cancelación realizada por el usuario.');
      await publishToQueue('order.cancelled', {
        orderId: order.id,
        cancelledBy: 'usuario',
      });

      return res.json({
        message: 'Pedido cancelado por el usuario.',
        order,
      });
    }

    // 🔹 Caso 2: admin
    if (role === 'admin') {
      if (!reason || reason.trim() === '') {
        return res.status(400).json({
          error: 'El administrador debe proporcionar una razón de cancelación.',
        });
      }

      order.status = 'cancelado';
      await order.save();

      await sendOrderEmail(order, 'cancelled', `Cancelado por admin: ${reason}`);
      await publishToQueue('order.cancelled', {
        orderId: order.id,
        cancelledBy: 'admin',
        reason,
      });

      return res.json({
        message: 'Pedido cancelado por el administrador.',
        order,
      });
    }

    // 🔹 Si el rol no es válido
    return res.status(400).json({ error: 'Rol inválido. Debe ser "user" o "admin".' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al cancelar pedido.' });
  }
};



// 🟣 Historial de pedidos
export const getOrderHistory = async (req, res) => {
  try {
    const { clientId } = req.params;
    const orders = await Order.findAll({
      where: { clientId },
      include: { model: OrderItem, as: 'items' },
      order: [['createdAt', 'DESC']],
    });

    res.json(orders);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener historial.' });
  }
};

// 🟡 Filtros: ID, fecha, cliente
export const getAllOrders = async (req, res) => {
  try {
    const { id, startDate, endDate, userId } = req.query;

    const filters = {};
    if (id) filters.id = id;
    if (userId) filters.userId = userId;
    if (startDate && endDate)
      filters.createdAt = { [Op.between]: [new Date(startDate), new Date(endDate)] };

    const orders = await Order.findAll({
      where: filters,
      include: { model: OrderItem, as: 'items' },
    });

    res.json(orders);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener pedidos.' });
  }
};
