import { motion } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';

export default function ChartCard({ title, subtitle, children, className = '', delay = 0 }) {
  const { isDark } = useTheme();

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay }}
      className={`glass-card ${className}`}
      style={{ padding: 24 }}
    >
      <div style={{ marginBottom: 18 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: isDark ? '#f3f4f6' : '#111827' }}>{title}</h3>
        {subtitle && (
          <p style={{ fontSize: 12.5, marginTop: 3, color: isDark ? '#6b7280' : '#9ca3af' }}>{subtitle}</p>
        )}
      </div>
      {children}
    </motion.div>
  );
}
