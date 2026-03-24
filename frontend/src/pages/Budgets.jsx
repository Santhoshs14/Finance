import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';
import { useData } from '../context/DataContext';
import { budgetSnapshotsAPI, categoriesAPI, profileAPI } from '../services/api';
import { getFinancialCycle, getCycleDayInfo } from '../utils/financialMonth';
import {
  PencilSquareIcon, CheckIcon, XMarkIcon,
  BanknotesIcon, SparklesIcon,
  PlusIcon, TrashIcon, InformationCircleIcon,
  ArrowTrendingUpIcon, ExclamationTriangleIcon, ShieldCheckIcon,
  Bars3Icon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

import { fmt } from '../utils/format';

/* ─── Status helper ─── */
const getBudgetStatus = (pct) => {
  if (pct >= 100) return { label: 'Over Budget', color: '#ef4444', bg: 'rgba(239,68,68,0.12)', icon: ExclamationTriangleIcon };
  if (pct >= 80)  return { label: 'Warning',     color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', icon: ExclamationTriangleIcon };
  return              { label: 'Safe',           color: '#1abf94', bg: 'rgba(26,191,148,0.10)', icon: ShieldCheckIcon };
};

/* ─── Salary Banner ─── */
function SalaryBanner({ salary, onEdit, isDark }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(salary);
  const textMain = isDark ? '#f3f4f6' : '#111827';
  const textSub  = isDark ? '#9ca3af' : '#6b7280';

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
function BudgetCard({ cat, limit, spent = 0, salary, isDark, onSave, cycleInfo }) {
  const [editing, setEditing]   = useState(false);
  const [value, setValue]       = useState(String(limit));
  const [hovered, setHovered]   = useState(false);

  useEffect(() => { setValue(String(limit)); }, [limit]);

  const pct        = limit > 0 ? (spent / limit) * 100 : 0;
  const cappedPct  = Math.min(pct, 100);
  const salaryPct  = salary > 0 ? Math.min((limit / salary) * 100, 100) : 0;
  const status     = getBudgetStatus(pct);
  const textMain   = isDark ? '#f3f4f6' : '#111827';
  const textSub    = isDark ? '#9ca3af' : '#6b7280';

  // Predictive analytics
  const { daysElapsed, totalDays, daysLeft } = cycleInfo;
  const projectedSpend = limit > 0 && daysElapsed > 0
    ? (spent / daysElapsed) * totalDays
    : 0;
  const projectedPct = limit > 0 ? (projectedSpend / limit) * 100 : 0;
  const willExceed   = projectedSpend > limit && spent < limit;

  const handleSave = () => {
    const v = parseFloat(value);
    if (!isNaN(v) && v >= 0) { onSave(cat.id, v); setEditing(false); }
  };

  const StatusIcon = status.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      style={{
        background: isDark ? '#161b22' : '#ffffff',
        border: `1px solid ${pct >= 100 ? '#ef444444' : pct >= 80 ? '#f59e0b44' : isDark ? '#30363d' : '#e5e7eb'}`,
        borderRadius: 14, padding: '16px', position: 'relative', overflow: 'hidden',
        transition: 'box-shadow 0.2s, border-color 0.3s',
        boxShadow: hovered ? (isDark ? '0 4px 24px rgba(0,0,0,0.6)' : '0 4px 24px rgba(0,0,0,0.1)') : 'none',
      }}
    >
      {/* Left color stripe */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', background: cat.color, borderRadius: '14px 0 0 14px' }} />

      <div style={{ paddingLeft: 10 }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: cat.color, flexShrink: 0 }} />
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: textMain }}>{cat.name}</p>
            </div>
            {salary > 0 && <p style={{ margin: 0, fontSize: 11, color: textSub }}>{salaryPct.toFixed(0)}% of salary</p>}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Status badge */}
            {limit > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 99, background: status.bg, border: `1px solid ${status.color}44` }}>
                <StatusIcon style={{ width: 10, height: 10, color: status.color }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: status.color }}>{status.label}</span>
              </div>
            )}

            {/* Edit button */}
            {editing ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <input type="number" value={value} onChange={e => setValue(e.target.value)} autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false); }}
                  style={{ width: 80, padding: '4px 8px', borderRadius: 8, border: `1px solid ${cat.color}`, background: isDark ? '#0a0e14' : '#f9fafb', color: textMain, fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
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
        </div>

        {limit > 0 ? (
          <>
            {/* Progress bar */}
            <div style={{ height: 8, borderRadius: 99, background: isDark ? '#1a2235' : '#f3f4f6', overflow: 'hidden', marginBottom: 4, position: 'relative' }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${cappedPct}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                style={{ height: '100%', borderRadius: 99, background: pct >= 100 ? '#ef4444' : pct >= 80 ? '#f59e0b' : '#1abf94', position: 'relative' }}
              />
              {/* Projected overlay */}
              {willExceed && hovered && (
                <div style={{
                  position: 'absolute', top: 0, left: 0,
                  width: `${Math.min(projectedPct, 100)}%`,
                  height: '100%', borderRadius: 99,
                  background: 'rgba(239,68,68,0.25)',
                  border: '1px dashed #ef4444',
                }} />
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: textSub, marginBottom: 10 }}>
              <span>{cappedPct.toFixed(0)}% used</span>
              <span>{fmt(Math.max(0, limit - spent))} left</span>
            </div>

            {/* Stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
              {[
                { label: 'Spent',  val: fmt(spent),                  color: '#ef4444' },
                { label: 'Left',   val: fmt(Math.max(0, limit - spent)), color: '#1abf94' },
                { label: 'Used',   val: `${pct.toFixed(0)}%`,         color: status.color },
              ].map(s => (
                <div key={s.label} style={{ textAlign: 'center', padding: '7px 4px', background: isDark ? '#0a0e14' : '#f9fafb', borderRadius: 8 }}>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: s.color }}>{s.val}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 10, color: textSub, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</p>
                </div>
              ))}
            </div>

            {/* Predictive line */}
            <AnimatePresence>
              {hovered && projectedSpend > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{ overflow: 'hidden' }}
                >
                  <div style={{
                    marginTop: 10, padding: '8px 10px', borderRadius: 8,
                    background: willExceed ? 'rgba(239,68,68,0.08)' : 'rgba(26,191,148,0.08)',
                    border: `1px solid ${willExceed ? '#ef444433' : '#1abf9433'}`,
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    <ArrowTrendingUpIcon style={{ width: 13, height: 13, color: willExceed ? '#ef4444' : '#1abf94', flexShrink: 0 }} />
                    <p style={{ margin: 0, fontSize: 11, color: willExceed ? '#ef4444' : '#1abf94' }}>
                      {willExceed
                        ? `Projected to reach ${fmt(projectedSpend)} by end of cycle (${daysLeft}d left)`
                        : `On track · Est. ${fmt(projectedSpend)} by end of cycle`}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
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
  const { categories, currentAggregate, cycleStartDay, monthlySalary } = useData();
  const { currentUser } = useAuth();

  const cycle = useMemo(() => getFinancialCycle(new Date(), cycleStartDay), [cycleStartDay]);
  const cycleKey = cycle.cycleKey;
  const cycleInfo = useMemo(() => getCycleDayInfo(cycle), [cycle]);

  // Budget limits per categoryId
  const [limits, setLimits]               = useState({});   // { [categoryId]: number }
  const [snapshotLoading, setSnapshotLoading] = useState(true);

  // ── Drag-to-reorder ──
  const [reorderMode, setReorderMode] = useState(false);
  const [cardOrder, setCardOrder]     = useState([]);   // array of category ids
  const dragItem   = useRef(null);
  const dragOver   = useRef(null);

  const STORAGE_KEY = `wf_budget_order_${currentUser?.uid}`;

  // Load saved order from localStorage
  useEffect(() => {
    if (!currentUser) return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setCardOrder(JSON.parse(saved));
    } catch {}
  }, [currentUser, STORAGE_KEY]);

  // Persist order whenever it changes
  useEffect(() => {
    if (!currentUser || cardOrder.length === 0) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cardOrder));
  }, [cardOrder, currentUser, STORAGE_KEY]);

  const handleDragStart = (id) => { dragItem.current = id; };
  const handleDragEnter = (id) => { dragOver.current = id; };
  const handleDragEnd   = () => {
    if (!dragItem.current || !dragOver.current || dragItem.current === dragOver.current) return;
    setCardOrder(prev => {
      const arr = prev.length ? [...prev] : enriched.map(e => e.cat.id);
      const from = arr.indexOf(dragItem.current);
      const to   = arr.indexOf(dragOver.current);
      if (from === -1 || to === -1) return prev;
      arr.splice(to, 0, arr.splice(from, 1)[0]);
      return arr;
    });
    dragItem.current = null;
    dragOver.current = null;
  };

  // Salary
  const handleSalaryEdit = async (val) => {
    try {
      await profileAPI.update({ monthlySalary: val });
    } catch (e) {
      toast.error('Failed to update salary');
    }
  };

  // Add Category UI
  const [showAddCat, setShowAddCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#6366f1');

  // Load snapshot using subcollection structure, carry-forward from previous cycle
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setSnapshotLoading(true);
      try {
        let data = await budgetSnapshotsAPI.get(cycleKey);
        if (!data) {
          // Try carry-forward from previous cycle
          const prev = new Date(cycle.startDate);
          prev.setMonth(prev.getMonth() - 1);
          const prevKey = getFinancialCycle(prev, cycleStartDay).cycleKey;
          await budgetSnapshotsAPI.carryForward(prevKey, cycleKey);
          data = await budgetSnapshotsAPI.get(cycleKey);
        }
        if (!cancelled) {
          // Convert subcollection format { [catId]: { limit } } to { [catId]: number }
          const limitMap = {};
          if (data) {
            Object.entries(data).forEach(([catId, doc]) => {
              limitMap[catId] = typeof doc === 'object' ? (doc.limit ?? 0) : doc;
            });
          }
          setLimits(limitMap);
        }
      } catch (e) {
        console.error('Failed to load budget snapshot:', e);
      } finally {
        if (!cancelled) setSnapshotLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [cycleKey, cycleStartDay]);

  // Save a limit for a specific category
  const handleSaveLimit = useCallback(async (categoryId, limit) => {
    setLimits(prev => ({ ...prev, [categoryId]: limit }));
    try {
      await budgetSnapshotsAPI.setLimit(cycleKey, categoryId, limit);
      toast.success('Budget limit saved!');
    } catch {
      toast.error('Failed to save budget limit');
    }
  }, [cycleKey]);

  // Add Category
  const handleAddCategory = async () => {
    const name = newCatName.trim();
    if (!name) { toast.error('Category name is required'); return; }
    if (categories.some(c => c.name.toLowerCase() === name.toLowerCase())) {
      toast.error('Category already exists'); return;
    }
    try {
      await categoriesAPI.create({ name, color: newCatColor });
      toast.success(`Category "${name}" added!`);
      setNewCatName(''); setNewCatColor('#6366f1'); setShowAddCat(false);
    } catch { toast.error('Failed to add category'); }
  };

  const handleDeleteCategory = async (id, name) => {
    if (!confirm(`Delete category "${name}"? Existing transactions are unaffected.`)) return;
    try {
      await categoriesAPI.delete(id);
      toast.success(`Category "${name}" deleted`);
    } catch { toast.error('Failed to delete category'); }
  };

  const spendingCategories = useMemo(() =>
    categories.filter(c => c.name !== 'Income'), [categories]
  );

  // Spend map directly from real-time aggregates
  const spendMap = useMemo(() => {
    return currentAggregate?.categoryBreakdown || {};
  }, [currentAggregate]);

  const enriched = useMemo(() => {
    const base = spendingCategories.map(cat => ({
      cat,
      limit: limits[cat.id] || 0,
      spent: spendMap[cat.name] || 0,
    }));
    if (!cardOrder.length) return base;
    // Sort by saved order; new categories not yet in order go to end
    const indexMap = {};
    cardOrder.forEach((id, i) => { indexMap[id] = i; });
    return [...base].sort((a, b) => {
      const ia = indexMap[a.cat.id] ?? 9999;
      const ib = indexMap[b.cat.id] ?? 9999;
      return ia - ib;
    });
  }, [spendingCategories, limits, spendMap, cardOrder]);

  const totalBudgeted = enriched.reduce((s, b) => s + b.limit, 0);
  const totalSpent    = enriched.reduce((s, b) => s + b.spent, 0);
  const unbudgeted    = Math.max(0, monthlySalary - totalBudgeted);
  const overBudgetCount = enriched.filter(b => b.limit > 0 && b.spent > b.limit).length;
  const warnCount       = enriched.filter(b => b.limit > 0 && b.spent / b.limit >= 0.8 && b.spent <= b.limit).length;

  const textMain = isDark ? '#f3f4f6' : '#111827';
  const textSub  = isDark ? '#9ca3af' : '#6b7280';

  const PRESET_COLORS = ['#6366f1','#ef4444','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ec4899','#14b8a6','#f97316','#84cc16','#06b6d4','#f43f5e','#eab308','#64748b'];

  return (
    <div>
      {/* ─── Header ─── */}
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: textMain, margin: 0 }}>Budgets</h1>
        <p style={{ fontSize: 13, color: textSub, margin: '4px 0 0' }}>
          {cycle.label} · {cycle.startDate} → {cycle.endDate} · Day {cycleInfo.daysElapsed}/{cycleInfo.totalDays}
        </p>
      </div>

      {/* ─── Alerts ─── */}
      {overBudgetCount > 0 && (
        <div style={{ padding: '10px 14px', borderRadius: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <ExclamationTriangleIcon style={{ width: 16, height: 16, color: '#ef4444', flexShrink: 0 }} />
          <p style={{ margin: 0, fontSize: 12, color: '#ef4444' }}>
            <strong>{overBudgetCount} category{overBudgetCount > 1 ? 'ies are' : ' is'} over budget</strong> this cycle. Consider adjusting your spending.
          </p>
        </div>
      )}
      {warnCount > 0 && overBudgetCount === 0 && (
        <div style={{ padding: '10px 14px', borderRadius: 12, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <ExclamationTriangleIcon style={{ width: 16, height: 16, color: '#f59e0b', flexShrink: 0 }} />
          <p style={{ margin: 0, fontSize: 12, color: '#f59e0b' }}>
            <strong>{warnCount} category{warnCount > 1 ? 'ies are' : ' is'} approaching the budget limit.</strong> Hover over cards to see predictions.
          </p>
        </div>
      )}

      {/* ─── Cycle info banner ─── */}
      <div style={{ padding: '10px 14px', borderRadius: 12, background: isDark ? '#0c1824' : '#eff6ff', border: `1px solid ${isDark ? '#1e3a5f' : '#bfdbfe'}`, display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <InformationCircleIcon style={{ width: 16, height: 16, color: '#3b82f6', flexShrink: 0 }} />
        <p style={{ margin: 0, fontSize: 12, color: isDark ? '#93c5fd' : '#1e40af' }}>
          <strong>Budget limits are saved per cycle.</strong> Previous limits carry forward automatically. Hover over any card to see spend projections.
        </p>
      </div>

      {/* ─── Salary Banner ─── */}
      <SalaryBanner salary={monthlySalary} onEdit={handleSalaryEdit} isDark={isDark} />

      {/* ─── Summary Cards ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-5">
        {[
          { label: 'Salary',      val: fmt(monthlySalary),       color: '#1abf94', icon: '💰' },
          { label: 'Budgeted',    val: fmt(totalBudgeted), color: '#3b82f6', icon: '📊' },
          { label: 'Spent',       val: fmt(totalSpent),    color: '#ef4444', icon: '💸' },
          { label: 'Unbudgeted',  val: fmt(unbudgeted),    color: '#f59e0b', icon: '🎯' },
          { label: 'Over Budget', val: overBudgetCount,    color: overBudgetCount > 0 ? '#ef4444' : '#1abf94', icon: '🚨' },
        ].map(c => (
          <div key={c.label} className="glass-card" style={{ padding: '14px 16px' }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: textSub, textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>{c.icon} {c.label}</p>
            <p style={{ fontSize: 20, fontWeight: 800, color: c.color, margin: '6px 0 0', letterSpacing: '-0.5px' }}>{c.val}</p>
          </div>
        ))}
      </div>

      {/* ─── Add Category + Reorder ─── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: textMain }}>
          {spendingCategories.length} Categories
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setReorderMode(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 10,
              background: reorderMode ? (isDark ? '#1a3a5f' : '#eff6ff') : (isDark ? '#1a2235' : '#f3f4f6'),
              border: `1px solid ${reorderMode ? '#3b82f6' : (isDark ? '#252f3e' : '#e5e7eb')}`,
              cursor: 'pointer', fontSize: 13, fontWeight: 600,
              color: reorderMode ? '#3b82f6' : textSub,
              fontFamily: 'inherit', transition: 'all 0.2s',
            }}
          >
            <Bars3Icon style={{ width: 14, height: 14 }} />
            {reorderMode ? 'Done Reordering' : 'Reorder'}
          </button>
          <button
            onClick={() => setShowAddCat(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 10, background: isDark ? '#1a2235' : '#ecfdf5', border: `1px solid ${isDark ? '#1e3a5f' : '#6ee7b7'}`, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: isDark ? '#1abf94' : '#065f46', fontFamily: 'inherit' }}
          >
            <PlusIcon style={{ width: 14, height: 14 }} /> Add Category
          </button>
        </div>
      </div>

      {/* Reorder hint */}
      <AnimatePresence>
        {reorderMode && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            style={{ overflow: 'hidden', marginBottom: 12 }}
          >
            <div style={{ padding: '10px 14px', borderRadius: 10, background: isDark ? '#0c1824' : '#eff6ff', border: `1px solid ${isDark ? '#1e3a5f' : '#bfdbfe'}`, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Bars3Icon style={{ width: 14, height: 14, color: '#3b82f6', flexShrink: 0 }} />
              <p style={{ margin: 0, fontSize: 12, color: isDark ? '#93c5fd' : '#1e40af' }}>
                Drag the <strong>⠿ handle</strong> on any card to reorder. Your layout is saved automatically.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAddCat && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            style={{ overflow: 'hidden', marginBottom: 16 }}>
            <div className="glass-card" style={{ padding: 16 }}>
              <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: textMain }}>New Category</p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  type="text" value={newCatName} onChange={e => setNewCatName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddCategory(); if (e.key === 'Escape') setShowAddCat(false); }}
                  placeholder="Category name..." className="input-field" style={{ flex: 1, minWidth: 140 }} autoFocus
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
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
          {enriched.map(({ cat, limit, spent }) => (
            <div
              key={cat.id}
              style={{ position: 'relative', opacity: 1, transition: 'opacity 0.15s' }}
              draggable={reorderMode}
              onDragStart={() => handleDragStart(cat.id)}
              onDragEnter={() => handleDragEnter(cat.id)}
              onDragEnd={handleDragEnd}
              onDragOver={e => e.preventDefault()}
            >
              {/* Drag handle — only visible in reorder mode */}
              {reorderMode && (
                <div
                  title="Drag to reorder"
                  style={{
                    position: 'absolute', top: 10, left: 10, zIndex: 10,
                    width: 26, height: 26, borderRadius: 6,
                    background: isDark ? '#1e3a5f' : '#dbeafe',
                    border: '1px solid #3b82f6',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'grab', color: '#3b82f6',
                  }}
                >
                  <Bars3Icon style={{ width: 13, height: 13 }} />
                </div>
              )}
              <BudgetCard
                cat={cat} limit={limit} spent={spent} salary={monthlySalary}
                isDark={isDark} onSave={handleSaveLimit} cycleInfo={cycleInfo}
              />
              {!reorderMode && (
                <button
                  onClick={() => handleDeleteCategory(cat.id, cat.name)}
                  title="Remove category"
                  style={{
                    position: 'absolute', top: 8, right: 8, width: 22, height: 22,
                    border: 'none', borderRadius: 6, background: isDark ? '#1e2732' : '#fee2e2',
                    color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.5,
                  }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '0.5'}
                >
                  <TrashIcon style={{ width: 11, height: 11 }} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ─── Tip ─── */}
      <div style={{ marginTop: 20, padding: '12px 16px', borderRadius: 12, background: isDark ? '#0a0e14' : '#f0fdf9', border: `1px solid ${isDark ? '#1a2235' : '#a7f3d0'}`, display: 'flex', alignItems: 'center', gap: 10 }}>
        <SparklesIcon style={{ width: 16, height: 16, color: '#1abf94', flexShrink: 0 }} />
        <p style={{ margin: 0, fontSize: 12, color: textSub }}>
          <strong style={{ color: '#1abf94' }}>Tip:</strong> Hover over any budget card to see AI-powered spending projections for the rest of this cycle.
        </p>
      </div>
    </div>
  );
}
