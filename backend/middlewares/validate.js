const { validationResult } = require('express-validator');
const { error } = require('../utils/apiResponse');

/**
 * Validation middleware
 * Runs express-validator checks and returns 400 on failure
 */
const validate = (validations) => {
  return async (req, res, next) => {
    // Run all validations
    await Promise.all(validations.map((validation) => validation.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    const extractedErrors = errors.array().map((err) => ({
      field: err.path,
      message: err.msg,
    }));

    return error(res, 'Validation failed', 400, extractedErrors);
  };
};

module.exports = validate;
