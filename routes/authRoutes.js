const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');
const requireRole = require('../middleware/requireRole');

router.post('/login', authController.login);

// Registration is HRD-only (audit fix a): no self-assigned privileged roles
router.post('/register', authMiddleware, requireRole('hrd'), authController.register);

router.get('/karyawan', authMiddleware, userController.getAllUsers);
router.get('/users', authMiddleware, requireRole('hrd', 'supervisor'), authController.getAllUsers);

module.exports = router;
