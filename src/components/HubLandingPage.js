import React, { useState, useEffect, useRef, useMemo } from 'react';
import { collection, getDocs, query, where, orderBy, doc, deleteDoc, getDoc, getCountFromServer } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import { MdDelete, MdHeadphones, MdPlayCircleOutline, MdArrowForward, MdPiano, MdVideocam, MdOpenInNew } from 'react-icons/md';
import { IoMusicalNotes } from 'react-icons/io5';
import PostSetModal from './PostSetModal';
import { useToast } from '../ui';
import './HubLandingPage.css';

const SETUP_TYPES = [
  {
    type: 'DJ',
    icon: <MdHeadphones size={32} />,
    blurb: 'CDJs, mixers & turntables',
    accent: '#d4a850',
    accentRgb: '212, 168, 80',
    eqBars: [45, 80, 55, 95, 60, 85, 50],
  },
  {
    type: 'Producer',
    icon: <MdPiano size={32} />,
    blurb: 'Synths, interfaces & controllers',
    accent: '#c4763a',
    accentRgb: '196, 118, 58',
    eqBars: [70, 40, 90, 55, 80, 35, 75],
  },
  {
    type: 'Musician',
    icon: <IoMusicalNotes size={32} />,
    blurb: 'Instruments, amps & pedals',
    accent: '#a87a52',
    accentRgb: '168, 122, 82',
    eqBars: [60, 85, 40, 95, 50, 75, 65],
  },
];

const ADMIN_EMAIL = 'sebasludmir@gmail.com';

function HubLandingPage({ onSetupSelect, onNewSetup, onFeedClick, onAddProducts, theme = 'light' }) {
  const toast = useToast();
  const [savedSetups, setSavedSetups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPostSetModal, setShowPostSetModal] = useState(false);
  const [stats, setStats] = useState({ setups: 0, posts: 0, followers: 0 });

  const glowsRef = useRef(null);
  const mouseTargetRef = useRef({ x: 0, y: 0 });
  const mouseCurrentRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef(null);
  const scrollYRef = useRef(0);

  const wavePaths = useMemo(() => {
    const makeWave = (yCenter, amp, freq, phase) => {
      const pts = [];
      for (let i = 0; i <= 260; i++) {
        const x = (i / 260) * 1500;
        const y = yCenter + amp * Math.sin((i / 260) * freq * Math.PI * 2 + phase);
        pts.push(i === 0 ? `M${x.toFixed(1)},${y.toFixed(1)}` : `L${x.toFixed(1)},${y.toFixed(1)}`);
      }
      return pts.join(' ');
    };
    return [
      { d: makeWave(110, 22, 1.4, 0),   color: '212,168,80',  opacity: 0.07,  sw: 1,   dur: '16s', delay: '0s',   da: '4 8',  rev: false },
      { d: makeWave(270, 38, 0.9, 1.1), color: '196,118,58',  opacity: 0.055, sw: 1.5, dur: '26s', delay: '-9s',  da: '5 10', rev: true  },
      { d: makeWave(430, 16, 2.1, 0.7), color: '212,168,80',  opacity: 0.075, sw: 1,   dur: '13s', delay: '-4s',  da: '3 9',  rev: false },
      { d: makeWave(570, 50, 0.7, 2.2), color: '196,118,58',  opacity: 0.042, sw: 2,   dur: '34s', delay: '-16s', da: '5 7',  rev: true  },
      { d: makeWave(710, 28, 1.7, 0.3), color: '220,175,90',  opacity: 0.060, sw: 1,   dur: '21s', delay: '-6s',  da: '4 8',  rev: false },
      { d: makeWave(850, 20, 1.2, 1.9), color: '212,168,80',  opacity: 0.060, sw: 1.5, dur: '19s', delay: '-11s', da: '3 9',  rev: true  },
    ];
  }, []);

  useEffect(() => {
    loadSavedSetups();
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const animate = () => {
      const lerp = 0.045;
      mouseCurrentRef.current.x += (mouseTargetRef.current.x - mouseCurrentRef.current.x) * lerp;
      mouseCurrentRef.current.y += (mouseTargetRef.current.y - mouseCurrentRef.current.y) * lerp;
      if (glowsRef.current) {
        const t = performance.now() / 1000;
        const driftX = Math.sin(t * 0.18) * 18 + Math.sin(t * 0.07) * 10;
        const driftY = Math.cos(t * 0.13) * 14 + Math.cos(t * 0.05) * 8;
        const mx = mouseCurrentRef.current.x * 38;
        const my = mouseCurrentRef.current.y * 26 + scrollYRef.current * -0.12;
        glowsRef.current.style.transform = `translate(${mx + driftX}px, ${my + driftY}px)`;
      }
      rafRef.current = requestAnimationFrame(animate);
    };
    const onMouseMove = (e) => {
      mouseTargetRef.current.x = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseTargetRef.current.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    const onScroll = (e) => { scrollYRef.current = e.target.scrollTop; };
    rafRef.current = requestAnimationFrame(animate);
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    const scrollEl = document.querySelector('.hub-scroll');
    scrollEl?.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('mousemove', onMouseMove);
      scrollEl?.removeEventListener('scroll', onScroll);
    };
  }, []);

  const loadSavedSetups = async () => {
    if (!auth.currentUser) return;
    try {
      setLoading(true);
      const setupsRef = collection(db, 'setups');
      const q = query(
        setupsRef,
        where('ownerId', '==', auth.currentUser.uid),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const setups = [];
      querySnapshot.forEach((d) => {
        setups.push({ id: d.id, ...d.data() });
      });
      setSavedSetups(setups);
    } catch (error) {
      console.error('Error loading setups:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    if (!auth.currentUser) return;
    try {
      const uid = auth.currentUser.uid;

      // Fetch user doc for followers
      const userDoc = await getDoc(doc(db, 'users', uid));
      const userData = userDoc.exists() ? userDoc.data() : {};
      const followerCount = userData.followers?.length || 0;

      // Count sets posted by user
      let postCount = 0;
      try {
        const setsQuery = query(collection(db, 'sets'), where('creatorId', '==', uid));
        const setsSnap = await getCountFromServer(setsQuery);
        postCount = setsSnap.data().count;
      } catch {
        // fallback: sets collection might not exist yet
      }

      // Count setups
      let setupCount = 0;
      try {
        const setupsQuery = query(collection(db, 'setups'), where('ownerId', '==', uid));
        const setupsSnap = await getCountFromServer(setupsQuery);
        setupCount = setupsSnap.data().count;
      } catch {
        // fallback
      }

      setStats({ setups: setupCount, posts: postCount, followers: followerCount });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp?.toDate) return '';
    const d = timestamp.toDate();
    const now = new Date();
    const diff = now - d;
    if (diff < 86400000) return 'Today';
    if (diff < 172800000) return 'Yesterday';
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    return d.toLocaleDateString();
  };

  const handleDeleteSetup = async (e, setup) => {
    e.stopPropagation();
    if (!auth.currentUser || setup.ownerId !== auth.currentUser.uid) return;
    if (!window.confirm(`Delete "${setup.name || 'Untitled Setup'}"? This can't be undone.`)) return;
    try {
      await deleteDoc(doc(db, 'setups', setup.id));
      setSavedSetups((prev) => prev.filter((s) => s.id !== setup.id));
      setStats((prev) => ({ ...prev, setups: Math.max(0, prev.setups - 1) }));
    } catch (err) {
      console.error('Error deleting setup:', err);
      toast.error('Failed to delete setup. Please try again.');
    }
  };

  const setupTypeIcons = {
    DJ: <MdHeadphones size={16} />,
    Producer: <MdPiano size={16} />,
    Musician: <IoMusicalNotes size={16} />
  };

  return (
    <div className="hub-page" data-hub-theme="dark">
      {/* Background */}
      <div className="hub-grid-bg" aria-hidden="true">
        <svg className="hub-waves-svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
          {wavePaths.map((wave, i) => (
            <path
              key={i}
              d={wave.d}
              fill="none"
              stroke={`rgba(${wave.color},${wave.opacity})`}
              strokeWidth={wave.sw}
              strokeDasharray={wave.da}
              style={{
                animation: `${wave.rev ? 'hub-wave-flow-rev' : 'hub-wave-flow-fwd'} ${wave.dur} linear infinite`,
                animationDelay: wave.delay,
              }}
            />
          ))}
        </svg>
        <div className="hub-glows-layer" ref={glowsRef}>
          <div className="hub-grid-glow hub-grid-glow-1" />
          <div className="hub-grid-glow hub-grid-glow-2" />
          <div className="hub-grid-glow hub-grid-glow-3" />
        </div>
        <div className="hub-waveform">
          {[38,62,48,80,55,92,42,72,60,85,50,76,44,96,54,32,68,58,83,42,70,58,45,88].map((h, i) => (
            <div
              key={i}
              className="hub-waveform-bar"
              style={{ '--bar-h': `${h}%`, animationDelay: `${((i * 0.17) % 2.4).toFixed(2)}s` }}
            />
          ))}
        </div>
        <div className="hub-grid-fade" />
      </div>

      <div className="hub-scroll">
        {/* Hero */}
        <section className="hub-hero">
          <img
            src={'/liveset-logo-dark.png'}
            alt="LiveSet"
            className="hub-logo"
          />
          <p className="hub-tagline">Design your rig. Share your sound.</p>

          {/* Setup type cards */}
          <div className="hub-build-cards">
            {SETUP_TYPES.map(({ type, icon, blurb, accent, accentRgb, eqBars }) => (
              <button
                key={type}
                className="hub-build-card"
                onClick={() => onNewSetup && onNewSetup(type)}
                style={{ '--card-accent': accent, '--card-accent-rgb': accentRgb }}
              >
                <div className="hub-build-card-icon">{icon}</div>
                <span className="hub-build-card-type">{type}</span>
                <span className="hub-build-card-blurb">{blurb}</span>
                <span className="hub-build-card-cta">
                  Start building <MdArrowForward size={14} />
                </span>
                <div className="hub-card-eq" aria-hidden="true">
                  {eqBars.map((h, i) => (
                    <div
                      key={i}
                      className="hub-card-eq-bar"
                      style={{ '--eq-h': `${h}%`, animationDelay: `${(i * 0.22).toFixed(2)}s` }}
                    />
                  ))}
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Quick stats */}
        <section className="hub-stats">
          <div className="hub-stat">
            <span className="hub-stat-value">{stats.setups}</span>
            <span className="hub-stat-label">Setups</span>
          </div>
          <div className="hub-stat-divider" />
          <div className="hub-stat">
            <span className="hub-stat-value">{stats.posts}</span>
            <span className="hub-stat-label">Posts</span>
          </div>
          <div className="hub-stat-divider" />
          <div className="hub-stat">
            <span className="hub-stat-value">{stats.followers}</span>
            <span className="hub-stat-label">Followers</span>
          </div>
        </section>

        {/* Action row: Post + Feed side by side */}
        <div className="hub-action-row">
          {/* Share your performance banner */}
          <section className="hub-post-banner" onClick={() => setShowPostSetModal(true)}>
            <div className="hub-post-banner-bg" aria-hidden="true" />
            <div className="hub-post-banner-content">
              <div className="hub-post-banner-icon">
                <MdVideocam size={24} />
              </div>
              <div className="hub-post-banner-text">
                <h3 className="hub-post-banner-title">Share your performance</h3>
                <p className="hub-post-banner-desc">Upload a video and link it to your gear</p>
              </div>
              <span className="hub-post-banner-cta">
                Post my set <MdArrowForward size={14} />
              </span>
            </div>
          </section>

          {/* Discover feed */}
          {onFeedClick && (
            <button type="button" className="hub-feed-card" onClick={onFeedClick}>
              <div className="hub-feed-card-icon">
                <MdPlayCircleOutline size={24} />
              </div>
              <div className="hub-feed-card-text">
                <span className="hub-feed-card-title">Discover Feed</span>
                <span className="hub-feed-card-desc">Watch sets from creators</span>
              </div>
              <MdArrowForward size={16} className="hub-feed-card-arrow" />
            </button>
          )}
        </div>

        {/* Recent setups */}
        {(loading || savedSetups.length > 0) && (
          <section className="hub-section">
            <div className="hub-section-head">
              <h2 className="hub-section-title">Recent setups</h2>
              {savedSetups.length > 0 && (
                <span className="hub-section-count">{savedSetups.length}</span>
              )}
            </div>

            {loading ? (
              <div className="hub-loading">
                <div className="hub-spinner" />
              </div>
            ) : (
              <div className="hub-setups-row">
                {savedSetups.slice(0, 6).map((setup) => (
                  <div key={setup.id} className="hub-setup-card-wrap">
                    <button
                      type="button"
                      className="hub-setup-card"
                      onClick={() => onSetupSelect && onSetupSelect(setup)}
                    >
                      <div className="hub-setup-card-top">
                        <span className="hub-setup-badge">
                          {setupTypeIcons[setup.setupType || 'DJ']}
                          {setup.setupType || 'DJ'}
                        </span>
                        <span className="hub-setup-date">{formatDate(setup.createdAt)}</span>
                      </div>
                      <span className="hub-setup-name">{setup.name || 'Untitled Setup'}</span>
                      <span className="hub-setup-meta">{setup.devices?.length || 0} devices</span>
                    </button>
                    <button
                      type="button"
                      className="hub-setup-delete"
                      onClick={(e) => handleDeleteSetup(e, setup)}
                      title="Delete setup"
                      aria-label="Delete setup"
                    >
                      <MdDelete size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Admin-only: import products */}
        {onAddProducts && auth.currentUser?.email === ADMIN_EMAIL && (
          <button
            type="button"
            className="hub-feed-card"
            onClick={onAddProducts}
            style={{ marginTop: 8, borderColor: 'rgba(99, 102, 241, 0.2)' }}
          >
            <div className="hub-feed-card-icon" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8' }}>
              <MdArrowForward size={20} />
            </div>
            <div className="hub-feed-card-text">
              <span className="hub-feed-card-title">Product Importer</span>
              <span className="hub-feed-card-desc">Scan Storage & import new 3D models</span>
            </div>
          </button>
        )}
      </div>

      {showPostSetModal && (
        <PostSetModal
          onClose={() => setShowPostSetModal(false)}
          onSuccess={() => setShowPostSetModal(false)}
          theme={theme}
        />
      )}
    </div>
  );
}

export default HubLandingPage;
