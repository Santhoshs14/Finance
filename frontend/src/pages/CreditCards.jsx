import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { useTheme } from '../context/ThemeContext';
import { useData } from '../context/DataContext';
import ChartCard from '../components/ChartCard';
import { creditCardsAPI, calculationsAPI } from '../services/api';
import { PlusIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function CreditCards() {
  const { isDark } = useTheme();
  const queryClient = useQueryClient();
  const [showAddCard, setShowAddCard] = useState(false);
  const [showAddTxn, setShowAddTxn] = useState(false);
  const [cardForm, setCardForm] = useState({ card_name: '', credit_limit: '', billing_cycle: '', due_date: '', reward_points: '' });
  const [txnForm, setTxnForm] = useState({ credit_card_id: '', amount: '', category: '', date: new Date().toISOString().split('T')[0], notes: '' });

  const { creditCards: cards, transactions: allTxns } = useData();
  const cardsLoading = false;
  const ccTxns = useMemo(() => allTxns.filter(t => t.credit_card_id), [allTxns]);
  const txnsLoading = false;
  
  const { data: ccUtil = [], isLoading: calcLoading } = useQuery({ queryKey: ['calculations'], queryFn: async () => { try { const res = await calculationsAPI.get(); return res.data.data?.cc_utilization || []; } catch(e) { return []; } } });
  
  const loading = false;

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['creditCards'] });
    queryClient.invalidateQueries({ queryKey: ['creditCardTxns'] });
    queryClient.invalidateQueries({ queryKey: ['calculations'] });
    queryClient.invalidateQueries({ queryKey: ['insights'] });
    queryClient.invalidateQueries({ queryKey: ['transactions'] }); // since cc txns might affect overall budget
  };

  const addCardMutation = useMutation({
    mutationFn: (data) => creditCardsAPI.create(data),
    onSuccess: () => {
      invalidateAll();
      toast.success('Card added!'); setShowAddCard(false);
      setCardForm({ card_name: '', credit_limit: '', billing_cycle: '', due_date: '', reward_points: '' });
    },
    onError: () => toast.error('Failed')
  });

  const addTxnMutation = useMutation({
    mutationFn: (data) => creditCardsAPI.createTransaction(data),
    onSuccess: () => {
      invalidateAll();
      toast.success('Transaction added!'); setShowAddTxn(false);
      setTxnForm({ credit_card_id: '', amount: '', category: '', date: new Date().toISOString().split('T')[0], notes: '' });
    },
    onError: () => toast.error('Failed')
  });

  const handleAddCard = (e) => { e.preventDefault(); addCardMutation.mutate({ ...cardForm, credit_limit: parseFloat(cardForm.credit_limit), reward_points: parseFloat(cardForm.reward_points || 0) }); };
  const handleAddTxn = (e) => { e.preventDefault(); addTxnMutation.mutate({ ...txnForm, amount: parseFloat(txnForm.amount) }); };

  const spendingByCategory = ccTxns.reduce((acc, txn) => {
    const existing = acc.find((i) => i.name === txn.category);
    if (existing) existing.value += Math.abs(txn.amount);
    else acc.push({ name: txn.category || 'Other', value: Math.abs(txn.amount) });
    return acc;
  }, []);

  const tooltipStyle = {
    contentStyle: {
      backgroundColor: isDark ? '#1e293b' : '#fff',
      border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
      borderRadius: '12px',
      maxWidth: '250px',
      whiteSpace: 'normal'
    },
    wrapperStyle: { zIndex: 100 }
  };

  if (loading) return <div className="flex items-center justify-center h-[60vh]"><div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" /></div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-dark-900'}`}>Credit Cards</h1>
          <p className={`mt-1 ${isDark ? 'text-dark-400' : 'text-dark-500'}`}>Manage cards & spending</p>
        </div>
        <div className="flex gap-3">
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => setShowAddTxn(!showAddTxn)} className="btn-secondary flex items-center gap-2"><PlusIcon className="w-5 h-5" /> Add Transaction</motion.button>
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => setShowAddCard(!showAddCard)} className="btn-primary flex items-center gap-2"><PlusIcon className="w-5 h-5" /> Add Card</motion.button>
        </div>
      </div>

      {showAddCard && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 mb-6">
          <form onSubmit={handleAddCard} className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div><label className={`block text-sm mb-1 ${isDark ? 'text-dark-300' : 'text-dark-700'}`}>Card Name</label><input value={cardForm.card_name} onChange={(e) => setCardForm({ ...cardForm, card_name: e.target.value })} className="input-field" required /></div>
            <div><label className={`block text-sm mb-1 ${isDark ? 'text-dark-300' : 'text-dark-700'}`}>Credit Limit (₹)</label><input type="number" value={cardForm.credit_limit} onChange={(e) => setCardForm({ ...cardForm, credit_limit: e.target.value })} className="input-field" required /></div>
            <div><label className={`block text-sm mb-1 ${isDark ? 'text-dark-300' : 'text-dark-700'}`}>Billing Cycle</label><input value={cardForm.billing_cycle} onChange={(e) => setCardForm({ ...cardForm, billing_cycle: e.target.value })} className="input-field" placeholder="1st to 30th" /></div>
            <div><label className={`block text-sm mb-1 ${isDark ? 'text-dark-300' : 'text-dark-700'}`}>Due Date</label><input value={cardForm.due_date} onChange={(e) => setCardForm({ ...cardForm, due_date: e.target.value })} className="input-field" placeholder="15th of every month" /></div>
            <div><label className={`block text-sm mb-1 ${isDark ? 'text-dark-300' : 'text-dark-700'}`}>Reward Points</label><input type="number" value={cardForm.reward_points} onChange={(e) => setCardForm({ ...cardForm, reward_points: e.target.value })} className="input-field" /></div>
            <div className="flex items-end"><button type="submit" className="btn-primary w-full">Add Card</button></div>
          </form>
        </motion.div>
      )}

      {showAddTxn && cards.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 mb-6">
          <form onSubmit={handleAddTxn} className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div><label className={`block text-sm mb-1 ${isDark ? 'text-dark-300' : 'text-dark-700'}`}>Card</label><select value={txnForm.credit_card_id} onChange={(e) => setTxnForm({ ...txnForm, credit_card_id: e.target.value })} className="input-field" required><option value="">Select</option>{cards.map((c) => <option key={c.id} value={c.id}>{c.card_name}</option>)}</select></div>
            <div><label className={`block text-sm mb-1 ${isDark ? 'text-dark-300' : 'text-dark-700'}`}>Amount (₹)</label><input type="number" value={txnForm.amount} onChange={(e) => setTxnForm({ ...txnForm, amount: e.target.value })} className="input-field" required /></div>
            <div><label className={`block text-sm mb-1 ${isDark ? 'text-dark-300' : 'text-dark-700'}`}>Category</label><input value={txnForm.category} onChange={(e) => setTxnForm({ ...txnForm, category: e.target.value })} className="input-field" /></div>
            <div><label className={`block text-sm mb-1 ${isDark ? 'text-dark-300' : 'text-dark-700'}`}>Date</label><input type="date" value={txnForm.date} onChange={(e) => setTxnForm({ ...txnForm, date: e.target.value })} className="input-field" required /></div>
            <div><label className={`block text-sm mb-1 ${isDark ? 'text-dark-300' : 'text-dark-700'}`}>Notes</label><input value={txnForm.notes} onChange={(e) => setTxnForm({ ...txnForm, notes: e.target.value })} className="input-field" /></div>
            <div className="flex items-end"><button type="submit" className="btn-primary w-full">Add</button></div>
          </form>
        </motion.div>
      )}

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {cards.map((card, i) => {
          const util = ccUtil.find((u) => u.card_name === card.card_name);
          return (
            <motion.div key={card.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} whileHover={{ scale: 1.03, y: -5 }} className="glass-card p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-primary-500 to-accent-500 opacity-10 rounded-bl-full" />
              <h4 className={`font-bold text-lg mb-2 ${isDark ? 'text-white' : 'text-dark-900'}`}>{card.card_name}</h4>
              <p className={`text-sm mb-4 ${isDark ? 'text-dark-400' : 'text-dark-500'}`}>Limit: ₹{parseFloat(card.credit_limit).toLocaleString('en-IN')}</p>
              {util && (
                <div className="mb-3">
                  <div className="flex justify-between mb-1"><span className={`text-xs ${isDark ? 'text-dark-400' : 'text-dark-500'}`}>Utilization</span><span className={`text-xs font-semibold ${util.utilization_percentage > 75 ? 'text-danger-500' : util.utilization_percentage > 50 ? 'text-warning-500' : 'text-accent-500'}`}>{util.utilization_percentage}%</span></div>
                  <div className={`w-full h-2 rounded-full ${isDark ? 'bg-dark-700' : 'bg-dark-200'}`}><div className={`h-full rounded-full ${util.utilization_percentage > 75 ? 'bg-danger-500' : util.utilization_percentage > 50 ? 'bg-warning-500' : 'bg-accent-500'}`} style={{ width: `${Math.min(util.utilization_percentage, 100)}%` }} /></div>
                </div>
              )}
              <div className={`text-xs ${isDark ? 'text-dark-500' : 'text-dark-400'}`}>
                {card.billing_cycle && <div>Billing: {card.billing_cycle}</div>}
                {card.due_date && <div>Due: {card.due_date}</div>}
                {card.reward_points > 0 && <div>Points: {card.reward_points}</div>}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Spending Chart */}
      {spendingByCategory.length > 0 && (
        <ChartCard title="CC Spending by Category">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart><Pie data={spendingByCategory} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value">
              {spendingByCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie><Tooltip formatter={(v) => `₹${v.toLocaleString('en-IN')}`} {...tooltipStyle} /></PieChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {cards.length === 0 && <p className={`text-center py-16 ${isDark ? 'text-dark-500' : 'text-dark-400'}`}>No credit cards added yet</p>}
    </div>
  );
}
