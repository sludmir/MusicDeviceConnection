# Camera Angle Slots — Design Spec
**Date:** 2026-06-08

## Overview

Allow set builders to save up to 3 named camera angles per setup. Saved angles are persisted on the Firestore `setups` doc. When a setup is loaded, the camera auto-snaps to slot 1 (if saved). A bottom-left HUD lets users save and recall angles at any time during building.

---

## Data Model

The `setups` Firestore document gains one new optional field:

```js
cameraAngles: [
  { position: { x, y, z }, target: { x, y, z } },  // slot 1 (default view)
  { position: { x, y, z }, target: { x, y, z } },  // slot 2
  null,                                              // slot 3 (empty)
]
```

- Array of exactly 3 entries (indices 0–2, shown to users as 1–3).
- Each entry is either `{ position, target }` or `null` (empty/unset).
- Slot 0 is the **default view** — auto-snapped to on setup load.
- Old setups without `cameraAngles` fall back to `CAMERA_POSITIONS.default`.
- The existing `CAMERA_POSITIONS.set` and `CAMERA_POSITIONS.connections` presets are removed, along with the `cameraView` state that drives them.

---

## UI

A `CameraAngleControls` component renders bottom-left in the 3D builder. Three slots, each with two controls:

```
[ camera-icon ][ 1 ]   [ camera-icon ][ 2 ]   [ camera-icon ][ 3 ]
```

- **Camera icon button** (react-icons, e.g. `MdOutlineCameraAlt`) — saves the current `cameraRef.position` and `controlsRef.target` into that slot. Icon visually fills/highlights when the slot is occupied.
- **Number button** — recalls the saved angle with a smooth GSAP tween (matching existing `focusOnDevice` animation style). Greyed out and disabled when slot is empty.
- Angles update live in React state (`cameraAngles`) inside `ThreeScene`. They are persisted to Firestore only when the user clicks **Save Setup**.

---

## Setup Load Behaviour

When `ThreeScene` mounts with an existing setup that has `cameraAngles`:
1. After the scene initialises and devices load, check `setup.cameraAngles?.[0]`.
2. If non-null, GSAP-tween the camera to that position/target (same easing as `focusOnDevice`).
3. If null or absent, use `CAMERA_POSITIONS.default` as today.

---

## Components & File Changes

### New: `src/components/CameraAngleControls.js`
~80 lines. Props:
- `cameraAngles` — array of 3 (null or `{position, target}`)
- `onSave(slotIndex)` — called when user clicks the save icon for a slot
- `onRecall(slotIndex)` — called when user clicks a number button

### Modified: `src/ThreeScene.js`
- Add `cameraAngles` state: `useState([null, null, null])`, initialised from `setup.cameraAngles` on load.
- Add `onCameraAnglesChange` prop — callback fired whenever `cameraAngles` state changes, so `App.js` can pass it down to `SaveSetupButton`.
- Implement `handleSaveCameraAngle(slotIndex)` — reads `cameraRef.current.position` and `controlsRef.current.target`, updates `cameraAngles` state.
- Implement `handleRecallCameraAngle(slotIndex)` — GSAP tweens camera to stored position/target.
- Render `<CameraAngleControls>` bottom-left in the scene overlay.
- Remove `cameraView` state, `CAMERA_POSITIONS.set`, `CAMERA_POSITIONS.connections`, and all code referencing them.
- Auto-snap to slot 0 after scene init if available.

### Modified: `src/components/SaveSetupButton.js`
- Accept `cameraAngles` prop.
- Include `cameraAngles` in the Firestore `setupData` object at save time.

### Modified: `src/App.js`
- Hold `cameraAngles` in state (or pass as a ref callback).
- Pass `onCameraAnglesChange` to `ThreeScene` and `cameraAngles` to `SaveSetupButton`.

---

## Out of Scope
- Naming camera angles (just "1", "2", "3")
- Per-scene-variant camera defaults (future work)
- Mobile-specific angle restrictions
