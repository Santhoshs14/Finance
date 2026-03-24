import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../context/ThemeContext';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { db } from '../config/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import GoalCard from '../components/GoalCard';
import { goalsAPI } from '../services/api';
import { PlusIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

export default function Goals() {
  const { isDark } = useTheme();
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ goal_name: '', target_amount: '', current_amount: '', deadline: '' });

  const [selectedGoal, setSelectedGoal] = useState(null);
  const [showAddFunds, setShowAddFunds] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [addFundsAmount, setAddFundsAmount] = useState('');

  const { currentUser } = useAuth();
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;
    const unsub = onSnapshot(collection(db, `users/${currentUser.uid}/goals`), (snap) => {
      setGoals(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, [currentUser]);
  const addMutation = useMutation({
    mutationFn: (data) => goalsAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      queryClient.invalidateQueries({ queryKey: ['calculations'] });
      queryClient.invalidateQueries({ queryKey: ['insights'] });
      toast.success('Goal created!');
      setShowAdd(false); setForm({ goal_name: '', target_amount: '', current_amount: '', deadline: '' });
    },
    onError: () => toast.error('Failed')
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => goalsAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      toast.success('Goal updated!');
      setShowEdit(false); setShowAddFunds(false); setSelectedGoal(null);
      setForm({ goal_name: '', target_amount: '', current_amount: '', deadline: '' });
    },
    onError: () => toast.error('Failed to update goal')
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => goalsAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      toast.success('Goal deleted!');
      setShowEdit(false); setSelectedGoal(null);
      setForm({ goal_name: '', target_amount: '', current_amount: '', deadline: '' });
    },
    onError: () => toast.error('Failed to delete goal')
  });

  const handleAdd = (e) => {
    e.preventDefault();
    addMutation.mutate({ ...form, target_amount: parseFloat(form.target_amount), current_amount: parseFloat(form.current_amount || 0) });
  };

  const handleEdit = (e) => {
    e.preventDefault();
    updateMutation.mutate({ id: selectedGoal.id, data: { ...form, target_amount: parseFloat(form.target_amount), current_amount: parseFloat(form.current_amount || 0) } });
  };

  const handleAddFunds = (e) => {
    e.preventDefault();
    const addedAmount = parseFloat(addFundsAmount);
    if (!addedAmount || addedAmount <= 0) return toast.error('Enter a valid amount');
    const newTarget = parseFloat(selectedGoal.current_amount || 0) + addedAmount;
    updateMutation.mutate({ id: selectedGoal.id, data: { current_amount: newTarget } });
  };

  const goalsWithActions = goals.map(g => ({
    ...g,
    onAddFunds: (goal) => { setSelectedGoal(goal); setShowAddFunds(true); setAddFundsAmount(''); },
    onEdit: (goal) => { setSelectedGoal(goal); setForm({ goal_name: goal.goal_name || goal.name, target_amount: goal.target_amount, current_amount: goal.current_amount, deadline: goal.deadline || '' }); setShowEdit(true); }
  }));

  if (loading) return <div className="flex items-center justify-center h-[60vh]"><div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" /></div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-dark-900'}`}>Financial Goals</h1>
          <p className={`mt-1 ${isDark ? 'text-dark-400' : 'text-dark-500'}`}>Track your financial targets</p>
        </div>
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setShowAdd(!showAdd)} className="btn-primary flex items-center gap-2">
          <PlusIcon className="w-5 h-5" /> New Goal
        </motion.button>
      </div>

      {showAdd && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 mb-6">
          <form onSubmit={handleAdd} className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div><label className={`block text-sm mb-1 ${isDark ? 'text-dark-300' : 'text-dark-700'}`}>Goal Name</label><input value={form.goal_name} onChange={(e) => setForm({ ...form, goal_name: e.target.value })} className="input-field" required placeholder="Emergency Fund" /></div>
            <div><label className={`block text-sm mb-1 ${isDark ? 'text-dark-300' : 'text-dark-700'}`}>Target (₹)</label><input type="number" value={form.target_amount} onChange={(e) => setForm({ ...form, target_amount: e.target.value })} className="input-field" required placeholder="500000" /></div>
            <div><label className={`block text-sm mb-1 ${isDark ? 'text-dark-300' : 'text-dark-700'}`}>Current (₹)</label><input type="number" value={form.current_amount} onChange={(e) => setForm({ ...form, current_amount: e.target.value })} className="input-field" placeholder="0" /></div>
            <div><label className={`block text-sm mb-1 ${isDark ? 'text-dark-300' : 'text-dark-700'}`}>Deadline</label><input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} className="input-field" required /></div>
            <div className="col-span-2 md:col-span-4"><button type="submit" className="btn-primary">Create Goal</button></div>
          </form>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {goalsWithActions.map((goal, i) => <GoalCard key={goal.id} goal={goal} delay={i * 0.1} />)}
      </div>
      {goals.length === 0 && <p className={`text-center py-16 ${isDark ? 'text-dark-500' : 'text-dark-400'}`}>No goals yet. Set your first financial target!</p>}

      {/* Edit Goal Modal */}
      {showEdit && selectedGoal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowEdit(false)}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className={`w-full max-w-md p-6 rounded-2xl ${isDark ? 'bg-dark-900 border border-dark-800' : 'bg-white shadow-xl'}`} onClick={e => e.stopPropagation()}>
            <h3 className={`text-xl font-bold mb-4 ${isDark ? 'text-white' : 'text-dark-900'}`}>Edit Goal</h3>
            <form onSubmit={handleEdit} className="space-y-4">
              <div><label className={`block text-sm mb-1 ${isDark ? 'text-dark-300' : 'text-dark-700'}`}>Goal Name</label><input value={form.goal_name} onChange={(e) => setForm({ ...form, goal_name: e.target.value })} className="input-field" required /></div>
              <div><label className={`block text-sm mb-1 ${isDark ? 'text-dark-300' : 'text-dark-700'}`}>Target (₹)</label><input type="number" value={form.target_amount} onChange={(e) => setForm({ ...form, target_amount: e.target.value })} className="input-field" required /></div>
              <div><label className={`block text-sm mb-1 ${isDark ? 'text-dark-300' : 'text-dark-700'}`}>Current (₹)</label><input type="number" value={form.current_amount} onChange={(e) => setForm({ ...form, current_amount: e.target.value })} className="input-field" required /></div>
              <div><label className={`block text-sm mb-1 ${isDark ? 'text-dark-300' : 'text-dark-700'}`}>Deadline</label><input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} className="input-field" required /></div>
              <div className="flex gap-3 pt-4">
                <button type="submit" className="flex-1 btn-primary">Save Changes</button>
                <button type="button" onClick={() => deleteMutation.mutate(selectedGoal.id)} className="px-4 py-2 font-bold text-danger-500 bg-danger-500/10 hover:bg-danger-500/20 rounded-xl transition-colors">Delete</button>
                <button type="button" onClick={() => setShowEdit(false)} className="flex-1 btn-secondary">Cancel</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Add Funds Modal */}
      {showAddFunds && selectedGoal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowAddFunds(false)}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className={`w-full max-w-sm p-6 rounded-2xl ${isDark ? 'bg-dark-900 border border-dark-800' : 'bg-white shadow-xl'}`} onClick={e => e.stopPropagation()}>
            <h3 className={`text-xl font-bold mb-4 ${isDark ? 'text-white' : 'text-dark-900'}`}>Add Funds to {selectedGoal.goal_name || selectedGoal.name}</h3>
            <form onSubmit={handleAddFunds} className="space-y-4">
              <div>
                <label className={`block text-sm mb-1 ${isDark ? 'text-dark-300' : 'text-dark-700'}`}>Amount (₹)</label>
                <input type="number" placeholder="Enter amount saved" value={addFundsAmount} onChange={(e) => setAddFundsAmount(e.target.value)} className="input-field text-xl font-bold" autoFocus required />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 btn-primary bg-primary-500">Deposit</button>
                <button type="button" onClick={() => setShowAddFunds(false)} className="flex-1 btn-secondary">Cancel</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
