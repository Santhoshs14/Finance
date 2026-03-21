const { db } = require('../config/firebase');
const transactionModel = require('../models/transactionModel');
const cron = require('node-cron');
const { isNewCycleDay, getCurrentFinancialMonth } = require('../utils/financialMonth');

const processRecurringTransactions = async () => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Note: collectionGroup requires a composite index if combining multiple where clauses with different fields,
    // but single equivalences like is_recurring=true and array/range queries can sometimes work if simple enough.
    // If it fails with index error, user will need to add it via Firebase Console.
    const snapshot = await db.collectionGroup('transactions')
      .where('is_recurring', '==', true)
      .where('next_date', '<=', today)
      .get();

    if (snapshot.empty) {
      console.log('No recurring transactions to process today.');
      return;
    }

    let processedCount = 0;
    for (const doc of snapshot.docs) {
      const data = doc.data();
      const userId = doc.ref.parent.parent.id;
      
      // Calculate next date based on frequency
      const currentDate = new Date(data.next_date);
      if (data.recurrence_interval === 'monthly') {
        currentDate.setMonth(currentDate.getMonth() + 1);
      } else if (data.recurrence_interval === 'weekly') {
        currentDate.setDate(currentDate.getDate() + 7);
      } else if (data.recurrence_interval === 'yearly') {
        currentDate.setFullYear(currentDate.getFullYear() + 1);
      }
      const nextDate = currentDate.toISOString().split('T')[0];

      // Add a new standard transaction (the instance for today/past due)
      // Discard the recurrence fields for the instance, so it doesn't recur itself
      const { id, is_recurring, recurrence_interval, next_date, created_at, ...txnData } = data;
      txnData.date = data.next_date; // Use the exact due date to backfill accurately
      await transactionModel.create(userId, txnData);

      // Update the original recurring definition to the next date
      await doc.ref.update({ next_date: nextDate });
      processedCount++;
    }
    console.log(`Successfully processed ${processedCount} recurring transactions.`);
  } catch (error) {
    if (error.message.includes('index')) {
      console.error('Missing composite index for collectionGroup recurring transactions. Please create it in Firebase console:');
      console.error(error.message);
    } else {
      console.error('Error processing recurring transactions:', error);
    }
  }
};

const recordNetWorthSnapshots = async () => {
  try {
    const today = new Date();
    // Check if tomorrow is the 1st of the month (meaning today is the last day)
    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    if (tomorrow.getDate() !== 1) {
      return; // Not the last day of the month, skip
    }

    console.log('Last day of the month detected. Recording Net Worth Snapshots...');
    const accountModel = require('../models/accountModel');
    const investmentModel = require('../models/investmentModel');
    const lendingModel = require('../models/lendingModel');
    const transactionModel = require('../models/transactionModel');
    const { calculateNetWorth } = require('../utils/calculations');
    const { generateStatementsForUser } = require('./statementService');

    const usersSnapshot = await db.collection('users').get();
    let processedCount = 0;

    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      
      // Process statements sequentially
      try {
        await generateStatementsForUser(userId);
      } catch (e) {
        console.error(`Statement generation error for userId: ${userId}:`, e);
      }

      const [accounts, investments, allTxns, lendingItems] = await Promise.all([
        accountModel.getAll(userId),
        investmentModel.getAll(userId),
        transactionModel.getAll(userId),
        lendingModel.getAll(userId),
      ]);

      const bankAccounts = accounts.filter(a => a.type !== 'credit');
      const creditCards = accounts.filter(a => a.type === 'credit');
      const ccTransactions = allTxns.filter(t => {
        const acc = accounts.find(a => a.id === t.account_id);
        return acc && acc.type === 'credit';
      });

      const netWorthData = calculateNetWorth(bankAccounts, investments, creditCards, ccTransactions, lendingItems);

      await db.collection('users').doc(userId).collection('net_worth_snapshots').add({
        date: today.toISOString().split('T')[0],
        net_worth: netWorthData.net_worth,
        total_accounts: netWorthData.total_accounts,
        total_investments: netWorthData.total_investments,
        total_debt: netWorthData.total_cc_outstanding,
        created_at: today.toISOString(),
      });
      processedCount++;
    }
    console.log(`Successfully recorded ${processedCount} net worth snapshots.`);
  } catch (err) {
    console.error('Error recording net worth snapshots:', err);
  }
};

const resetBudgetCycles = async () => {
  const today = new Date();
  if (!isNewCycleDay(today)) return;

  console.log('25th detected — resetting budget cycles for all users...');
  const { bulkUpsert } = require('../models/budgetModel');
  const { startDate, endDate } = getCurrentFinancialMonth(today);

  try {
    const usersSnapshot = await db.collection('users').get();
    let count = 0;
    for (const userDoc of usersSnapshot.docs) {
      await bulkUpsert(userDoc.id, startDate, endDate);
      count++;
    }
    console.log(`Budget cycles reset for ${count} users (${startDate} → ${endDate})`);
  } catch (err) {
    console.error('Budget cycle reset failed:', err);
  }
};

const startCronJobs = () => {
  // Run daily at 00:00 (Midnight)
  cron.schedule('0 0 * * *', () => {
    console.log('Running daily recurring transaction check...');
    processRecurringTransactions();
    resetBudgetCycles();
  });

  // Run daily at 23:55 (Check for End of Month Net Worth Snapshot)
  cron.schedule('55 23 * * *', () => {
    recordNetWorthSnapshots();
  });
  console.log('Recurring transactions cron job scheduled.');
};

module.exports = { startCronJobs, processRecurringTransactions, resetBudgetCycles };
