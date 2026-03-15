const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');
const authMiddleware = require('../middlewares/authMiddleware');
const validate = require('../middlewares/validate');
const { transactionValidator, transactionUpdateValidator } = require('../validators/transactionValidator');

router.use(authMiddleware);

router.get('/', transactionController.getAll);
router.get('/:id', transactionController.getById);
router.post('/', validate(transactionValidator), transactionController.create);
router.put('/:id', validate(transactionUpdateValidator), transactionController.update);
router.delete('/', transactionController.removeAll);
router.delete('/:id', transactionController.remove);

module.exports = router;
