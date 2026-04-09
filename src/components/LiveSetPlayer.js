import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MdClose, MdPlayArrow, MdPause, MdVolumeUp, MdVolumeOff } from 'react-icons/md';
import './LiveSetPlayer.css';

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
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

  const videoURL = set?.videoURL;
  const audioTrackURL = set?.audioTrackURL;
  const audioOffsetSeconds = Number(set?.audioOffsetSeconds) || 0;
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

  useEffect(() => {
    const v = videoRef.current;
    const a = audioRef.current;
    if (!audioTrackURL || !a || !v) return;
    const onPlay = () => {
      a.currentTime = v.currentTime + audioOffsetSeconds;
      a.play().catch(() => {});
    };
    const onTimeUpdate = () => {
      a.currentTime = v.currentTime + audioOffsetSeconds;
    };
    v.addEventListener('play', onPlay);
    v.addEventListener('timeupdate', onTimeUpdate);
    if (!v.paused) {
      a.currentTime = v.currentTime + audioOffsetSeconds;
      a.play().catch(() => {});
    }
    return () => {
      v.removeEventListener('play', onPlay);
      v.removeEventListener('timeupdate', onTimeUpdate);
      a.pause();
      a.removeAttribute('src');
    };
  }, [videoURL, audioTrackURL, audioOffsetSeconds]);

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

  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;

  const TIMELINE_PAD = 8;

  const handleTimelineClick = (e) => {
    const bar = timelineRef.current;
    if (!bar || !duration) return;
    const rect = bar.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const usable = rect.width - 2 * TIMELINE_PAD;
    const p = usable > 0 ? Math.max(0, Math.min(1, (x - TIMELINE_PAD) / usable)) : 0;
    const t = p * duration;
    if (videoRef.current) {
      videoRef.current.currentTime = t;
      setCurrentTime(t);
    }
  };

  const handleTimelineMouseDown = (e) => {
    e.preventDefault();
    setDragging(true);
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e) => {
      const bar = timelineRef.current;
      if (!bar || !duration) return;
      const rect = bar.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const usable = rect.width - 2 * TIMELINE_PAD;
      const p = usable > 0 ? Math.max(0, Math.min(1, (x - TIMELINE_PAD) / usable)) : 0;
      const t = p * duration;
      if (videoRef.current) videoRef.current.currentTime = t;
      setCurrentTime(t);
    };
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging, duration]);

  if (!set?.videoURL) return null;

  return (
    <div className={`live-set-player ${isDark ? 'live-set-player-dark' : ''}`} aria-label="Live set player">
      <div className="live-set-player-panel">
        <div className="live-set-player-panel-header">
          <span className="live-set-player-title" title={title}>{title}</span>
          <button
            type="button"
            className="live-set-player-close"
            onClick={onClose}
            aria-label="Close player"
          >
            <MdClose size={22} />
          </button>
        </div>
        <div className="live-set-player-video-wrap" onClick={togglePlay}>
          <video
            ref={videoRef}
            src={videoURL}
            className="live-set-player-video"
            muted={!!audioTrackURL || muted}
            playsInline
            onLoadedMetadata={syncAudioToVideo}
          />
          {!loaded && <div className="live-set-player-loading">Loading…</div>}
          <div className={`live-set-player-play-overlay ${!playing ? 'visible' : ''}`}>
            {!playing ? <MdPlayArrow size={48} /> : null}
          </div>
        </div>
        <div className="live-set-player-controls">
          <button type="button" className="live-set-player-btn" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}>
            {playing ? <MdPause size={24} /> : <MdPlayArrow size={24} />}
          </button>
          {!audioTrackURL && (
            <button type="button" className="live-set-player-btn" onClick={toggleMuted} aria-label={muted ? 'Unmute' : 'Mute'}>
              {muted ? <MdVolumeOff size={22} /> : <MdVolumeUp size={22} />}
            </button>
          )}
          <span className="live-set-player-time">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
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

      {audioTrackURL && <audio ref={audioRef} src={audioTrackURL} style={{ display: 'none' }} />}
    </div>
  );
}

export default LiveSetPlayer;
