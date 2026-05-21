# Builder Navigation & Scene Variants — Design

**Date:** 2026-05-14
**Scope:** Set builder UX upgrades — device hover menu, spot-aware product selector, multi-scene variants per setup type.

## Goals

1. Make placed devices directly interactive (remove / swap) without a separate panel.
2. Cut visual clutter in the product selector by hard-filtering to the clicked spot's `recommendedType`.
3. Make scenes feel intentional and varied — start with one new variant per setup type.

## Non-Goals

- Refining scene aesthetics beyond the first pass for each new variant (iterate later).
- More than one new variant per setup type in this iteration.
- Mobile-specific layout work beyond touch-target sizing.
- Reworking the mini-profile panel.

---

## Feature 1 — Device Hover Menu

### Interaction

- **Hover (desktop):** raycast against placed device meshes. On hit, apply an emissive rim highlight to the device's meshes (reuse the category-glow approach already in `ThreeScene.js`: blue `0x00a2ff`, low intensity ~0.35). Cursor switches to `pointer`. On leave, restore original material state.
- **Click (or tap on mobile):** open a small HTML action menu anchored above the device. The anchor point is the device model's projected bounding-box top-center, recomputed each frame the menu is open (so it follows camera orbits).
- **Menu contents:** exactly two icon buttons.
  - **✕ Remove** — calls existing `removeDevice(uniqueId)`.
  - **⟳ Swap** — opens the reworked product selector modal (Feature 2) in *swap mode* for this device's spot.
- **Dismiss:** click empty space, press `Esc`, or click the same device again.
- **Mobile:** no hover; tap opens the menu. Hit targets ≥ 36px.
- **Coexistence with mini-profile:** clicking a device still opens the mini-profile as today. The hover action menu is a separate overlay sitting near the model. (If this turns out to be noisy in practice, we can move mini-profile behind an "info" button later — out of scope here.)

### Swap flow

When **⟳ Swap** is pressed for a device at `uniqueId`:
1. Record the device's `spotType`, `placementIndex`, world position, and current product id.
2. Open the product selector modal in swap mode (Feature 2), pre-filtered for that spot's `recommendedType`.
3. On selection of a new product:
   - Remove the old device via `removeDevice(uniqueId)`.
   - Place the new product at the same ghost spot (existing `addProductToPosition` path).
4. On cancel: no changes.

### Removed UI

- Bottom-right **"Current Setup"** panel that lists placed devices. The hover menu fully replaces its remove function; the panel's other affordances were not load-bearing.

### Implementation notes

- New component: `src/components/DeviceHoverMenu.js` + `DeviceHoverMenu.css`. Receives `{ device, screenPosition, onRemove, onSwap, onClose }`.
- Hover highlight: reuse the existing emissive-save/restore pattern used by category glow (`ThreeScene.js` lines ~4227–4259). Apply per-mesh on hover-in, restore on hover-out.
- Anchor projection: project `model.position + (boundingBox.max.y * 0.5)` to screen space each render frame while the menu is open.
- Raycast: add a hover raycaster reading from existing `pointermove` handler (`ThreeScene.js:1404`) and `placedDevicesListRef.current`. Throttle to render-frame cadence — avoid per-mouse-move work.

---

## Feature 2 — Reworked Product Selector Modal

### Behavior

- When the modal opens **from a ghost spot click** or **from device swap**:
  - Read `recommendedType` from the spot's `userData`.
  - Apply a **hard filter**: show only products where `isProductRecommended(product, recommendedType)` is true.
  - Header reflects context: `"Choose a {recommendedType}"` (e.g., "Choose a Mixer", "Choose Effects Pedal"). For `recommendedType === 'Any Device'` or `'Instrument or Effects'`, fall back to the existing recommendation sort with no hard filter.
- **"Show all products" toggle** at the top of the modal (off by default). When enabled, drops the hard filter and falls back to the existing `sortProductsByRecommendation` ordering.
- **Search input** stays. It filters within the currently visible set (filtered or full).
- **Swap mode** indicator: when opened via swap, the current device's product appears at the top of the grid with a "Current" badge; selecting it is a no-op (closes the modal).

### Implementation notes

- Extract the modal currently rendered inline in `ThreeScene.js` (around line 4664+) into `src/components/ProductSelectorModal.js` + `ProductSelectorModal.css`. Props: `{ isOpen, mode: 'place' | 'swap', recommendedType, currentProductId?, onSelect, onClose }`.
- Reuse `isProductRecommended` and `sortProductsByRecommendation` (already in `ThreeScene.js`) — move them with the modal or export them via a shared util `src/utils/productRecommendation.js`.
- No Firestore schema change.

---

## Feature 3 — Scene Variants

### Variants (one new per setup type)

| Setup type | Variant A (existing) | Variant B (new) | Variant key |
|---|---|---|---|
| DJ | Club booth | **Rooftop** — concrete patio floor, low parapet wall, distant skyline silhouette plane, blue-sky skybox with soft drifting cloud planes, daylight + warm rim light | `dj-club` / `dj-rooftop` |
| Producer | Studio desk + racks | **Bedroom Studio** — warm tungsten lamp, acoustic foam panels on back wall, soft daylight window, rug under desk, plant, wood floor | `producer-studio-desk` / `producer-bedroom` |
| Musician | Rehearsal room | **Live Stage** — wooden stage platform, backdrop curtain or brick, side wedge monitors, edge LED strip, warm PAR cans, mic stands with coiled cables | `musician-rehearsal` / `musician-live-stage` |

### Constraints

- Variants are **purely visual**. They must not alter:
  - Ghost spot positions or `recommendedType`s.
  - Table/booth dimensions (`scene unit = 400mm` reference; DJ booth `PlaneGeometry(6, 1.4)` at `y: 0.95`).
  - Device placement logic.
- Only the environment geometry, lighting, materials, and skybox change between variants.

### Switcher UI

- Bottom-center **upward dropdown** placed where the removed `SetupTimeline` lived. Component: `SceneVariantSwitcher`.
- Closed state: pill button labeled `Scene: {variantLabel} ▴`.
- Expanded state: options stack **upward** above the button (so the list grows away from the bottom edge). Each option is `[thumbnail or icon] + label`. Click selects.
- Only shows variants for the **current setup type** (no DJ variants when in Producer mode).

### Persistence

- Add `sceneVariant: string` to the `setups` Firestore doc. Values are the keys in the table above.
- On setup load: read `sceneVariant` and apply. Legacy setups without the field default to Variant A.
- Save flow: include the current `sceneVariant` in `SaveSetupButton`'s payload.
- Switching variants for an in-progress unsaved setup updates local state only.

### Removed UI

- **`SetupTimeline.js`** bottom category bar (Instruments / Amplifiers / Effects / etc.) and its category-highlight glow feature. The hover menu + spot-aware selector replace navigation needs; category glow is not retained.

### Implementation notes

- Extract scene building into `src/scenes/` with one module per `(setupType, variant)`:
  - `djClub.js`, `djRooftop.js`
  - `producerStudioDesk.js`, `producerBedroom.js`
  - `musicianRehearsal.js`, `musicianLiveStage.js`
  - Each exports `build(scene): SceneHandle` and a `dispose()` on the handle for cleanup of geometry/materials/textures.
- `createClubEnvironment` becomes a dispatcher: `buildEnvironment(scene, setupType, variant)`.
- Shared metadata: `src/utils/sceneVariants.js` exports `VARIANTS_BY_SETUP` mapping setup type → ordered list of `{ key, label, build }`.

---

## Data Model Changes

`setups` document gains one optional field:

```
sceneVariant?: string  // e.g., "dj-rooftop"
```

No migration required — legacy setups read as Variant A by default.

No changes to `products`, `sets`, `clips`, or `users`.

---

## File Plan

**New files:**
- `src/components/DeviceHoverMenu.js` / `.css`
- `src/components/ProductSelectorModal.js` / `.css`
- `src/components/SceneVariantSwitcher.js` / `.css`
- `src/scenes/djClub.js`, `djRooftop.js`
- `src/scenes/producerStudioDesk.js`, `producerBedroom.js`
- `src/scenes/musicianRehearsal.js`, `musicianLiveStage.js`
- `src/utils/sceneVariants.js`
- `src/utils/productRecommendation.js` (optional — only if extraction is clean)

**Modified files:**
- `src/ThreeScene.js` — wire hover/menu raycasting, swap flow, scene dispatcher; remove the bottom-right Current Setup panel and the inline product selector modal.
- `src/App.js` — remove `SetupTimeline` from the layout; thread `sceneVariant` through state.
- `src/components/SaveSetupButton.js` — include `sceneVariant` in save payload.

**Removed files:**
- `src/SetupTimeline.js` and any CSS specific to it (verify no other consumers first).

---

## Risks & Open Questions

- **Hover menu vs. mini-profile click conflict** — both fire on click. Solution: hover menu opens on click and contains its own buttons; mini-profile continues to open. Verify in-engine that the overlay positioning doesn't visually overlap the mini-profile panel; if it does, offset the menu.
- **`ThreeScene.js` size** — already 4865 lines. The extractions here should net-reduce its size; do not let new logic land inside `ThreeScene.js` if a component or scene module can hold it.
- **Scene module cleanup correctness** — each variant must fully dispose its geometry/materials/textures on switch to avoid GPU leaks during repeated swaps.
- **Performance** — Rooftop skybox + clouds and Live Stage lighting must stay light (<500 extra draw calls). Use baked textures over real-time effects.

---

## Acceptance

- Hovering a placed device shows a blue rim highlight; clicking it shows a 2-button overlay (✕, ⟳) that follows the camera.
- ✕ removes the device; ⟳ opens the selector modal pre-filtered to the spot's recommended type with the current device marked.
- Clicking a ghost spot opens the selector modal hard-filtered to that spot's `recommendedType`, with a "Show all products" toggle.
- The bottom SetupTimeline and bottom-right Current Setup panel are gone.
- Each setup type offers two scene variants in a bottom-center upward dropdown.
- Saving a setup persists the chosen variant; loading restores it; legacy setups load with Variant A.
