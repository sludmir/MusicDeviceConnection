#!/usr/bin/env node
/**
 * One-time privacy cleanup: removes email addresses from documents that other
 * users can read.
 *
 *  1. users/*        — deletes the `email` field (rules allow any signed-in
 *                      user to read user docs; auth already knows the email).
 *  2. products/*     — rewrites `createdBy` when it contains an email
 *                      (products are public-read) to the owner's displayName,
 *                      falling back to their uid.
 *
 * Auth: uses firebase-admin with Application Default Credentials.
 * One-time setup:  gcloud auth application-default login
 * Dry run:         node scripts/scrubEmails.js
 * Apply:           node scripts/scrubEmails.js --apply
 */

const admin = require('firebase-admin');

const PROJECT_ID = 'musicdeviceconnection';
const APPLY = process.argv.includes('--apply');

admin.initializeApp({
  projectId: PROJECT_ID,
  credential: admin.credential.applicationDefault(),
});

const db = admin.firestore();
const looksLikeEmail = (s) => typeof s === 'string' && /\S+@\S+\.\S+/.test(s);

async function scrubUsers() {
  const snap = await db.collection('users').get();
  let count = 0;
  for (const doc of snap.docs) {
    if (!('email' in doc.data())) continue;
    count += 1;
    console.log(`users/${doc.id}: remove email`);
    if (APPLY) {
      await doc.ref.update({ email: admin.firestore.FieldValue.delete() });
    }
  }
  return count;
}

async function scrubProducts() {
  const snap = await db.collection('products').get();
  let count = 0;
  for (const doc of snap.docs) {
    const { createdBy, ownerId } = doc.data();
    if (!looksLikeEmail(createdBy)) continue;
    count += 1;
    let replacement = ownerId || 'unknown';
    if (ownerId) {
      const owner = await db.collection('users').doc(ownerId).get();
      if (owner.exists && owner.data().displayName) {
        replacement = owner.data().displayName;
      }
    }
    console.log(`products/${doc.id}: createdBy → ${replacement}`);
    if (APPLY) {
      await doc.ref.update({ createdBy: replacement });
    }
  }
  return count;
}

(async () => {
  const users = await scrubUsers();
  const products = await scrubProducts();
  console.log(
    `\n${APPLY ? 'Updated' : 'Would update'} ${users} user doc(s), ${products} product doc(s).` +
      (APPLY ? '' : '\nRe-run with --apply to write changes.')
  );
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
