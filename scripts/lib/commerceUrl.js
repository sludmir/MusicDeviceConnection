const { ZZOUNDS_AFFILIATE_ID, MONETIZED_RETAILERS, ALLOWED_PURCHASE_HOSTS } = require('./commerceConstants');

const RETAILERS = [
  {
    id: 'amazon',
    label: 'Amazon',
    matchHost: (hostname) => /(^|\.)amazon\.[a-z.]{2,}$/i.test(hostname),
    subIdParam: 'ascsubtag',
    subIdMaxLen: 90,
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
  },
  {
    id: 'awin',
    label: 'Reverb',
    matchHost: (hostname) => /(^|\.)reverb\.com$/i.test(hostname),
    subIdParam: 'clickref',
    subIdMaxLen: 50,
  },
  {
    id: 'thomann',
    label: 'Thomann',
    matchHost: (hostname) => /(^|\.)thomann\.[a-z.]{2,}$/i.test(hostname),
    subIdParam: 'subid',
    subIdMaxLen: 50,
  },
  {
    id: 'impact',
    label: 'Sweetwater',
    matchHost: (hostname) => /(^|\.)sweetwater\.com$/i.test(hostname),
    subIdParam: 'subId',
    subIdMaxLen: 50,
  },
  {
    id: 'manufacturer',
    label: 'Manufacturer',
    matchHost: (hostname) => /(^|\.)teile\.life$/i.test(hostname) || /(^|\.)telepathicinstruments\.com$/i.test(hostname),
    subIdParam: null,
    subIdMaxLen: 0,
  },
];

function buildSubtag(attribution, maxLen = 90) {
  if (!attribution || !attribution.creatorId) return '';
  const raw = [attribution.creatorId, attribution.setupId].filter(Boolean).join('-');
  return raw.replace(/[^A-Za-z0-9-]/g, '').slice(0, maxLen);
}

function detectRetailer(hostname) {
  return RETAILERS.find((r) => r.matchHost(hostname)) || null;
}

function isAllowedPurchaseHost(hostname) {
  return ALLOWED_PURCHASE_HOSTS.some((re) => re.test(hostname));
}

function parseZzoundsItemId(urlString) {
  try {
    const url = new URL(urlString);
    const match = url.pathname.match(/\/item--([^/?#]+)/i);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

function buildZzoundsAffiliateUrl(itemId, subtag, affiliateId = ZZOUNDS_AFFILIATE_ID) {
  if (!itemId) return null;
  const cleanSubtag = (subtag || '').replace(/[^A-Za-z0-9-]/g, '');
  const sidSegment = cleanSubtag ? `/sid--${cleanSubtag}` : '';
  return `https://www.zzounds.com/a--${affiliateId}${sidSegment}/item--${itemId}`;
}

function isMonetizedRetailer(retailerId) {
  return MONETIZED_RETAILERS.has(retailerId);
}

function inferCommerceStatus(product, retailerId) {
  if (product?.commerceStatus) return product.commerceStatus;
  if (!retailerId) return 'unknown';
  return isMonetizedRetailer(retailerId) ? 'monetized' : 'non_monetized';
}

function getEffectivePurchaseUrl(product) {
  if (!product) return null;
  return product.purchaseUrl || product.affiliateUrl || null;
}

function decorateAffiliateUrl(urlString, attribution, { amazonTag } = {}) {
  const url = new URL(urlString);
  const retailer = detectRetailer(url.hostname);
  const subtag = retailer ? buildSubtag(attribution, retailer.subIdMaxLen) : '';

  if (/zzounds/i.test(url.hostname)) {
    const itemId = parseZzoundsItemId(urlString);
    if (itemId) {
      const rebuilt = buildZzoundsAffiliateUrl(itemId, subtag);
      return {
        url: rebuilt,
        retailer,
        monetized: true,
        commerceStatus: 'monetized',
      };
    }
  }

  if (retailer?.id === 'amazon' && amazonTag) {
    url.searchParams.set('tag', amazonTag);
  }
  if (retailer && subtag && retailer.subIdParam) {
    url.searchParams.set(retailer.subIdParam, subtag);
  }

  const monetized = retailer ? isMonetizedRetailer(retailer.id) : false;
  return {
    url: url.toString(),
    retailer,
    monetized,
    commerceStatus: monetized ? 'monetized' : 'non_monetized',
  };
}

function retailerLabel(retailer, hostname) {
  if (!retailer) return null;
  if (retailer.labelForHost) return retailer.labelForHost(hostname);
  return retailer.label || null;
}

module.exports = {
  RETAILERS,
  buildSubtag,
  detectRetailer,
  isAllowedPurchaseHost,
  parseZzoundsItemId,
  buildZzoundsAffiliateUrl,
  isMonetizedRetailer,
  inferCommerceStatus,
  getEffectivePurchaseUrl,
  decorateAffiliateUrl,
  retailerLabel,
};
