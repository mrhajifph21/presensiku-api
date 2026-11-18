const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const authMiddleware = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');

router.get('/',        authMiddleware, attendanceController.getAttendances);
router.get('/all',     authMiddleware, attendanceController.getAttendances);
router.get('/history', authMiddleware, attendanceController.getHistory);

router.post('/clock-in',  authMiddleware, upload.single('selfie'), attendanceController.clockIn);
router.post('/clock-out', authMiddleware, attendanceController.clockOut);

module.exports = router;