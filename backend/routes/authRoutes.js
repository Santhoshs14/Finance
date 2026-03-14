const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const validate = require('../middlewares/validate');
const authMiddleware = require('../middlewares/authMiddleware');
const { loginValidator, updateProfileValidator } = require('../validators/authValidator');

// POST /auth/login
router.post('/login', validate(loginValidator), authController.login);

// POST /auth/register
router.post('/register', validate(loginValidator), authController.register);

// PUT /auth/profile
router.put('/profile', authMiddleware, validate(updateProfileValidator), authController.updateProfile);

// GET /auth/profile/stats
router.get('/profile/stats', authMiddleware, authController.getProfileStats);

module.exports = router;
