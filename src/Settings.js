import React, { useState, useEffect } from 'react';
import { auth } from './firebaseConfig';
import { updateProfile } from 'firebase/auth';

function Settings({ onBack }) {
  const [user, setUser] = useState(null);
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    if (auth.currentUser) {
      setUser(auth.currentUser);
      setDisplayName(auth.currentUser.displayName || '');
    }
  }, []);

  const handleSaveProfile = async () => {
    if (!user) return;

    try {
      setSaving(true);
      setMessage({ type: '', text: '' });

      await updateProfile(user, {
        displayName: displayName.trim() || 'User'
      });

      setMessage({ type: 'success', text: 'Profile updated successfully!' });
      
      // Update local user state
      setUser({ ...user, displayName: displayName.trim() || 'User' });
    } catch (error) {
      console.error('Error updating profile:', error);
      setMessage({ type: 'error', text: 'Failed to update profile. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

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
            <h1 style={{ margin: 0, fontSize: '32px', fontWeight: '600' }}>Settings</h1>
            <p style={{ margin: '8px 0 0 0', opacity: 0.7, fontSize: '14px' }}>
              Manage your account settings
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

        {/* Profile Section */}
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
            Profile Information
          </h2>

          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              opacity: 0.8
            }}>
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Enter your display name"
              style={{
                width: '100%',
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

          {user && (
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                opacity: 0.8
              }}>
                Email
              </label>
              <input
                type="text"
                value={user.email || ''}
                disabled
                style={{
                  width: '100%',
                  padding: '12px',
                  backgroundColor: '#0a0a0a',
                  border: '1px solid #333',
                  borderRadius: '8px',
                  color: '#666',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                  cursor: 'not-allowed'
                }}
              />
              <p style={{
                margin: '8px 0 0 0',
                fontSize: '12px',
                opacity: 0.6
              }}>
                Email cannot be changed
              </p>
            </div>
          )}

          <button
            onClick={handleSaveProfile}
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
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>

        {/* Account Section */}
        <div style={{
          backgroundColor: '#1a1a1a',
          border: '1px solid #333',
          borderRadius: '12px',
          padding: '32px'
        }}>
          <h2 style={{
            margin: '0 0 24px 0',
            fontSize: '20px',
            fontWeight: '600'
          }}>
            Account
          </h2>

          <div style={{
            padding: '16px',
            backgroundColor: '#0a0a0a',
            borderRadius: '8px',
            marginBottom: '16px'
          }}>
            <div style={{
              fontSize: '14px',
              opacity: 0.7,
              marginBottom: '4px'
            }}>
              Account Type
            </div>
            <div style={{
              fontSize: '16px',
              fontWeight: '500'
            }}>
              Free Account
            </div>
          </div>

          <p style={{
            margin: 0,
            fontSize: '14px',
            opacity: 0.6
          }}>
            More account management features coming soon.
          </p>
        </div>
      </div>
    </div>
  );
}

export default Settings;

