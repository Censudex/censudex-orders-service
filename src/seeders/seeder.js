// Importar Faker para generar datos aleatorios realistas
import { faker } from '@faker-js/faker';
// Importar instancia de Sequelize para sincronizar la base de datos
import { sequelize } from '../config/censudex-orders-db.js';
// Importar modelos de datos
import { Order } from '../models/order.js';
import { OrderItem } from '../models/orderItem.js';

/**
 * 🌱 Función para llenar la base de datos con datos de prueba
 * Crea órdenes aleatorias con sus items asociados para testing y desarrollo
 * 
 * @async
 * @param {number} nOrders - Número de órdenes a crear (por defecto 10)
 * @param {number} maxItemsPerOrder - Cantidad máxima de items por orden (por defecto 5)
 * @returns {Promise<void>}
 * @throws {Error} Si hay error al crear los datos
 * 
 * @example
 * // Crear 10 órdenes con máximo 5 items cada una
 * await seedDatabase();
 * 
 * @example
 * // Crear 50 órdenes con máximo 10 items cada una
 * await seedDatabase(50, 10);
 */
export async function seedDatabase(nOrders = 10, maxItemsPerOrder = 5) {
  try {
    // 🔄 Sincroniza los modelos con la base de datos
    // Crea las tablas si no existen
    await sequelize.sync();
    console.log('📦 Base de datos sincronizada');

    // 🔁 Bucle para crear múltiples órdenes
    for (let i = 0; i < nOrders; i++) {
      // 🎲 Estado aleatorio de la orden
      // Selecciona aleatoriamente uno de los estados posibles
      const status = faker.helpers.arrayElement([
        'pendiente',                   // Orden recibida, pendiente de procesamiento
        'en procesamiento',            // Siendo preparada para envío
        'enviado',                     // Ya fue enviada al cliente
        'entregado',                   // Recibida por el cliente
        'cancelado',                   // Cancelada por cliente o admin
      ]);

      // 🔹 Generar número de seguimiento único para cada pedido
      // Formato: TRK-XXXXXXXXXX (10 caracteres alfanuméricos)
      const trackingNumber = `TRK-${faker.string.alphanumeric(10).toUpperCase()}`;

      // 🏠 Dirección de envío aleatoria y realista
      // Combina calle, ciudad y país aleatorios
      const shippingAddress = `${faker.location.streetAddress()}, ${faker.location.city()}, ${faker.location.country()}`;

      // 📝 Crear la orden en la base de datos
      const order = await Order.create({
        clientId: faker.string.uuid(),         // ID único del cliente
        clientName: faker.person.fullName(),   // Nombre completo aleatorio
        totalAmount: 0,                        // Se calcula después al sumar items
        status,                                // Estado aleatorio
        trackingNumber,                        // Número de seguimiento único
        shippingAddress,                       // Dirección de envío aleatoria
      });

      // 🔢 Generar cantidad aleatoria de items (entre 1 y maxItemsPerOrder)
      const nItems = faker.number.int({ min: 1, max: maxItemsPerOrder });
      let totalAmount = 0;

      // 🔁 Bucle para crear items dentro de la orden
      for (let j = 0; j < nItems; j++) {
        // 💰 Generar precio aleatorio entre $5 y $200 con 2 decimales
        const price = parseFloat(
          faker.commerce.price({ min: 5, max: 200, dec: 2 })
        );
        
        // 📦 Generar cantidad aleatoria entre 1 y 5 unidades
        const quantity = faker.number.int({ min: 1, max: 5 });
        
        // 🧮 Sumar al total: precio × cantidad
        totalAmount += price * quantity;

        // ✅ Crear el item en la base de datos
        await OrderItem.create({
          orderId: order.id,                   // ID de la orden a la que pertenece
          productId: faker.string.uuid(),      // ID único del producto
          quantity,                            // Cantidad del producto
          price,                               // Precio unitario
        });
      }

      // 💾 Actualizar el monto total de la orden
      // Suma de (precio × cantidad) de todos los items
      order.totalAmount = totalAmount;
      await order.save();
    }

    // ✅ Mensaje de éxito en consola
    console.log(
      `✅ Se han creado ${nOrders} órdenes con trackingNumbers, direcciones y items aleatorios`
    );

  } catch (error) {
    // ❌ Manejo de errores
    console.error('❌ Error creando seed:', error);
    throw error; // Propaga el error al archivo que llama esta función (server.js)
  }
}