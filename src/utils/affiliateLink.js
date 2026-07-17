// Builds outbound purchase links with per-retailer affiliate tags and creator
// SubIDs so commission reports can be reconciled to creators for the 50/50 split.

const ZZOUNDS_AFFILIATE_ID = process.env.REACT_APP_ZZOUNDS_AFFILIATE_ID || '3998299';

const MONETIZED_RETAILERS = new Set(['amazon', 'cj', 'awin', 'thomann', 'impact']);

function getAssocTag() {
  return process.env.REACT_APP_AMAZON_ASSOC_TAG || '';
}

export function buildSubtag(attribution, maxLen = 90) {
  if (!attribution || !attribution.creatorId) return '';
  const raw = [attribution.creatorId, attribution.setupId].filter(Boolean).join('-');
  return raw.replace(/[^A-Za-z0-9-]/g, '').slice(0, maxLen);
}

const RETAILERS = [
  {
    id: 'amazon',
    label: 'Amazon',
    matchHost: (hostname) => /(^|\.)amazon\.[a-z.]{2,}$/i.test(hostname),
    subIdParam: 'ascsubtag',
    subIdMaxLen: 90,
    decorate(url, subtag) {
      const tag = getAssocTag();
      if (!tag) console.warn('REACT_APP_AMAZON_ASSOC_TAG is not set — affiliate links are untagged');
      if (tag) url.searchParams.set('tag', tag);
      if (subtag) url.searchParams.set(this.subIdParam, subtag);
    },
  },
  {
    id: 'cj',
    matchHost: (hostname) => /(^|\.)(zzounds|guitarcenter|musiciansfriend)\.com$/i.test(hostname),
    labelForHost(hostname) {
      if (/zzounds/i.test(hostname)) return 'zZounds';
      if (/guitarcenter/i.test(hostname)) return 'Guitar Center';
      if (/musiciansfriend/i.test(hostname)) return "Musician's Friend";
      return 'Retailer';
    },
    subIdParam: 'sid',
    subIdMaxLen: 64,
    decorate(url, subtag) {
      if (/zzounds/i.test(url.hostname)) return;
      if (subtag) url.searchParams.set(this.subIdParam, subtag);
    },
  },
  {
    id: 'awin',
    label: 'Reverb',
    matchHost: (hostname) => /(^|\.)reverb\.com$/i.test(hostname),
    subIdParam: 'clickref',
    subIdMaxLen: 50,
    decorate(url, subtag) {
      if (subtag) url.searchParams.set(this.subIdParam, subtag);
    },
  },
  {
    id: 'thomann',
    label: 'Thomann',
    matchHost: (hostname) => /(^|\.)thomann(?:music)?\.[a-z.]{2,}$/i.test(hostname),
    subIdParam: 'subid',
    subIdMaxLen: 50,
    decorate(url, subtag) {
      if (subtag) url.searchParams.set(this.subIdParam, subtag);
    },
  },
  {
    id: 'impact',
    label: 'Sweetwater',
    matchHost: (hostname) => /(^|\.)sweetwater\.com$/i.test(hostname),
    subIdParam: 'subId',
    subIdMaxLen: 50,
    decorate(url, subtag) {
      if (subtag) url.searchParams.set(this.subIdParam, subtag);
    },
  },
  {
    id: 'manufacturer',
    label: 'Manufacturer',
    matchHost: (hostname) => /(^|\.)teile\.life$/i.test(hostname)
      || /(^|\.)telepathicinstruments\.com$/i.test(hostname)
      || /(^|\.)apple\.com$/i.test(hostname),
    subIdParam: null,
    subIdMaxLen: 0,
    decorate() {},
  },
];

export function detectRetailer(hostname) {
  return RETAILERS.find((r) => r.matchHost(hostname)) || null;
}

export function parseZzoundsItemId(urlString) {
  try {
    const url = new URL(urlString);
    const match = url.pathname.match(/\/item--([^/?#]+)/i);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

export function buildZzoundsAffiliateUrl(itemId, subtag, affiliateId = ZZOUNDS_AFFILIATE_ID) {
  if (!itemId) return null;
  const cleanSubtag = (subtag || '').replace(/[^A-Za-z0-9-]/g, '');
  const sidSegment = cleanSubtag ? `/sid--${cleanSubtag}` : '';
  return `https://www.zzounds.com/a--${affiliateId}${sidSegment}/item--${itemId}`;
}

function retailerLabel(retailer, hostname) {
  if (!retailer) return null;
  if (retailer.labelForHost) return retailer.labelForHost(hostname);
  return retailer.label || null;
}

function isMonetizedRetailer(retailerId) {
  return MONETIZED_RETAILERS.has(retailerId);
}

export function getEffectivePurchaseUrl(product) {
  if (!product) return null;
  return product.purchaseUrl || product.affiliateUrl || null;
}

function resolveCommerceStatus(product, retailerId, fallbackMonetized) {
  if (product?.commerceStatus) return product.commerceStatus;
  if (fallbackMonetized) return 'monetized';
  if (retailerId && isMonetizedRetailer(retailerId)) return 'monetized';
  if (retailerId) return 'non_monetized';
  return 'unknown';
}

function isZzoundsUrl(urlString) {
  try {
    return /(^|\.)zzounds\.com$/i.test(new URL(urlString).hostname);
  } catch {
    return false;
  }
}

/** Verified in stock via catalog audit fields. */
function isVerifiedInStock(product) {
  if (!product) return false;
  if (product.commerceAvailability === 'discontinued' || product.commerceAvailability === 'out_of_stock') {
    return false;
  }
  if (product.commerceAvailability === 'in_stock') return true;
  if (product.commerceStatus === 'monetized') return true;
  return false;
}

/** Gold cart: in-stock zZounds affiliate link only. */
export function resolveCartMonetized(product, link) {
  if (!link?.url || !isZzoundsUrl(link.url) || !link.monetized) return false;
  return isVerifiedInStock(product);
}

function buildLinkResult(url, product, { urlKind, retailer, hostname, monetized, commerceStatus }) {
  const isAmazon = retailer?.id === 'amazon';
  const result = {
    url: typeof url === 'string' ? url : url.toString(),
    urlKind,
    isAmazon,
    retailer: retailer?.id || (isAmazon ? 'amazon' : 'other'),
    retailerLabel: retailerLabel(retailer, hostname),
    monetized: !!monetized,
    commerceStatus: commerceStatus || (monetized ? 'monetized' : 'non_monetized'),
  };
  result.cartMonetized = resolveCartMonetized(product, result);
  return result;
}

function decorateAffiliateUrl(url, attribution, product) {
  const retailer = detectRetailer(url.hostname);
  const subtag = retailer ? buildSubtag(attribution, retailer.subIdMaxLen) : '';

  if (/zzounds/i.test(url.hostname)) {
    const itemId = parseZzoundsItemId(url.toString());
    if (itemId) {
      const rebuilt = buildZzoundsAffiliateUrl(itemId, subtag);
      return buildLinkResult(rebuilt, product, {
        urlKind: 'product-link',
        retailer,
        hostname: url.hostname,
        monetized: true,
        commerceStatus: resolveCommerceStatus(product, retailer?.id, true),
      });
    }
  }

  if (retailer) retailer.decorate(url, subtag);
  const monetized = retailer ? isMonetizedRetailer(retailer.id) : false;
  return buildLinkResult(url, product, {
    urlKind: 'product-link',
    retailer,
    hostname: url.hostname,
    monetized,
    commerceStatus: resolveCommerceStatus(product, retailer?.id, monetized),
  });
}

export function buildBuyLink(product, attribution) {
  if (!product) return null;

  const rawUrl = getEffectivePurchaseUrl(product);
  if (rawUrl) {
    try {
      const url = new URL(rawUrl);
      return decorateAffiliateUrl(url, attribution, product);
    } catch (e) {
      return buildLinkResult(rawUrl, product, {
        urlKind: 'product-link',
        retailer: null,
        hostname: '',
        monetized: product.commerceStatus === 'monetized',
        commerceStatus: product.commerceStatus || 'unknown',
      });
    }
  }

  const query = [product.brand, product.name].filter(Boolean).join(' ').trim();
  if (!query) return null;

  const url = new URL('https://www.amazon.com/s');
  url.searchParams.set('k', query);
  const amazon = RETAILERS.find((r) => r.id === 'amazon');
  const subtag = buildSubtag(attribution, amazon.subIdMaxLen);
  amazon.decorate(url, subtag);
  return buildLinkResult(url, product, {
    urlKind: 'search-fallback',
    retailer: amazon,
    hostname: url.hostname,
    monetized: !!getAssocTag(),
    commerceStatus: 'unknown',
  });
}

export function buyButtonLabel(link) {
  if (!link) return 'Buy ↗';
  if (link.retailerLabel) return `Buy on ${link.retailerLabel} ↗`;
  if (link.isAmazon) return 'Buy on Amazon ↗';
  return 'Buy ↗';
}

export function purchaseLinkNotice(link, attribution) {
  if (!link) return null;
  if (link.cartMonetized) {
    return `zZounds affiliate link — purchases support LiveSet${attribution?.creatorId ? ' and this creator' : ''}.`;
  }
  if (link.urlKind === 'search-fallback') {
    return 'Search link — verify the exact product before buying.';
  }
  if (isZzoundsUrl(link.url) && link.monetized) {
    return 'zZounds link — product unavailable or stock not verified yet.';
  }
  return 'LiveSet may not earn commission from this link.';
}
