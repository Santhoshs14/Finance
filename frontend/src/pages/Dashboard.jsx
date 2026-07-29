import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Responsive as ResponsiveGridLayout, useContainerWidth } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, CartesianGrid,
} from 'recharts';
import CountUp from 'react-countup';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { useTheme } from '../context/ThemeContext';
import { getShortFinancialMonthLabelForDate, getFinancialCycle, getRecentFinancialMonths, getCycleDayInfo } from '../utils/financialMonth';
import TransactionTable from '../components/TransactionTable';
import QuickAddTransaction from '../components/QuickAddTransaction';
import DashboardCustomizer from '../components/dashboard/DashboardCustomizer';
import { useDashboardLayout, WIDGET_REGISTRY } from '../hooks/useDashboardLayout';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { db } from '../config/firebase';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { transactionsAPI, budgetSnapshotsAPI } from '../services/api';
import { generateInsightsFromAggregates, generateCycleComparisonInsights } from '../utils/insights';
import { calculateCycleSummary, calculateCreditCardHealth } from '../utils/calculations';
import {
  ArrowUpIcon, ArrowDownIcon, PlusIcon,
  ScaleIcon, BanknotesIcon, ChartBarIcon,
  ShieldCheckIcon, ArrowTrendingUpIcon, ExclamationTriangleIcon,
  LightBulbIcon, FireIcon, CreditCardIcon, SparklesIcon,
  CheckCircleIcon, FlagIcon, AdjustmentsHorizontalIcon,
  Bars3Icon, XMarkIcon, PencilSquareIcon,
} from '@heroicons/react/24/outline';
import { fmt } from '../utils/format';
import CustomTooltip from '../components/CustomTooltip';

/* ════════════════════════════════════════════════════════════════
   SHARED SUB-COMPONENTS
   ════════════════════════════════════════════════════════════════ */

/* ─── KPI Card ─── */
const KpiCard = ({ label, value, icon: Icon, color, isDark, isPercent, onClick, trend }) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
    className="glass-card interactive-card"
    onClick={onClick}
    style={{
      padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 10,
      cursor: onClick ? 'pointer' : 'default',
    }}
    whileHover={onClick ? { scale: 1.02 } : {}}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: isDark ? '#9ca3af' : '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
      <div style={{ width: 32, height: 32, borderRadius: 9, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon style={{ width: 16, height: 16, color }} />
      </div>
    </div>
    <p style={{ fontSize: 24, fontWeight: 800, color: isDark ? '#f3f4f6' : '#111827', margin: 0, letterSpacing: '-0.5px' }}>
      {isPercent
        ? <CountUp end={value} decimals={1} suffix="%" duration={1.2} />
        : <CountUp end={value} decimals={0} duration={1.2}
            formattingFn={(n) => '₹' + new Intl.NumberFormat('en-IN').format(n)} />
      }
    </p>
    {trend !== undefined && trend !== null && trend !== 0 && (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {trend > 0
          ? <ArrowUpIcon style={{ width: 11, height: 11, color: isPercent || label === 'Total Savings' ? '#10b981' : '#ef4444' }} />
          : <ArrowDownIcon style={{ width: 11, height: 11, color: isPercent || label === 'Total Savings' ? '#ef4444' : '#10b981' }} />
        }
        <span style={{ fontSize: 11, fontWeight: 600, color: isDark ? '#9ca3af' : '#6b7280' }}>
          {Math.abs(trend).toFixed(1)}% vs last
        </span>
      </div>
    )}
  </motion.div>
);

/* ─── Savings Bar ─── */
const SavingsBar = ({ label, current, total, isDark }) => {
  const pct = total ? Math.min((current / total) * 100, 100) : 0;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 13, color: isDark ? '#d1d5db' : '#374151', fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 13, color: isDark ? '#9ca3af' : '#6b7280' }}>{fmt(current)}<span style={{ color: isDark ? '#4b5563' : '#d1d5db' }}>/{fmt(total)}</span></span>
      </div>
      <div className="progress-track">
        <motion.div className="progress-fill" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.7, ease: 'easeOut' }} />
      </div>
      {pct > 0 && pct < 100 && (
        <p style={{ fontSize: 11, color: isDark ? '#6b7280' : '#9ca3af', margin: '4px 0 0' }}>{pct.toFixed(0)}% — {fmt(total - current)} remaining</p>
      )}
    </div>
  );
};

/* ─── Spending Heatmap ─── */
const SpendingHeatmap = ({ transactions, isDark }) => {
  const today = new Date();
  const days = [];
  for (let i = 34; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    days.push(d.toISOString().split('T')[0]);
  }
  const daysSet = new Set(days);
  const spendByDay = {};
  transactions.forEach(t => {
    if (t.amount < 0 && daysSet.has(t.date) && t.category !== 'Transfer' && !t.payment_type?.includes('Transfer') && t.category !== 'Credit Card Payment') {
      spendByDay[t.date] = (spendByDay[t.date] || 0) + Math.abs(t.amount);
    }
  });
  const maxSpend = Math.max(...Object.values(spendByDay), 1);
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {days.map(day => {
          const amt = spendByDay[day] || 0;
          const intensity = amt / maxSpend;
          const bg = amt === 0 ? (isDark ? '#1f2937' : '#f3f4f6')
            : intensity > 0.7 ? '#ef4444' : intensity > 0.4 ? '#f59e0b' : '#1abf94';
          return (
            <div key={day} title={`${day}: ${fmt(amt)}`} style={{ width: 14, height: 14, borderRadius: 3, background: bg, cursor: 'default', transition: 'transform 0.1s' }}
              onMouseOver={(e) => e.target.style.transform = 'scale(1.4)'}
              onMouseOut={(e) => e.target.style.transform = 'scale(1)'}
            />
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 8, alignItems: 'center', fontSize: 10, color: isDark ? '#6b7280' : '#9ca3af' }}>
        <span>Less</span>
        {['#1abf94', '#f59e0b', '#ef4444'].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: 2, background: c }} />)}
        <span>More</span>
      </div>
    </div>
  );
};

/* ─── Health Score Gauge ─── */
const HealthGauge = ({ score, isDark }) => {
  const getLabel = (s) => s >= 80 ? 'Excellent' : s >= 60 ? 'Good' : s >= 40 ? 'Average' : 'Poor';
  const getColor = (s) => s >= 80 ? '#10b981' : s >= 60 ? '#1abf94' : s >= 40 ? '#f59e0b' : '#ef4444';
  const label = getLabel(score);
  const color = getColor(score);
  const angle = (score / 100) * 180 - 90;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div style={{ position: 'relative', width: 140, height: 80, overflow: 'hidden' }}>
        <svg width="140" height="80" viewBox="0 0 140 80" style={{ position: 'absolute', top: 0, left: 0 }}>
          <path d="M 10 70 A 60 60 0 0 1 130 70" stroke={isDark ? '#1f2937' : '#e5e7eb'} strokeWidth="12" fill="none" strokeLinecap="round" />
          <path d="M 10 70 A 60 60 0 0 1 130 70"
            stroke={color} strokeWidth="12" fill="none" strokeLinecap="round"
            strokeDasharray={`${(score / 100) * 188} 188`}
          />
        </svg>
        <div style={{
          position: 'absolute', bottom: 4, left: '50%', transformOrigin: 'bottom center',
          transform: `translateX(-50%) rotate(${angle}deg)`,
          width: 2, height: 55, background: color, borderRadius: 2,
          transition: 'transform 1s ease-out',
        }} />
        <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 10, height: 10, borderRadius: '50%', background: color }} />
        <div style={{ position: 'absolute', bottom: 14, left: 0, right: 0, textAlign: 'center', fontSize: 22, fontWeight: 800, color: isDark ? '#f3f4f6' : '#111827' }}>
          {score}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
        <span style={{ fontSize: 14, fontWeight: 700, color }}>{label}</span>
      </div>
      <div style={{ display: 'flex', gap: 16, fontSize: 10, color: isDark ? '#6b7280' : '#9ca3af' }}>
        {[['Poor','#ef4444'],['Average','#f59e0b'],['Good','#1abf94'],['Excellent','#10b981']].map(([l,c]) => (
          <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: c, display: 'inline-block' }} />{l}
          </span>
        ))}
      </div>
    </div>
  );
};

const CHART_COLORS = ['#1abf94', '#34d399', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

/* ════════════════════════════════════════════════════════════════
   WIDGET WRAPPER HELPERS
   ════════════════════════════════════════════════════════════════ */

/* ════════════════════════════════════════════════════════════════
   DASHBOARD — MAIN COMPONENT
   ════════════════════════════════════════════════════════════════ */
export default function Dashboard() {
  const { isDark } = useTheme();
  const queryClient = useQueryClient();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [activeId, setActiveId] = useState(null);
  const [flippedWidget, setFlippedWidget] = useState(null);

  const [goals, setGoals] = useState([]);
  const [mutualFunds, setMutualFunds] = useState([]);
  const [lending, setLending] = useState([]);
  const [metricsLoading, setMetricsLoading] = useState(true);

  const { width: containerWidth, containerRef } = useContainerWidth();
  const { layout, setLayout, toggleWidget, resizeWidget, resetLayout } = useDashboardLayout(currentUser?.uid);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'n' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); setShowQuickAdd(true); } };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    const unsubs = [
      onSnapshot(collection(db, `users/${currentUser.uid}/goals`), snap => setGoals(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, `users/${currentUser.uid}/mutualFunds`), snap => setMutualFunds(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, `users/${currentUser.uid}/lending`), snap => setLending(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
    ];
    setMetricsLoading(false);
    return () => unsubs.forEach(fn => fn());
  }, [currentUser]);

  const [prevAggregate, setPrevAggregate] = useState(null);
  const { transactions, accounts, creditCards, categories, cycleStartDay, currentAggregate } = useData();
  const snapshots = [];

  const addTxnMutation = useMutation({
    mutationFn: (data) => transactionsAPI.create(data, cycleStartDay),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['transactions'] }); },
  });

  const currentCycle = useMemo(() => getFinancialCycle(new Date(), cycleStartDay), [cycleStartDay]);
  const cycleInfo    = useMemo(() => getCycleDayInfo(currentCycle), [currentCycle]);

  const prevCycleKey = useMemo(() => {
    const cycles = getRecentFinancialMonths(2, new Date(), cycleStartDay);
    return cycles.length > 1 ? cycles[1].cycleKey : null;
  }, [cycleStartDay]);

  useEffect(() => {
    if (!currentUser || !prevCycleKey) return;
    const unsub = onSnapshot(
      doc(db, `users/${currentUser.uid}/aggregates/${prevCycleKey}`),
      (snap) => { if (snap.exists()) setPrevAggregate(snap.data()); else setPrevAggregate(null); }
    );
    return () => unsub();
  }, [currentUser, prevCycleKey]);

  const bankAccounts = useMemo(() => accounts.filter(a => a.type !== 'credit'), [accounts]);
  const accountsBalance = bankAccounts.reduce((s, a) => s + (a.balance || 0), 0);

  const totalSavings = mutualFunds.reduce((s, mf) => {
    const val = mf.current_nav ? parseFloat(mf.current_nav) * parseFloat(mf.units) : parseFloat(mf.invested_amount || 0);
    return s + val;
  }, 0);

  const totalLiabilities = creditCards.reduce((s, cc) => s + parseFloat(cc.liability || 0), 0)
    + lending.filter(l => l.type === 'borrowed').reduce((s, l) => {
        const principal = parseFloat(l.amount || 0);
        const paid = parseFloat(l.paid_amount || 0);
        return s + (principal - paid);
      }, 0);

  const netWorth = accountsBalance + totalSavings - totalLiabilities;

  const cycleTxns = useMemo(() =>
    transactions.filter(t => t.date >= currentCycle.startDate && t.date <= currentCycle.endDate),
    [transactions, currentCycle]
  );

  const cashFlow = useMemo(() => {
    let tIncome = 0;
    let tExpense = 0;
    const skipCats = new Set(['Transfer', 'Credit Card Payment']);
    const isSkip = (t) =>
      t.payment_type === 'Credit Card' ||
      t.payment_type === 'Self Transfer' ||
      t.payment_type === 'Transfer' ||
      skipCats.has(t.category);

    cycleTxns.forEach(t => {
      if (isSkip(t)) return;
      if (t.category === 'Income') { tIncome += Math.abs(t.amount); }
      else if (t.amount < 0) { tExpense += Math.abs(t.amount); }
    });

    return {
      totalIncome: tIncome, totalExpenses: tExpense,
      netSavings: tIncome - tExpense,
      dailyAvgSpend: cycleInfo.daysElapsed > 0 ? tExpense / cycleInfo.daysElapsed : 0,
    };
  }, [cycleTxns, cycleInfo]);

  const income = cashFlow.totalIncome;
  const savingsTxns = cycleTxns.filter(t => t.amount < 0 && (t.category === 'Investment' || t.category === 'Savings'));
  const totalSavedInCycle = savingsTxns.reduce((s, t) => s + Math.abs(t.amount), 0);
  const savingsRate = income > 0 ? (totalSavedInCycle / income * 100) : 0;

  const { data: budgetLimits = {} } = useQuery({
    queryKey: ['dashboardBudgets', currentCycle?.cycleKey],
    queryFn: async () => {
      const data = await budgetSnapshotsAPI.get(currentCycle.cycleKey);
      if (!data) return {};
      const limitMap = {};
      Object.entries(data).forEach(([catId, doc]) => {
        limitMap[doc.categoryId || catId] = typeof doc === 'object' ? (doc.limit ?? 0) : doc;
      });
      return limitMap;
    },
    enabled: !!currentCycle?.cycleKey,
  });

  const budgetUsage = useMemo(() => {
    const map = {};
    cycleTxns.forEach(t => {
      if (t.payment_type === 'Credit Card') return;
      if (t.payment_type === 'Self Transfer' || t.payment_type === 'Transfer' || t.category === 'Transfer' || t.category === 'Credit Card Payment' || t.category === 'Income') return;
      const amount = parseFloat(t.amount || 0);
      if (amount < 0 && t.category) map[t.category] = (map[t.category] || 0) + Math.abs(amount);
    });
    return Object.entries(map)
      .map(([cat, spent]) => {
        const catId = categories.find(c => c.name === cat)?.id;
        return { category: cat, spent, monthly_limit: catId ? (budgetLimits[catId] || 0) : 0 };
      })
      .sort((a, b) => b.spent - a.spent)
      .slice(0, 5);
  }, [cycleTxns, budgetLimits, categories]);

  /* ─── Financial Health Score ─── */
  const financialHealthScore = useMemo(() => {
    let score = 0;
    score += Math.min(30, (savingsRate / 20) * 30);
    const budgeted = budgetUsage.filter(b => b.monthly_limit > 0);
    if (budgeted.length > 0) {
      const withinLimit = budgeted.filter(b => b.spent <= b.monthly_limit).length;
      score += (withinLimit / budgeted.length) * 25;
    } else { score += 15; }
    const totalCCLimit = creditCards.reduce((s, c) => s + parseFloat(c.credit_limit || 0), 0);
    const totalCCOutstanding = creditCards.reduce((s, c) => s + parseFloat(c.liability || 0), 0);
    const ccUtil = totalCCLimit > 0 ? totalCCOutstanding / totalCCLimit : 0;
    score += Math.max(0, 25 - (ccUtil * 83));
    const daySpend = {};
    cycleTxns.forEach(t => {
      if (t.amount < 0 && t.category !== 'Transfer' && t.category !== 'Credit Card Payment' && t.payment_type !== 'Credit Card') {
        daySpend[t.date] = (daySpend[t.date] || 0) + Math.abs(t.amount);
      }
    });
    const vals = Object.values(daySpend);
    if (vals.length > 2) {
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length;
      const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;
      score += Math.max(0, 20 - (cv * 10));
    } else { score += 10; }
    return Math.max(0, Math.min(100, Math.round(score)));
  }, [savingsRate, budgetUsage, creditCards, cycleTxns]);

  /* ─── Spending Leaks ─── */
  const spendingLeaks = useMemo(() => {
    const catStats = {};
    cycleTxns.forEach(t => {
      if (t.amount < 0 && t.category !== 'Transfer' && t.category !== 'Credit Card Payment' && t.payment_type !== 'Credit Card' && t.category !== 'Income') {
        if (!catStats[t.category]) catStats[t.category] = { total: 0, count: 0 };
        catStats[t.category].total += Math.abs(t.amount);
        catStats[t.category].count += 1;
      }
    });
    return Object.entries(catStats)
      .map(([cat, s]) => ({ category: cat, total: s.total, count: s.count, avgPerTxn: s.total / s.count }))
      .filter(s => s.count >= 3 && s.avgPerTxn < 600)
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);
  }, [cycleTxns]);

  /* ─── Behavioral Insights ─── */
  const behavioralInsights = useMemo(() => {
    const daySpend = {};
    const catCount = {};
    cycleTxns.forEach(t => {
      if (t.amount < 0 && t.category !== 'Transfer' && t.category !== 'Credit Card Payment' && t.payment_type !== 'Credit Card') {
        daySpend[t.date] = (daySpend[t.date] || 0) + Math.abs(t.amount);
        catCount[t.category] = (catCount[t.category] || 0) + 1;
      }
    });
    const topDay = Object.entries(daySpend).sort((a, b) => b[1] - a[1])[0];
    const topCat = Object.entries(catCount).sort((a, b) => b[1] - a[1])[0];
    return {
      highestSpendingDay: topDay ? { date: topDay[0], amount: topDay[1] } : null,
      mostFrequentCategory: topCat ? { name: topCat[0], count: topCat[1] } : null,
      dailyAvg: cashFlow.dailyAvgSpend,
      totalTxns: cycleTxns.filter(t => t.amount < 0 && t.category !== 'Transfer').length,
    };
  }, [cycleTxns, cashFlow.dailyAvgSpend]);

  /* ─── Risk Alerts ─── */
  const riskAlerts = useMemo(() => {
    const alerts = [];
    budgetUsage.forEach(b => {
      if (b.monthly_limit > 0) {
        const pct = (b.spent / b.monthly_limit) * 100;
        if (pct >= 100) alerts.push({ type: 'danger', message: `${b.category} is over budget (${pct.toFixed(0)}% used — ${fmt(b.spent - b.monthly_limit)} over)` });
        else if (pct >= 80) alerts.push({ type: 'warning', message: `${b.category} is at ${pct.toFixed(0)}% of budget — ${fmt(b.monthly_limit - b.spent)} left` });
      }
    });
    bankAccounts.forEach(a => {
      if ((a.balance || 0) < 1000) alerts.push({ type: 'danger', message: `Low balance: ${a.account_name} has only ${fmt(a.balance || 0)}` });
    });
    if (prevAggregate && currentAggregate?.totalSpent > 0 && prevAggregate.totalSpent > 0) {
      const changePct = ((currentAggregate.totalSpent - prevAggregate.totalSpent) / prevAggregate.totalSpent) * 100;
      if (changePct > 30) alerts.push({ type: 'warning', message: `Spending is up ${changePct.toFixed(0)}% vs last cycle (${fmt(currentAggregate.totalSpent - prevAggregate.totalSpent)} more)` });
    }
    creditCards.forEach(cc => {
      const health = calculateCreditCardHealth(cc, creditCards);
      if (health.utilization > 80) alerts.push({ type: 'danger', message: `${cc.account_name} is at ${health.utilization}% utilization — ${health.paymentAdvice}` });
    });
    return alerts.slice(0, 5);
  }, [budgetUsage, bankAccounts, prevAggregate, currentAggregate, creditCards]);

  /* ─── Smart Recommendations ─── */
  const smartRecommendations = useMemo(() => {
    const recs = [];
    if (savingsRate < 10) recs.push({ icon: '💰', text: 'Your savings rate is below 10%. Try setting aside a fixed amount at the start of each cycle before spending.' });
    if (spendingLeaks.length > 0) recs.push({ icon: '🔍', text: `High-frequency spending detected in "${spendingLeaks[0].category}" (${spendingLeaks[0].count} transactions). Consider batching these purchases.` });
    const highUtil = creditCards.find(cc => calculateCreditCardHealth(cc, creditCards).utilization > 50);
    if (highUtil) recs.push({ icon: '💳', text: `Pay down ${highUtil.account_name} to reduce credit utilization below 30% and improve your financial health score.` });
    const topBudget = budgetUsage.find(b => b.monthly_limit > 0 && b.spent >= b.monthly_limit);
    if (topBudget) recs.push({ icon: '⚠️', text: `You've exceeded your ${topBudget.category} budget. Consider increasing the limit or reducing spending in this category.` });
    if (goals.length === 0) recs.push({ icon: '🎯', text: 'Set financial goals to track your savings progress and stay motivated throughout the year.' });
    if (recs.length === 0) recs.push({ icon: '✨', text: 'Great financial health! Keep maintaining your spending habits and consider increasing your SIP contributions.' });
    return recs.slice(0, 4);
  }, [savingsRate, spendingLeaks, creditCards, budgetUsage, goals]);

  /* ─── Goals with projection ─── */
  const goalsWithProgress = useMemo(() => {
    return goals.slice(0, 4).map(g => {
      const target = g.target_amount || 0;
      const current = g.current_amount || g.saved_amount || 0;
      const pct = target > 0 ? Math.min((current / target) * 100, 100) : 0;
      const remaining = Math.max(0, target - current);
      const deadline = g.deadline ? new Date(g.deadline) : null;
      const now = new Date();
      const monthsLeft = deadline ? Math.max(0, (deadline.getFullYear() - now.getFullYear()) * 12 + (deadline.getMonth() - now.getMonth())) : null;
      const reqMonthly = monthsLeft && monthsLeft > 0 ? remaining / monthsLeft : null;
      return { ...g, pct, remaining, reqMonthly };
    });
  }, [goals]);

  /* ─── CC health per card ─── */
  const ccHealthData = useMemo(() =>
    creditCards.map(cc => ({ ...cc, health: calculateCreditCardHealth(cc, creditCards) })),
    [creditCards]
  );

  const insights = useMemo(() => {
    const generated = generateInsightsFromAggregates(currentAggregate, null, accounts, savingsRate);
    const comparison = generateCycleComparisonInsights(currentAggregate, prevAggregate);
    generated.push(...comparison);
    if (bankAccounts.some(a => a.balance < 1000)) {
      generated.push({ type: 'warning', title: 'Low Balance', message: 'One or more bank accounts have a low balance. Consider a top-up.' });
    }
    return generated;
  }, [currentAggregate, prevAggregate, accounts, bankAccounts, savingsRate]);

  /* ─── Chart data ─── */
  const categoryData = transactions.reduce((acc, txn) => {
    const isTrans = txn.category === 'Transfer' || txn.payment_type?.includes('Transfer') || txn.category === 'Credit Card Payment';
    const isCCTxn = txn.payment_type === 'Credit Card';
    if (txn.category !== 'Income' && txn.amount < 0 && !isTrans && !isCCTxn) {
      const ex = acc.find(i => i.name === txn.category);
      const col = categories.find(c => c.name === txn.category)?.color || '#94a3b8';
      if (ex) ex.value += Math.abs(txn.amount);
      else acc.push({ name: txn.category, value: Math.abs(txn.amount), color: col });
    }
    return acc;
  }, []).sort((a, b) => b.value - a.value);

  const textMain = isDark ? '#f3f4f6' : '#111827';
  const textSub  = isDark ? '#9ca3af' : '#6b7280';

  /* ─── Section Header ─── */
  const SectionHeader = useCallback(({ icon: Icon, title, sub, color = '#1abf94' }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
      <div style={{ width: 30, height: 30, borderRadius: 8, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon style={{ width: 15, height: 15, color }} />
      </div>
      <div>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: textMain }}>{title}</p>
        {sub && <p style={{ margin: 0, fontSize: 11, color: textSub }}>{sub}</p>}
      </div>
    </div>
  ), [textMain, textSub]);

  /* ════════════════════════════════════════════════════════════════
     WIDGET RENDER MAP
     Each key matches a widget id in WIDGET_REGISTRY.
     ════════════════════════════════════════════════════════════════ */
  const widgetComponents = useMemo(() => ({

    /* ── KPI Cards ─────────────────────────────────────────────── */
    kpi_cards: (
      <div style={{ padding: '20px 20px' }}>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <KpiCard label="Net Worth" value={netWorth} icon={ScaleIcon} color="#1abf94" isDark={isDark} onClick={() => navigate('/accounts')} />
          <KpiCard label="Account Balance" value={accountsBalance} icon={BanknotesIcon} color="#34d399" isDark={isDark} onClick={() => navigate('/accounts')} />
          <KpiCard label="Total Savings" value={totalSavings} icon={ArrowTrendingUpIcon} color="#8b5cf6" isDark={isDark} onClick={() => navigate('/investments')} />
          <KpiCard label="Total Liabilities" value={totalLiabilities} icon={ArrowDownIcon} color="#ef4444" isDark={isDark} onClick={() => navigate('/credit-cards')} />
          <KpiCard label="Savings Rate" value={savingsRate} icon={ChartBarIcon} color="#f59e0b" isDark={isDark} isPercent />
        </div>
      </div>
    ),

    /* ── Cash Flow ──────────────────────────────────────────────── */
    cash_flow: (
      <div style={{ padding: '20px 22px' }}>
        <SectionHeader icon={BanknotesIcon} title="Cash Flow" sub={`${currentCycle.label} · Day ${cycleInfo.daysElapsed}/${cycleInfo.totalDays}`} color="#1abf94" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Income', value: cashFlow.totalIncome, color: '#10b981' },
            { label: 'Expenses', value: cashFlow.totalExpenses, color: '#ef4444' },
            { label: 'Net Savings', value: cashFlow.netSavings, color: cashFlow.netSavings >= 0 ? '#1abf94' : '#ef4444' },
            { label: 'Daily Avg', value: cashFlow.dailyAvgSpend, color: '#f59e0b' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ padding: '12px 14px', borderRadius: 12, background: isDark ? '#0f1621' : '#f9fafb', border: `1px solid ${isDark ? '#1a2235' : '#e5e7eb'}` }}>
              <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 600, color: textSub, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</p>
              <p style={{ margin: 0, fontSize: 17, fontWeight: 800, color, letterSpacing: '-0.5px' }}>
                ₹{Math.abs(value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </p>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 11, color: textSub }}>
            <span>Cycle progress: {cycleInfo.daysElapsed}/{cycleInfo.totalDays} days</span>
            <span>{cycleInfo.daysLeft} days left</span>
          </div>
          <div style={{ height: 4, borderRadius: 2, background: isDark ? '#1f2937' : '#e5e7eb', overflow: 'hidden' }}>
            <motion.div initial={{ width: 0 }} animate={{ width: `${(cycleInfo.daysElapsed / cycleInfo.totalDays) * 100}%` }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
              style={{ height: '100%', borderRadius: 2, background: 'linear-gradient(90deg, #1abf94, #10b981)' }} />
          </div>
        </div>
      </div>
    ),

    /* ── Health Score ───────────────────────────────────────────── */
    health_score: (
      <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <SectionHeader icon={SparklesIcon} title="Financial Health" sub="Based on savings, budgets & credit" color="#8b5cf6" />
        <HealthGauge score={financialHealthScore} isDark={isDark} />
        <div style={{ display: 'flex', gap: 20, marginTop: 6, fontSize: 11, color: textSub }}>
          <span>Savings <strong style={{ color: textMain }}>{savingsRate.toFixed(1)}%</strong></span>
          <span>CC Util <strong style={{ color: textMain }}>{creditCards.length > 0 ? `${calculateCreditCardHealth(creditCards[0], creditCards).utilization}%` : '—'}</strong></span>
        </div>
      </div>
    ),

    /* ── Heatmap ─────────────────────────────────────────────────── */
    heatmap: (
      <div style={{ padding: '20px 22px' }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: textMain, display: 'block', marginBottom: 4 }}>Spending Heatmap</span>
        <p style={{ fontSize: 11, color: textSub, marginBottom: 14 }}>Last 35 days — daily spend intensity</p>
        <SpendingHeatmap transactions={transactions} isDark={isDark} />
      </div>
    ),

    /* ── Category Chart ──────────────────────────────────────────── */
    category_chart: (
      <div style={{ padding: '20px 22px' }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: textMain, display: 'block', marginBottom: 3 }}>Spending by Category</span>
        <p style={{ fontSize: 11, color: textSub, marginBottom: 12 }}>Current cycle breakdown</p>
        {categoryData.length > 0 ? (
          <>
            <div className="h-[230px] w-full">
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                <PieChart>
                  <Pie data={categoryData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value" stroke="none">
                    {categoryData.map((item, i) => <Cell key={i} fill={item.color} />)}
                  </Pie>
                  <Tooltip content={<CustomTooltip isDark={isDark} />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {categoryData.slice(0, 5).map((item, i) => (
                <span key={i} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: isDark ? '#252f3e' : '#f3f4f6', color: textMain, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: item.color }} />{item.name}
                </span>
              ))}
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🥧</div>
            <p style={{ color: textSub, fontSize: 13, margin: 0 }}>No spending data yet this cycle</p>
            <button onClick={() => setShowQuickAdd(true)} className="btn-primary" style={{ marginTop: 12, fontSize: 12, padding: '6px 16px' }}>
              <PlusIcon style={{ width: 13, height: 13 }} /> Add Transaction
            </button>
          </div>
        )}
      </div>
    ),

    /* ── Budget Progress ─────────────────────────────────────────── */
    budget_progress: (
      <div style={{ padding: '20px 22px' }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: textMain, display: 'block', marginBottom: 16 }}>Budget Progress</span>
        {budgetUsage.filter(b => b.spent > 0).length > 0 ? (
          budgetUsage.filter(b => b.spent > 0).map((b, i) => (
            <SavingsBar key={i} label={b.category} current={b.spent} total={b.monthly_limit || b.spent * 1.5} isDark={isDark} />
          ))
        ) : (
          <div style={{ textAlign: 'center', padding: '36px 0' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🎯</div>
            <p style={{ color: textSub, fontSize: 13, margin: 0 }}>Set budgets to track your spending limits</p>
            <button onClick={() => navigate('/budgets')} className="btn-primary" style={{ marginTop: 12, fontSize: 12, padding: '6px 16px' }}>
              Go to Budgets
            </button>
          </div>
        )}
      </div>
    ),

    /* ── Risk Alerts + Recommendations ──────────────────────────── */
    risk_alerts: (
      <div style={{ padding: '20px 22px' }}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Risk Alerts */}
          <div>
            <SectionHeader icon={ExclamationTriangleIcon} title="Risk Alerts" sub="Items requiring your attention" color="#ef4444" />
            {riskAlerts.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {riskAlerts.map((alert, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    padding: '10px 12px', borderRadius: 10,
                    background: alert.type === 'danger' ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)',
                    border: `1px solid ${alert.type === 'danger' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'}`,
                  }}>
                    <ExclamationTriangleIcon style={{ width: 13, height: 13, color: alert.type === 'danger' ? '#ef4444' : '#f59e0b', flexShrink: 0, marginTop: 1 }} />
                    <span style={{ fontSize: 12, color: isDark ? '#d1d5db' : '#374151', lineHeight: 1.5 }}>{alert.message}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <CheckCircleIcon style={{ width: 28, height: 28, color: '#1abf94', margin: '0 auto 8px' }} />
                <p style={{ fontSize: 12, color: textSub, margin: 0 }}>No alerts — finances look healthy!</p>
              </div>
            )}
          </div>
          {/* Smart Recommendations */}
          <div>
            <SectionHeader icon={LightBulbIcon} title="Smart Recommendations" sub="Personalized financial guidance" color="#f59e0b" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {smartRecommendations.map((rec, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '10px 12px', borderRadius: 10,
                  background: isDark ? 'rgba(245,158,11,0.05)' : 'rgba(245,158,11,0.04)',
                  border: `1px solid rgba(245,158,11,0.15)`,
                }}>
                  <span style={{ fontSize: 14, lineHeight: 1, flexShrink: 0 }}>{rec.icon}</span>
                  <span style={{ fontSize: 12, color: isDark ? '#d1d5db' : '#374151', lineHeight: 1.5 }}>{rec.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    ),

    /* ── Behavioral Insights ─────────────────────────────────────── */
    behavioral: (
      <div style={{ padding: '20px 22px' }}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Spending Leaks */}
          <div>
            <SectionHeader icon={FireIcon} title="Top Spending Leaks" sub="High-frequency small transactions" color="#ef4444" />
            {spendingLeaks.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {spendingLeaks.map((leak, i) => {
                  const catColor = categories.find(c => c.name === leak.category)?.color || '#94a3b8';
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10, background: isDark ? '#0f1621' : '#f9fafb', border: `1px solid ${isDark ? '#1a2235' : '#e5e7eb'}` }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: catColor, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: textMain }}>{leak.category}</p>
                        <p style={{ margin: 0, fontSize: 11, color: textSub }}>{leak.count} txns · avg {fmt(leak.avgPerTxn)}</p>
                      </div>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#ef4444' }}>{fmt(leak.total)}</p>
                    </div>
                  );
                })}
                <p style={{ margin: '4px 0 0', fontSize: 11, color: textSub }}>💡 Consolidate frequent small purchases to reduce impulse spending.</p>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <CheckCircleIcon style={{ width: 28, height: 28, color: '#1abf94', margin: '0 auto 8px' }} />
                <p style={{ fontSize: 12, color: textSub, margin: 0 }}>No spending leaks detected this cycle!</p>
              </div>
            )}
          </div>

          {/* Behavioral stats */}
          <div>
            <SectionHeader icon={ChartBarIcon} title="Behavioral Stats" sub="Your spending patterns this cycle" color="#8b5cf6" />
            <div className="grid grid-cols-2 gap-3">
              <div style={{ padding: '12px', borderRadius: 12, background: isDark ? '#0f1621' : '#f9fafb', border: `1px solid ${isDark ? '#1a2235' : '#e5e7eb'}` }}>
                <p style={{ margin: '0 0 4px', fontSize: 11, color: textSub, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Daily Avg Spend</p>
                <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#f59e0b' }}>{fmt(behavioralInsights.dailyAvg)}</p>
              </div>
              <div style={{ padding: '12px', borderRadius: 12, background: isDark ? '#0f1621' : '#f9fafb', border: `1px solid ${isDark ? '#1a2235' : '#e5e7eb'}` }}>
                <p style={{ margin: '0 0 4px', fontSize: 11, color: textSub, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Transactions</p>
                <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#6366f1' }}>{behavioralInsights.totalTxns}</p>
              </div>
              {behavioralInsights.highestSpendingDay && (
                <div style={{ gridColumn: '1/-1', padding: '12px', borderRadius: 12, background: isDark ? '#0f1621' : '#f9fafb', border: `1px solid ${isDark ? '#1a2235' : '#e5e7eb'}` }}>
                  <p style={{ margin: '0 0 4px', fontSize: 11, color: textSub, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Highest Spending Day</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: textMain }}>
                      {new Date(behavioralInsights.highestSpendingDay.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' })}
                    </p>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#ef4444' }}>{fmt(behavioralInsights.highestSpendingDay.amount)}</p>
                  </div>
                </div>
              )}
              {behavioralInsights.mostFrequentCategory && (
                <div style={{ gridColumn: '1/-1', padding: '12px', borderRadius: 12, background: isDark ? '#0f1621' : '#f9fafb', border: `1px solid ${isDark ? '#1a2235' : '#e5e7eb'}` }}>
                  <p style={{ margin: '0 0 4px', fontSize: 11, color: textSub, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Most Frequent Category</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: textMain }}>{behavioralInsights.mostFrequentCategory.name}</p>
                    <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 99, background: 'rgba(139,92,246,0.12)', color: '#8b5cf6', fontWeight: 700 }}>
                      {behavioralInsights.mostFrequentCategory.count}× this cycle
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    ),

    /* ── Recent Transactions ─────────────────────────────────────── */
    recent_txns: (
      <div style={{ padding: '20px 22px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <span style={{ fontSize: 14, fontWeight: 700, color: textMain, display: 'block' }}>Recent Transactions</span>
            <span style={{ fontSize: 11, color: textSub }}>Latest 6 entries</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => navigate('/transactions')} style={{ fontSize: 12, padding: '5px 12px', borderRadius: 8, border: `1px solid ${isDark ? '#30363d' : '#e5e7eb'}`, background: 'transparent', cursor: 'pointer', color: textSub, transition: 'all 0.15s' }}
              onMouseOver={(e) => e.currentTarget.style.color = '#1abf94'}
              onMouseOut={(e) => e.currentTarget.style.color = textSub}
            >
              View all
            </button>
            <button onClick={() => setShowQuickAdd(true)} className="btn-primary" style={{ padding: '5px 12px', fontSize: 12 }}>
              <PlusIcon style={{ width: 13, height: 13 }} /> Add
            </button>
          </div>
        </div>
        {transactions.length > 0 ? (
          <TransactionTable transactions={transactions.slice(0, 6)} categories={categories} />
        ) : (
          <div style={{ textAlign: 'center', padding: '36px 0' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🔄</div>
            <p style={{ color: textSub, fontSize: 13, margin: 0 }}>No transactions yet. Start by adding one!</p>
            <button onClick={() => setShowQuickAdd(true)} className="btn-primary" style={{ marginTop: 12, fontSize: 12, padding: '6px 16px' }}>
              <PlusIcon style={{ width: 13, height: 13 }} /> Add First Transaction
            </button>
          </div>
        )}
      </div>
    ),

    /* ── Goals & Credit Health ───────────────────────────────────── */
    goals: (
      <div style={{ padding: '20px 22px' }}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Financial Goals */}
          <div>
            <SectionHeader icon={FlagIcon} title="Goal Progress" sub="Completion forecast and required savings" color="#10b981" />
            {goalsWithProgress.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {goalsWithProgress.map((g, i) => (
                  <div key={g.id || i} style={{ padding: '12px 14px', borderRadius: 12, background: isDark ? '#0f1621' : '#f9fafb', border: `1px solid ${isDark ? '#1a2235' : '#e5e7eb'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: textMain }}>{g.name || g.goal_name || 'Goal'}</p>
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#10b981' }}>{g.pct.toFixed(0)}%</span>
                    </div>
                    <div style={{ height: 5, borderRadius: 3, background: isDark ? '#1f2937' : '#e5e7eb', marginBottom: 6, overflow: 'hidden' }}>
                      <motion.div initial={{ width: 0 }} animate={{ width: `${g.pct}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        style={{ height: '100%', borderRadius: 3, background: 'linear-gradient(90deg, #1abf94, #10b981)' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: textSub }}>
                      <span>{fmt(g.current_amount || g.saved_amount || 0)} saved</span>
                      <span>Target: {fmt(g.target_amount)}</span>
                    </div>
                    {g.reqMonthly && (
                      <p style={{ margin: '4px 0 0', fontSize: 11, color: '#f59e0b', fontWeight: 600 }}>
                        Required: {fmt(g.reqMonthly)}/mo to meet deadline
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🏆</div>
                <p style={{ color: textSub, fontSize: 13, margin: 0 }}>Set financial goals to stay motivated</p>
                <button onClick={() => navigate('/goals')} className="btn-primary" style={{ marginTop: 12, fontSize: 12, padding: '6px 16px' }}>
                  Create Goal
                </button>
              </div>
            )}
          </div>

          {/* Credit Health */}
          <div>
            <SectionHeader icon={CreditCardIcon} title="Credit Health" sub="Utilization and outstanding amounts" color="#6366f1" />
            {ccHealthData.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {ccHealthData.slice(0, 3).map((cc, i) => {
                  const { health } = cc;
                  return (
                    <div key={i} style={{ padding: '12px 14px', borderRadius: 12, background: isDark ? '#0f1621' : '#f9fafb', border: `1px solid ${isDark ? '#1a2235' : '#e5e7eb'}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <div>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: textMain }}>{cc.account_name}</p>
                          <p style={{ margin: 0, fontSize: 11, color: textSub }}>Limit: {fmt(health.limit)}</p>
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: `${health.riskColor}18`, color: health.riskColor }}>
                          {health.riskLevel}
                        </span>
                      </div>
                      <div style={{ marginBottom: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: textSub, marginBottom: 4 }}>
                          <span>Utilization</span>
                          <span style={{ fontWeight: 700, color: health.riskColor }}>{health.utilization}%</span>
                        </div>
                        <div style={{ height: 5, borderRadius: 3, background: isDark ? '#1f2937' : '#e5e7eb', overflow: 'hidden' }}>
                          <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(health.utilization, 100)}%` }}
                            transition={{ duration: 0.8, ease: 'easeOut' }}
                            style={{ height: '100%', borderRadius: 3, background: health.riskColor }} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700 }}>
                        <span style={{ color: textSub }}>Outstanding</span>
                        <span style={{ color: '#ef4444' }}>{fmt(health.outstanding)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>💳</div>
                <p style={{ color: textSub, fontSize: 13, margin: 0 }}>No credit cards linked yet</p>
                <button onClick={() => navigate('/credit-cards')} className="btn-primary" style={{ marginTop: 12, fontSize: 12, padding: '6px 16px' }}>
                  Add Credit Card
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    ),

    /* ── Savings Rate Widget ───────────────────────────────────────── */
    savings_rate_widget: (() => {
      const rate = savingsRate;
      const benchmarks = [{ label: '50/30/20 Rule', target: 20, color: '#1abf94' }, { label: 'Aggressive', target: 30, color: '#8b5cf6' }, { label: 'FIRE Goal', target: 50, color: '#f59e0b' }];
      const status = rate >= 30 ? { label: 'Excellent', color: '#10b981' } : rate >= 20 ? { label: 'Good', color: '#1abf94' } : rate >= 10 ? { label: 'Fair', color: '#f59e0b' } : { label: 'Low', color: '#ef4444' };
      return (
        <div style={{ padding: '20px 22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <span style={{ fontSize: 14, fontWeight: 700, color: textMain, display: 'block' }}>Savings Rate</span>
              <span style={{ fontSize: 11, color: textSub }}>This cycle vs benchmarks</span>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: `${status.color}18`, color: status.color }}>{status.label}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 20 }}>
            <span style={{ fontSize: 44, fontWeight: 900, color: status.color, letterSpacing: '-2px', lineHeight: 1 }}>{rate.toFixed(1)}</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: status.color }}>%</span>
          </div>
          {benchmarks.map(b => {
            const isMet = rate >= b.target;
            return (
              <div key={b.label} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 11 }}>
                  <span style={{ color: textSub, fontWeight: 600 }}>{b.label}</span>
                  <span style={{ color: isMet ? b.color : textSub, fontWeight: 700 }}>{b.target}% {isMet ? '✓' : ''}</span>
                </div>
                <div style={{ height: 5, borderRadius: 3, background: isDark ? '#1f2937' : '#e5e7eb', overflow: 'hidden' }}>
                  <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min((rate / b.target) * 100, 100)}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    style={{ height: '100%', background: isMet ? b.color : `${b.color}60`, borderRadius: 3 }} />
                </div>
              </div>
            );
          })}
        </div>
      );
    })(),

    /* ── Burn Rate Widget ──────────────────────────────────────────── */
    burn_rate: (() => {
      const monthlyBurn = cashFlow.dailyAvgSpend * 30;
      const totalAssets = accountsBalance + totalSavings;
      const runway = monthlyBurn > 0 ? (totalAssets / monthlyBurn) : 999;
      const runwayLabel = runway >= 12 ? '12+ months' : runway >= 6 ? `${runway.toFixed(1)} months` : runway >= 1 ? `${runway.toFixed(1)} months ⚠️` : `${(runway * 30).toFixed(0)} days 🛑`;
      const runwayColor = runway >= 6 ? '#10b981' : runway >= 3 ? '#f59e0b' : '#ef4444';
      return (
        <div style={{ padding: '20px 22px' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: textMain, display: 'block', marginBottom: 3 }}>Burn Rate & Runway</span>
          <p style={{ fontSize: 11, color: textSub, marginBottom: 16 }}>Monthly spending pace vs financial cushion</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[{ label: 'Monthly Burn', value: fmt(monthlyBurn), color: '#ef4444', sub: `${fmt(cashFlow.dailyAvgSpend)}/day` },
              { label: 'Runway', value: runwayLabel, color: runwayColor, sub: `Total assets: ${fmt(totalAssets)}` },
              { label: 'Income', value: fmt(cashFlow.totalIncome), color: '#10b981', sub: 'This cycle' },
              { label: 'Net Remaining', value: fmt(cashFlow.netSavings), color: cashFlow.netSavings >= 0 ? '#1abf94' : '#ef4444', sub: 'After expenses' },
            ].map(s => (
              <div key={s.label} style={{ padding: '12px 14px', borderRadius: 12, background: isDark ? '#0f1621' : '#f9fafb', border: `1px solid ${isDark ? '#1a2235' : '#e5e7eb'}` }}>
                <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 600, color: textSub, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</p>
                <p style={{ margin: '0 0 2px', fontSize: 16, fontWeight: 800, color: s.color, letterSpacing: '-0.5px' }}>{s.value}</p>
                <p style={{ margin: 0, fontSize: 10, color: textSub }}>{s.sub}</p>
              </div>
            ))}
          </div>
        </div>
      );
    })(),

    /* ── Expense/Income Ratio ──────────────────────────────────── */
    expense_income_ratio: (() => {
      const ratio = cashFlow.totalIncome > 0 ? (cashFlow.totalExpenses / cashFlow.totalIncome) * 100 : 0;
      const color = ratio > 100 ? '#ef4444' : ratio > 80 ? '#f59e0b' : '#1abf94';
      const label = ratio > 100 ? 'Overspending' : ratio > 80 ? 'Tight Budget' : ratio > 60 ? 'Moderate' : 'Healthy';
      const maxVal = Math.max(cashFlow.totalIncome, cashFlow.totalExpenses, 1);
      return (
        <div style={{ padding: '20px 22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <span style={{ fontSize: 14, fontWeight: 700, color: textMain, display: 'block' }}>Expense / Income Ratio</span>
              <span style={{ fontSize: 11, color: textSub }}>How much of your income is spent</span>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: `${color}18`, color }}>{label}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 20 }}>
            <span style={{ fontSize: 40, fontWeight: 900, color, letterSpacing: '-2px' }}>{ratio.toFixed(0)}</span>
            <span style={{ fontSize: 16, fontWeight: 700, color }}>%</span>
            <span style={{ fontSize: 12, color: textSub, marginLeft: 6 }}>of income spent</span>
          </div>
          {[{ label: 'Total Income', value: cashFlow.totalIncome, color: '#10b981' }, { label: 'Total Expenses', value: cashFlow.totalExpenses, color: '#ef4444' }].map(bar => (
            <div key={bar.label} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
                <span style={{ color: textSub, fontWeight: 600 }}>{bar.label}</span>
                <span style={{ color: bar.color, fontWeight: 700 }}>{fmt(bar.value)}</span>
              </div>
              <div style={{ height: 8, borderRadius: 4, background: isDark ? '#1f2937' : '#e5e7eb', overflow: 'hidden' }}>
                <motion.div initial={{ width: 0 }} animate={{ width: `${(bar.value / maxVal) * 100}%` }}
                  transition={{ duration: 0.9, ease: 'easeOut' }}
                  style={{ height: '100%', background: bar.color, borderRadius: 4 }} />
              </div>
            </div>
          ))}
        </div>
      );
    })(),

    /* ── Credit Utilization Summary ────────────────────────────── */
    credit_utilization_summary: (() => {
      const totalLimit = creditCards.reduce((s, c) => s + parseFloat(c.credit_limit || 0), 0);
      const totalOwed  = creditCards.reduce((s, c) => s + parseFloat(c.liability || 0), 0);
      const util = totalLimit > 0 ? (totalOwed / totalLimit) * 100 : 0;
      const utilColor = util > 70 ? '#ef4444' : util > 30 ? '#f59e0b' : '#10b981';
      const utilLabel = util > 70 ? 'High Risk' : util > 30 ? 'Moderate' : 'Healthy';
      return (
        <div style={{ padding: '20px 22px' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: textMain, display: 'block', marginBottom: 3 }}>Credit Utilization</span>
          <p style={{ fontSize: 11, color: textSub, marginBottom: 16 }}>Combined across all {creditCards.length} card{creditCards.length !== 1 ? 's' : ''}</p>
          {creditCards.length > 0 ? (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 8 }}>
                <span style={{ fontSize: 40, fontWeight: 900, color: utilColor, letterSpacing: '-2px' }}>{util.toFixed(1)}</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: utilColor }}>%</span>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99, marginLeft: 8, background: `${utilColor}18`, color: utilColor }}>{utilLabel}</span>
              </div>
              <div style={{ height: 10, borderRadius: 5, background: isDark ? '#1f2937' : '#e5e7eb', overflow: 'hidden', marginBottom: 14 }}>
                <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(util, 100)}%` }}
                  transition={{ duration: 0.9, ease: 'easeOut' }}
                  style={{ height: '100%', background: `linear-gradient(90deg, #10b981, ${utilColor})`, borderRadius: 5 }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: textSub }}>Outstanding: <strong style={{ color: '#ef4444' }}>{fmt(totalOwed)}</strong></span>
                <span style={{ color: textSub }}>Available: <strong style={{ color: '#10b981' }}>{fmt(Math.max(0, totalLimit - totalOwed))}</strong></span>
              </div>
              <div style={{ display: 'flex', gap: 4, marginTop: 12, flexWrap: 'wrap' }}>
                {[{pct:30,label:'30% limit',color:'#10b981'},{pct:70,label:'70% danger',color:'#ef4444'}].map(m => (
                  <span key={m.label} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 99, background: `${m.color}15`, color: m.color, fontWeight: 600 }}>{m.label}</span>
                ))}
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <span style={{ fontSize: 32 }}>💳</span>
              <p style={{ fontSize: 12, color: textSub, margin: '8px 0 0' }}>No credit cards added yet</p>
            </div>
          )}
        </div>
      );
    })(),

  }), [
    isDark, textMain, textSub, netWorth, accountsBalance, totalSavings, totalLiabilities, savingsRate,
    currentCycle, cycleInfo, cashFlow, financialHealthScore, creditCards, transactions, categoryData,
    budgetUsage, riskAlerts, smartRecommendations, spendingLeaks, behavioralInsights, categories,
    goalsWithProgress, ccHealthData, insights,
  ]);

  /* ════════════════════════════════════════════════════════════════
     DND EVENT HANDLERS
     ════════════════════════════════════════════════════════════════ */
  const handleDragStart = useCallback((event) => {
    setActiveId(event.active.id);
  }, []);

  const handleDragEnd = useCallback((event) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;
    const oldIndex = layout.findIndex((w) => w.id === active.id);
    const newIndex = layout.findIndex((w) => w.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    setLayout(arrayMove(layout, oldIndex, newIndex));
  }, [layout, setLayout]);

  /* ─── Loading state ─── */
  if (metricsLoading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 16 }}>
      <div style={{ width: 44, height: 44, borderRadius: '50%', border: '3px solid rgba(26,191,148,0.15)', borderTopColor: '#1abf94', animation: 'spin 0.9s linear infinite' }} />
      <p style={{ color: isDark ? '#6b7280' : '#9ca3af', fontSize: 13 }}>Loading dashboard…</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  const visibleWidgets = layout.filter((w) => w.visible);
  const activeWidget = layout.find((w) => w.id === activeId);

  return (
    <div>
      {/* ─── Dashboard Header ─── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: textMain, letterSpacing: '-0.3px' }}>Dashboard</h1>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: textSub }}>{currentCycle.label} · {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={() => { setEditMode(v => !v); setShowCustomizer(v => !v); }}
            className="btn-customize"
            style={{
              borderColor: editMode ? '#1abf94' : (isDark ? '#30363d' : '#e5e7eb'),
              color: editMode ? '#1abf94' : textSub,
              background: editMode ? 'rgba(26,191,148,0.08)' : 'transparent',
            }}
          >
            <AdjustmentsHorizontalIcon style={{ width: 15, height: 15 }} />
            {editMode ? 'Done Editing' : 'Customize'}
          </button>
          <button onClick={() => setShowQuickAdd(true)} className="btn-primary" style={{ padding: '6px 14px', fontSize: 13 }}>
            <PlusIcon style={{ width: 14, height: 14 }} /> Add
          </button>
        </div>
      </div>

      {/* ─── DnD Widget Grid ─── */}
      <div ref={containerRef}>
        <ResponsiveGridLayout
          className="layout"
          width={containerWidth}
          layouts={{ lg: visibleWidgets, md: visibleWidgets, sm: visibleWidgets, xs: visibleWidgets, xxs: visibleWidgets }}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
          rowHeight={120}
          onLayoutChange={(currentLayout) => {
            if (editMode) setLayout(currentLayout);
          }}
          isDraggable={editMode}
          isResizable={editMode}
          resizeHandles={['s', 'e', 'se']}
          draggableHandle=".widget-drag-handle"
          margin={[20, 20]}
        >
        {visibleWidgets.map((item, idx) => {
          const content = widgetComponents[item.id || item.i];
          if (!content) return null;
          const reg = WIDGET_REGISTRY.find(r => r.id === (item.id || item.i));
          const isFlipped = flippedWidget === (item.id || item.i);
          return (
            <div key={item.i || item.id}>
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: idx * 0.03 }}
                className={`glass-card widget-flip-container ${isFlipped ? 'flipped' : ''}`}
                style={{ overflow: isFlipped ? 'visible' : 'hidden', position: 'relative', width: '100%', height: '100%' }}
              >
                {editMode && (
                  <div className="widget-edit-overlay">
                    <div className="widget-drag-handle" style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'grab' }}>
                      <Bars3Icon style={{ width: 14, height: 14, color: '#1abf94', flexShrink: 0 }} />
                      <span style={{ fontSize: 10, fontWeight: 600, color: '#1abf94', letterSpacing: '0.04em', textTransform: 'uppercase' }}>drag</span>
                    </div>
                    <button
                      onPointerDown={e => e.stopPropagation()}
                      onClick={e => { e.stopPropagation(); toggleWidget(item.id || item.i); }}
                      title="Hide widget"
                      style={{
                        marginLeft: 4, width: 22, height: 22, borderRadius: 5,
                        border: `1px solid ${isDark ? '#30363d' : '#e5e7eb'}`, background: 'transparent',
                        color: isDark ? '#9ca3af' : '#6b7280', cursor: 'pointer', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
                      }}
                      onMouseOver={e => { e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.color = '#ef4444'; }}
                      onMouseOut={e => { e.currentTarget.style.borderColor = isDark ? '#30363d' : '#e5e7eb'; e.currentTarget.style.color = isDark ? '#9ca3af' : '#6b7280'; }}
                    >
                      <XMarkIcon style={{ width: 11, height: 11 }} />
                    </button>
                  </div>
                )}
                <div className="widget-flip-inner" style={{ height: '100%' }}>
                  {/* Front */}
                  <div className="widget-flip-front" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                    {/* Info button */}
                    {reg?.flipInfo && !editMode && (
                      <button
                        className="widget-info-btn"
                        onClick={e => { e.stopPropagation(); setFlippedWidget(isFlipped ? null : (item.id || item.i)); }}
                        title="Learn more about this metric"
                      >i</button>
                    )}
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      {content}
                    </div>
                  </div>
                  {/* Back — flip info panel */}
                  {reg?.flipInfo && (
                    <div className="widget-flip-back glass-card" style={{
                      padding: '20px 22px',
                      background: isDark
                        ? 'linear-gradient(135deg, #0f1621, #161b22)'
                        : 'linear-gradient(135deg, #f0fdf9, #fff)',
                      borderRadius: 'var(--radius-lg)',
                      height: '100%',
                      overflowY: 'auto'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 22 }}>{reg.icon}</span>
                          <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#1abf94' }}>{reg.flipInfo.title}</p>
                        </div>
                        <button
                          onClick={() => setFlippedWidget(null)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: isDark ? '#9ca3af' : '#6b7280', padding: 4 }}
                        ><XMarkIcon style={{ width: 16, height: 16 }} /></button>
                      </div>
                      {[['📌 What it is', reg.flipInfo.what], ['🔢 How it\'s calculated', reg.flipInfo.how], ['💡 Why it matters', reg.flipInfo.why], ['📈 Trend insight', reg.flipInfo.trend]].map(([label, text]) => (
                        <div key={label} style={{ marginBottom: 12 }}>
                          <p style={{ margin: '0 0 3px', fontSize: 11, fontWeight: 700, color: '#1abf94', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
                          <p style={{ margin: 0, fontSize: 12, color: isDark ? '#d1d5db' : '#374151', lineHeight: 1.6 }}>{text}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          );
        })}
        </ResponsiveGridLayout>
      </div>

      {/* ─── Customizer Edit Banner ─── */}
      <DashboardCustomizer
        open={showCustomizer}
        onClose={() => { setShowCustomizer(false); setEditMode(false); }}
        layout={layout}
        onToggle={toggleWidget}
        onResize={resizeWidget}
        onReset={resetLayout}
      />

      {/* ─── Quick Add Transaction ─── */}
      <AnimatePresence>
        {showQuickAdd && (
          <QuickAddTransaction isOpen={showQuickAdd} onClose={() => setShowQuickAdd(false)}
            onSubmit={(data) => addTxnMutation.mutate(data)} accounts={bankAccounts} creditCards={creditCards} categories={categories} />
        )}
      </AnimatePresence>
    </div>
  );
}
