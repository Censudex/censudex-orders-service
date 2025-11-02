import { DataTypes } from 'sequelize';
import { sequelize } from '../config/db.js';

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
  createdAt: {             
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false
  }
}, {
  updatedAt: false 
});
