const { validateProposal, PROPOSAL_VERSION } = require('../../scripts/lib/proposalSchema');
const { parseZzoundsItemId, buildZzoundsAffiliateUrl, isAllowedPurchaseHost } = require('../../scripts/lib/commerceUrl');
const { classifyAvailability } = require('../../scripts/lib/commerceAudit');

describe('proposalSchema', () => {
  test('accepts a valid proposal', () => {
    const { valid, errors } = validateProposal({
      version: PROPOSAL_VERSION,
      generatedAt: new Date().toISOString(),
      runId: 'test-run',
      changes: [{
        productId: 'abc',
        updates: {
          purchaseUrl: 'https://www.zzounds.com/item--TEST',
          commerceStatus: 'monetized',
          commerceAvailability: 'in_stock',
        },
      }],
    });
    expect(valid).toBe(true);
    expect(errors).toEqual([]);
  });

  test('rejects disallowed update fields', () => {
    const { valid, errors } = validateProposal({
      version: PROPOSAL_VERSION,
      generatedAt: new Date().toISOString(),
      runId: 'test-run',
      changes: [{ productId: 'abc', updates: { name: 'nope' } }],
    });
    expect(valid).toBe(false);
    expect(errors.some((e) => e.includes('name'))).toBe(true);
  });
});

describe('commerceUrl helpers', () => {
  test('parseZzoundsItemId extracts slug', () => {
    expect(parseZzoundsItemId('https://www.zzounds.com/item--PIOCDJ3000')).toBe('PIOCDJ3000');
  });

  test('buildZzoundsAffiliateUrl uses path-based sid', () => {
    expect(buildZzoundsAffiliateUrl('ABC', 'creator1', '3998299'))
      .toBe('https://www.zzounds.com/a--3998299/sid--creator1/item--ABC');
  });

  test('isAllowedPurchaseHost permits manufacturer stores', () => {
    expect(isAllowedPurchaseHost('teile.life')).toBe(true);
    expect(isAllowedPurchaseHost('evil.example.com')).toBe(false);
  });
});

describe('classifyAvailability', () => {
  test('detects out of stock copy', () => {
    expect(classifyAvailability(200, '<html>Currently unavailable</html>')).toBe('out_of_stock');
  });

  test('detects discontinued via 404', () => {
    expect(classifyAvailability(404, '')).toBe('discontinued');
  });
});
