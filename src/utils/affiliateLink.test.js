import { buildBuyLink, buildSubtag, buildZzoundsAffiliateUrl, buyButtonLabel, detectRetailer, parseZzoundsItemId, purchaseLinkNotice, resolveCartMonetized } from './affiliateLink';

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

describe('parseZzoundsItemId', () => {
  test('extracts item slug from plain and affiliate URLs', () => {
    expect(parseZzoundsItemId('https://www.zzounds.com/item--PIOCDJ3000')).toBe('PIOCDJ3000');
    expect(parseZzoundsItemId('https://www.zzounds.com/a--3998299/sid--creator1/item--PIOCDJ3000')).toBe('PIOCDJ3000');
  });
});

describe('buildZzoundsAffiliateUrl', () => {
  test('builds official a-- and sid-- path format', () => {
    expect(buildZzoundsAffiliateUrl('PIOCDJ3000', 'creator1-setup9', '3998299')).toBe(
      'https://www.zzounds.com/a--3998299/sid--creator1-setup9/item--PIOCDJ3000'
    );
  });

  test('omits sid segment when no subtag', () => {
    expect(buildZzoundsAffiliateUrl('PIOCDJ3000', '', '3998299')).toBe(
      'https://www.zzounds.com/a--3998299/item--PIOCDJ3000'
    );
  });
});

describe('detectRetailer', () => {
  test('detects supported retailer hostnames', () => {
    expect(detectRetailer('www.zzounds.com')?.id).toBe('cj');
    expect(detectRetailer('www.guitarcenter.com')?.id).toBe('cj');
    expect(detectRetailer('www.reverb.com')?.id).toBe('awin');
    expect(detectRetailer('www.thomann.de')?.id).toBe('thomann');
    expect(detectRetailer('www.amazon.com')?.id).toBe('amazon');
    expect(detectRetailer('teile.life')?.id).toBe('manufacturer');
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

describe('purchaseLinkNotice', () => {
  test('shows non-monetized notice for manufacturer links', () => {
    expect(purchaseLinkNotice({ cartMonetized: false, monetized: false, url: 'https://teile.life/x' }, null))
      .toBe('LiveSet may not earn commission from this link.');
  });

  test('shows zZounds affiliate notice when cart is gold', () => {
    expect(purchaseLinkNotice({ cartMonetized: true, monetized: true, url: 'https://www.zzounds.com/a--3998299/item--X', urlKind: 'product-link' }, { creatorId: 'c1' }))
      .toContain('zZounds affiliate link');
  });

  test('shows unverified zZounds notice when affiliate but not in stock', () => {
    expect(purchaseLinkNotice({ cartMonetized: false, monetized: true, url: 'https://www.zzounds.com/a--3998299/item--X', urlKind: 'product-link' }, null))
      .toContain('unavailable or stock not verified');
  });
});

describe('buildBuyLink', () => {
  const OLD_ENV = process.env.REACT_APP_AMAZON_ASSOC_TAG;
  beforeEach(() => { process.env.REACT_APP_AMAZON_ASSOC_TAG = 'liveset-20'; });
  afterEach(() => { process.env.REACT_APP_AMAZON_ASSOC_TAG = OLD_ENV; });

  test('prefers purchaseUrl over affiliateUrl', () => {
    const link = buildBuyLink({
      name: 'Teile Revolo',
      purchaseUrl: 'https://teile.life/products/revolo',
      affiliateUrl: 'https://www.zzounds.com/item--OLD',
    }, null);
    expect(link.url).toBe('https://teile.life/products/revolo');
    expect(link.commerceStatus).toBe('non_monetized');
    expect(link.monetized).toBe(false);
  });

  test('builds Amazon search fallback when product has no purchase URL', () => {
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
    expect(link.monetized).toBe(true);
  });

  test('rebuilds zZounds URLs with a-- and sid-- path segments', () => {
    const link = buildBuyLink(
      { name: 'CDJ-3000', affiliateUrl: 'https://www.zzounds.com/item--PIONEERCDJ3000' },
      { creatorId: 'creator1', setupId: 'setup9' }
    );
    expect(link.url).toBe('https://www.zzounds.com/a--3998299/sid--creator1-setup9/item--PIONEERCDJ3000');
    expect(link.retailer).toBe('cj');
    expect(link.retailerLabel).toBe('zZounds');
    expect(link.isAmazon).toBe(false);
    expect(link.monetized).toBe(true);
    expect(link.cartMonetized).toBe(false);
  });

  test('gold cart only for verified in-stock zZounds links', () => {
    const inStock = buildBuyLink(
      {
        name: 'CDJ-3000X',
        affiliateUrl: 'https://www.zzounds.com/item--CDJ3000X',
        commerceAvailability: 'in_stock',
        commerceStatus: 'monetized',
      },
      { creatorId: 'c1' }
    );
    expect(inStock.cartMonetized).toBe(true);

    const discontinued = buildBuyLink(
      {
        name: 'CDJ-3000',
        affiliateUrl: 'https://www.zzounds.com/item--PIOCDJ3000',
        commerceAvailability: 'discontinued',
      },
      null
    );
    expect(discontinued.monetized).toBe(true);
    expect(discontinued.cartMonetized).toBe(false);

    const amazon = buildBuyLink(
      { name: 'CDJ-3000', affiliateUrl: 'https://www.amazon.com/dp/B08F2ND1' },
      null
    );
    expect(amazon.monetized).toBe(true);
    expect(amazon.cartMonetized).toBe(false);
  });

  test('resolveCartMonetized helper', () => {
    const link = { url: 'https://www.zzounds.com/a--3998299/item--X', monetized: true };
    expect(resolveCartMonetized({ commerceAvailability: 'in_stock' }, link)).toBe(true);
    expect(resolveCartMonetized({ commerceAvailability: 'discontinued' }, link)).toBe(false);
    expect(resolveCartMonetized({}, link)).toBe(false);
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

  test('omits sid when there is no attribution on zZounds', () => {
    const link = buildBuyLink(
      { name: 'CDJ-3000', affiliateUrl: 'https://www.zzounds.com/item--PIONEERCDJ3000' },
      null
    );
    expect(link.url).toBe('https://www.zzounds.com/a--3998299/item--PIONEERCDJ3000');
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
