const express = require('express');
const router = express.Router();
const { getDb } = require('../db/connection');
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
    let cartDetails = [];
    let zones = []; // Inicializar vacío por defecto
    let rawData = [];

    try {
        const userApp = req.session.user.app;
        const cardsCollection = db.collection('cards_status');
        
        // Agregación: Filtrar por app y sumar senseValue_m
        if (userApp) {
            // Obtener detalles individuales para la cuadrícula
            rawData = await cardsCollection.find({ app: userApp }).toArray();
            cartDetails = processCartData(rawData);
            zones = calculateZonesMetrics(cartDetails);
        }
    } catch (error) {
        console.error("Error consultando Ezeiza:", error);
    }

    res.render('dashboard', { user: req.session.user, zones, cartDetails, rawData });
});

router.get('/maps', async (req, res) => {
    const db = getDb();
    let zones = [];
    let cartDetails = [];
    
    try {
        const userApp = req.session.user.app;
        const cardsCollection = db.collection('cards_status');
        
        if (userApp) {
            // Reutilizamos la lógica para obtener solo los datos de las zonas (cards-grid)
            const rawData = await cardsCollection.find({ app: userApp }).toArray();
            cartDetails = processCartData(rawData);
            zones = calculateZonesMetrics(cartDetails);
        }
    } catch (error) {
        console.error("Error consultando Ezeiza (Maps):", error);
    }

    res.render('maps', { user: req.session.user, zones, cartDetails });
});

module.exports = router;