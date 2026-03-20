import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts';
import CountUp from 'react-countup';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../context/ThemeContext';
import { getShortFinancialMonthLabelForDate } from '../utils/financialMonth';
import TransactionTable from '../components/TransactionTable';
import QuickAddTransaction from '../components/QuickAddTransaction';
import { useData } from '../context/DataContext';
import { transactionsAPI, accountsAPI, calculationsAPI, insightsAPI, goalsAPI } from '../services/api';
import {
  ArrowUpIcon, ArrowDownIcon, PlusIcon,
  ScaleIcon, BanknotesIcon, ChartBarIcon,
  ShieldCheckIcon, ArrowTrendingUpIcon,
} from '@heroicons/react/24/outline';

/* ─── Formatting ─── */
const fmt = (n) => '₹' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n || 0);

/* ─── Tooltip ─── */
const CustomTooltip = ({ active, payload, label, isDark }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: isDark ? '#1f2937' : '#fff', border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`, borderRadius: 10, padding: '10px 14px', fontSize: 13 }}>
      <p style={{ color: isDark ? '#9ca3af' : '#6b7280', marginBottom: 4, fontWeight: 600 }}>{label}</p>
      {payload.map((p, i) => <p key={i} style={{ color: p.color, margin: '2px 0' }}>{p.name}: {fmt(p.value)}</p>)}
    </div>
  );
};

/* ─── KPI Card ─── */
const KpiCard = ({ label, value, icon: Icon, color, isDark, isPercent }) => (
  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card"
    style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
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
  const spendByDay = {};
  transactions.forEach(t => {
    if (t.amount < 0 && days.includes(t.date)) {
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
          const bg = amt === 0
            ? (isDark ? '#1f2937' : '#f3f4f6')
            : intensity > 0.7 ? '#ef4444'
            : intensity > 0.4 ? '#f59e0b'
            : '#1abf94';
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

/* ─── Status badge ─── */
const StatusBadge = ({ status }) => {
  const map = { success: 'status-success', completed: 'status-success', fail: 'status-fail', cancel: 'status-cancel' };
  return <span className={map[(status || '').toLowerCase()] || 'status-cancel'} style={{ textTransform: 'capitalize' }}>{status || 'N/A'}</span>;
};

const CHART_COLORS = ['#1abf94', '#34d399', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

/* ─── Dashboard ─── */
export default function Dashboard() {
  const { isDark } = useTheme();
  const queryClient = useQueryClient();
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'n' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); setShowQuickAdd(true); } };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const { data: calculations = null } = useQuery({
    queryKey: ['calculations'],
    queryFn: async () => { try { const r = await calculationsAPI.get(); return r.data.data || {}; } catch { return null; } },
  });
  
  const { transactions, accounts, goals, creditCards, cycleStartDay } = useData();
  const txnLoading = false;
  const { data: snapshots = [] } = useQuery({
    queryKey: ['snapshots'],
    queryFn: async () => { try { const r = await calculationsAPI.getSnapshots(); return r.data.data || []; } catch { return []; } },
  });
  const { data: insights = [] } = useQuery({
    queryKey: ['insights'],
    queryFn: async () => { try { const r = await insightsAPI.get(); return r.data.data?.insights || []; } catch { return []; } },
  });

  const addTxnMutation = useMutation({
    mutationFn: (data) => transactionsAPI.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['transactions'] }); queryClient.invalidateQueries({ queryKey: ['calculations'] }); },
  });

  /* ─── Computed ─── */
  const netWorth    = calculations?.net_worth?.net_worth || 0;
  const totalSavings = calculations?.total_savings || 0;          // Investment portfolio only
  const totalLiabilities = calculations?.total_liabilities?.total || 0;
  const income      = calculations?.savings_rate?.income || 0;
  const expenses    = calculations?.savings_rate?.expenses || 0;
  const savingsRate = calculations?.savings_rate?.savings_rate || 0;
  const accountsBalance = accounts.reduce((s, a) => s + (a.balance || 0), 0);

  const categoryData = transactions.reduce((acc, txn) => {
    if (txn.category !== 'Income' && txn.amount < 0) {
      const ex = acc.find(i => i.name === txn.category);
      if (ex) ex.value += Math.abs(txn.amount);
      else acc.push({ name: txn.category, value: Math.abs(txn.amount) });
    }
    return acc;
  }, []).sort((a, b) => b.value - a.value);

  const monthlyData = transactions.reduce((acc, txn) => {
    const key = getShortFinancialMonthLabelForDate(txn.date, cycleStartDay);
    const ex = acc.find(i => i.month === key);
    const amt = Math.abs(txn.amount);
    if (ex) { if (txn.amount > 0) ex.income += amt; else ex.expense += amt; }
    else acc.push({ month: key, income: txn.amount > 0 ? amt : 0, expense: txn.amount < 0 ? amt : 0 });
    return acc;
  }, []);

  const textMain = isDark ? '#f3f4f6' : '#111827';
  const textSub  = isDark ? '#9ca3af' : '#6b7280';
  const cardBorder = isDark ? '#252f3e' : '#e5e7eb';

  if (txnLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ width: 44, height: 44, borderRadius: '50%', border: '4px solid rgba(26,191,148,0.2)', borderTopColor: '#1abf94', animation: 'spin 0.9s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div>
      {/* ─── Row 1: 5 KPI Cards ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 20 }}>
        <KpiCard label="Net Worth" value={netWorth} icon={ScaleIcon} color="#1abf94" isDark={isDark} />
        <KpiCard label="Account Balance" value={accountsBalance} icon={BanknotesIcon} color="#34d399" isDark={isDark} />
        <KpiCard label="Total Savings" value={totalSavings} icon={ArrowTrendingUpIcon} color="#8b5cf6" isDark={isDark} />
        <KpiCard label="Total Liabilities" value={totalLiabilities} icon={ArrowDownIcon} color="#ef4444" isDark={isDark} />
        <KpiCard label="Savings Rate" value={savingsRate} icon={ChartBarIcon} color="#f59e0b" isDark={isDark} isPercent />
      </div>

      {/* ─── Row 2: Spending Heatmap (full width) ─── */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card" style={{ padding: 24, marginBottom: 20 }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: textMain, display: 'block', marginBottom: 6 }}>Spending Heatmap</span>
        <p style={{ fontSize: 11, color: textSub, marginBottom: 16 }}>Last 35 days — daily spend intensity</p>
        <SpendingHeatmap transactions={transactions} isDark={isDark} />
      </motion.div>

      {/* ─── Row 3: Spending by Category + Budget Progress ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* Category pie */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card" style={{ padding: 24 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: textMain, display: 'block', marginBottom: 4 }}>Spending by Category</span>
          <p style={{ fontSize: 11, color: textSub, marginBottom: 12 }}>Current cycle breakdown</p>
          {categoryData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={categoryData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value" stroke="none">
                    {categoryData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip content={<CustomTooltip isDark={isDark} />} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {categoryData.slice(0, 5).map((item, i) => (
                  <span key={i} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: isDark ? '#252f3e' : '#f3f4f6', color: textMain, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: CHART_COLORS[i % CHART_COLORS.length] }} />{item.name}
                  </span>
                ))}
              </div>
            </>
          ) : <div style={{ textAlign: 'center', padding: '48px 0', color: textSub }}>No spending data yet</div>}
        </motion.div>

        {/* Budget Progress */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="glass-card" style={{ padding: 24 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: textMain, display: 'block', marginBottom: 16 }}>Budget Progress</span>
          {calculations?.budget_usage?.filter(b => b.monthly_limit > 0).length > 0 ? (
            calculations.budget_usage.filter(b => b.monthly_limit > 0).slice(0, 5).map((b, i) => (
              <SavingsBar key={i} label={b.category} current={b.spent} total={b.monthly_limit} isDark={isDark} />
            ))
          ) : <div style={{ textAlign: 'center', padding: '40px 0', color: textSub }}>Set budgets to track spending</div>}
        </motion.div>
      </div>

      {/* ─── Row 4: Goals + Net Worth Timeline ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 20, marginBottom: 20 }}>
        {/* Goals */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <ShieldCheckIcon style={{ width: 18, height: 18, color: '#f59e0b' }} />
            <span style={{ fontSize: 15, fontWeight: 600, color: textMain }}>Financial Goals</span>
          </div>
          {goals.length > 0 ? goals.slice(0, 3).map((g, i) => (
            <SavingsBar key={g.id || i} label={g.name || g.goal_name || 'Goal'} current={g.current_amount || g.saved_amount || 0} total={g.target_amount || 0} isDark={isDark} />
          )) : <div style={{ textAlign: 'center', padding: '20px 0', color: textSub, fontSize: 13 }}>No goals yet</div>}
        </motion.div>

        {/* Net Worth Timeline */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="glass-card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: textMain }}>Net Worth Timeline</span>
            <span style={{ fontSize: 12, color: textSub }}>Historical snapshots</span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
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
        </motion.div>
      </div>

      {/* ─── Row 5: Insights + Recent Transactions ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.8fr', gap: 20, marginBottom: 20 }}>
        {/* Insights */}
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

        {/* Recent Transactions */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="glass-card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: textMain }}>🔄 Recent Transactions</span>
            <button onClick={() => setShowQuickAdd(true)} className="btn-primary" style={{ padding: '6px 14px', fontSize: 12 }}>
              <PlusIcon style={{ width: 14, height: 14 }} /> Add
            </button>
          </div>
          <TransactionTable transactions={transactions.slice(0, 6)} />
        </motion.div>
      </div>

      {/* Quick Add */}
      <AnimatePresence>
        {showQuickAdd && (
          <QuickAddTransaction isOpen={showQuickAdd} onClose={() => setShowQuickAdd(false)}
            onSubmit={(data) => addTxnMutation.mutate(data)} accounts={accounts} creditCards={creditCards} />
        )}
      </AnimatePresence>
    </div>
  );
}
