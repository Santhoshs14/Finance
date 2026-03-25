import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { db } from '../config/firebase';
import { collection, doc, onSnapshot, query, orderBy, limit, addDoc, writeBatch } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { getFinancialCycle } from '../utils/financialMonth';

const DataContext = createContext(null);

// Default categories seeded on first login
const DEFAULT_CATEGORIES = [
  { name: 'Investment',    color: '#6366f1' },
  { name: 'Rent',          color: '#f59e0b' },
  { name: 'Home',          color: '#8b5cf6' },
  { name: 'Food',          color: '#ef4444' },
  { name: 'Travel',        color: '#3b82f6' },
  { name: 'Petrol',        color: '#f97316' },
  { name: 'Entertainment', color: '#ec4899' },
  { name: 'Shopping',      color: '#14b8a6' },
  { name: 'Bills',         color: '#64748b' },
  { name: 'Utilities',     color: '#eab308' },
  { name: 'Subscription',  color: '#06b6d4' },
  { name: 'Lending',       color: '#84cc16' },
  { name: 'Gifts',         color: '#f43f5e' },
  { name: 'Income',        color: '#10b981' },
  { name: 'Other',         color: '#94a3b8' },
];

export const DataProvider = ({ children }) => {
  const { currentUser } = useAuth();

  const [accounts, setAccounts]       = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [budgets, setBudgets]         = useState([]);
  const [categories, setCategories]   = useState([]);
  const [investments, setInvestments] = useState([]);
  const [goals, setGoals]             = useState([]);
  const [lending, setLending]         = useState([]);
  const [cycleStartDay, setCycleStartDay] = useState(25);
  const [monthlySalary, setMonthlySalary] = useState(0);
  const [currentAggregate, setCurrentAggregate] = useState({
    totalSpent: 0, totalIncome: 0, categoryBreakdown: {},
  });

  useEffect(() => {
    let unsubscribes = [];

    const cleanup = () => {
      unsubscribes.forEach(u => u());
      unsubscribes = [];
    };

    if (!currentUser) {
      setAccounts([]);
      setTransactions([]);
      setBudgets([]);
      setCategories([]);
      setInvestments([]);
      setGoals([]);
      setLending([]);
      setCycleStartDay(25);
      setMonthlySalary(0);
      setCurrentAggregate({ totalSpent: 0, totalIncome: 0, categoryBreakdown: {} });
      return cleanup;
    }

    const uid = currentUser.uid;

    // ── Profile (cycleStartDay & monthlySalary) ──
    unsubscribes.push(
      onSnapshot(doc(db, `users/${uid}`), (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setCycleStartDay(data.cycleStartDay || 25);
          setMonthlySalary(data.monthlySalary || 0);
        }
      })
    );

    // ── Accounts ──
    unsubscribes.push(
      onSnapshot(collection(db, `users/${uid}/accounts`), (snap) => {
        setAccounts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      })
    );

    // ── Transactions (latest 200) ──
    const txQuery = query(
      collection(db, `users/${uid}/transactions`),
      orderBy('date', 'desc'),
      limit(200)
    );
    unsubscribes.push(
      onSnapshot(txQuery, (snap) => {
        const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        fetched.sort((a, b) => {
          const dateCmp = b.date.localeCompare(a.date);
          if (dateCmp !== 0) return dateCmp;
          return (b.createdAt || '').localeCompare(a.createdAt || '');
        });
        setTransactions(fetched);
      })
    );

    // ── Budgets (moved to Budgets page) ──
    // ── Categories — seed defaults if empty ──
    const categoriesRef = collection(db, `users/${uid}/categories`);
    unsubscribes.push(
      onSnapshot(categoriesRef, async (snap) => {
        if (snap.empty) {
          const batch = writeBatch(db);
          DEFAULT_CATEGORIES.forEach(cat => {
            const slug = cat.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
            const docRef = doc(db, `users/${uid}/categories/${slug}`);
            batch.set(docRef, { ...cat, createdAt: new Date().toISOString() });
          });
          await batch.commit();
        } else {
          setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        }
      })
    );



    // ── Investments, Goals, Lending (moved to respective pages) ──



    return cleanup;
  }, [currentUser]);

  // ── Re-subscribe to aggregates when cycleStartDay changes ──
  useEffect(() => {
    if (!currentUser) return;
    const uid = currentUser.uid;
    const cycle = getFinancialCycle(new Date(), cycleStartDay);
    const unsub = onSnapshot(
      doc(db, `users/${uid}/aggregates/${cycle.cycleKey}`),
      (snap) => {
        if (snap.exists()) setCurrentAggregate(snap.data());
        else setCurrentAggregate({ totalSpent: 0, totalIncome: 0, categoryBreakdown: {} });
      }
    );
    return () => unsub();
  }, [currentUser, cycleStartDay]);

  const getCategoryById = useCallback(
    (id) => categories.find(c => c.id === id) || null,
    [categories]
  );

  const creditCards = useMemo(() => accounts.filter(a => a.type === 'credit'), [accounts]);

  const getCategoryByName = useCallback(
    (name) => categories.find(c => c.name === name) || null,
    [categories]
  );

  const value = useMemo(() => ({
    accounts,
    transactions,
    budgets,
    categories,
    creditCards,
    investments,
    goals,
    lending,
    cycleStartDay,
    monthlySalary,
    currentAggregate,
    getCategoryById,
    getCategoryByName,
  }), [
    accounts, transactions, budgets, categories, creditCards,
    investments, goals, lending, cycleStartDay, monthlySalary, currentAggregate,
    getCategoryById, getCategoryByName,
  ]);

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
};
