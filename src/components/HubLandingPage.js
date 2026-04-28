import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, orderBy, doc, deleteDoc, limit } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import { MdHeadphones, MdPiano, MdMoreVert, MdArrowForward, MdDelete, MdAdd, MdPlayArrow } from 'react-icons/md';
import { IoMusicalNotes } from 'react-icons/io5';
import PostSetModal from './PostSetModal';
import { Card, Chip, SectionHeader, useToast } from '../ui';
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
  const [featured, setFeatured] = useState([]);
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
          limit(12),
        );
        const setupsSnap = await getDocs(setupsQ);
        const setups = [];
        setupsSnap.forEach((d) => setups.push({ id: d.id, ...d.data() }));

        let recent = [];
        try {
          const setsQ = query(collection(db, 'sets'), orderBy('createdAt', 'desc'), limit(8));
          const setsSnap = await getDocs(setsQ);
          setsSnap.forEach((d) => recent.push({ id: d.id, ...d.data() }));
        } catch {
          recent = [];
        }

        if (!cancelled) {
          setSavedSetups(setups);
          setFeatured(recent);
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
      toast.success('Setup deleted.');
    } catch (err) {
      console.error('Error deleting setup:', err);
      toast.error('Failed to delete setup.');
    }
    setOpenMenuId(null);
  };

  const hero = featured[0];
  const otherFeatured = featured.slice(1);

  return (
    <div className="hub">
      <div className="hub__inner">

        {/* ---- FEATURED ---- */}
        <section className="hub__section">
          <SectionHeader
            eyebrow="FEATURED"
            title="From the community"
            action={onFeedClick && (
              <button type="button" className="hub-link" onClick={onFeedClick}>
                Open feed <MdArrowForward size={14} />
              </button>
            )}
          />

          {loading ? (
            <Card padding="lg"><div className="hub-loading">Loading…</div></Card>
          ) : featured.length === 0 ? (
            <Card padding="lg">
              <div className="hub-loading">No live sets posted yet. Be the first.</div>
            </Card>
          ) : (
            <div className="hub-featured">
              {/* Hero */}
              <button
                type="button"
                className="hub-hero"
                onClick={onFeedClick}
                aria-label={`Watch ${hero.title || 'set'}`}
              >
                <div className="hub-hero__thumb">
                  {hero.videoURL ? (
                    <video src={hero.videoURL} muted preload="metadata" />
                  ) : null}
                  <div className="hub-hero__overlay">
                    <div className="hub-hero__play"><MdPlayArrow size={28} /></div>
                  </div>
                  {hero.durationSeconds ? (
                    <span className="hub-hero__duration mono-label">
                      {formatDuration(hero.durationSeconds)}
                    </span>
                  ) : null}
                </div>
                <div className="hub-hero__meta">
                  <span className="mono-label hub-hero__creator">{hero.creatorName || 'Unknown'}</span>
                  <h2 className="hub-hero__title">{hero.title || 'Untitled set'}</h2>
                  {hero.setupType && (
                    <div className="hub-hero__chip"><Chip>{hero.setupType.toUpperCase()}</Chip></div>
                  )}
                </div>
              </button>

              {/* Smaller tiles row */}
              {otherFeatured.length > 0 && (
                <div className="hub-sets-row">
                  {otherFeatured.map((set) => (
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
              )}
            </div>
          )}
        </section>

        {/* ---- YOUR SETUPS ---- */}
        <section className="hub__section">
          <SectionHeader
            eyebrow="YOUR SETUPS"
            action={savedSetups.length > 0 && (
              <button
                type="button"
                className="hub-link"
                onClick={() => window.location.assign('/sets')}
              >
                View all <MdArrowForward size={14} />
              </button>
            )}
          />

          {loading ? null : savedSetups.length === 0 ? (
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
                  <span className="hub-type-card__cta mono-label">START BUILDING →</span>
                </Card>
              ))}
            </div>
          ) : (
            <div className="hub-setups-grid">
              {savedSetups.slice(0, 5).map((setup) => (
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

              {/* "+ New" tile slotted into the grid */}
              <button
                type="button"
                className="hub-new-setup-tile"
                onClick={() => {
                  // Default to DJ for the quick-add tile; user can switch in builder.
                  onNewSetup && onNewSetup('DJ');
                }}
                aria-label="Start a new setup"
              >
                <MdAdd size={28} />
                <span>New setup</span>
              </button>
            </div>
          )}
        </section>

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
