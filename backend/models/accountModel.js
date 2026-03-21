const { db } = require('../config/firebase');
const { encrypt, decrypt } = require('../utils/encryption');

const getCollection = (userId) => db.collection('users').doc(userId).collection('accounts');

const decryptDoc = (data) => {
  if (data.account_number) data.account_number = decrypt(data.account_number);
  return data;
};

const encryptData = (data) => {
  const result = { ...data };
  if (result.account_number) result.account_number = encrypt(result.account_number);
  return result;
};

const getAll = async (userId) => {
  const snapshot = await getCollection(userId).orderBy('created_at', 'desc').get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...decryptDoc(doc.data()) }));
};

const getById = async (userId, id) => {
  const doc = await getCollection(userId).doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...decryptDoc(doc.data()) };
};

const create = async (userId, data) => {
  const baseData = {
    ...data,
    created_at: new Date().toISOString(),
  };

  if (data.type === 'credit') {
    baseData.liability = data.liability || 0;
    delete baseData.balance;
  } else {
    baseData.balance = data.balance || 0;
    delete baseData.liability;
  }

  const encryptedData = encryptData(baseData);
  const docRef = await getCollection(userId).add(encryptedData);
  return { id: docRef.id, ...data };
};

const update = async (userId, id, data) => {
  const docRef = getCollection(userId).doc(id);
  const doc = await docRef.get();
  if (!doc.exists) return null;
  
  const encryptedData = encryptData(data);
  await docRef.update(encryptedData);
  return { id, ...decryptDoc(doc.data()), ...data };
};

const remove = async (userId, id) => {
  const docRef = getCollection(userId).doc(id);
  const doc = await docRef.get();
  if (!doc.exists) return null;
  await docRef.delete();
  return { id };
};

module.exports = { getAll, getById, create, update, remove };
