import { buildClickPayload } from './affiliateClicks';

describe('buildClickPayload', () => {
  test('fills all ledger fields', () => {
    const payload = buildClickPayload({
      product: { id: 'p1', name: 'CDJ-3000' },
      attribution: { creatorId: 'c1', setupId: 's1' },
      clickerUid: 'u1',
      source: 'mini-profile',
      urlKind: 'product-link',
    });
    expect(payload).toEqual({
      productId: 'p1',
      productName: 'CDJ-3000',
      creatorId: 'c1',
      setupId: 's1',
      clickerUid: 'u1',
      source: 'mini-profile',
      urlKind: 'product-link',
    });
  });

  test('nulls attribution fields when absent', () => {
    const payload = buildClickPayload({
      product: { id: 'p1', name: 'CDJ-3000' },
      attribution: null,
      clickerUid: 'u1',
      source: 'hover-menu',
      urlKind: 'search-fallback',
    });
    expect(payload.creatorId).toBeNull();
    expect(payload.setupId).toBeNull();
  });
});
