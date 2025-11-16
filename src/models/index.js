/**
 * Archivo de exportación centralizado para los modelos de la aplicación
 * Facilita la importación de modelos desde un único punto
 * 
 * @module models
 * @description Centraliza las exportaciones de todos los modelos Sequelize
 */

// Importar modelo de Orden (Order)
// Contiene la estructura y definición de una orden de compra
import { Order } from './order.js';

// Importar modelo de Items de Orden (OrderItem)
// Contiene la estructura y definición de los artículos dentro de una orden
import { OrderItem } from './orderItem.js';

/**
 * Exportar modelos para su uso en otros módulos
 * Permite usar: import { Order, OrderItem } from './models/index.js'
 * O simplemente: import { Order, OrderItem } from './models'
 */
export { Order, OrderItem };