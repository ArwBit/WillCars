const express = require('express');
const router = express.Router();
const pool = require('../db');
const logger = require('../logger');
const { authenticateAdmin, authenticateAdminOrProvider } = require('../middleware/auth');

// Obtener lista de proveedores
router.get('/', authenticateAdminOrProvider, async (req, res) => {
    try {
        logger.info('GET /api/proveedores recibido');
        const result = await pool.query('SELECT id, name, id_pro, email_contacto FROM suppliers ORDER BY name');
        res.json(result.rows);
        logger.info(`Proveedores cargados: ${result.rows.length} registros`);
    } catch (error) {
        logger.error(`Error al cargar proveedores: ${error.message}, stack: ${error.stack}`);
        res.status(500).json({ error: 'Error al cargar proveedores' });
    }
});

// Obtener estado de proveedores
router.get('/status', authenticateAdminOrProvider, async (req, res) => {
    try {
        logger.info('GET /api/proveedores/status recibido');
        const result = await pool.query(`
            SELECT s.id_pro, s.name, s.visible, COUNT(p.id) as product_count
            FROM suppliers s
            LEFT JOIN products p ON s.id_pro = p.proveedor_id
            GROUP BY s.id_pro, s.name, s.visible
        `);
        res.json(result.rows);
        logger.info('Estado de proveedores enviado');
    } catch (error) {
        logger.error(`Error al obtener estado de proveedores: ${error.message}, stack: ${error.stack}`);
        res.status(500).json({ error: 'Error al obtener estado de proveedores' });
    }
});

// Actualizar visibilidad de proveedor
router.post('/status/:id_pro', authenticateAdmin, async (req, res) => {
    const { id_pro } = req.params;
    const { visible } = req.body;
    try {
        logger.info(`Actualizando visibilidad de proveedor ${id_pro} a ${visible}`);
        const result = await pool.query(
            'UPDATE suppliers SET visible = $1, updated_at = NOW() WHERE id_pro = $2 RETURNING *',
            [visible, id_pro]
        );
        if (result.rowCount === 0) {
            logger.warn(`Proveedor no encontrado: ${id_pro}`);
            return res.status(404).json({ error: 'Proveedor no encontrado' });
        }
        res.json(result.rows[0]);
        logger.info(`Proveedor ${id_pro} actualizado`);
    } catch (error) {
        logger.error(`Error al actualizar proveedor ${id_pro}: ${error.message}, stack: ${error.stack}`);
        res.status(500).json({ error: 'Error al actualizar proveedor' });
    }
});

module.exports = router;