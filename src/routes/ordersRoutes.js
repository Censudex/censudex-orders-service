// Importar la clase Router de Express para definir rutas
import { Router } from 'express';
// Importar todas las funciones del controlador de órdenes
import * as ordersController from '../controllers/ordersController.js';

// Crear instancia del enrutador
const router = Router();

/**
 * 📮 POST /
 * Crea una nueva orden con sus items asociados
 * 
 * @route POST /orders
 * @param {Object} req.body - Cuerpo de la solicitud
 * @param {string} req.body.userId - ID del cliente
 * @param {string} req.body.clientName - Nombre del cliente
 * @param {Array} req.body.items - Array de items del pedido
 * @param {string} req.body.shippingAddress - Dirección de envío
 * @returns {Object} Orden creada con código 201
 * 
 * @example
 * POST /orders
 * {
 *   "userId": "123e4567-e89b-12d3-a456-426614174000",
 *   "clientName": "Juan Pérez",
 *   "items": [
 *     { "productId": "prod1", "quantity": 2, "price": 29.99 }
 *   ],
 *   "shippingAddress": "Calle Principal 123"
 * }
 */
router.post('/', ordersController.createOrder);

/**
 * 🔍 GET /
 * Obtiene todas las órdenes con filtros opcionales
 * 
 * @route GET /orders
 * @query {string} [id] - Filtro por ID de orden
 * @query {string} [userId] - Filtro por ID del usuario
 * @query {string} [startDate] - Filtro por fecha inicial (ISO 8601)
 * @query {string} [endDate] - Filtro por fecha final (ISO 8601)
 * @returns {Array} Lista de órdenes encontradas
 * 
 * @example
 * GET /orders?userId=123e4567-e89b-12d3-a456-426614174000
 * GET /orders?startDate=2025-11-01&endDate=2025-11-15
 */
router.get('/', ordersController.getAllOrders);

/**
 * 📦 GET /:trackingNumber/status
 * Consulta el estado de una orden usando su número de seguimiento
 * 
 * @route GET /orders/:trackingNumber/status
 * @param {string} trackingNumber - Número de seguimiento de la orden
 * @returns {Object} Estado y detalles de la orden
 * 
 * @example
 * GET /orders/TRK-ABC123XYZ/status
 * 
 * Respuesta:
 * {
 *   "trackingNumber": "TRK-ABC123XYZ",
 *   "status": "enviado",
 *   "clientName": "Juan Pérez",
 *   "totalAmount": 59.98
 * }
 */
router.get('/:trackingNumber/status', ordersController.getOrderStatus);

/**
 * 🔄 PATCH /:id/status
 * Actualiza el estado de una orden existente
 * Genera número de seguimiento si el estado es "enviado"
 * 
 * @route PATCH /orders/:id/status
 * @param {string} id - ID de la orden a actualizar
 * @param {Object} req.body - Cuerpo de la solicitud
 * @param {string} req.body.status - Nuevo estado: 'pendiente', 'en procesamiento', 'enviado', 'entregado', 'cancelado'
 * @param {string} [req.body.trackingNumber] - Número de seguimiento (opcional)
 * @returns {Object} Orden actualizada
 * 
 * @example
 * PATCH /orders/123e4567-e89b-12d3-a456-426614174000/status
 * {
 *   "status": "enviado",
 *   "trackingNumber": "TRK-XYZ789ABC"
 * }
 */
router.patch('/:id/status', ordersController.updateOrderStatus);

/**
 * ❌ PATCH /:idOrTracking/cancel
 * Cancela una orden con validación de rol
 * Usuarios: solo pueden cancelar pedidos pendientes o en procesamiento
 * Administradores: pueden cancelar cualquier pedido con motivo obligatorio
 * 
 * @route PATCH /orders/:idOrTracking/cancel
 * @param {string} idOrTracking - ID de la orden o número de seguimiento
 * @param {Object} req.body - Cuerpo de la solicitud
 * @param {string} req.body.role - Rol del usuario: 'user' o 'admin'
 * @param {string} [req.body.reason] - Motivo de cancelación (obligatorio para admin)
 * @returns {Object} Orden cancelada con mensaje de confirmación
 * 
 * @example
 * // Cancelación por usuario
 * PATCH /orders/123e4567-e89b-12d3-a456-426614174000/cancel
 * {
 *   "role": "user"
 * }
 * 
 * @example
 * // Cancelación por administrador
 * PATCH /orders/123e4567-e89b-12d3-a456-426614174000/cancel
 * {
 *   "role": "admin",
 *   "reason": "Stock agotado"
 * }
 */
router.patch('/:idOrTracking/cancel', ordersController.cancelOrder);

/**
 * 📚 GET /history/:clientId
 * Obtiene el historial completo de órdenes de un cliente
 * Ordena los resultados por fecha de creación descendente (más reciente primero)
 * 
 * @route GET /orders/history/:clientId
 * @param {string} clientId - ID del cliente cuyo historial se solicita
 * @returns {Array} Lista de todas las órdenes del cliente
 * 
 * @example
 * GET /orders/history/123e4567-e89b-12d3-a456-426614174000
 * 
 * Respuesta:
 * [
 *   {
 *     "id": "order1",
 *     "clientName": "Juan Pérez",
 *     "totalAmount": 59.98,
 *     "status": "entregado",
 *     "createdAt": "2025-11-15T10:30:00Z"
 *   },
 *   {
 *     "id": "order2",
 *     "clientName": "Juan Pérez",
 *     "totalAmount": 29.99,
 *     "status": "pendiente",
 *     "createdAt": "2025-11-10T14:22:00Z"
 *   }
 * ]
 */
router.get('/history/:clientId', ordersController.getOrderHistory);

// Exportar el enrutador configurado para usarlo en la aplicación principal
export default router;