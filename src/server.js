// Importar framework Express para crear servidor HTTP
import express from 'express';
// Importar cliente MySQL para crear conexiones
import mysql from 'mysql2/promise';
// Importar dotenv para cargar variables de entorno
import dotenv from 'dotenv';
// Importar instancia de Sequelize configurada
import { sequelize } from './config/censudex-orders-db.js';
// Importar modelos de datos
import { Order } from './models/order.js';
import { OrderItem } from './models/orderItem.js';
// Importar función para llenar la base de datos con datos de prueba
import { seedDatabase } from './seeders/seeder.js';
// Importar función para conectar con RabbitMQ
import { connectRabbitMQ } from './config/rabbitmq.js';
// Importar rutas de órdenes
import ordersRouter from './routes/ordersRoutes.js'; // 👈 importa tu router
// Importar función para iniciar servicio gRPC
import { startGrpcService } from './gRPC/orderGrpcService.js';

// Cargar variables de entorno desde archivo .env
dotenv.config();

// 📌 Obtener configuración desde variables de entorno
const { DB_HOST, DB_NAME, DB_USER, DB_PASSWORD, PORT } = process.env;

/**
 * 🧩 Esperar a que la base de datos esté lista antes de continuar
 * Intenta conectar a MySQL múltiples veces con reintentos automáticos
 * Crea la base de datos si no existe
 * 
 * @async
 * @returns {Promise<void>}
 * @throws {Error} Si no logra conectar después de 10 intentos (50 segundos)
 */
async function waitForDatabase() {
  let retries = 10;  // Número máximo de intentos
  
  // Reintentar hasta conectar o agotar intentos
  while (retries > 0) {
    try {
      // Intentar crear conexión con MySQL
      const connection = await mysql.createConnection({
        host: DB_HOST,
        user: DB_USER,
        password: DB_PASSWORD,
      });
      
      // Crear base de datos si no existe
      await connection.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`;`);
      
      // Cerrar conexión
      await connection.end();
      
      console.log('✅ Base de datos lista');
      return;  // Salir exitosamente
    } catch (err) {
      // Si hay error, reintentar
      console.log('⏳ Esperando a que MySQL esté listo...');
      retries--;  // Decrementar contador
      
      // Esperar 5 segundos antes de reintentar
      await new Promise((res) => setTimeout(res, 5000));
    }
  }
  
  // Si agota los intentos, lanzar error
  throw new Error('❌ No se pudo conectar a MySQL después de varios intentos');
}

/**
 * 🧩 Sincronizar modelos y ejecutar seeder
 * Crea las tablas en la base de datos si no existen
 * Llena la base de datos con datos de prueba si está vacía
 * 
 * @async
 * @returns {Promise<void>}
 * @throws {Error} Si hay error al sincronizar modelos o ejecutar seeder
 */
async function initDatabase() {
  // Sincronizar modelos con la base de datos
  // force: true = borra tablas existentes y las recrea (solo para desarrollo)
  await sequelize.sync({ force: true });
  console.log('🧩 Migraciones ejecutadas correctamente');

  // Contar órdenes existentes
  const count = await Order.count();
  
  // Si no hay datos, ejecutar seeder
  if (count === 0) {
    console.log('🌱 Ejecutando seeder...');
    // Crear 20 órdenes con máximo 5 items cada una
    await seedDatabase(20, 5);
  } else {
    console.log('✅ La base de datos ya tiene datos.');
  }
}

/**
 * 🚀 Función principal para iniciar la aplicación
 * Realiza todas las conexiones necesarias y arranca el servidor Express
 * 
 * @async
 * @returns {Promise<void>}
 */
async function start() {
  // 1️⃣ Esperar a que MySQL esté listo
  await waitForDatabase();
  
  // 2️⃣ Conectar con RabbitMQ con reintentos automáticos
  await connectRabbitMQ();

  try {
    // 3️⃣ Autenticar conexión con la base de datos
    await sequelize.authenticate();
    console.log('✅ Conectado a MySQL');
    
    // 4️⃣ Inicializar base de datos (migraciones + seeder)
    await initDatabase();

    // 5️⃣ Crear instancia de Express
    const app = express();
    
    // Middleware para parsear JSON en el body de las solicitudes
    app.use(express.json());

    // 👇 Montar rutas de órdenes en el prefijo /orders
    // Todas las rutas de ordersRouter estarán disponibles en /orders/*
    app.use('/orders', ordersRouter);

    // (Opcional) Ruta de salud para probar conexión rápida
    // GET / retorna un mensaje indicando que el servicio está funcionando
    app.get('/', (req, res) => res.send('✅ Order Service funcionando'));

    // 6️⃣ Iniciar servidor HTTP en el puerto especificado
    app.listen(PORT, () => {
      console.log(`🚀 Order Service corriendo en puerto ${PORT}`);
    });
  } catch (err) {
    // Capturar y mostrar errores durante la inicialización
    console.error('❌ Error inicializando la app:', err);
  }
}

/**
 * 🚀 Iniciar el servidor Express
 * Llamar a la función start() para iniciar toda la aplicación
 */
start();

/**
 * 🚀 Iniciar servicio gRPC de forma asincrónica
 * El servidor gRPC se ejecuta en paralelo con Express
 * en un puerto separado (por defecto 50052)
 */
(async () => {
  await startGrpcService();
})();