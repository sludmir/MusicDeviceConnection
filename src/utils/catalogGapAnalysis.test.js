const {
  analyzeCatalogGaps,
  parseProductsMarkdown,
  parseKnowledgeBaseSource,
  normalizeName,
  scoreTarget,
  STATUS,
} = require('../../scripts/lib/catalogGapAnalysis');

describe('normalizeName', () => {
  test('strips punctuation and case', () => {
    expect(normalizeName('Pioneer CDJ-2000NXS2')).toBe('pioneercdj2000nxs2');
  });
});

describe('scoreTarget', () => {
  const emptyCoverage = {
    'Musician::amplifiers': 0,
    'Musician::effects': 0,
    'Producer::synthesizers': 5,
  };

  test('boosts empty subcategory and essential tier', () => {
    const { score, reasons, skip } = scoreTarget(
      {
        name: 'Fender Twin Reverb',
        category: 'Musician',
        subcategory: 'amplifiers',
        priority: 5,
        tier: 'essential',
      },
      { coverage: emptyCoverage, kbMatch: false, isLive: false }
    );
    expect(skip).toBe(false);
    expect(score).toBeGreaterThan(70);
    expect(reasons.some((r) => r.includes('empty'))).toBe(true);
  });

  test('boosts KB-not-live', () => {
    const { score, reasons } = scoreTarget(
      {
        name: 'Pioneer CDJ-2000NXS2',
        category: 'DJ',
        subcategory: 'players',
        priority: 5,
        tier: 'essential',
      },
      { coverage: { 'DJ::players': 2 }, kbMatch: true, isLive: false }
    );
    expect(reasons).toContain('in KB not live');
    expect(score).toBeGreaterThan(50);
  });

  test('skips cables', () => {
    const { skip } = scoreTarget(
      { name: 'XLR Cable', category: 'DJ', subcategory: 'cables', priority: 5, tier: 'essential' },
      { coverage: {}, kbMatch: false, isLive: false }
    );
    expect(skip).toBe(true);
  });

  test('skips already live', () => {
    const { skip, reasons } = scoreTarget(
      { name: 'CDJ-3000', category: 'DJ', subcategory: 'players', priority: 5, tier: 'essential' },
      { coverage: {}, kbMatch: false, isLive: true }
    );
    expect(skip).toBe(true);
    expect(reasons).toContain('already live');
  });

  test('downranks heavy subcategories', () => {
    const heavy = scoreTarget(
      {
        name: 'Yet Another Synth',
        category: 'Producer',
        subcategory: 'synthesizers',
        priority: 2,
        tier: 'nice',
      },
      { coverage: { 'Producer::synthesizers': 5 }, kbMatch: false, isLive: false }
    );
    const empty = scoreTarget(
      {
        name: 'Boss DS-1',
        category: 'Musician',
        subcategory: 'effects',
        priority: 2,
        tier: 'nice',
      },
      { coverage: { 'Musician::effects': 0 }, kbMatch: false, isLive: false }
    );
    expect(empty.score).toBeGreaterThan(heavy.score);
  });
});

describe('analyzeCatalogGaps', () => {
  const products = [
    { id: '1', name: 'CDJ-3000', brand: 'Pioneer DJ', category: 'DJ', subcategory: 'players', type: 'cdj' },
    { id: '2', name: 'Arturia MiniFreak', brand: 'Arturia', category: 'Producer', subcategory: 'synthesizers', type: 'synthesizer' },
    { id: '3', name: 'Korg Minilogue XD', brand: 'Korg', category: 'Producer', subcategory: 'synthesizers', type: 'synthesizer' },
    { id: '4', name: 'Sequential Prophet-6', brand: 'Sequential', category: 'Producer', subcategory: 'synthesizers', type: 'synthesizer' },
    { id: '5', name: 'Roland TB-303', brand: 'Roland', category: 'Producer', subcategory: 'synthesizers', type: 'synthesizer' },
    { id: '6', name: 'Fender Stratocaster', brand: 'Fender', category: 'Musician', subcategory: 'instruments', type: 'guitar' },
  ];

  const targetFiles = [
    {
      persona: 'guitar-rig',
      targets: [
        {
          name: 'Boss DS-1 Distortion',
          brand: 'Boss',
          category: 'Musician',
          subcategory: 'effects',
          type: 'pedal',
          priority: 5,
          tier: 'essential',
        },
        {
          name: 'Fender Twin Reverb',
          brand: 'Fender',
          category: 'Musician',
          subcategory: 'amplifiers',
          type: 'guitar_amp',
          priority: 5,
          tier: 'essential',
        },
      ],
    },
    {
      persona: 'accessible-dj',
      targets: [
        {
          name: 'Pioneer CDJ-2000NXS2',
          brand: 'Pioneer DJ',
          category: 'DJ',
          subcategory: 'players',
          type: 'cdj',
          priority: 5,
          tier: 'essential',
          kbKeys: ['CDJ-2000NXS2'],
        },
        {
          name: 'CDJ-3000',
          brand: 'Pioneer DJ',
          category: 'DJ',
          subcategory: 'players',
          type: 'cdj',
          priority: 5,
          tier: 'essential',
        },
      ],
    },
  ];

  const kbProducts = [
    {
      name: 'Pioneer CDJ-2000NXS2',
      brand: 'Pioneer DJ',
      type: 'cdj',
      category: 'DJ',
      subcategory: 'players',
    },
    {
      name: 'Ableton Push 3',
      brand: 'Ableton',
      type: 'midi_controller',
      category: 'Producer',
      subcategory: 'controllers',
    },
  ];

  test('ranks empty musician gear and accessible DJ above live items', () => {
    const result = analyzeCatalogGaps({
      products,
      targetFiles,
      kbProducts,
      source: 'fixture',
    });

    expect(result.coverageSummary.needMore.some((r) => r.subcategory === 'amplifiers')).toBe(true);
    expect(result.coverageSummary.needMore.some((r) => r.subcategory === 'effects' && r.category === 'Musician')).toBe(true);
    expect(result.coverageSummary.needLess.some((r) => r.subcategory === 'synthesizers')).toBe(true);

    const openNames = result.topRecommendations.map((r) => r.name);
    expect(openNames).toContain('Boss DS-1 Distortion');
    expect(openNames).toContain('Fender Twin Reverb');
    expect(openNames).toContain('Pioneer CDJ-2000NXS2');

    const live = result.items.find((i) => i.name === 'CDJ-3000');
    expect(live.status).toBe(STATUS.LIVE);

    const cdj2k = result.items.find((i) => i.id === 'pioneer-cdj-2000nxs2');
    expect(cdj2k.kbMatch).toBe(true);
    expect(cdj2k.reasons).toContain('in KB not live');
  });

  test('preserves ready_to_model status from prior backlog', () => {
    const result = analyzeCatalogGaps({
      products,
      targetFiles,
      kbProducts,
      priorItems: [
        {
          id: 'boss-ds-1-distortion',
          status: STATUS.READY_TO_MODEL,
          meshyBrief: 'use orange enclosure refs',
        },
      ],
    });
    const ds1 = result.items.find((i) => i.id === 'boss-ds-1-distortion');
    expect(ds1.status).toBe(STATUS.READY_TO_MODEL);
    expect(ds1.meshyBrief).toBe('use orange enclosure refs');
  });

  test('marks prior item live when product appears', () => {
    const result = analyzeCatalogGaps({
      products: [
        ...products,
        {
          id: '99',
          name: 'Boss DS-1 Distortion',
          brand: 'Boss',
          category: 'Musician',
          subcategory: 'effects',
        },
      ],
      targetFiles,
      kbProducts,
      priorItems: [{ id: 'boss-ds-1-distortion', status: STATUS.MODELING }],
    });
    const ds1 = result.items.find((i) => i.id === 'boss-ds-1-distortion');
    expect(ds1.status).toBe(STATUS.LIVE);
  });

  test('adds KB-only candidates', () => {
    const result = analyzeCatalogGaps({
      products,
      targetFiles: [],
      kbProducts,
    });
    expect(result.items.some((i) => i.name === 'Ableton Push 3')).toBe(true);
    expect(result.summary.kbNotLiveCount).toBeGreaterThan(0);
  });
});

describe('parseProductsMarkdown', () => {
  test('parses PRODUCTS.md sections', () => {
    const md = `
## DJ (2)

- **CDJ-3000** — Pioneer DJ — players — 3D model: ✓
- **Laptop** — Apple — device — 3D model: ✓

## Musician (1)

- **Fender Stratocaster** — Fender — instruments — 3D model: ✓
`;
    const products = parseProductsMarkdown(md);
    expect(products).toHaveLength(3);
    const cdj = products.find((p) => p.name === 'CDJ-3000');
    expect(cdj.category).toBe('DJ');
    expect(cdj.subcategory).toBe('players');
  });
});

describe('parseKnowledgeBaseSource', () => {
  test('extracts unique products', () => {
    const src = `
add(['CDJ-3000'], {
  name: 'Pioneer CDJ-3000', brand: 'Pioneer DJ', type: 'cdj', category: 'DJ', subcategory: 'players',
});
add(['CDJ3000'], {
  name: 'Pioneer CDJ-3000', brand: 'Pioneer DJ', type: 'cdj', category: 'DJ', subcategory: 'players',
});
add(['Push 3'], {
  name: 'Ableton Push 3', brand: 'Ableton', type: 'midi_controller', category: 'Producer', subcategory: 'controllers',
});
`;
    const products = parseKnowledgeBaseSource(src);
    expect(products).toHaveLength(2);
    expect(products.map((p) => p.name)).toEqual([
      'Pioneer CDJ-3000',
      'Ableton Push 3',
    ]);
  });
});
