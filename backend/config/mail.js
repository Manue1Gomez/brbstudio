const nodemailer = require('nodemailer');
require('dotenv').config();

let transporter = null;

function isMailConfigured() {
  return Boolean(process.env.MAIL_HOST);
}

function getTransporter() {
  if (!transporter) {
    const auth = process.env.MAIL_USER
      ? { user: process.env.MAIL_USER, pass: process.env.MAIL_PASSWORD || '' }
      : undefined;

    transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      port: Number(process.env.MAIL_PORT) || 587,
      secure: process.env.MAIL_SECURE === 'true',
      auth,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
    });
  }

  return transporter;
}

function sendMail({ to, subject, text, html }) {
  const from = process.env.MAIL_FROM || `"BRB Studios" <${process.env.MAIL_USER}>`;

  return getTransporter().sendMail({ from, to, subject, text, html });
}

module.exports = { isMailConfigured, sendMail };
