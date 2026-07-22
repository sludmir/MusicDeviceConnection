import React, { useRef, useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { attachHls } from '../utils/attachHls';
import { getSignedBunnyUrls } from '../utils/bunnyUrl';
import { createAudioMasterSync } from '../utils/audioVideoSync';
import { useSetPlayer } from './SetPlayerProvider';
import { MdPlayArrow, MdPause } from 'react-icons/md';
import './ChatMediaPlayer.css';

function toFiniteNumberOr(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function ChatClipPlayer({ clip, compact }) {
  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const syncRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [signedUrl, setSignedUrl] = useState(null);

  const hasTrack = !!(clip?.audioTrackURL && clip.audioReplacesVideo !== false);
  const start = toFiniteNumberOr(clip?.clipStart, 0);
  const endRaw = clip?.clipEnd;
  const end = Number.isFinite(Number(endRaw)) ? Number(endRaw) : null;

  useEffect(() => {
    if (!clip?.clipId && !clip?.id) return;
    const id = clip.clipId || clip.id;
    let cancelled = false;
    getSignedBunnyUrls('clip', id)
      .then((urls) => { if (!cancelled) setSignedUrl(urls.videoURL || clip.videoURL); })
      .catch(() => { if (!cancelled) setSignedUrl(clip.videoURL); });
    return () => { cancelled = true; };
  }, [clip]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !signedUrl) return;
    video.src = signedUrl;
    const cleanupHls = attachHls(video, signedUrl);
    return () => {
      cleanupHls?.();
      syncRef.current?.destroy?.();
      syncRef.current = null;
    };
  }, [signedUrl]);

  useEffect(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video || !signedUrl) return;

    if (hasTrack && audio) {
      audio.src = clip.audioTrackURL;
      syncRef.current?.destroy?.();
      const offset = 0;
      const loopStartVal = clip.clipStartMaster ?? start;
      const loopEndVal = clip.clipEndMaster ?? end;
      const useLoop = loopEndVal != null;
      syncRef.current = createAudioMasterSync(video, audio, {
        offset,
        audioStart: loopStartVal + offset,
        audioLoopStart: useLoop ? () => loopStartVal + offset : undefined,
        audioLoopEnd: useLoop ? () => loopEndVal + offset : undefined,
      });
      return () => {
        syncRef.current?.destroy?.();
        syncRef.current = null;
      };
    }

    const onTimeUpdate = () => {
      if (end != null && video.currentTime >= end - 0.05) {
        try { video.currentTime = start; } catch (_) {}
      }
    };
    video.addEventListener('timeupdate', onTimeUpdate);
    return () => video.removeEventListener('timeupdate', onTimeUpdate);
  }, [signedUrl, hasTrack, clip, start, end]);

  const togglePlay = () => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (hasTrack && syncRef.current) {
      if (playing) {
        syncRef.current.pause();
        setPlaying(false);
      } else {
        syncRef.current.play();
        setPlaying(true);
      }
      return;
    }
    if (!video) return;
    if (video.paused) {
      try { video.currentTime = start; } catch (_) {}
      video.play().catch(() => {});
      setPlaying(true);
    } else {
      video.pause();
      setPlaying(false);
    }
  };

  return (
    <div className={`chat-media-player ${compact ? 'chat-media-player--compact' : ''}`}>
      <div className="chat-media-player__video-wrap" onClick={togglePlay}>
        <video
          ref={videoRef}
          className="chat-media-player__video"
          muted={hasTrack}
          playsInline
          preload="metadata"
        />
        <div className={`chat-media-player__play ${playing ? '' : 'visible'}`}>
          {playing ? <MdPause size={28} /> : <MdPlayArrow size={28} />}
        </div>
      </div>
      <div className="chat-media-player__label">{clip.title || 'Clip'}</div>
      {hasTrack && <audio ref={audioRef} style={{ display: 'none' }} />}
    </div>
  );
}

function ChatSetPlayer({ setData, compact }) {
  const { playSet } = useSetPlayer();
  const [thumb, setThumb] = useState(setData.thumbnailURL || '');

  useEffect(() => {
    if (setData.thumbnailURL) return;
    const id = setData.setId || setData.id;
    if (!id) return;
    getSignedBunnyUrls('set', id)
      .then((urls) => { if (urls.thumbnailURL) setThumb(urls.thumbnailURL); })
      .catch(() => {});
  }, [setData]);

  const openFull = async () => {
    const id = setData.setId || setData.id;
    if (!id) return;
    try {
      const snap = await getDoc(doc(db, 'sets', id));
      if (snap.exists()) {
        playSet({ id: snap.id, ...snap.data() });
      } else {
        playSet({ id, ...setData, videoURL: setData.videoURL });
      }
    } catch {
      playSet({ id, ...setData });
    }
  };

  return (
    <button type="button" className={`chat-media-player chat-media-player--set ${compact ? 'chat-media-player--compact' : ''}`} onClick={openFull}>
      <div className="chat-media-player__video-wrap">
        {thumb ? (
          <img src={thumb} alt="" className="chat-media-player__thumb" />
        ) : (
          <div className="chat-media-player__thumb-placeholder" />
        )}
        <div className="chat-media-player__play visible">
          <MdPlayArrow size={28} />
        </div>
      </div>
      <div className="chat-media-player__label">{setData.title || 'Live set'}</div>
    </button>
  );
}

function ChatMediaPlayer({ message, compact = false }) {
  if (message.type === 'clip' && message.clip) {
    return <ChatClipPlayer clip={message.clip} compact={compact} />;
  }
  if (message.type === 'liveSet' || message.type === 'set') {
    const setData = message.sharedSet || message.set;
    if (setData) return <ChatSetPlayer setData={setData} compact={compact} />;
  }
  return null;
}

export default ChatMediaPlayer;
