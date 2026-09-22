// =====================================================================
//  S.A.P.C. — CHAWAL  |  Rutas de Agendas / Bloques Horarios
//  Archivo: backend/src/routes/agendas.routes.js
//  Historia: US-07 (SCRUM-6)
// =====================================================================

const express = require('express');
const {
  consultarDisponibilidad,
  generarBloques
} = require('../controllers/agendas.controller');
const { verifyToken, requireRole } = require('../middlewares/auth.middleware');

const router = express.Router();

// Endpoint de información de rutas disponibles.
// ⚠️ Debe declararse ANTES de '/:terapeutaId' para que 'info' no sea
//    interpretado como un id de terapeuta.
router.get('/info', (req, res) => {
  res.json({
    message: 'Agendas API Routes - SAPC Chawal',
    endpoints: {
      consultar: 'GET /api/agendas/:terapeutaId?fecha=YYYY-MM-DD',
      generar: 'POST /api/agendas'
    },
    version: '1.0.0',
    user_story: 'US-07 (SCRUM-6)'
  });
});

/**
 * @route  GET /api/agendas/:terapeutaId?fecha=YYYY-MM-DD
 * @desc   Consulta la disponibilidad de un terapeuta en una fecha
 * @access Privado — cualquier rol autenticado
 */
router.get('/:terapeutaId', verifyToken, consultarDisponibilidad);

/**
 * @route  POST /api/agendas
 * @desc   Generación masiva de bloques horarios (plantilla semanal)
 * @access Privado — ADMINISTRADOR
 */
router.post('/', verifyToken, requireRole('ADMINISTRADOR'), generarBloques);

module.exports = router;
