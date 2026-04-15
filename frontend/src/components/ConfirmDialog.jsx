import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

/**
 * ConfirmDialog — styled modal replacement for native window.confirm().
 *
 * Usage:
 *   <ConfirmDialog
 *     open={showConfirm}
 *     title="Delete transaction?"
 *     message="This action cannot be undone."
 *     confirmLabel="Delete"
 *     confirmColor="danger"    // 'danger' | 'warning' | 'primary'
 *     onConfirm={() => { ... }}
 *     onCancel={() => setShowConfirm(false)}
 *   />
 */
export default function ConfirmDialog({
  open,
  title = 'Are you sure?',
  message = '',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmColor = 'danger',
  onConfirm,
  onCancel,
  icon: CustomIcon,
}) {
  const { isDark } = useTheme();

  const colorMap = {
    danger:  { bg: '#ef4444', hover: '#dc2626', ring: 'rgba(239,68,68,0.25)', iconBg: 'rgba(239,68,68,0.12)', iconColor: '#ef4444' },
    warning: { bg: '#f59e0b', hover: '#d97706', ring: 'rgba(245,158,11,0.25)', iconBg: 'rgba(245,158,11,0.12)', iconColor: '#f59e0b' },
    primary: { bg: '#6366f1', hover: '#4f46e5', ring: 'rgba(99,102,241,0.25)', iconBg: 'rgba(99,102,241,0.12)', iconColor: '#6366f1' },
  };
  const c = colorMap[confirmColor] || colorMap.danger;
  const Icon = CustomIcon || ExclamationTriangleIcon;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onCancel}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
            padding: 16,
          }}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 10 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 400,
              background: isDark ? '#111827' : '#ffffff',
              border: `1px solid ${isDark ? '#1f2937' : '#e5e7eb'}`,
              borderRadius: 20, overflow: 'hidden',
              boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
            }}
          >
            {/* Icon + Content */}
            <div style={{ padding: '28px 24px 20px', textAlign: 'center' }}>
              <div style={{
                width: 48, height: 48, borderRadius: 14, margin: '0 auto 16px',
                background: c.iconBg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon style={{ width: 24, height: 24, color: c.iconColor }} />
              </div>
              <h3 style={{
                margin: '0 0 8px', fontSize: 17, fontWeight: 700,
                color: isDark ? '#f3f4f6' : '#111827',
              }}>
                {title}
              </h3>
              {message && (
                <p style={{
                  margin: 0, fontSize: 13, lineHeight: 1.6,
                  color: isDark ? '#9ca3af' : '#6b7280',
                }}>
                  {message}
                </p>
              )}
            </div>

            {/* Actions */}
            <div style={{
              display: 'flex', gap: 10, padding: '0 24px 24px',
            }}>
              <button
                onClick={onCancel}
                style={{
                  flex: 1, padding: '10px 16px', borderRadius: 12,
                  background: isDark ? '#1f2937' : '#f3f4f6',
                  border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
                  color: isDark ? '#d1d5db' : '#374151',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  fontFamily: 'inherit', transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => e.target.style.background = isDark ? '#374151' : '#e5e7eb'}
                onMouseLeave={(e) => e.target.style.background = isDark ? '#1f2937' : '#f3f4f6'}
              >
                {cancelLabel}
              </button>
              <button
                onClick={onConfirm}
                style={{
                  flex: 1, padding: '10px 16px', borderRadius: 12,
                  background: c.bg, border: 'none',
                  color: '#ffffff', fontSize: 13, fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'background 0.15s',
                  boxShadow: `0 4px 14px ${c.ring}`,
                }}
                onMouseEnter={(e) => e.target.style.background = c.hover}
                onMouseLeave={(e) => e.target.style.background = c.bg}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
