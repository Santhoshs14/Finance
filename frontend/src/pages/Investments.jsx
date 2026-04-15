import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../context/ThemeContext';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { db } from '../config/firebase';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import ChartCard from '../components/ChartCard';
import { mutualFundsAPI, transactionsAPI, goalsAPI } from '../services/api';
import { PlusIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import ConfirmDialog from '../components/ConfirmDialog';
import toast from 'react-hot-toast';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export default function Investments() {
  const { isDark } = useTheme();
  const queryClient = useQueryClient();
  const [showAddMF, setShowAddMF] = useState(false);
  const [editMfId, setEditMfId] = useState(null);
  const [mfForm, setMfForm] = useState({ 
    fund_name: '', average_nav: '', units: '', current_nav: '', sip_amount: '', linked_goal_id: '', account_id: '' 
  });

  const { currentUser } = useAuth();
  const { accounts } = useData();
  const [mutualFunds, setMutualFunds] = useState([]);
  const [goals, setGoals] = useState([]);
  const [mfLoading, setMfLoading] = useState(true);
  const [editingNavId, setEditingNavId] = useState(null);
  const [newNav, setNewNav] = useState('');
  const [confirmState, setConfirmState] = useState({ open: false, title: '', message: '', onConfirm: null });
  const closeConfirm = () => setConfirmState(s => ({ ...s, open: false }));

  useEffect(() => {
    if (!currentUser) return;
    const unsubMF = onSnapshot(collection(db, `users/${currentUser.uid}/mutualFunds`), (snap) => {
      setMutualFunds(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setMfLoading(false);
    });
    const unsubGoals = onSnapshot(collection(db, `users/${currentUser.uid}/goals`), (snap) => {
      setGoals(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubMF(); unsubGoals(); };
  }, [currentUser]);

  const invalidateAll = () => queryClient.invalidateQueries({ queryKey: ['mutualFunds'] });

  const handleCloseForm = () => {
    setShowAddMF(false);
    setEditMfId(null);
    setMfForm({ fund_name: '', average_nav: '', units: '', current_nav: '', sip_amount: '', linked_goal_id: '', account_id: '' });
  };

  const addMFMutation = useMutation({
    mutationFn: async (data) => {
      const investedValue = data.units * data.average_nav;
      if (data.account_id) {
        await transactionsAPI.create({ 
          amount: -investedValue, category: 'Investment', account_id: data.account_id, 
          date: new Date().toISOString().split('T')[0], payment_type: 'Transfer', 
          notes: `Investment: ${data.fund_name}` 
        });
      }
      if (data.linked_goal_id) {
        const goal = goals.find(g => g.id === data.linked_goal_id);
        if (goal) await goalsAPI.update(goal.id, { current_amount: (goal.current_amount || 0) + investedValue });
      }
      return mutualFundsAPI.create(data);
    },
    onSuccess: () => { 
      invalidateAll(); toast.success('Mutual Fund / SIP added!'); 
      handleCloseForm();
    },
    onError: () => toast.error('Failed to add fund')
  });

  const updateMFMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const oldMf = mutualFunds.find(mf => mf.id === id);
      const oldInvested = oldMf ? (oldMf.units * oldMf.average_nav) : 0;
      const newInvested = data.units * data.average_nav;
      
      const oldGoalId = oldMf?.linked_goal_id;
      const newGoalId = data.linked_goal_id;

      // Handle Linked Goal mathematics
      if (oldGoalId === newGoalId && oldGoalId) {
        const diff = newInvested - oldInvested;
        if (diff !== 0) {
          const goal = goals.find(g => g.id === oldGoalId);
          if (goal) await goalsAPI.update(goal.id, { current_amount: Math.max(0, (goal.current_amount || 0) + diff) });
        }
      } else {
        if (oldGoalId) {
          const oldGoal = goals.find(g => g.id === oldGoalId);
          if (oldGoal) await goalsAPI.update(oldGoal.id, { current_amount: Math.max(0, (oldGoal.current_amount || 0) - oldInvested) });
        }
        if (newGoalId) {
          const newGoal = goals.find(g => g.id === newGoalId);
          if (newGoal) await goalsAPI.update(newGoal.id, { current_amount: (newGoal.current_amount || 0) + newInvested });
        }
      }

      await mutualFundsAPI.update(id, data);
    },
    onSuccess: () => { 
      invalidateAll(); toast.success('Mutual Fund updated!'); 
      handleCloseForm();
    },
    onError: () => toast.error('Failed to update fund')
  });

  const deleteMFMutation = useMutation({
    mutationFn: async (id) => {
      const oldMf = mutualFunds.find(mf => mf.id === id);
      if (oldMf?.linked_goal_id) {
        const oldInvested = oldMf.units * oldMf.average_nav;
        const goal = goals.find(g => g.id === oldMf.linked_goal_id);
        if (goal) await goalsAPI.update(goal.id, { current_amount: Math.max(0, (goal.current_amount || 0) - oldInvested) });
      }
      await mutualFundsAPI.delete(id);
    },
    onSuccess: () => { invalidateAll(); toast.success('Fund deleted successfully!'); },
    onError: () => toast.error('Failed to delete fund')
  });

  const updateNavMutation = useMutation({
    mutationFn: async ({ id, current_nav }) => {
      const mf = mutualFunds.find(m => m.id === id);
      if (!mf) return;
      
      const newContribution = parseFloat((current_nav * mf.units).toFixed(2));
      
      // Update the fund with new nav AND store the exact contribution amount for this goal
      await updateDoc(doc(db, `users/${currentUser.uid}/mutualFunds/${id}`), { 
        current_nav,
        fund_contribution: newContribution  // Track exactly what this fund contributes to its goal
      });

      // Sync goal: recalculate from all funds linked to this goal
      if (mf?.linked_goal_id) {
        const goal = goals.find(g => g.id === mf.linked_goal_id);
        if (goal) {
          // Sum contributions from all OTHER funds linked to the same goal
          const otherFundsSum = mutualFunds
            .filter(f => f.id !== id && f.linked_goal_id === mf.linked_goal_id)
            .reduce((sum, f) => {
              // Use stored fund_contribution if available, else compute from current/avg nav
              const contrib = f.fund_contribution ?? ((f.current_nav || f.average_nav) * f.units);
              return sum + contrib;
            }, 0);

          // goal.current_amount may include manual deposits unrelated to this fund.
          // We track the fund's OLD contribution to remove it cleanly.
          const oldContribution = mf.fund_contribution ?? ((mf.current_nav || mf.average_nav) * mf.units);
          const manualDeposits = Math.max(0, (goal.current_amount || 0) - oldContribution - otherFundsSum);
          
          const updatedGoalAmount = parseFloat((manualDeposits + otherFundsSum + newContribution).toFixed(2));
          await goalsAPI.update(goal.id, { current_amount: updatedGoalAmount });
        }
      }
    },
    onSuccess: () => { toast.success('NAV updated! Goal synced.'); setEditingNavId(null); },
    onError: (e) => { console.error(e); toast.error('Failed to update NAV'); }
  });


  const handleAddMF = (e) => { 
    e.preventDefault(); 
    const payload = { 
      ...mfForm, 
      average_nav: parseFloat(mfForm.average_nav), 
      units: parseFloat(mfForm.units), 
      current_nav: parseFloat(mfForm.current_nav) || parseFloat(mfForm.average_nav),
      sip_amount: mfForm.sip_amount ? parseFloat(mfForm.sip_amount) : 0 
    };

    if (editMfId) {
      updateMFMutation.mutate({ id: editMfId, data: payload });
    } else {
      addMFMutation.mutate(payload);
    }
  };

  const handleSaveNav = (id) => {
    const val = parseFloat(newNav);
    if (!isNaN(val) && val > 0) updateNavMutation.mutate({ id, current_nav: val });
  };

  // Calculations
  const portfolioData = mutualFunds.map((mf, i) => ({ 
    name: mf.fund_name, value: (mf.current_nav || mf.average_nav) * mf.units, fill: COLORS[i % COLORS.length] 
  })).filter(p => p.value > 0);

  const plChartData = mutualFunds.map((mf) => {
    const invested = mf.average_nav * mf.units;
    const current = (mf.current_nav || mf.average_nav) * mf.units;
    return { name: mf.fund_name, invested, current, pl: current - invested };
  }).filter(p => p.invested > 0);

  const totalInvested = plChartData.reduce((s, f) => s + f.invested, 0);
  const totalCurrent = plChartData.reduce((s, f) => s + f.current, 0);
  const totalPL = totalCurrent - totalInvested;

  const tooltipStyle = {
    contentStyle: { backgroundColor: isDark ? '#1e293b' : '#fff', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, borderRadius: '12px' },
    itemStyle: { fontSize: '13px' }, wrapperStyle: { zIndex: 100 }
  };

  if (mfLoading) return <div className="flex items-center justify-center h-[60vh]"><div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" /></div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-dark-900'}`}>Mutual Funds & SIPs</h1>
          <p className={`mt-1 ${isDark ? 'text-dark-400' : 'text-dark-500'}`}>Simplifying your wealth creation</p>
        </div>
        <motion.button whileTap={{ scale: 0.95 }} onClick={() => { setEditMfId(null); setMfForm({ fund_name: '', average_nav: '', units: '', current_nav: '', sip_amount: '', linked_goal_id: '', account_id: '' }); setShowAddMF(!showAddMF); }} className="btn-primary flex items-center gap-2">
          <PlusIcon className="w-5 h-5" /> Add Fund / SIP
        </motion.button>
      </div>

      {showAddMF && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 mb-6 relative">
          <button onClick={handleCloseForm} className="absolute top-4 right-4 text-sm font-semibold text-gray-400 hover:text-gray-600">Close</button>
          <h3 className={`text-lg font-bold mb-4 ${isDark ? 'text-white' : 'text-dark-900'}`}>{editMfId ? 'Edit Mutual Fund' : 'New Mutual Fund / SIP'}</h3>
          <form onSubmit={handleAddMF} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div><label className={`block text-sm mb-1 ${isDark ? 'text-dark-300' : 'text-dark-700'}`}>Fund Name</label><input value={mfForm.fund_name} onChange={(e) => setMfForm({ ...mfForm, fund_name: e.target.value })} className="input-field" placeholder="e.g. Parag Parikh Flexi Cap" required /></div>
            <div><label className={`block text-sm mb-1 ${isDark ? 'text-dark-300' : 'text-dark-700'}`}>Units Owned</label><input type="number" step="0.001" value={mfForm.units} onChange={(e) => setMfForm({ ...mfForm, units: e.target.value })} className="input-field" required /></div>
            <div><label className={`block text-sm mb-1 ${isDark ? 'text-dark-300' : 'text-dark-700'}`}>Average / Buy NAV (₹)</label><input type="number" step="0.01" value={mfForm.average_nav} onChange={(e) => setMfForm({ ...mfForm, average_nav: e.target.value })} className="input-field" required /></div>
            <div><label className={`block text-sm mb-1 ${isDark ? 'text-dark-300' : 'text-dark-700'}`}>Current NAV (₹)</label><input type="number" step="0.01" value={mfForm.current_nav} onChange={(e) => setMfForm({ ...mfForm, current_nav: e.target.value })} className="input-field" placeholder="Defaults to Buy NAV" /></div>
            <div><label className={`block text-sm mb-1 ${isDark ? 'text-dark-300' : 'text-dark-700'}`}>Active SIP Amount (₹/mo)</label><input type="number" value={mfForm.sip_amount} onChange={(e) => setMfForm({ ...mfForm, sip_amount: e.target.value })} className="input-field" placeholder="0 if one-time" /></div>
            
            {!editMfId && (
              <div>
                <label className={`block text-sm mb-1 ${isDark ? 'text-dark-300' : 'text-dark-700'}`}>Pay From (Bank)</label>
                <select value={mfForm.account_id || ''} onChange={(e) => setMfForm({ ...mfForm, account_id: e.target.value })} className="input-field">
                  <option value="">External / Do not deduct</option>
                  {accounts.filter(a => a.type !== 'credit').map(a => <option key={a.id} value={a.id}>{a.bank_name}</option>)}
                </select>
              </div>
            )}
            
            <div>
              <label className={`block text-sm mb-1 ${isDark ? 'text-dark-300' : 'text-dark-700'}`}>Link to Goal</label>
              <select value={mfForm.linked_goal_id || ''} onChange={(e) => setMfForm({ ...mfForm, linked_goal_id: e.target.value })} className="input-field">
                <option value="">None</option>
                {goals.map(g => <option key={g.id} value={g.id}>{g.goal_name || g.name}</option>)}
              </select>
            </div>
            <div className={`flex items-end ${editMfId ? 'lg:col-span-1' : 'lg:col-span-4'}`}><button type="submit" className="btn-primary w-full">{editMfId ? 'Save Changes' : 'Save Investment'}</button></div>
          </form>
        </motion.div>
      )}

      {/* Summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
        {[
          { label: 'Total Invested', val: `₹${totalInvested.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, color: isDark ? 'text-blue-400' : 'text-blue-600' },
          { label: 'Current Value', val: `₹${totalCurrent.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, color: isDark ? 'text-purple-400' : 'text-purple-600' },
          { label: 'Total Return', val: `${totalPL >= 0 ? '+' : ''}₹${totalPL.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, color: totalPL >= 0 ? 'text-emerald-500' : 'text-red-500' },
          { label: 'Return %', val: totalInvested > 0 ? `${((totalPL / totalInvested) * 100).toFixed(2)}%` : '0%', color: totalPL >= 0 ? 'text-emerald-500' : 'text-red-500' },
          { label: 'Total SIP/mo', val: `₹${mutualFunds.reduce((s, mf) => s + (parseFloat(mf.sip_amount) || 0), 0).toLocaleString('en-IN')}`, color: isDark ? 'text-amber-400' : 'text-amber-600' },
        ].map((s, i) => (
          <div key={i} className="glass-card p-5 text-center">
            <p className={`text-xs uppercase tracking-wider font-semibold mb-1 ${isDark ? 'text-dark-400' : 'text-dark-500'}`}>{s.label}</p>
            <p className={`text-xl font-bold ${s.color}`}>{s.val}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6">
        <ChartCard title="Allocation">
          {portfolioData.length > 0 ? (
            <div className="h-[250px] w-full"><ResponsiveContainer><PieChart><Pie data={portfolioData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value">{portfolioData.map((e, i) => <Cell key={i} fill={e.fill} />)}</Pie><Tooltip formatter={v => `₹${v.toLocaleString('en-IN', {maximumFractionDigits:0})}`} {...tooltipStyle} /></PieChart></ResponsiveContainer></div>
          ) : <p className={`text-center py-16 ${isDark ? 'text-dark-500' : 'text-dark-400'}`}>No portfolio data</p>}
        </ChartCard>
        <ChartCard title="Performance">
          {plChartData.length > 0 ? (
            <div className="h-[250px] w-full"><ResponsiveContainer><BarChart data={plChartData}><CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#e2e8f0'} /><XAxis dataKey="name" stroke={isDark ? '#64748b' : '#94a3b8'} tick={{fontSize: 11}} /><YAxis stroke={isDark ? '#64748b' : '#94a3b8'} tick={{fontSize: 11}} /><Tooltip formatter={v => `₹${v.toLocaleString('en-IN', {maximumFractionDigits:0})}`} {...tooltipStyle} /><Bar dataKey="invested" fill="#6366f1" radius={[4, 4, 0, 0]} /><Bar dataKey="current" fill="#10b981" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
          ) : <p className={`text-center py-16 ${isDark ? 'text-dark-500' : 'text-dark-400'}`}>No performance data</p>}
        </ChartCard>
      </div>

      {/* ─── Fund P/L Comparison ─── */}
      {plChartData.length > 1 && (
        <div className="glass-card p-6 mb-6">
          <h3 className={`text-lg font-bold mb-4 ${isDark ? 'text-white' : 'text-dark-900'}`}>Fund Returns Comparison</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {plChartData
              .map(f => ({ ...f, plPct: f.invested > 0 ? (f.pl / f.invested) * 100 : 0 }))
              .sort((a, b) => b.plPct - a.plPct)
              .map((f, i, arr) => {
                const maxPct = Math.max(...arr.map(x => Math.abs(x.plPct)), 1);
                const barWidth = Math.max(Math.abs(f.plPct) / maxPct * 100, 3);
                const isBest = i === 0 && f.plPct > 0;
                const isWorst = i === arr.length - 1 && f.plPct < 0;
                return (
                  <div key={f.name} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: isDark ? '#d1d5db' : '#374151', width: 140, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {f.name}
                    </span>
                    <div style={{ flex: 1, height: 20, borderRadius: 6, background: isDark ? '#1a2235' : '#f3f4f6', overflow: 'hidden', position: 'relative' }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${barWidth}%` }}
                        transition={{ duration: 0.7, ease: 'easeOut', delay: i * 0.05 }}
                        style={{
                          height: '100%', borderRadius: 6,
                          background: f.plPct >= 0
                            ? 'linear-gradient(90deg, #1abf94, #40d9b3)'
                            : 'linear-gradient(90deg, #ef4444, #f87171)',
                        }}
                      />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, minWidth: 60, textAlign: 'right', color: f.plPct >= 0 ? '#10b981' : '#ef4444' }}>
                      {f.plPct >= 0 ? '+' : ''}{f.plPct.toFixed(2)}%
                    </span>
                    {isBest && <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 99, background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>⭐ BEST</span>}
                    {isWorst && <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 99, background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>WORST</span>}
                  </div>
                );
              })}
          </div>
        </div>
      )}

      <h3 className={`text-lg font-bold mb-4 ${isDark ? 'text-white' : 'text-dark-900'}`}>Your Funds</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {mutualFunds.map((mf, i) => {
          const invested = mf.average_nav * mf.units;
          const current = (mf.current_nav || mf.average_nav) * mf.units;
          const pl = current - invested;
          const plPct = invested > 0 ? (pl / invested) * 100 : 0;
          return (
            <motion.div key={mf.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="glass-card p-5 relative overflow-hidden">
              <div className={`absolute top-0 left-0 w-1 h-full ${pl >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`} />
              <div className="flex justify-between items-start mb-4 pl-2 group">
                <h4 className={`font-bold leading-tight pr-2 ${isDark ? 'text-white' : 'text-dark-900'}`}>{mf.fund_name}</h4>
                <div className="text-right flex-shrink-0">
                  <div className="flex gap-3 justify-end mb-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { setEditMfId(mf.id); setMfForm(mf); setShowAddMF(true); window.scrollTo(0,0); }} className="text-xs uppercase font-bold tracking-wider text-blue-500 hover:text-blue-400">Edit</button>
                    <button onClick={() => {
                      setConfirmState({
                        open: true,
                        title: 'Delete this fund?',
                        message: 'Historical ledger transactions will remain safely. This removes the fund from your portfolio.',
                        onConfirm: () => { closeConfirm(); deleteMFMutation.mutate(mf.id); },
                      });
                    }} className="text-xs uppercase font-bold tracking-wider text-red-500 hover:text-red-400">Delete</button>
                  </div>
                  <p className={`text-sm font-bold ${pl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{pl >= 0 ? '+' : ''}₹{pl.toLocaleString('en-IN', {maximumFractionDigits:0})}</p>
                  <p className={`text-[10px] ${pl >= 0 ? 'text-emerald-500/80' : 'text-red-500/80'}`}>{pl >= 0 ? '+' : ''}{plPct.toFixed(2)}%</p>
                </div>
              </div>
              <div className={`grid grid-cols-2 gap-3 text-xs pl-2 mb-4 ${isDark ? 'text-dark-300' : 'text-dark-600'}`}>
                <div><span className="opacity-70 block mb-0.5">Units</span><span className="font-semibold">{mf.units}</span></div>
                <div><span className="opacity-70 block mb-0.5">Buy NAV</span><span className="font-semibold">₹{mf.average_nav}</span></div>
                <div><span className="opacity-70 block mb-0.5">Invested</span><span className="font-semibold">₹{invested.toLocaleString('en-IN', {maximumFractionDigits:0})}</span></div>
                <div><span className="opacity-70 block mb-0.5">Current Value</span><span className="font-semibold">₹{current.toLocaleString('en-IN', {maximumFractionDigits:0})}</span></div>
              </div>
              
              <div className="pl-2 pt-3 border-t border-dashed border-gray-500/20 flex justify-between items-center">
                {mf.sip_amount > 0 ? (
                  <span className="text-xs font-semibold text-purple-500 bg-purple-500/10 px-2 py-1 rounded">SIP: ₹{mf.sip_amount}/mo</span>
                ) : <span className="text-xs text-gray-500 italic">One-time</span>}
                
                {editingNavId === mf.id ? (
                  <div className="flex gap-1 items-center justify-end flex-1 ml-4">
                    <input type="number" step="0.01" value={newNav} onChange={e => setNewNav(e.target.value)} 
                      className={`w-24 px-2 py-1 text-xs border rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500 ${isDark ? 'bg-dark-800 border-dark-600 text-white' : 'bg-white border-gray-300 text-black'}`} 
                      placeholder="NAV" autoFocus />
                    <button onClick={() => handleSaveNav(mf.id)} className="px-2 py-1 text-xs font-semibold text-white bg-primary-500 rounded-md hover:bg-primary-600">Save</button>
                    <button onClick={() => setEditingNavId(null)} className={`px-2 py-1 text-xs font-semibold rounded-md ${isDark ? 'bg-dark-700 text-white hover:bg-dark-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>X</button>
                  </div>
                ) : (
                  <button onClick={() => { setEditingNavId(mf.id); setNewNav(mf.current_nav || mf.average_nav); }} className="text-xs font-semibold text-blue-500 hover:text-blue-600 flex items-center gap-1">
                    <ArrowPathIcon className="w-3 h-3" /> Update NAV
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
        {mutualFunds.length === 0 && <div className="col-span-full text-center py-10 text-gray-500">You don't have any funds yet. Click "Add Fund" to start tracking.</div>}
      </div>

      <ConfirmDialog
        open={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        confirmLabel="Delete Fund"
        confirmColor="danger"
        onConfirm={confirmState.onConfirm}
        onCancel={closeConfirm}
      />
    </div>
  );
}
