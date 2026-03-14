const goalService = require('../services/goalService');
const { success } = require('../utils/apiResponse');

const getAll = async (req, res, next) => {
  try {
    const goals = await goalService.getAllGoals(req.user.id);
    return success(res, goals, 'Goals retrieved');
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const goal = await goalService.createGoal(req.user.id, req.body);
    return success(res, goal, 'Goal created', 201);
  } catch (err) { next(err); }
};

module.exports = { getAll, create };
