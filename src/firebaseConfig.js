import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence, CACHE_SIZE_UNLIMITED } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Use environment variables for Firebase configuration
// Set these in your .env file or CI/CD environment variables
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
};

// Validate that all required config values are present
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  throw new Error('Missing required Firebase configuration. Please set REACT_APP_FIREBASE_* environment variables.');
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth with enhanced security settings
const auth = getAuth(app);
auth.useDeviceLanguage(); // Better UX for authentication dialogs
const provider = new GoogleAuthProvider();
// Add additional scopes if needed 
// provider.addScope('https://www.googleapis.com/auth/contacts.readonly');

// Set persistence to reduce re-authentication needs
// import { setPersistence, browserLocalPersistence } from "firebase/auth";
// setPersistence(auth, browserLocalPersistence);

// Initialize Firestore with settings
// Note: getFirestore(app) uses the "(default)" database
// To use a different database, use: getFirestore(app, 'devicedatabase')
const db = getFirestore(app);

// Log which database is being used (for debugging)
console.log('Firestore database ID:', db._databaseId?.database || '(default)');

// Initialize Storage with security settings
const storage = getStorage(app);

// Enable offline persistence with error handling
const enablePersistence = async () => {
  try {
    await enableIndexedDbPersistence(db, {
      cacheSizeBytes: CACHE_SIZE_UNLIMITED,
      synchronizeTabs: true
    });
    console.log("Offline persistence enabled successfully");
  } catch (err) {
    if (err.code === 'failed-precondition') {
      console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
    } else if (err.code === 'unimplemented') {
      console.warn('The current browser doesn\'t support persistence.');
    } else {
      console.error('Error enabling persistence:', err);
    }
  }
};

// Secured sign-in function with error handling and additional security checks
const secureSignIn = async () => {
  try {
    // Add additional security options
    provider.setCustomParameters({
      // Force account selection even when one account is available
      prompt: 'select_account'
    });
    
    return await signInWithPopup(auth, provider);
  } catch (error) {
    console.error("Authentication Error:", error);
    throw error;
  }
};

// Call enablePersistence
enablePersistence();

export { auth, provider, signInWithPopup, secureSignIn, signOut, db, storage };
