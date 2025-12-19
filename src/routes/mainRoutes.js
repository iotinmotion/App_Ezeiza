const express = require('express');
const router = express.Router();
const { getDb, getClient } = require('../db/connection');

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
    let totalCarritos = 0;
    let cartDetails = [];

    try {
        // Conexión a la base de datos NewIoT y colección específica
        const dbNewIoT = client.db('NewIoT');
        const collection = dbNewIoT.collection('cart_container_distance_statuses');
        const userApp = req.session.user.app;
        console.log(req.session.user)
        // Agregación: Filtrar por app y sumar senseValue_m
        if (userApp) {
            const result = await collection.aggregate([
                { $match: { app: userApp } },
                { $group: { _id: null, total: { $sum: "$senseValue_m" } } }
            ]).toArray();

            if (result.length > 0) {
                totalCarritos = Math.floor(result[0].total); // Sin decimales
            }

            // Obtener detalles individuales para la cuadrícula
            cartDetails = await collection.find({ app: userApp }).toArray();
        }
    } catch (error) {
        console.error("Error consultando NewIoT:", error);
    }
    
    const zones = [
        { name: 'Total de Carritos', carts: totalCarritos, status: 'ok', footer_card: 'Carritos Disponibles' },
        { name: 'Promedio General', carts: 12, status: 'low', footer_card: 'Carritos Disponibles' },
        { name: 'Zonas Criticas', carts: 80, status: 'critical', footer_card: 'Carritos Disponibles' },
        { name: 'Zonas Completas', carts: 5, status: 'ok', footer_card: 'Carritos Disponibles' }
    ];

    res.render('dashboard', { user: req.session.user, zones, cartDetails });
});

module.exports = router;