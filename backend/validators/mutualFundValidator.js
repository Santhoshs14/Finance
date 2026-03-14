const { body } = require('express-validator');

const mutualFundValidator = [
  body('fund_name').trim().notEmpty().withMessage('Fund name is required'),
  body('nav').notEmpty().withMessage('NAV is required').isNumeric(),
  body('units').notEmpty().withMessage('Units is required').isNumeric(),
  body('sip_amount').optional().isNumeric(),
  body('investment_date').notEmpty().withMessage('Investment date is required').isISO8601(),
];

const sipValidator = [
  body('fund_id').notEmpty().withMessage('Fund ID is required'),
  body('monthly_amount').notEmpty().withMessage('Monthly amount is required').isNumeric(),
  body('start_date').notEmpty().withMessage('Start date is required').isISO8601(),
];

module.exports = { mutualFundValidator, sipValidator };
