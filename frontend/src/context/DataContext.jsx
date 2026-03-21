import { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../config/firebase';
import { collection, doc, onSnapshot, query, orderBy, limit, getDocs, addDoc } from 'firebase/firestore';
import { useAuth } from './AuthContext';

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

  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [creditCards, setCreditCards] = useState([]);
  const [investments, setInvestments] = useState([]);
  const [goals, setGoals] = useState([]);
  const [lending, setLending] = useState([]);
  const [cycleStartDay, setCycleStartDay] = useState(25);

  useEffect(() => {
    let unsubscribes = [];

    const unsubscribeFirestoreListeners = () => {
      unsubscribes.forEach(unsub => unsub());
      unsubscribes = [];
    };

    if (currentUser) {
      const uid = currentUser.uid;

      // Listen to user profile doc for cycleStartDay
      const profileUnsub = onSnapshot(doc(db, `users/${uid}`), (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setCycleStartDay(data.cycleStartDay || 25);
        }
      });
      unsubscribes.push(profileUnsub);

      const accountsUnsub = onSnapshot(collection(db, `users/${uid}/accounts`), (snapshot) => {
        setAccounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
      unsubscribes.push(accountsUnsub);

      const txQuery = query(collection(db, `users/${uid}/transactions`), orderBy('date', 'desc'), limit(500));
      const txUnsub = onSnapshot(txQuery, (snapshot) => {
        setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
      unsubscribes.push(txUnsub);

      const budgetsUnsub = onSnapshot(collection(db, `users/${uid}/budgets`), (snapshot) => {
        setBudgets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
      unsubscribes.push(budgetsUnsub);

      // Categories — listen and seed defaults if empty
      const categoriesRef = collection(db, `users/${uid}/categories`);
      const catUnsub = onSnapshot(categoriesRef, async (snapshot) => {
        if (snapshot.empty) {
          // Seed defaults
          const batch = DEFAULT_CATEGORIES.map(cat => addDoc(categoriesRef, cat));
          await Promise.all(batch);
        } else {
          setCategories(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        }
      });
      unsubscribes.push(catUnsub);

      const ccUnsub = onSnapshot(collection(db, `users/${uid}/creditCards`), (snapshot) => {
        setCreditCards(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
      unsubscribes.push(ccUnsub);

      const invUnsub = onSnapshot(collection(db, `users/${uid}/investments`), (snapshot) => {
        setInvestments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
      unsubscribes.push(invUnsub);

      const goalsUnsub = onSnapshot(collection(db, `users/${uid}/goals`), (snapshot) => {
        setGoals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
      unsubscribes.push(goalsUnsub);

      const lendingUnsub = onSnapshot(collection(db, `users/${uid}/lending`), (snapshot) => {
        setLending(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
      unsubscribes.push(lendingUnsub);

    } else {
      setAccounts([]);
      setTransactions([]);
      setBudgets([]);
      setCategories([]);
      setCreditCards([]);
      setInvestments([]);
      setGoals([]);
      setLending([]);
      setCycleStartDay(25);
      unsubscribeFirestoreListeners();
    }

    return () => {
      unsubscribeFirestoreListeners();
    };
  }, [currentUser]);

  return (
    <DataContext.Provider value={{
      accounts,
      transactions,
      budgets,
      categories,
      creditCards,
      investments,
      goals,
      lending,
      cycleStartDay,
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData must be used within DataProvider');
  return context;
};
