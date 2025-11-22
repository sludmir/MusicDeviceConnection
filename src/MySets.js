import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc, query, where, orderBy, serverTimestamp } from 'firebase/firestore';
import { db, auth } from './firebaseConfig';

function MySets({ onBack, currentSetup, currentDevices, setupType }) {
  const [savedSetups, setSavedSetups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [setupName, setSetupName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

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
      setError('Failed to load saved setups');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSetup = async () => {
    if (!setupName.trim()) {
      setError('Please enter a name for your setup');
      return;
    }

    if (!currentDevices || currentDevices.length === 0) {
      setError('No devices to save. Please add some devices to your setup first.');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      // Prepare devices data for saving
      const devicesData = currentDevices.map(device => ({
        id: device.id,
        name: device.name,
        type: device.type,
        category: device.category,
        position: device.position ? {
          x: device.position.x,
          y: device.position.y,
          z: device.position.z
        } : null,
        rotation: device.rotation ? {
          x: device.rotation.x,
          y: device.rotation.y,
          z: device.rotation.z
        } : null,
        modelPath: device.modelPath,
        connections: device.connections || []
      }));

      const setupData = {
        name: setupName.trim(),
        ownerId: auth.currentUser.uid,
        setupType: setupType || 'DJ',
        devices: devicesData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await addDoc(collection(db, 'setups'), setupData);
      
      setShowSaveDialog(false);
      setSetupName('');
      await loadSavedSetups();
      
      // Show success message
      alert('Setup saved successfully!');
    } catch (error) {
      console.error('Error saving setup:', error);
      setError('Failed to save setup. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSetup = async (setupId) => {
    if (!window.confirm('Are you sure you want to delete this setup?')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'setups', setupId));
      await loadSavedSetups();
    } catch (error) {
      console.error('Error deleting setup:', error);
      setError('Failed to delete setup. Please try again.');
    }
  };

  const handleLoadSetup = (setup) => {
    // This will be handled by the parent component
    // For now, just show an alert
    alert(`Loading setup: ${setup.name}\n\nThis feature will be implemented to restore your devices.`);
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0a0a0a',
      color: '#ffffff',
      padding: '40px 20px'
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '30px'
        }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '32px', fontWeight: '600' }}>My Sets</h1>
            <p style={{ margin: '8px 0 0 0', opacity: 0.7, fontSize: '14px' }}>
              Manage your saved equipment setups
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            {currentDevices && currentDevices.length > 0 && (
              <button
                onClick={() => setShowSaveDialog(true)}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#00a2ff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'background-color 0.2s ease'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#0088cc'}
                onMouseLeave={(e) => e.target.style.backgroundColor = '#00a2ff'}
              >
                💾 Save Current Setup
              </button>
            )}
            <button
              onClick={onBack}
              style={{
                padding: '12px 24px',
                backgroundColor: '#333',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                transition: 'background-color 0.2s ease'
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#444'}
              onMouseLeave={(e) => e.target.style.backgroundColor = '#333'}
            >
              ← Back
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div style={{
            padding: '12px 16px',
            backgroundColor: '#ff4444',
            color: 'white',
            borderRadius: '8px',
            marginBottom: '20px',
            fontSize: '14px'
          }}>
            {error}
          </div>
        )}

        {/* Save Dialog */}
        {showSaveDialog && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 2000
          }}>
            <div style={{
              backgroundColor: '#1a1a1a',
              padding: '32px',
              borderRadius: '12px',
              minWidth: '400px',
              border: '1px solid #333'
            }}>
              <h2 style={{ margin: '0 0 20px 0', fontSize: '24px' }}>Save Setup</h2>
              <p style={{ margin: '0 0 16px 0', opacity: 0.7, fontSize: '14px' }}>
                Enter a name for your setup:
              </p>
              <input
                type="text"
                value={setupName}
                onChange={(e) => setSetupName(e.target.value)}
                placeholder="e.g., My DJ Setup, Studio Setup"
                style={{
                  width: '100%',
                  padding: '12px',
                  backgroundColor: '#0a0a0a',
                  border: '1px solid #333',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '14px',
                  marginBottom: '20px',
                  boxSizing: 'border-box'
                }}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !saving) {
                    handleSaveSetup();
                  }
                }}
                autoFocus
              />
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => {
                    setShowSaveDialog(false);
                    setSetupName('');
                    setError(null);
                  }}
                  disabled={saving}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#333',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    opacity: saving ? 0.5 : 1
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveSetup}
                  disabled={saving || !setupName.trim()}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#00a2ff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: (saving || !setupName.trim()) ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    opacity: (saving || !setupName.trim()) ? 0.5 : 1
                  }}
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Setups List */}
        {loading ? (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '60px 20px',
            fontSize: '16px',
            opacity: 0.7
          }}>
            Loading your setups...
          </div>
        ) : savedSetups.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            opacity: 0.7
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎧</div>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '20px' }}>No saved setups yet</h3>
            <p style={{ margin: 0, fontSize: '14px' }}>
              {currentDevices && currentDevices.length > 0
                ? 'Save your current setup to get started!'
                : 'Create a setup and save it to see it here.'}
            </p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '20px'
          }}>
            {savedSetups.map((setup) => (
              <div
                key={setup.id}
                style={{
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #333',
                  borderRadius: '12px',
                  padding: '24px',
                  transition: 'transform 0.2s ease, border-color 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.borderColor = '#00a2ff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = '#333';
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '16px'
                }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{
                      margin: '0 0 8px 0',
                      fontSize: '18px',
                      fontWeight: '600'
                    }}>
                      {setup.name}
                    </h3>
                    <p style={{
                      margin: 0,
                      fontSize: '12px',
                      opacity: 0.6
                    }}>
                      {setup.setupType || 'DJ'} Setup
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteSetup(setup.id)}
                    style={{
                      padding: '6px 10px',
                      backgroundColor: 'transparent',
                      border: '1px solid #ff4444',
                      borderRadius: '6px',
                      color: '#ff4444',
                      cursor: 'pointer',
                      fontSize: '12px',
                      transition: 'background-color 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = '#ff4444';
                      e.target.style.color = 'white';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = 'transparent';
                      e.target.style.color = '#ff4444';
                    }}
                  >
                    Delete
                  </button>
                </div>
                
                <div style={{
                  marginBottom: '16px',
                  padding: '12px',
                  backgroundColor: '#0a0a0a',
                  borderRadius: '8px'
                }}>
                  <div style={{
                    fontSize: '14px',
                    opacity: 0.7,
                    marginBottom: '4px'
                  }}>
                    Devices: {setup.devices?.length || 0}
                  </div>
                  {setup.createdAt && (
                    <div style={{
                      fontSize: '12px',
                      opacity: 0.5
                    }}>
                      Created: {setup.createdAt.toDate ? 
                        new Date(setup.createdAt.toDate()).toLocaleDateString() : 
                        'Unknown'}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => handleLoadSetup(setup)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    backgroundColor: '#00a2ff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    transition: 'background-color 0.2s ease'
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = '#0088cc'}
                  onMouseLeave={(e) => e.target.style.backgroundColor = '#00a2ff'}
                >
                  Load Setup
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default MySets;

