// backend/routes/stats.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
const logger = require('../logger');

const authenticateToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) {
        logger.warn('No se proporcionó token');
        return res.status(401).json({ error: 'No se proporcionó token' });
    }
    try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        logger.error(`Error al verificar token: ${err.message}`);
        res.status(401).json({ error: 'Token inválido' });
    }
};

const authenticateAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        logger.warn(`Acceso denegado para usuario ${req.user.email}: no es administrador`);
        return res.status(403).json({ error: 'Acceso denegado. Solo administradores.' });
    }
    next();
};

router.get('/', authenticateToken, authenticateAdmin, async (req, res) => {
    try {
        const salesToday = await pool.query(
            `SELECT COALESCE(SUM(total), 0) as total FROM orders WHERE DATE(created_at) = CURRENT_DATE`
        );
        const totalUsers = await pool.query(`SELECT COUNT(*) as count FROM users`);
        const totalOrders = await pool.query(`SELECT COUNT(*) as count FROM orders`);
        const totalProducts = await pool.query(`SELECT COUNT(*) as count FROM products`);
        const pendingOrders = await pool.query(
            `SELECT COUNT(*) as count FROM orders WHERE status = 'pending'`
        );
        const salesYesterday = await pool.query(
            `SELECT COALESCE(SUM(total), 0) as total FROM orders WHERE DATE(created_at) = CURRENT_DATE - INTERVAL '1 day'`
        );
        const salesTrend = salesYesterday.rows[0].total > 0
            ? ((salesToday.rows[0].total - salesYesterday.rows[0].total) / salesYesterday.rows[0].total * 100).toFixed(1)
            : 0;
        const usersLastWeek = await pool.query(
            `SELECT COUNT(*) as count FROM users WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'`
        );
        const usersTrend = totalUsers.rows[0].count > 0
            ? (usersLastWeek.rows[0].count / totalUsers.rows[0].count * 100).toFixed(1)
            : 0;
        const ordersLastWeek = await pool.query(
            `SELECT COUNT(*) as count FROM orders WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'`
        );
        const ordersTrend = totalOrders.rows[0].count > 0
            ? (ordersLastWeek.rows[0].count / totalOrders.rows[0].count * 100).toFixed(1)
            : 0;
        const productsLastWeek = await pool.query(
            `SELECT COUNT(*) as count FROM products WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'`
        );
        const productsTrend = totalProducts.rows[0].count > 0
            ? (productsLastWeek.rows[0].count / totalProducts.rows[0].count * 100).toFixed(1)
            : 0;

        const response = {
            salesToday: parseFloat(salesToday.rows[0].total || 0),
            totalUsers: parseInt(totalUsers.rows[0].count || 0, 10),
            totalOrders: parseInt(totalOrders.rows[0].count || 0, 10),
            totalProducts: parseInt(totalProducts.rows[0].count || 0, 10),
            pendingOrders: parseInt(pendingOrders.rows[0].count || 0, 10),
            salesTrend: parseFloat(salesTrend || 0),
            usersTrend: parseFloat(usersTrend || 0),
            ordersTrend: parseFloat(ordersTrend || 0),
            productsTrend: parseFloat(productsTrend || 0)
        };

        logger.info(`Estadísticas obtenidas por ${req.user.email}: ${JSON.stringify(response)}`);
        res.json(response);
    } catch (error) {
        logger.error(`Error al obtener estadísticas: ${error.message}`);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

module.exports = router;