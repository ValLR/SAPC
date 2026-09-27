// =====================================================================
//  S.A.P.C. — CHAWAL  |  Rutas de Reportería / Métricas
//  Archivo: backend/src/routes/reports.routes.js
//  Historia: US-15 (SCRUM-23)
// =====================================================================

const express = require('express');
const { obtenerOcupacion } = require('../controllers/reports.controller');
const { verifyToken, requireRole } = require('../middlewares/auth.middleware');
const { ROLES } = require('../utils/roles');

const router = express.Router();

// Endpoint de información de rutas disponibles.
// ⚠️ Debe declararse ANTES de cualquier '/:param' (convención del repo) y
// exige token (US-03).
router.get('/info', verifyToken, (req, res) => {
  res.json({
    message: 'Reportes API Routes - SAPC Chawal',
    endpoints: {
      ocupacion: 'GET /api/reports/ocupacion?desde=YYYY-MM-DD&hasta=YYYY-MM-DD'
    },
    version: '1.0.0',
    user_story: 'US-15 (SCRUM-23)'
  });
});

/**
 * @route  GET /api/reports/ocupacion
 * @desc   Métricas consolidadas de demanda: citas por especialista (con
 *         desglose por estado) y porcentaje de ocupación de los talleres.
 *         Dos consultas agregadas (COUNT + GROUP BY), de solo lectura.
 * @access Privado — ADMINISTRADOR. El Escenario 2 del AC exige 403 para
 *         cualquier rol sin privilegios administrativos.
 * @query  desde, hasta (opcionales, YYYY-MM-DD)
 * @returns 200 OK | 400 filtros inválidos | 401 / 403 (US-03)
 */
router.get('/ocupacion', verifyToken, requireRole(ROLES.ADMINISTRADOR), obtenerOcupacion);

module.exports = router;
