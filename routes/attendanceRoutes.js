const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const authMiddleware = require('../middleware/authMiddleware');

// Route Absen Masuk
router.post('/clock-in', authMiddleware, attendanceController.clockIn);

// Route Absen Pulang
router.post('/clock-out', authMiddleware, attendanceController.clockOut);

// Route Ambil Riwayat Absen
router.get('/history', authMiddleware, attendanceController.getHistory);

module.exports = router;