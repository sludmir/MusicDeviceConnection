/**
 * Build Firestore-ready product drafts from backlog items + KB + optional overrides.
 */

const { normalizeName, slugId } = require('./catalogGapAnalysis');

function emptyDraft(item = {}) {
  return {
    name: item.name || '',
    brand: item.brand || '',
    type: item.type || '',
    category: item.category || '',
    subcategory: item.subcategory || '',
    description: '',
    price: 0,
    locationPriority: 1000,
    inputs: [],
    outputs: [],
    connections: [],
    specifications: {},
    features: [],
    modelPath: '',
    modelScale: 1.0,
    imageUrl: '',
    affiliateUrl: '',
    purchaseUrl: '',
    commerceStatus: '',
    commerceRetailer: '',
    commerceAvailability: '',
    width_mm: null,
    depth_mm: null,
    height_mm: null,
    isActive: true,
    factoryMeta: {
      backlogId: item.id || slugId(item.name || ''),
      personas: item.personas || [],
      score: item.score || 0,
      reasons: item.reasons || [],
      kbMatch: Boolean(item.kbMatch),
    },
  };
}

function findKbMatch(item, kbProducts = []) {
  const keys = [
    normalizeName(item.name),
    ...(Array.isArray(item.kbKeys) ? item.kbKeys.map(normalizeName) : []),
  ].filter(Boolean);
  for (const kb of kbProducts) {
    const n = normalizeName(kb.name);
    if (keys.some((k) => k === n || n.includes(k) || k.includes(n))) return kb;
  }
  return null;
}

/**
 * Merge backlog item + KB (+ optional researched fields) into a product draft.
 */
function buildProductDraft(item, { kbProducts = [], researched = {} } = {}) {
  const draft = emptyDraft(item);
  const kb = findKbMatch(item, kbProducts);

  if (kb) {
    draft.description = kb.description || draft.description;
    draft.price = kb.price ?? draft.price;
    draft.locationPriority = kb.locationPriority ?? draft.locationPriority;
    draft.inputs = kb.inputs || [];
    draft.outputs = kb.outputs || [];
    draft.connections = kb.connections || [];
    draft.specifications = kb.specifications || {};
    draft.features = kb.features || [];
    draft.width_mm = kb.width_mm ?? null;
    draft.depth_mm = kb.depth_mm ?? null;
    draft.height_mm = kb.height_mm ?? null;
    draft.type = draft.type || kb.type || '';
    draft.brand = draft.brand || kb.brand || '';
    draft.category = draft.category || kb.category || '';
    draft.subcategory = draft.subcategory || kb.subcategory || '';
    draft.factoryMeta.kbMatch = true;
  }

  // Researched overrides (from targets notes / manual enrichment / future search)
  Object.assign(draft, Object.fromEntries(
    Object.entries(researched).filter(([, v]) => v !== undefined && v !== null && v !== '')
  ));

  if (!draft.description) {
    draft.description = `${draft.brand} ${draft.name}`.trim();
  }

  return draft;
}

function suggestedModelFilename(draft) {
  const base = `${draft.brand || ''}${draft.name || ''}`
    .replace(/[^a-zA-Z0-9]+/g, '')
    .replace(/^\d+/, '');
  return `${base || 'Product'}.glb`;
}

module.exports = {
  emptyDraft,
  findKbMatch,
  buildProductDraft,
  suggestedModelFilename,
};
