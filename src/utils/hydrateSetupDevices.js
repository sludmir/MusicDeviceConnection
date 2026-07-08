import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { lookupProduct } from '../productKnowledgeBase';

const ENRICH_FIELDS = [
  'inputs',
  'outputs',
  'brand',
  'price',
  'affiliateUrl',
  'imageUrl',
  'subcategory',
  'type',
  'category',
  'description',
];

function isEmpty(value) {
  if (value == null || value === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

function mergeMissing(target, source, fields) {
  const out = { ...target };
  for (const field of fields) {
    if (isEmpty(out[field]) && !isEmpty(source[field])) {
      out[field] = source[field];
    }
  }
  return out;
}

export function stableDeviceUniqueId(device, index = 0) {
  if (device?.uniqueId) return device.uniqueId;
  const pos = device?.position || {};
  const x = Number(pos.x) || 0;
  const y = Number(pos.y) || 0;
  const z = Number(pos.z) || 0;
  if (device?.id) return `${device.id}-${x}-${y}-${z}`;
  return `dev-${index}`;
}

export function normalizeSetupDevices(devices) {
  if (!Array.isArray(devices)) return [];
  return devices.map((device, index) => {
    const kb = lookupProduct(device?.name);
    let merged = { ...device, uniqueId: stableDeviceUniqueId(device, index) };
    if (kb) merged = mergeMissing(merged, kb, ENRICH_FIELDS);
    return merged;
  });
}

export async function hydrateSetupDevices(devices) {
  if (!Array.isArray(devices) || devices.length === 0) return [];

  const productCache = new Map();
  const normalized = normalizeSetupDevices(devices);

  return Promise.all(normalized.map(async (device) => {
    if (!device.id) return device;

    let live = productCache.get(device.id);
    if (live === undefined) {
      try {
        const snap = await getDoc(doc(db, 'products', device.id));
        live = snap.exists() ? { id: snap.id, ...snap.data() } : null;
      } catch {
        live = null;
      }
      productCache.set(device.id, live);
    }

    return live ? mergeMissing(device, live, ENRICH_FIELDS) : device;
  }));
}
