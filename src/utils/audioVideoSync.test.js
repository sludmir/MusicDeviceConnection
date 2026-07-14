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

function makeVideo({ currentTime = 0, buffered = [[0, 0]], readyState = 4 } = {}) {
  return {
    currentTime,
    buffered: makeBuffered(buffered),
    readyState,
    playbackRate: 1,
    muted: false,
    play: jest.fn(() => Promise.resolve()),
    pause: jest.fn(),
  };
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
    // not seek there.
    expect(video.currentTime).toBe(0.9);
    expect(sync.getVideoSeeks()).toBe(0);
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

  test('drift correction applies only to the active video', () => {
    const { video0, video1, entries } = makeEntries();
    const audio = makeAudio({ currentTime: 0 });
    const sync = createMulticamAudioMasterSync(entries, audio, { cuts: makeCuts() });
    warmUpMulti(sync, audio); // active = 0; video1 parked at 10, untouched since

    video0.currentTime = 1.9; // target is 1.6 -> 0.3s drift (> DEADBAND, < SEEK_VIDEO)
    jest.advanceTimersByTime(250); // one FOLLOW_MS tick

    expect(video0.playbackRate).not.toBe(1); // active video gets the rate nudge
    expect(video1.playbackRate).toBe(1); // inactive video is left alone
    expect(video1.currentTime).toBe(10); // untouched by the follow loop
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
