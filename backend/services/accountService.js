const accountModel = require('../models/accountModel');

const getAllAccounts = async (userId) => {
  return await accountModel.getAll(userId);
};

const getAccountById = async (userId, id) => {
  const account = await accountModel.getById(userId, id);
  if (!account) {
    throw Object.assign(new Error('Account not found'), { statusCode: 404 });
  }
  return account;
};

const createAccount = async (userId, data) => {
  return await accountModel.create(userId, data);
};

const updateAccount = async (userId, id, data) => {
  const account = await accountModel.update(userId, id, data);
  if (!account) {
    throw Object.assign(new Error('Account not found'), { statusCode: 404 });
  }
  return account;
};

const deleteAccount = async (userId, id) => {
  const result = await accountModel.remove(userId, id);
  if (!result) {
    throw Object.assign(new Error('Account not found'), { statusCode: 404 });
  }
  return result;
};

module.exports = { getAllAccounts, getAccountById, createAccount, updateAccount, deleteAccount };
