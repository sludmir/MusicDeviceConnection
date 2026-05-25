# Admin Ghost-Spot Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let signed-in admins right-click ghost placement squares in the 3D builder to move, remove, or add them, with the layout saved globally per scene variant in Firestore.

**Architecture:** A new pure util (`ghostSpotLayout.js`) becomes the single source of truth for default spot layouts and the suggestion dropdown options, and wraps Firestore load/save. `ThreeScene.js` loads the active variant's layout into a ref and builds ghost spots from it (replacing the hardcoded `switch`). Two small React components render the admin-only right-click menu and the numeric editor panel. A Firestore rule restricts writes to admins.

**Tech Stack:** React 18 (CRA), Three.js, Firebase v10 modular SDK (Firestore), Jest + @testing-library/react (via react-scripts).

---

## File Structure

- **Create** `src/utils/ghostSpotLayout.js` — defaults, suggestion options, Firestore load/save.
- **Create** `src/utils/ghostSpotLayout.test.js` — unit tests for the util.
- **Create** `src/components/GhostSpotContextMenu.js` + `.css` — right-click menu (Move / Add adjacent / Remove).
- **Create** `src/components/GhostSpotContextMenu.test.js` — component tests.
- **Create** `src/components/GhostSpotEditorPanel.js` + `.css` — numeric X/Y/Z/rotation/size editor + add-mode suggestion dropdown.
- **Create** `src/components/GhostSpotEditorPanel.test.js` — component tests.
- **Modify** `src/ThreeScene.js` — admin detection, layout ref, `createGhostPlacementSpots` refactor, contextmenu wiring, render menu + panel, edit handlers.
- **Modify** `firestore.rules` — add `ghostSpotLayouts` collection rule.

---

## Task 1: `ghostSpotLayout.js` util — defaults + suggestion options

**Files:**
- Create: `src/utils/ghostSpotLayout.js`
- Test: `src/utils/ghostSpotLayout.test.js`

This task implements only the **pure** parts: `getDefaultLayout` and `SUGGESTION_OPTIONS`. Firestore `loadLayout`/`saveLayout` come in Task 2.

- [ ] **Step 1: Write the failing test**

Create `src/utils/ghostSpotLayout.test.js`:

```js
import { getDefaultLayout, SUGGESTION_OPTIONS, makeSpotType } from './ghostSpotLayout';

describe('getDefaultLayout', () => {
  test('DJ layout contains the mixer spot and four player spots', () => {
    const dj = getDefaultLayout('DJ');
    const types = dj.map((s) => s.type);
    expect(types).toContain('middle');
    expect(types).toContain('middle_left');
    expect(types).toContain('middle_right');
    expect(types).toContain('far_left');
    expect(types).toContain('far_right');
  });

  test('DJ mixer spot has Mixer recommendedType and is not reveal-gated', () => {
    const mixer = getDefaultLayout('DJ').find((s) => s.type === 'middle');
    expect(mixer.recommendedType).toBe('Mixer (DJM)');
    expect(mixer.revealAfterBasic).toBe(false);
    expect(mixer).toMatchObject({ x: 0, y: 1.05, z: 0 });
  });

  test('DJ FX spots are reveal-gated (revealAfterBasic true)', () => {
    const fxTop = getDefaultLayout('DJ').find((s) => s.type === 'fx_top');
    expect(fxTop.revealAfterBasic).toBe(true);
    expect(fxTop.recommendedType).toBe('FX Unit (RMX-1000)');
  });

  test('DJ default layout does NOT include the never-rendered inner/back spots', () => {
    const types = getDefaultLayout('DJ').map((s) => s.type);
    expect(types).not.toContain('middle_left_inner');
    expect(types).not.toContain('middle_right_inner');
    expect(types).not.toContain('middle_back');
  });

  test('Producer layout has desk center as Audio Interface and 8 rack spots', () => {
    const prod = getDefaultLayout('Producer');
    expect(prod.find((s) => s.type === 'desk_center').recommendedType).toBe('Audio Interface');
    expect(prod.filter((s) => s.type.startsWith('rack_')).length).toBe(8);
  });

  test('Musician layout has 4 pedal spots and 2 amps', () => {
    const mus = getDefaultLayout('Musician');
    expect(mus.filter((s) => s.type.startsWith('pedal_')).length).toBe(4);
    expect(mus.filter((s) => s.type.startsWith('amp_')).length).toBe(2);
  });

  test('every default spot has a stable id, numeric coords and a recommendedType', () => {
    for (const setupType of ['DJ', 'Producer', 'Musician']) {
      for (const spot of getDefaultLayout(setupType)) {
        expect(typeof spot.id).toBe('string');
        expect(typeof spot.type).toBe('string');
        expect(typeof spot.recommendedType).toBe('string');
        expect(typeof spot.x).toBe('number');
        expect(typeof spot.y).toBe('number');
        expect(typeof spot.z).toBe('number');
        expect(typeof spot.revealAfterBasic).toBe('boolean');
      }
    }
  });

  test('unknown setup type returns empty array', () => {
    expect(getDefaultLayout('Nope')).toEqual([]);
  });
});

describe('SUGGESTION_OPTIONS', () => {
  test('includes the union of recommendedType labels plus Any Device', () => {
    expect(SUGGESTION_OPTIONS).toEqual(expect.arrayContaining([
      'Mixer (DJM)', 'Player (CDJ)', 'FX Unit (RMX-1000)', 'FX / Filter (Revolo)',
      'FX Unit / Sampler', 'Speaker', 'Audio Interface', 'Controller / Synth',
      'Rack Unit / Processor', 'Studio Monitor', 'Instrument / Mic', 'Guitar / Bass',
      'Keyboard / Instrument', 'Drums / Instrument', 'Effects Pedal',
      'Amplifier / Monitor', 'Any Device',
    ]));
  });

  test('has no duplicate entries', () => {
    expect(new Set(SUGGESTION_OPTIONS).size).toBe(SUGGESTION_OPTIONS.length);
  });
});

describe('makeSpotType', () => {
  test('generates a unique custom- prefixed type', () => {
    const a = makeSpotType();
    const b = makeSpotType();
    expect(a.startsWith('custom-')).toBe(true);
    expect(a).not.toBe(b);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `CI=true npx react-scripts test src/utils/ghostSpotLayout.test.js --watchAll=false`
Expected: FAIL — "Cannot find module './ghostSpotLayout'".

- [ ] **Step 3: Write the implementation**

Create `src/utils/ghostSpotLayout.js`:

```js
// Single source of truth for ghost placement-spot layouts.
//
// Each spot: { id, type, recommendedType, x, y, z, rotationY?, size?, revealAfterBasic }
// - `type` is the placement identity saved setups match against (device.spotType).
// - `revealAfterBasic`: only show once the setup's "brain"/basic setup is complete
//   (preserves the DJ behavior where FX spots appear after the mixer is placed).
//
// getDefaultLayout(setupType) returns the in-code fallback used until an admin
// saves a layout for a given scene variant.

const DEFAULT_SIZE = { width: 0.3, depth: 0.3 };

// --- DJ -------------------------------------------------------------------
// Only the spots actually rendered today are included. The inner/back spots
// (middle_left_inner, middle_right_inner, middle_back) were defined but never
// shown, so they are intentionally omitted.
const DJ_SPOTS = [
  { type: 'middle',      recommendedType: 'Mixer (DJM)',         x: 0,    y: 1.05, z: 0,     revealAfterBasic: false },
  { type: 'middle_left', recommendedType: 'Player (CDJ)',        x: -1.5, y: 1.05, z: 0,     revealAfterBasic: false },
  { type: 'middle_right',recommendedType: 'Player (CDJ)',        x: 1.5,  y: 1.05, z: 0,     revealAfterBasic: false },
  { type: 'far_left',    recommendedType: 'Player (CDJ)',        x: -3.0, y: 1.05, z: 0,     revealAfterBasic: false },
  { type: 'far_right',   recommendedType: 'Player (CDJ)',        x: 3.0,  y: 1.05, z: 0,     revealAfterBasic: false },
  { type: 'speaker_left',  recommendedType: 'Speaker', x: 5.5,  y: 0.05, z: -0.25, size: { width: 0.5, depth: 0.5 }, revealAfterBasic: false },
  { type: 'speaker_right', recommendedType: 'Speaker', x: -5.5, y: 0.05, z: -0.25, size: { width: 0.5, depth: 0.5 }, revealAfterBasic: false },
  { type: 'fx_top',   recommendedType: 'FX Unit (RMX-1000)', x: 0,     y: 1.42, z: -0.55, size: { width: 0.28, depth: 0.22 }, revealAfterBasic: true },
  { type: 'fx_left',  recommendedType: 'FX / Filter (Revolo)', x: -0.75, y: 1.05, z: -0.22, size: { width: 0.22, depth: 0.22 }, revealAfterBasic: true },
  { type: 'fx_right', recommendedType: 'FX / Filter (Revolo)', x: 0.75,  y: 1.05, z: -0.22, size: { width: 0.22, depth: 0.22 }, revealAfterBasic: true },
  { type: 'fx_front', recommendedType: 'FX Unit / Sampler', x: 0,     y: 1.05, z: 0.45,  size: { width: 0.28, depth: 0.18 }, revealAfterBasic: true },
];

// --- Producer -------------------------------------------------------------
const PRODUCER_SPOTS = [
  { type: 'desk_center', recommendedType: 'Audio Interface',   x: 0,     y: 0.97, z: -0.25, size: { width: 0.35, depth: 0.25 }, revealAfterBasic: false },
  { type: 'desk_left',   recommendedType: 'Controller / Synth',x: -0.55, y: 0.97, z: -0.25, size: { width: 0.35, depth: 0.25 }, revealAfterBasic: false },
  { type: 'desk_right',  recommendedType: 'Controller / Synth',x: 0.55,  y: 0.97, z: -0.25, size: { width: 0.35, depth: 0.25 }, revealAfterBasic: false },
  { type: 'monitor_left',  recommendedType: 'Studio Monitor', x: -1.2, y: 1.18, z: -0.9, size: { width: 0.24, depth: 0.18 }, revealAfterBasic: false },
  { type: 'monitor_right', recommendedType: 'Studio Monitor', x: 1.2,  y: 1.18, z: -0.9, size: { width: 0.24, depth: 0.18 }, revealAfterBasic: false },
  { type: 'rack_left_1',  recommendedType: 'Rack Unit / Processor', x: -2.2, y: 0.35, z: -0.25, size: { width: 0.42, depth: 0.28 }, rotationY: Math.PI / 4,  revealAfterBasic: false },
  { type: 'rack_left_2',  recommendedType: 'Rack Unit / Processor', x: -2.2, y: 0.65, z: -0.25, size: { width: 0.42, depth: 0.28 }, rotationY: Math.PI / 4,  revealAfterBasic: false },
  { type: 'rack_left_3',  recommendedType: 'Rack Unit / Processor', x: -2.2, y: 0.95, z: -0.25, size: { width: 0.42, depth: 0.28 }, rotationY: Math.PI / 4,  revealAfterBasic: false },
  { type: 'rack_left_4',  recommendedType: 'Rack Unit / Processor', x: -2.2, y: 1.25, z: -0.25, size: { width: 0.42, depth: 0.28 }, rotationY: Math.PI / 4,  revealAfterBasic: false },
  { type: 'rack_right_1', recommendedType: 'Rack Unit / Processor', x: 2.2,  y: 0.35, z: -0.25, size: { width: 0.42, depth: 0.28 }, rotationY: -Math.PI / 4, revealAfterBasic: false },
  { type: 'rack_right_2', recommendedType: 'Rack Unit / Processor', x: 2.2,  y: 0.65, z: -0.25, size: { width: 0.42, depth: 0.28 }, rotationY: -Math.PI / 4, revealAfterBasic: false },
  { type: 'rack_right_3', recommendedType: 'Rack Unit / Processor', x: 2.2,  y: 0.95, z: -0.25, size: { width: 0.42, depth: 0.28 }, rotationY: -Math.PI / 4, revealAfterBasic: false },
  { type: 'rack_right_4', recommendedType: 'Rack Unit / Processor', x: 2.2,  y: 1.25, z: -0.25, size: { width: 0.42, depth: 0.28 }, rotationY: -Math.PI / 4, revealAfterBasic: false },
];

// --- Musician -------------------------------------------------------------
const MUSICIAN_SPOTS = [
  { type: 'stage_center', recommendedType: 'Instrument / Mic',     x: 0,    y: 0.05, z: 0.4,  size: { width: 0.4, depth: 0.4 },  revealAfterBasic: false },
  { type: 'stage_left',   recommendedType: 'Guitar / Bass',        x: -2.0, y: 0.39, z: 0.42, size: { width: 0.3, depth: 0.16 }, revealAfterBasic: false },
  { type: 'stage_right',  recommendedType: 'Guitar / Bass',        x: 2.0,  y: 0.39, z: 0.42, size: { width: 0.3, depth: 0.16 }, revealAfterBasic: false },
  { type: 'stage_back_left',   recommendedType: 'Keyboard / Instrument', x: -1.8, y: 0.82, z: -1.2, size: { width: 0.5, depth: 0.35 }, revealAfterBasic: false },
  { type: 'stage_back_center', recommendedType: 'Drums / Instrument',    x: 0,    y: 0.17, z: -1.3, size: { width: 0.6, depth: 0.5 },  revealAfterBasic: false },
  { type: 'stage_back_right',  recommendedType: 'Keyboard / Instrument', x: 1.8,  y: 0.82, z: -1.2, size: { width: 0.5, depth: 0.35 }, revealAfterBasic: false },
  { type: 'pedal_1', recommendedType: 'Effects Pedal', x: -2.2, y: 0.02, z: 0.75, size: { width: 0.22, depth: 0.16 }, revealAfterBasic: false },
  { type: 'pedal_2', recommendedType: 'Effects Pedal', x: -1.8, y: 0.02, z: 0.75, size: { width: 0.22, depth: 0.16 }, revealAfterBasic: false },
  { type: 'pedal_3', recommendedType: 'Effects Pedal', x: 1.8,  y: 0.02, z: 0.75, size: { width: 0.22, depth: 0.16 }, revealAfterBasic: false },
  { type: 'pedal_4', recommendedType: 'Effects Pedal', x: 2.2,  y: 0.02, z: 0.75, size: { width: 0.22, depth: 0.16 }, revealAfterBasic: false },
  { type: 'amp_left',  recommendedType: 'Amplifier / Monitor', x: -3.0, y: 0.05, z: -0.3, size: { width: 0.5, depth: 0.4 }, revealAfterBasic: false },
  { type: 'amp_right', recommendedType: 'Amplifier / Monitor', x: 3.0,  y: 0.05, z: -0.3, size: { width: 0.5, depth: 0.4 }, revealAfterBasic: false },
];

const DEFAULTS_BY_TYPE = {
  DJ: DJ_SPOTS,
  Producer: PRODUCER_SPOTS,
  Musician: MUSICIAN_SPOTS,
};

// Union of every recommendedType label across all setup types, plus "Any Device".
// (Per-setup-type filtering of this list is deferred — see the design doc.)
export const SUGGESTION_OPTIONS = (() => {
  const labels = [];
  for (const list of Object.values(DEFAULTS_BY_TYPE)) {
    for (const spot of list) {
      if (!labels.includes(spot.recommendedType)) labels.push(spot.recommendedType);
    }
  }
  labels.push('Any Device');
  return labels;
})();

export function makeSpotType() {
  return `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function normalizeSpot(spot) {
  return {
    id: spot.id || spot.type,
    type: spot.type,
    recommendedType: spot.recommendedType || 'Any Device',
    x: Number(spot.x) || 0,
    y: Number(spot.y) || 0,
    z: Number(spot.z) || 0,
    rotationY: Number(spot.rotationY) || 0,
    size: spot.size ? { width: Number(spot.size.width), depth: Number(spot.size.depth) } : { ...DEFAULT_SIZE },
    revealAfterBasic: !!spot.revealAfterBasic,
  };
}

export function getDefaultLayout(setupType) {
  const list = DEFAULTS_BY_TYPE[setupType];
  if (!list) return [];
  return list.map(normalizeSpot);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `CI=true npx react-scripts test src/utils/ghostSpotLayout.test.js --watchAll=false`
Expected: PASS (all tests green).

- [ ] **Step 5: Commit**

```bash
git add src/utils/ghostSpotLayout.js src/utils/ghostSpotLayout.test.js
git commit -m "feat(ghost-spots): default layouts + suggestion options util"
```

---

## Task 2: Firestore load/save in `ghostSpotLayout.js`

**Files:**
- Modify: `src/utils/ghostSpotLayout.js`
- Test: `src/utils/ghostSpotLayout.test.js`

- [ ] **Step 1: Write the failing test**

Append to `src/utils/ghostSpotLayout.test.js` (and add the mocks at the very top of the file, before the existing imports):

Add to the TOP of the file:

```js
jest.mock('firebase/firestore', () => ({
  doc: jest.fn((_db, col, id) => ({ col, id })),
  getDoc: jest.fn(),
  setDoc: jest.fn(() => Promise.resolve()),
  serverTimestamp: jest.fn(() => 'SERVER_TS'),
}));
jest.mock('../firebaseConfig', () => ({ db: {}, auth: { currentUser: { uid: 'admin-uid' } } }));
```

Append these describe blocks to the end of the file:

```js
import { loadLayout, saveLayout, layoutDocId } from './ghostSpotLayout';
import { getDoc, setDoc, doc } from 'firebase/firestore';

describe('layoutDocId', () => {
  test('joins setupType and settingKey', () => {
    expect(layoutDocId('DJ', 'club')).toBe('DJ__club');
    expect(layoutDocId('Musician', 'guitarRoom')).toBe('Musician__guitarRoom');
  });
});

describe('loadLayout', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns stored spots when the doc exists', async () => {
    const stored = [{ id: 'x', type: 'x', recommendedType: 'Speaker', x: 1, y: 2, z: 3, rotationY: 0, size: { width: 0.3, depth: 0.3 }, revealAfterBasic: false }];
    getDoc.mockResolvedValueOnce({ exists: () => true, data: () => ({ spots: stored }) });
    const result = await loadLayout('DJ', 'club');
    expect(doc).toHaveBeenCalledWith({}, 'ghostSpotLayouts', 'DJ__club');
    expect(result).toEqual(stored);
  });

  test('falls back to default layout when the doc does not exist', async () => {
    getDoc.mockResolvedValueOnce({ exists: () => false });
    const result = await loadLayout('DJ', 'club');
    expect(result.find((s) => s.type === 'middle').recommendedType).toBe('Mixer (DJM)');
  });

  test('falls back to default layout on read error', async () => {
    getDoc.mockRejectedValueOnce(new Error('offline'));
    const result = await loadLayout('Producer', 'studio');
    expect(result.find((s) => s.type === 'desk_center')).toBeTruthy();
  });
});

describe('saveLayout', () => {
  beforeEach(() => jest.clearAllMocks());

  test('writes the doc with metadata', async () => {
    const spots = [{ id: 'a', type: 'a', recommendedType: 'Speaker', x: 0, y: 0, z: 0, rotationY: 0, size: { width: 0.3, depth: 0.3 }, revealAfterBasic: false }];
    await saveLayout('DJ', 'rooftop', spots);
    expect(setDoc).toHaveBeenCalledTimes(1);
    const [, payload] = setDoc.mock.calls[0];
    expect(payload).toMatchObject({
      setupType: 'DJ',
      settingKey: 'rooftop',
      spots,
      updatedBy: 'admin-uid',
      updatedAt: 'SERVER_TS',
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `CI=true npx react-scripts test src/utils/ghostSpotLayout.test.js --watchAll=false`
Expected: FAIL — `loadLayout`, `saveLayout`, `layoutDocId` are not exported.

- [ ] **Step 3: Write the implementation**

Add to the TOP of `src/utils/ghostSpotLayout.js` (after the file's opening comment, before `DEFAULT_SIZE`):

```js
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';

const COLLECTION = 'ghostSpotLayouts';
```

Add these exports at the BOTTOM of `src/utils/ghostSpotLayout.js`:

```js
export function layoutDocId(setupType, settingKey) {
  return `${setupType}__${settingKey}`;
}

export async function loadLayout(setupType, settingKey) {
  try {
    const snap = await getDoc(doc(db, COLLECTION, layoutDocId(setupType, settingKey)));
    if (snap.exists()) {
      const data = snap.data();
      if (Array.isArray(data.spots) && data.spots.length > 0) {
        return data.spots.map(normalizeSpot);
      }
    }
  } catch (err) {
    console.error('loadLayout failed, using defaults:', err);
  }
  return getDefaultLayout(setupType);
}

export async function saveLayout(setupType, settingKey, spots) {
  const payload = {
    setupType,
    settingKey,
    spots: spots.map(normalizeSpot),
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser?.uid || null,
  };
  await setDoc(doc(db, COLLECTION, layoutDocId(setupType, settingKey)), payload);
}
```

Note: `loadLayout`/`saveLayout` call `normalizeSpot`, which is already defined in the file from Task 1.

- [ ] **Step 4: Run test to verify it passes**

Run: `CI=true npx react-scripts test src/utils/ghostSpotLayout.test.js --watchAll=false`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/ghostSpotLayout.js src/utils/ghostSpotLayout.test.js
git commit -m "feat(ghost-spots): Firestore load/save for per-variant layouts"
```

---

## Task 3: `GhostSpotContextMenu` component

**Files:**
- Create: `src/components/GhostSpotContextMenu.js`
- Create: `src/components/GhostSpotContextMenu.css`
- Test: `src/components/GhostSpotContextMenu.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/components/GhostSpotContextMenu.test.js`:

```js
import { render, screen, fireEvent } from '@testing-library/react';
import GhostSpotContextMenu from './GhostSpotContextMenu';

describe('GhostSpotContextMenu', () => {
  const baseProps = {
    screenPosition: { x: 100, y: 120 },
    recommendedType: 'Mixer (DJM)',
    onMove: jest.fn(),
    onAdd: jest.fn(),
    onRemove: jest.fn(),
    onClose: jest.fn(),
  };

  test('renders the three actions and the spot label', () => {
    render(<GhostSpotContextMenu {...baseProps} />);
    expect(screen.getByText(/Mixer \(DJM\)/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /move/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add adjacent/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /remove/i })).toBeInTheDocument();
  });

  test('fires the matching callbacks', () => {
    const onMove = jest.fn();
    const onAdd = jest.fn();
    const onRemove = jest.fn();
    render(<GhostSpotContextMenu {...baseProps} onMove={onMove} onAdd={onAdd} onRemove={onRemove} />);
    fireEvent.click(screen.getByRole('button', { name: /move/i }));
    fireEvent.click(screen.getByRole('button', { name: /add adjacent/i }));
    fireEvent.click(screen.getByRole('button', { name: /remove/i }));
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  test('renders nothing without a screenPosition', () => {
    const { container } = render(<GhostSpotContextMenu {...baseProps} screenPosition={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `CI=true npx react-scripts test src/components/GhostSpotContextMenu.test.js --watchAll=false`
Expected: FAIL — "Cannot find module './GhostSpotContextMenu'".

- [ ] **Step 3: Write the implementation**

Create `src/components/GhostSpotContextMenu.js`:

```js
import React from 'react';
import './GhostSpotContextMenu.css';

export default function GhostSpotContextMenu({
  screenPosition,
  recommendedType,
  onMove,
  onAdd,
  onRemove,
  onClose,
}) {
  if (!screenPosition) return null;
  const left = screenPosition.x ?? 0;
  const top = screenPosition.y ?? 0;

  return (
    <div
      className="gscm-anchor"
      style={{ left, top }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="gscm-bubble">
        <div className="gscm-label">{recommendedType || 'Ghost spot'}</div>
        <button className="gscm-btn" onClick={onMove}>Move</button>
        <button className="gscm-btn" onClick={onAdd}>Add adjacent</button>
        <button className="gscm-btn gscm-danger" onClick={onRemove}>Remove</button>
      </div>
    </div>
  );
}
```

Create `src/components/GhostSpotContextMenu.css`:

```css
.gscm-anchor {
  position: absolute;
  z-index: 1200;
  transform: translate(-50%, 8px);
  pointer-events: auto;
}
.gscm-bubble {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  min-width: 150px;
  background: rgba(15, 15, 20, 0.95);
  border: 1px solid rgba(0, 162, 255, 0.35);
  border-radius: 10px;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(10px);
}
.gscm-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: rgba(255, 255, 255, 0.6);
  padding: 2px 4px 6px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  margin-bottom: 2px;
}
.gscm-btn {
  appearance: none;
  border: none;
  text-align: left;
  padding: 8px 10px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  background: transparent;
  cursor: pointer;
  transition: background 0.12s ease;
}
.gscm-btn:hover { background: rgba(0, 162, 255, 0.18); }
.gscm-danger { color: #ff6b6b; }
.gscm-danger:hover { background: rgba(255, 107, 107, 0.15); }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `CI=true npx react-scripts test src/components/GhostSpotContextMenu.test.js --watchAll=false`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/GhostSpotContextMenu.js src/components/GhostSpotContextMenu.css src/components/GhostSpotContextMenu.test.js
git commit -m "feat(ghost-spots): admin right-click context menu component"
```

---

## Task 4: `GhostSpotEditorPanel` component

**Files:**
- Create: `src/components/GhostSpotEditorPanel.js`
- Create: `src/components/GhostSpotEditorPanel.css`
- Test: `src/components/GhostSpotEditorPanel.test.js`

The panel is controlled-ish: it holds a local draft of the spot, calls `onChange(draft)` on every edit (for live 3D preview), `onSave(draft)` on Save, and `onCancel()` on Cancel. In `mode="add"` it also shows a suggested-type `<select>`.

- [ ] **Step 1: Write the failing test**

Create `src/components/GhostSpotEditorPanel.test.js`:

```js
import { render, screen, fireEvent } from '@testing-library/react';
import GhostSpotEditorPanel from './GhostSpotEditorPanel';

const spot = {
  id: 'middle', type: 'middle', recommendedType: 'Mixer (DJM)',
  x: 0, y: 1.05, z: 0, rotationY: 0, size: { width: 0.3, depth: 0.3 }, revealAfterBasic: false,
};

describe('GhostSpotEditorPanel', () => {
  test('shows X/Y/Z inputs seeded from the spot', () => {
    render(<GhostSpotEditorPanel mode="move" spot={spot} onChange={()=>{}} onSave={()=>{}} onCancel={()=>{}} />);
    expect(screen.getByLabelText('X')).toHaveValue(0);
    expect(screen.getByLabelText('Y')).toHaveValue(1.05);
    expect(screen.getByLabelText('Z')).toHaveValue(0);
  });

  test('editing X fires onChange with the updated draft', () => {
    const onChange = jest.fn();
    render(<GhostSpotEditorPanel mode="move" spot={spot} onChange={onChange} onSave={()=>{}} onCancel={()=>{}} />);
    fireEvent.change(screen.getByLabelText('X'), { target: { value: '1.25' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ x: 1.25 }));
  });

  test('Save fires onSave with the current draft', () => {
    const onSave = jest.fn();
    render(<GhostSpotEditorPanel mode="move" spot={spot} onChange={()=>{}} onSave={onSave} onCancel={()=>{}} />);
    fireEvent.change(screen.getByLabelText('Z'), { target: { value: '-0.5' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ z: -0.5 }));
  });

  test('Cancel fires onCancel', () => {
    const onCancel = jest.fn();
    render(<GhostSpotEditorPanel mode="move" spot={spot} onChange={()=>{}} onSave={()=>{}} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  test('add mode shows a suggested-type select with options', () => {
    render(<GhostSpotEditorPanel mode="add" spot={spot} onChange={()=>{}} onSave={()=>{}} onCancel={()=>{}} />);
    const select = screen.getByLabelText(/suggested type/i);
    expect(select).toBeInTheDocument();
    fireEvent.change(select, { target: { value: 'Speaker' } });
    expect(select).toHaveValue('Speaker');
  });

  test('move mode does NOT show the suggested-type select', () => {
    render(<GhostSpotEditorPanel mode="move" spot={spot} onChange={()=>{}} onSave={()=>{}} onCancel={()=>{}} />);
    expect(screen.queryByLabelText(/suggested type/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `CI=true npx react-scripts test src/components/GhostSpotEditorPanel.test.js --watchAll=false`
Expected: FAIL — "Cannot find module './GhostSpotEditorPanel'".

- [ ] **Step 3: Write the implementation**

Create `src/components/GhostSpotEditorPanel.js`:

```js
import React, { useState, useEffect, useCallback } from 'react';
import './GhostSpotEditorPanel.css';
import { SUGGESTION_OPTIONS } from '../utils/ghostSpotLayout';

const POS_STEP = 0.05;
const SIZE_STEP = 0.05;

export default function GhostSpotEditorPanel({ mode, spot, onChange, onSave, onCancel }) {
  const [draft, setDraft] = useState(spot);

  useEffect(() => { setDraft(spot); }, [spot]);

  const update = useCallback((patch) => {
    setDraft((prev) => {
      const next = { ...prev, ...patch };
      onChange(next);
      return next;
    });
  }, [onChange]);

  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

  const axisRow = (label, key) => (
    <div className="gsep-row" key={key}>
      <label className="gsep-axis-label" htmlFor={`gsep-${key}`}>{label}</label>
      <button type="button" className="gsep-nudge" onClick={() => update({ [key]: Math.round((num(draft[key]) - POS_STEP) * 1000) / 1000 })}>−</button>
      <input
        id={`gsep-${key}`}
        aria-label={label}
        type="number"
        step={POS_STEP}
        value={draft[key]}
        onChange={(e) => update({ [key]: num(e.target.value) })}
      />
      <button type="button" className="gsep-nudge" onClick={() => update({ [key]: Math.round((num(draft[key]) + POS_STEP) * 1000) / 1000 })}>+</button>
    </div>
  );

  const sizeRow = (label, dim) => (
    <div className="gsep-row" key={dim}>
      <label className="gsep-axis-label" htmlFor={`gsep-size-${dim}`}>{label}</label>
      <button type="button" className="gsep-nudge" onClick={() => update({ size: { ...draft.size, [dim]: Math.max(0.05, Math.round((num(draft.size?.[dim]) - SIZE_STEP) * 1000) / 1000) } })}>−</button>
      <input
        id={`gsep-size-${dim}`}
        aria-label={label}
        type="number"
        step={SIZE_STEP}
        min="0.05"
        value={draft.size?.[dim] ?? 0.3}
        onChange={(e) => update({ size: { ...draft.size, [dim]: num(e.target.value) } })}
      />
      <button type="button" className="gsep-nudge" onClick={() => update({ size: { ...draft.size, [dim]: Math.round((num(draft.size?.[dim]) + SIZE_STEP) * 1000) / 1000 } })}>+</button>
    </div>
  );

  return (
    <div className="gsep-panel" onClick={(e) => e.stopPropagation()}>
      <div className="gsep-title">{mode === 'add' ? 'Add ghost spot' : 'Move ghost spot'}</div>

      {mode === 'add' && (
        <div className="gsep-row gsep-select-row">
          <label className="gsep-axis-label" htmlFor="gsep-type">Suggested type</label>
          <select
            id="gsep-type"
            aria-label="Suggested type"
            value={draft.recommendedType}
            onChange={(e) => update({ recommendedType: e.target.value })}
          >
            {SUGGESTION_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      )}

      <div className="gsep-section">Position</div>
      {axisRow('X', 'x')}
      {axisRow('Y', 'y')}
      {axisRow('Z', 'z')}

      <div className="gsep-section">Rotation (Y, radians)</div>
      {axisRow('Rotation', 'rotationY')}

      <div className="gsep-section">Size</div>
      {sizeRow('Width', 'width')}
      {sizeRow('Depth', 'depth')}

      <div className="gsep-actions">
        <button type="button" className="gsep-btn gsep-cancel" onClick={onCancel}>Cancel</button>
        <button type="button" className="gsep-btn gsep-save" onClick={() => onSave(draft)}>Save</button>
      </div>
    </div>
  );
}
```

Note: the rotation row uses key `rotationY` with label `Rotation`, so `screen.getByLabelText('Rotation')` works and it does not collide with the X/Y/Z rows.

Create `src/components/GhostSpotEditorPanel.css`:

```css
.gsep-panel {
  position: absolute;
  top: 20px;
  right: 20px;
  z-index: 1300;
  width: 240px;
  padding: 14px;
  background: rgba(15, 15, 20, 0.96);
  border: 1px solid rgba(0, 162, 255, 0.35);
  border-radius: 12px;
  box-shadow: 0 10px 32px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(12px);
  color: #fff;
}
.gsep-title { font-size: 14px; font-weight: 700; margin-bottom: 10px; }
.gsep-section {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: rgba(255, 255, 255, 0.45);
  margin: 10px 0 4px;
}
.gsep-row { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
.gsep-axis-label { width: 64px; font-size: 12px; color: rgba(255, 255, 255, 0.8); }
.gsep-row input[type="number"] {
  flex: 1;
  min-width: 0;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  color: #fff;
  padding: 5px 6px;
  font-size: 12px;
}
.gsep-row select {
  flex: 1;
  min-width: 0;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  color: #fff;
  padding: 5px 6px;
  font-size: 12px;
}
.gsep-select-row { flex-direction: column; align-items: stretch; gap: 4px; }
.gsep-nudge {
  width: 24px; height: 24px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
}
.gsep-nudge:hover { background: rgba(0, 162, 255, 0.2); }
.gsep-actions { display: flex; gap: 8px; margin-top: 14px; }
.gsep-btn {
  flex: 1;
  padding: 8px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border: none;
}
.gsep-cancel { background: rgba(255, 255, 255, 0.1); color: #fff; }
.gsep-save { background: #00a2ff; color: #06121c; }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `CI=true npx react-scripts test src/components/GhostSpotEditorPanel.test.js --watchAll=false`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/GhostSpotEditorPanel.js src/components/GhostSpotEditorPanel.css src/components/GhostSpotEditorPanel.test.js
git commit -m "feat(ghost-spots): numeric editor panel component"
```

---

## Task 5: Wire admin editor into `ThreeScene.js`

**Files:**
- Modify: `src/ThreeScene.js`

This task has **no unit test** — `ThreeScene.js` is a ~4800-line Three.js component with no existing render test harness, and the editing flow depends on WebGL raycasting that jsdom cannot exercise. It is verified manually via the dev server in Step 11. The pure logic it depends on (layout defaults, load/save, components) is already covered by Tasks 1–4.

- [ ] **Step 1: Add imports**

In `src/ThreeScene.js`, near the existing component imports (around line 15-16 where `ProductSelectorModal` and `DeviceHoverMenu` are imported), add:

```js
import GhostSpotContextMenu from './components/GhostSpotContextMenu';
import GhostSpotEditorPanel from './components/GhostSpotEditorPanel';
import { getDefaultLayout, loadLayout, saveLayout, makeSpotType } from './utils/ghostSpotLayout';
```

- [ ] **Step 2: Add admin state, layout ref, and editor UI state**

In the component body, near the other `useState`/`useRef` declarations (e.g. just after `const ghostSpotsRef = useRef([]);` at line 57), add:

```js
const [isAdmin, setIsAdmin] = useState(false);
const isAdminRef = useRef(false);
const currentLayoutRef = useRef(getDefaultLayout(setupType || 'DJ'));
const [ghostMenu, setGhostMenu] = useState(null);   // { screenX, screenY, spotIndex }
const [ghostEditor, setGhostEditor] = useState(null); // { mode, spot, originalSpot, insert }
```

Keep `isAdminRef` in sync — add this effect near the other effects (e.g. after the existing auth effects):

```js
useEffect(() => { isAdminRef.current = isAdmin; }, [isAdmin]);
```

- [ ] **Step 3: Resolve admin claim in the auth listener**

Find the auth listener at line ~1629:

```js
const unsubscribe = auth.onAuthStateChanged((user) => {
    if (user) {
        initializeScene();
    } else {
        setError("Please sign in to access the application");
    }
});
```

Replace it with:

```js
const unsubscribe = auth.onAuthStateChanged((user) => {
    if (user) {
        user.getIdTokenResult()
            .then((token) => setIsAdmin(token.claims.admin === true || token.claims.admin === 'true'))
            .catch(() => setIsAdmin(false));
        initializeScene();
    } else {
        setIsAdmin(false);
        setError("Please sign in to access the application");
    }
});
```

- [ ] **Step 4: Load the per-variant layout when setup type / setting changes**

Add a new effect near the other setup/setting effects (e.g. after the effect at line ~4374 that rebuilds the setting). Use a token guard to ignore stale async results:

```js
const layoutLoadTokenRef = useRef(0);
useEffect(() => {
    if (!sceneInitialized) return;
    const token = ++layoutLoadTokenRef.current;
    loadLayout(currentSetupType, currentSetting).then((spots) => {
        if (token !== layoutLoadTokenRef.current) return; // a newer load superseded us
        currentLayoutRef.current = spots;
        if (sceneRef.current) {
            const isComplete = checkBasicSetupComplete(placedDevicesListRef.current || []);
            createGhostPlacementSpots(sceneRef.current, isComplete);
        }
    });
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [currentSetupType, currentSetting, sceneInitialized]);
```

Note: place the `layoutLoadTokenRef` declaration with the other refs in Step 2 instead if your linter prefers refs grouped; inline here is fine functionally.

- [ ] **Step 5: Refactor `createGhostPlacementSpots` to build from the layout ref**

Replace the body of `createGhostPlacementSpots` (lines ~3749-3890) with the version below. It keeps the same signature, the same clear-previous logic, the same `userData` shape (so all existing call sites and raycasting keep working), and applies the reveal filter:

```js
function createGhostPlacementSpots(scene, isBasicComplete = null) {
    if (!djTableRef.current) {
        console.log('Cannot create ghost spots: No DJ table reference');
        return;
    }

    const isBasicSetupCompleted = isBasicComplete !== null ? isBasicComplete : basicSetupComplete;

    // Clear previous spots
    ghostSpotsRef.current.forEach((spot) => {
        if (spot && spot.parent) scene.remove(spot);
        if (spot?.geometry) spot.geometry.dispose();
        if (spot?.material) spot.material.dispose();
    });
    ghostSpotsRef.current = [];

    const layout = (currentLayoutRef.current && currentLayoutRef.current.length)
        ? currentLayoutRef.current
        : getDefaultLayout(currentSetupType);

    // Apply reveal filter: reveal-gated spots only show once basic setup is complete.
    const visibleSpots = layout.filter((s) => !s.revealAfterBasic || isBasicSetupCompleted);

    visibleSpots.forEach((spot, index) => {
        const width = spot.size?.width ?? 0.3;
        const depth = spot.size?.depth ?? 0.3;
        const geometry = new THREE.BoxGeometry(width, 0.05, depth);
        const material = new THREE.MeshBasicMaterial({
            color: 0x808080,
            transparent: true,
            opacity: 0.4,
        });

        const ghostSquare = new THREE.Mesh(geometry, material);
        ghostSquare.position.set(spot.x, spot.y, spot.z);
        if (spot.rotationY) ghostSquare.rotation.y = spot.rotationY;
        ghostSquare.userData = {
            index,
            defaultColor: 0x808080,
            hoverColor: 0xa0a0a0,
            type: spot.type,
            recommendedType: spot.recommendedType || 'Any Device',
            spotId: spot.id,
        };

        scene.add(ghostSquare);
        ghostSpotsRef.current.push(ghostSquare);
    });

    if (rendererRef.current && cameraRef.current) {
        rendererRef.current.render(scene, cameraRef.current);
    }
}
```

Then DELETE the now-unused `djSetupSpots` constant (lines ~148-163) **only if** no other code references it. Check first:

Run: `grep -n "djSetupSpots" src/ThreeScene.js`

If the only remaining references are inside the old `createGhostPlacementSpots` you just replaced, remove the constant. If `djSetupSpots` is referenced elsewhere (e.g. the speaker-spot lookup near line 646), LEAVE the constant in place — it is independent of the ghost-spot builder and removing it would break that code. Do not remove `SPOT_TYPES`.

- [ ] **Step 6: Add the edit helper functions**

Add these helpers inside the component (e.g. just after `getRecommendedProductType` around line 4185):

```js
const rebuildGhostSpots = useCallback(() => {
    if (!sceneRef.current) return;
    const isComplete = checkBasicSetupComplete(placedDevicesListRef.current || []);
    createGhostPlacementSpots(sceneRef.current, isComplete);
// eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

const persistLayout = useCallback((spots) => {
    currentLayoutRef.current = spots;
    rebuildGhostSpots();
    saveLayout(currentSetupType, currentSetting, spots).catch((err) =>
        console.error('Failed to save ghost-spot layout:', err)
    );
}, [currentSetupType, currentSetting, rebuildGhostSpots]);

// Live preview (no Firestore write) while dragging numbers in the editor.
const previewSpot = useCallback((draftSpot) => {
    const layout = currentLayoutRef.current.map((s) => (s.id === draftSpot.id ? draftSpot : s));
    currentLayoutRef.current = layout;
    rebuildGhostSpots();
}, [rebuildGhostSpots]);
```

If `useCallback` is not already imported from React at the top of the file, add it to the React import.

- [ ] **Step 7: Add the contextmenu handler**

Add this handler in the component body (near the other handlers, e.g. after `previewSpot`):

```js
const handleGhostContextMenu = (event) => {
    if (!isAdminRef.current || !rendererRef.current || !cameraRef.current) return;
    const rect = rendererRef.current.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, cameraRef.current);
    const hits = raycaster.intersectObjects(ghostSpotsRef.current);
    if (hits.length === 0) return;
    event.preventDefault();
    const spotIndex = hits[0].object.userData.index;
    setGhostMenu({
        screenX: event.clientX - rect.left,
        screenY: event.clientY - rect.top,
        spotIndex,
    });
};
```

- [ ] **Step 8: Wire `onContextMenu` onto the mount div**

Find the mount div at line ~4465:

```js
<div ref={mountRef} style={{
    width: "100%",
    height: isMobile ? "calc(100vh - 60px)" : "100%",
    touchAction: "none",
    backgroundColor: "#0a0a0a"
}}>
```

Add the handler:

```js
<div ref={mountRef} onContextMenu={handleGhostContextMenu} style={{
    width: "100%",
    height: isMobile ? "calc(100vh - 60px)" : "100%",
    touchAction: "none",
    backgroundColor: "#0a0a0a"
}}>
```

- [ ] **Step 9: Render the context menu and editor panel**

Just before the closing `</div>` of the mount div (right after the `DeviceHoverMenu` block at line ~4826), add:

```js
{isAdmin && ghostMenu && (() => {
    const layout = currentLayoutRef.current;
    const ghost = ghostSpotsRef.current[ghostMenu.spotIndex];
    const spotId = ghost?.userData?.spotId;
    const spot = layout.find((s) => s.id === spotId);
    if (!spot) return null;
    return (
        <GhostSpotContextMenu
            screenPosition={{ x: ghostMenu.screenX, y: ghostMenu.screenY }}
            recommendedType={spot.recommendedType}
            onMove={() => {
                setGhostEditor({ mode: 'move', spot, originalSpot: spot, insert: false });
                setGhostMenu(null);
            }}
            onAdd={() => {
                const newSpot = {
                    ...spot,
                    id: makeSpotType(),
                    type: makeSpotType(),
                    x: Math.round((spot.x + 0.4) * 1000) / 1000,
                };
                setGhostEditor({ mode: 'add', spot: newSpot, originalSpot: null, insert: true });
                setGhostMenu(null);
            }}
            onRemove={() => {
                // eslint-disable-next-line no-restricted-globals, no-alert
                if (window.confirm('Remove this ghost spot for all users?')) {
                    persistLayout(currentLayoutRef.current.filter((s) => s.id !== spot.id));
                }
                setGhostMenu(null);
            }}
            onClose={() => setGhostMenu(null)}
        />
    );
})()}

{isAdmin && ghostEditor && (
    <GhostSpotEditorPanel
        mode={ghostEditor.mode}
        spot={ghostEditor.spot}
        onChange={(draft) => {
            if (ghostEditor.insert) {
                // For add mode, temporarily include the draft so it previews in-scene.
                const base = currentLayoutRef.current.filter((s) => s.id !== draft.id);
                currentLayoutRef.current = [...base, draft];
                rebuildGhostSpots();
            } else {
                previewSpot(draft);
            }
        }}
        onSave={(draft) => {
            if (ghostEditor.insert) {
                const base = currentLayoutRef.current.filter((s) => s.id !== draft.id);
                persistLayout([...base, draft]);
            } else {
                persistLayout(currentLayoutRef.current.map((s) => (s.id === draft.id ? draft : s)));
            }
            setGhostEditor(null);
        }}
        onCancel={() => {
            // Revert any live preview back to the saved layout.
            if (ghostEditor.insert) {
                currentLayoutRef.current = currentLayoutRef.current.filter((s) => s.id !== ghostEditor.spot.id);
            } else if (ghostEditor.originalSpot) {
                currentLayoutRef.current = currentLayoutRef.current.map((s) =>
                    s.id === ghostEditor.originalSpot.id ? ghostEditor.originalSpot : s
                );
            }
            rebuildGhostSpots();
            setGhostEditor(null);
        }}
    />
)}
```

- [ ] **Step 10: Build to catch compile errors**

Run: `CI=true npx react-scripts build`
Expected: build succeeds (warnings OK, no errors). If it fails on `useCallback` not defined, confirm Step 6's import note was applied.

- [ ] **Step 11: Manual verification in the browser**

Run: `npm start`

As an admin (sebasludmir@gmail.com, which must have the `admin` custom claim set), open a setup in the 3D builder and verify:

1. **Right-click a ghost square** → the context menu appears at the cursor with Move / Add adjacent / Remove. (Right-click as a non-admin, or signed out → normal browser menu, no custom menu.)
2. **Move** → editor panel opens; changing X/Y/Z/rotation/size moves the square live; **Save** persists (reload the page → the square stays moved). **Cancel** reverts.
3. **Add adjacent** → editor opens pre-seeded next to the clicked square with a Suggested type dropdown listing all options; **Save** adds a new square; reload → it persists. Click the new square to place a product and confirm the product modal filters by the chosen suggested type.
4. **Remove** → confirm dialog → square disappears; reload → still gone.
5. **Switch scene variant** (e.g. DJ Club → Rooftop) → layouts are independent; edits to one do not affect the other.
6. **DJ reveal behavior** still works: FX spots appear only after a mixer/laptop is placed.
7. **Firestore**: confirm a `ghostSpotLayouts/DJ__club` (etc.) document is written.

Confirm the dev server console shows no errors during these flows. If the editor panel cannot be verified in-browser for any reason, say so explicitly rather than claiming success.

- [ ] **Step 12: Commit**

```bash
git add src/ThreeScene.js
git commit -m "feat(ghost-spots): admin in-scene editor wiring in ThreeScene"
```

---

## Task 6: Firestore rules for `ghostSpotLayouts`

**Files:**
- Modify: `firestore.rules`

- [ ] **Step 1: Add the collection rule**

In `firestore.rules`, add this block inside `match /databases/{database}/documents {` (e.g. right after the `products` block, around line 45):

```
// Ghost-spot layouts (admin-editable builder placement templates)
match /ghostSpotLayouts/{layoutId} {
  allow read: if isSignedIn();
  allow write: if isSignedIn() && request.auth.token.admin == true;
}
```

- [ ] **Step 2: Verify rules syntax**

Run: `cd /Users/sebastianludmir/Desktop/MusicDeviceConnection && npx firebase deploy --only firestore:rules --dry-run`
Expected: rules compile with no errors. (If `--dry-run` is unsupported in the installed CLI version, instead run `npx firebase firestore:rules` lint via `firebase deploy --only firestore:rules` against the project — but do NOT deploy without the user's go-ahead; see note below.)

- [ ] **Step 3: Commit**

```bash
git add firestore.rules
git commit -m "feat(ghost-spots): admin-only Firestore rule for ghostSpotLayouts"
```

**Deploy note:** Deploying rules and the app (`npm run deploy` / `firebase deploy --only firestore:rules`) affects shared production infrastructure. Do **not** deploy automatically — confirm with the user before any deploy. The admin custom claim for sebasludmir@gmail.com must already be set (it is, per the existing ProductDashboard admin flow) for writes to succeed.

---

## Self-Review Notes

- **Spec coverage:** admin gate (Task 5 Step 3) ✓; per-variant global persistence (Tasks 2, 5, 6) ✓; move via numeric panel (Task 4) ✓; remove (Task 5 Step 9) ✓; add-adjacent with suggestion dropdown (Tasks 1, 4, 5) ✓; default fallback / no migration (Task 1, 2) ✓; progressive reveal preserved (Task 5 Step 5) ✓; remove = leave-as-is (no setup mutation anywhere) ✓; Firestore rule (Task 6) ✓.
- **Type consistency:** spot shape `{ id, type, recommendedType, x, y, z, rotationY, size:{width,depth}, revealAfterBasic }` is consistent across util, components, and ThreeScene. `ghostSquare.userData` carries `spotId` so the renderer maps meshes back to layout entries by `id`. `makeSpotType()`, `getDefaultLayout`, `loadLayout`, `saveLayout`, `SUGGESTION_OPTIONS` names match across tasks.
- **Deferred (out of scope):** per-setup-type filtering of `SUGGESTION_OPTIONS`, drag-to-move, remove impact analysis.
