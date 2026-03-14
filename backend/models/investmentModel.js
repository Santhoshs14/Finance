const { db } = require('../config/firebase');

const getCollection = (userId) => db.collection('users').doc(userId).collection('investments');

const getAll = async (userId) => {
  const snapshot = await getCollection(userId).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

const create = async (userId, data) => {
  const profit_loss = (data.current_price - data.buy_price) * data.quantity;
  const docRef = await getCollection(userId).add({
    ...data,
    profit_loss,
    created_at: new Date().toISOString(),
  });
  return { id: docRef.id, ...data, profit_loss };
};

const update = async (userId, id, data) => {
  const profit_loss = (data.current_price - data.buy_price) * data.quantity;
  await getCollection(userId).doc(id).update({ ...data, profit_loss });
  return { id, ...data, profit_loss };
};

module.exports = { getAll, create, update };
