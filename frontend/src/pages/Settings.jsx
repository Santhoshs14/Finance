import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { accountsAPI, authAPI, profileAPI } from '../services/api';
import { PlusIcon, TrashIcon, PencilSquareIcon, SunIcon, MoonIcon, BellIcon, ArrowDownTrayIcon, CalendarDaysIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

export default function Settings() {
  const { isDark, toggleTheme } = useTheme();
  const { currentUser, logout } = useAuth();
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ account_name: '', account_type: 'bank', balance: '' });
  const [notifs, setNotifs] = useState({ email: true, push: false, monthlyReport: true });

  const displayName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'User';
  const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const { accounts, cycleStartDay } = useData();
  const loading = false;

  // Cycle start day state
  const [cycleDay, setCycleDay] = useState(cycleStartDay || 25);
  const [savingCycle, setSavingCycle] = useState(false);

  const handleSaveCycleDay = async () => {
    const day = parseInt(cycleDay, 10);
    if (isNaN(day) || day < 1 || day > 28) {
      toast.error('Please enter a day between 1 and 28');
      return;
    }
    setSavingCycle(true);
    try {
      await profileAPI.update({ cycleStartDay: day });
      toast.success(`Cycle start day updated to ${day}th`);
    } catch {
      toast.error('Failed to save cycle day');
    } finally {
      setSavingCycle(false);
    }
  };

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['accounts'] });
    queryClient.invalidateQueries({ queryKey: ['calculations'] });
    queryClient.invalidateQueries({ queryKey: ['insights'] });
  };

  const addMutation = useMutation({
    mutationFn: (data) => accountsAPI.create(data),
    onSuccess: () => {
      invalidateAll();
      toast.success('Account added!'); setShowAdd(false);
      setForm({ account_name: '', account_type: 'bank', balance: '' });
    },
    onError: () => toast.error('Failed to add')
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => accountsAPI.update(id, data),
    onSuccess: () => {
      invalidateAll();
      toast.success('Account updated!'); setEditId(null);
      setForm({ account_name: '', account_type: 'bank', balance: '' });
    },
    onError: () => toast.error('Failed to update')
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => accountsAPI.delete(id),
    onSuccess: () => { invalidateAll(); toast.success('Deleted'); },
    onError: () => toast.error('Failed to delete')
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editId) {
      updateMutation.mutate({ id: editId, data: { ...form, balance: parseFloat(form.balance || 0) } });
    } else {
      addMutation.mutate({ ...form, balance: parseFloat(form.balance || 0) });
    }
  };

  const handleEdit = (acc) => {
    setEditId(acc.id);
    setForm({ account_name: acc.account_name, account_type: acc.account_type, balance: acc.balance.toString() });
    setShowAdd(true);
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this account?')) {
      deleteMutation.mutate(id);
    }
  };

  // Profile update is now managed via Firebase Auth (displayName) - password reset via Firebase
  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    toast.info('To update your profile, use Firebase console or reset password via email.');
  };

  return (
    <div>
      <h1 className={`text-3xl font-bold mb-8 ${isDark ? 'text-white' : 'text-dark-900'}`}>Settings</h1>

      {/* Profile */}
      <div className="glass-card p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-dark-900'}`}>Profile</h3>
        </div>

        <AnimatePresence>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-4">
            <div style={{
              width: 60, height: 60, borderRadius: 18,
              background: 'linear-gradient(135deg, #1abf94, #107f61)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontWeight: 800, fontSize: 22, flexShrink: 0,
            }}>
              {initials}
            </div>
            <div>
              <p className={`font-bold text-lg ${isDark ? 'text-white' : 'text-dark-900'}`}>{displayName}</p>
              <p className={`text-sm ${isDark ? 'text-dark-400' : 'text-dark-500'}`}>{currentUser?.email}</p>
              <p className={`text-xs mt-1 ${isDark ? 'text-dark-600' : 'text-dark-400'}`}>UID: {currentUser?.uid?.slice(0,12)}...</p>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Financial Cycle */}
      <div className="glass-card p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <CalendarDaysIcon className="w-5 h-5 text-primary-500" />
          <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-dark-900'}`}>Financial Cycle</h3>
        </div>
        <p className={`text-sm mb-4 ${isDark ? 'text-dark-400' : 'text-dark-500'}`}>
          Set the day each month when your financial cycle resets. This affects Budgets, Transactions, and Dashboard month labels.
        </p>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <label className={`text-sm font-medium ${isDark ? 'text-dark-200' : 'text-dark-700'}`}>Cycle starts on the</label>
            <input
              type="number"
              min={1}
              max={28}
              value={cycleDay}
              onChange={e => setCycleDay(e.target.value)}
              className="input-field"
              style={{ width: 72, textAlign: 'center', fontWeight: 700 }}
            />
            <label className={`text-sm font-medium ${isDark ? 'text-dark-200' : 'text-dark-700'}`}>of every month</label>
          </div>
          <button
            onClick={handleSaveCycleDay}
            disabled={savingCycle}
            className="btn-primary text-sm"
          >
            {savingCycle ? 'Saving…' : 'Save'}
          </button>
        </div>
        <p className={`text-xs mt-3 ${isDark ? 'text-dark-600' : 'text-dark-400'}`}>
          Current setting: Cycle runs from the <strong>{cycleStartDay}th</strong> of each month to the <strong>{cycleStartDay - 1}th</strong> of the next month.
        </p>
      </div>

      {/* Theme & Notifications */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="glass-card p-6">
          <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-dark-900'}`}>Appearance</h3>
          <div className="flex items-center justify-between">
            <div>
              <p className={`font-medium ${isDark ? 'text-dark-200' : 'text-dark-700'}`}>Theme</p>
              <p className={`text-sm ${isDark ? 'text-dark-400' : 'text-dark-500'}`}>Toggle dark / light mode</p>
            </div>
            <button onClick={toggleTheme} className={`relative w-16 h-8 rounded-full transition-all ${isDark ? 'bg-primary-600' : 'bg-dark-300'}`}>
              <motion.div animate={{ x: isDark ? 32 : 0 }} className="absolute top-1 left-1 w-6 h-6 rounded-full bg-white shadow-md flex items-center justify-center">
                {isDark ? <MoonIcon className="w-3.5 h-3.5 text-primary-600" /> : <SunIcon className="w-3.5 h-3.5 text-warning-500" />}
              </motion.div>
            </button>
          </div>
        </div>

        <div className="glass-card p-6">
          <h3 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${isDark ? 'text-white' : 'text-dark-900'}`}>
            <BellIcon className="w-5 h-5 text-primary-500" /> Notifications
          </h3>
          <div className="space-y-4">
            {Object.entries({ email: 'Email Alerts', push: 'Push Notifications', monthlyReport: 'Monthly Report' }).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between">
                <span className={`text-sm font-medium ${isDark ? 'text-dark-200' : 'text-dark-700'}`}>{label}</span>
                <button onClick={() => setNotifs({...notifs, [key]: !notifs[key]})} className={`relative w-11 h-6 rounded-full transition-all ${notifs[key] ? 'bg-primary-500' : 'bg-dark-300'}`}>
                  <motion.div animate={{ x: notifs[key] ? 20 : 2 }} className="absolute top-1 left-0 w-4 h-4 rounded-full bg-white shadow-sm" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Accounts */}
      <div className="glass-card p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-dark-900'}`}>Accounts</h3>
          <button onClick={() => { setShowAdd(!showAdd); setEditId(null); setForm({ account_name: '', account_type: 'bank', balance: '' }); }} className="btn-primary flex items-center gap-2 text-sm">
            {showAdd && !editId ? 'Cancel' : <><PlusIcon className="w-4 h-4" /> Add</>}
          </button>
        </div>

        <AnimatePresence>
          {showAdd && (
            <motion.form initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 overflow-hidden">
              <input value={form.account_name} onChange={e => setForm({...form, account_name: e.target.value})} className="input-field" placeholder="Account name" required />
              <select value={form.account_type} onChange={e => setForm({...form, account_type: e.target.value})} className="input-field" required>
                {['bank','wallet','broker','cash','other'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <div className="flex gap-2">
                <input type="number" value={form.balance} onChange={e => setForm({...form, balance: e.target.value})} className="input-field" placeholder="Balance" required />
                <button type="submit" className="btn-primary px-4">{editId ? 'Update' : 'Save'}</button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        <div className="space-y-3">
          {accounts.map((acc, i) => (
            <motion.div key={acc.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }} className={`flex flex-wrap gap-4 justify-between items-center p-4 rounded-xl border ${isDark ? 'bg-dark-800/30 border-dark-700' : 'bg-dark-50 border-dark-100'}`}>
              <div>
                <p className={`font-medium ${isDark ? 'text-white' : 'text-dark-900'}`}>{acc.account_name}</p>
                <p className={`text-xs capitalize ${isDark ? 'text-dark-400' : 'text-dark-500'}`}>{acc.account_type}</p>
              </div>
              <div className="flex items-center gap-4">
                <span className={`font-bold ${isDark ? 'text-white' : 'text-dark-900'}`}>₹{parseFloat(acc.balance).toLocaleString('en-IN')}</span>
                <div className="flex items-center gap-1 border-l pl-4 border-dark-200 dark:border-dark-700">
                  <button onClick={() => handleEdit(acc)} className="p-1.5 rounded-lg text-primary-500 hover:bg-primary-500/10 transition-colors" title="Edit">
                    <PencilSquareIcon className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(acc.id)} className="p-1.5 rounded-lg text-danger-500 hover:bg-danger-500/10 transition-colors" title="Delete">
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
          {accounts.length === 0 && <p className="text-sm text-center py-4 text-dark-400">No accounts configured. Add one above.</p>}
        </div>
      </div>

      {/* Data Management */}
      <div className="glass-card p-6">
        <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-dark-900'}`}>Data Management</h3>
        <div className="flex items-center justify-between p-4 rounded-xl bg-dark-50 dark:bg-dark-800/50">
          <div>
            <p className={`font-medium ${isDark ? 'text-white' : 'text-dark-900'}`}>Export All Data</p>
            <p className={`text-sm ${isDark ? 'text-dark-400' : 'text-dark-500'}`}>Download a backup of all your financial data</p>
          </div>
          <button onClick={() => toast.success('Data export initiated. Please check your email.', { icon: '📦' })} className="btn-secondary flex items-center gap-2">
            <ArrowDownTrayIcon className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>
    </div>
  );
}
