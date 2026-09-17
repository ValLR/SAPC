// =====================================================================
//  S.A.P.C. — CHAWAL  |  Rutas de Especialidades (catálogo)
//  Archivo: backend/src/routes/especialidades.routes.js
// =====================================================================

const express = require('express');
const { listarEspecialidades } = require('../controllers/especialidades.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

const router = express.Router();

/**
 * @route  GET /api/especialidades
 * @desc   Catálogo de especialidades (para el formulario de terapeutas)
 * @access Privado — cualquier rol autenticado
 */
router.get('/', verifyToken, listarEspecialidades);

module.exports = router;
