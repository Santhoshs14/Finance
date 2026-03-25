import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../context/ThemeContext';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { db } from '../config/firebase';
import { collection, query, where, orderBy, limit, startAfter, getDocs, onSnapshot } from 'firebase/firestore';
import TransactionTable from '../components/TransactionTable';
import QuickAddTransaction from '../components/QuickAddTransaction';
import { transactionsAPI, importAPI } from '../services/api';
import { getRecentFinancialMonths } from '../utils/financialMonth';
import { PlusIcon, ArrowUpTrayIcon, TrashIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

import { fmt } from '../utils/format';

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

  const { accounts, creditCards, categories, cycleStartDay } = useData();

  // Recompute cycle list whenever cycleStartDay changes
  const FINANCIAL_MONTHS = useMemo(() => getRecentFinancialMonths(8, new Date(), cycleStartDay), [cycleStartDay]);
  const activeCycle = FINANCIAL_MONTHS[selectedCycle];

  const [transactions, setTransactions] = useState([]);
  const [lastVisible, setLastVisible] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isPaginating, setIsPaginating] = useState(false);

  // Initial load / Real-time listener for first page ONLY
  useEffect(() => {
    if (!currentUser || !activeCycle) return;
    
    setTransactions([]);
    setLastVisible(null);
    setHasMore(true);
    setIsLoading(true);

    const q = query(
      collection(db, `users/${currentUser.uid}/transactions`),
      where('date', '>=', activeCycle.startDate),
      where('date', '<=', activeCycle.endDate),
      orderBy('date', 'desc'),
      limit(50)
    );

    const unsub = onSnapshot(q, (snap) => {
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      if (snap.docs.length > 0) {
        setLastVisible(snap.docs[snap.docs.length - 1]);
      }
      setHasMore(snap.docs.length === 50);
      setIsLoading(false);
    });
    
    return () => unsub();
  }, [currentUser, activeCycle]);

  const loadMore = async () => {
    if (!lastVisible || !hasMore || !currentUser) return;
    setIsPaginating(true);
    try {
      const q = query(
        collection(db, `users/${currentUser.uid}/transactions`),
        where('date', '>=', activeCycle.startDate),
        where('date', '<=', activeCycle.endDate),
        orderBy('date', 'desc'),
        startAfter(lastVisible),
        limit(50)
      );
      const snap = await getDocs(q);
      const newTxns = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      setTransactions(prev => {
        const existingIds = new Set(prev.map(t => t.id));
        const filteredNew = newTxns.filter(t => !existingIds.has(t.id));
        return [...prev, ...filteredNew];
      });

      if (snap.docs.length > 0) {
        setLastVisible(snap.docs[snap.docs.length - 1]);
      }
      setHasMore(snap.docs.length === 50);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load more');
    } finally {
      setIsPaginating(false);
    }
  };

  const textMain = isDark ? '#f3f4f6' : '#111827';
  const textSub  = isDark ? '#9ca3af' : '#6b7280';
  const borderColor = isDark ? '#252f3e' : '#e5e7eb';

  const analytics = useMemo(() => {
    if (!transactions.length) return { totalSpent: 0, totalIncome: 0, topCategory: '—', dailyAvg: 0, count: 0 };
    const validTxns = transactions.filter(t => t.category !== 'Transfer' && !t.payment_type?.includes('Transfer') && t.category !== 'Credit Card Payment');
    const totalSpent = validTxns.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
    const totalIncome = validTxns.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const catMap = {};
    validTxns.forEach(t => { if (t.amount < 0 && t.category !== 'Income') catMap[t.category] = (catMap[t.category] || 0) + Math.abs(t.amount); });
    const topCategory = Object.entries(catMap).sort((a, b) => b[1] - a[1])[0]?.[0] || '\u2014';
    const days = [...new Set(validTxns.filter(t => t.amount < 0).map(t => t.date))].length || 1;
    return { totalSpent, totalIncome, topCategory, dailyAvg: totalSpent / days, count: transactions.length };
  }, [transactions]);

  /* ─── Daily grouping ─── */
  const grouped = useMemo(() => {
    const map = {};
    [...transactions].sort((a, b) => b.date.localeCompare(a.date)).forEach(t => {
      if (!map[t.date]) map[t.date] = [];
      map[t.date].push(t);
    });
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
  }, [transactions]);

  /* ─── Mutations ─── */
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['transactions'] });

  const addMutation = useMutation({
    mutationFn: (data) => transactionsAPI.create(data, cycleStartDay),
    onSuccess: () => { toast.success('Transaction added!'); invalidate(); setShowAdd(false); setEditTxn(null); },
    onError: (e) => toast.error(e?.message || 'Failed to add transaction'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => transactionsAPI.update(id, data, cycleStartDay),
    onSuccess: () => { toast.success('Transaction updated!'); invalidate(); setShowAdd(false); setEditTxn(null); },
    onError: () => toast.error('Failed to update'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => transactionsAPI.delete(id, cycleStartDay),
    onSuccess: () => { toast.success('Deleted'); invalidate(); },
    onError: () => toast.error('Failed to delete'),
  });

  const deleteAllMutation = useMutation({
    mutationFn: () => transactionsAPI.deleteAll(),
    onSuccess: (res) => { 
      toast.success(res.data?.message || 'All transactions cleared!'); 
      invalidate(); 
    },
    onError: () => toast.error('Failed to clear transactions'),
  });

  const handleEdit = (txn) => { setEditTxn(txn); setShowAdd(true); };
  const handleSubmit = (data) => {
    if (editTxn) updateMutation.mutate({ id: editTxn.id, data });
    else addMutation.mutate(data);
  };
  const handleDelete = (id) => { if (confirm('Delete this transaction?')) deleteMutation.mutate(id); };
  const handleDeleteAll = () => { 
    if (confirm('WARNING: Are you sure you want to permanently delete ALL your transactions? This cannot be undone.')) {
      deleteAllMutation.mutate();
    }
  };

  /* ─── Import ─── */
  const handleImportPreview = async () => {
    if (!importFile) return;
    try {
      const res = await importAPI.uploadExcel(importFile, true, importAccountId);
      setImportPreview(res.data.data);
      toast.success(`Preview: ${res.data.data?.length} transactions`);
    } catch { toast.error('Preview failed'); }
  };
  const handleImportConfirm = async () => {
    if (!importFile) return;
    try {
      await importAPI.uploadExcel(importFile, false, importAccountId);
      toast.success('Import successful!');
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      setShowImport(false); setImportFile(null); setImportPreview(null);
    } catch { toast.error('Import failed'); }
  };

  return (
    <div>
      {/* ─── Header ─── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: textMain, margin: 0 }}>Transactions</h1>
          <p style={{ fontSize: 13, color: textSub, margin: '4px 0 0' }}>
            Cycle: {activeCycle.startDate} → {activeCycle.endDate}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Financial Month Selector */}
          <div style={{ position: 'relative' }}>
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
          </div>
          
          <button onClick={handleDeleteAll} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#ef4444', borderColor: '#ef4444' }}>
            <TrashIcon style={{ width: 15, height: 15 }} /> Clear All
          </button>
          
          <button onClick={() => setShowImport(true)} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <ArrowUpTrayIcon style={{ width: 15, height: 15 }} /> Import
          </button>
          <button onClick={() => { setEditTxn(null); setShowAdd(true); }} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <PlusIcon style={{ width: 15, height: 15 }} /> Add Transaction
          </button>
        </div>
      </div>

      {/* ─── Analytics Summary ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Total Spent', value: fmt(analytics.totalSpent), color: '#ef4444' },
          { label: 'Top Category', value: analytics.topCategory, color: '#f59e0b' },
          { label: 'Daily Average', value: fmt(analytics.dailyAvg), color: '#8b5cf6' },
          { label: 'Transactions (Loaded)', value: analytics.count, color: '#1abf94' },
        ].map(card => (
          <motion.div key={card.label} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="glass-card"
            style={{ padding: '14px 18px' }}>
            <p style={{ fontSize: 11, color: textSub, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>{card.label}</p>
            <p style={{ fontSize: 22, fontWeight: 800, color: card.color, margin: '6px 0 0', letterSpacing: '-0.5px' }}>{card.value}</p>
          </motion.div>
        ))}
      </div>

      {/* ─── Transactions (Daily Grouped) ─── */}
      <div className="glass-card" style={{ padding: 24 }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: textSub }}>Loading transactions...</div>
        ) : grouped.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <p style={{ fontSize: 20, fontWeight: 700, color: textMain, margin: 0 }}>No transactions</p>
            <p style={{ fontSize: 13, color: textSub, marginTop: 8 }}>in {activeCycle.label} ({activeCycle.startDate} → {activeCycle.endDate})</p>
          </div>
        ) : (
          <>
            {grouped.map(([date, dayTxns]) => {
              const validDayTxns = dayTxns.filter(t => t.category !== 'Transfer' && !t.payment_type?.includes('Transfer') && t.category !== 'Credit Card Payment');
              const daySpent = validDayTxns.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
              const dayIncome = validDayTxns.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
              const d = new Date(date + 'T00:00:00');
              const dateLabel = d.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' });
              return (
                <div key={date} style={{ marginBottom: 24 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingBottom: 8, borderBottom: `1px solid ${borderColor}` }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: textMain }}>{dateLabel}</span>
                    <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
                      {dayIncome > 0 && <span style={{ color: '#1abf94', fontWeight: 600 }}>+{fmt(dayIncome)}</span>}
                      {daySpent > 0 && <span style={{ color: '#ef4444', fontWeight: 600 }}>-{fmt(daySpent)}</span>}
                    </div>
                  </div>
                  <TransactionTable transactions={dayTxns} onEdit={handleEdit} onDelete={handleDelete} categories={categories} />
                </div>
              );
            })}
            
            {hasMore && (
              <div style={{ textAlign: 'center', marginTop: 20 }}>
                <button
                  onClick={loadMore}
                  disabled={isPaginating}
                  className="btn-secondary"
                  style={{ padding: '8px 24px', borderRadius: 99, fontSize: 13 }}
                >
                  {isPaginating ? 'Loading...' : 'Load More'}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ─── Quick Add / Edit Modal ─── */}
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
        />)}
      </AnimatePresence>

      {/* ─── Import Modal ─── */}
      <AnimatePresence>
        {showImport && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
            onClick={() => setShowImport(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              style={{ width: '90%', maxWidth: 500, background: isDark ? '#181e27' : '#fff', borderRadius: 20, padding: 28, border: `1px solid ${borderColor}` }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: textMain, margin: '0 0 16px' }}>Import Transactions</h3>
              <div style={{ padding: '12px', background: isDark ? '#252f3e' : '#f3f4f6', borderRadius: 8, marginBottom: 14 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: textMain, margin: '0 0 6px' }}>Expected Columns (Case-sensitive):</p>
                <ul style={{ fontSize: 12, color: textSub, margin: 0, paddingLeft: 18 }}>
                  <li><strong>Date</strong>: YYYY-MM-DD format (e.g., 2024-03-15)</li>
                  <li><strong>Amount</strong>: Number (negative for expenses)</li>
                  <li><strong>Category</strong>: Text (e.g., Food, Transport)</li>
                  <li><strong>Notes</strong>: Optional text for description</li>
                </ul>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: textSub, display: 'block', marginBottom: 6 }}>Excel / CSV File</label>
                  <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => setImportFile(e.target.files[0])} className="input-field" />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: textSub, display: 'block', marginBottom: 6 }}>Assign to Account (optional)</label>
                  <select value={importAccountId} onChange={(e) => setImportAccountId(e.target.value)} className="input-field">
                    <option value="">Select an account...</option>
                    {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.account_name} (₹{parseFloat(acc.type === 'credit' ? acc.liability || 0 : acc.balance || 0).toLocaleString('en-IN')})</option>)}
                  </select>
                </div>
                {importPreview && (
                  <p style={{ fontSize: 13, color: '#1abf94', margin: 0 }}>Preview: {importPreview.length} transactions ready to import</p>
                )}
                <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                  <button onClick={() => { setShowImport(false); setImportPreview(null); }} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
                  {!importPreview ? (
                    <button onClick={handleImportPreview} className="btn-primary" style={{ flex: 1 }}>Preview</button>
                  ) : (
                    <button onClick={handleImportConfirm} className="btn-primary" style={{ flex: 1 }}>Import {importPreview.length} Transactions</button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
