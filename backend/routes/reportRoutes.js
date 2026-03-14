const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const authMiddleware = require('../middlewares/authMiddleware');

router.use(authMiddleware);

router.get('/monthly', reportController.getMonthlyReport);
router.get('/yearly', reportController.getYearlyReport);

module.exports = router;
