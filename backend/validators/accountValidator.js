const { body } = require('express-validator');

const accountValidator = [
  body('account_name').trim().notEmpty().withMessage('Account name is required'),
  body('account_type').trim().notEmpty().withMessage('Account type is required')
    .isIn(['bank', 'wallet', 'broker', 'cash', 'credit', 'other']).withMessage('Invalid account type'),
  body('balance').optional().isNumeric().withMessage('Balance must be a number'),
  body('credit_limit').optional().isNumeric().withMessage('Credit limit must be a number'),
  body('billing_cycle_start_day').optional().isInt({ min: 1, max: 31 }).withMessage('Billing cycle start must be 1-31'),
  body('due_days_after').optional().isInt({ min: 1 }).withMessage('Due days must be positive'),
];

const accountUpdateValidator = [
  body('account_name').optional().trim().notEmpty().withMessage('Account name cannot be empty'),
  body('account_type').optional().trim()
    .isIn(['bank', 'wallet', 'broker', 'cash', 'credit', 'other']).withMessage('Invalid account type'),
  body('balance').optional().isNumeric().withMessage('Balance must be a number'),
  body('credit_limit').optional().isNumeric().withMessage('Credit limit must be a number'),
  body('billing_cycle_start_day').optional().isInt({ min: 1, max: 31 }).withMessage('Billing cycle start must be 1-31'),
  body('due_days_after').optional().isInt({ min: 1 }).withMessage('Due days must be positive'),
];

module.exports = { accountValidator, accountUpdateValidator };
