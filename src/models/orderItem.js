import { DataTypes } from 'sequelize';
import { sequelize } from '../config/censudex-orders-db.js';
import { Order } from './order.js';

export const OrderItem = sequelize.define('OrderItem', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  orderId: {type: DataTypes.UUID,allowNull: false},
  productId: { type: DataTypes.UUID, allowNull: false },
  quantity: { type: DataTypes.INTEGER, allowNull: false },
  price: { type: DataTypes.FLOAT, allowNull: false },
});

Order.hasMany(OrderItem, { foreignKey: 'orderId', as: 'items' });
OrderItem.belongsTo(Order, { foreignKey: 'orderId' });
