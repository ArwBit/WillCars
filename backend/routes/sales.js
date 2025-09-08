const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const sanitizeHtml = require('sanitize-html');
// Importa el middleware de autenticación que usarás
const { authenticateAdminOrProvider } = require('../middleware/auth'); // O 'verifyToken' si no quieres rol específico

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT
});

// Aplica el middleware de autenticación a TODAS las rutas en sales.js que quieres proteger
// Usamos authenticateAdminOrProvider ya que son "ventas" y probablemente solo admins/proveedores las verán.
router.get('/', authenticateAdminOrProvider, async (req, res) => { // <-- ¡Aquí está el cambio clave!
    const search = req.query.search;
    const period = req.query.period;

    try {
        // ... (el resto de tu lógica de ventas refactorizada, que ya te proporcioné) ...
        let query = '';
        let params = [];
        let result;

        if (period) {
            switch (period) {
                case 'week':
                    query = `
                        SELECT date_trunc('day', created_at) as date, SUM(total) as total
                        FROM orders
                        WHERE status = 'completed' AND created_at >= CURRENT_DATE - INTERVAL '7 days'
                        GROUP BY date_trunc('day', created_at)
                        ORDER BY date;
                    `;
                    break;
                case 'month':
                    query = `
                        SELECT date_trunc('month', created_at) as date, SUM(total) as total
                        FROM orders
                        WHERE status = 'completed' AND created_at >= CURRENT_DATE - INTERVAL '1 month'
                        GROUP BY date_trunc('month', created_at)
                        ORDER BY date;
                    `;
                    break;
                case 'year':
                    query = `
                        SELECT date_trunc('year', created_at) as date, SUM(total) as total
                        FROM orders
                        WHERE status = 'completed' AND created_at >= CURRENT_DATE - INTERVAL '1 year'
                        GROUP BY date_trunc('year', created_at)
                        ORDER BY date;
                    `;
                    break;
                default:
                    return res.status(400).json({ error: 'Período de ventas no válido.' });
            }
            result = await pool.query(query, params);
            res.json(result.rows);

        } else if (search) {
            const sanitizedSearch = `%${sanitizeHtml(search)}%`;
            query = `
                SELECT SUM(total) as salesToday
                FROM orders
                WHERE status = 'completed' AND date_trunc('day', created_at) = CURRENT_DATE
                AND customer_name ILIKE $1;
            `;
            params = [sanitizedSearch];
            result = await pool.query(query, params);
            res.json({
                salesToday: result.rows[0].salesToday || 0
            });

        } else {
            query = `
                SELECT SUM(total) as salesToday
                FROM orders
                WHERE status = 'completed' AND date_trunc('day', created_at) = CURRENT_DATE;
            `;
            result = await pool.query(query);
            res.json({
                salesToday: result.rows[0].salesToday || 0
            });
        }

    } catch (error) {
        console.error('Error al obtener datos de ventas:', error);
        res.status(500).json({ error: 'Error interno del servidor al obtener datos de ventas' });
    }
});

module.exports = router;