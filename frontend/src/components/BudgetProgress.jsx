import { motion } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';

export default function BudgetProgress({ category, spent, limit, delay = 0 }) {
  const { isDark } = useTheme();
  const percentage = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;
  const isOver = spent > limit;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay }}
      className="mb-4"
    >
      <div className="flex justify-between items-center mb-2">
        <span className={`text-sm font-medium ${isDark ? 'text-dark-200' : 'text-dark-700'}`}>{category}</span>
        <span className={`text-sm font-semibold ${isOver ? 'text-danger-500' : isDark ? 'text-dark-300' : 'text-dark-600'}`}>
          ₹{spent.toLocaleString('en-IN')} / ₹{limit.toLocaleString('en-IN')}
        </span>
      </div>
      <div className={`w-full h-2.5 rounded-full ${isDark ? 'bg-dark-700' : 'bg-dark-200'}`}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1, delay: delay + 0.3, ease: 'easeOut' }}
          style={{
            background: isOver
              ? 'linear-gradient(90deg, #f87171, #dc2626)'
              : percentage > 75
              ? 'linear-gradient(90deg, #fbbf24, #d97706)'
              : 'linear-gradient(90deg, #1abf94, #40d9b3)',
            height: '100%', borderRadius: 99,
          }}
        />
      </div>
      <p className={`text-xs mt-1 ${isDark ? 'text-dark-500' : 'text-dark-400'}`}>
        {isOver ? `Over budget by ₹${(spent - limit).toLocaleString('en-IN')}` : `${percentage.toFixed(1)}% used`}
      </p>
    </motion.div>
  );
}
