const express = require('express');
const router = express.Router();
const creditCardController = require('../controllers/creditCardController');
const authMiddleware = require('../middlewares/authMiddleware');
const validate = require('../middlewares/validate');
const { creditCardValidator, ccTransactionValidator } = require('../validators/creditCardValidator');

router.use(authMiddleware);

// Credit Cards
router.get('/', creditCardController.getAllCards);
router.post('/', validate(creditCardValidator), creditCardController.createCard);

// Credit Card Transactions
router.get('/transactions', creditCardController.getAllTransactions);
router.post('/transactions', validate(ccTransactionValidator), creditCardController.createTransaction);

module.exports = router;
