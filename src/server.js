import express from 'express';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { sequelize } from './config/censudex-orders-db.js';
import { Order } from './models/order.js';
import { OrderItem } from './models/orderItem.js';
import { seedDatabase } from './seeders/seeder.js'; // importa tu seeder

const { DB_HOST, DB_NAME, DB_USER, DB_PASSWORD, PORT } = process.env;
dotenv.config();
// Función para crear la base de datos si no existe
async function createDatabaseIfNotExists() {
  const connection = await mysql.createConnection({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASSWORD
  });
  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`;`);
  await connection.end();
}

// Función para inicializar la base de datos y ejecutar el seeder si está vacía
async function initDatabase() {
  // Sincroniza las tablas de los modelos (sin borrar datos existentes)
  await sequelize.sync({ alter: true });
  console.log('Tablas sincronizadas correctamente');

  // Verifica si la tabla de orders está vacía
  const count = await Order.count();
  if (count === 0) {
    console.log('La tabla Order está vacía. Ejecutando seeder...');
    await seedDatabase(20, 5); // puedes cambiar la cantidad de órdenes/items
  } else {
    console.log('La tabla Order ya tiene datos, seeder no se ejecuta.');
  }
}

async function start() {
  await createDatabaseIfNotExists();

  try {
    await sequelize.authenticate();
    console.log('Conexión con MySQL exitosa');

    await initDatabase();

    const app = express();
    app.use(express.json());

    app.get('/orders', async (req, res) => {
      const orders = await Order.findAll({ include: { model: OrderItem, as: 'items' } });
      res.json(orders);
    });

    app.post('/orders', async (req, res) => {
      const order = await Order.create(req.body, { include: [{ model: OrderItem, as: 'items' }] });
      res.status(201).json(order);
    });

    app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));

  } catch (err) {
    console.error('Error conectando a MySQL:', err);
  }
}

start();
