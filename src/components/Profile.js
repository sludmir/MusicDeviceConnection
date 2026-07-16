import React, { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, query, where, orderBy, doc, getDoc, updateDoc, setDoc, deleteDoc, addDoc, arrayUnion, arrayRemove, serverTimestamp, getCountFromServer } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import { MdDelete, MdPlayArrow, MdVerified, MdLink } from 'react-icons/md';
import FaveProductViewer from './FaveProductViewer';
import { useSetPlayer } from './SetPlayerProvider';
import useViewerRoles from '../utils/useViewerRoles';
import { getSignedBunnyUrls } from '../utils/bunnyUrl';
import {
  Avatar,
  Button,
  Card,
  Chip,
  Modal,
  Tabs,
  Select,
  EmptyState,
  useToast,
} from '../ui';
import './Profile.css';

const TAB_ITEMS = [
  { value: 'sets', label: 'SETS' },
  { value: 'setups', label: 'SETUPS' },
];

function formatDate(ts) {
  if (!ts?.toDate) return '';
  return ts.toDate().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function Profile({ userId, onSetupSelect }) {
  const toast = useToast();
  const { playSet } = useSetPlayer();
  const [profile, setProfile] = useState(null);
  const [sets, setSets] = useState([]);
  const [setups, setSetups] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followers, setFollowers] = useState(0);
  const [faveSaving, setFaveSaving] = useState(false);
  const [faveProduct, setFaveProduct] = useState(null);
  const [setToDelete, setSetToDelete] = useState(null);
  const [deletingSet, setDeletingSet] = useState(false);
  const [setToRelink, setSetToRelink] = useState(null);
  const [relinkSetupId, setRelinkSetupId] = useState('');
  const [relinkingSet, setRelinkingSet] = useState(false);
  const [creatorSaving, setCreatorSaving] = useState(false);
  const { isAdmin } = useViewerRoles();
  const [activeTab, setActiveTab] = useState(() =>
    new URLSearchParams(window.location.search).get('tab') === 'setups' ? 'setups' : 'sets'
  );

  const currentUserId = auth.currentUser?.uid;
  const isOwnProfile = !!currentUserId && currentUserId === userId;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        // Independent reads go out in parallel — this used to be a 6-deep
        // sequential await chain, which is what made profiles slow to open
        // on mobile connections.
        const [userSnap, followersCount, setsSnap, setupsSnap, meSnap] = await Promise.all([
          getDoc(doc(db, 'users', userId)),
          getCountFromServer(collection(db, 'users', userId, 'followers')).catch(() => null),
          getDocs(query(collection(db, 'sets'), where('creatorId', '==', userId), orderBy('createdAt', 'desc'))),
          getDocs(query(collection(db, 'setups'), where('ownerId', '==', userId))),
          currentUserId && currentUserId !== userId
            ? getDoc(doc(db, 'users', currentUserId)).catch(() => null)
            : Promise.resolve(null),
        ]);
        if (cancelled) return;

        if (userSnap.exists()) {
          setProfile(userSnap.data());
        } else {
          setProfile({ displayName: userId.slice(0, 8), bio: '', createdAt: new Date() });
        }
        setFollowers(followersCount ? followersCount.data().count : 0);

        const setsList = [];
        setsSnap.forEach((d) => setsList.push({ id: d.id, ...d.data() }));
        setSets(setsList);

        const setupsList = [];
        setupsSnap.forEach((d) => setupsList.push({ id: d.id, ...d.data() }));
        setupsList.sort((a, b) => {
          const at = a.updatedAt?.toDate?.()?.getTime() ?? a.createdAt?.toDate?.()?.getTime() ?? 0;
          const bt = b.updatedAt?.toDate?.()?.getTime() ?? b.createdAt?.toDate?.()?.getTime() ?? 0;
          return bt - at;
        });
        setSetups(setupsList);

        if (meSnap && meSnap.exists()) {
          setIsFollowing((meSnap.data().following || []).includes(userId));
        }

        // Thumbnails arrive after first paint: sign in the background and
        // patch state instead of blocking the profile on N callables.
        Promise.all(setsList.map(async (s) => {
          try {
            const signed = await getSignedBunnyUrls('set', s.id);
            return { id: s.id, thumbnailURL: signed.thumbnailURL || null };
          } catch { return { id: s.id, thumbnailURL: null }; }
        })).then((thumbs) => {
          if (cancelled) return;
          const byId = new Map(thumbs.map((t) => [t.id, t.thumbnailURL]));
          setSets((prev) => prev.map((s) => (byId.get(s.id) ? { ...s, thumbnailURL: byId.get(s.id) } : s)));
        });
      } catch (err) {
        console.error('Error loading profile:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId, currentUserId]);

  // Fave-product options are own-profile-only and only feed the picker —
  // load them off the critical path so they never delay first paint.
  useEffect(() => {
    if (!isOwnProfile) return;
    let cancelled = false;
    (async () => {
      try {
        const productsSnap = await getDocs(collection(db, 'products'));
        if (cancelled) return;
        const productsList = productsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        productsList.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        setProducts(productsList);
      } catch { /* picker stays empty; fave viewer falls back to a direct doc read */ }
    })();
    return () => { cancelled = true; };
  }, [isOwnProfile]);

  useEffect(() => {
    if (!profile?.faveProductId) {
      setFaveProduct(null);
      return;
    }
    if (isOwnProfile && products.length > 0) {
      setFaveProduct(products.find((x) => x.id === profile.faveProductId) || null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'products', profile.faveProductId));
        if (cancelled) return;
        setFaveProduct(snap.exists() ? { id: snap.id, ...snap.data() } : null);
      } catch {
        if (!cancelled) setFaveProduct(null);
      }
    })();
    return () => { cancelled = true; };
  }, [profile?.faveProductId, isOwnProfile, products]);

  const refreshFollowerCount = async () => {
    try {
      const snap = await getCountFromServer(collection(db, 'users', userId, 'followers'));
      setFollowers(snap.data().count);
    } catch (err) {
      console.error('Error refreshing follower count:', err);
    }
  };

  const handleFollow = async () => {
    if (!currentUserId || currentUserId === userId) return;
    const meRef = doc(db, 'users', currentUserId);
    const targetFollowerRef = doc(db, 'users', userId, 'followers', currentUserId);
    try {
      const me = await getDoc(meRef);
      const myName = me.exists() ? (me.data().displayName || auth.currentUser?.email?.split('@')[0] || 'Someone') : 'Someone';
      if (isFollowing) {
        await updateDoc(meRef, { following: arrayRemove(userId) });
        await deleteDoc(targetFollowerRef);
        setIsFollowing(false);
      } else {
        await updateDoc(meRef, { following: arrayUnion(userId) });
        await setDoc(targetFollowerRef, { createdAt: serverTimestamp() });
        try {
          await addDoc(collection(db, 'users', userId, 'notifications'), {
            type: 'follow',
            fromUserId: currentUserId,
            fromUserName: myName,
            createdAt: serverTimestamp(),
            read: false,
          });
        } catch (e) {
          console.warn('Could not create follow notification:', e);
        }
        setIsFollowing(true);
      }
      await refreshFollowerCount();
    } catch (err) {
      console.error('Error updating follow status:', err);
      toast.error('Could not update follow status.');
    }
  };

  const handleConfirmDeleteSet = async () => {
    if (!setToDelete || !isOwnProfile || setToDelete.creatorId !== currentUserId) {
      setSetToDelete(null);
      return;
    }
    setDeletingSet(true);
    try {
      const clipsSnap = await getDocs(query(collection(db, 'clips'), where('fullSetId', '==', setToDelete.id)));
      await Promise.all(clipsSnap.docs.map((d) => deleteDoc(doc(db, 'clips', d.id))));
      await deleteDoc(doc(db, 'sets', setToDelete.id));
      setSets((prev) => prev.filter((s) => s.id !== setToDelete.id));
      toast.success('Set removed.');
    } catch (err) {
      console.error('Error deleting set:', err);
      toast.error('Failed to remove set.');
    } finally {
      setDeletingSet(false);
      setSetToDelete(null);
    }
  };

  const handleOpenRelink = (set, e) => {
    e.preventDefault();
    e.stopPropagation();
    setSetToRelink(set);
    setRelinkSetupId(set.setupId || '');
  };

  const handleConfirmRelink = async () => {
    if (!setToRelink || !isOwnProfile || setToRelink.creatorId !== currentUserId) {
      setSetToRelink(null);
      return;
    }
    if (!relinkSetupId) {
      toast.error('Please select a setup to link.');
      return;
    }
    const linkedSetup = setups.find((s) => s.id === relinkSetupId);
    if (!linkedSetup) {
      toast.error('Selected setup was not found.');
      return;
    }

    setRelinkingSet(true);
    try {
      const payload = {
        setupId: relinkSetupId,
        setupName: linkedSetup.name || '',
        setupType: linkedSetup.setupType || 'DJ',
      };
      await updateDoc(doc(db, 'sets', setToRelink.id), payload);
      const clipsSnap = await getDocs(query(collection(db, 'clips'), where('fullSetId', '==', setToRelink.id)));
      await Promise.all(clipsSnap.docs.map((clipDoc) => updateDoc(doc(db, 'clips', clipDoc.id), payload)));
      setSets((prev) => prev.map((s) => (s.id === setToRelink.id ? { ...s, ...payload } : s)));
      toast.success('Linked setup updated.');
      setSetToRelink(null);
      setRelinkSetupId('');
    } catch (err) {
      console.error('Error updating linked setup:', err);
      toast.error('Failed to update linked setup.');
    } finally {
      setRelinkingSet(false);
    }
  };

  const handleFaveChange = async (productId) => {
    if (!isOwnProfile) return;
    const product = products.find((p) => p.id === productId);
    setFaveSaving(true);
    try {
      await updateDoc(doc(db, 'users', currentUserId), {
        faveProductId: productId || null,
        faveProductName: product?.name || null,
      });
      setProfile((prev) => ({
        ...prev,
        faveProductId: productId || null,
        faveProductName: product?.name || null,
      }));
    } catch (err) {
      console.error('Error saving fave product:', err);
      toast.error('Could not save fave product.');
    } finally {
      setFaveSaving(false);
    }
  };

  const handleToggleCreator = async () => {
    if (!isAdmin || !userId) return;
    const next = !profile?.creator;
    setCreatorSaving(true);
    try {
      await updateDoc(doc(db, 'users', userId), { creator: next });
      setProfile((prev) => ({ ...prev, creator: next }));
      toast.success(next ? 'Verified as creator' : 'Creator status revoked');
    } catch (err) {
      console.error('Error updating creator status:', err);
      toast.error('Could not update creator status.');
    } finally {
      setCreatorSaving(false);
    }
  };

  const displayName = profile?.displayName || userId?.slice(0, 12) || 'User';
  const isCreatorProfile = profile?.creator === true;

  const setupsList = useMemo(() => setups, [setups]);

  return (
    <div className="profile">
      <div className="profile__inner">
        <aside className="profile__identity">
          <div className={`profile__avatar${isCreatorProfile ? ' profile__avatar--creator' : ''}`}>
            <Avatar name={displayName} size={96} />
          </div>
          <h1 className="profile__name">{displayName}</h1>
          {isCreatorProfile && (
            <Chip className="profile__creator-chip">
              <MdVerified size={12} aria-hidden="true" /> CREATOR
            </Chip>
          )}
          {profile?.bio && <p className="profile__bio">{profile.bio}</p>}
          <div className="profile__stats">
            <div className="profile__stat">
              <span className="profile__stat-value">{sets.length}</span>
              <span className="profile__stat-label mono-label">Sets</span>
            </div>
            <div className="profile__stat">
              <span className="profile__stat-value">{followers}</span>
              <span className="profile__stat-label mono-label">Followers</span>
            </div>
            <div className="profile__stat">
              <span className="profile__stat-value">{setups.length}</span>
              <span className="profile__stat-label mono-label">Setups</span>
            </div>
          </div>
          {!isOwnProfile && currentUserId && (
            <Button
              variant={isFollowing ? 'secondary' : 'primary'}
              onClick={handleFollow}
              size="md"
              className="profile__follow"
            >
              {isFollowing ? 'Following' : 'Follow'}
            </Button>
          )}
          {isAdmin && !loading && (
            <Button
              variant="secondary"
              size="md"
              className="profile__verify-creator"
              onClick={handleToggleCreator}
              disabled={creatorSaving}
            >
              {isCreatorProfile ? 'Revoke creator' : 'Verify as creator'}
            </Button>
          )}

          <div className="profile__divider" />

          <div className="profile__fave">
            <span className="mono-label profile__fave-eyebrow">Fave product</span>
            {isOwnProfile && (
              <Select
                aria-label="Choose a fave product"
                value={profile?.faveProductId || ''}
                onChange={(e) => handleFaveChange(e.target.value || null)}
                disabled={faveSaving}
              >
                <option value="">— None —</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name || p.id}</option>
                ))}
              </Select>
            )}
            {profile?.faveProductId && faveProduct ? (
              <>
                <div className="profile__fave-name">{profile.faveProductName || faveProduct.name}</div>
                <div className="profile__fave-viewer">
                  <FaveProductViewer product={faveProduct} />
                </div>
              </>
            ) : !isOwnProfile ? (
              <div className="profile__fave-empty">No fave product set.</div>
            ) : null}
          </div>
        </aside>

        <main className="profile__main">
          <Tabs items={TAB_ITEMS} value={activeTab} onChange={setActiveTab} />

          {loading ? (
            <div className="profile__loading">Loading…</div>
          ) : activeTab === 'sets' ? (
            sets.length === 0 ? (
              <EmptyState
                eyebrow="NO SETS"
                title="No live sets posted yet"
                body={isOwnProfile ? "Post a full set from the feed to see it here." : "This user hasn't posted yet."}
              />
            ) : (
              <div className="profile__sets-grid">
                {sets.map((set) => (
                  <div
                    key={set.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => { if (set.videoURL) playSet(set); }}
                    onKeyDown={(e) => {
                      if ((e.key === 'Enter' || e.key === ' ') && set.videoURL) {
                        e.preventDefault();
                        playSet(set);
                      }
                    }}
                    className="profile-set"
                  >
                    <div className="profile-set__thumb">
                      {set.thumbnailURL ? (
                        <img src={set.thumbnailURL} alt="" loading="lazy" />
                      ) : set.videoURL ? (
                        <video src={set.videoURL} muted preload="metadata" playsInline />
                      ) : (
                        <div className="profile-set__placeholder">No preview</div>
                      )}
                      <div className="profile-set__overlay">
                        <div className="profile-set__play"><MdPlayArrow size={24} /></div>
                      </div>
                      {isOwnProfile && (
                        <>
                          <button
                            type="button"
                            className="profile-set__relink"
                            onClick={(e) => handleOpenRelink(set, e)}
                            aria-label="Change linked setup"
                            title="Change linked setup"
                          >
                            <MdLink size={16} />
                          </button>
                          <button
                            type="button"
                            className="profile-set__delete"
                            onClick={(e) => { e.stopPropagation(); setSetToDelete(set); }}
                            aria-label="Remove this set"
                          >
                            <MdDelete size={16} />
                          </button>
                        </>
                      )}
                    </div>
                    <div className="profile-set__meta">
                      <div className="profile-set__title">{set.title || 'Untitled set'}</div>
                      {set.setupName ? (
                        <div className="profile-set__setup mono-label">{set.setupName}</div>
                      ) : (
                        isOwnProfile && (
                          <div className="profile-set__setup profile-set__setup--missing mono-label">No setup linked</div>
                        )
                      )}
                      <div className="profile-set__date mono-label">{formatDate(set.createdAt)}</div>
                      {isOwnProfile && (
                        <button
                          type="button"
                          className="profile-set__change-setup"
                          onClick={(e) => handleOpenRelink(set, e)}
                        >
                          Change linked setup
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            setupsList.length === 0 ? (
              <EmptyState
                eyebrow="NO SETUPS"
                title="No saved setups"
                body={isOwnProfile ? "Build a setup from the Hub to see it here." : "This user hasn't saved any setups yet."}
              />
            ) : (
              <div className="profile__setups-grid">
                {setupsList.map((setup) => (
                  <Card
                    key={setup.id}
                    padding="md"
                    className="profile-setup-card"
                    onClick={() => onSetupSelect && onSetupSelect(setup)}
                  >
                    <div className="profile-setup-card__top">
                      <Chip>{(setup.setupType || 'DJ').toUpperCase()}</Chip>
                      {setup.isMainSetup && <Chip>MAIN</Chip>}
                    </div>
                    <h4 className="profile-setup-card__name">{setup.name || 'Untitled Setup'}</h4>
                    <div className="profile-setup-card__meta mono-label">
                      {(setup.devices?.length || 0)} DEVICES
                    </div>
                  </Card>
                ))}
              </div>
            )
          )}
        </main>
      </div>

      <Modal
        open={!!setToDelete}
        onClose={() => !deletingSet && setSetToDelete(null)}
        title="Remove this live set?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setSetToDelete(null)} disabled={deletingSet}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleConfirmDeleteSet} loading={deletingSet}>
              Remove
            </Button>
          </>
        }
      >
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 'var(--fs-sm)' }}>
          This set will be removed from your profile and its clips will be removed from the feed.
          The video file will not be deleted from storage.
        </p>
      </Modal>

      <Modal
        open={!!setToRelink}
        onClose={() => !relinkingSet && setSetToRelink(null)}
        title="Change linked setup"
        footer={
          <>
            <Button variant="ghost" onClick={() => setSetToRelink(null)} disabled={relinkingSet}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirmRelink}
              loading={relinkingSet}
              disabled={!relinkSetupId || relinkingSet}
            >
              Save
            </Button>
          </>
        }
      >
        <p style={{ margin: '0 0 var(--space-4)', color: 'var(--text-muted)', fontSize: 'var(--fs-sm)' }}>
          Choose which saved setup is linked to <strong>{setToRelink?.title || 'this set'}</strong>.
          Feed clips from this set will use the same setup.
        </p>
        {setups.length === 0 ? (
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 'var(--fs-sm)' }}>
            No saved setups yet. Build and save a setup first.
          </p>
        ) : (
          <div className="profile-set-relink-list">
            {setups.map((setup) => (
              <button
                key={setup.id}
                type="button"
                className={`profile-set-relink-option ${relinkSetupId === setup.id ? 'active' : ''}`}
                onClick={() => setRelinkSetupId(setup.id)}
              >
                <span className="profile-set-relink-option-name">{setup.name || 'Untitled setup'}</span>
                <span className="profile-set-relink-option-meta mono-label">
                  {(setup.setupType || 'DJ').toUpperCase()} · {(setup.devices || []).length} devices
                </span>
              </button>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}

export default Profile;
