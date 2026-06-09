# Day / Night Lighting — Design Spec
**Date:** 2026-06-09

## Overview

Give every 3D scene a distinct day and night lighting configuration that reacts automatically to the app's existing light/dark theme toggle. Fix the flat "evenly bright" rendering of GLB scenes by adding ACES filmic tone mapping to the renderer.

---

## Goals

- All scenes (GLB and code-built) look noticeably different — and better — in each theme
- Toggling the theme in the header instantly updates the 3D scene's lighting, background colour, and tone mapping exposure
- The Dojo's existing moody city-night atmosphere is preserved (and improved) in dark mode
- No new user-facing controls; the app theme toggle is the only input

---

## Data Model — `src/data/settings.js`

Every setting object gains a `day` block and a `night` block. Both blocks share the same shape:

```ts
{
  background: number,              // Three.js hex colour for scene.background
  toneMappingExposure: number,     // renderer.toneMappingExposure (0.5–1.5 typical)
  globalLights: {
    ambient: number,               // AmbientLight intensity
    directional: number,           // DirectionalLight intensity
    hemisphere: number,            // HemisphereLight intensity
  },
  lights: Array<{                  // accent / fill lights added to envRoot
    kind: 'point' | 'directional',
    color: number,
    intensity: number,
    distance?: number,             // point lights only
    decay?: number,                // point lights only
    position: [x, y, z],
  }>,
}
```

Top-level `background`, `globalLights`, and `lights` fields on a setting are **removed**; the `day`/`night` blocks replace them entirely. Settings that previously had no `lights` array (code-built scenes) will have `lights: []` in both blocks.

### Lighting values per scene

**DJ — Club Booth** (code-built)
```js
day: {
  background: 0xd4c5a9,
  toneMappingExposure: 1.1,
  globalLights: { ambient: 0.8, directional: 1.2, hemisphere: 1.0 },
  lights: [],
},
night: {
  background: 0x0a0310,
  toneMappingExposure: 0.75,
  globalLights: { ambient: 0.2, directional: 0.0, hemisphere: 0.25 },
  lights: [],
},
```

**DJ — Dojo** (GLB)
```js
day: {
  background: 0x1a1000,
  toneMappingExposure: 0.9,
  globalLights: { ambient: 0.35, directional: 0.4, hemisphere: 0.25 },
  lights: [
    { kind: 'point', color: 0xffd090, intensity: 10, distance: 8,  decay: 2, position: [1.67, 1.85, 1.9] },
    { kind: 'point', color: 0xc8d8ff, intensity: 3,  distance: 10, decay: 2, position: [0,    1.7, -2.6] },
    { kind: 'point', color: 0xc8d8ff, intensity: 3,  distance: 10, decay: 2, position: [2.8,  1.7,  0  ] },
  ],
},
night: {
  background: 0x070a14,
  toneMappingExposure: 0.7,
  globalLights: { ambient: 0.1, directional: 0.0, hemisphere: 0.18 },
  lights: [
    { kind: 'point', color: 0xff8a3d, intensity: 14, distance: 8,  decay: 2, position: [1.67, 1.85, 1.9] },
    { kind: 'point', color: 0x6f8cff, intensity: 7,  distance: 14, decay: 2, position: [0,    1.7, -2.6] },
    { kind: 'point', color: 0x6f8cff, intensity: 7,  distance: 14, decay: 2, position: [2.8,  1.7,  0  ] },
  ],
},
```

**DJ — Rooftop** (GLB)
```js
day: {
  background: 0x87ceeb,
  toneMappingExposure: 1.2,
  globalLights: { ambient: 0.6, directional: 1.5, hemisphere: 1.2 },
  lights: [
    { kind: 'directional', color: 0xfff4d0, intensity: 1.5, position: [5, 8, 3] },
  ],
},
night: {
  background: 0x060818,
  toneMappingExposure: 0.65,
  globalLights: { ambient: 0.08, directional: 0.0, hemisphere: 0.15 },
  lights: [
    { kind: 'point', color: 0xa0b8ff, intensity: 3,  distance: 20, decay: 2, position: [0, 6, 0] },
    { kind: 'point', color: 0xff8844, intensity: 2,  distance: 15, decay: 2, position: [0, 0, -4] },
  ],
},
```

**Producer — Studio** (code-built)
```js
day: {
  background: 0xdce8f0,
  toneMappingExposure: 1.05,
  globalLights: { ambient: 0.7, directional: 1.0, hemisphere: 0.9 },
  lights: [],
},
night: {
  background: 0x080c10,
  toneMappingExposure: 0.8,
  globalLights: { ambient: 0.15, directional: 0.0, hemisphere: 0.2 },
  lights: [],
},
```

**Musician — Stage** (code-built)
```js
day: {
  background: 0xf0e8d8,
  toneMappingExposure: 1.1,
  globalLights: { ambient: 0.8, directional: 1.1, hemisphere: 1.0 },
  lights: [],
},
night: {
  background: 0x050308,
  toneMappingExposure: 0.7,
  globalLights: { ambient: 0.1, directional: 0.0, hemisphere: 0.15 },
  lights: [],
},
```

**Musician — Guitar Room** (GLB) — no prior lighting config, start neutral:
```js
day: {
  background: 0xd8c8b0,
  toneMappingExposure: 1.0,
  globalLights: { ambient: 0.6, directional: 0.9, hemisphere: 0.8 },
  lights: [
    { kind: 'point', color: 0xffeedd, intensity: 4, distance: 10, decay: 2, position: [0, 2.5, 1] },
  ],
},
night: {
  background: 0x080508,
  toneMappingExposure: 0.75,
  globalLights: { ambient: 0.1, directional: 0.0, hemisphere: 0.12 },
  lights: [
    { kind: 'point', color: 0xffcc88, intensity: 3, distance: 8, decay: 2, position: [0, 2.5, 1] },
  ],
},
```

---

## Renderer — Tone Mapping Fix

In `ThreeScene.js` renderer setup (currently around line 1408), add:

```js
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0; // overridden per-scene via applyGlobalLighting
```

This is the primary fix for the "evenly bright" GLB issue. ACESFilmic applies an S-curve: shadows stay deep, highlights roll off naturally.

---

## `ThreeScene.js` Changes

### New prop: `theme`
```js
function ThreeScene({ devices, ..., theme }) { ... }
```

`theme` is `'light'` or `'dark'`. Maps to `'day'` / `'night'` when selecting the lighting block:
```js
const themeKey = theme === 'dark' ? 'night' : 'day';
```

### `applyGlobalLighting(scene, settingConfig, theme)`

Picks `settingConfig[themeKey]` (falls back to top-level for backwards-compat), then:
- Sets `g.ambient.intensity`, `g.directional.intensity`, `g.hemisphere.intensity`
- Sets `scene.background`
- Sets `renderer.toneMappingExposure` (stored on `rendererRef`)

### `addSettingLights(envRoot, settingConfig, theme)`

Picks `settingConfig[themeKey].lights`. Behaviour unchanged otherwise.

### New helper: `rebuildSettingLights(theme)`

Called when `theme` prop changes without a full scene rebuild:
1. Remove all `THREE.Light` children from `environmentRootRef.current`
2. Call `addSettingLights(environmentRootRef.current, currentSettingConfig, theme)`
3. Call `applyGlobalLighting(sceneRef.current, currentSettingConfig, theme)`
4. Force one render frame

### `useEffect` watching `theme`

```js
useEffect(() => {
  if (!sceneInitialized || !environmentRootRef.current) return;
  rebuildSettingLights(theme);
}, [theme, sceneInitialized]);
```

The current setting config is accessed via a `currentSettingConfigRef` (a new ref that stores the last-applied setting config, set inside `buildSetting`).

---

## `App.js` Change

In `AppRoutes`, pass `theme` to `<ThreeScene>`:

```jsx
<ThreeScene
  ...
  theme={theme}
/>
```

`theme` is already in `AppRoutes` props (it's passed in from `App()`).

---

## File Changes Summary

| File | Change |
|------|--------|
| `src/data/settings.js` | Replace `lights`/`globalLights`/`background` with `day`/`night` blocks on all settings |
| `src/ThreeScene.js` | Add `theme` prop; update `applyGlobalLighting` + `addSettingLights` to be theme-aware; add `rebuildSettingLights`; add `currentSettingConfigRef`; add ACESFilmic tone mapping to renderer setup; add `useEffect` for theme changes |
| `src/App.js` | Pass `theme={theme}` to `<ThreeScene>` |

---

## Out of Scope

- Per-scene manual override of day/night (user can't pin a scene to night while app is in light mode)
- Animated transitions between day and night (instant switch only)
- Shadows (`shadowMap`) — already enabled; no change
- Mobile-specific lighting differences
