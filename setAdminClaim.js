/**
 * Script to set admin custom claim for a user
 * 
 * Usage:
 * 1. Install Firebase Admin SDK: npm install firebase-admin
 * 2. Get your service account key from Firebase Console:
 *    - Go to Project Settings > Service Accounts
 *    - Click "Generate New Private Key"
 *    - Save it as serviceAccountKey.json in the project root
 * 3. Run: node setAdminClaim.js sebasludmir@gmail.com
 * 
 * OR use the Firebase Console method (easier):
 * - Go to Authentication > Users
 * - Find your user
 * - Click the three dots > "Add custom claim"
 * - Add: admin = true
 */

const admin = require('firebase-admin');
const readline = require('readline');

// Initialize Firebase Admin
try {
  const serviceAccount = require('./serviceAccountKey.json');
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  
  console.log('Firebase Admin initialized successfully');
} catch (error) {
  console.error('Error initializing Firebase Admin:', error.message);
  console.log('\nTo use this script:');
  console.log('1. Go to Firebase Console > Project Settings > Service Accounts');
  console.log('2. Click "Generate New Private Key"');
  console.log('3. Save the file as serviceAccountKey.json in the project root');
  console.log('\nOR use the easier method:');
  console.log('1. Go to Firebase Console > Authentication > Users');
  console.log('2. Find your user (sebasludmir@gmail.com)');
  console.log('3. Click the three dots menu > "Add custom claim"');
  console.log('4. Add: admin = true');
  process.exit(1);
}

// Get email from command line or prompt
const email = process.argv[2];

if (!email) {
  console.log('Usage: node setAdminClaim.js <email>');
  console.log('Example: node setAdminClaim.js sebasludmir@gmail.com');
  process.exit(1);
}

async function setAdminClaim(email) {
  try {
    // Get user by email
    const user = await admin.auth().getUserByEmail(email);
    console.log(`Found user: ${user.email} (UID: ${user.uid})`);
    
    // Set admin custom claim
    await admin.auth().setCustomUserClaims(user.uid, { admin: true });
    
    console.log(`✅ Successfully set admin claim for ${email}`);
    console.log('\n⚠️  IMPORTANT: The user needs to sign out and sign back in for the changes to take effect!');
    console.log('   The custom claim is cached in the ID token.');
    
  } catch (error) {
    console.error('Error setting admin claim:', error.message);
    if (error.code === 'auth/user-not-found') {
      console.log(`\nUser with email ${email} not found. Make sure they have signed in at least once.`);
    }
  }
}

setAdminClaim(email).then(() => {
  process.exit(0);
});

