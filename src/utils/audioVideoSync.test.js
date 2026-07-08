import { createAudioMasterSync } from './audioVideoSync';

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
