import { useState } from 'react';
import { motion } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../context/ThemeContext';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { db } from '../config/firebase';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { lendingAPI } from '../services/api';
import { PlusIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

export default function Lending() {
  const { isDark } = useTheme();
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ person_name: '', amount: '', type: 'lent', status: 'pending', date: new Date().toISOString().split('T')[0] });

  const [repayForm, setRepayForm] = useState({ id: null, amount: '' });

  const { currentUser } = useAuth();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, `users/${currentUser.uid}/lending`), orderBy('date', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setRecords(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, [currentUser]);
  const addMutation = useMutation({
    mutationFn: (data) => lendingAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lending'] });
      toast.success('Record added!'); setShowAdd(false);
      setForm({ person_name: '', amount: '', type: 'lent', status: 'pending', date: new Date().toISOString().split('T')[0] });
    },
    onError: () => toast.error('Failed')
  });

  const repayMutation = useMutation({
    mutationFn: ({ id, amount }) => lendingAPI.repay(id, amount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lending'] });
      toast.success('Repayment recorded!');
      setRepayForm({ id: null, amount: '' });
    },
    onError: () => toast.error('Failed to record repayment')
  });

  const handleAdd = (e) => {
    e.preventDefault();
    addMutation.mutate({ ...form, amount: parseFloat(form.amount) });
  };

  const handleRepay = (e, id) => {
    e.preventDefault();
    repayMutation.mutate({ id, amount: parseFloat(repayForm.amount) });
  };

  const totalLent = records.filter(r => r.type === 'lent' && r.status !== 'settled').reduce((s, r) => s + (r.amount - (r.paid_amount || 0)), 0);
  const totalBorrowed = records.filter(r => r.type === 'borrowed' && r.status !== 'settled').reduce((s, r) => s + (r.amount - (r.paid_amount || 0)), 0);

  if (loading) return <div className="flex items-center justify-center h-[60vh]"><div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" /></div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-dark-900'}`}>Lending & Borrowing</h1>
          <p className={`mt-1 ${isDark ? 'text-dark-400' : 'text-dark-500'}`}>Track money lent and borrowed</p>
        </div>
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setShowAdd(!showAdd)} className="btn-primary flex items-center gap-2">
          <PlusIcon className="w-5 h-5" /> Add Record
        </motion.button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-5">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6">
          <p className={`text-sm ${isDark ? 'text-dark-400' : 'text-dark-500'}`}>Total Lent (Pending)</p>
          <p className="text-3xl font-bold text-warning-500 mt-1">₹{totalLent.toLocaleString('en-IN')}</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-6">
          <p className={`text-sm ${isDark ? 'text-dark-400' : 'text-dark-500'}`}>Total Borrowed (Pending)</p>
          <p className="text-3xl font-bold text-danger-500 mt-1">₹{totalBorrowed.toLocaleString('en-IN')}</p>
        </motion.div>
      </div>

      {showAdd && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-6 mb-6">
          <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 items-end">
            <div><label className={`block text-sm mb-1 ${isDark ? 'text-dark-300' : 'text-dark-700'}`}>Person</label><input value={form.person_name} onChange={e => setForm({...form, person_name: e.target.value})} className="input-field" required /></div>
            <div><label className={`block text-sm mb-1 ${isDark ? 'text-dark-300' : 'text-dark-700'}`}>Amount</label><input type="number" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} className="input-field" required /></div>
            <div><label className={`block text-sm mb-1 ${isDark ? 'text-dark-300' : 'text-dark-700'}`}>Type</label><select value={form.type} onChange={e => setForm({...form, type: e.target.value})} className="input-field"><option value="lent">Lent</option><option value="borrowed">Borrowed</option></select></div>
            <div><label className={`block text-sm mb-1 ${isDark ? 'text-dark-300' : 'text-dark-700'}`}>Date</label><input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="input-field" required /></div>
            <button type="submit" className="btn-primary">Add</button>
          </form>
        </motion.div>
      )}

      <div className="glass-card p-6">
        {records.length > 0 ? (
          <div className="space-y-3">
            {records.map((r, i) => {
              const paidAmount = r.paid_amount || 0;
              const pendingAmount = r.amount - paidAmount;
              const progress = Math.min((paidAmount / r.amount) * 100, 100);

              return (
                <motion.div key={r.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className={`flex flex-col p-4 rounded-xl ${isDark ? 'bg-dark-800/50' : 'bg-dark-50'}`}>
                  <div className="flex justify-between items-start w-full">
                    <div>
                      <p className={`font-medium ${isDark ? 'text-white' : 'text-dark-900'}`}>{r.person_name}</p>
                      <p className={`text-xs ${isDark ? 'text-dark-500' : 'text-dark-400'}`}>{new Date(r.date).toLocaleDateString('en-IN')}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-1 rounded-full ${r.type === 'lent' ? 'bg-warning-500/20 text-warning-500' : 'bg-danger-500/20 text-danger-500'}`}>{r.type}</span>
                        <span className={`text-xs px-2 py-1 rounded-full ${r.status === 'settled' || r.status === 'repaid' ? 'bg-accent-500/20 text-accent-500' : r.status === 'partial' ? 'bg-primary-500/20 text-primary-500' : 'bg-dark-400/20 text-dark-400'}`}>{r.status}</span>
                      </div>
                      <div className="text-right">
                        <span className={`block font-bold mt-1 ${isDark ? 'text-white' : 'text-dark-900'}`}>₹{r.amount?.toLocaleString('en-IN')}</span>
                        {paidAmount > 0 && <span className={`text-xs block ${isDark ? 'text-dark-400' : 'text-dark-500'}`}>Paid: ₹{paidAmount.toLocaleString('en-IN')}</span>}
                      </div>
                    </div>
                  </div>

                  {r.status !== 'settled' && r.status !== 'repaid' && (
                    <div className="mt-3">
                      <div className={`w-full h-1.5 rounded-full ${isDark ? 'bg-dark-700' : 'bg-dark-200'} mb-3 overflow-hidden`}>
                        <div className={`h-full rounded-full ${r.type === 'lent' ? 'bg-warning-500' : 'bg-danger-500'}`} style={{ width: `${progress}%` }} />
                      </div>
                      {repayForm.id === r.id ? (
                        <form onSubmit={(e) => handleRepay(e, r.id)} className="flex gap-2">
                          <input type="number" value={repayForm.amount} onChange={e => setRepayForm({ ...repayForm, amount: e.target.value })} placeholder={`Max ₹${pendingAmount}`} max={pendingAmount} className="input-field py-1 text-sm flex-1" required />
                          <button type="submit" className="btn-primary py-1 px-3 text-sm">Save</button>
                          <button type="button" onClick={() => setRepayForm({ id: null, amount: '' })} className="btn-secondary py-1 px-3 text-sm">Cancel</button>
                        </form>
                      ) : (
                        <button onClick={() => setRepayForm({ id: r.id, amount: pendingAmount })} className={`text-xs font-medium py-1 px-3 rounded-lg border ${isDark ? 'border-dark-700 text-dark-300 hover:bg-dark-700' : 'border-dark-300 text-dark-600 hover:bg-dark-200'}`}>
                          Record Partial/Full Repayment
                        </button>
                      )}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        ) : <p className={`text-center py-12 ${isDark ? 'text-dark-500' : 'text-dark-400'}`}>No records yet</p>}
      </div>
    </div>
  );
}
