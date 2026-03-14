const budgetService = require('../services/budgetService');
const { success } = require('../utils/apiResponse');

const getAll = async (req, res, next) => {
  try {
    const budgets = await budgetService.getAllBudgets(req.user.id);
    return success(res, budgets, 'Budgets retrieved');
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const budget = await budgetService.createBudget(req.user.id, req.body);
    return success(res, budget, 'Budget created', 201);
  } catch (err) { next(err); }
};

module.exports = { getAll, create };
