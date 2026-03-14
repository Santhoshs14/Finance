const { body } = require('express-validator');

const CATEGORIES = [
  'Investment', 'Rent', 'Home', 'Food', 'Travel', 'Petrol',
  'Entertainment', 'Shopping', 'Bills', 'Utilities', 'Subscription',
  'Lending', 'Gifts', 'Income', 'Other',
];

const PAYMENT_TYPES = ['Cash', 'Credit Card', 'Debit Card', 'UPI'];

const transactionValidator = [
  body('date').notEmpty().withMessage('Date is required').isISO8601().withMessage('Invalid date format'),
  body('amount').notEmpty().withMessage('Amount is required').isNumeric().withMessage('Amount must be a number'),
  body('category').notEmpty().withMessage('Category is required')
    .isIn(CATEGORIES).withMessage(`Category must be one of: ${CATEGORIES.join(', ')}`),
  body('payment_type').optional().trim().isIn(PAYMENT_TYPES).withMessage(`Payment type must be one of: ${PAYMENT_TYPES.join(', ')}`),
  body('account_id').optional().trim().isString(),
  body('notes').optional().trim().isString(),
];

const transactionUpdateValidator = [
  body('date').optional().isISO8601().withMessage('Invalid date format'),
  body('amount').optional().isNumeric().withMessage('Amount must be a number'),
  body('category').optional().isIn(CATEGORIES).withMessage(`Invalid category`),
  body('payment_type').optional().trim().isIn(PAYMENT_TYPES).withMessage('Invalid payment type'),
  body('account_id').optional().trim().isString(),
  body('notes').optional().trim().isString(),
];

module.exports = { transactionValidator, transactionUpdateValidator, CATEGORIES, PAYMENT_TYPES };
