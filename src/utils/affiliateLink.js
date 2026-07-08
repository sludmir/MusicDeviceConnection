// Builds outbound purchase links with per-retailer affiliate tags and creator
// SubIDs so commission reports can be reconciled to creators for the 50/50 split.

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
    matchHost: (hostname) => /(^|\.)thomann\.[a-z.]{2,}$/i.test(hostname),
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
];

export function detectRetailer(hostname) {
  return RETAILERS.find((r) => r.matchHost(hostname)) || null;
}

function retailerLabel(retailer, hostname) {
  if (!retailer) return null;
  if (retailer.labelForHost) return retailer.labelForHost(hostname);
  return retailer.label || null;
}

function buildLinkResult(url, { urlKind, retailer, hostname }) {
  const isAmazon = retailer?.id === 'amazon';
  return {
    url: url.toString(),
    urlKind,
    isAmazon,
    retailer: retailer?.id || (isAmazon ? 'amazon' : 'other'),
    retailerLabel: retailerLabel(retailer, hostname),
  };
}

function decorateAffiliateUrl(url, attribution) {
  const retailer = detectRetailer(url.hostname);
  const subtag = retailer ? buildSubtag(attribution, retailer.subIdMaxLen) : '';
  if (retailer) retailer.decorate(url, subtag);
  return buildLinkResult(url, { urlKind: 'product-link', retailer, hostname: url.hostname });
}

export function buildBuyLink(product, attribution) {
  if (!product) return null;

  if (product.affiliateUrl) {
    let url;
    try {
      url = new URL(product.affiliateUrl);
    } catch (e) {
      return {
        url: product.affiliateUrl,
        urlKind: 'product-link',
        isAmazon: false,
        retailer: 'other',
        retailerLabel: null,
      };
    }
    return decorateAffiliateUrl(url, attribution);
  }

  const query = [product.brand, product.name].filter(Boolean).join(' ').trim();
  if (!query) return null;

  const url = new URL('https://www.amazon.com/s');
  url.searchParams.set('k', query);
  const amazon = RETAILERS.find((r) => r.id === 'amazon');
  const subtag = buildSubtag(attribution, amazon.subIdMaxLen);
  amazon.decorate(url, subtag);
  return buildLinkResult(url, {
    urlKind: 'search-fallback',
    retailer: amazon,
    hostname: url.hostname,
  });
}

export function buyButtonLabel(link) {
  if (!link) return 'Buy ↗';
  if (link.retailerLabel) return `Buy on ${link.retailerLabel} ↗`;
  if (link.isAmazon) return 'Buy on Amazon ↗';
  return 'Buy ↗';
}
