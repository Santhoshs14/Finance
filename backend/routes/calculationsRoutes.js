const express = require('express');
const router = express.Router();
const calculationsController = require('../controllers/calculationsController');
const authMiddleware = require('../middlewares/authMiddleware');

router.use(authMiddleware);

router.get('/', calculationsController.getCalculations);
router.get('/snapshots', calculationsController.getSnapshots);

module.exports = router;
