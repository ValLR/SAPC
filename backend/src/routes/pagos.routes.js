// =====================================================================
//  S.A.P.C. — CHAWAL  |  Rutas de Pagos
//  Archivo: backend/src/routes/pagos.routes.js
//  Ticket: FIX-02 (Refix US-16)
// =====================================================================

const express = require('express');
const { simularPago, METODOS_ACEPTADOS } = require('../controllers/pagos.controller');
const { verifyToken, requireRole } = require('../middlewares/auth.middleware');
const { ROLES } = require('../utils/roles');

const router = express.Router();

// Endpoint de información de rutas disponibles.
// ⚠️ Debe declararse ANTES de cualquier '/:param' (convención del repo) y
// exige token (US-03).
router.get('/info', verifyToken, (req, res) => {
  res.json({
    message: 'Pagos API Routes - SAPC Chawal',
    endpoints: {
      simular: 'POST /api/pagos/simular'
    },
    metodos_aceptados: METODOS_ACEPTADOS,
    version: '1.0.0',
    user_story: 'FIX-02 (Refix US-16)'
  });
});

/**
 * @route  POST /api/pagos/simular
 * @desc   Simula la transacción de pago de una cita y devuelve un código de
 *         referencia ficticio. NO persiste nada en `pagos` (ver el
 *         controlador) y no consulta la base de datos.
 * @access Privado — PACIENTE. El AC exige validar el token del paciente;
 *         cualquier otro rol recibe 403 (US-03).
 * @body   { citaId|id_cita, monto, metodoPago|metodo_pago }
 * @returns 200 OK | 400 VALIDATION_ERROR | 401 / 403 (US-03)
 */
router.post('/simular', verifyToken, requireRole(ROLES.PACIENTE), simularPago);

module.exports = router;
