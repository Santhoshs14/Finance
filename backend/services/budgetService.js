const budgetModel = require('../models/budgetModel');

const getAllBudgets = async (userId) => {
  return await budgetModel.getAll(userId);
};

const createBudget = async (userId, data) => {
  return await budgetModel.create(userId, data);
};

module.exports = { getAllBudgets, createBudget };
