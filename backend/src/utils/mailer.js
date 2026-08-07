const nodemailer = require('nodemailer');

function getTransporter() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

async function enviarEmailAlerta(asunto, textoHtml) {
  const transporter = getTransporter();
  if (!transporter || !process.env.ALERT_EMAIL_TO) {
    console.warn('SMTP no configurado, se omite el envio de email de alerta.');
    return false;
  }
  try {
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: process.env.ALERT_EMAIL_TO,
      subject: asunto,
      html: textoHtml,
    });
    return true;
  } catch (err) {
    console.error('Error enviando email de alerta:', err.message);
    return false;
  }
}

module.exports = { enviarEmailAlerta };
