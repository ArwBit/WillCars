const jwt = require('jsonwebtoken');
const logger = require('../logger');
const pool = require('../db');

// Middleware para autenticar usuarios (opcionalmente) y adjuntar su info a req.user
const verifyToken = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
        req.user = null;
        return next();
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        logger.info(`Token válido para WebSocket/ruta de invitado, ID: ${decoded.id}, email: ${decoded.email}`);
        next();
    } catch (err) {
        logger.warn(`Token inválido o expirado para WebSocket/ruta de invitado: ${err.message}`);
        req.user = null;
        next();
    }
};

// Middleware para autenticar y autorizar solo a administradores
const authenticateAdmin = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        logger.warn('No se proporcionó token para autenticación de admin');
        return res.status(401).json({ error: 'Autenticación requerida: No se proporcionó token' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userResult = await pool.query(
            'SELECT id, role, email, name FROM users WHERE id = $1',
            [decoded.id]
        );

        if (userResult.rows.length === 0) {
            logger.warn(`Usuario no encontrado para ID decodificado: ${decoded.id}`);
            return res.status(403).json({ error: 'Usuario no encontrado o token inválido' });
        }

        const user = userResult.rows[0];
        if (user.role !== 'admin') {
            logger.warn(`Acceso denegado para usuario ${user.email} (rol: ${user.role})`);
            return res.status(403).json({ error: 'Acceso denegado: Se requiere rol de administrador' });
        }

        req.user = user;
        logger.info(`Acceso autorizado para ${user.email} (rol: ${user.role})`);
        next();
    } catch (err) {
        logger.error(`Error de autenticación: ${err.message}`);
        return res.status(401).json({ error: 'Token inválido o expirado. Por favor, vuelva a iniciar sesión.' });
    }
};

// Middleware para autenticar y autorizar solo a administradores o proveedores
const authenticateAdminOrProvider = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        logger.warn('No se proporcionó token para autenticación de admin/proveedor');
        return res.status(401).json({ error: 'Autenticación requerida: No se proporcionó token' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userResult = await pool.query(
            'SELECT id, role, proveedor_id, email, name FROM users WHERE id = $1',
            [decoded.id]
        );

        if (userResult.rows.length === 0) {
            logger.warn(`Usuario no encontrado para ID decodificado: ${decoded.id}`);
            return res.status(403).json({ error: 'Usuario no encontrado o token inválido' });
        }

        const user = userResult.rows[0];
        if (user.role !== 'admin' && !user.proveedor_id) {
            logger.warn(`Acceso denegado para usuario ${user.email} (rol: ${user.role}, proveedor_id: ${user.proveedor_id})`);
            return res.status(403).json({ error: 'Acceso denegado: Se requiere rol de administrador o proveedor' });
        }

        req.user = user;
        req.proveedor_id = user.proveedor_id;
        logger.info(`Acceso autorizado para ${user.email} (rol: ${user.role})`);
        next();
    } catch (err) {
        logger.error(`Error de autenticación/autorización: ${err.message}`);
        return res.status(401).json({ error: 'Token inválido o expirado. Por favor, vuelva a iniciar sesión.' });
    }
};

module.exports = {
    verifyToken,
    authenticateAdmin,
    authenticateAdminOrProvider
};