import { db, auth } from '../config/firebase';
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, getDoc, setDoc, writeBatch, increment,
  serverTimestamp, query, orderBy, limit, runTransaction,
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
   * Create a transaction atomically using runTransaction:
   * - Read account type inside the transaction (prevents race conditions)
   * - Write transaction doc
   * - Update account balance/liability
   * - Update aggregates for the cycle
   */
  create: async (data, cycleStartDay = 25) => {
    const uid = getUid();
    const amount = parseFloat(data.amount);
    if (isNaN(amount) || amount === 0) throw new Error('Invalid amount');

    const cycle = getFinancialCycleForDate(data.date, cycleStartDay);
    const txData = { ...data, amount, _cycleKey: cycle.cycleKey, createdAt: new Date().toISOString() };
    const txRef = doc(collection(db, `users/${uid}/transactions`));

    await runTransaction(db, async (transaction) => {
      // Read account type inside the transaction for consistency
      let accType = 'bank';
      let accExists = false;
      if (data.account_id) {
        const accRef = doc(db, `users/${uid}/accounts/${data.account_id}`);
        const accSnap = await transaction.get(accRef);
        if (accSnap.exists()) {
          accExists = true;
          accType = accSnap.data().type;
        }
      }

      // 1. Write transaction doc
      transaction.set(txRef, txData);

      // 2. Account balance / liability
      if (data.account_id && accExists) {
        const accRef = doc(db, `users/${uid}/accounts/${data.account_id}`);
        if (accType === 'credit') {
          const delta = -amount;
          transaction.update(accRef, { liability: increment(Math.round(delta * 100) / 100) });
        } else {
          transaction.update(accRef, { balance: increment(Math.round(amount * 100) / 100) });
        }
      }

      // 3. Aggregates
      const aggDelta = txnToAggregateDelta(txData, 1);
      if (aggDelta) {
        const aggRef = doc(db, `users/${uid}/aggregates/${cycle.cycleKey}`);
        const aggUpdate = { updatedAt: new Date().toISOString() };
        if (amount > 0) {
          aggUpdate.totalIncome = increment(amount);
        } else {
          aggUpdate.totalSpent = increment(Math.abs(amount));
        }
        // Only add expenses to categoryBreakdown (not income)
        if (txData.category && amount < 0) {
          aggUpdate.categoryBreakdown = {
            [txData.category]: increment(Math.abs(amount))
          };
        }
        transaction.set(aggRef, aggUpdate, { merge: true });
      }
    });

    return { id: txRef.id };
  },

  /**
   * Update a transaction atomically using runTransaction:
   * - All reads happen inside the transaction (prevents race conditions)
   * - Reverse old balance + aggregate impact
   * - Apply new balance + aggregate impact
   */
  update: async (id, data, cycleStartDay = 25) => {
    const uid = getUid();

    await runTransaction(db, async (transaction) => {
      // Read old transaction inside the transaction
      const oldSnap = await transaction.get(doc(db, `users/${uid}/transactions/${id}`));
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

      // Read account types BEFORE any writes
      let oldAccountType = 'bank';
      let oldAccountExists = false;
      if (oldAccountId) {
        const snap = await transaction.get(doc(db, `users/${uid}/accounts/${oldAccountId}`));
        if (snap.exists()) {
          oldAccountExists = true;
          oldAccountType = snap.data().type;
        }
      }
      
      let newAccountType = 'bank';
      let newAccountExists = false;
      if (newAccountId) {
        if (newAccountId === oldAccountId) {
          newAccountExists = oldAccountExists;
          newAccountType = oldAccountType;
        } else {
          const snap = await transaction.get(doc(db, `users/${uid}/accounts/${newAccountId}`));
          if (snap.exists()) {
            newAccountExists = true;
            newAccountType = snap.data().type;
          }
        }
      }

      // 1. Update transaction doc
      transaction.update(doc(db, `users/${uid}/transactions/${id}`), newData);

      // 2. Reverse & reapply account balance/liability
      if (oldAccountId === newAccountId) {
        if (oldAccountId && oldAccountExists) {
          let balDelta = newAmount - oldAmount;

          if (balDelta !== 0) {
            if (oldAccountType === 'credit') {
              transaction.update(doc(db, `users/${uid}/accounts/${oldAccountId}`), {
                liability: increment(Math.round(-balDelta * 100) / 100),
              });
            } else {
              transaction.update(doc(db, `users/${uid}/accounts/${oldAccountId}`), {
                balance: increment(Math.round(balDelta * 100) / 100),
              });
            }
          }
        }
      } else {
        if (oldAccountId && oldAccountExists) {
          if (oldAccountType === 'credit') {
            transaction.update(doc(db, `users/${uid}/accounts/${oldAccountId}`), {
              liability: increment(Math.round(oldAmount * 100) / 100),
            });
          } else {
            transaction.update(doc(db, `users/${uid}/accounts/${oldAccountId}`), {
              balance: increment(Math.round(-oldAmount * 100) / 100),
            });
          }
        }
        if (newAccountId && newAccountExists) {
          if (newAccountType === 'credit') {
            transaction.update(doc(db, `users/${uid}/accounts/${newAccountId}`), {
              liability: increment(Math.round(-newAmount * 100) / 100),
            });
          } else {
            transaction.update(doc(db, `users/${uid}/accounts/${newAccountId}`), {
              balance: increment(Math.round(newAmount * 100) / 100),
            });
          }
        }
      }

      // 3. Reverse old aggregate & apply new
      if (oldCycleKey === newCycleKey) {
        const aggRef = doc(db, `users/${uid}/aggregates/${oldCycleKey}`);
        const upd = { updatedAt: new Date().toISOString() };
        
        let incomeDelta = 0;
        let spentDelta = 0;
        const catDeltas = {};
        
        if (oldAmount > 0) incomeDelta -= oldAmount;
        else if (oldAmount < 0) {
          spentDelta -= Math.abs(oldAmount);
          if (old.category) catDeltas[old.category] = (catDeltas[old.category] || 0) - Math.abs(oldAmount);
        }
        
        if (newAmount > 0) incomeDelta += newAmount;
        else if (newAmount < 0) {
          spentDelta += Math.abs(newAmount);
          if (newData.category) catDeltas[newData.category] = (catDeltas[newData.category] || 0) + Math.abs(newAmount);
        }
        
        if (incomeDelta !== 0) upd.totalIncome = increment(incomeDelta);
        if (spentDelta !== 0) upd.totalSpent = increment(spentDelta);
        
        const validCatKeys = Object.entries(catDeltas).filter(([k, v]) => v !== 0);
        if (validCatKeys.length > 0) {
          upd.categoryBreakdown = {};
          for (const [cat, delta] of validCatKeys) {
            upd.categoryBreakdown[cat] = increment(delta);
          }
        }
        transaction.set(aggRef, upd, { merge: true });
      } else {
        const applyAgg = (aggCycleKey, txData, sign) => {
          const aggRef = doc(db, `users/${uid}/aggregates/${aggCycleKey}`);
          const upd = { updatedAt: new Date().toISOString() };
          const amt = parseFloat(txData.amount || 0);
          if (amt > 0) {
            upd.totalIncome = increment(sign * amt);
          } else if (amt < 0) {
            upd.totalSpent = increment(sign * Math.abs(amt));
          }
          if (txData.category && amt < 0) {
            upd.categoryBreakdown = {
              [txData.category]: increment(sign * Math.abs(amt))
            };
          }
          transaction.set(aggRef, upd, { merge: true });
        };

        applyAgg(oldCycleKey, old, -1);
        applyAgg(newCycleKey, newData, 1);
      }
    });
  },

  /**
   * Delete a transaction atomically using runTransaction:
   * - All reads happen inside the transaction (prevents race conditions)
   * - Reverse account balance
   * - Reverse aggregates
   */
  delete: async (id, cycleStartDay = 25) => {
    const uid = getUid();

    await runTransaction(db, async (transaction) => {
      const txDocRef = doc(db, `users/${uid}/transactions/${id}`);
      const snap = await transaction.get(txDocRef);
      if (!snap.exists()) {
        // Already deleted, nothing to reverse
        return;
      }

      const txData = snap.data();
      const amount = parseFloat(txData.amount || 0);
      const cycleKey = txData._cycleKey || getFinancialCycleForDate(txData.date, cycleStartDay).cycleKey;

      // Read account type BEFORE deletes/updates
      let accType = 'bank';
      let accExists = false;
      if (txData.account_id && amount !== 0) {
        const accRef = doc(db, `users/${uid}/accounts/${txData.account_id}`);
        const accSnap = await transaction.get(accRef);
        if (accSnap.exists()) {
          accExists = true;
          accType = accSnap.data().type;
        }
      }

      // 1. Delete transaction
      transaction.delete(txDocRef);

      // 2. Reverse account balance/liability
      if (txData.account_id && amount !== 0 && accExists) {
        const accRef = doc(db, `users/${uid}/accounts/${txData.account_id}`);
        if (accType === 'credit') {
          transaction.update(accRef, { liability: increment(Math.round(amount * 100) / 100) });
        } else {
          transaction.update(accRef, { balance: increment(Math.round(-amount * 100) / 100) });
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
      // Only reverse categoryBreakdown for expenses (not income)
      if (txData.category && amount < 0) {
        aggUpd.categoryBreakdown = {
          [txData.category]: increment(-Math.abs(amount))
        };
      }
      transaction.set(aggRef, aggUpd, { merge: true });
    });
  },

  /**
   * Delete ALL transactions — also resets all account balances to 0.
   */
  deleteAll: async () => {
    const uid = getUid();
    const txSnap = await getDocs(collection(db, `users/${uid}/transactions`));
    const accSnap = await getDocs(collection(db, `users/${uid}/accounts`));
    const aggSnap = await getDocs(collection(db, `users/${uid}/aggregates`));

    // Calculate sum of transactions per account to reverse them mathematically
    const accountDeltas = {};
    txSnap.docs.forEach(d => {
      const tx = d.data();
      if (tx.account_id && tx.amount) {
         accountDeltas[tx.account_id] = (accountDeltas[tx.account_id] || 0) + parseFloat(tx.amount);
      }
    });

    // Firestore batch has 500 doc limit — chunk if needed
    const allWrites = [
      ...txSnap.docs.map(d => ({ type: 'delete', ref: d.ref })),
      ...accSnap.docs.map(d => {
        const accData = d.data();
        const delta = accountDeltas[d.id] || 0;
        if (delta === 0) return null;
        
        if (accData.type === 'credit') {
          return { type: 'update', ref: d.ref, data: { liability: increment(Math.round(delta * 100) / 100) } };
        } else {
          return { type: 'update', ref: d.ref, data: { balance: increment(Math.round(-delta * 100) / 100) } };
        }
      }).filter(Boolean),
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

  /**
   * Atomic CC bill payment — single batch that:
   * 1. Creates debit transaction on bank account
   * 2. Creates credit transaction on credit card
   * 3. Adjusts bank account balance (decrement)
   * 4. Adjusts CC liability (decrement)
   * This prevents partial state where bank is debited but CC liability isn't reduced.
   */
  payBill: async ({ amount, bankAccountId, creditCardId, date, ccName, cycleStartDay = 25 }) => {
    const uid = getUid();
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) throw new Error('Invalid payment amount');
    if (!bankAccountId || !creditCardId) throw new Error('Both bank account and credit card are required');

    const cycle = getFinancialCycleForDate(date, cycleStartDay);
    const batch = writeBatch(db);

    // 1. Debit transaction on bank (expense — negative amount)
    const debitRef = doc(collection(db, `users/${uid}/transactions`));
    batch.set(debitRef, {
      amount: -parsedAmount,
      account_id: bankAccountId,
      category: 'Credit Card Payment',
      date,
      notes: `Payment for ${ccName || 'Credit Card'}`,
      payment_type: 'Transfer',
      _cycleKey: cycle.cycleKey,
      createdAt: new Date().toISOString(),
    });

    // 2. Credit transaction on CC (income — positive amount, reduces liability)
    const creditRef = doc(collection(db, `users/${uid}/transactions`));
    batch.set(creditRef, {
      amount: parsedAmount,
      account_id: creditCardId,
      category: 'Credit Card Payment',
      date,
      notes: 'Thank you for your payment',
      payment_type: 'Credit Card',
      _cycleKey: cycle.cycleKey,
      createdAt: new Date().toISOString(),
    });

    // 3. Adjust bank account balance (decrease)
    const bankRef = doc(db, `users/${uid}/accounts/${bankAccountId}`);
    batch.update(bankRef, { balance: increment(Math.round(-parsedAmount * 100) / 100) });

    // 4. Adjust CC liability (decrease)
    const ccRef = doc(db, `users/${uid}/accounts/${creditCardId}`);
    batch.update(ccRef, { liability: increment(Math.round(-parsedAmount * 100) / 100) });

    // Note: These are transfer transactions, so no aggregate impact (transfers are excluded)

    await batch.commit();
    return { debitId: debitRef.id, creditId: creditRef.id };
  },
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
            let finalizeBatch = writeBatch(db);
            let opCount = 0;

            const commitAndReset = async () => {
              if (opCount > 0) {
                await finalizeBatch.commit();
                finalizeBatch = writeBatch(db);
                opCount = 0;
              }
            };
            
            for (const [accId, delta] of Object.entries(accDeltas)) {
              if (delta === 0) continue;
              const accRef = doc(db, `users/${uid}/accounts/${accId}`);
              const snap = await getDoc(accRef);
              const type = snap.exists() ? snap.data().type : 'bank';
              if (type === 'credit') finalizeBatch.update(accRef, { liability: increment(Math.round(-delta * 100) / 100) });
              else finalizeBatch.update(accRef, { balance: increment(Math.round(delta * 100) / 100) });
              
              opCount++;
              if (opCount >= 400) await commitAndReset();
            }

            for (const [cKey, deltas] of Object.entries(aggDeltas)) {
              const aggRef = doc(db, `users/${uid}/aggregates/${cKey}`);
              const updateVars = { updatedAt: new Date().toISOString() };
              if (deltas.income > 0) updateVars.totalIncome = increment(deltas.income);
              if (deltas.spent > 0) updateVars.totalSpent = increment(deltas.spent);
              if (Object.keys(deltas.cat).length > 0) {
                updateVars.categoryBreakdown = {};
                for (const [cat, v] of Object.entries(deltas.cat)) {
                  if (v > 0) updateVars.categoryBreakdown[cat] = increment(v);
                }
              }
              finalizeBatch.set(aggRef, updateVars, { merge: true });
              
              opCount++;
              if (opCount >= 400) await commitAndReset();
            }

            await commitAndReset();
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



export default {};
