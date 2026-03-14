const express = require('express');
const router = express.Router();
const lendingController = require('../controllers/lendingController');
const authMiddleware = require('../middlewares/authMiddleware');
const validate = require('../middlewares/validate');
const { lendingValidator } = require('../validators/lendingValidator');

router.use(authMiddleware);

router.get('/', lendingController.getAll);
router.post('/', validate(lendingValidator), lendingController.create);
router.post('/:id/repay', lendingController.repay);

module.exports = router;
