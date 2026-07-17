#!/usr/bin/env node
/**
 * Applies an approved catalog proposal to Firestore products.
 *
 * Auth: firebase-admin + Application Default Credentials (or CI service account).
 *
 * Usage:
 *   npm run apply-catalog-proposal -- --file catalog/proposals/2026-07-17-affiliate-audit.json --dry-run
 *   npm run apply-catalog-proposal -- --file catalog/proposals/2026-07-17-affiliate-audit.json
 */

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const { validateProposal } = require('./lib/proposalSchema');

const PROJECT_ID = 'musicdeviceconnection';
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const fileIdx = args.indexOf('--file');

if (fileIdx < 0 || !args[fileIdx + 1]) {
  console.error('Usage: applyCatalogProposal.js --file <proposal.json> [--dry-run]');
  process.exit(1);
}

const proposalPath = path.resolve(args[fileIdx + 1]);

admin.initializeApp({
  projectId: PROJECT_ID,
  credential: admin.credential.applicationDefault(),
});

const db = admin.firestore();

(async () => {
  const raw = fs.readFileSync(proposalPath, 'utf8');
  const proposal = JSON.parse(raw);
  const { valid, errors } = validateProposal(proposal);
  if (!valid) {
    console.error('Invalid proposal:\n', errors.join('\n'));
    process.exit(1);
  }

  console.log(dryRun ? 'DRY RUN — no writes\n' : 'Applying proposal…\n');
  console.log(`Run: ${proposal.runId} (${proposal.changes.length} changes)\n`);

  let applied = 0;
  let skipped = 0;

  for (const change of proposal.changes) {
    const ref = db.collection('products').doc(change.productId);
    const snap = await ref.get();
    if (!snap.exists) {
      console.warn(`SKIP  ${change.productId} — document not found`);
      skipped += 1;
      continue;
    }

    const name = change.productName || snap.data().name || change.productId;
    if (change.action === 'review_required' && !process.env.CATALOG_APPLY_ALLOW_REVIEW) {
      console.log(`SKIP  ${name} — review_required (set CATALOG_APPLY_ALLOW_REVIEW=1 to apply)`);
      skipped += 1;
      continue;
    }

    console.log(`${dryRun ? 'WOULD' : 'SET'}  ${name}`);
    console.log(`      ${JSON.stringify(change.updates)}`);

    if (!dryRun) {
      await ref.update(change.updates);
    }
    applied += 1;
  }

  console.log(`\nDone: ${applied} ${dryRun ? 'would apply' : 'applied'}, ${skipped} skipped`);
  process.exit(0);
})().catch((err) => {
  console.error('Apply failed:', err);
  process.exit(1);
});
