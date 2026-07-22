const {
  mintFactoryToken,
  verifyFactoryToken,
  buildDecisionUrl,
} = require('../../functions/lib/factoryTokens');
const {
  checkGlbSize,
  checkProportion,
  runFactoryQa,
  MAX_GLB_BYTES,
} = require('../../scripts/lib/factoryQa');
const { pickWeeklyBatch } = require('../../scripts/lib/factoryPick');
const { buildProductDraft } = require('../../scripts/lib/factoryDraft');
const { prepareFactoryDigest } = require('../../scripts/lib/factoryEmail');
const { STATUS } = require('../../scripts/lib/catalogGapAnalysis');

describe('factoryTokens', () => {
  const secret = 'test-secret-xyz';

  test('mint and verify approve token', () => {
    const token = mintFactoryToken(
      { runId: '2026-07-21', productId: 'boss-ds-1', decision: 'approve' },
      secret
    );
    const v = verifyFactoryToken(token, secret);
    expect(v.valid).toBe(true);
    expect(v.payload.decision).toBe('approve');
    expect(v.payload.productId).toBe('boss-ds-1');
  });

  test('rejects tampered token', () => {
    const token = mintFactoryToken(
      { runId: '2026-07-21', productId: 'x', decision: 'reject' },
      secret
    );
    const bad = `${token.slice(0, -2)}ab`;
    expect(verifyFactoryToken(bad, secret).valid).toBe(false);
  });

  test('buildDecisionUrl encodes token', () => {
    const url = buildDecisionUrl('https://example.com/factoryDecide', 'a.b');
    expect(url).toBe('https://example.com/factoryDecide?token=a.b');
  });
});

describe('factoryQa', () => {
  test('rejects oversized GLB', () => {
    const buf = Buffer.alloc(MAX_GLB_BYTES + 1);
    const r = checkGlbSize(buf);
    expect(r.ok).toBe(false);
  });

  test('flags cube vs rectangular product', () => {
    const r = checkProportion(
      { x: 1, y: 1, z: 1 },
      { width_mm: 480, depth_mm: 270, height_mm: 60 }
    );
    expect(r.ok).toBe(false);
    expect(r.hardReasons).toContain('looks_like_cube_vs_rectangular_product');
  });

  test('mid-axis mismatch is soft for flat square pads', () => {
    const r = checkProportion(
      { x: 1, y: 0.2, z: 1 },
      { width_mm: 241, depth_mm: 241, height_mm: 21 }
    );
    expect(r.ok).toBe(true);
  });

  test('runFactoryQa ok for small buffer without dims', () => {
    const r = runFactoryQa(Buffer.alloc(100), null);
    expect(r.ok).toBe(true);
  });
});

describe('factoryPick', () => {
  test('caps at limit and balances personas', () => {
    const items = [
      { id: 'a', name: 'A', score: 100, status: STATUS.PROPOSED, personas: ['guitar-rig'] },
      { id: 'b', name: 'B', score: 99, status: STATUS.PROPOSED, personas: ['studio-producer'] },
      { id: 'c', name: 'C', score: 98, status: STATUS.PROPOSED, personas: ['accessible-dj'] },
      { id: 'd', name: 'D', score: 97, status: STATUS.PROPOSED, personas: ['guitar-rig'] },
      { id: 'live', name: 'Live', score: 200, status: STATUS.LIVE, personas: ['guitar-rig'] },
    ];
    const picked = pickWeeklyBatch(items, { limit: 3 });
    expect(picked).toHaveLength(3);
    expect(picked.map((p) => p.id).sort()).toEqual(['a', 'b', 'c']);
  });
});

describe('factoryDraft + email', () => {
  test('merges KB dims into draft', () => {
    const draft = buildProductDraft(
      { id: 'x', name: 'Pioneer CDJ-2000NXS2', brand: 'Pioneer DJ', category: 'DJ', subcategory: 'players', type: 'cdj' },
      {
        kbProducts: [{
          name: 'Pioneer CDJ-2000NXS2',
          brand: 'Pioneer DJ',
          type: 'cdj',
          category: 'DJ',
          subcategory: 'players',
          width_mm: 320,
          depth_mm: 406,
          height_mm: 106,
          description: 'Club CDJ',
        }],
      }
    );
    expect(draft.width_mm).toBe(320);
    expect(draft.description).toBe('Club CDJ');
  });

  test('digest html includes approve links', () => {
    const { prepareFactoryDigest } = require('../../scripts/lib/factoryEmail');
    const { html } = prepareFactoryDigest({
      runId: '2026-07-21',
      generatedAt: '2026-07-21T00:00:00.000Z',
      approveAllUrl: 'https://example.com?token=all',
      products: [{
        id: 'boss-ds-1',
        name: 'Boss DS-1',
        brand: 'Boss',
        category: 'Musician',
        subcategory: 'effects',
        reasons: ['essential'],
        sizeBytes: 1024,
        approveUrl: 'https://example.com?token=a',
        rejectUrl: 'https://example.com?token=r',
        publicImageUrl: 'https://cdn.example.com/boss.jpg',
        draft: { width_mm: 70, depth_mm: 120, height_mm: 50 },
      }],
    });
    expect(html).toContain('Boss DS-1');
    expect(html).toContain('Approve all remaining');
    expect(html).toContain('token=a');
    expect(html).not.toContain('file://');
  });
});
