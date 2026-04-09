import dimensionData from './data/productDimensions.json';

export const SCENE_UNIT_MM = dimensionData.scene.scene_unit_mm; // 400 — 1 scene unit = 400mm

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
  indexedProducts = dimensionData.products.map(p => ({
    ...p,
    _normName: normalize(p.name),
    _normKeys: (p.match_keys || []).map(k => k.replace(/[-\s:_.]/g, '').toLowerCase()),
  }));
  return indexedProducts;
}

export function lookupDimensions(productName) {
  if (!productName) return null;

  const cached = lookupCache.get(productName);
  if (cached !== undefined) return cached;

  const needle = normalize(productName);
  if (!needle) { lookupCache.set(productName, null); return null; }

  const products = getIndex();

  // 1. Exact normalized name match
  let match = products.find(p => p._normName === needle);

  // 2. Exact match_key
  if (!match) match = products.find(p => p._normKeys.includes(needle));

  // 3. Substring: needle inside product name or vice-versa
  if (!match) match = products.find(p => p._normName.includes(needle) || needle.includes(p._normName));

  // 4. Any match_key is a substring of needle or vice-versa
  if (!match) match = products.find(p => p._normKeys.some(k => needle.includes(k) || k.includes(needle)));

  const result = match ? { width_mm: match.width_mm, depth_mm: match.depth_mm, height_mm: match.height_mm, name: match.name } : null;
  lookupCache.set(productName, result);
  return result;
}

export function getRealDimensions(productName) {
  return lookupDimensions(productName);
}

/**
 * Compute auto-scale for a loaded GLB model.
 *
 * @param {string} productName  - Product name to look up in dimensions JSON
 * @param {Object} glbBboxSize  - { x, y, z } bounding box size of the raw GLB (before any scaling)
 * @returns {number|null}       - Scale factor, or null if product not found in JSON
 */
export function computeAutoScale(productName, glbBboxSize) {
  const dims = lookupDimensions(productName);
  if (!dims) return null;

  const bx = Math.abs(glbBboxSize.x);
  const by = Math.abs(glbBboxSize.y);
  const bz = Math.abs(glbBboxSize.z);
  if (bx === 0 && by === 0 && bz === 0) return null;

  const targetW = dims.width_mm / SCENE_UNIT_MM;
  const targetD = dims.depth_mm / SCENE_UNIT_MM;
  const targetH = dims.height_mm / SCENE_UNIT_MM;

  // Try width-based scaling first (most reliable for tabletop gear viewed from front).
  // GLB models may have width along X or Z depending on orientation.
  // We match the largest horizontal real dimension to the largest horizontal bbox dimension,
  // and height to the vertical (Y) axis.
  const realHoriz = Math.max(targetW, targetD);
  const realVert = targetH;

  const bboxHoriz = Math.max(bx, bz);
  const bboxVert = by;

  // Compute scale from horizontal and vertical independently
  const scaleH = bboxHoriz > 0.0001 ? realHoriz / bboxHoriz : null;
  const scaleV = bboxVert > 0.0001 ? realVert / bboxVert : null;

  // Prefer horizontal scale; validate against vertical if available
  if (scaleH !== null && scaleV !== null) {
    const ratio = scaleH / scaleV;
    // If horizontal and vertical agree within 3x, use horizontal. Otherwise average them.
    if (ratio > 0.33 && ratio < 3.0) return scaleH;
    return (scaleH + scaleV) / 2;
  }

  return scaleH || scaleV || null;
}
