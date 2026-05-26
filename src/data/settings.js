// Setting registry: per-setupType environment options.
//
// Each setting describes how the 3D scene environment is built. Ghost spots
// and placed gear live outside the environment group (on the scene root), so
// swapping a setting never disturbs the user's placed devices.
//
// type: 'procedural' — built inline in ThreeScene.createClubEnvironment
// type: 'glb'        — loaded via GLTFLoader (+ DRACOLoader if draco: true)

export const SETTINGS = {
  DJ: {
    club: {
      label: 'Club Booth',
      type: 'procedural',
      camera: { position: [0, 2.2, 1.8], target: [0, 0.9, 0] },
    },
    rooftop: {
      label: 'Rooftop',
      type: 'glb',
      source: '/scenes/dj-rooftop.glb',
      draco: true,
      camera: { position: [0, 8, 12], target: [0, 1, 0] },
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
      background: 0x070a14,
      globalLights: { ambient: 0.1, directional: 0.0, hemisphere: 0.18 },
      // Positions are in the GLB's authored (un-rotated) room frame; they ride
      // along with the environment when rotationY is applied.
      lights: [
        { kind: 'point', color: 0xff8a3d, intensity: 14, distance: 8,  decay: 2, position: [1.67, 1.85, 1.9] },
        { kind: 'point', color: 0x6f8cff, intensity: 7,  distance: 14, decay: 2, position: [0, 1.7, -2.6] },
        { kind: 'point', color: 0x6f8cff, intensity: 7,  distance: 14, decay: 2, position: [2.8, 1.7, 0] },
      ],
      camera: { position: [0, 1.5, 2.4], target: [0, 0.8, -0.3] },
    },
  },
  Producer: {
    studio: {
      label: 'Studio',
      type: 'procedural',
      camera: { position: [0, 3.2, 4.5], target: [0, 1, 0] },
    },
  },
  Musician: {
    stage: {
      label: 'Stage',
      type: 'procedural',
      camera: { position: [0, 3.5, 6], target: [0, 1, 0] },
    },
    guitarRoom: {
      label: 'Guitar Room',
      type: 'glb',
      source: '/scenes/musician-guitar-room.glb',
      draco: false,
      camera: { position: [0, 3.5, 6], target: [0, 1, 0] },
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
