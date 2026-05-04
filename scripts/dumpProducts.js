#!/usr/bin/env node
/**
 * Regenerates PRODUCTS.md by dumping the Firestore `products` collection.
 *
 * Auth: uses firebase-admin with Application Default Credentials.
 * One-time setup:  gcloud auth application-default login
 * Then run:        npm run dump-products
 */

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const PROJECT_ID = 'musicdeviceconnection';
const OUTPUT_PATH = path.join(__dirname, '..', 'PRODUCTS.md');

admin.initializeApp({
  projectId: PROJECT_ID,
  credential: admin.credential.applicationDefault(),
});

const db = admin.firestore();

function compatibleSetupTypes(p) {
  if (Array.isArray(p.compatibleSetupTypes) && p.compatibleSetupTypes.length) {
    return p.compatibleSetupTypes;
  }
  return p.category ? [p.category] : ['Uncategorized'];
}

function fmtRow(p) {
  const brand = p.brand || '—';
  const sub = p.subcategory || p.type || '—';
  const has3D = p.modelPath || p.modelUrl ? '✓' : '✗';
  return `- **${p.name}** — ${brand} — ${sub} — 3D model: ${has3D}`;
}

(async () => {
  const snap = await db.collection('products').get();
  const products = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  products.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  const bySetup = { DJ: [], Producer: [], Musician: [], Other: [] };
  for (const p of products) {
    const types = compatibleSetupTypes(p);
    let placed = false;
    for (const t of types) {
      if (bySetup[t]) {
        bySetup[t].push(p);
        placed = true;
      }
    }
    if (!placed) bySetup.Other.push(p);
  }

  const today = new Date().toISOString().slice(0, 10);
  const lines = [];
  lines.push('# Running List of 3D Products in the Builder');
  lines.push('');
  lines.push('Auto-generated from the Firestore `products` collection. **Do not edit by hand** — run `npm run dump-products` to regenerate.');
  lines.push('');
  lines.push(`Last generated: ${today}`);
  lines.push(`Total products: ${products.length}`);
  lines.push('');
  lines.push('Products compatible with multiple setup types appear in each relevant section.');
  lines.push('');
  lines.push('---');
  lines.push('');

  for (const setup of ['DJ', 'Producer', 'Musician', 'Other']) {
    const list = bySetup[setup];
    if (!list.length) continue;
    lines.push(`## ${setup} (${list.length})`);
    lines.push('');
    list.forEach((p) => lines.push(fmtRow(p)));
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('## How to update');
  lines.push('');
  lines.push('1. Add/edit/remove products via the in-app Product Management screen (Firestore is the source of truth).');
  lines.push('2. Run `npm run dump-products` to regenerate this file.');
  lines.push('3. Commit the updated `PRODUCTS.md`.');
  lines.push('');

  fs.writeFileSync(OUTPUT_PATH, lines.join('\n'));
  console.log(`Wrote ${products.length} products to ${OUTPUT_PATH}`);
  process.exit(0);
})().catch((err) => {
  console.error('Failed to dump products:', err);
  process.exit(1);
});
