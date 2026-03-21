import { motion } from 'framer-motion';
import CountUp from 'react-countup';
import { useTheme } from '../context/ThemeContext';

const gradients = {
  primary: 'linear-gradient(135deg, #1abf94, #107f61)',
  accent:  'linear-gradient(135deg, #34d399, #059669)',
  danger:  'linear-gradient(135deg, #f87171, #dc2626)',
  warning: 'linear-gradient(135deg, #fbbf24, #d97706)',
};

const glowColors = {
  primary: 'rgba(26,191,148,0.18)',
  accent:  'rgba(52,211,153,0.18)',
  danger:  'rgba(239,68,68,0.18)',
  warning: 'rgba(251,191,36,0.18)',
};

export default function StatCard({ title, value, prefix = '₹', suffix = '', icon: Icon, trend, trendLabel, color = 'primary', delay = 0 }) {
  const { isDark } = useTheme();

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay }}
      whileHover={{ y: -4, boxShadow: `0 8px 32px ${glowColors[color] || glowColors.primary}` }}
      className="glass-card p-4 sm:p-6"
      style={{ position: 'relative', overflow: 'hidden', cursor: 'default' }}
    >
      {/* Background glow blob */}
      <div
        style={{
          position: 'absolute', top: -20, right: -20,
          width: 90, height: 90, borderRadius: '50%',
          background: glowColors[color] || glowColors.primary,
          filter: 'blur(20px)',
          pointerEvents: 'none',
        }}
      />

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', position: 'relative' }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 500, color: isDark ? '#9ca3af' : '#6b7280', marginBottom: 8 }}>
            {title}
          </p>
          <h3 style={{ fontSize: 26, fontWeight: 800, color: isDark ? '#f3f4f6' : '#111827', letterSpacing: '-0.5px' }}>
            {prefix}
            <CountUp end={typeof value === 'number' ? value : 0} duration={1.8} separator="," decimals={value % 1 !== 0 ? 2 : 0} />
            {suffix}
          </h3>
          {trend !== undefined && (
            <div
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 8,
                background: trend >= 0 ? 'rgba(26,191,148,0.12)' : 'rgba(239,68,68,0.12)',
                color: trend >= 0 ? '#1abf94' : '#ef4444',
                padding: '3px 8px', borderRadius: 99, fontSize: 12, fontWeight: 600,
              }}
            >
              {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}%
              {trendLabel && <span style={{ color: isDark ? '#6b7280' : '#9ca3af', fontWeight: 400 }}>{trendLabel}</span>}
            </div>
          )}
        </div>
        {Icon && (
          <div
            style={{
              width: 44, height: 44, borderRadius: 12,
              background: gradients[color] || gradients.primary,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 4px 12px ${glowColors[color] || glowColors.primary}`,
              flexShrink: 0,
            }}
          >
            <Icon style={{ width: 22, height: 22, color: 'white' }} />
          </div>
        )}
      </div>
    </motion.div>
  );
}
