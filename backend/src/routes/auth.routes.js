// Rutas de Autenticación
const express = require('express');
const { login } = require('../controllers/auth.controller');

const router = express.Router();

/**
 * @route POST /api/auth/login
 * @desc Autenticación de usuario
 * @access Public
 * @body { email: string, password: string }
 * @returns { success: boolean, token: string, user: object }
 */
router.post('/login', login);

// Endpoint de información de rutas disponibles
router.get('/', (req, res) => {
  res.json({
    message: "Auth API Routes - SAPC Chawal",
    endpoints: {
      login: "POST /api/auth/login"
    },
    version: "1.0.0",
    user_story: "US-01 (SCRUM-9)"
  });
});

module.exports = router;