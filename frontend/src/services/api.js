import { db, auth } from '../config/firebase';
import { collection, doc, addDoc, updateDoc, deleteDoc, getDocs, writeBatch } from 'firebase/firestore';
import * as XLSX from 'xlsx';

const getUserRef = (col) => {
  if (!auth.currentUser) throw new Error("Not authenticated");
  return collection(db, `users/${auth.currentUser.uid}/${col}`);
};

const getDocRef = (col, id) => {
  if (!auth.currentUser) throw new Error("Not authenticated");
  return doc(db, `users/${auth.currentUser.uid}/${col}`, id);
};

// Auth
export const authAPI = {
  login: () => { throw new Error('Use AuthContext'); },
  register: () => { throw new Error('Use AuthContext'); },
  updateProfile: () => Promise.resolve({ data: { success: true } }),
  getStats: () => Promise.resolve({ data: {} }),
};

// Accounts
export const accountsAPI = {
  create: async (data) => await addDoc(getUserRef('accounts'), data),
  update: async (id, data) => await updateDoc(getDocRef('accounts', id), data),
  delete: async (id) => await deleteDoc(getDocRef('accounts', id)),
};

export const transactionsAPI = {
  create: async (data) => await addDoc(getUserRef('transactions'), data),
  update: async (id, data) => await updateDoc(getDocRef('transactions', id), data),
  delete: async (id) => await deleteDoc(getDocRef('transactions', id)),
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

