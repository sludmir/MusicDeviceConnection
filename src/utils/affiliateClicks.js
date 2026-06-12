// Fire-and-forget ledger of Buy clicks. This collection plus the ascsubtag
// column in the Amazon earnings report is the source of truth for creator
// payouts (manual in this phase).
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';

export function buildClickPayload({ product, attribution, clickerUid, source, urlKind }) {
  return {
    productId: product?.id ?? null,
    productName: product?.name ?? '',
    creatorId: attribution?.creatorId ?? null,
    setupId: attribution?.setupId ?? null,
    clickerUid: clickerUid ?? null,
    source,
    urlKind,
  };
}

export function logAffiliateClick(db, payload) {
  if (!db) return Promise.resolve();
  return addDoc(collection(db, 'affiliateClicks'), { ...payload, createdAt: serverTimestamp() })
    .catch((err) => console.warn('Affiliate click log failed:', err));
}
