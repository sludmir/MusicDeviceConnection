# LiveSet Redesign — Phase 2: Navigation Shell + Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `currentView` state-machine in `App.js` with React Router, and introduce a persistent navigation shell — left sidebar on desktop, bottom tab bar on mobile — that hides itself in the 3D builder.

**Architecture:** A new `AppShell` component owns the sidebar/tab-bar chrome and renders nested route content via `<Outlet />`. Existing screen components (HubLandingPage, MySets, Settings, Profile, Feed, etc.) become route elements. The 3D builder lives at `/builder` and renders without `AppShell`. `App.js` shrinks substantially: it only handles auth bootstrap and provides the router. Active-route highlighting in the sidebar uses `useLocation()`.

**Tech Stack:** react-router-dom v6 (new), existing React 18 + CRA, the `src/ui/` primitives from Phase 1.

**Source Spec:** `docs/superpowers/specs/2026-04-28-liveset-redesign-design.md` — Section 5 (Navigation Shell).

---

## File Structure

```
src/
├── App.js                           # SHRINKS: auth + router + global state providers
├── AppShell.js / AppShell.css       # NEW: persistent layout (sidebar/tabs + <Outlet/>)
├── routes/
│   ├── Sidebar.js / Sidebar.css     # NEW: desktop left rail
│   ├── BottomTabBar.js / .css       # NEW: mobile tab bar
│   ├── NavConfig.js                 # NEW: shared list of nav items (icon, label, path)
│   └── BuilderRoute.js              # NEW: wraps the 3D builder, hides shell
└── (existing screens unchanged in this phase, just rendered as routes)
```

App.js still owns `selectedSetup`, `setupDevices`, `actualDevices`, `theme`, `user`, etc. — but those become props to whichever route needs them, or move to a context if they're widely used. For Phase 2 we use prop-drilling from `App` into route elements (refactor to context can come later if it gets unwieldy).

---

## Routes

| Path | Element | Notes |
|---|---|---|
| `/` | `<Navigate to="/hub" replace>` | redirect |
| `/hub` | `<HubLandingPage>` | inside AppShell |
| `/feed` | `<Feed>` | inside AppShell |
| `/sets` | `<MySets>` | inside AppShell |
| `/profile` | `<Profile>` (own) | inside AppShell |
| `/profile/:id` | `<Profile profileUserId={id}>` | inside AppShell |
| `/search` | `<UserSearch>` | inside AppShell |
| `/notifications` | `<Notifications>` | inside AppShell |
| `/settings` | `<Settings>` | inside AppShell |
| `/preferences` | `<Preferences>` | inside AppShell |
| `/admin/products` | `<ProductDashboard>` | inside AppShell, admin guard |
| `/upload` | `<Upload>` | inside AppShell |
| `/builder` | `<BuilderRoute>` | NO shell |
| `/builder/:setupId` | `<BuilderRoute>` | NO shell |
| `*` | `<Navigate to="/hub" replace>` | catch-all |

Auth-not-signed-in still falls back to the existing sign-in screen rendered by `App.js` outside the router (since the router only mounts when the user is authenticated).

---

## Task 1: Install react-router-dom and add basic router

**Files:**
- Modify: `package.json` (via npm install)
- Modify: `src/App.js`

- [ ] **Step 1: Install**

```bash
npm install react-router-dom@^6.22.0
```

- [ ] **Step 2: Smoke test build**

```bash
npm run build
```

Expected: build succeeds (no other code uses router yet).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add react-router-dom"
```

---

## Task 2: NavConfig and AppShell scaffolding

**Files:**
- Create: `src/routes/NavConfig.js`
- Create: `src/routes/Sidebar.js`
- Create: `src/routes/Sidebar.css`
- Create: `src/routes/BottomTabBar.js`
- Create: `src/routes/BottomTabBar.css`
- Create: `src/AppShell.js`
- Create: `src/AppShell.css`
- Test: `src/__tests__/AppShell.test.js`

- [ ] **Step 1: Write failing test**

Create `src/__tests__/AppShell.test.js`:

```js
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AppShell from "../AppShell";

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/hub" element={<div>HUB CONTENT</div>} />
          <Route path="/feed" element={<div>FEED CONTENT</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe("AppShell", () => {
  test("renders nested route content via outlet", () => {
    renderAt("/hub");
    expect(screen.getByText("HUB CONTENT")).toBeInTheDocument();
  });

  test("renders sidebar nav items", () => {
    renderAt("/hub");
    expect(screen.getByRole("link", { name: /hub/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /feed/i })).toBeInTheDocument();
  });

  test("marks active route in sidebar", () => {
    renderAt("/feed");
    const feedLink = screen.getByRole("link", { name: /feed/i });
    expect(feedLink).toHaveAttribute("aria-current", "page");
  });
});
```

- [ ] **Step 2: Run test (FAIL — module not found)**

```bash
npm test -- --watchAll=false src/__tests__/AppShell.test.js
```

- [ ] **Step 3: Create NavConfig**

Create `src/routes/NavConfig.js`:

```js
import {
  MdHome,
  MdPlayCircleOutline,
  MdLibraryMusic,
  MdSearch,
  MdNotificationsNone,
  MdPerson,
} from "react-icons/md";

export const NAV_ITEMS = [
  { path: "/hub", label: "Hub", icon: MdHome },
  { path: "/feed", label: "Feed", icon: MdPlayCircleOutline },
  { path: "/sets", label: "My Sets", icon: MdLibraryMusic, mobileHidden: true },
  { path: "/search", label: "Search", icon: MdSearch },
  { path: "/notifications", label: "Notifications", icon: MdNotificationsNone },
  { path: "/profile", label: "Profile", icon: MdPerson },
];
```

- [ ] **Step 4: Create Sidebar**

Create `src/routes/Sidebar.js`:

```js
import React from "react";
import { NavLink } from "react-router-dom";
import { NAV_ITEMS } from "./NavConfig";
import "./Sidebar.css";

function Sidebar({ collapsed = false, onToggleCollapse }) {
  return (
    <nav className={`app-sidebar ${collapsed ? "app-sidebar--collapsed" : ""}`} aria-label="Primary">
      <div className="app-sidebar__brand">
        {collapsed ? <span className="app-sidebar__brand-mark">L</span> : <span className="app-sidebar__brand-text">LiveSet</span>}
      </div>
      <ul className="app-sidebar__list">
        {NAV_ITEMS.map(({ path, label, icon: Icon }) => (
          <li key={path}>
            <NavLink
              to={path}
              className={({ isActive }) =>
                `app-sidebar__link ${isActive ? "app-sidebar__link--active" : ""}`
              }
              end={path === "/hub"}
            >
              <Icon size={20} aria-hidden="true" />
              {!collapsed && <span className="app-sidebar__label">{label}</span>}
            </NavLink>
          </li>
        ))}
      </ul>
      {onToggleCollapse && (
        <button
          type="button"
          className="app-sidebar__collapse-btn"
          onClick={onToggleCollapse}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? "›" : "‹"}
        </button>
      )}
    </nav>
  );
}

export default Sidebar;
```

Create `src/routes/Sidebar.css`:

```css
.app-sidebar {
  width: 240px;
  flex-shrink: 0;
  background: var(--surface-1);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  padding: var(--space-4) 0;
  transition: width var(--dur-std);
}

.app-sidebar--collapsed { width: 64px; }

.app-sidebar__brand {
  padding: 0 var(--space-5) var(--space-5);
  font-weight: 600;
  letter-spacing: 1px;
  color: var(--text);
}

.app-sidebar__brand-text {
  font-size: var(--fs-lg);
}
.app-sidebar__brand-mark {
  font-family: var(--font-mono);
  font-size: var(--fs-lg);
  display: block;
  text-align: center;
}

.app-sidebar__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  flex: 1;
}

.app-sidebar__link {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-5);
  color: var(--text-muted);
  text-decoration: none;
  font-size: var(--fs-body);
  border-left: 3px solid transparent;
  transition: background var(--dur-micro), color var(--dur-micro), border-color var(--dur-micro);
}

.app-sidebar__link:hover {
  background: var(--surface-2);
  color: var(--text);
}

.app-sidebar__link--active {
  background: var(--surface-1);
  color: var(--text);
  border-left-color: var(--accent);
}

.app-sidebar--collapsed .app-sidebar__link {
  justify-content: center;
  padding: var(--space-3) 0;
}

.app-sidebar__collapse-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  margin: var(--space-3);
  padding: var(--space-2);
  align-self: flex-end;
  font-size: var(--fs-lg);
}
.app-sidebar__collapse-btn:hover { color: var(--text); }
.app-sidebar--collapsed .app-sidebar__collapse-btn {
  align-self: center;
}
```

- [ ] **Step 5: Create BottomTabBar**

Create `src/routes/BottomTabBar.js`:

```js
import React from "react";
import { NavLink } from "react-router-dom";
import { NAV_ITEMS } from "./NavConfig";
import "./BottomTabBar.css";

function BottomTabBar() {
  const items = NAV_ITEMS.filter((i) => !i.mobileHidden);
  return (
    <nav className="app-tabbar" aria-label="Primary">
      {items.map(({ path, label, icon: Icon }) => (
        <NavLink
          key={path}
          to={path}
          end={path === "/hub"}
          className={({ isActive }) =>
            `app-tabbar__tab ${isActive ? "app-tabbar__tab--active" : ""}`
          }
        >
          <Icon size={22} aria-hidden="true" />
          <span className="app-tabbar__label mono-label">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export default BottomTabBar;
```

Create `src/routes/BottomTabBar.css`:

```css
.app-tabbar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 64px;
  background: var(--surface-1);
  border-top: 1px solid var(--border);
  display: flex;
  z-index: 50;
}

.app-tabbar__tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  color: var(--text-dim);
  text-decoration: none;
  padding-top: 2px;
  border-top: 2px solid transparent;
  transition: color var(--dur-micro), border-color var(--dur-micro);
}

.app-tabbar__tab--active {
  color: var(--text);
  border-top-color: var(--accent);
}

.app-tabbar__label { display: none; }
.app-tabbar__tab--active .app-tabbar__label { display: inline; }
```

- [ ] **Step 6: Create AppShell**

Create `src/AppShell.js`:

```js
import React, { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./routes/Sidebar";
import BottomTabBar from "./routes/BottomTabBar";
import "./AppShell.css";

const COLLAPSE_KEY = "liveset-sidebar-collapsed";

function AppShell() {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  return (
    <div className="app-shell">
      <Sidebar collapsed={collapsed} onToggleCollapse={() => setCollapsed((c) => !c)} />
      <main className="app-shell__main">
        <Outlet />
      </main>
      <BottomTabBar />
    </div>
  );
}

export default AppShell;
```

Create `src/AppShell.css`:

```css
.app-shell {
  display: flex;
  min-height: 100vh;
  background: var(--bg);
  color: var(--text);
}

.app-shell__main {
  flex: 1;
  min-width: 0;
  padding-bottom: 0;
}

/* Mobile: hide sidebar, show tab bar, leave room at bottom for tabs */
@media (max-width: 1023px) {
  .app-shell .app-sidebar { display: none; }
  .app-shell__main { padding-bottom: 64px; }
}

/* Desktop: hide tab bar */
@media (min-width: 1024px) {
  .app-shell .app-tabbar { display: none; }
}
```

- [ ] **Step 7: Run tests**

```bash
npm test -- --watchAll=false src/__tests__/AppShell.test.js
```

Expected: 3/3 pass.

- [ ] **Step 8: Commit**

```bash
git add src/routes/ src/AppShell.js src/AppShell.css src/__tests__/AppShell.test.js
git commit -m "feat(nav): add AppShell with sidebar and bottom tab bar"
```

---

## Task 3: Migrate App.js to React Router

This is the biggest task in Phase 2. The goal: keep all existing functionality, but replace `currentView`-based view switching with `<Routes>`.

**Files:**
- Modify: `src/App.js` (significant)
- Create: `src/routes/BuilderRoute.js`

**Strategy:** Inside the existing `App` function, when `user && !isLoading && !error`, render a `<BrowserRouter>` containing a `<Routes>` tree. Two top-level branches:

1. Routes wrapped by `<Route element={<AppShell />}>` for normal pages (Hub, Feed, Sets, Profile, etc.) — these get the persistent shell.
2. Routes for `/builder` and `/builder/:setupId` rendered without the shell.

The header (App-header containing the logo, profile dropdown, theme toggle) is moved into `AppShell` as part of this task — the legacy `<header className="App-header">` block in App.js is removed, and AppShell renders a similar header above its `<Outlet />`. (Or for minimum risk, leave the header inside App.js for now; we'll move it in a later phase. **Recommendation: leave header in App.js for this phase**, just route the body.)

- [ ] **Step 1: Inventory all `currentView` transitions**

Read `src/App.js` and list every place `setCurrentView(...)` is called and every place `currentView === '...'` is read. Map each one to a route. Note what additional state each branch passes (e.g., `profileUserId`).

- [ ] **Step 2: Create BuilderRoute wrapper**

Create `src/routes/BuilderRoute.js`:

```js
import React from "react";
import { useParams, useNavigate } from "react-router-dom";

// Receives the rendered builder JSX as a prop because the builder needs
// access to App-level state (selectedSetup, devices, etc.). App.js owns
// the rendering and mounts BuilderRoute only when user is signed in.
function BuilderRoute({ render }) {
  const { setupId } = useParams();
  const navigate = useNavigate();
  return render({ setupId, exit: () => navigate("/hub") });
}

export default BuilderRoute;
```

- [ ] **Step 3: Replace currentView with router in App.js**

Open `src/App.js`. Add at the top:

```js
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams } from "react-router-dom";
import AppShell from "./AppShell";
```

Find the main signed-in render block (the one currently keyed off `currentView`). Replace its body with a `<BrowserRouter>` containing the route tree.

Conceptually, the structure becomes:

```jsx
return (
  <BrowserRouter>
    <div className="App">
      <header className="App-header">{/* keep existing header for now */}</header>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<Navigate to="/hub" replace />} />
          <Route path="/hub" element={
            <HubLandingPage
              onSetupSelect={(type) => navigate(`/builder?type=${type}`)}
              onNewSetup={...}
              onFeedClick={() => navigate('/feed')}
              theme={theme}
            />
          } />
          <Route path="/feed" element={<Feed onProfileClick={(id) => navigate(`/profile/${id}`)} />} />
          <Route path="/sets" element={<MySets onSelectSetup={...} onBack={() => navigate('/hub')} />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/profile/:id" element={<ProfileWithParam />} />
          <Route path="/search" element={<UserSearch onSelectUser={(id) => navigate(`/profile/${id}`)} />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/preferences" element={<Preferences />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/admin/products" element={<ProductDashboard />} />
          <Route path="*" element={<Navigate to="/hub" replace />} />
        </Route>
        <Route path="/builder/:setupId?" element={<BuilderRouteContent />} />
      </Routes>
    </div>
  </BrowserRouter>
);
```

Several subtleties:

- The current `selectedSetup` UI (the 3D builder view) is currently rendered inline in App.js's giant return. Moving it to `BuilderRouteContent` requires extracting the JSX and connecting App-level state. **For this phase**, define `BuilderRouteContent` as an inner component within App.js (not a separate file) so it has closure access to `selectedSetup`, `setupDevices`, `actualDevices`, etc. It calls `useParams()` for `setupId` and `useNavigate()` for exit.

- `navigate()` calls require being inside the `BrowserRouter` tree — extract callbacks into a small `Routed` inner component if needed, or pass `useNavigate()` results into props.

- Header actions that currently call `setCurrentView('feed')` etc. become `navigate('/feed')`. Replace `setCurrentView('mySets')` → `navigate('/sets')`, `setCurrentView('settings')` → `navigate('/settings')`, etc.

- `setCurrentView(null)` (return to hub) becomes `navigate('/hub')`.

- `profileUserId` state is replaced by URL `:id` param — drop `profileUserId` state and pass `useParams().id` to `<Profile>`.

- The legacy `selectedSetup`-driven branch (rendering the 3D builder) is now triggered by the route, not by state. When user picks a setup type from Hub, navigate to `/builder?type=DJ` (or `/builder/:setupId` when resuming a saved setup). The builder reads `?type` from `useSearchParams()` and `:setupId` from `useParams()`.

- [ ] **Step 4: Remove dead `currentView` state**

After all branches are migrated, delete:
- `const [currentView, setCurrentView] = useState(null);`
- All `setCurrentView(...)` callers

If something still references `currentView`, that branch still needs migrating — don't delete prematurely.

- [ ] **Step 5: Smoke-test in dev**

Run:

```bash
npm start
```

Walk through every route by clicking the nav, navigating to a setup, exiting back to Hub, hitting browser back/forward. Confirm:
- Sidebar appears on desktop, tab bar on mobile (resize the window to test).
- Active route is highlighted.
- Browser back/forward works.
- `/profile/some-user-id` deep link works.
- Builder hides the shell.
- Refresh on any URL re-renders the right page.

- [ ] **Step 6: Run tests**

```bash
npm test -- --watchAll=false
```

Expected: existing UI tests still pass; new AppShell test still passes.

- [ ] **Step 7: Commit**

```bash
git add src/App.js src/routes/BuilderRoute.js
git commit -m "feat(nav): migrate App.js views to React Router"
```

---

## Task 4: Wire user menu and notification badge into Sidebar bottom

**Files:**
- Modify: `src/AppShell.js`
- Modify: `src/routes/Sidebar.js` / `src/routes/Sidebar.css`

The current header has a profile dropdown (Settings, Preferences, Sign out, Admin). Per the spec, this dropdown belongs at the **bottom of the sidebar** on desktop, not in a top header.

**Step 1: Move profile dropdown into Sidebar**

Add a `userSlot` prop on `Sidebar` that renders below the nav list. AppShell receives `user`, `onSignOut`, `isAdmin` props from App.js (passed when AppShell is mounted) and constructs the user menu. On mobile (tab bar), the menu lives behind the Profile tab — so this is desktop-only.

Implementation (sketch — fill in actual JSX following Sidebar conventions):

```jsx
// AppShell.js — accept user/onSignOut/isAdmin via outlet context or props
<Sidebar
  collapsed={collapsed}
  onToggleCollapse={...}
  userSlot={
    <SidebarUserMenu
      user={user}
      isAdmin={isAdmin}
      onSignOut={onSignOut}
      collapsed={collapsed}
    />
  }
/>
```

`SidebarUserMenu` is a small new component in `src/routes/Sidebar.js` (or a sibling file `src/routes/SidebarUserMenu.js`). It shows the avatar + name when expanded, or just the avatar when collapsed. Click → menu (Settings, Preferences, Admin if admin, Sign out).

**Step 2: Remove the equivalent UI from the legacy `<header className="App-header">` in App.js** to avoid duplication. The header now only shows the wordmark or is removed entirely on routes that have AppShell. (For this phase: leave the header rendering only on auth/sign-in screen; remove it inside the router tree.)

**Step 3: Tests + commit**

```bash
npm test -- --watchAll=false
git add src/AppShell.js src/routes/
git commit -m "feat(nav): move user menu into sidebar, remove legacy header from app shell"
```

---

## Task 5: Phase 2 verification

- [ ] **Step 1: Full test suite + build**

```bash
npm test -- --watchAll=false
npm run build
```

Expected: tests pass, build succeeds.

- [ ] **Step 2: Smoke checklist (manual in browser)**

- [ ] Sign in → lands on `/hub`.
- [ ] Click each sidebar item — URL changes, content changes, active highlight follows.
- [ ] Resize to mobile width — sidebar disappears, tab bar appears at bottom.
- [ ] Navigate to a profile via `/profile/:id` — page renders.
- [ ] Pick a setup type on Hub → enters `/builder` → shell is hidden.
- [ ] Exit builder → back at Hub with shell.
- [ ] Browser back/forward navigates as expected.
- [ ] Hard refresh on `/profile/xyz` — page renders correctly (no 404).
- [ ] Toggle sidebar collapse — persists across reload.
- [ ] Sign out works.

- [ ] **Step 3: Tag the phase**

```bash
git tag redesign-phase-2
```

(Optional.)

Phase 2 complete. The app now has a real navigation shell and real URLs.

---

## Self-Review Notes

- **Spec coverage:** Section 5 (Routing, Desktop sidebar, Mobile tab bar, Builder mode hidden) → all tasks. localStorage-persisted collapse → Task 2.
- **Out of scope (deferred):** Header actions (theme toggle, notification dot animation) beyond user menu — Phase 3+. Sidebar user-menu styling polish — Phase 3. Mobile-only top app bars on individual pages — Phase 3+.
- **Risk:** Task 3 (App.js migration) is the biggest single change in the redesign so far. Recommend executing this task with extra care: spec review by a separate subagent, then a manual smoke test, then code-quality review. A regression here breaks every page.
