# Audio-as-Spine — master audio is the baseline of a set

**Date:** 2026-07-14
**Status:** Approved (user decisions recorded below). Builds on `multicam-cuts`
(same branch), see `2026-07-14-multicam-cuts-design.md`.

## Problem

1. **Double audio bug:** editor previews (SetEditor post-step clip preview,
   PostSetModal preview) rely on a one-shot `muted` of a `<video controls>`;
   the native volume button unmutes camera audio on top of the hidden master
   track and nothing re-mutes. The Feed additionally *falls back to camera
   audio* when the master track fails to load.
2. **Model inversion:** published sets are angle-1-video-centric
   (`durationSeconds` = angle-1 length, trim + clip ranges stored in angle-1
   video time, single-angle playback uses the video clock). The desired model:
   the master audio file is the spine; video angles are visual overlays that
   come and go on top of it.

## User decisions (2026-07-14)

- **Video coverage gaps:** freeze the nearest frame (last frame after footage
  ends, first frame before it starts). Gaps are expected to be rare — footage
  should normally cover the audio; this is a safety net, not a feature.
- **No master audio ⇒ single angle only.** Multicam cutting is a
  master-audio feature (the track is the sync anchor and the playback clock).
- **Camera audio is never heard when a master track exists.** No feed
  fallback: on track failure keep the video muted, retry the signed URL, show
  buffering (YouTube-style) — buffering only when genuinely starved.

## Policy

- Master audio is **required by default** in the multi-angle editor. An
  explicit **"Post without master audio"** checkbox opts out; opting out caps
  the set at one angle, no sync section, no cuts.
- Wherever a master track is engaged, camera audio must be *unhearable*: no
  native volume UI on previews, and a `volumechange` guard force-re-mutes.
- In no-master-audio mode, camera audio IS the set's audio
  (`audioReplacesVideo: false` — a path all players already support).

## Time-base model (single source of truth)

Master time == the master audio file's own timeline (0 = audio start). It is
the audio element's `currentTime` at playback. Angle video time =
`masterTime - angle.offsetSeconds` (existing convention).

### `sets` doc — fields written per mode

| Field | With master audio (new semantics) | Without (checkbox) |
|---|---|---|
| `trimInMasterSeconds` (new, optional) | trim IN, master seconds (editor input, verbatim) | omitted |
| `trimOutMasterSeconds` (new, optional) | trim OUT, master seconds | omitted |
| `durationSeconds` | **master window length** = `(trimOut ?? audioDuration) − (trimIn ?? 0)` | primary video duration (legacy) |
| `trimStartSeconds` / `trimEndSeconds` | still written, angle-1 VIDEO time (legacy readers) | omitted (no trim UI) |
| `audioTrackURL`, `audioOffsetSeconds`, `audioReplacesVideo: true` | as today | omitted / `0` / `false` |
| `angles[]`, `angleGuids`, `angleStatus`, `cuts` | as today (multicam branch) | single entry, offset 0, default cuts |

### `clips` doc

| Field | With master audio | Without |
|---|---|---|
| `clipStartMaster` / `clipEndMaster` (new) | clip window, master seconds | omitted |
| `clipStart` / `clipEnd` | still written: `clamp(master − offset0, 0, primaryDuration)` — numerically equal to today whenever footage covers the window | video seconds (as today) |

The Feed keeps reading the legacy fields (exact equivalents); it needs no
time-base change. Old docs are untouched; readers prefer the new fields only
when finite.

### Playback (LiveSetPlayer)

The stacked audio-clock path (built for multicam) becomes the norm for **any**
set with `angles[] ≥ 1`, all angles encoded, and a master track — a
single-angle set is just multicam with one entry. Master window:
`masterIn = trimInMasterSeconds ?? (trimStartSeconds + offset0)`,
`effDuration = (trimOutMasterSeconds − masterIn) ?? durationSeconds`.
The single-video (video-clock) path remains for legacy docs, no-master-audio
sets, and as the error fallback.

### Freeze-frame at coverage edges

In the multicam controller's follow loop: when the active video's target time
is at/past its `duration`, pause it there (hold last frame) instead of
fighting with seeks/rate-nudges; when the target is ≤ 0, hold paused at 0
(first frame). Resume playing automatically when the target re-enters
footage (including after user seeks). The editor warns (non-blocking) when
the trimmed master window extends beyond the union of angle coverage.

## Out of scope

- Migrating existing docs (legacy fields remain honored everywhere).
- Multicam clips in the feed; audio-only visualizer segments (freeze-frame
  covers gaps instead).
- Trim UI in no-master-audio mode.
