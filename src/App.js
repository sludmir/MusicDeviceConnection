import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams, useLocation } from 'react-router-dom';
import './App.css';
import './components/BuilderControls.css';
import { MdDarkMode, MdLightMode, MdSettings, MdTune, MdInventory2, MdLogout, MdPlayCircleOutline, MdAdd, MdHome } from 'react-icons/md';
import { FiChevronDown } from 'react-icons/fi';
import { signInWithGoogle, logout } from "./Auth";
import { auth } from "./firebaseConfig";
import { collection, getDocs, doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebaseConfig";
import { initializeDatabase } from './firebaseUtils';
import { defaultSettingFor } from './data/settings';
import { hydrateSetupDevices } from './utils/hydrateSetupDevices';
import AppShell from './AppShell';
import { SetPlayerProvider } from './components/SetPlayerProvider';
import ProductImporter from './ProductImporter';
import SceneVariantSwitcherImport from './components/SceneVariantSwitcher';
import ProductDashboardImport from './ProductDashboard';
import SettingsImport from './Settings';
import PreferencesImport from './Preferences';
import HubLandingPageImport from './components/HubLandingPage';
import CreateHubImport from './components/CreateHub';
import LandingPage from './components/LandingPage';
import LegalPage from './components/LegalPage';
import SaveSetupButtonImport from './components/SaveSetupButton';
import ConnectionGuideButtonImport from './components/ConnectionGuideButton';
import FeedImport from './components/Feed';
import PostSetModalImport from './components/PostSetModal';
import UploadImport from './components/Upload';
import ProfileImport from './components/Profile';
import UserSearchImport from './components/UserSearch';
import NotificationsImport from './components/Notifications';
import SetEditorImport from './components/SetEditor';
import BuilderEmptyStateImport from './components/BuilderEmptyState';
import useIsMobile from './utils/useIsMobile';
import useViewerRoles from './utils/useViewerRoles';
import { trackPageView } from './utils/analytics';

const ThreeScene = lazy(() =>
  import('./ThreeScene').then((m) => {
    const C = m.ThreeScene || m.default;
    return { default: typeof C === 'function' ? C : (m.default && m.default.default) || (() => null) };
  })
);
const unwrap = (m) => (m && typeof m.default === 'function' ? m.default : m);
const SceneVariantSwitcher = unwrap(SceneVariantSwitcherImport);
const SaveSetupButton = unwrap(SaveSetupButtonImport);
const ConnectionGuideButton = unwrap(ConnectionGuideButtonImport);
const ProductDashboard = unwrap(ProductDashboardImport);
const Settings = unwrap(SettingsImport);
const Preferences = unwrap(PreferencesImport);
const HubLandingPage = unwrap(HubLandingPageImport);
const CreateHub = unwrap(CreateHubImport);
const Feed = unwrap(FeedImport);
const PostSetModal = unwrap(PostSetModalImport);
const Upload = unwrap(UploadImport);
const Profile = unwrap(ProfileImport);
const UserSearch = unwrap(UserSearchImport);
const Notifications = unwrap(NotificationsImport);
const SetEditor = unwrap(SetEditorImport);
const BuilderEmptyState = unwrap(BuilderEmptyStateImport);

function isValidComponent(C) {
  return typeof C === 'function' || (C && typeof C === 'object' && typeof C.$$typeof === 'symbol');
}
const APP_COMPONENTS = [
  ['SceneVariantSwitcher', SceneVariantSwitcher],
  ['SaveSetupButton', SaveSetupButton],
  ['ProductDashboard', ProductDashboard],
  ['Settings', Settings],
  ['Preferences', Preferences],
  ['HubLandingPage', HubLandingPage],
  ['Feed', Feed],
  ['Upload', Upload],
  ['Profile', Profile],
  ['UserSearch', UserSearch],
  ['Notifications', Notifications],
  ['SetEditor', SetEditor],
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
  const [selectedSetting, setSelectedSetting] = useState(null);
  // { creatorId, setupId } when the loaded setup belongs to someone else; null otherwise
  const [affiliateAttribution, setAffiliateAttribution] = useState(null);
  const [setupDevices, setSetupDevices] = useState({ DJ: [], Producer: [], Musician: [] });
  const [isFirebaseConnected, setIsFirebaseConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actualDevices, setActualDevices] = useState([]);
  const [loadedSetupId, setLoadedSetupId] = useState(null);
  const [loadedSetupName, setLoadedSetupName] = useState(null);
  const [initialCameraAngles, setInitialCameraAngles] = useState(null);
  const [currentCameraAngles, setCurrentCameraAngles] = useState(null);
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
    if (selectedSetup && selectedSetting == null) {
      setSelectedSetting(defaultSettingFor(selectedSetup));
    }
  }, [selectedSetup, selectedSetting]);

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
            // No email here: users/* is readable by all signed-in users, and
            // auth already knows the email — keep PII out of the shared doc.
            await setDoc(userRef, {
              displayName: user.email?.split('@')[0] || 'User',
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

  const handleDevicesChange = useCallback((devices) => {
    setActualDevices(devices);
  }, []);

  // Cross-type scene switch from the in-scene switcher: the target scene must
  // start with just its ghost spots, so drop any devices held for that type
  // (e.g. from a setup of that type loaded earlier this session).
  const handleBuilderTypeSwitch = useCallback((type, settingKey) => {
    setSetupDevices(prev => ({ ...prev, [type]: [] }));
    setActualDevices([]);
    setSelectedSetup(type);
    setSelectedSetting(settingKey || defaultSettingFor(type));
  }, []);

  // Signed-out views (landing / legal) render outside the router, so the
  // in-router AnalyticsTracker never sees them — log them here instead.
  useEffect(() => {
    if (!isLoading && !user) trackPageView(window.location.pathname);
  }, [isLoading, user]);


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
        {window.location.pathname === '/legal' ? (
          <div style={{ flex: 1, overflowY: 'auto' }}><LegalPage /></div>
        ) : (
          <LandingPage onSignIn={signInWithGoogle} />
        )}
      </div>
    );
  }

  return (
    <BrowserRouter>
      <AnalyticsTracker />
      <SetPlayerProvider theme={theme}>
      <AppRoutes
        user={user}
        theme={theme}
        toggleTheme={toggleTheme}
        selectedSetup={selectedSetup}
        setSelectedSetup={setSelectedSetup}
        selectedSetting={selectedSetting}
        setSelectedSetting={setSelectedSetting}
        setupDevices={setupDevices}
        setSetupDevices={setSetupDevices}
        actualDevices={actualDevices}
        setActualDevices={setActualDevices}
        isFirebaseConnected={isFirebaseConnected}
        showFeedPostSetModal={showFeedPostSetModal}
        setShowFeedPostSetModal={setShowFeedPostSetModal}
        handleDevicesChange={handleDevicesChange}
        handleBuilderTypeSwitch={handleBuilderTypeSwitch}
        loadedSetupId={loadedSetupId}
        setLoadedSetupId={setLoadedSetupId}
        loadedSetupName={loadedSetupName}
        setLoadedSetupName={setLoadedSetupName}
        initialCameraAngles={initialCameraAngles}
        setInitialCameraAngles={setInitialCameraAngles}
        currentCameraAngles={currentCameraAngles}
        setCurrentCameraAngles={setCurrentCameraAngles}
        affiliateAttribution={affiliateAttribution}
        setAffiliateAttribution={setAffiliateAttribution}
      />
      </SetPlayerProvider>
    </BrowserRouter>
  );
}

function AppRoutes({
  user,
  theme,
  toggleTheme,
  selectedSetup,
  setSelectedSetup,
  selectedSetting,
  setSelectedSetting,
  setupDevices,
  setSetupDevices,
  actualDevices,
  setActualDevices,
  isFirebaseConnected,
  showFeedPostSetModal,
  setShowFeedPostSetModal,
  handleDevicesChange,
  handleBuilderTypeSwitch,
  loadedSetupId,
  setLoadedSetupId,
  loadedSetupName,
  setLoadedSetupName,
  initialCameraAngles,
  setInitialCameraAngles,
  currentCameraAngles,
  setCurrentCameraAngles,
  affiliateAttribution,
  setAffiliateAttribution,
}) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
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
    setActualDevices([]);
    setLoadedSetupId(null);
    setLoadedSetupName(null);
    setAffiliateAttribution(null);
    navigate('/hub');
  };

  const handleSetupSelectFromLanding = async (setup) => {
    const type = setup.setupType || 'DJ';
    const hydratedDevices = await hydrateSetupDevices(setup.devices || []);
    setSelectedSetup(type);
    setSelectedSetting(setup.setting || defaultSettingFor(type));
    setActualDevices(hydratedDevices);
    setSetupDevices(prev => ({ ...prev, [type]: hydratedDevices }));
    setLoadedSetupId(setup.id ?? null);
    setLoadedSetupName(setup.name ?? null);
    const viewerUid = auth.currentUser?.uid;
    if (setup.ownerId && viewerUid && setup.ownerId !== viewerUid) {
      setAffiliateAttribution({ creatorId: setup.ownerId, setupId: setup.id ?? null });
    } else {
      setAffiliateAttribution(null);
    }
    setInitialCameraAngles(setup.cameraAngles ?? null);
    setCurrentCameraAngles(setup.cameraAngles ?? null);
    navigate('/builder');
  };

  const handleNewSetupFromLanding = (setupType, setting) => {
    setSelectedSetup(setupType);
    setSelectedSetting(setting || defaultSettingFor(setupType));
    setActualDevices([]);
    setSetupDevices(prev => ({ ...prev, [setupType]: [] }));
    setLoadedSetupId(null);
    setLoadedSetupName(null);
    setAffiliateAttribution(null);
    setInitialCameraAngles(null);
    setCurrentCameraAngles(null);
    navigate('/builder');
  };

  // The global set player (mounted above the router) requests opening a set's
  // linked setup via this event; load it and route into the builder.
  useEffect(() => {
    const handler = async (e) => {
      const setupId = e.detail?.setupId;
      if (!setupId) return;
      try {
        const snap = await getDoc(doc(db, 'setups', setupId));
        if (snap.exists()) handleSetupSelectFromLanding({ id: snap.id, ...snap.data() });
      } catch (err) {
        console.error('Error opening setup from player:', err);
      }
    };
    window.addEventListener('liveset:view-setup', handler);
    return () => window.removeEventListener('liveset:view-setup', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="App" style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="App-header">
        <div className="App-header-left">
          <button
            type="button"
            className="theme-toggle press"
            onClick={toggleTheme}
            aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            title={theme === 'light' ? 'Dark mode' : 'Light mode'}
          >
            {theme === 'light' ? <MdDarkMode size={20} /> : <MdLightMode size={20} />}
          </button>
        </div>
        <div
          className="App-header-center press"
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
              className="header-profile-trigger press"
              onClick={toggleProfileDropdown}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '5px 8px', borderRadius: '5px', transition: 'background-color 0.2s ease' }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleProfileDropdown(); } }}
            >
              <div style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-contrast)', fontWeight: 'bold', fontSize: '10px' }}>
                {user.displayName ? user.displayName.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="header-profile-meta">
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
                  <div className="profile-dropdown-item" onClick={goAndClose('/settings')} style={{ padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <MdSettings size={20} style={{ flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '500' }}>Settings</div>
                      <div className="profile-dropdown-item-sub">Manage profile</div>
                    </div>
                  </div>
                  <div className="profile-dropdown-item" onClick={goAndClose('/admin/products')} style={{ padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <MdInventory2 size={20} style={{ flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '500' }}>Product Management</div>
                      <div className="profile-dropdown-item-sub">Manage products & prices</div>
                    </div>
                  </div>
                  <div className="profile-dropdown-item" onClick={goAndClose('/preferences')} style={{ padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <MdTune size={20} style={{ flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '500' }}>Preferences</div>
                      <div className="profile-dropdown-item-sub">Budget & options</div>
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
                onSearchClick={() => navigate('/search')}
                onAddProducts={() => navigate('/admin/products-import')}
                theme={theme}
              />
            } />
            <Route path="/create" element={
              <CreateHub onNewSetup={handleNewSetupFromLanding} />
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
            {/* Legacy My Sets page — setups now live under Profile → SETUPS */}
            <Route path="/sets" element={<Navigate to="/profile?tab=setups" replace />} />
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
            <Route path="/legal" element={<LegalPage />} />
            <Route path="/admin/products" element={<ProductDashboard onClose={() => navigate('/hub')} />} />
            <Route path="/admin/products-import" element={<ProductImporter onBack={() => navigate('/hub')} />} />
            <Route path="/upload" element={
              <RequireCreator>
                <Upload onBack={() => navigate('/feed')} onSuccess={() => navigate('/feed')} />
              </RequireCreator>
            } />
            <Route path="/set-editor" element={
              <RequireCreator>
                <SetEditor onBack={() => navigate('/hub')} theme={theme} />
              </RequireCreator>
            } />
            <Route path="/builder" element={
              selectedSetup ? (
                <Suspense fallback={<div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0c0c12', color: 'rgba(255,255,255,0.6)' }}>Loading scene…</div>}>
                  <div className="builder-page">
                    <div className="builder-stage">
                      <div className="builder-controls">
                        {isMobile ? (
                          // Mobile bottom bar: unchanged — the sidebar is desktop-only,
                          // so Home/Feed stay reachable from here.
                          <>
                            <button
                              type="button"
                              className="builder-feed-btn builder-home-btn"
                              onClick={handleLogoClick}
                              title="Back to home"
                            >
                              <MdHome size={18} />
                              <span className="builder-ctl-label">Home</span>
                            </button>
                            <button
                              type="button"
                              className="builder-feed-btn"
                              onClick={() => navigate('/feed')}
                              title="Open the LiveSet feed"
                            >
                              <MdPlayCircleOutline size={18} />
                              <span className="builder-ctl-label">Feed</span>
                            </button>
                            <button
                              type="button"
                              className="builder-add-btn press"
                              onClick={() => window.dispatchEvent(new CustomEvent('liveset:add-device'))}
                              title="Add a device"
                            >
                              <MdAdd size={20} />
                              <span className="builder-ctl-label">Add device</span>
                            </button>
                          </>
                        ) : (
                          // Desktop: the sidebar owns navigation, so the floating
                          // cluster is builder actions only.
                          <ConnectionGuideButton currentDevices={actualDevices} setupType={selectedSetup} />
                        )}
                        <SaveSetupButton
                          currentDevices={actualDevices}
                          setupType={selectedSetup}
                          setting={selectedSetting}
                          cameraAngles={currentCameraAngles}
                          setupId={loadedSetupId}
                          setupName={loadedSetupName}
                        />
                      </div>
                      <ThreeScene
                        devices={setupDevices[selectedSetup]}
                        isInitialized={isFirebaseConnected}
                        setupType={selectedSetup}
                        setting={selectedSetting}
                        onSettingChange={setSelectedSetting}
                        onSetupTypeChange={handleBuilderTypeSwitch}
                        onDevicesChange={handleDevicesChange}
                        initialCameraAngles={initialCameraAngles}
                        onCameraAnglesChange={setCurrentCameraAngles}
                        affiliateAttribution={affiliateAttribution}
                      />
                    </div>
                  </div>
                </Suspense>
              ) : (
                <BuilderEmptyState
                  onNewSetup={handleNewSetupFromLanding}
                  onSetupSelect={handleSetupSelectFromLanding}
                />
              )
            } />
            <Route path="*" element={<Navigate to="/hub" replace />} />
          </Route>
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

function AnalyticsTracker() {
  const location = useLocation();
  useEffect(() => {
    trackPageView(location.pathname + location.search);
  }, [location]);
  return null;
}

// Live-set posting routes are for verified creators only (mirrors the
// isCreator() gate in firestore.rules).
function RequireCreator({ children }) {
  const { isCreator, loading } = useViewerRoles();
  if (loading) return null;
  if (!isCreator) return <Navigate to="/hub" replace />;
  return children;
}

export default App;
