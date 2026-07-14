# Multicam Cuts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** FCP-style multicam cutting: creators place/drag cut markers on the sync timeline (or live-cut with keys 1/2/3) to switch between up to 3 synced camera angles; viewers see the cut sequence with the lossless master audio as the never-seeked playback clock.

**Architecture:** Cuts are stored in master-timeline (== audio) seconds as `[{ timeSec, angleIndex }]` on the `sets` doc. A pure util (`src/utils/multicam.js`) owns all cut-list math. The editor gains a cuts row on the existing sync timeline and uploads every angle to Bunny. The player stacks one muted `<video>` per angle and a new multicam controller in `utils/audioVideoSync.js` slaves only the active video to the audio clock, parking inactive videos at their next activation frame and swapping on a rAF ticker.

**Tech Stack:** React 18 (CRA), Firebase (Firestore/Storage/Functions), Bunny Stream (HLS via `attachHls`), Jest (`CI=true npm test -- --watchAll=false`).

**Spec:** `docs/superpowers/specs/2026-07-14-multicam-cuts-design.md` — read it first.

**Branch:** all commits on `multicam-cuts`.

---

## File map

| File | Task | Responsibility |
|---|---|---|
| `src/utils/multicam.js` (create) | 1 | Pure cut-list math (normalize, query, add/move/remove, segments) |
| `src/utils/multicam.test.js` (create) | 1 | Full unit coverage |
| `functions/index.js` (modify) | 2 | Sign per-angle URLs; webhook per-angle readiness |
| `src/utils/audioVideoSync.js` (modify) | 3 | `createMulticamAudioMasterSync` controller |
| `src/utils/audioVideoSync.test.js` (modify) | 3 | Multicam controller tests (existing fake-element harness) |
| `src/components/SetEditor.js` / `SetEditor.css` (modify) | 4 | Cuts row UI, live cutting, preview-follows-cuts, multi-angle upload |
| `src/components/LiveSetPlayer.js` / `LiveSetPlayer.css` (modify) | 5 | Multicam playback mode with single-video fallback |

Task order: 1 → (2, 3, 4 in parallel; disjoint files) → 5 (needs 3's controller and 2's response shape).

---

### Task 1: Cut-list math (`src/utils/multicam.js`)

**Files:**
- Create: `src/utils/multicam.js`
- Test: `src/utils/multicam.test.js`

Conventions this file owns (everything else imports them):
- A cut list is `[{ timeSec: number, angleIndex: number }]`, sorted ascending by `timeSec`, `cuts[0].timeSec === 0` always. `MIN_SEGMENT_SEC = 0.5`.
- Consecutive cuts to the same angle are merged (a cut that doesn't change the angle is dropped).

- [ ] **Step 1: Write the failing tests** — `src/utils/multicam.test.js`:

```js
import {
  MIN_SEGMENT_SEC,
  normalizeCuts,
  angleIndexAt,
  addCut,
  moveCut,
  removeCut,
  setSegmentAngle,
  cutsToSegments,
} from './multicam';

describe('normalizeCuts', () => {
  it('returns the default cut list for empty/invalid input', () => {
    expect(normalizeCuts(null)).toEqual([{ timeSec: 0, angleIndex: 0 }]);
    expect(normalizeCuts([])).toEqual([{ timeSec: 0, angleIndex: 0 }]);
    expect(normalizeCuts('nope')).toEqual([{ timeSec: 0, angleIndex: 0 }]);
  });

  it('sorts by time and forces the first cut to timeSec 0', () => {
    expect(normalizeCuts([
      { timeSec: 10, angleIndex: 1 },
      { timeSec: 4, angleIndex: 2 },
    ])).toEqual([
      { timeSec: 0, angleIndex: 2 },
      { timeSec: 10, angleIndex: 1 },
    ]);
  });

  it('clamps angleIndex into [0, maxAngleIndex] and floors NaN to 0', () => {
    expect(normalizeCuts([
      { timeSec: 0, angleIndex: 7 },
      { timeSec: 5, angleIndex: -1 },
      { timeSec: 12, angleIndex: NaN },
    ], { maxAngleIndex: 2 })).toEqual([
      { timeSec: 0, angleIndex: 2 },
      { timeSec: 5, angleIndex: 0 },
      // 12s cut dropped: angle NaN→0 equals previous angle 0 → merged
    ]);
  });

  it('drops cuts closer than MIN_SEGMENT_SEC to the previous cut', () => {
    expect(normalizeCuts([
      { timeSec: 0, angleIndex: 0 },
      { timeSec: 5, angleIndex: 1 },
      { timeSec: 5.2, angleIndex: 2 },
    ])).toEqual([
      { timeSec: 0, angleIndex: 0 },
      { timeSec: 5, angleIndex: 1 },
    ]);
  });

  it('merges consecutive same-angle cuts', () => {
    expect(normalizeCuts([
      { timeSec: 0, angleIndex: 0 },
      { timeSec: 5, angleIndex: 0 },
      { timeSec: 9, angleIndex: 1 },
    ])).toEqual([
      { timeSec: 0, angleIndex: 0 },
      { timeSec: 9, angleIndex: 1 },
    ]);
  });
});

describe('angleIndexAt', () => {
  const cuts = [
    { timeSec: 0, angleIndex: 0 },
    { timeSec: 10, angleIndex: 1 },
    { timeSec: 20, angleIndex: 0 },
  ];
  it('returns the angle of the segment containing t', () => {
    expect(angleIndexAt(cuts, 0)).toBe(0);
    expect(angleIndexAt(cuts, 9.99)).toBe(0);
    expect(angleIndexAt(cuts, 10)).toBe(1);
    expect(angleIndexAt(cuts, 15)).toBe(1);
    expect(angleIndexAt(cuts, 25)).toBe(0);
  });
  it('is safe for empty lists and negative times', () => {
    expect(angleIndexAt([], 5)).toBe(0);
    expect(angleIndexAt(cuts, -3)).toBe(0);
  });
});

describe('addCut', () => {
  const base = [{ timeSec: 0, angleIndex: 0 }];
  it('inserts a sorted cut', () => {
    expect(addCut(base, 12, 1)).toEqual([
      { timeSec: 0, angleIndex: 0 },
      { timeSec: 12, angleIndex: 1 },
    ]);
  });
  it('does not mutate the input', () => {
    const copy = base.slice();
    addCut(base, 12, 1);
    expect(base).toEqual(copy);
  });
  it('retargets an existing cut within MIN_SEGMENT_SEC instead of stacking', () => {
    const cuts = [
      { timeSec: 0, angleIndex: 0 },
      { timeSec: 10, angleIndex: 1 },
    ];
    expect(addCut(cuts, 10.2, 2)).toEqual([
      { timeSec: 0, angleIndex: 0 },
      { timeSec: 10, angleIndex: 2 },
    ]);
  });
  it('adding at 0 replaces the opening angle', () => {
    expect(addCut(base, 0, 2)).toEqual([{ timeSec: 0, angleIndex: 2 }]);
  });
  it('drops a cut that would not change the angle', () => {
    expect(addCut(base, 12, 0)).toEqual(base);
  });
});

describe('moveCut', () => {
  const cuts = [
    { timeSec: 0, angleIndex: 0 },
    { timeSec: 10, angleIndex: 1 },
    { timeSec: 20, angleIndex: 2 },
  ];
  it('moves a cut, clamped between neighbors ± MIN_SEGMENT_SEC', () => {
    expect(moveCut(cuts, 1, 14)[1].timeSec).toBe(14);
    expect(moveCut(cuts, 1, 0.1)[1].timeSec).toBe(MIN_SEGMENT_SEC);
    expect(moveCut(cuts, 1, 25)[1].timeSec).toBe(20 - MIN_SEGMENT_SEC);
  });
  it('never moves index 0', () => {
    expect(moveCut(cuts, 0, 5)).toEqual(cuts);
  });
});

describe('removeCut / setSegmentAngle', () => {
  const cuts = [
    { timeSec: 0, angleIndex: 0 },
    { timeSec: 10, angleIndex: 1 },
    { timeSec: 20, angleIndex: 0 },
  ];
  it('removes a non-zero cut (segment merges into previous)', () => {
    expect(removeCut(cuts, 1)).toEqual([
      { timeSec: 0, angleIndex: 0 },
      // 20s cut survives; still a change vs previous angle 0? No: previous is
      // now angle 0 and cut 20 targets 0 → merged away by normalize.
    ]);
  });
  it('refuses to remove index 0', () => {
    expect(removeCut(cuts, 0)).toEqual(cuts);
  });
  it('setSegmentAngle changes one segment and re-normalizes', () => {
    expect(setSegmentAngle(cuts, 1, 2)[1]).toEqual({ timeSec: 10, angleIndex: 2 });
    // Setting segment 1 to angle 0 merges it into both neighbors:
    expect(setSegmentAngle(cuts, 1, 0)).toEqual([{ timeSec: 0, angleIndex: 0 }]);
  });
});

describe('cutsToSegments', () => {
  it('converts cuts to [start,end) segments ending at duration', () => {
    expect(cutsToSegments([
      { timeSec: 0, angleIndex: 0 },
      { timeSec: 10, angleIndex: 1 },
    ], 30)).toEqual([
      { start: 0, end: 10, angleIndex: 0 },
      { start: 10, end: 30, angleIndex: 1 },
    ]);
  });
  it('drops cuts at/after duration', () => {
    expect(cutsToSegments([
      { timeSec: 0, angleIndex: 0 },
      { timeSec: 40, angleIndex: 1 },
    ], 30)).toEqual([{ start: 0, end: 30, angleIndex: 0 }]);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `CI=true npx react-scripts test --watchAll=false src/utils/multicam.test.js` → FAIL (module not found).

- [ ] **Step 3: Implement** — `src/utils/multicam.js`:

```js
// Pure cut-list math for multicam sets. A cut list is
// [{ timeSec, angleIndex }] in MASTER-timeline seconds, sorted ascending,
// with cuts[0].timeSec === 0. A cut at T shows angles[angleIndex] until the
// next cut. Consecutive same-angle cuts are merged; segments shorter than
// MIN_SEGMENT_SEC are rejected.

export const MIN_SEGMENT_SEC = 0.5;

const DEFAULT_CUTS = [{ timeSec: 0, angleIndex: 0 }];

function clampAngle(idx, maxAngleIndex) {
  const n = Number(idx);
  if (!Number.isFinite(n) || n < 0) return 0;
  const max = Number.isFinite(maxAngleIndex) ? maxAngleIndex : Infinity;
  return Math.min(Math.floor(n), max);
}

export function normalizeCuts(cuts, { maxAngleIndex } = {}) {
  if (!Array.isArray(cuts) || cuts.length === 0) return DEFAULT_CUTS.map((c) => ({ ...c }));
  const cleaned = cuts
    .filter((c) => c && Number.isFinite(Number(c.timeSec)))
    .map((c) => ({
      timeSec: Math.max(0, Number(c.timeSec)),
      angleIndex: clampAngle(c.angleIndex, maxAngleIndex),
    }))
    .sort((a, b) => a.timeSec - b.timeSec);
  if (cleaned.length === 0) return DEFAULT_CUTS.map((c) => ({ ...c }));
  cleaned[0] = { ...cleaned[0], timeSec: 0 };
  const out = [cleaned[0]];
  for (let i = 1; i < cleaned.length; i++) {
    const prev = out[out.length - 1];
    const cur = cleaned[i];
    if (cur.timeSec - prev.timeSec < MIN_SEGMENT_SEC) continue; // too close
    if (cur.angleIndex === prev.angleIndex) continue;           // no-op cut
    out.push(cur);
  }
  return out;
}

export function angleIndexAt(cuts, tSec) {
  if (!Array.isArray(cuts) || cuts.length === 0) return 0;
  let angle = cuts[0].angleIndex || 0;
  for (let i = 1; i < cuts.length; i++) {
    if (cuts[i].timeSec <= tSec) angle = cuts[i].angleIndex;
    else break;
  }
  return angle;
}

export function addCut(cuts, tSec, angleIndex) {
  const base = normalizeCuts(cuts);
  // Retarget an existing cut if we're within MIN_SEGMENT_SEC of it.
  const nearIdx = base.findIndex((c) => Math.abs(c.timeSec - tSec) < MIN_SEGMENT_SEC);
  if (nearIdx >= 0) {
    const next = base.map((c, i) => (i === nearIdx ? { ...c, angleIndex } : c));
    return normalizeCuts(next);
  }
  return normalizeCuts([...base, { timeSec: tSec, angleIndex }]);
}

export function moveCut(cuts, index, tSec) {
  const base = normalizeCuts(cuts);
  if (index <= 0 || index >= base.length) return base;
  const lo = base[index - 1].timeSec + MIN_SEGMENT_SEC;
  const hi = index + 1 < base.length ? base[index + 1].timeSec - MIN_SEGMENT_SEC : Infinity;
  const clamped = Math.min(Math.max(tSec, lo), hi);
  return base.map((c, i) => (i === index ? { ...c, timeSec: clamped } : c));
}

export function removeCut(cuts, index) {
  const base = normalizeCuts(cuts);
  if (index <= 0 || index >= base.length) return base;
  return normalizeCuts(base.filter((_, i) => i !== index));
}

export function setSegmentAngle(cuts, index, angleIndex) {
  const base = normalizeCuts(cuts);
  if (index < 0 || index >= base.length) return base;
  return normalizeCuts(base.map((c, i) => (i === index ? { ...c, angleIndex } : c)));
}

export function cutsToSegments(cuts, durationSec) {
  const base = normalizeCuts(cuts);
  const dur = Math.max(0, Number(durationSec) || 0);
  const segs = [];
  for (let i = 0; i < base.length; i++) {
    if (base[i].timeSec >= dur) break;
    const end = i + 1 < base.length ? Math.min(base[i + 1].timeSec, dur) : dur;
    segs.push({ start: base[i].timeSec, end, angleIndex: base[i].angleIndex });
  }
  return segs;
}
```

Note the `moveCut` order-of-clamp subtlety: apply the `hi` bound after `lo` (`Math.min(Math.max(...))`) so a huge `tSec` lands on `hi`, matching the test.

- [ ] **Step 4: Run tests** — same command → PASS (all).
- [ ] **Step 5: Commit** — `git add src/utils/multicam.js src/utils/multicam.test.js && git commit -m "feat: pure cut-list math for multicam sets"`.

---

### Task 2: Cloud functions — per-angle signing + readiness

**Files:**
- Modify: `functions/index.js`

- [ ] **Step 1: Sign angle URLs in `getSignedBunnyUrl`** — in the return object (after `thumbnailURL`), add:

```js
      angles: Array.isArray(data.angles)
        ? data.angles.map((a) => ({ ...a, hlsUrl: signIfBunny(a?.hlsUrl) }))
        : undefined,
      angleStatus: data.angleStatus || undefined,
```

(Each guid lives under its own token path, so per-angle signing is required. Returning `angleStatus` here lets the player gate multicam on one fetch. `onCall` drops `undefined` keys — verify the client handles both shapes.)

- [ ] **Step 2: Webhook per-angle readiness** — in `bunnyWebhook`, after the existing `sets`/`clips` loop, add a second pass updating `angleStatus.<guid>` for sets that reference the guid as an angle:

```js
    const angleSnap = await db
      .collection('sets')
      .where('angleGuids', 'array-contains', VideoGuid)
      .get();
    if (!angleSnap.empty) {
      const batch = db.batch();
      angleSnap.forEach((doc) => {
        batch.update(doc.ref, {
          [`angleStatus.${VideoGuid}`]: nextStatus,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        updated += 1;
      });
      await batch.commit();
    }
```

- [ ] **Step 3: Syntax check** — `node --check functions/index.js` → exits 0. (No emulator run; functions deploy is manual.)
- [ ] **Step 4: Commit** — `git add functions/index.js && git commit -m "feat: sign per-angle Bunny URLs and track per-angle encode status"`.

---

### Task 3: Multicam audio-master sync controller

**Files:**
- Modify: `src/utils/audioVideoSync.js` (append; do NOT change `createAudioMasterSync`)
- Test: `src/utils/audioVideoSync.test.js` (append a `describe('createMulticamAudioMasterSync')` block reusing the existing `makeVideo`/`makeAudio` fakes)

Contract:

```js
/**
 * Multicam variant: one audio clock, N muted videos (one per angle).
 * Only the ACTIVE video (per `cuts` at the audio clock) plays and is slaved
 * with the same rate-nudge follow as createAudioMasterSync. Inactive videos
 * are paused and pre-seeked ("parked") to their video time at their next
 * activation cut, so a cut swap starts on an already-decoded frame.
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
export function createMulticamAudioMasterSync(entries, audio, opts = {}) { ... }
```

Implementation requirements (mirror the single-video controller's internals — read it first):
- Master time is `audio.currentTime`; video target for entry i is `audio.currentTime - entries[i].offset` (clamped ≥ 0).
- Reuse the same constants (`WARMUP_PROGRESS`, `SEEK_VIDEO`, `DEADBAND`, `MAX_RATE_DELTA`, `FOLLOW_MS`) and the same warmup flow: on first `play()`, seek audio to `audioStart` if behind, wait for real audio progress, then start the ACTIVE video aligned and begin the follow loop. Use `angleIndexAt`-equivalent logic on `opts.cuts` (import `angleIndexAt` from `./multicam`).
- Follow loop (`setInterval`, FOLLOW_MS): applies drift correction ONLY to the active video (same deadband/nudge/hard-seek-if-buffered logic, including the bandwidth-starvation branch and the `document.hidden || readyState < 2` guard).
- Cut ticker (`requestAnimationFrame` while playing): when `audio.currentTime` crosses the next cut boundary, switch: `newVideo.play().catch(()=>{})` (it is parked at the right frame), set `playbackRate = 1`, fire `onActiveAngleChange(newIdx)`, then `oldVideo.pause()` and park the old video at ITS next activation time (`nextActivationTime(cuts, idx, fromTime) - offset`; if it never activates again, leave it paused where it is).
- `parkInactive()` helper: for every inactive entry, pause + seek to its next-activation video time. Called after warmup, after `seek()`, and after each swap.
- `seek(masterTime)`: `audio.currentTime = max(0, masterTime)`; recompute active from cuts; seek every video to its own target (active exact, inactive parked); if active index changed, fire callback. If playing, keep audio playing and `play()` the new active video.
- `pause()`: pause audio + all videos, stop follow + ticker. `destroy()`: everything + `playbackRate = 1` on all videos + remove visibilitychange listener (same re-align-on-visible behavior as the single controller, applied to the active video).
- Keep all videos `muted = true` in `play()`.

Tests to append (adapt to the harness's timer style — read how the existing tests advance `jest.useFakeTimers()` and drive `currentTime`; note rAF must also be faked/stubbed, e.g. `jest.spyOn(window, 'requestAnimationFrame')` driving manually or polyfill via setInterval fallback — if rAF proves awkward under the harness, implement the cut ticker with a `setInterval(CUT_TICK_MS = 50)` instead; deterministic beats clever):
1. initial `onActiveAngleChange(0)` after warmup; video 0 playing, video 1 paused and parked at `cuts[1].timeSec - offset1`.
2. advancing the audio clock past `cuts[1].timeSec` swaps: video 1 `.play()` called, callback fired with 1, video 0 paused.
3. `seek()` into a later segment recomputes the active angle and repositions both videos.
4. drift correction applies only to the active video.
5. `destroy()` clears timers (no callbacks fire afterwards).

Steps: write failing tests → run (`CI=true npx react-scripts test --watchAll=false src/utils/audioVideoSync.test.js`) → implement → pass → ALSO re-run the whole file to prove the existing single-video tests still pass → commit `feat: multicam audio-master sync controller`.

---

### Task 4: Editor — cuts row, live cutting, multi-angle upload

**Files:**
- Modify: `src/components/SetEditor.js`, `src/components/SetEditor.css`

Read the file top-to-bottom first; reuse its existing patterns (pointer-capture drags, refs for live transforms, `pxPerSec` scaling). Import from `../utils/multicam`.

**4a. State** (near the sync state):

```js
const [cuts, setCuts] = useState([{ timeSec: 0, angleIndex: 0 }]);
const [focusedCutIndex, setFocusedCutIndex] = useState(null); // segment index, null = none
const cutDragRef = useRef(null); // { pointerId, cutIndex, markerEl }
```

Angle removal must remap cuts: in `handleRemoveAngle`, after filtering angles, rebuild cuts clamping `angleIndex` with `normalizeCuts(cuts, { maxAngleIndex: newAngles.length - 1 })` (drop to default when < 2 angles remain).

**4b. Cuts row UI** — rendered inside `.set-editor__sync-canvas-area` after the angle rows, only when `angles.length >= 2`:
- Row `.set-editor__cuts-row` (height ~40px) containing, per `cutsToSegments(cuts, previewDuration)`: a `.set-editor__cut-segment` div positioned `left: start*pxPerSec`, `width: (end-start)*pxPerSec`, class modifier `--a0/--a1/--a2` for color, label `A{angleIndex+1}`, `onClick` → `setFocusedCutIndex(segIndex)`.
- For each cut with index ≥ 1: a draggable marker `.set-editor__cut-marker` at `left: timeSec*pxPerSec` (12px-wide hit area, full row height). Pointer handlers follow the row-drag pattern: pointerdown captures + stores `{ cutIndex }`; pointermove computes `tSec = (clientX - rect.left + scrollLeft) / pxPerSec` and updates the marker + adjacent segment widths live via a ref-driven `setCuts(moveCut(...))` (state updates are fine here — segments are cheap to re-render); pointerup clears the drag. Throttle live preview seeks like the existing offset drag does.
- Segment angle chips: when `focusedCutIndex != null`, show in the preview bar (next to the nudge group) a `.set-editor__cut-chips` group: buttons "Angle 1..N" calling `setCuts(setSegmentAngle(cuts, focusedCutIndex, i))`, plus a delete button (visible when `focusedCutIndex >= 1`) calling `setCuts(removeCut(cuts, focusedCutIndex))` then `setFocusedCutIndex(null)`.
- Sync-tools additions: a scissors button (`MdContentCut`) "Cut at playhead" → `setCuts(addCut(cuts, playheadSec, angleIndexAt(cuts, playheadSec)))` — i.e. split keeping the same angle, creator then retargets; disabled when `angles.length < 2`.

**4c. Live cutting + preview-follows-cuts:**
- Keydown listener (effect, `document`, only when `step === 'edit' && angles.length >= 2`): keys `1`–`3` (skip when `e.target` is an input/textarea/select or `e.metaKey/ctrlKey/altKey`): `const idx = Number(e.key) - 1; if (idx < angles.length) setCuts((prev) => addCut(prev, playheadRefSec(), idx));` where `playheadRefSec()` reads the live playhead (during playback `playheadSec` state is fresh each rAF tick — using `playheadSec` from a ref mirror is fine; add `const playheadSecRef = useRef(0)` kept in sync where `setPlayheadSec` is called, or read `masterAudioPlayerRef.current?.currentTime`). Prefer `masterAudioPlayerRef.current.currentTime` when playing — it IS master time.
- While `playing && angles.length >= 2`: derive `const cutAngleId = angles[angleIndexAt(cuts, playheadSec)]?.id` and show THAT video in the preview stage (reuse the existing `--visible` class logic: visible when `playing ? angle.id === cutAngleId : angle.id === focusedAngleId`). Paused behavior unchanged (manual tabs for sync work).

**4d. CSS** (`SetEditor.css`): follow the file's existing custom-property/dark-light patterns. Segment colors must be theme-independent chrome over timeline (allowed literals): a0 `#D9A03F`-ish gold, a1 `#4FA3E3` blue, a2 `#9C6BD9` purple, each ~35% opacity fill + solid 2px left border; `.set-editor__cut-marker` a 2px vertical line with a grab handle dot, `cursor: ew-resize`; focused segment gets a brighter outline.

**4e. Post step — upload every angle** (in `handlePost`):
- Replace the single-angle upload with a loop over `angles`; per-angle progress mapped into 0–90: `setUploadProgress(Math.round(((i + fraction) / angles.length) * 90))`.

```js
const uploaded = []; // { bunny, angle }
for (let i = 0; i < angles.length; i++) {
  const angle = angles[i];
  const bunny = await createBunnyVideo({
    title: `${safeTitle}${angles.length > 1 ? ` — Angle ${i + 1}` : ''}`,
    kind: 'set',
  });
  await uploadToBunny(
    angle.file,
    { uploadUrl: bunny.uploadUrl, uploadHeaders: bunny.uploadHeaders },
    (fraction) => setUploadProgress(Math.round(((i + fraction) / angles.length) * 90))
  );
  uploaded.push({ bunny, angle });
}
const primaryBunny = uploaded[0].bunny;
```

- `setData` changes: `videoURL: primaryBunny.hlsUrl`, `bunnyVideoGuid/bunnyLibraryId` from primary (back-compat untouched); plus:

```js
angles: uploaded.map(({ bunny, angle }, i) => ({
  label: `Angle ${i + 1}`,
  bunnyVideoGuid: bunny.videoGuid,
  bunnyLibraryId: bunny.libraryId,
  hlsUrl: bunny.hlsUrl,
  offsetSeconds: angleOffsets[angle.id] || 0,
  durationSeconds: angle.duration || 0,
})),
angleGuids: uploaded.map(({ bunny }) => bunny.videoGuid),
angleStatus: Object.fromEntries(uploaded.map(({ bunny }) => [bunny.videoGuid, 'processing'])),
cuts: normalizeCuts(cuts, { maxAngleIndex: angles.length - 1 }),
```

- Clips remain angle-1-only (fields unchanged, still `primaryBunny`).
- Post summary line: mention `cuts.length - 1` cut point(s) when ≥ 2 angles.
- Update the sync help text to mention: cut row, scissors, 1/2/3 live cutting.

**Steps:** implement 4a–4e → `CI=true npx react-scripts test --watchAll=false` (full suite; SetEditor has no direct tests but the suite must stay green and the app must compile: also run `npx eslint src/components/SetEditor.js` if eslint is wired, otherwise rely on CRA build lint during tests) → commit `feat: multicam cut editing in the set editor + multi-angle upload`.

---

### Task 5: Player — multicam playback

**Files:**
- Modify: `src/components/LiveSetPlayer.js`, `src/components/LiveSetPlayer.css`

Read the whole file first. Key existing behaviors to preserve exactly: signed-URL fetch/caching, trim window, view counting, pip/minimize, keyboard seeking, buffering overlay, audio-master sync for single video.

**5a. Multicam eligibility** (derived, after `signed` state):

```js
const angleList = Array.isArray(signed?.angles) && signed.angles.length >= 2 ? signed.angles : null;
const angleStatus = signed?.angleStatus || set?.angleStatus || {};
const anglesReady = !!angleList && angleList.every((a) => angleStatus[a.bunnyVideoGuid] === 'ready');
const cuts = useMemo(
  () => normalizeCuts(set?.cuts, { maxAngleIndex: (angleList?.length || 1) - 1 }),
  [set?.cuts, angleList]
);
const multicam = !!(angleList && anglesReady && audioTrackURL && audioReplacesVideo);
```

`signed.angles` requires extending the signed-URL effect: pass through `urls.angles` / `urls.angleStatus` into `setSigned`, falling back to `set.angles` unsigned only if the function omits them (older deployed function) — in that case multicam stays off unless URLs aren't Bunny-tokenized. Simplest rule: multicam only when `urls.angles` came back signed (or the hlsUrls are non-Bunny).

- Master-time window: `masterIn = trimStart + (Number(angleList?.[0]?.offsetSeconds) || audioOffsetSeconds)`; `masterOut = trimEnd != null ? trimEnd + offset0 : (durations known ? min over... ) ` — keep it simple: derive `effDuration` in multicam mode from `set.durationSeconds` (already the trimmed length) and clamp.

**5b. Rendering** — in multicam mode render N stacked videos inside `.live-set-player-video-wrap`:

```jsx
{multicam ? angleList.map((a, i) => (
  <video
    key={a.bunnyVideoGuid}
    ref={(el) => { multiVideoRefs.current[i] = el; }}
    className={`live-set-player-video live-set-player-video--stacked ${i === activeAngle ? 'is-active' : ''}`}
    preload="metadata"
    muted
    playsInline
    /* buffering handlers only on the active video via effect, not props */
  />
)) : ( /* existing single <video> unchanged */ )}
```

CSS: `.live-set-player-video--stacked { position: absolute; inset: 0; opacity: 0; } .live-set-player-video--stacked.is-active { opacity: 1; }` — parent wrap already sizes the video; make wrap `position: relative` if not already. Add a small angle badge (`.live-set-player-angle-badge`, chrome-over-video literal colors) showing "Angle N" for 1.5s after each switch (optional polish; keep minimal).

**5c. Wiring** — new effects, gated on `multicam` (the existing single-video effects must remain and be skipped in multicam mode — gate them):
- `attachHls(el, angleList[i].hlsUrl)` per stacked video (one effect over the list, cleanup all).
- Controller effect replaces the single `createAudioMasterSync` effect when multicam:

```js
const sync = createMulticamAudioMasterSync(
  angleList.map((a, i) => ({ video: multiVideoRefs.current[i], offset: Number(a.offsetSeconds) || 0 })),
  audioRef.current,
  {
    cuts,
    audioStart: masterIn,
    onActiveAngleChange: (i) => setActiveAngle(i),
  }
);
syncRef.current = sync; // togglePlay/seek paths keep working via syncRef
```

- Time/seek plumbing: in multicam mode the UI clock is the AUDIO: drive `currentTime` state from the audio element's `timeupdate` (master time), display `currentTime - masterIn`, seek via `sync.seek(masterIn + p * effDuration)`. The multicam controller's `seek` takes MASTER time (unlike the single controller's video time) — the component must branch accordingly in `seekToClientX`/keyboard handler. Trim-end stop: pause when master time ≥ masterOut.
- Events currently bound to the single video (`play/pause/timeupdate/loadedmetadata`, view counting) need a multicam branch: bind play/pause/waiting to the AUDIO element + active video for buffering; count the view on first audio play.
- Fallback: if any stacked video errors (`error` event) or `attachHls` fails, set a `multicamFailed` flag → component falls back to the single-video path (primary `videoURL`), which already works.

**Steps:** implement → full suite `CI=true npx react-scripts test --watchAll=false` green → commit `feat: multicam playback in LiveSetPlayer`.

---

## Final verification (orchestrator)
- [ ] `CI=true npx react-scripts test --watchAll=false` — entire suite green.
- [ ] `npx eslint src/utils/multicam.js src/utils/audioVideoSync.js src/components/SetEditor.js src/components/LiveSetPlayer.js` (if configured) or confirm CRA compile via test run.
- [ ] `node --check functions/index.js`.
- [ ] Review full `git diff main...multicam-cuts` for spec compliance (audio never seeked in playback loops; back-compat fields untouched; mobile gating unaffected — the editor is desktop-first but must not break mobile layout).
- [ ] Report: manual browser verification + functions deploy (`firebase deploy --only functions`) are the user's call.
