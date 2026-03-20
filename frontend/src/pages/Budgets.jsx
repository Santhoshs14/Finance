import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../context/ThemeContext';
import { useData } from '../context/DataContext';
import { budgetsAPI, transactionsAPI } from '../services/api';
import { getCurrentFinancialMonth } from '../utils/financialMonth';
import {
  PencilSquareIcon, CheckIcon, XMarkIcon,
  BanknotesIcon, ArrowTrendingDownIcon, SparklesIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

/* ─── Config ─── */
const SALARY_KEY = 'vault_monthly_salary';

const CATEGORIES = [
  { name: 'Investment',    color: '#6366f1' },
  { name: 'Rent',          color: '#f59e0b' },
  { name: 'Home',          color: '#8b5cf6' },
  { name: 'Food',          color: '#ef4444' },
  { name: 'Travel',        color: '#3b82f6' },
  { name: 'Petrol',        color: '#f97316' },
  { name: 'Entertainment', color: '#ec4899' },
  { name: 'Shopping',      color: '#14b8a6' },
  { name: 'Bills',         color: '#64748b' },
  { name: 'Utilities',     color: '#eab308' },
  { name: 'Subscription',  color: '#06b6d4' },
  { name: 'Lending',       color: '#84cc16' },
  { name: 'Gifts',         color: '#f43f5e' },
];

const fmt = (n) => '₹' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n || 0);

/* ─── Salary Banner ─── */
function SalaryBanner({ salary, onEdit, isDark }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(salary);
  const textMain = isDark ? '#f3f4f6' : '#111827';
  const textSub = isDark ? '#9ca3af' : '#6b7280';
  const borderC = isDark ? '#1a2235' : '#e5e7eb';

  const save = () => {
    const v = parseFloat(val);
    if (!isNaN(v) && v > 0) { onEdit(v); setEditing(false); toast.success('Salary updated!'); }
  };

  return (
    <div style={{
      background: isDark ? 'linear-gradient(135deg, #0d1117 0%, #111827 100%)' : 'linear-gradient(135deg, #f0fdf9 0%, #ecfdf5 100%)',
      border: `1px solid ${isDark ? '#1a2235' : '#6ee7b7'}`,
      borderRadius: 16, padding: '18px 22px', marginBottom: 20,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: 'linear-gradient(135deg, #1abf94, #107f61)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <BanknotesIcon style={{ width: 22, height: 22, color: 'white' }} />
        </div>
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: textSub, textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>Monthly Salary</p>
          {editing ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#1abf94' }}>₹</span>
              <input type="number" value={val} onChange={e => setVal(e.target.value)} autoFocus
                onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
                style={{ width: 110, fontSize: 18, fontWeight: 700, background: 'transparent', border: 'none', borderBottom: `2px solid #1abf94`, color: textMain, outline: 'none', fontFamily: 'inherit', paddingBottom: 2 }} />
              <button onClick={save} style={{ border: 'none', background: '#1abf94', borderRadius: 6, width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckIcon style={{ width: 14, height: 14, color: '#fff' }} />
              </button>
              <button onClick={() => setEditing(false)} style={{ border: 'none', background: isDark ? '#374151' : '#e5e7eb', borderRadius: 6, width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <XMarkIcon style={{ width: 14, height: 14, color: textSub }} />
              </button>
            </div>
          ) : (
            <p style={{ fontSize: 24, fontWeight: 800, color: '#1abf94', margin: '2px 0 0', letterSpacing: '-0.5px' }}>{fmt(salary)}</p>
          )}
        </div>
      </div>
      {!editing && (
        <button onClick={() => { setVal(salary); setEditing(true); }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, background: isDark ? '#1a2235' : '#d1fae5', border: `1px solid ${isDark ? '#252f3e' : '#6ee7b7'}`, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: isDark ? '#d1d5db' : '#065f46', fontFamily: 'inherit' }}>
          <PencilSquareIcon style={{ width: 14, height: 14 }} /> Edit Salary
        </button>
      )}
    </div>
  );
}

/* ─── Budget Card ─── */
function BudgetCard({ cat, limit, spent = 0, salary, isDark, onSave }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(limit));

  useEffect(() => { setValue(String(limit)); }, [limit]);

  const pct = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;
  const salaryPct = salary > 0 ? Math.min((limit / salary) * 100, 100) : 0;
  const status = pct >= 100 ? 'over' : pct >= 80 ? 'warn' : pct >= 50 ? 'mid' : 'ok';
  const barColor = { over: '#ef4444', warn: '#f59e0b', mid: '#3b82f6', ok: '#1abf94' }[status];
  const bgStatus = {
    over: isDark ? 'rgba(239,68,68,0.06)' : 'rgba(254,242,242,0.9)',
    warn: isDark ? 'rgba(245,158,11,0.05)' : 'rgba(255,251,235,0.9)',
    mid: isDark ? 'rgba(59,130,246,0.04)' : 'rgba(239,246,255,0.9)',
    ok: isDark ? 'rgba(26,191,148,0.04)' : 'rgba(240,253,249,0.9)',
  }[status];
  const textMain = isDark ? '#f3f4f6' : '#111827';
  const textSub = isDark ? '#9ca3af' : '#6b7280';

  const handleSave = () => {
    const v = parseFloat(value);
    if (!isNaN(v) && v >= 0) { onSave(cat.name, v); setEditing(false); }
  };

  return (
    <motion.div layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
      style={{
        background: isDark ? '#161b22' : '#ffffff',
        border: `1px solid ${isDark ? '#30363d' : '#e5e7eb'}`,
        borderRadius: 14, padding: '16px', position: 'relative', overflow: 'hidden',
        transition: 'box-shadow 0.2s',
      }}
      whileHover={{ boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.6)' : '0 4px 20px rgba(0,0,0,0.08)' }}
    >
      {/* Category color accent */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: 3, height: '100%', background: cat.color, borderRadius: '14px 0 0 14px' }} />

      <div style={{ paddingLeft: 8 }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: textMain }}>{cat.name}</p>
            {salary > 0 && <p style={{ margin: 0, fontSize: 11, color: textSub }}>{salaryPct.toFixed(0)}% of salary</p>}
          </div>

          {/* Edit / Amount display */}
          {editing ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input type="number" value={value} onChange={e => setValue(e.target.value)} autoFocus
                onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false); }}
                style={{ width: 88, padding: '4px 8px', borderRadius: 8, border: `1px solid ${cat.color}`, background: isDark ? '#0a0e14' : '#f9fafb', color: textMain, fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
              <button onClick={handleSave} style={{ border: 'none', background: '#1abf94', borderRadius: 6, width: 26, height: 26, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckIcon style={{ width: 12, height: 12, color: '#fff' }} />
              </button>
              <button onClick={() => setEditing(false)} style={{ border: 'none', background: isDark ? '#374151' : '#e5e7eb', borderRadius: 6, width: 26, height: 26, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <XMarkIcon style={{ width: 12, height: 12, color: textSub }} />
              </button>
            </div>
          ) : (
            <button onClick={() => { setValue(String(limit)); setEditing(true); }}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 8, border: `1px solid ${isDark ? '#252f3e' : '#e5e7eb'}`, background: 'transparent', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: textSub, fontFamily: 'inherit' }}>
              <PencilSquareIcon style={{ width: 12, height: 12 }} />
              {limit > 0 ? fmt(limit) : 'Set limit'}
            </button>
          )}
        </div>

        {limit > 0 ? (
          <>
            {/* Progress bar */}
            <div style={{ height: 6, borderRadius: 99, background: isDark ? '#1a2235' : '#f3f4f6', overflow: 'hidden', marginBottom: 10 }}>
              <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.7, ease: 'easeOut' }}
                style={{ height: '100%', borderRadius: 99, background: barColor }} />
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {[
                { label: 'Spent', val: fmt(spent), color: '#ef4444' },
                { label: 'Left', val: fmt(Math.max(0, limit - spent)), color: '#1abf94' },
                { label: 'Used', val: `${pct.toFixed(0)}%`, color: barColor },
              ].map(s => (
                <div key={s.label} style={{ textAlign: 'center', padding: '8px 4px', background: isDark ? '#0a0e14' : '#f9fafb', borderRadius: 8 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: s.color }}>{s.val}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 10, color: textSub, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p style={{ fontSize: 12, color: textSub, margin: '4px 0 0' }}>Click "Set limit" to track this category</p>
        )}
      </div>
    </motion.div>
  );
}

/* ─── Main Page ─── */
export default function Budgets() {
  const { isDark } = useTheme();
  const queryClient = useQueryClient();
  const { budgets, transactions: allTransactions, cycleStartDay } = useData();
  const cycle = getCurrentFinancialMonth(new Date(), cycleStartDay);

  // Salary — stored in localStorage, defaulting to 98,000
  const [salary, setSalary] = useState(() => {
    const saved = localStorage.getItem(SALARY_KEY);
    return saved ? parseFloat(saved) : 98000;
  });

  const handleSalaryEdit = (val) => {
    setSalary(val);
    localStorage.setItem(SALARY_KEY, String(val));
  };

  const budgetsLoading = false;

  // Fetch cycle transactions directly (not from heavy calculations endpoint)
  const cycleTransactions = useMemo(() => {
    return allTransactions.filter(t => t.date >= cycle.startDate && t.date <= cycle.endDate);
  }, [allTransactions, cycle]);
  const txnLoading = false;

  const saveMutation = useMutation({
    mutationFn: ({ category, limit }) => budgetsAPI.create({ category, monthly_limit: limit }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      toast.success('Budget updated!');
    },
    onError: () => toast.error('Failed to update budget'),
  });

  /* ─── Merge budget limits with actual spending ─── */
  const enriched = useMemo(() => {
    const budgetMap = {};
    budgets.forEach(b => { budgetMap[b.category] = b.monthly_limit || 0; });

    const spendMap = {};
    cycleTransactions.forEach(t => {
      if (t.amount < 0 && t.category && t.category !== 'Income') {
        spendMap[t.category] = (spendMap[t.category] || 0) + Math.abs(t.amount);
      }
    });

    return CATEGORIES.map(cat => ({
      cat,
      limit: budgetMap[cat.name] || 0,
      spent: spendMap[cat.name] || 0,
    }));
  }, [budgets, cycleTransactions]);

  const totalBudgeted = enriched.reduce((s, b) => s + b.limit, 0);
  const totalSpent    = enriched.reduce((s, b) => s + b.spent, 0);
  const unbudgeted    = Math.max(0, salary - totalBudgeted);

  const textMain = isDark ? '#f3f4f6' : '#111827';
  const textSub  = isDark ? '#9ca3af' : '#6b7280';
  const isLoading = budgetsLoading || txnLoading;

  return (
    <div>
      {/* ─── Header ─── */}
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: textMain, margin: 0 }}>Budgets</h1>
        <p style={{ fontSize: 13, color: textSub, margin: '4px 0 0' }}>
          {cycle.label} · {cycle.startDate} → {cycle.endDate} · Resets on {cycleStartDay}th
        </p>
      </div>

      {/* ─── Salary Banner ─── */}
      <SalaryBanner salary={salary} onEdit={handleSalaryEdit} isDark={isDark} />

      {/* ─── Summary Cards ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 22 }}>
        {[
          { label: 'Salary', val: fmt(salary), color: '#1abf94', icon: '💰' },
          { label: 'Budgeted', val: fmt(totalBudgeted), color: '#3b82f6', icon: '📊' },
          { label: 'Spent', val: fmt(totalSpent), color: '#ef4444', icon: '💸' },
          { label: 'Unbudgeted', val: fmt(unbudgeted), color: '#f59e0b', icon: '🎯' },
        ].map(c => (
          <div key={c.label} className="glass-card" style={{ padding: '14px 16px' }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: textSub, textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>{c.icon} {c.label}</p>
            <p style={{ fontSize: 20, fontWeight: 800, color: c.color, margin: '6px 0 0', letterSpacing: '-0.5px' }}>{c.val}</p>
          </div>
        ))}
      </div>

      {/* ─── Loading ─── */}
      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0', gap: 12, flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid rgba(26,191,148,0.2)', borderTopColor: '#1abf94', animation: 'spin 0.9s linear infinite' }} />
          <p style={{ color: textSub, fontSize: 13 }}>Loading budgets...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : (
        /* ─── Budget Grid ─── */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
          {enriched.map(({ cat, limit, spent }) => (
            <BudgetCard
              key={cat.name}
              cat={cat}
              limit={limit}
              spent={spent}
              salary={salary}
              isDark={isDark}
              onSave={(category, lim) => saveMutation.mutate({ category, limit: lim })}
            />
          ))}
        </div>
      )}

      {/* ─── Helpful tip ─── */}
      <div style={{ marginTop: 20, padding: '12px 16px', borderRadius: 12, background: isDark ? '#0a0e14' : '#f0fdf9', border: `1px solid ${isDark ? '#1a2235' : '#a7f3d0'}`, display: 'flex', alignItems: 'center', gap: 10 }}>
        <SparklesIcon style={{ width: 16, height: 16, color: '#1abf94', flexShrink: 0 }} />
        <p style={{ margin: 0, fontSize: 12, color: textSub }}>
          <strong style={{ color: '#1abf94' }}>Tip:</strong> Click "Set limit" on any category to start tracking. Budgets auto-reset on the {cycleStartDay}th each month.
        </p>
      </div>
    </div>
  );
}
