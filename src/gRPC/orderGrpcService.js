import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import dotenv from 'dotenv';
import { Order } from '../models/order.js';
import { OrderItem } from '../models/orderItem.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { faker } from '@faker-js/faker';
import { Op } from 'sequelize';

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
  // Crear una orden
async CreateOrder(call, callback) {
  try {
    const { clientId, clientName, shippingAddress, items } = call.request;

    // 🧮 Calcular el totalAmount sumando (price * quantity) de cada item
    const totalAmount = items.reduce(
      (sum, item) => sum + (item.price * item.quantity),
      0
    );
    const trackingNumber = `TRK-${faker.string.alphanumeric(10).toUpperCase()}`;
    // 🗃️ Crear la orden con el total calculado
    const order = await Order.create(
      {
        clientId,
        clientName,
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

    callback(null, { message: 'Order created successfully', order });
  } catch (error) {
    callback({
      code: grpc.status.INTERNAL,
      message: `Error creating order: ${error.message}`,
    });
  }
},


async GetAllOrders(call, callback) {
try {
    const { id, userId, startDate, endDate } = call.request;
    const filters = {};

    // 🔹 Filtrar por ID
    if (id) filters.id = id;

    // 🔹 Filtrar por usuario
    if (userId) filters.clientId = userId;

    // 🔹 Filtrar por rango de fechas (con validación)
    if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start) || isNaN(end)) {
        return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'Las fechas deben tener un formato válido (ejemplo: 2025-11-01T00:00:00Z)',
        });
    }

    filters.createdAt = { [Op.between]: [start, end] };
    }

    // 🔹 Consultar base de datos
    const orders = await Order.findAll({
    where: filters,
    include: [{ model: OrderItem, as: 'items' }],
    order: [['createdAt', 'DESC']],
    });

    // ✅ Respuesta exitosa
    callback(null, { orders });
} catch (error) {
    console.error('Error fetching orders:', error);
    callback({
    code: grpc.status.INTERNAL,
    message: `Error fetching orders: ${error.message}`,
    });
}
},

  // Obtener estado de una orden
  async GetOrderStatus(call, callback) {
    try {
      const { trackingNumber } = call.request;
      const order = await Order.findOne({ where: { trackingNumber } });

      if (!order)
        return callback({ code: grpc.status.NOT_FOUND, message: 'Order not found' });

      callback(null, { trackingNumber, status: order.status });
    } catch (error) {
      callback({
        code: grpc.status.INTERNAL,
        message: `Error getting order status: ${error.message}`,
      });
    }
  },

  // Actualizar estado
  async UpdateOrderStatus(call, callback) {
    try {
      const { id, status } = call.request;
      const order = await Order.findByPk(id);

      if (!order)
        return callback({ code: grpc.status.NOT_FOUND, message: 'Order not found' });

      order.status = status;
      await order.save();

      callback(null, { success: true });
    } catch (error) {
      callback({success: false});
    }
  },

  // Cancelar orden
async CancelOrder(call, callback) {
  try {
    const { idOrTracking, role, reason } = call.request;

    if (!role) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'Debe especificar el rol (user o admin).',
      });
    }

    // 🔍 Buscar pedido por id o trackingNumber
    const order =
      (await Order.findByPk(idOrTracking)) ||
      (await Order.findOne({ where: { trackingNumber: idOrTracking } }));

    if (!order) {
      return callback({
        code: grpc.status.NOT_FOUND,
        message: 'Pedido no encontrado.',
      });
    }

    // 🔹 Caso 1: usuario
    if (role === 'user') {
      if (order.status !== 'pendiente' && order.status !== 'en procesamiento') {
        return callback({
          code: grpc.status.PERMISSION_DENIED,
          message:
            'El usuario solo puede cancelar pedidos pendientes o en procesamiento.',
        });
      }

      order.status = 'cancelado';
      await order.save();

      // Si usas RabbitMQ o correos:
      // await sendOrderEmail(order, 'cancelled', 'Cancelación realizada por el usuario.');
      // await publishToQueue('order.cancelled', { orderId: order.id, cancelledBy: 'usuario' });

      return callback(null, {
        success: true,
        message: 'Pedido cancelado por el usuario.',
      });
    }

    // 🔹 Caso 2: administrador
    if (role === 'admin') {
      if (!reason || reason.trim() === '') {
        return callback({
          code: grpc.status.INVALID_ARGUMENT,
          message:
            'El administrador debe proporcionar una razón de cancelación.',
        });
      }

      order.status = 'cancelado';
      await order.save();

      // await sendOrderEmail(order, 'cancelled', `Cancelado por admin: ${reason}`);
      // await publishToQueue('order.cancelled', { orderId: order.id, cancelledBy: 'admin', reason });

      return callback(null, {
        success: true,
        message: 'Pedido cancelado por el administrador.',
      });
    }

    // 🔹 Si el rol no es válido
    return callback({
      code: grpc.status.INVALID_ARGUMENT,
      message: 'Rol inválido. Debe ser "user" o "admin".',
    });
  } catch (error) {
    console.error('Error al cancelar pedido:', error);
    callback({
      code: grpc.status.INTERNAL,
      message: `Error al cancelar pedido: ${error.message}`,
    });
  }
},

  // Historial de órdenes por cliente
  async GetOrderHistory(call, callback) {
    try {
      const { clientId } = call.request;
      const orders = await Order.findAll({
        where: { clientId },
        include: [{ model: OrderItem, as: 'items' }],
      });

      callback(null, { orders });
    } catch (error) {
      callback({
        code: grpc.status.INTERNAL,
        message: `Error fetching order history: ${error.message}`,
      });
    }
  },
};

// 🚀 Función para iniciar el servidor gRPC
export const startGrpcService = async () => {
  const server = new grpc.Server();

  console.log('📂 PROTO_PATH:', PROTO_PATH);
  console.log('🧩 Loaded proto definition keys:', Object.keys(orderProto));

  server.addService(orderProto.OrderService.service, orderService);


  const PORT = process.env.GRPC_PORT || 50052;

  return new Promise((resolve, reject) => {
    server.bindAsync(
      `0.0.0.0:${PORT}`,
      grpc.ServerCredentials.createInsecure(),
      (err, port) => {
        if (err) {
          console.error('❌ Error iniciando gRPC:', err);
          return reject(err);
        }
        console.log(`🚀 Order gRPC Server corriendo en puerto ${port}`);
        resolve(server);
      }
    );
  });
};
