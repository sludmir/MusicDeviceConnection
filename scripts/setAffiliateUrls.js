#!/usr/bin/env node
/**
 * Sets products.affiliateUrl for catalog items matched to zZounds product pages.
 *
 * Auth: firebase-admin + Application Default Credentials.
 * Setup:  gcloud auth application-default login
 * Dry run: npm run set-affiliate-urls -- --dry-run
 * Apply:   npm run set-affiliate-urls
 */

const admin = require('firebase-admin');

const PROJECT_ID = 'musicdeviceconnection';
const dryRun = process.argv.includes('--dry-run');

// Firestore doc id -> zZounds product page (clean URL, no tracking params).
const ZZOUNDS_URLS = {
  '1pIub3og5rC8ma6RdwUC': 'https://www.zzounds.com/item--PIOCDJ3000',       // CDJ-3000
  '4mhqPOxI8q6d092ai3mY': 'https://www.zzounds.com/item--PNRDJM900NXS2',   // DJM-900NXS2 (discontinued on zZounds)
  'sdJxUNoS4C60JHCEf7G6': 'https://www.zzounds.com/item--PIODDJ400',       // Pioneer DDJ-400
  'S7VZM6PRfVldVg9KznR0': 'https://www.zzounds.com/item--PNRRMX1000',     // RMX-1000
  'pjbOdWgal7pdKo8wGSwl': 'https://www.zzounds.com/item--AAHXONE96',       // Xone:96
  'lVIzwlNosgslfk9OUVKm': 'https://www.zzounds.com/item--YAMHS8',           // Yamaha HS8
  'DsYwnSaD8r7tZwKml4qh': 'https://www.zzounds.com/item--ARAMINIFREAK',    // Arturia MiniFreak
  '9kqynlGyGmWGQYJI7dtz': 'https://www.zzounds.com/item--KORMINILOGUEXD',   // Korg Minilogue XD
  'nrKWTOJ5zf0XymwUvqpW': 'https://www.zzounds.com/item--SEQPROPHET6',      // Sequential Prophet-6
  'qC1pm1ONBmdWzCNdKSPt': 'https://www.zzounds.com/item--FOCSCAR2I2V4',    // Focusrite Scarlett 2i2 Gen 4
  'l99XT3AKl15yzPalCVyv': 'https://www.zzounds.com/item--RNEMP2015',       // Rane MP2015
  'XfV46qbmbzXuAmtchrXr': 'https://www.zzounds.com/item--FEN0140512',       // Fender Stratocaster (Player II)
  'v3e0RIDzZ8BFiXEJTAuR': 'https://www.zzounds.com/item--GIBLPSL5A25',     // Gibson Les Paul Standard Lite
  'yNY0UUGxmYyp2huXOCKD': 'https://www.zzounds.com/item--BOEL1MISBP',       // Bose L1 (Model I system)
  '55g8R1TvWvMMGZNSXxPc': 'https://www.zzounds.com/item--ROLTB3',          // Roland TB-303 (TB-3 stand-in; original not sold new)
};

admin.initializeApp({
  projectId: PROJECT_ID,
  credential: admin.credential.applicationDefault(),
});

const db = admin.firestore();

(async () => {
  const ids = Object.keys(ZZOUNDS_URLS);
  console.log(dryRun ? 'DRY RUN — no writes\n' : 'Applying affiliateUrl updates…\n');

  let updated = 0;
  let skipped = 0;

  for (const id of ids) {
    const url = ZZOUNDS_URLS[id];
    const ref = db.collection('products').doc(id);
    const snap = await ref.get();

    if (!snap.exists) {
      console.warn(`SKIP  ${id} — document not found`);
      skipped += 1;
      continue;
    }

    const name = snap.data().name || id;
    const current = snap.data().affiliateUrl || null;

    if (current === url) {
      console.log(`OK    ${name} — already set`);
      skipped += 1;
      continue;
    }

    console.log(`${dryRun ? 'WOULD' : 'SET'}  ${name}`);
    console.log(`      ${current || '(empty)'} → ${url}`);

    if (!dryRun) {
      await ref.update({ affiliateUrl: url });
    }
    updated += 1;
  }

  console.log(`\nDone: ${updated} ${dryRun ? 'would update' : 'updated'}, ${skipped} unchanged/missing`);
  process.exit(0);
})().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
