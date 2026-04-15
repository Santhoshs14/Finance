import { motion } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';

/* ─── Skeleton primitives ─── */

const pulse = {
  animate: {
    opacity: [0.4, 0.8, 0.4],
  },
  transition: {
    duration: 1.5,
    repeat: Infinity,
    ease: 'easeInOut',
  },
};

const SkeletonBlock = ({ width = '100%', height = 16, radius = 8, style = {} }) => {
  const { isDark } = useTheme();
  return (
    <motion.div
      {...pulse}
      style={{
        width, height, borderRadius: radius,
        background: isDark ? '#1f2937' : '#e5e7eb',
        ...style,
      }}
    />
  );
};

/* ─── SkeletonCard ─── */
export const SkeletonCard = ({ lines = 3, style = {} }) => {
  const { isDark } = useTheme();
  return (
    <div
      className="glass-card"
      style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 12, ...style }}
    >
      <SkeletonBlock width="40%" height={12} />
      <SkeletonBlock width="60%" height={26} />
      {Array.from({ length: lines - 2 }).map((_, i) => (
        <SkeletonBlock key={i} width={`${60 + Math.random() * 30}%`} height={12} />
      ))}
    </div>
  );
};

/* ─── SkeletonTable ─── */
export const SkeletonTable = ({ rows = 5, cols = 6, style = {} }) => {
  const { isDark } = useTheme();
  return (
    <div style={{ overflow: 'hidden', borderRadius: 16, ...style }}>
      {/* Header */}
      <div style={{
        display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 12,
        padding: '14px 18px',
        borderBottom: `1px solid ${isDark ? '#1f2937' : '#e5e7eb'}`,
      }}>
        {Array.from({ length: cols }).map((_, i) => (
          <SkeletonBlock key={i} height={10} width="70%" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} style={{
          display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 12,
          padding: '12px 18px',
          borderBottom: `1px solid ${isDark ? '#111827' : '#f3f4f6'}`,
        }}>
          {Array.from({ length: cols }).map((_, c) => (
            <SkeletonBlock key={c} height={14} width={`${50 + Math.random() * 40}%`} />
          ))}
        </div>
      ))}
    </div>
  );
};

/* ─── SkeletonChart ─── */
export const SkeletonChart = ({ height = 250, style = {} }) => {
  const { isDark } = useTheme();
  return (
    <div className="glass-card" style={{ padding: 20, ...style }}>
      <SkeletonBlock width="35%" height={14} style={{ marginBottom: 20 }} />
      <div style={{
        height, display: 'flex', alignItems: 'flex-end', gap: 8, padding: '0 10px',
      }}>
        {Array.from({ length: 7 }).map((_, i) => (
          <SkeletonBlock
            key={i}
            width="100%"
            height={`${30 + Math.random() * 60}%`}
            radius={6}
          />
        ))}
      </div>
    </div>
  );
};

/* ─── SkeletonGrid — multiple cards ─── */
export const SkeletonGrid = ({ count = 4, cols = 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4' }) => (
  <div className={`grid ${cols} gap-4`}>
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonCard key={i} />
    ))}
  </div>
);

export default SkeletonBlock;
