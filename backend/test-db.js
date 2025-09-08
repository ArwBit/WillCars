const pool = require('./config/db');

async function testConnection() {
    try {
        const res = await pool.query('SELECT * FROM products LIMIT 1');
        console.log('Conexión exitosa. Primer producto:', res.rows[0]);
    } catch (error) {
        console.error('Error de conexión:', error.message, error.stack);
    } finally {
        await pool.end();
    }
}

testConnection();