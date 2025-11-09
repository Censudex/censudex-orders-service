import { Router } from 'express';
import * as ordersController from '../controllers/ordersController.js';

const router = Router();

router.post('/', ordersController.createOrder);
router.get('/', ordersController.getAllOrders);
router.get('/:trackingNumber/status', ordersController.getOrderStatus);
router.patch('/:id/status', ordersController.updateOrderStatus);
router.patch('/:idOrTracking/cancel', ordersController.cancelOrder);
router.get('/history/:clientId', ordersController.getOrderHistory);

export default router;
