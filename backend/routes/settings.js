const express = require('express');
const router = express.Router();
const pool = require('../db');
const jwt = require('jsonwebtoken');
const logger = require('../logger');

// Middleware para verificar JWT y rol de admin
const authenticateAdmin = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) {
        logger.warn('No se proporcionó token');
        return res.status(401).json({ error: 'No se proporcionó token' });
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role !== 'admin') {
            logger.warn(`Acceso denegado para usuario ${decoded.email}: no es administrador`);
            return res.status(403).json({ error: 'Acceso denegado. Solo administradores.' });
        }
        req.user = decoded;
        next();
    } catch (err) {
        logger.error(`Error al verificar token: ${err.message}`);
        res.status(401).json({ error: 'Token inválido' });
    }
};

// Obtener todas las configuraciones
router.get('/', authenticateAdmin, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM settings ORDER BY updated_at DESC');
        logger.info(`Configuraciones obtenidas por ${req.user.email}`);
        res.json(result.rows);
    } catch (err) {
        logger.error(`Error al obtener configuraciones: ${err.message}`);
        res.status(500).json({ error: 'Error al obtener configuraciones' });
    }
});

// Actualizar o crear una configuración
router.post('/', authenticateAdmin, async (req, res) => {
    const { key, value } = req.body;
    try {
        if (!key || !value) {
            logger.warn(`Intento de crear configuración sin clave o valor`);
            return res.status(400).json({ error: 'Clave y valor son obligatorios' });
        }
        const result = await pool.query(
            'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP RETURNING *',
            [key, value]
        );
        logger.info(`Configuración actualizada: ${key} por ${req.user.email}`);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        logger.error(`Error al actualizar configuración: ${err.message}`);
        res.status(500).json({ error: 'Error al actualizar configuración' });
    }
});

module.exports = router;