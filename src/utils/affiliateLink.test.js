import { buildBuyLink, buildSubtag, buyButtonLabel, detectRetailer } from './affiliateLink';

describe('buildSubtag', () => {
  test('joins creatorId and setupId with a hyphen', () => {
    expect(buildSubtag({ creatorId: 'abc123', setupId: 'set456' })).toBe('abc123-set456');
  });

  test('returns empty string with no creator', () => {
    expect(buildSubtag(null)).toBe('');
    expect(buildSubtag({ creatorId: null, setupId: 'set456' })).toBe('');
  });

  test('strips unsafe characters and truncates to maxLen', () => {
    const sub = buildSubtag({ creatorId: 'a$b c!', setupId: 'x'.repeat(200) }, 50);
    expect(sub).toMatch(/^[A-Za-z0-9-]+$/);
    expect(sub.length).toBeLessThanOrEqual(50);
  });
});

describe('detectRetailer', () => {
  test('detects supported retailer hostnames', () => {
    expect(detectRetailer('www.zzounds.com')?.id).toBe('cj');
    expect(detectRetailer('www.guitarcenter.com')?.id).toBe('cj');
    expect(detectRetailer('www.reverb.com')?.id).toBe('awin');
    expect(detectRetailer('www.thomann.de')?.id).toBe('thomann');
    expect(detectRetailer('www.amazon.com')?.id).toBe('amazon');
  });
});

describe('buyButtonLabel', () => {
  test('uses retailer label when available', () => {
    expect(buyButtonLabel({ retailerLabel: 'zZounds', isAmazon: false })).toBe('Buy on zZounds ↗');
  });

  test('falls back to Amazon label', () => {
    expect(buyButtonLabel({ isAmazon: true, retailerLabel: null })).toBe('Buy on Amazon ↗');
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
    expect(link.retailer).toBe('amazon');
    expect(link.retailerLabel).toBe('Amazon');
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
    expect(link.retailer).toBe('amazon');
  });

  test('adds sid to CJ retailer URLs', () => {
    const link = buildBuyLink(
      { name: 'CDJ-3000', affiliateUrl: 'https://www.zzounds.com/item--PIONEERCDJ3000' },
      { creatorId: 'creator1', setupId: 'setup9' }
    );
    const url = new URL(link.url);
    expect(url.searchParams.get('sid')).toBe('creator1-setup9');
    expect(link.retailer).toBe('cj');
    expect(link.retailerLabel).toBe('zZounds');
    expect(link.isAmazon).toBe(false);
  });

  test('adds clickref to Reverb URLs', () => {
    const link = buildBuyLink(
      { name: 'Prophet-6', affiliateUrl: 'https://reverb.com/item/12345-sequential-prophet-6' },
      { creatorId: 'creator1', setupId: 'setup9' }
    );
    const url = new URL(link.url);
    expect(url.searchParams.get('clickref')).toBe('creator1-setup9');
    expect(link.retailer).toBe('awin');
    expect(link.retailerLabel).toBe('Reverb');
  });

  test('adds subid to Thomann URLs', () => {
    const link = buildBuyLink(
      { name: 'CDJ-3000', affiliateUrl: 'https://www.thomann.de/intl/pioneer_cdj_3000.htm?partner=xyz' },
      { creatorId: 'c', setupId: 's' }
    );
    const url = new URL(link.url);
    expect(url.searchParams.get('partner')).toBe('xyz');
    expect(url.searchParams.get('subid')).toBe('c-s');
    expect(link.retailer).toBe('thomann');
    expect(link.retailerLabel).toBe('Thomann');
  });

  test('omits subid when there is no attribution', () => {
    const link = buildBuyLink(
      { name: 'CDJ-3000', affiliateUrl: 'https://www.zzounds.com/item--PIONEERCDJ3000' },
      null
    );
    expect(new URL(link.url).searchParams.get('sid')).toBeNull();
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
