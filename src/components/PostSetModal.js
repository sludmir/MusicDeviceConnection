import React, { useState, useRef, useEffect, useCallback } from 'react';
import { IoArrowBack } from 'react-icons/io5';
import { collection, addDoc, serverTimestamp, query, where, getDocs, orderBy } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, auth } from '../firebaseConfig';
import { createBunnyVideo, uploadToBunny } from '../utils/bunnyStream';
import './PostSetModal.css';

const PIXELS_PER_SECOND = 80;
const WAVEFORM_HEIGHT = 80;
const SET_MIN_SEC = 5 * 60;   // 5 min – full set minimum
const SET_MAX_SEC = 90 * 60;  // 1 hr 30 min – full set maximum
const CLIP_MIN_SEC = 10;      // 10 sec – clip minimum
const CLIP_MAX_SEC = 60;      // 1 min – clip maximum
const MAX_AUDIO_SIZE_MB = 200;
const MAX_AUDIO_SIZE_BYTES = MAX_AUDIO_SIZE_MB * 1024 * 1024;
const MAX_VIDEO_SIZE_MB = 10000; // Bunny Stream upload (10GB)
const MAX_VIDEO_SIZE_BYTES = MAX_VIDEO_SIZE_MB * 1024 * 1024;
const LARGE_VIDEO_WARN_MB = 1000; // Warn above 1GB for UX/perf
const LARGE_VIDEO_WARN_BYTES = LARGE_VIDEO_WARN_MB * 1024 * 1024;
const MAX_THUMBNAIL_SIZE_MB = 5;
const MAX_THUMBNAIL_SIZE_BYTES = MAX_THUMBNAIL_SIZE_MB * 1024 * 1024;

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
}

function getValidDuration(value) {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function normalizeClipRange(range, durationSec) {
  const dur = getValidDuration(durationSec);
  if (!dur) {
    return { start: 0, end: CLIP_MIN_SEC };
  }

  const maxStart = Math.max(0, dur - CLIP_MIN_SEC);
  const rawStart = Number(range?.start);
  const rawEnd = Number(range?.end);
  const fallbackEnd = Math.min(dur, Math.max(CLIP_MIN_SEC, dur));

  let start = Number.isFinite(rawStart) ? rawStart : 0;
  let end = Number.isFinite(rawEnd) ? rawEnd : fallbackEnd;

  start = Math.max(0, Math.min(maxStart, start));
  end = Math.max(start + CLIP_MIN_SEC, end);
  end = Math.min(dur, start + CLIP_MAX_SEC, end);

  if (end - start < CLIP_MIN_SEC) {
    start = Math.max(0, Math.min(maxStart, end - CLIP_MIN_SEC));
    end = Math.min(dur, start + CLIP_MIN_SEC);
  }

  return {
    start: Number(start.toFixed(2)),
    end: Number(end.toFixed(2)),
  };
}

function PostSetModal({ onClose, theme = 'light', onSuccess }) {
  const [step, setStep] = useState(1);
  const [videoFile, setVideoFile] = useState(null);
  const [videoURL, setVideoURL] = useState(null);
  const [audioFile, setAudioFile] = useState(null);
  const [audioURL, setAudioURL] = useState(null);
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [thumbnailURL, setThumbnailURL] = useState(null);
  const [audioBuffer, setAudioBuffer] = useState(null);
  const [offsetSeconds, setOffsetSeconds] = useState(0);
  const [waveformReady, setWaveformReady] = useState(false);
  const [error, setError] = useState(null);
  const [audioSource, setAudioSource] = useState('video');
  const [numClips, setNumClips] = useState(1);
  const [clipRanges, setClipRanges] = useState([{ start: 0, end: 10 }]);
  const [activeClipIndex, setActiveClipIndex] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [dragging, setDragging] = useState(null);
  const [title, setTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [savedSetups, setSavedSetups] = useState([]);
  const [selectedSetupId, setSelectedSetupId] = useState('');
  const [loadingSetups, setLoadingSetups] = useState(false);

  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const waveformCanvasRef = useRef(null);
  const scrollRef = useRef(null);
  const waveformWrapRef = useRef(null);
  const audioContextRef = useRef(null);
  const timelineRef = useRef(null);
  const step2VideoRef = useRef(null);
  const audioInputRef = useRef(null);
  const thumbnailInputRef = useRef(null);
  const clipRangesRef = useRef(clipRanges);
  clipRangesRef.current = clipRanges;

  const isDark = theme === 'dark';
  const useTrackAudio = audioSource === 'track';

  useEffect(() => {
    if (step !== 2 || !auth.currentUser) return;
    let cancelled = false;
    const fetchSetups = async () => {
      setLoadingSetups(true);
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
    };
    fetchSetups();
    return () => { cancelled = true; };
  }, [step]);

  const videoURLRef = useRef(null);
  const audioURLRef = useRef(null);
  const thumbnailURLRef = useRef(null);
  videoURLRef.current = videoURL;
  audioURLRef.current = audioURL;
  thumbnailURLRef.current = thumbnailURL;

  useEffect(() => {
    return () => {
      if (videoURLRef.current) URL.revokeObjectURL(videoURLRef.current);
      if (audioURLRef.current) URL.revokeObjectURL(audioURLRef.current);
      if (thumbnailURLRef.current) URL.revokeObjectURL(thumbnailURLRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, []);

  const handleThumbnailChange = (e) => {
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
    if (thumbnailURLRef.current) URL.revokeObjectURL(thumbnailURLRef.current);
    const url = URL.createObjectURL(file);
    setError(null);
    setThumbnailFile(file);
    setThumbnailURL(url);
  };

  const handleRemoveThumbnail = () => {
    if (thumbnailURLRef.current) URL.revokeObjectURL(thumbnailURLRef.current);
    setThumbnailFile(null);
    setThumbnailURL(null);
    if (thumbnailInputRef.current) thumbnailInputRef.current.value = '';
  };

  const handleVideoChange = (e) => {
    const file = e.target.files?.[0];
    const input = e.target;
    if (!file || !file.type.startsWith('video/')) {
      setError('Please select a video file');
      if (input) input.value = '';
      return;
    }
    if (file.size > MAX_VIDEO_SIZE_BYTES) {
      setError(`Video file is too large (${formatFileSize(file.size)}). Max ${MAX_VIDEO_SIZE_MB} MB.`);
      if (input) input.value = '';
      return;
    }
    if (file.size > LARGE_VIDEO_WARN_BYTES) {
      const proceed = window.confirm(
        `This file is large (${formatFileSize(file.size)}). It may take a while to load and upload. Continue?`
      );
      if (!proceed) {
        if (input) input.value = '';
        return;
      }
    }
    if (audioURL) URL.revokeObjectURL(audioURL);
    if (audioInputRef.current) audioInputRef.current.value = '';
    if (audioRef.current) audioRef.current.pause();
    setAudioFile(null);
    setAudioURL(null);
    setAudioBuffer(null);
    setWaveformReady(false);
    setOffsetSeconds(0);
    setAudioSource('video');
    setVideoDuration(0);
    setClipRanges([{ start: 0, end: 10 }]);
    setActiveClipIndex(0);
    setNumClips(1);
    setStep(1);
    setTitle('');
    setSelectedSetupId('');
    setUploadProgress(0);
    setUploading(false);
    if (step2VideoRef.current) step2VideoRef.current.currentTime = 0;
    if (videoRef.current) videoRef.current.currentTime = 0;
    if (videoURL) URL.revokeObjectURL(videoURL);
    setError(null);
    setVideoFile(file);
    setVideoURL(URL.createObjectURL(file));
    if (input) input.value = '';
  };

  const resetVideoSelection = () => {
    if (videoURL) URL.revokeObjectURL(videoURL);
    setVideoFile(null);
    setVideoURL(null);
    setVideoDuration(0);
    setClipRanges([{ start: 0, end: 10 }]);
    setNumClips(1);
    setActiveClipIndex(0);
    setStep(1);
    setError(null);
    setUploadProgress(0);
    setUploading(false);
    if (videoRef.current) videoRef.current.currentTime = 0;
    if (step2VideoRef.current) step2VideoRef.current.currentTime = 0;
    if (audioURL) URL.revokeObjectURL(audioURL);
    if (audioInputRef.current) audioInputRef.current.value = '';
    if (audioRef.current) audioRef.current.pause();
    setAudioFile(null);
    setAudioURL(null);
    setAudioBuffer(null);
    setWaveformReady(false);
    setOffsetSeconds(0);
    setAudioSource('video');
    setSelectedSetupId('');
  };

  const handleAudioChange = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('audio/') && !file.type.includes('mpeg')) {
      setError('Please select an audio file (e.g. MP3, WAV)');
      e.target.value = '';
      return;
    }
    if (file.size > MAX_AUDIO_SIZE_BYTES) {
      setError(`Audio file is too large (${formatFileSize(file.size)}). Max ${MAX_AUDIO_SIZE_MB} MB for waveform.`);
      e.target.value = '';
      return;
    }
    if (audioURL) URL.revokeObjectURL(audioURL);
    setError(null);
    setAudioFile(file);
    const url = URL.createObjectURL(file);
    setAudioURL(url);
    setWaveformReady(false);
    setAudioBuffer(null);

    try {
      const ctx = audioContextRef.current || new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = ctx;
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = await res.arrayBuffer();
      if (buf.byteLength === 0) throw new Error('File is empty');
      const decoded = await new Promise((resolve, reject) => {
        ctx.decodeAudioData(buf.slice(0), resolve, reject);
      });
      setAudioBuffer(decoded);
      setWaveformReady(true);
    } catch (err) {
      console.error('Audio decode error:', err);
      const msg = err?.message || '';
      const isDecodeError = /decode|not support|invalid/i.test(msg);
      const friendly = isDecodeError
        ? 'This file couldn\'t be decoded. Try WAV or re-export the audio (e.g. from your DAW) as WAV or MP3.'
        : (msg ? `Could not load audio: ${msg}` : 'Could not load audio for waveform');
      setError(friendly);
    }
    e.target.value = '';
  }, [audioURL]);

  useEffect(() => {
    if (!audioBuffer || !waveformCanvasRef.current) return;
    const canvas = waveformCanvasRef.current;
    const ctx = canvas.getContext('2d');
    const duration = audioBuffer.duration;
    const minWidth = scrollRef.current?.clientWidth || 800;
    const width = Math.max(Math.ceil(duration * PIXELS_PER_SECOND), minWidth);
    const height = WAVEFORM_HEIGHT;
    canvas.width = width;
    canvas.height = height;

    const data = audioBuffer.getChannelData(0);
    const step = Math.ceil(data.length / width);
    const amp = height / 2;

    ctx.fillStyle = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = isDark ? 'rgba(0, 162, 255, 0.7)' : 'rgba(0, 100, 200, 0.8)';

    for (let i = 0; i < width; i++) {
      const start = i * step;
      let min = 1, max = -1;
      for (let j = 0; j < step && start + j < data.length; j++) {
        const v = data[start + j];
        if (v < min) min = v;
        if (v > max) max = v;
      }
      const yMin = amp + min * amp;
      const yMax = amp + max * amp;
      ctx.fillRect(i, Math.min(yMin, yMax), 1, Math.abs(yMax - yMin) || 1);
    }
  }, [audioBuffer, waveformReady, isDark]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const sec = el.scrollLeft / PIXELS_PER_SECOND;
    setOffsetSeconds(sec);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', handleScroll);
    return () => el.removeEventListener('scroll', handleScroll);
  }, [handleScroll, waveformReady]);

  const syncAudioToVideo = useCallback(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!audio || !video || !audioURL || !useTrackAudio) return;
    const target = video.currentTime + offsetSeconds;
    audio.currentTime = Math.max(0, target);
  }, [offsetSeconds, audioURL, useTrackAudio]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onSeeked = () => {
      setTimeout(() => syncAudioToVideo(), 0);
    };
    video.addEventListener('seeked', onSeeked);
    return () => video.removeEventListener('seeked', onSeeked);
  }, [syncAudioToVideo, videoURL]);

  const handleVideoPlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.readyState < 2 && videoURL) {
      video.src = videoURL;
      video.load();
    }
    if (useTrackAudio && audioRef.current && audioURL) {
      video.muted = true;
      const target = (video.currentTime || 0) + offsetSeconds;
      audioRef.current.currentTime = Math.max(0, target);
      audioRef.current.play().catch(() => {});
    } else {
      video.muted = false;
      if (audioRef.current) audioRef.current.pause();
    }
    video.play().catch(() => {});
  };

  const handleVideoPause = () => {
    if (audioRef.current) audioRef.current.pause();
    const video = videoRef.current;
    if (video && !useTrackAudio) video.muted = false;
  };

  const handleVideoError = useCallback(() => {
    const video = videoRef.current;
    if (video && videoURL) {
      video.src = '';
      video.load();
      video.src = videoURL;
      video.load();
    }
    setError('Video had a playback issue. Try playing again or re-upload.');
  }, [videoURL]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = useTrackAudio;
  }, [useTrackAudio, videoURL]);

  const scrollWaveformToTime = useCallback((timeSeconds) => {
    const el = scrollRef.current;
    if (!el) return;
    const center = el.clientWidth / 2;
    const targetScroll = timeSeconds * PIXELS_PER_SECOND - center;
    el.scrollLeft = Math.max(0, targetScroll);
  }, []);

  useEffect(() => {
    if (!useTrackAudio || !audioURL || !scrollRef.current) return;
    const audio = audioRef.current;
    if (!audio) return;
    const onTimeUpdate = () => {
      scrollWaveformToTime(audio.currentTime);
    };
    audio.addEventListener('timeupdate', onTimeUpdate);
    return () => audio.removeEventListener('timeupdate', onTimeUpdate);
  }, [useTrackAudio, audioURL, scrollWaveformToTime]);

  const handleScrollToOffset = (e) => {
    const el = scrollRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left + el.scrollLeft;
    const sec = x / PIXELS_PER_SECOND;
    setOffsetSeconds(Math.max(0, sec));
    el.scrollLeft = Math.max(0, sec * PIXELS_PER_SECOND);
  };

  const handleStep1VideoLoaded = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    const dur = v.duration;
    if (dur && !Number.isNaN(dur)) setVideoDuration(dur);
  }, []);

  const getBestKnownVideoDuration = useCallback(() => {
    const refDuration = step2VideoRef.current?.duration;
    return getValidDuration(refDuration) || getValidDuration(videoDuration);
  }, [videoDuration]);

  const handleStep2VideoLoaded = useCallback(() => {
    const v = step2VideoRef.current;
    if (!v) return;
    const dur = getValidDuration(v.duration);
    if (!dur) return;
    setVideoDuration(dur);
    setClipRanges((prev) => {
      if (!Array.isArray(prev) || prev.length === 0) {
        return [normalizeClipRange({ start: 0, end: CLIP_MIN_SEC }, dur)];
      }
      return prev.map((range) => normalizeClipRange(range, dur));
    });
  }, []);

  const percentToTime = useCallback((p) => Math.max(0, Math.min(videoDuration, (p / 100) * videoDuration)), [videoDuration]);
  const timeToPercent = (t) => (videoDuration > 0 ? (t / videoDuration) * 100 : 0);

  const updateClipRange = useCallback((newStart, newEnd, seekVideo = true) => {
    let start = newStart;
    let end = newEnd;
    if (end - start > CLIP_MAX_SEC) end = start + CLIP_MAX_SEC;
    if (end - start < CLIP_MIN_SEC) {
      if (dragging === 'end') start = end - CLIP_MIN_SEC;
      else end = start + CLIP_MIN_SEC;
    }
    start = Math.max(0, Math.min(videoDuration - CLIP_MIN_SEC, start));
    end = Math.max(CLIP_MIN_SEC, Math.min(videoDuration, end));
    const i = activeClipIndex;
    setClipRanges((prev) => {
      const next = [...prev];
      next[i] = { start: Number(start.toFixed(2)), end: Number(end.toFixed(2)) };
      return next;
    });
    if (seekVideo && step2VideoRef.current) step2VideoRef.current.currentTime = start;
  }, [videoDuration, dragging, activeClipIndex]);

  const handleTimelineClick = (e) => {
    if (!timelineRef.current || !videoDuration) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const p = (e.clientX - rect.left) / rect.width;
    const t = percentToTime(p * 100);
    if (step2VideoRef.current) step2VideoRef.current.currentTime = t;
  };

  const handleThumbMouseDown = (which) => (e) => {
    e.preventDefault();
    setDragging(which);
  };

  useEffect(() => {
    if (!dragging || !timelineRef.current || !videoDuration) return;
    const onMove = (e) => {
      const rect = timelineRef.current.getBoundingClientRect();
      const p = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const t = percentToTime(p * 100);
      const ranges = clipRangesRef.current;
      const i = activeClipIndex;
      const start = (ranges[i] || {}).start ?? 0;
      const end = (ranges[i] || {}).end ?? 0;
      if (dragging === 'start') updateClipRange(t, end, true);
      else updateClipRange(start, t, false);
    };
    const onUp = () => setDragging(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging, videoDuration, percentToTime, updateClipRange, activeClipIndex]);

  const handleNext = () => {
    if (!videoURL) return;
    setError(null);
    const dur = videoRef.current?.duration ?? videoDuration;
    if (!dur || Number.isNaN(dur)) {
      setError('Load the video first (wait for it to load)');
      return;
    }
    if (dur < SET_MIN_SEC) {
      setError(`Set must be at least ${SET_MIN_SEC / 60} minutes. Yours is ${(dur / 60).toFixed(1)} min.`);
      return;
    }
    if (dur > SET_MAX_SEC) {
      setError(`Set must be at most ${SET_MAX_SEC / 60} minutes (1 hr 30 min). Yours is ${(dur / 60).toFixed(1)} min.`);
      return;
    }
    setVideoDuration(dur);
    setStep(2);
  };

  const handleBack = () => {
    setError(null);
    setStep(1);
  };

  const handleNumClipsChange = (n) => {
    setNumClips(n);
    setClipRanges((prev) => {
      const next = prev.slice(0, n);
      const dur = getBestKnownVideoDuration();
      if (!dur) {
        while (next.length < n) {
          const last = next[next.length - 1];
          const start = Number.isFinite(last?.end) ? last.end + 30 : 0;
          next.push({
            start: Number(start.toFixed(2)),
            end: Number((start + CLIP_MIN_SEC).toFixed(2)),
          });
        }
        return next;
      }

      for (let i = 0; i < next.length; i++) {
        next[i] = normalizeClipRange(next[i], dur);
      }

      if (next.length === 0) {
        next.push(normalizeClipRange({ start: 0, end: CLIP_MIN_SEC }, dur));
      }

      while (next.length < n) {
        const last = next[next.length - 1];
        const maxStart = Math.max(0, dur - CLIP_MIN_SEC);
        const start = last ? Math.min(last.end + 30, maxStart) : 0;
        next.push(normalizeClipRange({ start, end: start + CLIP_MIN_SEC }, dur));
      }
      return next;
    });
    setActiveClipIndex((prev) => Math.min(prev, n - 1));
  };

  const handlePost = async () => {
    const dur = getBestKnownVideoDuration();
    if (!dur) {
      setError('Video duration is not ready yet. Please wait for the clip preview to load.');
      return;
    }
    const rangesToPost = clipRanges.slice(0, numClips).map((range) => normalizeClipRange(range, dur));
    for (let i = 0; i < rangesToPost.length; i++) {
      const r = rangesToPost[i];
      const start = Number(r?.start);
      const end = Number(r?.end);
      if (!Number.isFinite(start) || !Number.isFinite(end)) {
        setError(`Clip ${i + 1} has invalid range values`);
        return;
      }
      if (end <= start) {
        setError(`Clip ${i + 1} must end after it starts`);
        return;
      }
      const duration = end - start;
      if (duration < CLIP_MIN_SEC) {
        setError(`Clip ${i + 1} must be at least ${CLIP_MIN_SEC} seconds`);
        return;
      }
      if (duration > CLIP_MAX_SEC) {
        setError(`Clip ${i + 1} must be at most ${CLIP_MAX_SEC} seconds (1 min)`);
        return;
      }
    }
    if (!auth.currentUser) {
      setError('Please sign in to post');
      return;
    }
    if (!videoFile) {
      setError('Missing video file');
      return;
    }
    if (!selectedSetupId) {
      setError('Please link a saved setup so viewers can copy your gear');
      return;
    }

    setUploading(true);
    setError(null);
    const storage = getStorage();
    const userId = auth.currentUser.uid;
    const creatorName = auth.currentUser.displayName || auth.currentUser.email?.split('@')[0] || 'Unknown';

    try {
      // 1. Reserve a Bunny Stream video and get a one-shot upload URL.
      const bunny = await createBunnyVideo({
        title: (title || videoFile.name || 'Untitled Set').trim().slice(0, 200),
        kind: 'set',
      });

      // 2. Upload the video file directly to Bunny with progress.
      await uploadToBunny(
        videoFile,
        { uploadUrl: bunny.uploadUrl, uploadHeaders: bunny.uploadHeaders },
        (fraction) => setUploadProgress(Math.min(100, Math.round(fraction * 100)))
      );

      // 3. Audio track (optional) still goes to Firebase Storage — small file, cheap, simpler.
      let audioTrackURL = null;
      if (audioFile) {
        const audioName = (audioFile.name || 'audio').replace(/[^a-zA-Z0-9._-]/g, '_');
        const audioStorageRef = ref(storage, `sets/audio/${userId}_${Date.now()}_${audioName}`);
        await uploadBytes(audioStorageRef, audioFile);
        audioTrackURL = await getDownloadURL(audioStorageRef);
      }

      // 3b. Custom thumbnail (optional) — Firebase Storage, overrides Bunny's auto-thumbnail.
      let customThumbnailURL = null;
      if (thumbnailFile) {
        const thumbName = (thumbnailFile.name || 'thumb').replace(/[^a-zA-Z0-9._-]/g, '_');
        const thumbStorageRef = ref(storage, `sets/thumbnails/${userId}_${Date.now()}_${thumbName}`);
        await uploadBytes(thumbStorageRef, thumbnailFile);
        customThumbnailURL = await getDownloadURL(thumbStorageRef);
      }

      // 4. Write the Firestore docs. status='processing' until Bunny webhook flips to 'ready'.
      const linkedSetup = savedSetups.find(s => s.id === selectedSetupId);
      const setData = {
        creatorId: userId,
        creatorName,
        title: (title || 'Untitled Set').trim(),
        description: '',
        videoURL: bunny.hlsUrl,
        thumbnailURL: customThumbnailURL || bunny.thumbnailUrl,
        bunnyVideoGuid: bunny.videoGuid,
        bunnyLibraryId: bunny.libraryId,
        status: 'processing',
        durationSeconds: videoDuration,
        createdAt: serverTimestamp(),
        views: 0,
      };
      if (customThumbnailURL) {
        setData.customThumbnailURL = customThumbnailURL;
        setData.autoThumbnailURL = bunny.thumbnailUrl;
      }
      if (selectedSetupId && linkedSetup) {
        setData.setupId = selectedSetupId;
        setData.setupName = linkedSetup.name || '';
        setData.setupType = linkedSetup.setupType || 'DJ';
      }
      if (audioTrackURL != null) {
        setData.audioTrackURL = audioTrackURL;
        setData.audioOffsetSeconds = offsetSeconds;
        setData.audioReplacesVideo = true;
      }
      const setDocRef = await addDoc(collection(db, 'sets'), setData);

      const baseClipData = {
        creatorId: userId,
        creatorName,
        title: (title || 'Untitled Set').trim(),
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
      };
      if (customThumbnailURL) {
        baseClipData.customThumbnailURL = customThumbnailURL;
        baseClipData.autoThumbnailURL = bunny.thumbnailUrl;
      }
      if (selectedSetupId && linkedSetup) {
        baseClipData.setupId = selectedSetupId;
        baseClipData.setupName = linkedSetup.name || '';
        baseClipData.setupType = linkedSetup.setupType || 'DJ';
      }
      if (audioTrackURL != null) {
        baseClipData.audioTrackURL = audioTrackURL;
        baseClipData.audioOffsetSeconds = offsetSeconds;
        baseClipData.audioReplacesVideo = true;
      }

      for (const r of rangesToPost) {
        const clipData = {
          ...baseClipData,
          clipStart: r.start,
          clipEnd: r.end,
          createdAt: serverTimestamp(),
        };
        await addDoc(collection(db, 'clips'), clipData);
      }

      setUploading(false);
      setTimeout(() => {
        onSuccess?.();
        onClose?.();
      }, 150);
    } catch (e) {
      console.error('Error uploading set:', e);
      setError(e?.message || e?.code || String(e) || 'Upload failed');
      setUploading(false);
    }
  };

  return (
    <div className={`post-set-overlay ${isDark ? 'post-set-overlay-dark' : ''}`} onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="post-set-modal" onClick={(e) => e.stopPropagation()}>
        <div className="post-set-header">
          <h2 className="post-set-title">Post my set</h2>
          <button type="button" className="post-set-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        {error && <div className="post-set-error">{error}</div>}

        {step === 1 && (
          <>
            <div className="post-set-section">
              <h3 className="post-set-section-title">1. Upload your set video</h3>
              {!videoURL ? (
                <label className="post-set-upload-zone">
                  <input type="file" accept="video/*" onChange={handleVideoChange} className="post-set-file-input" />
                  <span className="post-set-upload-text">Choose video file</span>
                  <span className="post-set-upload-hint">MP4, MOV, etc.</span>
                </label>
              ) : (
                <div className="post-set-video-wrap">
                  <video
                    ref={videoRef}
                    src={videoURL}
                    controls
                    preload="metadata"
                    className="post-set-video"
                    onPlay={handleVideoPlay}
                    onPause={handleVideoPause}
                    onError={handleVideoError}
                    onLoadedMetadata={handleStep1VideoLoaded}
                  />
                  <button type="button" className="post-set-swap-audio-btn" onClick={resetVideoSelection}>
                    Choose different video
                  </button>
                  <p className="post-set-video-label">Video loaded. Full set must be 5 min – 1 hr 30 min. Add optional audio below to sync.</p>
                </div>
              )}
            </div>

            <div className="post-set-section">
              <h3 className="post-set-section-title">2. Add audio track (optional)</h3>
              <p className="post-set-hint">Upload a separate audio file to sync with your video. Use the waveform to line them up.</p>
              {!audioURL ? (
                <label className="post-set-upload-zone post-set-upload-zone-small">
                  <input type="file" accept="audio/*,.mp3,.wav,.m4a" onChange={handleAudioChange} className="post-set-file-input" />
                  <span className="post-set-upload-text">Choose audio file</span>
                  <span className="post-set-upload-hint">Max {MAX_AUDIO_SIZE_MB} MB (MP3, WAV, M4A)</span>
                </label>
              ) : (
                <div className="post-set-audio-sync">
                  {videoURL && (
                    <div className="post-set-audio-toggle">
                      <span className="post-set-toggle-label">Playback audio:</span>
                      <div className="post-set-toggle-buttons">
                        <button
                          type="button"
                          className={`post-set-toggle-btn ${audioSource === 'video' ? 'active' : ''}`}
                          onClick={() => setAudioSource('video')}
                        >
                          Video audio
                        </button>
                        <button
                          type="button"
                          className={`post-set-toggle-btn ${audioSource === 'track' ? 'active' : ''}`}
                          onClick={() => setAudioSource('track')}
                        >
                          Audio track
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="post-set-audio-row">
                    <p className="post-set-audio-label">Audio: {audioFile?.name}. Scroll the waveform to line up with the video.</p>
                    <input
                      ref={audioInputRef}
                      type="file"
                      accept="audio/*,.mp3,.wav,.m4a"
                      onChange={handleAudioChange}
                      className="post-set-file-input"
                      style={{ display: 'none' }}
                    />
                    <button type="button" className="post-set-swap-audio-btn" onClick={() => audioInputRef.current?.click()}>
                      Swap audio track
                    </button>
                  </div>
                  <div ref={waveformWrapRef} className="post-set-waveform-wrap">
                    <div className="post-set-playhead-stick" aria-hidden />
                    <div
                      ref={scrollRef}
                      className="post-set-waveform-scroll"
                      onScroll={handleScroll}
                    >
                      <canvas
                        ref={waveformCanvasRef}
                        className="post-set-waveform-canvas"
                        height={WAVEFORM_HEIGHT}
                        onClick={handleScrollToOffset}
                      />
                    </div>
                  </div>
                  <div className="post-set-offset-bar">
                    <span>Audio offset: {offsetSeconds.toFixed(2)}s</span>
                    <input
                      type="range"
                      min={0}
                      max={audioBuffer ? Math.max(0.01, audioBuffer.duration) : 0}
                      step="0.1"
                      value={offsetSeconds}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        setOffsetSeconds(v);
                        if (scrollRef.current) scrollRef.current.scrollLeft = v * PIXELS_PER_SECOND;
                      }}
                      className="post-set-offset-slider"
                    />
                  </div>
                  {videoURL && (
                    <p className="post-set-play-hint">
                      {useTrackAudio
                        ? 'Play the video — the audio track plays in sync. The playhead shows position; waveform scrolls as it plays.'
                        : 'Play the video to hear its built-in audio, or switch to "Audio track" to use the uploaded file.'}
                    </p>
                  )}
                </div>
              )}
            </div>

            {videoURL && (
              <div className="post-set-actions">
                <button type="button" className="post-set-next-btn" onClick={handleNext}>
                  Next — Select clip(s) for feed (10s–1 min each)
                </button>
              </div>
            )}
          </>
        )}

        {step === 2 && videoURL && (
          <>
            <div className="post-set-section">
              <button type="button" className="post-set-back-btn" onClick={handleBack}><IoArrowBack size={18} style={{ marginRight: '6px', verticalAlign: 'middle' }} />Back</button>
              <h3 className="post-set-section-title">Select clip(s) for the feed</h3>
              <p className="post-set-hint">Choose 1–3 segments (10 sec – 1 min each) that will appear in the feed. The full set will be on your profile.</p>
              <div className="post-set-num-clips">
                <span className="post-set-num-clips-label">Number of clips:</span>
                {[1, 2, 3].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`post-set-num-clip-btn ${numClips === n ? 'active' : ''}`}
                    onClick={() => handleNumClipsChange(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
              {numClips > 1 && (
                <div className="post-set-clip-tabs">
                  {Array.from({ length: numClips }, (_, i) => (
                    <button
                      key={i}
                      type="button"
                      className={`post-set-clip-tab ${activeClipIndex === i ? 'active' : ''}`}
                      onClick={() => setActiveClipIndex(i)}
                    >
                      Clip {i + 1}
                    </button>
                  ))}
                </div>
              )}
              <div className="post-set-clip-preview-wrap">
                <video
                  ref={step2VideoRef}
                  src={videoURL}
                  controls
                  preload="metadata"
                  className="post-set-clip-video"
                  onLoadedMetadata={handleStep2VideoLoaded}
                />
              </div>
              <div className="post-set-timeline-wrap">
                {numClips > 1 && <p className="post-set-timeline-clip-label">Clip {activeClipIndex + 1} range</p>}
                <div
                  ref={timelineRef}
                  className="post-set-timeline"
                  onClick={handleTimelineClick}
                  role="group"
                  aria-label="Clip timeline"
                >
                  <div className="post-set-timeline-track" />
                  <div
                    className="post-set-timeline-range"
                    style={{
                      left: `${timeToPercent((clipRanges[activeClipIndex] || {}).start ?? 0)}%`,
                      width: `${timeToPercent((clipRanges[activeClipIndex] || {}).end ?? 0) - timeToPercent((clipRanges[activeClipIndex] || {}).start ?? 0)}%`,
                    }}
                  />
                  <div
                    className="post-set-timeline-thumb post-set-timeline-thumb-start"
                    style={{ left: `${timeToPercent((clipRanges[activeClipIndex] || {}).start ?? 0)}%` }}
                    onMouseDown={handleThumbMouseDown('start')}
                    role="button"
                    aria-label="Clip start"
                  />
                  <div
                    className="post-set-timeline-thumb post-set-timeline-thumb-end"
                    style={{ left: `${timeToPercent((clipRanges[activeClipIndex] || {}).end ?? 0)}%` }}
                    onMouseDown={handleThumbMouseDown('end')}
                    role="button"
                    aria-label="Clip end"
                  />
                </div>
                <div className="post-set-timeline-labels">
                  <span>{((clipRanges[activeClipIndex] || {}).start ?? 0).toFixed(1)}s</span>
                  <span className="post-set-timeline-dur">{(((clipRanges[activeClipIndex] || {}).end ?? 0) - ((clipRanges[activeClipIndex] || {}).start ?? 0)).toFixed(1)}s / 10s–{CLIP_MAX_SEC}s</span>
                  <span>{((clipRanges[activeClipIndex] || {}).end ?? 0).toFixed(1)}s</span>
                </div>
              </div>
              <div className="post-set-thumbnail-row">
                <label className="post-set-title-label">Thumbnail (optional)</label>
                <p className="post-set-hint" style={{ marginTop: 0 }}>
                  Upload a custom image, or leave blank to use an auto-generated frame from the video. 16:9 recommended.
                </p>
                <div className="post-set-thumbnail-picker">
                  {thumbnailURL ? (
                    <div className="post-set-thumbnail-preview">
                      <img src={thumbnailURL} alt="Custom thumbnail preview" />
                      <div className="post-set-thumbnail-actions">
                        <button
                          type="button"
                          className="post-set-thumbnail-btn"
                          onClick={() => thumbnailInputRef.current?.click()}
                        >
                          Replace
                        </button>
                        <button
                          type="button"
                          className="post-set-thumbnail-btn post-set-thumbnail-btn--danger"
                          onClick={handleRemoveThumbnail}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="post-set-thumbnail-empty"
                      onClick={() => thumbnailInputRef.current?.click()}
                    >
                      <span className="post-set-thumbnail-empty-icon">+</span>
                      <span className="post-set-thumbnail-empty-label">Upload thumbnail</span>
                      <span className="post-set-thumbnail-empty-hint">JPG, PNG, or WebP · up to {MAX_THUMBNAIL_SIZE_MB} MB</span>
                    </button>
                  )}
                  <input
                    ref={thumbnailInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleThumbnailChange}
                    style={{ display: 'none' }}
                  />
                </div>
              </div>

              <div className="post-set-title-row">
                <label className="post-set-title-label">Title (optional)</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Live Set at Club XYZ"
                  className="post-set-title-input"
                  maxLength={100}
                />
              </div>

              <div className="post-set-setup-row">
                <label className="post-set-setup-label">Link a setup (required)</label>
                <p className="post-set-hint" style={{ marginTop: 0 }}>
                  Let viewers copy your gear setup from the clip.
                </p>
                {loadingSetups ? (
                  <div className="post-set-setup-loading">Loading setups…</div>
                ) : savedSetups.length === 0 ? (
                  <div className="post-set-setup-empty">
                    No saved setups yet. Save a setup first from the scene view.
                  </div>
                ) : (
                  <div className="post-set-setup-list">
                    {savedSetups.map((setup) => (
                      <button
                        key={setup.id}
                        type="button"
                        className={`post-set-setup-option ${selectedSetupId === setup.id ? 'active' : ''}`}
                        onClick={() => setSelectedSetupId(prev => prev === setup.id ? '' : setup.id)}
                      >
                        <span className="post-set-setup-option-icon">
                          {setup.setupType === 'DJ' ? '🎧' : setup.setupType === 'Producer' ? '🎹' : '🎸'}
                        </span>
                        <span className="post-set-setup-option-name">{setup.name || 'Untitled'}</span>
                        <span className="post-set-setup-option-type">{setup.setupType || 'DJ'}</span>
                        <span className="post-set-setup-option-devices">
                          {(setup.devices || []).length} device{(setup.devices || []).length !== 1 ? 's' : ''}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {uploading ? (
                <div className="post-set-progress">
                  <div className="post-set-progress-bar">
                    <div className="post-set-progress-fill" style={{ width: `${uploadProgress}%` }} />
                  </div>
                  <div className="post-set-progress-text">{Math.round(uploadProgress)}%</div>
                </div>
              ) : (
                <button type="button" className="post-set-post-btn" onClick={handlePost}>
                  Post — Full set to profile, {numClips} clip{numClips > 1 ? 's' : ''} to feed
                </button>
              )}
            </div>
          </>
        )}

        {step === 1 && audioURL && <audio ref={audioRef} src={audioURL} />}
      </div>
    </div>
  );
}

export default PostSetModal;
