// Single source of truth for ghost placement-spot layouts.
//
// Each spot: { id, type, recommendedType, x, y, z, rotationY?, size?, revealAfterBasic }
// - `type` is the placement identity saved setups match against (device.spotType).
// - `revealAfterBasic`: only show once the setup's "brain"/basic setup is complete
//   (preserves the DJ behavior where FX spots appear after the mixer is placed).
//
// getDefaultLayout(setupType) returns the in-code fallback used until an admin
// saves a layout for a given scene variant.

import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';

const COLLECTION = 'ghostSpotLayouts';

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
