const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const authMiddleware = require('../middleware/authMiddleware');
const requireRole = require('../middleware/requireRole');

// Geofence master data is authenticated (audit fix b)
router.get('/', authMiddleware, settingsController.getSettings);
router.put('/', authMiddleware, requireRole('hrd'), settingsController.updateSettings);

module.exports = router;
