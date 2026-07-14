// Audio-master A/V sync for an uploaded lossless track overlaid on a muted video.
//
// Why "audio-master": on iOS, seeking an <audio> element causes an audible
// stall/rebuffer. Any sync scheme that re-seeks the audio to chase the video
// therefore stutters (drift -> seek -> stall -> falls behind -> seek again...).
// The lossless track, however, plays perfectly smoothly as long as it is never
// seeked. So we make the AUDIO the master clock and never seek it during
// playback; the muted VIDEO is slaved to it via tiny playbackRate nudges (a
// muted video running a few % fast/slow is invisible) plus a rare hard seek for
// large gaps. Verified on iOS Safari/Chrome: drift holds < 0.2s.
//
// Offset convention (matches the rest of the app):
//     audio.currentTime = video.currentTime + offset
//   => videoTarget       = audio.currentTime - offset

import { angleIndexAt } from './multicam';

const WARMUP_PROGRESS = 1.2;  // seconds of *real* audio progress before starting the video
const SEEK_VIDEO = 0.6;       // hard re-seek the video when it is off by more than this
const DEADBAND = 0.05;        // within this, leave the video alone
const MAX_RATE_DELTA = 0.10;  // cap on the video playbackRate nudge (muted => invisible)
const FOLLOW_MS = 250;        // how often the slave loop runs

/**
 * Create an audio-master sync controller for a (muted) video + lossless audio.
 *
 * @param {HTMLVideoElement} video  the muted HLS video element
 * @param {HTMLAudioElement} audio  the uploaded lossless track element
 * @param {Object}  opts
 * @param {number}  [opts.offset=0]          audioOffsetSeconds
 * @param {number}  [opts.audioStart=0]      where the audio should begin (e.g. clipStart + offset)
 * @param {()=>number} [opts.audioLoopStart] if set, loop the audio back here once it passes audioLoopEnd
 * @param {()=>number} [opts.audioLoopEnd]   end of the loop window (audio time)
 * @returns {{ play:Function, pause:Function, seek:Function, destroy:Function, getVideoSeeks:Function }}
 */
export function createAudioMasterSync(video, audio, opts = {}) {
  const offset = Number(opts.offset) || 0;
  const audioStart = Number(opts.audioStart) || 0;
  const loopStart = opts.audioLoopStart;
  const loopEnd = opts.audioLoopEnd;

  let started = false;   // warm-up completed at least once
  let active = false;    // intended to be playing
  let followId = null;
  let warmId = null;
  let warm0 = null;
  let videoSeeks = 0;
  let destroyed = false;

  const videoTarget = () => Math.max(0, audio.currentTime - offset);

  // Is `t` already inside a buffered range of `el`? Used to tell "off-clock,
  // safe to hard-seek" apart from "legitimately bandwidth-starved" -- seeking
  // into unbuffered video forces a fresh fetch further ahead than the last
  // one, which is what turns a single stall into a growing-freeze spiral.
  const isBuffered = (el, t) => {
    const buf = el.buffered;
    for (let i = 0; i < buf.length; i++) {
      if (t >= buf.start(i) - 0.1 && t <= buf.end(i) + 0.1) return true;
    }
    return false;
  };

  const stopFollow = () => { if (followId) { clearInterval(followId); followId = null; } };
  const startFollow = () => { stopFollow(); followId = setInterval(follow, FOLLOW_MS); };

  function follow() {
    if (destroyed || !active || !started) return;

    // Loop window (feed clips): the audio is the master, so we loop the audio.
    if (loopStart && loopEnd) {
      const end = loopEnd();
      if (end > 0 && audio.currentTime >= end - 0.04) {
        try { audio.currentTime = loopStart(); } catch (_) {}
        try { video.currentTime = videoTarget(); } catch (_) {}
        video.playbackRate = 1;
        return;
      }
    }

    // Don't fight a backgrounded (frozen) video — wait for visibility to return.
    if (document.hidden || video.readyState < 2) return;

    const drift = video.currentTime - videoTarget(); // + video ahead, - video behind
    const ad = Math.abs(drift);
    if (ad > SEEK_VIDEO) {
      if (isBuffered(video, videoTarget())) {
        try { video.currentTime = videoTarget(); } catch (_) {}
        video.playbackRate = 1;
        videoSeeks += 1;
      } else if (drift < 0) {
        // Behind, and the master's current position isn't buffered yet --
        // bandwidth-starved, not just off-clock. Run at the fastest safe
        // rate instead of seeking into the void; let the buffer catch up.
        video.playbackRate = 1 + MAX_RATE_DELTA;
      } else {
        video.playbackRate = 1 - MAX_RATE_DELTA;
      }
    } else if (ad > DEADBAND) {
      const clamped = Math.max(-MAX_RATE_DELTA, Math.min(MAX_RATE_DELTA, drift));
      video.playbackRate = 1 - clamped; // ahead -> slow down; behind -> speed up
    } else {
      video.playbackRate = 1;
    }
  }

  function warmupThenStartVideo() {
    warm0 = null;
    if (warmId) clearInterval(warmId);
    warmId = setInterval(() => {
      if (destroyed || !active) { clearInterval(warmId); warmId = null; return; }
      if (audio.currentTime > audioStart + 0.2) {
        if (warm0 === null) warm0 = audio.currentTime;
        if (audio.currentTime - warm0 > WARMUP_PROGRESS) {
          clearInterval(warmId); warmId = null;
          const vp = video.play();
          if (vp && vp.catch) vp.catch(() => {});
          try { video.currentTime = videoTarget(); } catch (_) {}
          started = true;
          startFollow();
        }
      }
    }, 100);
  }

  function play() {
    if (destroyed) return;
    active = true;
    video.muted = true; // audio-master: the video's own audio is never used
    audio.playbackRate = 1;
    const p = audio.play();
    if (p && p.catch) p.catch(() => {});
    if (!started) {
      // First start: let the audio warm up (iOS ramps its clock slowly), then
      // bring the video in already aligned so we don't bank a startup gap.
      if (audio.readyState >= 1 && audio.currentTime < audioStart) {
        try { audio.currentTime = audioStart; } catch (_) {}
      }
      warmupThenStartVideo();
    } else {
      const vp = video.play();
      if (vp && vp.catch) vp.catch(() => {});
      try { video.currentTime = videoTarget(); } catch (_) {}
      startFollow();
    }
  }

  function pause() {
    active = false;
    try { audio.pause(); } catch (_) {}
    try { video.pause(); } catch (_) {}
    stopFollow();
    if (warmId) { clearInterval(warmId); warmId = null; }
  }

  // Deliberate user scrub: master is the audio, so move the audio (a single
  // intentional seek is fine — the per-frame chase is what we avoid).
  function seek(videoTime) {
    try { audio.currentTime = Math.max(0, videoTime + offset); } catch (_) {}
    try { video.currentTime = Math.max(0, videoTime); } catch (_) {}
  }

  function onVisibility() {
    if (!document.hidden && active && started) {
      try { video.currentTime = videoTarget(); } catch (_) {}
      video.playbackRate = 1;
    }
  }
  document.addEventListener('visibilitychange', onVisibility);

  function destroy() {
    destroyed = true;
    active = false;
    started = false;
    stopFollow();
    if (warmId) { clearInterval(warmId); warmId = null; }
    document.removeEventListener('visibilitychange', onVisibility);
    try { video.playbackRate = 1; } catch (_) {}
  }

  return { play, pause, seek, destroy, getVideoSeeks: () => videoSeeks };
}

// ---------------------------------------------------------------------------
// Multicam variant: one audio clock, N muted videos (one per angle). Only the
// ACTIVE video (per `cuts`, at the audio clock) is slaved to the audio via
// the same rate-nudge follow loop as createAudioMasterSync above; inactive
// videos are paused and "parked" -- pre-seeked to their own video time at
// their next activation cut, so a future cut swap starts on an
// already-decoded frame instead of a fresh seek.
//
// A cut ticker compares the audio clock to the cut list and swaps the active
// video. The plan explicitly permits setInterval over rAF here for
// determinism under the jest fake-timer harness.

const CUT_TICK_MS = 50; // cut-boundary poll interval

/**
 * Create a multicam audio-master sync controller: one lossless audio track
 * as the clock, N muted videos (one per angle) slaved to it per a cut list.
 *
 * @param {{ video: HTMLVideoElement, offset: number }[]} entries  index == angleIndex
 * @param {HTMLAudioElement} audio
 * @param {Object} opts
 * @param {{ timeSec:number, angleIndex:number }[]} opts.cuts   normalized (multicam.js), MASTER time
 * @param {number} [opts.audioStart=0]
 * @param {(angleIndex:number)=>void} [opts.onActiveAngleChange] fired on every active-angle change, including the initial one
 * @returns {{ play, pause, seek, destroy, getActiveIndex }}
 *   seek(masterTime): one intentional audio seek; repositions every video and
 *   recomputes/notifies the active angle. masterTime === audio.currentTime.
 */
export function createMulticamAudioMasterSync(entries, audio, opts = {}) {
  const audioStart = Number(opts.audioStart) || 0;
  const cuts = Array.isArray(opts.cuts) && opts.cuts.length > 0
    ? opts.cuts
    : [{ timeSec: 0, angleIndex: 0 }];
  const onActiveAngleChange = typeof opts.onActiveAngleChange === 'function'
    ? opts.onActiveAngleChange
    : () => {};

  let started = false;   // warm-up completed at least once
  let active = false;    // intended to be playing
  let followId = null;
  let warmId = null;
  let warm0 = null;
  let cutTickId = null;
  let activeIndex = -1;  // -1 = not yet activated
  let destroyed = false;

  const offsetOf = (i) => Number(entries[i] && entries[i].offset) || 0;
  const videoTargetFor = (i) => Math.max(0, audio.currentTime - offsetOf(i));
  const angleAt = (tSec) => angleIndexAt(cuts, tSec);

  // Same buffered-range check as createAudioMasterSync -- tells "off-clock,
  // safe to hard-seek" apart from "legitimately bandwidth-starved".
  const isBuffered = (el, t) => {
    const buf = el.buffered;
    for (let i = 0; i < buf.length; i++) {
      if (t >= buf.start(i) - 0.1 && t <= buf.end(i) + 0.1) return true;
    }
    return false;
  };

  // Earliest cut after `fromTime` that (re)activates angle `idx`, or null if
  // it never comes back around.
  function nextActivationTime(idx, fromTime) {
    for (let i = 0; i < cuts.length; i++) {
      if (cuts[i].timeSec > fromTime && cuts[i].angleIndex === idx) return cuts[i].timeSec;
    }
    return null;
  }

  // Pause + pre-seek every non-active video to its own time at its next
  // activation cut, so a future swap starts on an already-decoded frame.
  function parkInactive() {
    for (let i = 0; i < entries.length; i++) {
      if (i === activeIndex) continue;
      const video = entries[i] && entries[i].video;
      if (!video) continue;
      try { video.pause(); } catch (_) {}
      const nextT = nextActivationTime(i, audio.currentTime);
      if (nextT != null) {
        try { video.currentTime = Math.max(0, nextT - offsetOf(i)); } catch (_) {}
      }
    }
  }

  const stopFollow = () => { if (followId) { clearInterval(followId); followId = null; } };
  const startFollow = () => { stopFollow(); followId = setInterval(follow, FOLLOW_MS); };
  const stopCutTicker = () => { if (cutTickId) { clearInterval(cutTickId); cutTickId = null; } };
  const startCutTicker = () => { stopCutTicker(); cutTickId = setInterval(checkCut, CUT_TICK_MS); };

  // Drift-correct the ACTIVE video only -- identical logic to
  // createAudioMasterSync's follow(), scoped to entries[activeIndex].
  function follow() {
    if (destroyed || !active || !started || activeIndex < 0) return;
    const video = entries[activeIndex] && entries[activeIndex].video;
    if (!video) return;
    if (document.hidden || video.readyState < 2) return;

    const target = videoTargetFor(activeIndex);
    const drift = video.currentTime - target;
    const ad = Math.abs(drift);
    if (ad > SEEK_VIDEO) {
      if (isBuffered(video, target)) {
        try { video.currentTime = target; } catch (_) {}
        video.playbackRate = 1;
      } else if (drift < 0) {
        video.playbackRate = 1 + MAX_RATE_DELTA;
      } else {
        video.playbackRate = 1 - MAX_RATE_DELTA;
      }
    } else if (ad > DEADBAND) {
      const clamped = Math.max(-MAX_RATE_DELTA, Math.min(MAX_RATE_DELTA, drift));
      video.playbackRate = 1 - clamped;
    } else {
      video.playbackRate = 1;
    }
  }

  // Swap the active video. On a cut-triggered swap the new video is already
  // parked at the right frame, so no reseek is needed -- only warmup/resume
  // (seekExact) need an explicit alignment.
  function activate(newIdx, { seekExact = false } = {}) {
    const prevIdx = activeIndex;
    activeIndex = newIdx;
    const newVideo = entries[newIdx] && entries[newIdx].video;
    if (newVideo) {
      newVideo.muted = true;
      if (seekExact) {
        try { newVideo.currentTime = videoTargetFor(newIdx); } catch (_) {}
      }
      if (active) {
        const vp = newVideo.play();
        if (vp && vp.catch) vp.catch(() => {});
      }
      newVideo.playbackRate = 1;
    }
    if (prevIdx !== newIdx) onActiveAngleChange(newIdx);
    parkInactive(); // pauses + re-parks every now-inactive video, incl. the old active one
  }

  function checkCut() {
    if (destroyed || !active || !started) return;
    if (document.hidden) return;
    const idx = angleAt(audio.currentTime);
    if (idx !== activeIndex) activate(idx);
  }

  function warmupThenStart() {
    warm0 = null;
    if (warmId) clearInterval(warmId);
    warmId = setInterval(() => {
      if (destroyed || !active) { clearInterval(warmId); warmId = null; return; }
      if (audio.currentTime > audioStart + 0.2) {
        if (warm0 === null) warm0 = audio.currentTime;
        if (audio.currentTime - warm0 > WARMUP_PROGRESS) {
          clearInterval(warmId); warmId = null;
          started = true;
          activate(angleAt(audio.currentTime), { seekExact: true });
          startFollow();
          startCutTicker();
        }
      }
    }, 100);
  }

  function play() {
    if (destroyed) return;
    active = true;
    entries.forEach((e) => { if (e && e.video) e.video.muted = true; });
    audio.playbackRate = 1;
    const p = audio.play();
    if (p && p.catch) p.catch(() => {});
    if (!started) {
      // First start: let the audio warm up (iOS ramps its clock slowly), then
      // bring the active video in already aligned so we don't bank a startup gap.
      if (audio.readyState >= 1 && audio.currentTime < audioStart) {
        try { audio.currentTime = audioStart; } catch (_) {}
      }
      warmupThenStart();
    } else {
      const idx = activeIndex >= 0 ? activeIndex : angleAt(audio.currentTime);
      activate(idx, { seekExact: true });
      startFollow();
      startCutTicker();
    }
  }

  function pause() {
    active = false;
    try { audio.pause(); } catch (_) {}
    entries.forEach((e) => {
      if (e && e.video) { try { e.video.pause(); } catch (_) {} }
    });
    stopFollow();
    stopCutTicker();
    if (warmId) { clearInterval(warmId); warmId = null; }
  }

  // Deliberate user scrub: master is the audio, so move the audio (a single
  // intentional seek is fine); every video repositions off the new master
  // time and the active angle is recomputed.
  function seek(masterTime) {
    const t = Math.max(0, Number(masterTime) || 0);
    try { audio.currentTime = t; } catch (_) {}
    activate(angleAt(t), { seekExact: true });
  }

  function onVisibility() {
    if (!document.hidden && active && started && activeIndex >= 0) {
      const video = entries[activeIndex] && entries[activeIndex].video;
      if (video) {
        try { video.currentTime = videoTargetFor(activeIndex); } catch (_) {}
        video.playbackRate = 1;
      }
    }
  }
  document.addEventListener('visibilitychange', onVisibility);

  function destroy() {
    destroyed = true;
    active = false;
    started = false;
    stopFollow();
    stopCutTicker();
    if (warmId) { clearInterval(warmId); warmId = null; }
    document.removeEventListener('visibilitychange', onVisibility);
    entries.forEach((e) => {
      if (e && e.video) { try { e.video.playbackRate = 1; } catch (_) {} }
    });
  }

  return { play, pause, seek, destroy, getActiveIndex: () => activeIndex };
}
