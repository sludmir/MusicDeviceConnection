import React, { useState, useRef, useEffect, useMemo } from 'react';
import { doc, updateDoc, increment } from 'firebase/firestore';
import { MdClose, MdPlayArrow, MdPause, MdVolumeUp, MdVolumeOff, MdFullscreen, MdFullscreenExit, MdGraphicEq, MdVisibility } from 'react-icons/md';
import { db } from '../firebaseConfig';
import { attachHls } from '../utils/attachHls';
import { getSignedBunnyUrls } from '../utils/bunnyUrl';
import { createAudioMasterSync, createMulticamAudioMasterSync } from '../utils/audioVideoSync';
import { normalizeCuts } from '../utils/multicam';
import { formatCompactNumber } from '../utils/formatCount';
import './LiveSetPlayer.css';

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

function normalizeAudioTrackURL(url) {
  if (typeof url !== 'string') return null;
  const trimmed = url.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function LiveSetPlayer({ set, onClose, theme = 'light' }) {
  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const timelineRef = useRef(null);
  const syncRef = useRef(null);
  const multiVideoRefs = useRef([]);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [minimized, setMinimized] = useState(false);
  // Multicam: which stacked angle is currently visible/slaved (driven by the
  // controller's onActiveAngleChange), and a fallback flag flipped by any
  // stacked-video/HLS error that drops the player back to the single-video path.
  const [activeAngle, setActiveAngle] = useState(0);
  const [multicamFailed, setMulticamFailed] = useState(false);
  // One view per mount (SetPlayerProvider remounts this via `key={set.id}`),
  // counted on the first real play — never on autoplay, since nothing here
  // autoplays without a user tap.
  const viewCountedRef = useRef(false);
  // Shown in the header; starts at the count Hub/Feed already fetched and
  // bumps instantly on the first play so the badge doesn't wait on a re-fetch.
  const [displayViews, setDisplayViews] = useState(() => Number(set?.views) || 0);

  // Sign Bunny URLs (no-op for non-Bunny URLs). signed is null until
  // the cloud function returns; we hold off attaching HLS until then.
  const [signed, setSigned] = useState(null);
  useEffect(() => {
    if (!set?.id) { setSigned(null); return; }
    let cancelled = false;
    getSignedBunnyUrls('set', set.id)
      .then((urls) => {
        if (cancelled) return;
        // Mirror Feed: signing only replaces Bunny URLs; keep the Firestore
        // audioTrackURL (Firebase Storage) when the function omits it.
        // angles/angleStatus pass through the callable's response; fall back
        // to the (unsigned) Firestore fields only if the deployed function
        // hasn't been updated yet to return them.
        setSigned({
          videoURL: urls.videoURL || set.videoURL,
          audioTrackURL: normalizeAudioTrackURL(urls.audioTrackURL)
            || normalizeAudioTrackURL(set.audioTrackURL),
          angles: Array.isArray(urls.angles)
            ? urls.angles
            : (Array.isArray(set.angles) ? set.angles : undefined),
          angleStatus: urls.angleStatus || set.angleStatus || undefined,
        });
      })
      .catch(() => {
        if (!cancelled) setSigned({
          videoURL: set.videoURL,
          audioTrackURL: normalizeAudioTrackURL(set.audioTrackURL),
          angles: Array.isArray(set.angles) ? set.angles : undefined,
          angleStatus: set.angleStatus || undefined,
        });
      });
    return () => { cancelled = true; };
    // set.angles/set.angleStatus deliberately omitted: they're only read as a
    // fallback inside the closure (same pattern as set.videoURL above), and
    // including array/object props here would re-trigger the fetch on every
    // parent re-render that hands down a new (but content-equal) reference.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [set?.id, set?.videoURL, set?.audioTrackURL]);

  const videoURL = signed?.videoURL;
  const audioTrackURL = normalizeAudioTrackURL(signed?.audioTrackURL ?? set?.audioTrackURL);
  const audioOffsetSeconds = Number(set?.audioOffsetSeconds) || 0;
  const audioReplacesVideo = audioTrackURL
    ? (set?.audioReplacesVideo !== false)
    : false;
  // Optional trim window (video time) set in the multi-angle editor: playback
  // is confined to [trimStart, trimEnd] and the timeline shows only that span.
  const trimStart = Math.max(0, Number(set?.trimStartSeconds) || 0);
  const rawTrimEnd = Number(set?.trimEndSeconds);
  const trimEnd = Number.isFinite(rawTrimEnd) && rawTrimEnd > trimStart ? rawTrimEnd : null;
  const title = set?.title || 'Live set';
  const setupLabel = (set?.setupName || '').trim() || 'Setup';

  const isDark = theme === 'dark';

  // Audio-clock (stacked) mode eligibility — a single-angle set is multicam
  // with one entry: signed per-angle URLs, every angle's Bunny encode marked
  // 'ready', and the lossless track actually engaged (audio-master is
  // required for the cut controller). Any stacked-video/HLS error flips
  // multicamFailed and drops back to the single-video path below.
  const angleList = Array.isArray(signed?.angles) && signed.angles.length >= 1 ? signed.angles : null;
  const angleStatus = signed?.angleStatus || set?.angleStatus || {};
  const anglesReady = !!angleList && angleList.every((a) => angleStatus[a.bunnyVideoGuid] === 'ready');
  const cuts = useMemo(
    () => normalizeCuts(set?.cuts, { maxAngleIndex: (angleList?.length || 1) - 1 }),
    [set?.cuts, angleList]
  );
  const multicam = !!(angleList && anglesReady && audioTrackURL && audioReplacesVideo) && !multicamFailed;

  // Master-time window (multicam only): the audio clock is the UI clock, so
  // the displayed/seekable range is expressed in master seconds, not video
  // seconds. Prefer the new trimIn/trimOutMasterSeconds fields (audio-spine
  // posting) and fall back to the legacy video-time trim + offset / plain
  // durationSeconds for older docs that never wrote them.
  const offset0 = Number(angleList?.[0]?.offsetSeconds ?? audioOffsetSeconds) || 0;
  const masterIn = Number.isFinite(Number(set?.trimInMasterSeconds))
    ? Number(set.trimInMasterSeconds)
    : trimStart + offset0;
  const multicamEffDuration = Number.isFinite(Number(set?.trimOutMasterSeconds))
    ? Math.max(0, Number(set.trimOutMasterSeconds) - masterIn)
    : Math.max(0, Number(set?.durationSeconds) || 0);
  const effDuration = multicam ? multicamEffDuration : Math.max(0, (trimEnd ?? duration) - trimStart);
  const masterOut = masterIn + effDuration;
  const displayOrigin = multicam ? masterIn : trimStart;

  useEffect(() => {
    if (!videoURL) return;
    setCurrentTime(0);
    setDuration(0);
    setLoaded(false);
    setPlaying(false);
    setBuffering(true);
    setMulticamFailed(false);
    setActiveAngle(0);
  }, [videoURL]);

  // Single-video HLS attach — skipped in multicam mode (the stacked-video
  // effect below owns attachHls there); gated on `multicam` too so it
  // (re)attaches the moment multicam falls back (see multicamFailed).
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !videoURL || multicam) return;
    return attachHls(v, videoURL);
  }, [videoURL, multicam]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    if (!audioTrackURL) {
      a.pause();
      a.removeAttribute('src');
      return;
    }
    if (a.src !== audioTrackURL) a.src = audioTrackURL;
  }, [audioTrackURL]);

  useEffect(() => {
    const v = videoRef.current;
    if (v && audioReplacesVideo && !multicam) v.muted = true;
  }, [audioReplacesVideo, videoURL, multicam]);

  // Single-video event bindings (timeupdate/loadedmetadata/play/pause + view
  // counting) — skipped in multicam mode, where the audio element and the
  // active stacked video own these instead (effects further below).
  useEffect(() => {
    const v = videoRef.current;
    if (!v || multicam) return;
    const onTimeUpdate = () => {
      setCurrentTime(v.currentTime);
      if (trimEnd && v.currentTime >= trimEnd) {
        const sync = syncRef.current;
        if (sync) sync.pause();
        else { try { v.pause(); } catch (_) {} }
      }
    };
    const onLoadedMetadata = () => {
      setDuration(v.duration);
      setLoaded(true);
      if (trimStart > 0 && v.currentTime < trimStart) {
        try { v.currentTime = trimStart; } catch (_) {}
        setCurrentTime(trimStart);
      }
    };
    const onDurationChange = () => setDuration(v.duration);
    const onPlay = () => {
      setPlaying(true);
      if (!viewCountedRef.current && set?.id) {
        viewCountedRef.current = true;
        setDisplayViews((v) => v + 1);
        updateDoc(doc(db, 'sets', set.id), { views: increment(1) }).catch(() => {});
      }
    };
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
  }, [videoURL, set?.id, trimStart, trimEnd, multicam]);

  // Audio-master sync (see utils/audioVideoSync): the lossless track is the
  // clock and is never seeked during playback; the muted video is slaved to it
  // via tiny playbackRate nudges. Seeking an <audio> element stalls on iOS, so
  // the old "chase the video by re-seeking the audio" approach stuttered there.
  // Only engaged when the uploaded track replaces the video's own audio, and
  // never in multicam mode (the multicam controller effect below owns syncRef then).
  useEffect(() => {
    const v = videoRef.current;
    const a = audioRef.current;
    if (multicam || !audioReplacesVideo || !audioTrackURL || !a || !v || !videoURL) return undefined;
    const sync = createAudioMasterSync(v, a, {
      offset: audioOffsetSeconds,
      audioStart: trimStart + audioOffsetSeconds,
    });
    syncRef.current = sync;
    return () => { sync.destroy(); syncRef.current = null; };
  }, [videoURL, audioTrackURL, audioOffsetSeconds, audioReplacesVideo, trimStart, multicam]);

  // ---- Multicam mode: stacked muted videos slaved to the audio clock ----

  // Attach HLS to every stacked angle video (mirrors the single-video attach
  // above, one per angle). Any attach/error flips multicamFailed so the
  // component falls back to the single-video path.
  useEffect(() => {
    if (!multicam || !angleList) return undefined;
    const cleanups = angleList.map((a, i) => {
      const el = multiVideoRefs.current[i];
      if (!el || !a?.hlsUrl) return null;
      try {
        return attachHls(el, a.hlsUrl);
      } catch (_) {
        setMulticamFailed(true);
        return null;
      }
    });
    return () => { cleanups.forEach((fn) => { if (fn) fn(); }); };
  }, [multicam, angleList]);

  // The multicam controller: one audio clock, N muted videos, cuts drive
  // which one is active. Mirrors the single-video sync effect above but only
  // the active video is slaved; see utils/audioVideoSync for the internals.
  useEffect(() => {
    if (!multicam || !angleList) return undefined;
    const a = audioRef.current;
    const videos = angleList.map((_, i) => multiVideoRefs.current[i]);
    if (!a || videos.some((v) => !v)) return undefined;
    const sync = createMulticamAudioMasterSync(
      angleList.map((ang, i) => ({ video: videos[i], offset: Number(ang.offsetSeconds) || 0 })),
      a,
      {
        cuts,
        audioStart: masterIn,
        onActiveAngleChange: (i) => setActiveAngle(i),
      }
    );
    syncRef.current = sync;
    return () => { sync.destroy(); syncRef.current = null; };
  }, [multicam, angleList, cuts, masterIn]);

  // Buffering/loaded signal follows whichever stacked video is currently
  // active (re-binds on every angle swap).
  useEffect(() => {
    if (!multicam) return undefined;
    const el = multiVideoRefs.current[activeAngle];
    if (!el) return undefined;
    const onWaiting = () => setBuffering(true);
    const onPlaying = () => setBuffering(false);
    const onLoadedMetadata = () => setLoaded(true);
    el.addEventListener('waiting', onWaiting);
    el.addEventListener('playing', onPlaying);
    el.addEventListener('loadedmetadata', onLoadedMetadata);
    return () => {
      el.removeEventListener('waiting', onWaiting);
      el.removeEventListener('playing', onPlaying);
      el.removeEventListener('loadedmetadata', onLoadedMetadata);
    };
  }, [multicam, activeAngle]);

  // The UI clock in multicam mode is the AUDIO element (master time), not any
  // one video. View counting fires on the first real audio play; trim-end
  // (masterOut) pauses playback the same way trimEnd does for single-video.
  useEffect(() => {
    if (!multicam) return undefined;
    const a = audioRef.current;
    if (!a) return undefined;
    const onTimeUpdate = () => {
      setCurrentTime(a.currentTime);
      if (masterOut > masterIn && a.currentTime >= masterOut) {
        const sync = syncRef.current;
        if (sync) sync.pause();
        else { try { a.pause(); } catch (_) {} }
      }
    };
    const onPlay = () => {
      setPlaying(true);
      if (!viewCountedRef.current && set?.id) {
        viewCountedRef.current = true;
        setDisplayViews((v) => v + 1);
        updateDoc(doc(db, 'sets', set.id), { views: increment(1) }).catch(() => {});
      }
    };
    const onPause = () => setPlaying(false);
    const onEnded = () => setPlaying(false);
    a.addEventListener('timeupdate', onTimeUpdate);
    a.addEventListener('play', onPlay);
    a.addEventListener('pause', onPause);
    a.addEventListener('ended', onEnded);
    return () => {
      a.removeEventListener('timeupdate', onTimeUpdate);
      a.removeEventListener('play', onPlay);
      a.removeEventListener('pause', onPause);
      a.removeEventListener('ended', onEnded);
    };
  }, [multicam, set?.id, masterIn, masterOut]);

  // Esc shrinks the expanded view to the pip rather than closing it, so
  // playback isn't lost by accident. Use the ✕ to close fully.
  useEffect(() => {
    if (minimized) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setMinimized(true); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [minimized]);

  const togglePlay = () => {
    if (multicam) {
      const a = audioRef.current;
      const sync = syncRef.current;
      if (!a || !sync) return;
      const atEnd = masterOut > masterIn && a.currentTime >= masterOut - 0.05;
      if (a.paused) {
        setBuffering(true);
        if (atEnd) sync.seek(masterIn);
        sync.play();
      } else {
        sync.pause();
      }
      return;
    }
    const v = videoRef.current;
    if (!v) return;
    const sync = syncRef.current;
    const atTrimEnd = trimEnd != null && v.currentTime >= trimEnd - 0.05;
    if (sync && audioReplacesVideo) {
      if (v.paused) {
        setBuffering(true);
        if (atTrimEnd) sync.seek(trimStart);
        sync.play();
      } else {
        sync.pause();
      }
      return;
    }
    if (v.paused) {
      setBuffering(true);
      if (atTrimEnd || v.currentTime < trimStart) {
        try { v.currentTime = trimStart; } catch (_) {}
      }
      v.play().catch(() => setBuffering(false));
    } else {
      v.pause();
    }
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

  const progress = effDuration > 0
    ? Math.min(1, Math.max(0, (currentTime - displayOrigin) / effDuration))
    : 0;

  const TIMELINE_PAD = 8;

  // Deliberate user scrub. In multicam mode the controller's seek() takes
  // MASTER time (audio.currentTime); the single-video controller's seek()
  // takes VIDEO time — branch accordingly.
  const seekToClientX = (clientX) => {
    const bar = timelineRef.current;
    if (!bar) return;
    if (!multicam && !duration) return;
    if (effDuration <= 0) return;
    const rect = bar.getBoundingClientRect();
    const x = clientX - rect.left;
    const usable = rect.width - 2 * TIMELINE_PAD;
    const p = usable > 0 ? Math.max(0, Math.min(1, (x - TIMELINE_PAD) / usable)) : 0;
    if (multicam) {
      const t = masterIn + p * effDuration;
      const sync = syncRef.current;
      if (sync) sync.seek(t);
      setCurrentTime(t);
      return;
    }
    const t = trimStart + p * effDuration;
    if (videoRef.current) {
      const sync = syncRef.current;
      if (sync && audioReplacesVideo) sync.seek(t);
      else videoRef.current.currentTime = t;
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
  }, [dragging, duration, multicam]);

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
          {!minimized && (
            <span className="live-set-player-views" title={`${displayViews} views`}>
              <MdVisibility size={13} /> {formatCompactNumber(displayViews)}
            </span>
          )}
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
          {multicam ? (
            angleList.map((a, i) => (
              <video
                key={a.bunnyVideoGuid || i}
                ref={(el) => { multiVideoRefs.current[i] = el; }}
                className={`live-set-player-video live-set-player-video--stacked ${i === activeAngle ? 'is-active' : ''}`}
                preload="metadata"
                muted
                playsInline
                onError={() => setMulticamFailed(true)}
              />
            ))
          ) : (
            <video
              ref={videoRef}
              className="live-set-player-video"
              preload="metadata"
              muted={audioReplacesVideo || muted}
              playsInline
              onWaiting={() => setBuffering(true)}
              onPlaying={() => setBuffering(false)}
              onPause={() => setBuffering(false)}
              onError={() => setBuffering(false)}
            />
          )}
          {(!loaded || buffering) && (
            <div className="live-set-player-buffering" aria-hidden="true">
              <img
                src={isDark ? '/liveset-logo-dark.png' : '/liveset-logo.png'}
                alt=""
                className="live-set-player-buffering-logo"
              />
            </div>
          )}
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
          aria-valuemax={effDuration}
          aria-valuenow={Math.max(0, currentTime - displayOrigin)}
          tabIndex={0}
          onKeyDown={(e) => {
            const step = e.shiftKey ? 30 : 5;
            if (multicam) {
              const a = audioRef.current;
              const sync = syncRef.current;
              if (!a || !sync) return;
              const seekRel = (delta) => {
                const target = Math.max(masterIn, Math.min(masterOut, a.currentTime + delta));
                sync.seek(target);
              };
              if (e.key === 'ArrowLeft') { e.preventDefault(); seekRel(-step); }
              else if (e.key === 'ArrowRight') { e.preventDefault(); seekRel(step); }
              return;
            }
            const v = videoRef.current;
            if (!v || !duration) return;
            const seekRel = (delta) => {
              const target = Math.max(trimStart, Math.min(trimEnd ?? duration, v.currentTime + delta));
              const sync = syncRef.current;
              if (sync && audioReplacesVideo) sync.seek(target);
              else v.currentTime = target;
            };
            if (e.key === 'ArrowLeft') { e.preventDefault(); seekRel(-step); }
            else if (e.key === 'ArrowRight') { e.preventDefault(); seekRel(step); }
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
              aria-label={`Open setup: ${setupLabel}`}
              title={`Open setup: ${setupLabel}`}
            >
              <MdGraphicEq size={20} />
              <span className="live-set-player-setup-label">{setupLabel}</span>
            </button>
          )}
          <span className="live-set-player-time">
            {formatTime(Math.max(0, currentTime - displayOrigin))} / {formatTime(effDuration)}
          </span>
        </div>
      </div>

      <audio ref={audioRef} style={{ display: 'none' }} />
    </div>
  );
}

export default LiveSetPlayer;
