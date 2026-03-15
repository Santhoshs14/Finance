import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';
import { XMarkIcon } from '@heroicons/react/24/outline';

const CATEGORIES = ['Investment','Rent','Home','Food','Travel','Petrol','Entertainment','Shopping','Bills','Utilities','Subscription','Lending','Gifts','Income','Other'];

const getLocalISODate = () => {
  const tzOffset = (new Date()).getTimezoneOffset() * 60000;
  return new Date(Date.now() - tzOffset).toISOString().split('T')[0];
};

const defaultForm = {
  date: getLocalISODate(),
  amount: '',
  category: 'Food',
  payment_type: 'Cash',
  account_id: '',
  credit_card_id: '',
  notes: '',
  is_recurring: false,
  recurrence_interval: 'monthly',
};

export default function QuickAddTransaction({ isOpen, onClose, onSubmit, accounts = [], creditCards = [], initialData = null }) {
  const { isDark } = useTheme();
  const [form, setForm] = useState(defaultForm);

  // Pre-fill form when editing an existing transaction
  useEffect(() => {
    if (initialData) {
      setForm({
        date: initialData.date || defaultForm.date,
        amount: Math.abs(initialData.amount) || '',
        category: initialData.category || 'Food',
        payment_type: initialData.payment_type || 'Cash',
        account_id: initialData.account_id || '',
        credit_card_id: initialData.credit_card_id || '',
        notes: initialData.notes || '',
        is_recurring: initialData.is_recurring || false,
        recurrence_interval: initialData.recurrence_interval || 'monthly',
      });
    } else {
      setForm(defaultForm);
    }
  }, [initialData, isOpen]);

  // When payment type changes, reset associated selection
  const handlePaymentTypeChange = (newType) => {
    setForm(prev => ({
      ...prev,
      payment_type: newType,
      account_id: newType === 'Credit Card' ? '' : prev.account_id,
      credit_card_id: newType !== 'Credit Card' ? '' : prev.credit_card_id,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const rawAmount = parseFloat(form.amount);
    // Income category → positive, everything else → negative
    const signedAmount = form.category === 'Income' ? Math.abs(rawAmount) : -Math.abs(rawAmount);
    let submitData = { ...form, amount: signedAmount };

    // Clean up unneeded field
    if (form.payment_type === 'Credit Card') {
      submitData.account_id = null;
    } else {
      submitData.credit_card_id = null;
    }
    
    if (submitData.is_recurring) {
      const d = new Date(submitData.date);
      if (submitData.recurrence_interval === 'monthly') d.setMonth(d.getMonth() + 1);
      else if (submitData.recurrence_interval === 'weekly') d.setDate(d.getDate() + 7);
      else if (submitData.recurrence_interval === 'yearly') d.setFullYear(d.getFullYear() + 1);
      submitData.next_date = d.toISOString().split('T')[0];
    } else {
      delete submitData.recurrence_interval;
      delete submitData.next_date;
    }

    onSubmit(submitData);
    setForm(defaultForm);
    onClose();
  };

  if (!isOpen) return null;

  const isEdit = !!initialData;
  const paymentType = form.payment_type;
  const showCreditCardSelector = paymentType === 'Credit Card' && creditCards.length > 0;
  const showAccountSelector = (paymentType === 'Debit Card' || paymentType === 'UPI') && accounts.length > 0;

  const label = (text) => (
    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4, color: isDark ? '#9ca3af' : '#6b7280' }}>{text}</label>
  );

  const inputStyle = { width: '100%' };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md mx-4 rounded-2xl shadow-2xl p-6 ${isDark ? 'bg-dark-900 border border-dark-700' : 'bg-white border border-dark-200'}`}
      >
        <div className="flex justify-between items-center mb-5">
          <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-dark-900'}`}>
            {isEdit ? 'Edit Transaction' : 'Quick Add Transaction'}
          </h3>
          <button onClick={onClose} className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-dark-800' : 'hover:bg-dark-100'} transition-colors`}>
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              {label('Date')}
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="input-field" style={inputStyle} required />
            </div>
            <div>
              {label('Amount (₹)')}
              <input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="input-field" style={inputStyle} placeholder="0.00" required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              {label('Category')}
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input-field" style={inputStyle}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              {label('Payment Method')}
              <select value={form.payment_type} onChange={(e) => handlePaymentTypeChange(e.target.value)} className="input-field" style={inputStyle}>
                <option value="Cash">💵 Cash</option>
                <option value="Credit Card">💳 Credit Card</option>
                <option value="Debit Card">🏦 Debit Card</option>
                <option value="UPI">📱 UPI</option>
              </select>
            </div>
          </div>

          {/* Contextual account/card selector */}
          {showCreditCardSelector && (
            <div>
              {label('Credit Card')}
              <select
                value={form.credit_card_id}
                onChange={(e) => setForm({ ...form, credit_card_id: e.target.value })}
                className="input-field"
                style={inputStyle}
                required
              >
                <option value="">— Select credit card —</option>
                {creditCards.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.card_name} (Limit: ₹{parseFloat(c.credit_limit || 0).toLocaleString('en-IN')})
                  </option>
                ))}
              </select>
            </div>
          )}

          {showAccountSelector && (
            <div>
              {label(paymentType === 'UPI' ? 'UPI Linked Account' : 'Bank Account')}
              <select
                value={form.account_id}
                onChange={(e) => setForm({ ...form, account_id: e.target.value })}
                className="input-field"
                style={inputStyle}
              >
                <option value="">— Select account —</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.account_name} (₹{parseFloat(a.balance || 0).toLocaleString('en-IN')})
                  </option>
                ))}
              </select>
            </div>
          )}

          {paymentType === 'Credit Card' && creditCards.length === 0 && (
            <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', fontSize: 12, color: '#f59e0b' }}>
              No credit cards added yet. Add cards in the Credit Cards page first.
            </div>
          )}

          <div>
            {label('Notes')}
            <input type="text" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="input-field" style={inputStyle} placeholder="Description..." />
          </div>

          {!isEdit && (
            <div className={`p-4 rounded-xl border ${isDark ? 'border-dark-700 bg-dark-800/50' : 'border-dark-200 bg-dark-50/50'}`}>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={form.is_recurring} onChange={(e) => setForm({ ...form, is_recurring: e.target.checked })} className="w-4 h-4 rounded border-dark-300" />
                <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-dark-900'}`}>Make this a recurring transaction</span>
              </label>
              
              {form.is_recurring && (
                <div className="mt-3">
                  <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-dark-400' : 'text-dark-500'}`}>Frequency</label>
                  <select value={form.recurrence_interval} onChange={(e) => setForm({ ...form, recurrence_interval: e.target.value })} className="input-field py-1.5 text-sm">
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" className="btn-primary flex-1">{isEdit ? 'Save Changes' : 'Add Transaction'}</button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
