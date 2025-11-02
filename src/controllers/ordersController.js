import * as orderService from '../services/orderService.js';

export const createOrder = async (req, res, next) => {
  try {
    const order = await orderService.createOrder(req.body);
    res.status(201).json(order);
  } catch (err) {
    next(err);
  }
};

export const getAllOrders = async (req, res, next) => {
  try {
    const orders = await orderService.getOrders();
    res.json(orders);
  } catch (err) {
    next(err);
  }
};

export const getOrderById = async (req, res, next) => {
  try {
    const order = await orderService.getOrderById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Orden no encontrada' });
    res.json(order);
  } catch (err) {
    next(err);
  }
};