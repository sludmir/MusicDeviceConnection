const {
  detectRetailer,
  getEffectivePurchaseUrl,
  isMonetizedRetailer,
  parseZzoundsItemId,
} = require('./commerceUrl');

const USER_AGENT = 'LiveSet-CatalogAudit/1.0 (+https://liveset.io)';

const OUT_OF_STOCK_PATTERNS = [
  /\bout of stock\b/i,
  /\bcurrently unavailable\b/i,
  /\bsold out\b/i,
  /\btemporarily unavailable\b/i,
  /\bnot available to ship\b/i,
];

const DISCONTINUED_PATTERNS = [
  /\bthis item (?:is )?discontinued\b/i,
  /\bthis product (?:has been )?discontinued\b/i,
  /\bno longer available(?: for purchase)?\b/i,
  /\bproduct page not found\b/i,
  /\bwe couldn['']t find (?:that|this) product\b/i,
];

async function fetchPage(urlString, { timeoutMs = 15000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(urlString, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    const body = res.ok ? await res.text() : '';
    return { status: res.status, finalUrl: res.url, body };
  } catch (err) {
    return { status: 0, finalUrl: urlString, body: '', error: err.message };
  } finally {
    clearTimeout(timer);
  }
}

function classifyAvailability(status, body) {
  if (status === 404 || status === 410) return 'discontinued';
  if (status < 200 || status >= 400) return 'unknown';
  const snippet = (body || '').slice(0, 120000);
  if (DISCONTINUED_PATTERNS.some((re) => re.test(snippet))) return 'discontinued';
  if (OUT_OF_STOCK_PATTERNS.some((re) => re.test(snippet))) return 'out_of_stock';
  return 'in_stock';
}

function classifyRetailer(urlString) {
  try {
    const host = new URL(urlString).hostname;
    const retailer = detectRetailer(host);
    return retailer?.id || 'other';
  } catch {
    return 'other';
  }
}

function buildAuditResult(product, fetchResult) {
  const checkedUrl = getEffectivePurchaseUrl(product);
  const { status, finalUrl, body, error } = fetchResult;
  const availability = classifyAvailability(status, body);
  const retailerId = classifyRetailer(finalUrl || checkedUrl || '');
  const monetized = isMonetizedRetailer(retailerId);
  const reachable = status >= 200 && status < 400 && availability !== 'discontinued';

  let commerceStatus = 'unknown';
  if (reachable && monetized) commerceStatus = 'monetized';
  else if (reachable) commerceStatus = 'non_monetized';

  const reasons = [];
  if (error) reasons.push(`fetch_error: ${error}`);
  if (status) reasons.push(`http_${status}`);
  if (availability !== 'in_stock') reasons.push(availability);
  if (/zzounds/i.test(finalUrl || checkedUrl || '') && !parseZzoundsItemId(finalUrl || checkedUrl || '')) {
    reasons.push('zzounds_missing_item_id');
  }

  return {
    productId: product.id,
    productName: product.name || product.id,
    checkedUrl,
    finalUrl: finalUrl || checkedUrl,
    httpStatus: status,
    commerceAvailability: availability,
    commerceRetailer: retailerId,
    commerceStatus,
    reachable,
    monetized: commerceStatus === 'monetized',
    commerceValidationReason: reasons.join('; ') || 'ok',
    needsUpdate: !checkedUrl || !reachable || availability !== 'in_stock' || product.commerceStatus !== commerceStatus,
  };
}

async function auditProduct(product) {
  const checkedUrl = getEffectivePurchaseUrl(product);
  if (!checkedUrl) {
    return {
      productId: product.id,
      productName: product.name || product.id,
      checkedUrl: null,
      finalUrl: null,
      httpStatus: 0,
      commerceAvailability: 'unknown',
      commerceRetailer: 'other',
      commerceStatus: 'unknown',
      reachable: false,
      monetized: false,
      commerceValidationReason: 'missing_purchase_url',
      needsUpdate: true,
    };
  }
  const fetchResult = await fetchPage(checkedUrl);
  return buildAuditResult(product, fetchResult);
}

function auditResultToProposalChange(audit, { validatedAt }) {
  if (!audit.checkedUrl && !audit.reachable) {
    return {
      productId: audit.productId,
      productName: audit.productName,
      updates: {
        commerceStatus: 'unknown',
        commerceAvailability: audit.commerceAvailability,
        commerceValidatedAt: validatedAt,
        commerceValidationReason: audit.commerceValidationReason,
      },
      evidence: {
        checkedUrl: audit.checkedUrl,
        httpStatus: audit.httpStatus,
        finalUrl: audit.finalUrl,
      },
      action: 'review_required',
    };
  }

  const updates = {
    purchaseUrl: audit.finalUrl || audit.checkedUrl,
    commerceStatus: audit.commerceStatus,
    commerceRetailer: audit.commerceRetailer,
    commerceAvailability: audit.commerceAvailability,
    commerceValidatedAt: validatedAt,
    commerceValidationReason: audit.commerceValidationReason,
  };

  if (audit.commerceRetailer === 'cj' && /zzounds/i.test(updates.purchaseUrl)) {
    updates.affiliateUrl = updates.purchaseUrl;
  }

  return {
    productId: audit.productId,
    productName: audit.productName,
    updates,
    evidence: {
      checkedUrl: audit.checkedUrl,
      httpStatus: audit.httpStatus,
      finalUrl: audit.finalUrl,
    },
    action: audit.reachable && audit.commerceAvailability === 'in_stock' ? 'update' : 'review_required',
  };
}

module.exports = {
  fetchPage,
  classifyAvailability,
  auditProduct,
  auditResultToProposalChange,
};
