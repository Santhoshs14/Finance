const express = require('express');
const router = express.Router();
const investmentController = require('../controllers/investmentController');
const authMiddleware = require('../middlewares/authMiddleware');
const validate = require('../middlewares/validate');
const { investmentValidator } = require('../validators/investmentValidator');

router.use(authMiddleware);

router.get('/', investmentController.getAll);
router.post('/', validate(investmentValidator), investmentController.create);
router.post('/sync', investmentController.sync);

module.exports = router;
