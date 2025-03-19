import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence, CACHE_SIZE_UNLIMITED } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBvBg2-bMMDpKYCSKIIt4MQotXVvZr5Qwg",
  authDomain: "musicdeviceconnection.firebaseapp.com",
  projectId: "musicdeviceconnection",
  storageBucket: "musicdeviceconnection.appspot.com",
  messagingSenderId: "897367746043",
  appId: "1:897367746043:web:94426c84afeaac5255175e",
  measurementId: "G-WJGQ979CK1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// Initialize Firestore with settings
const db = getFirestore(app);

// Initialize Storage
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

// Call enablePersistence
enablePersistence();

export { auth, provider, signInWithPopup, signOut, db, storage };