/* jshint -W069 */ // Suprime advertencias sobre notación de corchetes
const fs = require('fs');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

const inputCsv = 'C:/Users/warei/Desktop/WillCars/backend/csvs/Mastro.csv';
const outputCsv = 'C:/Users/warei/Desktop/WillCars/backend/csvs/Mastro_corrected.csv';

const validProveedores = ['PS-00001', 'MAS-i002', 'ARG-C003', 'Mcc-i004', 'Wic-A1', 'kod-Sc001'];
const defaultImage = '/img/willcars-1.jpg';

const records = [];
fs.createReadStream(inputCsv)
    .pipe(csv())
    .on('data', (row) => {
        // Ignorar filas vacías
        if (!row['Código'] && !row['Descripción'] && !row['Precio USD'] && !row['Proveedor']) {
            console.log('Fila vacía omitida:', row);
            return;
        }
        // Corregir Código
        row['Código'] = row['Código'] ? row['Código'].substring(0, 100) : 'UNKNOWN_CODE_' + Math.random().toString(36).substring(2, 8);
        // Corregir Descripción
        row['Descripción'] = row['Descripción'] ? row['Descripción'].substring(0, 500) : 'Sin descripción';
        // Corregir proveedor_id
        if (!validProveedores.includes(row['Proveedor'])) {
            row['Proveedor'] = 'PS-00001';
        }
        // Corregir Precio USD
        if (!row['Precio USD'] || isNaN(parseFloat(row['Precio USD']))) {
            row['Precio USD'] = '0.00';
        }
        // Corregir Referencia
        if (!row['Referencia'] || isNaN(parseFloat(row['Referencia']))) {
            row['Referencia'] = (parseFloat(row['Precio USD']) * 1.2).toFixed(2);
        }
        // Corregir Imagen
        if (!row['Imagen'] || row['Imagen'].includes('Sanchez Import/Fotos Sanchez Import/product-107.JPG')) {
            row['Imagen'] = defaultImage;
        }
        records.push(row);
    })
    .on('end', () => {
        const csvWriter = createCsvWriter({
            path: outputCsv,
            header: [
                { id: 'Código', title: 'Código' },
                { id: 'Descripción', title: 'Descripción' },
                { id: 'Marca', title: 'Marca' },
                { id: 'Modelo', title: 'Modelo' },
                { id: 'Precio USD', title: 'Precio USD' },
                { id: 'Referencia', title: 'Referencia' },
                { id: 'Proveedor', title: 'Proveedor' },
                { id: 'Imagen', title: 'Imagen' }
            ]
        });
        csvWriter.writeRecords(records)
            .then(() => console.log('CSV corregido guardado en:', outputCsv))
            .catch(err => console.error('Error al escribir CSV:', err));
    })
    .on('error', (err) => {
        console.error('Error al leer CSV:', err);
    });