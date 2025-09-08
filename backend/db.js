const { Pool } = require('pg');
const path = require('path');
const dotenv = require('dotenv');

const envPath = path.resolve(__dirname, '.env');
const result = dotenv.config({ path: envPath });

if (result.error) {
    console.error('Error al cargar .env:', result.error);
    throw result.error;
}

console.log('Variables de entorno cargadas:', {
    DB_USER: process.env.DB_USER,
    DB_HOST: process.env.DB_HOST,
    DB_NAME: process.env.DB_NAME,
    DB_PASSWORD: process.env.DB_PASSWORD,
    DB_PORT: process.env.DB_PORT
});

if (!process.env.DB_PASSWORD) {
    throw new Error('DB_PASSWORD no está definido en .env');
}

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

pool.on('connect', () => {
    console.log('Conectado a la base de datos PostgreSQL');
});

pool.on('error', (err) => {
    console.error('Error en la conexión a la base de datos:', err.stack);
});

module.exports = pool;