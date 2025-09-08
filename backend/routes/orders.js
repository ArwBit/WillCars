// routes/orders.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
const logger = require('../logger');
// Importa AMBOS middlewares
const { verifyToken, authenticateAdminOrProvider } = require('../middleware/auth');
const { sendEmail } = require('../src/utils/emailService');

// Envuelve las rutas en una función que acepte 'io'
module.exports = (io) => {
    // Ruta para crear un nuevo pedido (accesible para invitados, pero usa verifyToken opcionalmente)
    // verifyToken poblará req.user si hay un token válido, pero no detendrá la ejecución si no lo hay.
    router.post('/', verifyToken, async (req, res) => {
        const client = await pool.connect();
        try {
            const { contact_method, email, whatsapp, items, customer_name, customer_code } = req.body; // Añadido customer_name, customer_code

            // Determinar user_id: si hay un token válido, req.user será poblado por verifyToken
            const user_id = req.user ? req.user.id : null; // Obtiene el ID del usuario del token si está autenticado, sino null
            const user_email = req.user ? req.user.email : null; // Obtiene el email del usuario del token si está autenticado, sino null

            logger.info(`Intento de crear pedido por user_id: ${user_id}, user_email: ${user_email}, método contacto: ${contact_method}`);

            // Validar entradas básicas
            if (!items || items.length === 0) {
                logger.warn('Intento de crear pedido sin artículos.');
                return res.status(400).json({ error: 'El pedido debe contener al menos un artículo.' });
            }
            if (!contact_method || (contact_method === 'email' && !email) || (contact_method === 'whatsapp' && !whatsapp) || (contact_method === 'both' && (!email || !whatsapp))) {
                logger.warn(`Validación de contacto fallida. Método: ${contact_method}, Email: ${email}, Whatsapp: ${whatsapp}`);
                return res.status(400).json({ error: 'Método de contacto y detalles son requeridos.' });
            }

            await client.query('BEGIN'); // Iniciar transacción

            let total = 0;
            // Validar que todos los items tienen product_id y quantity, y calcular el total
            for (const item of items) {
                if (!item.product_id || !item.quantity || typeof item.quantity !== 'number' || item.quantity <= 0) {
                    throw new Error('Cada artículo debe tener un product_id y una quantity válida y positiva.');
                }
                // Opcional: Podrías buscar el precio actual del producto en la DB para calcular el total de forma segura en el backend
                // Por ahora, asumimos que el frontend envía un precio unitario para el cálculo, pero ten cuidado con esto en producción
                total += (item.price || 0) * item.quantity;
            }

            // Insertar el nuevo pedido
            const orderResult = await client.query(`
                INSERT INTO orders (user_id, total, contact_method, status, user_email, email, whatsapp, client_code, customer_name, customer_code)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                RETURNING id, created_at
            `, [user_id, total, contact_method, 'pendiente', user_email, email, whatsapp, client_code, customer_name, customer_code]);

            const orderId = orderResult.rows[0].id;
            const createdAt = orderResult.rows[0].created_at;
            logger.info(`Pedido ${orderId} creado en DB.`);

            // Insertar los detalles del pedido con más campos
            for (const item of items) {
                await client.query(`
                    INSERT INTO order_items (order_id, product_id, quantity, price, subtotal, description, product_code, product_ref, price_at_purchase)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                `, [
                    orderId,
                    item.product_id,
                    item.quantity,
                    item.price,        // Este es el precio unitario que el frontend envía para el cálculo del total.
                    (item.price || 0) * item.quantity, // Calculamos el subtotal aquí.
                    item.description,    // Necesitas asegurarte de que 'item.description' venga del frontend.
                    item.product_code,   // Necesitas asegurarte de que 'item.product_code' venga del frontend.
                    item.product_ref,    // Necesitas asegurarte de que 'item.product_ref' venga del frontend.
                    item.price           // Usamos item.price como price_at_purchase (precio al momento de la compra).
                ]);
            }
            logger.info(`Detalles para pedido ${orderId} insertados.`);

            await client.query('COMMIT'); // Confirmar transacción

            // Enviar notificación por correo electrónico
            await sendEmail({
                to: email,
                subject: `Confirmación de Pedido WillCars #${orderId}`, // Asunto más descriptivo
                // Asegúrate de que tu `items` del pedido tenga 'product_name' o 'description', 'price', etc.
                // para construir un email más detallado.
                html: `
                <p>¡Bienvenido a WillCars ${customer_name || email}!</p>
                <p>Gracias por su pedido en WillCars. Hemos recibido su solicitud y la estamos procesando.</p>
                
                <p><strong>Detalles de su Pedido: #${orderId}</strong></p>
                <p>Código Cliente: ${customer_code || 'N/A'}</p>
                <p>Contacto Preferido: ${contact_method}</p>
                <p>Email: ${email || '-'}</p>
                <p>WhatsApp: ${whatsapp || '-'}</p>
                
                <table style="width:100%; border-collapse: collapse; margin-top: 20px;">
                    <thead>
                        <tr style="background-color: #f2f2f2;">
                            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Descripción</th>
                            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Código/Referencia</th>
                            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Cantidad</th>
                            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Precio Unit.</th>
                            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${items.map(item => `
                            <tr>
                                <td style="padding: 8px; border: 1px solid #ddd;">${item.description || item.product_name || 'N/A'}</td>
                                <td style="padding: 8px; border: 1px solid #ddd;">${item.product_code || 'N/A'}</td>
                                <td style="padding: 8px; border: 1px solid #ddd;">${item.quantity}</td>
                                <td style="padding: 8px; border: 1px solid #ddd;">$${parseFloat(item.price || 0).toFixed(2)}</td>
                                <td style="padding: 8px; border: 1px solid #ddd;">$${parseFloat((item.price || 0) * item.quantity).toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="4" style="padding: 8px; border: 1px solid #ddd; text-align: right; font-weight: bold;">Total:</td>
                            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">$${total.toFixed(2)}</td>
                        </tr>
                    </tfoot>
                </table>
                
                <p>En breve nos pondremos en contacto con usted a través de su método preferido (${email}).</p>
                <p>¡Gracias por su confianza!</p>
                <p>Atentamente,<br>El equipo de WillCars.
                <br>0414-3287986</p>
                `
            });
            logger.info(`Correo de confirmación enviado para pedido ${orderId} a ${email}.`);

            // Emitir evento de nuevo pedido a través de WebSockets
            const newOrderResult = await pool.query(`
                SELECT
                    o.id,
                    o.user_id,
                    o.total,
                    o.contact_method,
                    o.status,
                    o.created_at,
                    o.user_email,
                    o.email,
                    o.whatsapp,
                    o.client_code,
                    o.customer_name,
                    o.customer_code
                FROM orders o
                WHERE o.id = $1
            `, [orderId]);

            if (newOrderResult.rows.length > 0) {
                const newOrderData = newOrderResult.rows[0];
                io.emit('newOrder', { order: newOrderData }); // Emitir el objeto completo del pedido
                logger.info(`Evento 'newOrder' emitido para el pedido ${orderId} vía Socket.IO.`);
            } else {
                logger.warn(`No se pudo encontrar el pedido ${orderId} después de la inserción para emitir por socket.`);
            }

            res.status(201).json({ message: 'Pedido creado y notificación enviada con éxito.', orderId: orderId, total: total });

        } catch (error) {
            await client.query('ROLLBACK'); // Revertir transacción en caso de error
            logger.error(`Error al crear pedido: ${error.message}, stack: ${error.stack}`);
            res.status(500).json({ error: 'Error al procesar el pedido.', details: error.message });
        } finally {
            client.release();
        }
    });

    // Ruta para obtener todos los pedidos con paginación
    router.get('/', authenticateAdminOrProvider, async (req, res) => {
        logger.info('--- Solicitud GET /api/orders recibida ---');

        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 5; // Default limit a 5
            const offset = (page - 1) * limit;

            logger.info(`Parámetros de paginación: page=${page}, limit=${limit}, offset=${offset}`);

            // Primero, obtener el total de pedidos para la paginación
            const countResult = await pool.query('SELECT COUNT(*) AS total FROM orders');
            const total = parseInt(countResult.rows[0].total);
            logger.info(`Total de pedidos en DB: ${total}`);

            // Obtener los pedidos con paginación
            const result = await pool.query(`
                SELECT * FROM orders
                ORDER BY created_at DESC
                LIMIT $1 OFFSET $2
            `, [limit, offset]);

            logger.info(`Pedidos obtenidos de DB: ${result.rows.length} filas.`);
            logger.info('Primeras 5 filas de pedidos:', result.rows.slice(0, 5));

            // Verificar si hay resultados
            if (result.rows.length === 0) {
                logger.info('No se encontraron pedidos en la base de datos para la página solicitada (después de la consulta).');
                return res.status(200).json({ orders: [], totalPages: 0, currentPage: page, totalOrders: 0 });
            }

            const totalPages = Math.ceil(total / limit);

            const responseData = {
                orders: result.rows,
                totalPages: totalPages,
                currentPage: page,
                totalOrders: total
            };

            logger.info('Datos a enviar al frontend:', responseData);
            res.json(responseData);

        } catch (err) {
            logger.error(`Error al obtener pedidos: ${err.message}`, err.stack);
            res.status(500).json({ error: 'Error del servidor al obtener pedidos.' });
        }
    });

    // RUTA PARA OBTENER DETALLES DE UN PEDIDO ESPECÍFICO POR ID (incluyendo sus ítems y datos de producto)
    router.get('/:id', authenticateAdminOrProvider, async (req, res) => {
        const orderId = req.params.id;
        logger.info(`Solicitud GET /api/orders/${orderId} recibida.`);
        try {
            // Obtener el pedido principal
            const orderResult = await pool.query(`
                SELECT
                    id, user_id, total, contact_method, status, created_at,
                    user_email, email, whatsapp, client_code, customer_name, customer_code
                FROM orders
                WHERE id = $1
            `, [orderId]);

            if (orderResult.rows.length === 0) {
                logger.warn(`Pedido con ID ${orderId} no encontrado.`);
                return res.status(404).json({ error: 'Pedido no encontrado.' });
            }

            const order = orderResult.rows[0];

            // Obtener los ítems asociados a ese pedido, haciendo JOIN con la tabla 'products'
            const itemsResult = await pool.query(`
                SELECT
                    oi.id,
                    oi.product_id,
                    -- Usar el nombre del producto de 'products' si está disponible, sino la descripción de 'order_items'
                    COALESCE(p.description, 'Producto Desconocido') AS product_name,
                    -- Usar el código del producto de 'products' si está disponible, sino el código de 'order_items'
                    COALESCE(p.code, oi.product_code) AS product_code,
                    oi.quantity,
                    oi.subtotal,
                    -- Seleccionar el precio unitario correcto para el frontend
                    -- Si 'price_at_purchase' es el precio que se usó al momento de la compra, úsalo.
                    -- Si 'p.usd' es el precio actual de venta, puedes considerarlo.
                    -- Para que el frontend lo muestre en 'Precio Unit.', necesitamos enviarlo como 'ref'
                    COALESCE(oi.price_at_purchase, p.usd, 0) AS ref, -- <--- MODIFICADO AQUÍ
                    oi.description, -- Mantener description de order_items si existe
                    p.ref AS product_ref_from_products -- El 'ref' del producto original, si es necesario para otros fines
                FROM order_items oi
                LEFT JOIN products p ON oi.product_id = p.id
                WHERE oi.order_id = $1
                ORDER BY oi.id;
            `, [orderId]);

            // Mapear los ítems para asegurar que tengan las propiedades que espera el frontend
            order.items = itemsResult.rows.map(item => ({
                product_id: item.product_id,
                product_name: item.product_name, // Viene del COALESCE
                quantity: item.quantity,
                // 'ref' ahora contiene el precio unitario para el frontend (price_at_purchase o p.usd)
                ref: parseFloat(item.ref || 0).toFixed(2), // Asegurarse que es un número y formatear
                subtotal: parseFloat(item.subtotal || 0).toFixed(2), // Asegurarse que es un número y formatear
                product_code: item.product_code, // Viene del COALESCE
                description: item.description // Si tienes una columna de descripción en order_items
            }));


            logger.info(`Detalles para el pedido ${orderId} obtenidos con ${order.items.length} ítems.`);
            res.json(order);
        } catch (err) {
            logger.error(`Error al obtener detalles del pedido ${orderId}: ${err.message}`, err.stack);
            res.status(500).json({ error: 'Error del servidor al obtener detalles del pedido.' });
        }
    });

    // ... otras rutas de pedidos (PUT, DELETE, etc. si las tienes) ...

    return router;
};