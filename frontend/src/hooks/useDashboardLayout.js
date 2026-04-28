import { useState, useCallback, useEffect } from 'react';

// ─── Widget Registry ───────────────────────────────────────────────────────────
// Single source of truth for all dashboard widgets.
// Order here = default order for new users.
export const WIDGET_REGISTRY = [
  {
    id: 'kpi_cards',
    title: 'KPI Overview',
    description: 'Net worth, balance, savings & liabilities',
    icon: '📊',
    defaultSize: 'large',
    allowedSizes: ['large'],
    removable: false, // always visible
  },
  {
    id: 'cash_flow',
    title: 'Cash Flow',
    description: 'Income, expenses, and cycle progress',
    icon: '💸',
    defaultSize: 'large',
    allowedSizes: ['medium', 'large'],
  },
  {
    id: 'health_score',
    title: 'Financial Health',
    description: 'Composite health score gauge',
    icon: '❤️',
    defaultSize: 'medium',
    allowedSizes: ['medium', 'large'],
  },
  {
    id: 'heatmap',
    title: 'Spending Heatmap',
    description: 'Daily spend intensity (last 35 days)',
    icon: '🔥',
    defaultSize: 'large',
    allowedSizes: ['medium', 'large'],
  },
  {
    id: 'category_chart',
    title: 'Category Breakdown',
    description: 'Spending by category this cycle',
    icon: '🥧',
    defaultSize: 'medium',
    allowedSizes: ['medium', 'large'],
  },
  {
    id: 'budget_progress',
    title: 'Budget Progress',
    description: 'Spending vs budget limits',
    icon: '🎯',
    defaultSize: 'medium',
    allowedSizes: ['medium', 'large'],
  },
  {
    id: 'risk_alerts',
    title: 'Risk & Recommendations',
    description: 'Alerts, smart tips, and spending leaks',
    icon: '⚠️',
    defaultSize: 'large',
    allowedSizes: ['medium', 'large'],
  },
  {
    id: 'behavioral',
    title: 'Behavioral Insights',
    description: 'Patterns, daily avg, and top categories',
    icon: '🧠',
    defaultSize: 'medium',
    allowedSizes: ['medium', 'large'],
  },
  {
    id: 'recent_txns',
    title: 'Recent Transactions',
    description: 'Latest activity feed',
    icon: '🔄',
    defaultSize: 'large',
    allowedSizes: ['medium', 'large'],
  },
  {
    id: 'goals',
    title: 'Goals & Credit Health',
    description: 'Goal progress and credit card utilization',
    icon: '🏆',
    defaultSize: 'large',
    allowedSizes: ['medium', 'large'],
  },
];

// Build the default layout from the registry
const buildDefaultLayout = () =>
  WIDGET_REGISTRY.map((w) => ({
    id: w.id,
    visible: true,
    size: w.defaultSize,
  }));

// ─── Hook ──────────────────────────────────────────────────────────────────────
export function useDashboardLayout(uid) {
  const storageKey = uid ? `wf_dashboard_layout_${uid}` : null;

  const loadLayout = useCallback(() => {
    if (!storageKey) return buildDefaultLayout();
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return buildDefaultLayout();
      const saved = JSON.parse(raw);
      // Merge saved with registry — add any NEW widgets at the end,
      // and remove any old ones that no longer exist in registry.
      const registryIds = new Set(WIDGET_REGISTRY.map((w) => w.id));
      const savedIds = new Set(saved.map((w) => w.id));
      const merged = saved.filter((w) => registryIds.has(w.id));
      WIDGET_REGISTRY.forEach((w) => {
        if (!savedIds.has(w.id)) {
          merged.push({ id: w.id, visible: true, size: w.defaultSize });
        }
      });
      // Enforce non-removable widgets as always visible
      return merged.map((w) => {
        const reg = WIDGET_REGISTRY.find((r) => r.id === w.id);
        return reg?.removable === false ? { ...w, visible: true } : w;
      });
    } catch {
      return buildDefaultLayout();
    }
  }, [storageKey]);

  const [layout, setLayoutState] = useState(loadLayout);

  // Persist whenever layout changes
  useEffect(() => {
    if (!storageKey) return;
    localStorage.setItem(storageKey, JSON.stringify(layout));
  }, [layout, storageKey]);

  // Reload layout when uid changes (user switch)
  useEffect(() => {
    setLayoutState(loadLayout());
  }, [storageKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const setLayout = useCallback((newLayout) => {
    setLayoutState(newLayout);
  }, []);

  const toggleWidget = useCallback((id) => {
    setLayoutState((prev) =>
      prev.map((w) => (w.id === id ? { ...w, visible: !w.visible } : w))
    );
  }, []);

  const resizeWidget = useCallback((id, size) => {
    setLayoutState((prev) =>
      prev.map((w) => (w.id === id ? { ...w, size } : w))
    );
  }, []);

  const resetLayout = useCallback(() => {
    setLayoutState(buildDefaultLayout());
    if (storageKey) localStorage.removeItem(storageKey);
  }, [storageKey]);

  return { layout, setLayout, toggleWidget, resizeWidget, resetLayout };
}
