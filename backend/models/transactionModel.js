const { db } = require('../config/firebase');
const { encrypt, decrypt } = require('../utils/encryption');

const getCollection = (userId) => db.collection('users').doc(userId).collection('transactions');

// Helper to decrypt a transaction doc
const decryptDoc = (docData) => {
  if (docData.notes) {
    docData.notes = decrypt(docData.notes);
  }
  return docData;
};

// Helper to encrypt a transaction object's sensitive fields
const encryptData = (data) => {
  const result = { ...data };
  if (result.notes) {
    result.notes = encrypt(result.notes);
  }
  return result;
};

const getAll = async (userId, filters = {}, limit = null, lastDocId = null) => {
  let query = getCollection(userId);

  if (filters.category) {
    query = query.where('category', '==', filters.category);
  }
  if (filters.account_id) {
    query = query.where('account_id', '==', filters.account_id);
  }
  // Date range filter for financial month cycle
  if (filters.startDate) {
    query = query.where('date', '>=', filters.startDate);
  }
  if (filters.endDate) {
    query = query.where('date', '<=', filters.endDate);
  }

  query = query.orderBy('date', 'desc');

  if (lastDocId) {
    const lastDoc = await getCollection(userId).doc(lastDocId).get();
    if (lastDoc.exists) {
      query = query.startAfter(lastDoc);
    }
  }

  if (limit) {
    query = query.limit(limit);
  }

  const snapshot = await query.get();
  const transactions = snapshot.docs.map((doc) => ({ id: doc.id, ...decryptDoc(doc.data()) }));
  
  if (limit) {
    return {
      transactions,
      lastDocId: snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1].id : null,
      hasMore: snapshot.docs.length === limit,
    };
  }
  
  return transactions;
};

const getById = async (userId, id) => {
  const doc = await getCollection(userId).doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...decryptDoc(doc.data()) };
};

const create = async (userId, data) => {
  const encryptedData = encryptData({
    ...data,
    created_at: new Date().toISOString(),
  });
  
  const docRef = await getCollection(userId).add(encryptedData);
  return { id: docRef.id, ...data }; // return original unencrypted data to the client
};

const createBatch = async (userId, items) => {
  const batch = db.batch();
  const results = [];
  const collectionRef = getCollection(userId);
  for (const item of items) {
    const docRef = collectionRef.doc();
    const encryptedItem = encryptData({ ...item, created_at: new Date().toISOString() });
    batch.set(docRef, encryptedItem);
    results.push({ id: docRef.id, ...item });
  }
  await batch.commit();
  return results;
};

const update = async (userId, id, data) => {
  const docRef = getCollection(userId).doc(id);
  const doc = await docRef.get();
  if (!doc.exists) return null;
  
  const encryptedUpdateData = encryptData(data);
  await docRef.update(encryptedUpdateData);
  
  // Return the merged unencrypted data
  return { id, ...decryptDoc(doc.data()), ...data };
};

const remove = async (userId, id) => {
  const docRef = getCollection(userId).doc(id);
  const doc = await docRef.get();
  if (!doc.exists) return null;
  await docRef.delete();
  return { id };
};

const removeAll = async (userId) => {
  const collectionRef = getCollection(userId);
  const snapshot = await collectionRef.get();
  
  if (snapshot.empty) return { deleted: 0 };

  let batch = db.batch();
  let count = 0;
  let totalDeleted = 0;

  for (const doc of snapshot.docs) {
    batch.delete(doc.ref);
    count++;
    totalDeleted++;
    
    // Firestore batches allow a max of 500 operations
    if (count === 500) {
      await batch.commit();
      batch = db.batch();
      count = 0;
    }
  }

  if (count > 0) {
    await batch.commit();
  }

  return { deleted: totalDeleted };
};

const getByDateRange = async (userId, startDate, endDate) => {
  const snapshot = await getCollection(userId)
    .where('date', '>=', startDate)
    .where('date', '<=', endDate)
    .orderBy('date', 'desc')
    .get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...decryptDoc(doc.data()) }));
};

module.exports = { getAll, getById, create, createBatch, update, remove, removeAll, getByDateRange };
