const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');

admin.initializeApp();

setGlobalOptions({ region: 'us-central1', maxInstances: 10 });

const BUNNY_API_KEY = defineSecret('BUNNY_API_KEY');
const BUNNY_LIBRARY_ID = defineSecret('BUNNY_LIBRARY_ID');
const BUNNY_CDN_HOSTNAME = defineSecret('BUNNY_CDN_HOSTNAME');
const BUNNY_WEBHOOK_SECRET = defineSecret('BUNNY_WEBHOOK_SECRET');

const ALLOWED_KINDS = new Set(['set', 'clip']);

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
