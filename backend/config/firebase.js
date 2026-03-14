const admin = require('firebase-admin');
const path = require('path');

const serviceAccountPath = path.join(__dirname, '..', 'serviceAccountKey.json');

let serviceAccount;
try {
  serviceAccount = require(serviceAccountPath);
} catch (err) {
  console.error('⚠️  serviceAccountKey.json not found!');
  console.error('   Please download it from Firebase Console:');
  console.error('   Project Settings → Service Accounts → Generate New Private Key');
  console.error(`   Place it at: ${serviceAccountPath}`);
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

module.exports = { admin, db };
