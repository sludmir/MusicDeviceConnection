import React, { useState, useEffect } from 'react';
import { auth } from './firebaseConfig';
import { updateProfile } from 'firebase/auth';
import { Button, Card, Input, SectionHeader, useToast } from './ui';
import './Settings.css';

function Settings() {
  const toast = useToast();
  const [user, setUser] = useState(null);
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);

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
      await updateProfile(user, { displayName: displayName.trim() || 'User' });
      setUser({ ...user, displayName: displayName.trim() || 'User' });
      toast.success('Profile updated.');
    } catch (err) {
      console.error('Error updating profile:', err);
      toast.error('Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="settings">
      <div className="settings__inner">
        <SectionHeader
          eyebrow="ACCOUNT"
          title="Settings"
        />

        <Card padding="lg" className="settings__card">
          <h3 className="settings__section-title">Profile</h3>
          <div className="settings__field">
            <Input
              label="Display name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="How you appear to others"
            />
          </div>
          <div className="settings__field">
            <Input
              label="Email"
              value={user?.email || ''}
              disabled
              help="Email is managed by your Google sign-in and cannot be changed here."
            />
          </div>
          <div className="settings__actions">
            <Button onClick={handleSaveProfile} loading={saving}>
              Save changes
            </Button>
          </div>
        </Card>

        <Card padding="lg" className="settings__card">
          <h3 className="settings__section-title">Account</h3>
          <div className="settings__row">
            <span className="mono-label settings__row-label">Plan</span>
            <span className="settings__row-value">Free</span>
          </div>
          <p className="settings__hint">
            More account controls are coming soon.
          </p>
        </Card>
      </div>
    </div>
  );
}

export default Settings;
