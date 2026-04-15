import { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { useTheme } from '../context/ThemeContext';
import { useData } from '../context/DataContext';
import { accountsAPI, creditCardsAPI, budgetSnapshotsAPI } from '../services/api';
import { calculateCreditCardHealth } from '../utils/calculations';
import ChartCard from '../components/ChartCard';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { PlusIcon, CreditCardIcon, BanknotesIcon, PencilSquareIcon, CheckBadgeIcon, ShieldCheckIcon, ExclamationTriangleIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { getFinancialCycle, formatShortDate } from '../utils/financialMonth';
import { fmt } from '../utils/format';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const CC_BUDGET_CATEGORY_KEY = 'cc-spending-budget';

export default function CreditCards() {
  const { isDark } = useTheme();
  const queryClient = useQueryClient();
  const { accounts, creditCards, transactions, cycleStartDay } = useData();
  const bankAccounts = useMemo(() => accounts.filter(a => a.type !== 'credit'), [accounts]);

  const [showAddCard, setShowAddCard] = useState(false);
  const [showPayBill, setShowPayBill] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState(null);
  const [cardForm, setCardForm] = useState({ account_name: '', credit_limit: '', billing_cycle_start_day: 1, due_days_after: 20, shared_limit_with: '' });
  const [payForm, setPayForm] = useState({ account_id: '', amount: '', date: new Date().toISOString().split('T')[0] });
  const [isEditMode, setIsEditMode] = useState(false);

  // ── CC Spending Budget state ──
  const [ccBudgetLimit, setCcBudgetLimit] = useState(0);
  const [ccBudgetEditing, setCcBudgetEditing] = useState(false);
  const [ccBudgetInput, setCcBudgetInput] = useState('');

  // Derive cc transactions
  const ccTxns = useMemo(() => transactions.filter(t => t.payment_type === 'Credit Card' || creditCards.some(c => c.id === t.account_id)), [transactions, creditCards]);

  const activeCardId = selectedCardId || (creditCards.length > 0 ? creditCards[0].id : null);
  const activeCard = creditCards.find(c => c.id === activeCardId);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['accounts'] });
    queryClient.invalidateQueries({ queryKey: ['creditCards'] });
  };

  const addCardMutation = useMutation({
    mutationFn: (data) => accountsAPI.create({ ...data, type: 'credit', balance: 0 }),
    onSuccess: () => {
      invalidateAll();
      toast.success('Credit Card added successfully!'); 
      setShowAddCard(false);
      setCardForm({ account_name: '', credit_limit: '', billing_cycle_start_day: 1, due_days_after: 20, shared_limit_with: '' });
    },
    onError: () => toast.error('Failed to add card.')
  });

  const editCardMutation = useMutation({
    mutationFn: ({ id, data }) => accountsAPI.update(id, data),
    onSuccess: () => {
      invalidateAll();
      toast.success('Card updated!'); 
      setShowAddCard(false);
      setIsEditMode(false);
    },
    onError: () => toast.error('Failed to update card.')
  });

  const deleteCardMutation = useMutation({
    mutationFn: (id) => accountsAPI.delete(id),
    onSuccess: () => {
      invalidateAll();
      toast.success('Card deleted!');
      setIsEditMode(false);
      setShowAddCard(false);
    }
  });

  const payBillMutation = useMutation({
    mutationFn: async (data) => {
      // Atomic bill payment — single batch handles bank debit, CC credit, and balance updates
      await creditCardsAPI.payBill({
        amount: data.amount,
        bankAccountId: data.account_id,
        creditCardId: activeCardId,
        date: data.date,
        ccName: activeCard.account_name,
        cycleStartDay,
      });
    },
    onSuccess: () => {
      toast.success('Payment recorded successfully!');
      setShowPayBill(false);
      invalidateAll();
    },
    onError: (e) => toast.error(e?.message || 'Failed to record payment.')
  });

  const handleCardSubmit = (e) => {
    e.preventDefault();
    const data = {
      account_name: cardForm.account_name,
      credit_limit: cardForm.shared_limit_with ? 0 : (parseFloat(cardForm.credit_limit) || 0),
      billing_cycle_start_day: parseInt(cardForm.billing_cycle_start_day) || 1,
      due_days_after: parseInt(cardForm.due_days_after) || 20,
      shared_limit_with: cardForm.shared_limit_with || null,
    };
    if (isEditMode) {
      editCardMutation.mutate({ id: activeCardId, data });
    } else {
      addCardMutation.mutate(data);
    }
  };

  const openEditCard = () => {
    if (!activeCard) return;
    setCardForm({
      account_name: activeCard.account_name,
      credit_limit: activeCard.credit_limit || '',
      billing_cycle_start_day: activeCard.billing_cycle_start_day || 1,
      due_days_after: activeCard.due_days_after || 20,
      shared_limit_with: activeCard.shared_limit_with || '',
    });
    setIsEditMode(true);
    setShowAddCard(true);
  };

  // ── CC Budget: derive cycle key from active card's billing cycle ──
  const activeCycleCycleKey = useMemo(() => {
    const today = new Date();
    const cardCycleDay = activeCard ? parseInt(activeCard.billing_cycle_start_day) || 1 : cycleStartDay;
    return getFinancialCycle(today, cardCycleDay).cycleKey;
  }, [activeCard, cycleStartDay]);

  // Load CC budget limit for current cycle
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await budgetSnapshotsAPI.get(activeCycleCycleKey);
        if (!cancelled && data && data[CC_BUDGET_CATEGORY_KEY]) {
          const limitVal = typeof data[CC_BUDGET_CATEGORY_KEY] === 'object'
            ? (data[CC_BUDGET_CATEGORY_KEY].limit ?? 0)
            : data[CC_BUDGET_CATEGORY_KEY];
          setCcBudgetLimit(limitVal);
        } else if (!cancelled) {
          setCcBudgetLimit(0);
        }
      } catch (e) {
        console.error('Failed to load CC budget:', e);
      }
    };
    if (activeCycleCycleKey) load();
    return () => { cancelled = true; };
  }, [activeCycleCycleKey]);

  const handleSaveCcBudget = useCallback(async () => {
    const v = parseFloat(ccBudgetInput);
    if (isNaN(v) || v < 0) { toast.error('Enter a valid amount'); return; }
    setCcBudgetLimit(v);
    setCcBudgetEditing(false);
    try {
      await budgetSnapshotsAPI.setLimit(activeCycleCycleKey, CC_BUDGET_CATEGORY_KEY, v);
      toast.success('CC spending budget saved!');
    } catch {
      toast.error('Failed to save CC budget');
    }
  }, [ccBudgetInput, activeCycleCycleKey]);

  // Metrics for active card
  const activeTxns = useMemo(() => ccTxns.filter(t => t.account_id === activeCardId), [ccTxns, activeCardId]);
  
  const metrics = useMemo(() => {
    if (!activeCard) return null;
    const balance = parseFloat(activeCard.liability || 0);

    // Shared Limit Resolution
    let limit = parseFloat(activeCard.credit_limit || 0);
    let sharedLiability = balance;
    let isShared = !!activeCard.shared_limit_with;
    let parentCard = activeCard;

    if (isShared) {
      parentCard = creditCards.find(c => c.id === activeCard.shared_limit_with) || activeCard;
      limit = parseFloat(parentCard.credit_limit || 0);
      sharedLiability = parseFloat(parentCard.liability || 0);
      // add all other children
      creditCards.filter(c => c.shared_limit_with === parentCard.id).forEach(c => {
        sharedLiability += parseFloat(c.liability || 0);
      });
    } else {
      // It might be a parent, add its children's liability
      const children = creditCards.filter(c => c.shared_limit_with === activeCard.id);
      if (children.length > 0) {
        isShared = true;
        children.forEach(c => {
          sharedLiability += parseFloat(c.liability || 0);
        });
      }
    }

    const available = limit - sharedLiability;
    const utilPercent = limit > 0 ? ((sharedLiability / limit) * 100).toFixed(1) : 0;
    
    // Cycle logic
    const today = new Date();
    const cycle = getFinancialCycle(today, parseInt(activeCard.billing_cycle_start_day) || 1);
    
    // Spend this cycle
    const cycleTxns = activeTxns.filter(t => t.date >= cycle.startDate && t.date <= cycle.endDate);
    let cycleSpend = 0;
    let cyclePaid = 0;
    cycleTxns.forEach(t => {
      const amt = parseFloat(t.amount || 0);
      if (amt < 0) cycleSpend += Math.abs(amt);
      else cyclePaid += amt;
    });

    const dueDateObj = new Date(cycle.endDate);
    dueDateObj.setDate(dueDateObj.getDate() + (parseInt(activeCard.due_days_after) || 20));

    return { balance, limit, available, utilPercent, cycleSpend, cyclePaid, cycle, dueDate: dueDateObj.toISOString().split('T')[0], isShared, parentCardName: parentCard?.account_name, sharedLiability };
  }, [activeCard, activeTxns, creditCards]);

  // Charts data
  const categoryData = useMemo(() => {
    const acc = {};
    activeTxns.forEach(t => {
      const amt = parseFloat(t.amount || 0);
      if (amt < 0) {
        acc[t.category] = (acc[t.category] || 0) + Math.abs(amt);
      }
    });
    return Object.entries(acc).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);
  }, [activeTxns]);

  const tooltipStyle = {
    contentStyle: {
      backgroundColor: isDark ? '#1e293b' : '#fff',
      border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
      borderRadius: '12px',
    },
  };

  return (
    <div className="pb-20">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className={`text-3xl font-extrabold tracking-tight ${isDark ? 'text-white' : 'text-dark-900'}`}>Credit Cards</h1>
          <p className={`mt-1 text-sm ${isDark ? 'text-dark-400' : 'text-dark-500'}`}>Manage accounts, statements, and utilization</p>
        </div>
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => { setIsEditMode(false); setCardForm({ account_name: '', credit_limit: '', billing_cycle_start_day: 1, due_days_after: 20, shared_limit_with: '' }); setShowAddCard(true); }} className="btn-primary flex items-center gap-2 shadow-lg shadow-primary-500/20">
          <PlusIcon className="w-5 h-5" /> Add New Card
        </motion.button>
      </div>

      {creditCards.length === 0 && !showAddCard && (
        <div className={`p-10 text-center rounded-3xl border-2 border-dashed ${isDark ? 'border-dark-700 bg-dark-800/50' : 'border-dark-300 bg-white/50'} flex flex-col items-center justify-center`}>
          <CreditCardIcon className={`w-16 h-16 mb-4 ${isDark ? 'text-dark-600' : 'text-dark-300'}`} />
          <h3 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-dark-900'}`}>No credit cards found</h3>
          <p className={`max-w-md mx-auto ${isDark ? 'text-dark-400' : 'text-dark-500'}`}>Add your credit cards to track utilization, statements, and avoid late payments.</p>
        </div>
      )}

      {/* CARD TABS */}
      {creditCards.length > 0 && (
        <div className="flex overflow-x-auto pb-4 gap-3 mb-4 snap-x hide-scrollbar">
          {creditCards.map(card => (
            <motion.button
              key={card.id}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setSelectedCardId(card.id)}
              className={`flex-shrink-0 snap-start px-6 py-3 rounded-2xl border transition-all ${
                activeCardId === card.id 
                  ? 'bg-gradient-to-r from-primary-600 to-indigo-600 text-white border-transparent shadow-xl shadow-primary-500/30' 
                  : isDark ? 'bg-dark-800 border-dark-700 text-dark-300 hover:bg-dark-700' : 'bg-white border-dark-200 text-dark-600 hover:bg-dark-50'
              }`}
            >
              <div className="font-bold">{card.account_name}</div>
              <div className={`text-xs mt-1 ${activeCardId === card.id ? 'text-primary-100' : 'opacity-70'}`}>
                ₹{parseFloat(card.liability || 0).toLocaleString('en-IN')} Due
              </div>
            </motion.button>
          ))}
        </div>
      )}

      {/* ACTIVE CARD DASHBOARD */}
      {activeCard && metrics && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          
          {/* TOP METRICS */}
          <div className="flex flex-col lg:flex-row gap-4 sm:gap-6">
            <div className={`flex-1 rounded-3xl p-8 relative overflow-hidden text-white shadow-xl shadow-indigo-500/20`}
                 style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #4338ca 100%)' }}>
              <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -translate-y-1/2 translate-x-1/3 blur-2xl" />
              
              <div className="flex justify-between items-start relative z-10">
                <div>
                  <h2 className="text-2xl font-black mb-1 drop-shadow-sm">{activeCard.account_name}</h2>
                  <p className="text-indigo-200 text-sm font-medium tracking-wide uppercase">Credit Card</p>
                </div>
                <button onClick={openEditCard} className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors backdrop-blur-md">
                  <PencilSquareIcon className="w-5 h-5 text-indigo-100" />
                </button>
              </div>

              <div className="mt-10 grid grid-cols-2 gap-8 relative z-10">
                <div>
                  <p className="text-indigo-200 text-xs font-semibold tracking-wider uppercase mb-1">
                    Outstanding (This Card)
                  </p>
                  <p className="text-4xl font-black tracking-tight drop-shadow-md">₹{metrics.balance.toLocaleString('en-IN')}</p>
                </div>
                <div>
                  <p className="text-indigo-200 text-xs font-semibold tracking-wider uppercase mb-1">
                    {metrics.isShared ? 'Shared Available Credit' : 'Available Credit'}
                  </p>
                  <p className="text-2xl font-bold tracking-tight text-white/90">₹{metrics.available.toLocaleString('en-IN')}</p>
                </div>
              </div>

              <div className="mt-8 relative z-10">
                <div className="flex justify-between text-xs font-semibold mb-2">
                  <span className="text-indigo-200">
                    {metrics.isShared ? `Shared Limit (` : `Credit Limit: `}
                    ₹{metrics.limit.toLocaleString('en-IN')}
                    {metrics.isShared ? `) • Total Used: ₹${metrics.sharedLiability.toLocaleString('en-IN')}` : ''}
                  </span>
                  <span className={metrics.utilPercent > 30 ? 'text-amber-300' : 'text-emerald-300'}>{metrics.utilPercent}% Utilized {metrics.isShared && '(Combined)'}</span>
                </div>
                <div className="h-2 w-full bg-black/30 rounded-full overflow-hidden backdrop-blur-sm">
                  <motion.div 
                    initial={{ width: 0 }} 
                    animate={{ width: `${Math.min(metrics.utilPercent, 100)}%` }} 
                    transition={{ duration: 1, ease: 'easeOut' }}
                    className={`h-full rounded-full ${metrics.utilPercent > 30 ? 'bg-gradient-to-r from-amber-400 to-amber-300' : 'bg-gradient-to-r from-emerald-400 to-emerald-300'}`} 
                  />
                </div>

              {/* ─── Credit Health Insight ─── */}
              {(() => {
                const health = calculateCreditCardHealth(activeCard, creditCards);
                const HealthIcon = health.riskLevel === 'Critical' || health.riskLevel === 'Warning'
                  ? ExclamationTriangleIcon : ShieldCheckIcon;
                return (
                  <div className="mt-6 relative z-10" style={{
                    padding: '12px 16px', borderRadius: 14,
                    background: `${health.riskColor}18`,
                    border: `1px solid ${health.riskColor}40`,
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: 10,
                      background: `${health.riskColor}25`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <HealthIcon className="w-5 h-5" style={{ color: health.riskColor }} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <span style={{ fontSize: 12, fontWeight: 800, color: health.riskColor }}>
                          {health.riskLevel}
                        </span>
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>
                          · {health.utilization.toFixed(1)}% utilization
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.75)', lineHeight: 1.4 }}>
                        {health.paymentAdvice}
                      </p>
                    </div>
                  </div>
                );
              })()}

              </div>
            </div>

            {/* BILLING CYCLES */}
            <div className={`lg:w-1/3 rounded-3xl p-6 border flex flex-col justify-between shadow-lg ${isDark ? 'bg-dark-800 border-dark-700' : 'bg-white border-dark-200'}`}>
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <BanknotesIcon className={`w-6 h-6 ${isDark ? 'text-primary-400' : 'text-primary-600'}`} />
                  <h3 className={`font-bold ${isDark ? 'text-white' : 'text-dark-900'}`}>Current Cycle</h3>
                </div>
                <div className={`text-sm font-medium mb-6 px-3 py-1.5 rounded-lg inline-block ${isDark ? 'bg-dark-700 text-dark-300' : 'bg-dark-50 text-dark-600'}`}>
                  {formatShortDate(metrics.cycle.startDate)} — {formatShortDate(metrics.cycle.endDate)}
                </div>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className={`text-sm ${isDark ? 'text-dark-400' : 'text-dark-500'}`}>Spent this cycle</span>
                    <span className={`font-bold ${isDark ? 'text-white' : 'text-dark-900'}`}>₹{metrics.cycleSpend.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className={`text-sm ${isDark ? 'text-dark-400' : 'text-dark-500'}`}>Paid this cycle</span>
                    <span className={`font-bold text-emerald-500`}>₹{metrics.cyclePaid.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

              <div className={`mt-6 pt-5 border-t ${isDark ? 'border-dark-700' : 'border-dark-100'}`}>
                <div className="flex justify-between items-end">
                  <div>
                    <p className={`text-xs font-semibold tracking-wider uppercase mb-1 ${isDark ? 'text-dark-500' : 'text-dark-400'}`}>Next Due Date</p>
                    <p className={`font-bold text-lg ${isDark ? 'text-primary-300' : 'text-primary-600'}`}>{formatShortDate(metrics.dueDate)}</p>
                  </div>
                  {metrics.balance <= 0 ? (
                    <div className="flex items-center gap-1 text-emerald-500 bg-emerald-500/10 px-3 py-1.5 rounded-full text-xs font-bold">
                      <CheckBadgeIcon className="w-4 h-4" /> Cleared
                    </div>
                  ) : (
                    <button onClick={() => setShowPayBill(true)} className="btn-primary text-sm py-1.5 px-4 shadow-md shadow-primary-500/20">Pay Bill</button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* CHARTS */}
          {categoryData.length > 0 && (
            <div className={`rounded-3xl p-6 border shadow-sm ${isDark ? 'bg-dark-800 border-dark-700' : 'bg-white border-dark-100'}`}>
              <h3 className={`font-bold text-lg mb-6 ${isDark ? 'text-white' : 'text-dark-900'}`}>Spending Breakdown</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                <div className="h-[250px] sm:h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                    <PieChart>
                      <Pie data={categoryData} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={4} dataKey="value" cornerRadius={6}>
                        {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v) => `₹${v.toLocaleString('en-IN')}`} {...tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-3">
                  {categoryData.slice(0, 5).map((cat, i) => (
                    <div key={cat.name} className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className={`text-sm font-medium ${isDark ? 'text-dark-300' : 'text-dark-700'}`}>{cat.name}</span>
                      </div>
                      <span className={`text-sm font-bold ${isDark ? 'text-white' : 'text-dark-900'}`}>₹{cat.value.toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                  {categoryData.length > 5 && (
                    <div className={`text-xs text-center mt-4 font-medium ${isDark ? 'text-dark-500' : 'text-dark-400'}`}>
                      + {categoryData.length - 5} more categories
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* CC SPENDING BUDGET SECTION */}
          {metrics && (() => {
            const cycleSpend = metrics.cycleSpend;
            const hasLimit = ccBudgetLimit > 0;
            const pct = hasLimit ? (cycleSpend / ccBudgetLimit) * 100 : 0;
            const cappedPct = Math.min(pct, 100);
            const remaining = hasLimit ? Math.max(0, ccBudgetLimit - cycleSpend) : 0;
            const budgetStatus = pct > 100
              ? { label: 'Over Budget', color: '#ef4444', bg: 'rgba(239,68,68,0.10)' }
              : pct >= 80
              ? { label: 'Warning', color: '#f59e0b', bg: 'rgba(245,158,11,0.10)' }
              : { label: 'Safe', color: '#1abf94', bg: 'rgba(26,191,148,0.08)' };

            return (
              <div className={`rounded-3xl p-6 border shadow-sm ${isDark ? 'bg-dark-800 border-dark-700' : 'bg-white border-dark-100'}`}>
                <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg, #6366f1, #4338ca)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <BanknotesIcon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className={`font-bold text-lg ${isDark ? 'text-white' : 'text-dark-900'}`}>
                        CC Spending Budget
                      </h3>
                      <p className={`text-xs ${isDark ? 'text-dark-400' : 'text-dark-500'}`}>
                        {formatShortDate(metrics.cycle.startDate)} — {formatShortDate(metrics.cycle.endDate)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasLimit && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 99, background: budgetStatus.bg, border: `1px solid ${budgetStatus.color}44` }}>
                        {pct > 100 ? <ExclamationTriangleIcon className="w-3 h-3" style={{ color: budgetStatus.color }} /> : <ShieldCheckIcon className="w-3 h-3" style={{ color: budgetStatus.color }} />}
                        <span style={{ fontSize: 11, fontWeight: 700, color: budgetStatus.color }}>{budgetStatus.label}</span>
                      </div>
                    )}
                    {ccBudgetEditing ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#6366f1' }}>₹</span>
                        <input
                          type="number" step="0.01" min="0"
                          value={ccBudgetInput}
                          onChange={e => setCcBudgetInput(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleSaveCcBudget(); if (e.key === 'Escape') setCcBudgetEditing(false); }}
                          autoFocus
                          className="input-field"
                          style={{ width: 110, fontSize: 14, fontWeight: 700, padding: '5px 10px' }}
                          placeholder="0.00"
                        />
                        <button onClick={handleSaveCcBudget} style={{ border: 'none', background: '#1abf94', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <CheckIcon className="w-4 h-4 text-white" />
                        </button>
                        <button onClick={() => setCcBudgetEditing(false)} style={{ border: 'none', background: isDark ? '#374151' : '#e5e7eb', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <XMarkIcon className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setCcBudgetInput(ccBudgetLimit > 0 ? String(ccBudgetLimit) : ''); setCcBudgetEditing(true); }}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 10, background: isDark ? '#1a2235' : '#eff6ff', border: `1px solid ${isDark ? '#252f3e' : '#bfdbfe'}`, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: isDark ? '#93c5fd' : '#1e40af', fontFamily: 'inherit' }}
                      >
                        <PencilSquareIcon className="w-3.5 h-3.5" />
                        {hasLimit ? fmt(ccBudgetLimit) : 'Set Limit'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Stats row */}
                <div className={`grid gap-3 mb-4`} style={{ gridTemplateColumns: hasLimit ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)' }}>
                  {[
                    { label: 'Spent (CC)', val: fmt(cycleSpend), color: '#ef4444' },
                    ...(hasLimit ? [
                      { label: 'Remaining', val: fmt(remaining), color: remaining === 0 ? '#ef4444' : '#1abf94' },
                      { label: 'Used', val: `${pct.toFixed(0)}%`, color: budgetStatus.color },
                    ] : [
                      { label: 'Paid Back', val: fmt(metrics.cyclePaid), color: '#1abf94' },
                    ]),
                  ].map(s => (
                    <div key={s.label} style={{ textAlign: 'center', padding: '10px 6px', background: isDark ? '#0a0e14' : '#f9fafb', borderRadius: 10 }}>
                      <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: s.color }}>{s.val}</p>
                      <p style={{ margin: '3px 0 0', fontSize: 10, color: isDark ? '#9ca3af' : '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Progress bar (only if limit is set) */}
                {hasLimit && (
                  <div>
                    <div style={{ height: 8, borderRadius: 99, background: isDark ? '#1a2235' : '#f3f4f6', overflow: 'hidden', marginBottom: 4 }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${cappedPct}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        style={{ height: '100%', borderRadius: 99, background: pct > 100 ? '#ef4444' : pct >= 80 ? '#f59e0b' : '#1abf94' }}
                      />
                    </div>
                    <div className="flex justify-between" style={{ fontSize: 10, color: isDark ? '#9ca3af' : '#6b7280' }}>
                      <span>{cappedPct.toFixed(0)}% used</span>
                      <span>Limit: {fmt(ccBudgetLimit)}</span>
                    </div>
                  </div>
                )}

                {/* Category breakdown pills for CC spending */}
                {categoryData.length > 0 && (
                  <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {categoryData.slice(0, 6).map((cat, i) => (
                      <div key={cat.name} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, background: isDark ? '#161b22' : '#f3f4f6', border: `1px solid ${isDark ? '#30363d' : '#e5e7eb'}` }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                        <span style={{ fontSize: 11, fontWeight: 600, color: isDark ? '#d1d5db' : '#374151' }}>{cat.name}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: isDark ? '#f3f4f6' : '#111827' }}>₹{cat.value.toLocaleString('en-IN')}</span>
                      </div>
                    ))}
                  </div>
                )}

                {!hasLimit && (
                  <p style={{ fontSize: 12, color: isDark ? '#9ca3af' : '#6b7280', marginTop: 8 }}>
                    Set a spending limit to track your credit card budget against a cap.
                  </p>
                )}
              </div>
            );
          })()}

          {/* ─── PAYMENT HISTORY ─── */}
          {(() => {
            const payments = activeTxns
              .filter(t => t.category === 'Credit Card Payment' && parseFloat(t.amount) > 0)
              .sort((a, b) => b.date.localeCompare(a.date))
              .slice(0, 8);
            if (payments.length === 0) return null;
            return (
              <div className={`rounded-3xl p-6 border shadow-sm ${isDark ? 'bg-dark-800 border-dark-700' : 'bg-white border-dark-100'}`}>
                <h3 className={`font-bold text-lg mb-4 ${isDark ? 'text-white' : 'text-dark-900'}`}>Payment History</h3>
                <div className="space-y-3">
                  {payments.map(p => (
                    <div key={p.id} className={`flex items-center justify-between p-3 rounded-xl ${isDark ? 'bg-dark-700/50' : 'bg-dark-50'}`}>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                          <CheckBadgeIcon className="w-4 h-4 text-emerald-500" />
                        </div>
                        <div>
                          <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-dark-900'}`}>
                            Bill Payment
                          </p>
                          <p className={`text-xs ${isDark ? 'text-dark-400' : 'text-dark-500'}`}>
                            {formatShortDate(p.date)} {p.notes && `· ${p.notes}`}
                          </p>
                        </div>
                      </div>
                      <span className="font-bold text-emerald-500">+₹{Math.abs(p.amount).toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* RECENT TRANSACTIONS */}

          <div className={`rounded-3xl border shadow-sm overflow-hidden ${isDark ? 'bg-dark-800 border-dark-700' : 'bg-white border-dark-100'}`}>
            <div className={`px-6 py-5 border-b ${isDark ? 'border-dark-700' : 'border-dark-100'} flex justify-between items-center`}>
              <h3 className={`font-bold text-lg ${isDark ? 'text-white' : 'text-dark-900'}`}>Recent Transactions</h3>
            </div>
            {activeTxns.length === 0 ? (
              <div className={`p-8 text-center ${isDark ? 'text-dark-500' : 'text-dark-400'}`}>No transactions found for this card.</div>
            ) : (
              <div className="divide-y divide-dark-100 dark:divide-dark-700">
                {activeTxns.slice(0, 10).map(txn => {
                  const isExpense = parseFloat(txn.amount) < 0;
                  return (
                    <div key={txn.id} className={`px-6 py-4 flex justify-between items-center hover:bg-dark-50 dark:hover:bg-dark-700/50 transition-colors`}>
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isExpense ? (isDark ? 'bg-dark-700 text-dark-300' : 'bg-dark-100 text-dark-600') : 'bg-emerald-500/10 text-emerald-500'}`}>
                          {isExpense ? <CreditCardIcon className="w-5 h-5" /> : <PlusIcon className="w-5 h-5" />}
                        </div>
                        <div>
                          <p className={`font-bold text-sm ${isDark ? 'text-white' : 'text-dark-900'}`}>{txn.category}</p>
                          <p className={`text-xs ${isDark ? 'text-dark-400' : 'text-dark-500'}`}>{formatShortDate(txn.date)} {txn.notes && `• ${txn.notes}`}</p>
                        </div>
                      </div>
                      <div className={`font-bold ${isExpense ? (isDark ? 'text-white' : 'text-dark-900') : 'text-emerald-500'}`}>
                        {isExpense ? '-' : '+'}₹{Math.abs(txn.amount).toLocaleString('en-IN')}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* MODAL */}
      <AnimatePresence>
        {showAddCard && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className={`w-full max-w-md rounded-3xl shadow-2xl overflow-hidden ${isDark ? 'bg-dark-800 border border-dark-700' : 'bg-white border border-dark-200'}`}>
              <div className={`px-6 py-5 border-b ${isDark ? 'border-dark-700' : 'border-dark-100'}`}>
                <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-dark-900'}`}>{isEditMode ? 'Edit Credit Card' : 'Add Credit Card'}</h3>
              </div>
              <form onSubmit={handleCardSubmit} className="p-6 space-y-4">
                <div>
                  <label className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${isDark ? 'text-dark-400' : 'text-dark-500'}`}>Card Name</label>
                  <input required value={cardForm.account_name} onChange={e => setCardForm({...cardForm, account_name: e.target.value})} className="input-field w-full" placeholder="e.g. HDFC Millennia" />
                </div>
                <div>
                  <label className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${isDark ? 'text-dark-400' : 'text-dark-500'}`}>Shared Limit With (Optional)</label>
                  <select value={cardForm.shared_limit_with} onChange={e => {
                      const val = e.target.value;
                      setCardForm(prev => ({ 
                        ...prev, 
                        shared_limit_with: val,
                        // Clear limit input if shared, wait, no, just disable below
                      }));
                    }} className="input-field w-full">
                    <option value="">— Independent Limit —</option>
                    {creditCards.filter(c => c.id !== (isEditMode ? activeCardId : null) && !c.shared_limit_with).map(c => (
                      <option key={c.id} value={c.id}>Share with {c.account_name}</option>
                    ))}
                  </select>
                </div>
                {!cardForm.shared_limit_with && (
                  <div>
                    <label className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${isDark ? 'text-dark-400' : 'text-dark-500'}`}>Credit Limit (₹)</label>
                    <input required type="number" step="0.01" min="0" value={cardForm.credit_limit} onChange={e => setCardForm({...cardForm, credit_limit: e.target.value})} className="input-field w-full" placeholder="100000.00" />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${isDark ? 'text-dark-400' : 'text-dark-500'}`}>Cycle Start Day</label>
                    <input required type="number" min="1" max="28" value={cardForm.billing_cycle_start_day} onChange={e => setCardForm({...cardForm, billing_cycle_start_day: e.target.value})} className="input-field w-full" placeholder="1-28" />
                  </div>
                  <div>
                    <label className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${isDark ? 'text-dark-400' : 'text-dark-500'}`}>Grace Period (Days)</label>
                    <input required type="number" min="0" max="45" value={cardForm.due_days_after} onChange={e => setCardForm({...cardForm, due_days_after: e.target.value})} className="input-field w-full" placeholder="20" />
                  </div>
                </div>
                <div className="flex justify-between pt-4">
                  {isEditMode && (
                    <button type="button" onClick={() => deleteCardMutation.mutate(activeCardId)} className="text-danger-500 text-sm font-bold hover:underline px-2">
                      Delete Card
                    </button>
                  )}
                  <div className="flex gap-3 ml-auto w-full md:w-auto">
                    <button type="button" onClick={() => setShowAddCard(false)} className="btn-secondary px-6">Cancel</button>
                    <button type="submit" className="btn-primary px-8 shadow-lg shadow-primary-500/20">{isEditMode ? 'Save' : 'Add Card'}</button>
                  </div>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}

        {showPayBill && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className={`w-full max-w-md rounded-3xl shadow-2xl overflow-hidden ${isDark ? 'bg-dark-800 border border-dark-700' : 'bg-white border border-dark-200'}`}>
              <div className={`px-6 py-5 border-b flex justify-between items-center ${isDark ? 'border-dark-700 bg-dark-800/80' : 'border-dark-100 bg-dark-50/50'}`}>
                <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-dark-900'}`}>Pay Credit Card Bill</h3>
              </div>
              <form onSubmit={(e) => { e.preventDefault(); payBillMutation.mutate({ ...payForm, amount: parseFloat(payForm.amount) }); }} className="p-6 space-y-4">
                <div className={`p-4 rounded-xl mb-4 ${isDark ? 'bg-indigo-900/20 border border-indigo-500/30' : 'bg-indigo-50 border border-indigo-100'}`}>
                  <p className={`text-xs font-semibold tracking-wider uppercase mb-1 ${isDark ? 'text-indigo-300' : 'text-indigo-600'}`}>Outstanding Balance</p>
                  <p className={`text-2xl font-black ${isDark ? 'text-white' : 'text-indigo-900'}`}>₹{metrics?.balance?.toLocaleString('en-IN')}</p>
                </div>
                <div>
                  <label className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${isDark ? 'text-dark-400' : 'text-dark-500'}`}>From Bank Account</label>
                  <select required value={payForm.account_id} onChange={e => setPayForm({...payForm, account_id: e.target.value})} className="input-field w-full">
                    <option value="">— Select Source Account —</option>
                    {bankAccounts.map(a => (
                      <option key={a.id} value={a.id}>{a.account_name} (₹{parseFloat(a.balance || 0).toLocaleString('en-IN')})</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${isDark ? 'text-dark-400' : 'text-dark-500'}`}>Amount</label>
                    <input required type="number" step="0.01" max={metrics?.balance || 0} value={payForm.amount} onChange={e => setPayForm({...payForm, amount: e.target.value})} className="input-field w-full" placeholder="0.00" />
                  </div>
                  <div>
                    <label className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${isDark ? 'text-dark-400' : 'text-dark-500'}`}>Date</label>
                    <input required type="date" value={payForm.date} onChange={e => setPayForm({...payForm, date: e.target.value})} className="input-field w-full" />
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setShowPayBill(false)} className="btn-secondary flex-1 py-2.5">Cancel</button>
                  <button type="submit" className="btn-primary flex-1 py-2.5 shadow-lg shadow-primary-500/20">Confirm Payment</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
