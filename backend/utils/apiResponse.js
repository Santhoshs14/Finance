/**
 * Standardized API Response helpers
 */

const success = (res, data = {}, message = 'Success', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    data,
    message,
  });
};

const error = (res, message = 'Something went wrong', statusCode = 500, data = null) => {
  return res.status(statusCode).json({
    success: false,
    data,
    message,
  });
};

module.exports = { success, error };
