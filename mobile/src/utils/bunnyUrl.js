import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

// Tiny in-memory cache so revisiting a set/clip within its expiry window
// doesn't re-call the function. Keyed by `${kind}:${id}`.
const cache = new Map();

/**
 * Get short-lived signed Bunny CDN URLs for a set or clip. The cloud
 * function returns the same URLs unchanged for non-Bunny entries (e.g.
 * legacy Firebase Storage uploads).
 *
 * @param {'set'|'clip'} kind
 * @param {string} id
 * @returns {Promise<{ videoURL, fullVideoURL?, audioTrackURL?, thumbnailURL?, expiresAt }>}
 */
export async function getSignedBunnyUrls(kind, id) {
  const key = `${kind}:${id}`;
  const now = Math.floor(Date.now() / 1000);
  const cached = cache.get(key);
  // Use cache only if it has at least 5 minutes left.
  if (cached && cached.expiresAt - now > 300) return cached;

  const callable = httpsCallable(functions, 'getSignedBunnyUrl');
  const res = await callable({ kind, id });
  cache.set(key, res.data);
  return res.data;
}
