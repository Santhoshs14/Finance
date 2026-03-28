import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useData } from '../context/DataContext';
import { useTheme } from '../context/ThemeContext';
import { 
  BanknotesIcon, CreditCardIcon, PlusIcon, 
  ArrowTrendingUpIcon, ArrowTrendingDownIcon, 
  WalletIcon, CircleStackIcon, Cog6ToothIcon, CreditCardIcon as CreditCardSolid
} from '@heroicons/react/24/outline';
import TransactionTable from '../components/TransactionTable';
import QuickAddTransaction from '../components/QuickAddTransaction';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { transactionsAPI } from '../services/api';

import { fmt } from '../utils/format';



export default function Accounts() {
  const { isDark } = useTheme();
  const queryClient = useQueryClient();
  const { accounts, creditCards, transactions, cycleStartDay } = useData();
  const [selectedAccountId, setSelectedAccountId] = useState(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  const addTxnMutation = useMutation({
    mutationFn: (data) => transactionsAPI.create(data, cycleStartDay),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['transactions'] }); },
  });

  // Separate accounts purely into Banks vs Credits
  const bankAccounts = useMemo(() => accounts.filter(a => a.type !== 'credit').sort((a, b) => (b.balance || 0) - (a.balance || 0)), [accounts]);
  const creditAccounts = useMemo(() => creditCards.sort((a, b) => (b.liability || 0) - (a.liability || 0)), [creditCards]);

  const allAccounts = useMemo(() => [...bankAccounts, ...creditAccounts], [bankAccounts, creditAccounts]);

  // Set initial selected account without side effects inside useMemo
  useEffect(() => {
    if (!selectedAccountId && allAccounts.length > 0) {
      setSelectedAccountId(allAccounts[0].id);
    }
  }, [allAccounts, selectedAccountId]);

  const selectedAccount = useMemo(() => {
    return allAccounts.find(a => a.id === selectedAccountId) || allAccounts[0] || null;
  }, [selectedAccountId, allAccounts]);

  // Derived Statistics for Selected Account
  const accountStats = useMemo(() => {
    if (!selectedAccount) return { income: 0, expense: 0, recentTxns: [], avgTxn: 0, biggestExpense: null, topCategory: null };

    const isCreditCard = selectedAccount.type === 'credit';
    const txns = transactions.filter(t => t.account_id === selectedAccount.id);

    let income = 0;
    let expense = 0;

    txns.forEach(t => {
      if (t.amount > 0) income += t.amount;
      else expense += Math.abs(t.amount);
    });

    // Avg transaction size (absolute)
    const avgTxn = txns.length > 0 ? txns.reduce((s, t) => s + Math.abs(t.amount), 0) / txns.length : 0;

    // Biggest single debit
    const debits = txns.filter(t => t.amount < 0);
    const biggestExpense = debits.length > 0
      ? debits.reduce((max, t) => Math.abs(t.amount) > Math.abs(max.amount) ? t : max, debits[0])
      : null;

    // Most active category
    const catCount = {};
    txns.forEach(t => {
      const cat = t.category || 'Other';
      catCount[cat] = (catCount[cat] || 0) + 1;
    });
    const topCategoryEntry = Object.entries(catCount).sort((a, b) => b[1] - a[1])[0];
    const topCategory = topCategoryEntry ? { name: topCategoryEntry[0], count: topCategoryEntry[1] } : null;

    return { income, expense, recentTxns: txns.slice(0, 10), avgTxn, biggestExpense, topCategory, ccOutstanding: selectedAccount.liability || 0 };
  }, [selectedAccount, transactions]);

  const textMain = isDark ? '#f3f4f6' : '#111827';
  const textSub = isDark ? '#9ca3af' : '#6b7280';
  const border = isDark ? '#374151' : '#e5e7eb';

  const renderAccountBtn = (acc, isCard) => {
    const isSelected = selectedAccountId === acc.id;
    return (
      <button 
        key={acc.id} 
        onClick={() => setSelectedAccountId(acc.id)}
        style={{ 
          display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', 
          borderRadius: 14, border: 'none', cursor: 'pointer',
          background: isSelected ? (isDark ? 'rgba(26,191,148,0.1)' : '#e6f7f2') : 'transparent',
          borderLeft: isSelected ? '4px solid #1abf94' : '4px solid transparent',
          transition: 'all 0.2s', textAlign: 'left', width: '100%'
        }}
        onMouseOver={(e) => !isSelected && (e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.03)' : '#f9fafb')}
        onMouseOut={(e) => !isSelected && (e.currentTarget.style.background = 'transparent')}
      >
        <div style={{ width: 40, height: 40, borderRadius: 12, background: isCard ? 'rgba(245,158,11,0.1)' : 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {isCard ? <CreditCardIcon style={{ width: 20, height: 20, color: '#f59e0b' }} /> : <BanknotesIcon style={{ width: 20, height: 20, color: '#3b82f6' }} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: textMain, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{acc.account_name}</p>
          <p style={{ margin: 0, fontSize: 11, color: textSub }}>{isCard ? `Limit: ${fmt(acc.credit_limit)}` : (acc.account_type || 'Bank Account')}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: isCard ? '#f59e0b' : textMain }}>{isCard ? fmt(acc.liability || 0) : fmt(acc.balance || 0)}</p>
        </div>
      </button>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: textMain, margin: '0 0 4px 0', letterSpacing: '-0.5px' }}>Accounts</h1>
          <p style={{ fontSize: 13, color: textSub, margin: 0 }}>Manage your bank accounts and credit cards</p>
        </div>
        <button onClick={() => setShowQuickAdd(true)} className="btn-primary" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <PlusIcon style={{ width: 16, height: 16 }} /> Transaction
        </button>
      </div>

      {allAccounts.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 20px', textAlign: 'center' }} className="glass-card">
          <div style={{ width: 80, height: 80, borderRadius: 24, background: isDark ? 'rgba(59,130,246,0.1)' : '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
            <WalletIcon style={{ width: 40, height: 40, color: '#3b82f6' }} />
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: textMain, margin: '0 0 12px 0' }}>No Accounts Found</h2>
          <p style={{ fontSize: 15, color: textSub, maxWidth: 400, margin: '0 0 32px 0', lineHeight: 1.6 }}>
            You haven't added any bank accounts or credit cards yet. Start by setting up your financial profile.
          </p>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, width: '100%', maxWidth: 500 }}>
            <Link 
              to="/settings" 
              style={{ 
                textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: 20, 
                borderRadius: 20, background: isDark ? 'rgba(255,255,255,0.03)' : '#f9fafb', border: `1px solid ${border}`,
                transition: 'all 0.2s',
              }}
              onMouseOver={(e) => e.currentTarget.style.borderColor = '#1abf94'}
              onMouseOut={(e) => e.currentTarget.style.borderColor = border}
            >
              <Cog6ToothIcon style={{ width: 24, height: 24, color: '#1abf94' }} />
              <span style={{ fontWeight: 700, color: textMain }}>Add Bank Account</span>
              <span style={{ fontSize: 12, color: textSub }}>Go to Settings</span>
            </Link>

            <Link 
              to="/credit-cards" 
              style={{ 
                textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: 20, 
                borderRadius: 20, background: isDark ? 'rgba(255,255,255,0.03)' : '#f9fafb', border: `1px solid ${border}`,
                transition: 'all 0.2s',
              }}
              onMouseOver={(e) => e.currentTarget.style.borderColor = '#f59e0b'}
              onMouseOut={(e) => e.currentTarget.style.borderColor = border}
            >
              <CreditCardIcon style={{ width: 24, height: 24, color: '#f59e0b' }} />
              <span style={{ fontWeight: 700, color: textMain }}>Add Credit Card</span>
              <span style={{ fontSize: 12, color: textSub }}>Credit Cards Page</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4 sm:gap-6 items-start">
          
          {/* Left Col: Account List */}
          <div className="glass-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            
            {bankAccounts.length > 0 && (
              <>
                <span style={{ fontSize: 13, fontWeight: 700, color: textSub, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '0 8px', marginTop: 8 }}>Bank Accounts</span>
                {bankAccounts.map(acc => renderAccountBtn(acc, false))}
              </>
            )}

            {creditAccounts.length > 0 && (
              <>
                <div style={{ height: 1, background: border, margin: '8px 0' }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: textSub, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '0 8px' }}>Credit Cards</span>
                {creditAccounts.map(acc => renderAccountBtn(acc, true))}
              </>
            )}

          </div>

          {/* Right Col: Account Details */}
          {selectedAccount && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              
              {/* Top Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
                <div className="glass-card" style={{ padding: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <WalletIcon style={{ width: 16, height: 16, color: '#3b82f6' }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: textSub, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {selectedAccount.type === 'credit' ? 'Outstanding Liability' : 'Available Balance'}
                    </span>
                  </div>
                  <p style={{ fontSize: 32, fontWeight: 800, color: textMain, margin: 0, letterSpacing: '-1px' }}>
                    {fmt(selectedAccount.type === 'credit' ? accountStats.ccOutstanding : selectedAccount.balance)}
                  </p>
                </div>

                <div className="glass-card" style={{ padding: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(26,191,148,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <ArrowTrendingUpIcon style={{ width: 16, height: 16, color: '#1abf94' }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: textSub, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total In</span>
                  </div>
                  <p style={{ fontSize: 24, fontWeight: 700, color: '#1abf94', margin: 0 }}>{fmt(accountStats.income)}</p>
                </div>

                <div className="glass-card" style={{ padding: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(2ef4444,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <ArrowTrendingDownIcon style={{ width: 16, height: 16, color: '#ef4444' }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: textSub, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Out</span>
                  </div>
                  <p style={{ fontSize: 24, fontWeight: 700, color: '#ef4444', margin: 0 }}>{fmt(accountStats.expense)}</p>
                </div>
              </div>

              {/* Account Analytics */}
              <div className="glass-card" style={{ padding: 24 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: textMain, margin: '0 0 20px 0' }}>Account Analytics</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Avg Transaction */}
                  <div style={{ padding: '16px', borderRadius: 14, background: isDark ? 'rgba(99,102,241,0.08)' : '#f0f0ff', border: `1px solid ${isDark ? 'rgba(99,102,241,0.2)' : '#e0e0ff'}` }}>
                    <p style={{ margin: '0 0 6px 0', fontSize: 11, fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Avg Transaction</p>
                    <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: textMain }}>{fmt(accountStats.avgTxn)}</p>
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: textSub }}>across {transactions.filter(t => t.account_id === selectedAccount.id).length} transactions</p>
                  </div>
                  {/* Biggest Expense */}
                  <div style={{ padding: '16px', borderRadius: 14, background: isDark ? 'rgba(239,68,68,0.08)' : '#fff5f5', border: `1px solid ${isDark ? 'rgba(239,68,68,0.2)' : '#fecaca'}` }}>
                    <p style={{ margin: '0 0 6px 0', fontSize: 11, fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Biggest Spend</p>
                    <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: textMain }}>{accountStats.biggestExpense ? fmt(Math.abs(accountStats.biggestExpense.amount)) : '—'}</p>
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: textSub, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{accountStats.biggestExpense ? `${accountStats.biggestExpense.category} · ${accountStats.biggestExpense.date}` : 'No debits yet'}</p>
                  </div>
                  {/* Most Active Category */}
                  <div style={{ padding: '16px', borderRadius: 14, background: isDark ? 'rgba(16,185,129,0.08)' : '#f0fdf4', border: `1px solid ${isDark ? 'rgba(16,185,129,0.2)' : '#bbf7d0'}` }}>
                    <p style={{ margin: '0 0 6px 0', fontSize: 11, fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Top Category</p>
                    <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: textMain }}>{accountStats.topCategory?.name || '—'}</p>
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: textSub }}>{accountStats.topCategory ? `${accountStats.topCategory.count} transactions` : 'No data'}</p>
                  </div>
                </div>
              </div>

              {/* Transactions */}
              <div className="glass-card" style={{ padding: 24 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: textMain, margin: '0 0 16px 0' }}>Recent Transactions</h3>
                <TransactionTable transactions={accountStats.recentTxns} />
                {accountStats.recentTxns.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '40px 0' }}>
                    <CircleStackIcon style={{ width: 40, height: 40, color: border, margin: '0 auto 12px' }} />
                    <p style={{ color: textSub, fontSize: 14 }}>No transactions found for this account.</p>
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {showQuickAdd && (
          <QuickAddTransaction 
            isOpen={showQuickAdd} 
            onClose={() => setShowQuickAdd(false)}
            onSubmit={(data) => addTxnMutation.mutate(data)}
            accounts={bankAccounts} 
            creditCards={creditCards}
            defaultAccountId={selectedAccount?.type !== 'credit' ? selectedAccount?.id : null}
            defaultCreditCardId={selectedAccount?.type === 'credit' ? selectedAccount?.id : null}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
