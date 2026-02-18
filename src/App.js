import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import './App.css';
import { signInWithGoogle, logout } from "./Auth";
import { auth } from "./firebaseConfig";
import { collection, getDocs, doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebaseConfig";
import { initializeDatabase } from './firebaseUtils';
import { findProductByName, prepareProductForSetup, canAddProductToSetup } from './utils/productSearch';
import { getRecommendedPosition } from './utils/devicePlacement';
import SetupTimelineImport from './SetupTimeline';
import ProductDashboardImport from './ProductDashboard';
import MySetsImport from './MySets';
import SettingsImport from './Settings';
import PreferencesImport from './Preferences';
import HubLandingPageImport from './components/HubLandingPage';
import SaveSetupButtonImport from './components/SaveSetupButton';
import FeedImport from './components/Feed';
import UploadImport from './components/Upload';
import ProfileImport from './components/Profile';

const ThreeScene = lazy(() =>
  import('./ThreeScene').then((m) => {
    const C = m.ThreeScene || m.default;
    return { default: typeof C === 'function' ? C : (m.default && m.default.default) || (() => null) };
  })
);
const unwrap = (m) => (m && typeof m.default === 'function' ? m.default : m);
const SetupTimeline = unwrap(SetupTimelineImport);
const SaveSetupButton = unwrap(SaveSetupButtonImport);
const ProductDashboard = unwrap(ProductDashboardImport);
const MySets = unwrap(MySetsImport);
const Settings = unwrap(SettingsImport);
const Preferences = unwrap(PreferencesImport);
const HubLandingPage = unwrap(HubLandingPageImport);
const Feed = unwrap(FeedImport);
const Upload = unwrap(UploadImport);
const Profile = unwrap(ProfileImport);

function isValidComponent(C) {
  return typeof C === 'function' || (C && typeof C === 'object' && typeof C.$$typeof === 'symbol');
}
const APP_COMPONENTS = [
  ['SetupTimeline', SetupTimeline],
  ['SaveSetupButton', SaveSetupButton],
  ['ProductDashboard', ProductDashboard],
  ['MySets', MySets],
  ['Settings', Settings],
  ['Preferences', Preferences],
  ['HubLandingPage', HubLandingPage],
  ['Feed', Feed],
  ['Upload', Upload],
  ['Profile', Profile],
];
const INVALID_COMPONENTS = APP_COMPONENTS.filter(([, C]) => !isValidComponent(C)).map(([name]) => name);

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
  const [isFirebaseConnected, setIsFirebaseConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [actualDevices, setActualDevices] = useState([]);
  const [threeSceneToggleFunction, setThreeSceneToggleFunction] = useState(null);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [showProductDashboard, setShowProductDashboard] = useState(false);
  const [currentView, setCurrentView] = useState(null); // 'mySets', 'settings', 'preferences', 'productDashboard', 'feed', 'upload', 'profile'
  const [profileUserId, setProfileUserId] = useState(null);

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

          // Initialize user profile if doesn't exist
          const userRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userRef);
          if (!userSnap.exists()) {
            await setDoc(userRef, {
              displayName: user.email?.split('@')[0] || 'User',
              email: user.email,
              followers: [],
              following: [],
              createdAt: serverTimestamp()
            });
            console.log("User profile initialized");
          }

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

  const handleSetupSelection = (setupType) => {
    setSelectedSetup(setupType);
    setActualDevices([]); // Reset devices when switching setup types
    setSelectedCategory(null); // Reset selected category
  };

  const handleCategorySelect = (categoryId) => {
    setSelectedCategory(categoryId);
    console.log('Selected category:', categoryId);
  };

  const handleDevicesChange = useCallback((devices) => {
    setActualDevices(devices);
    console.log('Devices updated in App.js:', devices.map(d => d.name));
  }, []);

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
    closeProfileDropdown();
    setCurrentView('mySets');
  };

  const handleSettings = () => {
    closeProfileDropdown();
    setCurrentView('settings');
  };

  const handlePreferences = () => {
    closeProfileDropdown();
    setCurrentView('preferences');
  };

  const handleProductManagement = () => {
    closeProfileDropdown();
    setCurrentView('productDashboard');
  };

  const handleFeed = () => {
    closeProfileDropdown();
    setCurrentView('feed');
  };

  const handleBackToMain = () => {
    setCurrentView(null);
  };

  // Handle adding a device from search
  const handleAddDevice = async (searchQuery) => {
    if (!selectedSetup) {
      alert('Please select a setup type first');
      return;
    }

    try {
      // Search for the product
      const product = await findProductByName(searchQuery);
      
      if (!product) {
        alert(`Product "${searchQuery}" not found. Please check the spelling or try a different name.`);
        return;
      }

      // Validate if product can be added
      const validation = canAddProductToSetup(product, selectedSetup, actualDevices);
      if (!validation.canAdd) {
        alert(validation.reason);
        return;
      }

      // Get spot configuration for current setup type
      const spotConfig = getSpotConfigForSetup(selectedSetup);
      
      // Prepare device with smart placement
      const newDevice = prepareProductForSetup(
        product, 
        selectedSetup, 
        actualDevices, 
        spotConfig
      );

      if (!newDevice) {
        alert('Failed to prepare device for setup');
        return;
      }

      // Add device to setup
      const updatedDevices = [...actualDevices, newDevice];
      setActualDevices(updatedDevices);
      
      // Update setupDevices state
      setSetupDevices(prev => ({
        ...prev,
        [selectedSetup]: updatedDevices
      }));

      console.log('Device added:', newDevice.name, 'at position:', newDevice);
    } catch (error) {
      console.error('Error adding device:', error);
      alert('Failed to add device. Please try again.');
    }
  };

  // Get spot configuration for setup type
  const getSpotConfigForSetup = (setupType) => {
    // This matches the spot configuration in ThreeScene.js
    const djSetupSpots = [
      { x: 0, y: 1.05, z: 0, type: 'middle' },
      { x: -0.8, y: 1.05, z: 0, type: 'middle_left' },
      { x: 0.8, y: 1.05, z: 0, type: 'middle_right' },
      { x: -1.6, y: 1.05, z: 0, type: 'far_left' },
      { x: 1.6, y: 1.05, z: 0, type: 'far_right' },
      { x: -0.4, y: 1.05, z: 0, type: 'middle_left_inner' },
      { x: 0.4, y: 1.05, z: 0, type: 'middle_right_inner' },
      { x: 0, y: 1.05, z: -0.2, type: 'middle_back' },
      { x: 0, y: 1.5, z: -0.5, type: 'fx_top' },
      { x: -0.4, y: 1.05, z: -0.3, type: 'fx_left' },
      { x: 0.4, y: 1.05, z: -0.3, type: 'fx_right' },
      { x: 0, y: 1.05, z: 0.3, type: 'fx_front' }
    ];

    switch (setupType) {
      case 'DJ':
        return djSetupSpots;
      case 'Producer':
        return [
          { x: 0, y: 1.05, z: 0, type: 'interface' },
          { x: -0.8, y: 1.05, z: 0, type: 'synth_left' },
          { x: 0.8, y: 1.05, z: 0, type: 'synth_right' },
          { x: -1.6, y: 1.05, z: 0, type: 'fx_left' },
          { x: 1.6, y: 1.05, z: 0, type: 'fx_right' }
        ];
      case 'Musician':
        return [
          { x: 0, y: 1.05, z: 0, type: 'center' },
          { x: -0.8, y: 1.05, z: 0, type: 'left' },
          { x: 0.8, y: 1.05, z: 0, type: 'right' }
        ];
      default:
        return djSetupSpots;
    }
  };

  // Handle setup selection from landing page
  const handleSetupSelectFromLanding = (setup) => {
    setSelectedSetup(setup.setupType || 'DJ');
    setActualDevices(setup.devices || []);
    setSetupDevices(prev => ({
      ...prev,
      [setup.setupType || 'DJ']: setup.devices || []
    }));
    setCurrentView(null);
  };

  // Handle new setup creation from landing page
  const handleNewSetupFromLanding = (setupType) => {
    setSelectedSetup(setupType);
    setActualDevices([]);
    setSetupDevices(prev => ({
      ...prev,
      [setupType]: []
    }));
    setCurrentView(null);
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

  if (INVALID_COMPONENTS.length > 0) {
    return (
      <div className="App" style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#0c0c12', color: '#fff', padding: 24 }}>
        <div style={{ maxWidth: 480, textAlign: 'center' }}>
          <h2>Invalid component(s)</h2>
          <p style={{ margin: '16px 0', fontFamily: 'monospace', background: '#222', padding: 12, borderRadius: 8 }}>
            {INVALID_COMPONENTS.join(', ')}
          </p>
          <p style={{ opacity: 0.8, fontSize: 14 }}>
            Check that each file exports a default React component (e.g. <code>export default ComponentName</code>).
          </p>
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
            setCurrentView(null);
          }} 
          style={{ 
            cursor: 'pointer', 
            transition: 'opacity 0.2s ease',
            userSelect: 'none'
          }}
          onMouseEnter={(e) => e.target.style.opacity = '0.7'}
          onMouseLeave={(e) => e.target.style.opacity = '1'}
        >
          LiveSet
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
                    onClick={handleFeed}
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
                    <span style={{ fontSize: '16px' }}>📱</span>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '500' }}>Feed</div>
                      <div style={{ fontSize: '12px', opacity: 0.7 }}>Discover live sets</div>
                    </div>
                  </div>
                  
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
                  
                  <div 
                    onClick={handleProductManagement}
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
                    <span style={{ fontSize: '16px' }}>📦</span>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '500' }}>Product Management</div>
                      <div style={{ fontSize: '12px', opacity: 0.7 }}>Manage products & prices</div>
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
        {/* Render different views based on currentView state */}
        {currentView === 'mySets' ? (
          <MySets 
            onBack={handleBackToMain}
            onSelectSetup={(setup) => {
              handleSetupSelectFromLanding(setup);
              setCurrentView(null);
            }}
            currentSetup={selectedSetup}
            currentDevices={actualDevices}
            setupType={selectedSetup}
          />
        ) : currentView === 'settings' ? (
          <Settings onBack={handleBackToMain} />
        ) : currentView === 'preferences' ? (
          <Preferences onBack={handleBackToMain} />
        ) : currentView === 'productDashboard' ? (
          <ProductDashboard onClose={handleBackToMain} />
        ) : currentView === 'feed' ? (
          <Feed 
            onProfileClick={(userId) => {
              setProfileUserId(userId);
              setCurrentView('profile');
            }}
            onUploadClick={() => setCurrentView('upload')}
          />
        ) : currentView === 'upload' ? (
          <Upload 
            onBack={() => setCurrentView('feed')}
            onSuccess={() => {
              setCurrentView('feed');
            }}
          />
        ) : currentView === 'profile' ? (
          <Profile 
            userId={profileUserId || auth.currentUser?.uid}
            onBack={() => {
              setCurrentView('feed');
              setProfileUserId(null);
            }}
          />
        ) : user && !selectedSetup ? (
          <HubLandingPage
            onSetupSelect={handleSetupSelectFromLanding}
            onNewSetup={handleNewSetupFromLanding}
            onFeedClick={() => setCurrentView('feed')}
          />
        ) : user && selectedSetup ? (
          <Suspense fallback={<div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0c0c12', color: 'rgba(255,255,255,0.6)' }}>Loading scene…</div>}>
          <div className="setup-container" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div className="main-content" style={{ flex: 1, position: 'relative', marginBottom: '80px' }}>
              <div style={{ position: 'absolute', top: '20px', right: '20px', zIndex: 100 }}>
                <SaveSetupButton 
                  currentDevices={actualDevices}
                  setupType={selectedSetup}
                />
              </div>
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
          </Suspense>
        ) : null}
      </div>
      
      {/* Product Dashboard Modal */}
      {showProductDashboard && (
        <ProductDashboard onClose={() => setShowProductDashboard(false)} />
      )}
    </div>
  );
}

export default App;