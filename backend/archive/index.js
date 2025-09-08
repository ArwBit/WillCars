require('dotenv').config();
console.log('DB Config:', {
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

const { Pool } = require('pg');
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

// Configuración de middleware
app.use(cors());
app.use(express.json());

// Servir archivos estáticos
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, '../will-cars-frontend')));
app.use('/img', express.static(path.join(__dirname, '../will-cars-frontend/img')));
app.use('/lib', express.static(path.join(__dirname, '../will-cars-frontend/lib')));
app.use('/css', express.static(path.join(__dirname, '../will-cars-frontend/css')));
app.use('/js', express.static(path.join(__dirname, '../will-cars-frontend/js')));

// Redirigir raíz a index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../will-cars-frontend/index.html'));
});

// Configuración de Multer (una sola declaración)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'uploads/';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir);
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png/;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = filetypes.test(file.mimetype);
        if (extname && mimetype) {
            return cb(null, true);
        } else {
            cb(new Error('Solo se permiten imágenes (jpg, jpeg, png)'));
        }
    },
    limits: { fileSize: 5 * 1024 * 1024 } // Límite de 5MB
});

// Conexión a PostgreSQL
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

pool.connect((err) => {
    if (err) {
        console.error('Error conectando a PostgreSQL:', err.stack);
        return;
    }
    console.log('Conectado a PostgreSQL');
});

// Middleware para verificar token JWT
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Acceso denegado. Token no proporcionado.' });

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Token inválido.' });
        req.user = user;
        next();
    });
}

// Registro de usuario
app.post('/api/auth/register', async (req, res) => {
    const { email, password, role } = req.body;
    if (!email || !password || !role) {
        return res.status(400).json({ error: 'Email, contraseña y rol son requeridos.' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await pool.query(
            'INSERT INTO users (email, password, role) VALUES ($1, $2, $3) RETURNING *',
            [email.toLowerCase(), hashedPassword, role]
        );
        res.status(201).json({ message: 'Usuario registrado exitosamente.' });
    } catch (error) {
        if (error.code === '23505') {
            res.status(400).json({ error: 'El email ya está registrado.' });
        } else {
            console.error('Error al registrar usuario:', error);
            res.status(500).json({ error: 'Error al registrar usuario.' });
        }
    }
});

// Login de usuario
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email y contraseña son requeridos.' });
    }

    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
        const user = result.rows[0];
        if (!user) {
            return res.status(400).json({ error: 'Email o contraseña incorrectos.' });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(400).json({ error: 'Email o contraseña incorrectos.' });
        }

        const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, {
            expiresIn: '1h',
        });
        res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
    } catch (error) {
        console.error('Error al iniciar sesión:', error);
        res.status(500).json({ error: 'Error al iniciar sesión.' });
    }
});

// Obtener lista de usuarios (solo admin)
app.get('/api/users', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Acceso denegado. Solo administradores.' });
    }

    try {
        const result = await pool.query('SELECT id, email, role FROM users');
        res.json(result.rows);
    } catch (error) {
        console.error('Error al obtener usuarios:', error);
        res.status(500).json({ error: 'Error al obtener usuarios.' });
    }
});

// Cambiar rol de usuario (solo admin)
app.put('/api/users/:id/role', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Acceso denegado. Solo administradores.' });
    }

    const { id } = req.params;
    const { role } = req.body;
    if (!role || !['user', 'admin'].includes(role)) {
        return res.status(400).json({ error: 'Rol inválido.' });
    }

    try {
        const result = await pool.query('UPDATE users SET role = $1 WHERE id = $2 RETURNING *', [role, id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }
        res.json({ message: 'Rol actualizado exitosamente.', user: result.rows[0] });
    } catch (error) {
        console.error('Error al cambiar rol:', error);
        res.status(500).json({ error: 'Error al cambiar rol.' });
    }
});

// Eliminar usuario (solo admin)
app.delete('/api/users/:id', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Acceso denegado. Solo administradores.' });
    }

    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }
        res.json({ message: 'Usuario eliminado exitosamente.' });
    } catch (error) {
        console.error('Error al eliminar usuario:', error);
        res.status(500).json({ error: 'Error al eliminar usuario.' });
    }
});

// Obtener lista de productos
app.get('/api/products', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM products');
        res.json(result.rows);
    } catch (error) {
        console.error('Error al obtener productos:', error);
        res.status(500).json({ error: 'Error al obtener productos.' });
    }
});

// Añadir producto (solo admin)
app.post('/api/products', authenticateToken, upload.single('image'), async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Acceso denegado. Solo administradores.' });
    }

    const { code, description, brand, model, usd, ref } = req.body;
    const imagePath = req.file ? `/uploads/${req.file.filename}` : null;

    if (!code || !description || !brand || !model || !usd || !ref) {
        return res.status(400).json({ error: 'Todos los campos son requeridos.' });
    }

    try {
        const result = await pool.query(
            'INSERT INTO products (code, description, brand, model, usd, ref, image_path) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
            [code, description, brand, model, usd, ref, imagePath]
        );
        res.status(201).json({ message: 'Producto añadido exitosamente.', product: result.rows[0] });
    } catch (error) {
        if (error.code === '23505') {
            res.status(400).json({ error: 'El código del producto ya existe.' });
        } else {
            console.error('Error al añadir producto:', error);
            res.status(500).json({ error: 'Error al añadir producto.' });
        }
    }
});

// Editar producto (solo admin)
app.put('/api/products/:code', authenticateToken, upload.single('image'), async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Acceso denegado. Solo administradores.' });
    }

    const { code } = req.params;
    const { description, brand, model, usd, ref } = req.body;
    const imagePath = req.file ? `/uploads/${req.file.filename}` : req.body.image_path;

    if (!description || !brand || !model || !usd || !ref) {
        return res.status(400).json({ error: 'Todos los campos son requeridos.' });
    }

    try {
        // Obtener imagen anterior para eliminarla
        const oldProduct = await pool.query('SELECT image_path FROM products WHERE code = $1', [code]);
        if (oldProduct.rows.length === 0) {
            return res.status(404).json({ error: 'Producto no encontrado.' });
        }

        // Actualizar producto
        const result = await pool.query(
            'UPDATE products SET description = $1, brand = $2, model = $3, usd = $4, ref = $5, image_path = $6 WHERE code = $7 RETURNING *',
            [description, brand, model, usd, ref, imagePath, code]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Producto no encontrado.' });
        }

        // Eliminar imagen anterior si existe y se subió una nueva
        if (req.file && oldProduct.rows[0].image_path) {
            const oldImagePath = path.join(__dirname, oldProduct.rows[0].image_path);
            if (fs.existsSync(oldImagePath)) {
                fs.unlinkSync(oldImagePath);
            }
        }

        res.json({ message: 'Producto actualizado exitosamente.', product: result.rows[0] });
    } catch (error) {
        console.error('Error al actualizar producto:', error);
        res.status(500).json({ error: 'Error al actualizar producto.' });
    }
});

// Eliminar producto (solo admin)
app.delete('/api/products/:code', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Acceso denegado. Solo administradores.' });
    }

    const { code } = req.params;
    try {
        // Obtener imagen para eliminarla
        const product = await pool.query('SELECT image_path FROM products WHERE code = $1', [code]);
        if (product.rows.length === 0) {
            return res.status(404).json({ error: 'Producto no encontrado.' });
        }

        // Eliminar producto
        const result = await pool.query('DELETE FROM products WHERE code = $1 RETURNING *', [code]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Producto no encontrado.' });
        }

        // Eliminar imagen si existe
        if (product.rows[0].image_path) {
            const imagePath = path.join(__dirname, product.rows[0].image_path);
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
        }

        res.json({ message: 'Producto eliminado exitosamente.' });
    } catch (error) {
        console.error('Error al eliminar producto:', error);
        res.status(500).json({ error: 'Error al eliminar producto.' });
    }
});

// Crear pedido
app.post('/api/orders', authenticateToken, async (req, res) => {
    const { user_id, products, total, contact_method, contact_info } = req.body;
    if (!user_id || !products || !total || !contact_method || !contact_info) {
        return res.status(400).json({ error: 'Todos los campos son requeridos.' });
    }

    try {
        const result = await pool.query(
            'INSERT INTO orders (user_id, products, total, status, contact_method, contact_info) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [user_id, JSON.stringify(products), total, 'pending', contact_method, contact_info]
        );
        res.status(201).json({ message: 'Pedido creado exitosamente.', order: result.rows[0] });
    } catch (error) {
        console.error('Error al crear pedido:', error);
        res.status(500).json({ error: 'Error al crear pedido.' });
    }
});

// Obtener lista de pedidos (solo admin)
app.get('/api/orders', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Acceso denegado. Solo administradores.' });
    }

    try {
        const result = await pool.query('SELECT * FROM orders');
        res.json(result.rows);
    } catch (error) {
        console.error('Error al obtener pedidos:', error);
        res.status(500).json({ error: 'Error al obtener pedidos.' });
    }
});

// Actualizar estado de pedido (solo admin)
app.put('/api/orders/:id/status', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Acceso denegado. Solo administradores.' });
    }

    const { id } = req.params;
    const { status } = req.body;
    if (!status || !['pending', 'processing', 'shipped'].includes(status)) {
        return res.status(400).json({ error: 'Estado inválido.' });
    }

    try {
        const result = await pool.query('UPDATE orders SET status = $1 WHERE id = $2 RETURNING *', [status, id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Pedido no encontrado.' });
        }
        res.json({ message: 'Estado del pedido actualizado exitosamente.', order: result.rows[0] });
    } catch (error) {
        console.error('Error al actualizar estado del pedido:', error);
        res.status(500).json({ error: 'Error al actualizar estado del pedido.' });
    }
});

// Iniciar servidor (una sola vez)
app.listen(port, () => {
    console.log(`Servidor corriendo en puerto ${port}`);
});