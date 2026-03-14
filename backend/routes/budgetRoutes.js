const express = require('express');
const router = express.Router();
const budgetController = require('../controllers/budgetController');
const authMiddleware = require('../middlewares/authMiddleware');
const validate = require('../middlewares/validate');
const { budgetValidator } = require('../validators/budgetValidator');

router.use(authMiddleware);

router.get('/', budgetController.getAll);
router.post('/', validate(budgetValidator), budgetController.create);

module.exports = router;
