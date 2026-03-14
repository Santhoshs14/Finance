const { body } = require('express-validator');

const lendingValidator = [
  body('person_name').trim().notEmpty().withMessage('Person name is required'),
  body('amount').notEmpty().withMessage('Amount is required').isNumeric(),
  body('type').notEmpty().withMessage('Type is required')
    .isIn(['lent', 'borrowed']).withMessage('Type must be lent or borrowed'),
  body('status').optional().isIn(['pending', 'repaid']).withMessage('Status must be pending or repaid'),
  body('date').notEmpty().withMessage('Date is required').isISO8601(),
];

module.exports = { lendingValidator };
