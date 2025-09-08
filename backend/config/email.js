// backend/config/email.js
const nodemailer = require('nodemailer');
require('dotenv').config();
const logger = require('../logger');

// Crear un transporter de Nodemailer usando Gmail SMTP
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER, // willmetacars@gmail.com
        pass: process.env.EMAIL_PASS, // HhKk1w2j8*2121
    },
});

// Verificar la configuración del transporter
transporter.verify((error, success) => {
    if (error) {
        logger.error(`Error en la configuración del transporter de email: ${error.message}`);
    } else {
        logger.info('Configuración del transporter de email verificada correctamente');
    }
});

// Función para enviar correos electrónicos
const sendEmail = async ({ to, subject, text, html }) => {
    try {
        const mailOptions = {
            from: `"WillCars" <${process.env.EMAIL_USER}>`, // Dirección del remitente
            to, // Destinatario(s)
            subject, // Asunto
            text, // Cuerpo en texto plano
            html, // Cuerpo en HTML (opcional)
        };

        const info = await transporter.sendMail(mailOptions);
        logger.info(`Correo enviado a ${to}: ${info.messageId}`);
        return info;
    } catch (error) {
        logger.error(`Error al enviar correo a ${to}: ${error.message}`);
        throw new Error(`Error al enviar correo: ${error.message}`);
    }
};

module.exports = {
    sendEmail,
};