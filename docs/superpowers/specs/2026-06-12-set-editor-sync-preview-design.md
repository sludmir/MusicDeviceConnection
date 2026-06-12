# Set Editor Sync Preview + Camera Defaults — Design

Date: 2026-06-12
Status: Approved (user confirmed: "I can't sync because I can't see where in the video I'm syncing the audio to")

## Goal

Make the multi-angle set editor's sync screen usable by showing the video while
aligning, with precision controls — so the creator can line up audio transients
(e.g. three CDJ cue hits) with the exact video frames of the actions. Secondary
scope: fix the default camera position of six scene variants.

## Background

`src/components/SetEditor.js` (~1,200 lines, currently uncommitted WIP dated
June 2) already has: multi-angle upload (max 3), master-audio waveform + per-angle
waveforms on a zoomable timeline (10–160 px/s), drag-to-offset, auto-align via
cross-correlation (`src/utils/audioAlign.js`), A/B mute playback, playhead
scrubbing, and a post step uploading to Bunny Stream + Firestore.

The blocker: the angle `<video>` elements live in a hidden `aria-hidden`
container (`.set-editor__sync-players`) and exist only to produce sound. The
user cannot see any video frame while aligning.

First implementation step: commit the existing WIP (SetEditor.js, SetEditor.css,
audioWaveform.js, PostSetModal.js, Upload.js, storage.rules, and related dirty
files) as the baseline, so new work is reviewable on top.

## Design

### 1. Visible synced preview panel

A preview panel sits inside the Sync section, above the timeline shell. It shows
the **focused angle's** video at a useful size (16:9, max-height ~340px on
desktop, full-width on small screens).

Implementation: keep rendering all angle `<video>` elements in one container
(they are the same elements `anglePlayerRefs` points at — moving them between
parents would re-mount and drop buffering). Restyle the container from "hidden"
to "preview": the focused angle's video is visible; the other angles' videos and
the master `<audio>` element stay `display: none`. No second set of media
elements, no extra decode.

Focus selection: clicking an angle's timeline row or its label row sets
`focusedAngleId` (drag already does). Default focus = angle 1 when angles
exist. Small tabs above the preview ("Angle 1 / Angle 2 / Angle 3") for
explicit switching; tabs double as the A/B "Angle" audio focus target already
in the code.

### 2. Live seek while dragging

Today the preview position only commits on pointer-up. Change both drag paths in
the pointer handlers to seek media live, throttled to ~80ms via a
`lastLiveSeekRef` timestamp:

- **Scrub drag:** seek all media to the dragged playhead time (existing
  `seekAllToMasterTime`).
- **Offset drag:** seek the dragged angle's video to
  `playheadSec - currentOffsetSec` so the frame visibly slides against the
  parked playhead.

`video.currentTime` assignment is used as-is (no fastSeek — Chrome/desktop is
the editing target and precision matters more than seek latency).

### 3. Precision nudge controls

- **Offset nudges** on the focused angle, in the preview panel's toolbar:
  `−0.1s  −0.01s  +0.01s  +0.1s`. Each click adjusts
  `angleOffsets[focusedAngleId]` and re-seeks that video so the frame updates
  immediately. Offset readout gains millisecond precision (e.g. `+1.234s`)
  in both the toolbar and the existing label row.
- **Playhead frame-step**: `‹ ›` buttons beside the time readout stepping
  ±1/30s, for parking the playhead exactly on the video frame of a cue press.

Suggested workflow (goes in the help text): Auto-align first → zoom into the
first cue hit on the master waveform → park the playhead on the transient
(frame-step to fine-tune) → nudge the angle offset until the preview frame
shows the finger on the pad → Master play to confirm all three hits.

### 4. Pure helpers (unit-testable)

New `src/utils/syncEditorMath.js`:
- `nudgeOffset(current, deltaSec, previewDuration)` — clamp to ±previewDuration.
- `angleTimeAtMaster(masterSec, offsetSec)` — `masterSec - offsetSec` (the one
  formula both seek paths share).
- `formatOffsetMs(sec)` — `+1.234s` / `−0.010s` readout.

SetEditor imports these; the existing inline clamp logic for offsets switches to
`nudgeOffset` so drag and nudge share one clamp.

### 5. Verification

- Jest: unit tests for `syncEditorMath.js`; existing test pattern.
- Browser: the app shell is auth-gated, so for local verification only, a
  temporary (uncommitted, reverted afterwards) dev harness renders SetEditor
  without sign-in; test media generated locally (ffmpeg if available, otherwise
  browser-synthesized via canvas/WebAudio MediaRecorder). Verify: preview
  visible and switching with focus; scrub moves the frame live; nudge buttons
  change the readout by exactly ±0.01/±0.1; auto-align still works.
- Final visual sign-off by the user with real footage (Google sign-in can't be
  automated).

## Secondary scope: per-scene camera defaults

All in `src/data/settings.js` (`camera: { position, target }` per variant).
Adjustments scale the position–target offset (zoom) or move the position:

| Variant | Change | New position (target unchanged) |
|---|---|---|
| DJ Club Booth | slight zoom out | `[0, 2.5, 2.25]` |
| DJ Rooftop | zoom in | `[0, 4.5, 6.5]` |
| DJ Dojo | zoom in + forward and left | `[-0.8, 2.2, 2.4]` |
| Producer Studio | zoom in | `[0, 2.5, 3.2]` |
| Musician Stage | zoom in | `[0, 2.75, 4.2]` |
| Musician Guitar Room | opposite side of room, same middle, slight zoom in | `[0, 2.9, -4.5]` |

Values are first-pass estimates tuned by eye after deploy; the user reviews each
scene and reports which need another nudge. Saved setups with stored
`cameraAngles` are unaffected (those override defaults).

## Error handling

- No angles or no waveforms ready → preview hidden (sync section already gates
  on `syncEnabled`).
- Seeks during drag are throttled and clamped to media duration (existing
  pattern in `seekAllToMasterTime`).
- Nudge with no focused angle → buttons disabled.

## Out of scope

Creator-gated uploads, public logged-out viewing, mobile control overhaul, day
theme — each gets its own spec later. Multi-angle playback cuts in the feed
player (schema already stores `angles[]`/`cuts[]`, MVP posts angle 1 only).
