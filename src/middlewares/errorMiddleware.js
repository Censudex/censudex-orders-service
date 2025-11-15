/**
 * Middleware de manejo de errores para Express
 * Captura cualquier error no manejado en las rutas y retorna una respuesta de error
 * Este middleware debe ser el último en la cadena de middlewares
 * 
 * @param {Error} err - Objeto de error capturado
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 * @param {Function} next - Función para pasar al siguiente middleware (no utilizado en este caso)
 * @returns {void}
 * 
 * @example
 * // Uso en el archivo principal de la aplicación (app.js o index.js):
 * app.use(errorHandler); // Debe ir al final de todas las rutas
 */
export const errorHandler = (err, req, res, next) => {
  // 🔴 Registra el error en la consola para propósitos de debugging
  console.error('❌ Error:', err.message);
  
  // 📤 Retorna respuesta HTTP 500 (Error interno del servidor)
  // con un mensaje genérico para no exponer detalles sensibles del error
  res.status(500).json({ message: 'Error interno del servidor' });
};