const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const session = require('express-session');
const morgan = require('morgan'); // Middleware para logs HTTP
const helmet = require('helmet');
const { connectToDb, getDb } = require('./src/db/connection');
const { processCartData, calculateZonesMetrics } = require('./src/utils/dashboardHelpers');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
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
            connectSrc: ["'self'", "ws:", "wss:"]
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

// 5. Configuración de WebSockets
io.on('connection', (socket) => {
    console.log('Cliente conectado via WebSocket');
    let interval;
    let changeStream;

    // Escuchar solicitud de inicio de datos
    socket.on('request_dashboard_data', async (userApp) => {
        // Asegurar que el ID sea un número para coincidir con el tipo de dato en MongoDB
        const appId = parseInt(userApp);

        const sendData = async () => {
            try {
                const db = getDb();
                if (!db) return;
                
                const cardsCollection = db.collection('cards_status');
                if (appId) {
                    const rawData = await cardsCollection.find({ app: appId }).toArray();
                    const cartDetails = processCartData(rawData);

                    const zones = calculateZonesMetrics(cartDetails);
                    socket.emit('dashboard_update', { zones, cartDetails, rawData });
                }
            } catch (error) {
                console.error("Socket Error:", error);
            }

        };


        // Enviar datos inmediatamente y luego cada 10 segundos
        await sendData();
        
        // Intentar usar Change Streams para actualizaciones en tiempo real
        try {
            const db = getDb();
            const cardsCollection = db.collection('cards_status');
            
            if (changeStream) await changeStream.close();
            
            changeStream = cardsCollection.watch();
            changeStream.on('change', async () => {
                await sendData();
            });

            // Manejar errores de Change Stream (ej. MongoDB Standalone)
            changeStream.on('error', (err) => {
                console.error("ChangeStream error (fallback a polling):", err.message);
                if (changeStream) changeStream.close().catch(() => {});
                
                if (!interval) {
                    interval = setInterval(sendData, 10000);
                }
            });
        } catch (error) {
            // Fallback a Polling si no hay soporte para Change Streams
            if (interval) clearInterval(interval);
            interval = setInterval(sendData, 10000);
        }
    });


    socket.on('disconnect', async () => {
        if (interval) clearInterval(interval);
        if (changeStream) await changeStream.close();
    });
});


// 4. Inicialización
connectToDb(async (err) => {
    if (!err) {
        await createDefaultAdmin();

        server.listen(PORT, () => {
            console.log(`Servidor corriendo en http://localhost:${PORT}`);

        });
    } else {
        console.error("Fallo al iniciar la base de datos");
        process.exit(1); // Termina el proceso si no hay DB
    }
});