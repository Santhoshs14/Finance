import { db, auth } from '../config/firebase';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { transactionsAPI, budgetSnapshotsAPI } from '../services/api';
import { calculateNetWorth } from './calculations';

const runRecurringTransactions = async (uid, todayStr) => {
  try {
    const q = query(
      collection(db, `users/${uid}/transactions`),
      where('is_recurring', '==', true),
      where('next_date', '<=', todayStr)
    );
    const snap = await getDocs(q);

    if (snap.empty) return;

    // Use transactionsAPI.create to ensure atomicity with balances and aggregates
    for (const d of snap.docs) {
      const data = d.data();
      const currentDate = new Date(data.next_date);

      if (data.recurrence_interval === 'monthly') {
        currentDate.setMonth(currentDate.getMonth() + 1);
      } else if (data.recurrence_interval === 'weekly') {
        currentDate.setDate(currentDate.getDate() + 7);
      } else if (data.recurrence_interval === 'yearly') {
        currentDate.setFullYear(currentDate.getFullYear() + 1);
      }
      
      const nextDate = currentDate.toISOString().split('T')[0];

      // Remove recurrence fields for the actual instance created today
      const { id, is_recurring, recurrence_interval, next_date, created_at, ...txnData } = data;
      txnData.date = data.next_date; // Create it exactly on its due date

      // 1. Create the instance
      // Note: we pass 25 explicitly as default, but in production we'd want to fetch cycleStartDay.
      // Assuming 25 by default inside transactionsAPI is okay if not specified.
      await transactionsAPI.create(txnData, 25);

      // 2. Update the definition document to the next date
      await transactionsAPI.update(d.id, { next_date: nextDate }, 25);
    }
  } catch (error) {
    console.error('Failed processing recurring transactions:', error);
  }
};

const recordNetWorthSnapshot = async (uid, todayStr) => {
  try {
    const today = new Date();
    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    
    // Only capture on the last day of the calendar month
    if (tomorrow.getDate() !== 1) return;

    // Fast-check if today's snapshot already exists
    const snapId = todayStr.substring(0, 7); // YYYY-MM
    const existing = await getDoc(doc(db, `users/${uid}/net_worth_snapshots/${snapId}`));
    if (existing.exists()) return;

    // Gather aggregates
    const [accSnap, invSnap, lendSnap] = await Promise.all([
      getDocs(collection(db, `users/${uid}/accounts`)),
      getDocs(collection(db, `users/${uid}/investments`)),
      getDocs(collection(db, `users/${uid}/lending`))
    ]);

    const accounts = accSnap.docs.map(d => d.data());
    const investments = invSnap.docs.map(d => d.data());
    const lending = lendSnap.docs.map(d => d.data());

    const nw = calculateNetWorth(accounts, investments, lending);

    await setDoc(doc(db, `users/${uid}/net_worth_snapshots/${snapId}`), {
      date: todayStr,
      net_worth: nw.net_worth,
      total_accounts: nw.total_accounts,
      total_investments: nw.total_investments,
      total_debt: nw.total_cc_outstanding,
      created_at: new Date().toISOString()
    });
  } catch (err) {
    console.error('Failed to record NW snapshot', err);
  }
};

/**
 * Ensures system tasks run once per day upon active use.
 * Safe Lazy Execution.
 */
export const runDailyCronJobs = async () => {
  if (!auth.currentUser) return;
  const uid = auth.currentUser.uid;
  const profileRef = doc(db, `users/${uid}`);

  try {
    const profileSnap = await getDoc(profileRef);
    const todayStr = new Date().toISOString().split('T')[0];
    const profileData = profileSnap.exists() ? profileSnap.data() : {};
    
    const lastCronRun = profileData.lastCronRun || '1970-01-01';

    if (lastCronRun >= todayStr) {
      // Already ran today (or in the future, if user travels across timezones)
      return;
    }

    console.log('Executing background cron operations...', { lastCronRun, todayStr });

    // 1. Process recurring tasks sequentially to avoid overwhelming rate limits
    await runRecurringTransactions(uid, todayStr);
    
    // 2. Net worth snapshot (only executes logic if today is EOM)
    await recordNetWorthSnapshot(uid, todayStr);

    // Commit timestamp
    await setDoc(profileRef, { lastCronRun: todayStr }, { merge: true });
    
  } catch (error) {
    console.error('Critical cron failure:', error);
  }
};
