// Lightweight copy of the web app's dimension lookup. Mobile only needs to
// resolve a product name to its real-world mm footprint — the full
// computeAutoScale path (GLB bbox, etc.) is web-only.
//
// Keep this file in sync with /src/dimensionScaler.js when the web copy's
// name-normalization logic evolves.

import dimensionData from '../data/productDimensions.json';

export const SCENE_UNIT_MM = dimensionData.scene.scene_unit_mm; // 400

const BRAND_PREFIXES = [
  'pioneer', 'pioneer dj', 'roland', 'korg', 'moog', 'arturia', 'elektron',
  'boss', 'strymon', 'eventide', 'fender', 'gibson', 'shure', 'universal audio',
  'teenage engineering', 'native instruments', 'allen & heath', 'allen&heath',
  'sequential', 'technics', 'rane', 'ableton', 'denon', 'denon dj', 'numark',
  'bose', 'jbl', 'qsc', 'yamaha', 'mackie', 'rcf',
];

function normalize(name) {
  let n = (name || '').toLowerCase().trim();
  for (const prefix of BRAND_PREFIXES) {
    if (n.startsWith(prefix + ' ')) {
      n = n.slice(prefix.length).trim();
      break;
    }
  }
  return n.replace(/[-\s:_.]/g, '');
}

const lookupCache = new Map();

let indexedProducts = null;
function getIndex() {
  if (indexedProducts) return indexedProducts;
  indexedProducts = dimensionData.products.map((p) => ({
    ...p,
    _normName: normalize(p.name),
    _normKeys: (p.match_keys || []).map((k) => k.replace(/[-\s:_.]/g, '').toLowerCase()),
  }));
  return indexedProducts;
}

export function lookupDimensions(productName) {
  if (!productName) return null;
  const cached = lookupCache.get(productName);
  if (cached !== undefined) return cached;

  const needle = normalize(productName);
  if (!needle) {
    lookupCache.set(productName, null);
    return null;
  }

  const products = getIndex();
  let match = products.find((p) => p._normName === needle);
  if (!match) match = products.find((p) => p._normKeys.includes(needle));
  if (!match) {
    match = products.find((p) => p._normName.includes(needle) || needle.includes(p._normName));
  }
  if (!match) {
    match = products.find((p) => p._normKeys.some((k) => needle.includes(k) || k.includes(needle)));
  }

  const result = match
    ? { width_mm: match.width_mm, depth_mm: match.depth_mm, height_mm: match.height_mm, name: match.name }
    : null;
  lookupCache.set(productName, result);
  return result;
}
