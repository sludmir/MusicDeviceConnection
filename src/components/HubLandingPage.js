import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, orderBy, doc, deleteDoc, getDoc, getCountFromServer, limit } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import { MdHeadphones, MdPiano, MdMoreVert, MdArrowForward, MdDelete, MdRefresh } from 'react-icons/md';
import { IoMusicalNotes } from 'react-icons/io5';
import PostSetModal from './PostSetModal';
import { Button, Card, Chip, SectionHeader, EmptyState, useToast } from '../ui';
import './HubLandingPage.css';

const SETUP_TYPES = [
  { type: 'DJ', icon: MdHeadphones, blurb: 'CDJs, mixers & turntables' },
  { type: 'Producer', icon: MdPiano, blurb: 'Synths, interfaces & controllers' },
  { type: 'Musician', icon: IoMusicalNotes, blurb: 'Instruments, amps & pedals' },
];

function formatTimestamp(ts) {
  if (!ts?.toDate) return '';
  const d = ts.toDate();
  const now = new Date();
  const diff = now - d;
  if (diff < 86400000) return 'Today';
  if (diff < 172800000) return 'Yesterday';
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return d.toLocaleDateString();
}

function formatDuration(seconds) {
  if (!seconds || seconds < 0) return '';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function HubLandingPage({ onSetupSelect, onNewSetup, onFeedClick }) {
  const toast = useToast();
  const [savedSetups, setSavedSetups] = useState([]);
  const [recentSets, setRecentSets] = useState([]);
  const [stats, setStats] = useState({ setups: 0, posts: 0, followers: 0 });
  const [loading, setLoading] = useState(true);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [showPostSetModal, setShowPostSetModal] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const uid = auth.currentUser.uid;

        const setupsQ = query(
          collection(db, 'setups'),
          where('ownerId', '==', uid),
          orderBy('createdAt', 'desc'),
          limit(7),
        );
        const setupsSnap = await getDocs(setupsQ);
        const setups = [];
        setupsSnap.forEach((d) => setups.push({ id: d.id, ...d.data() }));

        let recent = [];
        try {
          const setsQ = query(collection(db, 'sets'), orderBy('createdAt', 'desc'), limit(6));
          const setsSnap = await getDocs(setsQ);
          setsSnap.forEach((d) => recent.push({ id: d.id, ...d.data() }));
        } catch {
          recent = [];
        }

        const userSnap = await getDoc(doc(db, 'users', uid));
        const userData = userSnap.exists() ? userSnap.data() : {};
        const followerCount = userData.followers?.length || 0;

        let postCount = 0;
        try {
          const myPostsQ = query(collection(db, 'sets'), where('creatorId', '==', uid));
          const myPostsSnap = await getCountFromServer(myPostsQ);
          postCount = myPostsSnap.data().count;
        } catch { /* ignore */ }

        let setupCount = setups.length;
        try {
          const setupCountQ = query(collection(db, 'setups'), where('ownerId', '==', uid));
          const setupCountSnap = await getCountFromServer(setupCountQ);
          setupCount = setupCountSnap.data().count;
        } catch { /* ignore */ }

        if (!cancelled) {
          setSavedSetups(setups);
          setRecentSets(recent);
          setStats({ setups: setupCount, posts: postCount, followers: followerCount });
        }
      } catch (err) {
        console.error('Hub data load failed:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (!e.target.closest('.hub-setup-card__menu-wrap')) setOpenMenuId(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleDeleteSetup = async (setup) => {
    if (!auth.currentUser || setup.ownerId !== auth.currentUser.uid) return;
    if (!window.confirm(`Delete "${setup.name || 'Untitled Setup'}"? This can't be undone.`)) return;
    try {
      await deleteDoc(doc(db, 'setups', setup.id));
      setSavedSetups((prev) => prev.filter((s) => s.id !== setup.id));
      setStats((prev) => ({ ...prev, setups: Math.max(0, prev.setups - 1) }));
      toast.success('Setup deleted.');
    } catch (err) {
      console.error('Error deleting setup:', err);
      toast.error('Failed to delete setup.');
    }
    setOpenMenuId(null);
  };

  const continueSetup = savedSetups[0] || null;
  const otherSetups = savedSetups.slice(1, 7);

  return (
    <div className="hub">
      <div className="hub__inner">

        {/* Section 1: Continue / Start Building */}
        {continueSetup ? (
          <section className="hub__section">
            <SectionHeader eyebrow="CONTINUE" />
            <Card padding="lg" className="hub-continue">
              <div className="hub-continue__body">
                <div className="hub-continue__meta">
                  <Chip>{(continueSetup.setupType || 'DJ').toUpperCase()}</Chip>
                  <span className="hub-continue__edited mono-label">
                    LAST EDITED · {formatTimestamp(continueSetup.updatedAt || continueSetup.createdAt)}
                  </span>
                </div>
                <h2 className="hub-continue__name">{continueSetup.name || 'Untitled Setup'}</h2>
                <p className="hub-continue__sub">
                  {continueSetup.devices?.length || 0} device{(continueSetup.devices?.length || 0) === 1 ? '' : 's'} placed
                </p>
              </div>
              <Button onClick={() => onSetupSelect && onSetupSelect(continueSetup)} size="lg">
                <MdRefresh size={18} /> Resume
              </Button>
            </Card>
          </section>
        ) : (
          <section className="hub__section">
            {loading ? (
              <Card padding="lg"><div className="hub-loading">Loading…</div></Card>
            ) : (
              <EmptyState
                eyebrow="WELCOME"
                title="Build your first setup"
                body="Pick the kind of rig you play. You can switch later or build more than one."
                action={null}
              />
            )}
            {!loading && (
              <div className="hub-types">
                {SETUP_TYPES.map(({ type, icon: Icon, blurb }) => (
                  <Card
                    key={type}
                    padding="lg"
                    className="hub-type-card"
                    onClick={() => onNewSetup && onNewSetup(type)}
                  >
                    <Icon size={36} className="hub-type-card__icon" />
                    <h3 className="hub-type-card__title">{type}</h3>
                    <p className="hub-type-card__blurb">{blurb}</p>
                  </Card>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Section 2: Recent posts */}
        {recentSets.length > 0 && (
          <section className="hub__section">
            <SectionHeader
              eyebrow="RECENT POSTS"
              action={onFeedClick && (
                <button type="button" className="hub-link" onClick={onFeedClick}>
                  View feed <MdArrowForward size={14} />
                </button>
              )}
            />
            <div className="hub-sets-row">
              {recentSets.map((set) => (
                <button
                  key={set.id}
                  type="button"
                  className="hub-set-tile"
                  onClick={onFeedClick}
                  aria-label={`Open ${set.title || 'set'}`}
                >
                  <div className="hub-set-tile__thumb">
                    {set.videoURL ? (
                      <video src={set.videoURL} muted preload="metadata" />
                    ) : null}
                    {set.durationSeconds ? (
                      <span className="hub-set-tile__duration mono-label">
                        {formatDuration(set.durationSeconds)}
                      </span>
                    ) : null}
                  </div>
                  <div className="hub-set-tile__meta">
                    <div className="hub-set-tile__creator mono-label">{set.creatorName || 'Unknown'}</div>
                    <div className="hub-set-tile__title">{set.title || 'Untitled set'}</div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Section 3: Your setups */}
        {continueSetup && (
          <section className="hub__section">
            <SectionHeader
              eyebrow="YOUR SETUPS"
              action={
                <button
                  type="button"
                  className="hub-link"
                  onClick={() => { window.location.assign('/sets'); }}
                >
                  View all <MdArrowForward size={14} />
                </button>
              }
            />
            {otherSetups.length === 0 ? (
              <p className="hub-setups-empty">You only have one setup so far. Build another to fill this section.</p>
            ) : (
              <div className="hub-setups-grid">
                {otherSetups.map((setup) => (
                  <Card
                    key={setup.id}
                    padding="md"
                    className="hub-setup-card"
                    onClick={() => onSetupSelect && onSetupSelect(setup)}
                  >
                    <div className="hub-setup-card__top">
                      <Chip>{(setup.setupType || 'DJ').toUpperCase()}</Chip>
                      <div className="hub-setup-card__menu-wrap" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="hub-setup-card__kebab"
                          aria-label="Setup actions"
                          onClick={() => setOpenMenuId(openMenuId === setup.id ? null : setup.id)}
                        >
                          <MdMoreVert size={18} />
                        </button>
                        {openMenuId === setup.id && (
                          <div className="hub-setup-card__menu">
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleDeleteSetup(setup); }}
                            >
                              <MdDelete size={14} /> Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <h4 className="hub-setup-card__name">{setup.name || 'Untitled Setup'}</h4>
                    <div className="hub-setup-card__bottom mono-label">
                      {(setup.devices?.length || 0)} DEVICES · {formatTimestamp(setup.updatedAt || setup.createdAt)}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>
        )}

      </div>

      {showPostSetModal && (
        <PostSetModal
          onClose={() => setShowPostSetModal(false)}
          onSuccess={() => setShowPostSetModal(false)}
        />
      )}
    </div>
  );
}

export default HubLandingPage;
