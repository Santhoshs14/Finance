/**
 * insights.js
 * Centralized pure functions for generating financial insights locally.
 * Relies on pre-aggregated data for scalability instead of looping over thousands of transactions.
 */

import { calculateCCUtilization } from './calculations';

export const generateInsightsFromAggregates = (aggregate, budgets, accounts, actualSavingsRate = undefined) => {
  const insights = [];
  if (!aggregate) return insights;

  const { totalSpent = 0, totalIncome = 0, categoryBreakdown = {} } = aggregate;

  // 1. Savings Rate Anomaly
  if (actualSavingsRate !== undefined) {
    if (actualSavingsRate > 0 && actualSavingsRate < 10) {
      insights.push({
        type: 'warning',
        title: 'Low Savings Rate',
        message: `Your savings rate is currently ${actualSavingsRate.toFixed(1)}%. Try to keep it above 20%.`,
      });
    } else if (actualSavingsRate > 40) {
      insights.push({
        type: 'success',
        title: 'Excellent Savings Rate',
        message: `You are saving ${actualSavingsRate.toFixed(1)}% of your income! Keep it up!`,
      });
    }
  } else if (totalIncome > 0) {
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
    const ccMetrics = calculateCCUtilization(accounts);
    ccMetrics.forEach(cc => {
      if (cc.utilization_percentage > 30) {
        insights.push({
          type: 'warning',
          title: 'High Credit Utilization',
          message: `${cc.card_name} is at ${cc.utilization_percentage.toFixed(1)}% utilization. Keep it below 30% for a healthy credit score.`,
        });
      }
    });
  }

  return insights;
};

/**
 * Generate cycle-over-cycle comparison insights.
 * @param {{ totalSpent: number, totalIncome: number, categoryBreakdown: Object }} current
 * @param {{ totalSpent: number, totalIncome: number, categoryBreakdown: Object }} previous
 * @returns {Array<{ type, title, message }>}
 */
export const generateCycleComparisonInsights = (current, previous) => {
  const insights = [];
  if (!current || !previous) return insights;

  const currSpent  = current.totalSpent  || 0;
  const prevSpent  = previous.totalSpent || 0;
  const currIncome = current.totalIncome || 0;
  const prevIncome = previous.totalIncome || 0;

  // Spending change
  if (prevSpent > 0) {
    const spendChange = ((currSpent - prevSpent) / prevSpent) * 100;
    if (spendChange > 15) {
      insights.push({
        type: 'warning',
        title: 'Spending Increased',
        message: `Spending is up ${spendChange.toFixed(1)}% vs last cycle (₹${Math.round(currSpent - prevSpent).toLocaleString('en-IN')} more).`,
      });
    } else if (spendChange < -10) {
      insights.push({
        type: 'success',
        title: 'Spending Reduced',
        message: `Great! Spending decreased ${Math.abs(spendChange).toFixed(1)}% vs last cycle (₹${Math.round(prevSpent - currSpent).toLocaleString('en-IN')} saved).`,
      });
    }
  }

  // Income change
  if (prevIncome > 0) {
    const incomeChange = ((currIncome - prevIncome) / prevIncome) * 100;
    if (incomeChange < -10) {
      insights.push({
        type: 'warning',
        title: 'Income Dropped',
        message: `Income decreased ${Math.abs(incomeChange).toFixed(1)}% vs last cycle.`,
      });
    } else if (incomeChange > 15) {
      insights.push({
        type: 'success',
        title: 'Income Increased',
        message: `Income grew by ${incomeChange.toFixed(1)}% vs last cycle!`,
      });
    }
  }

  // Category-level: find biggest worsening
  const SKIP = new Set(['Income', 'Transfer', 'Credit Card Payment']);
  const currBreakdown = current.categoryBreakdown || {};
  const prevBreakdown = previous.categoryBreakdown || {};
  const allCats = new Set([...Object.keys(currBreakdown), ...Object.keys(prevBreakdown)]);

  let worstCat = null;
  let bestCat = null;

  allCats.forEach(cat => {
    if (SKIP.has(cat)) return;
    const curr = currBreakdown[cat] || 0;
    const prev = prevBreakdown[cat] || 0;
    if (prev <= 0) return;

    const change = curr - prev;
    const pct = (change / prev) * 100;

    if (pct > 30 && change > 500 && (!worstCat || change > worstCat.change)) {
      worstCat = { cat, change, pct };
    }
    if (pct < -20 && Math.abs(change) > 300 && (!bestCat || change < bestCat.change)) {
      bestCat = { cat, change: Math.abs(change), pct: Math.abs(pct) };
    }
  });

  if (worstCat) {
    insights.push({
      type: 'warning',
      title: `${worstCat.cat} Spending Spike`,
      message: `${worstCat.cat} spending jumped ${worstCat.pct.toFixed(0)}% (₹${Math.round(worstCat.change).toLocaleString('en-IN')} more) vs last cycle.`,
    });
  }

  if (bestCat) {
    insights.push({
      type: 'success',
      title: `${bestCat.cat} Improved`,
      message: `${bestCat.cat} spending dropped ${bestCat.pct.toFixed(0)}% (₹${Math.round(bestCat.change).toLocaleString('en-IN')} saved) vs last cycle.`,
    });
  }

  return insights;
};
