import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from './firebaseConfig';
import { Button, Card, Input, Select, SectionHeader, useToast } from './ui';
import './Settings.css';

function Preferences() {
  const toast = useToast();
  const [preferences, setPreferences] = useState({
    budget: '',
    currency: 'USD',
    showPrices: true,
    defaultSetupType: 'DJ',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (!cancelled && snap.exists() && snap.data().preferences) {
          setPreferences((prev) => ({ ...prev, ...snap.data().preferences }));
        }
      } catch (err) {
        console.error('Error loading preferences:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleSave = async () => {
    if (!auth.currentUser) return;
    try {
      setSaving(true);
      await setDoc(
        doc(db, 'users', auth.currentUser.uid),
        { preferences, updatedAt: new Date() },
        { merge: true }
      );
      toast.success('Preferences saved.');
    } catch (err) {
      console.error('Error saving preferences:', err);
      toast.error('Failed to save preferences.');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (key, value) => {
    setPreferences((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="settings">
        <div className="settings__inner">
          <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: 'var(--space-8)' }}>
            Loading…
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="settings">
      <div className="settings__inner">
        <SectionHeader
          eyebrow="CUSTOMIZE"
          title="Preferences"
        />

        <Card padding="lg" className="settings__card">
          <h3 className="settings__section-title">Budget &amp; pricing</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 'var(--space-3)' }}>
            <Select
              label="Currency"
              value={preferences.currency}
              onChange={(e) => handleChange('currency', e.target.value)}
            >
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
              <option value="JPY">JPY (¥)</option>
            </Select>
            <Input
              label="Budget (optional)"
              type="number"
              value={preferences.budget}
              onChange={(e) => handleChange('budget', e.target.value)}
              placeholder="Total budget"
              help="Used to filter gear recommendations."
            />
          </div>
          <div className="settings__row settings__row--toggle">
            <div>
              <span className="settings__row-value">Show prices on equipment</span>
              <p className="settings__hint" style={{ marginTop: 'var(--space-1)' }}>
                Displays product prices in the gear browser.
              </p>
            </div>
            <input
              type="checkbox"
              checked={preferences.showPrices}
              onChange={(e) => handleChange('showPrices', e.target.checked)}
              className="settings__toggle"
              aria-label="Show prices on equipment"
            />
          </div>
        </Card>

        <Card padding="lg" className="settings__card">
          <h3 className="settings__section-title">Defaults</h3>
          <Select
            label="Default setup type"
            value={preferences.defaultSetupType}
            onChange={(e) => handleChange('defaultSetupType', e.target.value)}
            help="The setup type pre-selected when you start a new build."
          >
            <option value="DJ">DJ</option>
            <option value="Producer">Producer</option>
            <option value="Musician">Musician</option>
          </Select>
        </Card>

        <div className="settings__sticky-actions">
          <Button onClick={handleSave} loading={saving}>
            Save preferences
          </Button>
        </div>
      </div>
    </div>
  );
}

export default Preferences;
