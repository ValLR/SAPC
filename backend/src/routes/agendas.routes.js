// =====================================================================
//  S.A.P.C. — CHAWAL  |  Rutas de Agendas / Bloques Horarios
//  Archivo: backend/src/routes/agendas.routes.js
//  Historia: US-07 (SCRUM-6)  |  RBAC: US-03 (SCRUM-11)
// =====================================================================

const express = require('express');
const {
  consultarDisponibilidad,
  generarBloques
} = require('../controllers/agendas.controller');
const { verifyToken, requireRole } = require('../middlewares/auth.middleware');
const { ROLES } = require('../utils/roles');

const router = express.Router();

// Endpoint de información de rutas disponibles.
// ⚠️ Debe declararse ANTES de '/:terapeutaId' para que 'info' no sea
//    interpretado como un id de terapeuta.
// US-03: /info expone el inventario de endpoints del módulo, por lo que
//        también exige token (antes era la única ruta pública del módulo).
router.get('/info', verifyToken, (req, res) => {
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
router.post('/', verifyToken, requireRole(ROLES.ADMINISTRADOR), generarBloques);

module.exports = router;
