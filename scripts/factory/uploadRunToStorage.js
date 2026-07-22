#!/usr/bin/env node
/**
 * Upload a factory run directory to Firebase Storage:
 *   factory/runs/{runId}/**
 *
 * Usage:
 *   node scripts/factory/uploadRunToStorage.js --run 2026-07-21
 */

const fs = require('fs');
const path = require('path');
const { loadFactoryEnv } = require('../lib/loadEnv');
loadFactoryEnv(path.join(__dirname, '..', '..'));
const admin = require('firebase-admin');

const ROOT = path.join(__dirname, '..', '..');
const RUNS_DIR = path.join(ROOT, 'catalog', 'factory', 'runs');

function parseArgs(argv) {
  let runId = null;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--run') runId = argv[++i];
  }
  if (!runId) {
    console.error('Usage: node scripts/factory/uploadRunToStorage.js --run YYYY-MM-DD');
    process.exit(1);
  }
  return { runId };
}

function walk(dir, files = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, files);
    else files.push(p);
  }
  return files;
}

function resolveStorageBucket() {
  return (
    process.env.FIREBASE_STORAGE_BUCKET ||
    process.env.REACT_APP_FIREBASE_STORAGE_BUCKET ||
    'musicdeviceconnection.firebasestorage.app'
  );
}

(async () => {
  const { runId } = parseArgs(process.argv.slice(2));
  const runDir = path.join(RUNS_DIR, runId);
  if (!fs.existsSync(runDir)) throw new Error(`Missing run dir ${runDir}`);

  const storageBucket = resolveStorageBucket();
  if (!admin.apps.length) {
    admin.initializeApp({
      projectId: 'musicdeviceconnection',
      credential: admin.credential.applicationDefault(),
      storageBucket,
    });
  }
  const bucket = admin.storage().bucket(storageBucket);
  console.log(`Uploading to gs://${bucket.name}/factory/runs/${runId}/`);
  const files = walk(runDir);
  for (const file of files) {
    const rel = path.relative(runDir, file);
    const dest = `factory/runs/${runId}/${rel.replace(/\\/g, '/')}`;
    const contentType = file.endsWith('.glb')
      ? 'model/gltf-binary'
      : file.endsWith('.json')
        ? 'application/json'
        : file.endsWith('.html')
          ? 'text/html'
          : file.endsWith('.jpg') || file.endsWith('.jpeg')
            ? 'image/jpeg'
            : file.endsWith('.png')
              ? 'image/png'
              : undefined;
    await bucket.upload(file, {
      destination: dest,
      metadata: contentType ? { contentType } : undefined,
    });
    console.log(`Uploaded gs://${bucket.name}/${dest}`);
  }
  console.log(`Done — ${files.length} file(s)`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
