// middleware/multerConfig.js
const multer = require('multer');
const path = require('path');
const logger = require('../logger');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../Uploads/temp');
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const timestamp = Date.now();
        const proveedorId = req.user.proveedor_id || 'unknown';
        const originalName = path.parse(file.originalname).name;
        const ext = path.extname(file.originalname);
        cb(null, `${proveedorId}_${timestamp}_${originalName}${ext}`);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = ['.csv', '.xlsx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
        cb(null, true);
    } else {
        logger.error(`Archivo no permitido: ${file.originalname}`);
        cb(new Error('Solo se permiten archivos CSV y XLSX'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // Límite de 5MB
});

module.exports = upload;