import { motion } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';

/**
 * EmptyState — reusable empty state component with icon, title, description, and optional CTA.
 *
 * Usage:
 *   <EmptyState
 *     icon={ChartPieIcon}
 *     title="No data yet"
 *     description="Add your first transaction to get started."
 *     actionLabel="Add Transaction"
 *     onAction={() => setShowAdd(true)}
 *   />
 */
export default function EmptyState({
  icon: Icon,
  title = 'Nothing here yet',
  description = '',
  actionLabel,
  onAction,
  emoji,
  compact = false,
}) {
  const { isDark } = useTheme();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', textAlign: 'center',
        padding: compact ? '32px 20px' : '48px 24px',
      }}
    >
      {/* Icon circle */}
      {Icon && (
        <div style={{
          width: compact ? 48 : 64, height: compact ? 48 : 64,
          borderRadius: compact ? 14 : 20,
          background: isDark ? 'rgba(255,255,255,0.05)' : '#f3f4f6',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: compact ? 12 : 20,
        }}>
          <Icon style={{
            width: compact ? 22 : 28, height: compact ? 22 : 28,
            color: isDark ? '#4b5563' : '#9ca3af',
          }} />
        </div>
      )}

      {emoji && !Icon && (
        <div style={{
          fontSize: compact ? 32 : 48,
          marginBottom: compact ? 12 : 20,
          lineHeight: 1,
        }}>
          {emoji}
        </div>
      )}

      <h3 style={{
        margin: '0 0 6px', fontSize: compact ? 15 : 18,
        fontWeight: 700, color: isDark ? '#e5e7eb' : '#1f2937',
      }}>
        {title}
      </h3>

      {description && (
        <p style={{
          margin: '0 0 16px', fontSize: compact ? 12 : 13,
          color: isDark ? '#6b7280' : '#9ca3af',
          maxWidth: 320, lineHeight: 1.5,
        }}>
          {description}
        </p>
      )}

      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="btn-primary"
          style={{
            padding: '9px 20px', fontSize: 13, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          {actionLabel}
        </button>
      )}
    </motion.div>
  );
}
