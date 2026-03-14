const { body } = require('express-validator');

const INVESTMENT_TYPES = ['stocks', 'crypto', 'gold', 'fd', 'ppf'];

const investmentValidator = [
  body('investment_type').notEmpty().withMessage('Investment type is required')
    .isIn(INVESTMENT_TYPES).withMessage(`Must be one of: ${INVESTMENT_TYPES.join(', ')}`),
  body('name').trim().notEmpty().withMessage('Investment name is required'),
  body('quantity').notEmpty().withMessage('Quantity is required').isNumeric(),
  body('buy_price').notEmpty().withMessage('Buy price is required').isNumeric(),
  body('current_price').notEmpty().withMessage('Current price is required').isNumeric(),
];

module.exports = { investmentValidator, INVESTMENT_TYPES };
