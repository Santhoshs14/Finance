import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
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
  CheckCircleIcon, FlagIcon,
} from '@heroicons/react/24/outline';
import { fmt } from '../utils/format';
import CustomTooltip from '../components/CustomTooltip';

/* ─── KPI Card ─── */
const KpiCard = ({ label, value, icon: Icon, color, isDark, isPercent, onClick, trend }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
    className="glass-card"
    onClick={onClick}
    style={{
      padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 10,
      cursor: onClick ? 'pointer' : 'default',
      transition: 'transform 0.15s, box-shadow 0.15s',
    }}
    whileHover={onClick ? { scale: 1.03, boxShadow: `0 8px 30px ${color}22` } : {}}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: isDark ? '#9ca3af' : '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      <div style={{ width: 34, height: 34, borderRadius: 10, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon style={{ width: 18, height: 18, color }} />
      </div>
    </div>
    <p style={{ fontSize: 26, fontWeight: 800, color: isDark ? '#f3f4f6' : '#111827', margin: 0, letterSpacing: '-0.5px' }}>
      {isPercent
        ? <CountUp end={value} decimals={1} suffix="%" duration={1.2} />
        : <CountUp end={value} decimals={0} duration={1.2}
            formattingFn={(n) => '₹' + new Intl.NumberFormat('en-IN').format(n)} />
      }
    </p>
    {trend !== undefined && trend !== null && trend !== 0 && (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {trend > 0
          ? <ArrowUpIcon style={{ width: 12, height: 12, color: isPercent || label === 'Total Savings' ? '#10b981' : '#ef4444' }} />
          : <ArrowDownIcon style={{ width: 12, height: 12, color: isPercent || label === 'Total Savings' ? '#ef4444' : '#10b981' }} />
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
              onMouseOver={(e) => e.target.style.transform = 'scale(1.3)'}
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
  const angle = (score / 100) * 180 - 90; // -90 to +90 degrees
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div style={{ position: 'relative', width: 140, height: 80, overflow: 'hidden' }}>
        {/* Track */}
        <svg width="140" height="80" viewBox="0 0 140 80" style={{ position: 'absolute', top: 0, left: 0 }}>
          <path d="M 10 70 A 60 60 0 0 1 130 70" stroke={isDark ? '#1f2937' : '#e5e7eb'} strokeWidth="12" fill="none" strokeLinecap="round" />
          <path d="M 10 70 A 60 60 0 0 1 130 70"
            stroke={color} strokeWidth="12" fill="none" strokeLinecap="round"
            strokeDasharray={`${(score / 100) * 188} 188`}
          />
        </svg>
        {/* Needle */}
        <div style={{
          position: 'absolute', bottom: 4, left: '50%', transformOrigin: 'bottom center',
          transform: `translateX(-50%) rotate(${angle}deg)`,
          width: 2, height: 55, background: color, borderRadius: 2,
          transition: 'transform 1s ease-out',
        }} />
        {/* Center dot */}
        <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 10, height: 10, borderRadius: '50%', background: color }} />
        {/* Score */}
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

/* ─── Dashboard ─── */
export default function Dashboard() {
  const { isDark } = useTheme();
  const queryClient = useQueryClient();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  const [goals, setGoals] = useState([]);
  const [mutualFunds, setMutualFunds] = useState([]);
  const [lending, setLending] = useState([]);
  const [metricsLoading, setMetricsLoading] = useState(true);

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
      if (t.category === 'Income') {
        tIncome += Math.abs(t.amount);
      } else if (t.amount < 0) {
        tExpense += Math.abs(t.amount);
      }
    });

    return {
      totalIncome: tIncome,
      totalExpenses: tExpense,
      netSavings: tIncome - tExpense,
      dailyAvgSpend: cycleInfo.daysElapsed > 0 ? tExpense / cycleInfo.daysElapsed : 0,
    };
  }, [cycleTxns, cycleInfo]);

  const income = cashFlow.totalIncome;
  const savingsTxns = cycleTxns.filter(t => t.amount < 0 && (t.category === 'Investment' || t.category === 'Savings'));
  const totalSavedInCycle = savingsTxns.reduce((s, t) => s + Math.abs(t.amount), 0);
  const savingsRate = income > 0 ? (totalSavedInCycle / income * 100) : 0;

  /* ─── Cycle Summary ─── */
  const cycleSummary = useMemo(() => calculateCycleSummary(currentAggregate, cycleInfo), [currentAggregate, cycleInfo]);

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

  /* ─── Financial Health Score (0–100) ─── */
  const financialHealthScore = useMemo(() => {
    let score = 0;
    // 1. Savings rate (0-30 pts): 20%+ rate = 30 pts
    score += Math.min(30, (savingsRate / 20) * 30);
    // 2. Budget adherence (0-25 pts): % of categories within limit
    const budgeted = budgetUsage.filter(b => b.monthly_limit > 0);
    if (budgeted.length > 0) {
      const withinLimit = budgeted.filter(b => b.spent <= b.monthly_limit).length;
      score += (withinLimit / budgeted.length) * 25;
    } else {
      score += 15; // neutral if no budgets set
    }
    // 3. CC utilization (0-25 pts): <30% utilization = 25 pts
    const totalCCLimit = creditCards.reduce((s, c) => s + parseFloat(c.credit_limit || 0), 0);
    const totalCCOutstanding = creditCards.reduce((s, c) => s + parseFloat(c.liability || 0), 0);
    const ccUtil = totalCCLimit > 0 ? totalCCOutstanding / totalCCLimit : 0;
    score += Math.max(0, 25 - (ccUtil * 83)); // >30% → 0 pts
    // 4. Spending consistency (0-20 pts): low stddev = good
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
    } else {
      score += 10;
    }
    return Math.max(0, Math.min(100, Math.round(score)));
  }, [savingsRate, budgetUsage, creditCards, cycleTxns]);

  /* ─── Spending Leak Detection ─── */
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
    // Budget near limit
    budgetUsage.forEach(b => {
      if (b.monthly_limit > 0) {
        const pct = (b.spent / b.monthly_limit) * 100;
        if (pct >= 100) alerts.push({ type: 'danger', message: `${b.category} is over budget (${pct.toFixed(0)}% used — ${fmt(b.spent - b.monthly_limit)} over)` });
        else if (pct >= 80) alerts.push({ type: 'warning', message: `${b.category} is at ${pct.toFixed(0)}% of budget — ${fmt(b.monthly_limit - b.spent)} left` });
      }
    });
    // Low balance
    bankAccounts.forEach(a => {
      if ((a.balance || 0) < 1000) alerts.push({ type: 'danger', message: `Low balance: ${a.account_name} has only ${fmt(a.balance || 0)}` });
    });
    // Spending spike vs prev cycle
    if (prevAggregate && currentAggregate?.totalSpent > 0 && prevAggregate.totalSpent > 0) {
      const changePct = ((currentAggregate.totalSpent - prevAggregate.totalSpent) / prevAggregate.totalSpent) * 100;
      if (changePct > 30) alerts.push({ type: 'warning', message: `Spending is up ${changePct.toFixed(0)}% vs last cycle (${fmt(currentAggregate.totalSpent - prevAggregate.totalSpent)} more)` });
    }
    // High CC utilization
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
    const avgMonthly = income > 0 ? income * 0.15 : 0; // rough estimate
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
  }, [goals, income]);

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

  const monthlyData = transactions.reduce((acc, txn) => {
    const isTrans = txn.category === 'Transfer' || txn.payment_type?.includes('Transfer') || txn.category === 'Credit Card Payment';
    const isCCTxn = txn.payment_type === 'Credit Card';
    if (isTrans || isCCTxn) return acc;
    const key = getShortFinancialMonthLabelForDate(txn.date, cycleStartDay);
    const ex = acc.find(i => i.month === key);
    const amt = Math.abs(txn.amount);
    if (ex) { if (txn.amount > 0) ex.income += amt; else ex.expense += amt; }
    else acc.push({ month: key, income: txn.amount > 0 ? amt : 0, expense: txn.amount < 0 ? amt : 0 });
    return acc;
  }, []);

  const textMain = isDark ? '#f3f4f6' : '#111827';
  const textSub  = isDark ? '#9ca3af' : '#6b7280';
  const cardBg   = isDark ? 'rgba(255,255,255,0.03)' : '#ffffff';

  if (metricsLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ width: 44, height: 44, borderRadius: '50%', border: '4px solid rgba(26,191,148,0.2)', borderTopColor: '#1abf94', animation: 'spin 0.9s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  const SectionHeader = ({ icon: Icon, title, sub, color = '#1abf94' }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
      <div style={{ width: 32, height: 32, borderRadius: 9, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon style={{ width: 16, height: 16, color }} />
      </div>
      <div>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: textMain }}>{title}</p>
        {sub && <p style={{ margin: 0, fontSize: 11, color: textSub }}>{sub}</p>}
      </div>
    </div>
  );

  return (
    <div>
      {/* ─── Row 1: 5 KPI Cards ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-5 mb-5">
        <KpiCard label="Net Worth" value={netWorth} icon={ScaleIcon} color="#1abf94" isDark={isDark} onClick={() => navigate('/accounts')} />
        <KpiCard label="Account Balance" value={accountsBalance} icon={BanknotesIcon} color="#34d399" isDark={isDark} onClick={() => navigate('/accounts')} />
        <KpiCard label="Total Savings" value={totalSavings} icon={ArrowTrendingUpIcon} color="#8b5cf6" isDark={isDark} onClick={() => navigate('/investments')} />
        <KpiCard label="Total Liabilities" value={totalLiabilities} icon={ArrowDownIcon} color="#ef4444" isDark={isDark} onClick={() => navigate('/credit-cards')} />
        <KpiCard label="Savings Rate" value={savingsRate} icon={ChartBarIcon} color="#f59e0b" isDark={isDark} isPercent />
      </div>

      {/* ─── NEW: Financial Health Score + Cash Flow Strip ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-4 sm:gap-5 mb-5">
        {/* Health Score */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card" style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <SectionHeader icon={SparklesIcon} title="Financial Health" sub="Based on savings, budgets & credit" color="#8b5cf6" />
          <HealthGauge score={financialHealthScore} isDark={isDark} />
          <div style={{ display: 'flex', gap: 20, marginTop: 6, fontSize: 11, color: textSub }}>
            <span>Savings <strong style={{ color: textMain }}>{savingsRate.toFixed(1)}%</strong></span>
            <span>CC Util <strong style={{ color: textMain }}>{creditCards.length > 0 ? `${calculateCreditCardHealth(creditCards[0], creditCards).utilization}%` : '—'}</strong></span>
          </div>
        </motion.div>

        {/* Cash Flow Summary */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass-card" style={{ padding: '22px 24px' }}>
          <SectionHeader icon={BanknotesIcon} title="Cash Flow" sub={`${currentCycle.label} · Day ${cycleInfo.daysElapsed}/${cycleInfo.totalDays}`} color="#1abf94" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Income', value: cashFlow.totalIncome, color: '#10b981', prefix: '₹' },
              { label: 'Expenses', value: cashFlow.totalExpenses, color: '#ef4444', prefix: '₹' },
              { label: 'Net Savings', value: cashFlow.netSavings, color: cashFlow.netSavings >= 0 ? '#1abf94' : '#ef4444', prefix: '₹' },
              { label: 'Daily Avg', value: cashFlow.dailyAvgSpend, color: '#f59e0b', prefix: '₹' },
            ].map(({ label, value, color, prefix }) => (
              <div key={label} style={{ padding: '14px 16px', borderRadius: 12, background: isDark ? '#0f1621' : '#f9fafb', border: `1px solid ${isDark ? '#1a2235' : '#e5e7eb'}` }}>
                <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 600, color: textSub, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</p>
                <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color, letterSpacing: '-0.5px' }}>
                  {prefix}{Math.abs(value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </p>
              </div>
            ))}
          </div>
          {/* Cycle progress bar */}
          <div style={{ marginTop: 16 }}>
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
        </motion.div>
      </div>

      {/* ─── Row 2: Spending Heatmap ─── */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card" style={{ padding: 24, marginBottom: 20 }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: textMain, display: 'block', marginBottom: 6 }}>Spending Heatmap</span>
        <p style={{ fontSize: 11, color: textSub, marginBottom: 16 }}>Last 35 days — daily spend intensity</p>
        <SpendingHeatmap transactions={transactions} isDark={isDark} />
      </motion.div>

      {/* ─── Row 3: Spending by Category + Budget Progress ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 mb-5">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card" style={{ padding: 24 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: textMain, display: 'block', marginBottom: 4 }}>Spending by Category</span>
          <p style={{ fontSize: 11, color: textSub, marginBottom: 12 }}>Current cycle breakdown</p>
          {categoryData.length > 0 ? (
            <>
              <div className="h-[250px] sm:h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                  <PieChart>
                    <Pie data={categoryData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value" stroke="none">
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
          ) : <div style={{ textAlign: 'center', padding: '48px 0', color: textSub }}>No spending data yet</div>}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="glass-card" style={{ padding: 24 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: textMain, display: 'block', marginBottom: 16 }}>Budget Progress</span>
          {budgetUsage.filter(b => b.spent > 0).length > 0 ? (
            budgetUsage.filter(b => b.spent > 0).map((b, i) => (
              <SavingsBar key={i} label={b.category} current={b.spent} total={b.monthly_limit || b.spent * 1.5} isDark={isDark} />
            ))
          ) : <div style={{ textAlign: 'center', padding: '40px 0', color: textSub }}>Set budgets to track spending</div>}
        </motion.div>
      </div>

      {/* ─── Row 4: Goals + Net Worth Timeline ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.6fr] gap-4 sm:gap-5 mb-5">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <ShieldCheckIcon style={{ width: 18, height: 18, color: '#f59e0b' }} />
            <span style={{ fontSize: 15, fontWeight: 600, color: textMain }}>Financial Goals</span>
          </div>
          {goals.length > 0 ? goals.slice(0, 3).map((g, i) => (
            <SavingsBar key={g.id || i} label={g.name || g.goal_name || 'Goal'} current={g.current_amount || g.saved_amount || 0} total={g.target_amount || 0} isDark={isDark} />
          )) : <div style={{ textAlign: 'center', padding: '20px 0', color: textSub, fontSize: 13 }}>No goals yet</div>}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="glass-card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: textMain }}>Net Worth Timeline</span>
            <span style={{ fontSize: 12, color: textSub }}>Historical snapshots</span>
          </div>
          <div className="h-[250px] sm:h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              <AreaChart data={snapshots.length > 0 ? snapshots : [
                { date: 'Before', net_worth: netWorth * 0.8 }, { date: 'Now', net_worth: netWorth },
              ]}>
                <defs>
                  <linearGradient id="colorNW" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1abf94" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#1abf94" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: textSub, fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: textSub, fontSize: 10 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} width={45} />
                <Tooltip content={<CustomTooltip isDark={isDark} />} />
                <Area type="monotone" dataKey="net_worth" stroke="#1abf94" strokeWidth={3} fillOpacity={1} fill="url(#colorNW)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* ─── Row 5: Insights + Recent Transactions ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.8fr] gap-4 sm:gap-5 mb-5">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass-card" style={{ padding: 24 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: textMain, display: 'block', marginBottom: 14 }}>💡 Insights</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {insights.slice(0, 4).map((ins, i) => (
              <div key={i} style={{
                padding: '10px 12px', borderRadius: 10, fontSize: 12,
                background: ins.type === 'positive' ? 'rgba(26,191,148,0.08)' : ins.type === 'warning' ? 'rgba(245,158,11,0.08)' : 'rgba(59,130,246,0.08)',
                borderLeft: `3px solid ${ins.type === 'positive' ? '#1abf94' : ins.type === 'warning' ? '#f59e0b' : '#3b82f6'}`,
                color: isDark ? '#d1d5db' : '#374151',
              }}>
                {ins.message}
              </div>
            ))}
            {insights.length === 0 && <p style={{ fontSize: 13, color: textSub, textAlign: 'center', padding: '20px 0' }}>Add transactions to get insights</p>}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="glass-card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: textMain }}>🔄 Recent Transactions</span>
            <button onClick={() => setShowQuickAdd(true)} className="btn-primary" style={{ padding: '6px 14px', fontSize: 12 }}>
              <PlusIcon style={{ width: 14, height: 14 }} /> Add
            </button>
          </div>
          <TransactionTable transactions={transactions.slice(0, 6)} categories={categories} />
        </motion.div>
      </div>

      {/* ════════════════════════════════════════════════════ */}
      {/* ─── NEW ANALYTICS SECTION ─── */}
      {/* ════════════════════════════════════════════════════ */}

      {/* ─── Row 6: Risk Alerts + Smart Recommendations ─── */}
      {(riskAlerts.length > 0 || smartRecommendations.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 mb-5">
          {/* Risk Alerts */}
          {riskAlerts.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card" style={{ padding: '22px 24px' }}>
              <SectionHeader icon={ExclamationTriangleIcon} title="Risk Alerts" sub="Items requiring your attention" color="#ef4444" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {riskAlerts.map((alert, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    padding: '10px 12px', borderRadius: 10,
                    background: alert.type === 'danger' ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)',
                    border: `1px solid ${alert.type === 'danger' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'}`,
                  }}>
                    <ExclamationTriangleIcon style={{ width: 14, height: 14, color: alert.type === 'danger' ? '#ef4444' : '#f59e0b', flexShrink: 0, marginTop: 1 }} />
                    <span style={{ fontSize: 12, color: isDark ? '#d1d5db' : '#374151', lineHeight: 1.5 }}>{alert.message}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Smart Recommendations */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass-card" style={{ padding: '22px 24px' }}>
            <SectionHeader icon={LightBulbIcon} title="Smart Recommendations" sub="Personalized financial guidance" color="#f59e0b" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {smartRecommendations.map((rec, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '10px 12px', borderRadius: 10,
                  background: isDark ? 'rgba(245,158,11,0.06)' : 'rgba(245,158,11,0.05)',
                  border: `1px solid rgba(245,158,11,0.15)`,
                }}>
                  <span style={{ fontSize: 14, lineHeight: 1, flexShrink: 0 }}>{rec.icon}</span>
                  <span style={{ fontSize: 12, color: isDark ? '#d1d5db' : '#374151', lineHeight: 1.5 }}>{rec.text}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      )}

      {/* ─── Row 7: Spending Leaks + Behavioral Insights ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 mb-5">
        {/* Spending Leak Detection */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card" style={{ padding: '22px 24px' }}>
          <SectionHeader icon={FireIcon} title="Top Spending Leaks" sub="High-frequency small transactions this cycle" color="#ef4444" />
          {spendingLeaks.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {spendingLeaks.map((leak, i) => {
                const catColor = categories.find(c => c.name === leak.category)?.color || '#94a3b8';
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10, background: isDark ? '#0f1621' : '#f9fafb', border: `1px solid ${isDark ? '#1a2235' : '#e5e7eb'}` }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: catColor, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: textMain }}>{leak.category}</p>
                      <p style={{ margin: 0, fontSize: 11, color: textSub }}>{leak.count} transactions · avg {fmt(leak.avgPerTxn)}/txn</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#ef4444' }}>{fmt(leak.total)}</p>
                    </div>
                  </div>
                );
              })}
              <p style={{ margin: '8px 0 0', fontSize: 11, color: textSub, padding: '0 4px' }}>
                💡 Tip: Consolidate frequent small purchases to reduce impulse spending.
              </p>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '24px 0', color: textSub, fontSize: 13 }}>
              <CheckCircleIcon style={{ width: 32, height: 32, color: '#1abf94', margin: '0 auto 8px' }} />
              No spending leaks detected this cycle!
            </div>
          )}
        </motion.div>

        {/* Behavioral Insights */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="glass-card" style={{ padding: '22px 24px' }}>
          <SectionHeader icon={ChartBarIcon} title="Behavioral Insights" sub="Your spending patterns this cycle" color="#8b5cf6" />
          <div className="grid grid-cols-2 gap-3">
            <div style={{ padding: '14px', borderRadius: 12, background: isDark ? '#0f1621' : '#f9fafb', border: `1px solid ${isDark ? '#1a2235' : '#e5e7eb'}` }}>
              <p style={{ margin: '0 0 4px', fontSize: 11, color: textSub, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Daily Avg Spend</p>
              <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#f59e0b' }}>{fmt(behavioralInsights.dailyAvg)}</p>
            </div>
            <div style={{ padding: '14px', borderRadius: 12, background: isDark ? '#0f1621' : '#f9fafb', border: `1px solid ${isDark ? '#1a2235' : '#e5e7eb'}` }}>
              <p style={{ margin: '0 0 4px', fontSize: 11, color: textSub, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Transactions</p>
              <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#6366f1' }}>{behavioralInsights.totalTxns}</p>
            </div>
            {behavioralInsights.highestSpendingDay && (
              <div style={{ gridColumn: '1/-1', padding: '14px', borderRadius: 12, background: isDark ? '#0f1621' : '#f9fafb', border: `1px solid ${isDark ? '#1a2235' : '#e5e7eb'}` }}>
                <p style={{ margin: '0 0 4px', fontSize: 11, color: textSub, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Highest Spending Day</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: textMain }}>
                    {new Date(behavioralInsights.highestSpendingDay.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' })}
                  </p>
                  <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#ef4444' }}>{fmt(behavioralInsights.highestSpendingDay.amount)}</p>
                </div>
              </div>
            )}
            {behavioralInsights.mostFrequentCategory && (
              <div style={{ gridColumn: '1/-1', padding: '14px', borderRadius: 12, background: isDark ? '#0f1621' : '#f9fafb', border: `1px solid ${isDark ? '#1a2235' : '#e5e7eb'}` }}>
                <p style={{ margin: '0 0 4px', fontSize: 11, color: textSub, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Most Frequent Category</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: textMain }}>{behavioralInsights.mostFrequentCategory.name}</p>
                  <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 99, background: 'rgba(139,92,246,0.12)', color: '#8b5cf6', fontWeight: 700 }}>
                    {behavioralInsights.mostFrequentCategory.count}× this cycle
                  </span>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* ─── Row 8: Credit Health Panel ─── */}
      {ccHealthData.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card" style={{ padding: '22px 24px', marginBottom: 20 }}>
          <SectionHeader icon={CreditCardIcon} title="Credit Health" sub="Utilization and outstanding amounts" color="#6366f1" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {ccHealthData.map((cc, i) => {
              const { health } = cc;
              return (
                <div key={i} style={{ padding: '14px 16px', borderRadius: 12, background: isDark ? '#0f1621' : '#f9fafb', border: `1px solid ${isDark ? '#1a2235' : '#e5e7eb'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: textMain }}>{cc.account_name}</p>
                      <p style={{ margin: 0, fontSize: 11, color: textSub }}>Limit: {fmt(health.limit)}</p>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: `${health.riskColor}18`, color: health.riskColor }}>
                      {health.riskLevel}
                    </span>
                  </div>
                  {/* Utilization bar */}
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: textSub, marginBottom: 4 }}>
                      <span>Utilization</span>
                      <span style={{ fontWeight: 700, color: health.riskColor }}>{health.utilization}%</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: isDark ? '#1f2937' : '#e5e7eb', overflow: 'hidden' }}>
                      <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(health.utilization, 100)}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        style={{ height: '100%', borderRadius: 3, background: health.riskColor }} />
                    </div>
                  </div>
                  <p style={{ margin: 0, fontSize: 11, color: textSub, lineHeight: 1.4 }}>{health.paymentAdvice}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12, fontWeight: 700 }}>
                    <span style={{ color: textSub }}>Outstanding</span>
                    <span style={{ color: '#ef4444' }}>{fmt(health.outstanding)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* ─── Row 9: Goal Progress Summary ─── */}
      {goalsWithProgress.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="glass-card" style={{ padding: '22px 24px', marginBottom: 20 }}>
          <SectionHeader icon={FlagIcon} title="Goal Progress" sub="Completion forecast and required monthly savings" color="#10b981" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {goalsWithProgress.map((g, i) => (
              <div key={g.id || i} style={{ padding: '14px 16px', borderRadius: 12, background: isDark ? '#0f1621' : '#f9fafb', border: `1px solid ${isDark ? '#1a2235' : '#e5e7eb'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: textMain }}>{g.name || g.goal_name || 'Goal'}</p>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#10b981' }}>{g.pct.toFixed(0)}%</span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: isDark ? '#1f2937' : '#e5e7eb', marginBottom: 8, overflow: 'hidden', position: 'relative' }}>
                  <motion.div initial={{ width: 0 }} animate={{ width: `${g.pct}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    style={{ height: '100%', borderRadius: 3, background: 'linear-gradient(90deg, #1abf94, #10b981)' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: textSub }}>
                  <span>{fmt(g.current_amount || g.saved_amount || 0)} saved</span>
                  <span>Target: {fmt(g.target_amount)}</span>
                </div>
                {g.reqMonthly && (
                  <p style={{ margin: '6px 0 0', fontSize: 11, color: '#f59e0b', fontWeight: 600 }}>
                    Required: {fmt(g.reqMonthly)}/mo to meet deadline
                  </p>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Quick Add */}
      <AnimatePresence>
        {showQuickAdd && (
          <QuickAddTransaction isOpen={showQuickAdd} onClose={() => setShowQuickAdd(false)}
            onSubmit={(data) => addTxnMutation.mutate(data)} accounts={bankAccounts} creditCards={creditCards} categories={categories} />
        )}
      </AnimatePresence>
    </div>
  );
}
