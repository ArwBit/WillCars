const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateAdminOrProvider } = require('../middleware/auth');
const logger = require('../logger');

router.get('/:proveedor_id', authenticateAdminOrProvider, async (req, res) => {
    try {
        const { proveedor_id } = req.params;
        logger.info(`GET /api/notifications/${proveedor_id} recibido, usuario: ${req.user.email}, rol: ${req.user.role}, proveedor_id: ${req.user.proveedor_id}`);
        const result = await pool.query(
            'SELECT id, message, type, created_at, read FROM notifications WHERE proveedor_id = $1 ORDER BY created_at DESC LIMIT 10',
            [proveedor_id]
        );
        logger.info(`Notificaciones encontradas para ${proveedor_id}: ${result.rows.length}`);
        res.json(result.rows);
    } catch (error) {
        logger.error(`Error al cargar notificaciones para ${req.params.proveedor_id}: ${error.message}, stack: ${error.stack}`);
        res.status(500).json({ error: 'Error al cargar notificaciones', message: error.message });
    }
});

router.put('/:id/read', authenticateAdminOrProvider, async (req, res) => {
    try {
        const { id } = req.params;
        logger.info(`PUT /api/notifications/${id}/read recibido, usuario: ${req.user.email}, rol: ${req.user.role}`);
        const result = await pool.query('UPDATE notifications SET read = TRUE WHERE id = $1 RETURNING *', [id]);
        if (result.rowCount === 0) {
            logger.warn(`Notificación con id ${id} no encontrada`);
            return res.status(404).json({ error: 'Notificación no encontrada' });
        }
        res.json({ message: 'Notificación marcada como leída', notification: result.rows[0] });
    } catch (error) {
        logger.error(`Error al marcar notificación ${req.params.id} como leída: ${error.message}, stack: ${error.stack}`);
        res.status(500).json({ error: 'Error al marcar notificación como leída', message: error.message });
    }
});

module.exports = router;