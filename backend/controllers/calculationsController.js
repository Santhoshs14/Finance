/**
 * Calculations endpoint
 * Returns all financial calculations in one response
 */
const accountModel = require('../models/accountModel');
const investmentModel = require('../models/investmentModel');
const transactionModel = require('../models/transactionModel');
const budgetModel = require('../models/budgetModel');
const goalModel = require('../models/goalModel');
const mutualFundModel = require('../models/mutualFundModel');
const lendingModel = require('../models/lendingModel');
const {
  calculateNetWorth,
  calculateTotalSavings,
  calculateTotalLiabilities,
  calculateSavingsRate,
  calculateBudgetUsage,
  calculateCCUtilization,
  calculateInvestmentPL,
  calculatePortfolioAllocation,
  calculateFinancialHealthScore,
  calculateSIPGrowth,
  calculateGoalCompletion,
} = require('../utils/calculations');
const { getCurrentFinancialMonth, getFinancialMonthRange } = require('../utils/financialMonth');
const { success } = require('../utils/apiResponse');

const getCalculations = async (req, res, next) => {
  try {
    // Determine financial month to use for calculations
    let month, year, startDate, endDate;

    if (req.query.financialMonth) {
      // e.g. ?financialMonth=2026-03
      const parts = req.query.financialMonth.split('-');
      const range = getFinancialMonthRange(parseInt(parts[1]), parseInt(parts[0]));
      month = range.month;
      year = range.year;
      startDate = range.startDate;
      endDate = range.endDate;
    } else {
      const current = getCurrentFinancialMonth();
      month = current.month;
      year = current.year;
      startDate = current.startDate;
      endDate = current.endDate;
    }

    // Fetch all data in parallel
    const [accounts, investments, transactions, budgets, goals, sipPlans, lendingItems] =
      await Promise.all([
        accountModel.getAll(req.user.id),
        investmentModel.getAll(req.user.id),
        transactionModel.getAll(req.user.id),
        budgetModel.getAll(req.user.id),
        goalModel.getAll(req.user.id),
        mutualFundModel.getAllSIPs(req.user.id),
        lendingModel.getAll(req.user.id),
      ]);

    // Filter transactions for current financial month cycle
    const cycleTransactions = transactions.filter(t => {
      const d = t.date;
      return d >= startDate && d <= endDate;
    });

    const netWorthData = calculateNetWorth(accounts, investments, lendingItems);
    const totalSavings = calculateTotalSavings(investments);
    const totalLiabilities = calculateTotalLiabilities(accounts, lendingItems);
    const savingsRateData = calculateSavingsRate(transactions, month, year);
    const ccData = calculateCCUtilization(accounts);
    const portfolioData = calculatePortfolioAllocation(accounts, investments);

    const health_score = calculateFinancialHealthScore(savingsRateData, netWorthData, ccData, portfolioData);

    // Budget usage uses financial month cycle transactions
    const budgetUsageData = calculateBudgetUsage(budgets, cycleTransactions, month, year);

    const result = {
      // Current financial cycle info
      financial_cycle: { startDate, endDate, month, year },

      // Core metrics
      net_worth: netWorthData,
      total_savings: totalSavings,           // Investment portfolio value only
      total_liabilities: totalLiabilities,   // CC + borrowed lending
      savings_rate: savingsRateData,

      // Detailed breakdowns
      budget_usage: budgetUsageData,
      cc_utilization: ccData,
      investment_pl: calculateInvestmentPL(investments),
      portfolio_allocation: portfolioData,
      health_score,
      goal_completion: goals.map(calculateGoalCompletion),
      sip_projections: sipPlans.map((sip) => ({
        fund_id: sip.fund_id,
        monthly_amount: sip.monthly_amount,
        projection_5yr: calculateSIPGrowth(sip.monthly_amount, 12, 5),
        projection_10yr: calculateSIPGrowth(sip.monthly_amount, 12, 10),
        projection_20yr: calculateSIPGrowth(sip.monthly_amount, 12, 20),
      })),
    };
    return success(res, result, 'Financial calculations generated');
  } catch (err) { next(err); }
};

const getSnapshots = async (req, res, next) => {
  try {
    const { db } = require('../config/firebase');
    const snapshot = await db.collection('users').doc(req.user.id).collection('net_worth_snapshots')
      .orderBy('date', 'asc')
      .get();

    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return success(res, data, 'Net worth snapshots retrieved');
  } catch (err) { next(err); }
};

module.exports = { getCalculations, getSnapshots };
