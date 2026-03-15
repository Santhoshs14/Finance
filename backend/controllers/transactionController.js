const transactionService = require('../services/transactionService');
const { success } = require('../utils/apiResponse');

const getAll = async (req, res, next) => {
  try {
    const filters = {};
    if (req.query.category) filters.category = req.query.category;
    if (req.query.account_id) filters.account_id = req.query.account_id;
    if (req.query.startDate) filters.startDate = req.query.startDate;
    if (req.query.endDate) filters.endDate = req.query.endDate;

    const limit = req.query.limit ? parseInt(req.query.limit, 10) : null;
    const lastDocId = req.query.lastDocId || null;

    const result = await transactionService.getAllTransactions(req.user.id, filters, limit, lastDocId);
    return success(res, result, 'Transactions retrieved');
  } catch (err) { next(err); }
};

const getById = async (req, res, next) => {
  try {
    const txn = await transactionService.getTransactionById(req.user.id, req.params.id);
    return success(res, txn, 'Transaction retrieved');
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const txn = await transactionService.createTransaction(req.user.id, req.body);
    return success(res, txn, 'Transaction created', 201);
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const txn = await transactionService.updateTransaction(req.user.id, req.params.id, req.body);
    return success(res, txn, 'Transaction updated');
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    await transactionService.deleteTransaction(req.user.id, req.params.id);
    return success(res, null, 'Transaction deleted');
  } catch (err) { next(err); }
};

const removeAll = async (req, res, next) => {
  try {
    const result = await transactionService.deleteAllTransactions(req.user.id);
    return success(res, result, `Deleted ${result.deleted} transactions successfully`);
  } catch (err) { next(err); }
};

module.exports = { getAll, getById, create, update, remove, removeAll };
