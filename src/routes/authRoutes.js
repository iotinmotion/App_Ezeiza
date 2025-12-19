const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { getDb } = require('../db/connection');

// Función auxiliar para Auditoría
async function logAudit(action, user, details) {
    const db = getDb();
    await db.collection('audit_logs').insertOne({
        action,
        user,
        details,
        timestamp: new Date()
    });
}

// GET: Login Page
router.get('/', (req, res) => {
    if (req.session.user) {
        return res.redirect('/dashboard');
    }
    res.render('login', { error: null });
});

// POST: Login Process
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const db = getDb();

    try {
        const user = await db.collection('users').findOne({ username });

        if (user && await bcrypt.compare(password, user.password)) {
            // Crear sesión
            req.session.user = {
                id: user._id,
                username: user.username,
                role: user.role,
                app: user.app || 15 // Usa 15 como fallback si no tiene app definida
            };

            // Log de auditoría
            await logAudit('LOGIN_SUCCESS', username, 'Usuario inició sesión correctamente');

            return res.redirect('/dashboard');
        } else {
            await logAudit('LOGIN_FAILED', username, 'Intento de inicio de sesión fallido');
            return res.render('login', { error: 'Credenciales inválidas' });
        }
    } catch (err) {
        console.error(err);
        res.render('login', { error: 'Error del servidor' });
    }
});

// GET: Logout
router.get('/logout', async (req, res) => {
    if (req.session.user) {
        await logAudit('LOGOUT', req.session.user.username, 'Usuario cerró sesión');
    }
    req.session.destroy();
    res.redirect('/');
});

// Función para crear usuario admin por defecto
const createDefaultAdmin = async () => {
    const db = getDb();
    const username = 'admin';
    try {
        const existing = await db.collection('users').findOne({ username });
        if (!existing) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            await db.collection('users').insertOne({
                username: 'admin',
                password: hashedPassword,
                role: 'administrador',
                fullName: 'Admin Ezeiza',
                photoUrl: 'https://ui-avatars.com/api/?name=Admin+Ezeiza&background=4bc2c5&color=fff',
                app: 15 // Valor por defecto solicitado
            });
            console.log('Usuario administrador creado: admin / admin123');
        }
    } catch (e) { console.error('Error creando usuario default:', e); }
};

module.exports = { router, createDefaultAdmin };