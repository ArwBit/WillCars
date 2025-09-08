// backend/test-email.js
require('dotenv').config();
const { sendEmail } = require('./config/email');

async function testEmail() {
    try {
        await sendEmail({
            to: 'test@example.com',
            subject: 'Prueba WillCars',
            text: 'Este es un correo de prueba.',
        });
        console.log('Correo enviado');
    } catch (error) {
        console.error('Error:', error);
    }
}

testEmail();