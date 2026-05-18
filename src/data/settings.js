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
