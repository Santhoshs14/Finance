import { db, auth } from '../config/firebase';
import { collection, doc, addDoc, updateDoc, deleteDoc, getDocs, getDoc, setDoc, writeBatch, increment } from 'firebase/firestore';
import * as XLSX from 'xlsx';

const getUserRef = (col) => {
  if (!auth.currentUser) throw new Error("Not authenticated");
  return collection(db, `users/${auth.currentUser.uid}/${col}`);
};

const getDocRef = (col, id) => {
  if (!auth.currentUser) throw new Error("Not authenticated");
  return doc(db, `users/${auth.currentUser.uid}/${col}`, id);
};

const getProfileRef = () => {
  if (!auth.currentUser) throw new Error("Not authenticated");
  return doc(db, `users/${auth.currentUser.uid}`);
};

// Auth
export const authAPI = {
  login: () => { throw new Error('Use AuthContext'); },
  register: () => { throw new Error('Use AuthContext'); },
  updateProfile: () => Promise.resolve({ data: { success: true } }),
  getStats: () => Promise.resolve({ data: {} }),
};

// Profile (user root doc — stores settings like cycleStartDay)
export const profileAPI = {
  get: async () => {
    const snap = await getDoc(getProfileRef());
    return snap.exists() ? snap.data() : {};
  },
  update: async (data) => {
    await setDoc(getProfileRef(), data, { merge: true });
  },
};

// Accounts
export const accountsAPI = {
  create: async (data) => await addDoc(getUserRef('accounts'), data),
  update: async (id, data) => await updateDoc(getDocRef('accounts', id), data),
  delete: async (id) => await deleteDoc(getDocRef('accounts', id)),
};

// Helper: adjust an account's balance by a delta amount
const adjustAccountBalance = async (accountId, delta) => {
  if (!accountId || delta === 0) return;
  try {
    const accRef = getDocRef('accounts', accountId);
    await updateDoc(accRef, { 
      balance: increment(Math.round(delta * 100) / 100) 
    });
  } catch (e) {
    console.warn('Could not update account balance:', e);
  }
};

export const transactionsAPI = {
  create: async (data) => {
    const ref = await addDoc(getUserRef('transactions'), data);
    // Update linked account balance: amount is positive for income, negative for expense
    if (data.account_id && data.amount != null) {
      await adjustAccountBalance(data.account_id, parseFloat(data.amount));
    }
    return ref;
  },
  update: async (id, data) => {
    // Read the old transaction to reverse its effect before applying new one
    const oldSnap = await getDoc(getDocRef('transactions', id));
    await updateDoc(getDocRef('transactions', id), data);
    if (oldSnap.exists()) {
      const old = oldSnap.data();
      const oldAccountId = old.account_id;
      const newAccountId = data.account_id ?? oldAccountId;
      const oldAmount = parseFloat(old.amount || 0);
      const newAmount = parseFloat(data.amount ?? old.amount ?? 0);

      if (oldAccountId === newAccountId) {
        // Same account — apply net delta
        if (oldAccountId) {
          await adjustAccountBalance(oldAccountId, newAmount - oldAmount);
        }
      } else {
        // Account changed — reverse old, apply new
        if (oldAccountId) await adjustAccountBalance(oldAccountId, -oldAmount);
        if (newAccountId) await adjustAccountBalance(newAccountId, newAmount);
      }
    }
  },
  delete: async (id) => {
    // Read the transaction before deleting to reverse balance effect
    const snap = await getDoc(getDocRef('transactions', id));
    await deleteDoc(getDocRef('transactions', id));
    if (snap.exists()) {
      const txData = snap.data();
      if (txData.account_id && txData.amount != null) {
        await adjustAccountBalance(txData.account_id, -parseFloat(txData.amount));
      }
    }
  },
  deleteAll: async () => {
    const snap = await getDocs(getUserRef('transactions'));
    const batch = writeBatch(db);
    snap.forEach(d => batch.delete(d.ref));
    await batch.commit();
    return { data: { message: 'All transactions cleared!' } };
  },
};

// Budgets
export const budgetsAPI = {
  create: async (data) => await addDoc(getUserRef('budgets'), data),
  update: async (id, data) => await updateDoc(getDocRef('budgets', id), data),
  delete: async (id) => await deleteDoc(getDocRef('budgets', id)),
};

// Categories (custom, shared across budgets & transactions)
export const categoriesAPI = {
  create: async (data) => await addDoc(getUserRef('categories'), data),
  delete: async (id) => await deleteDoc(getDocRef('categories', id)),
};

// Budget Snapshots — stored per cycle key, e.g. "2026-03"
export const budgetSnapshotsAPI = {
  get: async (cycleKey) => {
    const snap = await getDoc(doc(db, `users/${auth.currentUser.uid}/budgetSnapshots/${cycleKey}`));
    return snap.exists() ? snap.data() : null;
  },
  save: async (cycleKey, limits) => {
    await setDoc(
      doc(db, `users/${auth.currentUser.uid}/budgetSnapshots/${cycleKey}`),
      { limits, updatedAt: new Date().toISOString() },
      { merge: true }
    );
  },
};


// Credit Cards
export const creditCardsAPI = {
  create: async (data) => await addDoc(getUserRef('creditCards'), data),
  update: async (id, data) => await updateDoc(getDocRef('creditCards', id), data),
  delete: async (id) => await deleteDoc(getDocRef('creditCards', id)),
  createTransaction: async (data) => await addDoc(getUserRef('transactions'), data),
};

// Investments
export const investmentsAPI = {
  create: async (data) => await addDoc(getUserRef('investments'), data),
  update: async (id, data) => await updateDoc(getDocRef('investments', id), data),
  delete: async (id) => await deleteDoc(getDocRef('investments', id)),
};

// Mutual Funds
export const mutualFundsAPI = {
  create: async (data) => await addDoc(getUserRef('mutualFunds'), data),
};

// Goals
export const goalsAPI = {
  create: async (data) => await addDoc(getUserRef('goals'), data),
  update: async (id, data) => await updateDoc(getDocRef('goals', id), data),
  delete: async (id) => await deleteDoc(getDocRef('goals', id)),
};

// Lending
export const lendingAPI = {
  create: async (data) => await addDoc(getUserRef('lending'), data),
  update: async (id, data) => await updateDoc(getDocRef('lending', id), data),
  delete: async (id) => await deleteDoc(getDocRef('lending', id)),
};

export const reportsAPI = {
  getMonthly: () => Promise.resolve({ data: { data: [] } }),
  getYearly: () => Promise.resolve({ data: { data: [] } }),
};

export const importAPI = {
  uploadExcel: async (file, isPreview, accountId) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = e.target.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const firstSheet = workbook.SheetNames[0];
          const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { raw: false });

          const transactions = rows.map(row => {
            const dateStr = row.Date || row.date || new Date().toISOString().split('T')[0];
            const amount = parseFloat(row.Amount || row.amount || 0);
            const category = row.Category || row.category || 'Other';
            const notes = row.Notes || row.notes || '';
            const type = row.Type || row.type || (amount >= 0 ? 'income' : 'expense');

            return {
              date: dateStr,
              amount: amount,
              category,
              notes,
              type,
              account_id: accountId || null,
              created_at: new Date().toISOString()
            };
          }).filter(t => !isNaN(t.amount) && t.amount !== 0);

          if (isPreview) {
            resolve({ data: { data: transactions } });
          } else {
            const batch = writeBatch(db);
            const userRef = collection(db, `users/${auth.currentUser.uid}/transactions`);
            transactions.forEach(txn => {
              const newRef = doc(userRef);
              batch.set(newRef, txn);
            });
            await batch.commit();
            resolve({ data: { data: transactions } });
          }
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = (error) => reject(error);
      reader.readAsBinaryString(file);
    });
  }
};

export const insightsAPI = {
  get: () => Promise.resolve({ data: { data: [] } }),
};

export const calculationsAPI = {
  get: () => Promise.resolve({ data: { data: {} } }),
  getSnapshots: () => Promise.resolve({ data: { data: [] } }),
};

export default {};
