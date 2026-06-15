# Set Builder Mobile Feel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the 3D set builder usable on a phone — restore two-finger drag-to-pan, enlarge the camera-angle buttons and in-scene menus for touch — without changing the laptop experience at all.

**Architecture:** Pan math lives in a pure, unit-tested helper `src/utils/cameraPan.js`. `ThreeScene.js`'s existing hand-written two-finger pointer handler is extended to call it (zoom stays; pan is added). Button/menu sizing is CSS-only under `@media (pointer: coarse)`, which targets touch devices and never affects mouse/trackpad laptops (even at small window sizes). No OrbitControls touch change, no desktop input change.

**Tech Stack:** React 18 (CRA), Three.js 0.162 (OrbitControls, pointer events), Jest (`CI=true npm test -- --watchAll=false --testPathPattern=<name>`).

**Spec:** `docs/superpowers/specs/2026-06-14-set-builder-mobile-feel-design.md`

**Hard constraint:** desktop/laptop build stays byte-for-byte identical. Touch handler (`activePointers`) and `@media (pointer: coarse)` are the only surfaces touched.

---

### Task 1: `cameraPan.js` pan-math helper

**Files:**
- Create: `src/utils/cameraPan.js`
- Test: `src/utils/cameraPan.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/utils/cameraPan.test.js
import { midpoint, panOffsetFromMidpointDelta } from './cameraPan';

describe('midpoint', () => {
  test('averages two points', () => {
    expect(midpoint({ clientX: 0, clientY: 0 }, { clientX: 10, clientY: 20 })).toEqual({ x: 5, y: 10 });
  });
});

describe('panOffsetFromMidpointDelta', () => {
  const base = { cameraDistance: 10, viewportHeight: 800, fovRad: Math.PI / 3 }; // 60° fov

  test('zero finger movement produces zero pan', () => {
    expect(panOffsetFromMidpointDelta({ dxScreen: 0, dyScreen: 0, ...base })).toEqual({ rightUnits: 0, upUnits: 0 });
  });

  test('dragging fingers right moves camera left along its right axis (negative rightUnits)', () => {
    const { rightUnits } = panOffsetFromMidpointDelta({ dxScreen: 40, dyScreen: 0, ...base });
    expect(rightUnits).toBeLessThan(0);
  });

  test('dragging fingers down produces positive upUnits (scene follows fingers)', () => {
    const { upUnits } = panOffsetFromMidpointDelta({ dxScreen: 0, dyScreen: 40, ...base });
    expect(upUnits).toBeGreaterThan(0);
  });

  test('farther camera distance pans more world units for the same drag', () => {
    const near = panOffsetFromMidpointDelta({ dxScreen: 40, dyScreen: 0, ...base, cameraDistance: 5 });
    const far = panOffsetFromMidpointDelta({ dxScreen: 40, dyScreen: 0, ...base, cameraDistance: 20 });
    expect(Math.abs(far.rightUnits)).toBeGreaterThan(Math.abs(near.rightUnits));
  });

  test('matches the OrbitControls world-per-pixel formula', () => {
    // worldPerPixel = 2 * dist * tan(fov/2) / viewportHeight
    const wpp = (2 * 10 * Math.tan((Math.PI / 3) / 2)) / 800;
    const { rightUnits, upUnits } = panOffsetFromMidpointDelta({ dxScreen: 40, dyScreen: -25, ...base });
    expect(rightUnits).toBeCloseTo(-40 * wpp, 6);
    expect(upUnits).toBeCloseTo(-25 * wpp, 6);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `CI=true npm test -- --watchAll=false --testPathPattern=cameraPan`
Expected: FAIL — "Cannot find module './cameraPan'"

- [ ] **Step 3: Implement**

```js
// src/utils/cameraPan.js
// Pure pan math for the set builder's two-finger touch gesture. Returns how far
// to translate the camera + target along the camera's own right/up axes so the
// scene tracks the fingers 1:1 (same world-per-pixel formula OrbitControls uses
// for perspective pan). ThreeScene multiplies these scalars by the live camera
// basis vectors — keeping this file WebGL-free and unit-testable.

export function midpoint(a, b) {
  return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
}

export function panOffsetFromMidpointDelta({ dxScreen, dyScreen, cameraDistance, viewportHeight, fovRad }) {
  if (!viewportHeight) return { rightUnits: 0, upUnits: 0 };
  const worldPerPixel = (2 * cameraDistance * Math.tan(fovRad / 2)) / viewportHeight;
  // Drag right (dxScreen > 0): camera shifts left along its right axis → negative.
  // Drag down (dyScreen > 0, screen-y points down): camera shifts up in world → positive.
  return {
    rightUnits: -dxScreen * worldPerPixel,
    upUnits: dyScreen * worldPerPixel,
  };
}
```

- [ ] **Step 4: Run to verify pass** — same command, expected PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/utils/cameraPan.js src/utils/cameraPan.test.js
git commit -m "feat: pure camera-pan math helper for two-finger touch gesture"
```

---

### Task 2: Wire two-finger pan into ThreeScene

**Files:**
- Modify: `src/ThreeScene.js` — imports (top) and the two-finger pointer handler (lines ~1476–1515)

- [ ] **Step 1: Import the helper**

Add near the other `./utils/...` imports (e.g. after the `cameraPan`-adjacent group; any util import line works):

```js
import { midpoint, panOffsetFromMidpointDelta } from './utils/cameraPan';
```

- [ ] **Step 2: Track the two-finger midpoint on pointer down**

Replace the existing `pinchStart*` declarations (lines ~1477–1478):

```js
        let pinchStartDistance = 0;
        let pinchStartCameraDistance = 0;
```

with:

```js
        let pinchStartDistance = 0;
        let pinchStartCameraDistance = 0;
        let panLastMid = null; // last two-finger midpoint, screen px
```

In `onPointerDown`, replace this block (lines ~1487–1491):

```js
            if (activePointers.size === 2) {
                isPinchingRef.current = true;
                pinchStartDistance = getPointersDistance(activePointers);
                pinchStartCameraDistance = camera.position.distanceTo(controls.target);
            }
```

with:

```js
            if (activePointers.size === 2) {
                isPinchingRef.current = true;
                pinchStartDistance = getPointersDistance(activePointers);
                pinchStartCameraDistance = camera.position.distanceTo(controls.target);
                const pts = Array.from(activePointers.values());
                panLastMid = midpoint(pts[0], pts[1]);
            }
```

- [ ] **Step 3: Apply pan after the existing zoom step**

In `onPointerMove`, the two-finger branch currently ends after `controls.update();` inside `if (activePointers.size === 2 && pinchStartDistance > 0)`. Replace that whole inner block (lines ~1496–1506):

```js
                if (activePointers.size === 2 && pinchStartDistance > 0) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    const dist = getPointersDistance(activePointers);
                    if (dist <= 0) return;
                    const ratio = pinchStartDistance / dist;
                    const newDist = pinchStartCameraDistance * ratio;
                    const dir = camera.position.clone().sub(controls.target).normalize();
                    camera.position.copy(controls.target).add(dir.multiplyScalar(newDist));
                    controls.update();
                }
```

with:

```js
                if (activePointers.size === 2 && pinchStartDistance > 0) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    const dist = getPointersDistance(activePointers);
                    if (dist <= 0) return;
                    // Pinch → dolly (unchanged).
                    const ratio = pinchStartDistance / dist;
                    const newDist = pinchStartCameraDistance * ratio;
                    const dir = camera.position.clone().sub(controls.target).normalize();
                    camera.position.copy(controls.target).add(dir.multiplyScalar(newDist));
                    // Two-finger drag → pan camera + target along camera basis.
                    const pts = Array.from(activePointers.values());
                    if (panLastMid && pts.length === 2) {
                        const newMid = midpoint(pts[0], pts[1]);
                        const { rightUnits, upUnits } = panOffsetFromMidpointDelta({
                            dxScreen: newMid.x - panLastMid.x,
                            dyScreen: newMid.y - panLastMid.y,
                            cameraDistance: camera.position.distanceTo(controls.target),
                            viewportHeight: renderer.domElement.clientHeight,
                            fovRad: (camera.fov * Math.PI) / 180,
                        });
                        const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0);
                        const up = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 1);
                        const panVec = right.multiplyScalar(rightUnits).add(up.multiplyScalar(upUnits));
                        camera.position.add(panVec);
                        controls.target.add(panVec);
                        panLastMid = newMid;
                    }
                    controls.update();
                }
```

- [ ] **Step 4: Reset the midpoint when the gesture ends**

In `onPointerUp`, replace (lines ~1511–1514):

```js
            if (activePointers.size < 2) {
                pinchStartDistance = 0;
                setTimeout(() => { isPinchingRef.current = false; }, 150);
            }
```

with:

```js
            if (activePointers.size < 2) {
                pinchStartDistance = 0;
                panLastMid = null;
                setTimeout(() => { isPinchingRef.current = false; }, 150);
            }
```

- [ ] **Step 5: Confirm it compiles (verified in Task 5's browser run)**

ThreeScene has no unit tests (WebGL). `THREE`, `camera`, `controls`, `renderer` are all already in scope in this effect. Behavior is verified in Task 5.

- [ ] **Step 6: Commit**

```bash
git add src/ThreeScene.js
git commit -m "feat: restore two-finger drag-to-pan in set builder (touch only)"
```

---

### Task 3: Touch-sized camera-angle buttons

**Files:**
- Modify: `src/components/CameraAngleControls.css` (append a media block)

- [ ] **Step 1: Append the mobile block**

Add to the end of `src/components/CameraAngleControls.css`:

```css
/* Touch devices: bigger hit areas, lifted clear of the bottom nav. Pointer-fine
   (mouse/trackpad) laptops are unaffected, even at small window sizes. */
@media (pointer: coarse) {
  .camera-angle-controls {
    bottom: 96px;
    left: 12px;
    gap: 12px;
  }
  .camera-angle-save,
  .camera-angle-recall {
    width: 48px;
    height: 48px;
    border-radius: 10px;
  }
  .camera-angle-recall {
    font-size: 18px;
  }
}
```

Note: the icon inside `.camera-angle-save` is set via the React `size={14}` prop
on `MdOutlineCameraAlt`; bumping it requires JS. Per spec scope we keep markup
unchanged — the 48px tappable button is the fix; the 14px glyph sits centered in
it and is acceptable. (If the glyph later needs to be bigger, that's a one-line
prop change, tracked separately.)

- [ ] **Step 2: Commit**

```bash
git add src/components/CameraAngleControls.css
git commit -m "feat: touch-sized camera-angle buttons on coarse-pointer devices"
```

---

### Task 4: Touch-sized device hover menu

**Files:**
- Modify: `src/components/DeviceHoverMenu.css` (append a media block)

- [ ] **Step 1: Append the mobile block**

Add to the end of `src/components/DeviceHoverMenu.css`:

```css
/* Touch devices: enlarge the buy/swap/remove targets to ~44px. */
@media (pointer: coarse) {
  .dhm-btn {
    width: 44px;
    height: 44px;
    font-size: 18px;
  }
  .dhm-actions { gap: 12px; }
  .dhm-label { font-size: 13px; }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/DeviceHoverMenu.css
git commit -m "feat: touch-sized device hover menu buttons on coarse-pointer devices"
```

---

### Task 5: Browser verification + handoff

No committed code here unless a spot-check turns up a real overflow bug.

- [ ] **Step 1: Start preview + load the builder**

The builder is auth-gated, so reuse the same temporary harness pattern as the
set-editor verification: in `src/index.js`, render `ThreeScene` (wrapped in
`BrowserRouter`) for `/__builder-harness` with a minimal DJ setup, OR — simpler
and preferred — verify the touch handler purely through the already-passing
`cameraPan` unit tests plus a DOM/CSS check of button sizes via the harness used
for sizing only. Do NOT commit the harness; `git checkout -- src/index.js` after.

If wiring a live `ThreeScene` harness proves heavy, it is acceptable to rely on:
(a) the `cameraPan` unit tests for the math, and (b) a `@media (pointer: coarse)`
CSS check (below) for sizing, and defer the full gesture check to the user's
real-phone test. State clearly in the handoff which path was taken.

- [ ] **Step 2: Verify touch-target sizes at a coarse pointer**

With the preview at a phone viewport and `preview_resize`/emulation forcing
`pointer: coarse`, use `preview_eval` to read computed sizes:

```js
(() => {
  const r = (sel) => { const el = document.querySelector(sel); if (!el) return null; const c = getComputedStyle(el); return { w: c.width, h: c.height }; };
  return JSON.stringify({ camSave: r('.camera-angle-save'), camRecall: r('.camera-angle-recall'), dhmBtn: r('.dhm-btn') });
})()
```

Expected: camera buttons report `48px`, `.dhm-btn` reports `44px` when a device
menu is open. (If the menu isn't open in the harness, assert the rule exists via
`getComputedStyle` on a temporarily injected `.dhm-btn` element, or skip to the
real-phone check.)

- [ ] **Step 3: Verify pan vs rotate (if live ThreeScene harness is up)**

`preview_eval`: capture `camera.position` + `camera.quaternion` (expose the
camera on `window` from the harness), dispatch two `pointerdown` + paired
`pointermove` events with both midpoints sliding the same direction, then assert
`camera.position` changed but `camera.quaternion` did **not** (pan, not rotate).
Then dispatch a single `pointerdown`/`pointerup` (tap) on a ghost spot and
confirm a device still places (placedDevices count increments).

- [ ] **Step 4: Desktop guard**

Force `pointer: fine` (desktop) and re-read sizes: camera buttons must be `28px`
(the `@media (pointer: coarse)` block must not apply). This proves the laptop UI
is untouched.

- [ ] **Step 5: Clean up + full test sweep**

```bash
git checkout -- src/index.js   # if a harness was added
```

Run: `CI=true npm test -- --watchAll=false --testPathPattern='(cameraPan|syncEditorMath|affiliateLink|affiliateClicks|DeviceHoverMenu|LegalPage|AppShell)'`
Expected: all PASS.

- [ ] **Step 6: Hand off to user**

User runs `npm run build && npm run deploy`, opens the builder on a real phone,
and confirms: one finger orbits, two fingers pan **and** pinch-zoom, camera
buttons are tappable, the device menu buttons are tappable. Report which
verification path Step 1 took.
