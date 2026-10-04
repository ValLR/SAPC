// =====================================================================
//  S.A.P.C. — CHAWAL  |  Group Classes & Capacity Routes
//  File: backend/src/routes/classesRoutes.js
// =====================================================================

const express = require('express');
const { getClasses, reserveClass } = require('../controllers/classesController');
const { verifyToken, requireRole } = require('../middlewares/auth.middleware');
const { ROLES } = require('../utils/roles');

const router = express.Router();

/**
 * @route  GET /api/classes
 * @desc   Get catalog of group classes and capacity status
 * @access Private - Authenticated Users
 */
router.get('/', verifyToken, getClasses);

/**
 * @route  POST /api/classes/:id_class/reserve
 * @desc   Enroll the authenticated patient in a group class
 * @access Private - Solo PACIENTE
 *         [R1] La inscripción pertenece a un paciente, no a un usuario
 *         cualquiera; por eso se restringe el rol antes de tocar la BD.
 */
router.post('/:id_class/reserve', verifyToken, requireRole(ROLES.PACIENTE), reserveClass);

module.exports = router;
