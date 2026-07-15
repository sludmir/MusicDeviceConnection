# LiveSet (connect-my-set) — Codebase Reference

LiveSet is a web app where DJs, producers, and musicians **build virtual 3D setups** of their gear, **save/share** them, and browse a **TikTok-style feed** of performance videos linked to that gear. "PCPartPicker meets TikTok for music equipment."

**Live:** liveset.io (primary, `connectmyset` Firebase Hosting site). connectmyset.com still resolves (transitional).

---

## ⚠️ Operational: Running Products List

`PRODUCTS.md` (repo root) lists every 3D product in the builder. Firestore `products` is the source of truth; `src/data/productDimensions.json` is only an auto-scaling lookup. **Don't edit `PRODUCTS.md` by hand** — regenerate after product changes:

```
npm run dump-products   # scripts/dumpProducts.js, firebase-admin + ADC (gcloud auth application-default login once)
```

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18 (CRA) + **React Router v6** (`BrowserRouter`) |
| 3D | Three.js 0.162 + GLTFLoader + OrbitControls; GSAP |
| Backend | Firebase (Auth, Firestore, Storage) — no custom server |
| Video | Bunny.net (signed URLs via `utils/bunnyUrl.js`); HLS via `utils/attachHls.js` |
| Auth | Google Sign-In only (`signInWithPopup`) |
| Icons | react-icons |

```
npm start      # dev server :3000   (NOTE: large app, first compile is slow; builds tend to hang under automation — run manually)
npm run build  # prod build
npm run deploy # build + firebase deploy (both hosting sites)
npm run emulate# auth:9099 firestore:8080 storage:9199
```
Firebase config from `REACT_APP_FIREBASE_*` env vars (`.env`).

---

## Navigation & Routing (React Router)

`App.js` wraps everything in `<BrowserRouter>`. A persistent `<header className="App-header">` sits above an `<AppShell>` (desktop `Sidebar` + mobile `BottomTabBar` + `<Outlet>`). Navigate with `useNavigate()`.

| Route | Screen |
|-------|--------|
| `/hub` | `HubLandingPage` — home (featured sets/clips; + setups & post CTAs on desktop) |
| `/create` | `CreateHub` — **mobile-only tab**: post a set / build a setup |
| `/feed` | `Feed` — vertical video feed |
| `/sets` | `MySets` |
| `/profile` `/profile/:id` | `Profile` (own / other; has SETS + SETUPS tabs) |
| `/search` | `UserSearch` |
| `/notifications` | `Notifications` |
| `/settings` `/preferences` | account screens |
| `/legal` | affiliate-disclosure page (public) |
| `/admin/products` `/admin/products-import` | admin (admin claim) |
| `/upload` `/set-editor` | clip upload / multi-angle editor |
| `/builder` | 3D builder (`ThreeScene`); requires `selectedSetup`, else redirects to `/hub`. Inside `AppShell` (desktop sidebar visible; scene framed in `.builder-stage`; on mobile the tab bar is hidden via `app-shell--builder` — the builder keeps its own bottom bar) |

**Tabs** (`routes/NavConfig.js`, flags `mobileHidden` / `desktopHidden` / `accent`):
- **Mobile** (`BottomTabBar`): Home · Feed · **Create (+, gold)** · Notifications · Profile
- **Desktop** (`Sidebar`): Home · Feed · My Sets · Search · Notifications · Profile

---

## Design System & Mobile (`src/ui/`)

- **`ui/tokens.css`** — `:root` design tokens: colors (warm-dark base; `--bg #0A0908`, accent `--accent/--primary #D9C2A0` gold, `--primary-contrast` dark text for filled gold), type scale, spacing (4px base), radius, motion, **plus a `[data-theme="light"]` override block** (warm "bone" palette, darker gold accents) — the header theme toggle sets `data-theme` on `<html>` (App.js, localStorage `livet-set-theme`). **Use tokens, not hex.** Exceptions that stay literal/theme-independent: chrome overlaying video or the 3D canvas (feed, LiveSetPlayer, play chips, scrims, builder overlays) and App.css's legacy header vars (`--app-bg`, `--header-bg`, `--hdr-border*`, …).
- **`ui/mobile.css`** — global touch layer: `--tap-min:44px`, safe-area vars (`--safe-top/-bottom`), `--tabbar-h`, `.press`/`.press-card` (tap feedback), `.sr-only`, tap-highlight reset. Imported in `index.css`.
- **`ui/` components**: Button, IconButton, Input/Textarea/Select, Card, Modal, Sheet, Tabs, Chip, Avatar, SectionHeader, Toast (`useToast`).
- **Breakpoint:** mobile = `max-width: 1023px`. JS branch via `utils/useIsMobile.js` (matchMedia, matches the CSS). **Mobile-only changes must be gated** by this/media queries — desktop stays put.
- **Viewport meta** lives in `public/index.html` (`width=device-width, viewport-fit=cover`) — required for mobile layout + safe areas.
- **Accent:** warm gold everywhere. Legacy electric-blue `#00a2ff` was migrated to `--primary` tokens; Feed has its own `--feed-accent → var(--primary)`. Filled gold buttons need dark text (`--primary-contrast`). The like-heart stays red (`--feed-like`).

### Hub: mobile vs desktop (`HubLandingPage.js`)
- **Mobile:** Featured sets + **Featured Clips** (recent `clips`, signed Bunny URLs) only; search icon top-right → `/search`. Post CTAs & Your Setups are **hidden** (they live on `/create` and Profile→SETUPS).
- **Desktop:** unchanged — featured + post CTAs + Your Setups.

---

## Firebase Data Model

| Collection | Key fields |
|-----------|-----------|
| `products` | name, type, brand, category (DJ/Producer/Musician), subcategory, price, modelPath, imageUrl, modelScale, inputs[], outputs[], locationPriority, **affiliateUrl**, ownerId |
| `users` | displayName, email, followers[], following[], faveProductId, preferences{} (+ `users/{id}/followers`, `/notifications`) |
| `setups` | name, ownerId, setupType, **setting** (scene variant), devices[] (positions, spotType, placementIndex, model data), mobileDiagram, cameraAngles, isMainSetup |
| `sets` | creatorId, creatorName, title, videoURL, durationSeconds (**master-window length** when a track exists), setupId?, audioTrackURL?, audioOffsetSeconds?, audioReplacesVideo, **angles[]** (per-angle Bunny guid/hlsUrl/offset), angleGuids[], angleStatus{}, **cuts[]** (`{timeSec, angleIndex}` in master-audio time), trimIn/trimOutMasterSeconds?, trimStart/trimEndSeconds (legacy, angle-1 video time) |
| `clips` | creatorId, videoURL, fullVideoURL, clipStart, clipEnd (angle-1 video time, legacy), **clipStartMaster/clipEndMaster** (master time), fullSetId, likes, likedBy[], setupId?, audioTrackURL?, audioReplacesVideo |
| `affiliateClicks` | click ledger for creator attribution |

**Storage:** `models/*.glb` (≤10MB target), `images/*`, `sets/{uid}/...`, `sets/audio/...`.
**Rules:** signed-in read; writes require ownerId/creatorId == uid; product update/delete needs `admin` claim.
**Indexes:** products(category+name), setups(ownerId+createdAt desc), sets(creatorId+createdAt desc).

---

## 3D Scene System (`ThreeScene.js` ~4700 lines + `src/data/settings.js`)

`ThreeScene.js` orchestrates the viewport (ghost spots, placement, raycasting, hover menu, product modal, mobile gestures, cables). Scene environments are declared in the **`src/data/settings.js` registry** per `(setupType, settingKey)`: `type: 'procedural'` variants are built inline by `ThreeScene.createClubEnvironment`; `type: 'glb'` variants load from `public/scenes/*.glb` (+ optional draco). Selected variant persists on `setups.setting`, switched via the **in-scene segmented control** (top-left of the canvas). GLB scene sources are the `.blend` files in **`blender/`** — see `blender/README.md` for the headless export commands and the three.js material compatibility rules (no transmission glass, no procedural emission, no mirror chrome).

**Variants:** DJ `club`(procedural)/`rooftop`(glb)/`dojo`(glb); Producer `studio`(procedural); Musician `stage`(procedural)/`guitarRoom`(glb).

**Lighting:** each setting has `lighting.day` / `lighting.night` blocks (`background`, `toneMappingExposure`, `envMapIntensity`, `globalLights`, accent `lights[]`), switched by the **in-scene sun/moon toggle** next to the variant control — deliberately independent of the app UI theme. Renderer: ACESFilmic tone mapping, retina pixel ratio (≤2), PCFSoft shadow map, PMREM `RoomEnvironment` IBL on `scene.environment` (per-setting strength via `envMapIntensity`, applied material-by-material since three r162 lacks `scene.environmentIntensity`).

**Scale:** `1 scene unit = 400mm`. DJ ghost spots spaced 1.15u; spots carry a `recommendedType` used to sort/filter the picker. Spot table: see `utils/devicePlacement.js`.

**Auto-scaling (`dimensionScaler.js`):** `computeAutoScale(name, glbBbox)` = `(realMm/400)/glbDim`; final = `autoScale × (product.modelScale||1)`. Fuzzy-matches names against `data/productDimensions.json` (strip brand, normalize, `match_keys`). `modelScale` is a manual multiplier (1.0 = real size); fallback = absolute scale if name unmatched.

**Brain device** (core, must be placed first): DJ = mixer/laptop; Producer = interface/laptop/console; Musician = none. `isBrainProduct()`, `setupHasBrain()`.

**Device tracking:** `devicesRef.current` keyed by `uniqueId` (`{productId}-{x}-{y}-{z}`) so duplicate products coexist. `removeDevice(uniqueId)` disposes geometry/materials, removes instance-specific cables (via `sourceDeviceUniqueId`/`targetDeviceUniqueId`), updates list/ghosts.

**Builder mobile chrome:**
- `MobileNavigation.js` — hamburger menu (Add Device, etc.).
- `components/CameraAngleControls` — save/recall camera angles (bottom-left).
- `components/BuilderControls.css` — builder layout (`.builder-page`/`.builder-stage` framed panel) + App.js-rendered controls: mobile **bottom action bar** (Home · Feed · Add device · Save); desktop top-right cluster is actions only (Connection Guide · Save — the sidebar owns navigation).
- `DeviceHoverMenu` — remove / swap / buy, anchored above a tapped device.
- `ProductSelectorModal` — spot-aware picker (hard-filters to `recommendedType`, swap mode).

---

## Other Systems

- **Feed (`Feed.js`)** — `clips` paginated (followed creators first), scroll-snap autoplay, audio-master track sync, tight `clipStart`/`clipEnd` loop, Copy Setup + Full Set, upload FAB. **Camera audio is never a fallback** when a track exists — load errors retry the signed URL, muted.
- **Affiliate monetization** — `utils/affiliateLink.js` (link builder) + `utils/affiliateClicks.js` (ledger); buy buttons in mini-profile & `DeviceHoverMenu`; `affiliateUrl` in Product Manager; `/legal` disclosure. Amazon Associates signup pending.
- **Multi-angle editor (`SetEditor.js`)** — up to 3 cameras synced to lossless master audio (**the audio is the set's spine/timeline**; opt-out checkbox = single angle w/ camera audio), FCP-style multicam cuts row (drag markers, keys 1/2/3 live-cut), sync preview (`utils/syncEditorMath`, cut math in `utils/multicam.js`). Playback of track-backed sets uses the audio clock (`createMulticamAudioMasterSync` in `utils/audioVideoSync.js`, freeze-frame past footage edges). Deploy functions before posting multicam sets (per-angle URL signing + webhook `angleStatus`).
- **Product Manager (`ProductManagerForm.js`)** — two-panel add/edit with live 3D preview, auto-scale badge, manual multiplier.
- **`productManager.js`** — `PRODUCT_CATEGORIES`, `DEFAULT_PRODUCT_TEMPLATE`, `CONNECTION_TYPES` (RCA/XLR/¼"/USB/MIDI/…).

---

## Key `App.js` State

`user` · `selectedSetup` (truthy → builder) · `selectedSetting` (scene variant) · `setupDevices{DJ,Producer,Musician}` · `actualDevices` · `theme` (localStorage `livet-set-theme`, default `light`) · `affiliateAttribution` · `showFeedPostSetModal`.

---

## Conventions

- Match surrounding code style. Prefer `ui/` components + `tokens.css` vars over bespoke CSS/hex.
- **Mobile changes gate on `useIsMobile()` / `max-width:1023px`; never regress desktop.**
- Filled gold surfaces use `--primary-contrast` text (gold is pale).
- 3D models: GLB ≤10MB; flag/optimize larger.

### Legacy / unused (not in main flow)
`AudioCableLogic.js`, `ConnectionPanel.js`, `DeviceDisplay.js`, `ModelViewer.js`, `ProductForm.js`, `ProductSubmissionForm.js`, `deviceLibrary.js`, root `liveset_product_dimensions.json`, and migration scripts (`migrateProducts.js`, `categorizeProducts.js`, `addMixerSendReturnPorts.js`, `addTeileRevoloHelper.js`, `updateMixerMasterOut.js`, `updateTeileRevoloConnections.js`).
