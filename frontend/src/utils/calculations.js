/**
 * Financial Calculations Utility
 * Net worth, savings rate, budget usage, CC utilization,
 * investment P/L, XIRR, SIP growth, goal completion
 */

export const calculateNetWorth = (accounts, investments, lendingItems = []) => {
  const bankAccounts = accounts.filter(a => a.type !== 'credit');
  const creditAccounts = accounts.filter(a => a.type === 'credit');

  const totalAccountBalance = bankAccounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);
  const totalInvestmentValue = investments.reduce((sum, inv) => sum + ((inv.current_price * inv.quantity) || inv.current_value || inv.value || 0), 0);

  const ccOutstanding = creditAccounts.reduce((sum, cc) => sum + (cc.liability || 0), 0);

  const lentAmount = lendingItems
    .filter(l => l.type === 'lent' && l.status !== 'paid')
    .reduce((sum, l) => sum + ((l.amount || 0) - (l.paid_amount || 0)), 0);

  const borrowedAmount = lendingItems
    .filter(l => l.type === 'borrowed' && l.status !== 'paid')
    .reduce((sum, l) => sum + ((l.amount || 0) - (l.paid_amount || 0)), 0);

  const r = (v) => Math.round(v * 100) / 100;
  return {
    total_accounts:       r(totalAccountBalance),
    total_investments:    r(totalInvestmentValue),
    total_cc_outstanding: r(ccOutstanding),
    total_lent:           r(lentAmount),
    total_borrowed:       r(borrowedAmount),
    net_worth:            r(totalAccountBalance + totalInvestmentValue + lentAmount - ccOutstanding - borrowedAmount),
  };
};

export const calculateTotalSavings = (investments) => {
  return investments.reduce((sum, inv) => sum + ((inv.current_price * inv.quantity) || inv.current_value || inv.value || 0), 0);
};

export const calculateTotalLiabilities = (accounts, lendingItems = []) => {
  const creditAccounts = accounts.filter(a => a.type === 'credit');
  const ccOutstanding = creditAccounts.reduce((sum, cc) => sum + (cc.liability || 0), 0);

  const borrowedAmount = lendingItems
    .filter(l => l.type === 'borrowed' && l.status !== 'paid')
    .reduce((sum, l) => sum + ((l.amount || 0) - (l.paid_amount || 0)), 0);
  const r = (v) => Math.round(v * 100) / 100;
  return {
    cc_outstanding: r(ccOutstanding),
    borrowed:       r(borrowedAmount),
    total:          r(ccOutstanding + borrowedAmount),
  };
};

// Frontend aggregates mode: we already have aggregate data built (totalSpent, totalIncome).
export const calculateSavingsRateFromAggregates = (aggregate) => {
  const income = aggregate?.totalIncome || 0;
  const expenses = aggregate?.totalSpent || 0;
  if (income === 0) return { income, expenses, savings: 0, savings_rate: 0 };
  const savings = Math.round((income - expenses) * 100) / 100;
  const savings_rate = parseFloat(((savings / income) * 100).toFixed(2));
  return { income, expenses, savings, savings_rate };
};

export const calculateBudgetUsageFromAggregates = (budgets, aggregate) => {
  const categories = aggregate?.categoryBreakdown || {};
  return budgets.map((budget) => {
    const spent = categories[budget.category] || 0;
    const usage_percentage = budget.monthly_limit > 0
      ? parseFloat(((spent / budget.monthly_limit) * 100).toFixed(2))
      : 0;
    const remaining = Math.round((budget.monthly_limit - spent) * 100) / 100;
    return {
      category: budget.category,
      monthly_limit: budget.monthly_limit,
      spent: Math.round(spent * 100) / 100,
      remaining,
      usage_percentage,
      over_budget: spent > budget.monthly_limit,
    };
  });
};

export const calculateCCUtilization = (accounts) => {
  const creditAccounts = accounts.filter(a => a.type === 'credit');
  return creditAccounts.map((card) => {
    let limit = card.credit_limit || 0;
    let outstanding = card.liability || 0;

    if (card.shared_limit_with) {
      const parent = creditAccounts.find(c => c.id === card.shared_limit_with) || card;
      limit = parent.credit_limit || 0;
      outstanding = parent.liability || 0;
      const children = creditAccounts.filter(c => c.shared_limit_with === parent.id);
      children.forEach(c => outstanding += (c.liability || 0));
    } else {
      const children = creditAccounts.filter(c => c.shared_limit_with === card.id);
      children.forEach(c => outstanding += (c.liability || 0));
    }

    const utilization = limit > 0
      ? parseFloat(((outstanding / limit) * 100).toFixed(2))
      : 0;

    return {
      card_name: card.account_name,
      credit_limit: limit,
      outstanding,
      available: limit - outstanding,
      utilization_percentage: utilization,
      risk_warning: utilization > 30,
    };
  });
};

export const calculateInvestmentPL = (investments) => {
  return investments.map((inv) => {
    const invested = (inv.buy_price * inv.quantity) || inv.invested_amount || 0;
    const current = (inv.current_price * inv.quantity) || inv.current_value || inv.value || 0;
    const profit_loss = current - invested;
    const pl_percentage = invested > 0
      ? parseFloat(((profit_loss / invested) * 100).toFixed(2))
      : 0;

    const r = (v) => Math.round(v * 100) / 100;
    return {
      name: inv.name,
      investment_type: inv.investment_type,
      invested:      r(invested),
      current_value: r(current),
      profit_loss:   r(profit_loss),
      pl_percentage,
    };
  });
};

export const calculatePortfolioAllocation = (accounts, investments) => {
  let totals = { Equity: 0, Debt: 0, Gold: 0, Crypto: 0, Cash: 0 };
  
  accounts.filter(a => a.type !== 'credit').forEach(acc => {
    totals.Cash += (acc.balance || 0);
  });
  
  investments.forEach(inv => {
    const value = (inv.current_price * inv.quantity) || inv.current_value || inv.value || 0;
    const type = (inv.investment_type || 'Equity').toLowerCase();
    
    if (type.includes('debt') || type.includes('bond')) totals.Debt += value;
    else if (type.includes('gold')) totals.Gold += value;
    else if (type.includes('crypto')) totals.Crypto += value;
    else totals.Equity += value;
  });
  
  const totalValue = Object.values(totals).reduce((sum, val) => sum + val, 0);
  if (totalValue === 0) return { totals, percentages: { Equity: 0, Debt: 0, Gold: 0, Crypto: 0, Cash: 0 } };
  
  const percentages = {
    Equity: parseFloat(((totals.Equity / totalValue) * 100).toFixed(2)),
    Debt: parseFloat(((totals.Debt / totalValue) * 100).toFixed(2)),
    Gold: parseFloat(((totals.Gold / totalValue) * 100).toFixed(2)),
    Crypto: parseFloat(((totals.Crypto / totalValue) * 100).toFixed(2)),
    Cash: parseFloat(((totals.Cash / totalValue) * 100).toFixed(2)),
  };
  return { totals, percentages, totalValue };
};

export const calculateFinancialHealthScore = (savingsRateData, netWorthData, ccData, portfolioData) => {
  let score = 0;
  
  const savingsRate = savingsRateData.savings_rate || 0;
  score += Math.min(30, (savingsRate / 20) * 30);
  
  const totalDebt = netWorthData.total_cc_outstanding || 0;
  const totalAssets = netWorthData.total_accounts + netWorthData.total_investments;
  const debtRatio = totalAssets > 0 ? (totalDebt / totalAssets) : (totalDebt > 0 ? 1 : 0);
  score += Math.max(0, 30 - (debtRatio * 60));
  
  const monthlyExpenses = savingsRateData.expenses || 0;
  const targetEmergencyFund = monthlyExpenses > 0 ? monthlyExpenses * 3 : 1000;
  const currentCash = portfolioData.totals?.Cash || 0;
  score += Math.min(20, (currentCash / targetEmergencyFund) * 20);
  
  const percentages = portfolioData.percentages || {};
  const maxNonCashAllocation = Math.max(percentages.Equity||0, percentages.Debt||0, percentages.Gold||0, percentages.Crypto||0);
  if (totalAssets > 0) {
    if (maxNonCashAllocation < 80) {
      score += 20;
    } else {
      score += Math.max(0, (100 - maxNonCashAllocation));
    }
  }
  
  return Math.max(0, Math.min(100, Math.round(score)));
};

export const calculateXIRR = (cashflows) => {
  if (!cashflows || cashflows.length < 2) return 0;
  const hasPositive = cashflows.some(cf => cf.amount > 0);
  const hasNegative = cashflows.some(cf => cf.amount < 0);
  if (!hasPositive || !hasNegative) return 0;

  const daysInYear = 365.0;
  const f = (rate) => {
    let sum = 0;
    const d0 = new Date(cashflows[0].date);
    for (const cf of cashflows) {
      const d = new Date(cf.date);
      const years = (d - d0) / (daysInYear * 24 * 60 * 60 * 1000);
      sum += cf.amount / Math.pow(1 + rate, years);
    }
    return sum;
  };
  const df = (rate) => {
    let sum = 0;
    const d0 = new Date(cashflows[0].date);
    for (const cf of cashflows) {
      const d = new Date(cf.date);
      const years = (d - d0) / (daysInYear * 24 * 60 * 60 * 1000);
      if (years === 0) continue;
      sum -= (years * cf.amount) / Math.pow(1 + rate, years + 1);
    }
    return sum;
  };

  let rate = 0.1;
  for (let i = 0; i < 100; i++) {
    const fVal = f(rate);
    const dfVal = df(rate);
    if (Math.abs(dfVal) < 1e-10) break;
    const newRate = rate - fVal / dfVal;
    if (Math.abs(newRate - rate) < 1e-7) break;
    rate = newRate;
  }
  return parseFloat((rate * 100).toFixed(2));
};

export const calculateSIPGrowth = (monthlyAmount, annualReturnRate, years) => {
  const months = years * 12;
  const monthlyRate = annualReturnRate / 12 / 100;

  if (monthlyRate === 0) {
    return {
      total_invested: monthlyAmount * months,
      estimated_value: monthlyAmount * months,
      estimated_returns: 0,
    };
  }

  const futureValue = monthlyAmount * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate) * (1 + monthlyRate);

  return {
    total_invested: monthlyAmount * months,
    estimated_value: parseFloat(futureValue.toFixed(2)),
    estimated_returns: parseFloat((futureValue - monthlyAmount * months).toFixed(2)),
  };
};

export const calculateGoalCompletion = (goal) => {
  const remaining = Math.round((goal.target_amount - goal.current_amount) * 100) / 100;
  const progress = goal.target_amount > 0
    ? parseFloat(((goal.current_amount / goal.target_amount) * 100).toFixed(2))
    : 0;

  const deadline = new Date(goal.deadline);
  const now = new Date();
  const monthsRemaining = Math.max(0, (deadline.getFullYear() - now.getFullYear()) * 12 + (deadline.getMonth() - now.getMonth()));

  const monthlyRequired = monthsRemaining > 0
    ? parseFloat((remaining / monthsRemaining).toFixed(2))
    : remaining;

  return {
    goal_name: goal.goal_name,
    target_amount: goal.target_amount,
    current_amount: goal.current_amount,
    remaining,
    progress_percentage: progress,
    months_remaining: monthsRemaining,
    monthly_savings_required: monthlyRequired,
    on_track: monthlyRequired <= 0 || remaining <= 0,
  };
};

/* ─────────────────────────────────────────────
   Centralized Calculation Functions (v2)
───────────────────────────────────────────── */

/**
 * Compute cycle summary metrics from an aggregate document.
 * This is the SINGLE source of truth for cycle summary — used by Transactions, Dashboard, Reports.
 * @param {{ totalSpent: number, totalIncome: number, categoryBreakdown: Object }} aggregate
 * @param {{ daysElapsed: number, totalDays: number }} cycleInfo — from getCycleDayInfo()
 * @returns {{ totalSpent, totalIncome, topCategory, dailyAvg, savingsRate }}
 */
export const calculateCycleSummary = (aggregate, cycleInfo) => {
  const { totalSpent = 0, totalIncome = 0, categoryBreakdown = {} } = aggregate || {};
  const { daysElapsed = 1 } = cycleInfo || {};

  // Top spending category
  const topCategory = Object.entries(categoryBreakdown)
    .filter(([cat]) => cat !== 'Income')
    .sort((a, b) => b[1] - a[1])[0]?.[0] || '—';

  // Daily average spending
  const dailyAvg = daysElapsed > 0 ? totalSpent / daysElapsed : 0;

  // Savings rate
  const savingsRate = totalIncome > 0
    ? parseFloat((((totalIncome - totalSpent) / totalIncome) * 100).toFixed(1))
    : 0;

  return {
    totalSpent: Math.round(totalSpent * 100) / 100,
    totalIncome: Math.round(totalIncome * 100) / 100,
    topCategory,
    dailyAvg: Math.round(dailyAvg * 100) / 100,
    savingsRate,
  };
};

/**
 * Budget forecast — predict whether a category will exceed its limit by cycle end.
 * @param {number} spent - amount spent so far
 * @param {number} limit - budget limit
 * @param {number} daysElapsed
 * @param {number} totalDays
 * @returns {{ projectedSpend, willExceed, dailyAvg, safeDailyBudget, overBy, daysLeft }}
 */
export const calculateBudgetForecast = (spent, limit, daysElapsed, totalDays) => {
  const daysLeft = Math.max(0, totalDays - daysElapsed);
  const dailyAvg = daysElapsed > 0 ? spent / daysElapsed : 0;
  const projectedSpend = dailyAvg * totalDays;
  const willExceed = projectedSpend > limit && spent < limit;
  const remaining = Math.max(0, limit - spent);
  const safeDailyBudget = daysLeft > 0 ? remaining / daysLeft : 0;
  const overBy = Math.max(0, spent - limit);

  return {
    projectedSpend: Math.round(projectedSpend * 100) / 100,
    willExceed,
    dailyAvg: Math.round(dailyAvg * 100) / 100,
    safeDailyBudget: Math.round(safeDailyBudget * 100) / 100,
    overBy: Math.round(overBy * 100) / 100,
    daysLeft,
    remaining: Math.round(remaining * 100) / 100,
  };
};

/**
 * Goal projection — estimate when a goal will be reached based on average contribution rate.
 * @param {{ target_amount: number, current_amount: number, deadline: string }} goal
 * @param {number} avgMonthlyContribution — average amount saved per month toward this goal
 * @returns {{ estimatedMonths, estimatedDate, onTrack, suggestedMonthly, progressPct }}
 */
export const calculateGoalProjection = (goal, avgMonthlyContribution = 0) => {
  const remaining = Math.max(0, goal.target_amount - goal.current_amount);
  const progressPct = goal.target_amount > 0
    ? parseFloat(((goal.current_amount / goal.target_amount) * 100).toFixed(1))
    : 0;

  if (remaining <= 0) {
    return { estimatedMonths: 0, estimatedDate: null, onTrack: true, suggestedMonthly: 0, progressPct: 100 };
  }

  // Months remaining until deadline
  const deadline = goal.deadline ? new Date(goal.deadline) : null;
  const now = new Date();
  const deadlineMonths = deadline
    ? Math.max(0, (deadline.getFullYear() - now.getFullYear()) * 12 + (deadline.getMonth() - now.getMonth()))
    : null;

  // Estimated months at current saving rate
  const estimatedMonths = avgMonthlyContribution > 0
    ? Math.ceil(remaining / avgMonthlyContribution)
    : null;

  // Estimated completion date
  const estimatedDate = estimatedMonths !== null
    ? new Date(now.getFullYear(), now.getMonth() + estimatedMonths, now.getDate()).toISOString().split('T')[0]
    : null;

  // Is the goal on track to be reached before the deadline?
  const onTrack = estimatedMonths !== null && deadlineMonths !== null
    ? estimatedMonths <= deadlineMonths
    : false;

  // Suggested monthly savings to reach goal on time
  const suggestedMonthly = deadlineMonths && deadlineMonths > 0
    ? Math.round((remaining / deadlineMonths) * 100) / 100
    : remaining;

  return { estimatedMonths, estimatedDate, onTrack, suggestedMonthly, progressPct };
};

/**
 * Credit card health assessment — unified utilization and risk analysis.
 * Resolves shared limits automatically.
 * @param {Object} card - the active credit card
 * @param {Object[]} allCards - all credit cards (for shared limit resolution)
 * @returns {{ utilization, riskLevel, riskColor, paymentAdvice, idealPayment }}
 */
export const calculateCreditCardHealth = (card, allCards = []) => {
  let limit = parseFloat(card.credit_limit || 0);
  let outstanding = parseFloat(card.liability || 0);

  // Resolve shared limits
  if (card.shared_limit_with) {
    // This card is a child — find parent, use parent's limit
    const parent = allCards.find(c => c.id === card.shared_limit_with) || card;
    limit = parseFloat(parent.credit_limit || 0);
    // Outstanding = parent's own liability + all children's liabilities (including this card)
    outstanding = parseFloat(parent.liability || 0);
    allCards
      .filter(c => c.shared_limit_with === parent.id)
      .forEach(c => { outstanding += parseFloat(c.liability || 0); });
  } else {
    // This card is standalone or a parent — outstanding = own + all children
    allCards
      .filter(c => c.shared_limit_with === card.id)
      .forEach(c => { outstanding += parseFloat(c.liability || 0); });
  }

  const utilization = limit > 0
    ? parseFloat(((outstanding / limit) * 100).toFixed(1))
    : 0;

  // Risk levels
  let riskLevel, riskColor;
  if (utilization > 90)      { riskLevel = 'Critical'; riskColor = '#ef4444'; }
  else if (utilization > 60) { riskLevel = 'Warning';  riskColor = '#f97316'; }
  else if (utilization > 30) { riskLevel = 'Moderate'; riskColor = '#f59e0b'; }
  else                       { riskLevel = 'Safe';     riskColor = '#10b981'; }

  // Payment advice: how much to pay to bring utilization to 30%
  const ideal30 = limit * 0.3;
  const idealPayment = outstanding > ideal30 ? Math.round((outstanding - ideal30) * 100) / 100 : 0;

  let paymentAdvice = '';
  if (outstanding <= 0) {
    paymentAdvice = 'All clear! No outstanding balance.';
  } else if (utilization <= 30) {
    paymentAdvice = `Utilization is healthy at ${utilization}%.`;
  } else {
    paymentAdvice = `Pay ₹${idealPayment.toLocaleString('en-IN')} to bring utilization below 30%.`;
  }

  return { utilization, riskLevel, riskColor, paymentAdvice, idealPayment, outstanding, limit };
};

/**
 * Compare two cycle aggregates to generate trend data.
 * @param {{ totalSpent: number, totalIncome: number, categoryBreakdown: Object }} current
 * @param {{ totalSpent: number, totalIncome: number, categoryBreakdown: Object }} previous
 * @returns {{ spendingChange, incomeChange, spendingPctChange, incomePctChange, categoryChanges }}
 */
export const compareCycles = (current, previous) => {
  const curr = current || { totalSpent: 0, totalIncome: 0, categoryBreakdown: {} };
  const prev = previous || { totalSpent: 0, totalIncome: 0, categoryBreakdown: {} };

  const spendingChange = curr.totalSpent - prev.totalSpent;
  const incomeChange = curr.totalIncome - prev.totalIncome;

  const spendingPctChange = prev.totalSpent > 0
    ? parseFloat(((spendingChange / prev.totalSpent) * 100).toFixed(1))
    : (curr.totalSpent > 0 ? 100 : 0);

  const incomePctChange = prev.totalIncome > 0
    ? parseFloat(((incomeChange / prev.totalIncome) * 100).toFixed(1))
    : (curr.totalIncome > 0 ? 100 : 0);

  // Category-level changes
  const allCats = new Set([
    ...Object.keys(curr.categoryBreakdown || {}),
    ...Object.keys(prev.categoryBreakdown || {}),
  ]);

  const SKIP_CATS_COMPARE = new Set(['Income', 'Transfer', 'Credit Card Payment']);

  const categoryChanges = [];
  allCats.forEach(cat => {
    if (SKIP_CATS_COMPARE.has(cat)) return;
    const currVal = (curr.categoryBreakdown || {})[cat] || 0;
    const prevVal = (prev.categoryBreakdown || {})[cat] || 0;
    const change = currVal - prevVal;
    const pctChange = prevVal > 0 ? parseFloat(((change / prevVal) * 100).toFixed(1)) : (currVal > 0 ? 100 : 0);
    categoryChanges.push({ category: cat, current: currVal, previous: prevVal, change, pctChange });
  });

  categoryChanges.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

  return { spendingChange, incomeChange, spendingPctChange, incomePctChange, categoryChanges };
};
