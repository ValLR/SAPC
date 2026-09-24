// =====================================================================
//  S.A.P.C. — CHAWAL  |  Rutas de Citas (agendamiento transaccional)
//  Archivo: backend/src/routes/citas.routes.js
//  Historia: US-05 (SCRUM-13)
// =====================================================================

const express = require('express');
const { crearCita, cancelarCita } = require('../controllers/citas.controller');
const { verifyToken, requireRole } = require('../middlewares/auth.middleware');
const { ROLES } = require('../utils/roles');

const router = express.Router();

// Endpoint de información de rutas disponibles.
// ⚠️ Debe declararse ANTES de cualquier '/:param' (misma convención que
//    agendas.routes.js y clases.routes.js) y exige token (US-03).
router.get('/info', verifyToken, (req, res) => {
  res.json({
    message: 'Citas API Routes - SAPC Chawal',
    endpoints: {
      agendar: 'POST /api/citas',
      cancelar: 'DELETE /api/citas/:id_cita'
    },
    version: '1.0.0',
    user_story: 'US-05 (SCRUM-13)'
  });
});

/**
 * @route  POST /api/citas
 * @desc   Agenda una cita invocando el stored procedure transaccional
 *         sp_agendar_cita (bloqueo pesimista + rollback atómico).
 * @access Privado — PACIENTE (siempre para sí mismo: el id_paciente sale
 *         del JWT, nunca del body).
 * @body   { id_profesional, id_servicio, id_bloque, fecha, hora_inicio }
 * @returns 201 Created | 409 Conflict | 400/404 según la validación
 */
router.post('/', verifyToken, requireRole(ROLES.PACIENTE), crearCita);

/**
 * @route  DELETE /api/citas/:id_cita
 * @desc   Baja lógica de una cita (estado = CANCELADA). Libera el slot:
 *         la columna generada slot_activo pasa a NULL y el índice único
 *         deja de bloquear el horario.
 * @access Privado — PACIENTE (solo sus citas), TERAPEUTA (solo su agenda),
 *         ADMINISTRADOR (cualquiera). La propiedad del recurso se valida en
 *         el controlador: el rol por sí solo no basta.
 * @body   { motivo? } — texto opcional de hasta 255 caracteres
 * @returns 200 OK | 409 Conflict | 403 Forbidden | 404 Not Found
 */
router.delete(
  '/:id_cita',
  verifyToken,
  requireRole(ROLES.PACIENTE, ROLES.TERAPEUTA, ROLES.ADMINISTRADOR),
  cancelarCita
);

module.exports = router;
