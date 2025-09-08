// backend/create-admin.js
require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'willcars',
    user: 'postgres',
    password: process.env.PG_PASSWORD || 'HhKk1w2j8*2121'
});

async function createAdminUser(email, password, role = 'admin') {
    try {
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        const query = `
            INSERT INTO users (email, password, role)
            VALUES ($1, $2, $3)
            ON CONFLICT (email) DO UPDATE
            SET password = EXCLUDED.password, role = EXCLUDED.role
            RETURNING id, email, role;
        `;
        const values = [email, hashedPassword, role];
        const result = await pool.query(query, values);
        console.log('Usuario creado/actualizado:', result.rows[0]);
    } catch (error) {
        console.error('Error al crear usuario:', error.message);
    } finally {
        await pool.end();
    }
}

createAdminUser('willmetacars@gmail.com', 'HhKk1w2j8*2121', 'admin');