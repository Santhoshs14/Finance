const transactionModel = require('../models/transactionModel');

const getAllTransactions = async (userId, filters, limit, lastDocId) => {
  return await transactionModel.getAll(userId, filters, limit, lastDocId);
};

const getTransactionById = async (userId, id) => {
  const txn = await transactionModel.getById(userId, id);
  if (!txn) throw Object.assign(new Error('Transaction not found'), { statusCode: 404 });
  return txn;
};

const createTransaction = async (userId, data) => {
  // Subscription Detection Heuristic
  // If it's an expense, check if an identical amount was charged in the last 45 days.
  if (data.amount < 0 && data.category !== 'Income') {
    try {
      // Get all recent transactions (simplistic heuristic: check all or let's say just doing a quick fetch)
      // For efficiency, we just fetch recent ones (e.g., limit 50)
      const recent = await transactionModel.getAll(userId, {}, 50);
      
      const isRecurring = recent.transactions ? recent.transactions.some(t => 
        t.amount === data.amount && 
        (t.category === data.category || (t.notes && data.notes && t.notes.toLowerCase() === data.notes.toLowerCase())) &&
        t.is_subscription !== false // If user manually unmarked it, don't re-mark
      ) : recent.some(t => 
        t.amount === data.amount && 
        (t.category === data.category || (t.notes && data.notes && t.notes.toLowerCase() === data.notes.toLowerCase())) &&
        t.is_subscription !== false
      );
      
      if (isRecurring || data.category === 'Subscription') {
        data.is_subscription = true;
      }
    } catch (e) {
      console.error('Subscription detection failed:', e);
    }
  }

  return await transactionModel.create(userId, data);
};

const createBatchTransactions = async (userId, items) => {
  return await transactionModel.createBatch(userId, items);
};

const updateTransaction = async (userId, id, data) => {
  const txn = await transactionModel.update(userId, id, data);
  if (!txn) throw Object.assign(new Error('Transaction not found'), { statusCode: 404 });
  return txn;
};

const deleteTransaction = async (userId, id) => {
  const result = await transactionModel.remove(userId, id);
  if (!result) throw Object.assign(new Error('Transaction not found'), { statusCode: 404 });
  return result;
};

const getTransactionsByDateRange = async (userId, startDate, endDate) => {
  return await transactionModel.getByDateRange(userId, startDate, endDate);
};

module.exports = {
  getAllTransactions, getTransactionById, createTransaction,
  createBatchTransactions, updateTransaction, deleteTransaction,
  getTransactionsByDateRange,
};
