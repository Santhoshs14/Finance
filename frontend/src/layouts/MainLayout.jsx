import { useState, useRef, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from './Sidebar';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { transactionsAPI } from '../services/api';
import {
  Bars3Icon,
  MagnifyingGlassIcon,
  UserIcon,
  Cog6ToothIcon,
  ArrowDownTrayIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

// CSV export helper
const downloadCSV = (transactions) => {
  if (!transactions?.length) { toast.error('No transactions to export'); return; }
  const headers = ['Date', 'Category', 'Payment Type', 'Amount', 'Notes'];
  const rows = transactions.map(t => [t.date, t.category, t.payment_type || '', t.amount, (t.notes || '').replace(/,/g, ' ')]);
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `transactions_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success('Exported transactions.csv');
};

export default function MainLayout() {
  const { isDark } = useTheme();
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const topbarBorder = isDark ? '#1a2235' : '#e5e7eb';
  const searchBg     = isDark ? '#111827' : '#f3f4f6';
  const searchColor  = isDark ? '#e5e7eb' : '#374151';
  const pageBg       = isDark ? '#080c14' : '#f0f4f8';   // deeper true-black in dark mode
  const textMuted    = isDark ? '#6b7280' : '#9ca3af';
  const menuBg       = isDark ? '#0f1621' : '#ffffff';
  const topbarBg     = isDark ? 'rgba(8,12,20,0.85)' : 'rgba(255,255,255,0.90)';

  const displayName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'User';
  const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  // Dynamic sidebar width
  const sidebarWidth = isMobile ? 0 : (sidebarCollapsed ? 72 : 220);

  const handleExport = async () => {
    setMenuOpen(false);
    try {
      const res = await transactionsAPI.exportCSV();
      const txns = Array.isArray(res.data.data) ? res.data.data : res.data.data?.transactions || [];
      downloadCSV(txns);
    } catch { toast.error('Export failed'); }
  };

  const handleLogout = () => { setMenuOpen(false); logout(); navigate('/login'); };

  const menuItems = [
    { icon: UserIcon, label: 'Profile', action: () => { setMenuOpen(false); navigate('/settings'); } },
    { icon: Cog6ToothIcon, label: 'Settings', action: () => { setMenuOpen(false); navigate('/settings'); } },
    { icon: ArrowDownTrayIcon, label: 'Export Data (CSV)', action: handleExport },
    { icon: ArrowRightOnRectangleIcon, label: 'Logout', action: handleLogout, danger: true },
  ];

  return (
    <div style={{ minHeight: '100vh', background: pageBg }}>
      <Sidebar
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        onCollapsedChange={(v) => setSidebarCollapsed(v)}
      />

      {/* Main content — margin tracks sidebar width dynamically */}
      <motion.div
        animate={{ marginLeft: sidebarWidth }}
        transition={{ duration: 0.25, ease: 'easeInOut' }}
        className="md:block"
        style={{ marginLeft: 0 }}
      >
        {/* Top bar */}
        <div className="flex items-center px-4 sm:px-6 h-16 gap-3 sm:gap-4 sticky top-0 z-40" style={{
          background: topbarBg,
          backdropFilter: 'blur(14px)',
          borderBottom: `1px solid ${topbarBorder}`,
        }}>
          {/* Mobile hamburger */}
          <button onClick={() => setMobileMenuOpen(true)} className="md:hidden"
            style={{ color: searchColor, background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <Bars3Icon style={{ width: 24, height: 24 }} />
          </button>

          {/* Search */}
          <div className="flex-1 max-w-[200px] sm:max-w-[400px] relative">
            <MagnifyingGlassIcon style={{ width: 16, height: 16, color: textMuted, position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
            <input type="text" placeholder="Search analytics, transactions..." value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)} className="input-field"
              style={{ width: '100%', background: searchBg, border: `1px solid ${topbarBorder}`, borderRadius: 12, padding: '10px 14px 10px 40px', fontSize: 13, color: searchColor, fontFamily: 'inherit' }} />
          </div>

          <div style={{ flex: 1 }} />



          {/* User Menu */}
          <div ref={menuRef} style={{ position: 'relative', flexShrink: 0 }}>
            <button onClick={() => setMenuOpen(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '6px 12px', borderRadius: 12, border: `1px solid ${menuOpen ? '#1abf94' : 'transparent'}`, background: 'transparent', transition: 'all 0.2s' }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg, #1abf94, #107f61)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 12 }}>
                {initials}
              </div>
              <div className="hidden lg:block" style={{ lineHeight: 1.2, textAlign: 'left' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: isDark ? '#f3f4f6' : '#111827', margin: 0 }}>{displayName}</p>
                  <span style={{ fontSize: 9, background: 'rgba(26,191,148,0.15)', color: '#1abf94', padding: '1px 4px', borderRadius: 4, fontWeight: 800 }}>PRO</span>
                </div>
                <p style={{ fontSize: 11, color: textMuted, margin: 0 }}>Analytics Access</p>
              </div>
            </button>

            <AnimatePresence>
              {menuOpen && (
                <motion.div initial={{ opacity: 0, y: -8, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.95 }} transition={{ duration: 0.15 }}
                  style={{ position: 'absolute', top: '110%', right: 0, minWidth: 200, background: menuBg, border: `1px solid ${topbarBorder}`, borderRadius: 14, boxShadow: '0 16px 48px rgba(0,0,0,0.3)', overflow: 'hidden', zIndex: 100 }}>
                  <div style={{ padding: '14px 16px', borderBottom: `1px solid ${topbarBorder}` }}>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: isDark ? '#f3f4f6' : '#111827' }}>{displayName}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: textMuted }}>{currentUser?.email}</p>
                  </div>
                  <div style={{ padding: '6px' }}>
                    {menuItems.map((item) => (
                      <button key={item.label} onClick={item.action}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 12px', borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', fontWeight: 500, color: item.danger ? '#ef4444' : (isDark ? '#d1d5db' : '#374151'), transition: 'background 0.15s' }}
                        onMouseOver={(e) => e.currentTarget.style.background = item.danger ? 'rgba(239,68,68,0.08)' : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)')}
                        onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}>
                        <item.icon style={{ width: 16, height: 16 }} />
                        {item.label}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Page content */}
        <main style={{ padding: '24px 24px 40px' }}>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
            <Outlet />
          </motion.div>
        </main>
      </motion.div>

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 40, backdropFilter: 'blur(2px)' }}
          onClick={() => setMobileMenuOpen(false)} />
      )}
    </div>
  );
}
