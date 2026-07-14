# Multicam Cuts — FCP-style angle switching for live sets

**Date:** 2026-07-14
**Status:** Approved for implementation (user pre-authorized execution)

## Problem

The multi-angle editor (`SetEditor.js`) syncs up to 3 camera angles against a lossless
master audio track, but at post time only Angle 1 is uploaded. The `sets` doc already
writes a stubbed forward-compatible schema (`angles: [angle1]`, `cuts: [{ timeSec: 0,
angleIndex: 0 }]`) with "Multi-angle stitching ships later". There is no way to cut
between angles — the signature effect of professional DJ-set productions (e.g. front-of-
booth camera → crowd camera on the drop).

## Goal

Creators drag cut markers along the sync timeline (and live-cut with keys 1/2/3 while
playing) to decide which angle is shown at every moment, switching back and forth as
often as they like. Viewers of the full set see the cut sequence with the lossless
master audio perfectly aligned. UX target: as direct as Final Cut Pro's multicam.

## Non-negotiable audio constraint

The app's playback sync is **audio-master** (`utils/audioVideoSync.js`): the lossless
track is the clock and is **never seeked during playback** (seeking `<audio>` stalls on
iOS). Videos are slaved via playbackRate nudges. Therefore a cut must only ever swap
which *video* is slaved/visible — the audio never notices.

**Timeline convention (existing, unchanged):** master time == audio time.
`angleVideoTime = masterTime - angle.offsetSeconds` (`angleTimeAtMaster` in
`utils/syncEditorMath.js`). Cuts stored in master time therefore apply to every angle
with no per-angle conversion beyond the existing offsets.

## Data model (`sets` doc — backward compatible)

| Field | Shape | Notes |
|---|---|---|
| `angles[]` | `{ label, bunnyVideoGuid, bunnyLibraryId, hlsUrl, offsetSeconds, durationSeconds }` | Now one entry per uploaded angle (1–3). Index 0 = primary. |
| `angleGuids[]` | `string[]` | For webhook `array-contains` queries. |
| `angleStatus` | `{ [guid]: 'processing'\|'ready'\|'failed' }` | Webhook flips per-guid; player gates multicam on all-ready. |
| `cuts[]` | `{ timeSec, angleIndex }[]` | Master-timeline seconds, sorted ascending, `cuts[0].timeSec === 0`. Cut at T shows `angles[angleIndex]` until the next cut. |

`videoURL`, `audioOffsetSeconds`, `trimStartSeconds/trimEndSeconds` (angle-0 video
time), and all clip fields are **unchanged** — existing docs and the current player
keep working; feed clips stay on angle 1 in v1.

## Components

### 1. `src/utils/multicam.js` (new, pure) + tests
`MIN_SEGMENT_SEC = 0.5`. Functions: `normalizeCuts(cuts, {maxAngleIndex})`,
`angleIndexAt(cuts, tSec)`, `addCut(cuts, tSec, angleIndex)`,
`moveCut(cuts, index, tSec)` (clamped between neighbors), `removeCut(cuts, index)`
(index 0 immovable/undeletable), `setSegmentAngle(cuts, index, angleIndex)`,
`cutsToSegments(cuts, durationSec)` → `[{ start, end, angleIndex }]`.

### 2. Editor (`SetEditor.js` / `.css`)
- **Cuts row** appended below the angle rows inside the existing sync scroller
  (shares `pxPerSec`, scroll, playhead). Renders `cutsToSegments` as colored blocks
  (one hue per angle, labeled "A1/A2/A3"). Visible when ≥2 angles.
- **Drag a cut boundary** to move the cut time (same pointer-capture pattern as the
  offset drag; live transform during drag, commit on release).
- **Cut at playhead** (scissors button) splits the current segment (keeps its angle).
- **Segment focus**: click a segment → angle chips (Angle 1/2/3) set its angle; a
  focused non-zero cut can be deleted (× button / Delete key → merges into previous).
- **Live cutting**: while playing, keys 1/2/3 insert a cut at the playhead switching
  to that angle (ignores keys when a text input is focused).
- **Preview follows cuts while playing** (`angleIndexAt(playheadSec)` drives the
  visible angle); while paused, manual angle tabs still control focus for sync work.
- **Post step**: uploads *every* angle to Bunny (one `createBunnyVideo` +
  `uploadToBunny` per angle; progress split evenly across angles within 0–90%),
  writes `angles[]`, `angleGuids`, `angleStatus` (all `'processing'`), normalized
  `cuts`. Summary line mentions the number of cuts.

### 3. Cloud functions (`functions/index.js`)
- `getSignedBunnyUrl`: additionally return `angles: data.angles.map(a => ({ ...a,
  hlsUrl: signIfBunny(a.hlsUrl) }))` (each guid has its own token path).
- `bunnyWebhook`: also query `sets` where `angleGuids array-contains VideoGuid` and
  update `angleStatus.<guid>`; existing primary `status` behavior untouched.

### 4. Player (`LiveSetPlayer.js` / `.css` + `utils/audioVideoSync.js`)
- New `createMulticamAudioMasterSync(entries, audio, { cuts, audioStart,
  onActiveAngleChange })`, `entries = [{ video, offset }]`, in `audioVideoSync.js`
  (reuses the existing follow/warmup internals):
  - Audio = master clock; only the **active** video runs the rate-nudge follow loop.
  - **Inactive videos are paused and "parked"** — pre-seeked to their video time at
    their next activation cut so the frame is decoded and hls.js buffers there.
  - A rAF **cut ticker** compares `audio.currentTime` to the next cut boundary and
    swaps within ~1 frame: play the parked video, `onActiveAngleChange(idx)` flips
    visibility in React, pause + re-park the old one.
  - `seek(masterTime)`: one intentional audio seek + reposition all videos +
    recompute active angle. `play/pause/destroy` mirror the single-video controller.
- Player renders one muted stacked `<video>` per angle (each `attachHls` with its
  signed URL); active one visible via CSS class (no remounting).
- **Multicam engages only when** `angles.length ≥ 2`, every guid is `'ready'` in
  `angleStatus`, and signed angle URLs are available. Otherwise (or on an angle's
  HLS error) fall back to today's single-video path.
- Timeline math moves to the master-time window: `masterIn = trimStartSeconds +
  angles[0].offsetSeconds`, displayed time = `audio.currentTime - masterIn`.

## Out of scope (v1)
- Multicam inside feed clips (Feed preloads several players; clips stay angle 1).
- Server-side stitched export / download.
- More than 3 angles; per-segment transitions (hard cuts only, like FCP defaults).

## Edge cases
- Cut `angleIndex` beyond available angles → clamp to 0 at normalize/read time.
- Angle footage ending mid-segment → clamp seek to `duration - 0.01` (frame freeze,
  visible in editor preview; creator's responsibility, as in FCP).
- Bunny still encoding a secondary angle → player runs single-angle until webhook
  marks all guids ready.

## Testing
- `multicam.test.js` — exhaustive pure-math coverage.
- `audioVideoSync.test.js` — extend the existing fake-media-element harness for the
  multicam controller (cut switching, parking, seek, fallback).
- Full suite: `CI=true npm test -- --watchAll=false` (no dev-server verification —
  builds hang under automation per CLAUDE.md; manual browser check is the user's).
