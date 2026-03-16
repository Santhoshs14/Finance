import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import {
  HomeIcon,
  BanknotesIcon,
  ChartBarIcon,
  FlagIcon,
  CreditCardIcon,
  ArrowsRightLeftIcon,
  DocumentChartBarIcon,
  Cog6ToothIcon,
  ChevronRightIcon,
  SunIcon,
  MoonIcon,
  ArrowRightOnRectangleIcon,
  XMarkIcon,
  ChartPieIcon,
} from '@heroicons/react/24/outline';

const menuItems = [
  { label: 'Dashboard', path: '/', icon: HomeIcon },
  { label: 'Transactions', path: '/transactions', icon: ArrowsRightLeftIcon },
  { label: 'Statistic', path: '/reports', icon: ChartBarIcon },
  { label: 'Budgets', path: '/budgets', icon: ChartPieIcon },
  { label: 'Savings', path: '/goals', icon: FlagIcon },
  { label: 'Investment', path: '/investments', icon: ChartPieIcon },
  { label: 'Credit Cards', path: '/credit-cards', icon: CreditCardIcon },
  { label: 'Lending', path: '/lending', icon: ArrowsRightLeftIcon },
];

const supportItems = [
  { label: 'Settings', path: '/settings', icon: Cog6ToothIcon },
];

const SidebarLogo = ({ collapsed, isDark }) => (
  <div className="flex items-center gap-2.5">
    <div style={{
      width: 36, height: 36, borderRadius: 10,
      background: 'linear-gradient(135deg, #1abf94 0%, #0e9470 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      boxShadow: '0 4px 12px rgba(26,191,148,0.4)',
    }}>
      {/* WealthFlow icon: upwards trending chart */}
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M3 14l5-5 4 4 9-9" stroke="white" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M15 4h6v6" stroke="white" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
    <AnimatePresence>
      {!collapsed && (
        <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.2 }} style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
          <span style={{ fontWeight: 800, fontSize: 19, letterSpacing: '-0.03em', fontFamily: 'Sora, sans-serif' }}>
            <span style={{ color: isDark ? '#f3f4f6' : '#111827' }}>Wealth</span>
            <span style={{ color: '#1abf94' }}>Flow</span>
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

export default function Sidebar({ mobileMenuOpen, setMobileMenuOpen, onCollapsedChange }) {
  const [collapsed, setCollapsed] = useState(false);
  const { isDark, toggleTheme } = useTheme();
  const { logout } = useAuth();
  const navigate = useNavigate();

  // Theme-aware sidebar colors
  const sidebarBg     = isDark ? '#0b0f1a' : '#ffffff';
  const sidebarBorder = isDark ? '#1a2235' : '#e5e7eb';
  const labelColor    = isDark ? '#4b5563' : '#94a3b8';

  const handleSetCollapsed = (val) => {
    setCollapsed(val);
    if (onCollapsedChange) onCollapsedChange(val);
  };

  const handleLogout = () => { logout(); navigate('/login'); };
  const handleNavClick = () => { if (mobileMenuOpen && setMobileMenuOpen) setMobileMenuOpen(false); };

  const NavSection = ({ title, items }) => (
    <div style={{ marginBottom: 24 }}>
      {!collapsed && (
        <p style={{ color: labelColor, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 12px', marginBottom: 6 }}>{title}</p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {items.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''} ${collapsed ? 'justify-center' : ''}`}
            title={collapsed ? item.label : ''}
            onClick={handleNavClick}
            style={({ isActive }) => ({
              color: isActive ? '#1abf94' : (isDark ? '#9ca3af' : '#374151'),
            })}
          >
            <item.icon style={{ width: 18, height: 18, flexShrink: 0 }} />
            <AnimatePresence>
              {!collapsed && (
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                  {item.label}
                </motion.span>
              )}
            </AnimatePresence>
          </NavLink>
        ))}
      </div>
    </div>
  );

  return (
    <>
      <motion.aside
        animate={{ width: collapsed ? 72 : 220 }}
        transition={{ duration: 0.25, ease: 'easeInOut' }}
        style={{
          position: 'fixed', top: 0, left: 0, height: '100vh', zIndex: 50,
          display: 'flex', flexDirection: 'column',
          background: sidebarBg,
          borderRight: `1px solid ${sidebarBorder}`,
          overflowX: 'hidden',
        }}
        className={mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      >
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 16px 20px', borderBottom: `1px solid ${sidebarBorder}` }}>
          <SidebarLogo collapsed={collapsed} isDark={isDark} />
          <button onClick={() => setMobileMenuOpen(false)} className="md:hidden"
            style={{ color: isDark ? '#6b7280' : '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <XMarkIcon style={{ width: 20, height: 20 }} />
          </button>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '20px 12px 0', overflowY: 'auto' }}>
          <NavSection title="Menu" items={menuItems} />
          <NavSection title="Support" items={supportItems} />
        </nav>

        {/* Bottom */}
        <div style={{ padding: '12px', borderTop: `1px solid ${sidebarBorder}` }}>
          <button onClick={toggleTheme} className={`sidebar-link ${collapsed ? 'justify-center' : ''}`}
            style={{ marginBottom: 2, color: isDark ? '#9ca3af' : '#374151' }}>
            {isDark
              ? <SunIcon style={{ width: 18, height: 18, flexShrink: 0 }} />
              : <MoonIcon style={{ width: 18, height: 18, flexShrink: 0 }} />}
            {!collapsed && <span style={{ fontSize: '0.875rem' }}>{isDark ? 'Light Mode' : 'Dark Mode'}</span>}
          </button>

          <button onClick={handleLogout} className={`sidebar-link ${collapsed ? 'justify-center' : ''}`}
            style={{ color: '#ef4444', marginBottom: 2 }}>
            <ArrowRightOnRectangleIcon style={{ width: 18, height: 18, flexShrink: 0 }} />
            {!collapsed && <span style={{ fontSize: '0.875rem' }}>Logout</span>}
          </button>

          <button onClick={() => handleSetCollapsed(!collapsed)}
            className={`sidebar-link hidden md:flex ${collapsed ? 'justify-center' : ''}`}
            style={{ color: isDark ? '#9ca3af' : '#374151' }}>
            <motion.div animate={{ rotate: collapsed ? 0 : 180 }} transition={{ duration: 0.25 }}>
              <ChevronRightIcon style={{ width: 18, height: 18 }} />
            </motion.div>
            {!collapsed && <span style={{ fontSize: '0.875rem' }}>Collapse</span>}
          </button>
        </div>
      </motion.aside>
    </>
  );
}
