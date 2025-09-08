// backend/routes/customerOrders.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
const logger = require('../logger');
const { sendEmail } = require('../src/utils/emailService'); // Asegúrate de que la ruta sea correcta

router.post('/', async (req, res) => {
    const client = await pool.connect();
    try {
        const { contact_method, email, whatsapp, items, customer_name, customer_code } = req.body;

        logger.info(`Iniciando creación de pedido. Contact_method: ${contact_method}, Email: ${email}, WhatsApp: ${whatsapp}, Items: ${JSON.stringify(items)}`);

        // Validaciones existentes
        if (!items || items.length === 0) {
            return res.status(400).json({ error: 'El pedido debe contener al menos un producto.' });
        }
        if (contact_method === 'email' && !email) {
            return res.status(400).json({ error: 'Se requiere un email para el método de contacto "Email".' });
        }
        if (contact_method === 'whatsapp' && !whatsapp) {
            return res.status(400).json({ error: 'Se requiere un número de WhatsApp para el método de contacto "WhatsApp".' });
        }
        if (contact_method === 'both' && (!email || !whatsapp)) {
            return res.status(400).json({ error: 'Se requiere email y WhatsApp para el método de contacto "Ambos".' });
        }
        if (!customer_name || customer_name.trim() === '') {
            return res.status(400).json({ error: 'El nombre del cliente es obligatorio.' });
        }

        await client.query('BEGIN');

        let total = 0;
        const orderItems = [];
        const supplierProductsMap = new Map();

        logger.info('Procesando ítems del pedido');
        for (const item of items) {
            logger.info(`Consultando producto con code: ${item.product_id}`);
            const productQuery = await client.query(
                'SELECT code, description, usd, ref, proveedor_id AS supplier_id FROM products WHERE code = $1',
                [item.product_id]
            );
            const product = productQuery.rows[0];

            if (!product) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: `Producto con código ${item.product_id} no encontrado.` });
            }

            const itemPrice = parseFloat(product.usd);
            const itemQuantity = parseInt(item.quantity, 10);
            const itemSubtotal = itemPrice * itemQuantity;

            total += itemSubtotal;
            const orderItem = {
                product_code: product.code,
                product_description: product.description,
                product_usd: itemPrice,
                product_ref: product.ref,
                quantity: itemQuantity,
                subtotal: itemSubtotal,
                supplier_id: product.supplier_id
            };
            orderItems.push(orderItem);

            if (!supplierProductsMap.has(product.supplier_id)) {
                supplierProductsMap.set(product.supplier_id, {
                    items: [],
                    total: 0
                });
            }
            supplierProductsMap.get(product.supplier_id).items.push(orderItem);
            supplierProductsMap.get(product.supplier_id).total += itemSubtotal;
        }

        logger.info(`Insertando pedido en orders. Total: ${total}`);
        const orderResult = await client.query(
            `INSERT INTO orders (user_id, total, contact_method, email, whatsapp, status, customer_name, customer_code)
             VALUES ($1, $2, $3, $4, $5, 'pendiente', $6, $7) RETURNING *`,
            [null, total, contact_method, email, whatsapp, customer_name, customer_code]
        );
        const newOrder = orderResult.rows[0];

        logger.info(`Insertando ítems en order_items para order_id: ${newOrder.id}`);
        for (const item of orderItems) {
            await client.query(
                `INSERT INTO order_items (order_id, product_code, quantity, price_at_purchase, product_ref, subtotal, supplier_id)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [newOrder.id, item.product_code, item.quantity, item.product_usd, item.product_ref || null, item.subtotal, item.supplier_id || null]
            );
        }

        logger.info('Confirmando transacción');
        await client.query('COMMIT');

        logger.info(`Nuevo pedido de cliente (ID: ${newOrder.id}) creado desde buscador.html. Contacto: ${contact_method}, Email: ${email}, WhatsApp: ${whatsapp}, Nombre: ${customer_name}, Código Cliente: ${customer_code}`);

        // Inicializar groupedItemsForAdminEmail
        const groupedItemsForAdminEmail = [];

        // **Envío de correo de confirmación al cliente**
        const customerEmailSubject = `Confirmación de Pedido WillCars #${newOrder.id}`;
        if (email) {
            logger.info(`Enviando correo de confirmación a ${email}`);
            await sendEmail(
                email,
                customerEmailSubject,
                'Su pedido ha sido recibido.',
                {
                    orderId: newOrder.id,
                    customerName: customer_name,
                    customerCode: customer_code,
                    customerEmail: email,
                    customerWhatsapp: whatsapp,
                    contactMethod: contact_method,
                    items: orderItems,
                    total: parseFloat(newOrder.total),
                    orderDate: new Date(newOrder.created_at).toLocaleString(),
                },
                'customerOrder'
            );
            logger.info(`Correo enviado a ${email}`);
        } else {
            logger.warn(`No se envió correo de confirmación para el pedido ${newOrder.id} porque no se proporcionó un email.`);
        }

        // **Envío de correos a cada proveedor involucrado**
        for (const [supplierId, supplierData] of supplierProductsMap.entries()) {
            logger.info(`Consultando proveedor con id_pro: ${supplierId}`);
            const supplierQuery = await client.query('SELECT name, email_contacto, id_pro FROM suppliers WHERE id_pro = $1', [supplierId]);
            const supplierInfo = supplierQuery.rows[0];

            if (supplierInfo) {
                groupedItemsForAdminEmail.push({
                    supplierName: supplierInfo.name,
                    supplierIdPro: supplierInfo.id_pro,
                    items: supplierData.items,
                    supplierTotal: supplierData.total
                });

                if (supplierInfo.email_contacto) {
                    const supplierEmailSubject = `Nuevo Pedido de WillCars para ${supplierInfo.name} #${newOrder.id} (${supplierInfo.id_pro})`;
                    logger.info(`Enviando correo a proveedor ${supplierInfo.name} (${supplierInfo.email_contacto})`);
                    await sendEmail(
                        supplierInfo.email_contacto,
                        supplierEmailSubject,
                        `Estimado/a ${supplierInfo.name},\n\nHemos recibido un nuevo pedido a través de WillCars que incluye productos de su inventario. Por favor, revise los detalles a continuación.`,
                        {
                            orderId: newOrder.id,
                            orderDate: new Date(newOrder.created_at).toLocaleString(),
                            customerName: customer_name,
                            customerCode: customer_code,
                            customerEmail: email,
                            customerWhatsapp: whatsapp,
                            supplierName: supplierInfo.name,
                            supplierIdPro: supplierInfo.id_pro,
                            items: supplierData.items,
                            supplierTotal: supplierData.total
                        },
                        'supplierOrder'
                    );
                    logger.info(`Email de pedido enviado a proveedor ${supplierInfo.name} (${supplierId}) para el pedido ${newOrder.id}.`);
                } else {
                    logger.warn(`El proveedor con ID ${supplierId} (${supplierInfo.name}) no tiene un email de contacto configurado para el pedido ${newOrder.id}.`);
                }
            } else {
                logger.warn(`No se encontraron detalles para el proveedor con ID ${supplierId} para el pedido ${newOrder.id}.`);
            }
        }

        // **Envío de correo resumen al administrador**
        const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_USER;
        if (adminEmail) {
            const adminEmailSubject = `Nuevo Pedido COMPLETO - WillCars #${newOrder.id} de ${customer_name}`;
            logger.info(`Enviando correo resumen a administrador ${adminEmail}`);
            await sendEmail(
                adminEmail,
                adminEmailSubject,
                `Se ha realizado un nuevo pedido completo por ${customer_name}. Detalles adjuntos.`,
                {
                    orderId: newOrder.id,
                    orderDate: new Date(newOrder.created_at).toLocaleString(),
                    customerName: customer_name,
                    customerCode: customer_code,
                    customerEmail: email,
                    customerWhatsapp: whatsapp,
                    contactMethod: contact_method,
                    groupedItemsBySupplier: groupedItemsForAdminEmail,
                    total: parseFloat(newOrder.total)
                },
                'customerOrder'
            );
            logger.info(`Correo resumen de pedido ${newOrder.id} enviado al administrador (${adminEmail}).`);
        } else {
            logger.warn(`No se pudo enviar correo resumen para el pedido ${newOrder.id} porque no se configuró ADMIN_EMAIL o EMAIL_USER.`);
        }

        res.status(201).json({ message: 'Pedido creado exitosamente', order_id: newOrder.id, order: newOrder });

    } catch (error) {
        await client.query('ROLLBACK');
        logger.error(`Error al crear pedido de cliente: ${error.message}, stack: ${error.stack}`);
        res.status(500).json({ error: 'Error interno del servidor al crear el pedido.', details: error.message });
    } finally {
        client.release();
    }
});

module.exports = router;