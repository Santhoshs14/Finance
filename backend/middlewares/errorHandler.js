/**
 * Centralized error handling middleware
 */

const errorHandler = (err, req, res, next) => {
  console.error('Error:', err.message);
  console.error('Stack:', err.stack);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  return res.status(statusCode).json({
    success: false,
    data: null,
    message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : message,
  });
};

module.exports = errorHandler;
