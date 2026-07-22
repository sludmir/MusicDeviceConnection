/**
 * Pure catalog gap / popularity scoring for LiveSet product backlog.
 * No I/O — CLI loads products, targets, and KB then calls analyzeCatalogGaps.
 */

const EXCLUDED_SUBCATEGORIES = new Set(['cables', 'software']);

/** Mirrors src/productManager.js PRODUCT_CATEGORIES keys (CommonJS-safe). */
const PRODUCT_CATEGORY_TREE = {
  DJ: ['players', 'mixers', 'effects', 'speakers', 'cables', 'accessories'],
  Producer: ['audio-interface', 'synthesizers', 'controllers', 'monitors', 'microphones', 'software'],
  Musician: ['instruments', 'amplifiers', 'effects', 'microphones', 'cables', 'accessories'],
};

/** Map free-text / legacy subcategory labels onto taxonomy keys. */
const SUBCATEGORY_ALIASES = {
  'fx unit': 'effects',
  fx_unit: 'effects',
  fx: 'effects',
  device: 'accessories',
  'audio interface': 'audio-interface',
  audio_interface: 'audio-interface',
  interface: 'audio-interface',
  synth: 'synthesizers',
  synths: 'synthesizers',
  guitar: 'instruments',
  guitars: 'instruments',
  amp: 'amplifiers',
  amps: 'amplifiers',
  pedal: 'effects',
  pedals: 'effects',
  mic: 'microphones',
  mics: 'microphones',
  microphone: 'microphones',
};

function normalizeSubcategory(sub) {
  if (!sub || typeof sub !== 'string') return '';
  const trimmed = sub.trim();
  const alias = SUBCATEGORY_ALIASES[trimmed.toLowerCase()];
  return alias || trimmed;
}

const TIER_SCORE = {
  essential: 40,
  popular: 25,
  nice: 10,
};

const STATUS = {
  PROPOSED: 'proposed',
  READY_TO_MODEL: 'ready_to_model',
  MODELING: 'modeling',
  UPLOADED: 'uploaded',
  STAGED: 'staged_pending_approval',
  REJECTED: 'rejected',
  LIVE: 'live',
};

function normalizeName(raw) {
  if (!raw || typeof raw !== 'string') return '';
  return raw.toLowerCase().replace(/[-\s:_.&"'()]/g, '');
}

function slugId(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function coverageKey(category, subcategory) {
  return `${category || 'Other'}::${subcategory || 'unknown'}`;
}

function buildLiveIndex(products) {
  const byNormName = new Map();
  const coverage = {};

  for (const cat of Object.keys(PRODUCT_CATEGORY_TREE)) {
    for (const sub of PRODUCT_CATEGORY_TREE[cat]) {
      coverage[coverageKey(cat, sub)] = 0;
    }
  }

  for (const p of products || []) {
    const name = p.name || '';
    const norm = normalizeName(name);
    if (norm) byNormName.set(norm, p);

    // Coverage uses primary category only so borrowed multi-setup gear
    // (e.g. DJ FX also listed under Musician) does not fake pedal/amp coverage.
    const cat = p.category || null;
    const sub = normalizeSubcategory(p.subcategory || '');
    if (!sub) continue;
    if (!cat) {
      const key = coverageKey('Other', sub);
      coverage[key] = (coverage[key] || 0) + 1;
      continue;
    }
    const key = coverageKey(cat, sub);
    coverage[key] = (coverage[key] || 0) + 1;
  }

  return { byNormName, coverage };
}

function isLiveMatch(target, byNormName) {
  const candidates = [
    target.name,
    ...(Array.isArray(target.kbKeys) ? target.kbKeys : []),
  ];
  for (const c of candidates) {
    const hit = byNormName.get(normalizeName(c));
    if (hit) return hit;
  }
  // Fuzzy: live name contains target brand+model tokens
  const targetNorm = normalizeName(target.name);
  if (!targetNorm) return null;
  for (const [norm, product] of byNormName.entries()) {
    if (norm.includes(targetNorm) || targetNorm.includes(norm)) return product;
  }
  return null;
}

function findKbProduct(target, kbProducts) {
  if (!Array.isArray(kbProducts) || !kbProducts.length) return null;
  const keys = [
    normalizeName(target.name),
    ...(Array.isArray(target.kbKeys) ? target.kbKeys.map(normalizeName) : []),
  ].filter(Boolean);

  for (const kb of kbProducts) {
    const kbNorm = normalizeName(kb.name);
    if (keys.some((k) => k === kbNorm || kbNorm.includes(k) || k.includes(kbNorm))) {
      return kb;
    }
  }
  return null;
}

function subcategoryCount(coverage, category, subcategory) {
  return coverage[coverageKey(category, subcategory)] || 0;
}

function scoreTarget(target, { coverage, kbMatch, isLive }) {
  const reasons = [];
  let score = 0;

  if (isLive) {
    return { score: 0, reasons: ['already live'], skip: true };
  }

  if (EXCLUDED_SUBCATEGORIES.has(target.subcategory)) {
    return { score: 0, reasons: ['excluded subcategory'], skip: true };
  }

  const tier = target.tier || 'nice';
  const tierPts = TIER_SCORE[tier] ?? TIER_SCORE.nice;
  score += tierPts;
  reasons.push(`${tier} target`);

  const priority = Math.min(5, Math.max(1, Number(target.priority) || 1));
  const priorityPts = priority * 8;
  score += priorityPts;
  reasons.push(`priority ${priority}`);

  const count = subcategoryCount(coverage, target.category, target.subcategory);
  if (count === 0) {
    score += 35;
    reasons.push(`${target.subcategory || 'subcategory'} empty`);
  } else if (count === 1) {
    score += 18;
    reasons.push(`${target.subcategory} thin (1)`);
  } else if (count >= 4) {
    score -= 20;
    reasons.push(`${target.subcategory} already heavy (${count})`);
  }

  if (kbMatch) {
    score += 20;
    reasons.push('in KB not live');
  }

  return { score, reasons, skip: false };
}

/**
 * Build need-more / need-less summary from coverage counts.
 */
function buildCoverageSummary(coverage) {
  const needMore = [];
  const needLess = [];

  for (const [key, count] of Object.entries(coverage)) {
    const [category, subcategory] = key.split('::');
    if (EXCLUDED_SUBCATEGORIES.has(subcategory)) continue;
    if (!PRODUCT_CATEGORY_TREE[category]) continue;

    if (count === 0) {
      needMore.push({ category, subcategory, count, note: 'empty — prioritize' });
    } else if (count === 1) {
      needMore.push({ category, subcategory, count, note: 'thin coverage' });
    } else if (count >= 4) {
      needLess.push({ category, subcategory, count, note: 'well covered — deprioritize similar adds' });
    }
  }

  needMore.sort((a, b) => a.count - b.count || a.category.localeCompare(b.category));
  needLess.sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));
  return { needMore, needLess };
}

/**
 * Merge previous backlog statuses (except live, which is recomputed).
 */
function mergePriorStatus(items, priorItems) {
  if (!Array.isArray(priorItems) || !priorItems.length) return items;
  const byId = new Map(priorItems.map((i) => [i.id, i]));
  return items.map((item) => {
    const prev = byId.get(item.id);
    if (!prev) return item;
    if (item.status === STATUS.LIVE) {
      return {
        ...item,
        meshyBrief: prev.meshyBrief ?? item.meshyBrief,
      };
    }
    const keepStatus = [
      STATUS.READY_TO_MODEL,
      STATUS.MODELING,
      STATUS.UPLOADED,
      STATUS.STAGED,
      STATUS.REJECTED,
    ].includes(prev.status)
      ? prev.status
      : item.status;
    return {
      ...item,
      status: keepStatus,
      meshyBrief: prev.meshyBrief ?? item.meshyBrief,
    };
  });
}

/**
 * @param {object} input
 * @param {Array<object>} input.products - live Firestore (or PRODUCTS.md) products
 * @param {Array<{persona, targets}>} input.targetFiles - parsed target JSON contents
 * @param {Array<object>} [input.kbProducts] - unique KB product rows
 * @param {Array<object>} [input.priorItems] - previous backlog items for status merge
 * @param {string} [input.generatedAt]
 * @param {string} [input.source] - 'firestore' | 'products.md' | 'fixture'
 */
function analyzeCatalogGaps({
  products = [],
  targetFiles = [],
  kbProducts = [],
  priorItems = [],
  generatedAt = new Date().toISOString(),
  source = 'unknown',
} = {}) {
  const { byNormName, coverage } = buildLiveIndex(products);
  const coverageSummary = buildCoverageSummary(coverage);

  // Unique KB products not in live catalog → synthetic candidates if not already a target
  const kbNotLive = [];
  const seenKb = new Set();
  for (const kb of kbProducts) {
    const norm = normalizeName(kb.name);
    if (!norm || seenKb.has(norm)) continue;
    seenKb.add(norm);
    if (byNormName.has(norm)) continue;
    let fuzzyLive = false;
    for (const liveNorm of byNormName.keys()) {
      if (liveNorm.includes(norm) || norm.includes(liveNorm)) {
        fuzzyLive = true;
        break;
      }
    }
    if (fuzzyLive) continue;
    if (EXCLUDED_SUBCATEGORIES.has(kb.subcategory)) continue;
    kbNotLive.push(kb);
  }

  const itemsById = new Map();

  for (const file of targetFiles) {
    const persona = file.persona || 'unknown';
    for (const target of file.targets || []) {
      const live = isLiveMatch(target, byNormName);
      const kbMatch = findKbProduct(target, kbProducts);
      const { score, reasons, skip } = scoreTarget(target, {
        coverage,
        kbMatch: Boolean(kbMatch),
        isLive: Boolean(live),
      });

      const id = slugId(target.name);
      const existing = itemsById.get(id);
      const personas = existing
        ? Array.from(new Set([...(existing.personas || []), persona]))
        : [persona];

      if (live) {
        itemsById.set(id, {
          id,
          name: target.name,
          brand: target.brand || live.brand || '',
          category: target.category || live.category || '',
          subcategory: target.subcategory || live.subcategory || '',
          type: target.type || live.type || '',
          personas,
          score: 0,
          reasons: ['already live'],
          status: STATUS.LIVE,
          kbMatch: Boolean(kbMatch),
          meshyBrief: null,
          liveProductId: live.id || null,
        });
        continue;
      }

      if (skip && !existing) {
        // excluded — omit from backlog
        continue;
      }

      const next = {
        id,
        name: target.name,
        brand: target.brand || '',
        category: target.category || '',
        subcategory: target.subcategory || '',
        type: target.type || '',
        personas,
        score: existing ? Math.max(existing.score, score) : score,
        reasons: existing
          ? Array.from(new Set([...(existing.reasons || []), ...reasons]))
          : reasons,
        status: STATUS.PROPOSED,
        kbMatch: Boolean(kbMatch) || Boolean(existing?.kbMatch),
        meshyBrief: null,
        notes: target.notes || '',
      };
      itemsById.set(id, next);
    }
  }

  // Add KB-not-live products that weren't already targeted
  for (const kb of kbNotLive) {
    const id = slugId(kb.name);
    if (itemsById.has(id)) continue;
    const fakeTarget = {
      name: kb.name,
      brand: kb.brand,
      category: kb.category,
      subcategory: kb.subcategory,
      type: kb.type,
      priority: 3,
      tier: 'popular',
    };
    const { score, reasons, skip } = scoreTarget(fakeTarget, {
      coverage,
      kbMatch: true,
      isLive: false,
    });
    if (skip) continue;
    itemsById.set(id, {
      id,
      name: kb.name,
      brand: kb.brand || '',
      category: kb.category || '',
      subcategory: kb.subcategory || '',
      type: kb.type || '',
      personas: ['kb-gap'],
      score,
      reasons: [...reasons, 'KB-only candidate'],
      status: STATUS.PROPOSED,
      kbMatch: true,
      meshyBrief: null,
      notes: 'Present in productKnowledgeBase but not live in Firestore.',
    });
  }

  let items = Array.from(itemsById.values());
  items = mergePriorStatus(items, priorItems);
  items.sort((a, b) => {
    if (a.status === STATUS.LIVE && b.status !== STATUS.LIVE) return 1;
    if (b.status === STATUS.LIVE && a.status !== STATUS.LIVE) return -1;
    return b.score - a.score || a.name.localeCompare(b.name);
  });

  const openItems = items.filter((i) => i.status !== STATUS.LIVE);
  const topOpen = openItems.slice(0, 10);

  return {
    version: 1,
    generatedAt,
    source,
    summary: {
      totalLiveProducts: products.length,
      backlogOpen: openItems.length,
      backlogLive: items.filter((i) => i.status === STATUS.LIVE).length,
      targetFiles: targetFiles.length,
      kbNotLiveCount: kbNotLive.length,
    },
    coverage,
    coverageSummary,
    topRecommendations: topOpen.map((i) => ({
      id: i.id,
      name: i.name,
      score: i.score,
      personas: i.personas,
      reasons: i.reasons,
    })),
    items,
  };
}

/**
 * Parse PRODUCTS.md bullet rows into minimal product objects.
 */
function parseProductsMarkdown(md) {
  const products = [];
  const re = /^-\s+\*\*(.+?)\*\*\s+—\s+(.+?)\s+—\s+(.+?)\s+—\s+3D model:/gm;
  let m;
  while ((m = re.exec(md)) !== null) {
    const name = m[1].trim();
    const brand = m[2].trim();
    const subcategory = m[3].trim();
    if (!name || name === 'undefined') continue;
    products.push({
      name,
      brand: brand === '—' ? '' : brand,
      subcategory: subcategory === '—' ? '' : subcategory,
      category: null,
    });
  }

  // Second pass: assign category from ## DJ (N) headings
  const sections = md.split(/^## /m);
  const byName = new Map();
  for (const section of sections) {
    const headerMatch = section.match(/^(DJ|Producer|Musician|Other)\s*\(/);
    if (!headerMatch) continue;
    const category = headerMatch[1] === 'Other' ? null : headerMatch[1];
    let sm;
    const rowRe = /^-\s+\*\*(.+?)\*\*\s+—\s+(.+?)\s+—\s+(.+?)\s+—\s+3D model:/gm;
    while ((sm = rowRe.exec(section)) !== null) {
      const name = sm[1].trim();
      if (!name || name === 'undefined') continue;
      const existing = byName.get(name);
      if (existing) {
        if (category) {
          const types = new Set(existing.compatibleSetupTypes || []);
          types.add(category);
          existing.compatibleSetupTypes = Array.from(types);
          if (!existing.category) existing.category = category;
        }
      } else {
        byName.set(name, {
          name,
          brand: sm[2].trim() === '—' ? '' : sm[2].trim(),
          subcategory: sm[3].trim() === '—' ? '' : sm[3].trim(),
          category,
          compatibleSetupTypes: category ? [category] : [],
        });
      }
    }
  }

  if (byName.size) return Array.from(byName.values());
  return products;
}

/**
 * Extract unique KB product stubs from productKnowledgeBase.js source text.
 */
function parseKnowledgeBaseSource(source) {
  const products = [];
  const seen = new Set();
  const re =
    /name:\s*'([^']+)'\s*,\s*brand:\s*'([^']+)'\s*,\s*type:\s*'([^']+)'\s*,\s*category:\s*'([^']+)'\s*,\s*subcategory:\s*'([^']+)'/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    const name = m[1];
    const norm = normalizeName(name);
    if (seen.has(norm)) continue;
    seen.add(norm);
    products.push({
      name,
      brand: m[2],
      type: m[3],
      category: m[4],
      subcategory: m[5],
    });
  }
  return products;
}

function renderBacklogMarkdown(analysis) {
  const lines = [];
  lines.push('# Catalog backlog');
  lines.push('');
  lines.push(`Generated: ${analysis.generatedAt}`);
  lines.push(`Source: ${analysis.source}`);
  lines.push(`Live products: ${analysis.summary.totalLiveProducts}`);
  lines.push(`Open backlog: ${analysis.summary.backlogOpen}`);
  lines.push('');
  lines.push('## Need more');
  lines.push('');
  if (!analysis.coverageSummary.needMore.length) {
    lines.push('_No empty/thin subcategories._');
  } else {
    for (const row of analysis.coverageSummary.needMore) {
      lines.push(`- **${row.category} / ${row.subcategory}** — count ${row.count} — ${row.note}`);
    }
  }
  lines.push('');
  lines.push('## Need less (already heavy)');
  lines.push('');
  if (!analysis.coverageSummary.needLess.length) {
    lines.push('_No over-indexed subcategories._');
  } else {
    for (const row of analysis.coverageSummary.needLess) {
      lines.push(`- **${row.category} / ${row.subcategory}** — count ${row.count} — ${row.note}`);
    }
  }
  lines.push('');
  lines.push('## Top recommendations');
  lines.push('');
  for (const item of analysis.topRecommendations) {
    lines.push(
      `- **${item.name}** (score ${item.score}) — ${item.personas.join(', ')} — ${item.reasons.join('; ')}`
    );
  }
  lines.push('');
  lines.push('## Full open queue');
  lines.push('');
  const open = analysis.items.filter((i) => i.status !== STATUS.LIVE);
  for (const item of open) {
    lines.push(
      `- [${item.status}] **${item.name}** — ${item.brand} — ${item.category}/${item.subcategory} — score ${item.score}`
    );
  }
  lines.push('');
  return lines.join('\n');
}

module.exports = {
  EXCLUDED_SUBCATEGORIES,
  PRODUCT_CATEGORY_TREE,
  TIER_SCORE,
  STATUS,
  normalizeName,
  normalizeSubcategory,
  slugId,
  analyzeCatalogGaps,
  parseProductsMarkdown,
  parseKnowledgeBaseSource,
  renderBacklogMarkdown,
  buildLiveIndex,
  scoreTarget,
  mergePriorStatus,
  SUBCATEGORY_ALIASES,
};
