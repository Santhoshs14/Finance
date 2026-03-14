const accountService = require('../services/accountService');
const { success } = require('../utils/apiResponse');

const getAll = async (req, res, next) => {
  try {
    const accounts = await accountService.getAllAccounts(req.user.id);
    return success(res, accounts, 'Accounts retrieved');
  } catch (err) { next(err); }
};

const getById = async (req, res, next) => {
  try {
    const account = await accountService.getAccountById(req.user.id, req.params.id);
    return success(res, account, 'Account retrieved');
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const account = await accountService.createAccount(req.user.id, req.body);
    return success(res, account, 'Account created', 201);
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const account = await accountService.updateAccount(req.user.id, req.params.id, req.body);
    return success(res, account, 'Account updated');
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    await accountService.deleteAccount(req.user.id, req.params.id);
    return success(res, null, 'Account deleted');
  } catch (err) { next(err); }
};

module.exports = { getAll, getById, create, update, remove };
