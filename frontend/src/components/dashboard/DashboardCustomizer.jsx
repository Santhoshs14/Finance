import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../../context/ThemeContext';
import { WIDGET_REGISTRY } from '../../hooks/useDashboardLayout';
import {
  XMarkIcon,
  ArrowPathIcon,
  EyeIcon,
  EyeSlashIcon,
} from '@heroicons/react/24/outline';

// ─── Size badge map ─────────────────────────────────────────────────────────
const SIZE_LABELS = { small: 'S', medium: 'M', large: 'L' };
const SIZE_COLORS = {
  small: '#6b7280',
  medium: '#3b82f6',
  large: '#8b5cf6',
};

export default function DashboardCustomizer({ open, onClose, layout, onToggle, onResize, onReset }) {
  const { isDark } = useTheme();

  const panelBg   = isDark ? '#0f1621' : '#ffffff';
  const border    = isDark ? '#1a2235' : '#e5e7eb';
  const textMain  = isDark ? '#f3f4f6' : '#111827';
  const textSub   = isDark ? '#9ca3af' : '#6b7280';
  const rowHover  = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';
  const chipBg    = isDark ? '#1a2235' : '#f3f4f6';

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(0,0,0,0.45)',
              backdropFilter: 'blur(3px)',
              zIndex: 200,
            }}
          />

          {/* Drawer panel */}
          <motion.div
            key="panel"
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 340, damping: 32 }}
            style={{
              position: 'fixed', top: 0, right: 0, bottom: 0,
              width: 340, maxWidth: '90vw',
              background: panelBg,
              borderLeft: `1px solid ${border}`,
              boxShadow: '-12px 0 48px rgba(0,0,0,0.3)',
              zIndex: 201,
              display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div style={{
              padding: '20px 20px 16px',
              borderBottom: `1px solid ${border}`,
              display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
              flexShrink: 0,
            }}>
              <div>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: textMain }}>
                  Customize Dashboard
                </p>
                <p style={{ margin: '3px 0 0', fontSize: 12, color: textSub }}>
                  Drag to reorder · toggle visibility · resize widgets
                </p>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={onReset}
                  title="Reset to default"
                  style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: isDark ? '#1a2235' : '#f3f4f6',
                    border: `1px solid ${border}`,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: textSub, transition: 'all 0.15s',
                  }}
                  onMouseOver={(e) => e.currentTarget.style.color = '#f59e0b'}
                  onMouseOut={(e) => e.currentTarget.style.color = textSub}
                >
                  <ArrowPathIcon style={{ width: 15, height: 15 }} />
                </button>
                <button
                  onClick={onClose}
                  style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: isDark ? '#1a2235' : '#f3f4f6',
                    border: `1px solid ${border}`,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: textSub, transition: 'all 0.15s',
                  }}
                  onMouseOver={(e) => e.currentTarget.style.color = '#ef4444'}
                  onMouseOut={(e) => e.currentTarget.style.color = textSub}
                >
                  <XMarkIcon style={{ width: 15, height: 15 }} />
                </button>
              </div>
            </div>

            {/* Widget List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 12px 20px' }}>
              {layout.map((item, idx) => {
                const reg = WIDGET_REGISTRY.find((r) => r.id === item.id);
                if (!reg) return null;
                const isAlwaysOn = reg.removable === false;
                return (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 12px', borderRadius: 12,
                      marginBottom: 4,
                      background: item.visible ? 'transparent' : (isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.03)'),
                      border: `1px solid ${item.visible ? border : border}`,
                      opacity: item.visible ? 1 : 0.55,
                      transition: 'all 0.15s',
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = rowHover}
                    onMouseOut={(e) => e.currentTarget.style.background = item.visible ? 'transparent' : (isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.03)')}
                  >
                    {/* Icon */}
                    <span style={{ fontSize: 18, flexShrink: 0 }}>{reg.icon}</span>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: textMain, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {reg.title}
                      </p>
                      <p style={{ margin: 0, fontSize: 11, color: textSub, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {reg.description}
                      </p>
                    </div>

                    {/* Size chips */}
                    {item.visible && reg.allowedSizes.length > 1 && (
                      <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                        {reg.allowedSizes.map((sz) => (
                          <button
                            key={sz}
                            onClick={() => onResize(item.id, sz)}
                            title={`Set size to ${sz}`}
                            style={{
                              width: 24, height: 24, borderRadius: 6, fontSize: 10, fontWeight: 700,
                              border: `1px solid ${item.size === sz ? SIZE_COLORS[sz] : border}`,
                              background: item.size === sz ? `${SIZE_COLORS[sz]}20` : 'transparent',
                              color: item.size === sz ? SIZE_COLORS[sz] : textSub,
                              cursor: 'pointer', transition: 'all 0.15s',
                            }}
                          >
                            {SIZE_LABELS[sz]}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Toggle visibility */}
                    <button
                      onClick={() => !isAlwaysOn && onToggle(item.id)}
                      disabled={isAlwaysOn}
                      title={isAlwaysOn ? 'This widget is always visible' : (item.visible ? 'Hide widget' : 'Show widget')}
                      style={{
                        width: 30, height: 30, borderRadius: 8, border: 'none',
                        background: item.visible ? 'rgba(26,191,148,0.15)' : chipBg,
                        cursor: isAlwaysOn ? 'default' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: item.visible ? '#1abf94' : textSub,
                        transition: 'all 0.15s', flexShrink: 0,
                        opacity: isAlwaysOn ? 0.5 : 1,
                      }}
                    >
                      {item.visible
                        ? <EyeIcon style={{ width: 14, height: 14 }} />
                        : <EyeSlashIcon style={{ width: 14, height: 14 }} />
                      }
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Footer tip */}
            <div style={{
              padding: '14px 16px',
              borderTop: `1px solid ${border}`,
              flexShrink: 0,
            }}>
              <p style={{ margin: 0, fontSize: 11, color: textSub, textAlign: 'center', lineHeight: 1.5 }}>
                💡 Drag widgets on the dashboard to reorder them
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
