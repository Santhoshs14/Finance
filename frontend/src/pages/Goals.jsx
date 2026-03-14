import { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../context/ThemeContext';
import GoalCard from '../components/GoalCard';
import { goalsAPI } from '../services/api';
import { PlusIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

export default function Goals() {
  const { isDark } = useTheme();
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ goal_name: '', target_amount: '', current_amount: '', deadline: '' });

  const { data: goals = [], isLoading: loading } = useQuery({ queryKey: ['goals'], queryFn: async () => { try { const res = await goalsAPI.getAll(); return res.data.data || []; } catch(e) { return []; } } });

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

  const handleAdd = (e) => {
    e.preventDefault();
    addMutation.mutate({ ...form, target_amount: parseFloat(form.target_amount), current_amount: parseFloat(form.current_amount || 0) });
  };

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
        {goals.map((goal, i) => <GoalCard key={goal.id} goal={goal} delay={i * 0.1} />)}
      </div>
      {goals.length === 0 && <p className={`text-center py-16 ${isDark ? 'text-dark-500' : 'text-dark-400'}`}>No goals yet. Set your first financial target!</p>}
    </div>
  );
}
