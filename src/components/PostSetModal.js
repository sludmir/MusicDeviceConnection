import React, { useState, useRef, useEffect, useCallback } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, auth } from '../firebaseConfig';
import './PostSetModal.css';

const PIXELS_PER_SECOND = 80;
const WAVEFORM_HEIGHT = 80;
const CLIP_MIN_SEC = 3;
const CLIP_MAX_SEC = 30;
const MAX_AUDIO_SIZE_MB = 100;
const MAX_AUDIO_SIZE_BYTES = MAX_AUDIO_SIZE_MB * 1024 * 1024;

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
}

function PostSetModal({ onClose, theme = 'light', onSuccess }) {
  const [step, setStep] = useState(1);
  const [videoFile, setVideoFile] = useState(null);
  const [videoURL, setVideoURL] = useState(null);
  const [audioFile, setAudioFile] = useState(null);
  const [audioURL, setAudioURL] = useState(null);
  const [audioBuffer, setAudioBuffer] = useState(null);
  const [offsetSeconds, setOffsetSeconds] = useState(0);
  const [waveformReady, setWaveformReady] = useState(false);
  const [error, setError] = useState(null);
  const [audioSource, setAudioSource] = useState('video');
  const [clipStart, setClipStart] = useState(0);
  const [clipEnd, setClipEnd] = useState(30);
  const [videoDuration, setVideoDuration] = useState(0);
  const [dragging, setDragging] = useState(null);
  const [title, setTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const waveformCanvasRef = useRef(null);
  const scrollRef = useRef(null);
  const waveformWrapRef = useRef(null);
  const audioContextRef = useRef(null);
  const timelineRef = useRef(null);
  const clipStartRef = useRef(clipStart);
  const clipEndRef = useRef(clipEnd);
  const step2VideoRef = useRef(null);
  const audioInputRef = useRef(null);
  clipStartRef.current = clipStart;
  clipEndRef.current = clipEnd;

  const isDark = theme === 'dark';
  const useTrackAudio = audioSource === 'track';

  const videoURLRef = useRef(null);
  const audioURLRef = useRef(null);
  videoURLRef.current = videoURL;
  audioURLRef.current = audioURL;

  useEffect(() => {
    return () => {
      if (videoURLRef.current) URL.revokeObjectURL(videoURLRef.current);
      if (audioURLRef.current) URL.revokeObjectURL(audioURLRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, []);

  const handleVideoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('video/')) {
      setError('Please select a video file');
      return;
    }
    if (videoURL) URL.revokeObjectURL(videoURL);
    setError(null);
    setVideoFile(file);
    setVideoURL(URL.createObjectURL(file));
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

  const handleStep2VideoLoaded = useCallback(() => {
    const v = step2VideoRef.current;
    if (!v) return;
    const dur = v.duration;
    setVideoDuration(dur);
    const end = Math.min(CLIP_MAX_SEC, dur);
    setClipEnd(end);
    setClipStart(0);
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
    setClipStart(Number(start.toFixed(2)));
    setClipEnd(Number(end.toFixed(2)));
    if (seekVideo && step2VideoRef.current) step2VideoRef.current.currentTime = start;
  }, [videoDuration, dragging]);

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
      const start = clipStartRef.current;
      const end = clipEndRef.current;
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
  }, [dragging, videoDuration, percentToTime, updateClipRange]);

  const handleNext = () => {
    if (!videoURL) return;
    setError(null);
    setStep(2);
  };

  const handleBack = () => {
    setError(null);
    setStep(1);
  };

  const handlePost = async () => {
    const duration = clipEnd - clipStart;
    if (duration < CLIP_MIN_SEC) {
      setError(`Clip must be at least ${CLIP_MIN_SEC} seconds`);
      return;
    }
    if (duration > CLIP_MAX_SEC) {
      setError(`Clip must be at most ${CLIP_MAX_SEC} seconds`);
      return;
    }
    if (!auth.currentUser) {
      setError('Please sign in to post');
      return;
    }
    if (!videoFile) {
      setError('Missing video file');
      return;
    }

    setUploading(true);
    setError(null);
    const storage = getStorage();
    const userId = auth.currentUser.uid;
    const creatorName = auth.currentUser.displayName || auth.currentUser.email?.split('@')[0] || 'Unknown';
    const fileName = `${userId}_${Date.now()}_${videoFile.name}`;
    const fullVideoRef = ref(storage, `sets/${fileName}`);

    try {
      const uploadTask = uploadBytesResumable(fullVideoRef, videoFile);
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          setUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        },
        (err) => {
          console.error('Upload error:', err);
          setError(err?.message || 'Upload failed');
          setUploading(false);
        },
        async () => {
          try {
            const fullVideoURL = await getDownloadURL(uploadTask.snapshot.ref);
            let audioTrackURL = null;
            if (audioFile) {
              const audioName = (audioFile.name || 'audio').replace(/[^a-zA-Z0-9._-]/g, '_');
              const audioRef = ref(storage, `sets/audio/${userId}_${Date.now()}_${audioName}`);
              await uploadBytes(audioRef, audioFile);
              audioTrackURL = await getDownloadURL(audioRef);
            }

            const setData = {
              creatorId: userId,
              creatorName,
              title: (title || 'Untitled Set').trim(),
              description: '',
              videoURL: fullVideoURL,
              createdAt: serverTimestamp(),
              views: 0,
            };
            if (audioTrackURL != null) {
              setData.audioTrackURL = audioTrackURL;
              setData.audioOffsetSeconds = offsetSeconds;
            }
            const setDocRef = await addDoc(collection(db, 'sets'), setData);

            const clipData = {
              creatorId: userId,
              creatorName,
              title: (title || 'Untitled Set').trim(),
              description: '',
              fullVideoURL,
              clipStart,
              clipEnd,
              videoURL: fullVideoURL,
              fullSetId: setDocRef.id,
              likes: 0,
              likedBy: [],
              createdAt: serverTimestamp(),
              views: 0,
            };
            if (audioTrackURL != null) {
              clipData.audioTrackURL = audioTrackURL;
              clipData.audioOffsetSeconds = offsetSeconds;
            }
            await addDoc(collection(db, 'clips'), clipData);
            setUploading(false);
            if (onSuccess) onSuccess();
            if (onClose) onClose();
          } catch (e) {
            console.error('Error saving set/clip:', e);
            setError(e?.message || 'Failed to save');
            setUploading(false);
          }
        }
      );
    } catch (e) {
      console.error('Error starting upload:', e);
      setError(e?.message || 'Upload failed');
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
                    className="post-set-video"
                    onPlay={handleVideoPlay}
                    onPause={handleVideoPause}
                    onError={handleVideoError}
                  />
                  <p className="post-set-video-label">Video loaded. Add optional audio below to sync.</p>
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
                  Next — Select 30s clip
                </button>
              </div>
            )}
          </>
        )}

        {step === 2 && videoURL && (
          <>
            <div className="post-set-section">
              <button type="button" className="post-set-back-btn" onClick={handleBack}>← Back</button>
              <h3 className="post-set-section-title">Select your 30 second clip</h3>
              <p className="post-set-hint">Choose the segment that will appear in the feed. The full set will be on your profile.</p>
              <div className="post-set-clip-preview-wrap">
                <video
                  ref={step2VideoRef}
                  src={videoURL}
                  controls
                  className="post-set-clip-video"
                  onLoadedMetadata={handleStep2VideoLoaded}
                />
              </div>
              <div className="post-set-timeline-wrap">
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
                      left: `${timeToPercent(clipStart)}%`,
                      width: `${timeToPercent(clipEnd) - timeToPercent(clipStart)}%`,
                    }}
                  />
                  <div
                    className="post-set-timeline-thumb post-set-timeline-thumb-start"
                    style={{ left: `${timeToPercent(clipStart)}%` }}
                    onMouseDown={handleThumbMouseDown('start')}
                    role="button"
                    aria-label="Clip start"
                  />
                  <div
                    className="post-set-timeline-thumb post-set-timeline-thumb-end"
                    style={{ left: `${timeToPercent(clipEnd)}%` }}
                    onMouseDown={handleThumbMouseDown('end')}
                    role="button"
                    aria-label="Clip end"
                  />
                </div>
                <div className="post-set-timeline-labels">
                  <span>{clipStart.toFixed(1)}s</span>
                  <span className="post-set-timeline-dur">{(clipEnd - clipStart).toFixed(1)}s / max {CLIP_MAX_SEC}s</span>
                  <span>{clipEnd.toFixed(1)}s</span>
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
              {uploading ? (
                <div className="post-set-progress">
                  <div className="post-set-progress-bar">
                    <div className="post-set-progress-fill" style={{ width: `${uploadProgress}%` }} />
                  </div>
                  <div className="post-set-progress-text">{Math.round(uploadProgress)}%</div>
                </div>
              ) : (
                <button type="button" className="post-set-post-btn" onClick={handlePost}>
                  Post — Full set to profile, 30s clip to feed
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
