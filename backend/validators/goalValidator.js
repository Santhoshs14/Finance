const { body } = require('express-validator');

const goalValidator = [
  body('goal_name').trim().notEmpty().withMessage('Goal name is required'),
  body('target_amount').notEmpty().withMessage('Target amount is required').isNumeric(),
  body('current_amount').optional().isNumeric(),
  body('deadline').notEmpty().withMessage('Deadline is required').isISO8601(),
];

module.exports = { goalValidator };
