const express = require('express');
const router = express.Router();
const pool = require('../db');
const logger = require('../logger');
const { sendEmail } = require('../config/email');

router.post('/', async (req, res) => {
    const { email } = req.body;
    if (!email?.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
        logger.warn(`Intento de suscripción con email inválido: ${email}`);
        return res.status(400).json({ error: 'Email inválido' });
    }
    try {
        await pool.query('INSERT INTO newsletter (email, created_at) VALUES ($1, $2)', [email, new Date()]);
        await sendEmail({
            to: email,
            subject: 'Bienvenido al Newsletter de WillCars',
            text: 'Gracias por suscribirte a nuestro newsletter. Recibirás las últimas novedades y ofertas.',
            html: '<p>Gracias por suscribirte a nuestro newsletter. Recibirás las últimas novedades y ofertas.</p>',
        });
        logger.info(`Suscripción exitosa: ${email}`);
        res.status(201).json({ message: 'Suscripción exitosa' });
    } catch (error) {
        logger.error(`Error al suscribir ${email}: ${error.message}`);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

module.exports = router;