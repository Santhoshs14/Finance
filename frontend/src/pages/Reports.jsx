import { useState } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';
import ChartCard from '../components/ChartCard';
import { reportsAPI } from '../services/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DocumentArrowDownIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

export default function Reports() {
  const { isDark } = useTheme();
  const [tab, setTab] = useState('monthly');
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = tab === 'monthly'
        ? await reportsAPI.getMonthly({ month, year })
        : await reportsAPI.getYearly({ year });
      setReport(res.data.data);
    } catch (e) { toast.error('Failed to load report'); }
    setLoading(false);
  };

  const exportPDF = async () => {
    try {
      const res = tab === 'monthly'
        ? await reportsAPI.getMonthlyPDF({ month, year })
        : await reportsAPI.getYearlyPDF({ year });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a'); a.href = url;
      a.download = `${tab}_report_${tab === 'monthly' ? `${month}_` : ''}${year}.pdf`;
      a.click(); URL.revokeObjectURL(url);
      toast.success('PDF downloaded!');
    } catch (e) { toast.error('PDF export failed'); }
  };

  const categoryData = report?.category_breakdown
    ? Object.entries(report.category_breakdown).map(([name, d]) => ({ name, total: d.total, count: d.count })).sort((a, b) => b.total - a.total)
    : [];

  const monthlyBreakdown = report?.monthly_breakdown
    ? Object.entries(report.monthly_breakdown).map(([m, d]) => ({ month: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][parseInt(m)-1], income: d.income, expense: d.expense }))
    : [];

  const ts = {
    contentStyle: {
      backgroundColor: isDark ? '#1e293b' : '#fff',
      border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
      borderRadius: '12px',
      maxWidth: '250px',
      whiteSpace: 'normal'
    },
    wrapperStyle: { zIndex: 100 }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-dark-900'}`}>Reports</h1>
          <p className={`mt-1 ${isDark ? 'text-dark-400' : 'text-dark-500'}`}>Financial summaries & PDF export</p>
        </div>
        {report && (
          <motion.button whileTap={{ scale: 0.95 }} onClick={exportPDF} className="btn-primary flex items-center gap-2">
            <DocumentArrowDownIcon className="w-5 h-5" /> Export PDF
          </motion.button>
        )}
      </div>

      <div className="glass-card p-6 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex gap-2">
            {['monthly', 'yearly'].map(t => (
              <button key={t} onClick={() => { setTab(t); setReport(null); }} className={`px-4 py-2 rounded-xl text-sm font-medium ${tab === t ? 'bg-primary-600 text-white' : isDark ? 'bg-dark-800 text-dark-400' : 'bg-dark-100 text-dark-600'}`}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          {tab === 'monthly' && (
            <select value={month} onChange={e => setMonth(parseInt(e.target.value))} className="input-field w-auto">
              {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m, i) => <option key={i} value={i+1}>{m}</option>)}
            </select>
          )}
          <input type="number" value={year} onChange={e => setYear(parseInt(e.target.value))} className="input-field w-24" min="2020" max="2030" />
          <button onClick={fetchReport} disabled={loading} className="btn-primary">{loading ? 'Loading...' : 'Generate'}</button>
        </div>
      </div>

      {report && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[{ label: 'Transactions', value: report.total_transactions, prefix: '' }, { label: 'Income', value: report.total_income }, { label: 'Expenses', value: report.total_expense }, { label: 'Savings Rate', value: report.savings_rate, prefix: '', suffix: '%' }].map((s, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="glass-card p-5">
                <p className={`text-sm ${isDark ? 'text-dark-400' : 'text-dark-500'}`}>{s.label}</p>
                <p className={`text-2xl font-bold mt-1 ${isDark ? 'text-white' : 'text-dark-900'}`}>{s.prefix !== '' ? '₹' : ''}{typeof s.value === 'number' ? s.value.toLocaleString('en-IN') : s.value}{s.suffix || ''}</p>
              </motion.div>
            ))}
          </div>

          {categoryData.length > 0 && (
            <ChartCard title="Spending by Category" className="mb-8">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={categoryData} layout="vertical"><CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#e2e8f0'} />
                  <XAxis type="number" stroke={isDark ? '#64748b' : '#94a3b8'} /><YAxis type="category" dataKey="name" width={100} stroke={isDark ? '#64748b' : '#94a3b8'} />
                  <Tooltip formatter={v => `₹${v.toLocaleString('en-IN')}`} {...ts} /><Bar dataKey="total" fill="#6366f1" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          )}

          {monthlyBreakdown.length > 0 && (
            <ChartCard title="Monthly Breakdown">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyBreakdown}><CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#e2e8f0'} />
                  <XAxis dataKey="month" stroke={isDark ? '#64748b' : '#94a3b8'} /><YAxis stroke={isDark ? '#64748b' : '#94a3b8'} />
                  <Tooltip formatter={v => `₹${v.toLocaleString('en-IN')}`} {...ts} />
                  <Bar dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} /><Bar dataKey="expense" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          )}
        </motion.div>
      )}
    </div>
  );
}
