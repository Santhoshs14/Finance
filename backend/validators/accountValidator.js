const { body } = require('express-validator');

const accountValidator = [
  body('account_name').trim().notEmpty().withMessage('Account name is required'),
  body('account_type').trim().notEmpty().withMessage('Account type is required')
    .isIn(['bank', 'wallet', 'broker', 'cash', 'other']).withMessage('Invalid account type'),
  body('balance').optional().isNumeric().withMessage('Balance must be a number'),
];

const accountUpdateValidator = [
  body('account_name').optional().trim().notEmpty().withMessage('Account name cannot be empty'),
  body('account_type').optional().trim()
    .isIn(['bank', 'wallet', 'broker', 'cash', 'other']).withMessage('Invalid account type'),
  body('balance').optional().isNumeric().withMessage('Balance must be a number'),
];

module.exports = { accountValidator, accountUpdateValidator };
