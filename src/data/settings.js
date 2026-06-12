// Setting registry: per-setupType environment options.
//
// Each setting describes how the 3D scene environment is built. Ghost spots
// and placed gear live outside the environment group (on the scene root), so
// swapping a setting never disturbs the user's placed devices.
//
// type: 'procedural' — built inline in ThreeScene.createClubEnvironment
// type: 'glb'        — loaded via GLTFLoader (+ DRACOLoader if draco: true)
//
// Every setting has a `day` block and a `night` block. ThreeScene picks the
// correct one based on the app theme ('light' → day, 'dark' → night).
// Both blocks share the same shape:
//   { background, toneMappingExposure, globalLights: {ambient, directional, hemisphere}, lights: [] }

export const SETTINGS = {
  DJ: {
    club: {
      label: 'Club Booth',
      type: 'procedural',
      camera: { position: [0, 2.5, 2.25], target: [0, 0.9, 0] },
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
    },
    rooftop: {
      label: 'Rooftop',
      type: 'glb',
      source: '/scenes/dj-rooftop.glb',
      draco: true,
      camera: { position: [0, 4.5, 6.5], target: [0, 1, 0] },
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
    },
    dojo: {
      label: 'Dojo',
      type: 'glb',
      source: '/scenes/dj-dojo.glb',
      draco: false,
      // Dark Miami apartment: night sky, dim global fill, light comes from the
      // city outside the two window walls + the warm "sunset" floor lamp by the
      // plant. rotationY spins the room so the booth faces the camera view.
      rotationY: Math.PI / 2,
      // The room was authored small; this brings it up to gear scale (1u = 400mm)
      // so real-world-sized products fit on the table. Light positions/distances
      // ride the scale automatically (see addSettingLights).
      scale: 2.25,
      camera: { position: [-0.8, 2.2, 2.4], target: [0, 1.05, 0] },
      day: {
        background: 0x1a1000,
        toneMappingExposure: 0.9,
        globalLights: { ambient: 0.35, directional: 0.4, hemisphere: 0.25 },
        lights: [
          // warm floor lamp (daytime: softer, cooler)
          { kind: 'point', color: 0xffd090, intensity: 10, distance: 8,  decay: 2, position: [1.67, 1.85, 1.9] },
          // city windows (daytime: cooler, dimmer)
          { kind: 'point', color: 0xc8d8ff, intensity: 3,  distance: 10, decay: 2, position: [0,    1.7, -2.6] },
          { kind: 'point', color: 0xc8d8ff, intensity: 3,  distance: 10, decay: 2, position: [2.8,  1.7,  0  ] },
        ],
      },
      night: {
        background: 0x070a14,
        toneMappingExposure: 0.7,
        globalLights: { ambient: 0.1, directional: 0.0, hemisphere: 0.18 },
        lights: [
          // warm floor lamp
          { kind: 'point', color: 0xff8a3d, intensity: 14, distance: 8,  decay: 2, position: [1.67, 1.85, 1.9] },
          // city glow through windows
          { kind: 'point', color: 0x6f8cff, intensity: 7,  distance: 14, decay: 2, position: [0,    1.7, -2.6] },
          { kind: 'point', color: 0x6f8cff, intensity: 7,  distance: 14, decay: 2, position: [2.8,  1.7,  0  ] },
        ],
      },
    },
  },
  Producer: {
    studio: {
      label: 'Studio',
      type: 'procedural',
      camera: { position: [0, 2.5, 3.2], target: [0, 1, 0] },
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
    },
  },
  Musician: {
    stage: {
      label: 'Stage',
      type: 'procedural',
      camera: { position: [0, 2.75, 4.2], target: [0, 1, 0] },
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
    },
    guitarRoom: {
      label: 'Guitar Room',
      type: 'glb',
      source: '/scenes/musician-guitar-room.glb',
      draco: false,
      camera: { position: [0, 2.9, -4.5], target: [0, 1, 0] },
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
    },
  },
};

export function defaultSettingFor(setupType) {
  const group = SETTINGS[setupType];
  if (!group) return null;
  return Object.keys(group)[0];
}

export function getSetting(setupType, settingKey) {
  const group = SETTINGS[setupType];
  if (!group) return null;
  return group[settingKey] || group[defaultSettingFor(setupType)] || null;
}

export function listSettings(setupType) {
  const group = SETTINGS[setupType];
  if (!group) return [];
  return Object.entries(group).map(([key, value]) => ({ key, ...value }));
}

export function hasMultipleSettings(setupType) {
  const group = SETTINGS[setupType];
  return !!group && Object.keys(group).length > 1;
}
