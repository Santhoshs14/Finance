const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../config/firebase');

const usersCollection = db.collection('users');

/**
 * Authenticate user and return JWT token
 */
const login = async (username, password) => {
  // Find user by username
  const snapshot = await usersCollection.where('username', '==', username).limit(1).get();

  if (snapshot.empty) {
    throw Object.assign(new Error('Invalid username or password'), { statusCode: 401 });
  }

  const userDoc = snapshot.docs[0];
  const user = { id: userDoc.id, ...userDoc.data() };

  // Compare password
  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    throw Object.assign(new Error('Invalid username or password'), { statusCode: 401 });
  }

  // Generate JWT
  const token = jwt.sign(
    { id: user.id, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  return {
    token,
    user: {
      id: user.id,
      username: user.username,
    },
  };
};

/**
 * Register a new user and return JWT token
 */
const register = async (username, password) => {
  // Check if username already exists
  const snapshot = await usersCollection.where('username', '==', username).limit(1).get();
  if (!snapshot.empty) {
    throw Object.assign(new Error('Username already exists'), { statusCode: 409 });
  }

  // Hash password
  const salt = await bcrypt.genSalt(10);
  const password_hash = await bcrypt.hash(password, salt);

  // Create user
  const newUserRef = await usersCollection.add({
    username,
    password_hash,
    created_at: new Date().toISOString()
  });

  // Generate JWT
  const token = jwt.sign(
    { id: newUserRef.id, username },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  return {
    token,
    user: {
      id: newUserRef.id,
      username,
    },
  };
};

/**
 * Update user profile (username, password)
 */
const updateProfile = async (userId, data) => {
  const userRef = usersCollection.doc(userId);
  const userDoc = await userRef.get();
  
  if (!userDoc.exists) {
    throw Object.assign(new Error('User not found'), { statusCode: 404 });
  }

  const updates = {};
  
  if (data.username && data.username !== userDoc.data().username) {
    // Check if new username is already taken
    const snapshot = await usersCollection.where('username', '==', data.username).limit(1).get();
    if (!snapshot.empty) {
      throw Object.assign(new Error('Username already exists'), { statusCode: 409 });
    }
    updates.username = data.username;
  }

  if (data.password) {
    const salt = await bcrypt.genSalt(10);
    updates.password_hash = await bcrypt.hash(data.password, salt);
  }

  if (Object.keys(updates).length > 0) {
    await userRef.update(updates);
  }

  return { id: userId, username: updates.username || userDoc.data().username };
};

/**
 * Get profile stats for dashboard/settings
 */
const getProfileStats = async (userId) => {
  try {
    const transactionModel = require('../models/transactionModel');
    const { calculateSavingsRate } = require('../utils/calculations');
    
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    
    const transactions = await transactionModel.getAll(userId);
    const savingsData = calculateSavingsRate(transactions, month, year);
    
    return {
      netWorth: 0, // Full net worth needs account+investment data; keep 0 here
      monthlyIncome: savingsData.income || 0,
      monthlySpent: savingsData.expenses || 0,
      savingsRate: savingsData.savings_rate || 0,
    };
  } catch (e) {
    return { netWorth: 0, monthlyIncome: 0, monthlySpent: 0, savingsRate: 0 };
  }
};

module.exports = { login, register, updateProfile, getProfileStats };
