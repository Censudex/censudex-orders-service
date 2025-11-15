// Importar tipos de datos de Sequelize para definir columnas
import { DataTypes } from 'sequelize';
// Importar instancia de Sequelize configurada para conectar con MySQL
import { sequelize } from '../config/censudex-orders-db.js';

/**
 * Modelo de Order (Orden/Pedido)
 * Define la estructura de la tabla 'Orders' en la base de datos
 * Representa un pedido realizado por un cliente con sus artículos asociados
 * 
 * @type {Model}
 * @property {UUID} id - Identificador único de la orden (generado automáticamente)
 * @property {UUID} clientId - ID del cliente que realizó el pedido
 * @property {string} clientName - Nombre del cliente
 * @property {float} totalAmount - Monto total del pedido
 * @property {string} status - Estado actual del pedido (pendiente, procesando, enviado, etc.)
 * @property {string} trackingNumber - Número de seguimiento del envío
 * @property {string} shippingAddress - Dirección de entrega
 * @property {Date} createdAt - Fecha de creación del pedido
 */
export const Order = sequelize.define('Order', {
  // 🔑 Campo ID: Identificador único de la orden
  id: { 
    type: DataTypes.UUID,              // Tipo UUID para ID global único
    defaultValue: DataTypes.UUIDV4,    // Genera automáticamente UUID versión 4
    primaryKey: true                   // Define como clave primaria
  },

  // 👤 Campo clientId: Referencia al cliente
  clientId: { 
    type: DataTypes.UUID,              // ID del cliente (referencia externa)
    allowNull: false                   // Campo obligatorio
  },

  // 📝 Campo clientName: Nombre del cliente
  clientName: { 
    type: DataTypes.STRING,            // Texto de longitud variable
    allowNull: false                   // Campo obligatorio
  },

  // 💰 Campo totalAmount: Monto total del pedido
  totalAmount: { 
    type: DataTypes.FLOAT,             // Número decimal para moneda
    allowNull: false                   // Campo obligatorio
  },

  // 📦 Campo status: Estado actual del pedido
  status: {
    type: DataTypes.ENUM(              // Enumeración con valores predefinidos
      'pendiente',                     // Pedido recibido, pendiente de procesamiento
      'en procesamiento',              // Siendo preparado para envío
      'enviado',                       // Ya fue enviado al cliente
      'entregado',                     // Recibido por el cliente
      'cancelado'                      // Cancelado por cliente o admin
    ),
    defaultValue: 'pendiente',         // Estado inicial de todo pedido nuevo
  },

  // 📍 Campo trackingNumber: Número de seguimiento del envío
  trackingNumber: {
    type: DataTypes.STRING,            // Código alfanumérico del seguimiento
    allowNull: true,                   // Campo opcional (se asigna cuando se envía)
    comment: 'Número de seguimiento para rastrear el envío'
  },

  // 🏠 Campo shippingAddress: Dirección de envío
  shippingAddress: {
    type: DataTypes.STRING,            // Dirección completa del cliente
    allowNull: true,                   // Campo opcional
    defaultValue: null,                // Por defecto vacío
    comment: 'Dirección de envío proporcionada por el cliente'
  },

  // 📅 Campo createdAt: Fecha de creación automática
  createdAt: {             
    type: DataTypes.DATE,              // Tipo fecha y hora
    defaultValue: DataTypes.NOW,       // Asigna automáticamente la fecha/hora actual
    allowNull: false                   // Campo obligatorio
  }
}, {
  // ⚙️ Opciones del modelo
  updatedAt: false                     // No crear columna 'updatedAt' (no se usa)
});