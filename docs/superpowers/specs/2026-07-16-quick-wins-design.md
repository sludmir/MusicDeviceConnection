# Quick Wins: Glass Relink Button, Badge Removal, Scene Sidebar Entry

**Date:** 2026-07-16
**Status:** Approved

Three small, independent UI improvements bundled into one branch.

## 1. Remove "New" badge from Multi-angle edit card

The multi-angle edit CTA carries a `New` sticker in two places:

- `src/components/CreateHub.js:86` (mobile create hub)
- `src/components/HubLandingPage.js:302` (desktop hub)

**Change:** delete the `<span className="hub-post-card__badge">New</span>` from both,
and remove the now-unused `.hub-post-card__badge` rule from
`src/components/HubLandingPage.css`. (The visually distinct
`.hub-post-locked__badge` CREATOR chip is unrelated and stays.)

## 2. Glass "Change linked setup" button on Profile

Each set card on the owner's Profile SETS tab has two relink controls:

- `.profile-set__relink` — small dark icon button on the thumbnail. **Unchanged.**
- `.profile-set__change-setup` — underlined text link under the card meta
  (`src/components/Profile.js:489`, styles at `src/components/Profile.css:310`).

**Change (CSS-only):** restyle `.profile-set__change-setup` into a glass pill:

- Translucent background + `backdrop-filter: blur(...)` (with `-webkit-` prefix).
- 1px `var(--border)` border, pill radius, small padding (`--space` tokens).
- Label in `var(--text)`; hover shifts border/text toward `var(--primary)`.
- Tokens only — must look right in both dark and light themes.

No markup or handler changes.

## 3. "Scene" entry in the desktop sidebar

### Decision

Approach chosen: **make `/builder` the Scene destination** (over a
sidebar-triggered modal with event plumbing). Scene becomes a real nav item with
an active state, and `/builder` no longer bounces to `/hub` when no setup is
loaded — refresh and deep-link now land on a usable chooser instead.

### Nav item

Add to `NAV_ITEMS` in `src/routes/NavConfig.js`:

```js
{ path: "/builder", label: "Scene", icon: MdViewInAr, mobileHidden: true }
```

Sidebar is desktop-only; `mobileHidden` keeps it off the bottom tab bar.
Position: after Feed, before Search.

### Builder route: no-setup state

In `src/App.js`, replace the `/builder` route's `<Navigate to="/hub" replace />`
fallback (currently at the `selectedSetup ? ... : ...` branch, ~line 653) with an
empty-scene state rendered inside the same `.builder-page` / `.builder-stage`
frame:

- Centered placeholder: "No setup loaded" + a **Choose setup** button.
- `SetupChooserModal` opens automatically on arrival; closing it returns to the
  placeholder (the button reopens it). No forced redirect.
- When `selectedSetup` is truthy, the route renders exactly as today — the popup
  never appears over a loaded scene.

### New component: `SetupChooserModal`

`src/components/SetupChooserModal.js`, built from `ui` `Modal` + `Card`.
Step-based flow, state local to the component:

1. **Choice step:** two cards — "New setup" and "Edit existing".
2. **New setup →** type cards (DJ / Producer / Musician, reusing the
   `hub-type-card` pattern from CreateHub) → if `hasMultipleSettings(type)`,
   a setting-picker step (same cards as CreateHub's in-modal picker) → calls
   `onNewSetup(type, settingKey)` (App's existing `handleNewSetupFromLanding`).
3. **Edit existing →** fetch the signed-in user's setups
   (`setups` where `ownerId == uid`, `createdAt` desc — same query Profile
   uses), listed with `previewImageURL` thumbnail + name → calls
   `onSetupSelect(setup)` (App's existing `handleSetupSelectFromLanding`).

Both handlers already `navigate('/builder')`; since we're already there, the
navigation is a no-op and the scene loads in place.

**Error/empty handling:**

- Setups fetch failure → toast error, modal shows an inline error state.
- No saved setups → "No saved setups yet" empty state pointing at New setup.
- Signed-out users never reach this (app routes require auth).

## Out of scope

- No changes to the mobile bottom tab bar or the mobile builder chrome.
- No changes to the thumbnail relink icon button.
- No changes to ThreeScene or setup persistence.

## Verification

Manual, on the dev server (signed-in Chrome — setups list requires auth):

1. Hub (desktop) + Create (mobile viewport): "New" badge gone from
   Multi-angle edit card; layout intact.
2. Profile SETS tab: glass pill renders in dark and light themes; relink flow
   still opens the picker modal.
3. Sidebar: Scene item shows, active on `/builder`.
4. Scene click with nothing loaded → empty stage + popup; all three paths
   (new setup, edit existing, cancel → placeholder → reopen) work.
5. Scene click with a setup loaded → straight to the live scene, no popup.
6. Refresh on `/builder` with no setup → chooser, not a bounce to `/hub`.
