const express = require('express');
const path = require('path');
const session = require('express-session');
const morgan = require('morgan'); // Middleware para logs HTTP
const helmet = require('helmet');
const { connectToDb } = require('./src/db/connection');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// 1. Configuración de Motor de Plantillas
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src/views'));

// 2. Middlewares
// Seguridad (Helmet)
app.use(helmet());

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
    cookie: { secure: false } // true si usas HTTPS
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

// 4. Inicialización
connectToDb(async (err) => {
    if (!err) {
        await createDefaultAdmin();
        app.listen(PORT, () => {
            console.log(`Servidor corriendo en http://localhost:${PORT}`);
        });
    } else {
        console.error("Fallo al iniciar la base de datos");
    }
});