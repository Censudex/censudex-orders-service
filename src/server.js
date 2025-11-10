import express from 'express';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { sequelize } from './config/censudex-orders-db.js';
import { Order } from './models/order.js';
import { OrderItem } from './models/orderItem.js';
import { seedDatabase } from './seeders/seeder.js';
import { connectRabbitMQ } from './config/rabbitmq.js';
import ordersRouter from './routes/ordersRoutes.js'; // 👈 importa tu router
import { startGrpcService } from './gRPC/orderGrpcService.js';

dotenv.config();

const { DB_HOST, DB_NAME, DB_USER, DB_PASSWORD, PORT } = process.env;

// 🧩 Esperar a que la base de datos esté lista antes de continuar
async function waitForDatabase() {
  let retries = 10;
  while (retries > 0) {
    try {
      const connection = await mysql.createConnection({
        host: DB_HOST,
        user: DB_USER,
        password: DB_PASSWORD,
      });
      await connection.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`;`);
      await connection.end();
      console.log('✅ Base de datos lista');
      return;
    } catch (err) {
      console.log('⏳ Esperando a que MySQL esté listo...');
      retries--;
      await new Promise((res) => setTimeout(res, 5000));
    }
  }
  throw new Error('❌ No se pudo conectar a MySQL después de varios intentos');
}

// 🧩 Sincronizar modelos y ejecutar seeder
async function initDatabase() {
  await sequelize.sync({ force: true });
  console.log('🧩 Migraciones ejecutadas correctamente');

  const count = await Order.count();
  if (count === 0) {
    console.log('🌱 Ejecutando seeder...');
    await seedDatabase(20, 5);
  } else {
    console.log('✅ La base de datos ya tiene datos.');
  }
}

// 🚀 Iniciar la aplicación
async function start() {
  await waitForDatabase();
  await connectRabbitMQ();

  try {
    await sequelize.authenticate();
    console.log('✅ Conectado a MySQL');
    await initDatabase();

    const app = express();
    app.use(express.json());

    // 👇 Montar tus rutas
    app.use('/orders', ordersRouter);

    // (Opcional) Ruta de salud para probar conexión rápida
    app.get('/', (req, res) => res.send('✅ Order Service funcionando'));

    app.listen(PORT, () => console.log(`🚀 Order Service corriendo en puerto ${PORT}`));
  } catch (err) {
    console.error('❌ Error inicializando la app:', err);
  }
}

start();
(async () => {
  await startGrpcService();
})();