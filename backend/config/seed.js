/**
 * Seed script — creates default user and accounts in Firestore
 * Run: npm run seed
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { db } = require('./firebase');

const seed = async () => {
  try {
    console.log('🌱 Starting seed...\n');

    // --- Seed User ---
    const usersRef = db.collection('users');
    const existingUser = await usersRef.where('username', '==', 'santhosh').limit(1).get();

    if (existingUser.empty) {
      const passwordHash = await bcrypt.hash('sandy2004', 12);
      await usersRef.add({
        username: 'santhosh',
        password_hash: passwordHash,
        created_at: new Date().toISOString(),
      });
      console.log('✅ User "santhosh" created');
    } else {
      console.log('ℹ️  User "santhosh" already exists, skipping');
    }

    // --- Seed Default Accounts ---
    const accountsRef = db.collection('accounts');
    const defaultAccounts = [
      { account_name: 'Bank Account 1', account_type: 'bank', balance: 0 },
      { account_name: 'Bank Account 2', account_type: 'bank', balance: 0 },
      { account_name: 'Bank Account 3', account_type: 'bank', balance: 0 },
    ];

    const existingAccounts = await accountsRef.get();
    if (existingAccounts.empty) {
      const batch = db.batch();
      for (const acc of defaultAccounts) {
        const docRef = accountsRef.doc();
        batch.set(docRef, { ...acc, created_at: new Date().toISOString() });
      }
      await batch.commit();
      console.log('✅ Default accounts created (Bank Account 1, 2, 3)');
    } else {
      console.log('ℹ️  Accounts already exist, skipping');
    }

    console.log('\n🎉 Seed complete!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  }
};

seed();
