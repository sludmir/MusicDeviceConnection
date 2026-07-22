/**
 * Validates conversation/message Firestore rules against the emulator.
 * Run: firebase emulators:exec --only firestore "node scripts/testDmRules.js"
 */
const fs = require('fs');
const path = require('path');
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require('@firebase/rules-unit-testing');

const PROJECT_ID = 'dm-rules-test';
const rules = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');

async function main() {
  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules },
  });

  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await db.collection('users').doc('alice').set({ displayName: 'Alice' });
    await db.collection('users').doc('bob').set({ displayName: 'Bob' });
  });

  const alice = testEnv.authenticatedContext('alice');
  const db = alice.firestore();
  const convId = ['alice', 'bob'].sort().join('_');
  const convRef = db.collection('conversations').doc(convId);
  const msgRef = convRef.collection('messages').doc();

  const convData = {
    participantIds: ['alice', 'bob'],
    lastMessage: 'Sent a set: Test',
    lastMessagePreview: 'Sent a set: Test',
    lastMessageAt: new Date(),
    createdAt: new Date(),
  };

  const messageData = {
    senderId: 'alice',
    type: 'liveSet',
    sharedSet: {
      setId: 'set1',
      title: 'Test set',
      creatorId: 'alice',
      creatorName: 'Alice',
    },
    createdAt: new Date(),
    readBy: ['alice'],
  };

  // First send: batch create conversation + message (matches client)
  const batch1 = db.batch();
  batch1.set(convRef, convData, { merge: true });
  batch1.set(msgRef, messageData);
  await assertSucceeds(batch1.commit());

  // Second send: existing conversation
  const msgRef2 = convRef.collection('messages').doc();
  const batch2 = db.batch();
  batch2.set(convRef, { ...convData, lastMessage: 'Again' }, { merge: true });
  batch2.set(msgRef2, { ...messageData, sharedSet: { setId: 'set2', title: 'Two' } });
  await assertSucceeds(batch2.commit());

  // Non-participant cannot write
  const eve = testEnv.authenticatedContext('eve');
  const eveDb = eve.firestore();
  const eveConv = eveDb.collection('conversations').doc(convId);
  const batch3 = eveDb.batch();
  batch3.set(eveConv, convData, { merge: true });
  batch3.set(eveConv.collection('messages').doc(), messageData);
  await assertFails(batch3.commit());

  console.log('All DM rules tests passed.');
  await testEnv.cleanup();
}

main().catch((err) => {
  console.error('DM rules test FAILED:', err);
  process.exit(1);
});
