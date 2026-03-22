/**
 * Financial Calculations Utility
 * Net worth, savings rate, budget usage, CC utilization,
 * investment P/L, XIRR, SIP growth, goal completion
 */

export const calculateNetWorth = (accounts, investments, lendingItems = []) => {
  const bankAccounts = accounts.filter(a => a.type !== 'credit');
  const creditAccounts = accounts.filter(a => a.type === 'credit');

  const totalAccountBalance = bankAccounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);
  const totalInvestmentValue = investments.reduce((sum, inv) => sum + (inv.current_price * inv.quantity), 0);

  const ccOutstanding = creditAccounts.reduce((sum, cc) => sum + (cc.liability || 0), 0);

  const lentAmount = lendingItems
    .filter(l => l.type === 'lent' && l.status !== 'paid')
    .reduce((sum, l) => sum + ((l.amount || 0) - (l.paid_amount || 0)), 0);

  const borrowedAmount = lendingItems
    .filter(l => l.type === 'borrowed' && l.status !== 'paid')
    .reduce((sum, l) => sum + ((l.amount || 0) - (l.paid_amount || 0)), 0);

  return {
    total_accounts: totalAccountBalance,
    total_investments: totalInvestmentValue,
    total_cc_outstanding: ccOutstanding,
    total_lent: lentAmount,
    total_borrowed: borrowedAmount,
    net_worth: totalAccountBalance + totalInvestmentValue + lentAmount - ccOutstanding - borrowedAmount,
  };
};

export const calculateTotalSavings = (investments) => {
  return investments.reduce((sum, inv) => sum + (inv.current_price * inv.quantity), 0);
};

export const calculateTotalLiabilities = (accounts, lendingItems = []) => {
  const creditAccounts = accounts.filter(a => a.type === 'credit');
  const ccOutstanding = creditAccounts.reduce((sum, cc) => sum + (cc.liability || 0), 0);

  const borrowedAmount = lendingItems
    .filter(l => l.type === 'borrowed' && l.status !== 'paid')
    .reduce((sum, l) => sum + ((l.amount || 0) - (l.paid_amount || 0)), 0);
  return {
    cc_outstanding: ccOutstanding,
    borrowed: borrowedAmount,
    total: ccOutstanding + borrowedAmount,
  };
};

// Frontend aggregates mode: we already have aggregate data built (totalSpent, totalIncome).
export const calculateSavingsRateFromAggregates = (aggregate) => {
  const income = aggregate?.totalIncome || 0;
  const expenses = aggregate?.totalSpent || 0;
  if (income === 0) return { income, expenses, savings: 0, savings_rate: 0 };
  const savings = income - expenses;
  const savings_rate = ((savings / income) * 100).toFixed(2);
  return { income, expenses, savings, savings_rate: parseFloat(savings_rate) };
};

export const calculateBudgetUsageFromAggregates = (budgets, aggregate) => {
  const categories = aggregate?.categoryBreakdown || {};
  return budgets.map((budget) => {
    const spent = categories[budget.category] || 0;
    const usage_percentage = budget.monthly_limit > 0
      ? parseFloat(((spent / budget.monthly_limit) * 100).toFixed(2))
      : 0;
    return {
      category: budget.category,
      monthly_limit: budget.monthly_limit,
      spent,
      remaining: budget.monthly_limit - spent,
      usage_percentage,
      over_budget: spent > budget.monthly_limit,
    };
  });
};

export const calculateCCUtilization = (accounts) => {
  const creditAccounts = accounts.filter(a => a.type === 'credit');
  return creditAccounts.map((card) => {
    const outstanding = card.liability || 0;
    const utilization = card.credit_limit > 0
      ? parseFloat(((outstanding / card.credit_limit) * 100).toFixed(2))
      : 0;

    return {
      card_name: card.account_name,
      credit_limit: card.credit_limit,
      outstanding,
      available: card.credit_limit - outstanding,
      utilization_percentage: utilization,
      risk_warning: utilization > 30,
    };
  });
};

export const calculateInvestmentPL = (investments) => {
  return investments.map((inv) => {
    const invested = inv.buy_price * inv.quantity;
    const current = inv.current_price * inv.quantity;
    const profit_loss = current - invested;
    const pl_percentage = invested > 0
      ? parseFloat(((profit_loss / invested) * 100).toFixed(2))
      : 0;

    return {
      name: inv.name,
      investment_type: inv.investment_type,
      invested,
      current_value: current,
      profit_loss,
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
    const value = inv.current_price * inv.quantity;
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
  const remaining = goal.target_amount - goal.current_amount;
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
