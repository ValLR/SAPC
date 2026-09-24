// =====================================================================
//  S.A.P.C. — CHAWAL  |  Rutas de Terapeutas
//  Archivo: backend/src/routes/terapeutas.routes.js
// =====================================================================

const express = require('express');
const {
  crearTerapeuta,
  listarTerapeutas,
  actualizarTerapeuta
} = require('../controllers/terapeutas.controller');
const { verifyToken, requireRole } = require('../middlewares/auth.middleware');
const { ROLES } = require('../utils/roles');

const router = express.Router();

// Endpoint de información de rutas disponibles.
// ⚠️ Debe declararse ANTES de cualquier '/:param' para que 'info' no sea
//    interpretado como un id de profesional (misma convención que
//    agendas.routes.js y clases.routes.js).
// US-03: exige token — expone el inventario de endpoints del módulo.
router.get('/info', verifyToken, (req, res) => {
  res.json({
    message: 'Terapeutas API Routes - SAPC Chawal',
    endpoints: {
      crear: 'POST /api/terapeutas',
      listar: 'GET /api/terapeutas',
      actualizar: 'PUT /api/terapeutas/:id_profesional'
    },
    version: '1.0.0',
    user_story: 'US-13 (SCRUM-21)'
  });
});

/**
 * @route  POST /api/terapeutas
 * @desc   Alta de un nuevo especialista
 * @access Privado — ADMINISTRADOR
 */
router.post('/', verifyToken, requireRole(ROLES.ADMINISTRADOR), crearTerapeuta);

/**
 * @route  GET /api/terapeutas
 * @desc   Consulta del catálogo de terapeutas
 * @access Privado — cualquier rol autenticado
 */
router.get('/', verifyToken, listarTerapeutas);

/**
 * @route  PUT /api/terapeutas/:id_profesional
 * @desc   Actualización de datos de un terapeuta
 * @access Privado — ADMINISTRADOR
 */
router.put('/:id_profesional', verifyToken, requireRole(ROLES.ADMINISTRADOR), actualizarTerapeuta);

module.exports = router;
