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

- `[Save]` calls `onSaveActive`; on success, proceeds with the pending switch
- `[Leave anyway]` proceeds immediately without saving
- Clicking outside the banner or pressing Esc cancels the switch and dismisses the banner
- The pending switch target is held in local component state (`pendingSwitch`) until resolved

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

App.js tracks `setupLoadedDevices` — a snapshot of the `actualDevices` array taken when:
- A saved setup is loaded (`handleSetupSelectFromLanding`)
- A new setup is started (`handleNewSetupFromLanding`) — snapshot is `[]`

```js
const [setupLoadedDevices, setSetupLoadedDevices] = useState([]);
```

`isDirty` is derived:
```js
const isDirty = actualDevices.length !== setupLoadedDevices.length ||
  actualDevices.some((d, i) => d.uniqueId !== setupLoadedDevices[i]?.uniqueId);
```

Simple length + id comparison is sufficient — no deep equality needed. Order is stable (devices are appended, not reordered).

Ghost spot moves (admin-only) are tracked via an existing `ghostSpotsModified` boolean passed up from `ThreeScene`. If `ghostSpotsModified` is true, `isDirty` is also true.

---

## App.js Changes

1. Add `setupLoadedDevices` state; set it when a setup is loaded or new session starts
2. Compute `isDirty` from `actualDevices` vs `setupLoadedDevices` (+ `ghostSpotsModified`)
3. Fetch user's saved setups from Firestore when authenticated and in builder view; store in `savedSetups` state
4. Pass `savedSetups`, `activeSetupId` (`loadedSetupId`), `isDirty`, `activeSetupName` (`loadedSetupName`), `onSwitchSetup`, `onNewSetup`, `onSaveActive` to `<SetupSwitcherBar>`
5. Replace `<SceneVariantSwitcher .../>` render with `<SetupSwitcherBar .../>`
6. Render `<NewSetupModal>` when `showNewSetupModal` state is true

### `onSwitchSetup` handler

```js
function handleSwitchSetup(setup) {
  // Set the dirty baseline to what is saved in Firestore for this setup
  // (setup.devices comes from the full onSnapshot doc spread)
  setSetupLoadedDevices(setup.devices || []);
  handleSetupSelectFromLanding(setup);
}
```

`setSetupLoadedDevices` is called before `handleSetupSelectFromLanding` so the baseline is locked in before `actualDevices` begins updating as 3D models load.

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

Uses `onSnapshot` so the bar updates immediately after a save without manual refresh.

---

## ThreeScene.js Changes

Expose `ghostSpotsModified` to the parent:

```js
// New prop
onGhostSpotsModified: () => void
```

Called once when the admin ghost spot editor moves a spot for the first time in a session. App.js sets a `ghostSpotsModified` boolean in response and includes it in the `isDirty` calculation.

---

## What SceneVariantSwitcher Did (now removed)

`SceneVariantSwitcher` let users change the scene variant (e.g. Club → Dojo) within the current setup type. This is now out of scope: a setup's scene variant is set at creation and changed by editing + re-saving. A per-setup scene variant picker can be added as a follow-up if needed.

---

## File Changes Summary

| File | Change |
|------|--------|
| `src/components/SetupSwitcherBar.js` | New — persistent bottom bar with setup tabs, dirty indicator, save prompt |
| `src/components/SetupSwitcherBar.css` | New — bar, tab, save prompt styles |
| `src/components/NewSetupModal.js` | New — modal with DJ/Producer/Musician type cards |
| `src/components/NewSetupModal.css` | New — modal overlay styles |
| `src/App.js` | Add `savedSetups` fetch + state; add `setupLoadedDevices` state; compute `isDirty`; replace `SceneVariantSwitcher` with `SetupSwitcherBar`; add `NewSetupModal` render |
| `src/ThreeScene.js` | Add `onGhostSpotsModified` prop; call it when admin moves a ghost spot |
| `src/components/SceneVariantSwitcher.js` | Deleted (no longer used) |
| `src/components/SceneVariantSwitcher.css` | Deleted |

---

## Out of Scope

- Changing a setup's scene variant mid-session (follow-up task)
- Reordering setup tabs
- Archiving / deleting setups from the bar (use MySets screen)
- Animated tab transitions
