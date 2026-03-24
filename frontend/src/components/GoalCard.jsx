import { motion } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';

export default function GoalCard({ goal, delay = 0 }) {
  const { isDark } = useTheme();
  const progress = goal.target_amount > 0 ? (goal.current_amount / goal.target_amount) * 100 : 0;
  const remaining = goal.target_amount - goal.current_amount;
  
  // Calculate months remaining
  const now = new Date();
  const deadline = goal.deadline ? new Date(goal.deadline) : null;
  let monthsRemaining = 0;
  if (deadline && deadline > now) {
    monthsRemaining = (deadline.getFullYear() - now.getFullYear()) * 12 + (deadline.getMonth() - now.getMonth());
    if (monthsRemaining <= 0) monthsRemaining = 1; // within same month
  }
  
  const requiredMonthly = (remaining > 0 && monthsRemaining > 0) ? (remaining / monthsRemaining) : 0;

  const bg = isDark ? '#181e27' : '#ffffff';
  const border = isDark ? '#252f3e' : '#e5e7eb';
  const textMain = isDark ? '#f3f4f6' : '#111827';
  const textSub = isDark ? '#9ca3af' : '#6b7280';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, delay }}
      whileHover={{ scale: 1.02 }}
      className="glass-card p-4 sm:p-6"
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1 pr-2">
          <div className="flex items-center gap-2 mb-1">
            <h4 style={{ fontWeight: 700, color: textMain, fontSize: 16 }}>{goal.goal_name || goal.name}</h4>
            <span style={{ 
              fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
              background: progress >= 100 ? 'rgba(26,191,148,0.15)' : 'rgba(245,158,11,0.15)',
              color: progress >= 100 ? '#1abf94' : '#f59e0b',
              marginLeft: 'auto'
            }}>
              {progress.toFixed(1)}%
            </span>
          </div>
          <p style={{ fontSize: 11, color: textSub }}>Target: {new Intl.DateTimeFormat('en-IN').format(deadline || now)}</p>
        </div>
        
        {/* Actions Dropdown / Icons */}
        <div className="flex gap-1">
          {goal.onAddFunds && (
            <button onClick={() => goal.onAddFunds(goal)} title="Add Funds" className="p-1.5 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-800 text-primary-500 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
            </button>
          )}
          {goal.onEdit && (
            <button onClick={() => goal.onEdit(goal)} title="Edit Goal" className="p-1.5 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-800 text-dark-500 hover:text-dark-700 dark:text-dark-400 dark:hover:text-dark-200 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
            </button>
          )}
        </div>
      </div>

      <div className="progress-track" style={{ height: 10, marginBottom: 12 }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(progress, 100)}%` }}
          transition={{ duration: 1.2, delay: delay + 0.2, ease: 'easeOut' }}
          className="progress-fill"
          style={{ background: 'linear-gradient(90deg, #1abf94, #40d9b3)' }}
        />
      </div>

      <div className="flex justify-between text-sm mb-6">
        <div style={{ color: textMain, fontWeight: 700 }}>
          ₹{goal.current_amount?.toLocaleString('en-IN')}
          <span style={{ color: textSub, fontWeight: 400, marginLeft: 4 }}>saved</span>
        </div>
        <div style={{ color: textSub }}>
          goal ₹{goal.target_amount?.toLocaleString('en-IN')}
        </div>
      </div>

      {requiredMonthly > 0 && (
        <div style={{ 
          background: isDark ? 'rgba(255,255,255,0.03)' : '#f9fafb',
          borderRadius: 12, padding: '12px 14px', border: `1px solid ${border}`
        }}>
          <p style={{ fontSize: 11, color: textSub, marginBottom: 4 }}>REQUIRED MONTHLY CONTRIBUTION</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: '#1abf94' }}>
              ₹{Math.ceil(requiredMonthly).toLocaleString('en-IN')}
            </span>
            <span style={{ fontSize: 11, color: '#1abf94', fontWeight: 600 }}>FOR {monthsRemaining} MO</span>
          </div>
        </div>
      )}

      {remaining <= 0 && (
        <div style={{ 
          background: 'rgba(26,191,148,0.1)', color: '#1abf94', 
          borderRadius: 12, padding: '12px 14px', textAlign: 'center', fontWeight: 700, fontSize: 13
        }}>
          GOAL COMPLETED 🎯
        </div>
      )}
    </motion.div>
  );
}
