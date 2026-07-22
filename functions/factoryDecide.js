/**
 * HTTPS endpoint: approve / reject staged factory products via signed email links.
 *
 * GET/POST ?token=...
 * Secrets: FACTORY_HMAC_SECRET
 *
 * Expects staging under Storage:
 *   factory/runs/{runId}/{productId}/draft.json
 *   factory/runs/{runId}/{productId}/{filename}.glb
 *   factory/runs/{runId}/manifest.json
 */

const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const path = require('path');
const { verifyFactoryToken } = require('./lib/factoryTokens');

const FACTORY_HMAC_SECRET = defineSecret('FACTORY_HMAC_SECRET');
const BUCKET_PREFIX = 'factory/runs';
const DEFAULT_BUCKET = 'musicdeviceconnection.firebasestorage.app';

function storageBucket() {
  // Prefer explicit project bucket (new *.firebasestorage.app names).
  try {
    return admin.storage().bucket(DEFAULT_BUCKET);
  } catch {
    return admin.storage().bucket();
  }
}

function htmlPage(title, body) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${title}</title>
  <style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#0A0908;color:#f5f0e8;padding:32px;max-width:560px;margin:0 auto}a{color:#D9C2A0}.ok{color:#9dcea1}.bad{color:#e8a0a0}code{background:#1a1816;padding:2px 6px;border-radius:4px}</style>
  </head><body><h1>${title}</h1>${body}</body></html>`;
}

function friendlyStorageError(err, runId) {
  const msg = String(err && err.message ? err.message : err);
  if (/No such object|ENOENT|not found/i.test(msg)) {
    return htmlPage(
      'Staging not uploaded yet',
      `<p class="bad">The approve link worked, but this week's factory run is not in Firebase Storage yet.</p>
       <p>On your Mac, from the project folder, run:</p>
       <p><code>npm run factory:upload -- --run ${runId}</code></p>
       <p>Then click Approve again. If this was a dry-run / <code>--skip-meshy</code> email, there is also no 3D model yet — re-run:</p>
       <p><code>npm run factory:week -- --limit 2</code></p>
       <p style="color:#6e655c;font-size:13px;">(${msg})</p>`
    );
  }
  return htmlPage('Error', `<p class="bad">${msg}</p>`);
}

async function readJsonFromStorage(bucket, objectPath) {
  const file = bucket.file(objectPath);
  const [exists] = await file.exists();
  if (!exists) {
    throw new Error(`No such object: ${bucket.name}/${objectPath}`);
  }
  const [buf] = await file.download();
  return JSON.parse(buf.toString('utf8'));
}

async function promoteProduct(bucket, runId, productId) {
  const draftPath = `${BUCKET_PREFIX}/${runId}/${productId}/draft.json`;
  const draftRecord = await readJsonFromStorage(bucket, draftPath);
  if (draftRecord.status === 'live' || draftRecord.decision === 'approved') {
    return { already: true, name: draftRecord.name, productId: draftRecord.firestoreId };
  }
  if (draftRecord.decision === 'rejected') {
    return { rejected: true, name: draftRecord.name };
  }

  const glbRel = draftRecord.glbRelativePath
    ? path.basename(draftRecord.glbRelativePath)
    : draftRecord.filename;
  const stagingGlb = `${BUCKET_PREFIX}/${runId}/${productId}/${glbRel || draftRecord.filename}`;
  const destName = draftRecord.filename || `${productId}.glb`;
  const destPath = `models/${destName}`;

  const [exists] = await bucket.file(stagingGlb).exists();
  if (!exists) {
    throw new Error(
      `No 3D model staged at ${stagingGlb}. This approve link was probably from a dry-run / --skip-meshy preview. Re-run: npm run factory:week -- --limit 2`
    );
  }
  await bucket.file(stagingGlb).copy(bucket.file(destPath));
  const token = require('crypto').randomUUID();
  await bucket.file(destPath).setMetadata({
    metadata: { firebaseStorageDownloadTokens: token },
    contentType: 'model/gltf-binary',
  });
  const modelPath = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(destPath)}?alt=media&token=${token}`;

  const draft = draftRecord.draft || {};
  const productDoc = {
    name: draft.name || draftRecord.name,
    brand: draft.brand || '',
    type: draft.type || '',
    category: draft.category || '',
    subcategory: draft.subcategory || '',
    description: draft.description || '',
    price: draft.price || 0,
    locationPriority: draft.locationPriority || 1000,
    inputs: draft.inputs || [],
    outputs: draft.outputs || [],
    connections: draft.connections || [],
    specifications: draft.specifications || {},
    features: draft.features || [],
    modelPath,
    modelScale: draft.modelScale || 1.0,
    imageUrl: draft.imageUrl || draftRecord.thumbnailUrl || '',
    affiliateUrl: draft.affiliateUrl || '',
    purchaseUrl: draft.purchaseUrl || '',
    commerceStatus: draft.commerceStatus || '',
    commerceRetailer: draft.commerceRetailer || '',
    commerceAvailability: draft.commerceAvailability || '',
    width_mm: draft.width_mm || null,
    depth_mm: draft.depth_mm || null,
    height_mm: draft.height_mm || null,
    isActive: true,
    createdBy: 'product-factory',
    ownerId: 'product-factory',
    factoryRunId: runId,
    factoryProductId: productId,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  const ref = await admin.firestore().collection('products').add(productDoc);
  draftRecord.decision = 'approved';
  draftRecord.status = 'live';
  draftRecord.firestoreId = ref.id;
  draftRecord.modelPath = modelPath;
  draftRecord.decidedAt = new Date().toISOString();
  await bucket.file(draftPath).save(JSON.stringify(draftRecord, null, 2), {
    contentType: 'application/json',
  });

  return { name: productDoc.name, productId: ref.id, modelPath };
}

async function rejectProduct(bucket, runId, productId) {
  const draftPath = `${BUCKET_PREFIX}/${runId}/${productId}/draft.json`;
  let draftRecord;
  try {
    draftRecord = await readJsonFromStorage(bucket, draftPath);
  } catch {
    return { name: productId, missing: true };
  }
  draftRecord.decision = 'rejected';
  draftRecord.status = 'rejected';
  draftRecord.decidedAt = new Date().toISOString();
  await bucket.file(draftPath).save(JSON.stringify(draftRecord, null, 2), {
    contentType: 'application/json',
  });
  return { name: draftRecord.name || productId };
}

function createFactoryDecide() {
  return onRequest(
    { secrets: [FACTORY_HMAC_SECRET], cors: true },
    async (req, res) => {
      try {
        const token = req.query.token || req.body?.token;
        const verified = verifyFactoryToken(token, FACTORY_HMAC_SECRET.value());
        if (!verified.valid) {
          res.status(400).send(htmlPage('Invalid link', `<p class="bad">${verified.error}</p>`));
          return;
        }
        const { runId, productId, decision } = verified.payload;
        const bucket = storageBucket();

        if (decision === 'reject') {
          try {
            const r = await rejectProduct(bucket, runId, productId);
            res
              .status(200)
              .send(htmlPage('Rejected', `<p class="bad">Rejected <strong>${r.name}</strong>. It will not be published.</p>`));
          } catch (err) {
            res.status(404).send(friendlyStorageError(err, runId));
          }
          return;
        }

        if (decision === 'approve') {
          try {
            const r = await promoteProduct(bucket, runId, productId);
            if (r.rejected) {
              res.status(200).send(htmlPage('Already rejected', `<p>${r.name} was previously rejected.</p>`));
              return;
            }
            res
              .status(200)
              .send(
                htmlPage(
                  'Published',
                  `<p class="ok">Published <strong>${r.name}</strong>${r.already ? ' (already live)' : ''}.</p><p>Firestore id: <code>${r.productId || ''}</code></p>`
                )
              );
          } catch (err) {
            res.status(404).send(friendlyStorageError(err, runId));
          }
          return;
        }

        if (decision === 'approve_all') {
          try {
            const manifest = await readJsonFromStorage(
              bucket,
              `${BUCKET_PREFIX}/${runId}/manifest.json`
            );
            const results = [];
            for (const id of manifest.staged || []) {
              try {
                const r = await promoteProduct(bucket, runId, id);
                if (!r.rejected) results.push(r.name);
              } catch (err) {
                results.push(`${id}: ERROR ${err.message}`);
              }
            }
            res
              .status(200)
              .send(
                htmlPage(
                  'Batch published',
                  `<p class="ok">Approved remaining products for run <code>${runId}</code>.</p><ul>${results
                    .map((n) => `<li>${n}</li>`)
                    .join('')}</ul>`
                )
              );
          } catch (err) {
            res.status(404).send(friendlyStorageError(err, runId));
          }
          return;
        }

        res.status(400).send(htmlPage('Unknown decision', '<p class="bad">Unsupported decision.</p>'));
      } catch (err) {
        console.error('factoryDecide error', err);
        res
          .status(500)
          .send(htmlPage('Error', `<p class="bad">${String(err.message || err)}</p>`));
      }
    }
  );
}

module.exports = { createFactoryDecide, promoteProduct, rejectProduct };
