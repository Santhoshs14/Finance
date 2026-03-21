import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';
import { XMarkIcon, SparklesIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

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
  notes: '',
  is_recurring: false,
  recurrence_interval: 'monthly',
};

const today = new Date().toISOString().split('T')[0];

/* ─── Keyword → Category suggestion map ─── */
const KEYWORD_MAP = [
  { keywords: ['swiggy','zomato','mcdonalds','kfc','pizza','burger','eat','food','restaurant','cafe','lunch','dinner','breakfast','tiffin','biryani','hotel'], category: 'Food' },
  { keywords: ['uber','ola','rapido','auto','cab','taxi','metro','bus','train','flight','petrol','diesel','fuel','toll','parkin'], category: 'Travel' },
  { keywords: ['netflix','prime','hotstar','disney','spotify','youtube','zee5','subscription','plan','monthly'], category: 'Subscription' },
  { keywords: ['amazon','flipkart','meesho','myntra','ajio','shop','buy','order','purchase','clothes','shoes'], category: 'Shopping' },
  { keywords: ['rent','landlord','flat','apartment','lease','accommodation'], category: 'Rent' },
  { keywords: ['electricity','water','bill','wifi','internet','broadband','phone','mobile','recharge','dth'], category: 'Bills' },
  { keywords: ['movie','cinema','pvr','inox','concert','event','party','fun','outing','entertainment'], category: 'Entertainment' },
  { keywords: ['salary','income','bonus','cashback','refund','dividend','freelance','payment received'], category: 'Income' },
  { keywords: ['mutual fund','sip','stocks','shares','invest','zerodha','groww','upstox','gold','fd','fixed deposit'], category: 'Investment' },
  { keywords: ['medicine','doctor','hospital','pharmacy','health','medical','pharma'], category: 'Utilities' },
  { keywords: ['lend','loan','borrow','given','received'], category: 'Lending' },
  { keywords: ['gift','present','wedding','anniversary','birthday'], category: 'Gifts' },
  { keywords: ['grocery','vegetables','milk','dmart','bigbasket','jiomart','store'], category: 'Food' },
  { keywords: ['petrol','fuel','pump','gas'], category: 'Petrol' },
];

/**
 * Given notes text, return best-matching category name or null.
 */
const suggestCategory = (notes, categoriesAvail) => {
  if (!notes || notes.trim().length < 2) return null;
  const lower = notes.toLowerCase();
  for (const entry of KEYWORD_MAP) {
    if (entry.keywords.some(kw => lower.includes(kw))) {
      // Verify the suggested category exists in user's categories
      const exists = categoriesAvail.some(c => c.name === entry.category);
      if (exists) return entry.category;
    }
  }
  return null;
};

export default function QuickAddTransaction({
  isOpen, onClose, onSubmit,
  accounts = [], creditCards = [], categories = [], initialData = null,
}) {
  const { isDark } = useTheme();
  const [form, setForm] = useState(defaultForm);
  const [suggestion, setSuggestion] = useState(null); // suggested category name

  // Pre-fill form when editing
  useEffect(() => {
    if (initialData) {
      setForm({
        date:                initialData.date || defaultForm.date,
        amount:              Math.abs(initialData.amount) || '',
        category:            initialData.category || 'Food',
        payment_type:        initialData.payment_type || 'Cash',
        account_id:          initialData.account_id || initialData.credit_card_id || '',
        notes:               initialData.notes || '',
        is_recurring:        initialData.is_recurring || false,
        recurrence_interval: initialData.recurrence_interval || 'monthly',
      });
    } else {
      setForm(defaultForm);
    }
    setSuggestion(null);
  }, [initialData, isOpen]);

  // Smart suggest on notes change
  const handleNotesChange = (val) => {
    setForm(prev => ({ ...prev, notes: val }));
    const suggested = suggestCategory(val, categories);
    if (suggested && suggested !== form.category) {
      setSuggestion(suggested);
    } else {
      setSuggestion(null);
    }
  };

  const handlePaymentTypeChange = (newType) => {
    setForm(prev => ({
      ...prev,
      payment_type: newType,
      account_id: '',
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (form.date > today) {
      toast.error('Future dates are not allowed for transactions.');
      return;
    }

    const rawAmount = parseFloat(form.amount);
    if (isNaN(rawAmount) || rawAmount <= 0) {
      toast.error('Amount must be a positive number.');
      return;
    }

    const signedAmount = form.category === 'Income' ? Math.abs(rawAmount) : -Math.abs(rawAmount);
    let submitData = { ...form, amount: signedAmount };
    delete submitData.credit_card_id; // Clean legacy field if exists

    if (submitData.is_recurring) {
      const d = new Date(submitData.date);
      if (submitData.recurrence_interval === 'monthly')  d.setMonth(d.getMonth() + 1);
      else if (submitData.recurrence_interval === 'weekly')  d.setDate(d.getDate() + 7);
      else if (submitData.recurrence_interval === 'yearly')  d.setFullYear(d.getFullYear() + 1);
      submitData.next_date = d.toISOString().split('T')[0];
    } else {
      delete submitData.recurrence_interval;
      delete submitData.next_date;
    }

    onSubmit(submitData);
    setForm(defaultForm);
    setSuggestion(null);
    onClose();
  };

  if (!isOpen) return null;

  const isEdit = !!initialData;
  const paymentType = form.payment_type;
  const showCreditCardSelector = paymentType === 'Credit Card' && creditCards.length > 0;
  const showAccountSelector    = (paymentType === 'Debit Card' || paymentType === 'UPI') && accounts.length > 0;

  const label = (text) => (
    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4, color: isDark ? '#9ca3af' : '#6b7280' }}>{text}</label>
  );

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
        style={{ maxHeight: '90vh', overflowY: 'auto' }}
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
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="input-field" style={{ width: '100%' }} max={today} required />
            </div>
            <div>
              {label('Amount (₹)')}
              <input type="number" step="0.01" value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="input-field" style={{ width: '100%' }} placeholder="0.00" min="0.01" required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              {label('Category')}
              <select value={form.category} onChange={(e) => { setForm({ ...form, category: e.target.value }); setSuggestion(null); }}
                className="input-field" style={{ width: '100%' }}>
                {categories.length > 0
                  ? categories.map((c) => <option key={c.id || c.name} value={c.name}>{c.name}</option>)
                  : ['Food','Income','Other'].map(c => <option key={c} value={c}>{c}</option>)
                }
              </select>
            </div>
            <div>
              {label('Payment Method')}
              <select value={form.payment_type} onChange={(e) => handlePaymentTypeChange(e.target.value)}
                className="input-field" style={{ width: '100%' }}>
                <option value="Cash">💵 Cash</option>
                <option value="Credit Card">💳 Credit Card</option>
                <option value="Debit Card">🏦 Debit Card</option>
                <option value="UPI">📱 UPI</option>
              </select>
            </div>
          </div>

          {showCreditCardSelector && (
            <div>
              {label('Credit Card')}
              <select value={form.account_id} onChange={(e) => setForm({ ...form, account_id: e.target.value })}
                className="input-field" style={{ width: '100%' }} required>
                <option value="">— Select credit card —</option>
                {creditCards.map((c) => (
                  <option key={c.id} value={c.id}>{c.account_name} (Limit: ₹{parseFloat(c.credit_limit || 0).toLocaleString('en-IN')})</option>
                ))}
              </select>
            </div>
          )}

          {showAccountSelector && (
            <div>
              {label(paymentType === 'UPI' ? 'UPI Linked Account' : 'Bank Account')}
              <select value={form.account_id} onChange={(e) => setForm({ ...form, account_id: e.target.value })}
                className="input-field" style={{ width: '100%' }}>
                <option value="">— Select account —</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.account_name} (₹{parseFloat(a.balance || 0).toLocaleString('en-IN')})</option>
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
            <input type="text" value={form.notes}
              onChange={(e) => handleNotesChange(e.target.value)}
              className="input-field" style={{ width: '100%' }} placeholder="Description (e.g. Swiggy order, Uber ride...)" />

            {/* Smart suggestion chip */}
            {suggestion && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <SparklesIcon style={{ width: 12, height: 12, color: '#8b5cf6', flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: isDark ? '#9ca3af' : '#6b7280' }}>Suggested:</span>
                <button
                  type="button"
                  onClick={() => { setForm(prev => ({ ...prev, category: suggestion })); setSuggestion(null); }}
                  style={{
                    fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 99,
                    background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.4)',
                    color: '#8b5cf6', cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  ✨ {suggestion}
                </button>
              </motion.div>
            )}
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
