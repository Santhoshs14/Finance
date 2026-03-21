const transactionModel = require('../models/transactionModel');
const accountModel = require('../models/accountModel');

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

  const newTxn = await transactionModel.create(userId, data);

  // Sync Account Balance
  if (data.account_id) {
    try {
      const account = await accountModel.getById(userId, data.account_id);
      if (account) {
        // Adjust balance: positive amount for income, negative for expense
        // For credit cards, balance is liability, so expenses (-ve) increase liability, income (+ve) decreases it.
        let newBalance;
        if (account.account_type === 'credit') {
          newBalance = (account.balance || 0) - data.amount;
        } else {
          newBalance = (account.balance || 0) + data.amount;
        }
        await accountModel.update(userId, data.account_id, { balance: newBalance });
      }
    } catch (e) {
      console.error('Failed to update account balance on transaction creation:', e);
    }
  }

  return newTxn;
};

const createBatchTransactions = async (userId, items) => {
  return await transactionModel.createBatch(userId, items);
};

const updateTransaction = async (userId, id, data) => {
  const originalTxn = await transactionModel.getById(userId, id);
  if (!originalTxn) throw Object.assign(new Error('Transaction not found'), { statusCode: 404 });

  const updatedTxn = await transactionModel.update(userId, id, data);

  // Sync Account Balance
  try {
    const oldAccountId = originalTxn.account_id;
    const newAccountId = data.account_id !== undefined ? data.account_id : originalTxn.account_id;
    
    const oldAmount = originalTxn.amount || 0;
    const newAmount = data.amount !== undefined ? data.amount : originalTxn.amount;

    if (oldAccountId === newAccountId && newAccountId) {
      // Amount changed for the same account
      const diff = newAmount - oldAmount;
      if (diff !== 0) {
        const account = await accountModel.getById(userId, newAccountId);
        if (account) {
          let newBalance;
          if (account.account_type === 'credit') {
            newBalance = (account.balance || 0) - diff;
          } else {
            newBalance = (account.balance || 0) + diff;
          }
          await accountModel.update(userId, newAccountId, { balance: newBalance });
        }
      }
    } else {
      // Account changed
      if (oldAccountId) {
        const oldAccount = await accountModel.getById(userId, oldAccountId);
        if (oldAccount) {
          let oldBalance;
          if (oldAccount.account_type === 'credit') {
            oldBalance = (oldAccount.balance || 0) + oldAmount;
          } else {
            oldBalance = (oldAccount.balance || 0) - oldAmount;
          }
          await accountModel.update(userId, oldAccountId, { balance: oldBalance });
        }
      }
      if (newAccountId) {
        const newAccount = await accountModel.getById(userId, newAccountId);
        if (newAccount) {
          let newBalance;
          if (newAccount.account_type === 'credit') {
            newBalance = (newAccount.balance || 0) - newAmount;
          } else {
            newBalance = (newAccount.balance || 0) + newAmount;
          }
          await accountModel.update(userId, newAccountId, { balance: newBalance });
        }
      }
    }
  } catch (e) {
    console.error('Failed to update account balance on transaction update:', e);
  }

  return updatedTxn;
};

const deleteTransaction = async (userId, id) => {
  const originalTxn = await transactionModel.getById(userId, id);
  if (!originalTxn) throw Object.assign(new Error('Transaction not found'), { statusCode: 404 });

  const result = await transactionModel.remove(userId, id);

  // Sync Account Balance
  if (originalTxn.account_id) {
    try {
      const account = await accountModel.getById(userId, originalTxn.account_id);
      if (account) {
        // Reverse the transaction amount
        let newBalance;
        if (account.account_type === 'credit') {
          newBalance = (account.balance || 0) + (originalTxn.amount || 0);
        } else {
          newBalance = (account.balance || 0) - (originalTxn.amount || 0);
        }
        await accountModel.update(userId, originalTxn.account_id, { balance: newBalance });
      }
    } catch (e) {
      console.error('Failed to update account balance on transaction deletion:', e);
    }
  }

  return result;
};

const deleteAllTransactions = async (userId) => {
  return await transactionModel.removeAll(userId);
};

const getTransactionsByDateRange = async (userId, startDate, endDate) => {
  return await transactionModel.getByDateRange(userId, startDate, endDate);
};

module.exports = {
  getAllTransactions, getTransactionById, createTransaction,
  createBatchTransactions, updateTransaction, deleteTransaction,
  deleteAllTransactions, getTransactionsByDateRange,
};
