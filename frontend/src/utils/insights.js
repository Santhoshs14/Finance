/**
 * insights.js
 * Centralized pure functions for generating financial insights locally.
 * Relies on pre-aggregated data for scalability instead of looping over thousands of transactions.
 */

export const generateInsightsFromAggregates = (aggregate, budgets, accounts) => {
  const insights = [];
  if (!aggregate) return insights;

  const { totalSpent = 0, totalIncome = 0, categoryBreakdown = {} } = aggregate;

  // 1. Savings Rate Anomaly
  if (totalIncome > 0) {
    const savingsRate = ((totalIncome - totalSpent) / totalIncome) * 100;
    if (savingsRate < 10) {
      insights.push({
        type: 'warning',
        title: 'Low Savings Rate',
        message: `Your savings rate is currently ${savingsRate.toFixed(1)}%. Try to keep it above 20%.`,
      });
    } else if (savingsRate > 40) {
      insights.push({
        type: 'success',
        title: 'Excellent Savings Rate',
        message: `You are saving ${savingsRate.toFixed(1)}% of your income! Keep it up!`,
      });
    }
  }

  // 2. Budget Warnings
  if (budgets && budgets.length > 0) {
    let overCount = 0;
    let warnCount = 0;
    budgets.forEach(b => {
      const spent = categoryBreakdown[b.category] || 0;
      if (b.monthly_limit > 0) {
        if (spent > b.monthly_limit) {
          overCount++;
          insights.push({
            type: 'danger',
            title: 'Budget Exceeded',
            message: `You have exceeded your ${b.category} budget by ₹${(spent - b.monthly_limit).toLocaleString('en-IN')}.`,
          });
        } else if (spent >= b.monthly_limit * 0.8) {
          warnCount++;
        }
      }
    });

    if (warnCount > 0) {
      insights.push({
        type: 'warning',
        title: 'Approaching Budget Limits',
        message: `${warnCount} categor${warnCount > 1 ? 'ies are' : 'y is'} nearing the limit. Check your budgets.`,
      });
    }
  }

  // 3. Credit Card Utilization
  if (accounts) {
    const ccAccounts = accounts.filter(a => a.type === 'credit' && a.credit_limit > 0);
    ccAccounts.forEach(cc => {
      const util = ((cc.liability || 0) / cc.credit_limit) * 100;
      if (util > 30) {
        insights.push({
          type: 'warning',
          title: 'High Credit Utilization',
          message: `${cc.account_name} is at ${util.toFixed(1)}% utilization. Keep it below 30% for a healthy credit score.`,
        });
      }
    });
  }

  return insights;
};
