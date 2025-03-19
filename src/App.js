import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import SearchBar from './SearchBar';
import DeviceDisplay from './DeviceDisplay';
import ThreeScene from './ThreeScene';
import deviceLibrary from './deviceLibrary';
import { v4 as uuidv4 } from 'uuid';
import { signInWithGoogle, logout } from "./Auth";
import { auth } from "./firebaseConfig";
import { collection, getDocs, addDoc, doc } from "firebase/firestore";
import { db, storage } from "./firebaseConfig";
import { initializeDatabase } from './firebaseUtils';

// Test Firebase connection
async function testFirebaseConnection() {
  try {
    console.log("Starting Firebase connection test...");
    
    // Check if Firebase is initialized
    if (!auth || !db) {
      console.error("Firebase is not properly initialized");
      return false;
    }

    // Get current auth state synchronously
    const currentUser = auth.currentUser;
    console.log("Current auth state:", currentUser ? `Authenticated as ${currentUser.email}` : "Not authenticated");

    if (!currentUser) {
      console.log("No user authenticated, please sign in");
      return false;
    }

    // Test Firestore access with a simple query
    try {
      console.log("Testing Firestore access...");
      const testRef = collection(db, "products");
      await getDocs(testRef);
      console.log("Successfully connected to Firestore");
      return true;
    } catch (firestoreError) {
      console.error("Firestore access error:", firestoreError);
      return false;
    }
  } catch (error) {
    console.error("Firebase connection test failed:", error);
    return false;
  }
}

function App() {
  const [user, setUser] = useState(null);
  const [selectedSetup, setSelectedSetup] = useState(null);
  const [setupDevices, setSetupDevices] = useState({
    DJ: [],
    Producer: [],
    Musician: []
  });
  const [device, setDevice] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const sidebarRef = useRef(null);
  const [isFirebaseConnected, setIsFirebaseConnected] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Handle authentication state changes
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      console.log("Auth state changed:", user ? "User logged in" : "User logged out");
      setUser(user);
      
      if (user) {
        console.log("User authenticated:", user.email);
        try {
          // Initialize database if needed
          const initResult = await initializeDatabase();
          console.log("Database initialization result:", initResult);

          // Test Firebase connection
          const connected = await testFirebaseConnection();
          setIsFirebaseConnected(connected);
          if (!connected) {
            setError("Failed to connect to Firebase. Please try again.");
          }
        } catch (error) {
          console.error("Error during initialization:", error);
          setError("Connection error. Please try again.");
        }
      } else {
        console.log("User not authenticated");
        setIsFirebaseConnected(false);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Load initial devices when Firebase is connected
  useEffect(() => {
    if (isFirebaseConnected && user) {
      // Initialize with some default devices if needed
      setSetupDevices(prev => ({
        ...prev,
        DJ: [], // You can populate this with initial devices if needed
        Producer: [],
        Musician: []
      }));
    }
  }, [isFirebaseConnected, user]);

  const handleHamburgerClick = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const handleClickOutside = (event) => {
    if (sidebarRef.current && !sidebarRef.current.contains(event.target)) {
      setIsSidebarOpen(false);
    }
  };

  const handleSetupSelection = (setupType) => {
    setSelectedSetup(setupType);
  };

  if (isLoading) {
    return (
      <div className="App" style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div className="loading-screen">
          <h2>Loading...</h2>
          <p>Please wait while we initialize the application.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="App" style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div className="error-screen">
          <h2>Error</h2>
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="App" style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="App-header" style={{ padding: '20px' }}>
        <h1>Music Equipment Configurator</h1>
        {user ? (
          <div>
            <p>Welcome, {user.displayName}</p>
            <button onClick={logout}>Sign Out</button>
          </div>
        ) : (
          <button onClick={signInWithGoogle}>Sign In with Google</button>
        )}
      </header>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {user && !selectedSetup ? (
          <div className="setup-selection" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
            <h2>Select Your Setup Type</h2>
            <div className="setup-buttons" style={{ display: 'flex', gap: '20px' }}>
              {["DJ", "Producer", "Musician"].map((setupType) => (
                <button 
                  key={setupType} 
                  onClick={() => handleSetupSelection(setupType)}
                  className="setup-button"
                  style={{
                    padding: '20px 40px',
                    fontSize: '18px',
                    cursor: 'pointer'
                  }}
                >
                  {setupType} Setup
                </button>
              ))}
            </div>
          </div>
        ) : user && selectedSetup ? (
          <div className="setup-container" style={{ flex: 1, display: 'flex' }}>
            <div className="main-content" style={{ flex: 1, position: 'relative' }}>
              <ThreeScene 
                devices={setupDevices[selectedSetup]} 
                isInitialized={isFirebaseConnected}
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default App;