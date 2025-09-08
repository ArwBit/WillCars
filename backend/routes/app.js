const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const { Server } = require('socket.io');
const http = require('http');
const path = require('path');
const jwt = require('jsonwebtoken'); // Importa jsonwebtoken aquí

// Asegúrate de que .env se cargue al inicio
require('dotenv').config();
console.log('JWT_SECRET cargado en el servidor:', process.env.JWT_SECRET); // ¡Añade esta línea!
// Tus módulos locales
const authRoutes = require('./routes/auth').router; // Asegúrate de exportar como .router si es así
const userRoutes = require('./routes/users');
const productsRoutes = require('./routes/products');
const ordersRoutes = require('./routes/orders'); // Se le pasará 'io'
const statsRoutes = require('./routes/stats');
const salesRoutes = require('./routes/sales');
const providerRoutes = require('./routes/proveedores');
const newsletterRoutes = require('./routes/newsletter');
const configRoutes = require('./routes/config');
const { initializeDatabase } = require('./db'); // O el pool directamente
const logger = require('./logger');

const app = express();
const server = http.createServer(app);

// --- CORRECCIÓN 1: Configuración de Orígenes Permitidos (CORS más amplio) ---
// Define la lista completa de orígenes permitidos para el desarrollo y producción
const allowedOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:8080',
    'http://127.0.0.1:8080',
    'http://localhost:5817', // Añade los puertos que uses en el frontend
    'http://127.0.0.1:5817',
    process.env.FRONTEND_URL // Para tu entorno de producción
].filter(Boolean); // Filtra cualquier valor 'undefined' si FRONTEND_URL no está establecido

// Configuración de Socket.IO con CORS para todos los orígenes permitidos
const io = new Server(server, {
    cors: {
        origin: allowedOrigins, // Usa la lista completa
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        credentials: true,
        allowedHeaders: ['Content-Type', 'Authorization'] // Importante para el token
    }
});
logger.info('Socket.IO inicializado, cliente disponible en /socket.io/socket.io.js');

// --- MIDDLEWARES GLOBALES ---
// CORS para Express (peticiones HTTP)
app.use(cors({
    origin: allowedOrigins, // Usa la lista completa también para Express
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Añade 'OPTIONS' para preflight requests
    allowedHeaders: ['Content-Type', 'Authorization'], // Importante para el token
    credentials: true
}));
app.use(express.json()); // Para parsear cuerpos de solicitud JSON
app.use(express.urlencoded({ extended: true })); // Para parsear cuerpos de solicitud URL-encoded
app.use(morgan('combined', { stream: logger.stream })); // Logging de peticiones HTTP

// --- CORRECCIÓN 2: Configuración de Helmet y Content Security Policy (CSP) ---
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: [
                "'self'",
                'https://code.jquery.com',
                'https://cdn.jsdelivr.net',
                'https://cdnjs.cloudflare.com',
                'https://stackpath.bootstrapcdn.com',
                'https://cdn.socket.io',
                'https://ajax.googleapis.com',
                "'unsafe-inline'" // Ten cuidado con esto en producción, pero es útil para desarrollo
            ],
            scriptSrcAttr: ["'unsafe-inline'"], // Para atributos de eventos inline (ej. onclick)
            styleSrc: [
                "'self'",
                'https://cdn.jsdelivr.net',
                'https://cdnjs.cloudflare.com',
                'https://stackpath.bootstrapcdn.com',
                'https://fonts.googleapis.com',
                "'unsafe-inline'"
            ],
            fontSrc: [
                "'self'",
                'https://cdnjs.cloudflare.com',
                'https://fonts.gstatic.com'
            ],
            imgSrc: [
                "'self'",
                'http://localhost:3000', // Tu propio origen
                'http://localhost:8080',
                'http://localhost:5817',
                'data:', // Para imágenes base64 (si las usas)
                
                // http://localhost:3000/Uploads/, ya está cubierto por 'http://localhost:3000'
            ],
            connectSrc: [
                "'self'",
                'http://localhost:3000',
                'ws://localhost:3000', // Para WebSockets
                'wss://localhost:3000', // Para WebSockets (HTTPS)
                'http://localhost:8080', 'ws://localhost:8080',
                'http://localhost:5817', 'ws://localhost:5817'
            ],
            formAction: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'none'"],
            frameSrc: ["'none'"]
        }
    }
}));


// --- CORRECCIÓN 3: Servir Archivos Estáticos desde la carpeta 'frontend' ---
// La ruta correcta para acceder a tu carpeta frontend desde el backend
logger.info('Configurando ruta estática para frontend:', path.join(__dirname, '../frontend'));
// Servir archivos estáticos
app.use(express.static(path.join(__dirname, '../../frontend')));
app.use('/Uploads', express.static(path.join(__dirname, '../../Uploads')));

// Si tienes subcarpetas específicas dentro de 'frontend' que quieres exponer con rutas cortas
// o configuraciones CORS diferentes, puedes añadirlas:
// app.use('/css', express.static(path.join(__dirname, '../frontend/css')));
// app.use('/js', express.static(path.join(__dirname, '../frontend/js')));
// app.use('/images', express.static(path.join(__dirname, '../frontend/images')));

// Servir la carpeta de 'Uploads' que está en el mismo nivel que 'routes'
logger.info('Configurando ruta estática para Uploads:', path.join(__dirname, '../Uploads'));
app.use('/Uploads', cors({
    origin: allowedOrigins,
    methods: ['GET'],
    allowedHeaders: ['Content-Type']
}), express.static(path.join(__dirname, '../Uploads'))); // Asegúrate que esta ruta es correcta para tu carpeta Uploads


// --- RUTAS API ---
logger.info('Registrando rutas API');
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/customer-orders', ordersRoutes(io));// Pasa la instancia 'io' a ordersRoutes
app.use('/api/stats', statsRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/proveedores', providerRoutes);
app.use('/api/newsletter', newsletterRoutes);
app.use('/api/config', configRoutes);


// --- CORRECCIÓN 4: Middleware de Autenticación de Socket.IO (Reintroducido) ---
// --- CORRECCIÓN 4: Middleware de Autenticación de Socket.IO (TEMPORALMENTE DESACTIVADO PARA DEPURACIÓN) ---
io.use((socket, next) => {
    // Estas dos líneas de abajo anulan toda la lógica de autenticación.
    // ¡Las usaremos para verificar si el 400 Bad Request viene de aquí!
    next(); // Permite la conexión del WebSocket sin importar el token.
    return; // Detiene la ejecución de este middleware aquí.

    // ********************************************************************************
    // TODO EL CÓDIGO DE VALIDACIÓN DE TOKEN DEBE ESTAR COMENTADO O REMOVIDO TEMPORALMENTE
    // (o el 'next(); return;' debe estar al principio del bloque)
    // ********************************************************************************

    // const token = socket.handshake.auth.token;
    // logger.info(`Intentando autenticar WebSocket con token: ${token ? 'presente' : 'no proporcionado'}`);
    // if (!token) {
    //     logger.error('No se proporcionó token para WebSocket');
    //     return next(new Error('Autenticación requerida'));
    // }
    // try {
    //     const decoded = jwt.verify(token, process.env.JWT_SECRET);
    //     socket.user = decoded;
    //     logger.info(`Token válido para WebSocket, id: ${decoded.id}, email: ${decoded.email}`);
    //     // next(); // Ya lo tenemos al principio del bloque
    // } catch (error) {
    //     logger.error(`Error verificando token WebSocket: ${error.message}`);
    //     return next(new Error('Token inválido o expirado. Por favor, vuelva a iniciar sesión.'));
    // }
});

// --- MANEJO DE EVENTOS SOCKET.IO ---
io.on('connection', (socket) => {
    logger.info(`Cliente conectado: ${socket.id}, usuario: ${socket.user?.email || 'desconocido'}`);

    socket.on('disconnect', () => {
        logger.info(`Cliente desconectado: ${socket.id}, usuario: ${socket.user?.email || 'desconocido'}`);
    });

    // Escucha eventos de productos y los emite a todos los clientes conectados
    socket.on('productUpdated', (data) => {
        logger.info(`Evento 'productUpdated' recibido desde ${socket.user?.email || 'desconocido'}. Emitiendo a todos.`);
        io.emit('productUpdated', data);
    });
    socket.on('productDeleted', (data) => { // Asegúrate de tener este evento en el frontend si lo usas
        logger.info(`Evento 'productDeleted' recibido desde ${socket.user?.email || 'desconocido'}. Emitiendo a todos.`);
        io.emit('productDeleted', data);
    });

    // Lógica para pedidos en tiempo real
    socket.on('newOrder', (order) => {
        logger.info(`Nuevo pedido recibido vía Socket desde ${socket.user?.email || 'desconocido'}. ID: ${order.id}`);
        io.emit('newOrder', { order }); // Reenvía el pedido a todos los clientes
    });
});

app.set('io', io); // Permite que otros módulos accedan a la instancia de Socket.IO


// --- MANEJO DE ERRORES Y RUTAS NO ENCONTRADAS ---
// Manejo de rutas no encontradas (404)
app.use((req, res, next) => {
    logger.warn(`Ruta no encontrada: ${req.originalUrl}`);
    res.status(404).json({ error: 'Ruta no encontrada' });
});

// Middleware para manejar errores no capturados
app.use((err, req, res, next) => {
    logger.error(`Error no manejado: ${err.message}, stack: ${err.stack}`);
    // No uses console.log para errores en producción, usa solo logger
    // console.log(`Error no manejado: ${err.message}, stack: ${err.stack}`);
    res.status(err.status || 500).json({ error: 'Error interno del servidor', message: err.message });
});


// --- INICIO DEL SERVIDOR ---
const PORT = process.env.PORT || 3000;
initializeDatabase().then(() => {
    server.listen(PORT, () => {
        logger.info(`Servidor corriendo en http://localhost:${PORT}`);
    });
}).catch((err) => {
    logger.error('Error al inicializar la base de datos:', err);
    process.exit(1);
});