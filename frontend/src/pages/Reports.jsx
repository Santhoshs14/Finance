import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { db } from '../config/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import ChartCard from '../components/ChartCard';
import { budgetSnapshotsAPI } from '../services/api';
import { getFinancialCycle, getRecentFinancialMonths, getCycleDayInfo } from '../utils/financialMonth';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell, ComposedChart, Line, AreaChart, Area,
} from 'recharts';
import {
  DocumentArrowDownIcon, ChartPieIcon, ScaleIcon,
  ArrowTrendingUpIcon, ArrowTrendingDownIcon, FireIcon, SparklesIcon,
  CalendarDaysIcon, ShieldCheckIcon, BoltIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { fmt } from '../utils/format';

const CHART_COLORS = ['#6366f1','#ef4444','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ec4899','#14b8a6','#f97316','#84cc16'];

const SKIP_CATS = new Set(['Transfer', 'Credit Card Payment']);
const isSkip = (t) =>
  t.payment_type === 'Credit Card' ||
  t.payment_type === 'Self Transfer' ||
  t.payment_type === 'Transfer' ||
  SKIP_CATS.has(t.category);

export default function Reports() {
  const { isDark } = useTheme();
  const { currentUser } = useAuth();
  const { categories, cycleStartDay } = useData();
  const [tab, setTab] = useState('cycle');
  const [selectedCycleIdx, setSelectedCycleIdx] = useState(0);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [budgetLimits, setBudgetLimits] = useState({});

  const recentCycles = useMemo(() => getRecentFinancialMonths(12, new Date(), cycleStartDay), [cycleStartDay]);
  const selectedCycle = recentCycles[selectedCycleIdx];

  useEffect(() => {
    if (!selectedCycle) return;
    budgetSnapshotsAPI.get(selectedCycle.cycleKey)
      .then(data => {
        if (!data) { setBudgetLimits({}); return; }
        const mapped = {};
        Object.entries(data).forEach(([catId, doc]) => {
          mapped[catId] = typeof doc === 'object' ? (doc.limit ?? 0) : doc;
        });
        setBudgetLimits(mapped);
      })
      .catch(() => setBudgetLimits({}));
  }, [selectedCycle]);

  const getCatName = (id) => categories.find(c => c.id === id)?.name || id;
  const getCatColor = (name) => categories.find(c => c.name === name)?.color || '#94a3b8';

  const ts = {
    contentStyle: {
      backgroundColor: isDark ? '#1e293b' : '#fff',
      border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
      borderRadius: '12px',
      fontSize: '12px',
    },
  };

  /* ════════════════════════════════════════
     GENERATE REPORT
  ════════════════════════════════════════ */
  const calculateReport = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {

      /* ─── CYCLE REPORT ─── */
      if (tab === 'cycle') {
        const cycle = selectedCycle;
        const qCycle = query(
          collection(db, `users/${currentUser.uid}/transactions`),
          where('date', '>=', cycle.startDate),
          where('date', '<=', cycle.endDate)
        );
        const snapCycle = await getDocs(qCycle);
        const filtered = snapCycle.docs.map(d => d.data());

        let totalIncome = 0, totalExpense = 0;
        const categoryBreakdown = {};
        const dayBreakdown = {};      // { 'YYYY-MM-DD': amount }
        const paymentMethodMap = {};  // { 'UPI': amount, ... }
        const accountMap = {};        // { accountId: amount }

        filtered.forEach(t => {
          if (isSkip(t)) return;
          const amt = Math.abs(t.amount);
          if (t.category === 'Income') { totalIncome += amt; return; }
          totalExpense += amt;
          if (t.amount < 0) {
            // Category
            if (!categoryBreakdown[t.category]) categoryBreakdown[t.category] = { total: 0, count: 0 };
            categoryBreakdown[t.category].total += amt;
            categoryBreakdown[t.category].count += 1;
            // Day-wise (use day number in cycle 1..31)
            const d = new Date(t.date + 'T00:00:00');
            const dayKey = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
            dayBreakdown[dayKey] = (dayBreakdown[dayKey] || 0) + amt;
            // Payment method
            const pm = t.payment_type || 'Cash';
            paymentMethodMap[pm] = (paymentMethodMap[pm] || 0) + amt;
            // Account
            if (t.account_id) accountMap[t.account_id] = (accountMap[t.account_id] || 0) + amt;
          }
        });

        // Previous cycle for comparison
        const prevCycle = recentCycles[1];
        let prevFiltered = [];
        let prevCatMap = {};
        let pIncome = 0, pExpense = 0;
        if (prevCycle) {
          const qPrev = query(
            collection(db, `users/${currentUser.uid}/transactions`),
            where('date', '>=', prevCycle.startDate),
            where('date', '<=', prevCycle.endDate)
          );
          const snapPrev = await getDocs(qPrev);
          prevFiltered = snapPrev.docs.map(d => d.data());
          prevFiltered.forEach(t => {
            if (isSkip(t)) return;
            const amt = Math.abs(t.amount);
            if (t.category === 'Income') { pIncome += amt; return; }
            pExpense += amt;
            if (t.amount < 0) prevCatMap[t.category] = (prevCatMap[t.category] || 0) + amt;
          });
        }

        // Most improved
        let mostImproved = { name: null, saving: 0 };
        Object.entries(prevCatMap).forEach(([cat, prevAmt]) => {
          const currAmt = categoryBreakdown[cat]?.total || 0;
          const saving = prevAmt - currAmt;
          if (saving > mostImproved.saving) mostImproved = { name: cat, saving };
        });

        // Spending consistency score (lower CV = more consistent)
        const dayVals = Object.values(dayBreakdown);
        let spendingConsistencyScore = 100;
        if (dayVals.length > 2) {
          const mean = dayVals.reduce((a, b) => a + b, 0) / dayVals.length;
          const variance = dayVals.reduce((s, v) => s + (v - mean) ** 2, 0) / dayVals.length;
          const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;
          spendingConsistencyScore = Math.max(0, Math.min(100, Math.round(100 - cv * 50)));
        }

        // Budget discipline score
        const budgeted = Object.entries(categoryBreakdown).filter(([cat]) => {
          const c = categories.find(x => x.name === cat);
          return c && budgetLimits[c.id] > 0;
        });
        let budgetDisciplineScore = budgeted.length > 0
          ? Math.round((budgeted.filter(([cat, d]) => {
              const c = categories.find(x => x.name === cat);
              return d.total <= (budgetLimits[c?.id] || Infinity);
            }).length / budgeted.length) * 100)
          : null;

        // Spending concentration
        const totalCatSpend = Object.values(categoryBreakdown).reduce((s, d) => s + d.total, 0);
        const top3Pct = Object.values(categoryBreakdown)
          .map(d => d.total)
          .sort((a, b) => b - a)
          .slice(0, 3)
          .reduce((s, v) => s + v, 0);
        const concentrationPct = totalCatSpend > 0 ? Math.round((top3Pct / totalCatSpend) * 100) : 0;

        setReport({
          tab: 'cycle',
          total_transactions: filtered.length,
          total_income: totalIncome,
          total_expense: totalExpense,
          savings_rate: totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome * 100).toFixed(1) : 0,
          category_breakdown: categoryBreakdown,
          most_improved: mostImproved,
          prev_cat_map: prevCatMap,
          prev_income: pIncome,
          prev_expense: pExpense,
          day_breakdown: dayBreakdown,
          payment_method_map: paymentMethodMap,
          account_map: accountMap,
          spending_consistency_score: spendingConsistencyScore,
          budget_discipline_score: budgetDisciplineScore,
          concentration_pct: concentrationPct,
        });

      /* ─── YEARLY REPORT — Financial Cycle aware ─── */
      } else {
        // Get 12 recent financial cycles
        const financialCycles = getRecentFinancialMonths(12, new Date(), cycleStartDay).reverse(); // oldest first

        // Fetch all txns covering entire range
        const oldestStart = financialCycles[0].startDate;
        const newestEnd   = financialCycles[financialCycles.length - 1].endDate;
        const qYear = query(
          collection(db, `users/${currentUser.uid}/transactions`),
          where('date', '>=', oldestStart),
          where('date', '<=', newestEnd)
        );
        const snapYear = await getDocs(qYear);
        const allTxns = snapYear.docs.map(d => d.data());

        // Aggregate per financial cycle
        let totalIncome = 0, totalExpense = 0;
        const cycleData = {};
        financialCycles.forEach(c => {
          cycleData[c.cycleKey] = { label: c.label, income: 0, expense: 0, savings: 0, savingsRate: 0, cats: {} };
        });

        allTxns.forEach(t => {
          if (isSkip(t)) return;
          const amt = Math.abs(t.amount);
          // Find which cycle this txn belongs to
          const cyc = financialCycles.find(c => t.date >= c.startDate && t.date <= c.endDate);
          if (!cyc) return;
          const row = cycleData[cyc.cycleKey];
          if (!row) return;
          if (t.category === 'Income') {
            row.income += amt;
            totalIncome += amt;
          } else if (t.amount < 0) {
            row.expense += amt;
            totalExpense += amt;
            row.cats[t.category] = (row.cats[t.category] || 0) + amt;
          }
        });

        // Compute savings per cycle
        Object.values(cycleData).forEach(row => {
          row.savings = row.income - row.expense;
          row.savingsRate = row.income > 0 ? parseFloat(((row.savings / row.income) * 100).toFixed(1)) : 0;
        });

        // Find best/worst cycle
        const withData = Object.values(cycleData).filter(r => r.income > 0 || r.expense > 0);
        let bestCycle = null, worstCycle = null;
        if (withData.length > 0) {
          const sorted = [...withData].sort((a, b) => b.savings - a.savings);
          bestCycle  = sorted[0];
          worstCycle = sorted[sorted.length - 1];
        }

        // Category evolution: top 5 categories across all cycles
        const allCats = {};
        Object.values(cycleData).forEach(r => {
          Object.entries(r.cats).forEach(([cat, amt]) => {
            allCats[cat] = (allCats[cat] || 0) + amt;
          });
        });
        const top5Cats = Object.entries(allCats).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([c]) => c);
        const categoryEvolution = Object.values(cycleData).map(r => {
          const row = { label: r.label.replace(/^(\w+)\s/, m => m.slice(0, 3) + ' ') };
          top5Cats.forEach(cat => { row[cat] = r.cats[cat] || 0; });
          return row;
        });

        // Spending volatility (coefficient of variation of monthly expenses)
        const expenseVals = withData.map(r => r.expense);
        let volatilityScore = 0;
        if (expenseVals.length > 1) {
          const mean = expenseVals.reduce((a, b) => a + b, 0) / expenseVals.length;
          const variance = expenseVals.reduce((s, v) => s + (v - mean) ** 2, 0) / expenseVals.length;
          const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;
          volatilityScore = parseFloat((cv * 100).toFixed(1));
        }

        setReport({
          tab: 'yearly',
          total_transactions: allTxns.length,
          total_income: totalIncome,
          total_expense: totalExpense,
          savings_rate: totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome * 100).toFixed(1) : 0,
          cycle_data: cycleData, // { [cycleKey]: { label, income, expense, savings, savingsRate, cats } }
          best_cycle: bestCycle,
          worst_cycle: worstCycle,
          top5_cats: top5Cats,
          category_evolution: categoryEvolution,
          volatility_score: volatilityScore,
        });
      }

      toast.success('Report generated!');
    } catch (err) {
      toast.error('Failed to generate report');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  /* ─── Derived display data ─── */
  const categoryData = useMemo(() => {
    if (!report?.category_breakdown) return [];
    return Object.entries(report.category_breakdown)
      .map(([name, d]) => ({ name, total: d.total, count: d.count, color: getCatColor(name) }))
      .sort((a, b) => b.total - a.total);
  }, [report, categories]);

  const monthlyData = useMemo(() => {
    if (report?.tab !== 'yearly' || !report?.cycle_data) return [];
    return Object.values(report.cycle_data)
      .map(r => ({ month: r.label.replace(/^(\w+)\s(\d+)/, (_, m, y) => m.slice(0, 3) + ' ' + y.slice(2)), income: r.income, expense: r.expense, savings: r.savings, savingsRate: r.savingsRate }));
  }, [report]);

  const budgetVsActual = useMemo(() => {
    return categoryData.filter(r => r.name !== 'Income').map(row => {
      const cat = categories.find(c => c.name === row.name);
      const budgeted = cat && budgetLimits[cat.id] ? budgetLimits[cat.id] : 0;
      const diff = budgeted > 0 ? budgeted - row.total : null;
      const over = diff !== null && diff < 0;
      const pct = budgeted > 0 ? (row.total / budgeted * 100) : null;
      const statusColor = budgeted === 0 ? '#64748b' : over ? '#ef4444' : diff / budgeted < 0.2 ? '#f59e0b' : '#10b981';
      const statusLabel = budgeted === 0 ? '—' : over ? 'Over' : diff / budgeted < 0.2 ? 'Near' : 'Safe';
      return { ...row, budgeted, diff, over, pct, statusColor, statusLabel };
    });
  }, [categoryData, budgetLimits, categories]);

  const topOverspent = useMemo(() =>
    budgetVsActual.filter(r => r.over).sort((a, b) => a.diff - b.diff)[0] || null,
    [budgetVsActual]
  );

  const vsPrevData = useMemo(() => {
    if (!report?.category_breakdown || !report?.prev_cat_map) return [];
    return Object.entries(report.category_breakdown)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 6)
      .map(([name, d]) => ({
        name: name.length > 10 ? name.slice(0, 9) + '…' : name,
        current: d.total,
        previous: report.prev_cat_map[name] || 0,
        pctChange: report.prev_cat_map[name] > 0
          ? parseFloat((((d.total - report.prev_cat_map[name]) / report.prev_cat_map[name]) * 100).toFixed(1))
          : null,
      }));
  }, [report]);

  const dayWiseData = useMemo(() => {
    if (!report?.day_breakdown) return [];
    return Object.entries(report.day_breakdown)
      .sort(([a], [b]) => {
        // sort by actual calendar order
        const da = new Date(a + ' 2000'), db2 = new Date(b + ' 2000');
        return da - db2;
      })
      .map(([day, amount]) => ({ day, amount }));
  }, [report]);

  const paymentMethodData = useMemo(() => {
    if (!report?.payment_method_map) return [];
    return Object.entries(report.payment_method_map)
      .map(([name, value], i) => ({ name, value, color: CHART_COLORS[i % CHART_COLORS.length] }))
      .sort((a, b) => b.value - a.value);
  }, [report]);

  const textMain = isDark ? '#f3f4f6' : '#111827';
  const textSub  = isDark ? '#9ca3af' : '#6b7280';

  const ScoreBadge = ({ label, score, color }) => (
    <div style={{ padding: '12px 16px', borderRadius: 12, background: isDark ? '#0f1621' : '#f9fafb', border: `1px solid ${isDark ? '#1a2235' : '#e5e7eb'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: textMain }}>{label}</span>
      <span style={{ fontSize: 18, fontWeight: 800, color: color || '#1abf94' }}>{score !== null ? `${score}` : '—'}</span>
    </div>
  );

  return (
    <div className="pb-10">
      {/* ─── Header ─── */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-dark-900'}`}>Reports</h1>
          <p className={`mt-1 ${isDark ? 'text-dark-400' : 'text-dark-500'}`}>Financial insights across your spending cycles</p>
        </div>
      </div>

      {/* ─── Controls ─── */}
      <div className="glass-card p-6 mb-8">
        <div className="flex flex-wrap gap-5 items-end">
          <div className="flex p-1 rounded-xl" style={{ background: isDark ? '#1a2235' : '#f1f5f9' }}>
            {[['cycle','Cycle Report'], ['yearly','Yearly (12 Cycles)']].map(([t, label]) => (
              <button key={t} onClick={() => { setTab(t); setReport(null); }}
                className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${tab === t ? 'bg-white dark:bg-dark-700 text-primary-600 shadow-sm' : 'text-dark-500 hover:text-dark-700 dark:hover:text-dark-300'}`}
              >{label}</button>
            ))}
          </div>

          {tab === 'cycle' && (
            <select value={selectedCycleIdx} onChange={e => { setSelectedCycleIdx(Number(e.target.value)); setReport(null); }}
              className="input-field" style={{ minWidth: 180 }}>
              {recentCycles.map((c, i) => (
                <option key={c.cycleKey} value={i}>{c.label}{i === 0 ? ' (Current)' : ''}</option>
              ))}
            </select>
          )}

          <button onClick={calculateReport} disabled={loading} className="btn-primary px-8 flex items-center gap-2">
            {loading
              ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <ChartPieIcon className="w-5 h-5" />}
            {loading ? 'Processing...' : 'Generate Report'}
          </button>
        </div>
      </div>

      {/* ─── Report content ─── */}
      {report ? (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-5">
            {[
              { label: 'Transactions', value: report.total_transactions, color: 'text-primary-500', icon: '📝' },
              {
                label: 'Income', value: fmt(report.total_income), color: 'text-success-500', icon: '📈',
                trend: report.prev_income > 0 ? ((report.total_income - report.prev_income) / report.prev_income * 100) : null,
                trendGoodUp: true,
              },
              {
                label: 'Expenses', value: fmt(report.total_expense), color: 'text-danger-500', icon: '📉',
                trend: report.prev_expense > 0 ? ((report.total_expense - report.prev_expense) / report.prev_expense * 100) : null,
                trendGoodUp: false,
              },
              { label: 'Savings Rate', value: `${report.savings_rate}%`, color: 'text-warning-500', icon: '🎯' },
            ].map((s, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="glass-card p-5 border-l-4 border-l-primary-500/20">
                <div className="flex justify-between items-start mb-2">
                  <span className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-dark-500' : 'text-dark-400'}`}>{s.label}</span>
                  <span className="text-xl">{s.icon}</span>
                </div>
                <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                {s.trend != null && Math.abs(s.trend) > 0.1 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
                    {s.trend > 0
                      ? <ArrowTrendingUpIcon style={{ width: 14, height: 14, color: s.trendGoodUp ? '#10b981' : '#ef4444' }} />
                      : <ArrowTrendingDownIcon style={{ width: 14, height: 14, color: s.trendGoodUp ? '#ef4444' : '#10b981' }} />
                    }
                    <span style={{ fontSize: 12, fontWeight: 600, color: isDark ? '#9ca3af' : '#6b7280' }}>
                      {s.trend > 0 ? '+' : ''}{s.trend.toFixed(1)}% vs last cycle
                    </span>
                  </div>
                )}
              </motion.div>
            ))}
          </div>

          {/* ─── CYCLE REPORT ANALYTICS ─── */}
          {report.tab === 'cycle' && (
            <>
              {/* Advanced Scores Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
                <ScoreBadge label="Spending Consistency" score={report.spending_consistency_score} color={report.spending_consistency_score > 70 ? '#10b981' : report.spending_consistency_score > 40 ? '#f59e0b' : '#ef4444'} />
                <ScoreBadge label="Budget Discipline" score={report.budget_discipline_score !== null ? `${report.budget_discipline_score}%` : null} color={report.budget_discipline_score > 80 ? '#10b981' : report.budget_discipline_score > 50 ? '#f59e0b' : '#ef4444'} />
                <ScoreBadge label="Top-3 Category Share" score={`${report.concentration_pct}%`} color={report.concentration_pct > 70 ? '#ef4444' : report.concentration_pct > 50 ? '#f59e0b' : '#10b981'} />
              </div>

              {/* Intelligence Cards */}
              {(topOverspent || report.most_improved?.name) && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-5">
                  {topOverspent && (
                    <div style={{ padding: '14px 16px', borderRadius: 14, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: '#ef444422', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <FireIcon style={{ width: 18, height: 18, color: '#ef4444' }} />
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Top Overspent</p>
                        <p style={{ margin: '3px 0 0', fontSize: 16, fontWeight: 800, color: textMain }}>{topOverspent.name}</p>
                        <p style={{ margin: '2px 0 0', fontSize: 12, color: textSub }}>
                          {fmt(topOverspent.total)} spent · Budget: {fmt(topOverspent.budgeted)} · <span style={{ color: '#ef4444', fontWeight: 700 }}>{Math.abs(topOverspent.diff) > 0 ? fmt(Math.abs(topOverspent.diff)) + ' over' : 'At limit'}</span>
                        </p>
                      </div>
                    </div>
                  )}
                  {report.most_improved?.name && (
                    <div style={{ padding: '14px 16px', borderRadius: 14, background: 'rgba(26,191,148,0.08)', border: '1px solid rgba(26,191,148,0.25)', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: '#1abf9422', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <ArrowTrendingDownIcon style={{ width: 18, height: 18, color: '#1abf94' }} />
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#1abf94', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Most Improved</p>
                        <p style={{ margin: '3px 0 0', fontSize: 16, fontWeight: 800, color: textMain }}>{report.most_improved.name}</p>
                        <p style={{ margin: '2px 0 0', fontSize: 12, color: textSub }}>
                          Saved <span style={{ color: '#1abf94', fontWeight: 700 }}>{fmt(report.most_improved.saving)}</span> vs previous cycle
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Charts Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-5">
                {/* Spending by Category */}
                {categoryData.length > 0 && (
                  <ChartCard title="Spending by Category" className="shadow-lg h-[300px] sm:h-[400px]">
                    <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                      <BarChart data={categoryData.filter(d => d.name !== 'Income')} layout="vertical" margin={{ left: 20, right: 30, top: 10, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={isDark ? '#334155' : '#e2e8f0'} />
                        <XAxis type="number" hide />
                        <YAxis type="category" dataKey="name" width={90} axisLine={false} tickLine={false}
                          tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 12, fontWeight: 600 }} />
                        <Tooltip formatter={v => fmt(v)} {...ts} cursor={{ fill: 'rgba(99,102,241,0.05)' }} />
                        <Bar dataKey="total" radius={[0, 10, 10, 0]} barSize={22}>
                          {categoryData.filter(d => d.name !== 'Income').map((entry, index) => (
                            <Cell key={index} fill={entry.color || CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>
                )}

                {/* Budget vs Actual */}
                {budgetVsActual.length > 0 && (
                  <ChartCard title={<span className="flex items-center gap-2"><ScaleIcon className="w-4 h-4 text-primary-500" /> Budget vs Actual</span>} className="shadow-lg">
                    <div className="overflow-x-auto">
                      <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 6px' }}>
                        <thead>
                          <tr>
                            {['Category','Budget','Spent','Difference','Status'].map(h => (
                              <th key={h} style={{ textAlign: h === 'Category' ? 'left' : 'right', fontSize: 11, fontWeight: 700, color: isDark ? '#64748b' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', paddingBottom: 8, paddingLeft: h === 'Category' ? 0 : 8 }}>
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {budgetVsActual.map((row) => (
                            <tr key={row.name}>
                              <td style={{ fontSize: 13, fontWeight: 600, paddingTop: 6, paddingBottom: 6, color: isDark ? '#e2e8f0' : '#1e293b' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: row.color || row.statusColor, flexShrink: 0 }} />
                                  {row.name}
                                </div>
                              </td>
                              <td style={{ textAlign: 'right', fontSize: 13, paddingLeft: 8, color: isDark ? '#94a3b8' : '#64748b' }}>{row.budgeted > 0 ? fmt(row.budgeted) : '—'}</td>
                              <td style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, paddingLeft: 8, color: '#ef4444' }}>{fmt(row.total)}</td>
                              <td style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, paddingLeft: 8, color: row.diff !== null ? (row.over ? '#ef4444' : '#10b981') : '#64748b' }}>
                                {row.diff !== null ? `${row.over ? '-' : '+'}${fmt(Math.abs(row.diff))}` : '—'}
                              </td>
                              <td style={{ textAlign: 'right', paddingLeft: 8 }}>
                                <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: `${row.statusColor}22`, color: row.statusColor }}>
                                  {row.statusLabel}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {Object.keys(budgetLimits).length === 0 && (
                        <p style={{ textAlign: 'center', fontSize: 12, padding: '12px 0 4px', color: isDark ? '#64748b' : '#94a3b8' }}>
                          No budget limits set. Set limits in the Budgets page.
                        </p>
                      )}
                    </div>
                  </ChartCard>
                )}

                {/* Category Split Donut */}
                {categoryData.length > 0 && (
                  <ChartCard title={<span className="flex items-center gap-2"><ChartPieIcon className="w-4 h-4 text-primary-500" /> Category Split</span>} className="shadow-lg h-[280px] sm:h-[320px]">
                    <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                      <PieChart>
                        <Pie data={categoryData.slice(0, 6)} cx="50%" cy="50%" innerRadius={60} outerRadius={95} paddingAngle={3} dataKey="total" nameKey="name">
                          {categoryData.slice(0, 6).map((entry, index) => (
                            <Cell key={index} fill={entry.color || CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={v => fmt(v)} {...ts} />
                        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartCard>
                )}

                {/* vs Previous Cycle */}
                {vsPrevData.length > 0 && (
                  <ChartCard title={<span className="flex items-center gap-2"><ArrowTrendingUpIcon className="w-4 h-4 text-primary-500" /> vs Previous Cycle</span>} className="shadow-lg h-[280px] sm:h-[320px]">
                    <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                      <BarChart data={vsPrevData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#e2e8f0'} />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 11, fontWeight: 600 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 10 }} tickFormatter={v => `₹${v >= 1000 ? (v/1000).toFixed(0)+'k' : v}`} />
                        <Tooltip formatter={v => fmt(v)} {...ts} />
                        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="previous" name="Last Cycle" fill={isDark ? '#475569' : '#cbd5e1'} radius={[4,4,0,0]} barSize={14} />
                        <Bar dataKey="current" name="This Cycle" fill="#6366f1" radius={[4,4,0,0]} barSize={14} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>
                )}
              </div>

              {/* ─── NEW: Category % Change Table ─── */}
              {vsPrevData.length > 0 && (
                <div className="glass-card mb-5" style={{ padding: 24 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: textMain, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <BoltIcon style={{ width: 16, height: 16, color: '#6366f1' }} />
                    Category Change vs Previous Cycle
                  </h3>
                  <div className="overflow-x-auto">
                    <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 4px' }}>
                      <thead>
                        <tr>
                          {['Category', 'Last Cycle', 'This Cycle', 'Change', '% Change'].map(h => (
                            <th key={h} style={{ textAlign: h === 'Category' ? 'left' : 'right', fontSize: 11, fontWeight: 700, color: textSub, textTransform: 'uppercase', letterSpacing: '0.05em', paddingBottom: 8, paddingLeft: h === 'Category' ? 0 : 8 }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {vsPrevData.map((row, i) => {
                          const change = row.current - row.previous;
                          const isUp = change > 0;
                          const changeColor = isUp ? '#ef4444' : '#10b981';
                          return (
                            <tr key={i} style={{ background: i % 2 === 0 ? (isDark ? 'rgba(255,255,255,0.02)' : '#f9fafb') : 'transparent' }}>
                              <td style={{ fontSize: 13, fontWeight: 600, color: textMain, padding: '7px 8px 7px 0' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: getCatColor(row.name), flexShrink: 0 }} />
                                  {row.name}
                                </div>
                              </td>
                              <td style={{ textAlign: 'right', fontSize: 13, color: textSub, paddingLeft: 8 }}>{fmt(row.previous)}</td>
                              <td style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, paddingLeft: 8, color: textMain }}>{fmt(row.current)}</td>
                              <td style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, paddingLeft: 8, color: changeColor }}>
                                {isUp ? '+' : ''}{fmt(change)}
                              </td>
                              <td style={{ textAlign: 'right', paddingLeft: 8 }}>
                                {row.pctChange !== null ? (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: `${changeColor}18`, color: changeColor }}>
                                    {isUp ? '↑' : '↓'} {Math.abs(row.pctChange)}%
                                  </span>
                                ) : '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ─── NEW: Day-wise Spending + Payment Method ─── */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-5">
                {/* Day-wise breakdown */}
                {dayWiseData.length > 0 && (
                  <ChartCard title={<span className="flex items-center gap-2"><CalendarDaysIcon className="w-4 h-4 text-primary-500" /> Day-wise Spending</span>} className="shadow-lg h-[260px]">
                    <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                      <BarChart data={dayWiseData} margin={{ top: 5, right: 10, left: 0, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#e2e8f0'} />
                        <XAxis dataKey="day" axisLine={false} tickLine={false} interval="preserveStartEnd"
                          tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 10 }} angle={-45} textAnchor="end" height={40} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 10 }}
                          tickFormatter={v => `₹${v >= 1000 ? (v/1000).toFixed(0)+'k' : v}`} width={40} />
                        <Tooltip formatter={v => fmt(v)} {...ts} />
                        <Bar dataKey="amount" name="Spent" fill="#6366f1" radius={[4,4,0,0]} barSize={12} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>
                )}

                {/* Payment Method Distribution */}
                {paymentMethodData.length > 0 && (
                  <ChartCard title={<span className="flex items-center gap-2"><ChartPieIcon className="w-4 h-4 text-primary-500" /> Payment Methods</span>} className="shadow-lg h-[260px]">
                    <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                      <PieChart>
                        <Pie data={paymentMethodData} cx="50%" cy="45%" outerRadius={80} dataKey="value" nameKey="name" paddingAngle={3} stroke="none">
                          {paymentMethodData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        </Pie>
                        <Tooltip formatter={v => fmt(v)} {...ts} />
                        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartCard>
                )}
              </div>

              {/* Empty state */}
              {categoryData.length === 0 && (
                <div className="glass-card flex flex-col items-center justify-center p-12 text-center">
                  <div className="w-16 h-16 bg-dark-100 dark:bg-dark-800 rounded-full flex items-center justify-center mb-4">
                    <ChartPieIcon className="w-8 h-8 text-dark-400" />
                  </div>
                  <h3 className="text-lg font-bold mb-2">No Data for this Period</h3>
                  <p className="text-dark-500 max-w-xs">No transactions found for the selected cycle.</p>
                </div>
              )}
            </>
          )}

          {/* ─── YEARLY REPORT (Financial Cycles) ─── */}
          {report.tab === 'yearly' && (
            <>
              {/* Best / Worst Cycle Cards */}
              {(report.best_cycle || report.worst_cycle) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-5">
                  {report.best_cycle && (
                    <div style={{ padding: '14px 16px', borderRadius: 14, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: '#1abf9422', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <ArrowTrendingUpIcon style={{ width: 18, height: 18, color: '#10b981' }} />
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Best Financial Cycle</p>
                        <p style={{ margin: '3px 0 0', fontSize: 16, fontWeight: 800, color: textMain }}>{report.best_cycle.label}</p>
                        <p style={{ margin: '2px 0 0', fontSize: 12, color: textSub }}>Savings rate: <span style={{ color: '#10b981', fontWeight: 700 }}>{report.best_cycle.savingsRate}%</span> · Saved {fmt(report.best_cycle.savings)}</p>
                      </div>
                    </div>
                  )}
                  {report.worst_cycle && (
                    <div style={{ padding: '14px 16px', borderRadius: 14, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: '#ef444422', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <ArrowTrendingDownIcon style={{ width: 18, height: 18, color: '#ef4444' }} />
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Toughest Cycle</p>
                        <p style={{ margin: '3px 0 0', fontSize: 16, fontWeight: 800, color: textMain }}>{report.worst_cycle.label}</p>
                        <p style={{ margin: '2px 0 0', fontSize: 12, color: textSub }}>Net: <span style={{ color: report.worst_cycle.savings >= 0 ? '#10b981' : '#ef4444', fontWeight: 700 }}>{fmt(report.worst_cycle.savings)}</span></p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Volatility Score */}
              {report.volatility_score !== undefined && (
                <div className="glass-card mb-5" style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <SparklesIcon style={{ width: 16, height: 16, color: '#8b5cf6' }} />
                    <div>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: textMain }}>Spending Volatility</p>
                      <p style={{ margin: 0, fontSize: 11, color: textSub }}>Coefficient of variation across 12 cycles — lower is better</p>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: report.volatility_score < 25 ? '#10b981' : report.volatility_score < 50 ? '#f59e0b' : '#ef4444' }}>
                      {report.volatility_score}%
                    </p>
                    <p style={{ margin: 0, fontSize: 11, color: textSub }}>
                      {report.volatility_score < 25 ? 'Very Consistent' : report.volatility_score < 50 ? 'Moderate' : 'Highly Variable'}
                    </p>
                  </div>
                </div>
              )}

              {/* Cash Flow + Net Savings chart (full width) */}
              {monthlyData.length > 0 && (
                <>
                  <ChartCard title="Cash Flow · 12 Financial Cycles" className="shadow-lg h-[300px] sm:h-[400px] mb-5">
                    <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                      <ComposedChart data={monthlyData} margin={{ top: 20, right: 30, left: 10, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#e2e8f0'} />
                        <XAxis dataKey="month" axisLine={false} tickLine={false}
                          tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 10, fontWeight: 700 }} />
                        <YAxis axisLine={false} tickLine={false}
                          tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 10 }}
                          tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                        <Tooltip formatter={v => fmt(v)} {...ts} cursor={{ fill: 'rgba(99,102,241,0.05)' }} />
                        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="income"  name="Income"  fill="#10b981" radius={[6,6,0,0]} barSize={12} />
                        <Bar dataKey="expense" name="Expense" fill="#ef4444" radius={[6,6,0,0]} barSize={12} />
                        <Line type="monotone" dataKey="savings" name="Net Savings" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 3, fill: '#6366f1' }} activeDot={{ r: 5 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </ChartCard>

                  {/* Category Evolution */}
                  {report.category_evolution?.length > 0 && report.top5_cats?.length > 0 && (
                    <ChartCard title="Category Evolution (Top 5)" className="shadow-lg h-[300px] mb-5">
                      <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                        <BarChart data={report.category_evolution} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#e2e8f0'} />
                          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 10 }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 10 }} tickFormatter={v => `₹${v >= 1000 ? (v/1000).toFixed(0)+'k' : v}`} width={40} />
                          <Tooltip formatter={v => fmt(v)} {...ts} />
                          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                          {report.top5_cats.map((cat, i) => (
                            <Bar key={cat} dataKey={cat} stackId="a" fill={getCatColor(cat) || CHART_COLORS[i % CHART_COLORS.length]} radius={i === report.top5_cats.length - 1 ? [4,4,0,0] : [0,0,0,0]} />
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartCard>
                  )}

                  {/* Monthly Summary Table */}
                  <div className="glass-card" style={{ padding: 24 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: textMain, margin: '0 0 16px 0' }}>Financial Cycle Summary</h3>
                    <div className="overflow-x-auto">
                      <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 4px' }}>
                        <thead>
                          <tr>
                            {['Cycle','Income','Expense','Net Savings','Rate'].map(h => (
                              <th key={h} style={{ textAlign: h === 'Cycle' ? 'left' : 'right', fontSize: 11, fontWeight: 700, color: textSub, textTransform: 'uppercase', letterSpacing: '0.05em', paddingBottom: 8, paddingLeft: h === 'Cycle' ? 0 : 8 }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {monthlyData.filter(r => r.income > 0 || r.expense > 0).map((row, i) => {
                            const savColor = row.savings >= 0 ? '#10b981' : '#ef4444';
                            return (
                              <tr key={i} style={{ background: i % 2 === 0 ? (isDark ? 'rgba(255,255,255,0.02)' : '#f9fafb') : 'transparent' }}>
                                <td style={{ fontSize: 13, fontWeight: 700, color: textMain, padding: '6px 8px 6px 0' }}>{row.month}</td>
                                <td style={{ textAlign: 'right', fontSize: 13, color: '#10b981', fontWeight: 600, paddingLeft: 8 }}>{fmt(row.income)}</td>
                                <td style={{ textAlign: 'right', fontSize: 13, color: '#ef4444', fontWeight: 600, paddingLeft: 8 }}>{fmt(row.expense)}</td>
                                <td style={{ textAlign: 'right', fontSize: 13, color: savColor, fontWeight: 700, paddingLeft: 8 }}>{row.savings >= 0 ? '+' : ''}{fmt(row.savings)}</td>
                                <td style={{ textAlign: 'right', fontSize: 12, color: savColor, fontWeight: 700, paddingLeft: 8 }}>{row.income > 0 ? `${row.savingsRate}%` : '—'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {monthlyData.every(r => r.income === 0 && r.expense === 0) && (
                        <p style={{ textAlign: 'center', fontSize: 12, color: textSub, padding: '16px 0' }}>No transactions found in the last 12 financial cycles.</p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </>
          )}

        </motion.div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
          <div className="w-20 h-20 bg-primary-100 dark:bg-primary-900/20 rounded-3xl flex items-center justify-center mb-6 rotate-3">
            <ChartPieIcon className="w-10 h-10 text-primary-500" />
          </div>
          <h2 className={`text-2xl font-black mb-3 ${isDark ? 'text-white' : 'text-dark-900'}`}>Ready to analyze?</h2>
          <p className={`text-dark-500 max-w-sm mb-8 ${isDark ? 'text-dark-400' : ''}`}>
            Select a financial cycle and click "Generate Report" to see spending insights, budget performance, and category trends.
            {tab === 'yearly' && <><br /><span style={{ color: '#1abf94', fontWeight: 600 }}>Yearly report uses your financial cycles (not calendar months).</span></>}
          </p>
        </div>
      )}
    </div>
  );
}
