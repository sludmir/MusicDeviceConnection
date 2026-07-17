#!/usr/bin/env node
/**
 * Audits product purchase/affiliate links and writes a catalog proposal JSON.
 *
 * Auth: firebase-admin + Application Default Credentials.
 * Setup:  gcloud auth application-default login
 *
 * Usage:
 *   npm run audit-affiliate-links -- --dry-run
 *   npm run audit-affiliate-links -- --out catalog/proposals/2026-07-17.json
 */

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const { PROPOSAL_VERSION } = require('./lib/proposalSchema');
const { auditProduct, auditResultToProposalChange } = require('./lib/commerceAudit');

const PROJECT_ID = 'musicdeviceconnection';
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const outIdx = args.indexOf('--out');
const defaultDate = new Date().toISOString().slice(0, 10);
const outPath = outIdx >= 0
  ? args[outIdx + 1]
  : path.join(__dirname, '..', 'catalog', 'proposals', `${defaultDate}-affiliate-audit.json`);

admin.initializeApp({
  projectId: PROJECT_ID,
  credential: admin.credential.applicationDefault(),
});

const db = admin.firestore();

(async () => {
  console.log(dryRun ? 'DRY RUN — audit only\n' : `Writing proposal to ${outPath}\n`);

  const snap = await db.collection('products').get();
  const products = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  console.log(`Loaded ${products.length} products.`);

  const validatedAt = new Date().toISOString();
  const runId = `${defaultDate}-weekly-affiliate-audit`;
  const audits = [];

  for (const product of products) {
    process.stdout.write(`Checking ${product.name || product.id}… `);
    const audit = await auditProduct(product);
    audits.push(audit);
    console.log(audit.commerceValidationReason);
  }

  const changes = audits
    .filter((a) => a.needsUpdate || a.commerceAvailability !== 'in_stock' || !a.checkedUrl)
    .map((a) => auditResultToProposalChange(a, { validatedAt }));

  const proposal = {
    version: PROPOSAL_VERSION,
    generatedAt: validatedAt,
    runId,
    summary: {
      totalProducts: products.length,
      checked: audits.length,
      proposedChanges: changes.length,
      unreachable: audits.filter((a) => !a.reachable).length,
      nonMonetized: audits.filter((a) => a.commerceStatus === 'non_monetized').length,
    },
    changes,
  };

  console.log('\nSummary:', proposal.summary);

  if (dryRun) {
    console.log('\nSample changes (up to 5):');
    changes.slice(0, 5).forEach((c) => {
      console.log(`  ${c.productName}: ${c.action} — ${c.updates.commerceValidationReason || JSON.stringify(c.updates)}`);
    });
    process.exit(0);
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(proposal, null, 2)}\n`);
  console.log(`\nWrote ${changes.length} proposed change(s) to ${outPath}`);
  process.exit(0);
})().catch((err) => {
  console.error('Audit failed:', err);
  process.exit(1);
});
