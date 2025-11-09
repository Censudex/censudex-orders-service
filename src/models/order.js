import { DataTypes } from 'sequelize';
import { sequelize } from '../config/censudex-orders-db.js';

export const Order = sequelize.define('Order', {
  id: { 
    type: DataTypes.UUID, 
    defaultValue: DataTypes.UUIDV4, 
    primaryKey: true 
  },
  clientId: { 
    type: DataTypes.UUID, 
    allowNull: false 
  },
  clientName: { 
    type: DataTypes.STRING, 
    allowNull: false 
  },
  totalAmount: { 
    type: DataTypes.FLOAT, 
    allowNull: false 
  },
  status: {
    type: DataTypes.ENUM('pendiente', 'en procesamiento', 'enviado', 'entregado', 'cancelado'),
    defaultValue: 'pendiente',
  },

  // 📦 Campo agregado: número de seguimiento del envío
  trackingNumber: {
    type: DataTypes.STRING,
    allowNull: true, // solo se usa cuando el pedido está "enviado"
  },

  // 🏠 Campo agregado: dirección de envío
  shippingAddress: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: null,
    comment: 'Dirección de envío proporcionada por el cliente'
  },

  createdAt: {             
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false
  }
}, {
  updatedAt: false 
});
