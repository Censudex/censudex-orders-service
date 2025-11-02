import { Router } from 'express';
import * as ordersController from '../controllers/ordersController.js';

const router = Router();

router.post('/', ordersController.createOrder);
router.get('/', ordersController.getAllOrders);
router.get('/:id', ordersController.getOrderById);

export default router;
