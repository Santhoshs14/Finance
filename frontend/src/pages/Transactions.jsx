import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../context/ThemeContext';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { db } from '../config/firebase';
import { collection, query, where, orderBy, limit, startAfter, getDocs, onSnapshot } from 'firebase/firestore';
import TransactionTable from '../components/TransactionTable';
import QuickAddTransaction from '../components/QuickAddTransaction';
import ConfirmDialog from '../components/ConfirmDialog';
import { transactionsAPI, importAPI } from '../services/api';
import { getRecentFinancialMonths, getCycleDayInfo } from '../utils/financialMonth';
import {
  PlusIcon, ArrowUpTrayIcon, TrashIcon, FunnelIcon, XMarkIcon,
  MagnifyingGlassIcon, ArrowsUpDownIcon, ChevronDownIcon, ChevronUpIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { fmt } from '../utils/format';

/* ─── Payment method options ─── */
const PAYMENT_METHODS = ['Cash', 'Credit Card', 'Debit Card', 'UPI', 'Self Transfer'];

/* ─── Transaction categories excluded from spend/income summaries ─── */
const SKIP_CATS  = new Set(['Transfer', 'Credit Card Payment']);
const SKIP_TYPES = new Set(['Self Transfer', 'Transfer']);

/* ─── Default filter state ─── */
const DEFAULT_FILTERS = {
  dateFrom: '',
  dateTo: '',
  categories: [],
  paymentMethods: [],
  accountId: '',
  amountMin: '',
  amountMax: '',
  txnType: '',
  searchText: '',
};

/* ─────────────────────────────────────────────────────────────────────
   SortBtn — defined OUTSIDE the component to prevent unmount/remount
   on every render (was a critical React anti-pattern before).
───────────────────────────────────────────────────────────────────── */
function SortBtn({ field, label, sortField, sortDir, onToggle, isDark, textSub }) {
  const isActive = sortField === field;
  return (
    <button
      onClick={() => onToggle(field)}
      style={{
        display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 8,
        fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: 'none',
        background: isActive ? (isDark ? '#1a2235' : '#eef2ff') : 'transparent',
        color: isActive ? '#6366f1' : textSub,
        transition: 'all 0.15s',
      }}
    >
      {label}
      {isActive && (sortDir === 'desc'
        ? <ChevronDownIcon style={{ width: 12, height: 12 }} />
        : <ChevronUpIcon   style={{ width: 12, height: 12 }} />
      )}
    </button>
  );
}

export default function Transactions() {
  const { isDark } = useTheme();
  const queryClient = useQueryClient();
  const { currentUser } = useAuth();

  const [selectedCycle, setSelectedCycle] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const [editTxn, setEditTxn] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importAccountId, setImportAccountId] = useState('');
  const [importPreview, setImportPreview] = useState(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const { accounts, creditCards, categories, cycleStartDay, transactions: contextTransactions } = useData();

  // Recompute cycle list when cycleStartDay changes
  const FINANCIAL_MONTHS = useMemo(
    () => getRecentFinancialMonths(8, new Date(), cycleStartDay),
    [cycleStartDay]
  );
  const activeCycle = FINANCIAL_MONTHS[selectedCycle] ?? FINANCIAL_MONTHS[0];

  const cycleInfo = useMemo(
    () => activeCycle ? getCycleDayInfo(activeCycle) : { daysElapsed: 1, totalDays: 30, daysLeft: 0 },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeCycle?.cycleKey]
  );

  /* ─── Firestore listener (paginated table only) ─── */
  const cycleStart = activeCycle?.startDate ?? '';
  const cycleEnd   = activeCycle?.endDate   ?? '';

  // Paginated table state (Firestore subscription for current cycle)
  const [transactions, setTransactions]   = useState([]);
  const [lastVisible, setLastVisible]     = useState(null);
  const [hasMore, setHasMore]             = useState(false);
  const [isLoading, setIsLoading]         = useState(false);
  const [isPaginating, setIsPaginating]   = useState(false);

  /* ─────────────────────────────────────────────────────────
     SUMMARY METRICS
     Source: dedicated Firestore query for the selected cycle
     (no limit) so past cycles like April are always accurate.
  ───────────────────────────────────────────────────────── */
  const [summaryTxns, setSummaryTxns] = useState([]);

  useEffect(() => {
    if (!currentUser || !cycleStart || !cycleEnd) {
      setSummaryTxns([]);
      return;
    }

    const q = query(
      collection(db, `users/${currentUser.uid}/transactions`),
      where('date', '>=', cycleStart),
      where('date', '<=', cycleEnd),
      orderBy('date', 'desc')
    );

    const unsub = onSnapshot(q, (snap) => {
      setSummaryTxns(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => {
      console.error('Summary listener error:', err);
    });

    return () => unsub();
  }, [currentUser, cycleStart, cycleEnd]);

  const summaryMetrics = useMemo(() => {
    let totalIncome = 0;
    let totalSpent  = 0;
    const catMap = {};

    summaryTxns.forEach(t => {
      if (SKIP_CATS.has(t.category) || SKIP_TYPES.has(t.payment_type)) return;

      const amt = parseFloat(t.amount || 0);
      if (amt > 0) {
        totalIncome += amt;
      } else if (amt < 0) {
        totalSpent += Math.abs(amt);
        if (t.category) catMap[t.category] = (catMap[t.category] || 0) + Math.abs(amt);
      }
    });

    const topCategory = Object.entries(catMap).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
    const daysElapsed  = cycleInfo.daysElapsed || 1;
    const dailyAvg     = totalSpent / daysElapsed;
    const savingsRate  = totalIncome > 0
      ? parseFloat((((totalIncome - totalSpent) / totalIncome) * 100).toFixed(1))
      : 0;

    return {
      totalSpent:  Math.round(totalSpent  * 100) / 100,
      totalIncome: Math.round(totalIncome * 100) / 100,
      topCategory,
      dailyAvg:    Math.round(dailyAvg    * 100) / 100,
      savingsRate,
    };
  }, [summaryTxns, cycleInfo.daysElapsed]);

  /* ─── Advanced Filters ─── */
  const [filters, setFilters]         = useState({ ...DEFAULT_FILTERS });
  const [showFilters, setShowFilters] = useState(false);

  const hasActiveFilters = useMemo(() =>
    filters.categories.length > 0 || filters.paymentMethods.length > 0 ||
    filters.accountId || filters.amountMin || filters.amountMax ||
    filters.txnType || filters.searchText || filters.dateFrom || filters.dateTo,
  [filters]);

  const clearFilters = () => {
    setFilters({ ...DEFAULT_FILTERS });
    // Don't auto-close — the user may want to set new filters immediately
  };

  /* ─── Sorting ─── */
  const [sortField, setSortField] = useState('date');
  const [sortDir,   setSortDir]   = useState('desc');

  const toggleSort = useCallback((field) => {
    setSortField(prev => {
      if (prev === field) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
      else { setSortDir('desc'); }
      return field;
    });
  }, []);

  /* ─── Bulk Selection ─── */
  const [selectedIds, setSelectedIds]           = useState(new Set());
  const [bulkMode, setBulkMode]                 = useState(false);
  const [bulkCategoryTarget, setBulkCategoryTarget] = useState('');

  const toggleSelect = useCallback((id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback((visibleTxns) => {
    setSelectedIds(prev => {
      const allVisible  = visibleTxns.map(t => t.id);
      const allSelected = allVisible.every(id => prev.has(id));
      return allSelected ? new Set() : new Set(allVisible);
    });
  }, []);

  useEffect(() => {
    if (!currentUser || !cycleStart || !cycleEnd) return;

    setTransactions([]);
    setLastVisible(null);
    setHasMore(false);
    setIsLoading(true);
    setSelectedIds(new Set());

    const q = query(
      collection(db, `users/${currentUser.uid}/transactions`),
      where('date', '>=', cycleStart),
      where('date', '<=', cycleEnd),
      orderBy('date', 'desc'),
      limit(50)
    );

    const unsub = onSnapshot(q, (snap) => {
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLastVisible(snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null);
      setHasMore(snap.docs.length === 50);
      setIsLoading(false);
    }, (err) => {
      console.error('Transactions listener error:', err);
      setIsLoading(false);
    });

    return () => unsub();
  }, [currentUser, cycleStart, cycleEnd]);

  /* ─── Load More (pagination) ─── */
  const loadMore = async () => {
    if (!lastVisible || !hasMore || !currentUser || isPaginating) return;
    setIsPaginating(true);
    try {
      const q = query(
        collection(db, `users/${currentUser.uid}/transactions`),
        where('date', '>=', cycleStart),
        where('date', '<=', cycleEnd),
        orderBy('date', 'desc'),
        startAfter(lastVisible),
        limit(50)
      );
      const snap = await getDocs(q);
      const newTxns = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setTransactions(prev => {
        const existingIds = new Set(prev.map(t => t.id));
        return [...prev, ...newTxns.filter(t => !existingIds.has(t.id))];
      });
      setLastVisible(snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : lastVisible);
      setHasMore(snap.docs.length === 50);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load more');
    } finally {
      setIsPaginating(false);
    }
  };

  const textMain    = isDark ? '#f3f4f6' : '#111827';
  const textSub     = isDark ? '#9ca3af' : '#6b7280';
  const borderColor = isDark ? '#252f3e' : '#e5e7eb';

  /* ─── Client-side filtering ─── */
  const filteredTransactions = useMemo(() => {
    let result = [...transactions];

    if (filters.dateFrom) result = result.filter(t => t.date >= filters.dateFrom);
    if (filters.dateTo)   result = result.filter(t => t.date <= filters.dateTo);

    if (filters.categories.length > 0)
      result = result.filter(t => filters.categories.includes(t.category));

    if (filters.paymentMethods.length > 0)
      result = result.filter(t => filters.paymentMethods.includes(t.payment_type));

    if (filters.accountId)
      result = result.filter(t => t.account_id === filters.accountId);

    if (filters.amountMin) {
      const min = parseFloat(filters.amountMin);
      if (!isNaN(min)) result = result.filter(t => Math.abs(t.amount) >= min);
    }
    if (filters.amountMax) {
      const max = parseFloat(filters.amountMax);
      if (!isNaN(max)) result = result.filter(t => Math.abs(t.amount) <= max);
    }

    if (filters.txnType === 'income')
      result = result.filter(t => t.amount > 0 && !SKIP_CATS.has(t.category));
    else if (filters.txnType === 'expense')
      result = result.filter(t => t.amount < 0 && !SKIP_CATS.has(t.category));
    else if (filters.txnType === 'transfer')
      result = result.filter(t => SKIP_CATS.has(t.category) || SKIP_TYPES.has(t.payment_type));

    if (filters.searchText) {
      const q = filters.searchText.toLowerCase();
      result = result.filter(t =>
        (t.notes        || '').toLowerCase().includes(q) ||
        (t.category     || '').toLowerCase().includes(q) ||
        (t.payment_type || '').toLowerCase().includes(q) ||
        String(Math.abs(t.amount)).includes(q)
      );
    }

    return result;
  }, [transactions, filters]);

  /* ─── Sorting ─── */
  const sortedTransactions = useMemo(() => {
    return [...filteredTransactions].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'date') {
        cmp = a.date.localeCompare(b.date);
        if (cmp === 0) cmp = (a.createdAt || '').localeCompare(b.createdAt || '');
      } else if (sortField === 'amount') {
        cmp = Math.abs(a.amount) - Math.abs(b.amount);
      } else if (sortField === 'category') {
        cmp = (a.category || '').localeCompare(b.category || '');
      } else if (sortField === 'account') {
        cmp = (a.account_id || '').localeCompare(b.account_id || '');
      }
      // For all fields: desc means higher/newer first (negate cmp)
      return sortDir === 'desc' ? -cmp : cmp;
    });
  }, [filteredTransactions, sortField, sortDir]);

  /* ─── Daily grouping ─── */
  const grouped = useMemo(() => {
    // Group by date (preserve sortedTransactions order within each day)
    const map = new Map();
    sortedTransactions.forEach(t => {
      if (!map.has(t.date)) map.set(t.date, []);
      map.get(t.date).push(t);
    });

    // Sort the date keys to match the chosen sort direction
    const entries = [...map.entries()];
    entries.sort(([dateA], [dateB]) =>
      sortDir === 'desc' ? dateB.localeCompare(dateA) : dateA.localeCompare(dateB)
    );
    return entries;
  }, [sortedTransactions, sortDir]);

  /* ─── Mutations ─── */
  const invalidateContext = () => queryClient.invalidateQueries({ queryKey: ['transactions'] });

  const addMutation = useMutation({
    mutationFn: (data) => transactionsAPI.create(data, cycleStartDay),
    onSuccess: () => {
      toast.success('Transaction added!');
      invalidateContext();
      setShowAdd(false);
      setEditTxn(null);
    },
    onError: (e) => toast.error(e?.message || 'Failed to add transaction'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => transactionsAPI.update(id, data, cycleStartDay),
    onSuccess: () => {
      toast.success('Transaction updated!');
      invalidateContext();
      setShowAdd(false);
      setEditTxn(null);
    },
    onError: () => toast.error('Failed to update'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => transactionsAPI.delete(id, cycleStartDay),
    onSuccess: () => { toast.success('Transaction deleted'); invalidateContext(); },
    onError:   () => toast.error('Failed to delete'),
  });

  const deleteAllMutation = useMutation({
    mutationFn: () => transactionsAPI.deleteAll(),
    onSuccess: () => { toast.success('All transactions cleared!'); invalidateContext(); },
    onError:   () => toast.error('Failed to clear transactions'),
  });

  const handleEdit   = (txn) => { setEditTxn(txn); setShowAdd(true); };
  const handleSubmit = (data) => {
    if (editTxn) updateMutation.mutate({ id: editTxn.id, data });
    else         addMutation.mutate(data);
  };
  /* ─── Confirm Dialog state ─── */
  const [confirmState, setConfirmState] = useState({ open: false, title: '', message: '', confirmLabel: 'Confirm', confirmColor: 'danger', onConfirm: null });
  const showConfirm = (opts) => setConfirmState({ ...opts, open: true });
  const closeConfirm = () => setConfirmState(s => ({ ...s, open: false }));

  const handleDelete = (id) => {
    showConfirm({
      title: 'Delete transaction?',
      message: 'This action cannot be undone.',
      confirmLabel: 'Delete',
      confirmColor: 'danger',
      onConfirm: () => { closeConfirm(); deleteMutation.mutate(id); },
    });
  };
  const handleDeleteAll = () => {
    showConfirm({
      title: 'Delete ALL transactions?',
      message: 'WARNING: This will permanently delete every transaction. This cannot be undone.',
      confirmLabel: 'Delete Everything',
      confirmColor: 'danger',
      onConfirm: () => { closeConfirm(); deleteAllMutation.mutate(); },
    });
  };

  /* ─── Bulk Actions ─── */
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    showConfirm({
      title: `Delete ${count} transaction${count > 1 ? 's' : ''}?`,
      message: 'This cannot be undone.',
      confirmLabel: 'Delete Selected',
      confirmColor: 'danger',
      onConfirm: async () => {
        closeConfirm();
        setBulkBusy(true);
        let success = 0;
        for (const id of selectedIds) {
          try { await transactionsAPI.delete(id, cycleStartDay); success++; } catch { /* skip */ }
        }
        setBulkBusy(false);
        toast.success(`Deleted ${success} of ${count} transaction${count > 1 ? 's' : ''}`);
        setSelectedIds(new Set());
        invalidateContext();
      },
    });
  };

  const handleBulkCategoryUpdate = async () => {
    if (selectedIds.size === 0 || !bulkCategoryTarget) return;
    const count = selectedIds.size;
    showConfirm({
      title: `Update ${count} transaction${count > 1 ? 's' : ''}?`,
      message: `Set category to "${bulkCategoryTarget}" for the selected items.`,
      confirmLabel: 'Update Category',
      confirmColor: 'primary',
      onConfirm: async () => {
        closeConfirm();
        setBulkBusy(true);
        let success = 0;
        for (const id of selectedIds) {
          try { await transactionsAPI.update(id, { category: bulkCategoryTarget }, cycleStartDay); success++; } catch { /* skip */ }
        }
        setBulkBusy(false);
        toast.success(`Updated ${success} of ${count} transaction${count > 1 ? 's' : ''}`);
        setSelectedIds(new Set());
        setBulkCategoryTarget('');
        invalidateContext();
      },
    });
  };

  /* ─── Quick Filters ─── */
  const applyQuickFilter = (type) => {
    const next = { ...DEFAULT_FILTERS };
    if (type === 'credit-card')   next.paymentMethods = ['Credit Card'];
    if (type === 'high-spending') next.amountMin = '5000';
    setFilters(next);
    setShowFilters(true);
  };

  /* ─── Multi-select toggles ─── */
  const toggleCategoryFilter = (name) =>
    setFilters(prev => ({
      ...prev,
      categories: prev.categories.includes(name)
        ? prev.categories.filter(c => c !== name)
        : [...prev.categories, name],
    }));

  const togglePaymentFilter = (method) =>
    setFilters(prev => ({
      ...prev,
      paymentMethods: prev.paymentMethods.includes(method)
        ? prev.paymentMethods.filter(m => m !== method)
        : [...prev.paymentMethods, method],
    }));

  /* ─── Import ─── */
  const handleImportPreview = async () => {
    if (!importFile) return;
    try {
      const res = await importAPI.uploadExcel(importFile, true, importAccountId);
      setImportPreview(res.data.data);
      toast.success(`Preview: ${res.data.data?.length ?? 0} transactions found`);
    } catch { toast.error('Preview failed'); }
  };

  const handleImportConfirm = async () => {
    if (!importFile) return;
    try {
      await importAPI.uploadExcel(importFile, false, importAccountId);
      toast.success('Import successful!');
      invalidateContext();
      setShowImport(false);
      setImportFile(null);
      setImportPreview(null);
    } catch { toast.error('Import failed'); }
  };

  /* ─── Computed helpers ─── */
  const allAccounts = useMemo(() => [...accounts, ...creditCards], [accounts, creditCards]);

  /* ─────────────────────────────────
     RENDER
  ───────────────────────────────── */
  return (
    <div>
      {/* ─── Header ─── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: textMain, margin: 0 }}>Transactions</h1>
          <p style={{ fontSize: 13, color: textSub, margin: '4px 0 0' }}>
            Cycle: {activeCycle?.startDate} → {activeCycle?.endDate}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Cycle selector */}
          <select
            value={selectedCycle}
            onChange={(e) => setSelectedCycle(Number(e.target.value))}
            className="input-field"
            style={{ paddingRight: 32, minWidth: 160, cursor: 'pointer' }}
          >
            {FINANCIAL_MONTHS.map((fm, i) => (
              <option key={fm.label} value={i}>{fm.label}{i === 0 ? ' (Current)' : ''}</option>
            ))}
          </select>

          <button onClick={handleDeleteAll} className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#ef4444', borderColor: '#ef4444' }}>
            <TrashIcon style={{ width: 15, height: 15 }} /> Clear All
          </button>
          <button onClick={() => setShowImport(true)} className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <ArrowUpTrayIcon style={{ width: 15, height: 15 }} /> Import
          </button>
          <button onClick={() => { setEditTxn(null); setShowAdd(true); }} className="btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <PlusIcon style={{ width: 15, height: 15 }} /> Add Transaction
          </button>
        </div>
      </div>

      {/* ─── Summary Cards ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
        {[
          { label: 'Total Spent',   value: fmt(summaryMetrics.totalSpent),  color: '#ef4444' },
          { label: 'Total Income',  value: fmt(summaryMetrics.totalIncome), color: '#10b981' },
          { label: 'Top Category',  value: summaryMetrics.topCategory,      color: '#f59e0b' },
          { label: 'Daily Average', value: fmt(summaryMetrics.dailyAvg),    color: '#8b5cf6' },
          {
            label: 'Transactions',
            value: hasActiveFilters
              ? `${filteredTransactions.length} / ${transactions.length}`
              : `${transactions.length}${hasMore ? '+' : ''}`,
            color: '#1abf94',
          },
        ].map(card => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
            className="glass-card" style={{ padding: '14px 18px' }}
          >
            <p style={{ fontSize: 11, color: textSub, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>{card.label}</p>
            <p style={{ fontSize: 22, fontWeight: 800, color: card.color, margin: '6px 0 0', letterSpacing: '-0.5px' }}>{card.value}</p>
          </motion.div>
        ))}
      </div>

      {/* ─── Quick Filters + Controls Row ─── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            { label: '💳 Credit Cards', key: 'credit-card' },
            { label: '🔥 High Spending', key: 'high-spending' },
          ].map(qf => (
            <button key={qf.key} onClick={() => applyQuickFilter(qf.key)} style={{
              padding: '6px 14px', borderRadius: 99, fontSize: 12, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
              border: `1px solid ${isDark ? '#252f3e' : '#e5e7eb'}`,
              background: isDark ? '#161b22' : '#f9fafb',
              color: textSub,
            }}>
              {qf.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { setBulkMode(v => !v); setSelectedIds(new Set()); }} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 10,
            fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
            border: `1px solid ${bulkMode ? '#6366f1' : (isDark ? '#252f3e' : '#e5e7eb')}`,
            background: bulkMode ? (isDark ? '#1e1b4b' : '#eef2ff') : (isDark ? '#161b22' : '#f9fafb'),
            color: bulkMode ? '#6366f1' : textSub,
          }}>
            ☑ {bulkMode ? 'Exit Bulk' : 'Bulk Select'}
          </button>
          <button onClick={() => setShowFilters(v => !v)} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 10,
            fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
            border: `1px solid ${hasActiveFilters ? '#1abf94' : (isDark ? '#252f3e' : '#e5e7eb')}`,
            background: hasActiveFilters ? (isDark ? '#0c1f1a' : '#ecfdf5') : (isDark ? '#161b22' : '#f9fafb'),
            color: hasActiveFilters ? '#1abf94' : textSub,
          }}>
            <FunnelIcon style={{ width: 13, height: 13 }} />
            Filters{hasActiveFilters && ' ✓'}
          </button>
        </div>
      </div>

      {/* ─── Filter Panel ─── */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            style={{ overflow: 'hidden', marginBottom: 16 }}
          >
            <div className="glass-card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: textMain }}>🔍 Advanced Filters</p>
                {hasActiveFilters && (
                  <button onClick={clearFilters}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                    <XMarkIcon style={{ width: 14, height: 14 }} /> Clear All
                  </button>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 14 }}>
                {/* Text Search */}
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: textSub, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Search</label>
                  <div style={{ position: 'relative' }}>
                    <MagnifyingGlassIcon style={{ width: 14, height: 14, color: textSub, position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      type="text" placeholder="Notes, category, amount..."
                      value={filters.searchText}
                      onChange={e => setFilters(f => ({ ...f, searchText: e.target.value }))}
                      className="input-field" style={{ paddingLeft: 32, width: '100%' }}
                    />
                  </div>
                </div>

                {/* Date From */}
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: textSub, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date From</label>
                  <input type="date" value={filters.dateFrom}
                    onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))}
                    min={activeCycle?.startDate} max={activeCycle?.endDate}
                    className="input-field" style={{ width: '100%' }} />
                </div>

                {/* Date To */}
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: textSub, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date To</label>
                  <input type="date" value={filters.dateTo}
                    onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value }))}
                    min={activeCycle?.startDate} max={activeCycle?.endDate}
                    className="input-field" style={{ width: '100%' }} />
                </div>

                {/* Amount Min */}
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: textSub, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Min Amount (₹)</label>
                  <input type="number" placeholder="0" min="0" value={filters.amountMin}
                    onChange={e => setFilters(f => ({ ...f, amountMin: e.target.value }))}
                    className="input-field" style={{ width: '100%' }} />
                </div>

                {/* Amount Max */}
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: textSub, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Max Amount (₹)</label>
                  <input type="number" placeholder="No limit" min="0" value={filters.amountMax}
                    onChange={e => setFilters(f => ({ ...f, amountMax: e.target.value }))}
                    className="input-field" style={{ width: '100%' }} />
                </div>

                {/* Transaction Type */}
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: textSub, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Type</label>
                  <select value={filters.txnType}
                    onChange={e => setFilters(f => ({ ...f, txnType: e.target.value }))}
                    className="input-field" style={{ width: '100%' }}>
                    <option value="">All</option>
                    <option value="expense">Expenses only</option>
                    <option value="income">Income only</option>
                    <option value="transfer">Transfers only</option>
                  </select>
                </div>

                {/* Account */}
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: textSub, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Account</label>
                  <select value={filters.accountId}
                    onChange={e => setFilters(f => ({ ...f, accountId: e.target.value }))}
                    className="input-field" style={{ width: '100%' }}>
                    <option value="">All Accounts</option>
                    {allAccounts.map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.account_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Category pills */}
              <div style={{ marginTop: 14 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: textSub, display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Categories</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {categories
                    .filter(c => !SKIP_CATS.has(c.name))
                    .map(cat => {
                      const isActive = filters.categories.includes(cat.name);
                      return (
                        <button key={cat.id} onClick={() => toggleCategoryFilter(cat.name)} style={{
                          display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 99,
                          fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                          border: `1px solid ${isActive ? cat.color : (isDark ? '#252f3e' : '#e5e7eb')}`,
                          background: isActive ? `${cat.color}22` : 'transparent',
                          color: isActive ? cat.color : textSub,
                        }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: cat.color, flexShrink: 0 }} />
                          {cat.name}
                        </button>
                      );
                    })}
                </div>
              </div>

              {/* Payment Method pills */}
              <div style={{ marginTop: 14 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: textSub, display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Payment Method</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {PAYMENT_METHODS.map(method => {
                    const isActive = filters.paymentMethods.includes(method);
                    return (
                      <button key={method} onClick={() => togglePaymentFilter(method)} style={{
                        padding: '5px 12px', borderRadius: 99, fontSize: 12, fontWeight: 600,
                        cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                        border: `1px solid ${isActive ? '#6366f1' : (isDark ? '#252f3e' : '#e5e7eb')}`,
                        background: isActive ? 'rgba(99,102,241,0.15)' : 'transparent',
                        color: isActive ? '#6366f1' : textSub,
                      }}>
                        {method}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Sorting Controls ─── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        <ArrowsUpDownIcon style={{ width: 14, height: 14, color: textSub }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: textSub, marginRight: 4 }}>Sort:</span>
        {['date', 'amount', 'category', 'account'].map(f => (
          <SortBtn
            key={f}
            field={f}
            label={f.charAt(0).toUpperCase() + f.slice(1)}
            sortField={sortField}
            sortDir={sortDir}
            onToggle={toggleSort}
            isDark={isDark}
            textSub={textSub}
          />
        ))}
      </div>

      {/* ─── Bulk Action Bar ─── */}
      <AnimatePresence>
        {bulkMode && selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            style={{
              padding: '12px 18px', borderRadius: 14, marginBottom: 14,
              background: isDark ? '#1e1b4b' : '#eef2ff',
              border: `1px solid ${isDark ? '#312e81' : '#c7d2fe'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, color: '#6366f1' }}>
              {selectedIds.size} selected
            </span>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Bulk Category */}
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <select
                  value={bulkCategoryTarget}
                  onChange={e => setBulkCategoryTarget(e.target.value)}
                  disabled={bulkBusy}
                  className="input-field"
                  style={{ fontSize: 12, padding: '5px 10px', minWidth: 140 }}
                >
                  <option value="">Move to category...</option>
                  {categories
                    .filter(c => !SKIP_CATS.has(c.name))
                    .map(cat => (
                      <option key={cat.id} value={cat.name}>{cat.name}</option>
                    ))}
                </select>
                {bulkCategoryTarget && (
                  <button onClick={handleBulkCategoryUpdate} disabled={bulkBusy}
                    className="btn-primary" style={{ fontSize: 12, padding: '5px 14px' }}>
                    {bulkBusy ? '...' : 'Apply'}
                  </button>
                )}
              </div>

              {/* Bulk Delete */}
              <button onClick={handleBulkDelete} disabled={bulkBusy} style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 10,
                fontSize: 12, fontWeight: 700, cursor: bulkBusy ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                background: '#ef444422', border: '1px solid #ef444444', color: '#ef4444',
                opacity: bulkBusy ? 0.6 : 1,
              }}>
                <TrashIcon style={{ width: 13, height: 13 }} />
                {bulkBusy ? 'Working...' : `Delete ${selectedIds.size}`}
              </button>

              <button onClick={() => setSelectedIds(new Set())} disabled={bulkBusy} style={{
                fontSize: 12, fontWeight: 600, color: textSub, background: 'none',
                border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              }}>
                Clear
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Transaction Table (daily grouped) ─── */}
      <div className="glass-card" style={{ padding: 24 }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: textSub }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              border: '3px solid rgba(26,191,148,0.2)', borderTopColor: '#1abf94',
              animation: 'spin 0.9s linear infinite', margin: '0 auto 12px',
            }} />
            <p>Loading transactions...</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : grouped.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <p style={{ fontSize: 20, fontWeight: 700, color: textMain, margin: 0 }}>
              {hasActiveFilters ? 'No matching transactions' : 'No transactions'}
            </p>
            <p style={{ fontSize: 13, color: textSub, marginTop: 8 }}>
              {hasActiveFilters
                ? 'Try adjusting or clearing your filters'
                : `in ${activeCycle?.label} (${activeCycle?.startDate} → ${activeCycle?.endDate})`}
            </p>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="btn-secondary" style={{ marginTop: 12, fontSize: 12 }}>
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <>
            {grouped.map(([date, dayTxns]) => {
              // Day summary: exclude transfers and CC payments from totals
              const countable = dayTxns.filter(t =>
                !SKIP_CATS.has(t.category) && t.payment_type !== 'Self Transfer'
              );
              const daySpent  = countable.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
              const dayIncome = countable.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
              const dateLabel = new Date(date + 'T00:00:00')
                .toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' });

              return (
                <div key={date} style={{ marginBottom: 24 }}>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    marginBottom: 10, paddingBottom: 8, borderBottom: `1px solid ${borderColor}`,
                  }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: textMain }}>{dateLabel}</span>
                    <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
                      {dayIncome > 0 && <span style={{ color: '#1abf94', fontWeight: 600 }}>+{fmt(dayIncome)}</span>}
                      {daySpent  > 0 && <span style={{ color: '#ef4444', fontWeight: 600 }}>−{fmt(daySpent)}</span>}
                    </div>
                  </div>
                  <TransactionTable
                    transactions={dayTxns}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    categories={categories}
                    accounts={accounts}
                    creditCards={creditCards}
                    selectable={bulkMode}
                    selectedIds={selectedIds}
                    onToggleSelect={toggleSelect}
                    onToggleSelectAll={toggleSelectAll}
                  />
                </div>
              );
            })}

            {hasMore && (
              <div style={{ textAlign: 'center', marginTop: 20 }}>
                <button
                  onClick={loadMore}
                  disabled={isPaginating}
                  className="btn-secondary"
                  style={{ padding: '8px 28px', borderRadius: 99, fontSize: 13 }}
                >
                  {isPaginating ? 'Loading...' : 'Load More Transactions'}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ─── Add / Edit Modal ─── */}
      <AnimatePresence>
        {showAdd && (
          <QuickAddTransaction
            isOpen={showAdd}
            onClose={() => { setShowAdd(false); setEditTxn(null); }}
            onSubmit={handleSubmit}
            accounts={accounts}
            creditCards={creditCards}
            categories={categories}
            initialData={editTxn}
          />
        )}
      </AnimatePresence>

      {/* ─── Import Modal ─── */}
      <AnimatePresence>
        {showImport && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
            onClick={() => setShowImport(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              style={{ width: '90%', maxWidth: 500, background: isDark ? '#181e27' : '#fff', borderRadius: 20, padding: 28, border: `1px solid ${borderColor}` }}
            >
              <h3 style={{ fontSize: 18, fontWeight: 700, color: textMain, margin: '0 0 16px' }}>Import Transactions</h3>
              <div style={{ padding: 12, background: isDark ? '#252f3e' : '#f3f4f6', borderRadius: 8, marginBottom: 14 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: textMain, margin: '0 0 6px' }}>Expected Columns (case-sensitive):</p>
                <ul style={{ fontSize: 12, color: textSub, margin: 0, paddingLeft: 18 }}>
                  <li><strong>Date</strong>: YYYY-MM-DD (e.g. 2024-03-15)</li>
                  <li><strong>Amount</strong>: Number (negative = expense)</li>
                  <li><strong>Category</strong>: Text (e.g. Food, Transport)</li>
                  <li><strong>Notes</strong>: Optional description</li>
                </ul>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: textSub, display: 'block', marginBottom: 6 }}>Excel / CSV File</label>
                  <input type="file" accept=".xlsx,.xls,.csv"
                    onChange={e => setImportFile(e.target.files[0])}
                    className="input-field" />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: textSub, display: 'block', marginBottom: 6 }}>Assign to Account (optional)</label>
                  <select value={importAccountId} onChange={e => setImportAccountId(e.target.value)} className="input-field">
                    <option value="">No account</option>
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.account_name}</option>
                    ))}
                  </select>
                </div>
                {importPreview && (
                  <p style={{ fontSize: 13, color: '#1abf94', margin: 0 }}>
                    ✓ {importPreview.length} transactions ready to import
                  </p>
                )}
                <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                  <button onClick={() => { setShowImport(false); setImportPreview(null); }}
                    className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
                  {!importPreview ? (
                    <button onClick={handleImportPreview} disabled={!importFile}
                      className="btn-primary" style={{ flex: 1 }}>Preview</button>
                  ) : (
                    <button onClick={handleImportConfirm}
                      className="btn-primary" style={{ flex: 1 }}>
                      Import {importPreview.length} Transactions
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Styled Confirm Dialog */}
      <ConfirmDialog
        open={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        confirmLabel={confirmState.confirmLabel}
        confirmColor={confirmState.confirmColor}
        onConfirm={confirmState.onConfirm}
        onCancel={closeConfirm}
      />
    </div>
  );
}
