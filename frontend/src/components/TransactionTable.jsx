import { motion } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';

const FALLBACK_COLORS = {
  Food: '#ef4444', Travel: '#3b82f6', Shopping: '#14b8a6',
  Bills: '#64748b', Entertainment: '#ec4899', Investment: '#6366f1',
  Income: '#10b981', Rent: '#f59e0b', Petrol: '#f97316',
  Utilities: '#eab308', Subscription: '#06b6d4', Lending: '#84cc16',
  Gifts: '#f43f5e', Home: '#8b5cf6', Other: '#94a3b8',
};

const paymentColors = {
  'Cash':        'bg-emerald-500/15 text-emerald-600',
  'Credit Card': 'bg-purple-500/15 text-purple-600',
  'Debit Card':  'bg-blue-500/15 text-blue-600',
  'UPI':         'bg-orange-500/15 text-orange-600',
  'Self Transfer': 'bg-gray-500/15 text-gray-400',
};

const paymentIcons = {
  'Cash': '💵', 'Credit Card': '💳', 'Debit Card': '🏧', 'UPI': '📱', 'Self Transfer': '🔄',
};

/**
 * Resolve category color from live categories list, falling back to hardcoded map.
 */
const resolveCatColor = (categoryName, categories = []) => {
  const found = categories.find(c => c.name === categoryName);
  return found?.color || FALLBACK_COLORS[categoryName] || '#94a3b8';
};

export default function TransactionTable({ transactions, onEdit, onDelete, categories = [], accounts = [], creditCards = [] }) {
  const allAccounts = [...accounts, ...creditCards];
  const resolveAccount = (accountId) => {
    if (!accountId) return null;
    return allAccounts.find(a => a.id === accountId) || null;
  };
  const { isDark } = useTheme();

  if (!transactions?.length) {
    return (
      <div className={`text-center py-12 ${isDark ? 'text-dark-500' : 'text-dark-400'}`}>
        <p className="text-lg mb-2">No transactions yet</p>
        <p className="text-sm">Add your first transaction to get started</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className={`${isDark ? 'text-dark-400 border-dark-700' : 'text-dark-500 border-dark-200'} border-b`}>
            <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider">Date</th>
            <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider">Category</th>
            <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider">Payment</th>
            <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider">Account</th>
            <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider">Notes</th>
            <th className="text-right py-3 px-4 text-xs font-semibold uppercase tracking-wider">Amount</th>
            <th className="text-right py-3 px-4 text-xs font-semibold uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((txn, i) => {
            const catColor = resolveCatColor(txn.category, categories);
            const isTransfer = txn.payment_type === 'Self Transfer' || txn.category === 'Transfer';
            const amountColor = isTransfer ? 'text-blue-500' : (txn.amount < 0 ? 'text-red-500' : 'text-emerald-500');
            const sign = isTransfer ? (txn.amount < 0 ? '↗ ' : '↘ ') : (txn.amount < 0 ? '-' : '+');
            const linkedAccount = resolveAccount(txn.account_id);
            const isCreditCard = linkedAccount && creditCards.some(c => c.id === linkedAccount.id);
            
            return (
              <motion.tr
                key={txn.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: Math.min(i * 0.03, 0.3) }}
                className={`${isDark ? 'border-dark-800 hover:bg-dark-800/50' : 'border-dark-100 hover:bg-dark-50'} border-b transition-colors duration-200`}
              >
                <td className={`py-3 px-4 text-sm whitespace-nowrap ${isDark ? 'text-dark-300' : 'text-dark-600'}`}>
                  {new Date(txn.date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center flex-wrap gap-1.5">
                    <span
                      style={{ background: `${catColor}22`, color: catColor, borderColor: `${catColor}44` }}
                      className="text-xs px-2.5 py-1 rounded-full font-medium border flex items-center gap-1.5"
                    >
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: catColor, display: 'inline-block', flexShrink: 0 }} />
                      {txn.category}
                    </span>
                    {txn.is_recurring && (
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded border ${isDark ? 'border-primary-500/50 text-primary-400' : 'border-primary-200 text-primary-600'} uppercase font-bold tracking-wider`}
                        title="Recurring Transaction"
                      >
                        ↻ {txn.recurrence_interval}
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-3 px-4">
                  {txn.payment_type ? (
                    <span className={`text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap ${paymentColors[txn.payment_type] || 'bg-gray-500/15 text-gray-600'}`}>
                      {paymentIcons[txn.payment_type] || '💰'} {txn.payment_type}
                    </span>
                  ) : (
                    <span className={`text-xs ${isDark ? 'text-dark-600' : 'text-dark-300'}`}>—</span>
                  )}
                </td>
                <td className="py-3 px-4">
                  {linkedAccount ? (
                    <span className={`text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap ${
                      isCreditCard
                        ? 'bg-purple-500/15 text-purple-600'
                        : 'bg-cyan-500/15 text-cyan-600'
                    }`}>
                      {isCreditCard ? '💳' : '🏦'} {linkedAccount.account_name}
                    </span>
                  ) : (
                    <span className={`text-xs ${isDark ? 'text-dark-600' : 'text-dark-300'}`}>—</span>
                  )}
                </td>
                <td className={`py-3 px-4 text-sm ${isDark ? 'text-dark-400' : 'text-dark-500'} max-w-[180px] truncate`}>
                  {txn.notes || '—'}
                </td>
                <td className={`py-3 px-4 text-sm text-right font-semibold whitespace-nowrap ${amountColor}`}>
                  {sign}₹{Math.abs(txn.amount).toLocaleString('en-IN')}
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="flex gap-1.5 justify-end">
                    {onEdit && !isTransfer && txn.category !== 'Credit Card Payment' && txn.category !== 'Investment' && (
                      <button
                        onClick={() => onEdit(txn)}
                        className={`text-xs px-2.5 py-1 rounded-lg ${isDark ? 'hover:bg-dark-700 text-dark-400' : 'hover:bg-dark-100 text-dark-500'} transition-colors`}
                      >
                        Edit
                      </button>
                    )}
                    {onDelete && (
                      <button
                        onClick={() => onDelete(txn.id)}
                        className="text-xs px-2.5 py-1 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </td>
              </motion.tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
