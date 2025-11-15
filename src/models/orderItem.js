// Importar tipos de datos de Sequelize para definir columnas
import { DataTypes } from 'sequelize';
// Importar instancia de Sequelize configurada para conectar con MySQL
import { sequelize } from '../config/censudex-orders-db.js';
// Importar modelo Order para establecer relaciones
import { Order } from './order.js';

/**
 * Modelo de OrderItem (Artículo de Orden)
 * Define la estructura de la tabla 'OrderItems' en la base de datos
 * Representa cada producto individual dentro de una orden
 * 
 * @type {Model}
 * @property {UUID} id - Identificador único del item (generado automáticamente)
 * @property {UUID} orderId - ID de la orden a la que pertenece este item
 * @property {UUID} productId - ID del producto que se está ordenando
 * @property {integer} quantity - Cantidad del producto en la orden
 * @property {float} price - Precio unitario del producto en el momento de la compra
 */
export const OrderItem = sequelize.define('OrderItem', {
  // 🔑 Campo ID: Identificador único del item
  id: { 
    type: DataTypes.UUID,             // Tipo UUID para ID global único
    defaultValue: DataTypes.UUIDV4,   // Genera automáticamente UUID versión 4
    primaryKey: true                  // Define como clave primaria
  },

  // 🔗 Campo orderId: Referencia a la orden
  orderId: {
    type: DataTypes.UUID,             // ID de la orden (clave foránea)
    allowNull: false                  // Campo obligatorio
  },

  // 📦 Campo productId: Referencia al producto
  productId: {
    type: DataTypes.UUID,             // ID del producto siendo ordenado
    allowNull: false                  // Campo obligatorio
  },

  // 🔢 Campo quantity: Cantidad del producto
  quantity: {
    type: DataTypes.INTEGER,          // Número entero (sin decimales)
    allowNull: false                  // Campo obligatorio
  },

  // 💰 Campo price: Precio unitario del producto
  price: {
    type: DataTypes.FLOAT,            // Número decimal para el precio
    allowNull: false                  // Campo obligatorio
  },
}, 
{
  // ⚙️ Opciones del modelo
  timestamps: false                   // No crear columnas createdAt/updatedAt
}
);

/**
 * 🔗 Definición de relaciones entre modelos
 * Establece la relación uno a muchos entre Order y OrderItem
 */

// Una orden tiene muchos items
// foreignKey: especifica qué columna actúa como clave foránea
// as: alias para acceder a los items (ej: order.getItems())
Order.hasMany(OrderItem, { 
  foreignKey: 'orderId', 
  as: 'items' 
});

// Muchos items pertenecen a una orden
// Permite acceder a la orden desde un item (ej: orderItem.getOrder())
OrderItem.belongsTo(Order, { 
  foreignKey: 'orderId' 
});