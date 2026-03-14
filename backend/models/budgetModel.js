const { db } = require('../config/firebase');

const EXPENSE_CATEGORIES = [
  'Investment', 'Rent', 'Home', 'Food', 'Travel', 'Petrol',
  'Entertainment', 'Shopping', 'Bills', 'Utilities', 'Subscription',
  'Lending', 'Gifts',
];

const getCollection = (userId) => db.collection('users').doc(userId).collection('budgets');

const getAll = async (userId) => {
  const snapshot = await getCollection(userId).get();
  const existing = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  // Always return all 13 categories — fill missing ones with limit=0
  const existingMap = {};
  existing.forEach(b => { existingMap[b.category] = b; });

  return EXPENSE_CATEGORIES.map(cat => {
    if (existingMap[cat]) return existingMap[cat];
    return { id: null, category: cat, monthly_limit: 0, cycleStartDate: null, cycleEndDate: null };
  });
};

const getByCategory = async (userId, category) => {
  const snapshot = await getCollection(userId).where('category', '==', category).limit(1).get();
  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() };
};

const create = async (userId, data) => {
  const existing = await getByCategory(userId, data.category);
  if (existing) {
    await getCollection(userId).doc(existing.id).update({
      monthly_limit: data.monthly_limit,
      ...(data.cycleStartDate && { cycleStartDate: data.cycleStartDate }),
      ...(data.cycleEndDate && { cycleEndDate: data.cycleEndDate }),
    });
    return { ...existing, ...data };
  }
  const docRef = await getCollection(userId).add({
    ...data,
    created_at: new Date().toISOString(),
  });
  return { id: docRef.id, ...data };
};

/**
 * Bulk upsert budgets for all categories — used on cycle reset (25th)
 */
const bulkUpsert = async (userId, cycleStart, cycleEnd) => {
  const existing = await getAll(userId);
  const existingMap = {};
  existing.forEach(b => { if (b.id) existingMap[b.category] = b; });

  const batch = db.batch();
  const results = [];

  for (const cat of EXPENSE_CATEGORIES) {
    const existingBudget = existingMap[cat];
    const docData = {
      category: cat,
      monthly_limit: existingBudget?.monthly_limit || 0,
      cycleStartDate: cycleStart,
      cycleEndDate: cycleEnd,
      updated_at: new Date().toISOString(),
    };

    if (existingBudget?.id) {
      const ref = getCollection(userId).doc(existingBudget.id);
      batch.update(ref, docData);
      results.push({ id: existingBudget.id, ...docData });
    } else {
      const ref = getCollection(userId).doc();
      batch.set(ref, { ...docData, created_at: new Date().toISOString() });
      results.push({ id: ref.id, ...docData });
    }
  }

  await batch.commit();
  return results;
};

module.exports = { getAll, getByCategory, create, bulkUpsert, EXPENSE_CATEGORIES };
