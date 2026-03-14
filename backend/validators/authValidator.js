const { body } = require('express-validator');

const loginValidator = [
  body('username')
    .trim()
    .notEmpty()
    .withMessage('Username is required')
    .isString()
    .withMessage('Username must be a string'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isString()
    .withMessage('Password must be a string'),
];

const updateProfileValidator = [
  body('username').optional().trim().notEmpty().withMessage('Username cannot be empty').isString(),
  body('password').optional().isString().isLength({ min: 1 }).withMessage('Password cannot be empty if provided'),
];

module.exports = { loginValidator, updateProfileValidator };
