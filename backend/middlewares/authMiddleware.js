const jwt = require('jsonwebtoken');
const { error } = require('../utils/apiResponse');

/**
 * JWT Authentication Middleware
 * Verifies Bearer token sent from the client
 */
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return error(res, 'Access denied. No token provided.', 401);
    }

    const token = authHeader.split(' ')[1];

    // Verify the JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Attach the user's data to the request object
    req.user = decoded;
    
    next();
  } catch (err) {
    console.error('Auth Error:', err.message);
    if (err.name === 'TokenExpiredError') {
      return error(res, 'Token expired. Please refresh your session.', 401);
    }
    return error(res, 'Authentication failed. Invalid token.', 401);
  }
};

module.exports = authMiddleware;
