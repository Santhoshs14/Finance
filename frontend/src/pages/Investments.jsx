import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../context/ThemeContext';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { db } from '../config/firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import ChartCard from '../components/ChartCard';
import { investmentsAPI, mutualFundsAPI, transactionsAPI, goalsAPI } from '../services/api';
import { calculateInvestmentPL, calculateSIPGrowth } from '../utils/calculations';
import { PlusIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
const TYPES = ['stocks', 'crypto', 'gold', 'fd', 'ppf'];

export default function Investments() {
  const { isDark } = useTheme();
  const queryClient = useQueryClient();
  const [showAddInv, setShowAddInv] = useState(false);
  const [showAddMF, setShowAddMF] = useState(false);
  const [showAddSIP, setShowAddSIP] = useState(false);
  const [invForm, setInvForm] = useState({ investment_type: 'stocks', name: '', symbol: '', quantity: '', buy_price: '', current_price: '', linked_goal_id: '', account_id: '' });
  const [mfForm, setMfForm] = useState({ fund_name: '', nav: '', units: '', sip_amount: '', investment_date: new Date().toISOString().split('T')[0], linked_goal_id: '', account_id: '' });
  const [sipForm, setSipForm] = useState({ fund_id: '', monthly_amount: '', start_date: new Date().toISOString().split('T')[0] });
  const [tab, setTab] = useState('investments');

  const { currentUser } = useAuth();
  const { goals, accounts } = useData();
  const [investments, setInvestments] = useState([]);
  const [mutualFunds, setMutualFunds] = useState([]);
  const [sips, setSips] = useState([]);

  const [invLoading, setInvLoading] = useState(true);
  const [mfLoading, setMfLoading] = useState(true);
  const [sipLoading, setSipLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;
    const uid = currentUser.uid;

    const unsubInv = onSnapshot(collection(db, `users/${uid}/investments`), (snap) => {
      setInvestments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setInvLoading(false);
    });

    const unsubMF = onSnapshot(collection(db, `users/${uid}/mutual_funds`), (snap) => {
      setMutualFunds(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setMfLoading(false);
    });

    const unsubSIP = onSnapshot(collection(db, `users/${uid}/sips`), (snap) => {
      setSips(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setSipLoading(false);
    });

    return () => { unsubInv(); unsubMF(); unsubSIP(); };
  }, [currentUser]);
  const loading = invLoading || mfLoading || sipLoading;

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['investments'] });
    queryClient.invalidateQueries({ queryKey: ['mutualFunds'] });
    queryClient.invalidateQueries({ queryKey: ['sips'] });
  };

  const addInvMutation = useMutation({
    mutationFn: async (data) => {
      const amount = data.quantity * data.buy_price;
      if (data.account_id) {
        await transactionsAPI.create({ amount: -amount, category: 'Investment', account_id: data.account_id, date: new Date().toISOString().split('T')[0], payment_type: 'Transfer', notes: `Purchased ${data.name}` });
      }
      if (data.linked_goal_id) {
        const goal = goals.find(g => g.id === data.linked_goal_id);
        if (goal) await goalsAPI.update(goal.id, { current_amount: (goal.current_amount || 0) + amount });
      }
      return investmentsAPI.create(data);
    },
    onSuccess: () => { invalidateAll(); toast.success('Investment added!'); setShowAddInv(false); setInvForm({ investment_type: 'stocks', name: '', symbol: '', quantity: '', buy_price: '', current_price: '', linked_goal_id: '', account_id: '' }); },
    onError: () => toast.error('Failed to add investment')
  });

  const syncMutation = useMutation({
    mutationFn: () => investmentsAPI.sync(),
    onSuccess: () => { invalidateAll(); toast.success('Live prices synced!'); },
    onError: () => toast.error('Sync failed')
  });

  const addMFMutation = useMutation({
    mutationFn: async (data) => {
      const amount = data.units * data.nav;
      if (data.account_id) {
        await transactionsAPI.create({ amount: -amount, category: 'Investment', account_id: data.account_id, date: data.investment_date || new Date().toISOString().split('T')[0], payment_type: 'Transfer', notes: `Purchased MF: ${data.fund_name}` });
      }
      if (data.linked_goal_id) {
        const goal = goals.find(g => g.id === data.linked_goal_id);
        if (goal) await goalsAPI.update(goal.id, { current_amount: (goal.current_amount || 0) + amount });
      }
      return mutualFundsAPI.create(data);
    },
    onSuccess: () => { invalidateAll(); toast.success('Mutual fund added!'); setShowAddMF(false); setMfForm({ fund_name: '', nav: '', units: '', sip_amount: '', investment_date: new Date().toISOString().split('T')[0], linked_goal_id: '', account_id: '' }); },
    onError: () => toast.error('Failed to add MF')
  });

  const addSIPMutation = useMutation({
    mutationFn: (data) => mutualFundsAPI.createSIP(data),
    onSuccess: () => { invalidateAll(); toast.success('SIP plan added!'); setShowAddSIP(false); },
    onError: () => toast.error('Failed')
  });

  const handleAddInvestment = (e) => { e.preventDefault(); addInvMutation.mutate({ ...invForm, quantity: parseFloat(invForm.quantity), buy_price: parseFloat(invForm.buy_price), current_price: parseFloat(invForm.current_price) }); };
  const handleAddMF = (e) => { e.preventDefault(); addMFMutation.mutate({ ...mfForm, nav: parseFloat(mfForm.nav), units: parseFloat(mfForm.units), sip_amount: mfForm.sip_amount ? parseFloat(mfForm.sip_amount) : 0 }); };
  const handleAddSIP = (e) => { e.preventDefault(); addSIPMutation.mutate({ ...sipForm, monthly_amount: parseFloat(sipForm.monthly_amount) }); };

  const plData = calculateInvestmentPL(investments);
  const portfolioData = investments.map((inv, i) => ({ name: inv.name, value: (inv.current_price * inv.quantity) || inv.current_value || inv.value || 0, fill: COLORS[i % COLORS.length] }));
  const plChartData = plData.map((inv) => ({ name: inv.name, invested: inv.invested, current: inv.current_value, pl: inv.profit_loss }));

  const sipProjections = sips.map(sip => ({
    monthly_amount: sip.monthly_amount,
    projection_5yr: calculateSIPGrowth(sip.monthly_amount, 12, 5),
    projection_10yr: calculateSIPGrowth(sip.monthly_amount, 12, 10),
    projection_20yr: calculateSIPGrowth(sip.monthly_amount, 12, 20)
  }));

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
          <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-dark-900'}`}>Investments</h1>
          <p className={`mt-1 ${isDark ? 'text-dark-400' : 'text-dark-500'}`}>Track your portfolio</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {['investments', 'mutual-funds', 'sip-plans'].map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab === t ? 'bg-primary-600 text-white shadow-lg' : isDark ? 'bg-dark-800 text-dark-400 hover:bg-dark-700' : 'bg-dark-100 text-dark-600 hover:bg-dark-200'}`}>
            {t === 'investments' ? 'Investments' : t === 'mutual-funds' ? 'Mutual Funds' : 'SIP Plans'}
          </button>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-5">
        <ChartCard title="Portfolio Allocation">
          {portfolioData.length > 0 ? (
            <div className="h-[250px] sm:h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                <PieChart><Pie data={portfolioData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value">
                  {portfolioData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Pie><Tooltip formatter={(v) => `₹${v.toLocaleString('en-IN')}`} {...tooltipStyle} /></PieChart>
              </ResponsiveContainer>
            </div>
          ) : <p className={`text-center py-16 ${isDark ? 'text-dark-500' : 'text-dark-400'}`}>No investments yet</p>}
        </ChartCard>

        <ChartCard title="Profit / Loss">
          {plChartData.length > 0 ? (
            <div className="h-[250px] sm:h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                <BarChart data={plChartData}><CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#e2e8f0'} />
                  <XAxis dataKey="name" stroke={isDark ? '#64748b' : '#94a3b8'} /><YAxis stroke={isDark ? '#64748b' : '#94a3b8'} />
                  <Tooltip formatter={(v) => `₹${v.toLocaleString('en-IN')}`} {...tooltipStyle} />
                  <Bar dataKey="invested" fill="#6366f1" radius={[4, 4, 0, 0]} /><Bar dataKey="current" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <p className={`text-center py-16 ${isDark ? 'text-dark-500' : 'text-dark-400'}`}>No P/L data</p>}
        </ChartCard>
      </div>

      {/* Tab Content */}
      {tab === 'investments' && (
        <div>
          <div className="flex flex-wrap justify-end gap-3 mb-4">
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending} className="btn-secondary flex items-center gap-2">
              <svg className={`w-4 h-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              {syncMutation.isPending ? 'Syncing...' : 'Sync Live Prices'}
            </motion.button>
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => setShowAddInv(!showAddInv)} className="btn-primary flex items-center gap-2"><PlusIcon className="w-5 h-5" /> Add Investment</motion.button>
          </div>
          {showAddInv && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 mb-6">
              <form onSubmit={handleAddInvestment} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div><label className={`block text-sm mb-1 ${isDark ? 'text-dark-300' : 'text-dark-700'}`}>Type</label><select value={invForm.investment_type} onChange={(e) => setInvForm({ ...invForm, investment_type: e.target.value })} className="input-field">{TYPES.map((t) => <option key={t} value={t}>{t.toUpperCase()}</option>)}</select></div>
                <div><label className={`block text-sm mb-1 ${isDark ? 'text-dark-300' : 'text-dark-700'}`}>Name</label><input value={invForm.name} onChange={(e) => setInvForm({ ...invForm, name: e.target.value })} className="input-field" required /></div>
                {invForm.investment_type === 'stocks' && <div><label className={`block text-sm mb-1 ${isDark ? 'text-dark-300' : 'text-dark-700'}`}>Ticker Symbol (Optional)</label><input value={invForm.symbol} onChange={(e) => setInvForm({ ...invForm, symbol: e.target.value })} className="input-field" placeholder="AAPL, TSLA..." /></div>}
                <div><label className={`block text-sm mb-1 ${isDark ? 'text-dark-300' : 'text-dark-700'}`}>Quantity</label><input type="number" step="0.01" value={invForm.quantity} onChange={(e) => setInvForm({ ...invForm, quantity: e.target.value })} className="input-field" required /></div>
                <div><label className={`block text-sm mb-1 ${isDark ? 'text-dark-300' : 'text-dark-700'}`}>Buy Price (₹)</label><input type="number" step="0.01" value={invForm.buy_price} onChange={(e) => setInvForm({ ...invForm, buy_price: e.target.value })} className="input-field" required /></div>
                <div><label className={`block text-sm mb-1 ${isDark ? 'text-dark-300' : 'text-dark-700'}`}>Current Price (₹)</label><input type="number" step="0.01" value={invForm.current_price} onChange={(e) => setInvForm({ ...invForm, current_price: e.target.value })} className="input-field" placeholder="Fallback if API fails" required /></div>
                <div>
                  <label className={`block text-sm mb-1 ${isDark ? 'text-dark-300' : 'text-dark-700'}`}>Pay From (Bank)</label>
                  <select value={invForm.account_id} onChange={(e) => setInvForm({ ...invForm, account_id: e.target.value })} className="input-field">
                    <option value="">External / Do not deduct</option>
                    {accounts.filter(a => a.type !== 'credit').map(a => <option key={a.id} value={a.id}>{a.bank_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={`block text-sm mb-1 ${isDark ? 'text-dark-300' : 'text-dark-700'}`}>Link to Goal</label>
                  <select value={invForm.linked_goal_id} onChange={(e) => setInvForm({ ...invForm, linked_goal_id: e.target.value })} className="input-field">
                    <option value="">None</option>
                    {goals.map(g => <option key={g.id} value={g.id}>{g.goal_name || g.name}</option>)}
                  </select>
                </div>
                <div className="flex items-end lg:col-span-4"><button type="submit" className="btn-primary w-full">Add Investment</button></div>
              </form>
            </motion.div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {investments.map((inv, i) => {
              const pl = (inv.current_price - inv.buy_price) * inv.quantity;
              return (
                <motion.div key={inv.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} whileHover={{ scale: 1.02 }} className="glass-card p-5">
                  <div className="flex justify-between items-start mb-3">
                    <div><h4 className={`font-semibold ${isDark ? 'text-white' : 'text-dark-900'}`}>{inv.name}</h4><span className={`text-xs uppercase ${isDark ? 'text-dark-500' : 'text-dark-400'}`}>{inv.investment_type}</span></div>
                    <span className={`text-sm font-bold ${pl >= 0 ? 'text-accent-500' : 'text-danger-500'}`}>{pl >= 0 ? '+' : ''}₹{pl.toLocaleString('en-IN')}</span>
                  </div>
                  <div className={`grid grid-cols-2 gap-2 text-sm ${isDark ? 'text-dark-400' : 'text-dark-500'}`}>
                    <div>Buy: ₹{inv.buy_price}</div><div>Current: ₹{inv.current_price}</div>
                    <div>Qty: {inv.quantity}</div><div>Value: ₹{(inv.current_price * inv.quantity).toLocaleString('en-IN')}</div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'mutual-funds' && (
        <div>
          <div className="flex justify-end mb-4">
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => setShowAddMF(!showAddMF)} className="btn-primary flex items-center gap-2"><PlusIcon className="w-5 h-5" /> Add Fund</motion.button>
          </div>
          {showAddMF && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 mb-6">
              <form onSubmit={handleAddMF} className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div><label className={`block text-sm mb-1 ${isDark ? 'text-dark-300' : 'text-dark-700'}`}>Fund Name</label><input value={mfForm.fund_name} onChange={(e) => setMfForm({ ...mfForm, fund_name: e.target.value })} className="input-field" required /></div>
                <div><label className={`block text-sm mb-1 ${isDark ? 'text-dark-300' : 'text-dark-700'}`}>NAV (₹)</label><input type="number" step="0.01" value={mfForm.nav} onChange={(e) => setMfForm({ ...mfForm, nav: e.target.value })} className="input-field" required /></div>
                <div><label className={`block text-sm mb-1 ${isDark ? 'text-dark-300' : 'text-dark-700'}`}>Units</label><input type="number" step="0.01" value={mfForm.units} onChange={(e) => setMfForm({ ...mfForm, units: e.target.value })} className="input-field" required /></div>
                <div><label className={`block text-sm mb-1 ${isDark ? 'text-dark-300' : 'text-dark-700'}`}>SIP Amount</label><input type="number" value={mfForm.sip_amount} onChange={(e) => setMfForm({ ...mfForm, sip_amount: e.target.value })} className="input-field" /></div>
                <div><label className={`block text-sm mb-1 ${isDark ? 'text-dark-300' : 'text-dark-700'}`}>Date</label><input type="date" value={mfForm.investment_date} onChange={(e) => setMfForm({ ...mfForm, investment_date: e.target.value })} className="input-field" required /></div>
                <div>
                  <label className={`block text-sm mb-1 ${isDark ? 'text-dark-300' : 'text-dark-700'}`}>Pay From (Bank)</label>
                  <select value={mfForm.account_id} onChange={(e) => setMfForm({ ...mfForm, account_id: e.target.value })} className="input-field">
                    <option value="">External / Do not deduct</option>
                    {accounts.filter(a => a.type !== 'credit').map(a => <option key={a.id} value={a.id}>{a.bank_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={`block text-sm mb-1 ${isDark ? 'text-dark-300' : 'text-dark-700'}`}>Link to Goal</label>
                  <select value={mfForm.linked_goal_id} onChange={(e) => setMfForm({ ...mfForm, linked_goal_id: e.target.value })} className="input-field">
                    <option value="">None</option>
                    {goals.map(g => <option key={g.id} value={g.id}>{g.goal_name || g.name}</option>)}
                  </select>
                </div>
                <div className="flex items-end lg:col-span-3"><button type="submit" className="btn-primary w-full">Add Mutual Fund</button></div>
              </form>
            </motion.div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            {mutualFunds.map((mf, i) => (
              <motion.div key={mf.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="glass-card p-5">
                <h4 className={`font-semibold mb-2 ${isDark ? 'text-white' : 'text-dark-900'}`}>{mf.fund_name}</h4>
                <div className={`grid grid-cols-2 gap-2 text-sm ${isDark ? 'text-dark-400' : 'text-dark-500'}`}>
                  <div>NAV: ₹{mf.nav}</div><div>Units: {mf.units}</div>
                  <div>Value: ₹{(mf.nav * mf.units).toLocaleString('en-IN')}</div>
                  {mf.sip_amount > 0 && <div>SIP: ₹{mf.sip_amount}/mo</div>}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {tab === 'sip-plans' && (
        <div>
          <div className="flex justify-end mb-4">
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => setShowAddSIP(!showAddSIP)} className="btn-primary flex items-center gap-2"><PlusIcon className="w-5 h-5" /> Add SIP</motion.button>
          </div>
          {showAddSIP && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 mb-6">
              <form onSubmit={handleAddSIP} className="grid grid-cols-3 gap-4">
                <div><label className={`block text-sm mb-1 ${isDark ? 'text-dark-300' : 'text-dark-700'}`}>Fund ID</label><input value={sipForm.fund_id} onChange={(e) => setSipForm({ ...sipForm, fund_id: e.target.value })} className="input-field" required /></div>
                <div><label className={`block text-sm mb-1 ${isDark ? 'text-dark-300' : 'text-dark-700'}`}>Monthly Amount (₹)</label><input type="number" value={sipForm.monthly_amount} onChange={(e) => setSipForm({ ...sipForm, monthly_amount: e.target.value })} className="input-field" required /></div>
                <div><label className={`block text-sm mb-1 ${isDark ? 'text-dark-300' : 'text-dark-700'}`}>Start Date</label><input type="date" value={sipForm.start_date} onChange={(e) => setSipForm({ ...sipForm, start_date: e.target.value })} className="input-field" required /></div>
              </form>
              <button onClick={handleAddSIP} className="btn-primary mt-4">Add SIP</button>
            </motion.div>
          )}
          {/* SIP Projections */}
          {sipProjections.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              {sipProjections.map((sip, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="glass-card p-5">
                  <h4 className={`font-semibold mb-3 ${isDark ? 'text-white' : 'text-dark-900'}`}>₹{sip.monthly_amount}/month SIP</h4>
                  <div className="space-y-2">
                    {[{ label: '5 Years', data: sip.projection_5yr }, { label: '10 Years', data: sip.projection_10yr }, { label: '20 Years', data: sip.projection_20yr }].map((p) => (
                      <div key={p.label} className={`flex justify-between text-sm ${isDark ? 'text-dark-400' : 'text-dark-500'}`}>
                        <span>{p.label}:</span>
                        <span className="font-medium text-accent-500">₹{p.data?.estimated_value?.toLocaleString('en-IN')}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
          {sips.length === 0 && <p className={`text-center py-12 ${isDark ? 'text-dark-500' : 'text-dark-400'}`}>No SIP plans yet</p>}
        </div>
      )}
    </div>
  );
}
