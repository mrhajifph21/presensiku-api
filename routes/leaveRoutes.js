const express = require('express');
const router = express.Router();
const leaveController = require('../controllers/leaveController');

// PERBAIKAN: Hilangkan kurung kurawal {} karena middleware diexport secara langsung
const verifyToken = require('../middleware/authMiddleware'); 

// 1. Ambil riwayat cuti spesifik user (WAJIB ditaruh di atas route /:id)
router.get('/history', verifyToken, leaveController.getMyLeaves);

// 2. Ambil semua data cuti untuk Web (HRD / Supervisor)
router.get('/', verifyToken, leaveController.getLeaves);

// 3. Kirim pengajuan cuti baru dari HP
router.post('/', verifyToken, leaveController.createLeave);

// 4. Update status cuti (Approve / Reject oleh Supervisor)
router.put('/:id', verifyToken, leaveController.updateLeaveStatus);

module.exports = router;