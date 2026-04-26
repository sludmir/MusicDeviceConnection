import React, { useState, useEffect, useRef, useCallback } from 'react';
import { collection, getDocs, query, orderBy, limit, startAfter, doc, getDoc, updateDoc, increment, arrayUnion, arrayRemove, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import { FaHeart, FaRegHeart } from 'react-icons/fa';
import { MdComment, MdShare, MdMoreVert, MdPlayCircleOutline, MdDelete, MdPlayArrow, MdClose, MdOndemandVideo, MdGraphicEq } from 'react-icons/md';
import './Feed.css';

const PRELOAD_WINDOW = 2;
const AUDIO_DRIFT_THRESHOLD = 0.3;
const DEBUG_FEED_AUDIO = process.env.NODE_ENV !== 'production';

function toFiniteNumberOr(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getClipAudioTrackURL(clip) {
  if (!clip) return null;
  if (typeof clip.audioTrackURL !== 'string') return null;
  const trimmed = clip.audioTrackURL.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function Feed({ onProfileClick, onUploadClick, onCopySetup, theme = 'light' }) {
  const [clips, setClips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastDoc, setLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [likedClips, setLikedClips] = useState(new Set());
  const [videoErrors, setVideoErrors] = useState(new Set());
  const [clipToDelete, setClipToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [pausedOverlay, setPausedOverlay] = useState(null);
  const [fullSetClip, setFullSetClip] = useState(null);
  const [failedExternalAudioClipIds, setFailedExternalAudioClipIds] = useState(() => new Set());
  const feedRef = useRef(null);
  const videoRefs = useRef({});
  const feedAudioRef = useRef(null);
  const pauseTimerRef = useRef(null);
  const fullSetVideoRef = useRef(null);
  const currentUserId = auth.currentUser?.uid;

  useEffect(() => {
    loadClips();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const ref = pauseTimerRef;
    return () => {
      if (ref.current) clearTimeout(ref.current);
    };
  }, []);

  const logAudioDebug = useCallback((event, payload = {}) => {
    if (!DEBUG_FEED_AUDIO) return;
    console.debug('[FeedAudio]', event, payload);
  }, []);

  // ── Scroll-based autoplay ──────────────────────────────────────────

  useEffect(() => {
    const container = feedRef.current;
    if (!container || !clips.length) return;

    const updateActiveVideo = (index) => {
      if (index === currentIndex || index < 0 || index >= clips.length) return;
      setCurrentIndex(index);
      setPausedOverlay(null);
      if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
      const clip = clips[index];
      const start = toFiniteNumberOr(clip?.clipStart, 0);
      Object.values(videoRefs.current).forEach((vid, idx) => {
        if (!vid) return;
        if (idx !== index) {
          vid.pause();
        } else {
          vid.currentTime = start;
          vid.play().catch(() => {});
        }
      });
    };

    const handleScroll = () => {
      const h = container.clientHeight;
      if (!h) return;
      const scrollTop = container.scrollTop;
      const newIndex = Math.round(scrollTop / h);
      const clamped = Math.max(0, Math.min(newIndex, clips.length - 1));
      if (clamped !== currentIndex) updateActiveVideo(clamped);
    };

    const snapToNearest = () => {
      const h = container.clientHeight;
      if (!h) return;
      const scrollTop = container.scrollTop;
      const index = Math.round(scrollTop / h);
      const clamped = Math.max(0, Math.min(index, clips.length - 1));
      const targetScroll = clamped * h;
      if (Math.abs(container.scrollTop - targetScroll) > 2) {
        container.scrollTo({ top: targetScroll, behavior: 'smooth' });
      }
      if (clamped !== currentIndex) updateActiveVideo(clamped);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    container.addEventListener('scrollend', snapToNearest);
    container.addEventListener('touchend', snapToNearest);

    let scrollEndTimer;
    const onScrollEnd = () => {
      clearTimeout(scrollEndTimer);
      scrollEndTimer = setTimeout(snapToNearest, 100);
    };
    container.addEventListener('scroll', onScrollEnd);

    return () => {
      container.removeEventListener('scroll', handleScroll);
      container.removeEventListener('scrollend', snapToNearest);
      container.removeEventListener('touchend', snapToNearest);
      container.removeEventListener('scroll', onScrollEnd);
      clearTimeout(scrollEndTimer);
    };
  }, [currentIndex, clips.length, clips]);

  // ── Clip segment loop ─────────────────────────────────────────────

  const setupClipSegmentLoop = useCallback((videoEl, clip) => {
    if (!videoEl || !clip?.videoURL) return () => {};
    const start = toFiniteNumberOr(clip.clipStart, 0);
    const end = toFiniteNumberOr(clip.clipEnd, 0);
    const useSegment = end > start && end - start > 0;

    let rafId = null;

    const checkLoop = () => {
      if (!useSegment) return;
      const endSec = end > 0 ? end : (videoEl.duration || 0);
      if (videoEl.duration && videoEl.currentTime >= endSec - 0.05) {
        videoEl.currentTime = start;
        if (videoEl.paused) videoEl.play().catch(() => {});
      }
    };

    const onTimeUpdate = () => checkLoop();

    const tick = () => {
      checkLoop();
      rafId = requestAnimationFrame(tick);
    };

    const onPlay = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(tick);
    };
    const onPause = () => {
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    };

    const onLoadedMetadata = () => {
      videoEl.currentTime = start;
    };

    videoEl.addEventListener('timeupdate', onTimeUpdate);
    videoEl.addEventListener('loadedmetadata', onLoadedMetadata);
    videoEl.addEventListener('play', onPlay);
    videoEl.addEventListener('pause', onPause);
    if (videoEl.readyState >= 1) videoEl.currentTime = start;
    if (!videoEl.paused) { rafId = requestAnimationFrame(tick); }

    return () => {
      videoEl.removeEventListener('timeupdate', onTimeUpdate);
      videoEl.removeEventListener('loadedmetadata', onLoadedMetadata);
      videoEl.removeEventListener('play', onPlay);
      videoEl.removeEventListener('pause', onPause);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  useEffect(() => {
    const vid = videoRefs.current[currentIndex];
    const clip = clips[currentIndex];
    if (!vid || !clip) return;
    return setupClipSegmentLoop(vid, clip);
  }, [currentIndex, clips, setupClipSegmentLoop]);

  // ── Audio sync (drift-tolerant) ───────────────────────────────────

  useEffect(() => {
    const vid = videoRefs.current[currentIndex];
    const clip = clips[currentIndex];
    const audioEl = feedAudioRef.current;
    const audioTrackURL = getClipAudioTrackURL(clip);
    if (!audioTrackURL || !audioEl) {
      if (audioEl) {
        logAudioDebug('noExternalTrack-usingVideoAudio', {
          clipId: clip?.id || null,
          hasAudioTrackURLField: Boolean(clip?.audioTrackURL),
          normalizedAudioTrackURL: audioTrackURL
        });
        audioEl.pause();
        audioEl.removeAttribute('src');
      }
      return () => {};
    }

    const start = toFiniteNumberOr(clip.clipStart, 0);
    const offset = Number(clip.audioOffsetSeconds) || 0;
    const targetTime = start + offset;
    const safePlayAudio = (audioNode, context) => {
      if (!audioNode) return;
      audioNode.play().catch((err) => {
        logAudioDebug('externalAudioPlayRejected', {
          clipId: clip?.id || null,
          context,
          name: err?.name,
          message: err?.message
        });
      });
    };

    const syncAudio = () => {
      const a = feedAudioRef.current;
      if (!a || !vid) return;
      const expected = vid.currentTime + offset;
      const drift = Math.abs(a.currentTime - expected);
      if (drift > AUDIO_DRIFT_THRESHOLD) {
        a.currentTime = expected;
      }
    };

    const onPlay = () => {
      const a = feedAudioRef.current;
      if (a && vid) {
        a.currentTime = vid.currentTime + offset;
        safePlayAudio(a, 'video-play-event');
      }
    };

    const onPause = () => {
      const a = feedAudioRef.current;
      if (a) a.pause();
    };

    const onTimeUpdate = syncAudio;

    const onAudioReady = () => {
      const a = feedAudioRef.current;
      if (!a) return;
      const sameSrc = a.src === audioTrackURL;
      if (!sameSrc && DEBUG_FEED_AUDIO) {
        console.debug('[FeedAudio] externalAudioSrcMismatch', {
          clipId: clip?.id || null,
          audioElementSrc: a.src,
          expectedAudioTrackURL: audioTrackURL
        });
      }
      a.currentTime = targetTime;
      if (vid && !vid.paused) {
        a.currentTime = vid.currentTime + offset;
        safePlayAudio(a, 'audio-ready');
      }
    };

    const onAudioError = () => {
      logAudioDebug('externalAudioLoadError-fallingBackToVideoAudio', {
        clipId: clip?.id || null,
        audioTrackURL
      });
      setFailedExternalAudioClipIds((prev) => {
        const next = new Set(prev);
        if (clip?.id) next.add(clip.id);
        return next;
      });
    };

    const needNewSrc = audioEl.src !== audioTrackURL;
    if (needNewSrc) {
      audioEl.src = audioTrackURL;
      audioEl.addEventListener('loadedmetadata', onAudioReady, { once: true });
      audioEl.addEventListener('canplay', onAudioReady, { once: true });
      audioEl.addEventListener('error', onAudioError, { once: true });
    } else {
      audioEl.currentTime = targetTime;
      if (vid && !vid.paused) {
        audioEl.currentTime = vid.currentTime + offset;
        safePlayAudio(audioEl, 'same-src-resume');
      }
    }

    vid.addEventListener('play', onPlay);
    vid.addEventListener('pause', onPause);
    vid.addEventListener('timeupdate', onTimeUpdate);
    if (!vid.paused) {
      syncAudio();
      safePlayAudio(audioEl, 'effect-initial-sync');
    }

    return () => {
      vid.removeEventListener('play', onPlay);
      vid.removeEventListener('pause', onPause);
      vid.removeEventListener('timeupdate', onTimeUpdate);
      audioEl.removeEventListener('loadedmetadata', onAudioReady);
      audioEl.removeEventListener('canplay', onAudioReady);
      audioEl.removeEventListener('error', onAudioError);
      audioEl.pause();
    };
  }, [currentIndex, clips, logAudioDebug]);

  // ── Data loading ──────────────────────────────────────────────────

  const loadClips = async () => {
    if (!auth.currentUser) return;
    try {
      setLoading(true);
      const userId = auth.currentUser.uid;
      
      let following = [];
      try {
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          following = userSnap.data().following || [];
        }
      } catch (err) {
        console.log('No user profile found, showing all clips');
      }

      const clipsRef = collection(db, 'clips');
      let q = query(clipsRef, orderBy('createdAt', 'desc'), limit(20));
      if (lastDoc) q = query(clipsRef, orderBy('createdAt', 'desc'), startAfter(lastDoc), limit(20));
      
      const snapshot = await getDocs(q);
      const allClips = [];
      snapshot.forEach((docSnap) => {
        const raw = docSnap.data();
        const normalizedTrackUrl = getClipAudioTrackURL(raw);
        allClips.push({
          id: docSnap.id,
          ...raw,
          audioTrackURL: normalizedTrackUrl
        });
      });

      const clipsFromSets = allClips.filter((clip) => clip.fullSetId);
      const followedClips = clipsFromSets.filter(clip => following.includes(clip.creatorId));
      const suggestedClips = clipsFromSets.filter(clip => !following.includes(clip.creatorId));
      const sortedClips = [...followedClips, ...suggestedClips].slice(0, 10);

      if (sortedClips.length < 10) setHasMore(false);
      if (snapshot.docs.length > 0) setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
      setClips(prev => [...prev, ...sortedClips]);
      if (DEBUG_FEED_AUDIO && sortedClips.length > 0) {
        console.debug('[FeedAudio] loadedClipAudioFields', sortedClips.slice(0, 5).map((clip) => ({
          id: clip.id,
          hasFullSetId: Boolean(clip.fullSetId),
          hasAudioTrackURL: Boolean(getClipAudioTrackURL(clip)),
          clipStart: clip.clipStart,
          clipEnd: clip.clipEnd
        })));
      }
      setLikedClips(prev => {
        const next = new Set(prev);
        sortedClips.forEach(c => {
          if (c.likedBy && Array.isArray(c.likedBy) && c.likedBy.includes(userId)) next.add(c.id);
        });
        return next;
      });
    } catch (error) {
      console.error('Error loading clips:', error);
    } finally {
      setLoading(false);
    }
  };

  // ── Interactions ──────────────────────────────────────────────────

  const handleLike = async (clipId) => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    const isLiked = likedClips.has(clipId);
    if (!isLiked) {
      const clip = clips.find(c => c.id === clipId);
      if (clip?.likedBy && clip.likedBy.includes(uid)) return;
    }
    const newLiked = new Set(likedClips);
    if (isLiked) {
      newLiked.delete(clipId);
    } else {
      newLiked.add(clipId);
    }
    setLikedClips(newLiked);
    setClips(prev => prev.map(c => {
      if (c.id !== clipId) return c;
      const currentLikes = c.likes ?? 0;
      const newLikes = isLiked ? currentLikes - 1 : currentLikes + 1;
      const currentLikedBy = c.likedBy || [];
      const newLikedBy = isLiked ? currentLikedBy.filter(id => id !== uid) : [...currentLikedBy, uid];
      return { ...c, likes: Math.max(0, newLikes), likedBy: newLikedBy };
    }));
    try {
      const clipRef = doc(db, 'clips', clipId);
      await updateDoc(clipRef, {
        likedBy: isLiked ? arrayRemove(uid) : arrayUnion(uid),
        likes: increment(isLiked ? -1 : 1)
      });
    } catch (error) {
      console.error('Error updating like:', error);
      setLikedClips(likedClips);
      setClips(prev => prev.map(c => c.id === clipId ? { ...c, likes: c.likes ?? 0, likedBy: c.likedBy || [] } : c));
    }
  };

  const handleProfileClick = async (userId) => {
    if (onProfileClick) onProfileClick(userId);
  };

  const handleVideoClick = (index) => {
    const v = videoRefs.current[index];
    if (!v) return;
    if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);

    if (v.paused) {
      v.muted = false;
      v.volume = 1;
      v.play().catch((err) => {
        logAudioDebug('videoPlayRejected-onUserClick', {
          clipId: clips[index]?.id || null,
          name: err?.name,
          message: err?.message
        });
      });
      setPausedOverlay(null);
    } else {
      v.pause();
      setPausedOverlay(index);
    }
  };

  const handleCopySetup = (clip) => {
    if (!clip.setupId || !onCopySetup) return;
    onCopySetup(clip.setupId);
  };

  const handleWatchFullSet = (clip) => {
    if (!clip.fullSetId) return;
    const v = videoRefs.current[currentIndex];
    if (v && !v.paused) v.pause();
    if (feedAudioRef.current) feedAudioRef.current.pause();
    setFullSetClip(clip);
  };

  const closeFullSetModal = () => {
    if (fullSetVideoRef.current) {
      fullSetVideoRef.current.pause();
      fullSetVideoRef.current.removeAttribute('src');
      fullSetVideoRef.current.load();
    }
    setFullSetClip(null);
    const v = videoRefs.current[currentIndex];
    if (v) v.play().catch(() => {});
  };

  const handleDeleteClick = (e, clip) => {
    e.stopPropagation();
    if (currentUserId && clip.creatorId === currentUserId) {
      setClipToDelete(clip);
    }
  };

  const handleConfirmDelete = async () => {
    if (!clipToDelete || !currentUserId || clipToDelete.creatorId !== currentUserId) {
      setClipToDelete(null);
      return;
    }
    setDeleting(true);
    try {
      await deleteDoc(doc(db, 'clips', clipToDelete.id));
      const idx = clips.findIndex((c) => c.id === clipToDelete.id);
      setClips((prev) => prev.filter((c) => c.id !== clipToDelete.id));
      setLikedClips((prev) => { const next = new Set(prev); next.delete(clipToDelete.id); return next; });
      setVideoErrors((prev) => { const next = new Set(prev); next.delete(clipToDelete.id); return next; });
      const newLength = clips.length - 1;
      if (newLength > 0 && idx >= 0) {
        const newIndex = idx <= currentIndex ? Math.max(0, currentIndex - 1) : currentIndex;
        setCurrentIndex(Math.min(newIndex, newLength - 1));
      } else {
        setCurrentIndex(0);
      }
    } catch (err) {
      console.error('Error deleting clip:', err);
    } finally {
      setDeleting(false);
      setClipToDelete(null);
    }
  };

  const handleCancelDelete = () => {
    setClipToDelete(null);
  };

  // ── Render helpers ────────────────────────────────────────────────

  const renderCopySetupBtn = (clip, variant = 'overlay') => {
    if (!clip.setupId) return null;
    const setupLabel = (clip.setupName || '').trim() || 'Linked Setup';
    const cls = variant === 'overlay' ? 'feed-action-btn' : 'feed-action-btn feed-action-btn-row';
    return (
      <button
        type="button"
        className={cls}
        onClick={(e) => { e.stopPropagation(); handleCopySetup(clip); }}
        aria-label={`Open setup: ${setupLabel}`}
        title={`Open setup: ${setupLabel}`}
      >
        <span className="feed-action-icon"><MdGraphicEq size={20} /></span>
        <span>{variant === 'row' ? setupLabel : ''}</span>
      </button>
    );
  };

  const renderFullSetBtn = (clip, variant = 'overlay') => {
    if (!clip.fullSetId) return null;
    const cls = variant === 'overlay' ? 'feed-action-btn' : 'feed-action-btn feed-action-btn-row';
    return (
      <button
        type="button"
        className={cls}
        onClick={(e) => { e.stopPropagation(); handleWatchFullSet(clip); }}
        aria-label="Watch full set"
        title="Watch the full LiveSet"
      >
        <span className="feed-action-icon"><MdOndemandVideo size={20} /></span>
        <span>{variant === 'row' ? 'Full Set' : ''}</span>
      </button>
    );
  };

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div className="feed-container">
      <button className="feed-upload-fab" onClick={onUploadClick} aria-label="Upload Set" title="Upload Set">
        +
      </button>
      <audio ref={feedAudioRef} style={{ display: 'none' }} />
      <div className="feed-scroll" ref={feedRef}>
        {clips.length === 0 && !loading ? (
          <div className="feed-empty">
            <div className="feed-empty-icon"><MdPlayCircleOutline size={48} /></div>
            <h2>No clips yet</h2>
            <p>Be the first to upload a live set!</p>
            <button className="feed-upload-btn" onClick={onUploadClick}>
              Upload Your First Set
            </button>
          </div>
        ) : (
          clips.map((clip, index) => {
          const isNear = Math.abs(index - currentIndex) <= PRELOAD_WINDOW;
          const isCurrent = index === currentIndex;
          const hasExternalAudio = Boolean(getClipAudioTrackURL(clip));
          const externalAudioFailed = clip?.id ? failedExternalAudioClipIds.has(clip.id) : false;
          const shouldMuteVideo = !isCurrent || (hasExternalAudio && !externalAudioFailed);

          return (
          <div key={clip.id} className="feed-item">
            {/* Desktop: creator row above video */}
            <div className="feed-item-meta feed-item-meta-header">
              <div className="feed-meta-top">
                <div className="feed-creator-info" onClick={() => handleProfileClick(clip.creatorId)}>
                  <div className="feed-creator-avatar">
                    {clip.creatorName?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <div>
                    <div className="feed-creator-name">{clip.creatorName || 'Unknown'}</div>
                    <div className="feed-clip-title">{clip.title || 'Untitled'}</div>
                  </div>
                </div>
                <div className="feed-header-actions">
                  {currentUserId && clip.creatorId === currentUserId && (
                    <button
                      type="button"
                      className="feed-delete-clip-btn"
                      onClick={(e) => handleDeleteClick(e, clip)}
                      aria-label="Delete clip"
                      title="Delete this clip from the feed"
                    >
                      <MdDelete size={20} />
                    </button>
                  )}
                  <button type="button" className="feed-more-btn" aria-label="More options"><MdMoreVert size={20} /></button>
                </div>
              </div>
            </div>

            {/* Video */}
            <div
              className="feed-video-wrapper"
              onClick={() => handleVideoClick(index)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleVideoClick(index); } }}
              aria-label="Toggle play / pause"
            >
              {videoErrors.has(clip.id) ? (
                <div className="feed-video-placeholder">Video unavailable</div>
              ) : clip.videoURL ? (
                <video
                  ref={el => { videoRefs.current[index] = el; }}
                  src={isNear ? clip.videoURL : undefined}
                  className="feed-video"
                  preload={isCurrent || Math.abs(index - currentIndex) <= 1 ? 'auto' : 'metadata'}
                  muted={shouldMuteVideo}
                  playsInline
                  onLoadedMetadata={(e) => {
                    const v = e.target;
                    const start = toFiniteNumberOr(clip.clipStart, 0);
                    const end = toFiniteNumberOr(clip.clipEnd, 0);
                    if (end > start) v.currentTime = start;
                  }}
                  onCanPlay={(e) => {
                    if (isCurrent && e.target.paused && pausedOverlay !== index) {
                      e.target.play().catch((err) => {
                        logAudioDebug('videoPlayRejected-onCanPlay', {
                          clipId: clip?.id || null,
                          muted: e.target.muted,
                          hasExternalAudio,
                          externalAudioFailed,
                          name: err?.name,
                          message: err?.message
                        });
                      });
                    }
                  }}
                  onWaiting={() => {}}
                  onError={() => {
                    setVideoErrors(prev => new Set(prev).add(clip.id));
                  }}
                />
              ) : (
                <div className="feed-video-placeholder">Loading video...</div>
              )}

              {/* Ghost pause overlay */}
              {pausedOverlay === index && (
                <div className="feed-pause-overlay" key={`pause-${index}`}>
                  <div className="feed-pause-icon">
                    <MdPlayArrow size={64} />
                  </div>
                </div>
              )}

              {/* Mobile: overlay with creator + actions */}
              <div className="feed-item-overlay">
                <div className="feed-item-info">
                  <div className="feed-creator-info" onClick={(e) => { e.stopPropagation(); handleProfileClick(clip.creatorId); }}>
                    <div className="feed-creator-avatar">
                      {clip.creatorName?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <div>
                      <div className="feed-creator-name">{clip.creatorName || 'Unknown'}</div>
                      <div className="feed-clip-title">{clip.title || 'Untitled'}</div>
                    </div>
                  </div>
                  <div className="feed-actions">
                    {currentUserId && clip.creatorId === currentUserId && (
                      <button
                        type="button"
                        className="feed-action-btn feed-delete-clip-btn-overlay"
                        onClick={(e) => { e.stopPropagation(); handleDeleteClick(e, clip); }}
                        aria-label="Delete clip"
                        title="Delete this clip"
                      >
                        <span className="feed-action-icon"><MdDelete size={18} /></span>
                      </button>
                    )}
                    <button
                      type="button"
                      className={`feed-action-btn ${likedClips.has(clip.id) ? 'liked' : ''}`}
                      onClick={(e) => { e.stopPropagation(); handleLike(clip.id); }}
                      aria-label={likedClips.has(clip.id) ? 'Unlike' : 'Like'}
                    >
                      <span className="feed-action-icon">{likedClips.has(clip.id) ? <FaHeart size={18} /> : <FaRegHeart size={18} />}</span>
                      <span>{clip.likes || 0}</span>
                    </button>
                    {renderCopySetupBtn(clip, 'overlay')}
                    {renderFullSetBtn(clip, 'overlay')}
                    <button type="button" className="feed-action-btn" aria-label="Comment" onClick={(e) => e.stopPropagation()}><MdComment size={18} /></button>
                    <button type="button" className="feed-action-btn" aria-label="Share" onClick={(e) => e.stopPropagation()}><MdShare size={18} /></button>
                  </div>
                </div>
              </div>
            </div>

            {/* Desktop: actions + caption below video */}
            <div className="feed-item-meta feed-item-meta-footer">
              <div className="feed-actions-row">
                <button
                  type="button"
                  className={`feed-action-btn ${likedClips.has(clip.id) ? 'liked' : ''}`}
                  onClick={() => handleLike(clip.id)}
                  aria-label={likedClips.has(clip.id) ? 'Unlike' : 'Like'}
                >
                  <span className="feed-action-icon">{likedClips.has(clip.id) ? <FaHeart size={18} /> : <FaRegHeart size={18} />}</span>
                  <span>{clip.likes || 0}</span>
                </button>
                {renderCopySetupBtn(clip, 'row')}
                {renderFullSetBtn(clip, 'row')}
                <button type="button" className="feed-action-btn" aria-label="Comment">
                  <span className="feed-action-icon"><MdComment size={18} /></span>
                  <span>Comment</span>
                </button>
                <button type="button" className="feed-action-btn" aria-label="Share">
                  <span className="feed-action-icon"><MdShare size={18} /></span>
                  <span>Share</span>
                </button>
              </div>
              <p className="feed-caption">
                <span className="feed-creator-name-inline">{clip.creatorName || 'Unknown'}</span>
                {clip.title || 'Untitled'}
                {clip.setupId && <span className="feed-caption-badge">🎛️ Setup linked</span>}
              </p>
            </div>
          </div>
          );
          })
        )}
        {loading && <div className="feed-loading">Loading...</div>}
        {hasMore && !loading && (
          <div className="feed-load-more">
            <button onClick={loadClips}>Load More</button>
          </div>
        )}
      </div>

      {/* Full Set Modal */}
      {fullSetClip && (
        <div className="feed-fullset-overlay" onClick={closeFullSetModal}>
          <div className="feed-fullset-modal" onClick={(e) => e.stopPropagation()}>
            <div className="feed-fullset-header">
              <div className="feed-fullset-info">
                <div
                  className="feed-creator-info"
                  onClick={() => { closeFullSetModal(); handleProfileClick(fullSetClip.creatorId); }}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="feed-creator-avatar feed-creator-avatar-sm">
                    {fullSetClip.creatorName?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <div>
                    <div className="feed-creator-name">{fullSetClip.creatorName || 'Unknown'}</div>
                    <div className="feed-clip-title">{fullSetClip.title || 'Full LiveSet'}</div>
                  </div>
                </div>
              </div>
              <button type="button" className="feed-fullset-close" onClick={closeFullSetModal} aria-label="Close">
                <MdClose size={24} />
              </button>
            </div>
            <div className="feed-fullset-video-wrap">
              <video
                ref={fullSetVideoRef}
                src={fullSetClip.fullVideoURL || fullSetClip.videoURL}
                className="feed-fullset-video"
                controls
                autoPlay
                playsInline
                preload="auto"
              />
            </div>
          </div>
        </div>
      )}

      {/* Delete clip confirm */}
      {clipToDelete && (
        <div className="feed-delete-overlay" onClick={handleCancelDelete}>
          <div className="feed-delete-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="feed-delete-title">Delete this clip?</h3>
            <p className="feed-delete-message">
              This clip will be removed from the feed. Your full set will stay on your profile.
            </p>
            <div className="feed-delete-actions">
              <button type="button" className="feed-delete-cancel" onClick={handleCancelDelete} disabled={deleting}>
                Cancel
              </button>
              <button type="button" className="feed-delete-confirm" onClick={handleConfirmDelete} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Feed;
