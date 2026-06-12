# Set Editor Sync Preview + Camera Defaults Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the set editor's sync screen show the video while aligning (visible preview, live seek during drags, ms-precision nudges), and fix six scene-variant camera defaults.

**Architecture:** The hidden `.set-editor__sync-players` container in `SetEditor.js` becomes a visible preview panel — same `<video>` elements (no re-mount), focused angle visible, rest hidden. Pointer-drag handlers gain throttled live seeking. New pure helpers in `src/utils/syncEditorMath.js` carry the clamp/format/seek math. Camera defaults are data edits in `src/data/settings.js`.

**Tech Stack:** React 18 (CRA), Jest (`CI=true npm test -- --watchAll=false --testPathPattern=<name>`), HTMLMediaElement seeking.

**Spec:** `docs/superpowers/specs/2026-06-12-set-editor-sync-preview-design.md`

---

### Task 0: Commit the June 2 WIP as the baseline

**Files:** all currently modified tracked files plus `public/scenes/musician-guitar-room.glb` (referenced by `settings.js`, must ship).

- [ ] **Step 1: Inspect untracked dirs before adding**

Run: `du -sh models public/scenes/*.glb .superpowers 2>/dev/null`
`models/` and `.superpowers/` stay untracked (source assets / scratch). Only the `.glb` under `public/scenes/` is needed by the app.

- [ ] **Step 2: Commit**

```bash
git add -A src/ PRODUCTS.md package-lock.json storage.rules public/scenes/musician-guitar-room.glb .firebase/hosting.YnVpbGQ.cache
git commit -m "wip: multi-angle set editor with waveform sync, Bunny upload, new scenes (June 2 baseline)"
```

Expected: working tree clean except `models/`, `.superpowers/`.

---

### Task 1: `syncEditorMath` helpers

**Files:**
- Create: `src/utils/syncEditorMath.js`
- Test: `src/utils/syncEditorMath.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/utils/syncEditorMath.test.js
import { nudgeOffset, angleTimeAtMaster, formatOffsetMs } from './syncEditorMath';

describe('nudgeOffset', () => {
  test('adds delta to current offset', () => {
    expect(nudgeOffset(1.0, 0.01, 60)).toBeCloseTo(1.01);
    expect(nudgeOffset(1.0, -0.1, 60)).toBeCloseTo(0.9);
  });
  test('treats null/undefined current as 0', () => {
    expect(nudgeOffset(undefined, 0.1, 60)).toBeCloseTo(0.1);
    expect(nudgeOffset(null, -0.01, 60)).toBeCloseTo(-0.01);
  });
  test('clamps to ±previewDuration', () => {
    expect(nudgeOffset(59.95, 0.1, 60)).toBe(60);
    expect(nudgeOffset(-59.95, -0.1, 60)).toBe(-60);
  });
});

describe('angleTimeAtMaster', () => {
  test('subtracts offset from master time', () => {
    expect(angleTimeAtMaster(10, 2)).toBe(8);
    expect(angleTimeAtMaster(10, -1.5)).toBe(11.5);
  });
  test('missing offset means 0', () => {
    expect(angleTimeAtMaster(10, undefined)).toBe(10);
  });
});

describe('formatOffsetMs', () => {
  test('formats with sign and 3 decimals', () => {
    expect(formatOffsetMs(1.2345)).toBe('+1.234s');
    expect(formatOffsetMs(-0.01)).toBe('−0.010s');
    expect(formatOffsetMs(0)).toBe('+0.000s');
  });
  test('non-finite input renders as zero', () => {
    expect(formatOffsetMs(NaN)).toBe('+0.000s');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `CI=true npm test -- --watchAll=false --testPathPattern=syncEditorMath`
Expected: FAIL — "Cannot find module './syncEditorMath'"

- [ ] **Step 3: Implement**

```js
// src/utils/syncEditorMath.js
// Pure math for the set editor sync screen: offset nudging, the master→angle
// time mapping shared by every seek path, and the ms-precision offset readout.

export function nudgeOffset(current, deltaSec, previewDuration) {
  const next = (current || 0) + deltaSec;
  const limit = Math.max(0, previewDuration || 0);
  return Math.max(-limit, Math.min(limit, next));
}

export function angleTimeAtMaster(masterSec, offsetSec) {
  return masterSec - (offsetSec || 0);
}

export function formatOffsetMs(sec) {
  const v = Number.isFinite(sec) ? sec : 0;
  const sign = v < 0 ? '−' : '+';
  return `${sign}${Math.abs(v).toFixed(3)}s`;
}
```

- [ ] **Step 4: Run to verify pass** — same command, expected PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/utils/syncEditorMath.js src/utils/syncEditorMath.test.js
git commit -m "feat: sync editor math helpers (nudge clamp, time mapping, ms readout)"
```

---

### Task 2: Visible preview panel

**Files:**
- Modify: `src/components/SetEditor.js` (imports ~line 8; hidden players block lines ~1104–1123 moves + restyles; sync section layout)
- Modify: `src/components/SetEditor.css` (replace `.set-editor__sync-players` rules ~lines 383–396)

- [ ] **Step 1: Add import**

```js
import { nudgeOffset, angleTimeAtMaster, formatOffsetMs } from '../utils/syncEditorMath';
```

- [ ] **Step 2: Replace the hidden players block with the preview panel**

Delete the `{/* Hidden players... */} <div className="set-editor__sync-players" aria-hidden>…</div>` block (after `.set-editor__sync-help`) and insert this **at the top of the Sync section, immediately after the `</div>` closing `.set-editor__section-header`** (before `.set-editor__sync-shell`):

```jsx
          {/* Preview: focused angle visible; all media elements live here so
              playback/seek refs never re-mount. */}
          <div className="set-editor__sync-preview">
            <div className="set-editor__preview-bar">
              <div className="set-editor__preview-tabs" role="tablist" aria-label="Preview angle">
                {angles.map((angle, idx) => (
                  <button
                    key={angle.id}
                    type="button"
                    role="tab"
                    aria-selected={angle.id === focusedAngleId}
                    className={`set-editor__preview-tab ${angle.id === focusedAngleId ? 'active' : ''}`}
                    onClick={() => setFocusedAngleId(angle.id)}
                  >
                    Angle {idx + 1}
                  </button>
                ))}
              </div>
              <div className="set-editor__preview-nudges" role="group" aria-label="Offset nudge">
                {[-0.1, -0.01, 0.01, 0.1].map((d) => (
                  <button
                    key={d}
                    type="button"
                    className="set-editor__nudge-btn"
                    disabled={focusedAngleId == null}
                    onClick={() => handleNudgeOffset(d)}
                    title={`Shift focused angle ${d > 0 ? 'later' : 'earlier'} by ${Math.abs(d)}s`}
                  >
                    {d > 0 ? `+${d}` : d}
                  </button>
                ))}
                <span className="set-editor__nudge-readout">
                  {focusedAngleId != null ? formatOffsetMs(angleOffsets[focusedAngleId] || 0) : '—'}
                </span>
              </div>
            </div>
            <div className="set-editor__preview-stage">
              {audio?.url && (
                <audio ref={masterAudioPlayerRef} src={audio.url} preload="auto" />
              )}
              {angles.map((angle) => (
                <video
                  key={angle.id}
                  ref={(el) => { if (el) anglePlayerRefs.current[angle.id] = el; else delete anglePlayerRefs.current[angle.id]; }}
                  src={angle.url}
                  preload="auto"
                  playsInline
                  muted
                  className={`set-editor__preview-video ${angle.id === focusedAngleId ? 'set-editor__preview-video--visible' : ''}`}
                />
              ))}
              {focusedAngleId == null && (
                <div className="set-editor__preview-empty">Click an angle row to preview it here.</div>
              )}
            </div>
          </div>
```

Note: keep the `muted` attribute — the A/B mute effect (line ~502) overwrites `.muted` at runtime; the attribute only sets the initial state.

- [ ] **Step 3: Add the nudge handler** (near `handleAutoAlign`):

```js
  // Nudge the focused angle's offset by ±deltaSec; the paused-seek effect
  // re-seeks its video so the frame updates immediately.
  const handleNudgeOffset = useCallback((deltaSec) => {
    if (focusedAngleId == null) return;
    setAngleOffsets((prev) => ({
      ...prev,
      [focusedAngleId]: nudgeOffset(prev[focusedAngleId] || 0, deltaSec, previewDuration),
    }));
  }, [focusedAngleId, previewDuration]);
```

- [ ] **Step 4: Make label rows focus their angle on click**

On the angle label row `<div key={angle.id} className="set-editor__sync-label-row">` add `onClick={() => setFocusedAngleId(angle.id)}`.

- [ ] **Step 5: ms offset readout in label rows**

Replace `<span>offset {formatTime(offset)}</span>` with `<span>offset {formatOffsetMs(offset)}</span>`.

- [ ] **Step 6: Replace the CSS**

Replace the `.set-editor__sync-players` rules (and its comment) in `SetEditor.css` with:

```css
/* Sync preview: focused angle video + nudge toolbar. */
.set-editor__sync-preview {
  margin-bottom: 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.35);
}
.set-editor__preview-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  padding: 8px 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.set-editor__preview-tabs { display: flex; gap: 6px; }
.set-editor__preview-tab {
  padding: 5px 12px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: transparent;
  color: inherit;
  font-size: 12px;
  cursor: pointer;
}
.set-editor__preview-tab.active {
  background: #00a2ff;
  border-color: #00a2ff;
  color: #fff;
}
.set-editor__preview-nudges { display: flex; align-items: center; gap: 6px; }
.set-editor__nudge-btn {
  min-width: 44px;
  padding: 5px 8px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: transparent;
  color: inherit;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
}
.set-editor__nudge-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.set-editor__nudge-readout {
  margin-left: 4px;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  opacity: 0.85;
  min-width: 64px;
  text-align: right;
}
.set-editor__preview-stage {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
  min-height: 120px;
}
.set-editor__preview-video { display: none; }
.set-editor__preview-video--visible {
  display: block;
  width: 100%;
  max-height: 340px;
  object-fit: contain;
}
.set-editor__preview-empty {
  padding: 36px 12px;
  font-size: 13px;
  opacity: 0.6;
}
.set-editor--light .set-editor__sync-preview {
  border-color: rgba(0, 0, 0, 0.12);
  background: rgba(0, 0, 0, 0.04);
}
.set-editor--light .set-editor__preview-bar { border-bottom-color: rgba(0, 0, 0, 0.12); }
.set-editor--light .set-editor__preview-tab,
.set-editor--light .set-editor__nudge-btn { border-color: rgba(0, 0, 0, 0.2); }
```

- [ ] **Step 7: Sanity check** — `CI=true npm test -- --watchAll=false --testPathPattern=syncEditorMath` still PASS (compile errors in SetEditor would surface in Task 6's browser run; no SetEditor unit tests exist).

- [ ] **Step 8: Commit**

```bash
git add src/components/SetEditor.js src/components/SetEditor.css
git commit -m "feat: visible synced video preview with nudge toolbar in set editor"
```

---

### Task 3: Live seek during drags + frame-step

**Files:**
- Modify: `src/components/SetEditor.js` (pointer handlers ~lines 403–427; sync tools toolbar ~line 962)

- [ ] **Step 1: Add throttle ref** (near `dragRef`):

```js
  const lastLiveSeekRef = useRef(0);
```

- [ ] **Step 2: Live seek in `handleRowPointerMove`**

At the end of the function (after the existing scrub/offset branches), before the closing brace, add:

```js
    const now = performance.now();
    if (now - lastLiveSeekRef.current > 80) {
      lastLiveSeekRef.current = now;
      if (d.kind === 'scrub' && d.currentSec != null) {
        seekAllToMasterTime(d.currentSec);
      } else if (d.kind === 'offset' && d.currentOffsetSec != null) {
        const v = anglePlayerRefs.current[d.angleId];
        if (v) {
          const t = angleTimeAtMaster(playheadSec, d.currentOffsetSec);
          const dur = Number.isFinite(v.duration) ? v.duration : Infinity;
          v.currentTime = Math.max(0, Math.min(dur - 0.01, t));
        }
      }
    }
```

Update the `useCallback` deps to `[pxPerSec, previewDuration, seekAllToMasterTime, playheadSec]`.

- [ ] **Step 3: Frame-step buttons**

In the sync tools toolbar, wrap the time readout (`<span className="set-editor__sync-time">…`) with step buttons:

```jsx
              <button
                type="button"
                className="set-editor__zoom-btn"
                onClick={() => setPlayheadSec((s) => Math.max(0, Math.min(previewDuration, s - 1 / 30)))}
                aria-label="Step back one frame"
                title="Back one frame (~33ms)"
              >‹</button>
              <span className="set-editor__sync-time">{formatTime(playheadSec)}</span>
              <button
                type="button"
                className="set-editor__zoom-btn"
                onClick={() => setPlayheadSec((s) => Math.max(0, Math.min(previewDuration, s + 1 / 30)))}
                aria-label="Step forward one frame"
                title="Forward one frame (~33ms)"
              >›</button>
```

(The paused-playhead effect at line ~490 already re-seeks all media on `playheadSec` change.)

- [ ] **Step 4: Update the help text**

```jsx
          <div className="set-editor__sync-help">
            <strong>Auto-align</strong> first, then verify: zoom into a hit on the master waveform, park the
            playhead on it (‹ › steps one frame), and nudge the angle (±0.01s) until the preview frame shows
            the action. Drag the ruler to scrub, drag an angle row to slide it, and use <em>Master / Angle</em>
            to A/B what you hear.
          </div>
```

- [ ] **Step 5: Commit**

```bash
git add src/components/SetEditor.js
git commit -m "feat: live video seek while dragging + frame-step playhead controls"
```

---

### Task 4: Camera defaults in settings.js

**Files:**
- Modify: `src/data/settings.js` (six `camera:` lines, see grep anchors)

- [ ] **Step 1: Apply the six edits**

| Variant | Old | New |
|---|---|---|
| Club Booth (~line 20) | `position: [0, 2.2, 1.8]` | `position: [0, 2.5, 2.25]` |
| Rooftop (~line 39) | `position: [0, 8, 12]` | `position: [0, 4.5, 6.5]` |
| Dojo (~line 71) | `position: [0, 2.6, 3.4]` | `position: [-0.8, 2.2, 2.4]` |
| Studio (~line 102) | `position: [0, 3.2, 4.5]` | `position: [0, 2.5, 3.2]` |
| Stage (~line 121) | `position: [0, 3.5, 6]` | `position: [0, 2.75, 4.2]` |
| Guitar Room (~line 140) | `position: [0, 3.5, 6]` | `position: [0, 2.9, -4.5]` |

Targets unchanged. Guitar Room flips to the opposite side of the room (−z) per the user's request; OrbitControls keeps facing the same target.

- [ ] **Step 2: Commit**

```bash
git add src/data/settings.js
git commit -m "feat: retune default camera positions for six scene variants"
```

---

### Task 5: Browser verification with generated media

No new code committed in this task; the dev harness is temporary and reverted.

- [ ] **Step 1: Temporary harness (do not commit)**

In `src/index.js`, render SetEditor directly for `/__sync-harness` (it needs Router context for `useNavigate`):

```jsx
// TEMP sync harness — revert before committing anything else
import { BrowserRouter } from 'react-router-dom';
import SetEditor from './components/SetEditor';
// inside the render decision:
window.location.pathname === '/__sync-harness'
  ? root.render(<BrowserRouter><SetEditor onBack={() => {}} /></BrowserRouter>)
  : /* existing render */
```

(Adapt to the file's actual structure when reading it.)

- [ ] **Step 2: Generate test media** (if `which ffmpeg` succeeds)

```bash
# 12s video: navy frames, burnt-in timecode, one beep at t=1s (video's own audio)
ffmpeg -y -f lavfi -i "color=c=navy:s=640x360:d=12:r=30" \
  -f lavfi -i "sine=frequency=880:duration=0.08,adelay=1000|1000,apad=whole_dur=12" \
  -vf "drawtext=text='%{pts\\:hms}':fontcolor=white:fontsize=48:x=20:y=20" \
  -shortest public/__test-angle.mp4
# Master audio: same beep pattern shifted 2s later
ffmpeg -y -f lavfi -i "sine=frequency=880:duration=0.08,adelay=3000|3000,apad=whole_dur=14" public/__test-master.wav
```

If ffmpeg is missing: skip Steps 2–4's media-driven checks, verify only UI states (empty preview, disabled nudges), and lean on the user's real-footage sign-off.

- [ ] **Step 3: Load files into the editor via preview tools**

Start `dev-alt` preview server → navigate to `/__sync-harness` → with `preview_eval`, fetch `/__test-angle.mp4` and `/__test-master.wav`, build `File`s, set them on the two hidden `input[type=file]` elements (index 0 = angle, 1 = audio) via `DataTransfer`, dispatch `change`.

- [ ] **Step 4: Verify behaviors**

- `preview_snapshot`: preview panel present, "Angle 1" tab active, nudge buttons enabled, offset readout `+0.000s`.
- `preview_eval`: click `+0.1` nudge → readout `+0.100s`; video element's `currentTime` decreased by ~0.1 relative to playhead mapping.
- Auto-align: click it → offset readout near `+2.000s` (the planted shift), tolerance ±0.05s.
- Frame-step: click `›` → playhead readout advances ~0.03s and `video.currentTime` follows.
- `preview_console_logs` level=error: nothing new from SetEditor.

- [ ] **Step 5: Clean up**

```bash
git checkout -- src/index.js
rm -f public/__test-angle.mp4 public/__test-master.wav
```

- [ ] **Step 6: Full touched-test sweep**

Run: `CI=true npm test -- --watchAll=false --testPathPattern='(syncEditorMath|affiliateLink|affiliateClicks|DeviceHoverMenu|LegalPage|AppShell)'`
Expected: all PASS.

- [ ] **Step 7: Hand off to user**

User runs `npm run build && npm run deploy`, then verifies with real footage: upload 1–2 angles + master audio at `/set-editor`, Auto-align, eyeball cue hits in the preview, nudge, post. User also eyeballs the six scene cameras and reports which need re-tuning.
