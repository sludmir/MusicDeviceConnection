// Builds outbound purchase links. Amazon links carry the Associates tag plus
// an ascsubtag with creator attribution so sales can be matched to creators
// in the Amazon earnings report.

function getAssocTag() {
  return process.env.REACT_APP_AMAZON_ASSOC_TAG || '';
}

export function buildSubtag(attribution) {
  if (!attribution || !attribution.creatorId) return '';
  const raw = [attribution.creatorId, attribution.setupId].filter(Boolean).join('-');
  return raw.replace(/[^A-Za-z0-9-]/g, '').slice(0, 90);
}

function isAmazonHost(hostname) {
  return /(^|\.)amazon\.[a-z.]{2,}$/i.test(hostname);
}

export function buildBuyLink(product, attribution) {
  if (!product) return null;
  const subtag = buildSubtag(attribution);
  const tag = getAssocTag();
  if (!tag) console.warn('REACT_APP_AMAZON_ASSOC_TAG is not set — affiliate links are untagged');

  if (product.affiliateUrl) {
    let url;
    try {
      url = new URL(product.affiliateUrl);
    } catch (e) {
      return { url: product.affiliateUrl, urlKind: 'product-link', isAmazon: false };
    }
    if (!isAmazonHost(url.hostname)) {
      return { url: product.affiliateUrl, urlKind: 'product-link', isAmazon: false };
    }
    if (tag) url.searchParams.set('tag', tag);
    if (subtag) url.searchParams.set('ascsubtag', subtag);
    return { url: url.toString(), urlKind: 'product-link', isAmazon: true };
  }

  const query = [product.brand, product.name].filter(Boolean).join(' ').trim();
  if (!query) return null;
  const url = new URL('https://www.amazon.com/s');
  url.searchParams.set('k', query);
  if (tag) url.searchParams.set('tag', tag);
  if (subtag) url.searchParams.set('ascsubtag', subtag);
  return { url: url.toString(), urlKind: 'search-fallback', isAmazon: true };
}
