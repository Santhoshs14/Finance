const { body } = require('express-validator');

const creditCardValidator = [
  body('card_name').trim().notEmpty().withMessage('Card name is required'),
  body('credit_limit').notEmpty().withMessage('Credit limit is required').isNumeric().withMessage('Credit limit must be a number'),
  body('billing_cycle').optional().trim().isString(),
  body('due_date').optional().trim().isString(),
  body('reward_points').optional().isNumeric().withMessage('Reward points must be a number'),
];

const ccTransactionValidator = [
  body('credit_card_id').notEmpty().withMessage('Credit card ID is required'),
  body('amount').notEmpty().withMessage('Amount is required').isNumeric().withMessage('Amount must be a number'),
  body('category').optional().trim().isString(),
  body('date').notEmpty().withMessage('Date is required').isISO8601().withMessage('Invalid date format'),
  body('notes').optional().trim().isString(),
];

module.exports = { creditCardValidator, ccTransactionValidator };
