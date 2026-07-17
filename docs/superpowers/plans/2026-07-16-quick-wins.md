# Quick Wins Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the "New" badge from the multi-angle edit card, turn the Profile "Change linked setup" text link into a glass pill button, and add a "Scene" sidebar entry that opens `/builder` with a create-new / edit-existing chooser when no setup is loaded.

**Architecture:** Three independent UI changes on the `quick-wins` branch. The Scene item makes `/builder` a real nav destination: its no-setup fallback changes from a redirect into an empty-stage placeholder (`BuilderEmptyState`) hosting a step-based `SetupChooserModal` that calls App's existing `handleNewSetupFromLanding` / `handleSetupSelectFromLanding`.

**Tech Stack:** React 18 (CRA), React Router v6, Firebase Firestore, `src/ui` components (Modal/Card/Button/Toast), design tokens in `src/ui/tokens.css`.

**Spec:** `docs/superpowers/specs/2026-07-16-quick-wins-design.md`

**Testing note:** This repo has no test suite (CRA's jest is unconfigured, zero `*.test.js` files — verified). Per-task checks are `npx eslint <file>` (CRA's `eslintConfig` in package.json; expect no output). Full behavior verification is manual in the browser (Task 5). Do NOT run `npm run build` — it hangs under automation (CLAUDE.md).

---

### Task 1: Remove the "New" badge

**Files:**
- Modify: `src/components/CreateHub.js:84-87`
- Modify: `src/components/HubLandingPage.js:300-303`
- Modify: `src/components/HubLandingPage.css:295-306`

- [ ] **Step 1: Remove the badge span in CreateHub.js**

In `src/components/CreateHub.js`, replace:

```jsx
                <div className="hub-post-card__title">
                  Multi-angle edit
                  <span className="hub-post-card__badge">New</span>
                </div>
```

with:

```jsx
                <div className="hub-post-card__title">Multi-angle edit</div>
```

- [ ] **Step 2: Remove the badge span in HubLandingPage.js**

In `src/components/HubLandingPage.js`, replace:

```jsx
                <div className="hub-post-card__title">
                  Multi-angle edit
                  <span className="hub-post-card__badge">New</span>
                </div>
```

with:

```jsx
                <div className="hub-post-card__title">Multi-angle edit</div>
```

- [ ] **Step 3: Delete the now-unused CSS rule**

In `src/components/HubLandingPage.css`, delete this entire block (leave `.hub-post-card__title` and `.hub-post-card__subtitle` untouched — the `CREATOR` chip uses the different class `.hub-post-locked__badge` and stays):

```css
.hub-post-card__badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 7px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  background: linear-gradient(135deg, var(--accent) 0%, var(--accent-strong) 100%);
  color: var(--primary-contrast);
}
```

- [ ] **Step 4: Confirm no other usages remain**

Run: `grep -rn "hub-post-card__badge" src/`
Expected: no matches (exit code 1).

- [ ] **Step 5: Lint the touched JS files**

Run: `npx eslint src/components/CreateHub.js src/components/HubLandingPage.js`
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add src/components/CreateHub.js src/components/HubLandingPage.js src/components/HubLandingPage.css
git commit -m "chore: remove New badge from multi-angle edit card"
```

---

### Task 2: Glass "Change linked setup" button

**Files:**
- Modify: `src/components/Profile.css:310-326` (CSS only — no JS changes)

- [ ] **Step 1: Replace the text-link styles with a glass pill**

In `src/components/Profile.css`, replace:

```css
.profile-set__change-setup {
  align-self: flex-start;
  margin-top: var(--space-1);
  padding: 0;
  border: none;
  background: none;
  color: var(--primary);
  font-size: var(--fs-xs);
  font-weight: 600;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.profile-set__change-setup:hover {
  color: var(--primary-hover);
}
```

with:

```css
.profile-set__change-setup {
  align-self: flex-start;
  margin-top: var(--space-1);
  display: inline-flex;
  align-items: center;
  padding: 5px 12px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: color-mix(in srgb, var(--surface-1) 55%, transparent);
  -webkit-backdrop-filter: blur(10px);
  backdrop-filter: blur(10px);
  color: var(--text);
  font-size: var(--fs-xs);
  font-weight: 600;
  cursor: pointer;
  transition: color var(--dur-micro), border-color var(--dur-micro);
}

.profile-set__change-setup:hover {
  color: var(--primary);
  border-color: var(--primary);
}
```

Token notes: `--surface-1`, `--border`, `--dur-micro` are defined in `src/ui/tokens.css` with a `[data-theme="light"]` override block, so the pill adapts to both themes automatically. `color-mix` keeps the fill translucent so the blur reads as glass.

- [ ] **Step 2: Commit**

```bash
git add src/components/Profile.css
git commit -m "feat: glass pill style for Change linked setup button on profile"
```

---

### Task 3: SetupChooserModal component

**Files:**
- Create: `src/components/SetupChooserModal.js`
- Create: `src/components/SetupChooserModal.css`

Step-based chooser: `choice` → (`type` → optional `setting`) for new setups, or `existing` listing the signed-in user's saved setups. Card steps reuse the `hub-type-card` classes from `HubLandingPage.css` (same pattern CreateHub uses in its in-modal setting picker). Selection calls the `onNewSetup(type, settingKey)` / `onSetupSelect(setup)` props — App's existing handlers; the modal never closes itself on success because choosing a setup makes `selectedSetup` truthy, which unmounts the whole empty state.

- [ ] **Step 1: Create `src/components/SetupChooserModal.js`**

```jsx
import React, { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import { MdHeadphones, MdPiano, MdAdd, MdFolderOpen } from 'react-icons/md';
import { IoMusicalNotes } from 'react-icons/io5';
import { Modal, Card, useToast } from '../ui';
import { listSettings, hasMultipleSettings, defaultSettingFor } from '../data/settings';
import './HubLandingPage.css';
import './SetupChooserModal.css';

const SETUP_TYPES = [
  { type: 'DJ', icon: MdHeadphones, blurb: 'CDJs, mixers & turntables' },
  { type: 'Producer', icon: MdPiano, blurb: 'Synths, interfaces & controllers' },
  { type: 'Musician', icon: IoMusicalNotes, blurb: 'Instruments, amps & pedals' },
];

const TYPE_ICONS = { DJ: MdHeadphones, Producer: MdPiano, Musician: IoMusicalNotes };

const TITLES = {
  choice: 'Open the 3D scene',
  type: 'Pick a setup type',
  setting: 'Pick a setting',
  existing: 'Edit an existing setup',
};

// Chooser shown when the builder is opened with no setup loaded ("Scene" in
// the sidebar, a refresh, or a deep link). Two paths: start a new setup
// (type → optional setting), or reopen one of the user's saved setups.
function SetupChooserModal({ open, onClose, onNewSetup, onSetupSelect }) {
  const toast = useToast();
  const [step, setStep] = useState('choice');
  const [pendingType, setPendingType] = useState(null);
  const [setups, setSetups] = useState(null); // null = not fetched yet
  const [loadingSetups, setLoadingSetups] = useState(false);
  const [fetchFailed, setFetchFailed] = useState(false);

  // Reset to the first step each time the modal opens.
  useEffect(() => {
    if (open) {
      setStep('choice');
      setPendingType(null);
    }
  }, [open]);

  const loadSetups = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    try {
      setLoadingSetups(true);
      setFetchFailed(false);
      const snap = await getDocs(query(collection(db, 'setups'), where('ownerId', '==', uid)));
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      // Newest first — same client-side sort Profile uses.
      list.sort((a, b) => {
        const at = a.updatedAt?.toDate?.()?.getTime() ?? a.createdAt?.toDate?.()?.getTime() ?? 0;
        const bt = b.updatedAt?.toDate?.()?.getTime() ?? b.createdAt?.toDate?.()?.getTime() ?? 0;
        return bt - at;
      });
      setSetups(list);
    } catch (err) {
      console.error('Error loading setups:', err);
      setFetchFailed(true);
      toast.error('Failed to load your setups.');
    } finally {
      setLoadingSetups(false);
    }
  };

  const openExisting = () => {
    setStep('existing');
    if (setups === null) loadSetups();
  };

  const pickType = (type) => {
    if (hasMultipleSettings(type)) {
      setPendingType(type);
      setStep('setting');
      return;
    }
    onNewSetup(type, defaultSettingFor(type));
  };

  return (
    <Modal open={open} onClose={onClose} title={TITLES[step]}>
      {step !== 'choice' && (
        <button
          type="button"
          className="setup-chooser__back mono-label"
          onClick={() => setStep(step === 'setting' ? 'type' : 'choice')}
        >
          ← BACK
        </button>
      )}

      {step === 'choice' && (
        <div className="hub-types hub-types--in-modal">
          <Card padding="lg" className="hub-type-card press-card" onClick={() => setStep('type')}>
            <MdAdd size={36} className="hub-type-card__icon" />
            <h3 className="hub-type-card__title">New setup</h3>
            <p className="hub-type-card__blurb">Start from an empty scene</p>
            <span className="hub-type-card__cta mono-label">START BUILDING →</span>
          </Card>
          <Card padding="lg" className="hub-type-card press-card" onClick={openExisting}>
            <MdFolderOpen size={36} className="hub-type-card__icon" />
            <h3 className="hub-type-card__title">Edit existing</h3>
            <p className="hub-type-card__blurb">Reopen one of your saved setups</p>
            <span className="hub-type-card__cta mono-label">CHOOSE SETUP →</span>
          </Card>
        </div>
      )}

      {step === 'type' && (
        <div className="hub-types hub-types--in-modal">
          {SETUP_TYPES.map(({ type, icon: Icon, blurb }) => (
            <Card
              key={type}
              padding="lg"
              className="hub-type-card press-card"
              onClick={() => pickType(type)}
            >
              <Icon size={36} className="hub-type-card__icon" />
              <h3 className="hub-type-card__title">{type}</h3>
              <p className="hub-type-card__blurb">{blurb}</p>
              <span className="hub-type-card__cta mono-label">START BUILDING →</span>
            </Card>
          ))}
        </div>
      )}

      {step === 'setting' && pendingType && (
        <div className="hub-types hub-types--in-modal">
          {listSettings(pendingType).map((s) => (
            <Card
              key={s.key}
              padding="lg"
              className="hub-type-card"
              onClick={() => onNewSetup(pendingType, s.key)}
            >
              <h3 className="hub-type-card__title">{s.label}</h3>
              <p className="hub-type-card__blurb">
                {s.type === 'glb' ? 'Custom 3D environment' : 'Default environment'}
              </p>
              <span className="hub-type-card__cta mono-label">USE THIS →</span>
            </Card>
          ))}
        </div>
      )}

      {step === 'existing' && (
        loadingSetups ? (
          <p className="setup-chooser__note">Loading your setups…</p>
        ) : fetchFailed ? (
          <div>
            <p className="setup-chooser__note">Couldn't load your setups.</p>
            <button type="button" className="setup-chooser__back mono-label" onClick={loadSetups}>
              TRY AGAIN
            </button>
          </div>
        ) : !setups || setups.length === 0 ? (
          <p className="setup-chooser__note">No saved setups yet — go back and start a new one.</p>
        ) : (
          <div className="setup-chooser__list">
            {setups.map((setup) => {
              const Icon = TYPE_ICONS[setup.setupType] || MdHeadphones;
              return (
                <button
                  key={setup.id}
                  type="button"
                  className="setup-chooser__option press"
                  onClick={() => onSetupSelect(setup)}
                >
                  {setup.previewImageURL ? (
                    <img className="setup-chooser__thumb" src={setup.previewImageURL} alt="" loading="lazy" />
                  ) : (
                    <span className="setup-chooser__thumb setup-chooser__thumb--fallback">
                      <Icon size={20} aria-hidden="true" />
                    </span>
                  )}
                  <span className="setup-chooser__option-body">
                    <span className="setup-chooser__option-name">{setup.name || 'Untitled setup'}</span>
                    <span className="setup-chooser__option-meta mono-label">
                      {(setup.setupType || 'DJ').toUpperCase()} · {(setup.devices || []).length} devices
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )
      )}
    </Modal>
  );
}

export default SetupChooserModal;
```

- [ ] **Step 2: Create `src/components/SetupChooserModal.css`**

```css
/* Chooser shown when /builder is opened with no setup loaded. The card steps
   reuse the hub-type-card look (HubLandingPage.css); below are the
   chooser-specific bits: back link + saved-setup rows. */

.setup-chooser__back {
  display: inline-flex;
  align-items: center;
  margin-bottom: var(--space-3);
  padding: 0;
  border: none;
  background: none;
  color: var(--text-muted);
  cursor: pointer;
}

.setup-chooser__back:hover {
  color: var(--primary);
}

.setup-chooser__note {
  margin: 0;
  color: var(--text-muted);
  font-size: var(--fs-sm);
}

.setup-chooser__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  max-height: 320px;
  overflow-y: auto;
}

.setup-chooser__option {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-1);
  color: var(--text);
  cursor: pointer;
  text-align: left;
  transition: border-color var(--dur-micro);
}

.setup-chooser__option:hover {
  border-color: var(--primary);
}

.setup-chooser__thumb {
  width: 56px;
  height: 40px;
  flex: 0 0 auto;
  border-radius: var(--radius-xs);
  object-fit: cover;
  background: var(--surface-2);
}

.setup-chooser__thumb--fallback {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-dim);
}

.setup-chooser__option-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.setup-chooser__option-name {
  font-size: var(--fs-sm);
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.setup-chooser__option-meta {
  color: var(--text-muted);
}
```

- [ ] **Step 3: Lint**

Run: `npx eslint src/components/SetupChooserModal.js`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add src/components/SetupChooserModal.js src/components/SetupChooserModal.css
git commit -m "feat: SetupChooserModal — new/existing setup chooser for the builder"
```

---

### Task 4: BuilderEmptyState + Scene nav item + route wiring

**Files:**
- Create: `src/components/BuilderEmptyState.js`
- Create: `src/components/BuilderEmptyState.css`
- Modify: `src/routes/NavConfig.js`
- Modify: `src/App.js:653-655` (the `/builder` route's `<Navigate>` fallback) + one import

- [ ] **Step 1: Create `src/components/BuilderEmptyState.js`**

```jsx
import React, { useState } from 'react';
import { MdViewInAr } from 'react-icons/md';
import { Button } from '../ui';
import SetupChooserModal from './SetupChooserModal';
import './BuilderEmptyState.css';

// Rendered on /builder when no setup is loaded (Scene in the sidebar, a
// refresh, or a deep link). The chooser opens on arrival; closing it leaves a
// placeholder that can reopen it — no redirect back to /hub.
function BuilderEmptyState({ onNewSetup, onSetupSelect }) {
  const [chooserOpen, setChooserOpen] = useState(true);

  return (
    <div className="builder-page">
      <div className="builder-stage">
        <div className="builder-empty">
          <MdViewInAr size={44} aria-hidden="true" />
          <p className="builder-empty__text">No setup loaded</p>
          <Button variant="primary" onClick={() => setChooserOpen(true)}>
            Choose setup
          </Button>
        </div>
      </div>
      <SetupChooserModal
        open={chooserOpen}
        onClose={() => setChooserOpen(false)}
        onNewSetup={onNewSetup}
        onSetupSelect={onSetupSelect}
      />
    </div>
  );
}

export default BuilderEmptyState;
```

(`.builder-page` / `.builder-stage` frame styles come from `BuilderControls.css`, already imported globally in `App.js:4`.)

- [ ] **Step 2: Create `src/components/BuilderEmptyState.css`**

```css
/* Empty-scene placeholder for /builder with no setup loaded. The page/stage
   frame itself is styled by BuilderControls.css. */

.builder-empty {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  color: var(--text-dim);
}

.builder-empty__text {
  margin: 0;
  color: var(--text-muted);
  font-size: var(--fs-sm);
}
```

- [ ] **Step 3: Add the Scene nav item**

In `src/routes/NavConfig.js`, add `MdViewInAr` to the existing `react-icons/md` import and insert the Scene item between Create and Search. The full file becomes:

```jsx
import {
  MdHome,
  MdPlayCircleOutline,
  MdSearch,
  MdAdd,
  MdNotificationsNone,
  MdPerson,
  MdViewInAr,
} from "react-icons/md";

// `mobileHidden`  — not shown in the mobile bottom tab bar
// `desktopHidden` — not shown in the desktop sidebar
// `accent`        — rendered as an emphasized (filled) create action on mobile
//
// Mobile tabs:  Home · Feed · Create(+) · Notifications · Profile
// Desktop tabs: Home · Feed · Scene · Search · Notifications · Profile
export const NAV_ITEMS = [
  { path: "/hub", label: "Home", icon: MdHome },
  { path: "/feed", label: "Feed", icon: MdPlayCircleOutline },
  { path: "/create", label: "Create", icon: MdAdd, desktopHidden: true, accent: true },
  { path: "/builder", label: "Scene", icon: MdViewInAr, mobileHidden: true },
  { path: "/search", label: "Search", icon: MdSearch, mobileHidden: true },
  { path: "/notifications", label: "Notifications", icon: MdNotificationsNone },
  { path: "/profile", label: "Profile", icon: MdPerson },
];
```

(`BottomTabBar` filters `mobileHidden`, `Sidebar` filters `desktopHidden` — no changes needed in either.)

- [ ] **Step 4: Swap the /builder fallback in App.js**

Add the import next to the other component imports in `src/App.js`:

```js
import BuilderEmptyState from './components/BuilderEmptyState';
```

Then in the `/builder` route (around line 653), replace:

```jsx
              ) : (
                <Navigate to="/hub" replace />
              )
```

with:

```jsx
              ) : (
                <BuilderEmptyState
                  onNewSetup={handleNewSetupFromLanding}
                  onSetupSelect={handleSetupSelectFromLanding}
                />
              )
```

Do NOT remove the `Navigate` import — the `*` catch-all route (`src/App.js:657`) still uses it. Both handlers already exist in App (`src/App.js:367-398`); they call `navigate('/builder')`, a no-op here since we're already on it, and setting `selectedSetup` flips the route to the loaded branch, unmounting the empty state (and its modal) automatically.

- [ ] **Step 5: Lint**

Run: `npx eslint src/App.js src/routes/NavConfig.js src/components/BuilderEmptyState.js`
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add src/components/BuilderEmptyState.js src/components/BuilderEmptyState.css src/routes/NavConfig.js src/App.js
git commit -m "feat: Scene sidebar entry — /builder hosts setup chooser when nothing loaded"
```

---

### Task 5: Manual browser verification

**Files:** none (verification only; fix-up commits if issues found).

Setup: start the dev server (`npm start`, port 3000, background — first compile is slow). Verify in the user's signed-in Chrome via the claude-in-chrome MCP (NOT the preview browser — the setups list and Profile require his Google auth session). Load the Chrome tools via one ToolSearch call first.

- [ ] **Step 1: Badge removal** — Desktop `/hub`: multi-angle edit card shows no "New" chip. Mobile viewport (resize to 375×812) `/create`: same.
- [ ] **Step 2: Glass button** — `/profile` → SETS tab: "Change linked setup" renders as a bordered translucent pill (not underlined text); hover shifts border/text to gold; clicking still opens the relink modal. Toggle the header theme switch and re-check in light mode.
- [ ] **Step 3: Scene nav** — Desktop sidebar shows Scene (3D-box icon) between Feed and Search; it highlights as active on `/builder`.
- [ ] **Step 4: Chooser — new setup** — Click Scene with nothing loaded: empty framed stage + chooser modal. New setup → DJ → pick a setting → scene loads with ghost spots. Return Home (clears `selectedSetup`), click Scene again: chooser is back.
- [ ] **Step 5: Chooser — edit existing** — Edit existing → saved setups listed newest-first with thumbnails → clicking one loads it with its devices.
- [ ] **Step 6: Chooser — cancel** — Close the modal: "No setup loaded" placeholder with Choose setup button; button reopens the chooser.
- [ ] **Step 7: Refresh** — Reload `/builder` directly: chooser appears (no bounce to `/hub`).
- [ ] **Step 8: Loaded scene untouched** — With a setup loaded, Scene click shows the live scene, no popup; mobile bottom bar unchanged (no Scene tab).
- [ ] **Step 9: Console** — No new errors in the browser console across the above.

If any step fails: diagnose in source, fix, re-verify, and commit the fix with a `fix:` message referencing the failing step.
