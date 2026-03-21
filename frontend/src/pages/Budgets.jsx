import { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../context/ThemeContext';
import { useData } from '../context/DataContext';
import { budgetSnapshotsAPI, categoriesAPI } from '../services/api';
import { getCurrentFinancialMonth } from '../utils/financialMonth';
import {
  PencilSquareIcon, CheckIcon, XMarkIcon,
  BanknotesIcon, ArrowTrendingDownIcon, SparklesIcon,
  PlusIcon, TrashIcon, InformationCircleIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const SALARY_KEY = 'vault_monthly_salary';
const fmt = (n) => '₹' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n || 0);

/* ─── Salary Banner ─── */
function SalaryBanner({ salary, onEdit, isDark }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(salary);
  const textMain = isDark ? '#f3f4f6' : '#111827';
  const textSub = isDark ? '#9ca3af' : '#6b7280';

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
      <div style={{ position: 'absolute', top: 0, left: 0, width: 3, height: '100%', background: cat.color, borderRadius: '14px 0 0 14px' }} />

      <div style={{ paddingLeft: 8 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: textMain }}>{cat.name}</p>
            {salary > 0 && <p style={{ margin: 0, fontSize: 11, color: textSub }}>{salaryPct.toFixed(0)}% of salary</p>}
          </div>

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
            <div style={{ height: 6, borderRadius: 99, background: isDark ? '#1a2235' : '#f3f4f6', overflow: 'hidden', marginBottom: 10 }}>
              <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.7, ease: 'easeOut' }}
                style={{ height: '100%', borderRadius: 99, background: barColor }} />
            </div>
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

/* ─── Main Budgets Page ─── */
export default function Budgets() {
  const { isDark } = useTheme();
  const { categories, transactions: allTransactions, cycleStartDay } = useData();
  const cycle = getCurrentFinancialMonth(new Date(), cycleStartDay);

  // Cycle key for snapshot: "YYYY-MM" based on cycle's start date
  const cycleKey = cycle.startDate.slice(0, 7);

  // Budget limits per category — loaded from snapshot
  const [limits, setLimits] = useState({});
  const [snapshotLoading, setSnapshotLoading] = useState(true);

  // Salary — stored in localStorage
  const [salary, setSalary] = useState(() => {
    const saved = localStorage.getItem(SALARY_KEY);
    return saved ? parseFloat(saved) : 98000;
  });
  const handleSalaryEdit = (val) => {
    setSalary(val);
    localStorage.setItem(SALARY_KEY, String(val));
  };

  // Add Category UI
  const [showAddCat, setShowAddCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#6366f1');

  // Load snapshot for current cycle, falling back to previous cycle
  useEffect(() => {
    let cancelled = false;
    const loadSnapshot = async () => {
      setSnapshotLoading(true);
      try {
        let data = await budgetSnapshotsAPI.get(cycleKey);
        if (!data) {
          // Try previous month as carry-forward
          const prevDate = new Date(cycle.startDate);
          prevDate.setMonth(prevDate.getMonth() - 1);
          const prevKey = prevDate.toISOString().slice(0, 7);
          data = await budgetSnapshotsAPI.get(prevKey);
        }
        if (!cancelled) setLimits(data?.limits || {});
      } catch (e) {
        console.error('Failed to load budget snapshot:', e);
      } finally {
        if (!cancelled) setSnapshotLoading(false);
      }
    };
    loadSnapshot();
    return () => { cancelled = true; };
  }, [cycleKey]);

  // Save a limit for a category to the current cycle snapshot
  const handleSaveLimit = useCallback(async (category, limit) => {
    const updated = { ...limits, [category]: limit };
    setLimits(updated);
    try {
      await budgetSnapshotsAPI.save(cycleKey, updated);
      toast.success('Budget limit saved for this cycle!');
    } catch {
      toast.error('Failed to save budget limit');
    }
  }, [cycleKey, limits]);

  // Add a new custom category
  const handleAddCategory = async () => {
    const name = newCatName.trim();
    if (!name) { toast.error('Category name is required'); return; }
    if (categories.some(c => c.name.toLowerCase() === name.toLowerCase())) {
      toast.error('Category already exists'); return;
    }
    try {
      await categoriesAPI.create({ name, color: newCatColor });
      toast.success(`Category "${name}" added!`);
      setNewCatName('');
      setNewCatColor('#6366f1');
      setShowAddCat(false);
    } catch {
      toast.error('Failed to add category');
    }
  };

  const handleDeleteCategory = async (id, name) => {
    if (!confirm(`Delete category "${name}"? This won't affect existing transactions.`)) return;
    try {
      await categoriesAPI.delete(id);
      toast.success(`Category "${name}" deleted`);
    } catch {
      toast.error('Failed to delete category');
    }
  };

  // Filter out Income from spending categories
  const spendingCategories = useMemo(() =>
    categories.filter(c => c.name !== 'Income'),
    [categories]
  );

  // Spending per category in current cycle
  const cycleTransactions = useMemo(() =>
    allTransactions.filter(t => t.date >= cycle.startDate && t.date <= cycle.endDate),
    [allTransactions, cycle]
  );

  const spendMap = useMemo(() => {
    const map = {};
    cycleTransactions.forEach(t => {
      if (t.amount < 0 && t.category && t.category !== 'Income') {
        map[t.category] = (map[t.category] || 0) + Math.abs(t.amount);
      }
    });
    return map;
  }, [cycleTransactions]);

  const enriched = useMemo(() =>
    spendingCategories.map(cat => ({
      cat,
      limit: limits[cat.name] || 0,
      spent: spendMap[cat.name] || 0,
    })),
    [spendingCategories, limits, spendMap]
  );

  const totalBudgeted = enriched.reduce((s, b) => s + b.limit, 0);
  const totalSpent    = enriched.reduce((s, b) => s + b.spent, 0);
  const unbudgeted    = Math.max(0, salary - totalBudgeted);

  const textMain = isDark ? '#f3f4f6' : '#111827';
  const textSub  = isDark ? '#9ca3af' : '#6b7280';

  const PRESET_COLORS = ['#6366f1','#ef4444','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ec4899','#14b8a6','#f97316','#84cc16','#06b6d4','#f43f5e','#eab308','#64748b'];

  return (
    <div>
      {/* ─── Header ─── */}
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: textMain, margin: 0 }}>Budgets</h1>
        <p style={{ fontSize: 13, color: textSub, margin: '4px 0 0' }}>
          {cycle.label} · {cycle.startDate} → {cycle.endDate} · Resets on {cycleStartDay}th
        </p>
      </div>

      {/* ─── Cycle info banner ─── */}
      <div style={{ padding: '10px 14px', borderRadius: 12, background: isDark ? '#0c1824' : '#eff6ff', border: `1px solid ${isDark ? '#1e3a5f' : '#bfdbfe'}`, display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <InformationCircleIcon style={{ width: 16, height: 16, color: '#3b82f6', flexShrink: 0 }} />
        <p style={{ margin: 0, fontSize: 12, color: isDark ? '#93c5fd' : '#1e40af' }}>
          <strong>Budget limits are saved per cycle.</strong> When a new cycle starts, your previous limits carry forward automatically. Change any limit and it will apply only to this cycle.
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

      {/* ─── Add Category ─── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: textMain }}>
          {spendingCategories.length} Categories
        </p>
        <button
          onClick={() => setShowAddCat(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 10, background: isDark ? '#1a2235' : '#ecfdf5', border: `1px solid ${isDark ? '#1e3a5f' : '#6ee7b7'}`, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: isDark ? '#1abf94' : '#065f46', fontFamily: 'inherit' }}
        >
          <PlusIcon style={{ width: 14, height: 14 }} /> Add Category
        </button>
      </div>

      <AnimatePresence>
        {showAddCat && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            style={{ overflow: 'hidden', marginBottom: 16 }}>
            <div className="glass-card" style={{ padding: 16 }}>
              <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: textMain }}>New Category</p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  type="text"
                  value={newCatName}
                  onChange={e => setNewCatName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddCategory(); if (e.key === 'Escape') setShowAddCat(false); }}
                  placeholder="Category name..."
                  className="input-field"
                  style={{ flex: 1, minWidth: 140 }}
                  autoFocus
                />
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {PRESET_COLORS.map(c => (
                    <button key={c} onClick={() => setNewCatColor(c)}
                      style={{ width: 24, height: 24, borderRadius: '50%', background: c, border: newCatColor === c ? '3px solid white' : '2px solid transparent', cursor: 'pointer', boxShadow: newCatColor === c ? `0 0 0 2px ${c}` : 'none', outline: 'none' }} />
                  ))}
                </div>
                <button onClick={handleAddCategory} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px' }}>
                  <PlusIcon style={{ width: 14, height: 14 }} /> Add
                </button>
                <button onClick={() => setShowAddCat(false)} className="btn-secondary" style={{ padding: '8px 14px' }}>Cancel</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Budget Grid ─── */}
      {snapshotLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0', gap: 12, flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid rgba(26,191,148,0.2)', borderTopColor: '#1abf94', animation: 'spin 0.9s linear infinite' }} />
          <p style={{ color: textSub, fontSize: 13 }}>Loading budgets...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
          {enriched.map(({ cat, limit, spent }) => (
            <div key={cat.id || cat.name} style={{ position: 'relative' }}>
              <BudgetCard
                cat={cat}
                limit={limit}
                spent={spent}
                salary={salary}
                isDark={isDark}
                onSave={handleSaveLimit}
              />
              {/* Delete custom category button  */}
              <button
                onClick={() => handleDeleteCategory(cat.id, cat.name)}
                title="Remove category"
                style={{
                  position: 'absolute', top: 8, right: 8, width: 22, height: 22,
                  border: 'none', borderRadius: 6, background: isDark ? '#1e2732' : '#fee2e2',
                  color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  opacity: 0.6,
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}
              >
                <TrashIcon style={{ width: 11, height: 11 }} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ─── Tip ─── */}
      <div style={{ marginTop: 20, padding: '12px 16px', borderRadius: 12, background: isDark ? '#0a0e14' : '#f0fdf9', border: `1px solid ${isDark ? '#1a2235' : '#a7f3d0'}`, display: 'flex', alignItems: 'center', gap: 10 }}>
        <SparklesIcon style={{ width: 16, height: 16, color: '#1abf94', flexShrink: 0 }} />
        <p style={{ margin: 0, fontSize: 12, color: textSub }}>
          <strong style={{ color: '#1abf94' }}>Tip:</strong> Click "Set limit" on any category to track spending. Limits are saved per cycle and carry forward automatically each month.
        </p>
      </div>
    </div>
  );
}
