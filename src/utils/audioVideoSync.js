// Audio-master A/V sync for an uploaded lossless track overlaid on a muted video.
//
// Why "audio-master": on iOS, seeking an <audio> element causes an audible
// stall/rebuffer. Any sync scheme that re-seeks the audio to chase the video
// therefore stutters (drift -> seek -> stall -> falls behind -> seek again...).
// The lossless track plays perfectly smoothly as long as it is never seeked,
// so the AUDIO is the master clock and is never seeked during playback.
//
// Why "align and leave alone": on iOS every intervention on a playing video
// -- a playbackRate write or a currentTime seek -- is itself a visible
// hiccup, and iOS reports media currentTime in coarse (~0.25s) steps, so a
// tight follow loop sees phantom drift on every tick and pokes the video
// forever (invisible on desktop, permanent jank on a phone). So the muted
// VIDEO is aligned once at start and then left completely alone; the follow
// loop only intervenes with a single hard seek when drift becomes genuinely
// visible (> SEEK_VIDEO), and otherwise never touches the element.
//
// Offset convention (matches the rest of the app):
//     audio.currentTime = video.currentTime + offset
//   => videoTarget       = audio.currentTime - offset

import { angleIndexAt } from './multicam';

const WARMUP_PROGRESS = 1.2;  // seconds of *real* audio progress before starting the video
// Hard re-seek the video only when it is off by more than this. Must sit
// well above iOS's ~0.25s currentTime read granularity (plus tick phase),
// or the loop corrects phantom drift forever.
const SEEK_VIDEO = 0.9;
const FOLLOW_MS = 250;        // how often the follow loop samples the clocks
// Past FORCE_SEEK seconds of drift the target being unbuffered no longer
// matters (the video is at the wrong position, not merely bandwidth-lagged):
// hard-seek anyway. The cooldown keeps the anti-spiral property of the
// buffered-only guard: one recovery fetch at a time, never a seek storm.
const FORCE_SEEK = 3;
const FORCE_SEEK_COOLDOWN_MS = 4000;

// Startup alignment verification: iOS can silently drop a currentTime write
// on a freshly-attached HLS stream even after metadata is in (no error, no
// 'seeked'). After each alignment seek, re-check the OUTCOME and re-issue
// while the video is hopelessly off target (> FORCE_SEEK — same threshold
// as the follow loop so a merely bandwidth-starved video is never poked).
const SEEK_VERIFY_MS = 800;
const SEEK_VERIFY_ATTEMPTS = 6;

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
  let lastForceSeekAt = 0;
  let metaCleanup = null;
  let verifyId = null;
  let verifyAttempts = 0;

  const clearVerify = () => { if (verifyId) { clearTimeout(verifyId); verifyId = null; } };

  const videoTarget = () => Math.max(0, audio.currentTime - offset);

  // Position the video at the current audio target — and verify the write
  // took. Two iOS failure modes are covered:
  //   1. writes before metadata are discarded → re-apply the fresh target on
  //      loadedmetadata (as before);
  //   2. writes on a just-attached, already-playing HLS stream are dropped
  //      with no error and no 'seeked' → re-check shortly after and re-issue,
  //      bounded, until the video sits near the live target.
  function positionVideo() {
    clearVerify();
    verifyAttempts = 0;
    applyAlignmentSeek();
  }

  function applyAlignmentSeek() {
    try { video.currentTime = videoTarget(); } catch (_) {}
    if (video.readyState < 1 && typeof video.addEventListener === 'function' && !metaCleanup) {
      const onMeta = () => {
        if (metaCleanup) metaCleanup();
        if (destroyed) return;
        applyAlignmentSeek();
      };
      video.addEventListener('loadedmetadata', onMeta);
      metaCleanup = () => {
        video.removeEventListener('loadedmetadata', onMeta);
        metaCleanup = null;
      };
      return; // verification restarts once metadata arrives
    }
    if (verifyAttempts >= SEEK_VERIFY_ATTEMPTS) return;
    verifyId = setTimeout(() => {
      verifyId = null;
      if (destroyed || !active) return;
      if (Math.abs(video.currentTime - videoTarget()) <= FORCE_SEEK) return; // landed
      verifyAttempts += 1;
      videoSeeks += 1;
      applyAlignmentSeek();
    }, SEEK_VERIFY_MS);
  }

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
        videoSeeks += 1;
      } else if (ad > FORCE_SEEK && Date.now() - lastForceSeekAt > FORCE_SEEK_COOLDOWN_MS) {
        lastForceSeekAt = Date.now();
        try { video.currentTime = videoTarget(); } catch (_) {}
        videoSeeks += 1;
      }
      // else: bandwidth-starved (or in the forced-seek cooldown) -- the
      // video is buffering, not misclocked. Leave it alone entirely.
    }
    // Steady state is zero-touch. Only restore the rate if something
    // external changed it -- on iOS a playbackRate write is itself a hiccup.
    if (video.playbackRate !== 1) {
      try { video.playbackRate = 1; } catch (_) {}
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
          positionVideo();
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
      // Kick the video's fetch off now, AT the target position, while the
      // audio warms up -- an iOS HLS stream takes seconds to spin up, and
      // buffering from 0:00 is wasted when the window starts mid-set.
      try { video.preload = 'auto'; } catch (_) {}
      positionVideo();
      warmupThenStartVideo();
    } else {
      const vp = video.play();
      if (vp && vp.catch) vp.catch(() => {});
      positionVideo();
      startFollow();
    }
  }

  function pause() {
    active = false;
    try { audio.pause(); } catch (_) {}
    try { video.pause(); } catch (_) {}
    stopFollow();
    clearVerify();
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
      if (video.playbackRate !== 1) { try { video.playbackRate = 1; } catch (_) {} }
    }
  }
  document.addEventListener('visibilitychange', onVisibility);

  function destroy() {
    destroyed = true;
    active = false;
    started = false;
    stopFollow();
    clearVerify();
    if (warmId) { clearInterval(warmId); warmId = null; }
    if (metaCleanup) metaCleanup();
    document.removeEventListener('visibilitychange', onVisibility);
    if (video.playbackRate !== 1) { try { video.playbackRate = 1; } catch (_) {} }
  }

  return { play, pause, seek, destroy, getVideoSeeks: () => videoSeeks };
}

// ---------------------------------------------------------------------------
// Multicam variant: one audio clock, N muted videos (one per angle). Only the
// ACTIVE video (per `cuts`, at the audio clock) is slaved to the audio via
// the same align-and-leave-alone follow loop as createAudioMasterSync above;
// inactive videos are paused and "parked" -- pre-seeked to their own video
// time at their next activation cut, so a future cut swap starts on an
// already-decoded frame instead of a fresh seek.
//
// A cut ticker compares the audio clock to the cut list and swaps the active
// video. The plan explicitly permits setInterval over rAF here for
// determinism under the jest fake-timer harness.

const CUT_TICK_MS = 50; // cut-boundary poll interval
const EDGE_MARGIN = 0.05; // within this of a footage edge, freeze instead of chasing

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
  let edgeHold = null;   // null | 'start' | 'end' -- freeze-frame state of the active video
  let lastForceSeekAt = 0;
  let metaCleanup = null;

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

  // Clamp a video seek target into playable bounds. Browsers clamp seeks to
  // [0, duration] themselves, but doing it explicitly here means an
  // out-of-range target (footage that starts later, or ends earlier, than
  // the master window) lands on an actual last/first frame -- and tests can
  // assert the exact seek destination.
  const clampVideoSeek = (t, dur) => (
    Number.isFinite(dur) ? Math.max(0, Math.min(t, dur - 0.01)) : Math.max(0, t)
  );

  // Same iOS guard as the single-video controller's positionVideo(): a
  // currentTime write before metadata is loaded is silently discarded, so
  // re-apply the fresh (clamped) target on loadedmetadata -- but only if
  // this angle is still the active one by then.
  function positionActiveVideo(video, idx) {
    try { video.currentTime = clampVideoSeek(videoTargetFor(idx), video.duration); } catch (_) {}
    if (video.readyState < 1 && typeof video.addEventListener === 'function') {
      if (metaCleanup) metaCleanup();
      const onMeta = () => {
        if (metaCleanup) metaCleanup();
        if (destroyed || idx !== activeIndex) return;
        try { video.currentTime = clampVideoSeek(videoTargetFor(idx), video.duration); } catch (_) {}
      };
      video.addEventListener('loadedmetadata', onMeta);
      metaCleanup = () => {
        video.removeEventListener('loadedmetadata', onMeta);
        metaCleanup = null;
      };
    }
  }

  // Freeze-frame at footage edges. When `idx`'s target time is at/past its
  // video's duration, hold the LAST frame (paused); when at/before 0 (and
  // the angle is nonetheless cut-active), hold the FIRST frame. Pauses once
  // on *entering* a hold -- not on every tick -- and auto-resumes (play() +
  // realign) the instant the target re-enters coverage, whether that's the
  // audio progressing forward into the footage or a user seek landing back
  // in range. A no-op (returns false, clears any hold) when the video's
  // duration isn't known yet (metadata not loaded) -- current behavior.
  // Returns true when the caller should skip drift correction this tick.
  function syncEdgeHold(video, idx, { forceRealign = false } = {}) {
    const dur = video.duration;
    if (!Number.isFinite(dur)) { edgeHold = null; return false; }
    const target = videoTargetFor(idx);
    if (target >= dur - EDGE_MARGIN) {
      const entering = edgeHold !== 'end';
      if (entering || forceRealign) {
        try { video.currentTime = clampVideoSeek(target, dur); } catch (_) {}
      }
      if (entering) { try { video.pause(); } catch (_) {} }
      if (video.playbackRate !== 1) { try { video.playbackRate = 1; } catch (_) {} }
      edgeHold = 'end';
      return true;
    }
    if (target <= EDGE_MARGIN) {
      const entering = edgeHold !== 'start';
      if (entering || forceRealign) {
        try { video.currentTime = clampVideoSeek(target, dur); } catch (_) {}
      }
      if (entering) { try { video.pause(); } catch (_) {} }
      if (video.playbackRate !== 1) { try { video.playbackRate = 1; } catch (_) {} }
      edgeHold = 'start';
      return true;
    }
    if (edgeHold) {
      // Target re-entered coverage (audio progressed into it, or a seek
      // landed back in range): resume playing and realign exactly.
      edgeHold = null;
      try { video.currentTime = clampVideoSeek(target, dur); } catch (_) {}
      if (video.playbackRate !== 1) { try { video.playbackRate = 1; } catch (_) {} }
      if (active && started) {
        const vp = video.play();
        if (vp && vp.catch) vp.catch(() => {});
      }
      return true;
    }
    return false;
  }

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
    if (syncEdgeHold(video, activeIndex)) return; // paused/resumed at a footage edge -- skip drift this tick

    const target = videoTargetFor(activeIndex);
    const drift = video.currentTime - target;
    const ad = Math.abs(drift);
    if (ad > SEEK_VIDEO) {
      if (isBuffered(video, target)) {
        try { video.currentTime = target; } catch (_) {}
      } else if (ad > FORCE_SEEK && Date.now() - lastForceSeekAt > FORCE_SEEK_COOLDOWN_MS) {
        // Hopelessly off -- same one-recovery-seek-per-cooldown policy as
        // the single-video follow loop.
        lastForceSeekAt = Date.now();
        try { video.currentTime = target; } catch (_) {}
      }
      // else: starved or cooling down -- leave the buffering video alone.
    }
    // Zero-touch steady state (see createAudioMasterSync.follow).
    if (video.playbackRate !== 1) {
      try { video.playbackRate = 1; } catch (_) {}
    }
  }

  // Swap the active video. On a cut-triggered swap the new video is already
  // parked at the right frame, so no reseek is needed -- only warmup/resume
  // (seekExact) need an explicit alignment.
  function activate(newIdx, { seekExact = false } = {}) {
    const prevIdx = activeIndex;
    if (prevIdx !== newIdx) edgeHold = null; // fresh edge state for the newly active video
    activeIndex = newIdx;
    const newVideo = entries[newIdx] && entries[newIdx].video;
    if (newVideo) {
      newVideo.muted = true;
      const held = syncEdgeHold(newVideo, newIdx, { forceRealign: seekExact });
      if (!held) {
        if (seekExact) {
          positionActiveVideo(newVideo, newIdx);
        }
        if (active) {
          const vp = newVideo.play();
          if (vp && vp.catch) vp.catch(() => {});
        }
        if (newVideo.playbackRate !== 1) { try { newVideo.playbackRate = 1; } catch (_) {} }
      }
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
      if (video && !syncEdgeHold(video, activeIndex, { forceRealign: true })) {
        try { video.currentTime = videoTargetFor(activeIndex); } catch (_) {}
        if (video.playbackRate !== 1) { try { video.playbackRate = 1; } catch (_) {} }
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
    if (metaCleanup) metaCleanup();
    document.removeEventListener('visibilitychange', onVisibility);
    entries.forEach((e) => {
      if (e && e.video && e.video.playbackRate !== 1) {
        try { e.video.playbackRate = 1; } catch (_) {}
      }
    });
  }

  return { play, pause, seek, destroy, getActiveIndex: () => activeIndex };
}
