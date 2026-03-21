const { db } = require('../config/firebase');

const getById = async (userId, cardId, cycleKey) => {
  const docId = `${cardId}_${cycleKey}`;
  const doc = await db.collection('users').doc(userId).collection('creditCardStatements').doc(docId).get();
  return doc.exists ? doc.data() : null;
};

const upsert = async (userId, cardId, cycleKey, data) => {
  const docId = `${cardId}_${cycleKey}`;
  const docRef = db.collection('users').doc(userId).collection('creditCardStatements').doc(docId);
  await docRef.set({ ...data, updatedAt: new Date().toISOString() }, { merge: true });
};

const getAllForCard = async (userId, cardId) => {
  const snapshot = await db.collection('users').doc(userId).collection('creditCardStatements')
    .where('cardId', '==', cardId)
    .orderBy('cycleKey', 'desc')
    .get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

module.exports = { getById, upsert, getAllForCard };
