const statementModel = require('../models/statementModel');
const accountModel = require('../models/accountModel');
const transactionModel = require('../models/transactionModel');
const { getFinancialCycle } = require('../../frontend/src/utils/financialMonth');

const generateStatementsForUser = async (userId) => {
  const accounts = await accountModel.getAll(userId);
  const creditCards = accounts.filter(a => a.type === 'credit');

  if (creditCards.length === 0) return;

  const now = new Date();
  
  for (const card of creditCards) {
    const startDay = parseInt(card.billingCycleStartDay) || 1;
    const cycleInfo = getFinancialCycle(now, startDay);
    
    // Check if yesterday was the last day of the cycle.
    if (now.getDate() === startDay) {
      const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      const previousCycleInfo = getFinancialCycle(yesterday, startDay);
      
      const txns = await transactionModel.getAll(userId);
      const cycleTxns = txns.filter(t => t.account_id === card.id && t.date >= previousCycleInfo.startDate && t.date <= previousCycleInfo.endDate);
      
      let totalSpent = 0;
      let totalPaid = 0;
      
      cycleTxns.forEach(t => {
        const amt = parseFloat(t.amount || 0);
        if (amt < 0) totalSpent += Math.abs(amt);
        else totalPaid += amt; 
      });
      
      const remainingBalance = parseFloat(card.balance || 0);
      const minDue = remainingBalance > 0 ? Math.max(remainingBalance * 0.05, 100) : 0;
      
      const dueDateObj = new Date(previousCycleInfo.endDate);
      dueDateObj.setDate(dueDateObj.getDate() + (parseInt(card.dueDaysAfter) || 20));
      
      await statementModel.upsert(userId, card.id, previousCycleInfo.cycleKey, {
        cardId: card.id,
        cycleKey: previousCycleInfo.cycleKey,
        startDate: previousCycleInfo.startDate,
        endDate: previousCycleInfo.endDate,
        totalSpent,
        totalPaid,
        remainingBalance,
        minimumDue: minDue,
        dueDate: dueDateObj.toISOString().split('T')[0],
        status: remainingBalance <= 0 ? 'paid' : 'pending',
        isFrozen: true,
      });
      console.log(`Generated frozen statement for card ${card.account_name || card.id} cycle ${previousCycleInfo.cycleKey}`);
    }
  }
};

module.exports = { generateStatementsForUser };
