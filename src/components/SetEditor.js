import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { MdArrowBack, MdAdd, MdClose, MdMusicNote, MdVideocam, MdImage, MdAutoFixHigh, MdRefresh, MdPlayArrow, MdPause, MdHeadphones, MdPiano, MdContentCut } from 'react-icons/md';
import { IoMusicalNotes } from 'react-icons/io5';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, serverTimestamp, query, where, getDocs, orderBy } from 'firebase/firestore';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, auth } from '../firebaseConfig';
import { createBunnyVideo, uploadToBunny } from '../utils/bunnyStream';
import { extractPeaks, extractPeaksStreaming, WAVEFORM_DEFAULTS } from '../utils/audioWaveform';
import { suggestOffsetSeconds } from '../utils/audioAlign';
import { nudgeOffset, angleTimeAtMaster, formatOffsetMs, parseClockTime, formatClockTime } from '../utils/syncEditorMath';
import { CLIP_MIN_SEC, CLIP_MAX_SEC, normalizeClipRange, resizeClipRanges } from '../utils/clipRanges';
import { normalizeCuts, angleIndexAt, addCut, moveCut, removeCut, setSegmentAngle, cutsToSegments } from '../utils/multicam';
import './SetEditor.css';

const PX_PER_SEC_DEFAULT = 40;
const PX_PER_SEC_MIN = 10;
const PX_PER_SEC_MAX = 160;
const ROW_HEIGHT = 72;

const MAX_ANGLES = 3;
const MAX_VIDEO_SIZE_MB = 10000;
const MAX_VIDEO_SIZE_BYTES = MAX_VIDEO_SIZE_MB * 1024 * 1024;
const MAX_AUDIO_SIZE_MB = 1000;
const MAX_AUDIO_SIZE_BYTES = MAX_AUDIO_SIZE_MB * 1024 * 1024;
const MAX_THUMBNAIL_SIZE_MB = 5;
const MAX_THUMBNAIL_SIZE_BYTES = MAX_THUMBNAIL_SIZE_MB * 1024 * 1024;

// Files small enough to fit in memory get a full decode (longer preview).
// Larger files stream just their opening seconds so they don't blow up memory.
function analyzePeaks(file, streamSeconds) {
  if (file && file.size > WAVEFORM_DEFAULTS.maxFileBytes) {
    return extractPeaksStreaming(file, { maxSeconds: streamSeconds });
  }
  return extractPeaks(file);
}

function formatFileSize(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i += 1; }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function readVideoMetadata(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => {
      const duration = Number.isFinite(v.duration) ? v.duration : 0;
      resolve({ url, duration });
    };
    v.onerror = () => resolve({ url, duration: 0 });
    v.src = url;
  });
}

function readAudioMetadata(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const a = document.createElement('audio');
    a.preload = 'metadata';
    a.onloadedmetadata = () => {
      const duration = Number.isFinite(a.duration) ? a.duration : 0;
      resolve({ url, duration });
    };
    a.onerror = () => resolve({ url, duration: 0 });
    a.src = url;
  });
}

function SetEditor({ onBack, theme = 'dark' }) {
  const navigate = useNavigate();
  const [step, setStep] = useState('edit'); // 'edit' | 'post'
  const [angles, setAngles] = useState([]); // { id, file, url, duration }
  const [audio, setAudio] = useState(null); // { file, url, duration }
  // Opt-out of master audio (single angle only — see docs/superpowers/specs/
  // 2026-07-14-audio-spine-design.md). Only meaningful while `audio` is falsy;
  // adding a track unchecks it.
  const [noMasterAudio, setNoMasterAudio] = useState(false);
  const [thumbnail, setThumbnail] = useState(null); // { file, url }
  const [error, setError] = useState(null);

  const angleInputRef = useRef(null);
  const audioInputRef = useRef(null);
  const thumbnailInputRef = useRef(null);
  const angleIdRef = useRef(0);
  // The edit-step "Master audio" card's own <audio controls> — paused inside
  // startPlayback() so auditioning the raw file can't echo against the sync
  // playback element once master play starts.
  const masterAudioCardRef = useRef(null);

  // ── Post step ─────────────────────────────────────────────────────
  const [title, setTitle] = useState('');
  const [savedSetups, setSavedSetups] = useState([]);
  const [selectedSetupId, setSelectedSetupId] = useState('');
  const [loadingSetups, setLoadingSetups] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Feed clips (post step): 1–3 ranges on angle 1's timeline.
  const [numClips, setNumClips] = useState(1);
  const [clipRanges, setClipRanges] = useState([{ start: 0, end: 30 }]);
  const [activeClipIndex, setActiveClipIndex] = useState(0);
  const clipTimelineRef = useRef(null);
  const clipVideoRef = useRef(null);
  const clipAudioRef = useRef(null);
  const clipDragRef = useRef(null);
  const clipDragEndAtRef = useRef(0);
  // Post-step clip preview play/pause chip (no native <video controls> — see
  // the muted/volumechange guard on the effect below).
  const [clipPreviewPlaying, setClipPreviewPlaying] = useState(false);

  // Trim (optional): IN/OUT points in MASTER-timeline seconds, entered as
  // clock text ("1:23") or grabbed from the playhead. Converted to video time
  // at post; viewers then see only the IN→OUT window.
  const [trimInText, setTrimInText] = useState('');
  const [trimOutText, setTrimOutText] = useState('');

  // ── Live playback (master + angle) ────────────────────────────────
  const [playing, setPlaying] = useState(false);
  const [audioFocus, setAudioFocus] = useState('master'); // 'master' | 'angle'
  const [focusedAngleId, setFocusedAngleId] = useState(null);
  const masterAudioPlayerRef = useRef(null);
  const anglePlayerRefs = useRef({}); // { [angleId]: HTMLVideoElement }
  const playRafRef = useRef(0);

  // ── Sync state ─────────────────────────────────────────────────────
  // waveforms: keyed by 'master' or `angle-${id}` → { status, peaks, peaksPerSecond, durationSeconds, previewDurationSeconds, error }
  const [waveforms, setWaveforms] = useState({});
  // angleOffsets: { [angleId]: offsetSeconds } — committed offsets (drag uses ref during motion, commits here on release)
  const [angleOffsets, setAngleOffsets] = useState({});
  const [playheadSec, setPlayheadSec] = useState(0);
  const [pxPerSec, setPxPerSec] = useState(PX_PER_SEC_DEFAULT);
  const [autoAligning, setAutoAligning] = useState({}); // { [angleId]: true }

  // ── Multicam cuts ────────────────────────────────────────────────
  // cuts: [{ timeSec, angleIndex }] in MASTER-timeline seconds (see utils/multicam.js).
  const [cuts, setCuts] = useState([{ timeSec: 0, angleIndex: 0 }]);
  const [focusedCutIndex, setFocusedCutIndex] = useState(null); // segment/cut index, null = none
  const cutDragRef = useRef(null); // { pointerId, cutIndex, markerEl }
  const playheadSecRef = useRef(0); // live mirror of playheadSec, read by the keydown live-cut listener

  const syncScrollRef = useRef(null);
  const playheadRef = useRef(null);
  const angleCanvasRefs = useRef({}); // { [angleId]: HTMLCanvasElement }
  const angleWrapRefs = useRef({});   // { [angleId]: HTMLDivElement } — for transform during drag
  const dragRef = useRef({ kind: null }); // 'scrub' | 'offset' | null
  const lastLiveSeekRef = useRef(0);      // throttle for live seeks during drags

  // Revoke object URLs on unmount ONLY. Running this cleanup on every media
  // change revokes URLs still held in state (add angle → add audio used to
  // kill the angle's blob URL, black-screening the preview). Removal/replace
  // paths revoke their own URLs individually.
  const mediaUrlsRef = useRef({ angles: [], audio: null, thumbnail: null });
  useEffect(() => {
    mediaUrlsRef.current = {
      angles: angles.map((a) => a.url),
      audio: audio?.url || null,
      thumbnail: thumbnail?.url || null,
    };
  }, [angles, audio, thumbnail]);
  useEffect(() => () => {
    const m = mediaUrlsRef.current;
    m.angles.forEach((u) => u && URL.revokeObjectURL(u));
    if (m.audio) URL.revokeObjectURL(m.audio);
    if (m.thumbnail) URL.revokeObjectURL(m.thumbnail);
  }, []);

  // Load master audio peaks when audio changes.
  useEffect(() => {
    let cancelled = false;
    if (!audio?.file) {
      setWaveforms((prev) => {
        if (!('master' in prev)) return prev;
        const next = { ...prev };
        delete next.master;
        return next;
      });
      return () => { cancelled = true; };
    }
    setWaveforms((prev) => ({ ...prev, master: { status: 'loading' } }));
    analyzePeaks(audio.file, 300)
      .then((result) => {
        if (cancelled) return;
        setWaveforms((prev) => ({
          ...prev,
          master: { status: 'ready', ...result },
        }));
      })
      .catch((err) => {
        if (cancelled) return;
        setWaveforms((prev) => ({
          ...prev,
          master: { status: 'error', error: err.message, code: err.code },
        }));
      });
    return () => { cancelled = true; };
  }, [audio?.file]);

  // Load angle peaks when angle list changes. Only fetch peaks for newly-added angles.
  useEffect(() => {
    const angleKeys = new Set(angles.map((a) => `angle-${a.id}`));
    // Drop entries for removed angles
    setWaveforms((prev) => {
      let changed = false;
      const next = { ...prev };
      Object.keys(next).forEach((key) => {
        if (key.startsWith('angle-') && !angleKeys.has(key)) {
          delete next[key];
          changed = true;
        }
      });
      return changed ? next : prev;
    });
    setAngleOffsets((prev) => {
      let changed = false;
      const next = { ...prev };
      Object.keys(next).forEach((k) => {
        const id = Number(k);
        if (!angles.some((a) => a.id === id)) {
          delete next[k];
          changed = true;
        }
      });
      return changed ? next : prev;
    });

    // Kick off extraction for angles that don't have a waveform yet.
    let cancelled = false;
    angles.forEach((angle) => {
      const key = `angle-${angle.id}`;
      setWaveforms((prev) => {
        if (prev[key]) return prev;
        return { ...prev, [key]: { status: 'loading' } };
      });
    });
    angles.forEach((angle) => {
      const key = `angle-${angle.id}`;
      setWaveforms((prev) => {
        if (prev[key]?.status === 'loading' && !prev[key].started) {
          // mark started, kick off async
          analyzePeaks(angle.file, 180)
            .then((result) => {
              if (cancelled) return;
              setWaveforms((p) => ({ ...p, [key]: { status: 'ready', ...result } }));
            })
            .catch((err) => {
              if (cancelled) return;
              setWaveforms((p) => ({ ...p, [key]: { status: 'error', error: err.message, code: err.code } }));
            });
          return { ...prev, [key]: { ...prev[key], started: true } };
        }
        return prev;
      });
    });
    return () => { cancelled = true; };
  }, [angles]);

  // Keep focusedAngleId valid as angles change.
  useEffect(() => {
    if (angles.length === 0) {
      if (focusedAngleId !== null) setFocusedAngleId(null);
      return;
    }
    if (!angles.some((a) => a.id === focusedAngleId)) {
      setFocusedAngleId(angles[0].id);
    }
  }, [angles, focusedAngleId]);

  // Re-normalize cuts whenever the angle count changes — removing an angle can
  // leave a cut's angleIndex out of range; dropping below 2 angles means
  // cutting no longer makes sense, so reset to the single-angle default.
  useEffect(() => {
    setCuts((prev) => (
      angles.length < 2
        ? [{ timeSec: 0, angleIndex: 0 }]
        : normalizeCuts(prev, { maxAngleIndex: angles.length - 1 })
    ));
  }, [angles.length]);

  // Keep focusedCutIndex valid as cuts change (e.g. setSegmentAngle can merge
  // segments together, shrinking the list out from under a selected index).
  useEffect(() => {
    if (focusedCutIndex != null && focusedCutIndex >= cuts.length) {
      setFocusedCutIndex(null);
    }
  }, [cuts, focusedCutIndex]);

  // Mirror playheadSec into a ref so the keydown live-cut listener (added once
  // per step/angle-count/playing combo, not on every scrub) can read the
  // latest value without going stale.
  useEffect(() => {
    playheadSecRef.current = playheadSec;
  }, [playheadSec]);

  // Live cutting: while editing with ≥2 angles, keys 1/2/3 insert a cut at the
  // current master time targeting that angle. Master time is the playing
  // master-audio element's currentTime (exact), or the parked playhead when
  // paused. Ignored while typing in a field or with a modifier held.
  useEffect(() => {
    if (step !== 'edit' || angles.length < 2) return undefined;
    const onKeyDown = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable) return;
      const idx = Number(e.key) - 1;
      if (!Number.isInteger(idx) || idx < 0 || idx >= angles.length) return;
      const master = masterAudioPlayerRef.current;
      const tSec = playing && master ? master.currentTime : playheadSecRef.current;
      setCuts((prev) => addCut(prev, tSec, idx));
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [step, angles.length, playing]);

  // ── Derived ────────────────────────────────────────────────────────
  const master = waveforms.master;
  const masterReady = master?.status === 'ready';
  const syncEnabled = angles.length >= 1 && audio;
  const allWaveformsReady = syncEnabled && masterReady && angles.every((a) => waveforms[`angle-${a.id}`]?.status === 'ready');
  // Multi-angle posting requires master audio (the sync anchor); the 4b
  // opt-out allows exactly one angle with no track, camera audio becoming the
  // set's audio (no sync/cuts section in that mode).
  const canContinueToPost = angles.length >= 1 && (audio ? allWaveformsReady : (noMasterAudio && angles.length === 1));
  const previewDuration = useMemo(() => {
    let max = 0;
    Object.values(waveforms).forEach((w) => {
      if (w?.status === 'ready' && w.previewDurationSeconds > max) max = w.previewDurationSeconds;
    });
    return Math.max(max, 10);
  }, [waveforms]);
  const timelinePx = previewDuration * pxPerSec;

  const handleAddAngle = async (e) => {
    const file = e.target.files?.[0];
    const input = e.target;
    if (input) input.value = '';
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      setError('Please select a video file');
      return;
    }
    if (file.size > MAX_VIDEO_SIZE_BYTES) {
      setError(`Video too large (${formatFileSize(file.size)}). Max ${MAX_VIDEO_SIZE_MB} MB.`);
      return;
    }
    if (angles.length >= MAX_ANGLES) {
      setError(`Maximum ${MAX_ANGLES} angles.`);
      return;
    }
    const { url, duration } = await readVideoMetadata(file);
    angleIdRef.current += 1;
    setError(null);
    setAngles((prev) => [...prev, { id: angleIdRef.current, file, url, duration }]);
  };

  const handleRemoveAngle = (id) => {
    setAngles((prev) => {
      const target = prev.find((a) => a.id === id);
      if (target?.url) URL.revokeObjectURL(target.url);
      return prev.filter((a) => a.id !== id);
    });
  };

  const handleSetAudio = async (e) => {
    const file = e.target.files?.[0];
    const input = e.target;
    if (input) input.value = '';
    if (!file) return;
    if (!file.type.startsWith('audio/')) {
      setError('Please select an audio file');
      return;
    }
    if (file.size > MAX_AUDIO_SIZE_BYTES) {
      setError(`Audio too large (${formatFileSize(file.size)}). Max ${MAX_AUDIO_SIZE_MB} MB.`);
      return;
    }
    if (audio?.url) URL.revokeObjectURL(audio.url);
    const { url, duration } = await readAudioMetadata(file);
    setError(null);
    setAudio({ file, url, duration });
    setNoMasterAudio(false);
  };

  const handleRemoveAudio = () => {
    if (audio?.url) URL.revokeObjectURL(audio.url);
    setAudio(null);
  };

  const handleSetThumbnail = (e) => {
    const file = e.target.files?.[0];
    const input = e.target;
    if (input) input.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (JPG, PNG, or WebP).');
      return;
    }
    if (file.size > MAX_THUMBNAIL_SIZE_BYTES) {
      setError(`Thumbnail too large (${formatFileSize(file.size)}). Max ${MAX_THUMBNAIL_SIZE_MB} MB.`);
      return;
    }
    if (thumbnail?.url) URL.revokeObjectURL(thumbnail.url);
    const url = URL.createObjectURL(file);
    setError(null);
    setThumbnail({ file, url });
  };

  const handleRemoveThumbnail = () => {
    if (thumbnail?.url) URL.revokeObjectURL(thumbnail.url);
    setThumbnail(null);
  };

  // "Post without master audio" (4b) caps the set at a single angle — the
  // track is the sync anchor multicam cutting depends on. Only active while
  // there's no track (adding one auto-unchecks the box).
  const noMasterAudioMode = noMasterAudio && !audio;
  const canAddAngle = angles.length < (noMasterAudioMode ? 1 : MAX_ANGLES);
  const isDark = theme === 'dark';

  // ── Canvas rendering ───────────────────────────────────────────────
  const masterCanvasRef = useRef(null);

  useLayoutEffect(() => {
    const drawOne = (canvas, peaks, peaksPerSecond) => {
      if (!canvas || !peaks || !peaks.length) return;
      const widthSec = peaks.length / peaksPerSecond;
      const totalWidthPx = Math.max(1, Math.round(widthSec * pxPerSec));
      const heightPx = ROW_HEIGHT - 16;
      const dpr = window.devicePixelRatio || 1;
      // Browsers cap canvas backing stores (~32k px per side); past the cap
      // drawing fails silently and the waveform goes blank at high zoom.
      // Cap the store and let the horizontal scale absorb the difference.
      const MAX_CANVAS_PX = 16000;
      const scaleX = Math.min(dpr, MAX_CANVAS_PX / totalWidthPx);
      canvas.width = Math.max(1, Math.round(totalWidthPx * scaleX));
      canvas.height = heightPx * dpr;
      canvas.style.width = `${totalWidthPx}px`;
      canvas.style.height = `${heightPx}px`;
      const ctx = canvas.getContext('2d');
      ctx.setTransform(scaleX, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, totalWidthPx, heightPx);
      ctx.fillStyle = canvas.dataset.color || (isDark ? 'rgba(0, 162, 255, 0.85)' : 'rgba(0, 102, 255, 0.85)');
      // Normalize each track to its own loudest peak: camera-mic audio sits
      // far below a mastered track, and alignment needs shape, not level.
      let peakMax = 0;
      for (let i = 0; i < peaks.length; i++) if (peaks[i] > peakMax) peakMax = peaks[i];
      const gain = peakMax > 0.001 ? 1 / peakMax : 1;
      const half = heightPx / 2;
      const pxPerPeak = pxPerSec / peaksPerSecond;
      const barWidth = Math.max(1, pxPerPeak - 0.5);
      for (let i = 0; i < peaks.length; i++) {
        const x = Math.floor(i * pxPerPeak);
        const h = Math.max(1, Math.min(1, peaks[i] * gain) * (heightPx - 4));
        ctx.fillRect(x, half - h / 2, barWidth, h);
      }
    };

    if (masterReady) {
      if (masterCanvasRef.current) masterCanvasRef.current.dataset.color = isDark ? 'rgba(255, 200, 80, 0.9)' : 'rgba(180, 120, 0, 0.9)';
      drawOne(masterCanvasRef.current, master.peaks, master.peaksPerSecond);
    }
    angles.forEach((angle) => {
      const w = waveforms[`angle-${angle.id}`];
      if (w?.status === 'ready') {
        const canvas = angleCanvasRefs.current[angle.id];
        if (canvas) canvas.dataset.color = isDark ? 'rgba(0, 162, 255, 0.85)' : 'rgba(0, 102, 255, 0.85)';
        drawOne(canvas, w.peaks, w.peaksPerSecond);
      }
    });
  }, [waveforms, pxPerSec, angles, masterReady, master, isDark]);

  // ── Pointer drag (scrub + per-angle offset) ────────────────────────
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  // Position all angle players against the master timeline using their offsets.
  const seekAllToMasterTime = useCallback((masterTime) => {
    const a = masterAudioPlayerRef.current;
    if (a) {
      const dur = Number.isFinite(a.duration) ? a.duration : Infinity;
      a.currentTime = Math.max(0, Math.min(dur - 0.01, masterTime));
    }
    angles.forEach((angle) => {
      const v = anglePlayerRefs.current[angle.id];
      if (!v) return;
      const offset = angleOffsets[angle.id] || 0;
      // offset: angle's content is shifted by +offset on master timeline.
      // So angle content time at master T is (T - offset).
      const t = angleTimeAtMaster(masterTime, offset);
      const dur = Number.isFinite(v.duration) ? v.duration : Infinity;
      v.currentTime = Math.max(0, Math.min(dur - 0.01, t));
    });
  }, [angles, angleOffsets]);

  const handleRowPointerDown = useCallback((e, kind, angleId) => {
    if (e.button !== 0) return; // left click only
    if (!syncScrollRef.current) return;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
    const rect = syncScrollRef.current.getBoundingClientRect();
    const scrollLeft = syncScrollRef.current.scrollLeft;

    if (kind === 'scrub') {
      const x = e.clientX - rect.left + scrollLeft;
      const newSec = clamp(x / pxPerSec, 0, previewDuration);
      // Instant visual update
      if (playheadRef.current) {
        playheadRef.current.style.transform = `translateX(${newSec * pxPerSec}px)`;
      }
      dragRef.current = {
        kind: 'scrub',
        pointerId: e.pointerId,
        target: e.currentTarget,
        currentSec: newSec,
      };
      setPlayheadSec(newSec);
    } else if (kind === 'offset') {
      const startOffsetSec = angleOffsets[angleId] || 0;
      setFocusedAngleId(angleId);
      dragRef.current = {
        kind: 'offset',
        pointerId: e.pointerId,
        target: e.currentTarget,
        angleId,
        startClientX: e.clientX,
        startOffsetSec,
        currentOffsetSec: startOffsetSec,
      };
    }
  }, [pxPerSec, previewDuration, angleOffsets]);

  const handleRowPointerMove = useCallback((e) => {
    const d = dragRef.current;
    if (!d.kind || d.pointerId !== e.pointerId) return;

    if (d.kind === 'scrub') {
      if (!syncScrollRef.current) return;
      const rect = syncScrollRef.current.getBoundingClientRect();
      const scrollLeft = syncScrollRef.current.scrollLeft;
      const x = e.clientX - rect.left + scrollLeft;
      const newSec = clamp(x / pxPerSec, 0, previewDuration);
      if (playheadRef.current) {
        playheadRef.current.style.transform = `translateX(${newSec * pxPerSec}px)`;
      }
      d.currentSec = newSec;
    } else if (d.kind === 'offset') {
      const dx = e.clientX - d.startClientX;
      const newOffset = d.startOffsetSec + dx / pxPerSec;
      const clamped = clamp(newOffset, -previewDuration, previewDuration);
      d.currentOffsetSec = clamped;
      const wrap = angleWrapRefs.current[d.angleId];
      if (wrap) {
        wrap.style.transform = `translateX(${clamped * pxPerSec}px)`;
      }
    }

    // Live preview while dragging: seek media (throttled) so the frame follows.
    const now = performance.now();
    if (now - lastLiveSeekRef.current > 80) {
      lastLiveSeekRef.current = now;
      if (d.kind === 'scrub' && d.currentSec != null) {
        seekAllToMasterTime(d.currentSec);
      } else if (d.kind === 'offset' && d.currentOffsetSec != null) {
        const v = anglePlayerRefs.current[d.angleId];
        if (v) {
          const t = angleTimeAtMaster(playheadSec, d.currentOffsetSec);
          const dur = Number.isFinite(v.duration) ? v.duration : Infinity;
          v.currentTime = Math.max(0, Math.min(dur - 0.01, t));
        }
      }
    }
  }, [pxPerSec, previewDuration, seekAllToMasterTime, playheadSec]);

  const handleRowPointerUp = useCallback((e) => {
    const d = dragRef.current;
    if (!d.kind || d.pointerId !== e.pointerId) return;
    try { d.target.releasePointerCapture(d.pointerId); } catch (_) {}

    if (d.kind === 'scrub' && d.currentSec != null) {
      setPlayheadSec(d.currentSec);
    } else if (d.kind === 'offset' && d.currentOffsetSec != null) {
      setAngleOffsets((prev) => ({ ...prev, [d.angleId]: d.currentOffsetSec }));
    }
    dragRef.current = { kind: null };
  }, []);

  // ── Cut marker drag (cuts row) ──────────────────────────────────────
  // Cuts index 0 is fixed (never draggable); the plan calls for a direct
  // setCuts(moveCut(...)) on every pointermove — segments are cheap to
  // re-render, unlike the offset drag's transform-then-commit dance.
  const handleCutMarkerPointerDown = useCallback((e, cutIndex) => {
    if (e.button !== 0) return;
    if (!syncScrollRef.current) return;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
    cutDragRef.current = { pointerId: e.pointerId, cutIndex, markerEl: e.currentTarget };
    setFocusedCutIndex(cutIndex);
  }, []);

  const handleCutMarkerPointerMove = useCallback((e) => {
    const d = cutDragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    if (!syncScrollRef.current) return;
    const rect = syncScrollRef.current.getBoundingClientRect();
    const scrollLeft = syncScrollRef.current.scrollLeft;
    const tSec = clamp((e.clientX - rect.left + scrollLeft) / pxPerSec, 0, previewDuration);
    setCuts((prev) => moveCut(prev, d.cutIndex, tSec));
    // Throttled live preview seek, same cadence as the offset drag — only
    // while paused, so we never touch playback while master audio is running.
    const now = performance.now();
    if (now - lastLiveSeekRef.current > 80) {
      lastLiveSeekRef.current = now;
      if (!playing) setPlayheadSec(tSec);
    }
  }, [pxPerSec, previewDuration, playing]);

  const handleCutMarkerPointerUp = useCallback((e) => {
    const d = cutDragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    try { d.markerEl.releasePointerCapture(d.pointerId); } catch (_) {}
    cutDragRef.current = null;
  }, []);

  // ── Auto-align ─────────────────────────────────────────────────────
  const handleAutoAlign = useCallback(async (angleId) => {
    const m = waveforms.master;
    const w = waveforms[`angle-${angleId}`];
    if (m?.status !== 'ready' || w?.status !== 'ready') return;
    setAutoAligning((prev) => ({ ...prev, [angleId]: true }));
    // Yield so the spinner can paint
    await new Promise((r) => setTimeout(r, 0));
    try {
      const result = suggestOffsetSeconds(m.peaks, w.peaks, m.peaksPerSecond, 15);
      if (result) {
        setAngleOffsets((prev) => ({ ...prev, [angleId]: result.offsetSeconds }));
      }
    } finally {
      setAutoAligning((prev) => {
        const next = { ...prev };
        delete next[angleId];
        return next;
      });
    }
  }, [waveforms]);

  // Nudge the focused angle's offset by ±deltaSec; the paused-seek effect
  // re-seeks its video so the frame updates immediately.
  const handleNudgeOffset = useCallback((deltaSec) => {
    if (focusedAngleId == null) return;
    setAngleOffsets((prev) => ({
      ...prev,
      [focusedAngleId]: nudgeOffset(prev[focusedAngleId] || 0, deltaSec, previewDuration),
    }));
  }, [focusedAngleId, previewDuration]);

  // ── Playback (master + angles together, A/B mute) ─────────────────
  // Stop playback whenever the underlying media changes or sync is no longer enabled.
  useEffect(() => {
    if (!syncEnabled && playing) setPlaying(false);
  }, [syncEnabled, playing]);

  // Whenever playhead moves while paused, scrub all elements (no playback).
  useEffect(() => {
    if (playing) return;
    seekAllToMasterTime(playheadSec);
  }, [playheadSec, playing, seekAllToMasterTime]);

  // Whenever angle offsets change during pause, re-seek that angle.
  useEffect(() => {
    if (playing) return;
    seekAllToMasterTime(playheadSec);
  }, [angleOffsets, playing, seekAllToMasterTime, playheadSec]);

  // Apply A/B mute: when focus is 'master' → angle videos muted; when 'angle' → master muted.
  useEffect(() => {
    const a = masterAudioPlayerRef.current;
    if (a) a.muted = audioFocus !== 'master';
    angles.forEach((angle) => {
      const v = anglePlayerRefs.current[angle.id];
      if (!v) return;
      v.muted = !(audioFocus === 'angle' && angle.id === focusedAngleId);
    });
  }, [audioFocus, focusedAngleId, angles, playing]);

  const stopPlayback = useCallback(() => {
    if (playRafRef.current) {
      cancelAnimationFrame(playRafRef.current);
      playRafRef.current = 0;
    }
    const a = masterAudioPlayerRef.current;
    if (a) { try { a.pause(); } catch (_) {} }
    angles.forEach((angle) => {
      const v = anglePlayerRefs.current[angle.id];
      if (v) { try { v.pause(); } catch (_) {} }
    });
  }, [angles]);

  const startPlayback = useCallback(async () => {
    const a = masterAudioPlayerRef.current;
    if (!a) return;
    // The edit-step "Master audio" card has its own <audio controls> for
    // auditioning the raw file. If left playing, starting sync playback would
    // play the same track twice at once (echo) — pause it first.
    const card = masterAudioCardRef.current;
    if (card) { try { card.pause(); } catch (_) {} }
    seekAllToMasterTime(playheadSec);
    try {
      await a.play();
    } catch (_) {
      // Likely autoplay blocked — bail out.
      setPlaying(false);
      return;
    }
    const playPromises = angles.map((angle) => {
      const v = anglePlayerRefs.current[angle.id];
      if (!v) return Promise.resolve();
      return v.play().catch(() => {});
    });
    await Promise.allSettled(playPromises);
    const tick = () => {
      const ap = masterAudioPlayerRef.current;
      if (!ap || ap.paused) {
        playRafRef.current = 0;
        return;
      }
      setPlayheadSec(ap.currentTime);
      playRafRef.current = requestAnimationFrame(tick);
    };
    playRafRef.current = requestAnimationFrame(tick);
  }, [angles, playheadSec, seekAllToMasterTime]);

  const handleTogglePlay = useCallback(() => {
    if (!allWaveformsReady) return;
    if (playing) {
      stopPlayback();
      setPlaying(false);
    } else {
      setPlaying(true);
      // startPlayback runs after state flips so refs are stable.
      Promise.resolve().then(() => startPlayback());
    }
  }, [allWaveformsReady, playing, startPlayback, stopPlayback]);

  // Cleanup playback on unmount.
  useEffect(() => () => stopPlayback(), [stopPlayback]);

  // ── Saved setups (post step) ──────────────────────────────────────
  useEffect(() => {
    if (step !== 'post' || !auth.currentUser) return;
    let cancelled = false;
    setLoadingSetups(true);
    (async () => {
      try {
        const q = query(
          collection(db, 'setups'),
          where('ownerId', '==', auth.currentUser.uid),
          orderBy('createdAt', 'desc')
        );
        const snap = await getDocs(q);
        if (cancelled) return;
        const list = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
        setSavedSetups(list);
      } catch (err) {
        console.error('Error fetching setups:', err);
      } finally {
        if (!cancelled) setLoadingSetups(false);
      }
    })();
    return () => { cancelled = true; };
  }, [step]);

  // ── Feed-clip picker (post step) ───────────────────────────────────
  const primaryDuration = angles[0]?.duration || 0;
  const primaryClipOffset = angleOffsets[angles[0]?.id] || 0;
  const masterDuration = audio?.duration || 0;
  // The picker's timeline is MASTER time whenever a track exists (the audio
  // spine — docs/superpowers/specs/2026-07-14-audio-spine-design.md); in
  // no-master-audio mode (4b) master IS angle-1 video time, so this collapses
  // back to today's behavior.
  const clipTimelineDuration = audio ? masterDuration : primaryDuration;

  const trimInSec = parseClockTime(trimInText);
  const trimOutSec = parseClockTime(trimOutText);
  const trimInvalid = trimInSec != null && trimOutSec != null && trimOutSec <= trimInSec;

  // Coverage warning (non-blocking): does the trimmed master window extend
  // past the footage the loaded angles actually cover?
  const coverageStart = angles.length ? Math.min(...angles.map((a) => angleOffsets[a.id] || 0)) : 0;
  const coverageEnd = angles.length ? Math.max(...angles.map((a) => (angleOffsets[a.id] || 0) + (a.duration || 0))) : 0;
  const trimWinStart = trimInSec ?? 0;
  const trimWinEnd = trimOutSec ?? masterDuration;
  const coverageWarnStart = angles.length > 0 && trimWinStart < coverageStart - 0.5;
  const coverageWarnEnd = angles.length > 0 && trimWinEnd > coverageEnd + 0.5;

  const handleContinueToPost = useCallback(() => {
    setError(null);
    if (angles.length === 0) { setError('Add at least one angle.'); return; }
    if (!audio) {
      if (!noMasterAudio) { setError('Add a master audio track, or check "Post without master audio".'); return; }
      if (angles.length !== 1) { setError('Posting without master audio only supports one angle.'); return; }
    } else if (!allWaveformsReady) {
      setError('Still analyzing waveforms — give it a moment.');
      return;
    }
    stopPlayback();
    setPlaying(false);
    setClipRanges((prev) => resizeClipRanges(prev, numClips, clipTimelineDuration));
    setStep('post');
  }, [angles, audio, allWaveformsReady, noMasterAudio, stopPlayback, numClips, clipTimelineDuration]);

  // Post-step preview: muted only while a master track exists (`audio`) —
  // then the video drives the hidden master-audio element
  // (audio.currentTime = video.currentTime + offset, the app-wide convention)
  // and camera audio must stay unhearable. Without a track, camera audio IS
  // the set's audio (4b), so the video plays unmuted and there's no hidden
  // <audio> to align (it isn't rendered — see JSX below). Also tracks
  // clipPreviewPlaying for the play/pause chip and force-re-mutes on any
  // volumechange while a track is engaged (no native volume UI is exposed,
  // but keyboard/media-key unmutes are still possible).
  useEffect(() => {
    if (step !== 'post') return undefined;
    const v = clipVideoRef.current;
    if (!v) return undefined;
    const a = clipAudioRef.current; // null in no-master-audio mode (4b)
    const offset = primaryClipOffset;
    const alignAudio = () => {
      if (!a) return;
      try { a.currentTime = Math.max(0, v.currentTime + offset); } catch (_) {}
    };
    const onPlay = () => {
      setClipPreviewPlaying(true);
      if (a) { alignAudio(); a.play().catch(() => {}); }
    };
    const onPause = () => {
      setClipPreviewPlaying(false);
      if (a) { try { a.pause(); } catch (_) {} }
    };
    const onTimeUpdate = () => {
      if (v.paused || !a) return;
      if (Math.abs(a.currentTime - (v.currentTime + offset)) > 0.25) alignAudio();
    };
    const onVolumeChange = () => {
      if (audio && !v.muted) v.muted = true;
    };
    v.muted = !!audio;
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    v.addEventListener('seeked', alignAudio);
    v.addEventListener('timeupdate', onTimeUpdate);
    v.addEventListener('volumechange', onVolumeChange);
    return () => {
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
      v.removeEventListener('seeked', alignAudio);
      v.removeEventListener('timeupdate', onTimeUpdate);
      v.removeEventListener('volumechange', onVolumeChange);
      if (a) { try { a.pause(); } catch (_) {} }
    };
  }, [step, primaryClipOffset, audio]);

  const handleNumClipsChange = useCallback((n) => {
    setNumClips(n);
    setClipRanges((prev) => resizeClipRanges(prev, n, clipTimelineDuration));
    setActiveClipIndex((prev) => Math.min(prev, n - 1));
  }, [clipTimelineDuration]);

  const seekClipPreview = useCallback((t) => {
    const v = clipVideoRef.current;
    if (!v || !Number.isFinite(t)) return;
    const dur = Number.isFinite(v.duration) ? v.duration : Infinity;
    v.currentTime = Math.max(0, Math.min(dur - 0.01, t));
  }, []);

  const toggleClipPreviewPlay = useCallback(() => {
    const v = clipVideoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {}); else v.pause();
  }, []);

  // Seek the preview video from a TIMELINE second — master time when a track
  // exists, angle-1 video time otherwise (clipTimelineDuration above).
  const seekClipPreviewAtTimelineSec = useCallback((timelineSec) => {
    const videoSec = audio
      ? clamp(timelineSec - primaryClipOffset, 0, Math.max(0, primaryDuration - 0.01))
      : timelineSec;
    seekClipPreview(videoSec);
  }, [audio, primaryClipOffset, primaryDuration, seekClipPreview]);

  const clipTimelineSecAt = useCallback((clientX) => {
    const el = clipTimelineRef.current;
    if (!el || !clipTimelineDuration) return 0;
    const rect = el.getBoundingClientRect();
    const frac = clamp((clientX - rect.left) / rect.width, 0, 1);
    return frac * clipTimelineDuration;
  }, [clipTimelineDuration]);

  const moveClipEdge = useCallback((edge, sec) => {
    setClipRanges((prev) => {
      const next = prev.slice();
      const cur = next[activeClipIndex] || { start: 0, end: CLIP_MIN_SEC };
      const raw = edge === 'start'
        ? { start: Math.min(sec, cur.end - CLIP_MIN_SEC), end: cur.end }
        : { start: cur.start, end: Math.max(sec, cur.start + CLIP_MIN_SEC) };
      next[activeClipIndex] = normalizeClipRange(raw, clipTimelineDuration);
      return next;
    });
    seekClipPreviewAtTimelineSec(sec);
  }, [activeClipIndex, clipTimelineDuration, seekClipPreviewAtTimelineSec]);

  const handleClipThumbPointerDown = useCallback((edge) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
    clipDragRef.current = { edge, pointerId: e.pointerId };
  }, []);

  const handleClipThumbPointerMove = useCallback((e) => {
    const d = clipDragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    if (d.edge === 'move') {
      // Slide the whole window, preserving its length.
      const dsec = clipTimelineSecAt(e.clientX) - d.grabSec;
      const len = d.startRange.end - d.startRange.start;
      const start = clamp(d.startRange.start + dsec, 0, Math.max(0, clipTimelineDuration - len));
      setClipRanges((prev) => {
        const next = prev.slice();
        next[activeClipIndex] = {
          start: Number(start.toFixed(2)),
          end: Number((start + len).toFixed(2)),
        };
        return next;
      });
      seekClipPreviewAtTimelineSec(start);
      return;
    }
    moveClipEdge(d.edge, clipTimelineSecAt(e.clientX));
  }, [moveClipEdge, clipTimelineSecAt, activeClipIndex, clipTimelineDuration, seekClipPreviewAtTimelineSec]);

  const handleClipRangePointerDown = useCallback((e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const r = clipRanges[activeClipIndex];
    if (!r) return;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
    clipDragRef.current = {
      edge: 'move',
      pointerId: e.pointerId,
      grabSec: clipTimelineSecAt(e.clientX),
      startRange: { ...r },
    };
  }, [clipRanges, activeClipIndex, clipTimelineSecAt]);

  const handleClipThumbPointerUp = useCallback((e) => {
    const d = clipDragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (_) {}
    clipDragRef.current = null;
    clipDragEndAtRef.current = performance.now();
  }, []);

  // Clicking the bar jumps the nearest edge of the active clip there.
  const handleClipTimelineClick = useCallback((e) => {
    if (clipDragRef.current) return;
    // The click that follows a thumb-drag release must not re-move an edge.
    if (performance.now() - clipDragEndAtRef.current < 250) return;
    const sec = clipTimelineSecAt(e.clientX);
    const cur = clipRanges[activeClipIndex];
    if (!cur) return;
    const edge = Math.abs(sec - cur.start) <= Math.abs(sec - cur.end) ? 'start' : 'end';
    moveClipEdge(edge, sec);
  }, [clipTimelineSecAt, clipRanges, activeClipIndex, moveClipEdge]);

  const handleSelectClipTab = useCallback((i) => {
    setActiveClipIndex(i);
    const r = clipRanges[i];
    if (r) seekClipPreviewAtTimelineSec(r.start);
  }, [clipRanges, seekClipPreviewAtTimelineSec]);

  const handleBackToEdit = useCallback(() => {
    setError(null);
    setStep('edit');
  }, []);

  const handlePost = useCallback(async () => {
    if (!auth.currentUser) { setError('Please sign in to post.'); return; }
    if (angles.length === 0) { setError('Add at least one angle.'); return; }
    if (!audio && !(noMasterAudio && angles.length === 1)) {
      setError('Add a master audio track, or check "Post without master audio" with a single angle.');
      return;
    }
    if (!selectedSetupId) { setError('Link a saved setup so viewers can copy your gear.'); return; }
    if (audio && trimInvalid) { setError('Trim OUT must be after trim IN.'); return; }

    setUploading(true);
    setUploadProgress(0);
    setError(null);
    const userId = auth.currentUser.uid;
    const creatorName = auth.currentUser.displayName || auth.currentUser.email?.split('@')[0] || 'Unknown';
    const storage = getStorage();

    try {
      // Angle 1 stays the "primary" video for every back-compat field (videoURL,
      // trim, clips); all angles upload below and are cut between via `cuts`.
      const primary = angles[0];
      const primaryOffset = angleOffsets[primary.id] || 0;
      const safeTitle = (title || primary.file?.name || 'Untitled Set').trim().slice(0, 200);

      // Trim only exists in the master-audio sync UI (4b: no trim UI without
      // a track) — gate every trim computation on `audio` so a stale IN/OUT
      // typed before the track was removed can never leak into the post.
      // Trim points arrive in master time; players work in video time.
      const trimStartV = audio && trimInSec != null
        ? Math.max(0, angleTimeAtMaster(trimInSec, primaryOffset))
        : 0;
      const trimEndVRaw = audio && trimOutSec != null
        ? angleTimeAtMaster(trimOutSec, primaryOffset)
        : null;
      const trimEndV = trimEndVRaw != null && primary.duration
        ? Math.min(Math.max(0, trimEndVRaw), primary.duration)
        : trimEndVRaw;
      const legacyDurationSeconds =
        Math.max(0, (trimEndV ?? primary.duration ?? 0) - trimStartV) || (primary.duration || 0);
      // durationSeconds is the MASTER window length when a track exists (see
      // docs/superpowers/specs/2026-07-14-audio-spine-design.md); falls back
      // to the legacy angle-1-video computation without one.
      const masterDurationSec = audio ? (audio.duration || 0) : 0;
      const effectiveDurationSeconds = masterDurationSec > 0
        ? Math.max(0, (trimOutSec ?? masterDurationSec) - (trimInSec ?? 0))
        : legacyDurationSeconds;

      // 1. Reserve Bunny video + upload EVERY angle (progress split evenly across
      // angles, 0–90%; storage/thumbnail steps below take it to 100).
      const uploaded = []; // { bunny, angle }, index-aligned with `angles`
      for (let i = 0; i < angles.length; i++) {
        const angle = angles[i];
        const angleBunny = await createBunnyVideo({
          title: `${safeTitle}${angles.length > 1 ? ` — Angle ${i + 1}` : ''}`,
          kind: 'set',
        });
        await uploadToBunny(
          angle.file,
          angleBunny,
          (fraction) => setUploadProgress(Math.round(((i + fraction) / angles.length) * 90))
        );
        uploaded.push({ bunny: angleBunny, angle });
      }
      // `bunny` = angle 1's Bunny record — every back-compat field below
      // (videoURL, bunnyVideoGuid, clip fields, …) reads from it exactly as before.
      const bunny = uploaded[0].bunny;

      // 2. Master audio → Firebase Storage. Skipped entirely when posting
      // without master audio (4b) — camera audio IS the set's audio there.
      let audioTrackURL = null;
      if (audio) {
        const audioName = (audio.file.name || 'audio').replace(/[^a-zA-Z0-9._-]/g, '_');
        const audioRef = storageRef(storage, `sets/audio/${userId}_${Date.now()}_${audioName}`);
        await uploadBytes(audioRef, audio.file);
        audioTrackURL = await getDownloadURL(audioRef);
      }
      setUploadProgress(98);

      // 3. Optional thumbnail.
      let customThumbnailURL = null;
      if (thumbnail?.file) {
        const tName = (thumbnail.file.name || 'thumb').replace(/[^a-zA-Z0-9._-]/g, '_');
        const tRef = storageRef(storage, `sets/thumbnails/${userId}_${Date.now()}_${tName}`);
        await uploadBytes(tRef, thumbnail.file);
        customThumbnailURL = await getDownloadURL(tRef);
      }

      // 4. Write set doc. Forward-compatible angles[] + cuts[] schema.
      const linkedSetup = savedSetups.find((s) => s.id === selectedSetupId);
      // audioOffsetSeconds: existing player expects audio.currentTime = video.currentTime + offset.
      // Our angle (video) is shifted by +primaryOffset on the master timeline, so at video time T
      // the master audio is at T + primaryOffset. Hence offset = primaryOffset.
      const setData = {
        creatorId: userId,
        creatorName,
        title: safeTitle,
        description: '',
        videoURL: bunny.hlsUrl,
        thumbnailURL: customThumbnailURL || bunny.thumbnailUrl,
        bunnyVideoGuid: bunny.videoGuid,
        bunnyLibraryId: bunny.libraryId,
        status: 'processing',
        durationSeconds: effectiveDurationSeconds,
        createdAt: serverTimestamp(),
        views: 0,
        ...(audioTrackURL
          ? { audioTrackURL, audioOffsetSeconds: primaryOffset, audioReplacesVideo: true }
          : { audioOffsetSeconds: 0, audioReplacesVideo: false }),
        angles: uploaded.map(({ bunny: b, angle }, i) => ({
          label: `Angle ${i + 1}`,
          bunnyVideoGuid: b.videoGuid,
          bunnyLibraryId: b.libraryId,
          hlsUrl: b.hlsUrl,
          offsetSeconds: angleOffsets[angle.id] || 0,
          durationSeconds: angle.duration || 0,
        })),
        angleGuids: uploaded.map(({ bunny: b }) => b.videoGuid),
        angleStatus: Object.fromEntries(uploaded.map(({ bunny: b }) => [b.videoGuid, 'processing'])),
        cuts: normalizeCuts(cuts, { maxAngleIndex: angles.length - 1 }),
        setupId: selectedSetupId,
        setupName: linkedSetup?.name || '',
        setupType: linkedSetup?.setupType || 'DJ',
      };
      if (customThumbnailURL) {
        setData.customThumbnailURL = customThumbnailURL;
        setData.autoThumbnailURL = bunny.thumbnailUrl;
      }
      if (trimStartV > 0) setData.trimStartSeconds = Number(trimStartV.toFixed(3));
      if (trimEndV != null && trimEndV > trimStartV) setData.trimEndSeconds = Number(trimEndV.toFixed(3));
      if (audio) {
        if (trimInSec != null) setData.trimInMasterSeconds = Number(trimInSec.toFixed(3));
        if (trimOutSec != null) setData.trimOutMasterSeconds = Number(trimOutSec.toFixed(3));
      }
      const setDocRef = await addDoc(collection(db, 'sets'), setData);

      // 5. User-selected clip ranges into the feed. The picker operates in
      // MASTER seconds whenever a track exists (4c); legacy clipStart/clipEnd
      // are always derived back into angle-1 video time so the Feed needs no
      // changes.
      const clipTimelineDurationSec = audio ? masterDurationSec : (primary.duration || 0);
      const rangesToPost = clipRanges
        .slice(0, numClips)
        .map((r) => normalizeClipRange(r, clipTimelineDurationSec));
      const baseClipData = {
        creatorId: userId,
        creatorName,
        title: safeTitle,
        description: '',
        fullVideoURL: bunny.hlsUrl,
        videoURL: bunny.hlsUrl,
        thumbnailURL: customThumbnailURL || bunny.thumbnailUrl,
        bunnyVideoGuid: bunny.videoGuid,
        bunnyLibraryId: bunny.libraryId,
        status: 'processing',
        fullSetId: setDocRef.id,
        likes: 0,
        likedBy: [],
        views: 0,
        ...(audioTrackURL
          ? { audioTrackURL, audioOffsetSeconds: primaryOffset, audioReplacesVideo: true }
          : { audioOffsetSeconds: 0, audioReplacesVideo: false }),
        setupId: selectedSetupId,
        setupName: linkedSetup?.name || '',
        setupType: linkedSetup?.setupType || 'DJ',
      };
      if (customThumbnailURL) {
        baseClipData.customThumbnailURL = customThumbnailURL;
        baseClipData.autoThumbnailURL = bunny.thumbnailUrl;
      }
      for (const r of rangesToPost) {
        const clipData = { ...baseClipData, createdAt: serverTimestamp() };
        if (audioTrackURL) {
          clipData.clipStartMaster = r.start;
          clipData.clipEndMaster = r.end;
          clipData.clipStart = Number(clamp(r.start - primaryOffset, 0, primary.duration || 0).toFixed(2));
          clipData.clipEnd = Number(clamp(r.end - primaryOffset, 0, primary.duration || 0).toFixed(2));
        } else {
          clipData.clipStart = r.start;
          clipData.clipEnd = r.end;
        }
        await addDoc(collection(db, 'clips'), clipData);
      }

      setUploadProgress(100);
      setTimeout(() => {
        setUploading(false);
        navigate('/profile');
      }, 250);
    } catch (e) {
      console.error('Error posting set:', e);
      setError(e?.message || String(e) || 'Upload failed');
      setUploading(false);
    }
  }, [angles, angleOffsets, audio, noMasterAudio, thumbnail, title, selectedSetupId, savedSetups, navigate, clipRanges, numClips, trimInSec, trimOutSec, trimInvalid, cuts]);

  const formatTime = (sec) => {
    if (!Number.isFinite(sec)) return '0:00';
    const sign = sec < 0 ? '-' : '';
    const v = Math.abs(sec);
    const m = Math.floor(v / 60);
    const s = v - m * 60;
    return `${sign}${m}:${s.toFixed(1).padStart(4, '0')}`;
  };

  const zoomOut = () => setPxPerSec((v) => Math.max(PX_PER_SEC_MIN, Math.round(v / 1.5)));
  const zoomIn = () => setPxPerSec((v) => Math.min(PX_PER_SEC_MAX, Math.round(v * 1.5)));

  // While playing with ≥2 angles, the sync preview follows the cut list
  // (angleIndexAt) instead of the manually-focused tab.
  const previewCuttingLive = playing && angles.length >= 2;
  const previewCutAngleId = previewCuttingLive ? angles[angleIndexAt(cuts, playheadSec)]?.id : null;

  return (
    <div className={`set-editor set-editor--${isDark ? 'dark' : 'light'}`}>
      <header className="set-editor__header">
        <button type="button" className="set-editor__back" onClick={onBack} aria-label="Back">
          <MdArrowBack size={22} />
        </button>
        <div className="set-editor__title-group">
          <div className="set-editor__eyebrow">Multi-angle editor</div>
          <h1 className="set-editor__title">New live set</h1>
        </div>
      </header>

      {error && (
        <div className="set-editor__error">
          {error}
          <button type="button" className="set-editor__error-close" onClick={() => setError(null)}>×</button>
        </div>
      )}

      {step === 'edit' && (
      <section className="set-editor__section">
        <div className="set-editor__section-header">
          <h2 className="set-editor__section-title">Camera angles</h2>
          <span className="set-editor__section-meta">{angles.length} / {MAX_ANGLES}</span>
        </div>

        <div className="set-editor__angle-grid">
          {angles.map((a, idx) => (
            <div key={a.id} className="set-editor__card">
              <div className="set-editor__card-header">
                <div className="set-editor__card-label">
                  <MdVideocam size={16} /> Angle {idx + 1}
                </div>
                <button
                  type="button"
                  className="set-editor__icon-btn"
                  onClick={() => handleRemoveAngle(a.id)}
                  aria-label={`Remove angle ${idx + 1}`}
                >
                  <MdClose size={16} />
                </button>
              </div>
              <video
                className="set-editor__card-video"
                src={a.url}
                muted
                preload="metadata"
                playsInline
              />
              <div className="set-editor__card-meta">
                <div className="set-editor__card-name">{a.file.name}</div>
                <div className="set-editor__card-stats">
                  {formatFileSize(a.file.size)} · {a.duration ? `${Math.round(a.duration)}s` : '—'}
                </div>
              </div>
            </div>
          ))}

          {canAddAngle && (
            <button
              type="button"
              className="set-editor__add-card"
              onClick={() => angleInputRef.current?.click()}
            >
              <MdAdd size={28} />
              <span>Add angle</span>
              <span className="set-editor__add-hint">
                {noMasterAudioMode ? 'Add a master track to use multiple angles' : `Up to ${MAX_ANGLES}`}
              </span>
            </button>
          )}
        </div>

        <input
          ref={angleInputRef}
          type="file"
          accept="video/*"
          onChange={handleAddAngle}
          style={{ display: 'none' }}
        />
      </section>
      )}

      {step === 'edit' && (
      <section className="set-editor__section">
        <div className="set-editor__section-header">
          <h2 className="set-editor__section-title">Master audio (lossless)</h2>
          <span className="set-editor__section-meta">FLAC / WAV recommended</span>
        </div>

        {audio ? (
          <div className="set-editor__card set-editor__card--audio">
            <div className="set-editor__card-header">
              <div className="set-editor__card-label">
                <MdMusicNote size={16} /> Master audio
              </div>
              <button
                type="button"
                className="set-editor__icon-btn"
                onClick={handleRemoveAudio}
                aria-label="Remove audio"
              >
                <MdClose size={16} />
              </button>
            </div>
            <audio ref={masterAudioCardRef} className="set-editor__card-audio" src={audio.url} controls />
            <div className="set-editor__card-meta">
              <div className="set-editor__card-name">{audio.file.name}</div>
              <div className="set-editor__card-stats">
                {formatFileSize(audio.file.size)} · {audio.duration ? `${Math.round(audio.duration)}s` : '—'}
              </div>
            </div>
          </div>
        ) : (
          <>
            <button
              type="button"
              className="set-editor__add-card set-editor__add-card--wide"
              onClick={() => audioInputRef.current?.click()}
            >
              <MdMusicNote size={28} />
              <span>Add master audio</span>
              <span className="set-editor__add-hint">Lossless preferred — replaces video audio</span>
            </button>
            <label
              className={`set-editor__checkbox-label ${angles.length >= 2 ? 'set-editor__checkbox-label--disabled' : ''}`}
              title={angles.length >= 2 ? 'Remove extra angles first — multi-angle sets require master audio' : undefined}
            >
              <input
                type="checkbox"
                checked={noMasterAudio}
                disabled={angles.length >= 2}
                onChange={(e) => setNoMasterAudio(e.target.checked)}
              />
              <span>Post without master audio — the camera’s own audio will be used</span>
            </label>
          </>
        )}

        <input
          ref={audioInputRef}
          type="file"
          accept="audio/*"
          onChange={handleSetAudio}
          style={{ display: 'none' }}
        />
      </section>
      )}

      {step === 'edit' && (
      <section className="set-editor__section">
        <div className="set-editor__section-header">
          <h2 className="set-editor__section-title">Thumbnail (optional)</h2>
          <span className="set-editor__section-meta">16:9 · up to {MAX_THUMBNAIL_SIZE_MB} MB</span>
        </div>

        {thumbnail ? (
          <div className="set-editor__card set-editor__card--thumb">
            <div className="set-editor__card-header">
              <div className="set-editor__card-label">
                <MdImage size={16} /> Thumbnail
              </div>
              <button
                type="button"
                className="set-editor__icon-btn"
                onClick={handleRemoveThumbnail}
                aria-label="Remove thumbnail"
              >
                <MdClose size={16} />
              </button>
            </div>
            <img className="set-editor__card-thumb-img" src={thumbnail.url} alt="Custom thumbnail preview" />
            <div className="set-editor__card-meta">
              <div className="set-editor__card-name">{thumbnail.file.name}</div>
              <div className="set-editor__card-stats">{formatFileSize(thumbnail.file.size)}</div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="set-editor__add-card set-editor__add-card--wide"
            onClick={() => thumbnailInputRef.current?.click()}
          >
            <MdImage size={28} />
            <span>Add thumbnail</span>
            <span className="set-editor__add-hint">Falls back to a frame from angle 1 if blank</span>
          </button>
        )}

        <input
          ref={thumbnailInputRef}
          type="file"
          accept="image/*"
          onChange={handleSetThumbnail}
          style={{ display: 'none' }}
        />
      </section>
      )}

      {step === 'edit' && syncEnabled && (
        <section className="set-editor__section">
          <div className="set-editor__section-header">
            <h2 className="set-editor__section-title">Sync</h2>
            <div className="set-editor__sync-tools">
              <button
                type="button"
                className="set-editor__play-btn"
                onClick={handleTogglePlay}
                disabled={!allWaveformsReady}
                title={allWaveformsReady ? 'Master play / pause' : 'Waveforms still analyzing'}
              >
                {playing ? <MdPause size={18} /> : <MdPlayArrow size={18} />}
                <span>{playing ? 'Pause' : 'Master play'}</span>
              </button>
              <div className="set-editor__ab-toggle" role="group" aria-label="Audio source">
                <button
                  type="button"
                  className={`set-editor__ab-btn ${audioFocus === 'master' ? 'active' : ''}`}
                  onClick={() => setAudioFocus('master')}
                  title="Hear master audio only"
                >Master</button>
                <button
                  type="button"
                  className={`set-editor__ab-btn ${audioFocus === 'angle' ? 'active' : ''}`}
                  onClick={() => setAudioFocus('angle')}
                  disabled={angles.length === 0}
                  title="Hear focused angle audio only"
                >Angle</button>
              </div>
              <button
                type="button"
                className="set-editor__zoom-btn"
                onClick={() => setPlayheadSec((s) => Math.max(0, Math.min(previewDuration, s - 1 / 30)))}
                aria-label="Step back one frame"
                title="Back one frame (~33ms)"
              >‹</button>
              <span className="set-editor__sync-time">{formatTime(playheadSec)}</span>
              <button
                type="button"
                className="set-editor__zoom-btn"
                onClick={() => setPlayheadSec((s) => Math.max(0, Math.min(previewDuration, s + 1 / 30)))}
                aria-label="Step forward one frame"
                title="Forward one frame (~33ms)"
              >›</button>
              <button
                type="button"
                className="set-editor__zoom-btn"
                onClick={() => setCuts((prev) => addCut(prev, playheadSec, angleIndexAt(prev, playheadSec)))}
                disabled={angles.length < 2}
                aria-label="Cut at playhead"
                title={angles.length < 2 ? 'Add a second angle to enable cuts' : 'Cut at playhead (splits, keeps the same angle)'}
              >
                <MdContentCut size={14} />
              </button>
              <button type="button" className="set-editor__zoom-btn" onClick={zoomOut} aria-label="Zoom out">−</button>
              <span className="set-editor__zoom-readout">{pxPerSec} px/s</span>
              <button type="button" className="set-editor__zoom-btn" onClick={zoomIn} aria-label="Zoom in">+</button>
            </div>
          </div>

          {/* Preview: focused angle visible; all media elements live here so
              playback/seek refs never re-mount. While playing with ≥2 angles the
              preview follows the cut list instead of the manually-focused tab
              (that tab still governs while paused, for sync work). */}
          <div className="set-editor__sync-preview">
            <div className="set-editor__preview-bar">
              <div className="set-editor__preview-tabs" role="tablist" aria-label="Preview angle">
                {angles.map((angle, idx) => (
                  <button
                    key={angle.id}
                    type="button"
                    role="tab"
                    aria-selected={angle.id === focusedAngleId}
                    className={`set-editor__preview-tab ${angle.id === focusedAngleId ? 'active' : ''}`}
                    onClick={() => setFocusedAngleId(angle.id)}
                  >
                    Angle {idx + 1}
                  </button>
                ))}
              </div>
              <div className="set-editor__preview-nudges" role="group" aria-label="Offset nudge">
                {[-0.1, -0.01, 0.01, 0.1].map((d) => (
                  <button
                    key={d}
                    type="button"
                    className="set-editor__nudge-btn"
                    disabled={focusedAngleId == null}
                    onClick={() => handleNudgeOffset(d)}
                    title={`Shift focused angle ${d > 0 ? 'later' : 'earlier'} by ${Math.abs(d)}s`}
                  >
                    {d > 0 ? `+${d}` : d}
                  </button>
                ))}
                <span className="set-editor__nudge-readout">
                  {focusedAngleId != null ? formatOffsetMs(angleOffsets[focusedAngleId] || 0) : '—'}
                </span>
              </div>
              {angles.length >= 2 && focusedCutIndex != null && (
                <div className="set-editor__cut-chips" role="group" aria-label="Cut segment angle">
                  {angles.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      className={`set-editor__cut-chip ${cuts[focusedCutIndex]?.angleIndex === i ? 'active' : ''}`}
                      onClick={() => setCuts((prev) => setSegmentAngle(prev, focusedCutIndex, i))}
                    >
                      Angle {i + 1}
                    </button>
                  ))}
                  {focusedCutIndex >= 1 && (
                    <button
                      type="button"
                      className="set-editor__cut-chip set-editor__cut-chip--delete"
                      onClick={() => {
                        setCuts((prev) => removeCut(prev, focusedCutIndex));
                        setFocusedCutIndex(null);
                      }}
                      aria-label="Delete this cut"
                      title="Delete this cut (merges into the previous segment)"
                    >
                      <MdClose size={14} />
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="set-editor__preview-stage">
              {audio?.url && (
                <audio ref={masterAudioPlayerRef} src={audio.url} preload="auto" />
              )}
              {angles.map((angle) => {
                const isVisible = previewCuttingLive ? angle.id === previewCutAngleId : angle.id === focusedAngleId;
                return (
                  <video
                    key={angle.id}
                    ref={(el) => { if (el) anglePlayerRefs.current[angle.id] = el; else delete anglePlayerRefs.current[angle.id]; }}
                    src={angle.url}
                    preload="auto"
                    playsInline
                    muted
                    onLoadedMetadata={(e) => {
                      const v = e.currentTarget;
                      const offset = angleOffsets[angle.id] || 0;
                      const t = angleTimeAtMaster(playheadSec, offset);
                      v.currentTime = Math.max(0, Math.min(v.duration - 0.01, t));
                    }}
                    className={`set-editor__preview-video ${isVisible ? 'set-editor__preview-video--visible' : ''}`}
                  />
                );
              })}
              {focusedAngleId == null && (
                <div className="set-editor__preview-empty">Click an angle row to preview it here.</div>
              )}
            </div>
          </div>

          <div className="set-editor__sync-shell">
            <div className="set-editor__sync-labels">
              <div className="set-editor__sync-label-row set-editor__sync-label-row--master">
                <div className="set-editor__sync-label-name">Master audio</div>
                <div className="set-editor__sync-label-status">
                  {master?.status === 'loading' && 'Analyzing…'}
                  {master?.status === 'error' && (master.code === 'FILE_TOO_LARGE' ? 'Too large for preview' : 'Error')}
                  {master?.status === 'ready' && master.truncated && `Preview: first ${Math.round(master.previewDurationSeconds)}s of ${Math.round(master.durationSeconds)}s`}
                  {master?.status === 'ready' && !master.truncated && `${Math.round(master.previewDurationSeconds)}s`}
                </div>
              </div>
              {angles.map((angle, idx) => {
                const w = waveforms[`angle-${angle.id}`];
                const offset = angleOffsets[angle.id] || 0;
                const busy = autoAligning[angle.id];
                return (
                  <div key={angle.id} className="set-editor__sync-label-row" onClick={() => setFocusedAngleId(angle.id)}>
                    <div className="set-editor__sync-label-name">Angle {idx + 1}</div>
                    <div className="set-editor__sync-label-status">
                      {w?.status === 'loading' && 'Analyzing…'}
                      {w?.status === 'error' && (w.code === 'FILE_TOO_LARGE' ? 'Too large for preview' : 'Error')}
                      {w?.status === 'ready' && (
                        <span>offset {formatOffsetMs(offset)}</span>
                      )}
                    </div>
                    <div className="set-editor__sync-label-actions">
                      <button
                        type="button"
                        className="set-editor__sync-action"
                        onClick={() => handleAutoAlign(angle.id)}
                        disabled={!masterReady || w?.status !== 'ready' || busy}
                        title="Suggest alignment from master audio"
                      >
                        <MdAutoFixHigh size={14} /> {busy ? 'Aligning…' : 'Auto-align'}
                      </button>
                      <button
                        type="button"
                        className="set-editor__sync-action set-editor__sync-action--ghost"
                        onClick={() => setAngleOffsets((prev) => ({ ...prev, [angle.id]: 0 }))}
                        disabled={!offset}
                        title="Reset offset to 0"
                      >
                        <MdRefresh size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
              {angles.length >= 2 && (
                <div className="set-editor__cuts-label">Cuts</div>
              )}
            </div>

            <div className="set-editor__sync-scroll" ref={syncScrollRef}>
              <div className="set-editor__sync-canvas-area" style={{ width: `${timelinePx}px` }}>
                <div
                  className="set-editor__sync-ruler"
                  onPointerDown={(e) => handleRowPointerDown(e, 'scrub')}
                  onPointerMove={handleRowPointerMove}
                  onPointerUp={handleRowPointerUp}
                  onPointerCancel={handleRowPointerUp}
                >
                  {Array.from({ length: Math.ceil(previewDuration / 10) + 1 }).map((_, i) => (
                    <div
                      key={i}
                      className="set-editor__sync-ruler-tick"
                      style={{ left: `${i * 10 * pxPerSec}px` }}
                    >
                      {i * 10}s
                    </div>
                  ))}
                </div>

                <div
                  className="set-editor__sync-row set-editor__sync-row--master"
                  onPointerDown={(e) => handleRowPointerDown(e, 'scrub')}
                  onPointerMove={handleRowPointerMove}
                  onPointerUp={handleRowPointerUp}
                  onPointerCancel={handleRowPointerUp}
                >
                  {masterReady ? (
                    <canvas ref={masterCanvasRef} className="set-editor__sync-canvas" />
                  ) : (
                    <div className="set-editor__sync-row-placeholder">
                      {master?.status === 'loading' ? 'Analyzing master audio…' :
                       master?.status === 'error' ? master.error : 'Master audio'}
                    </div>
                  )}
                </div>

                {angles.map((angle, idx) => {
                  const w = waveforms[`angle-${angle.id}`];
                  const offset = angleOffsets[angle.id] || 0;
                  const isFocused = angle.id === focusedAngleId;
                  return (
                    <div
                      key={angle.id}
                      className={`set-editor__sync-row set-editor__sync-row--angle ${isFocused ? 'set-editor__sync-row--focused' : ''}`}
                      onPointerDown={(e) => handleRowPointerDown(e, 'offset', angle.id)}
                      onPointerMove={handleRowPointerMove}
                      onPointerUp={handleRowPointerUp}
                      onPointerCancel={handleRowPointerUp}
                    >
                      {w?.status === 'ready' ? (
                        <div
                          ref={(el) => { if (el) angleWrapRefs.current[angle.id] = el; }}
                          className="set-editor__sync-row-wave"
                          style={{ transform: `translateX(${offset * pxPerSec}px)` }}
                        >
                          <canvas
                            ref={(el) => { if (el) angleCanvasRefs.current[angle.id] = el; }}
                            className="set-editor__sync-canvas"
                          />
                        </div>
                      ) : (
                        <div className="set-editor__sync-row-placeholder">
                          {w?.status === 'loading' ? `Analyzing angle ${idx + 1}…` :
                           w?.status === 'error' ? w.error : `Angle ${idx + 1}`}
                        </div>
                      )}
                    </div>
                  );
                })}

                {angles.length >= 2 && (
                  <div className="set-editor__cuts-row">
                    {cutsToSegments(cuts, previewDuration).map((seg, segIdx) => (
                      <div
                        key={`seg-${segIdx}`}
                        className={`set-editor__cut-segment set-editor__cut-segment--a${seg.angleIndex} ${focusedCutIndex === segIdx ? 'set-editor__cut-segment--focused' : ''}`}
                        style={{ left: `${seg.start * pxPerSec}px`, width: `${Math.max(0, (seg.end - seg.start) * pxPerSec)}px` }}
                        onClick={() => setFocusedCutIndex(segIdx)}
                        title={`${formatTime(seg.start)} – ${formatTime(seg.end)} · Angle ${seg.angleIndex + 1}`}
                      >
                        <span className="set-editor__cut-segment-label">A{seg.angleIndex + 1}</span>
                      </div>
                    ))}
                    {cuts.map((cut, cutIdx) => (
                      cutIdx === 0 ? null : (
                        <div
                          key={`marker-${cutIdx}`}
                          className="set-editor__cut-marker"
                          style={{ left: `${cut.timeSec * pxPerSec}px` }}
                          onPointerDown={(e) => handleCutMarkerPointerDown(e, cutIdx)}
                          onPointerMove={handleCutMarkerPointerMove}
                          onPointerUp={handleCutMarkerPointerUp}
                          onPointerCancel={handleCutMarkerPointerUp}
                          role="slider"
                          aria-label={`Cut ${cutIdx} at ${formatTime(cut.timeSec)}`}
                          aria-valuenow={Math.round(cut.timeSec)}
                          title={`Cut at ${formatTime(cut.timeSec)} — drag to move`}
                        />
                      )
                    ))}
                  </div>
                )}

                {trimInSec != null && trimInSec <= previewDuration && (
                  <div
                    className="set-editor__trim-marker set-editor__trim-marker--in"
                    style={{ transform: `translateX(${trimInSec * pxPerSec}px)` }}
                    title={`Trim IN ${formatClockTime(trimInSec)}`}
                  />
                )}
                {trimOutSec != null && trimOutSec <= previewDuration && (
                  <div
                    className="set-editor__trim-marker set-editor__trim-marker--out"
                    style={{ transform: `translateX(${trimOutSec * pxPerSec}px)` }}
                    title={`Trim OUT ${formatClockTime(trimOutSec)}`}
                  />
                )}
                <div
                  ref={playheadRef}
                  className="set-editor__sync-playhead"
                  style={{ transform: `translateX(${playheadSec * pxPerSec}px)` }}
                />
              </div>
            </div>
          </div>

          <div className="set-editor__trim">
            <span className="set-editor__trim-label">
              <MdContentCut size={14} /> Trim (optional)
            </span>
            <label className="set-editor__trim-field">
              <span>IN</span>
              <input
                type="text"
                value={trimInText}
                onChange={(e) => setTrimInText(e.target.value)}
                placeholder="0:00"
                className="set-editor__trim-input"
                aria-label="Trim in point (m:ss)"
              />
              <button
                type="button"
                className="set-editor__sync-action"
                onClick={() => setTrimInText(formatClockTime(playheadSec))}
                title="Set IN to the playhead"
              >
                @ playhead
              </button>
            </label>
            <label className="set-editor__trim-field">
              <span>OUT</span>
              <input
                type="text"
                value={trimOutText}
                onChange={(e) => setTrimOutText(e.target.value)}
                placeholder="end"
                className="set-editor__trim-input"
                aria-label="Trim out point (m:ss)"
              />
              <button
                type="button"
                className="set-editor__sync-action"
                onClick={() => setTrimOutText(formatClockTime(playheadSec))}
                title="Set OUT to the playhead"
              >
                @ playhead
              </button>
            </label>
            {(trimInText || trimOutText) && (
              <button
                type="button"
                className="set-editor__sync-action set-editor__sync-action--ghost"
                onClick={() => { setTrimInText(''); setTrimOutText(''); }}
                title="Clear trim"
              >
                <MdClose size={14} /> Clear
              </button>
            )}
            {trimInvalid && <span className="set-editor__trim-error">OUT must be after IN</span>}
            {coverageWarnStart && (
              <span className="set-editor__coverage-warning">
                Footage starts at {formatClockTime(coverageStart)} — the first frame will hold for {Math.round(coverageStart - trimWinStart)}s of audio.
              </span>
            )}
            {coverageWarnEnd && (
              <span className="set-editor__coverage-warning">
                Footage ends at {formatClockTime(coverageEnd)} — the last frame will hold for {Math.round(trimWinEnd - coverageEnd)}s of audio.
              </span>
            )}
            <span className="set-editor__trim-hint">
              Cuts dead time (camera rolling before the music) — viewers only see IN → OUT.
              Type a time like 38:20 for points beyond the preview window.
            </span>
          </div>

          <div className="set-editor__sync-help">
            <strong>Auto-align</strong> first, then verify: zoom into a hit on the master waveform, park the
            playhead on it (‹ › steps one frame), and nudge the angle (±0.01s) until the preview frame shows
            the action. Drag the ruler to scrub, drag an angle row to slide it, and use <em>Master / Angle</em>
            to A/B what you hear.
            {angles.length >= 2 && (
              <> {' '}Once synced, cut between angles on the <strong>cuts row</strong> below the waveforms:
              drag a marker to move a cut, click a segment to pick its angle or delete it, use the scissors
              (<MdContentCut size={11} />) to cut at the playhead, or press <strong>1</strong>/<strong>2</strong>/
              <strong>3</strong> while playing to live-cut to that angle.</>
            )}
          </div>

        </section>
      )}

      {step === 'post' && (
        <section className="set-editor__section">
          <button type="button" className="set-editor__back-inline" onClick={handleBackToEdit}>
            <MdArrowBack size={16} /> Back to sync
          </button>
          <h2 className="set-editor__section-title">Post details</h2>

          <div className="set-editor__post-field">
            <label className="set-editor__post-label">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Live Set at Club XYZ"
              className="set-editor__post-input"
              maxLength={120}
            />
          </div>

          <div className="set-editor__post-field">
            <label className="set-editor__post-label">Link a setup (required)</label>
            <p className="set-editor__post-hint">Lets viewers copy your gear from the clip.</p>
            {loadingSetups ? (
              <div className="set-editor__post-loading">Loading setups…</div>
            ) : savedSetups.length === 0 ? (
              <div className="set-editor__post-empty">No saved setups yet. Save a setup first from the scene view.</div>
            ) : (
              <div className="set-editor__setup-list">
                {savedSetups.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={`set-editor__setup-option ${selectedSetupId === s.id ? 'active' : ''}`}
                    onClick={() => setSelectedSetupId((prev) => prev === s.id ? '' : s.id)}
                  >
                    <span className="set-editor__setup-option-icon">
                      {s.setupType === 'DJ' ? <MdHeadphones size={18} /> : s.setupType === 'Producer' ? <MdPiano size={18} /> : <IoMusicalNotes size={18} />}
                    </span>
                    <span className="set-editor__setup-option-name">{s.name || 'Untitled'}</span>
                    <span className="set-editor__setup-option-type">{s.setupType || 'DJ'}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="set-editor__post-field">
            <label className="set-editor__post-label">Feed clips</label>
            <p className="set-editor__post-hint">
              Pick 1–3 segments ({CLIP_MIN_SEC}s–{CLIP_MAX_SEC}s each) for the feed. The full set lives on your profile.
            </p>
            <div className="set-editor__clip-count" role="group" aria-label="Number of clips">
              <span className="set-editor__clip-count-label">Clips:</span>
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`set-editor__clip-count-btn ${numClips === n ? 'active' : ''}`}
                  onClick={() => handleNumClipsChange(n)}
                >
                  {n}
                </button>
              ))}
              {numClips > 1 && Array.from({ length: numClips }, (_, i) => (
                <button
                  key={`tab-${i}`}
                  type="button"
                  className={`set-editor__clip-tab ${activeClipIndex === i ? 'active' : ''}`}
                  onClick={() => handleSelectClipTab(i)}
                >
                  Clip {i + 1}
                </button>
              ))}
            </div>
            <div className="set-editor__clip-video-wrap">
              <video
                ref={clipVideoRef}
                src={angles[0]?.url}
                muted={!!audio}
                preload="metadata"
                playsInline
                className="set-editor__clip-video"
              />
              <button
                type="button"
                className="set-editor__play-btn set-editor__clip-play-btn"
                onClick={toggleClipPreviewPlay}
                aria-label={clipPreviewPlaying ? 'Pause preview' : 'Play preview'}
              >
                {clipPreviewPlaying ? <MdPause size={20} /> : <MdPlayArrow size={20} />}
              </button>
            </div>
            {/* Hidden master track — the muted video above drives it, so clip
                previews are heard with the aligned lossless audio. Without a
                master track (4b) the video plays unmuted — camera audio IS
                the audio — so this element is never rendered. */}
            {audio?.url && <audio ref={clipAudioRef} src={audio.url} preload="auto" style={{ display: 'none' }} />}
            <div
              ref={clipTimelineRef}
              className="set-editor__clip-timeline"
              onClick={handleClipTimelineClick}
              role="group"
              aria-label={`Clip ${activeClipIndex + 1} range`}
            >
              <div className="set-editor__clip-track" />
              {(() => {
                const r = clipRanges[activeClipIndex] || { start: 0, end: CLIP_MIN_SEC };
                const pct = (t) => (clipTimelineDuration ? (t / clipTimelineDuration) * 100 : 0);
                return (
                  <>
                    <div
                      className="set-editor__clip-range"
                      style={{ left: `${pct(r.start)}%`, width: `${Math.max(0, pct(r.end) - pct(r.start))}%` }}
                      onPointerDown={handleClipRangePointerDown}
                      onPointerMove={handleClipThumbPointerMove}
                      onPointerUp={handleClipThumbPointerUp}
                      onPointerCancel={handleClipThumbPointerUp}
                      role="slider"
                      aria-label="Move clip window"
                      aria-valuenow={Math.round(r.start)}
                    />
                    <div
                      className="set-editor__clip-thumb"
                      style={{ left: `${pct(r.start)}%` }}
                      onPointerDown={handleClipThumbPointerDown('start')}
                      onPointerMove={handleClipThumbPointerMove}
                      onPointerUp={handleClipThumbPointerUp}
                      onPointerCancel={handleClipThumbPointerUp}
                      role="slider"
                      aria-label="Clip start"
                      aria-valuenow={Math.round(r.start)}
                    />
                    <div
                      className="set-editor__clip-thumb"
                      style={{ left: `${pct(r.end)}%` }}
                      onPointerDown={handleClipThumbPointerDown('end')}
                      onPointerMove={handleClipThumbPointerMove}
                      onPointerUp={handleClipThumbPointerUp}
                      onPointerCancel={handleClipThumbPointerUp}
                      role="slider"
                      aria-label="Clip end"
                      aria-valuenow={Math.round(r.end)}
                    />
                  </>
                );
              })()}
            </div>
            <div className="set-editor__clip-labels">
              {(() => {
                const r = clipRanges[activeClipIndex] || { start: 0, end: CLIP_MIN_SEC };
                return (
                  <>
                    <span>{formatTime(r.start)}</span>
                    <span>{(r.end - r.start).toFixed(1)}s selected</span>
                    <span>{formatTime(r.end)}</span>
                  </>
                );
              })()}
            </div>
          </div>

          <div className="set-editor__post-summary">
            Posting <strong>{angles.length}</strong> angle{angles.length === 1 ? '' : 's'} (Angle 1 will be the primary video){audio ? ' with master audio replacing the video audio' : " — the camera's own audio will be used"}, plus <strong>{numClips}</strong> clip{numClips === 1 ? '' : 's'} to the feed.
            {angles.length >= 2 && (
              <> Viewers will see <strong>{cuts.length - 1}</strong> cut{cuts.length - 1 === 1 ? '' : 's'} switching between angles.</>
            )}
            {audio && (trimInSec != null || trimOutSec != null) && (
              <> Trimmed to <strong>{trimInSec != null ? formatClockTime(trimInSec) : 'start'} → {trimOutSec != null ? formatClockTime(trimOutSec) : 'end'}</strong>.</>
            )}
          </div>

          {uploading ? (
            <div className="set-editor__progress">
              <div className="set-editor__progress-bar">
                <div className="set-editor__progress-fill" style={{ width: `${uploadProgress}%` }} />
              </div>
              <div className="set-editor__progress-text">{Math.round(uploadProgress)}%</div>
            </div>
          ) : (
            <button
              type="button"
              className="set-editor__primary set-editor__primary--full"
              onClick={handlePost}
              disabled={!selectedSetupId}
              title={!selectedSetupId ? 'Link a setup to post' : 'Post'}
            >
              Post set
            </button>
          )}
        </section>
      )}

      <footer className="set-editor__footer">
        <div className="set-editor__footer-status">
          {step === 'post'
            ? 'Add a title (optional) and link a setup, then post.'
            : angles.length === 0
            ? 'Add at least one angle to continue.'
            : `${angles.length} angle${angles.length === 1 ? '' : 's'}${audio ? ' + master audio' : noMasterAudioMode ? ' (camera audio)' : ''} loaded.`}
        </div>
        {step === 'edit' && (
          <button
            type="button"
            className="set-editor__primary"
            disabled={!canContinueToPost}
            onClick={handleContinueToPost}
            title={
              angles.length === 0 ? 'Add at least one angle'
                : !audio && !noMasterAudio ? 'Add a master audio track, or check "Post without master audio"'
                : !audio ? 'Posting without master audio only supports one angle'
                : !allWaveformsReady ? 'Waiting for waveforms…'
                : 'Continue to post'
            }
          >
            Continue to post
          </button>
        )}
      </footer>
    </div>
  );
}

export default SetEditor;
