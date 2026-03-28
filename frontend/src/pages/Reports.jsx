import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { db } from '../config/firebase';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import ChartCard from '../components/ChartCard';
import { budgetSnapshotsAPI } from '../services/api';
import { getFinancialCycle, getRecentFinancialMonths, getCycleDayInfo } from '../utils/financialMonth';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell, ComposedChart, Line,
} from 'recharts';
import {
  DocumentArrowDownIcon, ChartPieIcon, ScaleIcon,
  ArrowTrendingUpIcon, ArrowTrendingDownIcon, FireIcon, SparklesIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

import { fmt } from '../utils/format';

const CHART_COLORS = ['#6366f1','#ef4444','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ec4899','#14b8a6','#f97316','#84cc16'];

export default function Reports() {
  const { isDark } = useTheme();
  const { currentUser } = useAuth();
  const { categories, cycleStartDay } = useData();
  const [tab, setTab] = useState('cycle');
  const [selectedCycleIdx, setSelectedCycleIdx] = useState(0);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [budgetLimits, setBudgetLimits] = useState({}); // { [categoryId]: number }

  const recentCycles = useMemo(() => getRecentFinancialMonths(12, new Date(), cycleStartDay), [cycleStartDay]);
  const selectedCycle = recentCycles[selectedCycleIdx];

  // Load budget snapshot for selected cycle
  useEffect(() => {
    if (!selectedCycle) return;
    budgetSnapshotsAPI.get(selectedCycle.cycleKey)
      .then(data => {
        if (!data) { setBudgetLimits({}); return; }
        // data = { [catId]: { limit, categoryId, ... } }
        const mapped = {};
        Object.entries(data).forEach(([catId, doc]) => {
          mapped[catId] = typeof doc === 'object' ? (doc.limit ?? 0) : doc;
        });
        setBudgetLimits(mapped);
      })
      .catch(() => setBudgetLimits({}));
  }, [selectedCycle]);

  // Helper — get category name from id
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

  const calculateReport = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      if (tab === 'cycle') {
        const cycle = selectedCycle;
        
        // Fetch cycle transactions
        const qCycle = query(collection(db, `users/${currentUser.uid}/transactions`), where('date', '>=', cycle.startDate), where('date', '<=', cycle.endDate));
        const snapCycle = await getDocs(qCycle);
        const filtered = snapCycle.docs.map(d => d.data());

        let totalIncome = 0, totalExpense = 0;
        const categoryBreakdown = {};
        filtered.forEach(t => {
          const amt = Math.abs(t.amount);
          if (t.category === 'Income') totalIncome += amt;
          else if (t.category !== 'Transfer') totalExpense += amt;
          // Skip Transfer and Income from category breakdown
          if (t.category === 'Transfer' || t.category === 'Income') return;
          if (!categoryBreakdown[t.category]) categoryBreakdown[t.category] = { total: 0, count: 0 };
          categoryBreakdown[t.category].total += amt;
          categoryBreakdown[t.category].count += 1;
        });

        // Fetch previous cycle data for comparison chart
        const prevCycleData = recentCycles[1];
        const earliestDate = prevCycleData?.startDate || selectedCycle.startDate;
        const qTrend = query(collection(db, `users/${currentUser.uid}/transactions`), where('date', '>=', earliestDate));
        const snapTrend = await getDocs(qTrend);
        const trendTxns = snapTrend.docs.map(d => d.data());

        // Previous cycle data for vs-last-cycle chart
        const prevCycle = recentCycles[1];
        const prevFiltered = prevCycle
          ? trendTxns.filter(t => t.date >= prevCycle.startDate && t.date <= prevCycle.endDate && t.amount < 0 && t.category !== 'Transfer' && t.category !== 'Income')
          : [];
        const prevCatMap = {};
        prevFiltered.forEach(t => { prevCatMap[t.category] = (prevCatMap[t.category] || 0) + Math.abs(t.amount); });

        // Most improved: biggest reduction vs previous cycle
        let mostImproved = { name: null, saving: 0 };
        Object.entries(prevCatMap).forEach(([cat, prevAmt]) => {
          const currAmt = categoryBreakdown[cat]?.total || 0;
          const saving = prevAmt - currAmt;
          if (saving > mostImproved.saving) mostImproved = { name: cat, saving };
        });

        setReport({
          total_transactions: filtered.length,
          total_income: totalIncome,
          total_expense: totalExpense,
          savings_rate: totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome * 100).toFixed(1) : 0,
          category_breakdown: categoryBreakdown,
          most_improved: mostImproved,
          prev_cat_map: prevCatMap,
        });

      } else {
        // Yearly
        const year = new Date().getFullYear();
        const startString = `${year}-01-01`;
        const endString = `${year}-12-31`;
        
        const qYear = query(collection(db, `users/${currentUser.uid}/transactions`), where('date', '>=', startString), where('date', '<=', endString));
        const snapYear = await getDocs(qYear);
        const filtered = snapYear.docs.map(d => d.data());
        
        let totalIncome = 0, totalExpense = 0;
        const monthlyBreakdown = {};
        for (let i = 1; i <= 12; i++) monthlyBreakdown[i] = { income: 0, expense: 0, savings: 0 };
        filtered.forEach(t => {
          const m = new Date(t.date).getMonth() + 1;
          const amt = Math.abs(t.amount);
          if (t.category === 'Income') { totalIncome += amt; monthlyBreakdown[m].income += amt; }
          else if (t.category !== 'Transfer') { totalExpense += amt; monthlyBreakdown[m].expense += amt; }
        });
        // Compute net savings per month
        Object.keys(monthlyBreakdown).forEach(m => {
          monthlyBreakdown[m].savings = monthlyBreakdown[m].income - monthlyBreakdown[m].expense;
        });
        // Best/worst month
        const monthsWithData = Object.entries(monthlyBreakdown).filter(([, d]) => d.income > 0 || d.expense > 0);
        let bestMonth = null, worstMonth = null;
        if (monthsWithData.length > 0) {
          const monthNames = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
          const sorted = [...monthsWithData].sort((a, b) => b[1].savings - a[1].savings);
          bestMonth = { name: monthNames[parseInt(sorted[0][0])], savings: sorted[0][1].savings };
          worstMonth = { name: monthNames[parseInt(sorted[sorted.length-1][0])], savings: sorted[sorted.length-1][1].savings };
        }
        setReport({
          total_transactions: filtered.length,
          total_income: totalIncome,
          total_expense: totalExpense,
          savings_rate: totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome * 100).toFixed(1) : 0,
          monthly_breakdown: monthlyBreakdown,
          best_month: bestMonth,
          worst_month: worstMonth,
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

  // Derived display data
  const categoryData = useMemo(() => {
    if (!report?.category_breakdown) return [];
    return Object.entries(report.category_breakdown)
      .map(([name, d]) => ({ name, total: d.total, count: d.count, color: getCatColor(name) }))
      .sort((a, b) => b.total - a.total);
  }, [report, categories]);

  const monthlyData = useMemo(() => {
    if (!report?.monthly_breakdown) return [];
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return Object.entries(report.monthly_breakdown)
      .map(([m, d]) => ({ month: months[parseInt(m) - 1], income: d.income, expense: d.expense, savings: d.savings ?? (d.income - d.expense) }));
  }, [report]);

  // Budget vs Actual table data
  const budgetVsActual = useMemo(() => {
    return categoryData.filter(r => r.name !== 'Income').map(row => {
      // Try to find limit by category name matching category id
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

  // Top overspent: highest pct over budget
  const topOverspent = useMemo(() => {
    return budgetVsActual.filter(r => r.over).sort((a, b) => a.diff - b.diff)[0] || null;
  }, [budgetVsActual]);

  // VS Previous cycle comparison chart (top 5 categories)
  const vsPrevData = useMemo(() => {
    if (!report?.category_breakdown || !report?.prev_cat_map) return [];
    const top5 = Object.entries(report.category_breakdown)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 5)
      .map(([name, d]) => ({
        name: name.length > 10 ? name.slice(0, 9) + '…' : name,
        current: d.total,
        previous: report.prev_cat_map[name] || 0,
      }));
    return top5;
  }, [report]);

  const textMain = isDark ? '#f3f4f6' : '#111827';
  const textSub  = isDark ? '#9ca3af' : '#6b7280';

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
            {[['cycle','Cycle Report'], ['yearly','Yearly']].map(([t, label]) => (
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
              { label: 'Transactions', value: report.total_transactions, color: 'text-primary-500',  icon: '📝' },
              { label: 'Income',       value: fmt(report.total_income),  color: 'text-success-500', icon: '📈' },
              { label: 'Expenses',     value: fmt(report.total_expense), color: 'text-danger-500',  icon: '📉' },
              { label: 'Savings Rate', value: `${report.savings_rate}%`, color: 'text-warning-500', icon: '🎯' },
            ].map((s, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="glass-card p-5 border-l-4 border-l-primary-500/20">
                <div className="flex justify-between items-start mb-2">
                  <span className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-dark-500' : 'text-dark-400'}`}>{s.label}</span>
                  <span className="text-xl">{s.icon}</span>
                </div>
                <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
              </motion.div>
            ))}
          </div>

          {/* Yearly extra insight cards */}
          {tab === 'yearly' && (report.best_month || report.worst_month) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-5">
              {report.best_month && (
                <div style={{ padding: '14px 16px', borderRadius: 14, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: '#1abf9422', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <ArrowTrendingUpIcon style={{ width: 18, height: 18, color: '#10b981' }} />
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Best Month</p>
                    <p style={{ margin: '3px 0 0', fontSize: 16, fontWeight: 800, color: textMain }}>{report.best_month.name}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: textSub }}>Net savings: <span style={{ color: '#10b981', fontWeight: 700 }}>{fmt(report.best_month.savings)}</span></p>
                  </div>
                </div>
              )}
              {report.worst_month && (
                <div style={{ padding: '14px 16px', borderRadius: 14, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: '#ef444422', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <ArrowTrendingDownIcon style={{ width: 18, height: 18, color: '#ef4444' }} />
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Toughest Month</p>
                    <p style={{ margin: '3px 0 0', fontSize: 16, fontWeight: 800, color: textMain }}>{report.worst_month.name}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: textSub }}>Net savings: <span style={{ color: '#ef4444', fontWeight: 700 }}>{fmt(report.worst_month.savings)}</span></p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Intelligence Cards (cycle mode only) */}
          {tab === 'cycle' && (topOverspent || report.most_improved?.name) && (
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

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {/* Spending by Category */}
            {tab === 'cycle' && categoryData.length > 0 && (
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
                        <rect key={index} fill={entry.color || CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}

            {/* Budget vs Actual */}
            {tab === 'cycle' && budgetVsActual.length > 0 && (
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
                      {budgetVsActual.map((row, i) => (
                        <tr key={row.name}>
                          <td style={{ fontSize: 13, fontWeight: 600, paddingTop: 6, paddingBottom: 6, color: isDark ? '#e2e8f0' : '#1e293b' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 8, height: 8, borderRadius: '50%', background: row.color || row.statusColor, flexShrink: 0 }} />
                              {row.name}
                            </div>
                          </td>
                          <td style={{ textAlign: 'right', fontSize: 13, paddingLeft: 8, color: isDark ? '#94a3b8' : '#64748b' }}>
                            {row.budgeted > 0 ? fmt(row.budgeted) : '—'}
                          </td>
                          <td style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, paddingLeft: 8, color: '#ef4444' }}>
                            {fmt(row.total)}
                          </td>
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

            {/* Category Split Donut + vs Previous Cycle */}
            {tab === 'cycle' && categoryData.length > 0 && (
              <ChartCard title={<span className="flex items-center gap-2"><ChartPieIcon className="w-4 h-4 text-primary-500" /> Category Split</span>} className="shadow-lg h-[280px] sm:h-[320px]">
                <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                  <PieChart>
                    <Pie
                      data={categoryData.slice(0, 6)}
                      cx="50%" cy="50%"
                      innerRadius={60} outerRadius={95}
                      paddingAngle={3}
                      dataKey="total"
                      nameKey="name"
                    >
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

            {/* vs Previous Cycle bar (top 5 categories) */}
            {tab === 'cycle' && vsPrevData.length > 0 && (
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

            {/* Yearly breakdown with Net Savings line */}
            {tab === 'yearly' && monthlyData.length > 0 && (
              <>
                <ChartCard title="Cash Flow + Net Savings" className="shadow-lg h-[300px] sm:h-[400px] lg:col-span-2">
                  <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                    <ComposedChart data={monthlyData} margin={{ top: 20, right: 30, left: 10, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#e2e8f0'} />
                      <XAxis dataKey="month" axisLine={false} tickLine={false}
                        tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 12, fontWeight: 700 }} />
                      <YAxis axisLine={false} tickLine={false}
                        tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 11 }}
                        tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                      <Tooltip formatter={v => fmt(v)} {...ts} cursor={{ fill: 'rgba(99,102,241,0.05)' }} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="income"  name="Income"  fill="#10b981" radius={[6,6,0,0]} barSize={14} />
                      <Bar dataKey="expense" name="Expense" fill="#ef4444" radius={[6,6,0,0]} barSize={14} />
                      <Line type="monotone" dataKey="savings" name="Net Savings" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 3, fill: '#6366f1' }} activeDot={{ r: 5 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </ChartCard>

                {/* Monthly Summary Table */}
                <div className="glass-card lg:col-span-2" style={{ padding: 24 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: textMain, margin: '0 0 16px 0' }}>Monthly Summary</h3>
                  <div className="overflow-x-auto">
                    <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 4px' }}>
                      <thead>
                        <tr>
                          {['Month','Income','Expense','Net Savings','Rate'].map(h => (
                            <th key={h} style={{ textAlign: h === 'Month' ? 'left' : 'right', fontSize: 11, fontWeight: 700, color: isDark ? '#64748b' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', paddingBottom: 8, paddingLeft: h === 'Month' ? 0 : 8 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {monthlyData.filter(r => r.income > 0 || r.expense > 0).map((row, i) => {
                          const rate = row.income > 0 ? ((row.savings / row.income) * 100).toFixed(0) : '—';
                          const savColor = row.savings >= 0 ? '#10b981' : '#ef4444';
                          return (
                            <tr key={row.month} style={{ background: i % 2 === 0 ? (isDark ? 'rgba(255,255,255,0.02)' : '#f9fafb') : 'transparent' }}>
                              <td style={{ fontSize: 13, fontWeight: 700, color: textMain, padding: '6px 8px 6px 0' }}>{row.month}</td>
                              <td style={{ textAlign: 'right', fontSize: 13, color: '#10b981', fontWeight: 600, paddingLeft: 8 }}>{fmt(row.income)}</td>
                              <td style={{ textAlign: 'right', fontSize: 13, color: '#ef4444', fontWeight: 600, paddingLeft: 8 }}>{fmt(row.expense)}</td>
                              <td style={{ textAlign: 'right', fontSize: 13, color: savColor, fontWeight: 700, paddingLeft: 8 }}>{row.savings >= 0 ? '+' : ''}{fmt(row.savings)}</td>
                              <td style={{ textAlign: 'right', fontSize: 12, color: savColor, fontWeight: 700, paddingLeft: 8 }}>{typeof rate === 'string' ? rate : `${rate}%`}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {monthlyData.every(r => r.income === 0 && r.expense === 0) && (
                      <p style={{ textAlign: 'center', fontSize: 12, color: textSub, padding: '16px 0' }}>No transactions recorded this year.</p>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Empty state */}
            {tab === 'cycle' && categoryData.length === 0 && (
              <div className="glass-card flex flex-col items-center justify-center p-12 text-center lg:col-span-2">
                <div className="w-16 h-16 bg-dark-100 dark:bg-dark-800 rounded-full flex items-center justify-center mb-4">
                  <ChartPieIcon className="w-8 h-8 text-dark-400" />
                </div>
                <h3 className="text-lg font-bold mb-2">No Data for this Period</h3>
                <p className="text-dark-500 max-w-xs">No transactions found for the selected cycle.</p>
              </div>
            )}
          </div>
        </motion.div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
          <div className="w-20 h-20 bg-primary-100 dark:bg-primary-900/20 rounded-3xl flex items-center justify-center mb-6 rotate-3">
            <ChartPieIcon className="w-10 h-10 text-primary-500" />
          </div>
          <h2 className={`text-2xl font-black mb-3 ${isDark ? 'text-white' : 'text-dark-900'}`}>Ready to analyze?</h2>
          <p className={`text-dark-500 max-w-sm mb-8 ${isDark ? 'text-dark-400' : ''}`}>
            Select a financial cycle and click "Generate Report" to see spending insights, budget performance, and category trends.
          </p>
        </div>
      )}
    </div>
  );
}
