const { db } = require('../config/firebase');
const { encrypt, decrypt } = require('../utils/encryption');

const getCardCollection = (userId) => db.collection('users').doc(userId).collection('credit_cards');
const getTxnCollection = (userId) => db.collection('users').doc(userId).collection('credit_card_transactions');

const decryptCard = (data) => {
  if (data.card_number) data.card_number = decrypt(data.card_number);
  return data;
};

const encryptCard = (data) => {
  const result = { ...data };
  if (result.card_number) result.card_number = encrypt(result.card_number);
  return result;
};

// --- Credit Cards ---
const getAllCards = async (userId) => {
  const snapshot = await getCardCollection(userId).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...decryptCard(doc.data()) }));
};

const createCard = async (userId, data) => {
  const encryptedData = encryptCard({ ...data, created_at: new Date().toISOString() });
  const docRef = await getCardCollection(userId).add(encryptedData);
  return { id: docRef.id, ...data };
};

// --- Credit Card Transactions ---
const decryptTxn = (data) => {
  if (data.notes) data.notes = decrypt(data.notes);
  return data;
};

const encryptTxn = (data) => {
  const result = { ...data };
  if (result.notes) result.notes = encrypt(result.notes);
  return result;
};

const getAllTransactions = async (userId, creditCardId) => {
  let query = getTxnCollection(userId).orderBy('date', 'desc');
  if (creditCardId) {
    query = getTxnCollection(userId).where('credit_card_id', '==', creditCardId).orderBy('date', 'desc');
  }
  const snapshot = await query.get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...decryptTxn(doc.data()) }));
};

const createTransaction = async (userId, data) => {
  const encryptedData = encryptTxn({ ...data, created_at: new Date().toISOString() });
  const docRef = await getTxnCollection(userId).add(encryptedData);
  return { id: docRef.id, ...data };
};

module.exports = { getAllCards, createCard, getAllTransactions, createTransaction };
