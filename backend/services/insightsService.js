const transactionModel = require('../models/transactionModel');
const investmentModel = require('../models/investmentModel');
const budgetModel = require('../models/budgetModel');
const { calculateInvestmentPL, calculateSavingsRate, calculateBudgetUsage } = require('../utils/calculations');

/**
 * Generate rule-based financial insights
 */
const generateInsights = async (userId) => {
  if (!userId) throw new Error('User ID required for insights');
  
  const insights = [];
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;

  // Get all transactions and budgets
  const [allTransactions, budgets] = await Promise.all([
    transactionModel.getAll(userId),
    budgetModel.getAll(userId)
  ]);

  // Current & previous month transactions
  const currentMonthTxns = allTransactions.filter((txn) => {
    const d = new Date(txn.date);
    return d.getMonth() + 1 === currentMonth && d.getFullYear() === currentYear;
  });

  const prevMonthTxns = allTransactions.filter((txn) => {
    const d = new Date(txn.date);
    return d.getMonth() + 1 === prevMonth && d.getFullYear() === prevYear;
  });

  // --- Budget Risk Warnings ---
  const budgetUsage = calculateBudgetUsage(budgets, currentMonthTxns, currentMonth, currentYear);
  budgetUsage.forEach(usage => {
    // If > 80% usage
    if (usage.usage_percentage >= 100) {
      insights.push({
        type: 'warning',
        category: 'Budget',
        message: `You have exceeded your ${usage.category} budget by ₹${Math.abs(usage.remaining).toLocaleString('en-IN')}.`,
      });
    } else if (usage.usage_percentage > 80) {
      insights.push({
        type: 'warning',
        category: 'Budget',
        message: `High budget utilization: You have used ${usage.usage_percentage}% of your ${usage.category} budget.`,
      });
    }
  });

  // --- Spending Anomaly Detection (vs 3-month average) ---
  const past3MonthsDate = new Date();
  past3MonthsDate.setMonth(past3MonthsDate.getMonth() - 3);
  
  const oldTxns = allTransactions.filter(txn => new Date(txn.date) >= past3MonthsDate && new Date(txn.date) < new Date(currentYear, currentMonth - 1, 1));
  const categoryAverages = {};
  
  oldTxns.forEach(txn => {
    if (txn.category !== 'Income' && txn.amount < 0) {
      categoryAverages[txn.category] = (categoryAverages[txn.category] || 0) + Math.abs(txn.amount);
    }
  });
  
  // Divide by 3 (months)
  Object.keys(categoryAverages).forEach(cat => categoryAverages[cat] /= 3);

  const currentSpending = {};
  currentMonthTxns.forEach((txn) => {
    if (txn.category !== 'Income' && txn.amount < 0) {
      currentSpending[txn.category] = (currentSpending[txn.category] || 0) + Math.abs(txn.amount);
    }
  });

  // Compare categories
  for (const category of Object.keys(currentSpending)) {
    const current = currentSpending[category];
    const avg = categoryAverages[category] || 0;

    if (avg > 0) {
      const change = ((current - avg) / avg) * 100;
      // Anomaly trigger: Current spending is 50%+ higher than 3 month average
      if (change > 50 && current > 1000) { // arbitrary threshold to avoid noise on small amounts
        insights.push({
          type: 'warning',
          category,
          message: `Spending anomaly: ${category} spending (₹${current.toLocaleString('en-IN')}) is ${Math.abs(change).toFixed(0)}% higher than your 3-month average (₹${Math.round(avg).toLocaleString('en-IN')}).`,
        });
      }
    }
  }

  // --- Savings rate insight ---
  const currentSavings = calculateSavingsRate(allTransactions, currentMonth, currentYear);
  const prevSavings = calculateSavingsRate(allTransactions, prevMonth, prevYear);

  if (prevSavings.savings_rate > 0 && currentSavings.savings_rate < prevSavings.savings_rate) {
    insights.push({
      type: 'warning',
      category: 'Savings',
      message: `Savings rate dropped from ${prevSavings.savings_rate}% to ${currentSavings.savings_rate}% this month`,
    });
  } else if (currentSavings.savings_rate > prevSavings.savings_rate) {
    insights.push({
      type: 'positive',
      category: 'Savings',
      message: `Savings rate improved from ${prevSavings.savings_rate}% to ${currentSavings.savings_rate}% this month`,
    });
  }

  // --- Investment portfolio summary ---
  try {
    const investments = await investmentModel.getAll(userId);
    if (investments.length > 0) {
      const plData = calculateInvestmentPL(investments);
      const totalInvested = plData.reduce((sum, i) => sum + i.invested, 0);
      const totalCurrent = plData.reduce((sum, i) => sum + i.current_value, 0);
      const totalPL = totalCurrent - totalInvested;
      const plPercent = totalInvested > 0 ? ((totalPL / totalInvested) * 100).toFixed(2) : 0;

      insights.push({
        type: totalPL >= 0 ? 'positive' : 'warning',
        category: 'Investments',
        message: `Investment portfolio: ₹${totalCurrent.toLocaleString('en-IN')} (${totalPL >= 0 ? '+' : ''}₹${totalPL.toLocaleString('en-IN')}, ${plPercent}%)`,
      });
    }
  } catch (e) {
    // No investments yet
  }

  // --- General insights if no data ---
  if (insights.length === 0) {
    insights.push({
      type: 'info',
      category: 'General',
      message: 'Add more transactions to get personalized financial insights!',
    });
  }

  return {
    generated_at: now.toISOString(),
    current_month: `${currentMonth}/${currentYear}`,
    insights,
  };
};

module.exports = { generateInsights };
