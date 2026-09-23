// =====================================================================
//  S.A.P.C. — CHAWAL  |  Group Classes & Capacity Routes
//  File: backend/src/routes/classesRoutes.js
// =====================================================================

const express = require('express');
const { getClasses, reserveClass } = require('../controllers/classesController');
const { verifyToken } = require('../middlewares/auth.middleware');

const router = express.Router();

/**
 * @route  GET /api/classes
 * @desc   Get catalog of group classes and capacity status
 * @access Private - Authenticated Users
 */
router.get('/', verifyToken, getClasses);

/**
 * @route  POST /api/classes/:id_class/reserve
 * @desc   Reserve a slot in a group class
 * @access Private - Authenticated Users
 */
router.post('/:id_class/reserve', verifyToken, reserveClass);

module.exports = router;
