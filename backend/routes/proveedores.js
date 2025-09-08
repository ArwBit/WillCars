const express = require('express');
const router = express.Router();
const pool = require('../db');
const logger = require('../logger');
const { authenticateAdminOrProvider } = require('../middleware/auth'); // Importación corregida

const PROVEEDORES = {
    'PS-00001': { nombre: 'Sanchez Import', carpeta: 'Sanchez Import', imagenes: 'Fotos Sanchez Import' },
    'MAS-i002': { nombre: 'Mastro', carpeta: 'Mastro', imagenes: 'Fotos_Mastro' },
    'ARG-C003': { nombre: 'ARG Import', carpeta: 'ARG_importaciones', imagenes: 'Fotos_ARG' },
    'Mcc-i004': { nombre: 'MultiOcc', carpeta: 'MultiOcc', imagenes: 'Fotos_MultiOcc' },
    'Wic-A1': { nombre: 'WillCars Import', carpeta: 'WillCars Import', imagenes: 'Fotos_WillCars' },
    'kod-Sc001': { nombre: 'Kode Import', carpeta: 'Kode import', imagenes: 'Fotos_Kode' },
    'Karecho-001': { nombre: 'KarechoShop', carpeta: 'KarechoShop', imagenes: 'Fotos_KarechoShop' }
};

// Obtener lista de proveedores
router.get('/', authenticateAdminOrProvider, async (req, res) => {
    try {
        logger.info('GET /api/proveedores recibido');
        const result = await pool.query('SELECT id_pro AS id, name FROM suppliers ORDER BY name');
        res.json(result.rows);
        logger.info(`Proveedores cargados: ${result.rows.length} registros`);
    } catch (error) {
        logger.error(`Error al cargar proveedores: ${error.message}`);
        res.status(500).json({ error: 'Error al cargar proveedores' });
    }
});

// Obtener estado de actualización de proveedores
router.get('/status', authenticateAdminOrProvider, async (req, res) => {
    try {
        logger.info('GET /api/proveedores/status recibido');
        const result = await pool.query('SELECT id_pro AS id, last_updated, active, visible FROM suppliers');
        const statuses = result.rows.map(supplier => {
            const is_updated = supplier.last_updated && new Date(supplier.last_updated) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            return {
                supplier_id: supplier.id,
                is_updated,
                active: supplier.active,
                visible: supplier.visible
            };
        });
        res.json(statuses);
        logger.info('Estado de proveedores enviado');
    } catch (error) {
        logger.error(`Error al obtener estado de proveedores: ${error.message}`);
        res.status(500).json({ error: 'Error al obtener estado de proveedores' });
    }
});

// Actualizar estado de proveedor
router.put('/:id', authenticateAdminOrProvider, async (req, res) => {
    const { id } = req.params;
    const { active, visible } = req.body;
    try {
        logger.info(`PUT /api/proveedores/${id} recibido`);
        const result = await pool.query(
            'UPDATE suppliers SET active = $1, visible = $2, last_updated = NOW() WHERE id_pro = $3 RETURNING *',
            [active, visible, id]
        );
        if (result.rowCount === 0) {
            logger.warn(`Proveedor no encontrado: ${id}`);
            return res.status(404).json({ error: 'Proveedor no encontrado' });
        }
        res.json(result.rows[0]);
        logger.info(`Proveedor actualizado: ${id}`);
    } catch (error) {
        logger.error(`Error al actualizar proveedor ${id}: ${error.message}`);
        res.status(500).json({ error: 'Error al actualizar proveedor' });
    }
});

module.exports = { router, PROVEEDORES };