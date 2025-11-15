// Importar la librería Sequelize (ORM para bases de datos)
import { Sequelize } from 'sequelize';
// Importar dotenv para cargar variables de entorno desde archivo .env
import dotenv from 'dotenv';

// Cargar las variables de entorno definidas en el archivo .env
dotenv.config();

/**
 * Instancia de Sequelize configurada para conectar con MySQL
 * Utiliza variables de entorno para las credenciales de conexión
 * @type {Sequelize}
 */
export const sequelize = new Sequelize(
  process.env.DB_NAME,      // Nombre de la base de datos
  process.env.DB_USER,      // Usuario de MySQL
  process.env.DB_PASSWORD,  // Contraseña de MySQL
  {
    host: process.env.DB_HOST,  // Host del servidor MySQL
    dialect: 'mysql',           // Especifica que se usa MySQL como base de datos
    logging: false,             // Desactiva el logging de queries SQL en consola
  }
);

/**
 * Función asincrónica que establece la conexión con la base de datos MySQL
 * Intenta autenticar la conexión y muestra un mensaje de éxito o error
 * @async
 * @returns {Promise<void>}
 */
export const connectDB = async () => {
  try {
    // Autentica la conexión con la base de datos
    await sequelize.authenticate();
    // Mensaje de éxito en consola
    console.log('✅ Conectado a MySQL');
  } catch (err) {
    // Captura y muestra cualquier error de conexión
    console.error('❌ Error conectando a MySQL:', err);
  }
};