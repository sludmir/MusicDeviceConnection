const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');
const crypto = require('crypto');

admin.initializeApp();

setGlobalOptions({ region: 'us-central1', maxInstances: 10 });

const BUNNY_API_KEY = defineSecret('BUNNY_API_KEY');
const BUNNY_LIBRARY_ID = defineSecret('BUNNY_LIBRARY_ID');
const BUNNY_CDN_HOSTNAME = defineSecret('BUNNY_CDN_HOSTNAME');
const BUNNY_WEBHOOK_SECRET = defineSecret('BUNNY_WEBHOOK_SECRET');
// Bunny CDN "URL Token Authentication Key" (Stream library → Security).
// Set with: firebase functions:secrets:set BUNNY_TOKEN_KEY
const BUNNY_TOKEN_KEY = defineSecret('BUNNY_TOKEN_KEY');

const ALLOWED_KINDS = new Set(['set', 'clip']);

/**
 * Sign a Bunny CDN URL with a path-scoped token (what "CDN token
 * authentication" expects in the Stream library Security tab).
 *
 *   hashable  = security_key + token_path + expires
 *   token     = base64url( sha256_raw( hashable ) )
 *   final URL = original?token=<token>&expires=<unix>&token_path=<urlencoded path>
 *
 * token_path is the directory containing the file (e.g. "/<guid>/") so a
 * single token authorizes the manifest and all HLS segment requests under it.
 */
function signBunnyUrl(rawUrl, securityKey, expiresInSeconds = 4 * 3600) {
  const u = new URL(rawUrl);
  const tokenPath = u.pathname.replace(/[^/]+$/, '') || '/'; // "/<guid>/"
  const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;

  const hashBytes = crypto
    .createHash('sha256')
    .update(securityKey + tokenPath + expires)
    .digest();
  const token = hashBytes
    .toString('base64')
    .replace(/=+$/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const sep = u.search ? '&' : '?';
  return `${rawUrl}${sep}token=${token}&expires=${expires}&token_path=${encodeURIComponent(tokenPath)}`;
}

function isBunnyUrl(url, cdnHost) {
  if (!url || typeof url !== 'string') return false;
  try {
    const u = new URL(url);
    return u.hostname === cdnHost;
  } catch {
    return false;
  }
}

/**
 * Creates a Bunny Stream video record and returns a short-lived TUS-signed
 * upload URL. The Bunny API key never reaches the browser.
 *
 * Client flow:
 *   1. Call createBunnyVideo({ title, kind })  — kind is 'set' or 'clip'
 *   2. Use returned { uploadUrl, uploadHeaders } to PUT the video file
 *   3. Save returned { videoGuid, hlsUrl, thumbnailUrl } on the Firestore doc
 */
exports.createBunnyVideo = onCall(
  { secrets: [BUNNY_API_KEY, BUNNY_LIBRARY_ID, BUNNY_CDN_HOSTNAME] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be signed in.');
    }
    const { title, kind } = request.data || {};
    if (!ALLOWED_KINDS.has(kind)) {
      throw new HttpsError('invalid-argument', 'kind must be "set" or "clip".');
    }
    const safeTitle = (typeof title === 'string' && title.trim()) || 'Untitled';

    const libraryId = BUNNY_LIBRARY_ID.value();
    const apiKey = BUNNY_API_KEY.value();
    const cdnHost = BUNNY_CDN_HOSTNAME.value();

    const createRes = await fetch(
      `https://video.bunnycdn.com/library/${libraryId}/videos`,
      {
        method: 'POST',
        headers: {
          'AccessKey': apiKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ title: safeTitle.slice(0, 200) }),
      }
    );
    if (!createRes.ok) {
      const text = await createRes.text();
      console.error('Bunny create video failed', createRes.status, text);
      throw new HttpsError('internal', `Bunny create video failed: ${createRes.status}`);
    }
    const created = await createRes.json();
    const videoGuid = created.guid;

    return {
      videoGuid,
      libraryId,
      uploadUrl: `https://video.bunnycdn.com/library/${libraryId}/videos/${videoGuid}`,
      uploadHeaders: { AccessKey: apiKey },
      hlsUrl: `https://${cdnHost}/${videoGuid}/playlist.m3u8`,
      thumbnailUrl: `https://${cdnHost}/${videoGuid}/thumbnail.jpg`,
      previewUrl: `https://${cdnHost}/${videoGuid}/preview.webp`,
      iframeUrl: `https://iframe.mediadelivery.net/embed/${libraryId}/${videoGuid}`,
      uploaderUid: request.auth.uid,
    };
  }
);

/**
 * getSignedBunnyUrl
 *
 * Returns short-lived signed Bunny URLs for a given set or clip. Required
 * once the Bunny Stream library has Token Authentication enabled — bare
 * playlist URLs return 403 in that mode.
 *
 * Input:  { kind: 'set' | 'clip', id: string }
 * Output: { videoURL, audioTrackURL?, thumbnailURL?, expiresAt }
 *         Non-Bunny URLs (e.g. legacy Firebase Storage) are returned as-is.
 */
exports.getSignedBunnyUrl = onCall(
  { secrets: [BUNNY_TOKEN_KEY, BUNNY_CDN_HOSTNAME] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be signed in.');
    }
    const { kind, id } = request.data || {};
    if (!ALLOWED_KINDS.has(kind)) {
      throw new HttpsError('invalid-argument', 'kind must be "set" or "clip".');
    }
    if (!id || typeof id !== 'string') {
      throw new HttpsError('invalid-argument', 'id is required.');
    }

    const collection = kind === 'set' ? 'sets' : 'clips';
    const snap = await admin.firestore().collection(collection).doc(id).get();
    if (!snap.exists) {
      throw new HttpsError('not-found', `${kind} not found.`);
    }
    const data = snap.data();

    const securityKey = BUNNY_TOKEN_KEY.value();
    const cdnHost = BUNNY_CDN_HOSTNAME.value();
    const expiresInSeconds = 4 * 3600;

    const signIfBunny = (url) =>
      isBunnyUrl(url, cdnHost) ? signBunnyUrl(url, securityKey, expiresInSeconds) : url || null;

    return {
      videoURL: signIfBunny(data.videoURL),
      fullVideoURL: signIfBunny(data.fullVideoURL),
      audioTrackURL: signIfBunny(data.audioTrackURL),
      thumbnailURL: signIfBunny(data.thumbnailURL),
      expiresAt: Math.floor(Date.now() / 1000) + expiresInSeconds,
    };
  }
);

/**
 * Bunny webhook: fires when a video finishes encoding (or fails).
 * We look up any Firestore docs (sets, clips) holding this videoGuid and
 * flip their status field so the UI can hide processing videos.
 *
 * Configure in Bunny dashboard → Library → API → Webhook URL:
 *   https://us-central1-<project>.cloudfunctions.net/bunnyWebhook?secret=<BUNNY_WEBHOOK_SECRET>
 */
exports.bunnyWebhook = onRequest(
  { secrets: [BUNNY_WEBHOOK_SECRET], cors: false },
  async (req, res) => {
    if (req.method !== 'POST') {
      return res.status(405).send('Method not allowed');
    }
    if (req.query.secret !== BUNNY_WEBHOOK_SECRET.value()) {
      return res.status(403).send('Forbidden');
    }

    // Bunny webhook payload:
    // { VideoLibraryId, VideoGuid, Status }
    // Status: 0 Queued, 1 Processing, 2 Encoding, 3 Finished, 4 Resolution finished,
    //         5 Failed, 6 Presigned upload, 7 Transcoding queued
    const { VideoGuid, Status } = req.body || {};
    if (!VideoGuid) return res.status(400).send('Missing VideoGuid');

    let nextStatus = null;
    if (Status === 3 || Status === 4) nextStatus = 'ready';
    else if (Status === 5) nextStatus = 'failed';
    if (!nextStatus) return res.status(200).send('ignored');

    const db = admin.firestore();
    const collections = ['sets', 'clips'];
    let updated = 0;
    for (const coll of collections) {
      const snap = await db.collection(coll).where('bunnyVideoGuid', '==', VideoGuid).get();
      const batch = db.batch();
      snap.forEach((doc) => {
        batch.update(doc.ref, {
          status: nextStatus,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        updated += 1;
      });
      if (!snap.empty) await batch.commit();
    }

    return res.status(200).send(`ok (updated ${updated})`);
  }
);
