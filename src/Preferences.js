import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from './firebaseConfig';

function Preferences({ onBack }) {
  const [preferences, setPreferences] = useState({
    budget: '',
    currency: 'USD',
    showPrices: true,
    defaultSetupType: 'DJ',
    theme: 'dark'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    if (!auth.currentUser) {
      setLoading(false);
      return;
    }

    try {
      const userPrefsRef = doc(db, 'users', auth.currentUser.uid);
      const userPrefsSnap = await getDoc(userPrefsRef);
      
      if (userPrefsSnap.exists()) {
        const data = userPrefsSnap.data();
        setPreferences(prev => ({
          ...prev,
          ...data.preferences
        }));
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSavePreferences = async () => {
    if (!auth.currentUser) return;

    try {
      setSaving(true);
      setMessage({ type: '', text: '' });

      const userPrefsRef = doc(db, 'users', auth.currentUser.uid);
      await setDoc(userPrefsRef, {
        preferences: preferences,
        updatedAt: new Date()
      }, { merge: true });

      setMessage({ type: 'success', text: 'Preferences saved successfully!' });
    } catch (error) {
      console.error('Error saving preferences:', error);
      setMessage({ type: 'error', text: 'Failed to save preferences. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (key, value) => {
    setPreferences(prev => ({
      ...prev,
      [key]: value
    }));
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#0a0a0a',
        color: '#ffffff',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        <div style={{ fontSize: '16px', opacity: 0.7 }}>Loading preferences...</div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0a0a0a',
      color: '#ffffff',
      padding: '40px 20px'
    }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '30px'
        }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '32px', fontWeight: '600' }}>Preferences</h1>
            <p style={{ margin: '8px 0 0 0', opacity: 0.7, fontSize: '14px' }}>
              Customize your experience
            </p>
          </div>
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

        {/* Message */}
        {message.text && (
          <div style={{
            padding: '12px 16px',
            backgroundColor: message.type === 'success' ? '#00a2ff' : '#ff4444',
            color: 'white',
            borderRadius: '8px',
            marginBottom: '20px',
            fontSize: '14px'
          }}>
            {message.text}
          </div>
        )}

        {/* Budget & Pricing Section */}
        <div style={{
          backgroundColor: '#1a1a1a',
          border: '1px solid #333',
          borderRadius: '12px',
          padding: '32px',
          marginBottom: '20px'
        }}>
          <h2 style={{
            margin: '0 0 24px 0',
            fontSize: '20px',
            fontWeight: '600'
          }}>
            Budget & Pricing
          </h2>

          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              opacity: 0.8
            }}>
              Budget (optional)
            </label>
            <div style={{ display: 'flex', gap: '12px' }}>
              <select
                value={preferences.currency}
                onChange={(e) => handleChange('currency', e.target.value)}
                style={{
                  padding: '12px',
                  backgroundColor: '#0a0a0a',
                  border: '1px solid #333',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="JPY">JPY (¥)</option>
              </select>
              <input
                type="number"
                value={preferences.budget}
                onChange={(e) => handleChange('budget', e.target.value)}
                placeholder="Enter your budget"
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: '#0a0a0a',
                  border: '1px solid #333',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '14px',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            <p style={{
              margin: '8px 0 0 0',
              fontSize: '12px',
              opacity: 0.6
            }}>
              Set a budget to help filter equipment recommendations
            </p>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '20px'
          }}>
            <input
              type="checkbox"
              id="showPrices"
              checked={preferences.showPrices}
              onChange={(e) => handleChange('showPrices', e.target.checked)}
              style={{
                width: '18px',
                height: '18px',
                cursor: 'pointer'
              }}
            />
            <label
              htmlFor="showPrices"
              style={{
                fontSize: '14px',
                cursor: 'pointer',
                userSelect: 'none'
              }}
            >
              Show prices on equipment
            </label>
          </div>
        </div>

        {/* Setup Preferences */}
        <div style={{
          backgroundColor: '#1a1a1a',
          border: '1px solid #333',
          borderRadius: '12px',
          padding: '32px',
          marginBottom: '20px'
        }}>
          <h2 style={{
            margin: '0 0 24px 0',
            fontSize: '20px',
            fontWeight: '600'
          }}>
            Setup Preferences
          </h2>

          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              opacity: 0.8
            }}>
              Default Setup Type
            </label>
            <select
              value={preferences.defaultSetupType}
              onChange={(e) => handleChange('defaultSetupType', e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: '#0a0a0a',
                border: '1px solid #333',
                borderRadius: '8px',
                color: 'white',
                fontSize: '14px',
                cursor: 'pointer',
                boxSizing: 'border-box'
              }}
            >
              <option value="DJ">DJ</option>
              <option value="Producer">Producer</option>
              <option value="Musician">Musician</option>
            </select>
            <p style={{
              margin: '8px 0 0 0',
              fontSize: '12px',
              opacity: 0.6
            }}>
              The default setup type to show when you start the app
            </p>
          </div>
        </div>

        {/* Save Button */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px'
        }}>
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
            Cancel
          </button>
          <button
            onClick={handleSavePreferences}
            disabled={saving}
            style={{
              padding: '12px 24px',
              backgroundColor: '#00a2ff',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: saving ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              opacity: saving ? 0.5 : 1,
              transition: 'background-color 0.2s ease'
            }}
            onMouseEnter={(e) => {
              if (!saving) e.target.style.backgroundColor = '#0088cc';
            }}
            onMouseLeave={(e) => {
              if (!saving) e.target.style.backgroundColor = '#00a2ff';
            }}
          >
            {saving ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Preferences;

