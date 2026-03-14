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
      className="glass-card p-6"
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <h4 style={{ fontWeight: 700, color: textMain, fontSize: 16 }}>{goal.goal_name || goal.name}</h4>
          <p style={{ fontSize: 11, color: textSub, marginTop: 2 }}>Target: {new Intl.DateTimeFormat('en-IN').format(deadline || now)}</p>
        </div>
        <span style={{ 
          fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 99,
          background: progress >= 100 ? 'rgba(26,191,148,0.15)' : 'rgba(245,158,11,0.15)',
          color: progress >= 100 ? '#1abf94' : '#f59e0b'
        }}>
          {progress.toFixed(1)}%
        </span>
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
