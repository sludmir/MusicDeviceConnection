import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import ThreeScene from '../ThreeScene';
import './SetupLandingPage.css';

function SetupLandingPage({ onSetupSelect, onAddDevice, onNewSetup, currentDevices = [], setupType = null, isFirebaseConnected = false, onDevicesChange }) {
  const [savedSetups, setSavedSetups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSetupSelection, setShowSetupSelection] = useState(!setupType); // Show if no setup type selected
  const [selectedSetupType, setSelectedSetupType] = useState(setupType);

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
        setups.push({
          id: doc.id,
          ...doc.data()
        });
      });
      setSavedSetups(setups);
    } catch (error) {
      console.error('Error loading setups:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim() && selectedSetupType) {
      if (onAddDevice) {
        onAddDevice(searchQuery.trim());
      }
      setSearchQuery('');
    }
  };

  const handleNewSetup = () => {
    setShowSetupSelection(true);
  };

  const handleSetupTypeSelect = (setupType) => {
    setShowSetupSelection(false);
    setSelectedSetupType(setupType);
    if (onNewSetup) {
      onNewSetup(setupType);
    }
  };

  // Update selected setup type when prop changes
  useEffect(() => {
    if (setupType) {
      setSelectedSetupType(setupType);
      setShowSetupSelection(false); // Hide selection if setup type is provided
    } else {
      setShowSetupSelection(true); // Show selection if no setup type
    }
  }, [setupType]);

  return (
    <div className="setup-landing-page">
      {/* Setup Type Selection - Show First */}
      {showSetupSelection && (
        <div className="setup-selection-overlay">
          <div className="setup-selection-content">
            <h2 className="setup-title">Select Your Setup Type</h2>
            <div className="setup-buttons-container">
              <div className="setup-buttons-glass">
                {["DJ", "Producer", "Musician"].map((setupType, index) => (
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

      {/* Left Sidebar - Saved Setups */}
      <div className="setup-sidebar">
        <div className="sidebar-header">
          <button className="new-setup-btn" onClick={handleNewSetup}>
            <span>+</span> New Setup
          </button>
        </div>
        
        <div className="sidebar-content">
          {loading ? (
            <div className="loading-text">Loading setups...</div>
          ) : savedSetups.length === 0 ? (
            <div className="empty-state">
              <p>No saved setups yet</p>
              <p className="hint">Create your first setup to get started</p>
            </div>
          ) : (
            <div className="setups-list">
              {savedSetups.map((setup) => (
                <div
                  key={setup.id}
                  className="setup-item"
                  onClick={() => onSetupSelect && onSetupSelect(setup)}
                >
                  <div className="setup-item-header">
                    <span className="setup-name">{setup.name || 'Untitled Setup'}</span>
                    <span className="setup-type">{setup.setupType || 'DJ'}</span>
                  </div>
                  <div className="setup-item-meta">
                    {setup.devices?.length || 0} devices
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area - 3D Scene with Search Overlay */}
      <div className="setup-main-content">
        {/* 3D Scene Background */}
        <div className="scene-container">
          <ThreeScene
            devices={currentDevices}
            isInitialized={isFirebaseConnected}
            setupType={selectedSetupType || 'DJ'}
            onDevicesChange={onDevicesChange}
            onCategoryToggle={() => {}}
          />
        </div>
        
        {/* Search Bar Overlay - Only show after setup type is selected */}
        {!showSetupSelection && selectedSetupType && (
          <div className="search-overlay">
            <div className="search-container">
              <h1 className="landing-title">What would you like to add to your setup?</h1>
              <form onSubmit={handleSearch} className="search-form">
                <div className="search-input-wrapper">
                  <input
                    type="text"
                    className="search-input"
                    placeholder="Search for a device (e.g., CDJ-3000, DJM-900, RMX-1000)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                  />
                  <button type="submit" className="search-submit-btn">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                    </svg>
                  </button>
                </div>
              </form>
              <div className="quick-suggestions">
                <p className="suggestions-label">Quick add:</p>
                <div className="suggestion-chips">
                  {['DJM-900', 'CDJ-3000', 'RMX-1000', 'Laptop'].map((suggestion) => (
                    <button
                      key={suggestion}
                      className="suggestion-chip"
                      onClick={() => {
                        setSearchQuery(suggestion);
                        if (onAddDevice) {
                          onAddDevice(suggestion);
                        }
                      }}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SetupLandingPage;

