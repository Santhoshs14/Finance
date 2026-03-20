import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useData } from '../context/DataContext';
import { useTheme } from '../context/ThemeContext';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { 
  BanknotesIcon, CreditCardIcon, PlusIcon, 
  ArrowTrendingUpIcon, ArrowTrendingDownIcon, 
  WalletIcon, CircleStackIcon
} from '@heroicons/react/24/outline';
import TransactionTable from '../components/TransactionTable';
import QuickAddTransaction from '../components/QuickAddTransaction';

const fmt = (n) => '₹' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n || 0);

const CustomTooltip = ({ active, payload, label, isDark }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: isDark ? '#1f2937' : '#fff', border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`, borderRadius: 10, padding: '10px 14px', fontSize: 13 }}>
      <p style={{ color: isDark ? '#9ca3af' : '#6b7280', marginBottom: 4, fontWeight: 600 }}>{label}</p>
      {payload.map((p, i) => <p key={i} style={{ color: p.color, margin: '2px 0' }}>{p.name}: {fmt(p.value)}</p>)}
    </div>
  );
};

export default function Accounts() {
  const { isDark } = useTheme();
  const { accounts, creditCards, transactions } = useData();
  const [selectedAccountId, setSelectedAccountId] = useState(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  // Combine Bank Accounts and Credit Cards for the list
  const allAccounts = useMemo(() => {
    const banks = accounts.map(a => ({ ...a, type: 'bank' }));
    const cards = creditCards.map(c => ({ ...c, type: 'credit_card', balance: 0, account_name: c.card_name })); // Credit limits are handled separately
    return [...banks, ...cards].sort((a, b) => b.balance - a.balance);
  }, [accounts, creditCards]);

  const selectedAccount = useMemo(() => {
    if (!selectedAccountId && allAccounts.length > 0) {
      setSelectedAccountId(allAccounts[0].id);
      return allAccounts[0];
    }
    return allAccounts.find(a => a.id === selectedAccountId) || allAccounts[0];
  }, [selectedAccountId, allAccounts]);

  // Derived Statistics for Selected Account
  const accountStats = useMemo(() => {
    if (!selectedAccount) return { income: 0, expense: 0, recentTxns: [], chartData: [] };

    const isCreditCard = selectedAccount.type === 'credit_card';
    const txns = transactions.filter(t => 
      isCreditCard ? t.credit_card_id === selectedAccount.id : t.account_id === selectedAccount.id
    );

    let income = 0;
    let expense = 0;
    let ccOutstanding = 0;

    txns.forEach(t => {
      if (t.amount > 0) income += t.amount;
      else {
        expense += Math.abs(t.amount);
        if (isCreditCard) ccOutstanding += Math.abs(t.amount); // Simplistic outstanding calculation
      }
    });

    // Chart Data (Last 30 days cumulative effect) - very basic mock for now
    let runningBalance = isCreditCard ? ccOutstanding : selectedAccount.balance;
    const chartData = txns.slice(0, 30).reverse().map(t => {
      if (!isCreditCard) {
        runningBalance = runningBalance - t.amount; // Reverse engineer balance
      }
      return {
        date: new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: Math.max(0, runningBalance)
      };
    }).reverse();

    if (chartData.length === 0) {
      chartData.push({ date: 'Now', value: isCreditCard ? ccOutstanding : selectedAccount.balance });
    }

    return { income, expense, recentTxns: txns.slice(0, 10), chartData, ccOutstanding };
  }, [selectedAccount, transactions]);

  const textMain = isDark ? '#f3f4f6' : '#111827';
  const textSub = isDark ? '#9ca3af' : '#6b7280';
  const border = isDark ? '#374151' : '#e5e7eb';
  const cardBg = isDark ? 'rgba(31, 41, 55, 0.4)' : '#ffffff';

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

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 320px) 1fr', gap: 24, alignItems: 'start' }}>
        
        {/* Left Col: Account List */}
        <div className="glass-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: textSub, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '0 8px' }}>Your Portfolio</span>
          
          {allAccounts.map(acc => {
            const isSelected = selectedAccountId === acc.id;
            const isCard = acc.type === 'credit_card';
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
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: isCard ? '#f59e0b' : textMain }}>{isCard ? '' : fmt(acc.balance)}</p>
                </div>
              </button>
            )
          })}
        </div>

        {/* Right Col: Account Details */}
        {selectedAccount && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            
            {/* Top Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              <div className="glass-card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <WalletIcon style={{ width: 16, height: 16, color: '#3b82f6' }} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: textSub, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {selectedAccount.type === 'credit_card' ? 'Outstanding' : 'Available Balance'}
                  </span>
                </div>
                <p style={{ fontSize: 32, fontWeight: 800, color: textMain, margin: 0, letterSpacing: '-1px' }}>
                  {fmt(selectedAccount.type === 'credit_card' ? accountStats.ccOutstanding : selectedAccount.balance)}
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

            {/* Chart */}
            <div className="glass-card" style={{ padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 600, color: textMain, margin: '0 0 4px 0' }}>Activity Timeline</h3>
                  <p style={{ fontSize: 12, color: textSub, margin: 0 }}>Recent balance fluctuations</p>
                </div>
              </div>
              <div style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={accountStats.chartData}>
                    <defs>
                      <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: textSub, fontSize: 11 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: textSub, fontSize: 11 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} width={45} />
                    <Tooltip content={<CustomTooltip isDark={isDark} />} />
                    <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorVal)" />
                  </AreaChart>
                </ResponsiveContainer>
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

      <AnimatePresence>
        {showQuickAdd && (
          <QuickAddTransaction 
            isOpen={showQuickAdd} 
            onClose={() => setShowQuickAdd(false)}
            accounts={accounts} 
            creditCards={creditCards}
            defaultAccountId={selectedAccount?.type === 'bank' ? selectedAccount.id : null}
            defaultCreditCardId={selectedAccount?.type === 'credit_card' ? selectedAccount.id : null}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
