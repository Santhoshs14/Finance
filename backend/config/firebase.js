const admin = require('firebase-admin');
const path = require('path');

const serviceAccountPath = path.join(__dirname, '..', 'serviceAccountKey.json');

let serviceAccount;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } catch (err) {
    console.error('⚠️  Failed to parse FIREBASE_SERVICE_ACCOUNT environment variable!');
    console.error('   Please ensure it is a valid JSON string.');
    process.exit(1);
  }
} else {
  try {
    serviceAccount = require(serviceAccountPath);
  } catch (err) {
    console.error('⚠️  serviceAccountKey.json not found and FIREBASE_SERVICE_ACCOUNT env var is not set!');
    console.error('   Please download it from Firebase Console:');
    console.error('   Project Settings → Service Accounts → Generate New Private Key');
    console.error(`   Place it at: ${serviceAccountPath}`);
    process.exit(1);
  }
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

module.exports = { admin, db };
