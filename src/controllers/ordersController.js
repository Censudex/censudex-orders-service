import * as orderService from '../services/orderService.js';

import { Order } from '../models/order.js';
import { OrderItem } from '../models/orderItem.js';
import { sendOrderEmail } from '../config/sendgrid.js'; // función auxiliar para enviar correos
import { publishToQueue } from '../config/rabbitmq.js'; // para publicar eventos
import { faker } from '@faker-js/faker';

/**
 * Crea un nuevo pedido con sus items asociados
 * Valida datos, calcula el total, genera número de seguimiento
 * y notifica mediante correo y RabbitMQ
 * @async
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} req.body - Cuerpo de la solicitud
 * @param {string} req.body.userId - ID del cliente
 * @param {string} req.body.clientName - Nombre del cliente
 * @param {Array} req.body.items - Array de items del pedido
 * @param {string} req.body.items[].productId - ID del producto
 * @param {number} req.body.items[].quantity - Cantidad
 * @param {number} req.body.items[].price - Precio unitario
 * @param {string} req.body.shippingAddress - Dirección de envío
 * @param {Object} res - Objeto de respuesta Express
 * @returns {Promise<void>}
 */
export const createOrder = async (req, res) => {
  try {
    const { userId, clientName, items, shippingAddress } = req.body;

    // 🔹 Validar datos básicos
    if (!userId || !clientName || !items || items.length === 0) {
      return res.status(400).json({ error: 'Faltan datos obligatorios: userId, clientName o items.' });
    }

    // 🔹 Calcular total del pedido sumando (precio * cantidad) de cada item
    const totalAmount = items.reduce((acc, item) => acc + item.price * item.quantity, 0);

    // 🔹 Generar número de seguimiento único
    const trackingNumber = `TRK-${faker.string.alphanumeric(10).toUpperCase()}`;

    // 🔹 Crear pedido con sus items asociados
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

    // 🔹 Publicar evento a RabbitMQ para notificar a otros servicios
    await publishToQueue('order.created', {
      orderId: order.id,
      trackingNumber,
      userId,
      items,
    });

    // 🔹 Enviar correo de confirmación al cliente
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

/**
 * Consulta el estado de un pedido usando su número de seguimiento
 * @async
 * @param {Object} req - Objeto de solicitud Express
 * @param {string} req.params.trackingNumber - Número de seguimiento del pedido
 * @param {Object} res - Objeto de respuesta Express
 * @returns {Promise<void>}
 */
export const getOrderStatus = async (req, res) => {
  try {
    const { trackingNumber } = req.params;

    // Buscar el pedido por número de seguimiento
    const order = await Order.findOne({ where: { trackingNumber } });

    if (!order) {
      return res.status(404).json({ error: 'Pedido no encontrado.' });
    }

    // Retorna información resumida del pedido
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

/**
 * Actualiza el estado de un pedido existente
 * Genera número de seguimiento si el estado es "enviado"
 * Notifica al cliente y publica evento en RabbitMQ
 * @async
 * @param {Object} req - Objeto de solicitud Express
 * @param {string} req.params.id - ID del pedido
 * @param {Object} req.body - Cuerpo de la solicitud
 * @param {string} req.body.status - Nuevo estado del pedido
 * @param {string} [req.body.trackingNumber] - Número de seguimiento (opcional)
 * @param {Object} res - Objeto de respuesta Express
 * @returns {Promise<void>}
 */
export const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, trackingNumber } = req.body;

    // Buscar el pedido por su ID
    const order = await Order.findByPk(id);
    if (!order) return res.status(404).json({ error: 'Pedido no encontrado.' });

    // 🔹 Actualizar estado del pedido
    order.status = status;

    // 🔹 Solo actualizar o generar trackingNumber si el estado es "enviado"
    if (status === 'enviado') {
      order.trackingNumber = trackingNumber || order.trackingNumber || `TRK-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    }

    // 🔹 Si se cancela el pedido, se elimina el trackingNumber
    if (status === 'cancelado') {
      order.trackingNumber = null;
    }

    // Guardar cambios en la base de datos
    await order.save();

    // 🔹 Enviar correo de notificación con el trackingNumber actual
    await sendOrderEmail(order, 'status', order.trackingNumber);

    // 🔹 Publicar evento de actualización en RabbitMQ
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

/**
 * Cancela un pedido con validación de rol
 * Usuarios solo pueden cancelar pedidos pendientes o en procesamiento
 * Administradores pueden cancelar cualquier pedido con motivo obligatorio
 * @async
 * @param {Object} req - Objeto de solicitud Express
 * @param {string} req.params.idOrTracking - ID del pedido o número de seguimiento
 * @param {Object} req.body - Cuerpo de la solicitud
 * @param {string} req.body.role - Rol del usuario ('user' o 'admin')
 * @param {string} [req.body.reason] - Motivo de cancelación (obligatorio para admin)
 * @param {Object} res - Objeto de respuesta Express
 * @returns {Promise<void>}
 */
export const cancelOrder = async (req, res) => {
  try {
    const { idOrTracking } = req.params; // 👈 puede ser id o trackingNumber
    const { role, reason } = req.body; // 👈 Recibe rol y motivo opcional

    // Validar que se proporcionó el rol
    if (!role) {
      return res.status(400).json({ error: 'Debe especificar el rol (user o admin).' });
    }

    // 🔍 Buscar pedido por ID o número de seguimiento
    const order =
      (await Order.findByPk(idOrTracking)) ||
      (await Order.findOne({ where: { trackingNumber: idOrTracking } }));

    if (!order) {
      return res.status(404).json({ error: 'Pedido no encontrado.' });
    }

    // 🔹 CASO 1: Cancelación por usuario
    if (role === 'user') {
      // Los usuarios solo pueden cancelar pedidos en estado pendiente o en procesamiento
      if (order.status !== 'pendiente' && order.status !== 'en procesamiento') {
        return res.status(403).json({
          error: 'El usuario solo puede cancelar pedidos pendientes o en procesamiento.',
        });
      }

      order.status = 'cancelado';
      await order.save();

      // Notificar al cliente y publicar evento
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

    // 🔹 CASO 2: Cancelación por administrador
    if (role === 'admin') {
      // Admin debe proporcionar un motivo de cancelación
      if (!reason || reason.trim() === '') {
        return res.status(400).json({
          error: 'El administrador debe proporcionar una razón de cancelación.',
        });
      }

      order.status = 'cancelado';
      await order.save();

      // Notificar al cliente incluyendo el motivo
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

/**
 * Obtiene el historial de todos los pedidos de un cliente
 * Ordena los resultados por fecha de creación descendente
 * @async
 * @param {Object} req - Objeto de solicitud Express
 * @param {string} req.params.clientId - ID del cliente
 * @param {Object} res - Objeto de respuesta Express
 * @returns {Promise<void>}
 */
export const getOrderHistory = async (req, res) => {
  try {
    const { clientId } = req.params;

    // Buscar todos los pedidos del cliente, incluye sus items
    const orders = await Order.findAll({
      where: { clientId },
      include: { model: OrderItem, as: 'items' },
      order: [['createdAt', 'DESC']],  // Ordena de más reciente a más antiguo
    });

    res.json(orders);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener historial.' });
  }
};

/**
 * Obtiene todos los pedidos con filtros opcionales
 * Puede filtrar por ID, rango de fechas y usuario
 * @async
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} req.query - Parámetros de búsqueda
 * @param {string} [req.query.id] - ID del pedido (opcional)
 * @param {string} [req.query.startDate] - Fecha inicial (opcional)
 * @param {string} [req.query.endDate] - Fecha final (opcional)
 * @param {string} [req.query.userId] - ID del usuario/cliente (opcional)
 * @param {Object} res - Objeto de respuesta Express
 * @returns {Promise<void>}
 */
export const getAllOrders = async (req, res) => {
  try {
    const { id, startDate, endDate, userId } = req.query;

    // Construir objeto con filtros dinámicos
    const filters = {};
    if (id) filters.id = id;
    if (userId) filters.userId = userId;
    if (startDate && endDate)
      filters.createdAt = { [Op.between]: [new Date(startDate), new Date(endDate)] };

    // Buscar pedidos con los filtros especificados
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