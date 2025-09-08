const express = require('express');
const router = express.Router();
const pool = require('../db');
const logger = require('../logger');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const authenticateToken = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        logger.warn('No se proporcionó token');
        return res.status(401).json({ message: 'No se proporcionó token' });
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        logger.error(`Error al verificar token: ${err.message}`);
        return res.status(401).json({ error: 'Token inválido' });
    }
};

const authenticateAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        logger.warn(`Acceso denegado para usuario ${req.user.email}: no es administrador`);
        return res.status(403).json({ error: 'Acceso denegado. Solo administradores.' });
    }
    next();
};

// GET /api/users
router.get('/', authenticateToken, authenticateAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    const offset = (page - 1) * limit;
    const searchPattern = `%${search}%`;

    const query = `
      SELECT u.id, u.name, u.email, u.whatsapp, u.role, u.active, u.last_login, p.id_pro AS providerid
      FROM users u
      LEFT JOIN suppliers p ON u.proveedor_id = p.id_pro
      WHERE u.email ILIKE $1 OR u.role ILIKE $1 OR u.name ILIKE $1
      ORDER BY u.id DESC
      LIMIT $2 OFFSET $3
    `;
    const countQuery = `
      SELECT COUNT(*)
      FROM users u
      WHERE u.email ILIKE $1 OR u.role ILIKE $1 OR u.name ILIKE $1
    `;

    const [usersResult, countResult] = await Promise.all([
      pool.query(query, [searchPattern, limit, offset]),
      pool.query(countQuery, [searchPattern])
    ]);

    console.log('Usuarios devueltos:', usersResult.rows);
    res.json({
      users: usersResult.rows,
      page: parseInt(page),
      pages: Math.ceil(parseInt(countResult.rows[0].count) / limit),
      total: parseInt(countResult.rows[0].count)
    });
  } catch (error) {
    logger.error(`Error al obtener usuarios: ${error.message}`);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

// GET /api/users/:id
router.get('/:id', authenticateToken, authenticateAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const query = `
            SELECT u.id, u.name, u.email, u.role, u.status, u.active, u.last_login, u.whatsapp,
                   p.id_pro AS providerid
            FROM users u
            LEFT JOIN suppliers p ON u.proveedor_id = p.id_pro
            WHERE u.id = $1
        `;
        const result = await pool.query(query, [id]);
        if (result.rows.length === 0) {
            logger.warn(`Usuario ID ${id} no encontrado.`);
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }
        const user = result.rows[0];
        logger.info(`Datos del usuario ${id} obtenidos por ${req.user.email}`);
        res.json(user);
    } catch (error) {
        logger.error(`Error al obtener usuario por ID: ${error.message}`);
        res.status(500).json({ error: 'Error del servidor al obtener usuario.' });
    }
});

// GET /api/users/:id - Obtener un usuario por ID
router.get('/:id', authenticateToken, authenticateAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const query = `
            SELECT u.id, u.name, u.email, u.role, u.status, u.active, u.last_login,
                   p.id_pro AS providerid
            FROM users u
            LEFT JOIN suppliers p ON u.proveedor_id = p.id_pro
            WHERE u.id = $1
        `;
        const result = await pool.query(query, [id]);
        if (result.rows.length === 0) {
            logger.warn(`Usuario ID ${id} no encontrado.`);
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }
        const user = result.rows[0];
        logger.info(`Datos del usuario ${id} obtenidos por ${req.user.email}`);
        res.json(user);
    } catch (error) {
        logger.error(`Error al obtener usuario por ID: ${error.message}`);
        res.status(500).json({ error: 'Error del servidor al obtener usuario.' });
    }
});

// POST /api/users - Crear un nuevo usuario
// POST /api/users
router.post('/', authenticateToken, authenticateAdmin, async (req, res) => {
    try {
        const { name, email, password, role, providerId, whatsapp } = req.body;

        const emailCheck = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (emailCheck.rows.length > 0) {
            return res.status(400).json({ error: 'El email ya está registrado' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        let clientCode = null;
        if (['client', 'user'].includes(role)) {
            clientCode = `CL-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
            let codeCheck;
            do {
                codeCheck = await pool.query('SELECT id FROM users WHERE client_code = $1', [clientCode]);
                if (codeCheck.rows.length > 0) {
                    clientCode = `CL-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
                }
            } while (codeCheck.rows.length > 0);
        }

        const userResult = await pool.query(
            'INSERT INTO users (name, email, password, role, created_at, active, client_code, whatsapp) VALUES ($1, $2, $3, $4, NOW(), TRUE, $5, $6) RETURNING id',
            [name, email, hashedPassword, role, clientCode, whatsapp]
        );
        const userId = userResult.rows[0].id;

        if (role === 'proveedor') {
            const finalProviderId = providerId || `SUP-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
            await pool.query(
                'INSERT INTO suppliers (id_pro, name, user_id, email_contacto, created_at) VALUES ($1, $2, $3, $4, NOW())',
                [finalProviderId, name, userId, email]
            );
            await pool.query(
                'UPDATE users SET proveedor_id = $1 WHERE id = $2',
                [finalProviderId, userId]
            );
        }

        logger.info(`Usuario creado: ${userId} por ${req.user.email}`);
        res.status(201).json({ success: true, userId: userId, clientCode: clientCode });
    } catch (error) {
        logger.error(`Error al crear usuario: ${error.message}`);
        res.status(500).json({ error: 'Error al crear usuario' });
    }
});

// PUT /api/users/:id
router.put('/:id', authenticateToken, authenticateAdmin, async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { id } = req.params;
        const { name, email, password, role, active, providerId, whatsapp } = req.body;

        let queryUpdateUser = 'UPDATE users SET name = $1, email = $2, role = $3, active = $4, whatsapp = $5 WHERE id = $6';
        const queryParamsUser = [name, email, role, active, whatsapp, id];

        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            queryUpdateUser = 'UPDATE users SET name = $1, email = $2, password = $3, role = $4, active = $5, whatsapp = $6 WHERE id = $7';
            queryParamsUser.splice(2, 0, hashedPassword);
        }

        await client.query(queryUpdateUser, queryParamsUser);

        const existingSupplier = await client.query('SELECT id_pro FROM suppliers WHERE user_id = $1', [id]);

        if (role === 'proveedor') {
            if (providerId) {
                if (existingSupplier.rows.length > 0) {
                    await client.query('DELETE FROM suppliers WHERE user_id = $1', [id]);
                }
                await client.query(
                    'INSERT INTO suppliers (id_pro, name, user_id, email_contacto, created_at) VALUES ($1, $2, $3, $4, NOW())',
                    [providerId, name, id, email]
                );
                await client.query('UPDATE users SET proveedor_id = $1 WHERE id = $2', [providerId, id]);
            }
        } else {
            if (existingSupplier.rows.length > 0) {
                await client.query('DELETE FROM suppliers WHERE user_id = $1', [id]);
                await client.query('UPDATE users SET proveedor_id = NULL WHERE id = $1', [id]);
            }
        }

        await client.query('COMMIT');
        logger.info(`Usuario ${id} actualizado por ${req.user.email}`);
        res.status(200).json({ message: 'Usuario actualizado exitosamente.' });
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error(`Error al actualizar usuario ${req.params.id}: ${error.message}`);
        res.status(500).json({ error: 'Error del servidor al actualizar usuario.' });
    } finally {
        client.release();
    }
});

// PUT /api/users/:id - Actualizar datos de un usuario
router.put('/:id', authenticateToken, authenticateAdmin, async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { id } = req.params;
        const { name, email, password, role, active, providerId } = req.body;

        let queryUpdateUser = 'UPDATE users SET name = $1, email = $2, role = $3, active = $4 WHERE id = $5';
        const queryParamsUser = [name, email, role, active, id];

        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            queryUpdateUser = 'UPDATE users SET name = $1, email = $2, password = $3, role = $4, active = $5 WHERE id = $6';
            queryParamsUser.splice(2, 0, hashedPassword);
        }

        await client.query(queryUpdateUser, queryParamsUser);

        const existingSupplier = await client.query('SELECT id_pro FROM suppliers WHERE user_id = $1', [id]);

        if (role === 'proveedor') {
            if (providerId) {
                if (existingSupplier.rows.length > 0) {
                    await client.query('DELETE FROM suppliers WHERE user_id = $1', [id]);
                }
                await client.query(
                    'INSERT INTO suppliers (id_pro, name, user_id, email_contacto, created_at) VALUES ($1, $2, $3, $4, NOW())',
                    [providerId, name, id, email]
                );
                await client.query('UPDATE users SET proveedor_id = $1 WHERE id = $2', [providerId, id]);
            }
        } else {
            if (existingSupplier.rows.length > 0) {
                await client.query('DELETE FROM suppliers WHERE user_id = $1', [id]);
                await client.query('UPDATE users SET proveedor_id = NULL WHERE id = $1', [id]);
            }
        }

        await client.query('COMMIT');
        logger.info(`Usuario ${id} actualizado por ${req.user.email}`);
        res.status(200).json({ message: 'Usuario actualizado exitosamente.' });
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error(`Error al actualizar usuario ${req.params.id}: ${error.message}`);
        res.status(500).json({ error: 'Error del servidor al actualizar usuario.' });
    } finally {
        client.release();
    }
});

// DELETE /api/users/:id - Eliminar un usuario
router.delete('/:id', authenticateToken, authenticateAdmin, async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { id } = req.params;

        const existingSupplier = await client.query('SELECT id_pro FROM suppliers WHERE user_id = $1', [id]);
        if (existingSupplier.rows.length > 0) {
            await client.query('DELETE FROM suppliers WHERE user_id = $1', [id]);
        }

        const result = await client.query('DELETE FROM users WHERE id = $1', [id]);
        if (result.rowCount === 0) {
            await client.query('ROLLBACK');
            logger.warn(`Usuario ID ${id} no encontrado para eliminación.`);
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        await client.query('COMMIT');
        logger.info(`Usuario ${id} eliminado por ${req.user.email}`);
        res.status(200).json({ message: 'Usuario eliminado exitosamente.' });
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error(`Error al eliminar usuario ${req.params.id}: ${error.message}`);
        res.status(500).json({ error: 'Error del servidor al eliminar usuario.' });
    } finally {
        client.release();
    }
});

// Agregar estas rutas al final del archivo, antes de `module.exports = router;`

// PUT /api/users/:id/approve - Aprobar un usuario
router.put('/:id/approve', authenticateToken, authenticateAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('UPDATE users SET status = $1, active = $2 WHERE id = $3 RETURNING id', ['active', true, id]);
        if (result.rowCount === 0) {
            logger.warn(`Usuario ID ${id} no encontrado para aprobación.`);
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }
        logger.info(`Usuario ${id} aprobado por ${req.user.email}`);
        res.status(200).json({ message: 'Usuario aprobado exitosamente.' });
    } catch (error) {
        logger.error(`Error al aprobar usuario ${req.params.id}: ${error.message}`);
        res.status(500).json({ error: 'Error del servidor al aprobar usuario.' });
    }
});

// PUT /api/users/:id/reject - Rechazar un usuario
router.put('/:id/reject', authenticateToken, authenticateAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('UPDATE users SET status = $1, active = $2 WHERE id = $3 RETURNING id', ['inactive', false, id]);
        if (result.rowCount === 0) {
            logger.warn(`Usuario ID ${id} no encontrado para rechazo.`);
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }
        logger.info(`Usuario ${id} rechazado por ${req.user.email}`);
        res.status(200).json({ message: 'Usuario rechazado exitosamente.' });
    } catch (error) {
        logger.error(`Error al rechazar usuario ${req.params.id}: ${error.message}`);
        res.status(500).json({ error: 'Error del servidor al rechazar usuario.' });
    }
});

module.exports = router;