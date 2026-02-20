import React, { useState, useEffect, useRef } from 'react';
import { collection, getDocs, query, orderBy, limit, startAfter, doc, getDoc, updateDoc, increment, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
// import { getStorage, ref, getDownloadURL } from 'firebase/storage'; // Unused imports
import './Feed.css';

function Feed({ onProfileClick, onUploadClick, theme = 'light' }) {
  const [clips, setClips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastDoc, setLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [likedClips, setLikedClips] = useState(new Set());
  const [videoErrors, setVideoErrors] = useState(new Set());
  const feedRef = useRef(null);
  const videoRefs = useRef({});
  const feedAudioRef = useRef(null);
  // const storage = getStorage(); // Unused

  useEffect(() => {
    loadClips();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- loadClips only runs on mount
  }, []);

  useEffect(() => {
    const container = feedRef.current;
    if (!container || !clips.length) return;

    const updateActiveVideo = (index) => {
      if (index === currentIndex || index < 0 || index >= clips.length) return;
      setCurrentIndex(index);
      const clip = clips[index];
      const start = Number(clip?.clipStart) ?? 0;
      Object.values(videoRefs.current).forEach((vid, idx) => {
        if (vid) {
          if (idx !== index) vid.pause();
          else {
            vid.currentTime = start;
            vid.play().catch(() => {});
          }
        }
      });
    }

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

  const setupClipSegmentLoop = (videoEl, clip) => {
    if (!videoEl || !clip?.videoURL) return () => {};
    const start = Number(clip.clipStart) ?? 0;
    const end = Number(clip.clipEnd) ?? 0;
    const useSegment = end > start && end - start > 0;

    const onTimeUpdate = () => {
      if (!useSegment) return;
      const endSec = end > 0 ? end : (videoEl.duration || 0);
      if (videoEl.duration && videoEl.currentTime >= endSec - 0.15) {
        videoEl.currentTime = start;
      }
    };
    const onLoadedMetadata = () => {
      videoEl.currentTime = start;
    };

    videoEl.addEventListener('timeupdate', onTimeUpdate);
    videoEl.addEventListener('loadedmetadata', onLoadedMetadata);
    if (videoEl.readyState >= 1) videoEl.currentTime = start;

    return () => {
      videoEl.removeEventListener('timeupdate', onTimeUpdate);
      videoEl.removeEventListener('loadedmetadata', onLoadedMetadata);
    };
  };

  useEffect(() => {
    const vid = videoRefs.current[currentIndex];
    const clip = clips[currentIndex];
    if (!vid || !clip) return;
    const cleanup = setupClipSegmentLoop(vid, clip);
    return cleanup;
  }, [currentIndex, clips]);

  useEffect(() => {
    const vid = videoRefs.current[currentIndex];
    const clip = clips[currentIndex];
    const audioEl = feedAudioRef.current;
    if (!clip?.audioTrackURL || !audioEl) {
      if (audioEl) {
        audioEl.pause();
        audioEl.removeAttribute('src');
      }
      return () => {};
    }

    const start = Number(clip.clipStart) ?? 0;
    const offset = Number(clip.audioOffsetSeconds) || 0;

    audioEl.src = clip.audioTrackURL;
    audioEl.currentTime = start + offset;

    const onPlay = () => {
      const a = feedAudioRef.current;
      if (a && vid) {
        a.currentTime = vid.currentTime + offset;
        a.play().catch(() => {});
      }
    };
    const onTimeUpdate = () => {
      if (vid && feedAudioRef.current) {
        feedAudioRef.current.currentTime = vid.currentTime + offset;
      }
    };

    vid.addEventListener('play', onPlay);
    vid.addEventListener('timeupdate', onTimeUpdate);
    if (!vid.paused) {
      audioEl.currentTime = vid.currentTime + offset;
      audioEl.play().catch(() => {});
    }

    return () => {
      vid.removeEventListener('play', onPlay);
      vid.removeEventListener('timeupdate', onTimeUpdate);
      audioEl.pause();
      audioEl.removeAttribute('src');
    };
  }, [currentIndex, clips]);

  const loadClips = async () => {
    if (!auth.currentUser) return;
    try {
      setLoading(true);
      const userId = auth.currentUser.uid;
      
      // Get user's following list
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
        allClips.push({ id: docSnap.id, ...docSnap.data() });
      });

      // Prioritize clips from followed users
      const followedClips = allClips.filter(clip => following.includes(clip.creatorId));
      const suggestedClips = allClips.filter(clip => !following.includes(clip.creatorId));
      const sortedClips = [...followedClips, ...suggestedClips].slice(0, 10);

      if (sortedClips.length < 10) setHasMore(false);
      if (snapshot.docs.length > 0) setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
      setClips(prev => [...prev, ...sortedClips]);
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
    if (onProfileClick) {
      onProfileClick(userId);
    }
  };

  return (
    <div className="feed-container">
      <div className="feed-header">
        <div className="feed-header-brand">
          <img src={theme === 'dark' ? '/liveset-logo-dark.png' : '/liveset-logo.png'} alt="LiveSet" className="feed-header-logo" />
          <h1>Clips</h1>
        </div>
        <button className="feed-upload-btn" onClick={onUploadClick}>
          Upload Set
        </button>
      </div>
      <audio ref={feedAudioRef} style={{ display: 'none' }} />
      <div className="feed-scroll" ref={feedRef}>
        {clips.length === 0 && !loading ? (
          <div className="feed-empty">
            <div className="feed-empty-icon">📱</div>
            <h2>No clips yet</h2>
            <p>Be the first to upload a live set!</p>
            <button className="feed-upload-btn" onClick={onUploadClick}>
              Upload Your First Set
            </button>
          </div>
        ) : (
          clips.map((clip, index) => (
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
                    <div className="feed-clip-title">{clip.title || 'Untitled'} · Full set on profile</div>
                  </div>
                </div>
                <button type="button" className="feed-more-btn" aria-label="More options">⋯</button>
              </div>
            </div>
            <div className="feed-video-wrapper">
              {videoErrors.has(clip.id) ? (
                <div className="feed-video-placeholder">Video unavailable</div>
              ) : clip.videoURL ? (
                <video
                  ref={el => { videoRefs.current[index] = el; }}
                  src={clip.videoURL}
                  className="feed-video"
                  muted={index !== currentIndex || !!clip.audioTrackURL}
                  playsInline
                  onLoadedMetadata={(e) => {
                    const v = e.target;
                    const start = Number(clip.clipStart) ?? 0;
                    const end = Number(clip.clipEnd) ?? 0;
                    if (end > start) v.currentTime = start;
                    if (index === currentIndex) v.play().catch(() => {});
                  }}
                  onError={() => {
                    setVideoErrors(prev => new Set(prev).add(clip.id));
                  }}
                />
              ) : (
                <div className="feed-video-placeholder">Loading video...</div>
              )}
              {/* Mobile: overlay with creator + actions */}
              <div className="feed-item-overlay">
                <div className="feed-item-info">
                  <div className="feed-creator-info" onClick={() => handleProfileClick(clip.creatorId)}>
                    <div className="feed-creator-avatar">
                      {clip.creatorName?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <div>
                      <div className="feed-creator-name">{clip.creatorName || 'Unknown'}</div>
                      <div className="feed-clip-title">{clip.title || 'Untitled'} · Full set on profile</div>
                    </div>
                  </div>
                  <div className="feed-actions">
                    <button
                      type="button"
                      className={`feed-action-btn ${likedClips.has(clip.id) ? 'liked' : ''}`}
                      onClick={() => handleLike(clip.id)}
                      aria-label={likedClips.has(clip.id) ? 'Unlike' : 'Like'}
                    >
                      <span className="feed-action-icon">{likedClips.has(clip.id) ? '❤️' : '🤍'}</span>
                      <span>{clip.likes || 0}</span>
                    </button>
                    <button type="button" className="feed-action-btn" aria-label="Comment">💬</button>
                    <button type="button" className="feed-action-btn" aria-label="Share">📤</button>
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
                  <span className="feed-action-icon">{likedClips.has(clip.id) ? '❤️' : '🤍'}</span>
                  <span>{clip.likes || 0}</span>
                </button>
                <button type="button" className="feed-action-btn" aria-label="Comment">
                  <span className="feed-action-icon">💬</span>
                  <span>Comment</span>
                </button>
                <button type="button" className="feed-action-btn" aria-label="Share">
                  <span className="feed-action-icon">📤</span>
                  <span>Share</span>
                </button>
              </div>
              <p className="feed-caption">
                <span className="feed-creator-name-inline">{clip.creatorName || 'Unknown'}</span>
                {clip.title || 'Untitled'} · Full set on profile
              </p>
            </div>
          </div>
          ))
        )}
        {loading && <div className="feed-loading">Loading...</div>}
        {hasMore && !loading && (
          <div className="feed-load-more">
            <button onClick={loadClips}>Load More</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default Feed;
