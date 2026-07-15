# Audio-as-Spine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Camera audio is never heard when a master track exists (fix the editor-preview double-audio bug and the feed fallback); master audio becomes required-by-default with a single-angle opt-out; published sets/clips move to master-time fields with the audio clock driving all track-backed playback and freeze-frame at footage edges.

**Architecture:** See `docs/superpowers/specs/2026-07-14-audio-spine-design.md` — its time-base table is the single source of truth for field names/semantics. All five tasks own disjoint files and can run in parallel. No task commits; the orchestrator reviews and commits.

**Tech Stack:** React 18 (CRA), Firebase, Bunny HLS, Jest (`CI=true npx react-scripts test --watchAll=false`).

**Branch:** `multicam-cuts`.

---

## File ownership map (hard boundaries)

| Task | Owns (may modify NOTHING else) |
|---|---|
| 1 Feed integrity | `src/components/Feed.js` |
| 2 Modal integrity | `src/components/PostSetModal.js` |
| 3 Controller edges | `src/utils/audioVideoSync.js`, `src/utils/audioVideoSync.test.js` |
| 4 Editor | `src/components/SetEditor.js`, `src/components/SetEditor.css` |
| 5 Player | `src/components/LiveSetPlayer.js`, `src/components/LiveSetPlayer.css` |

---

### Task 1: Feed — never fall back to camera audio

Today (`Feed.js:306-316`): `onAudioError` adds the clip id to
`failedExternalAudioClipIds`; `audioReplacesVideoFor(clip, failed)` then
returns false, which **unmutes the video** (lines ~474, ~659) and hands the
loop to the video-side rAF (line ~206). Camera audio plays. Remove this.

- [ ] Remove the `failedExternalAudioClipIds` state and the fallback semantics
  from `audioReplacesVideoFor` (keep its `clip.audioReplacesVideo === false`
  check — that is the legitimate no-track/legacy path). Update all call sites
  (~206, ~266, ~474, ~658-659) and the `externalAudioFailed` UI usage.
- [ ] Replace `onAudioError` with a bounded retry: attempts 1..3 with backoff
  (~1s / 3s / 8s). Each retry re-calls `getSignedBunnyUrls('clip', clip.id)`
  (a fresh call — the util's in-memory cache only stores successes, and a
  near-expiry entry is refreshed by its own logic), re-applies the returned
  `audioTrackURL` to the audio element (`src` + `load()`), and re-arms the
  once-listeners. The video stays muted the entire time; the audio-master
  sync's warm-up already keeps the video from running ahead, so the existing
  buffering affordance is what the viewer sees.
- [ ] After the final failed attempt: leave the clip muted and paused-safe
  (do NOT unmute), log via `logAudioDebug('externalAudioUnavailable', …)`.
  A later scroll back to the clip re-runs the effect and retries fresh.
- [ ] Cleanup must cancel pending retry timers (effect teardown).
- [ ] Verify: `CI=true npx react-scripts test --watchAll=false` green
  (29/30 suites — `hydrateSetupDevices` fails pre-existing, ignore), plus
  `npx eslint src/components/Feed.js` clean.

### Task 2: PostSetModal — mute integrity while a track is engaged

Today the preview `<video>` (see ~line 706; check ~857 too) is muted/unmuted
imperatively around `useTrackAudio` (`handleVideoPlay`/`handleVideoPause`/
effect at ~370). If the element exposes native `controls`, the volume button
unmutes camera audio over the playing track.

- [ ] Add a `volumechange` guard effect: while `useTrackAudio` is true and a
  track URL exists, any unmute of the preview video is immediately reverted
  (`video.muted = true`). Bind/unbind with the element and `useTrackAudio`.
- [ ] If the preview video renders native `controls` while `useTrackAudio`
  is true, remove/suppress them in that mode (custom play affordances already
  exist via `handleVideoPlay`; keep `controls` only when the camera audio is
  the legitimate audio source, i.e. `!useTrackAudio`).
- [ ] Do not alter the `!useTrackAudio` behavior — camera audio is legitimate
  there.
- [ ] Verify: full suite green + `npx eslint src/components/PostSetModal.js`.

### Task 3: Multicam controller — freeze-frame at footage edges

In `createMulticamAudioMasterSync` only (do not touch
`createAudioMasterSync`). New behavior in the follow loop (and after
activation/seek repositioning): with `dur = video.duration` finite and
`target = videoTargetFor(activeIndex)`:

- [ ] `target >= dur - 0.05` → hold the LAST frame: ensure the video is
  paused (once), `playbackRate = 1`, skip drift logic. The audio keeps
  playing untouched.
- [ ] `target <= 0.05` while cut-active → hold the FIRST frame: video paused
  at ~0, skip drift logic.
- [ ] When the target re-enters `(0.05, dur - 0.05)` (audio progressed past
  the angle's start, or the user seeked back) and the controller is
  playing (`active && started`), automatically `play()` the video again and
  realign (`currentTime = target`). This must work both mid-playback and
  after `seek()`.
- [ ] `seek(masterTime)` and `activate(..., { seekExact: true })` must clamp
  their video seeks into `[0, dur - 0.01]` when `dur` is finite (browsers
  clamp anyway; be explicit so tests can assert).
- [ ] TDD in `audioVideoSync.test.js` (reuse the fake-element harness; give
  fakes a `duration` property): (a) audio advancing past
  `offset + duration` pauses the active video once and stops seeking it;
  (b) seeking back into coverage resumes `play()` and realigns; (c) a video
  whose footage starts later than the current master time stays paused at 0,
  then auto-plays when the master clock reaches its coverage.
- [ ] All pre-existing tests in the file must still pass. Verify: targeted
  test file run + full suite + eslint on both files.

### Task 4: Editor — preview integrity, opt-out checkbox, master-time posting

All in `SetEditor.js`/`SetEditor.css`. Read the whole component first; reuse
its patterns. Import nothing new except what already exists in the repo.

**4a — Post-step clip preview integrity**
- [ ] Remove `controls` from the clip preview `<video>` (~line 1761). Add a
  small play/pause chip (reuse `.set-editor__play-btn` styling; local
  `clipPreviewPlaying` state driven by the video's `play`/`pause` events).
  Scrubbing stays on the clip timeline (edge drags already seek the preview).
- [ ] The preview video is `muted` **only when master audio exists**
  (`muted={!!audio}`); add a `volumechange` guard (inside the existing
  post-step effect) that re-mutes instantly while `audio` exists. In
  no-master-audio mode (4b) the video plays unmuted — camera audio IS the
  audio there — and the hidden master `<audio>` is not rendered (already
  conditional).
- [ ] Edit-step echo guard: give the master-audio card's `<audio controls>`
  (~line 1194) a ref and pause it inside `startPlayback()` so the track can't
  play twice over itself.

**4b — "Post without master audio" checkbox (single angle only)**
- [ ] New state `noMasterAudio` (default false). Render the checkbox inside
  the Master audio section ONLY when `!audio`: label “Post without master
  audio — the camera’s own audio will be used”. Disable it (with a title
  explaining why) when `angles.length >= 2`. Adding a master audio file
  unchecks it automatically.
- [ ] When checked: `canAddAngle` caps at 1 (`angles.length < 1`), with the
  add-card hint switching to “Add a master track to use multiple angles”.
- [ ] `handleContinueToPost`: valid when `angles.length >= 1 && (audio ?
  allWaveformsReady : (noMasterAudio && angles.length === 1))`. Adjust the
  footer button's disabled/title logic to match. The sync section already
  hides without audio; the cuts row already requires ≥2 angles.
- [ ] `handlePost` without audio: skip the audio upload; set doc gets
  `audioReplacesVideo: false`, `audioOffsetSeconds: 0`, NO `audioTrackURL`,
  NO trim fields (no trim UI in this mode), `durationSeconds =
  primary.duration || 0`, `cuts: [{ timeSec: 0, angleIndex: 0 }]`, single
  `angles[]` entry with `offsetSeconds: 0`. Clip docs likewise get
  `audioReplacesVideo: false` and no `audioTrackURL`.

**4c — Master-time posting (only when audio exists; spec table is normative)**
- [ ] `masterDuration = audio.duration || 0`. The clip picker's timeline base
  becomes `masterDuration` (today it is `primaryDuration` = angle-1 video
  time): `resizeClipRanges`/`normalizeClipRange` calls, the `pct()` math, and
  `clipTimelineSecAt` all use it. Preview seeks convert master → video:
  `seekClipPreview(clamp(masterSec - primaryClipOffset, 0, primaryDuration))`
  (the hidden-audio alignment effect needs no change — video time + offset ==
  master time).
- [ ] Set doc: add `trimInMasterSeconds` / `trimOutMasterSeconds` (the raw
  `trimInSec`/`trimOutSec` clock inputs, when provided);
  `durationSeconds = Math.max(0, (trimOutSec ?? masterDuration) -
  (trimInSec ?? 0))`, falling back to the current computation when
  `masterDuration` is 0. Keep writing the legacy video-time trim fields
  exactly as today.
- [ ] Clip docs: add `clipStartMaster`/`clipEndMaster` (= the picked range,
  master seconds); legacy `clipStart`/`clipEnd` become
  `clamp(master − primaryClipOffset, 0, primaryDuration)` so the Feed keeps
  working unchanged.
- [ ] Coverage warning (non-blocking, in the sync section near the trim row):
  `coverageStart = min(offset_i)`, `coverageEnd = max(offset_i +
  duration_i)` over loaded angles; with `winStart = trimInSec ?? 0`,
  `winEnd = trimOutSec ?? masterDuration`: warn “Footage ends at {clock} —
  the last frame will hold for {n}s of audio” when `winEnd > coverageEnd +
  0.5`, and the first-frame equivalent when `winStart < coverageStart - 0.5`.
- [ ] Verify: full suite green + eslint on SetEditor.js.

### Task 5: Player — audio clock for every track-backed set

`LiveSetPlayer.js`/`.css` only. The stacked path already exists (multicam).

- [ ] Engage it for `angles.length >= 1` (was `>= 2`) — keep the variable
  name `multicam`, update comments to say "audio-clock (stacked) mode; a
  single-angle set is multicam with one entry". All other gates (all guids
  `'ready'` in `angleStatus`, signed URLs, `audioTrackURL`,
  `audioReplacesVideo`, `!multicamFailed`) unchanged, as is the single-video
  fallback (legacy docs, no-master-audio sets, errors).
- [ ] Master window prefers the new fields:
  `masterIn = Number.isFinite(Number(set?.trimInMasterSeconds)) ?
  Number(set.trimInMasterSeconds) : trimStart + offset0`;
  `effDuration = Number.isFinite(Number(set?.trimOutMasterSeconds)) ?
  Math.max(0, Number(set.trimOutMasterSeconds) - masterIn) :
  Math.max(0, Number(set?.durationSeconds) || 0)` (multicam mode only;
  single-video math untouched).
- [ ] Sanity-check the stacked render/controller/seek/keyboard paths make no
  `length >= 2` assumptions (cuts default to `[{timeSec:0, angleIndex:0}]`
  via `normalizeCuts`, which is fine for one entry).
- [ ] Verify: full suite green + eslint on LiveSetPlayer.js.

---

## Final verification (orchestrator)
- [ ] Full suite + eslint on all touched files.
- [ ] Review every diff against the spec: no path can unmute camera audio
  while a track is engaged; legacy fields still written; old docs unaffected.
- [ ] Update CLAUDE.md data-model rows + memory; report deploy notes.
