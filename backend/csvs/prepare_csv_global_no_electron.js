const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

// Configuración de proveedores
const PROVEEDORES = {
    'PS-00001': { nombre: 'Sanchez Import', carpeta: 'Sanchez Import', imagenes: 'Fotos Sanchez Import' },
    'MAS-i002': { nombre: 'Mastro Import', carpeta: 'Mastro', imagenes: 'Fotos_Mastro' },
    'ARG-C003': { nombre: 'ARG Import', carpeta: 'ARG_importaciones', imagenes: 'Fotos_ARG' },
    'Mcc-i004': { nombre: 'MultiOcc', carpeta: 'MultiOcc', imagenes: 'Fotos_MultiOcc' },
    'Wic-A1': { nombre: 'WillCars Import', carpeta: 'WillCars Import', imagenes: 'Fotos_WillCars' },
    'kod-Sc001': { nombre: 'Kode Import', carpeta: 'Kode import', imagenes: 'Fotos_Kode' }
};

const BASE_UPLOADS = 'C:/Users/warei/Desktop/WillCars/backend/Uploads';
const OUTPUT_CSV = 'C:/Users/warei/Desktop/WillCars/backend/csvs/global_productos.csv';
const DEFAULT_IMAGE = '/Uploads/default.jpg';

// Función para procesar un CSV
async function processCsv(inputCsv, proveedorId) {
    const records = [];
    const proveedor = PROVEEDORES[proveedorId];
    const imageBasePath = `/Uploads/${proveedor.carpeta}/${proveedor.imagenes}/`;
    const imageDir = path.join(BASE_UPLOADS, proveedor.carpeta, proveedor.imagenes);
    const mappingCsv = path.join(BASE_UPLOADS, proveedor.carpeta, 'mapeo_imagenes.csv');

    let mapping = {};
    if (fs.existsSync(mappingCsv)) {
        await new Promise((resolve, reject) => {
            fs.createReadStream(mappingCsv)
                .pipe(csv())
                .on('data', (row) => {
                    if (row['Código'] && row['Nombre_Imagen']) {
                        mapping[row['Código']] = row['Nombre_Imagen'];
                    }
                })
                .on('end', resolve)
                .on('error', reject);
        });
    }

    return new Promise((resolve, reject) => {
        fs.createReadStream(inputCsv)
            .pipe(csv())
            .on('data', (row) => {
                if (!Object.values(row).some(val => val && val.trim())) {
                    console.log('Fila vacía omitida:', row);
                    return;
                }

                let record = {
                    'Código': row['Código'] ? row['Código'].substring(0, 50).trim() : 'UNKNOWN_CODE_' + Math.random().toString(36).substring(2, 8),
                    'Descripción': row['Descripción'] ? row['Descripción'].substring(0, 255).trim() : 'Sin descripción',
                    'Marca': row['Marca'] ? row['Marca'].trim() : '',
                    'Modelo': row['Modelo'] ? row['Modelo'].trim() : '',
                    'Precio USD': row['Precio USD'] && !isNaN(parseFloat(row['Precio USD'])) ? parseFloat(row['Precio USD']).toFixed(2) : '0.00',
                    'Referencia': row['Referencia'] && !isNaN(parseFloat(row['Referencia'])) ? parseFloat(row['Referencia']).toFixed(2) : (parseFloat(row['Precio USD']) * 1.43).toFixed(2),
                    'Proveedor': PROVEEDORES[row['Proveedor']] ? row['Proveedor'] : proveedorId
                };

                const code = record['Código'].replace(/[\/\\ ]/g, '_');
                const imagePath = path.join(imageDir, `${code}.jpg`);
                record['Imagen'] = mapping[record['Código']] && fs.existsSync(path.join(imageDir, mapping[record['Código']]))
                    ? `${imageBasePath}${mapping[record['Código']]}`
                    : fs.existsSync(imagePath)
                    ? `${imageBasePath}${code}.jpg`
                    : DEFAULT_IMAGE;

                records.push(record);
            })
            .on('end', () => {
                console.log(`Procesado ${inputCsv}: ${records.length} registros`);
                resolve(records);
            })
            .on('error', (err) => {
                console.error(`Error al procesar ${inputCsv}:`, err);
                reject(err);
            });
    });
}

// Función para combinar CSVs
async function combineCsvs() {
    const allRecords = [];
    for (const proveedorId of Object.keys(PROVEEDORES)) {
        const csvPath = path.join(BASE_UPLOADS, PROVEEDORES[proveedorId].carpeta, `${PROVEEDORES[proveedorId].nombre}.csv`);
        if (fs.existsSync(csvPath)) {
            const records = await processCsv(csvPath, proveedorId);
            allRecords.push(...records);
        } else {
            console.log(`No se encontró CSV para ${PROVEEDORES[proveedorId].nombre}: ${csvPath}`);
        }
    }

    const csvWriter = createCsvWriter({
        path: OUTPUT_CSV,
        header: [
            { id: 'Código', title: 'Código' },
            { id: 'Descripción', title: 'Descripción' },
            { id: 'Marca', title: 'Marca' },
            { id: 'Modelo', title: 'Modelo' },
            { id: 'Precio USD', title: 'Precio USD' },
            { id: 'Referencia', title: 'Referencia' },
            { id: 'Proveedor', title: 'Proveedor' },
            { id: 'Imagen', title: 'Imagen' }
        ],
        fieldDelimiter: ',',
        encoding: 'utf8'
    });

    await csvWriter.writeRecords(allRecords);
    console.log(`CSV global generado: ${OUTPUT_CSV} con ${allRecords.length} registros`);
}

// Ejecutar
combineCsvs().catch(err => console.error('Error:', err));