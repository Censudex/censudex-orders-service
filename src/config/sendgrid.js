// Importar la librería SendGrid para enviar correos electrónicos
import sgMail from '@sendgrid/mail';
// Importar dotenv para cargar variables de entorno
import dotenv from 'dotenv';
dotenv.config();

// Configura la clave API de SendGrid desde las variables de entorno
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

/**
 * Función principal para enviar correos electrónicos usando SendGrid
 * Soporta tanto texto plano como HTML
 * @async
 * @param {string} to - Dirección de correo del destinatario
 * @param {string} subject - Asunto del correo
 * @param {string} text - Contenido en texto plano del correo
 * @param {string} [html=null] - Contenido en HTML del correo (opcional)
 * @returns {Promise<void>}
 */
export const sendEmail = async (to, subject, text, html = null) => {
  try {
    // Construye el objeto del mensaje con los datos del correo
    const msg = {
      to,                                    // Destinatario
      from: process.env.FROM_EMAIL,          // Remitente configurado en variables de entorno
      subject,                               // Asunto del correo
      text,                                  // Contenido en texto plano
      html: html || `<p>${text}</p>`,        // Contenido HTML (usa texto plano si no se proporciona)
    };

    // Envía el correo a través de SendGrid
    await sgMail.send(msg);
    console.log(`📧 Email enviado a ${to} | Asunto: ${subject}`);
  } catch (error) {
    // Manejo de errores en la entrega
    console.error('❌ Error enviando correo con SendGrid:');
    if (error.response?.body?.errors) {
      // Si hay errores de respuesta de SendGrid, los muestra
      console.error(error.response.body.errors);
    } else {
      // Si es otro tipo de error, muestra el mensaje
      console.error(error.message);
    }
  }
};

/**
 * Función auxiliar para enviar notificaciones de pedidos
 * Genera automáticamente el contenido según el tipo de notificación
 * @async
 * @param {string} type - Tipo de notificación ('created', 'processing', 'shipped', 'delivered', 'cancelled')
 * @param {Object} order - Objeto con datos del pedido
 * @param {string} order.id - ID del pedido
 * @param {string} order.email - Email del cliente
 * @param {string} order.status - Estado actual del pedido
 * @param {string|null} [extraInfo=null] - Información adicional según el tipo (número de seguimiento, motivo de cancelación, etc.)
 * @returns {Promise<void>}
 */
export const sendOrderEmail = async (type, order, extraInfo = null) => {
  // Obtiene el email del cliente, usa uno por defecto si no existe
  const userEmail = order.email || 'cliente@ejemplo.com';
  let subject, text, html;

  // Determina el contenido del correo según el tipo de notificación
  switch (type) {
    case 'created':
      // Notificación cuando se crea el pedido
      subject = `🛒 Confirmación de tu pedido #${order.id}`;
      text = `Hola, tu pedido fue recibido exitosamente. Estado actual: ${order.status}.`;
      html = `
        <h2>Gracias por tu compra!</h2>
        <p>Tu pedido <strong>#${order.id}</strong> fue creado correctamente.</p>
        <p>Estado actual: <b>${order.status}</b></p>
      `;
      break;

    case 'processing':
      // Notificación cuando el pedido está en procesamiento
      subject = `🔧 Tu pedido #${order.id} está en procesamiento`;
      text = `Estamos preparando tus productos. Te avisaremos cuando se envíe.`;
      html = `
        <h2>Estamos preparando tu pedido</h2>
        <p>Pedido #${order.id} está siendo procesado.</p>
      `;
      break;

    case 'shipped':
      // Notificación cuando el pedido es enviado (incluye número de seguimiento)
      subject = `📦 Tu pedido #${order.id} fue enviado`;
      text = `Tu pedido ha sido enviado. Número de seguimiento: ${extraInfo || 'N/A'}`;
      html = `
        <h2>Pedido enviado</h2>
        <p>Tu pedido #${order.id} fue enviado.</p>
        ${extraInfo ? `<p>Número de seguimiento: <b>${extraInfo}</b></p>` : ''}
      `;
      break;

    case 'delivered':
      // Notificación cuando el pedido es entregado
      subject = `✅ Tu pedido #${order.id} fue entregado`;
      text = `Tu pedido ha sido entregado correctamente. ¡Gracias por confiar en nosotros!`;
      html = `
        <h2>Pedido entregado</h2>
        <p>Pedido #${order.id} fue entregado exitosamente.</p>
      `;
      break;

    case 'cancelled':
      // Notificación cuando el pedido es cancelado (puede incluir motivo)
      subject = `❌ Tu pedido #${order.id} ha sido cancelado`;
      text = `Tu pedido ha sido cancelado. Motivo: ${extraInfo || 'No especificado.'}`;
      html = `
        <h2>Pedido cancelado</h2>
        <p>Tu pedido #${order.id} fue cancelado.</p>
        ${extraInfo ? `<p>Motivo: ${extraInfo}</p>` : ''}
      `;
      break;

    default:
      // Notificación genérica para otros casos
      subject = `📢 Actualización de pedido #${order.id}`;
      text = `Tu pedido ha sido actualizado.`;
      html = `<p>Tu pedido ha sido actualizado.</p>`;
  }

  // Usa la función principal para enviar el correo con el contenido generado
  await sendEmail(userEmail, subject, text, html);
};