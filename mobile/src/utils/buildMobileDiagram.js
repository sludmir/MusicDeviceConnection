// Port of /src/utils/buildMobileDiagram.js — mobile reuses the exact same
// shape so rendering stays symmetric between platforms. Only the dimension
// lookup import differs (local copy).
//
// Keep this file in sync with the web copy.

import { lookupDimensions, SCENE_UNIT_MM } from './dimensionLookup';
import { inferConnections } from './inferConnections';

const DIAGRAM_VERSION = 2;
const FALLBACK_DIMS_MM = { width_mm: 300, depth_mm: 300, height_mm: 80 };

function resolveDims(device) {
  if (device && device.width_mm && device.depth_mm) {
    return {
      width_mm: device.width_mm,
      depth_mm: device.depth_mm,
      height_mm: device.height_mm || 80,
    };
  }
  const looked = lookupDimensions(device?.name);
  if (looked) return looked;
  return FALLBACK_DIMS_MM;
}

function radToDeg(r) {
  if (typeof r !== 'number' || !isFinite(r)) return 0;
  return (r * 180) / Math.PI;
}

export function buildMobileDiagram(devices, setupType) {
  const safeType = setupType || 'DJ';
  const list = Array.isArray(devices) ? devices : [];

  if (list.length === 0) {
    return {
      version: DIAGRAM_VERSION,
      setupType: safeType,
      bounds: { minX: -1, maxX: 1, minZ: -1, maxZ: 1 },
      devices: [],
      connections: [],
    };
  }

  const mapped = list.map((d, i) => {
    const pos = d?.position || { x: 0, y: 0, z: 0 };
    const rot = d?.rotation || { x: 0, y: 0, z: 0 };
    const dims = resolveDims(d);
    return {
      uniqueId: d.uniqueId || `${d.id || 'dev'}-${i}`,
      productId: d.id || null,
      name: d.name || 'Unknown device',
      brand: d.brand || '',
      imageUrl: d.imageUrl || null,
      category: d.category || null,
      subcategory: d.subcategory || null,
      type: d.type || null,
      spotType: d.spotType ?? null,
      x: Number(pos.x) || 0,
      z: Number(pos.z) || 0,
      widthMm: dims.width_mm,
      depthMm: dims.depth_mm,
      heightMm: dims.height_mm,
      rotationDegY: radToDeg(rot.y),
    };
  });

  const halfUnits = (mm) => mm / SCENE_UNIT_MM / 2;
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const d of mapped) {
    const hw = halfUnits(d.widthMm);
    const hd = halfUnits(d.depthMm);
    if (d.x - hw < minX) minX = d.x - hw;
    if (d.x + hw > maxX) maxX = d.x + hw;
    if (d.z - hd < minZ) minZ = d.z - hd;
    if (d.z + hd > maxZ) maxZ = d.z + hd;
  }
  if (!isFinite(minX)) {
    minX = -1;
    maxX = 1;
    minZ = -1;
    maxZ = 1;
  }

  const connections = inferConnections(list, safeType);

  return {
    version: DIAGRAM_VERSION,
    setupType: safeType,
    bounds: { minX, maxX, minZ, maxZ },
    devices: mapped,
    connections,
  };
}

export { SCENE_UNIT_MM, DIAGRAM_VERSION };
