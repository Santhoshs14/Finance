/**
 * Financial Calculations Utility
 * Net worth, savings rate, budget usage, CC utilization,
 * investment P/L, XIRR, SIP growth, goal completion
 */

/**
 * Calculate net worth = sum of all account balances + investment value - credit card outstanding
 */
const calculateNetWorth = (accounts, investments, creditCards, creditCardTransactions) => {
  const totalAccountBalance = accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);
  const totalInvestmentValue = investments.reduce((sum, inv) => sum + (inv.current_price * inv.quantity), 0);

  // Calculate outstanding per credit card
  const ccOutstanding = creditCardTransactions.reduce((sum, txn) => sum + (txn.amount || 0), 0);

  return {
    total_accounts: totalAccountBalance,
    total_investments: totalInvestmentValue,
    total_cc_outstanding: ccOutstanding,
    net_worth: totalAccountBalance + totalInvestmentValue - ccOutstanding,
  };
};

/**
 * Total Savings = sum of investment portfolio current values ONLY
 * (Account balances are liquidity, not "savings" in investment sense)
 */
const calculateTotalSavings = (investments) => {
  return investments.reduce((sum, inv) => sum + (inv.current_price * inv.quantity), 0);
};

/**
 * Total Liabilities = CC outstanding balance + pending lending (money owed TO user as debtor)
 */
const calculateTotalLiabilities = (creditCards, creditCardTransactions, lendingItems = []) => {
  const ccOutstanding = creditCardTransactions.reduce((sum, txn) => sum + (txn.amount || 0), 0);
  // Lending where user is borrower (type === 'borrowed')
  const borrowedAmount = lendingItems
    .filter(l => l.type === 'borrowed' && l.status !== 'paid')
    .reduce((sum, l) => sum + ((l.amount || 0) - (l.paid_amount || 0)), 0);
  return {
    cc_outstanding: ccOutstanding,
    borrowed: borrowedAmount,
    total: ccOutstanding + borrowedAmount,
  };
};

/**
 * Savings rate = (income - expenses) / income * 100
 */
const calculateSavingsRate = (transactions, month, year) => {
  const monthTxns = transactions.filter((txn) => {
    const d = new Date(txn.date);
    return d.getMonth() + 1 === month && d.getFullYear() === year;
  });

  const income = monthTxns
    .filter((txn) => txn.category === 'Income' || txn.amount > 0)
    .reduce((sum, txn) => sum + Math.abs(txn.amount), 0);

  const expenses = monthTxns
    .filter((txn) => txn.category !== 'Income' && txn.amount < 0)
    .reduce((sum, txn) => sum + Math.abs(txn.amount), 0);

  if (income === 0) return { income, expenses, savings: 0, savings_rate: 0 };

  const savings = income - expenses;
  const savings_rate = ((savings / income) * 100).toFixed(2);

  return { income, expenses, savings, savings_rate: parseFloat(savings_rate) };
};

/**
 * Budget usage percentage per category
 */
const calculateBudgetUsage = (budgets, transactions, month, year) => {
  const monthTxns = transactions.filter((txn) => {
    const d = new Date(txn.date);
    return d.getMonth() + 1 === month && d.getFullYear() === year;
  });

  return budgets.map((budget) => {
    const spent = monthTxns
      .filter((txn) => txn.category === budget.category)
      .reduce((sum, txn) => sum + Math.abs(txn.amount), 0);

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

/**
 * Credit card utilization = outstanding / credit_limit * 100
 * Warn user when utilization exceeds 30 percent.
 */
const calculateCCUtilization = (creditCards, creditCardTransactions) => {
  return creditCards.map((card) => {
    const outstanding = creditCardTransactions
      .filter((txn) => txn.credit_card_id === card.id)
      .reduce((sum, txn) => sum + (txn.amount || 0), 0);

    const utilization = card.credit_limit > 0
      ? parseFloat(((outstanding / card.credit_limit) * 100).toFixed(2))
      : 0;

    return {
      card_name: card.card_name,
      credit_limit: card.credit_limit,
      outstanding,
      available: card.credit_limit - outstanding,
      utilization_percentage: utilization,
      risk_warning: utilization > 30, // 30% rule
    };
  });
};

/**
 * Investment profit/loss
 */
const calculateInvestmentPL = (investments) => {
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

/**
 * Portfolio Allocation (Equity, Debt, Gold, Crypto, Cash)
 */
const calculatePortfolioAllocation = (accounts, investments) => {
  let totals = { Equity: 0, Debt: 0, Gold: 0, Crypto: 0, Cash: 0 };
  
  // Categorize accounts as cash
  accounts.forEach(acc => {
    totals.Cash += (acc.balance || 0);
  });
  
  // Categorize investments
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

/**
 * Financial Health Score (0-100)
 * Savings Rate (30%), Debt Ratio (30%), Emergency Fund Coverage (20%), Investment Diversification (20%)
 */
const calculateFinancialHealthScore = (savingsRateData, netWorthData, ccData, portfolioData) => {
  let score = 0;
  
  // 1. Savings Rate (30 points) - 20% or more gets full points
  const savingsRate = savingsRateData.savings_rate || 0;
  score += Math.min(30, (savingsRate / 20) * 30);
  
  // 2. Debt Ratio (30 points) - Lower is better. Full points if 0 debt.
  const totalDebt = netWorthData.total_cc_outstanding || 0;
  const totalAssets = netWorthData.total_accounts + netWorthData.total_investments;
  const debtRatio = totalAssets > 0 ? (totalDebt / totalAssets) : (totalDebt > 0 ? 1 : 0);
  score += Math.max(0, 30 - (debtRatio * 60)); // 50% debt ratio = 0 points
  
  // 3. Emergency Fund (20 points) - Cash covering 3x monthly expenses gets full points
  const monthlyExpenses = savingsRateData.expenses || 0;
  const targetEmergencyFund = monthlyExpenses > 0 ? monthlyExpenses * 3 : 1000;
  const currentCash = portfolioData.totals?.Cash || 0;
  score += Math.min(20, (currentCash / targetEmergencyFund) * 20);
  
  // 4. Diversification (20 points) - Having < 80% in one asset type (excluding Cash) gets full points
  const percentages = portfolioData.percentages || {};
  const maxNonCashAllocation = Math.max(percentages.Equity||0, percentages.Debt||0, percentages.Gold||0, percentages.Crypto||0);
  if (totalAssets === 0) {
    // neutral points if no assets
  } else if (maxNonCashAllocation < 80) {
    score += 20;
  } else {
    score += (100 - maxNonCashAllocation) * (20 / 20); // Scale down if heavily concentrated
  }
  
  return Math.max(0, Math.min(100, Math.round(score)));
};

/**
 * XIRR calculation for mutual fund returns
 * Uses Newton-Raphson method
 */
const calculateXIRR = (cashflows) => {
  // cashflows: [{ amount, date }] where negative = investment, positive = redemption
  if (!cashflows || cashflows.length < 2) return 0;

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

/**
 * SIP Growth Projection
 * FV = P × [{(1 + r)^n - 1} / r] × (1 + r)
 */
const calculateSIPGrowth = (monthlyAmount, annualReturnRate, years) => {
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

/**
 * Goal completion estimation
 */
const calculateGoalCompletion = (goal) => {
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

module.exports = {
  calculateNetWorth,
  calculateTotalSavings,
  calculateTotalLiabilities,
  calculateSavingsRate,
  calculateBudgetUsage,
  calculateCCUtilization,
  calculateInvestmentPL,
  calculatePortfolioAllocation,
  calculateFinancialHealthScore,
  calculateXIRR,
  calculateSIPGrowth,
  calculateGoalCompletion,
};
