# LiveSet Redesign — Design Spec

**Date:** 2026-04-28
**Status:** Approved for implementation planning
**Scope:** Full visual redesign of the LiveSet web app — design system, navigation, page layouts, and the 3D builder HUD. No new features.

---

## 1. Goals & Non-Goals

### Goals
- Replace the current ad-hoc styling with a coherent, professional design system that makes LiveSet read as a real product instead of a vibe-coded prototype.
- Establish reusable primitives so future work is consistent by default.
- Introduce real routing and a persistent navigation shell.
- Upgrade the 3D builder to a true "instrument" UI.
- Each phase ships independently — no big-bang merge.

### Non-Goals
- Light mode (deferred — tokens designed to allow it later).
- New product features. This is purely a redesign.
- Mobile-app parity. `/mobile/` (Expo) is out of scope.
- Comments system overhaul.
- Backend / Firestore schema changes.

---

## 2. Aesthetic Direction

Hybrid of minimal Swiss/Linear-style discipline and pro-audio darkness, with warm cream/bone secondary surfaces and a sand/beige accent for warmth. True dark canvas, restrained ornamentation, instrument-like rhythm. Hierarchy from surface tone and type, not shadows.

---

## 3. Design Tokens

Implemented as CSS custom properties on `:root`. Live in `src/ui/tokens.css` (new), imported once from `src/index.css`.

### Color
| Token | Value | Use |
|---|---|---|
| `--bg` | `#0A0908` | App background (true black, faintly warm) |
| `--surface-1` | `#141210` | Cards, sidebar, top bar |
| `--surface-2` | `#1C1916` | Raised: modals, popovers, selected states |
| `--border` | `#2A2622` | 1px hairlines |
| `--border-strong` | `#3A342E` | Focus rings, active dividers |
| `--text` | `#F5EFE3` | Primary text & primary button background (cream/bone) |
| `--text-muted` | `#A89F90` | Secondary text |
| `--text-dim` | `#6B6358` | Tertiary / disabled |
| `--accent` | `#D9C2A0` | Active/selected/hover, key brand moments (sand) |
| `--accent-strong` | `#C9A77C` | Pressed states |
| `--danger` | `#C8553D` | Destructive actions only (terracotta) |
| `--success` | `#8FA66E` | Confirmations, never primary (muted olive) |

### Typography
- **UI/Body:** `Inter` (400 / 500 / 600), `-apple-system` fallback. Self-hosted via `@fontsource/inter`.
- **Technical labels:** `JetBrains Mono` (500), uppercase, +0.06em tracking. Used for BPM, durations, port counts, category tags, setup-type labels, timestamps, mono micro labels above inputs and on chips.
- **Scale (rem):** `0.6875` (mono micro), `0.8125` (small), `0.9375` (body), `1.0625` (lg), `1.375` (xl/section), `1.875` (2xl), `2.5` (display, used sparingly).
- **Line-height:** `1.5` body, `1.2` headings, `1` mono labels.

### Spacing (4px base)
`4 / 8 / 12 / 16 / 20 / 24 / 32 / 48 / 64 / 96` (tokens `--space-1` through `--space-10`).

### Radius
`2` chips/inputs, `6` buttons/cards, `10` modals, `0` rails/bars. No large radii.

### Elevation
Near-invisible shadows: `0 1px 0 rgba(0,0,0,0.4)` for subtle separation. Hierarchy comes from surface tone.

### Motion
- `120ms` micro (hover/press)
- `200ms` standard (panel state changes)
- `320ms cubic-bezier(0.2, 0.8, 0.2, 1)` for sheets/screens
- No bouncy springs.

---

## 4. Shared Primitives

All in `src/ui/`. Each is a small, focused component that consumes tokens.

| Component | Notes |
|---|---|
| `Button` | Variants: `primary` (cream bg, black text), `secondary` (transparent, border, cream text), `ghost` (no border, hover surface-1), `danger` (terracotta border + text). Sizes `sm/md/lg`. Icon-only variant. Loading state with spinner. |
| `IconButton` | Square, ghost by default. For headers/toolbars. |
| `Input` / `Textarea` / `Select` | Surface-2 background, hairline border, sand focus ring. Mono uppercase labels above. Help text dim, error text terracotta. |
| `Card` | Surface-1, hairline border, radius 6, padding 16/24. Hover lifts border to `--border-strong`. |
| `Modal` (centered dialog) | 480px max, surface-2, radius 10, dim backdrop `rgba(0,0,0,0.6)`. Header (title + close), body, footer (cancel + primary). For confirms/rename. |
| `Sheet` (full-screen takeover) | 100vw/100vh on mobile; 1080px max-width centered with backdrop on desktop. Slide-up 320ms. Own top bar (close left, title center, primary action right). For PostSet, ProductManager, Profile edit. |
| `Tabs` | Underline style, mono uppercase labels, sand active underline. |
| `Chip` | Small pill, surface-2, mono micro text. For gear chips, category tags, BPM/duration. Clickable variant has hover. |
| `Avatar` | 24/32/48/64/96. Circle, surface-2 fallback with initials in mono. |
| `Toast` | Bottom-center, surface-2, hairline border, 3s auto-dismiss. Sand for success, terracotta for error. Replaces ad-hoc alerts. |
| `EmptyState` | Centered: mono uppercase eyebrow + Inter heading + dim subcopy + primary CTA. |
| `SectionHeader` | Mono uppercase eyebrow + optional Inter title + optional right-aligned action link. |

---

## 5. Navigation Shell

### Routing
Migrate from `currentView` state to React Router:
`/hub`, `/feed`, `/sets`, `/profile/:id?`, `/builder/:setupId?`, `/search`, `/notifications`, `/settings`, `/preferences`, `/admin/products` (admin only).

Real URLs, browser back, deep links.

### Desktop (≥1024px) — Left sidebar
- Fixed, 240px expanded / 64px collapsed. User-toggleable, persisted in `localStorage` (`liveset-sidebar-collapsed`).
- Top: wordmark "LiveSet" (Inter 600, +1px tracking) → Hub.
- Items (icon + label): Hub · Feed · My Sets · Search · Notifications · Profile.
- Active: cream text, 3px sand left-border accent, surface-1 background.
- Inactive: muted text, hover lifts to surface-1.
- Bottom: avatar + display name → user menu (Settings, Preferences, Sign out, Admin if admin claim).
- Notification dot uses sand on the icon.

### Mobile (<1024px) — Bottom tab bar
- 64px tall, surface-1, hairline top border.
- 5 tabs: Hub · Feed · Search · Notifications · Profile. (My Sets accessed inside Hub on mobile.)
- Active: cream icon + mono label, 2px sand top accent. Inactive: dim icon, no label.
- Page-specific top app bars appear inside individual pages, not globally.

### Builder mode
Sidebar/tab bar hidden. Builder owns the viewport with its three-zone HUD.

---

## 6. Page Designs

### 6.1 Hub (`/hub`) — Default landing screen
Single scroll, max-width 1200px. Sections separated by `--space-9` (48px).

1. **Continue** — If a recent in-progress setup exists: full-width card with 3D thumbnail (left), name + mono "last edited" timestamp (right), `Resume` primary. Otherwise, a "Start Building" empty-state with three setup-type tiles (DJ / Producer / Musician).
2. **From people you follow** — `SectionHeader` "RECENT FROM YOUR FOLLOWS". Horizontal scroll of set tiles (thumbnail, creator + title, mono duration chip). Click → opens that set in `LiveSetPlayer` sheet or jumps to it in Feed.
3. **Your setups** — `SectionHeader` "YOUR SETUPS" with "View all →" link to `/sets`. Grid (3 / 2 / 1 cols), max 6 cards. Each: 3D thumbnail, name, setup-type chip, device count.

First-time user: full-page onboarding with three setup-type tiles, no follows section.

### 6.2 My Sets (`/sets`)
Tabs: **Setups** | **Sets**. Filter row: setup-type chips (All / DJ / Producer / Musician). Card grid. Kebab menu per card (Rename, Set as main, Delete with confirm `Modal`).

### 6.3 Profile (`/profile/:id?`) — `:id` omitted = own
**Desktop two-column:**
- Left (sticky, 320px): avatar 96px, display name (Inter 600, 1.375rem), follower/following counts (mono), Follow/Unfollow primary (or Edit Profile if own), bio if present, divider, **Fave Product** mono label + interactive 3D viewer (~280×280, orbit controls, name + brand below).
- Right (fluid): tabs `SETS / SETUPS / LIKED`. Card grid. Pagination/infinite scroll.

**Mobile:** stacks. Identity card on top; fave product collapses to a small thumbnail or full-width below tabs.

### 6.4 Search (`/search`)
Single full-width input (large). Tabs underneath: **People** | **Gear**. Vertical list:
- People: avatar + name + follower count + Follow button.
- Gear: image + name + brand + category chip + mono price.

### 6.5 Notifications (`/notifications`)
Vertical list, grouped by day (`TODAY`, `YESTERDAY`, `EARLIER` mono section headers). Row: 32px avatar, sentence text (`**Jane** liked your set _Berghain warmup_`), mono timestamp right. Unread = subtle sand left-border accent. "Mark all read" top-right.

### 6.6 Settings & Preferences (`/settings`, `/preferences`)
Single column, 640px max. Sectioned with `SectionHeader`s. New input system. Save button sticky bottom-right of section. Replaces current ad-hoc forms.

### 6.7 Feed (`/feed`)
**Mobile:** full-viewport vertical scroll, snap, autoplay/pause on scroll (preserves current behavior). Overlay restyled:
- Bottom-left: creator avatar + name + compact follow button. Below: title (Inter 500), gear chips row (mono uppercase, horizontally scrollable), `Copy Setup` and `Full Set` ghost buttons.
- Right rail overlay: like / comment / share icon buttons stacked, mono counts. Sand accent on liked state.
- Top: hairline progress bar for clip range. Audio sync indicator if separate audio track.

**Desktop:** split layout, max-width 1200px, centered.
- **Left (fluid, max ~520px):** video at natural vertical aspect, radius 10, surface-1 letterbox if needed. Vertical scroll between clips here (mouse wheel + arrow keys + j/k).
- **Right (~440px, sticky):** metadata panel:
  - Creator row (avatar + name + Follow).
  - Title (Inter 600, 1.375rem).
  - Description if present.
  - **Gear used** — `SectionHeader`. Clickable gear chips → product detail mini-sheet (image, specs, "Used in N other sets" link).
  - **Linked setup** card (name + type + `Copy Setup`).
  - Actions: Like / Comment / Share with mono counts.
  - `Watch Full Set` secondary → opens `LiveSetPlayer` sheet.

Comments behavior unchanged in this redesign.

### 6.8 Builder (`/builder/:setupId?`) — Three-zone HUD
Sidebar/tab bar hidden. Scene fills viewport.

**Top bar (48px, surface-1, hairline bottom)**
- Left: setup name (Inter 500, click to rename inline) + setup-type chip (mono).
- Right: `Save` (primary if dirty, ghost if clean), `Share` (ghost), `Exit` (ghost; confirm if dirty).

**Left rail (72px, surface-1, hairline right, icon-only with tooltip)**
- Top: setup-type icon (read-only).
- Then: device categories driven by current `SetupTimeline` data. Each is an icon button with mono count badge. Click filters/highlights category in scene + opens category browser side panel.
- Bottom (separated by hairline): tools — Recenter camera, Toggle ghost spots, Toggle cables, Snapshot.

**Bottom-center contextual action bar (rises 24px from bottom, pill, surface-2, hairline border, fits content)**
- **No selection:** `+ Add device` primary → opens search/add Sheet from right (scene stays visible).
- **Ghost spot hovered:** spot's recommended type (mono) + `Add to [spot]` primary.
- **Device selected:** device name (Inter 500) + brand/type chip (mono) + actions: `Rotate`, `Duplicate`, `View specs` (product detail mini-sheet), `Remove` (danger, inline confirm). Replaces current mini-profile popup.

**Category browser side panel** (triggered by left-rail category icon)
- Slides in from rail (320px, surface-1).
- Search input top, sorted product list (uses existing `sortProductsByRecommendation`).
- Row: small image, name, brand, mono price + recommended-type tag.
- Click → product prepped for placement; valid ghost spots glow sand.
- Esc / outside-click closes.

**Mobile builder**
- Top bar condensed (40px), name truncates.
- Left rail becomes bottom sheet triggered by single FAB labeled with current category icon.
- Contextual action bar full-width sticky bottom.
- Pinch/drag gestures preserved from current `MobileNavigation`.

---

## 7. Rollout Phases

Each phase is independently shippable.

### Phase 1 — Foundation
- Add `src/ui/tokens.css` (CSS custom properties). Import from `src/index.css`.
- Wire up `Inter` and `JetBrains Mono` (`@fontsource`).
- Build `src/ui/` primitives: Button, IconButton, Input, Textarea, Select, Card, Modal, Sheet, Tabs, Chip, Avatar, Toast, EmptyState, SectionHeader.
- Replace ad-hoc `alert()` calls with Toast.
- Ship — visually unchanged, but the kit is ready.

### Phase 2 — Navigation shell + routing
- Add React Router.
- Build `Sidebar`, `BottomTabBar`, `AppShell`.
- Migrate `currentView` switching to routes (App.js shrinks substantially).
- Builder route hides shell.
- Ship — structural feel of a real product.

### Phase 3 — Hub + My Sets + Profile + Settings
- Redesign Hub as new dashboard.
- Redesign My Sets as tabbed grid.
- Redesign Profile as two-column with sticky identity & fave product viewer.
- Settings & Preferences migrated to new primitives.
- Ship.

### Phase 4 — Feed redesign
- Mobile overlay polish + new chip/button system.
- Desktop split layout with metadata panel.
- Clickable gear chips → product detail mini-sheet.
- Ship.

### Phase 5 — Builder HUD
- New top bar, left rail, bottom-center contextual action bar.
- Migrate `SetupTimeline` → left rail.
- Migrate mini-profile popup → bottom-center actions.
- Restyle search/add modal as right-side Sheet.
- Ship — biggest user-visible upgrade lands last.

### Phase 6 — Sweep & retire
- Migrate remaining ad-hoc styles (ProductManagerForm, ProductDashboard, PostSetModal, Upload) onto primitives.
- Delete unused legacy files identified in CLAUDE.md (AudioCableLogic.js, ConnectionPanel.js, DeviceDisplay.js, ModelViewer.js, ProductForm.js, ProductSubmissionForm.js, deviceLibrary.js, root-level liveset_product_dimensions.json, completed migration scripts).
- Ship.

---

## 8. Risks & Constraints

- **`ThreeScene.js` is ~4600 lines.** The builder HUD work (Phase 5) requires extracting top-bar / rail / action-bar concerns out of `ThreeScene` into sibling components that communicate via well-defined props/refs. Internal scene logic (placement, cables, raycasting) stays in `ThreeScene`; only chrome moves out.
- **`App.js` (~800 lines)** shrinks substantially in Phase 2 once routing handles view switching.
- **Mobile gesture handling** in the builder must be preserved exactly during HUD migration. No regressions to pinch/drag behavior.
- **Firebase Auth flow** untouched — sign-in still routes through current Google popup; only the post-auth landing changes (Hub at `/hub`).
- **Admin gating** (`admin` custom claim) preserved on `/admin/products`.

---

## 9. Out of Scope (explicit)

- Light mode.
- Comments system.
- Mobile companion app (`/mobile/`).
- New features.
- Backend changes.
- Performance optimization beyond what naturally falls out of the redesign.
