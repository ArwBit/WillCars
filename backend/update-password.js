const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'willcars',
    password: process.env.PG_PASSWORD || 'tu_contraseña',
    port: process.env.DB_PORT || 5432
});

async function updateUserPassword(email, newPassword) {
    try {
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
        const query = `
            UPDATE users
            SET password = $1
            WHERE email = $2
            RETURNING id, email, role;
        `;
        const values = [hashedPassword, email];
        const result = await pool.query(query, values);
        if (result.rows.length === 0) {
            console.log('Usuario no encontrado:', email);
            return;
        }
        console.log('Contraseña actualizada:', result.rows[0]);
    } catch (error) {
        console.error('Error al actualizar contraseña:', error.message);
    } finally {
        await pool.end();
    }
}

const args = process.argv.slice(2);
const email = args[0] || 'admin@wilcars.com';
const newPassword = args[1] || 'test1234';

updateUserPassword(email, newPassword);




"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NjQsImVtYWlsIjoiYWRtaW5Ad2lsbGNhcnMuY29tIiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzQ1NTMxMDE5LCJleHAiOjE3NDU1MzQ2MTl9.1sRWGF2J90DvjbGr0YZqeztCGwve-zQpKageayUkwG8
curl -X POST http://localhost:3000/api/products -H "Content-Type: application/json" -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NjQsImVtYWlsIjoiYWRtaW5Ad2lsbGNhcnMuY29tIiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzQ1NTMxMDE5LCJleHAiOjE3NDU1MzQ2MTl9.1sRWGF2J90DvjbGr0YZqeztCGwve-zQpKageayUkwG8 -d "{\"code\":\"TEST002\",\"description\":\"Producto de prueba 2\",\"brand\":\"Marca2\",\"model\":\"Modelo2\",\"usd\":120,\"ref\":110}"












¡Inicio de sesión exitoso! Bienvenido, admin@willcars.com (admin)

willcars-#
willcars-# DELETE FROM products WHERE code = 'TEST002';
ERROR:  error de sintaxis en o cerca de «curl»
LINE 1: curl -X POST http://localhost:3000/api/products -H "Content-...
        ^
willcars=# SELECT * FROM products WHERE code IN ('TEST002', 'TEST003');
  code   |     description      | brand  |  model  |  usd   |  ref   |         created_at         | image_path | id | discount
---------+----------------------+--------+---------+--------+--------+----------------------------+------------+----+----------
 TEST003 | Producto de prueba 3 | Marca3 | Modelo3 | 130.00 | 120.00 | 2025-04-24 17:52:54.670156 |            | 23 |
 TEST002 | Producto de prueba 2 | Marca2 | Modelo2 | 120.00 | 110.00 | 2025-04-24 18:15:03.850702 |            | 24 |
(2 rows)


willcars=# \d products
                                         Table "public.products"
   Column    |            Type             | Collation | Nullable |               Default
-------------+-----------------------------+-----------+----------+--------------------------------------
 code        | character varying(50)       |           | not null |
 description | text                        |           | not null |
 brand       | character varying(100)      |           |          |
 model       | character varying(100)      |           |          |
 usd         | numeric(10,2)               |           | not null |
 ref         | numeric(10,2)               |           | not null |
 created_at  | timestamp without time zone |           |          | CURRENT_TIMESTAMP
 image_path  | character varying(255)      |           |          |
 id          | integer                     |           | not null | nextval('products_id_seq'::regclass)
 discount    | character varying(10)       |           |          |
Indexes:
    "products_pkey" PRIMARY KEY, btree (id)
    "products_code_unique" UNIQUE CONSTRAINT, btree (code)
Referenced by:
    TABLE "order_items" CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL


willcars=#

Esto significa que:
La contraseña test1234 para admin@willcars.com está correctamente configurada.

La contraseña K1w2j82121 para adminwillmetacars@gmail.com sigue funcionando.



Directory of C:\Users\warei\Desktop\WillCarsWeb\will-cars-backend

04/24/2025  01:44 PM    <DIR>          .
04/24/2025  01:44 PM    <DIR>          ..
04/17/2025  09:50 PM               197 .env
04/20/2025  10:15 PM    <DIR>          admin
04/19/2025  11:32 PM    <DIR>          archive
04/21/2025  11:47 AM                 0 cd
04/21/2025  12:45 AM    <DIR>          config
04/24/2025  10:17 AM             1,255 create-admin.js
04/21/2025  11:47 AM                 0 dir
04/24/2025  01:44 PM                 0 findstr
04/24/2025  09:52 AM    <DIR>          node_modules
04/24/2025  09:52 AM            61,700 package-lock.json
04/24/2025  10:06 AM               639 package.json
04/21/2025  12:55 AM    <DIR>          routes
04/21/2025  01:33 PM    <DIR>          scripts
04/20/2025  04:31 PM            11,504 server.js
04/24/2025  11:17 AM             1,624 update-password.js
04/20/2025  10:14 PM    <DIR>          uploads
               9 File(s)         76,919 bytes
               9 Dir(s)  94,171,955,200 bytes free

C:\Users\warei\Desktop\WillCarsWeb\will-cars-backend>

 Directory of C:\Users\warei\Desktop\WillCarsWeb\will-cars-frontend

04/21/2025  08:54 PM    <DIR>          .
04/21/2025  08:54 PM    <DIR>          ..
04/24/2025  01:43 PM            78,990 buscador.html
04/19/2025  08:35 AM            19,114 contact.html
04/20/2025  09:50 PM    <DIR>          css
04/18/2025  08:11 PM    <DIR>          img
04/19/2025  08:35 AM            61,902 index.html
03/11/2021  11:08 AM    <DIR>          js
04/19/2025  08:24 AM    <DIR>          lib
04/21/2025  02:15 PM             2,669 login.html
03/11/2021  11:08 AM    <DIR>          mail
04/21/2025  08:54 PM    <DIR>          node_modules
04/21/2025  08:54 PM             1,673 package-lock.json
04/21/2025  08:54 PM               324 package.json
04/21/2025  09:15 PM    <DIR>          scss
04/19/2025  08:35 AM            47,264 shop.html
               7 File(s)        211,936 bytes
               9 Dir(s)  94,171,389,952 bytes free

C:\Users\warei\Desktop\WillCarsWeb\will-cars-frontend>
server.js
const express = require('express');
const jwt = require('jsonwebtoken');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcrypt');
const multer = require('multer');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Configurar conexión a PostgreSQL
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT
});

// Configurar multer para subir imágenes
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, 'Uploads'));
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});
const upload = multer({ storage });

// Servir frontend público
app.use(express.static(path.join(__dirname, '../will-cars-frontend')));

// Servir imágenes subidas
app.use('/uploads', express.static(path.join(__dirname, 'Uploads')));

// Middleware de autenticación
const authenticateToken = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).send('No se proporcionó token');
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).send('Token inválido');
    }
};

// Middleware para verificar rol de administrador
const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).send('Acceso denegado. Solo administradores.');
    }
    next();
};

// Servir dashboard administrativo protegido
app.use('/admin', authenticateToken, requireAdmin, express.static(path.join(__dirname, 'admin')));
app.get('/admin', authenticateToken, requireAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'admin', 'admin.html'));
});

// API: Login
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = result.rows[0];
        if (!user || !bcrypt.compareSync(password, user.password)) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }
        const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.json({
            user: { id: user.id, email: user.email, role: user.role },
            token
        });
    } catch (error) {
        console.error('Error al iniciar sesión:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

// API: Verificar token
app.get('/api/auth/verify', authenticateToken, (req, res) => {
    res.json({ valid: true, user: req.user });
});

// API: Usuarios
app.get('/api/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const result = await pool.query('SELECT id, email, role, created_at FROM users');
        res.json(result.rows);
    } catch (error) {
        console.error('Error al obtener usuarios:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

app.post('/api/users', authenticateToken, requireAdmin, async (req, res) => {
    const { email, password, role } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await pool.query(
            'INSERT INTO users (email, password, role, created_at) VALUES ($1, $2, $3, $4) RETURNING id, email, role, created_at',
            [email, hashedPassword, role, new Date()]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error al crear usuario:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

app.put('/api/users/:id/role', authenticateToken, requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { role } = req.body;
    try {
        const result = await pool.query('UPDATE users SET role = $1 WHERE id = $2 RETURNING id, email, role, created_at', [role, id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error al actualizar rol:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

app.put('/api/users/:id/password', authenticateToken, requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        res.json({ message: 'Contraseña actualizada' });
    } catch (error) {
        console.error('Error al actualizar contraseña:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

app.delete('/api/users/:id', authenticateToken, requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM users WHERE id = $1', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        res.json({ message: 'Usuario eliminado' });
    } catch (error) {
        console.error('Error al eliminar usuario:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

// API: Productos
app.get('/api/products', async (req, res) => {
    try {
        const result = await pool.query('SELECT code, description, brand, model, usd, ref, image_path FROM products');
        res.json(result.rows);
    } catch (error) {
        console.error('Error al obtener productos:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

app.get('/api/products/:code', authenticateToken, requireAdmin, async (req, res) => {
    const { code } = req.params;
    try {
        const result = await pool.query('SELECT code, description, brand, model, usd, ref, image_path FROM products WHERE code = $1', [code]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error al obtener producto:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

app.post('/api/products', authenticateToken, requireAdmin, upload.single('image'), async (req, res) => {
    const { code, description, brand, model, usd, ref } = req.body;
    const imagePath = req.file ? `/uploads/${req.file.filename}` : null;
    try {
        const result = await pool.query(
            'INSERT INTO products (code, description, brand, model, usd, ref, image_path) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
            [code, description, brand, model, parseFloat(usd), parseFloat(ref), imagePath]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error al crear producto:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

app.put('/api/products/:code', authenticateToken, requireAdmin, upload.single('image'), async (req, res) => {
    const { code } = req.params;
    const { description, brand, model, usd, ref } = req.body;
    const imagePath = req.file ? `/uploads/${req.file.filename}` : req.body.image_path;
    try {
        const result = await pool.query(
            'UPDATE products SET description = $1, brand = $2, model = $3, usd = $4, ref = $5, image_path = $6 WHERE code = $7 RETURNING *',
            [description, brand, model, parseFloat(usd), parseFloat(ref), imagePath, code]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error al actualizar producto:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

app.delete('/api/products/:code', authenticateToken, requireAdmin, async (req, res) => {
    const { code } = req.params;
    try {
        const result = await pool.query('DELETE FROM products WHERE code = $1', [code]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }
        res.json({ message: 'Producto eliminado' });
    } catch (error) {
        console.error('Error al eliminar producto:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

// API: Pedidos
app.get('/api/orders', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const result = await pool.query('SELECT id, user_email, total, status, created_at FROM orders');
        res.json(result.rows);
    } catch (error) {
        console.error('Error al obtener pedidos:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

app.post('/api/orders', async (req, res) => {
    const { user_email, total, status } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO orders (user_email, total, status, created_at) VALUES ($1, $2, $3, $4) RETURNING *',
            [user_email, parseFloat(total), status || 'pending', new Date()]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error al crear pedido:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

app.put('/api/orders/:id/status', authenticateToken, requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
        const result = await pool.query('UPDATE orders SET status = $1 WHERE id = $2 RETURNING *', [status, id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Pedido no encontrado' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error al actualizar estado:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

app.delete('/api/orders/:id', authenticateToken, requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM orders WHERE id = $1', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Pedido no encontrado' });
        }
        res.json({ message: 'Pedido eliminado' });
    } catch (error) {
        console.error('Error al eliminar pedido:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

PORT=3000
JWT_SECRET=K1w2j8*2121/2424
EMAIL_USER=willmetacars@gmail.com
EMAIL_PASS=HhKk1w2j8*2121
DB_USER=postgres
DB_HOST=localhost
DB_NAME=willcars
DB_PASSWORD=HhKk1w2j8*2121
DB_PORT=5432






