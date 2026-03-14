const { body } = require('express-validator');

const budgetValidator = [
  body('category').trim().notEmpty().withMessage('Category is required'),
  body('monthly_limit').notEmpty().withMessage('Monthly limit is required')
    .isNumeric().withMessage('Monthly limit must be a number')
    .custom((val) => val > 0).withMessage('Monthly limit must be positive'),
];

module.exports = { budgetValidator };
