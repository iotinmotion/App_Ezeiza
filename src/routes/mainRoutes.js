const express = require('express');
const router = express.Router();
const { getDb, getClient } = require('../db/connection');
const { processCartData, calculateZonesMetrics } = require('../utils/dashboardHelpers');

// Middleware de protección de rutas
const requireAuth = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/');

    }
    next();
};

router.use(requireAuth);

router.get('/', async (req, res) => {
    const db = getDb();
    const client = getClient();
    let cartDetails = [];
    let zones = []; // Inicializar vacío por defecto

    try {
        const userApp = req.session.user.app;
        // Conexión a la base de datos NewIoT y colección específica
        const dbNewIoT = client.db('Ezeiza');

        const cardsCollection = db.collection('cards_status');
        console.log(req.session.user)
        // Agregación: Filtrar por app y sumar senseValue_m
        if (userApp) {
            // Obtener detalles individuales para la cuadrícula
            const rawData = await cardsCollection.find({ app: userApp }).toArray();
            cartDetails = processCartData(rawData);
            zones = calculateZonesMetrics(cartDetails);
        }
    } catch (error) {
        console.error("Error consultando Ezeiza:", error);
    }

    console.log("Valor de cartDetails:", cartDetails); // Imprime el valor de cartDetails
    res.render('dashboard', { user: req.session.user, zones, cartDetails });
});

module.exports = router;