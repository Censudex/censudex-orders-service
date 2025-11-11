import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import dotenv from 'dotenv';
import { Order } from '../models/order.js';
import { OrderItem } from '../models/orderItem.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { faker } from '@faker-js/faker';
import { Op } from 'sequelize';
import { sendOrderEmail } from '../config/sendgrid.js'; // 👈 IMPORTANTE: tu módulo SendGrid
import { publishToQueue } from '../config/rabbitmq.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROTO_PATH = path.resolve(__dirname, '../proto/order.proto');

// 📦 Cargar definición del proto
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const orderProto = grpc.loadPackageDefinition(packageDefinition).order;

// 📚 Implementación de métodos del servicio gRPC
const orderService = {
  // ✅ Crear una orden
  async CreateOrder(call, callback) {
    try {
      const { clientId, clientName, shippingAddress, items, email } = call.request;

      // 🧮 Calcular total
      const totalAmount = items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      );

      const trackingNumber = `TRK-${faker.string.alphanumeric(10).toUpperCase()}`;

      // 🗃️ Crear la orden
      const order = await Order.create(
        {
          clientId,
          clientName,
          email,
          totalAmount,
          trackingNumber,
          shippingAddress,
          status: 'pendiente',
          items: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
          })),
        },
        { include: [{ model: OrderItem, as: 'items' }] }
      );
      await publishToQueue('order.created', {
        orderId: order.id,
        trackingNumber,
        clientId,
        items,
      });
      // 📧 Enviar correo de confirmación
      await sendOrderEmail('created', order);

      callback(null, { message: 'Orden creada exitosamente', order });
    } catch (error) {
      console.error('❌ Error en CreateOrder:', error);
      callback({
        code: grpc.status.INTERNAL,
        message: `Error creando la orden: ${error.message}`,
      });
    }
  },

  // ✅ Obtener todas las órdenes
  async GetAllOrders(call, callback) {
    try {
      const { id, userId, startDate, endDate } = call.request;
      const filters = {};

      if (id) filters.id = id;
      if (userId) filters.clientId = userId;

      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (isNaN(start) || isNaN(end)) {
          return callback({
            code: grpc.status.INVALID_ARGUMENT,
            message: 'Fechas inválidas (use formato ISO: 2025-11-01T00:00:00Z)',
          });
        }
        filters.createdAt = { [Op.between]: [start, end] };
      }

      const orders = await Order.findAll({
        where: filters,
        include: [{ model: OrderItem, as: 'items' }],
        order: [['createdAt', 'DESC']],
      });

      callback(null, { orders });
    } catch (error) {
      console.error('❌ Error en GetAllOrders:', error);
      callback({
        code: grpc.status.INTERNAL,
        message: `Error obteniendo órdenes: ${error.message}`,
      });
    }
  },

  // ✅ Obtener estado
  async GetOrderStatus(call, callback) {
    try {
      const { trackingNumber } = call.request;
      const order = await Order.findOne({ where: { trackingNumber } });

      if (!order)
        return callback({ code: grpc.status.NOT_FOUND, message: 'Orden no encontrada' });

      callback(null, { trackingNumber, status: order.status });
    } catch (error) {
      callback({
        code: grpc.status.INTERNAL,
        message: `Error obteniendo estado: ${error.message}`,
      });
    }
  },

  // ✅ Actualizar estado
  async UpdateOrderStatus(call, callback) {
    try {
      const { id, status } = call.request;
      const order = await Order.findByPk(id);

      if (!order)
        return callback({ code: grpc.status.NOT_FOUND, message: 'Orden no encontrada' });

      order.status = status;
      await order.save();

      // 📧 Notificar cambio de estado
      await sendOrderEmail(status === 'enviado' ? 'shipped' : status, order);

      callback(null, { success: true });
    } catch (error) {
      console.error('❌ Error en UpdateOrderStatus:', error);
      callback({
        code: grpc.status.INTERNAL,
        message: `Error actualizando estado: ${error.message}`,
      });
    }
  },

  // ✅ Cancelar orden
  async CancelOrder(call, callback) {
    try {
      const { idOrTracking, role, reason } = call.request;

      if (!role) {
        return callback({
          code: grpc.status.INVALID_ARGUMENT,
          message: 'Debe especificar el rol (user o admin).',
        });
      }

      const order =
        (await Order.findByPk(idOrTracking)) ||
        (await Order.findOne({ where: { trackingNumber: idOrTracking } }));

      if (!order)
        return callback({
          code: grpc.status.NOT_FOUND,
          message: 'Pedido no encontrado.',
        });

      order.status = 'cancelado';
      await order.save();

      // 📧 Enviar correo de cancelación
      if (role === 'user') {
        await sendOrderEmail('cancelled', order, 'Cancelación realizada por el usuario.');
      } else {
        await sendOrderEmail('cancelled', order, `Cancelado por admin: ${reason || 'N/A'}`);
      }

      callback(null, {
        success: true,
        message: `Pedido cancelado por ${role === 'admin' ? 'administrador' : 'usuario'}.`,
      });
    } catch (error) {
      console.error('❌ Error en CancelOrder:', error);
      callback({
        code: grpc.status.INTERNAL,
        message: `Error cancelando pedido: ${error.message}`,
      });
    }
  },

  // ✅ Historial de órdenes
  async GetOrderHistory(call, callback) {
    try {
      const { clientId } = call.request;
      const orders = await Order.findAll({
        where: { clientId },
        include: [{ model: OrderItem, as: 'items' }],
      });

      callback(null, { orders });
    } catch (error) {
      console.error('❌ Error en GetOrderHistory:', error);
      callback({
        code: grpc.status.INTERNAL,
        message: `Error obteniendo historial: ${error.message}`,
      });
    }
  },
};

// 🚀 Inicialización del servidor gRPC
export const startGrpcService = async () => {
  const server = new grpc.Server();
  server.addService(orderProto.OrderService.service, orderService);
  const PORT = process.env.GRPC_PORT || 50052;

  return new Promise((resolve, reject) => {
    server.bindAsync(
      `0.0.0.0:${PORT}`,
      grpc.ServerCredentials.createInsecure(),
      (err, port) => {
        if (err) return reject(err);
        console.log(`🚀 Order gRPC Server corriendo en puerto ${port}`);
        resolve(server);
      }
    );
  });
};
