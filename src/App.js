import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import SearchBar from './SearchBar';
import DeviceDisplay from './DeviceDisplay';
import ThreeScene from './ThreeScene';
import SetupTimeline from './SetupTimeline';
// import ConnectionPanel from './ConnectionPanel';
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
      const testRef = collection(db, "users");
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
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [actualDevices, setActualDevices] = useState([]);
  const [threeSceneToggleFunction, setThreeSceneToggleFunction] = useState(null);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);

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

  useEffect(() => {
    window.setupDevices = setupDevices;
  }, [setupDevices]);

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
    setActualDevices([]); // Reset devices when switching setup types
    setSelectedCategory(null); // Reset selected category
  };

  const addDeviceToSetup = (setupType, device) => {
    setSetupDevices(prev => ({
      ...prev,
      [setupType]: [...prev[setupType], device]
    }));
  };

  const handleCategorySelect = (categoryId) => {
    setSelectedCategory(categoryId);
    console.log('Selected category:', categoryId);
  };

  const handleDevicesChange = (devices) => {
    setActualDevices(devices);
    console.log('Devices updated in App.js:', devices.map(d => d.name));
  };

  const handleCategoryToggle = (categoryId, isVisible) => {
    // Call the ThreeScene toggle function
    if (threeSceneToggleFunction) {
      threeSceneToggleFunction(categoryId, isVisible);
    }
  };

  const handleThreeSceneToggleSetup = (toggleFunction) => {
    setThreeSceneToggleFunction(() => toggleFunction);
  };

  const toggleProfileDropdown = () => {
    setIsProfileDropdownOpen(!isProfileDropdownOpen);
  };

  const closeProfileDropdown = () => {
    setIsProfileDropdownOpen(false);
  };

  const handleMySets = () => {
    console.log('Navigate to My Sets');
    closeProfileDropdown();
    // TODO: Implement My Sets screen
  };

  const handleSettings = () => {
    console.log('Navigate to Settings');
    closeProfileDropdown();
    // TODO: Implement Settings screen
  };

  const handlePreferences = () => {
    console.log('Navigate to Preferences');
    closeProfileDropdown();
    // TODO: Implement Preferences screen
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isProfileDropdownOpen && !event.target.closest('.profile-dropdown-container')) {
        closeProfileDropdown();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isProfileDropdownOpen]);

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
        <h1 
          onClick={() => {
            setSelectedSetup(null);
            setSelectedCategory(null);
            setActualDevices([]);
          }} 
          style={{ 
            cursor: 'pointer', 
            transition: 'opacity 0.2s ease',
            userSelect: 'none'
          }}
          onMouseEnter={(e) => e.target.style.opacity = '0.7'}
          onMouseLeave={(e) => e.target.style.opacity = '1'}
        >
          Music Equipment Configurator
        </h1>
        {user ? (
          <div className="profile-dropdown-container" style={{ position: 'relative' }}>
            <div 
              onClick={toggleProfileDropdown}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '12px', 
                cursor: 'pointer',
                padding: '8px 12px',
                borderRadius: '6px',
                transition: 'background-color 0.2s ease'
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'}
              onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
            >
              <div style={{ 
                width: '32px', 
                height: '32px', 
                borderRadius: '50%', 
                backgroundColor: '#00a2ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: 'bold',
                fontSize: '14px'
              }}>
                {user.displayName ? user.displayName.charAt(0).toUpperCase() : 'U'}
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: '500' }}>
                  {user.displayName || 'User'}
                </p>
                <p style={{ margin: 0, fontSize: '12px', opacity: 0.7 }}>
                  {user.email}
                </p>
              </div>
              <div style={{ 
                transform: isProfileDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease'
              }}>
                ▼
              </div>
            </div>
            
            {isProfileDropdownOpen && (
              <div style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                backgroundColor: '#1a1a1a',
                border: '1px solid #333',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                minWidth: '200px',
                zIndex: 1000,
                marginTop: '4px'
              }}>
                <div style={{ padding: '8px 0' }}>
                  <div 
                    onClick={handleMySets}
                    style={{
                      padding: '12px 16px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      transition: 'background-color 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'}
                    onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                  >
                    <span style={{ fontSize: '16px' }}>🎧</span>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '500' }}>My Sets</div>
                      <div style={{ fontSize: '12px', opacity: 0.7 }}>View saved setups</div>
                    </div>
                  </div>
                  
                  <div 
                    onClick={handleSettings}
                    style={{
                      padding: '12px 16px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      transition: 'background-color 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'}
                    onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                  >
                    <span style={{ fontSize: '16px' }}>⚙️</span>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '500' }}>Settings</div>
                      <div style={{ fontSize: '12px', opacity: 0.7 }}>Manage profile</div>
                    </div>
                  </div>
                  
                  <div 
                    onClick={handlePreferences}
                    style={{
                      padding: '12px 16px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      transition: 'background-color 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'}
                    onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                  >
                    <span style={{ fontSize: '16px' }}>🎛️</span>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '500' }}>Preferences</div>
                      <div style={{ fontSize: '12px', opacity: 0.7 }}>Budget & options</div>
                    </div>
                  </div>
                  
                  <div style={{ 
                    height: '1px', 
                    backgroundColor: '#333', 
                    margin: '8px 0' 
                  }}></div>
                  
                  <div 
                    onClick={logout}
                    style={{
                      padding: '12px 16px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      transition: 'background-color 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'}
                    onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                  >
                    <span style={{ fontSize: '16px' }}>🚪</span>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '500' }}>Sign Out</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
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
          <div className="setup-container" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            {/* <ConnectionPanel 
              devices={setupDevices[selectedSetup]} 
              setupType={selectedSetup}
            /> */}
            <div className="main-content" style={{ flex: 1, position: 'relative', marginBottom: '80px' }}>
              <ThreeScene 
                devices={setupDevices[selectedSetup]} 
                isInitialized={isFirebaseConnected}
                setupType={selectedSetup}
                onDevicesChange={handleDevicesChange}
                onCategoryToggle={handleThreeSceneToggleSetup}
              />
            </div>
            <SetupTimeline 
              setupType={selectedSetup}
              currentDevices={actualDevices}
              onCategorySelect={handleCategorySelect}
              selectedCategory={selectedCategory}
              onToggleCategory={handleCategoryToggle}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default App;