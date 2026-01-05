const express = require('express');
const http = require('http');
const https = require('https');
const fs = require('fs');
const { Server } = require('socket.io');
const path = require('path');
const session = require('express-session');
const morgan = require('morgan'); // Middleware para logs HTTP
const helmet = require('helmet');
const { connectToDb, getDb } = require('./src/db/connection');
const { processCartData, calculateZonesMetrics } = require('./src/utils/dashboardHelpers');
require('dotenv').config();

const app = express();

let server;
// Verificar si existen rutas de certificados SSL en las variables de entorno
if (process.env.SSL_KEY_PATH && process.env.SSL_CERT_PATH) {
    const httpsOptions = {
        key: fs.readFileSync(process.env.SSL_KEY_PATH),
        cert: fs.readFileSync(process.env.SSL_CERT_PATH)
    };
    server = https.createServer(httpsOptions, app);
} else {
    server = http.createServer(app);
}

const io = new Server(server);
const PORT = process.env.PORT || 3000;

// 1. Configuración de Motor de Plantillas
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src/views'));

// 2. Middlewares
// Si la app está detrás de un proxy (ej. Heroku, Nginx), confía en el primer proxy
app.set('trust proxy', 1);

// Seguridad (Helmet)
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com"],
            imgSrc: ["'self'", "data:", "https://tile.openstreetmap.org", "https://unpkg.com", "https://*.openstreetmap.org"],
            connectSrc: ["'self'", "ws:", "wss:", "https://unpkg.com"],
            upgradeInsecureRequests: null
        }
    }
}));

// Archivos estáticos (CSS, JS, Imágenes)
app.use(express.static(path.join(__dirname, 'src', 'views', 'publics')));

// Parseo de body
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// RESPUESTA A TU PREGUNTA: Middleware para registrar peticiones HTTP
// 'dev' muestra: :method :url :status :response-time ms
app.use(morgan('dev'));

// Configuración de Sesión
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production', // true solo en producción
        httpOnly: true // Ayuda a prevenir ataques XSS
    }
}));

// 3. Rutas
const { router: authRoutes, createDefaultAdmin } = require('./src/routes/authRoutes');
const mainRoutes = require('./src/routes/mainRoutes');

app.use('/', authRoutes);
app.use('/dashboard', mainRoutes);

// Manejo de rutas no encontradas (404)
app.use((req, res, next) => {
    res.status(404).send('Lo sentimos, no pudimos encontrar esa página.');
});

// Manejo de errores globales (500)
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('¡Algo salió mal en el servidor!');
});

// Lógica de Watcher Global para MongoDB
let globalChangeStream;
let globalPollingInterval;

const updateAllClients = async () => {
    const db = getDb();
    if (!db) return;
    
    const cardsCollection = db.collection('cards_status');
    // Obtener salas activas que correspondan a apps (formato 'app_ID')
    const rooms = io.sockets.adapter.rooms;
    const activeAppIds = new Set();

    if (rooms) {
        for (const [room, _] of rooms) {
            if (room.startsWith('app_')) {
                const id = parseInt(room.split('_')[1]);
                if (!isNaN(id)) activeAppIds.add(id);
            }
        }
    }

    for (const appId of activeAppIds) {
        try {
            const rawData = await cardsCollection.find({ app: appId }).toArray();
            const cartDetails = processCartData(rawData);
            const zones = calculateZonesMetrics(cartDetails);
            io.to(`app_${appId}`).emit('dashboard_update', { zones, cartDetails, rawData });
        } catch (error) {
            console.error(`Error actualizando app ${appId}:`, error);
        }
    }
};

const startPollingFallback = () => {
    if (globalPollingInterval) return;
    console.log("Iniciando Polling Global (10s)");
    globalPollingInterval = setInterval(updateAllClients, 10000);
};

const startGlobalWatcher = () => {
    const db = getDb();
    if (!db) return;
    
    try {
        const cardsCollection = db.collection('cards_status');
        
        if (globalChangeStream) globalChangeStream.close().catch(() => {});
        
        globalChangeStream = cardsCollection.watch();
        console.log("Global Change Stream iniciado");

        globalChangeStream.on('change', () => {
            updateAllClients();
        });

        globalChangeStream.on('error', (err) => {
            console.error("ChangeStream error (fallback a polling):", err.message);
            if (globalChangeStream) globalChangeStream.close().catch(() => {});
            startPollingFallback();
        });
        
        if (globalPollingInterval) {
            clearInterval(globalPollingInterval);
            globalPollingInterval = null;
        }

    } catch (error) {
        console.error("No se pudo iniciar ChangeStream:", error.message);
        startPollingFallback();
    }
};

// 5. Configuración de WebSockets
io.on('connection', (socket) => {
    console.log('Cliente conectado via WebSocket');

    // Escuchar solicitud de inicio de datos
    socket.on('request_dashboard_data', async (userApp) => {
        // Asegurar que el ID sea un número para coincidir con el tipo de dato en MongoDB
        const appId = parseInt(userApp);
        if (!appId) return;

        // Unirse a la sala específica de la app para recibir actualizaciones globales
        socket.join(`app_${appId}`);

        // Enviar datos iniciales inmediatamente
        try {
            const db = getDb();
            if (db) {
                const cardsCollection = db.collection('cards_status');
                const rawData = await cardsCollection.find({ app: appId }).toArray();
                const cartDetails = processCartData(rawData);
                const zones = calculateZonesMetrics(cartDetails);
                socket.emit('dashboard_update', { zones, cartDetails, rawData });
            }
        } catch (error) {
            console.error("Socket Error (Initial Data):", error);
        }
    });

    socket.on('disconnect', () => {
        // Socket.io maneja la salida de salas automáticamente
    });
});


// 4. Inicialización
connectToDb(async (err) => {
    if (!err) {
        await createDefaultAdmin();

        // Iniciar el watcher global de MongoDB
        startGlobalWatcher();

        server.listen(PORT, () => {
            console.log(`Servidor corriendo en http://localhost:${PORT}`);

        });
    } else {
        console.error("Fallo al iniciar la base de datos");
        process.exit(1); // Termina el proceso si no hay DB
    }
});