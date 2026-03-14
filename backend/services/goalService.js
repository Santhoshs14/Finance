const goalModel = require('../models/goalModel');

const getAllGoals = async (userId) => await goalModel.getAll(userId);
const createGoal = async (userId, data) => await goalModel.create(userId, data);

module.exports = { getAllGoals, createGoal };
