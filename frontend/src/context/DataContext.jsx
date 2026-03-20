import { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../config/firebase';
import { collection, doc, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { useAuth } from './AuthContext';

const DataContext = createContext(null);

export const DataProvider = ({ children }) => {
  const { currentUser } = useAuth();
  
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [budgets, setBudgets] = useState([]);
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

      const txQuery = query(collection(db, `users/${uid}/transactions`), orderBy('date', 'desc'), limit(100));
      const txUnsub = onSnapshot(txQuery, (snapshot) => {
        setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
      unsubscribes.push(txUnsub);

      const budgetsUnsub = onSnapshot(collection(db, `users/${uid}/budgets`), (snapshot) => {
        setBudgets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
      unsubscribes.push(budgetsUnsub);

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

