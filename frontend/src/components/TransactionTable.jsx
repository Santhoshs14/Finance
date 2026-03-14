import { motion } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';

const categoryColors = {
  Food: 'bg-orange-500/20 text-orange-500',
  Travel: 'bg-blue-500/20 text-blue-500',
  Shopping: 'bg-pink-500/20 text-pink-500',
  Bills: 'bg-red-500/20 text-red-500',
  Entertainment: 'bg-purple-500/20 text-purple-500',
  Investment: 'bg-emerald-500/20 text-emerald-500',
  Income: 'bg-green-500/20 text-green-500',
  Rent: 'bg-amber-500/20 text-amber-500',
  Petrol: 'bg-yellow-500/20 text-yellow-600',
  Utilities: 'bg-cyan-500/20 text-cyan-500',
  Subscription: 'bg-sky-500/20 text-sky-500',
  Lending: 'bg-teal-500/20 text-teal-500',
  Gifts: 'bg-rose-500/20 text-rose-500',
  Home: 'bg-lime-500/20 text-lime-600',
  Other: 'bg-gray-500/20 text-gray-500',
};

const paymentColors = {
  'Cash': 'bg-emerald-500/15 text-emerald-600',
  'Credit Card': 'bg-purple-500/15 text-purple-600',
  'Debit Card': 'bg-blue-500/15 text-blue-600',
  'UPI': 'bg-orange-500/15 text-orange-600',
};

const paymentIcons = {
  'Cash': '💵',
  'Credit Card': '💳',
  'Debit Card': '🏧',
  'UPI': '📱',
};

export default function TransactionTable({ transactions, onEdit, onDelete }) {
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
            <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider">Notes</th>
            <th className="text-right py-3 px-4 text-xs font-semibold uppercase tracking-wider">Amount</th>
            <th className="text-right py-3 px-4 text-xs font-semibold uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((txn, i) => (
            <motion.tr
              key={txn.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: i * 0.03 }}
              className={`${isDark ? 'border-dark-800 hover:bg-dark-800/50' : 'border-dark-100 hover:bg-dark-50'} border-b transition-colors duration-200`}
            >
              <td className={`py-3 px-4 text-sm whitespace-nowrap ${isDark ? 'text-dark-300' : 'text-dark-600'}`}>
                {new Date(txn.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              </td>
              <td className="py-3 px-4">
                <div className="flex items-center flex-wrap gap-1.5">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${categoryColors[txn.category] || categoryColors.Other}`}>
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
              <td className={`py-3 px-4 text-sm ${isDark ? 'text-dark-400' : 'text-dark-500'} max-w-[180px] truncate`}>
                {txn.notes || '—'}
              </td>
              <td className={`py-3 px-4 text-sm text-right font-semibold whitespace-nowrap ${txn.amount < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                {txn.amount < 0 ? '-' : '+'}₹{Math.abs(txn.amount).toLocaleString('en-IN')}
              </td>
              <td className="py-3 px-4 text-right">
                <div className="flex gap-1.5 justify-end">
                  {onEdit && (
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
          ))}
        </tbody>
      </table>
    </div>
  );
}
