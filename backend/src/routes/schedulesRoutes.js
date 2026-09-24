const express = require('express');
const { getSchedules, publishSchedule } = require('../controllers/schedulesController');
const { verifyToken, requireRole } = require('../middlewares/auth.middleware');

const router = express.Router();

/**
 * @route  GET /api/schedules
 * @desc   Get working schedules and time slot configuration
 * @access Private - Authenticated Users
 */
router.get('/', verifyToken, getSchedules);

/**
 * @route  POST /api/schedules/publish
 * @desc   Publish weekly working schedule slots
 * @access Private - ADMINISTRADOR o TERAPEUTA
 */
router.post('/publish', verifyToken, requireRole('ADMINISTRADOR', 'TERAPEUTA'), publishSchedule);

module.exports = router;
