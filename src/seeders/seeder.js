import { faker } from '@faker-js/faker';
import { sequelize } from '../config/censudex-orders-db.js';
import { Order } from '../models/order.js';
import { OrderItem } from '../models/orderItem.js';

export async function seedDatabase(nOrders = 10, maxItemsPerOrder = 5) {
  try {
    await sequelize.sync();
    console.log('📦 Base de datos sincronizada');

    for (let i = 0; i < nOrders; i++) {
      // Estado aleatorio
      const status = faker.helpers.arrayElement([
        'pendiente',
        'en procesamiento',
        'enviado',
        'entregado',
        'cancelado',
      ]);

      // 🔹 Generar un trackingNumber único para todos los pedidos
      const trackingNumber = `TRK-${faker.string.alphanumeric(10).toUpperCase()}`;

      // 🏠 Dirección de envío aleatoria
      const shippingAddress = `${faker.location.streetAddress()}, ${faker.location.city()}, ${faker.location.country()}`;

      const order = await Order.create({
        clientId: faker.string.uuid(),
        clientName: faker.person.fullName(),
        totalAmount: 0,
        status,
        trackingNumber,
        shippingAddress, // ✅ Nuevo campo
      });

      const nItems = faker.number.int({ min: 1, max: maxItemsPerOrder });
      let totalAmount = 0;

      for (let j = 0; j < nItems; j++) {
        const price = parseFloat(faker.commerce.price({ min: 5, max: 200, dec: 2 }));
        const quantity = faker.number.int({ min: 1, max: 5 });
        totalAmount += price * quantity;

        await OrderItem.create({
          orderId: order.id,
          productId: faker.string.uuid(),
          quantity,
          price,
        });
      }

      order.totalAmount = totalAmount;
      await order.save();
    }

    console.log(`✅ Se han creado ${nOrders} órdenes con trackingNumbers, direcciones y items aleatorios`);

  } catch (error) {
    console.error('❌ Error creando seed:', error);
    throw error; // Propaga el error a server.js
  }
}
