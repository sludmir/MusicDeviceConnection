import { buildBuyLink, buildSubtag } from './affiliateLink';

describe('buildSubtag', () => {
  test('joins creatorId and setupId with a hyphen', () => {
    expect(buildSubtag({ creatorId: 'abc123', setupId: 'set456' })).toBe('abc123-set456');
  });

  test('returns empty string with no creator', () => {
    expect(buildSubtag(null)).toBe('');
    expect(buildSubtag({ creatorId: null, setupId: 'set456' })).toBe('');
  });

  test('strips unsafe characters and truncates to 90 chars', () => {
    const sub = buildSubtag({ creatorId: 'a$b c!', setupId: 'x'.repeat(200) });
    expect(sub).toMatch(/^[A-Za-z0-9-]+$/);
    expect(sub.length).toBeLessThanOrEqual(90);
  });
});

describe('buildBuyLink', () => {
  const OLD_ENV = process.env.REACT_APP_AMAZON_ASSOC_TAG;
  beforeEach(() => { process.env.REACT_APP_AMAZON_ASSOC_TAG = 'liveset-20'; });
  afterEach(() => { process.env.REACT_APP_AMAZON_ASSOC_TAG = OLD_ENV; });

  test('builds Amazon search fallback when product has no affiliateUrl', () => {
    const link = buildBuyLink({ name: 'CDJ-3000', brand: 'Pioneer DJ' }, null);
    const url = new URL(link.url);
    expect(url.hostname).toBe('www.amazon.com');
    expect(url.pathname).toBe('/s');
    expect(url.searchParams.get('k')).toBe('Pioneer DJ CDJ-3000');
    expect(url.searchParams.get('tag')).toBe('liveset-20');
    expect(link.urlKind).toBe('search-fallback');
    expect(link.isAmazon).toBe(true);
  });

  test('adds tag and ascsubtag to an Amazon product URL', () => {
    const link = buildBuyLink(
      { name: 'CDJ-3000', affiliateUrl: 'https://www.amazon.com/dp/B08F2ND1?th=1' },
      { creatorId: 'creator1', setupId: 'setup9' }
    );
    const url = new URL(link.url);
    expect(url.searchParams.get('tag')).toBe('liveset-20');
    expect(url.searchParams.get('ascsubtag')).toBe('creator1-setup9');
    expect(url.searchParams.get('th')).toBe('1');
    expect(link.urlKind).toBe('product-link');
  });

  test('returns non-Amazon affiliateUrl untouched', () => {
    const raw = 'https://www.thomann.de/intl/pioneer_cdj_3000.htm?partner=xyz';
    const link = buildBuyLink({ name: 'CDJ-3000', affiliateUrl: raw }, { creatorId: 'c', setupId: 's' });
    expect(link.url).toBe(raw);
    expect(link.isAmazon).toBe(false);
    expect(link.urlKind).toBe('product-link');
  });

  test('omits ascsubtag when there is no attribution', () => {
    const link = buildBuyLink({ name: 'CDJ-3000', affiliateUrl: 'https://www.amazon.com/dp/B08F2N' }, null);
    expect(new URL(link.url).searchParams.get('ascsubtag')).toBeNull();
  });

  test('still builds a link without env tag (no tag param)', () => {
    delete process.env.REACT_APP_AMAZON_ASSOC_TAG;
    const link = buildBuyLink({ name: 'CDJ-3000', brand: 'Pioneer DJ' }, null);
    expect(new URL(link.url).searchParams.get('tag')).toBeNull();
  });

  test('returns null when product has no name, brand, or url', () => {
    expect(buildBuyLink({}, null)).toBeNull();
    expect(buildBuyLink(null, null)).toBeNull();
  });
});
