# Setup Switcher Bar — Design Spec
**Date:** 2026-06-09

## Overview

Replace the existing `SceneVariantSwitcher` with a persistent bottom bar that lets users navigate between their saved setups and start new ones — without leaving the builder. Visible whenever the user has at least one saved setup.

---

## Goals

- Users can switch between all their saved setups (across DJ / Producer / Musician types) from within the builder
- Users can start a new setup without navigating back to the hub
- Unsaved progress is never silently lost — prompt to save before any navigation that would clear devices
- No extra popups for switching; switching is a single click on a tab
- Flexible as new setup types and scenes are added

---

## Component: `SetupSwitcherBar`

New component at `src/components/SetupSwitcherBar.js` + `SetupSwitcherBar.css`.

Replaces `SceneVariantSwitcher` entirely. Rendered in `App.js` inside the builder view (same location as the current switcher).

### Props

```js
{
  savedSetups,      // Array<{ id, name, setupType, setting?, devices? }> — user's saved setups (full Firestore doc)
  activeSetupId,    // string | null — currently loaded setup ID (null = new unsaved session)
  isDirty,          // boolean — unsaved changes exist in current session
  activeSetupName,  // string | null — name of the currently loaded setup (for save prompt)
  onSwitchSetup,    // (setup: { id, name, setupType, setting }) => void
  onNewSetup,       // () => void — opens NewSetupModal
  onSaveActive,     // () => void — triggers save flow for the current setup
}
```

### Visibility

Renders only when `savedSetups.length >= 1`. If the user has no saved setups, nothing is shown.

### Layout

Fixed bottom bar, `z-index` above the scene, below any mobile nav overlay.

```
┌─────────────────────────────────────────────────────────────────┐
│  [icon Name]  [icon Name ●]  [icon Name]  ...  [+ New Setup]   │
└─────────────────────────────────────────────────────────────────┘
```

- Tabs are horizontally scrollable if more than fit the bar width
- Active tab: accent-colored pill/underline highlight
- Dirty indicator: a small dot on the active tab when `isDirty` is true
- `[+ New Setup]` button pinned to the right end

### Type Icons (react-icons)

| setupType  | Icon             | Import                   |
|------------|------------------|--------------------------|
| DJ         | `MdHeadphones`   | `react-icons/md`         |
| Producer   | `MdPiano`        | `react-icons/md`         |
| Musician   | `FaGuitar`       | `react-icons/fa`         |

### Save Prompt

When the user clicks a tab (or New Setup) and `isDirty` is true, a small banner renders above the bar before the switch executes:

```
┌─────────────────────────────────────────────┐
│  Save "DJ Dojo Set" before switching?  [Save]  [Leave anyway]  │
└─────────────────────────────────────────────┘
```

- `[Save]` calls `onSaveActive`; **only on save success** does the pending switch execute. On save failure the banner stays visible and shows an error message ("Save failed — try again").
- `[Leave anyway]` proceeds immediately without saving
- Clicking outside **the banner** (not the whole bar) or pressing Esc cancels the pending switch and dismisses the banner. The outside-click listener is scoped to the banner element only to avoid a tab click being interpreted as an outside click.
- The pending switch target is held in local component state (`pendingSwitch: setup | null`) until resolved by save-success, leave, or cancel

### New Unsaved Session (no active tab)

When `activeSetupId` is `null` (user just started a new setup), no tab is highlighted. The `[+ New Setup]` button does not receive extra treatment — the blank active state is sufficient.

---

## Component: `NewSetupModal`

New component at `src/components/NewSetupModal.js` + `NewSetupModal.css`.

A centered modal overlay showing the same DJ / Producer / Musician type selection cards as the hub landing page. Opens when the user clicks `[+ New Setup]` in the bar (after any save prompt resolves).

### Props

```js
{
  onSelect,   // (setupType: 'DJ' | 'Producer' | 'Musician') => void
  onClose,    // () => void
}
```

The three cards match the hub landing page visually. Selecting a type calls `onSelect(setupType)` which triggers the same `handleNewSetupFromLanding` flow in App.js as if the user had clicked from the hub.

---

## Dirty Detection

### State

```js
const [setupLoadedDevices, setSetupLoadedDevices] = useState([]); // Firestore-shaped saved devices
const [setupLoadComplete, setSetupLoadComplete] = useState(true);  // false while models are loading
const [ghostSpotsModified, setGhostSpotsModified] = useState(false);
```

`setupLoadedDevices` holds the raw Firestore `devices` array (saved shape: `{ id, position, spotType, ... }`). It is set only on explicit load/switch/save events — never as a side-effect of the `onSnapshot` listener.

### Gating with `setupLoadComplete`

When a setup switch begins, `setupLoadComplete` is set to `false`. ThreeScene calls `onSetupLoadComplete` once all models for the incoming setup have finished hydrating. Only then does `setupLoadComplete` flip back to `true`. `isDirty` is computed as `false` while `setupLoadComplete` is false, preventing spurious dirty-true states during the async model load window.

```js
const isDirty = setupLoadComplete && (
  ghostSpotsModified ||
  computeIsDirty(actualDevices, setupLoadedDevices)
);
```

### `computeIsDirty`

`uniqueId` is not persisted to Firestore — it is generated at runtime as `` `${product.id}-${position.x}-${position.y}-${position.z}` ``. The saved Firestore device has `id` and `position`, so we reconstruct the expected `uniqueId` from the saved record and do a Set-based comparison (order-independent):

```js
function computeIsDirty(actualDevices, savedDevices) {
  if (actualDevices.length !== savedDevices.length) return true;
  const savedIds = new Set(
    savedDevices
      .filter(d => d.id && d.position)
      .map(d => `${d.id}-${d.position.x}-${d.position.y}-${d.position.z}`)
  );
  return actualDevices.some(d => !savedIds.has(d.uniqueId));
}
```

Set-based comparison removes the positional-order dependency entirely. Devices filtered without a valid `id + position` are excluded from the set (they cannot match and would falsely flag dirty; any such malformed record is a data integrity issue, not a dirty-detection concern).

### Ghost spot moves (admin-only)

`ghostSpotsModified` is reset to `false` on every setup load and every new-setup start. This ensures a non-admin session never carries a stale `true` from a prior admin session in the same app instance. ThreeScene calls `onGhostSpotsModified` only when the admin editor moves a spot for the first time in a session.

---

## App.js Changes

1. Add `setupLoadedDevices`, `setupLoadComplete`, `ghostSpotsModified` state
2. Set `setupLoadedDevices` and reset `ghostSpotsModified` to `false` on every setup load or new-session start; set `setupLoadComplete = false` at the same time
3. Pass `onSetupLoadComplete` to `<ThreeScene>`; App.js sets `setupLoadComplete = true` when it fires
4. Compute `isDirty` via `computeIsDirty` (see Dirty Detection section), gated behind `setupLoadComplete`
5. Fetch user's saved setups from Firestore with `onSnapshot` when authenticated; store in `savedSetups` state. **The snapshot listener never writes to `setupLoadedDevices`** — the baseline is only touched by explicit load/switch/save handlers.
6. Pass `savedSetups`, `activeSetupId` (`loadedSetupId`), `isDirty`, `activeSetupName` (`loadedSetupName`), `onSwitchSetup`, `onNewSetup`, `onSaveActive` to `<SetupSwitcherBar>`
7. Replace `<SceneVariantSwitcher .../>` render with `<SetupSwitcherBar .../>`
8. Render `<NewSetupModal>` when `showNewSetupModal` state is true

### `onSwitchSetup` handler

```js
function handleSwitchSetup(setup) {
  // Lock in the new baseline and gate dirty-detection before models start loading
  setSetupLoadedDevices(setup.devices || []);
  setSetupLoadComplete(false);
  setGhostSpotsModified(false);
  handleSetupSelectFromLanding(setup);
}
```

`setupLoadComplete` is set to `false` before `handleSetupSelectFromLanding` fires so no stale `isDirty` reads can occur during the async model-load window. ThreeScene calls `onSetupLoadComplete` when all models for the incoming setup have finished hydrating, which flips it back to `true`.

### Firestore fetch for `savedSetups`

```js
useEffect(() => {
  if (!user) return;
  const q = query(
    collection(db, 'setups'),
    where('ownerId', '==', user.uid),
    orderBy('createdAt', 'desc')
  );
  const unsub = onSnapshot(q, snap => {
    setSavedSetups(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
  return unsub;
}, [user]);
```

Uses `onSnapshot` so the bar updates immediately after a save without manual refresh. The composite index on `(ownerId, createdAt desc)` already exists in the project's Firestore configuration (documented in CLAUDE.md) — no new index needed.

---

## ThreeScene.js Changes

Two new props:

```js
onSetupLoadComplete: () => void      // called once all models for the current setup have loaded
onGhostSpotsModified: () => void     // called once when admin ghost editor moves a spot (first move only)
```

`onSetupLoadComplete` is called at the end of the device-loading loop (after the last `addProductToPosition` resolves). App.js uses it to flip `setupLoadComplete = true`, which unblocks dirty computation.

`onGhostSpotsModified` is called once per session when the admin moves a ghost spot for the first time. App.js sets `ghostSpotsModified = true` in response.

---

## What SceneVariantSwitcher Did (now removed)

`SceneVariantSwitcher` let users change the scene variant (e.g. Club → Dojo) within the current setup type while building. This capability is intentionally removed in this spec:

- When loading a **saved setup**, its `setting` field determines the scene — no per-session override needed.
- When starting a **new setup**, the `NewSetupModal` lets the user pick a type (DJ / Producer / Musician). The new setup defaults to the first scene for that type (e.g. DJ → Club Booth). The user can change the scene only by building, saving, then loading and re-saving with a different variant.

This is a known regression for new-setup scene selection. A per-setup in-session scene picker is tracked as a follow-up task and is explicitly out of scope here.

---

## File Changes Summary

| File | Change |
|------|--------|
| `src/components/SetupSwitcherBar.js` | New — persistent bottom bar with setup tabs, dirty indicator, save prompt |
| `src/components/SetupSwitcherBar.css` | New — bar, tab, save prompt styles |
| `src/components/NewSetupModal.js` | New — modal with DJ/Producer/Musician type cards |
| `src/components/NewSetupModal.css` | New — modal overlay styles |
| `src/App.js` | Add `savedSetups` fetch; add `setupLoadedDevices`, `setupLoadComplete`, `ghostSpotsModified` state; `computeIsDirty` helper; replace `SceneVariantSwitcher` with `SetupSwitcherBar`; add `NewSetupModal` render |
| `src/ThreeScene.js` | Add `onSetupLoadComplete` prop (called after last model loads); add `onGhostSpotsModified` prop (called on first admin ghost move) |
| `src/components/SceneVariantSwitcher.js` | Deleted (no longer used) |
| `src/components/SceneVariantSwitcher.css` | Deleted |

---

## Out of Scope

- Changing a setup's scene variant mid-session (follow-up task)
- Reordering setup tabs
- Archiving / deleting setups from the bar (use MySets screen)
- Animated tab transitions
