import { createAudioMasterSync, createMulticamAudioMasterSync } from './audioVideoSync';

// Minimal HTMLMediaElement stand-ins. We only fake the properties/methods
// audioVideoSync.js actually touches, and drive `currentTime` ourselves
// between timer ticks to simulate playback (jsdom doesn't implement real
// media playback, and we want deterministic control over drift/buffering).
function makeBuffered(ranges) {
  return {
    length: ranges.length,
    start: (i) => ranges[i][0],
    end: (i) => ranges[i][1],
  };
}

function makeVideo({ currentTime = 0, buffered = [[0, 0]], readyState = 4, duration = NaN } = {}) {
  // `currentTime` is a getter/setter (instead of a plain property) so tests
  // can assert on write *count*, not just final value -- needed to prove the
  // freeze-frame edge-hold pauses once and then leaves currentTime alone on
  // subsequent follow ticks. Reads/writes behave exactly like a plain
  // property otherwise, so this is transparent to all existing assertions.
  let _currentTime = currentTime;
  let _playbackRate = 1;
  const video = {
    buffered: makeBuffered(buffered),
    readyState,
    duration, // NaN by default == "metadata not loaded", matching real elements pre-load
    muted: false,
    currentTimeWrites: 0,
    playbackRateWrites: 0,
    play: jest.fn(() => Promise.resolve()),
    pause: jest.fn(),
  };
  Object.defineProperty(video, 'currentTime', {
    enumerable: true,
    get() { return _currentTime; },
    set(v) { _currentTime = v; video.currentTimeWrites += 1; },
  });
  // playbackRate writes are tracked too: on iOS the *write itself* hiccups
  // the video pipeline, so the follow loop must not touch it in steady state.
  Object.defineProperty(video, 'playbackRate', {
    enumerable: true,
    get() { return _playbackRate; },
    set(v) { _playbackRate = v; video.playbackRateWrites += 1; },
  });
  return video;
}

// iOS-like video: discards currentTime writes issued before metadata is
// loaded (readyState < 1) — the real-device behavior behind "the clip shows
// the first seconds of the full video". Supports loadedmetadata listeners so
// tests can deliver metadata later, like a slow HLS spin-up on a phone.
function makeIOSVideo({ currentTime = 0, buffered = [[0, 0]] } = {}) {
  let _currentTime = currentTime;
  const listeners = {};
  const video = {
    buffered: makeBuffered(buffered),
    readyState: 0,
    duration: NaN,
    playbackRate: 1,
    muted: false,
    currentTimeWrites: 0,
    play: jest.fn(() => Promise.resolve()),
    pause: jest.fn(),
    addEventListener: (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); },
    removeEventListener: (ev, fn) => {
      listeners[ev] = (listeners[ev] || []).filter((f) => f !== fn);
    },
    loadMetadata(duration) {
      video.readyState = 1;
      video.duration = duration;
      (listeners.loadedmetadata || []).slice().forEach((fn) => fn());
    },
  };
  Object.defineProperty(video, 'currentTime', {
    enumerable: true,
    get() { return _currentTime; },
    set(v) {
      video.currentTimeWrites += 1;
      if (video.readyState >= 1) _currentTime = v; // pre-metadata seeks are lost
    },
  });
  return video;
}

function makeAudio({ currentTime = 0 } = {}) {
  return {
    currentTime,
    playbackRate: 1,
    readyState: 4,
    play: jest.fn(() => Promise.resolve()),
    pause: jest.fn(),
  };
}

// Runs sync.play() through the warm-up phase so `started` flips true and the
// follow() loop is live, without depending on real elapsed time.
function warmUp(sync, audio) {
  sync.play();
  audio.currentTime = 0.3;
  jest.advanceTimersByTime(100);
  audio.currentTime = 1.6; // > audioStart(0) + 0.2, and > warm0 + WARMUP_PROGRESS(1.2)
  jest.advanceTimersByTime(100);
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('createAudioMasterSync follow loop', () => {
  test('does not seek the video past its buffered edge when bandwidth-starved', () => {
    // Only 1s of video is buffered — simulates a mobile connection that
    // can't keep up with real-time playback.
    const video = makeVideo({ currentTime: 0, buffered: [[0, 1]] });
    const audio = makeAudio({ currentTime: 0 });
    const sync = createAudioMasterSync(video, audio, {});

    warmUp(sync, audio);

    // Audio (master) has raced ahead to t=3 while the video is stalled at
    // the edge of its 1s buffer.
    audio.currentTime = 3;
    video.currentTime = 0.9;
    jest.advanceTimersByTime(250);

    // A hard seek to videoTarget() (3) would jump past the buffered [0,1]
    // range, discarding progress and forcing a fetch further ahead than
    // last time -- the mechanism behind the growing-freeze spiral. It must
    // not seek there. And it must not "chase" with a rate change either:
    // the video is starved, not misclocked -- leave it alone to buffer.
    expect(video.currentTime).toBe(0.9);
    expect(sync.getVideoSeeks()).toBe(0);
    expect(video.playbackRate).toBe(1);
  });

  test('noise-level drift produces zero writes to the video (iOS clock granularity)', () => {
    // iOS reports audio.currentTime in coarse (~0.25s) steps, so the loop
    // permanently sees small phantom drift. Every playbackRate write or
    // seek is a visible hiccup on iOS -- steady state must be zero-touch.
    const video = makeVideo({ currentTime: 0, buffered: [[0, 10]] });
    const audio = makeAudio({ currentTime: 0 });
    const sync = createAudioMasterSync(video, audio, {});
    warmUp(sync, audio);

    audio.currentTime = 2.0;
    video.currentTime = 2.3; // 0.3s "drift" -- indistinguishable from clock noise
    const ctWrites = video.currentTimeWrites;
    const rateWrites = video.playbackRateWrites;
    jest.advanceTimersByTime(1000); // four follow ticks

    expect(video.currentTimeWrites).toBe(ctWrites);
    expect(video.playbackRateWrites).toBe(rateWrites);
    expect(video.playbackRate).toBe(1);
  });

  test('hard-seeks once the drifted-to target is already buffered', () => {
    const video = makeVideo({ currentTime: 0, buffered: [[0, 10]] });
    const audio = makeAudio({ currentTime: 0 });
    const sync = createAudioMasterSync(video, audio, {});

    warmUp(sync, audio);

    audio.currentTime = 3;
    video.currentTime = 2; // 1s drift (> SEEK_VIDEO 0.6s), but target(3) is buffered
    jest.advanceTimersByTime(250);

    expect(video.currentTime).toBe(3);
    expect(sync.getVideoSeeks()).toBe(1);
  });
});

describe('createAudioMasterSync loop window (feed clips)', () => {
  test('loops the audio back to loopStart and realigns the video', () => {
    // Feed clip: clipStart=2, clipEnd=5, offset=1 → audio window [3, 6],
    // video window [2, 5].
    const video = makeVideo({ currentTime: 0, buffered: [[0, 10]] });
    const audio = makeAudio({ currentTime: 0 });
    const sync = createAudioMasterSync(video, audio, {
      offset: 1,
      audioStart: 3,
      audioLoopStart: () => 3,
      audioLoopEnd: () => 6,
    });

    sync.play();
    // play() pre-seeks the audio to audioStart before warm-up.
    expect(audio.currentTime).toBe(3);

    // Drive the warm-up: needs > audioStart + 0.2 to latch warm0, then
    // WARMUP_PROGRESS (1.2s) of real audio progress to start the video.
    audio.currentTime = 3.3;
    jest.advanceTimersByTime(100);
    audio.currentTime = 4.6;
    jest.advanceTimersByTime(100);
    expect(video.play).toHaveBeenCalled();
    expect(video.currentTime).toBeCloseTo(3.6); // videoTarget = 4.6 - offset

    // Audio (master) reaches the loop end: it must wrap to loopStart and the
    // video must be pulled back to the matching clipStart.
    audio.currentTime = 5.98;
    video.currentTime = 4.98;
    jest.advanceTimersByTime(250);

    expect(audio.currentTime).toBe(3);
    expect(video.currentTime).toBe(2);
    expect(video.playbackRate).toBe(1);
  });
});

describe('createMulticamAudioMasterSync', () => {
  // Three cuts over two angles: angle 0 for [0,10), angle 1 for [10,20),
  // back to angle 0 for [20, end) — lets us exercise both "swap forward" and
  // "park at a future re-activation" in the same fixture.
  function makeCuts() {
    return [
      { timeSec: 0, angleIndex: 0 },
      { timeSec: 10, angleIndex: 1 },
      { timeSec: 20, angleIndex: 0 },
    ];
  }

  function makeEntries() {
    const video0 = makeVideo({ currentTime: 0, buffered: [[0, 100]] });
    const video1 = makeVideo({ currentTime: 0, buffered: [[0, 100]] });
    return {
      video0,
      video1,
      entries: [
        { video: video0, offset: 0 },
        { video: video1, offset: 0 },
      ],
    };
  }

  // Same warm-up shape as the single-video controller: audio needs to pass
  // audioStart + 0.2, then accrue WARMUP_PROGRESS (1.2s) of real progress
  // before the initially-active video is brought in.
  function warmUpMulti(sync, audio) {
    sync.play();
    audio.currentTime = 0.3;
    jest.advanceTimersByTime(100);
    audio.currentTime = 1.6;
    jest.advanceTimersByTime(100);
  }

  test('activates angle 0 after warmup; angle 1 stays paused and parks at its next activation cut', () => {
    const { video0, video1, entries } = makeEntries();
    const audio = makeAudio({ currentTime: 0 });
    const onActiveAngleChange = jest.fn();
    const sync = createMulticamAudioMasterSync(entries, audio, {
      cuts: makeCuts(),
      onActiveAngleChange,
    });

    warmUpMulti(sync, audio);

    expect(onActiveAngleChange).toHaveBeenCalledTimes(1);
    expect(onActiveAngleChange).toHaveBeenCalledWith(0);
    expect(video0.play).toHaveBeenCalled();
    expect(video0.currentTime).toBeCloseTo(1.6); // aligned to the audio clock
    expect(video1.pause).toHaveBeenCalled();
    expect(video1.currentTime).toBe(10); // parked at cuts[1].timeSec - offset1
    expect(sync.getActiveIndex()).toBe(0);
  });

  test('crossing a cut boundary swaps the active video', () => {
    const { video0, video1, entries } = makeEntries();
    const audio = makeAudio({ currentTime: 0 });
    const onActiveAngleChange = jest.fn();
    const sync = createMulticamAudioMasterSync(entries, audio, {
      cuts: makeCuts(),
      onActiveAngleChange,
    });
    warmUpMulti(sync, audio);

    // Audio clock crosses the 10s cut; the cut ticker (CUT_TICK_MS=50) picks
    // it up on its next tick.
    audio.currentTime = 10;
    jest.advanceTimersByTime(50);

    expect(video1.play).toHaveBeenCalled();
    expect(video0.pause).toHaveBeenCalled();
    expect(onActiveAngleChange).toHaveBeenLastCalledWith(1);
    expect(sync.getActiveIndex()).toBe(1);
    // The old (now-inactive) video is re-parked at its next activation cut (20s).
    expect(video0.currentTime).toBe(20);
  });

  test('seek() into a later segment recomputes the active angle and repositions both videos', () => {
    const { video0, video1, entries } = makeEntries();
    const audio = makeAudio({ currentTime: 0 });
    const onActiveAngleChange = jest.fn();
    const sync = createMulticamAudioMasterSync(entries, audio, {
      cuts: makeCuts(),
      onActiveAngleChange,
    });
    warmUpMulti(sync, audio); // active = 0

    sync.seek(15); // lands inside [10,20) -> angle 1

    expect(audio.currentTime).toBe(15);
    expect(sync.getActiveIndex()).toBe(1);
    expect(video1.currentTime).toBe(15); // active video: exact target
    expect(video0.currentTime).toBe(20); // inactive video: parked at its next activation (20s)
    expect(video1.play).toHaveBeenCalled(); // still playing -> new active video starts
    expect(onActiveAngleChange).toHaveBeenLastCalledWith(1);
  });

  test('noise-level drift leaves the active video completely alone', () => {
    const { video0, video1, entries } = makeEntries();
    const audio = makeAudio({ currentTime: 0 });
    const sync = createMulticamAudioMasterSync(entries, audio, { cuts: makeCuts() });
    warmUpMulti(sync, audio); // active = 0; video1 parked at 10, untouched since

    video0.currentTime = 1.9; // target is 1.6 -> 0.3s "drift" == iOS clock noise
    const ctWrites0 = video0.currentTimeWrites;
    const rateWrites0 = video0.playbackRateWrites;
    jest.advanceTimersByTime(1000); // several follow ticks

    expect(video0.playbackRate).toBe(1); // no rate nudges -- they hiccup iOS
    expect(video0.currentTimeWrites).toBe(ctWrites0);
    expect(video0.playbackRateWrites).toBe(rateWrites0);
    expect(video1.currentTime).toBe(10); // parked video untouched too
  });

  test('visible drift hard-seeks the active video only', () => {
    const { video0, video1, entries } = makeEntries();
    const audio = makeAudio({ currentTime: 0 });
    const sync = createMulticamAudioMasterSync(entries, audio, { cuts: makeCuts() });
    warmUpMulti(sync, audio); // active = 0, audio at 1.6

    video0.currentTime = 4; // 2.4s ahead of target 1.6, target buffered [0,100]
    jest.advanceTimersByTime(250);

    expect(video0.currentTime).toBeCloseTo(1.6); // one corrective seek
    expect(video0.playbackRate).toBe(1);
    expect(video1.currentTime).toBe(10); // inactive video untouched
  });

  test('destroy() clears timers so no further callbacks or swaps fire', () => {
    const { video0, video1, entries } = makeEntries();
    const audio = makeAudio({ currentTime: 0 });
    const onActiveAngleChange = jest.fn();
    const sync = createMulticamAudioMasterSync(entries, audio, {
      cuts: makeCuts(),
      onActiveAngleChange,
    });
    warmUpMulti(sync, audio);
    expect(onActiveAngleChange).toHaveBeenCalledTimes(1);
    const playCallsBefore = video1.play.mock.calls.length;

    sync.destroy();

    // This would cross the 10s cut and trigger a swap if any timer survived.
    audio.currentTime = 10;
    jest.advanceTimersByTime(300);

    expect(onActiveAngleChange).toHaveBeenCalledTimes(1); // no new calls
    expect(video1.play.mock.calls.length).toBe(playCallsBefore);
    expect(video0.playbackRate).toBe(1);
    expect(video1.playbackRate).toBe(1);
  });
});

describe('createMulticamAudioMasterSync freeze-frame at footage edges', () => {
  // Angle 0 is cut-active for the whole timeline -- isolates the
  // freeze-frame behavior from cut-boundary swapping (covered separately
  // above).
  const SINGLE_ANGLE_CUTS = [{ timeSec: 0, angleIndex: 0 }];

  function makeEntries({ duration0 = 5, duration1 = 100, offset0 = 0 } = {}) {
    const video0 = makeVideo({ currentTime: 0, buffered: [[0, 1000]], duration: duration0 });
    const video1 = makeVideo({ currentTime: 0, buffered: [[0, 1000]], duration: duration1 });
    return {
      video0,
      video1,
      entries: [
        { video: video0, offset: offset0 },
        { video: video1, offset: 0 },
      ],
    };
  }

  function warmUpMulti(sync, audio) {
    sync.play();
    audio.currentTime = 0.3;
    jest.advanceTimersByTime(100);
    audio.currentTime = 1.6;
    jest.advanceTimersByTime(100);
  }

  test('(a) audio advancing past the active angle\'s footage end pauses its video once and stops writing currentTime', () => {
    // video0's footage is only 5s long; the master clock (and angle-0's own
    // cut segment) runs well past that.
    const { video0, entries } = makeEntries({ duration0: 5 });
    const audio = makeAudio({ currentTime: 0 });
    const sync = createMulticamAudioMasterSync(entries, audio, { cuts: SINGLE_ANGLE_CUTS });
    warmUpMulti(sync, audio); // activeIndex=0, target=1.6 -- comfortably inside [0,5)

    expect(video0.pause).not.toHaveBeenCalled();

    // Audio (master) advances past video0's duration (5s) -- well past the
    // dur-0.05 hold margin.
    audio.currentTime = 8;
    jest.advanceTimersByTime(250);

    expect(video0.pause).toHaveBeenCalledTimes(1);
    expect(video0.playbackRate).toBe(1);
    // Seeks land on the clamped last frame (dur - 0.01), not the raw
    // (out-of-range) target -- proves the explicit clamp, not a browser one.
    expect(video0.currentTime).toBeCloseTo(4.99);
    const writesAfterFirstHold = video0.currentTimeWrites;

    // Keep advancing the master clock further past the edge over several
    // more follow ticks -- no further pause() calls, no further writes.
    audio.currentTime = 12;
    jest.advanceTimersByTime(250);
    audio.currentTime = 20;
    jest.advanceTimersByTime(250);

    expect(video0.pause).toHaveBeenCalledTimes(1); // still exactly once
    expect(video0.currentTimeWrites).toBe(writesAfterFirstHold); // no more writes
  });

  test('(b) seeking back into coverage after a hold resumes play() and realigns currentTime to target', () => {
    const { video0, entries } = makeEntries({ duration0: 5 });
    const audio = makeAudio({ currentTime: 0 });
    const sync = createMulticamAudioMasterSync(entries, audio, { cuts: SINGLE_ANGLE_CUTS });
    warmUpMulti(sync, audio);

    audio.currentTime = 8; // past video0's 5s duration -- enters the 'end' hold
    jest.advanceTimersByTime(250);
    expect(video0.pause).toHaveBeenCalledTimes(1);
    const playCallsBeforeResume = video0.play.mock.calls.length;

    sync.seek(2); // back inside angle 0's footage [0, 5)

    expect(sync.getActiveIndex()).toBe(0);
    expect(video0.play).toHaveBeenCalledTimes(playCallsBeforeResume + 1);
    expect(video0.currentTime).toBe(2);
    expect(video0.playbackRate).toBe(1);

    // Drift correction is live again on the next follow tick (no crash, no
    // re-entering the hold for an in-range target).
    video0.currentTime = 2;
    jest.advanceTimersByTime(250);
    expect(video0.pause).toHaveBeenCalledTimes(1); // not paused again
  });

  test('(c) an angle whose footage starts later than the current master time holds the first frame, then auto-plays once covered', () => {
    // video0's footage doesn't start until 5s into the master timeline
    // (offset=5), even though angle 0 is cut-active from master time 0.
    const { video0, entries } = makeEntries({ duration0: 100, offset0: 5 });
    const audio = makeAudio({ currentTime: 0 });
    const sync = createMulticamAudioMasterSync(entries, audio, { cuts: SINGLE_ANGLE_CUTS });

    warmUpMulti(sync, audio); // audio lands at 1.6 -> target0 = max(0, 1.6-5) = 0

    expect(sync.getActiveIndex()).toBe(0);
    expect(video0.pause).toHaveBeenCalledTimes(1); // held at the first frame, not playing
    expect(video0.play).not.toHaveBeenCalled();
    expect(video0.currentTime).toBe(0);

    // Master clock reaches video0's footage (offset 5) -- target crosses
    // back above the hold margin, so the video should auto-resume.
    audio.currentTime = 5.2; // target = 0.2, inside (0.05, dur-0.05)
    jest.advanceTimersByTime(250);

    expect(video0.play).toHaveBeenCalledTimes(1);
    expect(video0.currentTime).toBeCloseTo(0.2);
    expect(video0.playbackRate).toBe(1);
  });
});

describe('createAudioMasterSync recovery from hopeless drift', () => {
  // Rate nudges reclaim at most 0.1s of drift per second of playback. Past a
  // few seconds of drift that's minutes of visible trailing — the controller
  // must hard-seek even into an unbuffered range (one seek, not a chase).
  test('force-seeks the video when drift exceeds the rate-nudge horizon even if the target is unbuffered', () => {
    const video = makeVideo({ currentTime: 0, buffered: [[0, 1]] });
    const audio = makeAudio({ currentTime: 0 });
    const sync = createAudioMasterSync(video, audio, {});
    warmUp(sync, audio);

    // Audio (master) is at 100s; the video sits near 0 with only [0,1]
    // buffered — the feed-clip failure shape (video never positioned at the
    // clip, target hundreds of seconds outside the buffer).
    audio.currentTime = 100;
    video.currentTime = 0.9;
    jest.advanceTimersByTime(250);

    expect(video.currentTime).toBe(100);
    expect(video.playbackRate).toBe(1);
    expect(sync.getVideoSeeks()).toBe(1);
  });

  test('a forced seek does not repeat within its cooldown window', () => {
    const video = makeVideo({ currentTime: 0, buffered: [[0, 1]] });
    const audio = makeAudio({ currentTime: 0 });
    const sync = createAudioMasterSync(video, audio, {});
    warmUp(sync, audio);

    audio.currentTime = 100;
    video.currentTime = 0.9;
    jest.advanceTimersByTime(250);
    expect(sync.getVideoSeeks()).toBe(1); // the first forced seek

    // Still hopeless (the seek target hasn't buffered; audio keeps going).
    // Within the cooldown the controller must NOT seek again — and must not
    // rate-chase either (the video is buffering at the new position; on iOS
    // rate writes are themselves hiccups). Leave it alone.
    audio.currentTime = 104;
    video.currentTime = 100;
    jest.advanceTimersByTime(250);
    expect(sync.getVideoSeeks()).toBe(1);
    expect(video.currentTime).toBe(100);
    expect(video.playbackRate).toBe(1);

    // Once the cooldown has elapsed and it is still hopelessly behind, one
    // more forced seek is allowed.
    audio.currentTime = 110;
    jest.advanceTimersByTime(4000);
    expect(sync.getVideoSeeks()).toBeGreaterThanOrEqual(2);
    expect(video.currentTime).toBeGreaterThan(100);
  });
});

describe('createAudioMasterSync with pre-metadata seeks lost (iOS)', () => {
  test('re-applies the video position once metadata arrives', () => {
    // Feed clip deep into the set: audio window starts at 601 (clipStart 600
    // + offset 1). The iOS-like video ignores every seek until metadata
    // loads, which on a phone happens seconds after play() is tapped.
    const video = makeIOSVideo({ currentTime: 0, buffered: [[0, 1000]] });
    const audio = makeAudio({ currentTime: 0 });
    const sync = createAudioMasterSync(video, audio, { offset: 1, audioStart: 601 });

    sync.play();
    expect(audio.currentTime).toBe(601); // audio pre-seeked to the clip window

    // Warm-up completes while the video still has no metadata.
    audio.currentTime = 601.3;
    jest.advanceTimersByTime(100);
    audio.currentTime = 602.6;
    jest.advanceTimersByTime(100);
    expect(video.currentTime).toBe(0); // every seek so far was discarded

    // Metadata finally arrives: the controller must re-position the video at
    // the *current* audio target, not leave it playing from 0.
    video.loadMetadata(1000);
    expect(video.currentTime).toBeCloseTo(601.6); // 602.6 - offset(1)
  });
});

describe('createAudioMasterSync warm-up prefetch', () => {
  test('positions the video at its target when play() is called so buffering starts at the right place', () => {
    const video = makeVideo({ currentTime: 0, buffered: [[0, 1000]] });
    const audio = makeAudio({ currentTime: 0 });
    const sync = createAudioMasterSync(video, audio, { offset: 1, audioStart: 601 });

    sync.play();

    // Before the warm-up completes, the video should already point at the
    // clip position (audioStart - offset) so the fetch starts there instead
    // of at 0:00 — on a phone this is seconds of startup difference.
    expect(video.currentTime).toBeCloseTo(600);
    expect(video.preload).toBe('auto');
  });
});

describe('createMulticamAudioMasterSync recovery and iOS parity', () => {
  const SINGLE_ANGLE_CUTS = [{ timeSec: 0, angleIndex: 0 }];

  function warmUpMulti(sync, audio) {
    sync.play();
    audio.currentTime = 0.3;
    jest.advanceTimersByTime(100);
    audio.currentTime = 1.6;
    jest.advanceTimersByTime(100);
  }

  test('force-seeks the active video on hopeless unbuffered drift', () => {
    const video0 = makeVideo({ currentTime: 0, buffered: [[0, 1]], duration: 1000 });
    const audio = makeAudio({ currentTime: 0 });
    const sync = createMulticamAudioMasterSync(
      [{ video: video0, offset: 0 }],
      audio,
      { cuts: SINGLE_ANGLE_CUTS }
    );
    warmUpMulti(sync, audio);

    audio.currentTime = 100;
    video0.currentTime = 0.9;
    jest.advanceTimersByTime(250);

    expect(video0.currentTime).toBe(100);
    expect(video0.playbackRate).toBe(1);
  });

  test('activate() re-applies the active video position once metadata arrives', () => {
    const video0 = makeIOSVideo({ currentTime: 0, buffered: [[0, 1000]] });
    const audio = makeAudio({ currentTime: 0 });
    const sync = createMulticamAudioMasterSync(
      [{ video: video0, offset: 0 }],
      audio,
      { cuts: SINGLE_ANGLE_CUTS }
    );
    warmUpMulti(sync, audio); // activate(0, seekExact) fires with no metadata yet

    expect(video0.currentTime).toBe(0); // the exact seek was discarded

    video0.loadMetadata(1000);
    expect(video0.currentTime).toBeCloseTo(1.6); // repositioned at the audio clock
  });
});
