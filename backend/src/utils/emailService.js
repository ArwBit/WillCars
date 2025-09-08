// backend/src/utils/emailService.js

const nodemailer = require('nodemailer');
const path = require('path');
const logger = require('../../logger'); // Asegúrate de que la ruta sea correcta

// Configuración del transporter
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com', // o tu servidor SMTP
    port: 465,
    secure: true, // true para 465, false para otros puertos como 587
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

// Función para verificar la conexión
transporter.verify(function (error, success) {
    if (error) {
        logger.error('Error en la configuración del transporter de email:', error);
    } else {
        logger.info('Configuración del transporter de email verificada correctamente');
    }
});

// Función sendEmail
async function sendEmail(to, subject, text, data, templateType) {
    try {
        // Rutas a las imágenes
        const logoPath = path.join(__dirname, '..', '..', 'public', 'images', 'willcars-1.jpg');

        let htmlContent = `<p>${text}</p>`; // Contenido HTML por defecto

        if (templateType === 'customerOrder') {
            // Plantilla para el cliente y AHORA también para el administrador (dependiendo de los datos que se le pasen)
            let itemsHtml = '';

            // VERIFICAMOS SI TENEMOS LOS PRODUCTOS AGRUPADOS POR PROVEEDOR (PARA EL EMAIL DEL ADMINISTRADOR)
            if (data.groupedItemsBySupplier && data.groupedItemsBySupplier.length > 0) {
                itemsHtml += `
                    <h3 style="color: #0056b3;">Productos en su Pedido (Agrupados por Proveedor):</h3>
                `;
                // Iterar sobre cada grupo de proveedor
                data.groupedItemsBySupplier.forEach(supplierGroup => {
                    itemsHtml += `
                        <div style="margin-top: 25px; border: 1px solid #eee; padding: 15px; border-radius: 8px; background-color: #f9f9f9;">
                            <h4 style="color: #333; margin-top: 0;">Proveedor: ${supplierGroup.supplierName} (${supplierGroup.supplierIdPro})</h4>
                            <table style="width:100%; border-collapse: collapse; margin-top: 10px;">
                                <thead>
                                    <tr style="background-color: #e0e0e0;">
                                        <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Descripción</th>
                                        <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Código/Ref.</th>
                                        <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Cantidad</th>
                                        <th style="padding: 8px; border: 1px solid #ddd; text-align: right;">Precio Unit.</th>
                                        <th style="padding: 8px; border: 1px solid #ddd; text-align: right;">Subtotal</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${supplierGroup.items.map(item => `
                                        <tr>
                                            <td style="padding: 8px; border: 1px solid #ddd;">${item.description || item.product_description || 'N/A'}</td>
                                            <td style="padding: 8px; border: 1px solid #ddd;">${item.product_code || 'N/A'}</td>
                                            <td style="padding: 8px; border: 1px solid #ddd;">${item.quantity}</td>
                                            <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">$${parseFloat(item.ref || item.usd || item.product_usd).toFixed(2)}</td>
                                            <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">$${parseFloat(item.subtotal || 0).toFixed(2)}</td>
                                        </tr>
                                    `).join('')}
                                    <tr style="background-color: #f2f2f2; font-weight: bold;">
                                        <td colspan="4" style="padding: 8px; border: 1px solid #ddd; text-align: right;">Total Proveedor:</td>
                                        <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">$${parseFloat(supplierGroup.supplierTotal || 0).toFixed(2)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    `;
                });
                itemsHtml += `
                    <div style="margin-top: 20px; text-align: right; font-size: 1.2em; font-weight: bold; padding-top: 15px; border-top: 2px solid #0056b3;">
                        Total General del Pedido: $${parseFloat(data.total || 0).toFixed(2)}
                    </div>
                `;
            } else if (data.items && data.items.length > 0) {
                // SI NO ESTÁN AGRUPADOS, MOSTRAMOS COMO ANTES (PARA EL EMAIL DEL CLIENTE REGULAR)
                itemsHtml = `
                    <h3 style="color: #0056b3;">Productos en su Pedido:</h3>
                    <table style="width:100%; border-collapse: collapse; margin-top: 15px;">
                        <thead>
                            <tr style="background-color: #f2f2f2;">
                                <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Descripción</th>
                                <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Código/Referencia</th>
                                <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Cantidad</th>
                                <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Precio Unit.</th>
                                <th style="padding: 8px; border: 1px solid #ddd; text-align: right;">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.items.map(item => `
                                <tr>
                                    <td style="padding: 8px; border: 1px solid #ddd;">${item.description || item.product_description || 'N/A'}</td>
                                    <td style="padding: 8px; border: 1px solid #ddd;">${item.product_code || 'N/A'}</td>
                                    <td style="padding: 8px; border: 1px solid #ddd;">${item.quantity}</td>
                                    <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">$${parseFloat(item.ref || item.usd || item.product_usd).toFixed(2)}</td>
                                    <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">$${parseFloat(item.subtotal || 0).toFixed(2)}</td>
                                </tr>
                            `).join('')}
                            <tr style="background-color: #f2f2f2;">
                                <td colspan="4" style="padding: 8px; border: 1px solid #ddd; text-align: right; font-weight: bold;">Total:</td>
                                <td style="padding: 8px; border: 1px solid #ddd; text-align: right; font-weight: bold;">$${parseFloat(data.total || 0).toFixed(2)}</td>
                            </tr>
                        </tbody>
                    </table>
                `;
            } else {
                itemsHtml = '<p>No hay productos listados para este pedido.</p>';
            }

            htmlContent = `
                <!DOCTYPE html>
                <html lang="es">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Confirmación de Pedido WillCars</title>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 5px; overflow: hidden; }
                        .header { background-color: #f7f7f7; padding: 20px; text-align: center; }
                        .content { padding: 20px; }
                        .footer { text-align: center; padding: 20px 0; font-size: 0.8em; color: #777; }
                        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                        th, td { padding: 8px; border: 1px solid #ddd; text-align: left; }
                        th { background-color: #f2f2f2; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <img src="cid:willcars_logo" alt="WillCars Logo" style="max-width: 150px;">
                            <h1 style="color: #333;">¡Hola ${data.customerName || 'Cliente'}!</h1>
                        </div>
                        <div class="content">
                            <p>Gracias por su pedido en WillCars. Hemos recibido su solicitud y la estamos procesando.</p>
                            <p><strong>Detalles de su Pedido:</strong> #${data.orderId}</p>
                            <p><strong>Fecha del Pedido:</strong> ${data.orderDate || 'N/A'}</p> <p><strong>Código Cliente:</strong> ${data.customerCode || 'N/A'}</p>
                            <p><strong>Contacto Preferido:</strong> ${data.contactMethod}</p>
                            ${data.customerEmail ? `<p><strong>Email:</strong> ${data.customerEmail}</p>` : ''}
                            ${data.customerWhatsapp ? `<p><strong>WhatsApp:</strong> ${data.customerWhatsapp}</p>` : ''}
                            
                            ${itemsHtml}

                            <p>En breve nos pondremos en contacto con usted a través de su método preferido (${data.customerEmail || data.customerWhatsapp}).</p>
                            <p>¡Gracias por su confianza!</p>
                            <p>Atentamente,<br>El equipo de WillCars</p>
                        </div>
                        <div class="footer">
                            <p>WillCars © ${new Date().getFullYear()}</p>
                        </div>
                    </div>
                </body>
                </html>
            `;
        } else if (templateType === 'supplierOrder') {
            // Plantilla para el proveedor (también añadiremos la fecha del pedido)
            let supplierItemsHtml = '';
            if (data.items && data.items.length > 0) {
                supplierItemsHtml = `
                    <h3 style="color: #555;">Productos en este Pedido:</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>Descripción</th>
                                <th>Código/Referencia</th>
                                <th>Cantidad</th>
                                <th>Precio Unit.</th>
                                <th>Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.items.map(item => `
                                <tr>
                                    <td style="padding: 8px; border: 1px solid #ddd;">${item.description || item.product_description || 'N/A'}</td>
                                    <td style="padding: 8px; border: 1px solid #ddd;">${item.product_code || 'N/A'}</td>
                                    <td style="padding: 8px; border: 1px solid #ddd;">${item.quantity}</td>
                                    <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">$${parseFloat(item.ref || item.usd || item.product_usd).toFixed(2)}</td>
                                    <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">$${parseFloat(item.subtotal || 0).toFixed(2)}</td>
                                </tr>
                            `).join('')}
                            <tr style="font-weight: bold;">
                                <td colspan="4" style="text-align: right;">Total:</td>
                                <td>$${parseFloat(data.supplierTotal || 0).toFixed(2)}</td>
                            </tr>
                        </tbody>
                    </table>
                `;
            } else {
                supplierItemsHtml = '<p>No hay productos listados para este proveedor en este pedido.</p>';
            }

            htmlContent = `
                <!DOCTYPE html>
                <html lang="es">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Nuevo Pedido de WillCars</title>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 5px; overflow: hidden; }
                        .header { background-color: #f7f7f7; padding: 20px; text-align: center; }
                        .content { padding: 20px; }
                        .footer { text-align: center; padding: 20px 0; font-size: 0.8em; color: #777; }
                        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                        th, td { padding: 8px; border: 1px solid #ddd; text-align: left; }
                        th { background-color: #f2f2f2; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <img src="cid:willcars_logo" alt="WillCars Logo" style="max-width: 150px;">
                            <h1 style="color: #333;">Nuevo Pedido de WillCars</h1>
                        </div>
                        <div class="content">
                            <p>Hola ${data.supplierName || 'Proveedor'}!</p>
                            <p>Hemos recibido un nuevo pedido a través de WillCars que incluye productos de su inventario. Por favor, revise los detalles a continuación:</p>

                            <p><strong>Detalles del Pedido General:</strong> #${data.orderId}</p>
                            <p><strong>Fecha del Pedido:</strong> ${data.orderDate || 'N/A'}</p> <p><strong>Código Cliente:</strong> ${data.customerCode || 'N/A'}</p>
                            <p><strong>Contacto Cliente:</strong> ${data.customerName || 'Cliente'} (${data.customerEmail ? `<a href="mailto:${data.customerEmail}">${data.customerEmail}</a>` : ''}${data.customerWhatsapp ? `, WhatsApp: ${data.customerWhatsapp}` : ''})</p>
                            <p><strong>ID Proveedor:</strong> ${data.supplierIdPro || 'N/A'}</p>

                            ${supplierItemsHtml}

                            <p>Por favor, procese estos productos para el pedido #${data.orderId}.</p>
                            <p>Atentamente,<br>El equipo de WillCars</p>
                        </div>
                        <div class="footer">
                            <p>WillCars © ${new Date().getFullYear()}</p>
                        </div>
                    </div>
                </body>
                </html>
            `;
        } else {
            // Si templateType no es reconocido, usar el texto plano por defecto
            htmlContent = `<p>${text}</p>`;
        }

        const mailOptions = {
            from: `"WillCars" <${process.env.EMAIL_USER}>`,
            to: to,
            subject: subject,
            text: text, // Versión de texto plano
            html: htmlContent, // Versión HTML generada
            attachments: [
                {
                    filename: 'willcars-1.jpg',
                    path: logoPath,
                    cid: 'willcars_logo'
                }
            ]
        };

        const info = await transporter.sendMail(mailOptions);
        logger.info(`Correo enviado a ${to} con asunto: ${subject}`);
        return info;
    } catch (error) {
        logger.error(`Error al enviar correo a ${to}: ${error.message}`, error);
        throw error;
    }
}

module.exports = { sendEmail };