# LiveSet (connect-my-set) — Codebase Reference

## What This App Is

LiveSet is a web app where DJs, producers, and musicians can **build virtual setups** of their music gear in an interactive 3D scene, **save and share those setups**, and **browse a social feed** of video performances linked to the gear used. Think "PCPartPicker meets TikTok for music equipment."

**Live URLs:** connectmyset.com (two Firebase Hosting sites: `connectmyset` and `connectmyset-com`)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 (CRA), no React Router — navigation via `currentView` state |
| 3D Engine | Three.js 0.162 + GLTFLoader + OrbitControls |
| Animation | GSAP |
| Backend | Firebase (Auth, Firestore, Storage) — no custom server |
| Icons | react-icons |
| Hosting | Firebase Hosting (multi-site) |
| Auth | Google Sign-In only (Firebase Auth popup) |

---

## Project Structure

```
src/
├── App.js                    # Root component: auth, navigation, state management
├── App.css                   # Global layout styles
├── ThreeScene.js             # Core 3D scene builder (~4600 lines)
├── ModelPreviewPanel.js      # 3D preview for product suggestion form
├── SetupTimeline.js          # Bottom category bar (Players, Mixers, etc.)
├── ProductSuggestionForm.js  # In-scene "Suggest New Product" form
├── ProductManagerForm.js     # Admin product add/edit form (two-panel: form + 3D preview)
├── ProductDashboard.js       # Admin product list (requires admin claim)
├── Auth.js                   # signInWithGoogle / logout
├── firebaseConfig.js         # Firebase init (auth, db, storage)
├── firebaseUtils.js          # Storage URL resolvers, DB init, model path utils
├── productManager.js         # PRODUCT_CATEGORIES, ProductManager class, singleton
├── dimensionScaler.js        # Auto-scaling engine: real-world mm → scene units
├── DeviceCanvas.js           # 2D canvas sketch of device connections
├── SearchBar.js              # Product search with client-side filtering
├── MySets.js                 # List/delete saved setups
├── Settings.js               # Update display name
├── Preferences.js            # User preferences (budget, currency, defaults)
├── MobileNavigation.js       # Mobile UI helpers for 3D scene
├── chatGPTService.js         # Stub for AI connection suggestions
│
├── data/
│   └── productDimensions.json  # Real-world dimensions (mm) for auto-scaling
│
├── components/
│   ├── Feed.js / Feed.css              # TikTok-style vertical video feed
│   ├── HubLandingPage.js / .css        # Post-login hub: build or post
│   ├── PostSetModal.js / .css          # Upload full video + create clips
│   ├── Upload.js / .css                # Shorter clip upload path
│   ├── Profile.js / .css               # User profile, follow, sets, fave product
│   ├── LiveSetPlayer.js / .css         # Full-set video player with audio sync
│   ├── SaveSetupButton.js / .css       # Saves current 3D setup to Firestore
│   ├── FaveProductViewer.js / .css     # 3D viewer for favorite product on profile
│   ├── UserSearch.js / .css            # Search users by displayName
│   ├── Notifications.js / .css         # User notifications
│   └── SetupLandingPage.js / .css      # Alternate setup listing
│
├── utils/
│   ├── devicePlacement.js    # DEVICE_ROLES, SPOT_PRIORITIES, placement logic
│   ├── mobileDetection.js    # Mobile/iPhone detection helpers
│   └── productSearch.js      # Firestore product lookup utilities
│
└── (legacy/maintenance scripts)
    ├── deviceLibrary.js, migrateProducts.js, categorizeProducts.js
    ├── addMixerSendReturnPorts.js, addTeileRevoloHelper.js
    ├── updateMixerMasterOut.js, updateTeileRevoloConnections.js
    ├── AudioCableLogic.js, ConnectionPanel.js, DeviceDisplay.js
    └── ModelViewer.js, ProductForm.js, ProductSubmissionForm.js
```

---

## Navigation System

No React Router. `App.js` manages a `currentView` state:

| Value | Screen |
|-------|--------|
| `null` (no setup selected) | `HubLandingPage` — choose to build or post |
| `null` (setup selected) | 3D builder: `ThreeScene` + `SetupTimeline` + `SaveSetupButton` |
| `'feed'` | `Feed` — scrollable video feed |
| `'profile'` | `Profile` — user profile (own or other via `profileUserId`) |
| `'mySets'` | `MySets` — list of saved setups |
| `'settings'` | `Settings` — display name |
| `'preferences'` | `Preferences` — budget, currency, defaults |
| `'productDashboard'` | `ProductDashboard` — admin product manager |
| `'upload'` | `Upload` — clip upload |
| `'search'` | `UserSearch` |
| `'notifications'` | `Notifications` |

Logo click resets to hub.

---

## Firebase Data Model

### Collections

| Collection | Key Fields | Purpose |
|-----------|------------|---------|
| `products` | `name`, `type`, `brand`, `category` (DJ/Producer/Musician), `subcategory`, `price`, `modelPath`, `imageUrl`, `modelScale`, `inputs[]`, `outputs[]`, `locationPriority`, `ownerId` | All available gear with 3D models |
| `users` | `displayName`, `email`, `followers[]`, `following[]`, `faveProductId`, `preferences{}`, `createdAt` | User accounts |
| `users/{id}/followers/{followerId}` | `createdAt` | Follow relationships |
| `users/{id}/notifications/{id}` | `type`, `fromUserId`, `fromUserName`, `read` | Notifications |
| `setups` | `name`, `ownerId`, `setupType`, `devices[]` (with positions, `spotType`, `placementIndex`, model data), `isMainSetup` | Saved gear configurations |
| `sets` | `creatorId`, `creatorName`, `title`, `videoURL`, `durationSeconds`, `setupId?`, `setupName?`, `setupType?`, `audioTrackURL?`, `audioOffsetSeconds?` | Full performance recordings |
| `clips` | `creatorId`, `videoURL`, `fullVideoURL`, `clipStart`, `clipEnd`, `fullSetId`, `likes`, `likedBy[]`, `setupId?`, `audioTrackURL?` | Feed segments from sets |

### Storage Paths

| Path | Content |
|------|---------|
| `models/{filename}.glb` | 3D product models (GLB format, max 50MB) |
| `images/{filename}` | Product images (max 5MB) |
| `sets/{userId}/{timestamp}_{title}` | Full performance videos |
| `sets/audio/{...}` | Separate audio tracks for sets |

### Firestore Indexes

- `products`: category + name
- `setups`: ownerId + createdAt (desc)
- `sets`: creatorId + createdAt (desc)

---

## 3D Scene System (ThreeScene.js)

This is the largest and most complex file (~4600 lines).

### Setup Types and Ghost Spots

Three setup types, each with predefined "ghost spots" (translucent placement cubes):

| Type | Spots | Layout |
|------|-------|--------|
| **DJ** | center (mixer), left/right (CDJs), sides (FX/speakers) | Club booth layout |
| **Producer** | desk center, desk sides, rack units (angled 45 degrees), monitor speakers on poles | Studio desk with equipment racks |
| **Musician** | guitar/bass racks, keyboard stand, drum riser, amp spots, floor pedal spots | Rehearsal room / stage |

Each ghost spot has a `recommendedType` (e.g., "Mixer (DJM)", "Guitar / Bass", "Effects Pedal") used to sort search results.

### DJ Table and Booth Geometry

The DJ booth uses a `PlaneGeometry(6, 1.4)` table at `y: 0.95`. The booth is represented as 2400mm wide, 560mm deep, and 900mm tall in real-world terms. The **scene-to-real conversion** is `1 scene unit = 400mm`. This determines how all products are auto-scaled.

Ghost spot positions (center-to-center spacing of **1.15 units** between adjacent deck slots):

| Spot | Position (x, y, z) | Purpose |
|------|-------------------|---------|
| MIDDLE | (0, 1.05, 0) | Mixer |
| MIDDLE_LEFT | (-1.15, 1.05, 0) | Inner left player |
| MIDDLE_RIGHT | (1.15, 1.05, 0) | Inner right player |
| FAR_LEFT | (-2.3, 1.05, 0) | Outer left player |
| FAR_RIGHT | (2.3, 1.05, 0) | Outer right player |
| FX_LEFT | (-0.58, 1.05, -0.5) | FX behind left gap |
| FX_RIGHT | (0.58, 1.05, -0.5) | FX behind right gap |
| FX_TOP | (0, 1.5, -0.6) | Elevated FX behind mixer |
| FX_FRONT | (0, 1.05, 0.45) | FX in front of deck |
| SPEAKER_LEFT | (4.5, 0.05, -0.25) | Left speaker (floor) |
| SPEAKER_RIGHT | (-4.5, 0.05, -0.25) | Right speaker (floor) |

### Key Internal Functions

| Function | Purpose |
|----------|---------|
| `createClubEnvironment(scene)` | Builds the 3D room geometry per setup type |
| `createGhostPlacementSpots(scene)` | Creates interactive ghost cubes at predefined positions |
| `addProductToPosition(product, posIndex)` | Loads GLB model, auto-scales it, places it at ghost spot |
| `removeDevice(uniqueId)` | Removes model from scene, disposes geometry/materials, cleans up devicesRef and cables, closes mini profile if showing the removed device |
| `fetchProductsFromFirestore()` | Loads products for the search modal |
| `sortProductsByRecommendation()` | Sorts by brain-first, then recommended, then alphabetical |
| `updateConnections(deviceList)` | Draws cables between placed devices |
| `drawCable()` / `drawCableToGhostSquare()` | Renders 3D cable lines (cables store `sourceDeviceUniqueId` / `targetDeviceUniqueId` for instance-specific removal) |
| `isBrainProduct(product)` | Checks if product is a mixer/laptop/interface (core device) |
| `setupHasBrain()` | Whether the current setup has a core device placed |

### Brain Detection Logic

- **DJ**: mixer or laptop = brain. Must be placed first.
- **Producer**: audio interface, laptop, or console = brain. Must be placed first.
- **Musician**: no brain requirement. Spot-specific suggestions only.

### Device Tracking (`devicesRef`)

All placed 3D models are stored in `devicesRef.current` keyed by **`uniqueId`** (format: `{productId}-{x}-{y}-{z}`). This allows multiple instances of the same product to coexist independently. The `removeDevice` function:

1. Looks up the entry by `uniqueId` (not product `id`)
2. Removes the 3D model from the scene and disposes all geometry/materials (prevents ghost raycasting)
3. Deletes the `devicesRef` entry
4. Removes only cables connected to that specific instance (via `sourceDeviceUniqueId`/`targetDeviceUniqueId`)
5. Closes the mini profile panel if it was showing the removed device
6. Updates `placedDevicesList` state and triggers ghost spot refresh if needed

---

## Real-World Dimensions Auto-Scaling (dimensionScaler.js)

Products are automatically scaled to their correct real-world size when loaded into the 3D scene.

### How It Works

1. `src/data/productDimensions.json` contains real-world measurements (in mm) for 36+ products, plus scene reference dimensions
2. `dimensionScaler.js` provides the scaling logic:
   - `lookupDimensions(productName)` — fuzzy-matches product names (strips brand prefixes, normalizes hyphens/spaces, checks `match_keys`)
   - `computeAutoScale(productName, glbBboxSize)` — computes scale factor: `(realDimension_mm / 400) / glbBboxDimension`
   - `SCENE_UNIT_MM = 400` — 1 scene unit equals 400mm

### Scale Formula (applied at GLB load time)

```
autoScale = computeAutoScale(product.name, glbBoundingBox)
manualMultiplier = product.modelScale || 1.0
finalScale = autoScale * manualMultiplier
model.scale.setScalar(finalScale)
```

### `modelScale` Field Semantics

`modelScale` in Firestore is a **manual multiplier** on top of auto-scaling (default `1.0`). If `modelScale` is `1.0`, the product appears at its correct real-world size. If set to `2.0`, it appears 2x real size. If a product is not found in the dimensions JSON, `modelScale` acts as the absolute scale factor (fallback behavior).

### Product Name Matching

The JSON uses full names like `"Pioneer CDJ-3000"` while Firestore uses short names like `"CDJ-3000"`. Matching strategy:
1. Normalize both: lowercase, strip brand prefixes, remove hyphens/spaces
2. Exact normalized name match
3. Exact `match_keys` match
4. Substring match (either direction)
5. Results cached for performance

---

## Product Manager Form (ProductManagerForm.js)

Two-panel layout for adding/editing products:

**Left panel**: Form fields (name, brand, category, connections, image, submit)

**Right panel**: 3D model management
- Shows current model status (loaded from Firebase / new file selected / no model)
- "Replace 3D Model" button with "Revert to Current" option
- Inline 3D viewer with orbit controls and a wireframe reference cube for scale comparison
- Auto-scale badge showing matched dimensions and base scale factor
- Real-world dimensions display from JSON (e.g., "330 x 411 x 116 mm")
- Manual multiplier slider (0.1x to 5x) with preset buttons
- Scene-unit dimension readout (W, H, D)

The `ModelViewer` component inside the form calls `computeAutoScale` on GLB load and applies `effectiveScale = autoScale * manualMultiplier` per frame.

---

## Feed System (Feed.js)

- Loads `clips` ordered by `createdAt` desc, paginated with `startAfter`
- Prioritizes clips from followed creators
- Full-viewport scroll-snap with autoplay/pause on scroll
- Supports optional separate audio track (`audioTrackURL`) with drift-corrected sync
- Custom `requestAnimationFrame` loop for tight segment looping (`clipStart`/`clipEnd`)
- Ghost pause overlay with fade-in animation
- "Copy Setup" button loads the clip's linked setup into the 3D builder
- "Full Set" button opens the complete performance in `LiveSetPlayer`
- Upload FAB (floating action button) top-right

---

## Product Categories (productManager.js)

```
PRODUCT_CATEGORIES = {
  DJ: { players, mixers, effects, speakers, cables, accessories }
  Producer: { audio-interface, synthesizers, controllers, monitors, microphones, software }
  Musician: { instruments, amplifiers, effects, microphones, cables, accessories }
}
```

Each subcategory has: `name`, `description`, `icon` (emoji), `types[]` (for matching).

`DEFAULT_PRODUCT_TEMPLATE` defines the shape of a product document: `name`, `type`, `brand`, `description`, `category`, `subcategory`, `price`, `locationPriority`, `inputs[]`, `outputs[]`, `connections[]`, `specifications{}`, `features[]`, `modelPath`, `modelScale` (1.0), `imageUrl`, `isActive`, timestamps.

### Connection Types

`CONNECTION_TYPES`: RCA, XLR, 1/4", 3.5mm, USB, USB-C, Ethernet, Link, MIDI, SD, CF, Power, DC — each with type category, color key, and description.

---

## Device Placement (devicePlacement.js)

| Export | Purpose |
|--------|---------|
| `DEVICE_ROLES` | brain, input, output, effects, accessory |
| `SPOT_PRIORITIES` | Per setup type, ordered spot names per role |
| `getDeviceRole(device)` | Determines a product's role |
| `findBrainDevice(devices)` | Finds the core device in a list |
| `getRecommendedPosition(device, setupType, existingDevices, spotConfig)` | Returns `{ x, y, z, spotType }` |
| `getSetupReadiness(devices, setupType)` | Returns readiness percentage |

---

## Setup Timeline (SetupTimeline.js)

Fixed bottom bar showing device categories for the current setup type. Each button shows:
- Category icon and name
- Count of placed devices in that category
- Visual states: default, completed (green), glowing/highlighted (blue)

`categorizeDevice()` uses a 3-tier matching strategy:
1. Product `subcategory` field
2. `name` + `type` keyword matching
3. `spotType` fallback via `SPOT_TO_CATEGORY` mapping

---

## Category Highlight (Glow)

`SetupTimeline` buttons trigger `onCategoryToggle` which makes `ThreeScene` apply a blue emissive glow (`0x00a2ff`, intensity `0.35`) to all meshes in models matching the selected category. Original material properties are saved/restored.

---

## Authentication and Authorization

- **Auth**: Google popup only (`Auth.js`)
- **On sign-in**: `App.js` creates/updates `users/{uid}` doc, calls `initializeDatabase()`
- **Firestore rules**: signed-in read for most data; writes require `ownerId`/`creatorId` == `request.auth.uid`; product update/delete requires `admin` custom claim token
- **Storage rules**: public read for models/textures/sets; write requires auth with size/type constraints

---

## Key State in App.js

| State | Type | Purpose |
|-------|------|---------|
| `user` | Firebase User | Current authenticated user |
| `selectedSetup` | string | Active setup ID (shows 3D builder when set) |
| `setupDevices` | `{ DJ: [], Producer: [], Musician: [] }` | Devices per setup type |
| `actualDevices` | array | Devices currently in the 3D scene |
| `currentView` | string/null | Navigation state |
| `profileUserId` | string/null | Which user's profile to show (null = own) |
| `theme` | string | Persisted in localStorage as `livet-set-theme` |
| `showFeedPostSetModal` | bool | Controls PostSetModal visibility |

---

## Build and Deploy

```bash
npm start          # Dev server at localhost:3000
npm run build      # Production build (no sourcemaps)
npm run deploy     # Build + firebase deploy (both hosting sites)
npm run emulate    # Firebase emulators (auth:9099, firestore:8080, storage:9199)
```

Firebase config uses `REACT_APP_FIREBASE_*` env vars from `.env`.

---

## File Size and Complexity Notes

- `ThreeScene.js` is ~4600 lines — the heart of the app. Contains 3D scene setup, product search modal, device placement, cable rendering, mobile gestures, and admin tools.
- `App.js` is ~800 lines — manages global state, auth, and view switching.
- `Feed.js` is ~600 lines — complex video playback with audio sync.
- `PostSetModal.js` is ~500 lines — multi-step upload wizard with waveform alignment.
- `dimensionScaler.js` is ~110 lines — auto-scaling engine with fuzzy product name matching.
- `productDimensions.json` — 36 products with real-world mm dimensions and match keys.

---

## Legacy / Unused Files

These files exist but are not imported from the main app flow:
- `AudioCableLogic.js` — cable routing class (not wired up)
- `ConnectionPanel.js`, `DeviceDisplay.js` — unused UI components
- `ModelViewer.js` — standalone model viewer (superseded by inline `ModelViewer` in `ProductManagerForm`)
- `ProductForm.js`, `ProductSubmissionForm.js` — older product forms
- `deviceLibrary.js` — deprecated static product data
- `liveset_product_dimensions.json` (root) — original dimensions file, superseded by `src/data/productDimensions.json`
- Migration scripts: `migrateProducts.js`, `categorizeProducts.js`, `addMixerSendReturnPorts.js`, `addTeileRevoloHelper.js`, `updateMixerMasterOut.js`, `updateTeileRevoloConnections.js`
