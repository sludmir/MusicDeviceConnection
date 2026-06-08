# Camera Angle Slots — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 3 saveable/recallable camera angle slots per setup, persisted to Firestore and auto-snapped to slot 0 on setup load.

**Architecture:** `ThreeScene` owns `cameraAngles` state (array of 3 `{position,target}` objects or nulls), exposes save/recall handlers, and renders a new `CameraAngleControls` HUD bottom-left. Angles flow out via `onCameraAnglesChange` prop to `App.js`, which holds them and passes them to `SaveSetupButton` for Firestore persistence. On saved-setup load, `ThreeScene` auto-snaps the camera to slot 0. The dead `set`/`connections` camera presets and their UI are removed.

**Tech Stack:** React 18, GSAP, react-icons/md (`MdOutlineCameraAlt`), Firebase Firestore, Three.js OrbitControls

---

### Task 1: Remove dead camera preset code

**Files:**
- Modify: `src/ThreeScene.js`
- Modify: `src/MobileNavigation.js`

- [ ] **Step 1: Remove `cameraView` state**

In `src/ThreeScene.js` at line 97, delete:
```js
const [cameraView, setCameraView] = useState('set');
```

- [ ] **Step 2: Trim CAMERA_POSITIONS to `default` only**

Lines 200–214 — replace the entire `CAMERA_POSITIONS` object with:
```js
const CAMERA_POSITIONS = {
    default: {
        position: { x: 0, y: isMobile ? 3 : 2.2, z: isMobile ? 2.5 : 1.8 },
        target: { x: 0, y: 0.9, z: 0 }
    }
};
```

- [ ] **Step 3: Replace `moveCameraToPosition` with `snapCameraToAngle`**

Remove the entire `moveCameraToPosition` function (lines 4361–4387) and replace with:
```js
const snapCameraToAngle = ({ position, target }) => {
    if (!cameraRef.current || !controlsRef.current) return;
    gsap.to(cameraRef.current.position, {
        x: position.x, y: position.y, z: position.z,
        duration: 1.5,
        ease: 'power2.inOut',
        onUpdate: () => { cameraRef.current.lookAt(target.x, target.y, target.z); }
    });
    gsap.to(controlsRef.current.target, {
        x: target.x, y: target.y, z: target.z,
        duration: 1.5,
        ease: 'power2.inOut',
        onUpdate: () => { controlsRef.current.update(); }
    });
};
```

- [ ] **Step 4: Remove the Set/Connections camera-controls HUD div**

Remove lines 4825–4850 — the entire `<div className="camera-controls fade-in" ...>` block containing the "Set" and "Connections" buttons.

- [ ] **Step 5: Remove `onSetView`/`onConnectionsView` from the MobileNavigation render**

Around line 4806–4807, update the `<MobileNavigation>` JSX to remove those two props:
```jsx
<MobileNavigation
    onOpenSearch={openHamburgerSearch}
    placedDevicesList={placedDevicesList}
    onRemoveDevice={removeDevice}
    isUpdatingPaths={isUpdatingPaths}
    onUpdateModelPaths={handleUpdateModelPaths}
    style={{
        position: 'fixed',
        /* existing style props unchanged */
    }}
/>
```

- [ ] **Step 6: Update MobileNavigation.js — remove dead props and VIEW section**

In `src/MobileNavigation.js`, update the destructured props (lines 3–6):
```js
const MobileNavigation = ({
    onOpenSearch,
    placedDevicesList,
    onRemoveDevice,
    isUpdatingPaths,
    onUpdateModelPaths,
    style
}) => {
```

Remove the entire VIEW section (lines 76–103) — the `<div style={{ marginBottom: '24px' }}>` block with "Set View" and "Connections View" buttons.

- [ ] **Step 7: Verify compilation**

Run `npm run build 2>&1 | tail -20` (or start the dev server and check the console).
Expected: no errors referencing `cameraView`, `moveCameraToPosition`, `onSetView`, or `onConnectionsView`.

- [ ] **Step 8: Commit**

```bash
git add src/ThreeScene.js src/MobileNavigation.js
git commit -m "refactor: remove dead camera preset views (set/connections)"
```

---

### Task 2: Create CameraAngleControls component

**Files:**
- Create: `src/components/CameraAngleControls.js`
- Create: `src/components/CameraAngleControls.css`
- Create: `src/components/CameraAngleControls.test.js`

- [ ] **Step 1: Write the failing test first**

`src/components/CameraAngleControls.test.js`:
```js
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import CameraAngleControls from './CameraAngleControls';

const emptyAngles = [null, null, null];
const savedAngles = [
  { position: { x: 0, y: 2, z: 3 }, target: { x: 0, y: 0.9, z: 0 } },
  null,
  null,
];

describe('CameraAngleControls', () => {
  test('renders 3 save buttons and 3 recall buttons', () => {
    render(
      <CameraAngleControls cameraAngles={emptyAngles} onSave={() => {}} onRecall={() => {}} />
    );
    expect(screen.getAllByRole('button', { name: /save camera angle/i })).toHaveLength(3);
    expect(screen.getAllByRole('button', { name: /recall camera angle/i })).toHaveLength(3);
  });

  test('recall buttons are disabled when all slots are empty', () => {
    render(
      <CameraAngleControls cameraAngles={emptyAngles} onSave={() => {}} onRecall={() => {}} />
    );
    screen.getAllByRole('button', { name: /recall camera angle/i }).forEach((btn) => {
      expect(btn).toBeDisabled();
    });
  });

  test('recall button for saved slot is enabled; others remain disabled', () => {
    render(
      <CameraAngleControls cameraAngles={savedAngles} onSave={() => {}} onRecall={() => {}} />
    );
    const recallBtns = screen.getAllByRole('button', { name: /recall camera angle/i });
    expect(recallBtns[0]).not.toBeDisabled();
    expect(recallBtns[1]).toBeDisabled();
    expect(recallBtns[2]).toBeDisabled();
  });

  test('save icon has --saved modifier class only on occupied slots', () => {
    const { container } = render(
      <CameraAngleControls cameraAngles={savedAngles} onSave={() => {}} onRecall={() => {}} />
    );
    const saveBtns = container.querySelectorAll('.camera-angle-save');
    expect(saveBtns[0]).toHaveClass('camera-angle-save--saved');
    expect(saveBtns[1]).not.toHaveClass('camera-angle-save--saved');
    expect(saveBtns[2]).not.toHaveClass('camera-angle-save--saved');
  });

  test('calls onSave with the correct slot index', () => {
    const onSave = jest.fn();
    render(
      <CameraAngleControls cameraAngles={emptyAngles} onSave={onSave} onRecall={() => {}} />
    );
    fireEvent.click(screen.getAllByRole('button', { name: /save camera angle/i })[1]);
    expect(onSave).toHaveBeenCalledWith(1);
  });

  test('calls onRecall with correct slot index when slot is saved', () => {
    const onRecall = jest.fn();
    render(
      <CameraAngleControls cameraAngles={savedAngles} onSave={() => {}} onRecall={onRecall} />
    );
    fireEvent.click(screen.getAllByRole('button', { name: /recall camera angle/i })[0]);
    expect(onRecall).toHaveBeenCalledWith(0);
  });
});
```

- [ ] **Step 2: Run to confirm tests fail (file not yet created)**

Run: `npx react-scripts test --watchAll=false src/components/CameraAngleControls.test.js 2>&1 | tail -15`
Expected: FAIL — `Cannot find module './CameraAngleControls'`

- [ ] **Step 3: Create the component**

`src/components/CameraAngleControls.js`:
```jsx
import React from 'react';
import { MdOutlineCameraAlt } from 'react-icons/md';
import './CameraAngleControls.css';

function CameraAngleControls({ cameraAngles, onSave, onRecall }) {
  return (
    <div className="camera-angle-controls">
      {[0, 1, 2].map((slotIndex) => {
        const saved = cameraAngles[slotIndex] != null;
        return (
          <div key={slotIndex} className="camera-angle-slot">
            <button
              type="button"
              className={`camera-angle-save${saved ? ' camera-angle-save--saved' : ''}`}
              onClick={() => onSave(slotIndex)}
              title={`Save current view to slot ${slotIndex + 1}`}
              aria-label={`Save camera angle ${slotIndex + 1}`}
            >
              <MdOutlineCameraAlt size={14} />
            </button>
            <button
              type="button"
              className="camera-angle-recall"
              onClick={() => onRecall(slotIndex)}
              disabled={!saved}
              title={saved ? `Go to view ${slotIndex + 1}` : `Slot ${slotIndex + 1} is empty`}
              aria-label={`Recall camera angle ${slotIndex + 1}`}
            >
              {slotIndex + 1}
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default CameraAngleControls;
```

- [ ] **Step 4: Create the CSS**

`src/components/CameraAngleControls.css`:
```css
.camera-angle-controls {
  position: fixed;
  bottom: 80px;
  left: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 1000;
}

.camera-angle-slot {
  display: flex;
  gap: 4px;
  align-items: center;
}

.camera-angle-save,
.camera-angle-recall {
  background: rgba(0, 0, 0, 0.65);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #fff;
  border-radius: 6px;
  cursor: pointer;
  backdrop-filter: blur(10px);
  width: 28px;
  height: 28px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s, border-color 0.15s, opacity 0.15s;
}

.camera-angle-save--saved {
  border-color: rgba(0, 162, 255, 0.6);
  color: #00a2ff;
}

.camera-angle-save:hover {
  background: rgba(0, 162, 255, 0.2);
  border-color: #00a2ff;
  color: #00a2ff;
}

.camera-angle-recall {
  font-size: 12px;
  font-weight: 600;
}

.camera-angle-recall:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.camera-angle-recall:not(:disabled):hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.4);
}
```

- [ ] **Step 5: Run tests — confirm all 6 pass**

Run: `npx react-scripts test --watchAll=false src/components/CameraAngleControls.test.js 2>&1 | tail -15`
Expected: PASS — 6 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/CameraAngleControls.js src/components/CameraAngleControls.css src/components/CameraAngleControls.test.js
git commit -m "feat: add CameraAngleControls component"
```

---

### Task 3: Wire camera angle state into ThreeScene

**Files:**
- Modify: `src/ThreeScene.js`

- [ ] **Step 1: Add new props to the ThreeScene function signature**

Line 49 — update:
```js
function ThreeScene({ devices, isInitialized, setupType, setting, onDevicesChange, onCategoryToggle, initialCameraAngles, onCameraAnglesChange }) {
```

- [ ] **Step 2: Add `cameraAngles` state and reset effect**

After the block where `cameraView` was (line 97), add:
```js
const [cameraAngles, setCameraAngles] = useState(initialCameraAngles ?? [null, null, null]);

// Reset when a new setup is loaded (initialCameraAngles reference changes)
useEffect(() => {
    setCameraAngles(initialCameraAngles ?? [null, null, null]);
}, [initialCameraAngles]);
```

- [ ] **Step 3: Add save and recall handlers**

Directly after the `snapCameraToAngle` function (added in Task 1), add:
```js
const handleSaveCameraAngle = (slotIndex) => {
    if (!cameraRef.current || !controlsRef.current) return;
    const newAngles = [...cameraAngles];
    newAngles[slotIndex] = {
        position: {
            x: cameraRef.current.position.x,
            y: cameraRef.current.position.y,
            z: cameraRef.current.position.z,
        },
        target: {
            x: controlsRef.current.target.x,
            y: controlsRef.current.target.y,
            z: controlsRef.current.target.z,
        }
    };
    setCameraAngles(newAngles);
    onCameraAnglesChange?.(newAngles);
};

const handleRecallCameraAngle = (slotIndex) => {
    const angle = cameraAngles[slotIndex];
    if (!angle) return;
    snapCameraToAngle(angle);
};
```

- [ ] **Step 4: Auto-snap to slot 0 on saved setup load**

In the `isLoadFromSaved` async IIFE (around line 1801), immediately after the `for` loop that calls `await addProductToPosition(...)`, add:
```js
// Auto-snap camera to saved slot 0 if present
if (initialCameraAngles?.[0]) {
    snapCameraToAngle(initialCameraAngles[0]);
}
```

- [ ] **Step 5: Import CameraAngleControls**

Add to the top-of-file imports:
```js
import CameraAngleControls from './components/CameraAngleControls';
```

- [ ] **Step 6: Render CameraAngleControls in the JSX**

In the JSX return, just before the closing outer `</div>` (after the GhostSpotEditorPanel block), add:
```jsx
{sceneInitialized && (
    <CameraAngleControls
        cameraAngles={cameraAngles}
        onSave={handleSaveCameraAngle}
        onRecall={handleRecallCameraAngle}
    />
)}
```

- [ ] **Step 7: Verify manually in the browser**

Start the app. Open the builder. Confirm:
- Three camera-icon + number-button pairs appear bottom-left
- Clicking the camera icon on slot 1 saves the current angle; the icon border turns blue
- Clicking number "1" GSAP-tweens the camera back to the saved position
- Empty slots show greyed-out number buttons that do nothing when clicked

- [ ] **Step 8: Commit**

```bash
git add src/ThreeScene.js
git commit -m "feat(ThreeScene): add cameraAngles state, save/recall handlers, and auto-snap on load"
```

---

### Task 4: Persist cameraAngles in SaveSetupButton

**Files:**
- Modify: `src/components/SaveSetupButton.js`

- [ ] **Step 1: Accept `cameraAngles` prop**

Line 9 — update:
```js
function SaveSetupButton({ currentDevices, setupType, setting, cameraAngles }) {
```

- [ ] **Step 2: Include `cameraAngles` in setupData**

In `handleSaveSetup`, update the `setupData` object (around line 72):
```js
const setupData = {
    name: setupName.trim(),
    ownerId: auth.currentUser.uid,
    setupType: setupType || 'DJ',
    setting: setting || defaultSettingFor(setupType || 'DJ'),
    devices: devicesData,
    mobileDiagram,
    cameraAngles: cameraAngles ?? null,
    isMainSetup: isMainSetup,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
};
```

- [ ] **Step 3: Commit**

```bash
git add src/components/SaveSetupButton.js
git commit -m "feat(SaveSetupButton): persist cameraAngles to Firestore on save"
```

---

### Task 5: Wire App.js

**Files:**
- Modify: `src/App.js`

- [ ] **Step 1: Add camera angle state**

Near the other `useState` declarations in `App.js`, add:
```js
const [initialCameraAngles, setInitialCameraAngles] = useState(null);
const [currentCameraAngles, setCurrentCameraAngles] = useState(null);
```

`initialCameraAngles` — set when a setup is loaded; passed as a prop to `ThreeScene` to trigger state reset and auto-snap.
`currentCameraAngles` — updated live by `ThreeScene`; passed to `SaveSetupButton` for Firestore persistence.

- [ ] **Step 2: Set angles in `handleSetupSelectFromLanding`**

Lines 303–310 — update:
```js
const handleSetupSelectFromLanding = (setup) => {
    const type = setup.setupType || 'DJ';
    setSelectedSetup(type);
    setSelectedSetting(setup.setting || defaultSettingFor(type));
    setActualDevices(setup.devices || []);
    setSetupDevices(prev => ({ ...prev, [type]: setup.devices || [] }));
    setInitialCameraAngles(setup.cameraAngles ?? null);
    setCurrentCameraAngles(setup.cameraAngles ?? null);
    navigate('/builder');
};
```

- [ ] **Step 3: Reset angles in `handleNewSetupFromLanding`**

Lines 312–318 — update:
```js
const handleNewSetupFromLanding = (setupType, setting) => {
    setSelectedSetup(setupType);
    setSelectedSetting(setting || defaultSettingFor(setupType));
    setActualDevices([]);
    setSetupDevices(prev => ({ ...prev, [setupType]: [] }));
    setInitialCameraAngles(null);
    setCurrentCameraAngles(null);
    navigate('/builder');
};
```

- [ ] **Step 4: Pass props to ThreeScene and SaveSetupButton**

Update the `<SaveSetupButton>` and `<ThreeScene>` JSX (around lines 533–546):
```jsx
<SaveSetupButton
    currentDevices={actualDevices}
    setupType={selectedSetup}
    setting={selectedSetting}
    cameraAngles={currentCameraAngles}
/>
...
<ThreeScene
    devices={setupDevices[selectedSetup]}
    isInitialized={isFirebaseConnected}
    setupType={selectedSetup}
    setting={selectedSetting}
    onSettingChange={setSelectedSetting}
    onDevicesChange={handleDevicesChange}
    initialCameraAngles={initialCameraAngles}
    onCameraAnglesChange={setCurrentCameraAngles}
/>
```

- [ ] **Step 5: End-to-end verification**

1. Open the builder with a new setup. Confirm no camera HUD errors in console.
2. Orbit to a custom angle. Click the camera icon on slot 1 — icon turns blue.
3. Orbit elsewhere. Click "1" — camera tweens back to saved angle.
4. Click "Save Setup", name it, save.
5. Go to MySets, load the saved setup.
6. Confirm the camera auto-snaps to the slot 1 angle on load.

- [ ] **Step 6: Commit**

```bash
git add src/App.js
git commit -m "feat(App): wire initialCameraAngles and onCameraAnglesChange between ThreeScene and SaveSetupButton"
```
