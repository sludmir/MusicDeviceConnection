import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebaseConfig';

// In-memory cache so a clip/set re-rendered within its expiry window
// doesn't re-call the function. Keyed by `${kind}:${id}`.
const cache = new Map();
const inflight = new Map();

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
  if (cached && cached.expiresAt - now > 300) return cached;
  if (inflight.has(key)) return inflight.get(key);

  const callable = httpsCallable(functions, 'getSignedBunnyUrl');
  const promise = callable({ kind, id })
    .then((res) => {
      cache.set(key, res.data);
      inflight.delete(key);
      return res.data;
    })
    .catch((err) => {
      inflight.delete(key);
      throw err;
    });
  inflight.set(key, promise);
  return promise;
}
