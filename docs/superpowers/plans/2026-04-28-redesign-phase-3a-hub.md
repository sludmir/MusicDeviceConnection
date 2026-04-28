# LiveSet Redesign — Phase 3a: Hub Redesign

**Goal:** Rewrite the Hub landing page (`src/components/HubLandingPage.js` + `.css`) using the design system kit so it stops looking like a separate project.

**Architecture:** Keep all the existing Firebase data fetching and the same exposed props (`onSetupSelect`, `onNewSetup`, `onFeedClick`, `onAddProducts`, `theme`). Replace only the JSX render output and the CSS. Use kit primitives throughout.

**Source spec:** `docs/superpowers/specs/2026-04-28-liveset-redesign-design.md` Section 6.1.

---

## Layout (per spec)

Single scroll, max-width 1200px centered. Three sections separated by `--space-9` (64px):

1. **Continue / Start Building**
   - If user has saved setups: full-width Card with the most recent setup's name, mono "last edited" timestamp, setup-type chip, primary `Resume` button.
   - If no saved setups: Empty-state "Start Building" with three setup-type tiles (DJ / Producer / Musician). Tiles use `Card` + setup icon + label.
2. **Recent posts** (using existing data — new query for latest sets across all creators, capped at 6)
   - `SectionHeader` "RECENT POSTS" + "View feed →" link.
   - Horizontal-scroll row of set tiles. Each tile: thumbnail (use first frame of videoURL), creator name (Inter 500), title (Inter 600), mono duration chip.
   - If no posts yet, hide the entire section.
3. **Your setups**
   - `SectionHeader` "YOUR SETUPS" + "View all →" → `/sets`.
   - Grid: 3 cols desktop / 2 tablet / 1 mobile. Show first 6 setups (most recent).
   - Each card: name, type chip (mono), device count (mono), small kebab menu (Rename / Delete).

Background: page sits on `var(--bg)` warm black. No purple gradient. No glow effects.

---

## Implementation

### Task 1: Rewrite `src/components/HubLandingPage.js`

**Keep:**
- Imports for `useState`, `useEffect`, `useMemo`, Firebase Firestore (`collection`, `getDocs`, `query`, `where`, `orderBy`, `doc`, `deleteDoc`, `getDoc`, `getCountFromServer`, `limit`)
- `db, auth` from `../firebaseConfig`
- The `useToast` import added in Phase 1
- `PostSetModal` import (still used)
- `loadSavedSetups`, `loadStats`, `handleDeleteSetup`, `formatDate` functions — unchanged data logic

**Add:**
- `loadRecentSets` function that queries `collection(db, 'sets')` ordered by `createdAt desc` limited to 6.
- New imports from `'../ui'`: `Button`, `Card`, `Chip`, `SectionHeader`, `EmptyState`, `IconButton`.
- New imports from `'react-icons/md'`: `MdHeadphones`, `MdPiano` (already imported), `MdMoreVert`, `MdArrowForward`, `MdDelete`, `MdRefresh`.
- `IoMusicalNotes` from `'react-icons/io5'` (already imported).

**Replace** the entire `return (...)` block with the new layout. Drop the `MdOpenInNew`, `MdVideocam`, eq-bars data, accent gradient hex strings, `setupTypeIcons` map etc. — all of that goes.

**Drop** these now-unused: `useRef`, `MdPlayCircleOutline`, `MdArrowForward`, `MdOpenInNew`, `MdPiano`, `MdVideocam` if not used in the new render. Keep ones the new render uses.

**Replace** the `window.confirm(...)` delete check with a call to a new `Modal` from the kit, OR leave the existing `window.confirm` in for this phase (smallest change). Recommend: keep `window.confirm` for now; we'll switch to Modal in Phase 3b when we redesign MySets which has the same pattern.

Simplifying delete: keep `handleDeleteSetup` exactly as it is.

### Task 2: Replace `src/components/HubLandingPage.css` entirely

The new CSS is short — under 200 lines — and uses tokens exclusively. Drop all 745 lines of the old file.

### Task 3: Smoke test in dev

User refreshes their browser at `/hub` and confirms:
- Warm black background, no purple gradients
- Hub shows "Start Building" with 3 type tiles if no setups, or "Continue" card otherwise
- "YOUR SETUPS" section appears below
- Sidebar still works
- Click setup-type tile → navigates to /builder
- Click an existing setup card → loads it in builder
- Delete a setup (via kebab) → confirms, removes from list
- Resize to mobile width → grid collapses to 1 column

### Task 4: Commit

```
git add src/components/HubLandingPage.js src/components/HubLandingPage.css
git commit -m "feat(hub): redesign Hub landing page using design system kit"
```

---

## Out of scope for 3a

- Migrating MySets / Profile / Settings (those go in 3b)
- Real "from people you follow" filtering — current pass uses any recent sets
- Replacing `window.confirm` with `Modal` (deferred)
- Skeleton loading states (deferred — keep current spinner)
