const { db } = require('../config/firebase');

const getMfCollection = (userId) => db.collection('users').doc(userId).collection('mutual_funds');
const getSipCollection = (userId) => db.collection('users').doc(userId).collection('sip_plans');

// --- Mutual Funds ---
const getAllFunds = async (userId) => {
  const snapshot = await getMfCollection(userId).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

const createFund = async (userId, data) => {
  const docRef = await getMfCollection(userId).add({ ...data, created_at: new Date().toISOString() });
  return { id: docRef.id, ...data };
};

// --- SIP Plans ---
const getAllSIPs = async (userId) => {
  const snapshot = await getSipCollection(userId).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

const createSIP = async (userId, data) => {
  const docRef = await getSipCollection(userId).add({ ...data, created_at: new Date().toISOString() });
  return { id: docRef.id, ...data };
};

module.exports = { getAllFunds, createFund, getAllSIPs, createSIP };
