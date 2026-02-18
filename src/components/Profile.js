import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, orderBy, doc, getDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import './Profile.css';

const SETUP_TYPES = ['DJ', 'Producer', 'Musician'];

function Profile({ userId, onBack }) {
  const [profile, setProfile] = useState(null);
  const [sets, setSets] = useState([]);
  const [setups, setSetups] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followers, setFollowers] = useState(0);
  const [faveSaving, setFaveSaving] = useState(false);
  const currentUserId = auth.currentUser?.uid;
  const isOwnProfile = currentUserId && currentUserId === userId;

  useEffect(() => {
    loadProfile();
    loadSets();
    loadSetups();
    checkFollowing();
    if (isOwnProfile) loadProducts();
  }, [userId, isOwnProfile]);

  const loadProfile = async () => {
    try {
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        setProfile(userSnap.data());
        setFollowers(userSnap.data().followers?.length || 0);
      } else {
        const basicProfile = {
          displayName: userId.slice(0, 8),
          bio: '',
          followers: [],
          following: [],
          createdAt: new Date()
        };
        setProfile(basicProfile);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const loadSets = async () => {
    try {
      setLoading(true);
      const setsRef = collection(db, 'sets');
      const q = query(
        setsRef,
        where('creatorId', '==', userId),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      const userSets = [];
      snapshot.forEach((docSnap) => {
        userSets.push({ id: docSnap.id, ...docSnap.data() });
      });
      setSets(userSets);
    } catch (error) {
      console.error('Error loading sets:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSetups = async () => {
    try {
      const setupsRef = collection(db, 'setups');
      const q = query(setupsRef, where('ownerId', '==', userId));
      const snapshot = await getDocs(q);
      const list = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      list.sort((a, b) => {
        const at = a.updatedAt?.toDate?.() || a.createdAt?.toDate?.() || new Date(0);
        const bt = b.updatedAt?.toDate?.() || b.createdAt?.toDate?.() || new Date(0);
        return bt - at;
      });
      setSetups(list);
    } catch (error) {
      console.error('Error loading setups:', error);
    }
  };

  const loadProducts = async () => {
    try {
      const productsRef = collection(db, 'products');
      const snapshot = await getDocs(productsRef);
      const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setProducts(list);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  const checkFollowing = async () => {
    if (!currentUserId || currentUserId === userId) return;
    try {
      const currentUserRef = doc(db, 'users', currentUserId);
      const currentUserSnap = await getDoc(currentUserRef);
      if (currentUserSnap.exists()) {
        const following = currentUserSnap.data().following || [];
        setIsFollowing(following.includes(userId));
      }
    } catch (error) {
      console.error('Error checking follow status:', error);
    }
  };

  const handleFollow = async () => {
    if (!currentUserId || currentUserId === userId) return;
    try {
      const currentUserRef = doc(db, 'users', currentUserId);
      const targetUserRef = doc(db, 'users', userId);
      
      if (isFollowing) {
        await updateDoc(currentUserRef, {
          following: arrayRemove(userId)
        });
        await updateDoc(targetUserRef, {
          followers: arrayRemove(currentUserId)
        });
        setIsFollowing(false);
        setFollowers(prev => Math.max(0, prev - 1));
      } else {
        await updateDoc(currentUserRef, {
          following: arrayUnion(userId)
        });
        await updateDoc(targetUserRef, {
          followers: arrayUnion(currentUserId)
        });
        setIsFollowing(true);
        setFollowers(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error updating follow status:', error);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp?.toDate) return '';
    const d = timestamp.toDate();
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const handleFaveChange = async (productId) => {
    if (!currentUserId || currentUserId !== userId) return;
    const product = products.find((p) => p.id === productId);
    setFaveSaving(true);
    try {
      const userRef = doc(db, 'users', currentUserId);
      await updateDoc(userRef, {
        faveProductId: productId || null,
        faveProductName: product?.name || null
      });
      setProfile((prev) => ({
        ...prev,
        faveProductId: productId || null,
        faveProductName: product?.name || null
      }));
    } catch (error) {
      console.error('Error saving fave product:', error);
    } finally {
      setFaveSaving(false);
    }
  };

  const setupsByType = SETUP_TYPES.map((type) => ({
    type,
    list: setups.filter((s) => (s.setupType || 'DJ') === type)
  }));

  return (
    <div className="profile-container">
      <div className="profile-header">
        {onBack && (
          <button className="profile-back-btn" onClick={onBack}>← Back</button>
        )}
        <h1>Profile</h1>
      </div>

      {loading ? (
        <div className="profile-loading">Loading...</div>
      ) : (
        <div className="profile-content">
          <div className="profile-info">
            <div className="profile-avatar">
              {profile?.displayName?.[0]?.toUpperCase() || userId?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="profile-details">
              <h2>{profile?.displayName || userId?.slice(0, 12) || 'User'}</h2>
              {profile?.bio && <p className="profile-bio">{profile.bio}</p>}
              <div className="profile-stats">
                <div className="profile-stat">
                  <div className="profile-stat-value">{sets.length}</div>
                  <div className="profile-stat-label">Sets</div>
                </div>
                <div className="profile-stat">
                  <div className="profile-stat-value">{followers}</div>
                  <div className="profile-stat-label">Followers</div>
                </div>
              </div>
              {currentUserId && currentUserId !== userId && (
                <button
                  className={`profile-follow-btn ${isFollowing ? 'following' : ''}`}
                  onClick={handleFollow}
                >
                  {isFollowing ? 'Following' : 'Follow'}
                </button>
              )}
            </div>
          </div>

          <div className="profile-setups">
            <h3>Setups</h3>
            {setups.length === 0 ? (
              <div className="profile-empty">No setups saved yet</div>
            ) : (
              <div className="profile-setups-by-type">
                {setupsByType.map(({ type, list }) => (
                  <div key={type} className="profile-setup-type-block">
                    <h4 className="profile-setup-type-title">{type}</h4>
                    {list.length === 0 ? (
                      <div className="profile-setup-empty">No {type} setups</div>
                    ) : (
                      <div className="profile-setup-cards">
                        {list.map((setup) => (
                          <div key={setup.id} className="profile-setup-card">
                            <div className="profile-setup-name">{setup.name || `Unnamed ${type}`}</div>
                            <div className="profile-setup-meta">
                              {Array.isArray(setup.devices) ? setup.devices.length : 0} device(s)
                              {setup.isMainSetup && <span className="profile-setup-main">Main</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="profile-sets">
            <h3>Recently uploaded live sets</h3>
            {sets.length === 0 ? (
              <div className="profile-empty">No sets uploaded yet</div>
            ) : (
              <div className="profile-sets-grid">
                {sets.map((set) => (
                  <div key={set.id} className="profile-set-card">
                    {set.videoURL ? (
                      <video
                        src={set.videoURL}
                        className="profile-set-thumbnail"
                        muted
                        playsInline
                      />
                    ) : (
                      <div className="profile-set-placeholder">No preview</div>
                    )}
                    <div className="profile-set-info">
                      <div className="profile-set-title">{set.title || 'Untitled Set'}</div>
                      <div className="profile-set-date">{formatDate(set.createdAt)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="profile-fave">
            <h3>{isOwnProfile ? 'Your fave product' : 'Fave product'}</h3>
            {isOwnProfile ? (
              <>
                <p className="profile-fave-hint">Choose one product to showcase on your profile.</p>
                <div className="profile-fave-picker">
                  <select
                    value={profile?.faveProductId || ''}
                    onChange={(e) => handleFaveChange(e.target.value || null)}
                    disabled={faveSaving}
                    className="profile-fave-select"
                  >
                    <option value="">— None —</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name || p.id}</option>
                    ))}
                  </select>
                  {faveSaving && <span className="profile-fave-saving">Saving…</span>}
                </div>
              </>
            ) : null}
            {(profile?.faveProductName || profile?.faveProductId) ? (
              <div className="profile-fave-current">
                {isOwnProfile ? 'Current: ' : ''}<strong>{profile.faveProductName || 'Fave product'}</strong>
              </div>
            ) : (
              !isOwnProfile && <div className="profile-empty profile-fave-empty">No fave product set</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Profile;
