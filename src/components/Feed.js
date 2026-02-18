import React, { useState, useEffect, useRef } from 'react';
import { collection, getDocs, query, orderBy, limit, startAfter, doc, getDoc, updateDoc, increment } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import { getStorage, ref, getDownloadURL } from 'firebase/storage';
import './Feed.css';

function Feed({ onProfileClick, onUploadClick }) {
  const [clips, setClips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastDoc, setLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [likedClips, setLikedClips] = useState(new Set());
  const [videoErrors, setVideoErrors] = useState(new Set());
  const feedRef = useRef(null);
  const videoRefs = useRef({});
  const storage = getStorage();

  useEffect(() => {
    loadClips();
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
    } catch (error) {
      console.error('Error loading clips:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async (clipId) => {
    if (!auth.currentUser) return;
    const isLiked = likedClips.has(clipId);
    const newLiked = new Set(likedClips);
    if (isLiked) {
      newLiked.delete(clipId);
    } else {
      newLiked.add(clipId);
    }
    setLikedClips(newLiked);
    try {
      const clipRef = doc(db, 'clips', clipId);
      await updateDoc(clipRef, {
        likes: increment(isLiked ? -1 : 1)
      });
    } catch (error) {
      console.error('Error updating like:', error);
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
        <h1>Clips</h1>
        <button className="feed-upload-btn" onClick={onUploadClick}>
          Upload Set
        </button>
      </div>
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
            <div className="feed-video-wrapper">
              {videoErrors.has(clip.id) ? (
                <div className="feed-video-placeholder">Video unavailable</div>
              ) : clip.videoURL ? (
                <video
                  ref={el => { videoRefs.current[index] = el; }}
                  src={clip.videoURL}
                  className="feed-video"
                  muted={index !== currentIndex}
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
                      className={`feed-action-btn ${likedClips.has(clip.id) ? 'liked' : ''}`}
                      onClick={() => handleLike(clip.id)}
                    >
                      ❤️ {clip.likes || 0}
                    </button>
                    <button className="feed-action-btn">💬</button>
                    <button className="feed-action-btn">📤</button>
                  </div>
                </div>
              </div>
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
