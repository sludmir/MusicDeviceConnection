# Builder Navigation & Scene Variants — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a hover-driven device action menu (remove/swap), hard-filter the product selector to the clicked spot's recommended type, and give each setup type a second scene variant with a bottom-center switcher that persists per setup.

**Architecture:** Extract the inline product-selector modal and scene-building code out of `ThreeScene.js` into focused modules (`src/components/ProductSelectorModal.js`, `src/components/DeviceHoverMenu.js`, `src/components/SceneVariantSwitcher.js`, `src/scenes/*.js`, `src/utils/sceneVariants.js`, `src/utils/productRecommendation.js`). `ThreeScene.js` keeps orchestration only. The hover menu is an HTML overlay anchored via per-frame projection of each device's bounding-box top-center. The scene dispatcher swaps environment geometry on variant change while preserving ghost spots and dimensions. `sceneVariant` is saved on `setups` docs and applied on load.

**Tech Stack:** React 18, Three.js 0.162, Firebase (Firestore), Jest + React Testing Library (via `react-scripts test`).

**Testing philosophy:** Unit-test pure logic (recommendation filter, variants metadata). Three.js scene modules are validated by smoke tests (build returns disposable handle, expected mesh count > 0). UI interactions get RTL tests where practical; complex 3D interactions (raycasting, projection) are verified by manual smoke-testing in `npm start`.

---

## File Structure

**New files:**
- `src/utils/productRecommendation.js` — pure helpers: `isProductRecommended`, `sortProductsByRecommendation`, `filterByRecommendedType`
- `src/utils/productRecommendation.test.js`
- `src/utils/sceneVariants.js` — metadata: `VARIANTS_BY_SETUP`, helpers `getDefaultVariant`, `getVariantLabel`, `getVariantBuilder`
- `src/utils/sceneVariants.test.js`
- `src/components/ProductSelectorModal.js` + `.css`
- `src/components/ProductSelectorModal.test.js`
- `src/components/DeviceHoverMenu.js` + `.css`
- `src/components/DeviceHoverMenu.test.js`
- `src/components/SceneVariantSwitcher.js` + `.css`
- `src/components/SceneVariantSwitcher.test.js`
- `src/scenes/index.js` — `buildEnvironment(scene, setupType, variantKey)` dispatcher returning a `SceneHandle { dispose() }`
- `src/scenes/djClub.js`, `src/scenes/djRooftop.js`
- `src/scenes/producerStudioDesk.js`, `src/scenes/producerBedroom.js`
- `src/scenes/musicianRehearsal.js`, `src/scenes/musicianLiveStage.js`
- `src/scenes/__tests__/scenes.test.js` — smoke tests for each builder

**Modified:**
- `src/ThreeScene.js` — replace inline modal with `ProductSelectorModal`; replace inline `createClubEnvironment` with `buildEnvironment`; add device-hover raycast + `DeviceHoverMenu` overlay; add swap flow; remove bottom-right "Current Setup" panel.
- `src/App.js` — remove `SetupTimeline`; add `SceneVariantSwitcher`; thread `sceneVariant` state.
- `src/components/SaveSetupButton.js` — include `sceneVariant` in payload.

**Removed:**
- `src/SetupTimeline.js` (after confirming no other imports)

---

## Phase 1 — Extract product recommendation helpers

### Task 1: Pure recommendation util + tests

**Files:**
- Create: `src/utils/productRecommendation.js`
- Create: `src/utils/productRecommendation.test.js`

- [ ] **Step 1: Write failing tests**

```js
// src/utils/productRecommendation.test.js
import {
  isProductRecommended,
  filterByRecommendedType,
  sortProductsByRecommendation,
} from './productRecommendation';

const mixer = { id: 'm1', name: 'DJM-900', type: 'mixer', subcategory: 'mixers' };
const cdj = { id: 'p1', name: 'CDJ-3000', type: 'player', subcategory: 'players' };
const fx = { id: 'f1', name: 'RMX-1000', type: 'effects', subcategory: 'effects' };

describe('isProductRecommended', () => {
  test('returns false for empty/any recommended type', () => {
    expect(isProductRecommended(mixer, '')).toBe(false);
    expect(isProductRecommended(mixer, 'Any Device')).toBe(false);
    expect(isProductRecommended(mixer, 'Instrument or Effects')).toBe(false);
  });

  test('matches a mixer to "Mixer (DJM)"', () => {
    expect(isProductRecommended(mixer, 'Mixer (DJM)')).toBe(true);
    expect(isProductRecommended(cdj, 'Mixer (DJM)')).toBe(false);
  });

  test('matches a player to "Player (CDJ)"', () => {
    expect(isProductRecommended(cdj, 'Player (CDJ)')).toBe(true);
    expect(isProductRecommended(mixer, 'Player (CDJ)')).toBe(false);
  });

  test('matches effects to "Effects Pedal" or "Effects Unit"', () => {
    expect(isProductRecommended(fx, 'Effects Unit')).toBe(true);
    expect(isProductRecommended(fx, 'Effects Pedal')).toBe(true);
  });
});

describe('filterByRecommendedType', () => {
  const products = [mixer, cdj, fx];

  test('hard-filters to only matching products', () => {
    expect(filterByRecommendedType(products, 'Mixer (DJM)')).toEqual([mixer]);
  });

  test('returns all products for "Any Device"', () => {
    expect(filterByRecommendedType(products, 'Any Device')).toEqual(products);
  });
});

describe('sortProductsByRecommendation', () => {
  test('places matching products before non-matching', () => {
    const sorted = sortProductsByRecommendation([cdj, mixer, fx], 'Mixer (DJM)');
    expect(sorted[0]).toBe(mixer);
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npm test -- --watchAll=false src/utils/productRecommendation.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the util**

```js
// src/utils/productRecommendation.js
const NORMALIZE = (s) => (s || '').toString().toLowerCase();

export function isProductRecommended(product, recommendedType) {
  if (!product || !recommendedType) return false;
  if (recommendedType === 'Any Device' || recommendedType === 'Instrument or Effects') return false;

  const name = NORMALIZE(product.name);
  const type = NORMALIZE(product.type);
  const sub = NORMALIZE(product.subcategory);

  switch (recommendedType) {
    case 'Mixer (DJM)':
      return type.includes('mixer') || sub.includes('mixer') || name.includes('djm') || name.includes('mixer');
    case 'Player (CDJ)':
      return type.includes('player') || sub.includes('player') || name.includes('cdj') || name.includes('player');
    case 'Effects Unit':
    case 'Effects Pedal':
      return type.includes('effect') || sub.includes('effect') || name.includes('rmx') || name.includes('fx');
    case 'Speaker':
      return type.includes('speaker') || sub.includes('monitor') || sub.includes('speaker');
    case 'Audio Interface':
      return type.includes('interface') || sub.includes('interface');
    case 'Laptop':
      return type.includes('laptop') || name.includes('laptop') || name.includes('macbook');
    case 'Synthesizer':
      return type.includes('synth') || sub.includes('synth');
    case 'Controller':
      return type.includes('controller') || sub.includes('controller');
    case 'Microphone':
      return type.includes('mic') || sub.includes('microphone');
    case 'Guitar / Bass':
      return type.includes('guitar') || type.includes('bass') || name.includes('guitar') || name.includes('bass');
    case 'Amplifier':
      return type.includes('amp') || sub.includes('amp') || name.includes('amp');
    default: {
      const r = NORMALIZE(recommendedType);
      return type.includes(r) || sub.includes(r) || name.includes(r);
    }
  }
}

export function filterByRecommendedType(products, recommendedType) {
  if (!recommendedType || recommendedType === 'Any Device' || recommendedType === 'Instrument or Effects') {
    return products;
  }
  return products.filter((p) => isProductRecommended(p, recommendedType));
}

export function sortProductsByRecommendation(products, recommendedType) {
  if (!recommendedType) return [...products];
  return [...products].sort((a, b) => {
    const ar = isProductRecommended(a, recommendedType) ? 0 : 1;
    const br = isProductRecommended(b, recommendedType) ? 0 : 1;
    if (ar !== br) return ar - br;
    return (a.name || '').localeCompare(b.name || '');
  });
}
```

- [ ] **Step 4: Run tests, confirm pass**

Run: `npm test -- --watchAll=false src/utils/productRecommendation.test.js`
Expected: PASS, 5+ tests green.

- [ ] **Step 5: Commit**

```bash
git add src/utils/productRecommendation.js src/utils/productRecommendation.test.js
git commit -m "feat(util): extract product recommendation helpers with hard-filter"
```

---

## Phase 2 — Scene variant metadata + scene modules

### Task 2: `sceneVariants` metadata + tests

**Files:**
- Create: `src/utils/sceneVariants.js`
- Create: `src/utils/sceneVariants.test.js`

- [ ] **Step 1: Write failing tests**

```js
// src/utils/sceneVariants.test.js
import {
  VARIANTS_BY_SETUP,
  getDefaultVariant,
  getVariantLabel,
  isValidVariant,
} from './sceneVariants';

describe('sceneVariants', () => {
  test('every setup type has exactly 2 variants', () => {
    expect(VARIANTS_BY_SETUP.DJ).toHaveLength(2);
    expect(VARIANTS_BY_SETUP.Producer).toHaveLength(2);
    expect(VARIANTS_BY_SETUP.Musician).toHaveLength(2);
  });

  test('default variant is the first one (legacy "A")', () => {
    expect(getDefaultVariant('DJ')).toBe('dj-club');
    expect(getDefaultVariant('Producer')).toBe('producer-studio-desk');
    expect(getDefaultVariant('Musician')).toBe('musician-rehearsal');
  });

  test('getVariantLabel returns label for known key', () => {
    expect(getVariantLabel('dj-rooftop')).toBe('Rooftop');
  });

  test('getVariantLabel returns null for unknown key', () => {
    expect(getVariantLabel('not-a-thing')).toBeNull();
  });

  test('isValidVariant checks key against setup type', () => {
    expect(isValidVariant('DJ', 'dj-rooftop')).toBe(true);
    expect(isValidVariant('DJ', 'producer-bedroom')).toBe(false);
    expect(isValidVariant('Producer', 'unknown')).toBe(false);
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npm test -- --watchAll=false src/utils/sceneVariants.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement metadata**

```js
// src/utils/sceneVariants.js
export const VARIANTS_BY_SETUP = {
  DJ: [
    { key: 'dj-club', label: 'Club Booth' },
    { key: 'dj-rooftop', label: 'Rooftop' },
  ],
  Producer: [
    { key: 'producer-studio-desk', label: 'Studio Desk' },
    { key: 'producer-bedroom', label: 'Bedroom Studio' },
  ],
  Musician: [
    { key: 'musician-rehearsal', label: 'Rehearsal Room' },
    { key: 'musician-live-stage', label: 'Live Stage' },
  ],
};

export function getDefaultVariant(setupType) {
  const list = VARIANTS_BY_SETUP[setupType];
  return list ? list[0].key : null;
}

export function getVariantLabel(variantKey) {
  for (const list of Object.values(VARIANTS_BY_SETUP)) {
    const match = list.find((v) => v.key === variantKey);
    if (match) return match.label;
  }
  return null;
}

export function isValidVariant(setupType, variantKey) {
  const list = VARIANTS_BY_SETUP[setupType];
  if (!list) return false;
  return list.some((v) => v.key === variantKey);
}

export function getVariantsForSetup(setupType) {
  return VARIANTS_BY_SETUP[setupType] || [];
}
```

- [ ] **Step 4: Run tests, confirm pass**

Run: `npm test -- --watchAll=false src/utils/sceneVariants.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/sceneVariants.js src/utils/sceneVariants.test.js
git commit -m "feat(util): scene variant metadata with default-first ordering"
```

---

### Task 3: Extract existing DJ club scene into `src/scenes/djClub.js`

**Files:**
- Modify: `src/ThreeScene.js` (read `createClubEnvironment`, the `case 'DJ':` branch from lines ~2180–2400)
- Create: `src/scenes/djClub.js`

- [ ] **Step 1: Read `createClubEnvironment` and identify the DJ branch**

Run: `sed -n '2180,2400p' src/ThreeScene.js`
Identify: floor setup, table/booth setup, DJ-only walls/ceiling/lighting blocks. These move into the new module. Common code (floor, table) is duplicated per variant module — DRY is intentionally relaxed here because each variant defines its own floor/table look.

- [ ] **Step 2: Create `src/scenes/djClub.js`**

Each scene module exports a single `build(scene, ctx)` function and returns `{ dispose() }`. `ctx` provides shared refs (e.g., `djTableRef`) so device-placement logic still has a positional anchor.

```js
// src/scenes/djClub.js
import * as THREE from 'three';

export function build(scene, ctx) {
  const added = [];
  const disposables = [];

  function add(obj) { scene.add(obj); added.push(obj); }
  function trackDispose(thing) { disposables.push(thing); }

  // Floor
  const floorGeo = new THREE.PlaneGeometry(30, 30);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8, metalness: 0.2 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  floor.userData.type = 'environment';
  add(floor);
  trackDispose(floorGeo); trackDispose(floorMat);

  // Table (anchor for device placement)
  const tableTopGeo = new THREE.PlaneGeometry(8, 1.4);
  const tableTopMat = new THREE.MeshStandardMaterial({ color: 0x222222, side: THREE.DoubleSide });
  const tableTop = new THREE.Mesh(tableTopGeo, tableTopMat);
  tableTop.rotation.x = -Math.PI / 2;
  tableTop.position.set(0, 0.95, -0.25);
  tableTop.receiveShadow = true;
  tableTop.userData.type = 'environment';
  add(tableTop);
  trackDispose(tableTopGeo); trackDispose(tableTopMat);

  if (ctx?.djTableRef) ctx.djTableRef.current = tableTop;

  // Booth back panel
  const boothBackGeo = new THREE.PlaneGeometry(8.6, 0.9);
  const boothBackMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.7, roughness: 0.3 });
  const boothBack = new THREE.Mesh(boothBackGeo, boothBackMat);
  boothBack.position.set(0, 0.45, -0.7);
  boothBack.userData.type = 'environment';
  add(boothBack);
  trackDispose(boothBackGeo); trackDispose(boothBackMat);

  // Club walls (simple back wall, side walls)
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x0c0c12, roughness: 0.95 });
  trackDispose(wallMat);
  const backWallGeo = new THREE.PlaneGeometry(30, 8);
  const backWall = new THREE.Mesh(backWallGeo, wallMat);
  backWall.position.set(0, 4, -10);
  backWall.userData.type = 'environment';
  add(backWall);
  trackDispose(backWallGeo);

  // Ambient + spot
  const ambient = new THREE.AmbientLight(0x404060, 0.4);
  ambient.userData.type = 'environment';
  add(ambient);

  const spot = new THREE.SpotLight(0xffffff, 0.8, 30, Math.PI / 6, 0.4, 1);
  spot.position.set(0, 8, 4);
  spot.target.position.set(0, 1, 0);
  spot.userData.type = 'environment';
  add(spot); add(spot.target);

  return {
    dispose() {
      added.forEach((obj) => scene.remove(obj));
      disposables.forEach((d) => d.dispose && d.dispose());
    },
  };
}
```

- [ ] **Step 3: Verify the module imports without error**

Run: `node -e "require('./src/scenes/djClub.js')" 2>&1 || true`
Note: this may error on ESM imports in Node — that's fine; the real check is Step 4 in the smoke test (Task 9).

- [ ] **Step 4: Commit**

```bash
git add src/scenes/djClub.js
git commit -m "feat(scenes): extract DJ club environment into scenes/djClub"
```

---

### Task 4: New scene `src/scenes/djRooftop.js`

**Files:**
- Create: `src/scenes/djRooftop.js`

- [ ] **Step 1: Implement DJ rooftop variant**

```js
// src/scenes/djRooftop.js
import * as THREE from 'three';

export function build(scene, ctx) {
  const added = [];
  const disposables = [];
  const add = (obj) => { scene.add(obj); added.push(obj); };
  const td = (d) => disposables.push(d);

  // Concrete patio floor
  const floorGeo = new THREE.PlaneGeometry(30, 30);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x8a8a8a, roughness: 0.95, metalness: 0.05 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  floor.userData.type = 'environment';
  add(floor); td(floorGeo); td(floorMat);

  // DJ table (same anchor)
  const tableTopGeo = new THREE.PlaneGeometry(8, 1.4);
  const tableTopMat = new THREE.MeshStandardMaterial({ color: 0x202020, side: THREE.DoubleSide });
  const tableTop = new THREE.Mesh(tableTopGeo, tableTopMat);
  tableTop.rotation.x = -Math.PI / 2;
  tableTop.position.set(0, 0.95, -0.25);
  tableTop.receiveShadow = true;
  tableTop.userData.type = 'environment';
  add(tableTop); td(tableTopGeo); td(tableTopMat);
  if (ctx?.djTableRef) ctx.djTableRef.current = tableTop;

  // Low parapet wall (concrete)
  const parapetMat = new THREE.MeshStandardMaterial({ color: 0x9a9a9a, roughness: 0.9 });
  td(parapetMat);
  function parapet(x, z, w, d) {
    const geo = new THREE.BoxGeometry(w, 1.0, d);
    const m = new THREE.Mesh(geo, parapetMat);
    m.position.set(x, 0.5, z);
    m.userData.type = 'environment';
    add(m); td(geo);
  }
  parapet(0, -10, 30, 0.3);     // back
  parapet(0, 10, 30, 0.3);      // front
  parapet(-15, 0, 0.3, 20);     // left
  parapet(15, 0, 0.3, 20);      // right

  // Skyline silhouette plane (back)
  const skylineGeo = new THREE.PlaneGeometry(40, 8);
  const skylineMat = new THREE.MeshBasicMaterial({ color: 0x2a3550, transparent: true, opacity: 0.85 });
  const skyline = new THREE.Mesh(skylineGeo, skylineMat);
  skyline.position.set(0, 4, -14);
  skyline.userData.type = 'environment';
  add(skyline); td(skylineGeo); td(skylineMat);

  // Sky backdrop (large blue plane behind skyline)
  const skyGeo = new THREE.PlaneGeometry(80, 30);
  const skyMat = new THREE.MeshBasicMaterial({ color: 0x6fb6ff });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.position.set(0, 8, -18);
  sky.userData.type = 'environment';
  add(sky); td(skyGeo); td(skyMat);

  // Cloud planes (a few translucent quads scattered)
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 });
  td(cloudMat);
  const cloudPositions = [
    { x: -8, y: 9, z: -17, w: 6, h: 1.2 },
    { x: 6, y: 11, z: -17, w: 7, h: 1.4 },
    { x: 0, y: 13, z: -17, w: 5, h: 1.0 },
    { x: -12, y: 12, z: -17, w: 4, h: 0.9 },
  ];
  cloudPositions.forEach((c) => {
    const geo = new THREE.PlaneGeometry(c.w, c.h);
    const m = new THREE.Mesh(geo, cloudMat);
    m.position.set(c.x, c.y, c.z);
    m.userData.type = 'environment';
    add(m); td(geo);
  });

  // Daylight + warm rim
  const sun = new THREE.DirectionalLight(0xfff2d6, 1.1);
  sun.position.set(8, 12, 6);
  sun.userData.type = 'environment';
  add(sun);

  const sky2 = new THREE.HemisphereLight(0x9ecbff, 0x8a8a8a, 0.6);
  sky2.userData.type = 'environment';
  add(sky2);

  return {
    dispose() {
      added.forEach((o) => scene.remove(o));
      disposables.forEach((d) => d.dispose && d.dispose());
    },
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/scenes/djRooftop.js
git commit -m "feat(scenes): add DJ rooftop variant (concrete + skyline + clouds)"
```

---

### Task 5: Extract Producer studio desk + new Producer bedroom

**Files:**
- Create: `src/scenes/producerStudioDesk.js`
- Create: `src/scenes/producerBedroom.js`

- [ ] **Step 1: Read Producer branch of `createClubEnvironment`**

Run: `grep -n "case 'Producer'" src/ThreeScene.js`
Then read the surrounding ~150 lines.

- [ ] **Step 2: Create `src/scenes/producerStudioDesk.js` mirroring current Producer environment**

Use the same pattern as `djClub.js`: floor (warmer wood tone), desk surface at `y: 0.95` (anchor `djTableRef`), rear monitor stands geometry, soft cool lighting. Implement the visual content currently in the Producer branch of `createClubEnvironment`. (Engineer: copy the geometry/material setup from the existing Producer branch and wrap it in the `build/dispose` pattern.)

```js
// src/scenes/producerStudioDesk.js
import * as THREE from 'three';

export function build(scene, ctx) {
  const added = []; const disposables = [];
  const add = (o) => { scene.add(o); added.push(o); };
  const td = (d) => disposables.push(d);

  const floorGeo = new THREE.PlaneGeometry(20, 20);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x2a2520, roughness: 0.9 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
  floor.userData.type = 'environment';
  add(floor); td(floorGeo); td(floorMat);

  const deskGeo = new THREE.PlaneGeometry(8, 1.4);
  const deskMat = new THREE.MeshStandardMaterial({ color: 0x3a2f25, side: THREE.DoubleSide });
  const desk = new THREE.Mesh(deskGeo, deskMat);
  desk.rotation.x = -Math.PI / 2; desk.position.set(0, 0.95, -0.25);
  desk.userData.type = 'environment';
  add(desk); td(deskGeo); td(deskMat);
  if (ctx?.djTableRef) ctx.djTableRef.current = desk;

  const backWallGeo = new THREE.PlaneGeometry(20, 6);
  const backWallMat = new THREE.MeshStandardMaterial({ color: 0x1c1c20, roughness: 0.95 });
  const backWall = new THREE.Mesh(backWallGeo, backWallMat);
  backWall.position.set(0, 3, -8);
  backWall.userData.type = 'environment';
  add(backWall); td(backWallGeo); td(backWallMat);

  add(Object.assign(new THREE.AmbientLight(0x6678aa, 0.5), { userData: { type: 'environment' } }));
  const key = new THREE.DirectionalLight(0xffffff, 0.7);
  key.position.set(2, 5, 4); key.userData.type = 'environment';
  add(key);

  return {
    dispose() {
      added.forEach((o) => scene.remove(o));
      disposables.forEach((d) => d.dispose && d.dispose());
    },
  };
}
```

- [ ] **Step 3: Create `src/scenes/producerBedroom.js` (new variant)**

```js
// src/scenes/producerBedroom.js
import * as THREE from 'three';

export function build(scene, ctx) {
  const added = []; const disposables = [];
  const add = (o) => { scene.add(o); added.push(o); };
  const td = (d) => disposables.push(d);

  // Warm wood floor
  const floorGeo = new THREE.PlaneGeometry(18, 18);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2b, roughness: 0.85 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
  floor.userData.type = 'environment';
  add(floor); td(floorGeo); td(floorMat);

  // Rug under desk
  const rugGeo = new THREE.PlaneGeometry(7, 4);
  const rugMat = new THREE.MeshStandardMaterial({ color: 0x4a2222, roughness: 1.0 });
  const rug = new THREE.Mesh(rugGeo, rugMat);
  rug.rotation.x = -Math.PI / 2; rug.position.set(0, 0.005, 1.5);
  rug.userData.type = 'environment';
  add(rug); td(rugGeo); td(rugMat);

  // Desk surface (anchor)
  const deskGeo = new THREE.PlaneGeometry(8, 1.4);
  const deskMat = new THREE.MeshStandardMaterial({ color: 0x4e3a26, side: THREE.DoubleSide });
  const desk = new THREE.Mesh(deskGeo, deskMat);
  desk.rotation.x = -Math.PI / 2; desk.position.set(0, 0.95, -0.25);
  desk.userData.type = 'environment';
  add(desk); td(deskGeo); td(deskMat);
  if (ctx?.djTableRef) ctx.djTableRef.current = desk;

  // Back wall with acoustic foam panels (tiled boxes)
  const wallGeo = new THREE.PlaneGeometry(18, 6);
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xc9b89a, roughness: 1.0 });
  const wall = new THREE.Mesh(wallGeo, wallMat);
  wall.position.set(0, 3, -7); wall.userData.type = 'environment';
  add(wall); td(wallGeo); td(wallMat);

  const foamMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 1.0 });
  td(foamMat);
  const foamGeo = new THREE.BoxGeometry(0.7, 0.7, 0.05);
  td(foamGeo);
  for (let row = 0; row < 3; row++) {
    for (let col = -3; col <= 3; col++) {
      const panel = new THREE.Mesh(foamGeo, foamMat);
      panel.position.set(col * 0.8, 2.2 + row * 0.8, -6.95);
      panel.userData.type = 'environment';
      add(panel);
    }
  }

  // Window (light blue plane embedded in wall)
  const windowGeo = new THREE.PlaneGeometry(3, 2);
  const windowMat = new THREE.MeshBasicMaterial({ color: 0xbcdfff });
  const win = new THREE.Mesh(windowGeo, windowMat);
  win.position.set(5, 3, -6.94); win.userData.type = 'environment';
  add(win); td(windowGeo); td(windowMat);

  // Tungsten desk lamp light (warm point light)
  const lamp = new THREE.PointLight(0xffb070, 1.2, 8, 2);
  lamp.position.set(-2, 1.6, 0.5);
  lamp.userData.type = 'environment';
  add(lamp);

  // Soft daylight from window direction
  const day = new THREE.DirectionalLight(0xeaf2ff, 0.5);
  day.position.set(6, 4, 2); day.userData.type = 'environment';
  add(day);
  add(Object.assign(new THREE.AmbientLight(0x554433, 0.35), { userData: { type: 'environment' } }));

  return {
    dispose() {
      added.forEach((o) => scene.remove(o));
      disposables.forEach((d) => d.dispose && d.dispose());
    },
  };
}
```

- [ ] **Step 4: Commit**

```bash
git add src/scenes/producerStudioDesk.js src/scenes/producerBedroom.js
git commit -m "feat(scenes): producer studio-desk extracted + bedroom variant"
```

---

### Task 6: Extract Musician rehearsal + new Live Stage

**Files:**
- Create: `src/scenes/musicianRehearsal.js`
- Create: `src/scenes/musicianLiveStage.js`

- [ ] **Step 1: Read Musician branch of `createClubEnvironment`**

Run: `grep -n "case 'Musician'" src/ThreeScene.js` and read the surrounding ~150 lines.

- [ ] **Step 2: Create `src/scenes/musicianRehearsal.js`**

```js
// src/scenes/musicianRehearsal.js
import * as THREE from 'three';

export function build(scene, ctx) {
  const added = []; const disposables = [];
  const add = (o) => { scene.add(o); added.push(o); };
  const td = (d) => disposables.push(d);

  const floorGeo = new THREE.PlaneGeometry(22, 22);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x2c241e, roughness: 0.95 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
  floor.userData.type = 'environment';
  add(floor); td(floorGeo); td(floorMat);

  // Stand-in for stand surface anchor (some musician spots don't use the table)
  const deskGeo = new THREE.PlaneGeometry(8, 1.4);
  const deskMat = new THREE.MeshStandardMaterial({ color: 0x222222, side: THREE.DoubleSide });
  const desk = new THREE.Mesh(deskGeo, deskMat);
  desk.rotation.x = -Math.PI / 2; desk.position.set(0, 0.95, -0.25);
  desk.userData.type = 'environment';
  add(desk); td(deskGeo); td(deskMat);
  if (ctx?.djTableRef) ctx.djTableRef.current = desk;

  const backWallGeo = new THREE.PlaneGeometry(22, 7);
  const backWallMat = new THREE.MeshStandardMaterial({ color: 0x1f1c19, roughness: 1.0 });
  const backWall = new THREE.Mesh(backWallGeo, backWallMat);
  backWall.position.set(0, 3.5, -9); backWall.userData.type = 'environment';
  add(backWall); td(backWallGeo); td(backWallMat);

  add(Object.assign(new THREE.AmbientLight(0x666666, 0.5), { userData: { type: 'environment' } }));
  const key = new THREE.DirectionalLight(0xffffff, 0.6);
  key.position.set(3, 6, 3); key.userData.type = 'environment';
  add(key);

  return {
    dispose() {
      added.forEach((o) => scene.remove(o));
      disposables.forEach((d) => d.dispose && d.dispose());
    },
  };
}
```

- [ ] **Step 3: Create `src/scenes/musicianLiveStage.js`**

```js
// src/scenes/musicianLiveStage.js
import * as THREE from 'three';

export function build(scene, ctx) {
  const added = []; const disposables = [];
  const add = (o) => { scene.add(o); added.push(o); };
  const td = (d) => disposables.push(d);

  // Black house floor
  const houseGeo = new THREE.PlaneGeometry(30, 30);
  const houseMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 1.0 });
  const house = new THREE.Mesh(houseGeo, houseMat);
  house.rotation.x = -Math.PI / 2;
  house.userData.type = 'environment';
  add(house); td(houseGeo); td(houseMat);

  // Raised wooden stage platform
  const stageGeo = new THREE.BoxGeometry(14, 0.2, 8);
  const stageMat = new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.7 });
  const stage = new THREE.Mesh(stageGeo, stageMat);
  stage.position.set(0, 0.1, 0); stage.receiveShadow = true;
  stage.userData.type = 'environment';
  add(stage); td(stageGeo); td(stageMat);

  // Stage top anchor (the deck device-placement uses)
  const deckGeo = new THREE.PlaneGeometry(8, 1.4);
  const deckMat = new THREE.MeshStandardMaterial({ color: 0x6a4a2c, side: THREE.DoubleSide });
  const deck = new THREE.Mesh(deckGeo, deckMat);
  deck.rotation.x = -Math.PI / 2; deck.position.set(0, 0.95, -0.25);
  deck.userData.type = 'environment';
  add(deck); td(deckGeo); td(deckMat);
  if (ctx?.djTableRef) ctx.djTableRef.current = deck;

  // Brick backdrop
  const brickGeo = new THREE.PlaneGeometry(20, 8);
  const brickMat = new THREE.MeshStandardMaterial({ color: 0x4a2422, roughness: 0.95 });
  const brick = new THREE.Mesh(brickGeo, brickMat);
  brick.position.set(0, 4, -7.9); brick.userData.type = 'environment';
  add(brick); td(brickGeo); td(brickMat);

  // Edge LED strip along front of stage (emissive bar)
  const ledGeo = new THREE.BoxGeometry(14, 0.04, 0.04);
  const ledMat = new THREE.MeshBasicMaterial({ color: 0xff3060 });
  const led = new THREE.Mesh(ledGeo, ledMat);
  led.position.set(0, 0.22, 4); led.userData.type = 'environment';
  add(led); td(ledGeo); td(ledMat);

  // Wedge monitors (boxes at stage corners)
  const wedgeMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.7 });
  td(wedgeMat);
  function wedge(x) {
    const geo = new THREE.BoxGeometry(0.9, 0.5, 0.7);
    const m = new THREE.Mesh(geo, wedgeMat);
    m.position.set(x, 0.45, 3.4); m.rotation.y = x < 0 ? 0.3 : -0.3;
    m.userData.type = 'environment';
    add(m); td(geo);
  }
  wedge(-5.5); wedge(5.5);

  // Warm PAR cans (point lights overhead)
  function par(x, color) {
    const l = new THREE.PointLight(color, 1.2, 12, 1.8);
    l.position.set(x, 6, 2); l.userData.type = 'environment';
    add(l);
  }
  par(-3, 0xff9050);
  par(0, 0xffe0a0);
  par(3, 0xff9050);

  add(Object.assign(new THREE.AmbientLight(0x221122, 0.35), { userData: { type: 'environment' } }));

  return {
    dispose() {
      added.forEach((o) => scene.remove(o));
      disposables.forEach((d) => d.dispose && d.dispose());
    },
  };
}
```

- [ ] **Step 4: Commit**

```bash
git add src/scenes/musicianRehearsal.js src/scenes/musicianLiveStage.js
git commit -m "feat(scenes): musician rehearsal extracted + live stage variant"
```

---

### Task 7: Scene dispatcher `src/scenes/index.js`

**Files:**
- Create: `src/scenes/index.js`

- [ ] **Step 1: Implement dispatcher**

```js
// src/scenes/index.js
import * as djClub from './djClub';
import * as djRooftop from './djRooftop';
import * as producerStudioDesk from './producerStudioDesk';
import * as producerBedroom from './producerBedroom';
import * as musicianRehearsal from './musicianRehearsal';
import * as musicianLiveStage from './musicianLiveStage';

const BUILDERS = {
  'dj-club': djClub.build,
  'dj-rooftop': djRooftop.build,
  'producer-studio-desk': producerStudioDesk.build,
  'producer-bedroom': producerBedroom.build,
  'musician-rehearsal': musicianRehearsal.build,
  'musician-live-stage': musicianLiveStage.build,
};

export function buildEnvironment(scene, variantKey, ctx) {
  // Clear any prior environment objects first (safety net).
  scene.children
    .filter((c) => c.userData && c.userData.type === 'environment')
    .forEach((c) => scene.remove(c));

  const builder = BUILDERS[variantKey];
  if (!builder) {
    console.warn(`[scenes] unknown variant "${variantKey}"`);
    return { dispose() {} };
  }
  return builder(scene, ctx);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/scenes/index.js
git commit -m "feat(scenes): variant dispatcher with environment cleanup"
```

---

### Task 8: Scene smoke tests

**Files:**
- Create: `src/scenes/__tests__/scenes.test.js`

- [ ] **Step 1: Write smoke tests**

```js
// src/scenes/__tests__/scenes.test.js
import * as THREE from 'three';
import { buildEnvironment } from '../index';
import { VARIANTS_BY_SETUP } from '../../utils/sceneVariants';

describe('scene builders', () => {
  const allKeys = Object.values(VARIANTS_BY_SETUP).flat().map((v) => v.key);

  test.each(allKeys)('builds and disposes variant "%s"', (key) => {
    const scene = new THREE.Scene();
    const ctx = { djTableRef: { current: null } };
    const handle = buildEnvironment(scene, key, ctx);

    const envCount = scene.children.filter((c) => c.userData?.type === 'environment').length;
    expect(envCount).toBeGreaterThan(0);
    expect(ctx.djTableRef.current).not.toBeNull();

    handle.dispose();
    const after = scene.children.filter((c) => c.userData?.type === 'environment').length;
    expect(after).toBe(0);
  });

  test('unknown variant returns no-op handle', () => {
    const scene = new THREE.Scene();
    const handle = buildEnvironment(scene, 'not-a-key', {});
    expect(scene.children.filter((c) => c.userData?.type === 'environment').length).toBe(0);
    expect(() => handle.dispose()).not.toThrow();
  });
});
```

- [ ] **Step 2: Run and confirm pass**

Run: `npm test -- --watchAll=false src/scenes/__tests__/scenes.test.js`
Expected: PASS, 7 tests (6 variants + unknown).

- [ ] **Step 3: Commit**

```bash
git add src/scenes/__tests__/scenes.test.js
git commit -m "test(scenes): smoke tests for build + dispose on every variant"
```

---

## Phase 3 — `ProductSelectorModal` component

### Task 9: Extract modal + add hard filter

**Files:**
- Create: `src/components/ProductSelectorModal.js`
- Create: `src/components/ProductSelectorModal.css`
- Create: `src/components/ProductSelectorModal.test.js`

- [ ] **Step 1: Read existing inline modal**

Run: `sed -n '4660,4870p' src/ThreeScene.js`
Identify the existing modal's render block — the structure to mirror.

- [ ] **Step 2: Write failing component tests**

```js
// src/components/ProductSelectorModal.test.js
import { render, screen, fireEvent } from '@testing-library/react';
import ProductSelectorModal from './ProductSelectorModal';

const products = [
  { id: 'm1', name: 'DJM-900', type: 'mixer', subcategory: 'mixers' },
  { id: 'p1', name: 'CDJ-3000', type: 'player', subcategory: 'players' },
  { id: 'f1', name: 'RMX-1000', type: 'effects', subcategory: 'effects' },
];

describe('ProductSelectorModal', () => {
  test('hard-filters to recommended type by default', () => {
    render(
      <ProductSelectorModal
        isOpen
        mode="place"
        recommendedType="Mixer (DJM)"
        products={products}
        onSelect={() => {}}
        onClose={() => {}}
      />
    );
    expect(screen.getByText('DJM-900')).toBeInTheDocument();
    expect(screen.queryByText('CDJ-3000')).not.toBeInTheDocument();
  });

  test('"Show all products" toggle reveals filtered-out items', () => {
    render(
      <ProductSelectorModal
        isOpen
        mode="place"
        recommendedType="Mixer (DJM)"
        products={products}
        onSelect={() => {}}
        onClose={() => {}}
      />
    );
    fireEvent.click(screen.getByLabelText(/show all products/i));
    expect(screen.getByText('CDJ-3000')).toBeInTheDocument();
  });

  test('"Any Device" shows all products without filtering', () => {
    render(
      <ProductSelectorModal
        isOpen
        mode="place"
        recommendedType="Any Device"
        products={products}
        onSelect={() => {}}
        onClose={() => {}}
      />
    );
    expect(screen.getByText('DJM-900')).toBeInTheDocument();
    expect(screen.getByText('CDJ-3000')).toBeInTheDocument();
  });

  test('swap mode shows "Current" badge on currentProductId', () => {
    render(
      <ProductSelectorModal
        isOpen
        mode="swap"
        recommendedType="Mixer (DJM)"
        currentProductId="m1"
        products={products}
        onSelect={() => {}}
        onClose={() => {}}
      />
    );
    expect(screen.getByText('Current')).toBeInTheDocument();
  });

  test('onSelect fires with product id when card clicked', () => {
    const onSelect = jest.fn();
    render(
      <ProductSelectorModal
        isOpen
        mode="place"
        recommendedType="Mixer (DJM)"
        products={products}
        onSelect={onSelect}
        onClose={() => {}}
      />
    );
    fireEvent.click(screen.getByText('DJM-900'));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'm1' }));
  });
});
```

- [ ] **Step 3: Run, confirm failure**

Run: `npm test -- --watchAll=false src/components/ProductSelectorModal.test.js`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement component**

```jsx
// src/components/ProductSelectorModal.js
import React, { useMemo, useState } from 'react';
import { filterByRecommendedType, sortProductsByRecommendation } from '../utils/productRecommendation';
import './ProductSelectorModal.css';

export default function ProductSelectorModal({
  isOpen,
  mode = 'place',          // 'place' | 'swap'
  recommendedType,
  currentProductId,
  products = [],
  onSelect,
  onClose,
}) {
  const [showAll, setShowAll] = useState(false);
  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    const base = showAll
      ? sortProductsByRecommendation(products, recommendedType)
      : filterByRecommendedType(products, recommendedType);
    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base.filter((p) => (p.name || '').toLowerCase().includes(q));
  }, [products, recommendedType, showAll, query]);

  if (!isOpen) return null;

  const title = (() => {
    if (!recommendedType || recommendedType === 'Any Device') return 'Choose a Product';
    return `Choose ${recommendedType.startsWith('Effects') ? 'an' : 'a'} ${recommendedType}`;
  })();

  return (
    <div className="psm-overlay" onClick={onClose}>
      <div className="psm-modal" onClick={(e) => e.stopPropagation()}>
        <header className="psm-header">
          <h2>{title}</h2>
          <button className="psm-close" onClick={onClose} aria-label="Close">×</button>
        </header>

        <div className="psm-controls">
          <input
            className="psm-search"
            placeholder="Search products…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <label className="psm-show-all">
            <input
              type="checkbox"
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
            />
            Show all products
          </label>
        </div>

        <ul className="psm-grid">
          {visible.map((product) => {
            const isCurrent = mode === 'swap' && product.id === currentProductId;
            return (
              <li
                key={product.id}
                className={`psm-card${isCurrent ? ' is-current' : ''}`}
                onClick={() => (isCurrent ? onClose() : onSelect(product))}
              >
                {product.imageUrl && (
                  <img src={product.imageUrl} alt={product.name} className="psm-thumb" />
                )}
                <div className="psm-name">{product.name}</div>
                {isCurrent && <span className="psm-badge">Current</span>}
              </li>
            );
          })}
          {visible.length === 0 && <li className="psm-empty">No matching products.</li>}
        </ul>
      </div>
    </div>
  );
}
```

```css
/* src/components/ProductSelectorModal.css */
.psm-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.55);
  display: flex; align-items: center; justify-content: center; z-index: 4000;
}
.psm-modal {
  width: min(880px, 92vw); max-height: 86vh; overflow: hidden;
  background: #14171c; color: #fff; border-radius: 14px;
  display: flex; flex-direction: column;
}
.psm-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; }
.psm-header h2 { margin: 0; font-size: 18px; }
.psm-close { background: transparent; border: 0; color: #fff; font-size: 24px; cursor: pointer; }
.psm-controls { display: flex; gap: 12px; padding: 0 20px 12px; align-items: center; }
.psm-search {
  flex: 1; background: #1c2128; border: 1px solid #2a313b; color: #fff;
  border-radius: 8px; padding: 8px 12px; font-size: 14px;
}
.psm-show-all { display: flex; gap: 6px; align-items: center; font-size: 13px; color: #c8cdd6; }
.psm-grid {
  list-style: none; margin: 0; padding: 12px 20px 20px;
  display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px; overflow-y: auto;
}
.psm-card {
  background: #1b1f26; border: 1px solid #262c36; border-radius: 10px;
  padding: 12px; cursor: pointer; position: relative;
  display: flex; flex-direction: column; gap: 8px; align-items: center;
}
.psm-card:hover { border-color: #3a4658; background: #1f242d; }
.psm-card.is-current { border-color: #00a2ff; }
.psm-thumb { width: 100%; height: 90px; object-fit: contain; }
.psm-name { font-size: 13px; text-align: center; color: #e3e6ec; }
.psm-badge {
  position: absolute; top: 6px; right: 6px;
  background: #00a2ff; color: #fff; font-size: 10px; padding: 2px 6px; border-radius: 6px;
}
.psm-empty { grid-column: 1 / -1; text-align: center; color: #8a91a0; padding: 24px; }
```

- [ ] **Step 5: Run tests, confirm pass**

Run: `npm test -- --watchAll=false src/components/ProductSelectorModal.test.js`
Expected: PASS, 5 tests.

- [ ] **Step 6: Commit**

```bash
git add src/components/ProductSelectorModal.js src/components/ProductSelectorModal.css src/components/ProductSelectorModal.test.js
git commit -m "feat(modal): ProductSelectorModal with hard-filter + swap mode"
```

---

## Phase 4 — `DeviceHoverMenu` component

### Task 10: Build hover menu overlay + tests

**Files:**
- Create: `src/components/DeviceHoverMenu.js`
- Create: `src/components/DeviceHoverMenu.css`
- Create: `src/components/DeviceHoverMenu.test.js`

- [ ] **Step 1: Write failing tests**

```jsx
// src/components/DeviceHoverMenu.test.js
import { render, screen, fireEvent } from '@testing-library/react';
import DeviceHoverMenu from './DeviceHoverMenu';

describe('DeviceHoverMenu', () => {
  test('renders nothing when device is null', () => {
    const { container } = render(
      <DeviceHoverMenu device={null} screenPosition={{ x: 0, y: 0 }} onRemove={()=>{}} onSwap={()=>{}} onClose={()=>{}} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  test('shows remove and swap buttons when device present', () => {
    render(
      <DeviceHoverMenu
        device={{ uniqueId: 'd1', name: 'CDJ-3000' }}
        screenPosition={{ x: 100, y: 200 }}
        onRemove={() => {}}
        onSwap={() => {}}
        onClose={() => {}}
      />
    );
    expect(screen.getByLabelText(/remove/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/swap/i)).toBeInTheDocument();
  });

  test('clicking remove calls onRemove with device', () => {
    const onRemove = jest.fn();
    const device = { uniqueId: 'd1', name: 'CDJ-3000' };
    render(
      <DeviceHoverMenu device={device} screenPosition={{ x: 0, y: 0 }} onRemove={onRemove} onSwap={()=>{}} onClose={()=>{}} />
    );
    fireEvent.click(screen.getByLabelText(/remove/i));
    expect(onRemove).toHaveBeenCalledWith(device);
  });

  test('clicking swap calls onSwap with device', () => {
    const onSwap = jest.fn();
    const device = { uniqueId: 'd1', name: 'CDJ-3000' };
    render(
      <DeviceHoverMenu device={device} screenPosition={{ x: 0, y: 0 }} onRemove={()=>{}} onSwap={onSwap} onClose={()=>{}} />
    );
    fireEvent.click(screen.getByLabelText(/swap/i));
    expect(onSwap).toHaveBeenCalledWith(device);
  });
});
```

- [ ] **Step 2: Run, confirm failure**

Run: `npm test -- --watchAll=false src/components/DeviceHoverMenu.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```jsx
// src/components/DeviceHoverMenu.js
import React from 'react';
import './DeviceHoverMenu.css';

export default function DeviceHoverMenu({ device, screenPosition, onRemove, onSwap, onClose }) {
  if (!device) return null;
  const left = (screenPosition?.x ?? 0);
  const top = (screenPosition?.y ?? 0);

  return (
    <div
      className="dhm-anchor"
      style={{ left, top }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="dhm-bubble">
        <div className="dhm-label">{device.name}</div>
        <div className="dhm-actions">
          <button
            className="dhm-btn dhm-swap"
            aria-label="Swap product"
            title="Swap"
            onClick={() => onSwap(device)}
          >
            ⟳
          </button>
          <button
            className="dhm-btn dhm-remove"
            aria-label="Remove device"
            title="Remove"
            onClick={() => onRemove(device)}
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}
```

```css
/* src/components/DeviceHoverMenu.css */
.dhm-anchor {
  position: absolute;
  transform: translate(-50%, -110%);
  z-index: 3000;
  pointer-events: auto;
}
.dhm-bubble {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  background: rgba(20, 23, 28, 0.92);
  border: 1px solid #2a313b; border-radius: 10px;
  padding: 8px 10px;
  box-shadow: 0 6px 18px rgba(0,0,0,0.4);
  color: #fff;
  white-space: nowrap;
}
.dhm-label { font-size: 12px; color: #c8cdd6; }
.dhm-actions { display: flex; gap: 8px; }
.dhm-btn {
  width: 36px; height: 36px; border-radius: 50%;
  background: #1b1f26; border: 1px solid #2a313b; color: #fff;
  font-size: 16px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}
.dhm-btn:hover { background: #232932; }
.dhm-remove { color: #ff5566; }
.dhm-remove:hover { background: #3a1f24; border-color: #ff5566; }
.dhm-swap { color: #00a2ff; }
.dhm-swap:hover { background: #15303d; border-color: #00a2ff; }
```

- [ ] **Step 4: Run tests, confirm pass**

Run: `npm test -- --watchAll=false src/components/DeviceHoverMenu.test.js`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/DeviceHoverMenu.js src/components/DeviceHoverMenu.css src/components/DeviceHoverMenu.test.js
git commit -m "feat(menu): DeviceHoverMenu with remove + swap actions"
```

---

## Phase 5 — `SceneVariantSwitcher` component

### Task 11: Build switcher with upward-opening dropdown + tests

**Files:**
- Create: `src/components/SceneVariantSwitcher.js`
- Create: `src/components/SceneVariantSwitcher.css`
- Create: `src/components/SceneVariantSwitcher.test.js`

- [ ] **Step 1: Write failing tests**

```jsx
// src/components/SceneVariantSwitcher.test.js
import { render, screen, fireEvent } from '@testing-library/react';
import SceneVariantSwitcher from './SceneVariantSwitcher';

describe('SceneVariantSwitcher', () => {
  test('renders nothing if setupType has no variants', () => {
    const { container } = render(
      <SceneVariantSwitcher setupType="Unknown" value="x" onChange={()=>{}} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  test('shows current variant label in trigger', () => {
    render(<SceneVariantSwitcher setupType="DJ" value="dj-rooftop" onChange={()=>{}} />);
    expect(screen.getByRole('button')).toHaveTextContent(/Rooftop/i);
  });

  test('opens upward menu and lists variants for setup type', () => {
    render(<SceneVariantSwitcher setupType="DJ" value="dj-club" onChange={()=>{}} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Club Booth')).toBeInTheDocument();
    expect(screen.getByText('Rooftop')).toBeInTheDocument();
  });

  test('selecting an option fires onChange with key', () => {
    const onChange = jest.fn();
    render(<SceneVariantSwitcher setupType="DJ" value="dj-club" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('Rooftop'));
    expect(onChange).toHaveBeenCalledWith('dj-rooftop');
  });
});
```

- [ ] **Step 2: Run, confirm failure**

Run: `npm test -- --watchAll=false src/components/SceneVariantSwitcher.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```jsx
// src/components/SceneVariantSwitcher.js
import React, { useState } from 'react';
import { getVariantsForSetup, getVariantLabel } from '../utils/sceneVariants';
import './SceneVariantSwitcher.css';

export default function SceneVariantSwitcher({ setupType, value, onChange }) {
  const variants = getVariantsForSetup(setupType);
  const [open, setOpen] = useState(false);
  if (!variants.length) return null;

  const currentLabel = getVariantLabel(value) || variants[0].label;

  return (
    <div className={`svs-root ${open ? 'is-open' : ''}`}>
      {open && (
        <ul className="svs-menu">
          {variants.map((v) => (
            <li
              key={v.key}
              className={`svs-item ${v.key === value ? 'is-active' : ''}`}
              onClick={() => { onChange(v.key); setOpen(false); }}
            >
              {v.label}
            </li>
          ))}
        </ul>
      )}
      <button className="svs-trigger" onClick={() => setOpen((s) => !s)}>
        <span>Scene: {currentLabel}</span>
        <span className="svs-caret">▴</span>
      </button>
    </div>
  );
}
```

```css
/* src/components/SceneVariantSwitcher.css */
.svs-root {
  position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
  z-index: 2500;
}
.svs-trigger {
  background: rgba(20,23,28,0.92); color: #fff;
  border: 1px solid #2a313b; border-radius: 999px;
  padding: 8px 16px; font-size: 13px;
  display: inline-flex; gap: 8px; align-items: center; cursor: pointer;
}
.svs-trigger:hover { background: #232932; }
.svs-caret { font-size: 10px; transition: transform 0.15s; }
.svs-root.is-open .svs-caret { transform: rotate(180deg); }
.svs-menu {
  position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%);
  margin: 0 0 8px; padding: 6px;
  list-style: none;
  background: rgba(20,23,28,0.96); border: 1px solid #2a313b; border-radius: 12px;
  min-width: 200px;
  box-shadow: 0 -6px 18px rgba(0,0,0,0.35);
}
.svs-item {
  padding: 8px 12px; border-radius: 8px; color: #e3e6ec; cursor: pointer; font-size: 13px;
}
.svs-item:hover { background: #1f242d; }
.svs-item.is-active { background: #15303d; color: #00a2ff; }
```

- [ ] **Step 4: Run tests, confirm pass**

Run: `npm test -- --watchAll=false src/components/SceneVariantSwitcher.test.js`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/SceneVariantSwitcher.js src/components/SceneVariantSwitcher.css src/components/SceneVariantSwitcher.test.js
git commit -m "feat(ui): SceneVariantSwitcher with upward-opening dropdown"
```

---

## Phase 6 — Wire scene dispatcher into `ThreeScene.js`

### Task 12: Replace `createClubEnvironment` with `buildEnvironment`

**Files:**
- Modify: `src/ThreeScene.js`

- [ ] **Step 1: Add prop `sceneVariant` to `ThreeScene` (with `onSceneVariantChange` callback)**

Locate the `ThreeScene` function signature. Add `sceneVariant` and `onSceneVariantChange` to the destructured props. Default `sceneVariant` to `getDefaultVariant(currentSetupType)` when missing.

```js
// near top of src/ThreeScene.js
import { buildEnvironment } from './scenes';
import { getDefaultVariant } from './utils/sceneVariants';
```

In the component:

```js
const effectiveVariant = sceneVariant || getDefaultVariant(currentSetupType);
const sceneHandleRef = useRef(null);
```

- [ ] **Step 2: Replace both call sites of `createClubEnvironment(sceneRef.current)` with dispatcher**

Find both call sites:

Run: `grep -n "createClubEnvironment(" src/ThreeScene.js`

Replace each:

```js
// Before
createClubEnvironment(scene);

// After
if (sceneHandleRef.current) { sceneHandleRef.current.dispose(); }
sceneHandleRef.current = buildEnvironment(scene, effectiveVariant, { djTableRef });
```

- [ ] **Step 3: Add a `useEffect` that rebuilds when `effectiveVariant` changes**

```js
useEffect(() => {
  if (!sceneRef.current) return;
  if (sceneHandleRef.current) sceneHandleRef.current.dispose();
  sceneHandleRef.current = buildEnvironment(sceneRef.current, effectiveVariant, { djTableRef });
}, [effectiveVariant]);
```

- [ ] **Step 4: Delete the in-file `createClubEnvironment` function**

Remove the entire `function createClubEnvironment(scene) { ... }` block (starts around line 2180). Confirm with:

Run: `grep -n "createClubEnvironment" src/ThreeScene.js`
Expected: no matches.

- [ ] **Step 5: Manual smoke test**

Run: `npm start`
Open the builder, switch setup types (DJ → Producer → Musician), confirm each still renders the existing (variant A) environment. No console errors about geometry/material disposal.

- [ ] **Step 6: Commit**

```bash
git add src/ThreeScene.js
git commit -m "refactor(scene): replace createClubEnvironment with variant dispatcher"
```

---

### Task 13: Plumb `sceneVariant` through `App.js`

**Files:**
- Modify: `src/App.js`

- [ ] **Step 1: Add state for current scene variant**

```js
import { getDefaultVariant } from './utils/sceneVariants';
import SceneVariantSwitcher from './components/SceneVariantSwitcher';

// inside App component
const [sceneVariant, setSceneVariant] = useState(null);

// When setup type changes or setup is loaded, reset to default for that type if no value:
useEffect(() => {
  if (!sceneVariant && currentSetupType) {
    setSceneVariant(getDefaultVariant(currentSetupType));
  }
}, [currentSetupType, sceneVariant]);
```

- [ ] **Step 2: Pass `sceneVariant` to `ThreeScene` and render switcher**

```jsx
<ThreeScene
  /* …existing props… */
  sceneVariant={sceneVariant}
  onSceneVariantChange={setSceneVariant}
/>

{selectedSetup === null /* in-builder */ && currentSetupType && (
  <SceneVariantSwitcher
    setupType={currentSetupType}
    value={sceneVariant || getDefaultVariant(currentSetupType)}
    onChange={setSceneVariant}
  />
)}
```

- [ ] **Step 3: When setup is loaded from Firestore, hydrate `sceneVariant`**

Find the place where a saved setup is loaded (look for where `actualDevices` or `setupDevices` is populated from a setup doc). Add:

```js
setSceneVariant(loadedSetup.sceneVariant || getDefaultVariant(loadedSetup.setupType));
```

- [ ] **Step 4: Manual smoke test**

Run: `npm start`. Switch setup type — verify the switcher updates its variant list. Click the switcher — verify it opens upward and lists the right variants. Pick the new variant — verify the scene rebuilds.

- [ ] **Step 5: Commit**

```bash
git add src/App.js
git commit -m "feat(app): thread sceneVariant + render SceneVariantSwitcher"
```

---

### Task 14: Persist `sceneVariant` on save

**Files:**
- Modify: `src/components/SaveSetupButton.js`

- [ ] **Step 1: Read the file and find the Firestore write**

Run: `grep -n "addDoc\|setDoc\|sceneVariant\|ownerId" src/components/SaveSetupButton.js`

- [ ] **Step 2: Add `sceneVariant` to the saved payload**

Add `sceneVariant` to the props the button accepts (passed from App.js), and include it in the doc payload:

```js
const payload = {
  // ...existing fields
  sceneVariant: sceneVariant || null,
};
```

- [ ] **Step 3: Pass `sceneVariant` prop from App.js**

```jsx
<SaveSetupButton
  /* …existing… */
  sceneVariant={sceneVariant}
/>
```

- [ ] **Step 4: Manual verify**

Run: `npm start`. Build a setup, switch the scene variant, save, reload page, load the setup → scene loads with the saved variant.

- [ ] **Step 5: Commit**

```bash
git add src/components/SaveSetupButton.js src/App.js
git commit -m "feat(save): persist sceneVariant on setup docs"
```

---

## Phase 7 — Wire `ProductSelectorModal` into `ThreeScene.js`

### Task 15: Replace the inline modal

**Files:**
- Modify: `src/ThreeScene.js`

- [ ] **Step 1: Find and read the existing inline modal**

Run: `grep -n "showSearchModal\|productSearchModal\|recType\|selectedGhost" src/ThreeScene.js | head -30`

Identify the JSX block that renders the existing modal (around line 4660+). Note the existing `onClose` and the `onSelect` paths.

- [ ] **Step 2: Replace JSX with `ProductSelectorModal`**

```jsx
// at top of file
import ProductSelectorModal from './components/ProductSelectorModal';
```

```jsx
// replace existing inline modal block
{showSearchModal && (
  <ProductSelectorModal
    isOpen={showSearchModal}
    mode={swapTargetUniqueIdRef.current ? 'swap' : 'place'}
    recommendedType={activeSpot?.userData?.recommendedType || 'Any Device'}
    currentProductId={
      swapTargetUniqueIdRef.current
        ? placedDevicesListRef.current.find((d) => d.uniqueId === swapTargetUniqueIdRef.current)?.id
        : null
    }
    products={availableProducts}
    onSelect={(product) => handleProductSelected(product)}
    onClose={() => {
      setShowSearchModal(false);
      swapTargetUniqueIdRef.current = null;
    }}
  />
)}
```

- [ ] **Step 3: Add `swapTargetUniqueIdRef`**

```js
const swapTargetUniqueIdRef = useRef(null);
```

- [ ] **Step 4: Implement `handleProductSelected`**

```js
const handleProductSelected = (product) => {
  const swapId = swapTargetUniqueIdRef.current;
  if (swapId) {
    // Find the existing device, capture its spot, remove it, place new at same spot
    const existing = placedDevicesListRef.current.find((d) => d.uniqueId === swapId);
    if (existing) {
      const spotIndex = existing.placementIndex;
      removeDevice(swapId);
      addProductToPosition(product, spotIndex);
    }
    swapTargetUniqueIdRef.current = null;
  } else {
    addProductToPosition(product, selectedGhostIndex);
  }
  setShowSearchModal(false);
};
```

(Adjust to match real function names: `addProductToPosition`, `removeDevice`, `selectedGhostIndex` already exist in `ThreeScene.js`.)

- [ ] **Step 5: Delete the obsolete inline modal JSX and any now-unused state (e.g., local search query handled inside the new modal)**

- [ ] **Step 6: Manual smoke test**

Run: `npm start`. Click a ghost spot — verify the modal opens with only that spot's type. Toggle "Show all products" — verify all show. Search — verify filtering works. Select a product — verify placement.

- [ ] **Step 7: Commit**

```bash
git add src/ThreeScene.js
git commit -m "refactor(scene): use ProductSelectorModal with hard-filter + swap"
```

---

## Phase 8 — Device hover menu integration

### Task 16: Add hover raycast + click handling for placed devices

**Files:**
- Modify: `src/ThreeScene.js`

- [ ] **Step 1: Add state and refs for hover/menu**

```js
import DeviceHoverMenu from './components/DeviceHoverMenu';
import { Vector3 } from 'three';

// inside the component
const [menuDevice, setMenuDevice] = useState(null);
const [menuScreenPos, setMenuScreenPos] = useState({ x: 0, y: 0 });
const hoveredDeviceUniqueIdRef = useRef(null);
const hoverHighlightStateRef = useRef(new Map()); // uniqueId -> [{ mesh, emissive, intensity }]
```

- [ ] **Step 2: Add helper functions for highlight on/off**

```js
const applyHoverHighlight = (uniqueId) => {
  const entry = devicesRef.current[uniqueId];
  if (!entry || !entry.model) return;
  const saved = [];
  entry.model.traverse((node) => {
    if (node.isMesh && node.material && 'emissive' in node.material) {
      saved.push({ mesh: node, emissive: node.material.emissive.clone(), intensity: node.material.emissiveIntensity });
      node.material.emissive.setHex(0x00a2ff);
      node.material.emissiveIntensity = 0.35;
    }
  });
  hoverHighlightStateRef.current.set(uniqueId, saved);
};

const clearHoverHighlight = (uniqueId) => {
  const saved = hoverHighlightStateRef.current.get(uniqueId);
  if (!saved) return;
  saved.forEach(({ mesh, emissive, intensity }) => {
    if (mesh.material && 'emissive' in mesh.material) {
      mesh.material.emissive.copy(emissive);
      mesh.material.emissiveIntensity = intensity;
    }
  });
  hoverHighlightStateRef.current.delete(uniqueId);
};
```

- [ ] **Step 3: Extend the existing `pointermove` handler to raycast against placed devices**

Find the existing `onPointerMove` at `src/ThreeScene.js:1404`. Inside the same handler (after ghost-spot raycasting is done), add:

```js
// Raycast against placed device models
const deviceMeshes = Object.values(devicesRef.current)
  .filter((e) => e?.model)
  .map((e) => e.model);
const deviceHits = raycaster.intersectObjects(deviceMeshes, true);

let newHoverId = null;
if (deviceHits.length) {
  // Walk up to find the root model matching a devicesRef entry
  let node = deviceHits[0].object;
  while (node && !node.userData?.uniqueId) node = node.parent;
  newHoverId = node?.userData?.uniqueId || null;
}

if (newHoverId !== hoveredDeviceUniqueIdRef.current) {
  if (hoveredDeviceUniqueIdRef.current) clearHoverHighlight(hoveredDeviceUniqueIdRef.current);
  if (newHoverId) applyHoverHighlight(newHoverId);
  hoveredDeviceUniqueIdRef.current = newHoverId;
  el.style.cursor = newHoverId ? 'pointer' : '';
}
```

NOTE: When `addProductToPosition` places a model, ensure the root model has `model.userData.uniqueId = uniqueId`. Verify and add if missing.

- [ ] **Step 4: Tag device models with `uniqueId` on placement**

Find `addProductToPosition`. After the model is loaded and before adding to scene, set:

```js
model.userData.uniqueId = uniqueId;
```

- [ ] **Step 5: Add click handler to open the hover menu**

Find the existing pointer-down/click handler that triggers mini-profile (`setMiniProfileDevice(...)`). Adjacent to it, after determining a device was clicked, also set:

```js
const projectAnchor = () => {
  const entry = devicesRef.current[uniqueId];
  if (!entry?.model || !cameraRef.current) return { x: 0, y: 0 };
  const box = new THREE.Box3().setFromObject(entry.model);
  const top = new THREE.Vector3((box.min.x + box.max.x) / 2, box.max.y, (box.min.z + box.max.z) / 2);
  top.project(cameraRef.current);
  const rect = mountRef.current.getBoundingClientRect();
  return {
    x: rect.left + ((top.x + 1) / 2) * rect.width,
    y: rect.top + ((1 - top.y) / 2) * rect.height,
  };
};

setMenuDevice(deviceObj);
setMenuScreenPos(projectAnchor());
```

- [ ] **Step 6: Keep the menu anchor synced each render frame while open**

Inside the render loop (find the `requestAnimationFrame` body / `renderer.render(...)` call), if `menuDevice` is set, call `setMenuScreenPos(projectAnchor())`. To avoid excessive re-renders, only update when delta > 1px.

Practical alternative: use a `ref` for the anchor and store position on a DOM-level CSS variable directly. To keep code simple, accept the React state update on every animation frame the menu is open — it's only one render and only while a single menu is open.

- [ ] **Step 7: Render `DeviceHoverMenu`**

```jsx
<DeviceHoverMenu
  device={menuDevice}
  screenPosition={menuScreenPos}
  onRemove={(d) => { removeDevice(d.uniqueId); setMenuDevice(null); }}
  onSwap={(d) => {
    swapTargetUniqueIdRef.current = d.uniqueId;
    // open the modal for that spot
    const entry = placedDevicesListRef.current.find((x) => x.uniqueId === d.uniqueId);
    if (entry) {
      setSelectedGhostIndex(entry.placementIndex);
      setShowSearchModal(true);
    }
    setMenuDevice(null);
  }}
  onClose={() => setMenuDevice(null)}
/>
```

- [ ] **Step 8: Dismiss on outside click + Esc**

```js
useEffect(() => {
  if (!menuDevice) return;
  const onKey = (e) => { if (e.key === 'Escape') setMenuDevice(null); };
  const onClick = (e) => {
    // The menu stops propagation; any click reaching here closes it.
    setMenuDevice(null);
  };
  window.addEventListener('keydown', onKey);
  window.addEventListener('mousedown', onClick);
  return () => {
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('mousedown', onClick);
  };
}, [menuDevice]);
```

- [ ] **Step 9: Manual smoke test**

Run: `npm start`. Place a device. Hover — verify blue rim highlight. Move away — verify highlight clears. Click — verify menu appears anchored above the device. Orbit the camera — verify menu follows. Click ✕ — device gone. Place again, click ⟳ — modal opens in swap mode with current product badged.

- [ ] **Step 10: Commit**

```bash
git add src/ThreeScene.js
git commit -m "feat(scene): device hover highlight + swap/remove action menu"
```

---

## Phase 9 — Remove obsolete UI

### Task 17: Remove bottom-right "Current Setup" panel

**Files:**
- Modify: `src/ThreeScene.js`

- [ ] **Step 1: Locate the panel**

Run: `grep -n "Current Setup\|placedDevicesList.map\|currentDevicesPanel" src/ThreeScene.js`

The relevant JSX is around lines 4574–4600 (the panel that maps `placedDevicesList` to a list).

- [ ] **Step 2: Delete that JSX block**

Remove the rendered panel and any state that's only used by it (e.g., a `showCurrentSetup` toggle). `placedDevicesList` itself stays — it's used elsewhere.

- [ ] **Step 3: Manual verify**

Run: `npm start`. Confirm the bottom-right panel is gone; everything else still works.

- [ ] **Step 4: Commit**

```bash
git add src/ThreeScene.js
git commit -m "chore(ui): remove bottom-right Current Setup panel"
```

---

### Task 18: Remove `SetupTimeline` from layout

**Files:**
- Modify: `src/App.js`
- Delete: `src/SetupTimeline.js` (only if no other consumers)

- [ ] **Step 1: Confirm `SetupTimeline` is only used by `App.js`**

Run: `grep -rn "SetupTimeline" src/`
Expected: only `App.js` import and self.

- [ ] **Step 2: Remove import + render from `App.js`**

Delete the `import SetupTimeline from './SetupTimeline';` line and the `<SetupTimeline ... />` JSX.

- [ ] **Step 3: Delete the file**

```bash
git rm src/SetupTimeline.js
```

- [ ] **Step 4: Remove now-unused props plumbing (if any)**

Search for `onCategoryToggle`, `highlightedCategory` etc. in `App.js` and `ThreeScene.js`. If they're only used by the timeline-highlight feature (which is being removed), delete them. If they're shared with other features, leave them.

Run: `grep -n "highlightedCategory\|onCategoryToggle" src/App.js src/ThreeScene.js`

- [ ] **Step 5: Manual smoke test**

Run: `npm start`. Confirm no errors, the bottom bar is gone, scene switcher sits where the timeline used to be.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore(ui): remove SetupTimeline bottom bar + category glow"
```

---

## Phase 10 — Final verification

### Task 19: Run the full test suite + manual end-to-end

- [ ] **Step 1: Run all tests**

Run: `npm test -- --watchAll=false`
Expected: all tests pass.

- [ ] **Step 2: Manual end-to-end checklist**

Run: `npm start`. Verify in browser:

- [ ] Click a DJ ghost spot → modal opens with `Choose a {recommendedType}`, only matching products shown.
- [ ] Toggle "Show all products" → all products appear.
- [ ] Pick a product → placed correctly.
- [ ] Hover the placed device → blue rim highlight.
- [ ] Click it → action menu shows ✕ and ⟳ anchored above the device.
- [ ] Orbit camera → menu follows.
- [ ] Click ⟳ → modal reopens in swap mode, current product marked.
- [ ] Pick a different product → old removed, new placed at same spot.
- [ ] Click ✕ → device removed; menu closes.
- [ ] Open the scene switcher (bottom-center) → it opens upward, lists DJ variants.
- [ ] Select Rooftop → scene changes (concrete + sky + clouds), devices and table stay in place.
- [ ] Save the setup → reload page → load the setup → Rooftop scene restored, devices intact.
- [ ] Switch setup type to Producer → switcher updates to Producer variants. Pick "Bedroom Studio" → scene rebuilds.
- [ ] Same for Musician → "Live Stage" works.
- [ ] No bottom SetupTimeline. No bottom-right Current Setup panel.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: clean build, no warnings about missing deps.

- [ ] **Step 4: Update `CLAUDE.md`**

Append a short note under "3D Scene System" about `src/scenes/` and `sceneVariant`, and remove/update the `SetupTimeline.js` reference (move to legacy section or delete the line).

- [ ] **Step 5: Final commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for scenes module + sceneVariant field"
```

---

## Self-Review Notes

- **Spec coverage:** Hover menu (Tasks 10, 16), hard-filter modal (Tasks 1, 9, 15), scene variants (Tasks 2–8, 12–14), removals (17–18), persistence (14), legacy default (Task 13 step 3).
- **Type consistency:** `sceneVariant` (string), `uniqueId` (string), `recommendedType` (string) used consistently. `ctx.djTableRef` shape consistent across all scene modules.
- **No placeholders:** every step has executable content or exact commands.
- **Risks called out:** scene cleanup correctness handled by per-variant `dispose()` + dispatcher safety-net; hover menu DOM placement uses screen projection of bounding-box top-center; swap flow re-uses `placementIndex` to land at the same spot.
