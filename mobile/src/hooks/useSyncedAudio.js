import { useEffect, useRef } from 'react';
import { useAudioPlayer } from 'expo-audio';

const DRIFT_THRESHOLD = 0.25; // seconds — re-seek if audio drifts beyond this

/**
 * useSyncedAudio
 *
 * Drives an external audio track in lockstep with a video player. Used when
 * a clip or set has a separate `audioTrackURL` (typically a board recording
 * with much better audio quality than the camera capture).
 *
 * @param {object} videoPlayer - expo-video player instance
 * @param {string|null} audioUrl - external audio URL, or null/undefined for none
 * @param {number} offsetSeconds - audio offset relative to video (positive = audio starts before video)
 * @param {boolean} active - whether this card is currently visible/playing
 */
export default function useSyncedAudio(videoPlayer, audioUrl, offsetSeconds = 0, active = false) {
  // expo-audio's useAudioPlayer has historically been picky about null/undefined
  // sources. Pass `undefined` (not null) to create an idle player when there's
  // no external track — this is the documented no-source path.
  const audioPlayer = useAudioPlayer(audioUrl ? audioUrl : undefined);
  const driftTimer = useRef(null);

  // Mute the underlying video when an external audio track is in play.
  useEffect(() => {
    if (!videoPlayer) return;
    videoPlayer.muted = !!audioUrl;
  }, [videoPlayer, audioUrl]);

  // Play/pause coordination with the video.
  useEffect(() => {
    if (!audioUrl || !audioPlayer) return;

    const sync = async () => {
      try {
        if (active) {
          // Match audio time to video time (with offset) before playing.
          const target = (videoPlayer?.currentTime ?? 0) + offsetSeconds;
          if (typeof audioPlayer.seekTo === 'function') {
            await audioPlayer.seekTo(Math.max(0, target));
          }
          audioPlayer.play();
        } else {
          audioPlayer.pause();
        }
      } catch (e) { /* swallow — playback errors aren't fatal */ }
    };
    sync();
  }, [active, audioUrl, audioPlayer, videoPlayer, offsetSeconds]);

  // Periodic drift correction while active.
  useEffect(() => {
    if (!audioUrl || !active || !audioPlayer || !videoPlayer) return;

    driftTimer.current = setInterval(() => {
      try {
        const videoT = videoPlayer.currentTime ?? 0;
        const audioT = audioPlayer.currentTime ?? 0;
        const expected = videoT + offsetSeconds;
        const drift = Math.abs(audioT - expected);
        if (drift > DRIFT_THRESHOLD && typeof audioPlayer.seekTo === 'function') {
          audioPlayer.seekTo(Math.max(0, expected));
        }
      } catch (e) { /* ignore */ }
    }, 1000);

    return () => {
      if (driftTimer.current) clearInterval(driftTimer.current);
      driftTimer.current = null;
    };
  }, [active, audioUrl, audioPlayer, videoPlayer, offsetSeconds]);

  // Stop on unmount.
  useEffect(() => () => {
    try { audioPlayer?.pause(); } catch (e) { /* ignore */ }
  }, [audioPlayer]);

  return audioPlayer;
}
