import React, { useState, useRef, useEffect, useCallback } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import { createBunnyVideo, uploadToBunny } from '../utils/bunnyStream';
import { IoArrowBack } from 'react-icons/io5';
import { MdVideoLibrary } from 'react-icons/md';
import './Upload.css';

const CLIP_MIN_SEC = 3;
const CLIP_MAX_SEC = 30;

function toFiniteNumberOr(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function Upload({ onBack, onSuccess }) {
  const [step, setStep] = useState(1);
  const [videoFile, setVideoFile] = useState(null);
  const [videoPreview, setVideoPreview] = useState(null);
  const [clipStart, setClipStart] = useState(0);
  const [clipEnd, setClipEnd] = useState(10);
  const [videoDuration, setVideoDuration] = useState(0);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragging, setDragging] = useState(null); // 'start' | 'end' | null
  const videoRef = useRef(null);
  const timelineRef = useRef(null);
  const clipStartRef = useRef(clipStart);
  const clipEndRef = useRef(clipEnd);
  clipStartRef.current = clipStart;
  clipEndRef.current = clipEnd;

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('video/')) {
      alert('Please select a video file');
      return;
    }

    const maxSize = 5 * 1024 * 1024 * 1024; // 5GB (Firebase Storage limit)
    if (file.size > maxSize) {
      alert(`File is too large (${formatFileSize(file.size)}). Maximum size is 5GB. Please compress your video or use a smaller file.`);
      return;
    }

    // Warn for large files but allow them
    const largeFileThreshold = 1 * 1024 * 1024 * 1024; // 1GB
    if (file.size > largeFileThreshold) {
      const proceed = window.confirm(
        `This file is large (${formatFileSize(file.size)}). Upload may take a while. Continue?`
      );
      if (!proceed) return;
    }

    setVideoFile(file);
    const url = URL.createObjectURL(file);
    setVideoPreview(url);
    setStep(2);
  };

  const handleVideoLoaded = () => {
    if (videoRef.current) {
      const duration = videoRef.current.duration;
      setVideoDuration(duration);
      const end = Math.min(CLIP_MAX_SEC, duration);
      setClipEnd(end);
      setClipStart(0);
    }
  };

  const handleClipSelection = () => {
    const duration = clipEnd - clipStart;
    if (duration < CLIP_MIN_SEC) {
      alert(`Clip must be at least ${CLIP_MIN_SEC} seconds`);
      return;
    }
    if (duration > CLIP_MAX_SEC) {
      alert(`Clip must be at most ${CLIP_MAX_SEC} seconds`);
      return;
    }
    setStep(3);
  };

  const percentToTime = useCallback((p) => Math.max(0, Math.min(videoDuration, (p / 100) * videoDuration)), [videoDuration]);
  const timeToPercent = (t) => (videoDuration > 0 ? (t / videoDuration) * 100 : 0);

  const updateRange = useCallback((newStart, newEnd, seekVideo = true) => {
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
    if (seekVideo && videoRef.current) videoRef.current.currentTime = start;
  }, [videoDuration, dragging]);

  const handleTimelineClick = (e) => {
    if (!timelineRef.current || !videoDuration) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const p = (e.clientX - rect.left) / rect.width;
    const t = percentToTime(p * 100);
    if (videoRef.current) videoRef.current.currentTime = t;
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
      if (dragging === 'start') updateRange(t, end, true);
      else updateRange(start, t, false);
    };
    const onUp = () => setDragging(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging, videoDuration, percentToTime, updateRange]);

  const handleUpload = async () => {
    if (!videoFile || !title.trim()) {
      alert('Please provide a title');
      return;
    }
    if (!auth.currentUser) {
      alert('Please sign in to upload');
      return;
    }

    setUploading(true);
    try {
      const userId = auth.currentUser.uid;
      const userEmail = auth.currentUser.email;

      const bunny = await createBunnyVideo({
        title: title.trim().slice(0, 200) || videoFile.name,
        kind: 'set',
      });

      await uploadToBunny(
        videoFile,
        { uploadUrl: bunny.uploadUrl, uploadHeaders: bunny.uploadHeaders },
        (fraction) => setUploadProgress(Math.min(100, Math.round(fraction * 100)))
      );

      const safeClipStart = toFiniteNumberOr(clipStart, 0);
      const safeClipEnd = toFiniteNumberOr(clipEnd, safeClipStart + CLIP_MIN_SEC);
      const safeDurationSeconds = toFiniteNumberOr(videoDuration, 0);
      const creatorName = userEmail?.split('@')[0] || 'Unknown';

      const setDocRef = await addDoc(collection(db, 'sets'), {
        creatorId: userId,
        creatorName,
        title: title.trim(),
        description: description.trim(),
        videoURL: bunny.hlsUrl,
        thumbnailURL: bunny.thumbnailUrl,
        bunnyVideoGuid: bunny.videoGuid,
        bunnyLibraryId: bunny.libraryId,
        status: 'processing',
        durationSeconds: safeDurationSeconds,
        createdAt: serverTimestamp(),
        views: 0,
      });

      await addDoc(collection(db, 'clips'), {
        creatorId: userId,
        creatorName,
        title: title.trim(),
        description: description.trim(),
        fullVideoURL: bunny.hlsUrl,
        videoURL: bunny.hlsUrl,
        thumbnailURL: bunny.thumbnailUrl,
        bunnyVideoGuid: bunny.videoGuid,
        bunnyLibraryId: bunny.libraryId,
        status: 'processing',
        clipStart: safeClipStart,
        clipEnd: safeClipEnd,
        fullSetId: setDocRef.id,
        likes: 0,
        likedBy: [],
        views: 0,
        createdAt: serverTimestamp(),
      });

      setUploading(false);
      if (onSuccess) onSuccess();
      if (onBack) onBack();
    } catch (error) {
      console.error('Error uploading:', error);
      alert('Upload failed: ' + (error?.message || error));
      setUploading(false);
    }
  };

  return (
    <div className="upload-container">
      <div className="upload-header">
        <button className="upload-back-btn" onClick={onBack}><IoArrowBack size={18} style={{ marginRight: '6px', verticalAlign: 'middle' }} />Back</button>
        <h1>Upload Live Set</h1>
      </div>
      
      <div className="upload-content">
        {step === 1 && (
          <div className="upload-step">
            <div className="upload-dropzone">
              <input
                type="file"
                accept="video/*"
                onChange={handleFileSelect}
                id="video-upload"
                style={{ display: 'none' }}
              />
              <label htmlFor="video-upload" className="upload-label">
                <div className="upload-icon"><MdVideoLibrary size={64} /></div>
                <div className="upload-text">Click to select video file</div>
                <div className="upload-hint">MP4, MOV, or other video formats</div>
                <div className="upload-hint" style={{ marginTop: '8px', fontSize: '12px', opacity: 0.7 }}>
                  Maximum file size: 5GB
                </div>
              </label>
            </div>
          </div>
        )}

        {step === 2 && videoPreview && (
          <div className="upload-step">
            <h2>Select your clip (3–30 seconds)</h2>
            <p className="upload-timeline-hint">Scrub the timeline or drag the handles to choose the segment that will appear in the feed. Full set stays on your profile.</p>
            <div className="video-preview-container">
              <div className="upload-preview-video-wrap">
                <video
                  ref={videoRef}
                  src={videoPreview}
                  controls
                  onLoadedMetadata={handleVideoLoaded}
                  className="upload-preview-video"
                />
              </div>
              <div className="clip-timeline-wrap">
                <div
                  ref={timelineRef}
                  className="clip-timeline"
                  onClick={handleTimelineClick}
                  role="slider"
                  aria-label="Video timeline"
                  aria-valuenow={clipStart}
                  aria-valuemin={0}
                  aria-valuemax={videoDuration || 100}
                >
                  <div className="clip-timeline-track" />
                  <div
                    className="clip-timeline-range"
                    style={{
                      left: `${timeToPercent(clipStart)}%`,
                      width: `${timeToPercent(clipEnd) - timeToPercent(clipStart)}%`
                    }}
                  />
                  <div
                    className="clip-timeline-thumb clip-timeline-thumb-start"
                    style={{ left: `${timeToPercent(clipStart)}%` }}
                    onMouseDown={handleThumbMouseDown('start')}
                    role="button"
                    aria-label="Clip start"
                  />
                  <div
                    className="clip-timeline-thumb clip-timeline-thumb-end"
                    style={{ left: `${timeToPercent(clipEnd)}%` }}
                    onMouseDown={handleThumbMouseDown('end')}
                    role="button"
                    aria-label="Clip end"
                  />
                </div>
                <div className="clip-timeline-labels">
                  <span>{clipStart.toFixed(1)}s</span>
                  <span className="clip-timeline-dur">{(clipEnd - clipStart).toFixed(1)}s / max {CLIP_MAX_SEC}s</span>
                  <span>{clipEnd.toFixed(1)}s</span>
                </div>
              </div>
              <button className="upload-next-btn" onClick={handleClipSelection}>
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="upload-step">
            <h2>Add Details</h2>
            <div className="upload-form">
              <div className="upload-form-group">
                <label>Title *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Live Set at Club XYZ"
                  maxLength={100}
                />
              </div>
              <div className="upload-form-group">
                <label>Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Tell us about your set..."
                  rows={4}
                  maxLength={500}
                />
              </div>
              <div className="upload-preview-info">
                <div>Clip: {clipStart.toFixed(1)}s - {clipEnd.toFixed(1)}s ({(clipEnd - clipStart).toFixed(1)}s)</div>
              </div>
              {uploading ? (
                <div className="upload-progress">
                  <div className="upload-progress-bar">
                    <div 
                      className="upload-progress-fill" 
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <div className="upload-progress-text">{Math.round(uploadProgress)}%</div>
                </div>
              ) : (
                <button className="upload-submit-btn" onClick={handleUpload}>
                  Upload Set
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Upload;
