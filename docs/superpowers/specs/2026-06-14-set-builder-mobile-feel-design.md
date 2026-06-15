# Set Builder Mobile Feel — Design

Date: 2026-06-14
Status: Approved direction (user: "I just want to fix how it feels to open the set builder on mobile" — keep the laptop experience exactly as built)

## Goal

Make the 3D set builder feel good on a phone, without changing the laptop
experience at all. Three concrete fixes: restore two-finger drag-to-pan, make
the camera-angle buttons tappable, and make the in-scene touch menus
finger-sized. This is sub-project A of the larger mobile overhaul (B = mobile
nav shell, C = design tokens, D = per-screen passes are separate, later specs).

## Hard constraint

**The desktop/laptop build must stay byte-for-byte identical.** Every change is
gated behind mobile/touch detection or `@media`, and the desktop input paths
(`controls.mouseButtons.LEFT = PAN`, the wheel-to-rotate `handleWheel`) are not
touched. No rewrite of `ThreeScene.js`.

## Background (current code)

`src/ThreeScene.js`:
- `controls.touches = { ONE: TOUCH.ROTATE, TWO: -1 }` (line ~1473) — one finger
  orbits; OrbitControls' two-finger gesture is disabled (`TWO: -1`).
- A hand-written pointer handler (lines ~1476–1521) tracks active pointers in a
  `Map` and, on two pointers, does pinch-zoom only (no pan). The team
  deliberately left OrbitControls' touch handling because it conflicted with the
  pointer events used for tap-to-place; we keep that decision.
- `isMobile` state already exists in the component; `src/utils/mobileDetection.js`
  and `MobileNavigation.js` already exist.

`src/components/CameraAngleControls.css`: save/recall buttons are 28×28px with a
14px icon and no mobile sizing — below the ~44px touch-target minimum.

`src/components/DeviceHoverMenu.css`: action buttons are 36px — borderline on
touch.

## Design

### 1. Restore two-finger pan (Approach 2: extend the manual handler)

Extend the existing two-finger pointer handler to pan by the two-finger
**midpoint delta**, keeping the existing pinch-zoom. No OrbitControls touch
changes, so tap-to-place is unaffected.

- On the second `pointerdown`, record `panStartMid = midpoint(p1, p2)` (screen
  px) alongside the existing `pinchStartDistance`.
- On two-finger `pointermove`: after the zoom step, compute the new midpoint,
  take `dxScreen/dyScreen` from the last midpoint, convert to a world-space pan
  of both `camera.position` and `controls.target` (pan distance scales with the
  camera-to-target distance and viewport size so it feels 1:1 under the
  fingers), then `controls.update()`. Update the stored midpoint each move.
- The pan math lives in a pure helper `src/utils/cameraPan.js`
  (`panOffsetFromMidpointDelta({ dxScreen, dyScreen, cameraDistance, viewportHeight, fovRad })` →
  `{ rightUnits, upUnits }`) so it is unit-testable without WebGL. ThreeScene
  multiplies those scalars by the camera's right/up basis vectors.
- Unchanged: one-finger orbit, tap-to-place, `isPinchingRef` gating (which
  suppresses stray taps during multi-touch).

### 2. Tappable camera-angle buttons on mobile

In `CameraAngleControls.css`, add mobile-only sizing via
`@media (pointer: coarse)` (matches touch devices without affecting
mouse/trackpad laptops, even small windows): buttons ≥44×44px, icon ≥20px, more
gap. No JS/markup change.

The component positions itself in its own CSS (`.camera-angle-controls` is
`position: fixed; bottom: 80px; left: 20px`) — `ThreeScene` renders it with no
positioning props — so repositioning stays entirely in `CameraAngleControls.css`
under the same `@media (pointer: coarse)` block: nudge it to a thumb-reachable
spot and enlarge the hit area. No JS change.

### 3. Finger-sized in-scene menus on mobile

- `DeviceHoverMenu.css`: bump `.dhm-btn` from 36px to ≥44px under
  `@media (pointer: coarse)`; keep 36px on desktop. (Buy 🛒 / Swap ⟳ / Remove ✕
  shipped earlier — they just need touch sizing.)
- Verify the ghost-spot tap target is forgiving on touch (raycast already works;
  only sizing/affordance is in scope — no placement-logic changes).
- Spot-check that `ProductSelectorModal` and `SceneVariantSwitcher` are usable
  at phone width; fix only sizing/overflow if broken. No structural redesign
  here — that's sub-project D.

## Out of scope

Mobile nav shell, design-token port, day theme, and per-screen responsive passes
(feed/profile/hub/editor) — separate sub-projects. No changes to placement
logic, scene geometry, or desktop input.

## Error handling / edge cases

- Pan clamps nothing new; OrbitControls already bounds target via existing
  config. Pinch + pan in the same gesture compose (zoom from distance ratio,
  pan from midpoint delta) — both applied per move.
- A two-finger gesture must never fire a tap-to-place: existing `isPinchingRef`
  (set when `activePointers.size === 2`, cleared 150ms after dropping below 2)
  already guards this; the pan extension reuses it.

## Testing

- Jest unit tests for `cameraPan.js` (pan scalars: zero delta → zero pan,
  larger camera distance → larger world pan, sign/axis correctness).
- Browser verification in the preview: emulate two pointers, drag both → assert
  `camera.position`/`controls.target` translate while orientation
  (`camera.quaternion`) stays fixed; emulate pinch → zoom still works; single
  tap on a ghost spot → device still places. Confirm at a phone viewport that
  camera buttons report ≥44px and the hover menu buttons ≥44px.
- Desktop guard: confirm a `pointer: fine` / desktop viewport still shows 28px
  camera buttons and desktop mouse pan/rotate is unchanged.
- Final feel-test by the user on a real phone (the only thing emulation can't
  fully judge).
