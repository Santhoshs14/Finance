const { db } = require('../config/firebase');

const getCollection = (userId) => db.collection('users').doc(userId).collection('goals');

const getAll = async (userId) => {
  const snapshot = await getCollection(userId).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

const create = async (userId, data) => {
  const docRef = await getCollection(userId).add({
    ...data,
    current_amount: data.current_amount || 0,
    created_at: new Date().toISOString(),
  });
  return { id: docRef.id, ...data };
};

module.exports = { getAll, create };
