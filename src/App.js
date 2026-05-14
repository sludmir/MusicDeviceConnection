import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';
import './App.css';
import { MdDarkMode, MdLightMode, MdNotificationsNone, MdPerson, MdHeadphones, MdSettings, MdTune, MdInventory2, MdLogout, MdPlayCircleOutline } from 'react-icons/md';
import { FiSearch, FiChevronDown } from 'react-icons/fi';
import { signInWithGoogle, logout } from "./Auth";
import { auth } from "./firebaseConfig";
import { collection, getDocs, doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebaseConfig";
import { initializeDatabase } from './firebaseUtils';
import AppShell from './AppShell';
import ProductImporter from './ProductImporter';
import SetupTimelineImport from './SetupTimeline';
import { getDefaultVariant } from './utils/sceneVariants';
import SceneVariantSwitcherImport from './components/SceneVariantSwitcher';
import ProductDashboardImport from './ProductDashboard';
import MySetsImport from './MySets';
import SettingsImport from './Settings';
import PreferencesImport from './Preferences';
import HubLandingPageImport from './components/HubLandingPage';
import SaveSetupButtonImport from './components/SaveSetupButton';
import ConnectionGuideButtonImport from './components/ConnectionGuideButton';
import FeedImport from './components/Feed';
import PostSetModalImport from './components/PostSetModal';
import UploadImport from './components/Upload';
import ProfileImport from './components/Profile';
import UserSearchImport from './components/UserSearch';
import NotificationsImport from './components/Notifications';

const ThreeScene = lazy(() =>
  import('./ThreeScene').then((m) => {
    const C = m.ThreeScene || m.default;
    return { default: typeof C === 'function' ? C : (m.default && m.default.default) || (() => null) };
  })
);
const unwrap = (m) => (m && typeof m.default === 'function' ? m.default : m);
const SetupTimeline = unwrap(SetupTimelineImport);
const SceneVariantSwitcher = unwrap(SceneVariantSwitcherImport);
const SaveSetupButton = unwrap(SaveSetupButtonImport);
const ConnectionGuideButton = unwrap(ConnectionGuideButtonImport);
const ProductDashboard = unwrap(ProductDashboardImport);
const MySets = unwrap(MySetsImport);
const Settings = unwrap(SettingsImport);
const Preferences = unwrap(PreferencesImport);
const HubLandingPage = unwrap(HubLandingPageImport);
const Feed = unwrap(FeedImport);
const PostSetModal = unwrap(PostSetModalImport);
const Upload = unwrap(UploadImport);
const Profile = unwrap(ProfileImport);
const UserSearch = unwrap(UserSearchImport);
const Notifications = unwrap(NotificationsImport);

function isValidComponent(C) {
  return typeof C === 'function' || (C && typeof C === 'object' && typeof C.$$typeof === 'symbol');
}
const APP_COMPONENTS = [
  ['SetupTimeline', SetupTimeline],
  ['SceneVariantSwitcher', SceneVariantSwitcher],
  ['SaveSetupButton', SaveSetupButton],
  ['ProductDashboard', ProductDashboard],
  ['MySets', MySets],
  ['Settings', Settings],
  ['Preferences', Preferences],
  ['HubLandingPage', HubLandingPage],
  ['Feed', Feed],
  ['Upload', Upload],
  ['Profile', Profile],
  ['UserSearch', UserSearch],
  ['Notifications', Notifications],
];
const INVALID_COMPONENTS = APP_COMPONENTS.filter(([, C]) => !isValidComponent(C)).map(([name]) => name);

async function testFirebaseConnection() {
  try {
    if (!auth || !db) return false;
    const currentUser = auth.currentUser;
    if (!currentUser) return false;
    try {
      const testRef = collection(db, "users");
      await getDocs(testRef);
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
  const [sceneVariant, setSceneVariant] = useState(null);
  const [setupDevices, setSetupDevices] = useState({ DJ: [], Producer: [], Musician: [] });
  const [isFirebaseConnected, setIsFirebaseConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [actualDevices, setActualDevices] = useState([]);
  const [threeSceneToggleFunction, setThreeSceneToggleFunction] = useState(null);
  const [showFeedPostSetModal, setShowFeedPostSetModal] = useState(false);
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('livet-set-theme') || 'light';
    } catch {
      return 'light';
    }
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('livet-set-theme', theme);
    } catch (_) {}
  }, [theme]);

  useEffect(() => {
    if (selectedSetup && sceneVariant === null) {
      setSceneVariant(getDefaultVariant(selectedSetup));
    }
  }, [selectedSetup, sceneVariant]);

  const toggleTheme = () => setTheme((t) => (t === 'light' ? 'dark' : 'light'));

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      setUser(user);
      if (user) {
        try {
          await initializeDatabase();
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
          }
          const connected = await testFirebaseConnection();
          setIsFirebaseConnected(connected);
          if (!connected) setError("Failed to connect to Firebase. Please try again.");
        } catch (err) {
          console.error("Error during initialization:", err);
          setError("Connection error. Please try again.");
        }
      } else {
        setIsFirebaseConnected(false);
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (isFirebaseConnected && user) {
      setSetupDevices(prev => ({ ...prev, DJ: [], Producer: [], Musician: [] }));
    }
  }, [isFirebaseConnected, user]);

  useEffect(() => {
    window.setupDevices = setupDevices;
  }, [setupDevices]);

  const handleCategorySelect = (categoryId) => setSelectedCategory(categoryId);

  const handleDevicesChange = useCallback((devices) => {
    setActualDevices(devices);
  }, []);

  const handleCategoryToggle = (categoryId) => {
    if (threeSceneToggleFunction) threeSceneToggleFunction(categoryId);
  };

  const handleThreeSceneToggleSetup = (toggleFunction) => {
    setThreeSceneToggleFunction(() => toggleFunction);
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

  if (!user) {
    return (
      <div className="App" style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <header className="App-header">
          <div className="App-header-left">
            <button
              type="button"
              className="theme-toggle"
              onClick={toggleTheme}
              aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
              title={theme === 'light' ? 'Dark mode' : 'Light mode'}
            >
              {theme === 'light' ? <MdDarkMode size={20} /> : <MdLightMode size={20} />}
            </button>
          </div>
          <div className="App-header-center" style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
            <img src={theme === 'dark' ? '/liveset-logo-dark.png' : '/liveset-logo.png'} alt="LiveSet" style={{ height: '64px', width: 'auto', display: 'block' }} />
          </div>
          <div className="App-header-right">
            <button type="button" className="sign-in-btn" onClick={signInWithGoogle}>Sign In with Google</button>
          </div>
        </header>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <AppRoutes
        user={user}
        theme={theme}
        toggleTheme={toggleTheme}
        selectedSetup={selectedSetup}
        setSelectedSetup={setSelectedSetup}
        sceneVariant={sceneVariant}
        setSceneVariant={setSceneVariant}
        setupDevices={setupDevices}
        setSetupDevices={setSetupDevices}
        actualDevices={actualDevices}
        setActualDevices={setActualDevices}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        isFirebaseConnected={isFirebaseConnected}
        showFeedPostSetModal={showFeedPostSetModal}
        setShowFeedPostSetModal={setShowFeedPostSetModal}
        handleDevicesChange={handleDevicesChange}
        handleCategorySelect={handleCategorySelect}
        handleCategoryToggle={handleCategoryToggle}
        handleThreeSceneToggleSetup={handleThreeSceneToggleSetup}
      />
    </BrowserRouter>
  );
}

function AppRoutes({
  user,
  theme,
  toggleTheme,
  selectedSetup,
  setSelectedSetup,
  sceneVariant,
  setSceneVariant,
  setupDevices,
  setSetupDevices,
  actualDevices,
  setActualDevices,
  selectedCategory,
  setSelectedCategory,
  isFirebaseConnected,
  showFeedPostSetModal,
  setShowFeedPostSetModal,
  handleDevicesChange,
  handleCategorySelect,
  handleCategoryToggle,
  handleThreeSceneToggleSetup,
}) {
  const navigate = useNavigate();
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const closeDropdown = () => setIsProfileDropdownOpen(false);
  const toggleProfileDropdown = () => setIsProfileDropdownOpen((o) => !o);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isProfileDropdownOpen && !event.target.closest('.profile-dropdown-container')) {
        closeDropdown();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isProfileDropdownOpen]);

  const goAndClose = (path) => () => {
    closeDropdown();
    navigate(path);
  };

  const handleLogoClick = () => {
    setSelectedSetup(null);
    setSelectedCategory(null);
    setActualDevices([]);
    navigate('/hub');
  };

  const handleSetupSelectFromLanding = (setup) => {
    const type = setup.setupType || 'DJ';
    setSelectedSetup(type);
    setActualDevices(setup.devices || []);
    setSetupDevices(prev => ({ ...prev, [type]: setup.devices || [] }));
    setSceneVariant(setup.sceneVariant || getDefaultVariant(type));
    navigate('/builder');
  };

  const handleNewSetupFromLanding = (setupType) => {
    setSelectedSetup(setupType);
    setActualDevices([]);
    setSetupDevices(prev => ({ ...prev, [setupType]: [] }));
    navigate('/builder');
  };

  return (
    <div className="App" style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="App-header">
        <div className="App-header-left">
          <button
            type="button"
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            title={theme === 'light' ? 'Dark mode' : 'Light mode'}
          >
            {theme === 'light' ? <MdDarkMode size={20} /> : <MdLightMode size={20} />}
          </button>
        </div>
        <div
          className="App-header-center"
          onClick={handleLogoClick}
          style={{
            cursor: 'pointer',
            transition: 'opacity 0.2s ease',
            userSelect: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '7px'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85'; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
          role="button"
          aria-label="LiveSet home"
        >
          <img src={theme === 'dark' ? '/liveset-logo-dark.png' : '/liveset-logo.png'} alt="LiveSet" style={{ height: '64px', width: 'auto', display: 'block' }} />
        </div>
        <div className="App-header-right">
          <div className="profile-dropdown-container" style={{ position: 'relative' }}>
            <div
              className="header-profile-trigger"
              onClick={toggleProfileDropdown}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '5px 8px', borderRadius: '5px', transition: 'background-color 0.2s ease' }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleProfileDropdown(); } }}
            >
              <div style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: '#00a2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '10px' }}>
                {user.displayName ? user.displayName.charAt(0).toUpperCase() : 'U'}
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '10px', fontWeight: '500' }}>{user.displayName || 'User'}</p>
                <p style={{ margin: 0, fontSize: '8px', opacity: 0.7 }}>{user.email}</p>
              </div>
              <div style={{ transform: isProfileDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}>
                <FiChevronDown size={14} />
              </div>
            </div>

            {isProfileDropdownOpen && (
              <div className="profile-dropdown-menu" style={{ position: 'absolute', top: '100%', right: 0, minWidth: '200px', zIndex: 1000, marginTop: '4px' }}>
                <div style={{ padding: '8px 0' }}>
                  <div className="profile-dropdown-item" onClick={goAndClose('/search')} style={{ padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <FiSearch size={18} style={{ flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '500' }}>Search users</div>
                      <div className="profile-dropdown-item-sub">Find people to follow</div>
                    </div>
                  </div>
                  <div className="profile-dropdown-item" onClick={goAndClose('/notifications')} style={{ padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <MdNotificationsNone size={20} style={{ flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '500' }}>Notifications</div>
                      <div className="profile-dropdown-item-sub">Recent activity</div>
                    </div>
                  </div>
                  <div className="profile-dropdown-item" onClick={goAndClose('/feed')} style={{ padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <MdPlayCircleOutline size={20} style={{ flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '500' }}>Feed</div>
                      <div className="profile-dropdown-item-sub">Discover live sets</div>
                    </div>
                  </div>
                  <div className="profile-dropdown-item" onClick={goAndClose('/profile')} style={{ padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <MdPerson size={20} style={{ flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '500' }}>My Profile</div>
                      <div className="profile-dropdown-item-sub">View your profile & setups</div>
                    </div>
                  </div>
                  <div className="profile-dropdown-item" onClick={goAndClose('/sets')} style={{ padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <MdHeadphones size={20} style={{ flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '500' }}>My Sets</div>
                      <div className="profile-dropdown-item-sub">View saved setups</div>
                    </div>
                  </div>
                  <div className="profile-dropdown-item" onClick={goAndClose('/settings')} style={{ padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <MdSettings size={20} style={{ flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '500' }}>Settings</div>
                      <div className="profile-dropdown-item-sub">Manage profile</div>
                    </div>
                  </div>
                  <div className="profile-dropdown-item" onClick={goAndClose('/preferences')} style={{ padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <MdTune size={20} style={{ flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '500' }}>Preferences</div>
                      <div className="profile-dropdown-item-sub">Budget & options</div>
                    </div>
                  </div>
                  <div className="profile-dropdown-item" onClick={goAndClose('/admin/products')} style={{ padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <MdInventory2 size={20} style={{ flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '500' }}>Product Management</div>
                      <div className="profile-dropdown-item-sub">Manage products & prices</div>
                    </div>
                  </div>
                  <div className="profile-dropdown-divider" />
                  <div className="profile-dropdown-item" onClick={() => { closeDropdown(); logout(); }} style={{ padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <MdLogout size={20} style={{ flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '500' }}>Sign Out</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<Navigate to="/hub" replace />} />
            <Route path="/hub" element={
              <HubLandingPage
                onSetupSelect={handleSetupSelectFromLanding}
                onNewSetup={handleNewSetupFromLanding}
                onFeedClick={() => navigate('/feed')}
                onAddProducts={() => navigate('/admin/products-import')}
                theme={theme}
              />
            } />
            <Route path="/feed" element={
              <Feed
                onProfileClick={(userId) => navigate(`/profile/${userId}`)}
                onUploadClick={() => setShowFeedPostSetModal(true)}
                onCopySetup={async (setupId) => {
                  try {
                    const setupSnap = await getDoc(doc(db, 'setups', setupId));
                    if (setupSnap.exists()) {
                      const setup = { id: setupSnap.id, ...setupSnap.data() };
                      handleSetupSelectFromLanding(setup);
                    }
                  } catch (err) {
                    console.error('Error loading setup:', err);
                  }
                }}
                theme={theme}
              />
            } />
            <Route path="/sets" element={
              <MySets
                onSelectSetup={handleSetupSelectFromLanding}
                onNewSetup={handleNewSetupFromLanding}
              />
            } />
            <Route path="/profile" element={
              <Profile
                userId={auth.currentUser?.uid}
                onBack={() => navigate('/feed')}
                onSetupSelect={handleSetupSelectFromLanding}
              />
            } />
            <Route path="/profile/:id" element={
              <ProfileRoute
                onBack={() => navigate('/feed')}
                onSetupSelect={handleSetupSelectFromLanding}
              />
            } />
            <Route path="/search" element={
              <UserSearch
                onBack={() => navigate('/feed')}
                onProfileClick={(userId) => navigate(`/profile/${userId}`)}
              />
            } />
            <Route path="/notifications" element={
              <Notifications
                onBack={() => navigate('/feed')}
                onProfileClick={(userId) => navigate(`/profile/${userId}`)}
              />
            } />
            <Route path="/settings" element={<Settings onBack={() => navigate('/hub')} />} />
            <Route path="/preferences" element={<Preferences onBack={() => navigate('/hub')} />} />
            <Route path="/admin/products" element={<ProductDashboard onClose={() => navigate('/hub')} />} />
            <Route path="/admin/products-import" element={<ProductImporter onBack={() => navigate('/hub')} />} />
            <Route path="/upload" element={<Upload onBack={() => navigate('/feed')} onSuccess={() => navigate('/feed')} />} />
            <Route path="*" element={<Navigate to="/hub" replace />} />
          </Route>
          <Route path="/builder" element={
            selectedSetup ? (
              <Suspense fallback={<div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0c0c12', color: 'rgba(255,255,255,0.6)' }}>Loading scene…</div>}>
                <div className="setup-container" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div className="main-content" style={{ flex: 1, position: 'relative', marginBottom: '80px' }}>
                    <div style={{ position: 'absolute', top: '20px', right: '20px', zIndex: 250, display: 'flex', gap: '10px' }}>
                      <button
                        type="button"
                        className="builder-feed-btn"
                        onClick={() => navigate('/feed')}
                        title="Open the LiveSet feed"
                      >
                        <MdPlayCircleOutline size={18} />
                        Feed
                      </button>
                      <ConnectionGuideButton currentDevices={actualDevices} setupType={selectedSetup} />
                      <SaveSetupButton currentDevices={actualDevices} setupType={selectedSetup} sceneVariant={sceneVariant} />
                    </div>
                    <ThreeScene
                      devices={setupDevices[selectedSetup]}
                      isInitialized={isFirebaseConnected}
                      setupType={selectedSetup}
                      onDevicesChange={handleDevicesChange}
                      onCategoryToggle={handleThreeSceneToggleSetup}
                      sceneVariant={sceneVariant}
                      onSceneVariantChange={setSceneVariant}
                    />
                  </div>
                  <SetupTimeline
                    setupType={selectedSetup}
                    currentDevices={actualDevices}
                    onCategorySelect={handleCategorySelect}
                    selectedCategory={selectedCategory}
                    onToggleCategory={handleCategoryToggle}
                  />
                  {SceneVariantSwitcher && (
                    <SceneVariantSwitcher
                      setupType={selectedSetup}
                      value={sceneVariant || getDefaultVariant(selectedSetup)}
                      onChange={setSceneVariant}
                    />
                  )}
                </div>
              </Suspense>
            ) : (
              <Navigate to="/hub" replace />
            )
          } />
        </Routes>
      </div>

      {showFeedPostSetModal && (
        <PostSetModal
          theme={theme}
          onClose={() => setShowFeedPostSetModal(false)}
          onSuccess={() => setShowFeedPostSetModal(false)}
        />
      )}
    </div>
  );
}

function ProfileRoute({ onBack, onSetupSelect }) {
  const { id } = useParams();
  return <Profile userId={id} onBack={onBack} onSetupSelect={onSetupSelect} />;
}

export default App;
