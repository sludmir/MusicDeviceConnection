import React, { useState } from 'react';
import { collection, addDoc, query, where, getDocs, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { MdSave } from 'react-icons/md';
import { db, auth } from '../firebaseConfig';
import { buildMobileDiagram } from '../utils/buildMobileDiagram';
import { defaultSettingFor } from '../data/settings';
import { useToast } from '../ui';
import './SaveSetupButton.css';

function SaveSetupButton({ currentDevices, setupType, setting, cameraAngles, setupId, setupName: loadedSetupName }) {
  const toast = useToast();
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [setupName, setSetupName] = useState('');
  const [isMainSetup, setIsMainSetup] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSaveClick = () => {
    setShowSaveDialog(true);
    setSetupName('');
    setIsMainSetup(false);
    setError(null);
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

      // If marking as main setup, first unmark any existing main setups
      if (isMainSetup) {
        await unmarkOtherMainSetups();
      }

      // Prepare devices data for saving (include spotType and placementIndex so load puts each device on the correct ghost spot)
      const devicesData = currentDevices.map(device => ({
        id: device.id,
        name: device.name,
        type: device.type,
        category: device.category,
        brand: device.brand || null,
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
        imageUrl: device.imageUrl || null,
        price: device.price ?? null,
        affiliateUrl: device.affiliateUrl || null,
        connections: device.connections || [],
        spotType: device.spotType ?? null,
        placementIndex: device.placementIndex != null ? device.placementIndex : null,
        uniqueId: device.uniqueId ?? null,
        inputs: device.inputs || [],
        outputs: device.outputs || []
      }));

      // Build the mobile diagram from the full device objects (before they are
      // stripped down for storage). Keeps imageUrl/brand/dimensions embedded.
      const mobileDiagram = buildMobileDiagram(currentDevices, setupType || 'DJ');

      const setupData = {
        name: setupName.trim(),
        ownerId: auth.currentUser.uid,
        setupType: setupType || 'DJ',
        setting: setting || defaultSettingFor(setupType || 'DJ'),
        devices: devicesData,
        mobileDiagram,
        cameraAngles: cameraAngles ?? null,
        isMainSetup: isMainSetup,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await addDoc(collection(db, 'setups'), setupData);
      
      setShowSaveDialog(false);
      setSetupName('');
      setIsMainSetup(false);
      
      // Show success message
      toast.success(`Setup saved${isMainSetup ? ' and set as your main setup' : ''}.`);
    } catch (error) {
      console.error('Error saving setup:', error);
      setError('Failed to save setup. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateSetup = async () => {
    if (!currentDevices || currentDevices.length === 0) {
      setError('No devices to save. Please add some devices to your setup first.');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const devicesData = currentDevices.map(device => ({
        id: device.id,
        name: device.name,
        type: device.type,
        category: device.category,
        brand: device.brand || null,
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
        imageUrl: device.imageUrl || null,
        price: device.price ?? null,
        affiliateUrl: device.affiliateUrl || null,
        connections: device.connections || [],
        spotType: device.spotType ?? null,
        placementIndex: device.placementIndex != null ? device.placementIndex : null,
        uniqueId: device.uniqueId ?? null,
        inputs: device.inputs || [],
        outputs: device.outputs || [],
      }));

      const mobileDiagram = buildMobileDiagram(currentDevices, setupType || 'DJ');

      await updateDoc(doc(db, 'setups', setupId), {
        devices: devicesData,
        mobileDiagram,
        cameraAngles: cameraAngles ?? null,
        setting: setting || defaultSettingFor(setupType || 'DJ'),
        updatedAt: serverTimestamp(),
      });

      setShowSaveDialog(false);
      toast.success('Setup updated.');
    } catch (err) {
      console.error('Error updating setup:', err);
      setError('Failed to update setup. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const unmarkOtherMainSetups = async () => {
    try {
      const setupsRef = collection(db, 'setups');
      const q = query(
        setupsRef,
        where('ownerId', '==', auth.currentUser.uid),
        where('isMainSetup', '==', true)
      );
      const querySnapshot = await getDocs(q);
      
      // Unmark all existing main setups
      const updatePromises = querySnapshot.docs.map(docSnapshot => 
        updateDoc(doc(db, 'setups', docSnapshot.id), {
          isMainSetup: false,
          updatedAt: serverTimestamp()
        })
      );
      
      await Promise.all(updatePromises);
    } catch (error) {
      console.error('Error unmarking main setups:', error);
      // Don't throw - allow save to continue even if unmarking fails
    }
  };

  return (
    <>
      <button 
        className="save-setup-btn"
        onClick={handleSaveClick}
        title="Save this setup"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
          <polyline points="17 21 17 13 7 13 7 21"/>
          <polyline points="7 3 7 8 15 8"/>
        </svg>
        <span className="builder-ctl-label">Save Setup</span>
      </button>

      {showSaveDialog && (
        <div className="save-setup-overlay" onClick={() => !saving && setShowSaveDialog(false)}>
          <div className="save-setup-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="save-setup-title">Save Setup</h2>

            {setupId && (
              <>
                <button
                  className="save-setup-update-btn"
                  onClick={handleUpdateSetup}
                  disabled={saving}
                >
                  <MdSave size={18} />
                  {saving ? 'Updating…' : `Update "${loadedSetupName}"`}
                </button>
                <div className="save-setup-divider"><span>or save as new copy</span></div>
              </>
            )}

            <div className="save-setup-form">
              <label className="save-setup-label">
                Setup Name
                <input
                  type="text"
                  className="save-setup-input"
                  placeholder="My DJ Setup"
                  value={setupName}
                  onChange={(e) => setSetupName(e.target.value)}
                  disabled={saving}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !saving) {
                      handleSaveSetup();
                    }
                    if (e.key === 'Escape' && !saving) {
                      setShowSaveDialog(false);
                    }
                  }}
                />
              </label>

              <label className="save-setup-checkbox-label">
                <input
                  type="checkbox"
                  checked={isMainSetup}
                  onChange={(e) => setIsMainSetup(e.target.checked)}
                  disabled={saving}
                />
                <span>Set as main setup</span>
                <span className="save-setup-checkbox-hint">Only one main setup allowed</span>
              </label>

              {error && (
                <div className="save-setup-error">{error}</div>
              )}

              <div className="save-setup-actions">
                <button
                  className="save-setup-cancel"
                  onClick={() => setShowSaveDialog(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  className="save-setup-submit"
                  onClick={handleSaveSetup}
                  disabled={saving || !setupName.trim()}
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default SaveSetupButton;
