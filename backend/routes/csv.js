const express = require('express');
const router = express.Router();
const pool = require('../db');
const multer = require('multer');
const path = require('path');
const fs = require('fs'); // Cambiado de fs.promises a fs
const csvParser = require('csv-parser');
const logger = require('../logger');
const nodemailer = require('nodemailer');
const { authenticateAdmin, authenticateAdminOrProvider } = require('../middleware/auth');
const { PROVEEDORES } = require('./proveedores');

const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const tempDir = path.join(__dirname, '../Uploads/temp');
        try {
            await fs.promises.mkdir(tempDir, { recursive: true });
            cb(null, tempDir);
        } catch (err) {
            logger.error(`Error al crear directorio temp: ${err.message}`);
            cb(err);
        }
    },
    filename: (req, file, cb) => {
        const timestamp = Date.now();
        cb(null, `${req.user.proveedor_id}_${timestamp}_${file.originalname}`);
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const allowedMimes = [
            'text/csv',
            'application/csv',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel'
        ];
        if (allowedMimes.includes(file.mimetype) || ['.csv', '.xlsx'].includes(ext)) {
            cb(null, true);
        } else {
            logger.warn(`Archivo no permitido: ${file.originalname}, MIME: ${file.mimetype}`);
            cb(new Error('Solo se permiten archivos CSV o Excel (.xlsx)'));
        }
    },
    limits: { fileSize: 5 * 1024 * 1024 }
});

router.post('/upload', authenticateAdminOrProvider, upload.single('file'), async (req, res) => {
    let fileName = 'desconocido';
    try {
        logger.info(`POST /api/csv/upload recibido, usuario: ${req.user.email}, proveedor: ${req.user.proveedor_id}`);
        if (!req.file) {
            logger.warn('No se proporcionó archivo');
            return res.status(400).json({ error: 'No se proporcionó archivo' });
        }

        fileName = req.file.originalname;
        const filePath = req.file.path;
        const notes = req.body.notes || '';
        const supplierId = req.user.proveedor_id;

        logger.info(`Procesando archivo: ${fileName}, proveedor: ${supplierId}`);

        if (!PROVEEDORES[supplierId]) {
            logger.warn(`Proveedor no válido: ${supplierId}`);
            return res.status(400).json({ error: 'Proveedor no válido' });
        }

        const requiredColumns = ['código', 'descripción', 'precio_usd'];
        const optionalColumns = ['marca', 'modelo', 'referencia', 'proveedor', 'imagen'];
        const products = [];
        let headers = [];

        await new Promise((resolve, reject) => {
            fs.createReadStream(filePath)
                .pipe(csvParser({
                    skipLines: 0,
                    trim: true,
                    skipEmptyLines: true,
                    mapHeaders: ({ header }) => header.trim().toLowerCase().replace(/\s/g, '_'),
                    mapValues: ({ header, value }) => value.trim().replace(/^"|"$/g, '') || 'N/A'
                }))
                .on('headers', (fileHeaders) => {
                    headers = fileHeaders;
                    logger.info(`Encabezados detectados en ${fileName}: ${headers}`);
                    const missingRequiredColumns = requiredColumns.filter(col => !headers.includes(col));
                    if (missingRequiredColumns.length > 0) {
                        logger.warn(`Faltan columnas requeridas en ${fileName}: ${missingRequiredColumns.join(', ')}`);
                        reject(new Error(`Faltan columnas requeridas: ${missingRequiredColumns.join(', ')}`));
                    }
                })
                .on('data', (row) => {
                    products.push(row);
                })
                .on('end', resolve)
                .on('error', (err) => {
                    logger.error(`Error al parsear CSV ${fileName}: ${err.message}\n${err.stack}`);
                    reject(err);
                });
        });

        const validProducts = [];
        const errors = [];

        for (const product of products) {
            logger.info(`Validando producto: ${JSON.stringify(product)}`);
            if (!product.código || product.código === 'N/A') {
                errors.push(`Producto inválido: Código faltante (${JSON.stringify(product)})`);
                continue;
            }
            if (!product.descripción || product.descripción === 'N/A') {
                errors.push(`Producto inválido: Descripción faltante (${JSON.stringify(product)})`);
                continue;
            }
            if (isNaN(parseFloat(product.precio_usd)) || parseFloat(product.precio_usd) <= 0) {
                errors.push(`Producto inválido: Precio USD inválido (${JSON.stringify(product)})`);
                continue;
            }
            if (product.proveedor && product.proveedor !== 'N/A' && product.proveedor !== supplierId) {
                errors.push(`Producto inválido: Proveedor ${product.proveedor} no coincide con ${supplierId}`);
                continue;
            }
            if (product.imagen && product.imagen !== 'N/A') {
                const expectedImagePath = `/Uploads/${PROVEEDORES[supplierId].carpeta}/${PROVEEDORES[supplierId].imagenes}/`;
                if (!product.imagen.startsWith(expectedImagePath) || !product.imagen.match(/\.(jpg|png|JPG|PNG)$/i)) {
                    errors.push(`Producto inválido: Ruta de imagen inválida para ${supplierId}: ${product.imagen}`);
                    continue;
                }
                const imagePath = path.join(__dirname, '../', product.imagen);
                try {
                    await fs.promises.access(imagePath);
                } catch {
                    errors.push(`Producto inválido: Imagen no encontrada: ${product.imagen}`);
                    continue;
                }
            }

            validProducts.push({
                code: product.código,
                description: product.descripción,
                brand: product.marca || 'N/A',
                model: product.modelo || 'N/A',
                price_usd: parseFloat(product.precio_usd),
                reference: product.referencia || 'N/A',
                supplier_id: product.proveedor || supplierId,
                image_path: product.imagen || 'N/A'
            });
        }

        if (validProducts.length === 0) {
            try {
                await fs.promises.unlink(filePath);
                logger.info(`Archivo temporal ${filePath} eliminado`);
            } catch (err) {
                logger.error(`Error al eliminar archivo temporal: ${err.message}`);
            }
            logger.warn(`No se encontraron productos válidos en ${fileName}: ${errors.join('; ')}`);
            return res.status(400).json({ error: 'No se encontraron productos válidos', errors });
        }

        const fileUrl = `/Uploads/temp/${req.file.filename}`;
        logger.info(`Insertando en pending_csvs: file_name=${fileName}, file_url=${fileUrl}, supplier_id=${supplierId}`);
        const result = await pool.query(
            'INSERT INTO pending_csvs (file_name, file_url, supplier_id, notes, created_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING id',
            [fileName, fileUrl, supplierId, notes]
        );
        const csvId = result.rows[0].id;

        for (const product of validProducts) {
            logger.info(`Insertando producto en pending_products: ${JSON.stringify(product)}`);
            await pool.query(
                `INSERT INTO pending_products (csv_id, code, description, brand, model, price_usd, reference, image_path, supplier_id, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
                [csvId, product.code, product.description, product.brand, product.model, product.price_usd, product.reference, product.image_path, product.supplier_id]
            );
        }

        /*
        try {
            const transporter = nodemailer.createTransport({
                host: 'smtp.gmail.com',
                port: 587,
                secure: false,
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS
                }
            });

            const supplierResult = await pool.query('SELECT name FROM suppliers WHERE id_pro = $1', [supplierId]);
            const supplierName = supplierResult.rows[0]?.name || supplierId;

            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: process.env.ADMIN_EMAIL,
                subject: 'Nuevo CSV Subido para Revisión',
                text: `El proveedor ${supplierName} (${supplierId}) ha subido un nuevo archivo CSV: ${fileName}. Notas: ${notes || 'Ninguna'}. Por favor, revisa en el panel de administración.`
            };
            await transporter.sendMail(mailOptions);
            logger.info(`Email enviado al administrador para el archivo ${fileName}`);
        } catch (error) {
            logger.error(`Error al enviar correo: ${error.message}`);
        }
        */

        res.json({ message: 'Archivo subido y pendiente de revisión', csvId });
    } catch (error) {
        logger.error(`Error al subir archivo CSV ${fileName || 'desconocido'}: ${error.message}\n${error.stack}`);
        try {
            if (req.file && req.file.path) await fs.promises.unlink(req.file.path);
            logger.info(`Archivo temporal ${req.file?.path || 'desconocido'} eliminado`);
        } catch (unlinkError) {
            logger.error(`Error al eliminar archivo temporal: ${unlinkError.message}`);
        }
        res.status(500).json({ error: 'Error interno del servidor', message: error.message });
    }
});

router.get('/pending', authenticateAdminOrProvider, async (req, res) => {
    try {
        const supplierId = req.query.supplier_id || req.user.proveedor_id;
        logger.info(`GET /api/csv/pending recibido, usuario: ${req.user.email}, proveedor_id: ${supplierId}`);
        if (!supplierId) {
            logger.warn('No se proporcionó supplier_id');
            return res.status(400).json({ error: 'Se requiere supplier_id' });
        }

        const result = await pool.query(
            `SELECT pc.id, pc.file_name, pc.file_url, pc.supplier_id, pc.notes, pc.status, pc.admin_notes, pc.created_at, s.name as proveedor_name
             FROM pending_csvs pc
             LEFT JOIN suppliers s ON pc.supplier_id = s.id_pro
             WHERE pc.supplier_id = $1
             ORDER BY pc.created_at DESC`,
            [supplierId]
        );
        const files = result.rows.map(row => ({
            id: row.id,
            file_name: row.file_name,
            file_url: row.file_url,
            supplier_id: row.supplier_id,
            proveedor_name: row.proveedor_name,
            notes: row.notes,
            status: row.status,
            admin_notes: row.admin_notes,
            created_at: row.created_at
        }));

        logger.info(`Archivos pendientes encontrados para ${supplierId}: ${files.length}`);
        res.json(files);
    } catch (error) {
        logger.error(`Error al obtener archivos pendientes: ${error.message}\n${error.stack}`);
        res.status(500).json({ error: 'Error interno del servidor', message: error.message });
    }
});

router.get('/preview/:fileId', authenticateAdminOrProvider, async (req, res) => {
    const { fileId } = req.params;
    try {
        logger.info(`GET /api/csv/preview/${fileId} recibido, usuario: ${req.user.email}`);
        const csvResult = await pool.query(
            'SELECT supplier_id FROM pending_csvs WHERE id = $1',
            [fileId]
        );
        if (csvResult.rows.length === 0) {
            logger.warn(`Archivo CSV no encontrado: ${fileId}`);
            return res.status(404).json({ error: 'Archivo CSV no encontrado' });
        }

        if (req.user.role !== 'admin' && req.user.proveedor_id !== csvResult.rows[0].supplier_id) {
            logger.warn(`Acceso denegado para usuario ${req.user.email} al archivo ${fileId}`);
            return res.status(403).json({ error: 'Acceso denegado' });
        }

        const productsResult = await pool.query(
            'SELECT code, description, brand, model, price_usd, reference, image_path, supplier_id FROM pending_products WHERE csv_id = $1',
            [fileId]
        );
        res.json({ products: productsResult.rows });
        logger.info(`Vista previa enviada para archivo ${fileId}`);
    } catch (error) {
        logger.error(`Error al obtener vista previa del archivo ${fileId}: ${error.message}`);
        res.status(500).json({ error: 'Error al obtener vista previa', message: error.message });
    }
});

router.post('/approve/:fileId', authenticateAdmin, async (req, res) => {
    const { fileId } = req.params;
    try {
        logger.info(`POST /api/csv/approve/${fileId} recibido, usuario: ${req.user.email}`);
        const csvResult = await pool.query(
            'SELECT file_name, supplier_id FROM pending_csvs WHERE id = $1',
            [fileId]
        );
        if (csvResult.rows.length === 0) {
            logger.warn(`Archivo CSV no encontrado: ${fileId}`);
            return res.status(404).json({ error: 'Archivo CSV no encontrado' });
        }

        const { supplier_id } = csvResult.rows[0];
        const productsResult = await pool.query(
            'SELECT code, description, brand, model, price_usd, reference, image_path FROM pending_products WHERE csv_id = $1',
            [fileId]
        );

        for (const product of productsResult.rows) {
            await pool.query(
                `INSERT INTO products (code, description, brand, model, price_usd, reference, image_path, supplier_id, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
                 ON CONFLICT (code) DO UPDATE
                 SET description = EXCLUDED.description,
                     brand = EXCLUDED.brand,
                     model = EXCLUDED.model,
                     price_usd = EXCLUDED.price_usd,
                     reference = EXCLUDED.reference,
                     image_path = EXCLUDED.image_path,
                     supplier_id = EXCLUDED.supplier_id,
                     updated_at = NOW()`,
                [
                    product.code,
                    product.description,
                    product.brand,
                    product.model,
                    product.price_usd,
                    product.reference,
                    product.image_path,
                    supplier_id
                ]
            );
        }

        await pool.query('UPDATE pending_csvs SET status = $1 WHERE id = $2', ['approved', fileId]);
        logger.info(`Archivo CSV ${fileId} aprobado y productos insertados`);
        res.json({ message: 'Archivo aprobado y productos cargados' });
    } catch (error) {
        logger.error(`Error al aprobar archivo ${fileId}: ${error.message}`);
        res.status(500).json({ error: 'Error al aprobar archivo', message: error.message });
    }
});

router.post('/reject/:fileId', authenticateAdmin, async (req, res) => {
    const { fileId } = req.params;
    try {
        logger.info(`POST /api/csv/reject/${fileId} recibido, usuario: ${req.user.email}`);
        const csvResult = await pool.query(
            'SELECT file_url FROM pending_csvs WHERE id = $1',
            [fileId]
        );
        if (csvResult.rows.length === 0) {
            logger.warn(`Archivo CSV no encontrado: ${fileId}`);
            return res.status(404).json({ error: 'Archivo CSV no encontrado' });
        }

        const { file_url } = csvResult.rows[0];
        const filePath = path.join(__dirname, '../', file_url);
        try {
            await fs.promises.unlink(filePath);
            logger.info(`Archivo ${filePath} eliminado`);
        } catch (err) {
            logger.warn(`No se pudo eliminar archivo ${filePath}: ${err.message}`);
        }

        await pool.query('DELETE FROM pending_products WHERE csv_id = $1', [fileId]);
        await pool.query('DELETE FROM pending_csvs WHERE id = $1', [fileId]);
        logger.info(`Archivo CSV ${fileId} rechazado`);
        res.json({ message: 'Archivo rechazado' });
    } catch (error) {
        logger.error(`Error al rechazar archivo ${fileId}: ${error.message}`);
        res.status(500).json({ error: 'Error al rechazar archivo', message: error.message });
    }
});

module.exports = router;