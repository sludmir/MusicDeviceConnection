/**
 * HMAC-signed factory decision tokens (approve / reject).
 * Canonical copy for Cloud Functions deploy; scripts re-export this module.
 */

const crypto = require('crypto');

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function base64url(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/=+$/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function fromBase64url(str) {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + pad;
  return Buffer.from(b64, 'base64');
}

function mintFactoryToken(payload, secret, ttlMs = DEFAULT_TTL_MS) {
  if (!secret) throw new Error('FACTORY_HMAC_SECRET is required');
  const body = {
    runId: payload.runId,
    productId: payload.productId || '*',
    decision: payload.decision,
    exp: Date.now() + ttlMs,
  };
  const bodyB64 = base64url(JSON.stringify(body));
  const sig = base64url(
    crypto.createHmac('sha256', secret).update(bodyB64).digest()
  );
  return `${bodyB64}.${sig}`;
}

function verifyFactoryToken(token, secret) {
  if (!secret) return { valid: false, error: 'missing_secret' };
  if (!token || typeof token !== 'string' || !token.includes('.')) {
    return { valid: false, error: 'malformed' };
  }
  const [bodyB64, sig] = token.split('.');
  const expected = base64url(
    crypto.createHmac('sha256', secret).update(bodyB64).digest()
  );
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { valid: false, error: 'bad_signature' };
  }
  let payload;
  try {
    payload = JSON.parse(fromBase64url(bodyB64).toString('utf8'));
  } catch {
    return { valid: false, error: 'bad_payload' };
  }
  if (!payload.exp || Date.now() > payload.exp) {
    return { valid: false, error: 'expired' };
  }
  if (!['approve', 'reject', 'approve_all'].includes(payload.decision)) {
    return { valid: false, error: 'bad_decision' };
  }
  return { valid: true, payload };
}

function buildDecisionUrl(baseUrl, token) {
  const base = String(baseUrl || '').replace(/\/$/, '');
  return `${base}?token=${encodeURIComponent(token)}`;
}

module.exports = {
  DEFAULT_TTL_MS,
  mintFactoryToken,
  verifyFactoryToken,
  buildDecisionUrl,
};
