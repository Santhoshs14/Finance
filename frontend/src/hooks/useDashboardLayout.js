import { useState, useCallback, useEffect } from 'react';

// ─── Widget Registry ───────────────────────────────────────────────────────────
// Single source of truth for all dashboard widgets.
// Order here = default order for new users.
export const WIDGET_REGISTRY = [
  {
    id: 'kpi_cards',
    title: 'KPI Overview',
    description: 'Net worth, balance, savings & liabilities',
    icon: '📊',
    defaultW: 12, defaultH: 2, minW: 4, minH: 2,
    removable: false, // always visible
    flipInfo: {
      title: 'Key Performance Indicators',
      what: 'A snapshot of your core financial metrics — net worth, account balance, total savings, liabilities, and savings rate.',
      how: 'Net Worth = Bank Accounts + Investments − Liabilities. Savings Rate = (Savings This Cycle / Total Income) × 100.',
      why: 'These numbers tell you your overall financial health at a glance. Positive net worth and a savings rate >20% are strong indicators of financial wellbeing.',
      trend: 'Track monthly changes in net worth to measure long-term progress.',
    },
  },
  {
    id: 'cash_flow',
    title: 'Cash Flow',
    description: 'Income, expenses, and cycle progress',
    icon: '💸',
    defaultW: 6, defaultH: 2, minW: 3, minH: 2,
    flipInfo: {
      title: 'Cash Flow Analysis',
      what: 'Shows your total income, total expenses, net savings, and daily average spending for the current financial cycle.',
      how: 'Net Savings = Income − Expenses. Daily Avg = Total Expenses ÷ Days Elapsed in cycle. Credit card transactions are excluded.',
      why: 'Understanding your cash flow tells you if you\'re living within your means. Positive net savings means you\'re building wealth.',
      trend: 'A consistently positive cash flow each cycle is the foundation of financial growth.',
    },
  },
  {
    id: 'health_score',
    title: 'Financial Health',
    description: 'Composite health score gauge',
    icon: '❤️',
    defaultW: 6, defaultH: 2, minW: 3, minH: 2,
    flipInfo: {
      title: 'Financial Health Score',
      what: 'A composite score (0-100) measuring your overall financial wellness based on savings rate, budget discipline, credit utilization, and spending consistency.',
      how: 'Score = Savings Rate (30pts) + Budget Adherence (25pts) + CC Utilization (25pts) + Spending Consistency (20pts)',
      why: 'A single number to quickly assess how well you\'re managing your finances. Aim for 70+ for good financial health.',
      trend: 'Scores above 80 indicate excellent financial habits. Improve by reducing CC utilization and staying within budget limits.',
    },
  },
  {
    id: 'savings_rate_widget',
    title: 'Savings Rate',
    description: 'Visual savings rate with targets and trend',
    icon: '💰',
    defaultW: 4, defaultH: 2, minW: 3, minH: 2,
    flipInfo: {
      title: 'Savings Rate Breakdown',
      what: 'Your savings rate as a percentage of income, with a visual comparison against recommended benchmarks.',
      how: 'Savings Rate = (Amount Saved This Cycle / Total Income) × 100. Saved = Investment + Savings category transactions.',
      why: 'Financial experts recommend saving at least 20% of income (50/30/20 rule). Higher savings rates accelerate wealth building.',
      trend: 'Tracking this monthly helps you stay accountable to your savings goals.',
    },
  },
  {
    id: 'heatmap',
    title: 'Spending Heatmap',
    description: 'Daily spend intensity (last 35 days)',
    icon: '🔥',
    defaultW: 8, defaultH: 2, minW: 6, minH: 2,
    flipInfo: {
      title: 'Spending Heatmap',
      what: 'A visual calendar showing daily spending intensity over the last 35 days. Darker colors = higher spending.',
      how: 'Each cell represents one day. Color intensity is proportional to spending relative to your highest single-day spend.',
      why: 'Helps identify spending patterns, "danger days", and whether you tend to overspend on specific days of the week.',
      trend: 'Uniform light colors = consistent spending. Isolated dark spots = one-time high expenses.',
    },
  },
  {
    id: 'category_chart',
    title: 'Category Breakdown',
    description: 'Spending by category this cycle',
    icon: '🥧',
    defaultW: 6, defaultH: 3, minW: 4, minH: 3,
    flipInfo: {
      title: 'Category Spending Breakdown',
      what: 'A pie chart showing what percentage of your spending went to each category this financial cycle.',
      how: 'Only expense transactions (negative amounts) are included. Credit card and transfer transactions are excluded.',
      why: 'Identifying your top spending categories helps you find areas to cut back and optimize your budget.',
      trend: 'Food & dining and entertainment typically top the list. Aim to keep discretionary spending below 30% of income.',
    },
  },
  {
    id: 'budget_progress',
    title: 'Budget Progress',
    description: 'Spending vs budget limits',
    icon: '🎯',
    defaultW: 6, defaultH: 3, minW: 4, minH: 2,
    flipInfo: {
      title: 'Budget Progress Tracker',
      what: 'Shows how much you\'ve spent vs. your set budget limit for each category this cycle.',
      how: 'Progress bar = Spent ÷ Budget Limit. Red = over budget, amber = within 20% of limit, green = safe.',
      why: 'Budget adherence is one of the strongest predictors of financial success. Staying within limits ensures you meet savings goals.',
      trend: 'Review budgets monthly and adjust limits based on actual spending patterns.',
    },
  },
  {
    id: 'burn_rate',
    title: 'Burn Rate & Runway',
    description: 'How fast you\'re spending vs income',
    icon: '🚀',
    defaultW: 6, defaultH: 2, minW: 4, minH: 2,
    flipInfo: {
      title: 'Burn Rate Analysis',
      what: 'Your burn rate is the pace at which you\'re spending money relative to your income. Runway = how many months your savings can sustain current spending.',
      how: 'Burn Rate = Daily Avg Spend × 30 days. Runway = (Account Balance + Investments) ÷ Monthly Burn Rate.',
      why: 'Understanding your runway is critical for financial security. A minimum 3-6 month emergency fund is recommended.',
      trend: 'A burn rate significantly below income means you\'re building a financial cushion.',
    },
  },
  {
    id: 'risk_alerts',
    title: 'Risk & Recommendations',
    description: 'Alerts, smart tips, and spending leaks',
    icon: '⚠️',
    defaultW: 12, defaultH: 2, minW: 6, minH: 2,
    flipInfo: {
      title: 'Risk Alerts System',
      what: 'Real-time alerts about budget overruns, low account balances, high credit utilization, and unusual spending patterns.',
      how: 'Alerts are triggered when: spending >80% of budget limit, account balance <₹1000, CC utilization >70%, or spending jumps >30% vs last cycle.',
      why: 'Early warning systems help you course-correct before small issues become financial emergencies.',
      trend: 'Zero alerts = excellent financial hygiene. Aim to resolve all alerts within the same billing cycle.',
    },
  },
  {
    id: 'behavioral',
    title: 'Behavioral Insights',
    description: 'Patterns, daily avg, and top categories',
    icon: '🧠',
    defaultW: 6, defaultH: 3, minW: 4, minH: 2,
    flipInfo: {
      title: 'Behavioral Finance Insights',
      what: 'Analysis of your spending patterns — daily averages, most frequent categories, highest spending days, and transaction frequency.',
      how: 'Derived from all expense transactions this cycle. Spending leaks = categories with 3+ transactions averaging under ₹600.',
      why: 'Behavioral patterns often drive spending unconsciously. Awareness of your habits is the first step to changing them.',
      trend: 'High transaction frequency in small-ticket categories often signals impulse spending that adds up significantly.',
    },
  },
  {
    id: 'recent_txns',
    title: 'Recent Transactions',
    description: 'Latest activity feed',
    icon: '🔄',
    defaultW: 6, defaultH: 3, minW: 4, minH: 3,
    flipInfo: {
      title: 'Transaction Activity Feed',
      what: 'Your 6 most recent transactions across all accounts, showing date, category, and amount.',
      how: 'Pulls from your transaction history sorted by most recent. Click "View all" to go to the full transactions page.',
      why: 'Quick visibility into recent spending helps catch unauthorized transactions and keep spending top of mind.',
      trend: 'Review daily to stay aware of your spending and catch any errors early.',
    },
  },
  {
    id: 'goals',
    title: 'Goals & Credit Health',
    description: 'Goal progress and credit card utilization',
    icon: '🏆',
    defaultW: 12, defaultH: 3, minW: 6, minH: 3,
    flipInfo: {
      title: 'Goals & Credit Overview',
      what: 'Tracks progress toward your financial goals and shows credit card utilization health across all cards.',
      how: 'Goal % = Current Saved ÷ Target Amount. Required monthly = Remaining ÷ Months Left until deadline. CC utilization = Outstanding ÷ Credit Limit.',
      why: 'Goal tracking maintains motivation. Credit utilization below 30% positively impacts your credit score.',
      trend: 'Set specific, time-bound goals. Pay down cards to keep utilization in the green zone.',
    },
  },
  {
    id: 'expense_income_ratio',
    title: 'Expense/Income Ratio',
    description: 'Visual ratio of expenses vs income',
    icon: '⚖️',
    defaultW: 6, defaultH: 2, minW: 4, minH: 2,
    flipInfo: {
      title: 'Expense-to-Income Ratio',
      what: 'Compares your total expenses against total income for the current cycle as a visual bar chart.',
      how: 'Ratio = Total Expenses ÷ Total Income. Values below 80% indicate healthy spending. Above 100% means you\'re spending more than you earn.',
      why: 'The expense-to-income ratio is a core indicator of financial sustainability.',
      trend: 'Target keeping expenses below 70% of income to allow for savings and investments.',
    },
  },
  {
    id: 'credit_utilization_summary',
    title: 'Credit Utilization',
    description: 'All cards combined utilization and health',
    icon: '💳',
    defaultW: 6, defaultH: 2, minW: 4, minH: 2,
    flipInfo: {
      title: 'Credit Utilization Summary',
      what: 'Combined credit utilization across all your credit cards — total outstanding vs total credit limit.',
      how: 'Combined Utilization = Total Outstanding Across All Cards ÷ Total Combined Credit Limit × 100.',
      why: 'Credit utilization above 30% negatively impacts your credit score. Keeping it below 10% is ideal for excellent credit.',
      trend: 'Paying more than the minimum each month and spreading balances across cards helps keep utilization low.',
    },
  },
];

// Build the default layout from the registry
const buildDefaultLayout = () =>
  WIDGET_REGISTRY.map((w, i) => ({
    i: w.id,
    id: w.id,
    visible: true,
    w: w.defaultW,
    h: w.defaultH,
    x: (i * 4) % 12, // simple auto-placement
    y: Math.floor(i / 3) * 2,
    minW: w.minW,
    minH: w.minH,
  }));

// ─── Hook ──────────────────────────────────────────────────────────────────────
export function useDashboardLayout(uid) {
  const storageKey = uid ? `wf_dashboard_layout_v2_${uid}` : null;

  const loadLayout = useCallback(() => {
    if (!storageKey) return buildDefaultLayout();
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return buildDefaultLayout();
      const saved = JSON.parse(raw);
      // Merge saved with registry — add any NEW widgets at the end,
      // and remove any old ones that no longer exist in registry.
      const registryIds = new Set(WIDGET_REGISTRY.map((w) => w.id));
      const savedIds = new Set(saved.map((w) => w.id || w.i));
      let merged = saved.filter((w) => registryIds.has(w.id || w.i)).map(w => {
        // Migration for old format without x/y/w/h
        const reg = WIDGET_REGISTRY.find((r) => r.id === (w.id || w.i));
        const mappedW = w.w || (w.size === 'full' ? 12 : w.size === 'large' ? 8 : w.size === 'small' ? 3 : 6);
        return {
          i: w.id || w.i,
          id: w.id || w.i,
          visible: w.visible ?? true,
          w: mappedW,
          h: w.h || reg?.defaultH || 2,
          x: w.x || 0,
          y: w.y || 0,
          minW: reg?.minW || 2,
          minH: reg?.minH || 2,
        };
      });
      
      // Auto-place missing widgets
      let max_y = Math.max(0, ...merged.map(w => w.y + w.h));
      WIDGET_REGISTRY.forEach((w) => {
        if (!savedIds.has(w.id)) {
          merged.push({ i: w.id, id: w.id, visible: true, w: w.defaultW, h: w.defaultH, x: 0, y: max_y, minW: w.minW, minH: w.minH });
          max_y += w.defaultH;
        }
      });

      // Enforce non-removable widgets as always visible
      return merged.map((w) => {
        const reg = WIDGET_REGISTRY.find((r) => r.id === w.id);
        return reg?.removable === false ? { ...w, visible: true } : w;
      });
    } catch {
      return buildDefaultLayout();
    }
  }, [storageKey]);

  const [layout, setLayoutState] = useState(loadLayout);

  // Persist whenever layout changes
  useEffect(() => {
    if (!storageKey) return;
    localStorage.setItem(storageKey, JSON.stringify(layout));
  }, [layout, storageKey]);

  // Reload layout when uid changes (user switch)
  useEffect(() => {
    setLayoutState(loadLayout());
  }, [storageKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const setLayout = useCallback((newLayoutArray) => {
    setLayoutState((prev) => {
      // newLayoutArray only contains visible widgets.
      // Update the previous layout so we don't lose hidden ones.
      return prev.map(p => {
        const updated = newLayoutArray.find(n => (n.i === p.id || n.i === p.i));
        return updated ? { ...updated, visible: p.visible, id: p.id || p.i, minW: p.minW, minH: p.minH } : p;
      });
    });
  }, []);

  const toggleWidget = useCallback((id) => {
    setLayoutState((prev) =>
      prev.map((w) => (w.id === id || w.i === id ? { ...w, visible: !w.visible } : w))
    );
  }, []);

  const resizeWidget = useCallback((id, sizeObj) => {
    // Only used conceptually if there are preset buttons, but React-Grid-Layout uses handle drag.
  }, []);

  const resetLayout = useCallback(() => {
    setLayoutState(buildDefaultLayout());
    if (storageKey) localStorage.removeItem(storageKey);
  }, [storageKey]);

  return { layout, setLayout, toggleWidget, resizeWidget, resetLayout };
}
