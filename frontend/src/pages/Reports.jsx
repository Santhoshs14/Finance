import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';
import { useData } from '../context/DataContext';
import ChartCard from '../components/ChartCard';
import { budgetSnapshotsAPI } from '../services/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DocumentArrowDownIcon, ChartPieIcon, ScaleIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

export default function Reports() {
  const { isDark } = useTheme();
  const { transactions, categories } = useData();
  const [tab, setTab] = useState('monthly');
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [budgetLimits, setBudgetLimits] = useState({});

  // Load budget snapshot for selected month
  useEffect(() => {
    if (tab !== 'monthly') return;
    const cycleKey = `${year}-${String(month).padStart(2, '0')}`;
    budgetSnapshotsAPI.get(cycleKey)
      .then(data => setBudgetLimits(data?.limits || {}))
      .catch(() => setBudgetLimits({}));
  }, [month, year, tab]);

  const calculateReport = () => {
    setLoading(true);
    // Simulate a small delay for better UX
    setTimeout(() => {
      try {
        if (tab === 'monthly') {
          const filtered = transactions.filter(t => {
            const d = new Date(t.date);
            return (d.getMonth() + 1) === month && d.getFullYear() === year;
          });

          let totalIncome = 0;
          let totalExpense = 0;
          const categoryBreakdown = {};

          filtered.forEach(t => {
            const amt = Math.abs(t.amount);
            if (t.category === 'Income' || t.amount > 0) {
              totalIncome += amt;
            } else {
              totalExpense += amt;
            }

            if (!categoryBreakdown[t.category]) {
              categoryBreakdown[t.category] = { total: 0, count: 0 };
            }
            categoryBreakdown[t.category].total += amt;
            categoryBreakdown[t.category].count += 1;
          });

          setReport({
            total_transactions: filtered.length,
            total_income: totalIncome,
            total_expense: totalExpense,
            savings_rate: totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome * 100).toFixed(1) : 0,
            category_breakdown: categoryBreakdown
          });
        } else {
          // Yearly
          const filtered = transactions.filter(t => new Date(t.date).getFullYear() === year);
          let totalIncome = 0;
          let totalExpense = 0;
          const monthlyBreakdown = {};

          // Initialize all months
          for (let i = 1; i <= 12; i++) {
            monthlyBreakdown[i] = { income: 0, expense: 0 };
          }

          filtered.forEach(t => {
            const d = new Date(t.date);
            const m = d.getMonth() + 1;
            const amt = Math.abs(t.amount);

            if (t.category === 'Income' || t.amount > 0) {
              totalIncome += amt;
              monthlyBreakdown[m].income += amt;
            } else {
              totalExpense += amt;
              monthlyBreakdown[m].expense += amt;
            }
          });

          setReport({
            total_transactions: filtered.length,
            total_income: totalIncome,
            total_expense: totalExpense,
            savings_rate: totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome * 100).toFixed(1) : 0,
            monthly_breakdown: monthlyBreakdown
          });
        }
        toast.success(`${tab.charAt(0).toUpperCase() + tab.slice(1)} report generated!`);
      } catch (err) {
        toast.error('Failed to generate report');
        console.error(err);
      }
      setLoading(false);
    }, 500);
  };

  const exportPDF = () => {
    toast.error('PDF Export requires backend server configuration. Displaying data on screen instead.');
  };

  const categoryData = useMemo(() => {
    if (!report?.category_breakdown) return [];
    return Object.entries(report.category_breakdown)
      .map(([name, d]) => ({ name, total: d.total, count: d.count }))
      .sort((a, b) => b.total - a.total);
  }, [report]);

  const monthlyBreakdownData = useMemo(() => {
    if (!report?.monthly_breakdown) return [];
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return Object.entries(report.monthly_breakdown)
      .map(([m, d]) => ({ 
        month: months[parseInt(m) - 1], 
        income: d.income, 
        expense: d.expense 
      }));
  }, [report]);

  const ts = {
    contentStyle: {
      backgroundColor: isDark ? '#1e293b' : '#fff',
      border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
      borderRadius: '12px',
      fontSize: '12px'
    }
  };

  return (
    <div className="pb-10">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-dark-900'}`}>Reports</h1>
          <p className={`mt-1 ${isDark ? 'text-dark-400' : 'text-dark-500'}`}>Visual insights and financial summaries</p>
        </div>
        {report && (
          <motion.button 
            whileTap={{ scale: 0.95 }} 
            onClick={exportPDF} 
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <DocumentArrowDownIcon className="w-5 h-5 text-primary-500" /> Save as PDF
          </motion.button>
        )}
      </div>

      <div className="glass-card p-6 mb-8 group hover:border-primary-500/30 transition-all">
        <div className="flex flex-wrap gap-5 items-end">
          <div className="flex p-1 bg-dark-100 dark:bg-dark-800 rounded-xl">
            {['monthly', 'yearly'].map(t => (
              <button 
                key={t} 
                onClick={() => { setTab(t); setReport(null); }} 
                className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${tab === t ? 'bg-white dark:bg-dark-700 text-primary-600 shadow-sm' : 'text-dark-500 hover:text-dark-700 dark:hover:text-dark-300'}`}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          
          <div className="flex gap-3 items-center">
            {tab === 'monthly' && (
              <select 
                value={month} 
                onChange={e => { setMonth(parseInt(e.target.value)); setReport(null); }} 
                className="input-field w-32 font-medium"
              >
                {['January','February','March','April','May','June','July','August','September','October','November','December']
                  .map((m, i) => <option key={i} value={i+1}>{m}</option>)}
              </select>
            )}
            <input 
              type="number" 
              value={year} 
              onChange={e => { setYear(parseInt(e.target.value)); setReport(null); }} 
              className="input-field w-24 font-bold text-center" 
              min="2020" max="2030" 
            />
          </div>

          <button 
            onClick={calculateReport} 
            disabled={loading} 
            className="btn-primary px-8 flex items-center gap-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <ChartPieIcon className="w-5 h-5" />
            )}
            {loading ? 'Processing...' : 'Generate Report'}
          </button>
        </div>
      </div>

      {report ? (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Transactions', value: report.total_transactions, color: 'text-primary-500', icon: '📝' },
              { label: 'Income', value: `₹${report.total_income.toLocaleString('en-IN')}`, color: 'text-success-500', icon: '📈' },
              { label: 'Expenses', value: `₹${report.total_expense.toLocaleString('en-IN')}`, color: 'text-danger-500', icon: '📉' },
              { label: 'Savings Rate', value: `${report.savings_rate}%`, color: 'text-warning-500', icon: '🎯' }
            ].map((s, i) => (
              <motion.div 
                key={i} 
                initial={{ opacity: 0, y: 10 }} 
                animate={{ opacity: 1, y: 0 }} 
                transition={{ delay: i * 0.05 }} 
                className="glass-card p-5 border-l-4 border-l-primary-500/20"
              >
                <div className="flex justify-between items-start mb-2">
                  <span className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-dark-500' : 'text-dark-400'}`}>{s.label}</span>
                  <span className="text-xl">{s.icon}</span>
                </div>
                <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {tab === 'monthly' && categoryData.length > 0 && (
              <ChartCard title="Spending by Category" className="shadow-lg h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryData} layout="vertical" margin={{ left: 20, right: 30, top: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={isDark ? '#334155' : '#e2e8f0'} />
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" width={80} axisLine={false} tickLine={false} tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 12, fontWeight: 600 }} />
                    <Tooltip formatter={v => `₹${v.toLocaleString('en-IN')}`} {...ts} cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }} />
                    <Bar dataKey="total" fill="#6366f1" radius={[0, 10, 10, 0]} barSize={24}></Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}

            {/* ─── Budget vs Actual Table ─── */}
            {tab === 'monthly' && categoryData.length > 0 && (
              <ChartCard title={<span className="flex items-center gap-2"><ScaleIcon className="w-4 h-4 text-primary-500" /> Budget vs Actual</span>} className="shadow-lg">
                <div className="overflow-x-auto">
                  <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 6px' }}>
                    <thead>
                      <tr>
                        {['Category', 'Budget', 'Spent', 'Difference', 'Status'].map(h => (
                          <th key={h} style={{ textAlign: h === 'Category' ? 'left' : 'right', fontSize: 11, fontWeight: 700, color: isDark ? '#64748b' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', paddingBottom: 8, paddingLeft: h === 'Category' ? 0 : 8 }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {categoryData.filter(r => r.name !== 'Income').map((row, i) => {
                        const budgeted = budgetLimits[row.name] || 0;
                        const spent = row.total;
                        const diff = budgeted > 0 ? budgeted - spent : null;
                        const over = diff !== null && diff < 0;
                        const statusColor = budgeted === 0 ? '#64748b' : over ? '#ef4444' : diff / budgeted < 0.2 ? '#f59e0b' : '#10b981';
                        const statusLabel = budgeted === 0 ? '—' : over ? 'Over' : diff / budgeted < 0.2 ? 'Near' : 'OK';
                        return (
                          <tr key={row.name}>
                            <td style={{ fontSize: 13, fontWeight: 600, paddingTop: 6, paddingBottom: 6, color: isDark ? '#e2e8f0' : '#1e293b' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor, flexShrink: 0 }} />
                                {row.name}
                              </div>
                            </td>
                            <td style={{ textAlign: 'right', fontSize: 13, paddingLeft: 8, color: isDark ? '#94a3b8' : '#64748b' }}>
                              {budgeted > 0 ? `₹${budgeted.toLocaleString('en-IN')}` : '—'}
                            </td>
                            <td style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, paddingLeft: 8, color: '#ef4444' }}>
                              ₹{spent.toLocaleString('en-IN')}
                            </td>
                            <td style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, paddingLeft: 8, color: diff !== null ? (over ? '#ef4444' : '#10b981') : '#64748b' }}>
                              {diff !== null ? `${over ? '-' : '+'}₹${Math.abs(diff).toLocaleString('en-IN')}` : '—'}
                            </td>
                            <td style={{ textAlign: 'right', paddingLeft: 8 }}>
                              <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: `${statusColor}22`, color: statusColor }}>
                                {statusLabel}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {Object.keys(budgetLimits).length === 0 && (
                    <p style={{ textAlign: 'center', fontSize: 12, padding: '12px 0 4px', color: isDark ? '#64748b' : '#94a3b8' }}>
                      No budget limits set for this month. Set limits in the Budgets page.
                    </p>
                  )}
                </div>
              </ChartCard>
            )}

            {tab === 'yearly' && monthlyBreakdownData.length > 0 && (
              <ChartCard title="Cash Flow Breakdown" className="shadow-lg h-[400px] lg:col-span-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyBreakdownData} margin={{ top: 20, right: 30, left: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#e2e8f0'} />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 12, fontWeight: 700 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 11 }} tickFormatter={v => `₹${v/1000}k`} />
                    <Tooltip formatter={v => `₹${v.toLocaleString('en-IN')}`} {...ts} cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }} />
                    <Bar dataKey="income" fill="#10b981" radius={[6, 6, 0, 0]} barSize={16} />
                    <Bar dataKey="expense" fill="#ef4444" radius={[6, 6, 0, 0]} barSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}

            {tab === 'monthly' && categoryData.length === 0 && (
              <div className="glass-card flex flex-col items-center justify-center p-12 text-center lg:col-span-2">
                <div className="w-16 h-16 bg-dark-100 dark:bg-dark-800 rounded-full flex items-center justify-center mb-4">
                  <ChartPieIcon className="w-8 h-8 text-dark-400" />
                </div>
                <h3 className="text-lg font-bold mb-2">No Data for this Period</h3>
                <p className="text-dark-500 max-w-xs">We couldn't find any transactions for the selected month and year.</p>
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
            Select a period and click "Generate Report" to see your financial health visualised with beautiful charts.
          </p>
        </div>
      )}
    </div>
  );
}

