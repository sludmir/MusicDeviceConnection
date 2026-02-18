import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db, auth } from './firebaseConfig';
import './components/HubLandingPage.css';

function MySets({ onBack, onSelectSetup }) {
  const [savedSetups, setSavedSetups] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSavedSetups();
  }, []);

  const loadSavedSetups = async () => {
    if (!auth.currentUser) return;
    try {
      setLoading(true);
      const setupsRef = collection(db, 'setups');
      const q = query(setupsRef, where('ownerId', '==', auth.currentUser.uid));
      const snapshot = await getDocs(q);
      const list = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      list.sort((a, b) => {
        const at = a.createdAt?.toDate?.()?.getTime() ?? 0;
        const bt = b.createdAt?.toDate?.()?.getTime() ?? 0;
        return bt - at;
      });
      setSavedSetups(list);
    } catch (err) {
      console.error('Error loading setups:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp?.toDate) return '';
    return timestamp.toDate().toLocaleDateString();
  };

  return (
    <div className="hub-landing-page" style={{ padding: '24px' }}>
      <div className="profile-header" style={{ marginBottom: '24px' }}>
        {onBack && (
          <button type="button" className="profile-back-btn" onClick={onBack}>
            � Back
          </button>
        )}
        <h1 style={{ margin: 0, fontSize: '24px' }}>My Sets</h1>
      </div>
      {loading ? (
        <div className="hub-loading">Loading...</div>
      ) : savedSetups.length === 0 ? (
        <div className="hub-empty">
          <p>No saved setups yet.</p>
        </div>
      ) : (
        <div className="hub-setups-grid">
          {savedSetups.map((setup) => (
            <button
              key={setup.id}
              type="button"
              className="hub-setup-card"
              onClick={() => {
                if (onSelectSetup) onSelectSetup(setup);
                if (onBack) onBack();
              }}
            >
              <span className="hub-setup-card-type">{setup.setupType || 'DJ'}</span>
              <span className="hub-setup-card-name">{setup.name || 'Untitled Setup'}</span>
              <span className="hub-setup-card-meta">
                {setup.devices?.length || 0} devices � {formatDate(setup.createdAt)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default MySets;
