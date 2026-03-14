const { db } = require('../config/firebase');

const getCollection = (userId) => db.collection('users').doc(userId).collection('lending_records');

const getAll = async (userId) => {
  const snapshot = await getCollection(userId).orderBy('date', 'desc').get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

const create = async (userId, data) => {
  const docRef = await getCollection(userId).add({
    ...data,
    paid_amount: 0,
    status: data.status || 'pending',
    created_at: new Date().toISOString(),
  });
  return { id: docRef.id, ...data, paid_amount: 0 };
};

const update = async (userId, id, data) => {
  await getCollection(userId).doc(id).update(data);
  const updatedDoc = await getCollection(userId).doc(id).get();
  return { id, ...updatedDoc.data() };
};

module.exports = { getAll, create, update };
