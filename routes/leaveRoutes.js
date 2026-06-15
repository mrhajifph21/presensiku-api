    const express = require('express');
const router = express.Router();
const leaveController = require('../controllers/leaveController');
const authMiddleware = require('../middleware/authMiddleware');

// URL: http://localhost:3000/api/leaves/submit
router.post('/submit', authMiddleware, leaveController.submitLeave);

// URL: http://localhost:3000/api/leaves/history
router.get('/history', authMiddleware, leaveController.getLeaveHistory);

// URL: http://localhost:3000/api/leaves/all-pending (KHUSUS HRD)
router.get('/all-pending', authMiddleware, leaveController.getAllPendingLeaves);

// URL: http://localhost:3000/api/leaves/:id/status (KHUSUS HRD)
router.put('/:id/status', authMiddleware, leaveController.updateLeaveStatus);

module.exports = router;