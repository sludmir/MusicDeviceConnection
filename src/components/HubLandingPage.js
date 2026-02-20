import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, orderBy, doc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import PostSetModal from './PostSetModal';
import './HubLandingPage.css';

function HubLandingPage({ onSetupSelect, onNewSetup, onFeedClick, theme = 'light' }) {
  const [savedSetups, setSavedSetups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSetupSelection, setShowSetupSelection] = useState(false);
  const [showPostSetModal, setShowPostSetModal] = useState(false);

  useEffect(() => {
    loadSavedSetups();
  }, []);

  const loadSavedSetups = async () => {
    if (!auth.currentUser) return;
    try {
      setLoading(true);
      const setupsRef = collection(db, 'setups');
      const q = query(
        setupsRef,
        where('ownerId', '==', auth.currentUser.uid),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const setups = [];
      querySnapshot.forEach((doc) => {
        setups.push({ id: doc.id, ...doc.data() });
      });
      setSavedSetups(setups);
    } catch (error) {
      console.error('Error loading setups:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBuildMySet = () => {
    setShowSetupSelection(true);
  };

  const handleSetupTypeSelect = (setupType) => {
    setShowSetupSelection(false);
    if (onNewSetup) onNewSetup(setupType);
  };

  const formatDate = (timestamp) => {
    if (!timestamp?.toDate) return '';
    const d = timestamp.toDate();
    const now = new Date();
    const diff = now - d;
    if (diff < 86400000) return 'Today';
    if (diff < 172800000) return 'Yesterday';
    if (diff < 604800000) return `${Math.floor(diff / 86400000)} days ago`;
    return d.toLocaleDateString();
  };

  const handleDeleteSetup = async (e, setup) => {
    e.stopPropagation();
    if (!auth.currentUser || setup.ownerId !== auth.currentUser.uid) return;
    if (!window.confirm(`Delete "${setup.name || 'Untitled Setup'}"? This can't be undone.`)) return;
    try {
      await deleteDoc(doc(db, 'setups', setup.id));
      setSavedSetups((prev) => prev.filter((s) => s.id !== setup.id));
    } catch (err) {
      console.error('Error deleting setup:', err);
      alert('Failed to delete setup. Please try again.');
    }
  };

  return (
    <div className="hub-landing-page">
      {/* Liquid glass background */}
      <div className="hub-liquid-bg" aria-hidden="true">
        <div className="hub-liquid-blob hub-liquid-blob-1" />
        <div className="hub-liquid-blob hub-liquid-blob-2" />
        <div className="hub-liquid-blob hub-liquid-blob-3" />
        <div className="hub-liquid-blob hub-liquid-blob-4" />
        <div className="hub-liquid-blob hub-liquid-blob-5" />
        <div className="hub-glass-noise" />
      </div>

      {/* Setup type selection modal - same as existing */}
      {showSetupSelection && (
        <div className="hub-setup-selection-overlay">
          <div className="hub-setup-selection-content">
            <h2 className="hub-setup-title">Select Your Setup Type</h2>
            <div className="setup-buttons-container">
              <div className="setup-buttons-glass">
                {['DJ', 'Producer', 'Musician'].map((setupType, index) => (
                  <button
                    key={setupType}
                    onClick={() => handleSetupTypeSelect(setupType)}
                    className="setup-option"
                    data-setup-type={setupType}
                    data-index={index}
                  >
                    <span className="setup-option-text">{setupType}</span>
                  </button>
                ))}
                <div className="setup-button-hover-slider"></div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="hub-content hub-content-glass">
        {/* Hero */}
        <section className="hub-hero hub-hero-glass">
          <div className="hub-hero-bg" />
          <div className="hub-hero-inner">
            <img src={theme === 'dark' ? '/liveset-logo-dark.png' : '/liveset-logo.png'} alt="LiveSet" className="hub-hero-logo" />
            <h1 className="hub-hero-title">Your setup, your way</h1>
            <p className="hub-hero-subtitle">
              Design, save, and share your ideal rig. Start from scratch or pick up where you left off.
            </p>
            <div className="hub-hero-buttons">
              <button
                type="button"
                className="hub-build-btn"
                onClick={handleBuildMySet}
              >
                Build my set
              </button>
              <button
                type="button"
                className="hub-post-set-btn"
                onClick={() => setShowPostSetModal(true)}
              >
                Post my set
              </button>
            </div>
          </div>
        </section>

        {showPostSetModal && (
          <PostSetModal onClose={() => setShowPostSetModal(false)} theme={theme} />
        )}

        {/* Main grid: Recent setups + sidebar */}
        <div className="hub-main">
          <section className="hub-section hub-recent hub-section-glass">
            <h2 className="hub-section-title">Recent setups</h2>
            {loading ? (
              <div className="hub-loading">Loading...</div>
            ) : savedSetups.length === 0 ? (
              <div className="hub-empty">
                <p>No saved setups yet.</p>
                <button type="button" className="hub-empty-cta" onClick={handleBuildMySet}>
                  Build my set
                </button>
              </div>
            ) : (
              <div className="hub-setups-grid">
                {savedSetups.slice(0, 6).map((setup) => (
                  <div key={setup.id} className="hub-setup-card-wrapper">
                    <button
                      type="button"
                      className="hub-setup-card"
                      onClick={() => onSetupSelect && onSetupSelect(setup)}
                    >
                      <span className="hub-setup-card-type">{setup.setupType || 'DJ'}</span>
                      <span className="hub-setup-card-name">{setup.name || 'Untitled Setup'}</span>
                      <span className="hub-setup-card-meta">
                        {setup.devices?.length || 0} devices · {formatDate(setup.createdAt)}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="hub-setup-card-delete"
                      onClick={(e) => handleDeleteSetup(e, setup)}
                      title="Delete setup"
                      aria-label="Delete setup"
                    >
                      🗑
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <aside className="hub-sidebar">
            <section className="hub-sidebar-section hub-glass-card">
              <h3 className="hub-sidebar-title">Quick actions</h3>
              <button type="button" className="hub-sidebar-btn" onClick={handleBuildMySet}>
                Build my set
              </button>
              {onFeedClick && (
                <button type="button" className="hub-sidebar-btn" onClick={onFeedClick} style={{ marginTop: '12px' }}>
                  Discover Feed
                </button>
              )}
            </section>
            <section className="hub-sidebar-section hub-glass-card">
              <h3 className="hub-sidebar-title">Profiles you follow</h3>
              <div className="hub-follow-placeholder">
                <p>Discover setups from other users.</p>
                <p className="hub-coming-soon">Coming soon</p>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}

export default HubLandingPage;
