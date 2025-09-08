
/* jshint -W069 */
// backend/scripts/validateCSV.js
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: 'willcars',
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

const PROVEEDORES = {
    'PS-00001': { nombre: 'Sanchez Import', carpeta: 'Sanchez Import', imagenes: 'Fotos Sanchez Import' },
    'MAS-i002': { nombre: 'Mastro Import', carpeta: 'Mastro', imagenes: 'Fotos_Mastro' },
    'ARG-C003': { nombre: 'ARG Import', carpeta: 'ARG_importaciones', imagenes: 'Fotos_ARG' },
    'Mcc-i004': { nombre: 'MultiOcc', carpeta: 'MultiOcc', imagenes: 'Fotos_MultiOcc' },
    'Wic-A1': { nombre: 'WillCars Import', carpeta: 'WillCars Import', imagenes: 'Fotos_WillCars' },
    'kod-Sc001': { nombre: 'Kode Import', carpeta: 'Kode import', imagenes: 'Fotos_Kode' }
};

const BASE_UPLOADS = 'C:/Users/warei/Desktop/WillCars/backend/Uploads';
const DEFAULT_IMAGE = '/Uploads/default.jpg';

async function validateCSV(filePath, proveedorId) {
    const errors = [];
    const records = [];
    const proveedor = PROVEEDORES[proveedorId];
    if (!proveedor) {
        errors.push(`Proveedor inválido: ${proveedorId}`);
        return { valid: false, errors, records };
    }
    const imageBasePath = `/Uploads/${proveedor.carpeta}/${proveedor.imagenes}/`;
    const imageDir = path.join(BASE_UPLOADS, proveedor.carpeta, proveedor.imagenes);

    // Validar proveedor en la base de datos
    const supplierQuery = await pool.query('SELECT id_pro FROM suppliers WHERE id_pro = $1', [proveedorId]);
    if (supplierQuery.rows.length === 0) {
        errors.push(`Proveedor no encontrado en la base de datos: ${proveedorId}`);
        return { valid: false, errors, records };
    }

    // Leer y validar CSV
    return new Promise((resolve) => {
        fs.createReadStream(filePath)
            .pipe(csv({ headers: true, skipLines: 0, trim: true }))
            .on('data', (row) => {
                // Mapear columnas no estándares a las requeridas
                let codigo = row['Código'] || row['Code'] || row['ID'] || `UNKNOWN_CODE_${Math.random().toString(36).substring(2, 8)}`;
                let descripcion = row['Descripción'] || row['Description'] || row['Nombre'] || 'Sin descripción';
                let marca = row['Marca'] || row['Brand'] || '';
                let modelo = row['Modelo'] || row['Model'] || '';
                let precio = row['Precio USD'] || row['Price'] || row['USD'] || '0.00';
                let referencia = row['Referencia'] || row['Ref'] || (parseFloat(precio) * 1.43).toFixed(2);
                let imagen = row['Imagen'] || row['Image'] || '';

                // Normalizar datos
                let record = {
                    'Código': codigo.substring(0, 50).trim(),
                    'Descripción': descripcion.substring(0, 255).trim(),
                    'Marca': marca.trim(),
                    'Modelo': modelo.trim(),
                    'Precio USD': !isNaN(parseFloat(precio)) ? parseFloat(precio).toFixed(2) : '0.00',
                    'Referencia': !isNaN(parseFloat(referencia)) ? parseFloat(referencia).toFixed(2) : (parseFloat(precio) * 1.43).toFixed(2),
                    'Proveedor': proveedorId
                };

                // Validar imagen
                const code = record['Código'].replace(/[\/\\ ]/g, '_');
                const imagePath = imagen ? path.join(BASE_UPLOADS, imagen.replace('/Uploads/', '')) : path.join(imageDir, `${code}.jpg`);
                record['Imagen'] = fs.existsSync(imagePath) ? (imagen || `${imageBasePath}${code}.jpg`) : DEFAULT_IMAGE;

                // Validaciones
                if (record['Precio USD'] <= 0) {
                    errors.push(`Precio inválido para ${record['Código']}: ${record['Precio USD']}`);
                }
                if (!fs.existsSync(path.join(BASE_UPLOADS, record['Imagen'].replace('/Uploads/', '')))) {
                    errors.push(`Imagen no encontrada para ${record['Código']}: ${record['Imagen']}`);
                }

                records.push(record);
            })
            .on('end', () => {
                console.log(`Validado ${filePath}: ${records.length} registros, ${errors.length} errores`);
                resolve({ valid: errors.length === 0, errors, records });
            })
            .on('error', (err) => {
                console.error(`Error al validar ${filePath}:`, err);
                resolve({ valid: false, errors: [`Error al leer CSV: ${err.message}`], records });
            });
    });
}

module.exports = { validateCSV };