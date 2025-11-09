import sgMail from '@sendgrid/mail';
import dotenv from 'dotenv';

dotenv.config();
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const msg = {
  to: 'trucelpro7@gmail.com', // 👈 cambia esto por tu correo personal
  from: process.env.FROM_EMAIL,
  subject: '🔍 Prueba de SendGrid desde Node.js',
  text: 'Si ves este correo, SendGrid está funcionando correctamente.',
};

sgMail
  .send(msg)
  .then(() => console.log('✅ Correo enviado correctamente'))
  .catch((error) => {
    console.error('❌ Error enviando correo:');
    console.error(error.response ? error.response.body : error);
  });