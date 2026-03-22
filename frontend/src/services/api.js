import { db, auth } from '../config/firebase';
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, getDoc, setDoc, writeBatch, increment,
  serverTimestamp, query, orderBy, limit,
} from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { getFinancialCycleForDate } from '../utils/financialMonth';

/* ─────────────────────────────────────────────
   Helpers
───────────────────────────────────────────── */
const getUid = () => {
  if (!auth.currentUser) throw new Error('Not authenticated');
  return auth.currentUser.uid;
};

const getUserRef = (col) => collection(db, `users/${getUid()}/${col}`);

const getDocRef = (col, id) => doc(db, `users/${getUid()}/${col}`, id);

const getProfileRef = () => doc(db, `users/${getUid()}`);

/* ─────────────────────────────────────────────
   Account balance helper (used internally)
───────────────────────────────────────────── */
const adjustAccountBalance = async (batch, accountId, delta) => {
  if (!accountId || delta === 0 || isNaN(delta)) return;
  const accRef = getDocRef('accounts', accountId);
  batch.update(accRef, { balance: increment(Math.round(delta * 100) / 100) });
};

/* ─────────────────────────────────────────────
   Aggregates helper — update cycle aggregate doc
   delta: { totalSpent?: number, totalIncome?: number, categoryName?: string, categoryDelta?: number }
───────────────────────────────────────────── */
const applyAggregateDelta = (batch, uid, cycleKey, delta) => {
  const aggRef = doc(db, `users/${uid}/aggregates/${cycleKey}`);
  const update = { updatedAt: new Date().toISOString() };

  if (delta.totalSpent)  update.totalSpent  = increment(delta.totalSpent);
  if (delta.totalIncome) update.totalIncome = increment(delta.totalIncome);

  if (delta.categoryName && delta.categoryDelta) {
    update[`categoryBreakdown.${delta.categoryName}`] = increment(delta.categoryDelta);
  }

  batch.set(aggRef, update, { merge: true });
};

/**
 * Given a transaction doc, compute what aggregate delta it contributes (positive = adding it).
 */
const txnToAggregateDelta = (txData, sign = 1) => {
  const amount = parseFloat(txData.amount || 0);
  const cycleKey = txData._cycleKey; // injected before calling
  if (!cycleKey) return null;

  const isTransfer = txData.payment_type === 'Transfer' || 
                     txData.category?.toLowerCase() === 'transfer' || 
                     txData.category?.toLowerCase() === 'credit card payment';

  if (isTransfer) return null;

  if (amount > 0) {
    // Income
    return { cycleKey, totalIncome: sign * amount, totalSpent: 0, categoryName: txData.category, categoryDelta: sign * amount };
  } else if (amount < 0) {
    // Expense
    const spent = Math.abs(amount);
    return { cycleKey, totalSpent: sign * spent, totalIncome: 0, categoryName: txData.category, categoryDelta: sign * spent };
  }
  return null;
};

/* ─────────────────────────────────────────────
   Auth API
───────────────────────────────────────────── */
export const authAPI = {
  login: () => { throw new Error('Use AuthContext'); },
  register: () => { throw new Error('Use AuthContext'); },
  updateProfile: () => Promise.resolve({ data: { success: true } }),
  getStats: () => Promise.resolve({ data: {} }),
};

/* ─────────────────────────────────────────────
   Profile API
───────────────────────────────────────────── */
export const profileAPI = {
  get: async () => {
    const snap = await getDoc(getProfileRef());
    return snap.exists() ? snap.data() : {};
  },
  update: async (data) => {
    await setDoc(getProfileRef(), data, { merge: true });
  },
};

/* ─────────────────────────────────────────────
   Accounts API
───────────────────────────────────────────── */
export const accountsAPI = {
  create: async (data) => await addDoc(getUserRef('accounts'), data),
  update: async (id, data) => await updateDoc(getDocRef('accounts', id), data),
  delete: async (id) => await deleteDoc(getDocRef('accounts', id)),

  /**
   * Recalculate an account's balance from all its transactions (fail-safe).
   */
  recalculateBalance: async (accountId) => {
    const uid = getUid();
    const txSnap = await getDocs(collection(db, `users/${uid}/transactions`));
    let balance = 0;
    txSnap.forEach(d => {
      const t = d.data();
      if (t.account_id === accountId && t.amount != null) {
        balance += parseFloat(t.amount);
      }
    });
    await updateDoc(doc(db, `users/${uid}/accounts/${accountId}`), { balance: Math.round(balance * 100) / 100 });
    return balance;
  },
};

/* ─────────────────────────────────────────────
   Transactions API — Atomic operations
───────────────────────────────────────────── */
export const transactionsAPI = {
  /**
   * Create a transaction atomically:
   * - Write transaction doc
   * - Update account balance
   * - Update aggregates for the cycle
   */
  create: async (data, cycleStartDay = 25) => {
    const uid = getUid();
    // Validate
    const amount = parseFloat(data.amount);
    if (isNaN(amount) || amount === 0) throw new Error('Invalid amount');

    const cycle = getFinancialCycleForDate(data.date, cycleStartDay);
    const txData = { ...data, amount, _cycleKey: cycle.cycleKey, createdAt: new Date().toISOString() };

    const batch = writeBatch(db);

    // 1. Transaction doc
    const txRef = doc(collection(db, `users/${uid}/transactions`));
    batch.set(txRef, txData);

    // 2. Account balance / liability
    if (data.account_id) {
      const accRef = doc(db, `users/${uid}/accounts/${data.account_id}`);
      const accSnap = await getDoc(accRef);
      const accType = accSnap.exists() ? accSnap.data().type : 'bank';
      if (accType === 'credit') {
        const delta = -amount;
        batch.update(accRef, { liability: increment(Math.round(delta * 100) / 100) });
      } else {
        batch.update(accRef, { balance: increment(Math.round(amount * 100) / 100) });
      }
    }

    // 3. Aggregates
    const delta = txnToAggregateDelta(txData, 1);
    if (delta) {
      const aggRef = doc(db, `users/${uid}/aggregates/${cycle.cycleKey}`);
      const aggUpdate = { updatedAt: new Date().toISOString() };
      if (amount > 0) {
        aggUpdate.totalIncome = increment(amount);
      } else {
        aggUpdate.totalSpent = increment(Math.abs(amount));
      }
      if (txData.category) {
        aggUpdate[`categoryBreakdown.${txData.category}`] = increment(Math.abs(amount));
      }
      batch.set(aggRef, aggUpdate, { merge: true });
    }

    await batch.commit();
    return { id: txRef.id };
  },

  /**
   * Update a transaction atomically:
   * - Reverse old balance + aggregate impact
   * - Apply new balance + aggregate impact
   */
  update: async (id, data, cycleStartDay = 25) => {
    const uid = getUid();

    // Read old transaction
    const oldSnap = await getDoc(doc(db, `users/${uid}/transactions/${id}`));
    if (!oldSnap.exists()) throw new Error('Transaction not found');

    const old = oldSnap.data();
    const oldAmount = parseFloat(old.amount || 0);
    const newAmount = parseFloat(data.amount ?? old.amount ?? 0);
    const oldAccountId = old.account_id;
    const newAccountId = data.account_id ?? oldAccountId;
    const oldCycleKey = old._cycleKey || getFinancialCycleForDate(old.date, cycleStartDay).cycleKey;
    const newCycle = getFinancialCycleForDate(data.date || old.date, cycleStartDay);
    const newCycleKey = newCycle.cycleKey;

    const newData = {
      ...old, ...data,
      amount: newAmount,
      _cycleKey: newCycleKey,
      updatedAt: new Date().toISOString(),
    };

    const batch = writeBatch(db);

    // 1. Update transaction doc
    batch.update(doc(db, `users/${uid}/transactions/${id}`), newData);

    // 2. Reverse & reapply account balance/liability
    const getAccountType = async (accId) => {
      if (!accId) return null;
      const snap = await getDoc(doc(db, `users/${uid}/accounts/${accId}`));
      return snap.exists() ? snap.data().type : 'bank';
    };

    if (oldAccountId === newAccountId) {
      if (oldAccountId) {
        const type = await getAccountType(oldAccountId);
        let balDelta = newAmount - oldAmount;
        
        if (balDelta !== 0) {
          if (type === 'credit') {
            batch.update(doc(db, `users/${uid}/accounts/${oldAccountId}`), {
              liability: increment(Math.round(-balDelta * 100) / 100),
            });
          } else {
            batch.update(doc(db, `users/${uid}/accounts/${oldAccountId}`), {
              balance: increment(Math.round(balDelta * 100) / 100),
            });
          }
        }
      }
    } else {
      if (oldAccountId) {
        const type = await getAccountType(oldAccountId);
        if (type === 'credit') {
          batch.update(doc(db, `users/${uid}/accounts/${oldAccountId}`), {
            liability: increment(Math.round(oldAmount * 100) / 100),
          });
        } else {
          batch.update(doc(db, `users/${uid}/accounts/${oldAccountId}`), {
            balance: increment(Math.round(-oldAmount * 100) / 100),
          });
        }
      }
      if (newAccountId) {
        const type = await getAccountType(newAccountId);
        if (type === 'credit') {
          batch.update(doc(db, `users/${uid}/accounts/${newAccountId}`), {
            liability: increment(Math.round(-newAmount * 100) / 100),
          });
        } else {
          batch.update(doc(db, `users/${uid}/accounts/${newAccountId}`), {
            balance: increment(Math.round(newAmount * 100) / 100),
          });
        }
      }
    }

    // 3. Reverse old aggregate
    const reverseOldAgg = (aggCycleKey, txData, sign) => {
      const aggRef = doc(db, `users/${uid}/aggregates/${aggCycleKey}`);
      const upd = { updatedAt: new Date().toISOString() };
      const amt = parseFloat(txData.amount || 0);
      if (amt > 0) {
        upd.totalIncome = increment(sign * amt);
      } else if (amt < 0) {
        upd.totalSpent = increment(sign * Math.abs(amt));
      }
      if (txData.category) {
        upd[`categoryBreakdown.${txData.category}`] = increment(sign * Math.abs(amt));
      }
      batch.set(aggRef, upd, { merge: true });
    };

    reverseOldAgg(oldCycleKey, old, -1);
    reverseOldAgg(newCycleKey, newData, 1);

    await batch.commit();
  },

  /**
   * Delete a transaction atomically:
   * - Reverse account balance
   * - Reverse aggregates
   */
  delete: async (id, cycleStartDay = 25) => {
    const uid = getUid();

    const snap = await getDoc(doc(db, `users/${uid}/transactions/${id}`));
    if (!snap.exists()) {
      await deleteDoc(doc(db, `users/${uid}/transactions/${id}`));
      return;
    }

    const txData = snap.data();
    const amount = parseFloat(txData.amount || 0);
    const cycleKey = txData._cycleKey || getFinancialCycleForDate(txData.date, cycleStartDay).cycleKey;

    const batch = writeBatch(db);

    // 1. Delete transaction
    batch.delete(doc(db, `users/${uid}/transactions/${id}`));

    // 2. Reverse account balance/liability
    if (txData.account_id && amount !== 0) {
      const accRef = doc(db, `users/${uid}/accounts/${txData.account_id}`);
      const accSnap = await getDoc(accRef);
      const accType = accSnap.exists() ? accSnap.data().type : 'bank';
      if (accType === 'credit') {
        batch.update(accRef, { liability: increment(Math.round(amount * 100) / 100) });
      } else {
        batch.update(accRef, { balance: increment(Math.round(-amount * 100) / 100) });
      }
    }

    // 3. Reverse aggregates
    const aggRef = doc(db, `users/${uid}/aggregates/${cycleKey}`);
    const aggUpd = { updatedAt: new Date().toISOString() };
    if (amount > 0) {
      aggUpd.totalIncome = increment(-amount);
    } else if (amount < 0) {
      aggUpd.totalSpent = increment(-Math.abs(amount));
    }
    if (txData.category) {
      aggUpd[`categoryBreakdown.${txData.category}`] = increment(-Math.abs(amount));
    }
    batch.set(aggRef, aggUpd, { merge: true });

    await batch.commit();
  },

  /**
   * Delete ALL transactions — also resets all account balances to 0.
   */
  deleteAll: async () => {
    const uid = getUid();
    const txSnap = await getDocs(collection(db, `users/${uid}/transactions`));
    const accSnap = await getDocs(collection(db, `users/${uid}/accounts`));
    const aggSnap = await getDocs(collection(db, `users/${uid}/aggregates`));

    // Firestore batch has 500 doc limit — chunk if needed
    const allWrites = [
      ...txSnap.docs.map(d => ({ type: 'delete', ref: d.ref })),
      ...accSnap.docs.map(d => {
        const accData = d.data();
        if (accData.type === 'credit') return { type: 'update', ref: d.ref, data: { liability: 0 } };
        return { type: 'update', ref: d.ref, data: { balance: 0 } };
      }),
      ...aggSnap.docs.map(d => ({ type: 'delete', ref: d.ref })),
    ];

    const CHUNK = 490;
    for (let i = 0; i < allWrites.length; i += CHUNK) {
      const batch = writeBatch(db);
      for (const w of allWrites.slice(i, i + CHUNK)) {
        if (w.type === 'delete') batch.delete(w.ref);
        else if (w.type === 'update') batch.update(w.ref, w.data);
      }
      await batch.commit();
    }
    return { data: { message: 'All transactions cleared and balances reset!' } };
  },
};

/* ─────────────────────────────────────────────
   Budgets API (legacy — kept for safety)
───────────────────────────────────────────── */
export const budgetsAPI = {
  create: async (data) => await addDoc(getUserRef('budgets'), data),
  update: async (id, data) => await updateDoc(getDocRef('budgets', id), data),
  delete: async (id) => await deleteDoc(getDocRef('budgets', id)),
};

/* ─────────────────────────────────────────────
   Categories API
───────────────────────────────────────────── */
export const categoriesAPI = {
  create: async (data) => await addDoc(getUserRef('categories'), {
    ...data,
    createdAt: new Date().toISOString(),
  }),
  update: async (id, data) => await updateDoc(getDocRef('categories', id), data),
  delete: async (id) => await deleteDoc(getDocRef('categories', id)),
};

/* ─────────────────────────────────────────────
   Budget Snapshots API
   Path: users/{uid}/budgetSnapshots/{cycleKey}/categories/{categoryId}
───────────────────────────────────────────── */
export const budgetSnapshotsAPI = {
  /**
   * Get all category limits for a cycle.
   * Returns { [categoryId]: { limit, categoryId, createdAt, ... } }
   */
  get: async (cycleKey) => {
    const uid = getUid();
    const snap = await getDocs(
      collection(db, `users/${uid}/budgetSnapshots/${cycleKey}/categories`)
    );
    if (snap.empty) return null;
    const result = {};
    snap.forEach(d => {
      result[d.id] = { categoryId: d.id, ...d.data() };
    });
    return result;
  },

  /**
   * Set the budget limit for a single category in a cycle.
   */
  setLimit: async (cycleKey, categoryId, limit) => {
    const uid = getUid();
    const ref = doc(db, `users/${uid}/budgetSnapshots/${cycleKey}/categories/${categoryId}`);
    await setDoc(ref, {
      categoryId,
      limit,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  },

  /**
   * Carry forward all limits from fromKey cycle to toKey cycle (without overwriting existing docs).
   */
  carryForward: async (fromKey, toKey) => {
    const uid = getUid();
    const fromSnap = await getDocs(
      collection(db, `users/${uid}/budgetSnapshots/${fromKey}/categories`)
    );
    if (fromSnap.empty) return;

    const toSnap = await getDocs(
      collection(db, `users/${uid}/budgetSnapshots/${toKey}/categories`)
    );
    const existingIds = new Set(toSnap.docs.map(d => d.id));

    const batch = writeBatch(db);
    fromSnap.forEach(d => {
      if (!existingIds.has(d.id)) {
        const toRef = doc(db, `users/${uid}/budgetSnapshots/${toKey}/categories/${d.id}`);
        batch.set(toRef, {
          ...d.data(),
          carriedForward: true,
          carriedFromCycle: fromKey,
          updatedAt: new Date().toISOString(),
        });
      }
    });
    await batch.commit();
  },

  /**
   * Legacy save — used by old code that passed a flat limits object { [catName]: amount }
   * Retained for migration safety only.
   */
  save: async (cycleKey, limits) => {
    const uid = getUid();
    await setDoc(
      doc(db, `users/${uid}/budgetSnapshots_legacy/${cycleKey}`),
      { limits, updatedAt: new Date().toISOString() },
      { merge: true }
    );
  },
};

/* ─────────────────────────────────────────────
   Aggregates API
   Path: users/{uid}/aggregates/{cycleKey}
───────────────────────────────────────────── */
export const aggregatesAPI = {
  /**
   * Get aggregate data for a specific cycle.
   * Returns { totalSpent, totalIncome, categoryBreakdown, updatedAt } or null.
   */
  get: async (cycleKey) => {
    const uid = getUid();
    const snap = await getDoc(doc(db, `users/${uid}/aggregates/${cycleKey}`));
    return snap.exists() ? snap.data() : { totalSpent: 0, totalIncome: 0, categoryBreakdown: {} };
  },

  /**
   * Rebuild aggregate for a cycle from raw transaction data (fail-safe recalculation).
   */
  rebuild: async (cycleKey, transactions) => {
    const uid = getUid();
    let totalSpent = 0;
    let totalIncome = 0;
    const categoryBreakdown = {};

    transactions.forEach(t => {
      if (t._cycleKey !== cycleKey) return;
      
      const isTransfer = t.payment_type === 'Transfer' || 
                         t.category?.toLowerCase() === 'transfer' || 
                         t.category?.toLowerCase() === 'credit card payment';
      if (isTransfer) return;

      const amt = parseFloat(t.amount || 0);
      if (amt > 0) {
        totalIncome += amt;
      } else {
        totalSpent += Math.abs(amt);
      }
      if (t.category) {
        categoryBreakdown[t.category] = (categoryBreakdown[t.category] || 0) + Math.abs(amt);
      }
    });

    await setDoc(doc(db, `users/${uid}/aggregates/${cycleKey}`), {
      totalSpent, totalIncome, categoryBreakdown, rebuiltAt: new Date().toISOString(),
    });

    return { totalSpent, totalIncome, categoryBreakdown };
  },
};

/* ─────────────────────────────────────────────
   Credit Cards API
───────────────────────────────────────────── */
export const creditCardsAPI = {
  create: async (data) => await addDoc(getUserRef('creditCards'), data),
  update: async (id, data) => await updateDoc(getDocRef('creditCards', id), data),
  delete: async (id) => await deleteDoc(getDocRef('creditCards', id)),
  createTransaction: async (data) => await addDoc(getUserRef('transactions'), data),
};

/* ─────────────────────────────────────────────
   Investments API
───────────────────────────────────────────── */
export const investmentsAPI = {
  create: async (data) => await addDoc(getUserRef('investments'), data),
  update: async (id, data) => await updateDoc(getDocRef('investments', id), data),
  delete: async (id) => await deleteDoc(getDocRef('investments', id)),
};

export const mutualFundsAPI = {
  create: async (data) => await addDoc(getUserRef('mutualFunds'), data),
};

/* ─────────────────────────────────────────────
   Goals API
───────────────────────────────────────────── */
export const goalsAPI = {
  create: async (data) => await addDoc(getUserRef('goals'), data),
  update: async (id, data) => await updateDoc(getDocRef('goals', id), data),
  delete: async (id) => await deleteDoc(getDocRef('goals', id)),
};

/* ─────────────────────────────────────────────
   Lending API
───────────────────────────────────────────── */
export const lendingAPI = {
  create: async (data) => await addDoc(getUserRef('lending'), data),
  update: async (id, data) => await updateDoc(getDocRef('lending', id), data),
  delete: async (id) => await deleteDoc(getDocRef('lending', id)),
};

/* ─────────────────────────────────────────────
   Reports API (local computation)
───────────────────────────────────────────── */
export const reportsAPI = {
  getMonthly: () => Promise.resolve({ data: { data: [] } }),
  getYearly:  () => Promise.resolve({ data: { data: [] } }),
};

/* ─────────────────────────────────────────────
   Import API
───────────────────────────────────────────── */
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

          const now = new Date().toISOString().split('T')[0];
          const transactions = rows.map(row => {
            const dateStr = row.Date || row.date || now;
            const amount  = parseFloat(row.Amount || row.amount || 0);
            const category = row.Category || row.category || 'Other';
            const notes   = row.Notes || row.notes || '';
            const type    = row.Type || row.type || (amount >= 0 ? 'income' : 'expense');
            return {
              date: dateStr, amount, category, notes, type,
              account_id: accountId || null,
              created_at: new Date().toISOString(),
            };
          }).filter(t => !isNaN(t.amount) && t.amount !== 0);

          if (isPreview) {
            resolve({ data: { data: transactions } });
          } else {
            const uid = getUid();
            const CHUNK = 400; // Leave room for refs
            
            const accDeltas = {};
            const aggDeltas = {};

            for (let i = 0; i < transactions.length; i += CHUNK) {
              const batch = writeBatch(db);
              for (const t of transactions.slice(i, i + CHUNK)) {
                const ref = doc(collection(db, `users/${uid}/transactions`));
                // Tag with cycle key for later parsing/rebuilds if needed
                const cycle = getFinancialCycleForDate(t.date, 25);
                t._cycleKey = cycle.cycleKey;
                batch.set(ref, t);

                // Tally Accounts
                if (t.account_id && t.amount !== 0) {
                  accDeltas[t.account_id] = (accDeltas[t.account_id] || 0) + t.amount;
                }

                // Tally Aggregates
                const amt = t.amount;
                const cKey = t._cycleKey;
                if (!aggDeltas[cKey]) aggDeltas[cKey] = { spent: 0, income: 0, cat: {} };
                
                const isTransfer = t.payment_type === 'Transfer' || t.category?.toLowerCase() === 'transfer' || t.category?.toLowerCase() === 'credit card payment';
                if (!isTransfer) {
                  if (amt > 0) aggDeltas[cKey].income += amt;
                  else if (amt < 0) {
                    aggDeltas[cKey].spent += Math.abs(amt);
                    if (t.category) {
                       aggDeltas[cKey].cat[t.category] = (aggDeltas[cKey].cat[t.category] || 0) + Math.abs(amt);
                    }
                  }
                }
              }
              await batch.commit();
            }

            // Post-batch atomic updates of Account Balances & Aggregates
            const finalizeBatch = writeBatch(db);
            
            for (const [accId, delta] of Object.entries(accDeltas)) {
              if (delta === 0) continue;
              const accRef = doc(db, `users/${uid}/accounts/${accId}`);
              const snap = await getDoc(accRef);
              const type = snap.exists() ? snap.data().type : 'bank';
              if (type === 'credit') finalizeBatch.update(accRef, { liability: increment(Math.round(-delta * 100) / 100) });
              else finalizeBatch.update(accRef, { balance: increment(Math.round(delta * 100) / 100) });
            }

            for (const [cKey, deltas] of Object.entries(aggDeltas)) {
              const aggRef = doc(db, `users/${uid}/aggregates/${cKey}`);
              const updateVars = { updatedAt: new Date().toISOString() };
              if (deltas.income > 0) updateVars.totalIncome = increment(deltas.income);
              if (deltas.spent > 0) updateVars.totalSpent = increment(deltas.spent);
              for (const [cat, v] of Object.entries(deltas.cat)) {
                if (v > 0) updateVars[`categoryBreakdown.${cat}`] = increment(v);
              }
              finalizeBatch.set(aggRef, updateVars, { merge: true });
            }

            await finalizeBatch.commit();
            resolve({ data: { data: transactions } });
          }
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = (error) => reject(error);
      reader.readAsBinaryString(file);
    });
  },
};

/* ─────────────────────────────────────────────
   Insights API (local generation)
───────────────────────────────────────────── */
export const insightsAPI = {
  get: () => Promise.resolve({ data: { data: { insights: [] } } }),
};

/* ─────────────────────────────────────────────
   Calculations API — computed locally from DataContext
───────────────────────────────────────────── */
export const calculationsAPI = {
  get: () => Promise.resolve({ data: { data: {} } }),
  getSnapshots: () => Promise.resolve({ data: { data: [] } }),
};

export default {};
