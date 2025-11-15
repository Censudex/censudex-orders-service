// Importar librerías necesarias para gRPC
import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import dotenv from 'dotenv';
import { Order } from '../models/order.js';
import { OrderItem } from '../models/orderItem.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { faker } from '@faker-js/faker';
import { Op } from 'sequelize';
import { sendOrderEmail } from '../config/sendgrid.js';
import { publishToQueue } from '../config/rabbitmq.js';

dotenv.config();

// Obtener la ruta del directorio actual
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ruta al archivo de definición de protocolo gRPC
const PROTO_PATH = path.resolve(__dirname, '../proto/order.proto');

/**
 * 📦 Cargar definición del archivo .proto
 * Este archivo define la estructura de los servicios y mensajes gRPC
 */
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,           // Mantiene el caso original de las propiedades
  longs: String,            // Convierte números largos a strings
  enums: String,            // Convierte enums a strings
  defaults: true,           // Asigna valores por defecto
  oneofs: true,             // Soporta campos oneOf del proto
});

// Cargar el paquete de definiciones gRPC
const orderProto = grpc.loadPackageDefinition(packageDefinition).order;

/**
 * 📚 Implementación de métodos del servicio gRPC
 * Define todas las operaciones disponibles para órdenes
 */
const orderService = {
  /**
   * ✅ Crea una nueva orden con sus items asociados
   * @async
   * @param {Object} call - Objeto que contiene los datos de la solicitud
   * @param {Object} call.request - Datos enviados por el cliente
   * @param {string} call.request.clientId - ID del cliente
   * @param {string} call.request.clientName - Nombre del cliente
   * @param {string} call.request.shippingAddress - Dirección de envío
   * @param {Array} call.request.items - Array de items del pedido
   * @param {string} call.request.email - Email del cliente
   * @param {Function} callback - Función para enviar la respuesta
   * @returns {void}
   */
  async CreateOrder(call, callback) {
    try {
      const { clientId, clientName, shippingAddress, items, email } = call.request;

      // 🧮 Calcular el monto total sumando (precio * cantidad) de cada item
      const totalAmount = items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      );

      // Generar número de seguimiento único
      const trackingNumber = `TRK-${faker.string.alphanumeric(10).toUpperCase()}`;

      // 🗃️ Crear la orden en la base de datos con sus items relacionados
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

      // 📤 Publicar evento en RabbitMQ para notificar a otros servicios
      await publishToQueue('order.created', {
        orderId: order.id,
        trackingNumber,
        clientId,
        items,
      });

      // 📧 Enviar correo de confirmación al cliente
      await sendOrderEmail('created', order);

      // Enviar respuesta exitosa al cliente gRPC
      callback(null, { message: 'Orden creada exitosamente', order });
    } catch (error) {
      console.error('❌ Error en CreateOrder:', error);
      // Enviar error en formato gRPC
      callback({
        code: grpc.status.INTERNAL,
        message: `Error creando la orden: ${error.message}`,
      });
    }
  },

  /**
   * ✅ Obtiene todas las órdenes con filtros opcionales
   * @async
   * @param {Object} call - Objeto que contiene los parámetros de búsqueda
   * @param {string} [call.request.id] - ID de la orden (opcional)
   * @param {string} [call.request.userId] - ID del usuario/cliente (opcional)
   * @param {string} [call.request.startDate] - Fecha inicial en ISO (opcional)
   * @param {string} [call.request.endDate] - Fecha final en ISO (opcional)
   * @param {Function} callback - Función para enviar la respuesta
   * @returns {void}
   */
  async GetAllOrders(call, callback) {
    try {
      const { id, userId, startDate, endDate } = call.request;
      const filters = {};

      // Aplicar filtros si se proporcionan
      if (id) filters.id = id;
      if (userId) filters.clientId = userId;

      // Filtrar por rango de fechas si se proporcionan
      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        // Validar que las fechas sean válidas
        if (isNaN(start) || isNaN(end)) {
          return callback({
            code: grpc.status.INVALID_ARGUMENT,
            message: 'Fechas inválidas (use formato ISO: 2025-11-01T00:00:00Z)',
          });
        }
        filters.createdAt = { [Op.between]: [start, end] };
      }

      // Buscar órdenes con los filtros aplicados
      const orders = await Order.findAll({
        where: filters,
        include: [{ model: OrderItem, as: 'items' }],
        order: [['createdAt', 'DESC']],  // Ordenar de más reciente a más antiguo
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

  /**
   * ✅ Obtiene el estado de una orden por número de seguimiento
   * @async
   * @param {Object} call - Objeto que contiene el número de seguimiento
   * @param {string} call.request.trackingNumber - Número de seguimiento de la orden
   * @param {Function} callback - Función para enviar la respuesta
   * @returns {void}
   */
  async GetOrderStatus(call, callback) {
    try {
      const { trackingNumber } = call.request;
      
      // Buscar orden por número de seguimiento
      const order = await Order.findOne({ where: { trackingNumber } });

      if (!order)
        return callback({ 
          code: grpc.status.NOT_FOUND, 
          message: 'Orden no encontrada' 
        });

      // Retornar estado de la orden
      callback(null, { trackingNumber, status: order.status });
    } catch (error) {
      callback({
        code: grpc.status.INTERNAL,
        message: `Error obteniendo estado: ${error.message}`,
      });
    }
  },

  /**
   * ✅ Actualiza el estado de una orden existente
   * @async
   * @param {Object} call - Objeto que contiene ID y nuevo estado
   * @param {string} call.request.id - ID de la orden
   * @param {string} call.request.status - Nuevo estado de la orden
   * @param {Function} callback - Función para enviar la respuesta
   * @returns {void}
   */
  async UpdateOrderStatus(call, callback) {
    try {
      const { id, status } = call.request;
      
      // Buscar la orden por ID
      const order = await Order.findByPk(id);

      if (!order)
        return callback({ 
          code: grpc.status.NOT_FOUND, 
          message: 'Orden no encontrada' 
        });

      // Actualizar el estado de la orden
      order.status = status;
      await order.save();

      // 📧 Notificar cambio de estado al cliente por correo
      // Convierte estado 'enviado' a 'shipped' para el correo
      await sendOrderEmail(status === 'enviado' ? 'shipped' : status, order);

      // Retornar respuesta exitosa
      callback(null, { success: true });
    } catch (error) {
      console.error('❌ Error en UpdateOrderStatus:', error);
      callback({
        code: grpc.status.INTERNAL,
        message: `Error actualizando estado: ${error.message}`,
      });
    }
  },

  /**
   * ✅ Cancela una orden con validación de rol
   * @async
   * @param {Object} call - Objeto que contiene datos de cancelación
   * @param {string} call.request.idOrTracking - ID o número de seguimiento
   * @param {string} call.request.role - Rol del usuario ('user' o 'admin')
   * @param {string} [call.request.reason] - Motivo de cancelación (para admin)
   * @param {Function} callback - Función para enviar la respuesta
   * @returns {void}
   */
  async CancelOrder(call, callback) {
    try {
      const { idOrTracking, role, reason } = call.request;

      // Validar que se proporcionó el rol
      if (!role) {
        return callback({
          code: grpc.status.INVALID_ARGUMENT,
          message: 'Debe especificar el rol (user o admin).',
        });
      }

      // Buscar orden por ID o número de seguimiento
      const order =
        (await Order.findByPk(idOrTracking)) ||
        (await Order.findOne({ where: { trackingNumber: idOrTracking } }));

      if (!order)
        return callback({
          code: grpc.status.NOT_FOUND,
          message: 'Pedido no encontrado.',
        });

      // Cambiar estado a cancelado
      order.status = 'cancelado';
      await order.save();

      // 📧 Enviar correo de cancelación con motivo según el rol
      if (role === 'user') {
        await sendOrderEmail('cancelled', order, 'Cancelación realizada por el usuario.');
      } else {
        await sendOrderEmail('cancelled', order, `Cancelado por admin: ${reason || 'N/A'}`);
      }

      // Retornar respuesta exitosa
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

  /**
   * ✅ Obtiene el historial de órdenes de un cliente
   * @async
   * @param {Object} call - Objeto que contiene el ID del cliente
   * @param {string} call.request.clientId - ID del cliente
   * @param {Function} callback - Función para enviar la respuesta
   * @returns {void}
   */
  async GetOrderHistory(call, callback) {
    try {
      const { clientId } = call.request;
      
      // Buscar todas las órdenes del cliente incluidas sus items
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

/**
 * 🚀 Inicializa y arranca el servidor gRPC
 * Configura el servidor con los servicios implementados
 * @async
 * @returns {Promise<grpc.Server>} Promesa que resuelve al servidor gRPC iniciado
 * @throws {Error} Si no se puede vincular a los credenciales o puerto
 */
export const startGrpcService = async () => {
  // Crear nueva instancia del servidor gRPC
  const server = new grpc.Server();
  
  // Agregar el servicio de órdenes con sus implementaciones
  server.addService(orderProto.OrderService.service, orderService);
  
  // Obtener puerto del archivo .env o usar puerto por defecto
  const PORT = process.env.GRPC_PORT || 50052;

  // Vincular el servidor a un puerto y credenciales
  return new Promise((resolve, reject) => {
    server.bindAsync(
      `0.0.0.0:${PORT}`,                          // Escucha en todos los interfaces
      grpc.ServerCredentials.createInsecure(),    // Sin cifrado (desarrollo)
      (err, port) => {
        if (err) return reject(err);
        console.log(`🚀 Order gRPC Server corriendo en puerto ${port}`);
        resolve(server);
      }
    );
  });
};