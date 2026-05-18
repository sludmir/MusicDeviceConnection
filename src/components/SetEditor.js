import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { MdArrowBack, MdAdd, MdClose, MdMusicNote, MdVideocam, MdImage, MdAutoFixHigh, MdRefresh } from 'react-icons/md';
import { extractPeaks, WAVEFORM_DEFAULTS } from '../utils/audioWaveform';
import { suggestOffsetSeconds } from '../utils/audioAlign';
import './SetEditor.css';

const PX_PER_SEC_DEFAULT = 40;
const PX_PER_SEC_MIN = 10;
const PX_PER_SEC_MAX = 160;
const ROW_HEIGHT = 72;

const MAX_ANGLES = 3;
const MAX_VIDEO_SIZE_MB = 5000;
const MAX_VIDEO_SIZE_BYTES = MAX_VIDEO_SIZE_MB * 1024 * 1024;
const MAX_AUDIO_SIZE_MB = 500;
const MAX_AUDIO_SIZE_BYTES = MAX_AUDIO_SIZE_MB * 1024 * 1024;
const MAX_THUMBNAIL_SIZE_MB = 5;
const MAX_THUMBNAIL_SIZE_BYTES = MAX_THUMBNAIL_SIZE_MB * 1024 * 1024;

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
  const [angles, setAngles] = useState([]); // { id, file, url, duration }
  const [audio, setAudio] = useState(null); // { file, url, duration }
  const [thumbnail, setThumbnail] = useState(null); // { file, url }
  const [error, setError] = useState(null);

  const angleInputRef = useRef(null);
  const audioInputRef = useRef(null);
  const thumbnailInputRef = useRef(null);
  const angleIdRef = useRef(0);

  // ── Sync state ─────────────────────────────────────────────────────
  // waveforms: keyed by 'master' or `angle-${id}` → { status, peaks, peaksPerSecond, durationSeconds, previewDurationSeconds, error }
  const [waveforms, setWaveforms] = useState({});
  // angleOffsets: { [angleId]: offsetSeconds } — committed offsets (drag uses ref during motion, commits here on release)
  const [angleOffsets, setAngleOffsets] = useState({});
  const [playheadSec, setPlayheadSec] = useState(0);
  const [pxPerSec, setPxPerSec] = useState(PX_PER_SEC_DEFAULT);
  const [autoAligning, setAutoAligning] = useState({}); // { [angleId]: true }

  const syncScrollRef = useRef(null);
  const playheadRef = useRef(null);
  const angleCanvasRefs = useRef({}); // { [angleId]: HTMLCanvasElement }
  const angleWrapRefs = useRef({});   // { [angleId]: HTMLDivElement } — for transform during drag
  const dragRef = useRef({ kind: null }); // 'scrub' | 'offset' | null
  const rafRef = useRef(0);

  // Schedule peak extraction whenever underlying files change.
  useEffect(() => {
    return () => {
      angles.forEach((a) => a.url && URL.revokeObjectURL(a.url));
      if (audio?.url) URL.revokeObjectURL(audio.url);
      if (thumbnail?.url) URL.revokeObjectURL(thumbnail.url);
    };
  }, [angles, audio, thumbnail]);

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
    extractPeaks(audio.file)
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
          extractPeaks(angle.file)
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

  // ── Derived ────────────────────────────────────────────────────────
  const master = waveforms.master;
  const masterReady = master?.status === 'ready';
  const syncEnabled = angles.length >= 1 && audio;
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

  const canAddAngle = angles.length < MAX_ANGLES;
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
      canvas.width = totalWidthPx * dpr;
      canvas.height = heightPx * dpr;
      canvas.style.width = `${totalWidthPx}px`;
      canvas.style.height = `${heightPx}px`;
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, totalWidthPx, heightPx);
      ctx.fillStyle = canvas.dataset.color || (isDark ? 'rgba(0, 162, 255, 0.85)' : 'rgba(0, 102, 255, 0.85)');
      const half = heightPx / 2;
      const pxPerPeak = pxPerSec / peaksPerSecond;
      const barWidth = Math.max(1, pxPerPeak - 0.5);
      for (let i = 0; i < peaks.length; i++) {
        const x = Math.floor(i * pxPerPeak);
        const h = Math.max(1, peaks[i] * (heightPx - 4));
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
  }, [pxPerSec, previewDuration]);

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
              <span className="set-editor__add-hint">Up to {MAX_ANGLES}</span>
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
            <audio className="set-editor__card-audio" src={audio.url} controls />
            <div className="set-editor__card-meta">
              <div className="set-editor__card-name">{audio.file.name}</div>
              <div className="set-editor__card-stats">
                {formatFileSize(audio.file.size)} · {audio.duration ? `${Math.round(audio.duration)}s` : '—'}
              </div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="set-editor__add-card set-editor__add-card--wide"
            onClick={() => audioInputRef.current?.click()}
          >
            <MdMusicNote size={28} />
            <span>Add master audio</span>
            <span className="set-editor__add-hint">Lossless preferred — replaces video audio</span>
          </button>
        )}

        <input
          ref={audioInputRef}
          type="file"
          accept="audio/*"
          onChange={handleSetAudio}
          style={{ display: 'none' }}
        />
      </section>

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

      {syncEnabled && (
        <section className="set-editor__section">
          <div className="set-editor__section-header">
            <h2 className="set-editor__section-title">Sync</h2>
            <div className="set-editor__sync-tools">
              <span className="set-editor__sync-time">{formatTime(playheadSec)}</span>
              <button type="button" className="set-editor__zoom-btn" onClick={zoomOut} aria-label="Zoom out">−</button>
              <span className="set-editor__zoom-readout">{pxPerSec} px/s</span>
              <button type="button" className="set-editor__zoom-btn" onClick={zoomIn} aria-label="Zoom in">+</button>
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
                  <div key={angle.id} className="set-editor__sync-label-row">
                    <div className="set-editor__sync-label-name">Angle {idx + 1}</div>
                    <div className="set-editor__sync-label-status">
                      {w?.status === 'loading' && 'Analyzing…'}
                      {w?.status === 'error' && (w.code === 'FILE_TOO_LARGE' ? 'Too large for preview' : 'Error')}
                      {w?.status === 'ready' && (
                        <span>offset {formatTime(offset)}</span>
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
                  return (
                    <div
                      key={angle.id}
                      className="set-editor__sync-row"
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

                <div
                  ref={playheadRef}
                  className="set-editor__sync-playhead"
                  style={{ transform: `translateX(${playheadSec * pxPerSec}px)` }}
                />
              </div>
            </div>
          </div>

          <div className="set-editor__sync-help">
            Drag <strong>master</strong> row or ruler to scrub. Drag an <strong>angle</strong> row to slide it in time.
            Click <em>Auto-align</em> to suggest an offset from waveform correlation.
          </div>
        </section>
      )}

      <footer className="set-editor__footer">
        <div className="set-editor__footer-status">
          {angles.length === 0
            ? 'Add at least one angle to continue.'
            : `${angles.length} angle${angles.length === 1 ? '' : 's'}${audio ? ' + master audio' : ''} loaded.`}
        </div>
        <button
          type="button"
          className="set-editor__primary"
          disabled={angles.length === 0}
          title={angles.length === 0 ? 'Add an angle first' : 'Sync (coming next)'}
        >
          Continue to sync
        </button>
      </footer>
    </div>
  );
}

export default SetEditor;
