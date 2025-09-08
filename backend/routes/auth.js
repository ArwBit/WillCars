// backend/routes/auth.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const Joi = require('joi');
const logger = require('../logger');
const pool = require('../db');
const crypto = require('crypto');
const { sendEmail } = require('../src/utils/emailService');

// Esquema de validación para registro de usuarios
const registerSchema = Joi.object({
    name: Joi.string().min(3).max(255).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).max(255).required(),
    role: Joi.string().valid('client', 'proveedor', 'admin').required(),
    proveedorName: Joi.string().min(3).max(255).when('role', {
        is: 'proveedor',
        then: Joi.required(),
        otherwise: Joi.allow('')
    })
});

// Esquema de validación para restablecimiento de contraseña
const resetPasswordSchema = Joi.object({
    token: Joi.string().required(),
    newPassword: Joi.string().min(6).max(255).required()
});

// --- Ruta de Login ---
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    logger.info(`Intento de login para email: ${email}`);

    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) {
            logger.warn(`Credenciales inválidas para email: ${email} (usuario no encontrado)`);
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        const user = result.rows[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            logger.warn(`Contraseña incorrecta para email: ${email}`);
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        if (user.status === 'pending') {
            logger.warn(`Intento de login con usuario pendiente: ${email}`);
            return res.status(403).json({ error: 'Cuenta pendiente de aprobación' });
        }

        // Actualizar last_login
        await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

        const tokenPayload = {
            id: user.id,
            email: user.email,
            role: user.role,
            name: user.name,
            status: user.status
        };
        if (user.proveedor_id) {
            tokenPayload.proveedor_id = user.proveedor_id;
        }

        const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '24h' });

        logger.info(`Login exitoso para email: ${email}, role: ${user.role}`);
        res.json({
            token,
            user: {
                email: user.email,
                role: user.role,
                name: user.name,
                client_code: user.client_code,
                proveedor_id: user.proveedor_id,
                status: user.status
            }
        });
    } catch (error) {
        logger.error(`Error en login para email: ${email}: ${error.message}`);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

// --- Ruta de Verificación de Token ---
router.get('/verify', (req, res) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    logger.info('Verificando token');

    if (!token) {
        logger.warn('No se proporcionó token en verificación');
        return res.status(401).json({ valid: false, error: 'No token provided' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        logger.info(`Token verificado para email: ${decoded.email}`);
        res.json({
            valid: true,
            role: decoded.role,
            name: decoded.name,
            proveedor_id: decoded.proveedor_id,
            status: decoded.status
        });
    } catch (error) {
        logger.error(`Error verificando token: ${error.message}`);
        res.status(401).json({ valid: false, error: 'Token inválido' });
    }
});

// --- Ruta de Registro ---
router.post('/register', async (req, res) => {
    logger.info(`Intento de registro para email: ${req.body.email}`);

    try {
        const { error } = registerSchema.validate(req.body);
        if (error) {
            logger.warn(`Error de validación en registro: ${error.details[0].message}`);
            return res.status(400).json({ error: error.details[0].message });
        }

        const { name, email, password, role, proveedorName } = req.body;

        const emailCheck = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (emailCheck.rows.length > 0) {
            logger.warn(`Email ya registrado: ${email}`);
            return res.status(400).json({ error: 'El email ya está registrado' });
        }

        let clientCode;
        let codeExists = true;
        while (codeExists) {
            clientCode = `CL-${Math.floor(10000 + Math.random() * 90000)}`;
            const codeCheck = await pool.query('SELECT * FROM users WHERE client_code = $1', [clientCode]);
            if (codeCheck.rows.length === 0) codeExists = false;
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        let proveedorId = null;
        if (role === 'proveedor') {
            codeExists = true;
            while (codeExists) {
                proveedorId = `SUP-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
                const idCheck = await pool.query('SELECT * FROM suppliers WHERE id_pro = $1', [proveedorId]);
                if (idCheck.rows.length === 0) codeExists = false;
            }
        }

        const userResult = await pool.query(
            'INSERT INTO users (name, email, password, role, client_code, proveedor_id, status, created_at, active) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8) RETURNING id, email, role, name, client_code, proveedor_id, status',
            [name, email, hashedPassword, role, clientCode, proveedorId, role === 'proveedor' ? 'pending' : 'active', true]
        );
        const user = userResult.rows[0];

        if (role === 'proveedor') {
            await pool.query(
                'INSERT INTO suppliers (id_pro, name, email_contacto, user_id, created_at, active, visible) VALUES ($1, $2, $3, $4, NOW(), $5, $6)',
                [proveedorId, proveedorName, email, user.id, true, true]
            );
            logger.info(`Proveedor creado: ${proveedorId} para usuario: ${email}`);
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role, name: user.name, proveedor_id: user.proveedor_id, status: user.status },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        logger.info(`Registro exitoso para email: ${email}, role: ${role}, status: ${user.status}`);
        res.status(201).json({
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                client_code: user.client_code,
                proveedor_id: user.proveedor_id,
                status: user.status
            },
            token
        });
    } catch (error) {
        logger.error(`Error en registro para email: ${req.body.email}: ${error.message}`);
        res.status(500).json({ error: 'Error en el servidor' });
    }
});

// --- Ruta para solicitar restablecimiento de contraseña ---
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    logger.info(`Solicitud de restablecimiento de contraseña para email: ${email}`);

    try {
        const userResult = await pool.query('SELECT id, email FROM users WHERE email = $1', [email]);
        if (userResult.rows.length === 0) {
            logger.warn(`Intento de restablecimiento para email no registrado: ${email}`);
            return res.status(200).json({ message: 'Si el correo existe, recibirás un enlace para restablecer tu contraseña.' });
        }

        const user = userResult.rows[0];
        const resetToken = crypto.randomBytes(32).toString('hex');
        const expires = new Date(Date.now() + 3600000);

        await pool.query(
            'UPDATE users SET reset_password_token = $1, reset_password_expires = $2 WHERE id = $3',
            [resetToken, expires, user.id]
        );

        const resetLink = `http://localhost:3000/reset-password.html?token=${resetToken}`;
        const emailSubject = 'Restablecimiento de Contraseña para WillCars';
        const emailText = `Has solicitado restablecer tu contraseña. Haz clic en el siguiente enlace: ${resetLink}. Este enlace expirará en 1 hora.`;
        const emailHtml = `
            <p>Hola,</p>
            <p>Has solicitado restablecer tu contraseña para tu cuenta de WillCars.</p>
            <p>Por favor, haz clic en el siguiente enlace para restablecer tu contraseña:</p>
            <p><a href="${resetLink}">Restablecer Contraseña</a></p>
            <p>Este enlace es válido por **1 hora**.</p>
            <p>Si no solicitaste este restablecimiento, por favor ignora este correo.</p>
            <p>Saludos,</p>
            <p>El equipo de WillCars</p>
        `;

        const emailSent = await sendEmail(user.email, emailSubject, emailText, emailHtml);
        if (emailSent) {
            logger.info(`Email de restablecimiento enviado a ${user.email}`);
            res.status(200).json({ message: 'Si el correo existe, recibirás un enlace para restablecer tu contraseña.' });
        } else {
            logger.error(`Fallo al enviar email de restablecimiento a ${user.email}`);
            res.status(500).json({ error: 'Error al enviar el correo de restablecimiento.' });
        }
    } catch (error) {
        logger.error(`Error en forgot-password para email ${email}: ${error.message}`);
        res.status(500).json({ error: 'Error del servidor al procesar la solicitud.' });
    }
});

// --- Ruta para restablecer la contraseña ---
router.post('/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;
    logger.info(`Intento de restablecer contraseña con token: ${token ? token.substring(0, 10) + '...' : 'no token'}`);

    try {
        const { error } = resetPasswordSchema.validate(req.body);
        if (error) {
            logger.warn(`Error de validación en reset-password: ${error.details[0].message}`);
            return res.status(400).json({ error: error.details[0].message });
        }

        const userResult = await pool.query(
            'SELECT id, email FROM users WHERE reset_password_token = $1 AND reset_password_expires > NOW()',
            [token]
        );

        if (userResult.rows.length === 0) {
            logger.warn(`Token de restablecimiento inválido o expirado.`);
            return res.status(400).json({ error: 'El token de restablecimiento es inválido o ha expirado.' });
        }

        const user = userResult.rows[0];
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await pool.query(
            'UPDATE users SET password = $1, reset_password_token = NULL, reset_password_expires = NULL WHERE id = $2',
            [hashedPassword, user.id]
        );

        logger.info(`Contraseña restablecida exitosamente para usuario: ${user.email}`);
        res.status(200).json({ message: 'Contraseña restablecida exitosamente.' });
    } catch (error) {
        logger.error(`Error en reset-password: ${error.message}`);
        res.status(500).json({ error: 'Error del servidor al restablecer la contraseña.' });
    }
});

// --- Ruta para obtener usuarios ---
router.get('/users', async (req, res) => {
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) {
        logger.warn('Intento de acceso no autorizado a usuarios');
        return res.status(401).json({ error: 'No autorizado: Token no proporcionado' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role !== 'admin') {
            logger.warn(`Acceso denegado a usuarios para usuario: ${decoded.email}`);
            return res.status(403).json({ error: 'Acceso denegado: Solo administradores' });
        }

        const { page = 1, limit = 10, search = '' } = req.query;
        const offset = (page - 1) * limit;
        const searchQuery = search ? `%${search}%` : '%';

        const result = await pool.query(
            `SELECT u.id, u.name, u.email, u.role, u.proveedor_id as providerid, u.status, u.last_login, s.name as proveedor_name
             FROM users u
             LEFT JOIN suppliers s ON u.proveedor_id = s.id_pro
             WHERE u.name ILIKE $1 OR u.email ILIKE $1 OR u.proveedor_id ILIKE $1
             ORDER BY u.id DESC
             LIMIT $2 OFFSET $3`,
            [searchQuery, limit, offset]
        );

        const totalResult = await pool.query(
            'SELECT COUNT(*) FROM users WHERE name ILIKE $1 OR email ILIKE $1 OR providerid ILIKE $1',
            [searchQuery]
        );
        const totalUsers = parseInt(totalResult.rows[0].count);
        const totalPages = Math.ceil(totalUsers / limit);

        res.json({
            users: result.rows,
            page: parseInt(page),
            pages: totalPages,
            total: totalUsers
        });
    } catch (err) {
        logger.error(`Error al obtener usuarios: ${err.message}`);
        res.status(500).json({ error: 'Error al obtener usuarios', details: err.message });
    }
});

// --- Ruta para obtener usuarios pendientes ---
router.get('/pending-users', async (req, res) => {
    const token = req.headers.authorization?.split('Bearer ')[1];
    logger.info('Solicitud para obtener usuarios pendientes');

    if (!token) {
        logger.warn('Intento de acceso no autorizado a usuarios pendientes');
        return res.status(401).json({ error: 'No autorizado: Token no proporcionado' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role !== 'admin') {
            logger.warn(`Acceso denegado a usuarios pendientes para usuario: ${decoded.email}`);
            return res.status(403).json({ error: 'Acceso denegado: Solo administradores' });
        }

        const result = await pool.query(
            'SELECT u.id, u.name, u.email, u.role, u.proveedor_id, u.status, u.created_at, s.name as proveedor_name FROM users u LEFT JOIN suppliers s ON u.proveedor_id = s.id_pro WHERE u.role = $1 AND u.status = $2',
            ['proveedor', 'pending']
        );
        logger.info(`Usuarios pendientes obtenidos: ${result.rows.length} registros`);
        res.json({ users: result.rows });
    } catch (err) {
        logger.error(`Error al obtener usuarios pendientes: ${err.message}`);
        res.status(500).json({ error: 'Error al obtener usuarios pendientes', details: err.message });
    }
});

// --- Ruta para aprobar usuario ---
router.post('/approve-user', async (req, res) => {
    const { userId } = req.body;
    const token = req.headers.authorization?.split('Bearer ')[1];
    logger.info(`Solicitud para aprobar usuario ID: ${userId}`);

    if (!token) {
        logger.warn('Intento de aprobación no autorizado: Token no proporcionado');
        return res.status(401).json({ error: 'No autorizado: Token no proporcionado' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role !== 'admin') {
            logger.warn(`Acceso denegado para aprobar usuario: ${decoded.email}`);
            return res.status(403).json({ error: 'Acceso denegado: Solo administradores' });
        }

        await pool.query('UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2', ['active', userId]);
        await pool.query('UPDATE suppliers SET updated_at = NOW(), last_updated = NOW() WHERE user_id = $1', [userId]);
        logger.info(`Usuario ID ${userId} aprobado exitosamente`);
        res.json({ success: true, message: 'Usuario aprobado' });
    } catch (err) {
        logger.error(`Error al aprobar usuario ID ${userId}: ${err.message}`);
        res.status(500).json({ error: 'Error al aprobar usuario' });
    }
});

// --- Ruta para rechazar usuario ---
router.post('/reject-user', async (req, res) => {
    const { userId } = req.body;
    const token = req.headers.authorization?.split('Bearer ')[1];
    logger.info(`Solicitud para rechazar usuario ID: ${userId}`);

    if (!token) {
        logger.warn('Intento de rechazo no autorizado: Token no proporcionado');
        return res.status(401).json({ error: 'No autorizado: Token no proporcionado' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role !== 'admin') {
            logger.warn(`Acceso denegado para rechazar usuario: ${decoded.email}`);
            return res.status(403).json({ error: 'Acceso denegado: Solo administradores' });
        }

        const userResult = await pool.query('SELECT proveedor_id FROM users WHERE id = $1', [userId]);
        if (userResult.rows.length > 0 && userResult.rows[0].proveedor_id) {
            await pool.query('DELETE FROM suppliers WHERE id_pro = $1', [userResult.rows[0].proveedor_id]);
            logger.info(`Registro de proveedor eliminado: ${userResult.rows[0].proveedor_id}`);
        }
        await pool.query('DELETE FROM users WHERE id = $1', [userId]);
        logger.info(`Usuario ID ${userId} rechazado exitosamente`);
        res.json({ success: true, message: 'Usuario rechazado' });
    } catch (err) {
        logger.error(`Error al rechazar usuario ID ${userId}: ${err.message}`);
        res.status(500).json({ error: 'Error al rechazar usuario' });
    }
});

module.exports = { router };