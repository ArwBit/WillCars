const express = require('express');
const router = express.Router();
const pool = require('../db');
const logger = require('../logger');
const Joi = require('joi');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const { authenticateAdminOrProvider } = require('../middleware/auth');

// Esquema de validación para productos
const productSchema = Joi.object({
    code: Joi.string().max(20).required(),
    description: Joi.string().required(),
    brand: Joi.string().allow(null, ''),
    model: Joi.string().allow(null, ''),
    usd: Joi.number().positive().required(),
    ref: Joi.number().positive().required(),
    discount: Joi.number().min(0).max(100).allow(null),
    proveedor_id: Joi.string().required(),
    image_path: Joi.string().allow(null, ''),
    product_code_id: Joi.string().allow(null, '')
});

// Esquema de validación para actualización de visibilidad
const visibilitySchema = Joi.object({
    proveedor_id: Joi.string().required(),
    is_visible: Joi.number().integer().valid(0, 1).required()
});

// Esquema de validación para eliminación por proveedor
const deleteBySupplierSchema = Joi.object({
    proveedor_id: Joi.string().required()
});

// Esquema de validación para exportación a CSV
const exportCsvSchema = Joi.object({
    proveedor_id: Joi.string().required()
});

// Configuración de Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../Uploads');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const fileExtension = path.extname(file.originalname).toLowerCase();
        cb(null, `product-${Date.now()}${fileExtension}`);
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (['image/jpeg', 'image/png', 'text/csv'].includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten imágenes JPEG, PNG o archivos CSV'), false);
        }
    },
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

const headerMappings = {
    'Código': 'code', 'Descripción': 'description', 'Marca': 'brand', 'Modelo': 'model',
    'Precio USD': 'usd', 'Referencia': 'ref', 'Descuento': 'discount', 'Proveedor': 'proveedor_id',
    'Imagen': 'image_path', 'Item': 'code', 'Desc': 'description', 'Brand': 'brand',
    'Price': 'usd', 'RefPrice': 'ref', 'SupplierID': 'proveedor_id', 'ProdCode': 'code',
    'ProductName': 'description', 'USDPrice': 'usd', 'Supplier': 'proveedor_id', 'ImagePath': 'image_path'
};

router.post('/', authenticateAdminOrProvider, upload.single('image'), async (req, res) => {
    try {
        logger.info('POST /api/products recibido');
        const { code, description, brand, model, usd, ref, discount, proveedor_id, product_code_id } = req.body;
        const image_path = req.file ? `/Uploads/${req.file.filename}` : null;

        const final_proveedor_id = req.proveedor_id || proveedor_id;

        const { error } = productSchema.validate({
            code, description, brand: brand || null, model: model || null,
            usd: parseFloat(usd), ref: parseFloat(ref),
            discount: discount ? parseFloat(discount) : null,
            proveedor_id: final_proveedor_id, image_path,
            product_code_id: product_code_id || code
        });

        if (error) {
            logger.warn(`Error de validación: ${error.details.map(d => d.message).join(', ')}`);
            return res.status(400).json({ error: error.details.map(d => d.message).join(', ') });
        }

        const existingProduct = await pool.query('SELECT code FROM products WHERE code = $1', [code]);
        if (existingProduct.rows.length > 0) {
            logger.warn(`Código ya existe: ${code}`);
            return res.status(400).json({ error: 'El código del producto ya existe' });
        }

        const result = await pool.query(
            'INSERT INTO products (code, description, brand, model, usd, ref, discount, proveedor_id, image_path, product_code_id, is_visible, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 1, NOW()) RETURNING *',
            [code, description, brand || null, model || null, parseFloat(usd), parseFloat(ref), discount || null, req.proveedor_id || proveedor_id, image_path, product_code_id || code]
        );

        await pool.query('UPDATE suppliers SET last_updated = NOW() WHERE id_pro = $1', [req.proveedor_id || proveedor_id]);
        const io = req.app.get('io');
        if (io) {
            io.emit('productUpdated', { code, description, proveedor_id: req.proveedor_id || proveedor_id });
            logger.info(`Evento productUpdated emitido: ${code}`);
        }
        res.json(result.rows[0]);
        logger.info(`Producto creado: ${code}`);

    } catch (error) {
        logger.error(`Error en POST /api/products: ${error.message}`);
        // Añade esta condición para manejar el error de la llave foránea
        if (error.message.includes('products_proveedor_id_fkey')) {
            return res.status(400).json({ error: 'El proveedor seleccionado no es válido' });
        }
        // Para otros errores, devuelve un 500
        res.status(500).json({ error: 'Error interno del servidor', message: error.message });
    }
});

router.put('/:code', authenticateAdminOrProvider, async (req, res) => {
    const { code } = req.params;
    const { description, brand, model, price, discount, proveedor_id, image_path, usd } = req.body;
    try {
        logger.info(`PUT /api/products/${code} recibido`);
        const result = await pool.query(
            'UPDATE products SET description = $1, brand = $2, model = $3, price = $4, discount = $5, proveedor_id = $6, image_path = $7, usd = $8, updated_at = NOW() WHERE code = $9 RETURNING *',
            [description, brand, model, price, discount, proveedor_id, image_path, usd, code]
        );
        if (result.rowCount === 0) {
            logger.warn(`Producto no encontrado: ${code}`);
            return res.status(404).json({ error: 'Producto no encontrado' });
        }
        res.json(result.rows[0]);
        logger.info(`Producto actualizado: ${code}`);
    } catch (error) {
        logger.error(`Error al actualizar producto ${code}: ${error.message}, stack: ${error.stack}`);
        res.status(500).json({ error: 'Error al actualizar producto' });
    }
});

router.delete('/:code', authenticateAdminOrProvider, async (req, res) => {
    const { code } = req.params;
    try {
        logger.info(`DELETE /api/products/${code} recibido`);
        const result = await pool.query('DELETE FROM products WHERE code = $1 RETURNING id, proveedor_id', [code]);
        if (result.rowCount === 0) {
            logger.warn(`Producto no encontrado para eliminar: ${code}`);
            return res.status(404).json({ error: 'Producto no encontrado' });
        }
        const proveedor_id = result.rows[0].proveedor_id;
        await pool.query('UPDATE suppliers SET last_updated = NOW() WHERE id_pro = $1', [proveedor_id]);
        const io = req.app.get('io');
        if (io) {
            io.emit('productUpdated', { code, status: 'deleted', proveedor_id });
            logger.info(`Evento productUpdated emitido: ${code}`);
        }
        res.json({ success: true });
        logger.info(`Producto eliminado: ${code}`);
    } catch (error) {
        logger.error(`Error al eliminar producto: ${error.message}`);
        return res.status(500).json({ error: 'Error al eliminar producto' });
    }
});

router.post('/bulk', authenticateAdminOrProvider, upload.single('file'), async (req, res) => {
    logger.info('POST /api/products/bulk recibido');
    if (!req.file) {
        logger.warn('No se subió ningún archivo');
        return res.status(400).json({ error: 'No se subió ningún archivo' });
    }

    const file = req.file;
    const uploadPath = path.join(__dirname, '../Uploads/bulk');
    if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
    }

    const tempPath = path.join(uploadPath, `${Date.now()}_${file.filename}`);

    try {
        await fs.promises.rename(file.path, tempPath);
        logger.info(`Archivo guardado en ${tempPath}`);

        const products = [];
        await new Promise((resolve, reject) => {
            fs.createReadStream(tempPath)
                .pipe(csv())
                .on('data', (row) => {
                    const normalizedRow = {};
                    for (const [key, value] of Object.entries(row)) {
                        const normalizedKey = headerMappings[key] || key.toLowerCase().replace(/\s/g, '_');
                        normalizedRow[normalizedKey] = value;
                    }
                    normalizedRow.proveedor_id = req.proveedor_id || normalizedRow.proveedor_id;
                    normalizedRow.product_code_id = normalizedRow.product_code_id || normalizedRow.code;
                    products.push(normalizedRow);
                })
                .on('end', resolve)
                .on('error', reject);
        });

        let insertedCount = 0;
        let errorMessages = [];
        const insertedProducts = [];
        for (const item of products) {
            try {
                let usdValue;
                if (typeof item.usd === 'string' && item.usd.trim() !== '') {
                    usdValue = parseFloat(item.usd.trim().replace(',', '.'));
                    if (isNaN(usdValue)) {
                        usdValue = undefined;
                    }
                } else {
                    usdValue = undefined;
                }

                let refValue;
                if (typeof item.ref === 'string' && item.ref.trim() !== '') {
                    refValue = parseFloat(item.ref.trim().replace(',', '.'));
                    if (isNaN(refValue)) {
                        refValue = undefined;
                    }
                } else {
                    refValue = undefined;
                }

                let discountValue;
                if (typeof item.discount === 'string' && item.discount.trim() !== '') {
                    discountValue = parseFloat(item.discount.trim().replace(',', '.'));
                    if (isNaN(discountValue)) {
                        discountValue = null;
                    }
                } else {
                    discountValue = null;
                }

                let finalProveedorId = item.proveedor_id;
                if (typeof finalProveedorId === 'string' && finalProveedorId.trim() === '') {
                    finalProveedorId = undefined;
                }
                finalProveedorId = req.proveedor_id || finalProveedorId;

                logger.debug(`Validando item: code=${item.code}, usd=${usdValue} (tipo: ${typeof usdValue}), ref=${refValue} (tipo: ${typeof refValue}), discount=${discountValue} (tipo: ${typeof discountValue}), proveedor_id=${finalProveedorId} (tipo: ${typeof finalProveedorId})`);

                const { error } = productSchema.validate({
                    code: item.code, description: item.description,
                    brand: item.brand || null, model: item.model || null,
                    usd: usdValue, ref: refValue, discount: discountValue,
                    proveedor_id: finalProveedorId, image_path: item.image_path || null,
                    product_code_id: item.product_code_id || item.code
                });

                if (error) {
                    throw new Error(error.details.map(d => d.message).join(', '));
                }

                const dbUsd = usdValue === undefined ? null : usdValue;
                const dbRef = refValue === undefined ? null : refValue;
                const dbDiscount = discountValue;
                const dbProveedorId = finalProveedorId === undefined ? null : finalProveedorId;

                // Validar si la imagen existe
                if (item.image_path && !fs.existsSync(path.join(__dirname, '..', item.image_path))) {
                    logger.warn(`Imagen no encontrada: ${item.image_path} para el producto ${item.code}`);
                    item.image_path = null;
                }

                const result = await pool.query(
    `INSERT INTO products (code, description, brand, model, usd, ref, discount, proveedor_id, image_path, product_code_id, is_visible, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 1, NOW())
     ON CONFLICT (code) DO UPDATE
     SET description = EXCLUDED.description, brand = EXCLUDED.brand, model = EXCLUDED.model,
         usd = EXCLUDED.usd, ref = EXCLUDED.ref, discount = EXCLUDED.discount,
         proveedor_id = EXCLUDED.proveedor_id, image_path = EXCLUDED.image_path,
         product_code_id = EXCLUDED.product_code_id, is_visible = EXCLUDED.is_visible
     RETURNING *`,
    [item.code, item.description, item.brand || null, item.model || null,
     dbUsd, dbRef, dbDiscount, dbProveedorId, item.image_path || null, item.product_code_id || item.code]
);
                insertedCount++;
                insertedProducts.push(result.rows[0]);

                // Verificar si el proveedor existe antes de actualizar last_updated
                if (dbProveedorId) {
    const supplierCheck = await pool.query('SELECT id_pro FROM suppliers WHERE id_pro = $1', [dbProveedorId]);
    if (supplierCheck.rows.length === 0) {
        logger.warn(`Proveedor no encontrado: ${dbProveedorId} para el producto ${item.code}`);
        errorMessages.push(`Proveedor no encontrado: ${dbProveedorId} para el producto ${item.code}`);
        // Crear proveedor automáticamente
        await pool.query(
            'INSERT INTO suppliers (id_pro, name, email_contacto, visible, last_updated) VALUES ($1, $2, $3, $4, NOW())',
            [dbProveedorId, dbProveedorId, null, true]
        );
        logger.info(`Proveedor creado: ${dbProveedorId}`);
    }
}

                const io = req.app.get('io');
                if (io) {
                    io.emit('new-products', { code: item.code, description: item.description, proveedor_id: dbProveedorId });
                    logger.info(`Evento new-products emitido para código ${item.code}`);
                }
            } catch (error) {
                errorMessages.push(`Error al insertar código ${item.code}: ${error.message}`);
                logger.error(`Error al insertar código ${item.code}: ${error.message}`);
            }
        }
        await fs.promises.unlink(tempPath).catch((error) => {
            logger.error(`Error al eliminar archivo ${tempPath}: ${error.message}`);
        });
        res.json({ inserted: insertedCount, errors: errorMessages.length, errorMessages, insertedProducts });
        logger.info(`Carga masiva completada: ${insertedCount} insertados, ${errorMessages.length} errores`);
    } catch (error) {
        logger.error(`Error al procesar archivo: ${error.message}`);
        await fs.promises.unlink(tempPath).catch((unlinkError) => {
            logger.error(`Error al eliminar archivo ${tempPath}: ${unlinkError.message}`);
        });
        res.status(500).json({ error: 'Error al procesar el archivo', message: error.message });
    }
});

router.get('/public', async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '', proveedor_id = '', sort = 'created_at', order = 'desc' } = req.query;
        const offset = (page - 1) * limit;
        const whereClauses = ['s.visible = TRUE'];
        const values = [];
        if (search) {
            whereClauses.push('p.description ILIKE $1 OR p.code ILIKE $2 OR p.brand ILIKE $3 OR p.model ILIKE $4');
            values.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
        }
        if (proveedor_id) {
            whereClauses.push(`p.proveedor_id = $${values.length + 1}`);
            values.push(proveedor_id);
        }
        const where = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';
        const validSortColumns = ['code', 'description', 'brand', 'model', 'usd', 'ref', 'created_at'];
        const sortColumn = validSortColumns.includes(sort) ? sort : 'created_at';
        const sortOrder = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
        const query = `
            SELECT p.id, p.code, p.description, p.brand, p.model, p.usd, p.ref, p.proveedor_id, p.image_path, s.name AS proveedor_name
            FROM products p
            LEFT JOIN suppliers s ON p.proveedor_id = s.id_pro
            ${where}
            ORDER BY p.${sortColumn} ${sortOrder}
            LIMIT $${values.length + 1} OFFSET $${values.length + 2}
        `;
        const countQuery = `
            SELECT COUNT(*) as total
            FROM products p
            LEFT JOIN suppliers s ON p.proveedor_id = s.id_pro
            ${where}
        `;
        values.push(limit, offset);
        const [productsResult, countResult] = await Promise.all([
            pool.query(query, values),
            pool.query(countQuery, values.slice(0, -2))
        ]);
        const totalProducts = parseInt(countResult.rows[0].total, 10);
        const totalPages = Math.ceil(totalProducts / limit);
        res.json({
            products: productsResult.rows,
            totalProducts,
            totalPages,
            currentPage: parseInt(page, 10),
            hasPrevPage: page > 1,
            hasNextPage: page < totalPages
        });
    } catch (error) {
        console.error('Error fetching public products:', error);
        res.status(500).json({ error: 'Error fetching public products' });
    }
});

router.get('/:code', async (req, res) => {
    const { code } = req.params;
    try {
        const result = await pool.query(
            'SELECT p.*, pr.name as proveedor_name FROM products p LEFT JOIN suppliers pr ON p.proveedor_id = pr.id_pro WHERE p.code = $1',
            [code]
        );

        if (result.rows.length === 0) {
            logger.warn(`Producto no encontrado: ${code}`);
            return res.status(404).json({ error: 'Producto no encontrado' });
        }

        res.json(result.rows[0]);
        logger.info(`Producto obtenido: ${code}`);
    } catch (error) {
        logger.error(`Error al obtener producto: ${error.message}`);
        return res.status(500).json({ error: 'Error al obtener producto' });
    }
});

router.get('/', authenticateAdminOrProvider, async (req, res) => {
    try {
        const { page = 1, limit = 12, search = '', proveedor_id = '', sort = 'created_at', order = 'desc' } = req.query;
        const offset = (page - 1) * limit;
        const whereClauses = [];
        const values = [];

        // Filtrar por proveedor_id para usuarios no administradores
        if (req.user.role !== 'admin') {
            if (!req.proveedor_id) {
                logger.warn(`Usuario ${req.user.email} no tiene proveedor_id asignado`);
                return res.status(403).json({ error: 'Acceso denegado: No tienes un proveedor asignado' });
            }
            whereClauses.push('p.proveedor_id = $1');
            values.push(req.proveedor_id);
        }

        // Búsqueda por descripción, código, marca o modelo
        if (search) {
            const searchIndex = values.length + 1;
            whereClauses.push(`(p.description ILIKE $${searchIndex} OR p.code ILIKE $${searchIndex + 1} OR p.brand ILIKE $${searchIndex + 2} OR p.model ILIKE $${searchIndex + 3})`);
            values.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
        }

        // Filtrar por proveedor_id para administradores (opcional)
        if (proveedor_id && req.user.role === 'admin') {
            whereClauses.push(`p.proveedor_id = $${values.length + 1}`);
            values.push(proveedor_id);
        }

        const where = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';
        const validSortColumns = ['code', 'description', 'brand', 'model', 'usd', 'ref', 'created_at'];
        const sortColumn = validSortColumns.includes(sort) ? sort : 'created_at';
        const sortOrder = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
        const query = `
            SELECT p.id, p.code, p.description, p.brand, p.model, p.usd, p.ref, p.proveedor_id, p.image_path, s.name AS proveedor_name
            FROM products p
            LEFT JOIN suppliers s ON p.proveedor_id = s.id_pro
            ${where}
            ORDER BY p.${sortColumn} ${sortOrder}
            LIMIT $${values.length + 1} OFFSET $${values.length + 2}
        `;
        const countQuery = `
            SELECT COUNT(*) as total
            FROM products p
            LEFT JOIN suppliers s ON p.proveedor_id = s.id_pro
            ${where}
        `;
        values.push(limit, offset);
        const [productsResult, countResult] = await Promise.all([
            pool.query(query, values),
            pool.query(countQuery, values.slice(0, -2))
        ]);
        const totalProducts = parseInt(countResult.rows[0].total, 10);
        const totalPages = Math.ceil(totalProducts / limit);
        res.json({
            products: productsResult.rows,
            totalProducts,
            totalPages,
            currentPage: parseInt(page, 10),
            hasPrevPage: page > 1,
            hasNextPage: page < totalPages
        });
    } catch (error) {
        logger.error(`Error al obtener productos: ${error.message}`);
        res.status(500).json({ error: 'Error al obtener productos' });
    }
});

router.post('/update-visibility', authenticateAdminOrProvider, async (req, res) => {
    try {
        logger.info('POST /api/products/update-visibility recibido');
        const { proveedor_id, is_visible } = req.body;

        const { error } = visibilitySchema.validate({ proveedor_id, is_visible });
        if (error) {
            logger.warn(`Error de validación: ${error.details.map(d => d.message).join(', ')}`);
            return res.status(400).json({ error: error.details.map(d => d.message).join(', ') });
        }

        const result = await pool.query(
            'UPDATE products SET is_visible = $1 WHERE proveedor_id = $2 RETURNING id',
            [is_visible, proveedor_id]
        );
        await pool.query('UPDATE suppliers SET last_updated = NOW() WHERE id_pro = $1', [proveedor_id]);
        const io = req.app.get('io');
        if (io) {
            io.emit('productUpdated', { proveedor_id, action: is_visible ? 'activate' : 'deactivate' });
            logger.info(`Evento productUpdated emitido: proveedor_id ${proveedor_id}, action ${is_visible ? 'activate' : 'deactivate'}`);
        }
        res.json({ success: true, updated: result.rowCount });
        logger.info(`Visibilidad actualizada para proveedor_id ${proveedor_id}: is_visible=${is_visible}`);
    } catch (error) {
        logger.error(`Error al actualizar visibilidad: ${error.message}`);
        res.status(500).json({ error: 'Error al actualizar visibilidad' });
    }
});

router.delete('/delete-by-supplier', authenticateAdminOrProvider, async (req, res) => {
    try {
        logger.info('DELETE /api/products/delete-by-supplier recibido');
        const { proveedor_id } = req.body;

        const { error } = deleteBySupplierSchema.validate({ proveedor_id });
        if (error) {
            logger.warn(`Error de validación: ${error.details.map(d => d.message).join(', ')}`);
            return res.status(400).json({ error: error.details.map(d => d.message).join(', ') });
        }

        const result = await pool.query('DELETE FROM products WHERE proveedor_id = $1 RETURNING id', [proveedor_id]);
        await pool.query('UPDATE suppliers SET last_updated = NOW() WHERE id_pro = $1', [proveedor_id]);
        const io = req.app.get('io');
        if (io) {
            io.emit('productUpdated', { proveedor_id, action: 'deleted' });
            logger.info(`Evento productUpdated emitido: proveedor_id ${proveedor_id}, action deleted`);
        }
        res.json({ success: true, deleted: result.rowCount });
        logger.info(`Productos eliminados para proveedor_id ${proveedor_id}: ${result.rowCount} registros`);
    } catch (error) {
        logger.error(`Error al eliminar productos: ${error.message}`);
        res.status(500).json({ error: 'Error al eliminar productos' });
    }
});

router.post('/export-csv', authenticateAdminOrProvider, async (req, res) => {
    try {
        logger.info('POST /api/products/export-csv recibido');
        const { proveedor_id } = req.body;

        const { error } = exportCsvSchema.validate({ proveedor_id });
        if (error) {
            logger.warn(`Error de validación: ${error.details.map(d => d.message).join(', ')}`);
            return res.status(400).json({ error: error.details.map(d => d.message).join(', ') });
        }

        const result = await pool.query(
            'SELECT code, description, brand, model, usd, ref, discount, proveedor_id, image_path, product_code_id, is_visible FROM products WHERE proveedor_id = $1',
            [proveedor_id]
        );
        let csv = 'code,description,brand,model,usd,ref,discount,proveedor_id,image_path,product_code_id,is_visible\n';
        result.rows.forEach(product => {
            csv += `"${product.code.replace(/"/g, '""')}","${product.description.replace(/"/g, '""')}","${product.brand ? product.brand.replace(/"/g, '""') : ''}","${product.model ? product.model.replace(/"/g, '""') : ''}",${product.usd},${product.ref},${product.discount || ''},"${product.proveedor_id}","${product.image_path ? product.image_path.replace(/"/g, '""') : ''}","${product.product_code_id}",${product.is_visible}\n`;
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=products_${proveedor_id}_${new Date().toISOString()}.csv`);
        res.send(csv);
        await pool.query('UPDATE suppliers SET last_updated = NOW() WHERE id_pro = $1', [proveedor_id]);
        const io = req.app.get('io');
        if (io) {
            io.emit('productUpdated', { proveedor_id, action: 'exported' });
            logger.info(`Evento productUpdated emitido: proveedor_id ${proveedor_id}, action exported`);
        }
        logger.info(`Productos exportados a CSV para proveedor_id ${proveedor_id}`);
    } catch (error) {
        logger.error(`Error al exportar productos a CSV: ${error.message}`);
        res.status(500).json({ error: 'Error al exportar productos a CSV' });
    }
});

module.exports = router;