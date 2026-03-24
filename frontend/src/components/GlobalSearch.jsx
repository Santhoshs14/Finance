import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MagnifyingGlassIcon, ArrowsRightLeftIcon, HomeIcon, BanknotesIcon, ChartBarIcon, FlagIcon, CreditCardIcon, ChartPieIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';
import { useData } from '../context/DataContext';
import { useTheme } from '../context/ThemeContext';

const PAGES = [
  { label: 'Dashboard',    path: '/',             icon: HomeIcon },
  { label: 'Transactions', path: '/transactions', icon: ArrowsRightLeftIcon },
  { label: 'Accounts',     path: '/accounts',     icon: BanknotesIcon },
  { label: 'Reports',      path: '/reports',       icon: ChartBarIcon },
  { label: 'Budgets',      path: '/budgets',      icon: ChartPieIcon },
  { label: 'Goals',        path: '/goals',        icon: FlagIcon },
  { label: 'Investments',  path: '/investments',  icon: ChartPieIcon },
  { label: 'Credit Cards', path: '/credit-cards', icon: CreditCardIcon },
  { label: 'Lending',      path: '/lending',      icon: ArrowsRightLeftIcon },
  { label: 'Settings',     path: '/settings',     icon: Cog6ToothIcon },
];

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export default function GlobalSearch({ searchBg, topbarBorder, searchColor, textMuted }) {
  const { transactions, accounts } = useData();
  const { isDark } = useTheme();
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  // ── Build results ──────────────────────────────────────────────
  const results = useCallback(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const out = [];

    // Pages
    PAGES.filter(p => p.label.toLowerCase().includes(q)).forEach(p =>
      out.push({ type: 'page', label: p.label, sub: p.path, icon: p.icon, path: p.path })
    );

    // Accounts
    accounts
      .filter(a => a.name?.toLowerCase().includes(q) || a.type?.toLowerCase().includes(q))
      .slice(0, 3)
      .forEach(a => out.push({
        type: 'account',
        label: a.name,
        sub: `${a.type} · ${fmt(a.balance)}`,
        path: '/accounts',
        icon: BanknotesIcon,
      }));

    // Transactions
    transactions
      .filter(t =>
        t.category?.toLowerCase().includes(q) ||
        t.notes?.toLowerCase().includes(q) ||
        t.payment_type?.toLowerCase().includes(q) ||
        String(t.amount).includes(q)
      )
      .slice(0, 6)
      .forEach(t => out.push({
        type: 'transaction',
        label: `${t.category} — ${fmt(t.amount)}`,
        sub: `${t.date}${t.notes ? ' · ' + t.notes : ''}`,
        path: '/transactions',
        icon: ArrowsRightLeftIcon,
        txnType: t.type,
      }));

    return out;
  }, [query, transactions, accounts])();

  // Reset active index when results change
  useEffect(() => { setActiveIdx(0); }, [results.length]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (item) => {
    setQuery('');
    setOpen(false);
    navigate(item.path);
  };

  const handleKeyDown = (e) => {
    if (!open) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && results[activeIdx]) handleSelect(results[activeIdx]);
    else if (e.key === 'Escape') { setOpen(false); setQuery(''); inputRef.current?.blur(); }
  };

  const dropBg  = isDark ? '#0f1621' : '#ffffff';
  const borderC = isDark ? '#1a2235' : '#e5e7eb';
  const hoverBg = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)';
  const activeBg = isDark ? 'rgba(26,191,148,0.12)' : 'rgba(26,191,148,0.08)';

  const TypeBadge = ({ type, txnType }) => {
    const colors = {
      page:        { bg: 'rgba(99,102,241,0.12)', color: '#818cf8' },
      account:     { bg: 'rgba(59,130,246,0.12)', color: '#60a5fa' },
      transaction: txnType === 'income'
        ? { bg: 'rgba(16,185,129,0.12)', color: '#34d399' }
        : { bg: 'rgba(239,68,68,0.1)',   color: '#f87171' },
    };
    const c = colors[type] || colors.page;
    const label = type === 'transaction' ? (txnType || type) : type;
    return (
      <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '2px 6px', borderRadius: 5, background: c.bg, color: c.color }}>
        {label}
      </span>
    );
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', flex: 1, maxWidth: 400 }}>
      {/* Input */}
      <div style={{ position: 'relative' }}>
        <MagnifyingGlassIcon style={{
          width: 15, height: 15, color: textMuted,
          position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
          pointerEvents: 'none',
        }} />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search transactions, pages, accounts…"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => { if (query) setOpen(true); }}
          onKeyDown={handleKeyDown}
          style={{
            width: '100%',
            background: searchBg,
            border: `1px solid ${open ? '#1abf94' : topbarBorder}`,
            borderRadius: 12,
            padding: '9px 14px 9px 38px',
            fontSize: 13,
            color: searchColor,
            fontFamily: 'inherit',
            outline: 'none',
            transition: 'border-color 0.2s',
          }}
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setOpen(false); inputRef.current?.focus(); }}
            style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: textMuted, fontSize: 16, lineHeight: 1, padding: 2 }}
          >×</button>
        )}
      </div>

      {/* Dropdown */}
      <AnimatePresence>
        {open && query.trim() && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0,
              background: dropBg, border: `1px solid ${borderC}`,
              borderRadius: 14, boxShadow: '0 16px 48px rgba(0,0,0,0.25)',
              overflow: 'hidden', zIndex: 200,
              maxHeight: 420, overflowY: 'auto',
            }}
          >
            {results.length === 0 ? (
              <div style={{ padding: '20px 16px', textAlign: 'center', color: textMuted, fontSize: 13 }}>
                No results for "<strong style={{ color: searchColor }}>{query}</strong>"
              </div>
            ) : (
              <>
                <div style={{ padding: '8px 12px 4px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: textMuted }}>
                  {results.length} result{results.length !== 1 ? 's' : ''}
                </div>
                {results.map((item, i) => {
                  const Icon = item.icon;
                  const isActive = i === activeIdx;
                  return (
                    <button
                      key={i}
                      onMouseEnter={() => setActiveIdx(i)}
                      onClick={() => handleSelect(item)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        width: '100%', padding: '10px 14px',
                        background: isActive ? activeBg : 'transparent',
                        border: 'none', cursor: 'pointer', textAlign: 'left',
                        transition: 'background 0.1s',
                        borderLeft: isActive ? '2px solid #1abf94' : '2px solid transparent',
                      }}
                    >
                      <div style={{
                        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                        background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Icon style={{ width: 16, height: 16, color: isActive ? '#1abf94' : textMuted }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: searchColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.label}
                        </p>
                        {item.sub && (
                          <p style={{ margin: 0, fontSize: 11, color: textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {item.sub}
                          </p>
                        )}
                      </div>
                      <TypeBadge type={item.type} txnType={item.txnType} />
                    </button>
                  );
                })}
              </>
            )}

            {/* Footer hint */}
            <div style={{ padding: '8px 14px', borderTop: `1px solid ${borderC}`, display: 'flex', gap: 12, fontSize: 11, color: textMuted }}>
              <span><kbd style={{ padding: '1px 5px', borderRadius: 4, border: `1px solid ${borderC}`, fontSize: 10 }}>↑↓</kbd> navigate</span>
              <span><kbd style={{ padding: '1px 5px', borderRadius: 4, border: `1px solid ${borderC}`, fontSize: 10 }}>↵</kbd> select</span>
              <span><kbd style={{ padding: '1px 5px', borderRadius: 4, border: `1px solid ${borderC}`, fontSize: 10 }}>Esc</kbd> close</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
