import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MdClose, MdPlayArrow, MdPause, MdVolumeUp, MdVolumeOff, MdFullscreen, MdFullscreenExit, MdGraphicEq } from 'react-icons/md';
import { attachHls } from '../utils/attachHls';
import { getSignedBunnyUrls } from '../utils/bunnyUrl';
import './LiveSetPlayer.css';

// How far the overlaid audio track may drift from the video before we re-seek
// it. Re-seeking on every timeupdate causes audible stutter/relooping, so we
// only correct when the gap exceeds this.
const AUDIO_DRIFT_THRESHOLD = 0.25;

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

function LiveSetPlayer({ set, onClose, theme = 'light' }) {
  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const timelineRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [minimized, setMinimized] = useState(false);

  // Sign Bunny URLs (no-op for non-Bunny URLs). signed is null until
  // the cloud function returns; we hold off attaching HLS until then.
  const [signed, setSigned] = useState(null);
  useEffect(() => {
    if (!set?.id) { setSigned(null); return; }
    let cancelled = false;
    getSignedBunnyUrls('set', set.id)
      .then((urls) => { if (!cancelled) setSigned(urls); })
      .catch(() => {
        if (!cancelled) setSigned({
          videoURL: set.videoURL,
          audioTrackURL: set.audioTrackURL,
        });
      });
    return () => { cancelled = true; };
  }, [set?.id, set?.videoURL, set?.audioTrackURL]);

  const videoURL = signed?.videoURL;
  const audioTrackURL = signed?.audioTrackURL;
  const audioOffsetSeconds = Number(set?.audioOffsetSeconds) || 0;
  const audioReplacesVideo = audioTrackURL
    ? (set?.audioReplacesVideo !== false)
    : false;
  const title = set?.title || 'Live set';

  const isDark = theme === 'dark';

  const syncAudioToVideo = useCallback(() => {
    const v = videoRef.current;
    const a = audioRef.current;
    if (!a || !v || !audioTrackURL) return;
    a.currentTime = v.currentTime + audioOffsetSeconds;
  }, [audioTrackURL, audioOffsetSeconds]);

  useEffect(() => {
    if (!videoURL) return;
    setCurrentTime(0);
    setDuration(0);
    setLoaded(false);
    setPlaying(false);
  }, [videoURL]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !videoURL) return;
    return attachHls(v, videoURL);
  }, [videoURL]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTimeUpdate = () => setCurrentTime(v.currentTime);
    const onLoadedMetadata = () => {
      setDuration(v.duration);
      setLoaded(true);
    };
    const onDurationChange = () => setDuration(v.duration);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => setPlaying(false);
    v.addEventListener('timeupdate', onTimeUpdate);
    v.addEventListener('loadedmetadata', onLoadedMetadata);
    v.addEventListener('durationchange', onDurationChange);
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    v.addEventListener('ended', onEnded);
    return () => {
      v.removeEventListener('timeupdate', onTimeUpdate);
      v.removeEventListener('loadedmetadata', onLoadedMetadata);
      v.removeEventListener('durationchange', onDurationChange);
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
      v.removeEventListener('ended', onEnded);
    };
  }, [videoURL]);

  // Keep the overlaid audio track locked to the (muted) video. Crucially the
  // audio must pause when the video pauses and re-seek only on real seeks or
  // when it drifts — otherwise it keeps playing past a pause and stutters.
  useEffect(() => {
    const v = videoRef.current;
    const a = audioRef.current;
    if (!audioTrackURL || !a || !v) return;
    const resync = () => { a.currentTime = v.currentTime + audioOffsetSeconds; };
    const onPlay = () => { resync(); a.play().catch(() => {}); };
    const onPause = () => { a.pause(); };
    const onSeeked = () => { resync(); };
    const onEnded = () => { a.pause(); };
    const onTimeUpdate = () => {
      const expected = v.currentTime + audioOffsetSeconds;
      if (Math.abs(a.currentTime - expected) > AUDIO_DRIFT_THRESHOLD) {
        a.currentTime = expected;
      }
    };
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    v.addEventListener('seeked', onSeeked);
    v.addEventListener('ended', onEnded);
    v.addEventListener('timeupdate', onTimeUpdate);
    if (!v.paused) { resync(); a.play().catch(() => {}); }
    return () => {
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
      v.removeEventListener('seeked', onSeeked);
      v.removeEventListener('ended', onEnded);
      v.removeEventListener('timeupdate', onTimeUpdate);
      a.pause();
      a.removeAttribute('src');
    };
  }, [videoURL, audioTrackURL, audioOffsetSeconds]);

  // Esc shrinks the expanded view to the pip rather than closing it, so
  // playback isn't lost by accident. Use the ✕ to close fully.
  useEffect(() => {
    if (minimized) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setMinimized(true); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [minimized]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  };

  const toggleMuted = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };

  // Open this set's linked setup in the 3D builder, same action as the feed's
  // setup button. The player is mounted above the router, so AppRoutes handles
  // the load+navigate via this event; we shrink to the pip so it keeps playing.
  const handleViewSetup = () => {
    const setupId = set?.setupId;
    if (!setupId) return;
    setMinimized(true);
    window.dispatchEvent(new CustomEvent('liveset:view-setup', { detail: { setupId } }));
  };

  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;

  const TIMELINE_PAD = 8;

  const seekToClientX = (clientX) => {
    const bar = timelineRef.current;
    if (!bar || !duration) return;
    const rect = bar.getBoundingClientRect();
    const x = clientX - rect.left;
    const usable = rect.width - 2 * TIMELINE_PAD;
    const p = usable > 0 ? Math.max(0, Math.min(1, (x - TIMELINE_PAD) / usable)) : 0;
    const t = p * duration;
    if (videoRef.current) {
      videoRef.current.currentTime = t;
      setCurrentTime(t);
    }
  };

  const handleTimelineClick = (e) => seekToClientX(e.clientX);

  const handleTimelineMouseDown = (e) => {
    e.preventDefault();
    setDragging(true);
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e) => seekToClientX(e.clientX);
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging, duration]);

  if (!set?.videoURL) return null;

  const rootClass = [
    'live-set-player',
    minimized ? 'live-set-player--mini' : 'live-set-player--expanded',
    isDark ? 'live-set-player-dark' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={rootClass} aria-label="Live set player">
      {!minimized && (
        <div
          className="live-set-player-backdrop"
          aria-hidden="true"
          onClick={() => setMinimized(true)}
        />
      )}

      <div className="live-set-player-panel" role="dialog" aria-modal={!minimized} aria-label={title}>
        <div className="live-set-player-panel-header">
          <span className="live-set-player-title" title={title}>{title}</span>
          <div className="live-set-player-header-actions">
            <button
              type="button"
              className="live-set-player-close"
              onClick={() => setMinimized((m) => !m)}
              aria-label={minimized ? 'Expand player' : 'Minimize player'}
              title={minimized ? 'Expand' : 'Minimize'}
            >
              {minimized ? <MdFullscreen size={20} /> : <MdFullscreenExit size={20} />}
            </button>
            <button
              type="button"
              className="live-set-player-close"
              onClick={onClose}
              aria-label="Close player"
              title="Close"
            >
              <MdClose size={22} />
            </button>
          </div>
        </div>

        <div className="live-set-player-video-wrap" onClick={togglePlay}>
          <video
            ref={videoRef}
            className="live-set-player-video"
            preload="metadata"
            muted={audioReplacesVideo || muted}
            playsInline
            onLoadedMetadata={syncAudioToVideo}
          />
          {!loaded && <div className="live-set-player-loading">Loading…</div>}
          <div className={`live-set-player-play-overlay ${!playing ? 'visible' : ''}`}>
            {!playing ? <MdPlayArrow size={48} /> : null}
          </div>
        </div>

        <div
          ref={timelineRef}
          className="live-set-player-timeline"
          onClick={handleTimelineClick}
          onMouseDown={handleTimelineMouseDown}
          role="slider"
          aria-label="Seek"
          aria-valuemin={0}
          aria-valuemax={duration}
          aria-valuenow={currentTime}
          tabIndex={0}
          onKeyDown={(e) => {
            const v = videoRef.current;
            if (!v || !duration) return;
            const step = e.shiftKey ? 30 : 5;
            if (e.key === 'ArrowLeft') {
              e.preventDefault();
              v.currentTime = Math.max(0, v.currentTime - step);
            } else if (e.key === 'ArrowRight') {
              e.preventDefault();
              v.currentTime = Math.min(duration, v.currentTime + step);
            }
          }}
        >
          <div className="live-set-player-timeline-track" />
          <div
            className="live-set-player-timeline-progress"
            style={{ width: `calc((100% - 16px) * ${progress})` }}
          />
          <div
            className="live-set-player-timeline-thumb"
            style={{ left: `calc(8px + (100% - 16px) * ${progress})` }}
          />
        </div>

        <div className="live-set-player-controls">
          <button type="button" className="live-set-player-btn" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}>
            {playing ? <MdPause size={24} /> : <MdPlayArrow size={24} />}
          </button>
          {!audioReplacesVideo && (
            <button type="button" className="live-set-player-btn" onClick={toggleMuted} aria-label={muted ? 'Unmute' : 'Mute'}>
              {muted ? <MdVolumeOff size={22} /> : <MdVolumeUp size={22} />}
            </button>
          )}
          {set?.setupId && (
            <button
              type="button"
              className="live-set-player-btn live-set-player-setup-btn"
              onClick={handleViewSetup}
              aria-label="View setup"
              title="Open this set's setup in the builder"
            >
              <MdGraphicEq size={20} />
              <span className="live-set-player-setup-label">View setup</span>
            </button>
          )}
          <span className="live-set-player-time">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>
      </div>

      {audioTrackURL && <audio ref={audioRef} src={audioTrackURL} style={{ display: 'none' }} />}
    </div>
  );
}

export default LiveSetPlayer;
