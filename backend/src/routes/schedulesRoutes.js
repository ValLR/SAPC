const express = require('express');
const { getSchedules, publishSchedule } = require('../controllers/schedulesController');
const { verifyToken } = require('../middlewares/auth.middleware');

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
 * @access Private - Authenticated Users (Admin/Therapist)
 */
router.post('/publish', verifyToken, publishSchedule);

module.exports = router;
