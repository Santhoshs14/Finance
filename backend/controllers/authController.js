const authService = require('../services/authService');
const { success, error } = require('../utils/apiResponse');

/**
 * POST /auth/login
 */
const login = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const result = await authService.login(username, password);
    return success(res, result, 'Login successful');
  } catch (err) {
    next(err);
  }
};

/**
 * POST /auth/register
 */
const register = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const result = await authService.register(username, password);
    return success(res, result, 'Registration successful', 201);
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /auth/profile
 */
const updateProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { username, password } = req.body;
    const result = await authService.updateProfile(userId, { username, password });
    return success(res, result, 'Profile updated successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * GET /auth/profile/stats
 */
const getProfileStats = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const result = await authService.getProfileStats(userId);
    return success(res, result, 'Profile stats retrieved');
  } catch (err) {
    next(err);
  }
};

module.exports = { login, register, updateProfile, getProfileStats };
