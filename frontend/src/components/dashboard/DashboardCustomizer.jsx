import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../../context/ThemeContext';
import { WIDGET_REGISTRY } from '../../hooks/useDashboardLayout';
import { ArrowPathIcon, XMarkIcon, CheckIcon } from '@heroicons/react/24/outline';

/**
 * Compact edit-mode banner shown at the TOP of the page.
 * Each widget card already handles its own drag-handle & controls
 * in edit mode. This banner just shows global actions.
 */
export default function DashboardCustomizer({ open, onClose, layout, onToggle, onReset }) {
  const { isDark } = useTheme();
  const textMain = isDark ? '#f3f4f6' : '#111827';
  const textSub  = isDark ? '#9ca3af' : '#6b7280';
  const border   = isDark ? '#30363d' : '#e5e7eb';
  const bg       = isDark ? '#0d1117' : '#ffffff';

  const hiddenCount = layout.filter(w => !w.visible).length;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="edit-banner"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          style={{
            position: 'sticky', top: 0, zIndex: 100,
            background: isDark
              ? 'linear-gradient(135deg, rgba(13,17,23,0.97), rgba(26,37,51,0.97))'
              : 'linear-gradient(135deg, rgba(255,255,255,0.97), rgba(240,253,244,0.97))',
            backdropFilter: 'blur(12px)',
            borderBottom: `1px solid ${isDark ? 'rgba(26,191,148,0.2)' : 'rgba(26,191,148,0.3)'}`,
            padding: '10px 20px',
            marginBottom: 20,
            display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          }}
        >
          {/* Status indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: '#1abf94',
              boxShadow: '0 0 8px rgba(26,191,148,0.6)',
              animation: 'pulse 2s ease-in-out infinite',
            }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: '#1abf94' }}>
              Workspace Edit Mode
            </span>
            <span style={{ fontSize: 12, color: textSub }}>
              · Drag handle to move · Drag edges/corners to resize · Click × to hide
            </span>
          </div>

          {/* Hidden widget pills */}
          {hiddenCount > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginLeft: 4 }}>
              {layout.filter(w => !w.visible).map(item => {
                const reg = WIDGET_REGISTRY.find(r => r.id === item.id);
                if (!reg) return null;
                return (
                  <button
                    key={item.id}
                    onClick={() => onToggle(item.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '4px 10px', borderRadius: 99,
                      fontSize: 11, fontWeight: 600, cursor: 'pointer',
                      fontFamily: 'inherit',
                      border: `1px dashed ${border}`,
                      background: isDark ? '#161b22' : '#f9fafb',
                      color: textSub,
                      transition: 'all 0.15s',
                    }}
                    onMouseOver={e => { e.currentTarget.style.borderColor = '#1abf94'; e.currentTarget.style.color = '#1abf94'; }}
                    onMouseOut={e => { e.currentTarget.style.borderColor = border; e.currentTarget.style.color = textSub; }}
                    title={`Show ${reg.title}`}
                  >
                    <span>{reg.icon}</span>
                    <span>+ {reg.title}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            <button
              onClick={onReset}
              title="Reset to default layout"
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                border: `1px solid ${border}`,
                background: 'transparent',
                color: textSub,
              }}
              onMouseOver={e => { e.currentTarget.style.color = '#f59e0b'; e.currentTarget.style.borderColor = '#f59e0b'; }}
              onMouseOut={e => { e.currentTarget.style.color = textSub; e.currentTarget.style.borderColor = border; }}
            >
              <ArrowPathIcon style={{ width: 13, height: 13 }} /> Reset
            </button>
            <button
              onClick={onClose}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                border: '1px solid #1abf94',
                background: 'rgba(26,191,148,0.1)',
                color: '#1abf94',
              }}
            >
              <CheckIcon style={{ width: 13, height: 13 }} /> Done
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
