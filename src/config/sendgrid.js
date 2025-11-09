import sgMail from '@sendgrid/mail';
import dotenv from 'dotenv';
dotenv.config();

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// 🧩 Función principal para enviar correos
export const sendEmail = async (to, subject, text, html = null) => {
  try {
    const msg = {
      to,
      from: process.env.FROM_EMAIL,
      subject,
      text,
      html: html || `<p>${text}</p>`, // Soporte básico de HTML
    };

    await sgMail.send(msg);
    console.log(`📧 Email enviado a ${to} | Asunto: ${subject}`);
  } catch (error) {
    console.error('❌ Error enviando correo con SendGrid:');
    if (error.response?.body?.errors) {
      console.error(error.response.body.errors);
    } else {
      console.error(error.message);
    }
  }
};

// 🧠 Función auxiliar para distintos tipos de notificaciones de pedidos
export const sendOrderEmail = async (type, order, extraInfo = null) => {
  const userEmail = order.email || 'cliente@ejemplo.com'; // Ajusta según tu modelo
  let subject, text, html;

  switch (type) {
    case 'created':
      subject = `🛒 Confirmación de tu pedido #${order.id}`;
      text = `Hola, tu pedido fue recibido exitosamente. Estado actual: ${order.status}.`;
      html = `
        <h2>Gracias por tu compra!</h2>
        <p>Tu pedido <strong>#${order.id}</strong> fue creado correctamente.</p>
        <p>Estado actual: <b>${order.status}</b></p>
      `;
      break;

    case 'processing':
      subject = `🔧 Tu pedido #${order.id} está en procesamiento`;
      text = `Estamos preparando tus productos. Te avisaremos cuando se envíe.`;
      html = `
        <h2>Estamos preparando tu pedido</h2>
        <p>Pedido #${order.id} está siendo procesado.</p>
      `;
      break;

    case 'shipped':
      subject = `📦 Tu pedido #${order.id} fue enviado`;
      text = `Tu pedido ha sido enviado. Número de seguimiento: ${extraInfo || 'N/A'}`;
      html = `
        <h2>Pedido enviado</h2>
        <p>Tu pedido #${order.id} fue enviado.</p>
        ${extraInfo ? `<p>Número de seguimiento: <b>${extraInfo}</b></p>` : ''}
      `;
      break;

    case 'delivered':
      subject = `✅ Tu pedido #${order.id} fue entregado`;
      text = `Tu pedido ha sido entregado correctamente. ¡Gracias por confiar en nosotros!`;
      html = `
        <h2>Pedido entregado</h2>
        <p>Pedido #${order.id} fue entregado exitosamente.</p>
      `;
      break;

    case 'cancelled':
      subject = `❌ Tu pedido #${order.id} ha sido cancelado`;
      text = `Tu pedido ha sido cancelado. Motivo: ${extraInfo || 'No especificado.'}`;
      html = `
        <h2>Pedido cancelado</h2>
        <p>Tu pedido #${order.id} fue cancelado.</p>
        ${extraInfo ? `<p>Motivo: ${extraInfo}</p>` : ''}
      `;
      break;

    default:
      subject = `📢 Actualización de pedido #${order.id}`;
      text = `Tu pedido ha sido actualizado.`;
      html = `<p>Tu pedido ha sido actualizado.</p>`;
  }

  // Usa la función principal para enviar el correo
  await sendEmail(userEmail, subject, text, html);
};
