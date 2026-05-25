# Admin Ghost-Spot Editor — Design

**Date:** 2026-05-25
**Status:** Approved for planning

## Goal

Let signed-in admins edit the 3D builder's ghost placement squares directly in
the scene by right-clicking them:

1. **Move** a ghost square (numeric X / Y / Z / rotation panel).
2. **Remove** a ghost square.
3. **Add** a new ghost square adjacent to an existing one, choosing the suggested
   product type from a dropdown.

Edits are saved **globally** (all users see them) and stored **per scene
variant**.

## Audience / Authorization

- Gated by the Firebase `admin` custom claim — the same gate already used by
  `ProductDashboard.js` (`tokenResult.claims.admin === true`).
- Detected inside `ThreeScene.js` via `auth.currentUser.getIdTokenResult()`,
  stored in an `isAdmin` state.
- Non-admin users see **no behavior change** — no context menu, no editing.

## Persistence Model

New Firestore collection: **`ghostSpotLayouts`**.

- One document per scene variant, keyed `` `${setupType}__${settingKey}` ``.
  - DJ: `DJ__club`, `DJ__rooftop`
  - Producer: `Producer__studio`
  - Musician: `Musician__stage`, `Musician__guitarRoom`
- Variant identity comes from `currentSetupType` + `currentSetting` (the setting
  registry in `src/data/settings.js`).

Document shape:

```json
{
  "setupType": "DJ",
  "settingKey": "club",
  "spots": [
    {
      "id": "mixer-middle",
      "type": "middle",
      "recommendedType": "Mixer (DJM)",
      "x": 0, "y": 1.05, "z": 0,
      "rotationY": 0,
      "size": { "width": 0.3, "depth": 0.3 },
      "revealAfterBasic": false
    }
  ],
  "updatedAt": "<serverTimestamp>",
  "updatedBy": "<uid>"
}
```

**No data migration.** Until an admin saves a given variant, the app serves the
in-code default layout (identical to today's behavior). The first save "freezes"
the current defaults into the document.

## Components & Responsibilities

### 1. `src/utils/ghostSpotLayout.js` (new) — single source of truth

- `getDefaultLayout(setupType)` → returns the spot array currently hardcoded in
  `ThreeScene.js` (the `djSetupSpots` reveal subset, plus the Producer and
  Musician inline arrays), each normalized to:
  `{ id, type, recommendedType, x, y, z, rotationY?, size?, revealAfterBasic }`.
  `recommendedType` is seeded from the existing `getRecommendedProductType`
  mapping. This becomes the fallback when no Firestore doc exists.
- `SUGGESTION_OPTIONS` → union of every `recommendedType` label currently used
  across DJ / Producer / Musician, plus `"Any Device"`. Source for the add-spot
  dropdown. (Per-setup-type filtering of this list is explicitly deferred — a
  later enhancement.)
- `loadLayout(setupType, settingKey)` → reads the Firestore doc; returns its
  `spots` if present, else `getDefaultLayout(setupType)`.
- `saveLayout(setupType, settingKey, spots)` → upserts the doc with `updatedAt`
  (serverTimestamp) and `updatedBy` (current uid).

### 2. `src/ThreeScene.js` (modified)

- Add `isAdmin` state (resolved from `auth.currentUser.getIdTokenResult()` in the
  existing auth listener).
- Add `currentLayoutRef` holding the active variant's spot array.
- On setup-type / setting load, call `loadLayout(...)` into `currentLayoutRef`,
  then rebuild ghost spots from it.
- `createGhostPlacementSpots` iterates `currentLayoutRef.current` instead of the
  hardcoded `switch`. It applies the reveal filter
  `(!spot.revealAfterBasic || isBasicSetupCompleted)` so the DJ "FX spots appear
  after the mixer is placed" behavior is preserved. `recommendedType` is read
  directly from each stored spot.
- The inline `djSetupSpots` / Producer / Musician arrays move into
  `getDefaultLayout` (deleted from `ThreeScene` once `getDefaultLayout` is the
  source). `SPOT_TYPES` stays where it is and is reused by the default builder.
- Add a `contextmenu` event listener on the renderer canvas: raycast ghost
  spots; if `isAdmin` and a spot is hit, `preventDefault()` and open the admin
  context menu anchored at the cursor. Non-admins: no handler effect.

### 3. `src/components/GhostSpotContextMenu.js` + `.css` (new)

- HTML overlay styled after `DeviceHoverMenu.css`.
- Actions: **Move**, **Add adjacent**, **Remove**.
- Dismiss on Esc or outside click.

### 4. `src/components/GhostSpotEditorPanel.js` + `.css` (new)

- Numeric inputs: X, Y, Z, rotationY, plus width / depth, each with +/- nudge
  buttons (step ~0.05 for position, ~0.05 for size).
- Live-updates the target ghost square's transform in the scene as values change
  (no save required to preview).
- **Save** → updates `currentLayoutRef`, rebuilds ghost spots, calls
  `saveLayout`. **Cancel** → reverts to pre-edit values.
- **Add adjacent** reuses this panel pre-seeded with a copy of the clicked spot
  offset by ~0.4 units on X, plus a suggested-type `<select>` populated from
  `SUGGESTION_OPTIONS`. New spots receive a unique generated `type` of the form
  `custom-<shortid>` so saved setups continue to match placements by `spotType`.

## Edit Flows

- **Move:** context menu → editor panel (numeric) → live preview → Save persists.
- **Add adjacent:** context menu → editor panel pre-seeded from clicked spot +
  type dropdown → Save inserts the new spot and persists.
- **Remove:** context menu → confirm → drop spot from `currentLayoutRef`, rebuild,
  persist.

Every successful edit: update `currentLayoutRef` → `createGhostPlacementSpots`
re-run → `saveLayout`.

## Firestore Rules

Add to `firestore.rules`:

```
match /ghostSpotLayouts/{layoutId} {
  allow read: if isSignedIn();
  allow write: if isSignedIn() && request.auth.token.admin == true;
}
```

## Key Behaviors & Tradeoffs

- **Spot `type` is the placement identity.** Saved setups re-place devices by
  matching `device.spotType` to a spot's `type`. Moving a spot keeps its `type`.
  New spots get a unique `custom-<id>` type.
- **Remove impact = leave-as-is.** Removing a spot does not touch saved setups.
  An orphaned saved device simply won't auto-place on next load (it falls through
  existing fallback logic). This matches how the app already behaves when spot
  layouts change — zero migration risk.
- **Progressive reveal preserved** via the per-spot `revealAfterBasic` flag (DJ FX
  spots default `true`; everything else `false`).
- **No migration step.** Defaults are served until first save per variant.

## Out of Scope (deferred)

- Filtering `SUGGESTION_OPTIONS` per setup type (e.g. hiding "Mixer" in Musician).
- Drag-to-move in 3D (numeric panel only for now).
- Warning/among-saved-setups impact analysis on remove.
- Reordering / re-indexing spots beyond add/remove/move.
