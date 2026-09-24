// =====================================================================
//  S.A.P.C. — CHAWAL  |  Rutas de Clases Grupales (Talleres)
//  Archivo: backend/src/routes/clases.routes.js
//  Historia: US-11 (SCRUM-19)  |  RBAC: US-03 (SCRUM-11)
// =====================================================================

const express = require('express');
const {
  crearClase,
  listarClases,
  obtenerClase,
  actualizarClase,
  eliminarClase
} = require('../controllers/clases.controller');
const { verifyToken, requireRole } = require('../middlewares/auth.middleware');
const { ROLES } = require('../utils/roles');

const router = express.Router();

// Endpoint de información de rutas disponibles.
// ⚠️ Debe declararse ANTES de '/:id_clase' para que 'info' no sea
//    interpretado como un id de clase.
// US-03: /info expone el inventario de endpoints del módulo, por lo que
//        también exige token (antes era la única ruta pública del módulo).
router.get('/info', verifyToken, (req, res) => {
  res.json({
    message: 'Clases Grupales API Routes - SAPC Chawal',
    endpoints: {
      crear: 'POST /api/clases',
      listar: 'GET /api/clases',
      detalle: 'GET /api/clases/:id_clase',
      actualizar: 'PUT /api/clases/:id_clase',
      cancelar: 'DELETE /api/clases/:id_clase'
    },
    version: '1.0.0',
    user_story: 'US-11 (SCRUM-19)'
  });
});

/**
 * @route  POST /api/clases
 * @desc   Alta de una nueva clase grupal
 * @access Privado — ADMINISTRADOR
 */
router.post('/', verifyToken, requireRole(ROLES.ADMINISTRADOR), crearClase);

/**
 * @route  GET /api/clases
 * @desc   Listado de actividades disponibles (con filtros)
 * @access Privado — cualquier rol autenticado
 */
router.get('/', verifyToken, listarClases);

/**
 * @route  GET /api/clases/:id_clase
 * @desc   Detalle de una clase grupal
 * @access Privado — cualquier rol autenticado
 */
router.get('/:id_clase', verifyToken, obtenerClase);

/**
 * @route  PUT /api/clases/:id_clase
 * @desc   Actualización de una clase grupal
 * @access Privado — ADMINISTRADOR
 */
router.put('/:id_clase', verifyToken, requireRole(ROLES.ADMINISTRADOR), actualizarClase);

/**
 * @route  DELETE /api/clases/:id_clase
 * @desc   Baja lógica (estado_clase = CANCELADA)
 * @access Privado — ADMINISTRADOR
 */
router.delete('/:id_clase', verifyToken, requireRole(ROLES.ADMINISTRADOR), eliminarClase);

module.exports = router;
