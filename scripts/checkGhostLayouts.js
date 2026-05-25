#!/usr/bin/env node
/* Read-only: dump the ghostSpotLayouts collection to see what (if anything) saved. */
const admin = require('firebase-admin');
admin.initializeApp({
  projectId: 'musicdeviceconnection',
  credential: admin.credential.applicationDefault(),
});
const db = admin.firestore();
(async () => {
  const snap = await db.collection('ghostSpotLayouts').get();
  if (snap.empty) {
    console.log('ghostSpotLayouts collection is EMPTY — no layouts have been saved.');
  } else {
    console.log(`Found ${snap.size} layout doc(s):`);
    snap.docs.forEach((d) => {
      const data = d.data();
      console.log(`- ${d.id}: ${Array.isArray(data.spots) ? data.spots.length : 0} spots, updatedBy=${data.updatedBy || '?'}, updatedAt=${data.updatedAt?.toDate?.().toISOString?.() || '?'}`);
    });
  }
  process.exit(0);
})().catch((err) => {
  console.error('Failed to read ghostSpotLayouts:', err.message);
  process.exit(1);
});
