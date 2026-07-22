import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  writeBatch,
  serverTimestamp,
  waitForPendingWrites,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';

export function conversationIdFor(uidA, uidB) {
  return [uidA, uidB].sort().join('_');
}

function omitUndefined(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  );
}

function clipPayload(clip) {
  return omitUndefined({
    clipId: clip.id || '',
    title: clip.title || 'Clip',
    creatorId: clip.creatorId || '',
    creatorName: clip.creatorName || '',
    thumbnailURL: clip.thumbnailURL || '',
    videoURL: clip.videoURL || '',
    clipStart: Number.isFinite(Number(clip.clipStart)) ? Number(clip.clipStart) : 0,
    clipEnd: Number.isFinite(Number(clip.clipEnd)) ? Number(clip.clipEnd) : null,
    clipStartMaster: Number.isFinite(Number(clip.clipStartMaster)) ? Number(clip.clipStartMaster) : null,
    clipEndMaster: Number.isFinite(Number(clip.clipEndMaster)) ? Number(clip.clipEndMaster) : null,
    audioTrackURL: clip.audioTrackURL || '',
    audioReplacesVideo: clip.audioReplacesVideo !== false,
    fullSetId: clip.fullSetId || '',
  });
}

function setPayload(set) {
  return omitUndefined({
    setId: set.id || '',
    title: set.title || 'Live set',
    creatorId: set.creatorId || '',
    creatorName: set.creatorName || '',
    thumbnailURL: set.thumbnailURL || '',
    videoURL: set.videoURL || '',
    audioTrackURL: set.audioTrackURL || '',
    audioReplacesVideo: set.audioReplacesVideo !== false,
    setupName: set.setupName || '',
  });
}

function buildMediaMessage(senderId, media) {
  if (media.type === 'clip') {
    const preview = `Sent a clip: ${media.item.title || 'Clip'}`;
    return {
      preview,
      data: omitUndefined({
        senderId,
        type: 'clip',
        clip: clipPayload(media.item),
        createdAt: serverTimestamp(),
        readBy: [senderId],
      }),
    };
  }
  if (media.type === 'set') {
    const preview = `Sent a set: ${media.item.title || 'Live set'}`;
    return {
      preview,
      data: omitUndefined({
        senderId,
        type: 'liveSet',
        sharedSet: setPayload(media.item),
        createdAt: serverTimestamp(),
        readBy: [senderId],
      }),
    };
  }
  throw new Error('Unknown media type');
}

export async function getOrCreateConversation(currentUid, otherUid) {
  if (!currentUid || !otherUid || currentUid === otherUid) {
    throw new Error('Invalid conversation participants');
  }
  const id = conversationIdFor(currentUid, otherUid);
  const ref = doc(db, 'conversations', id);
  const participantIds = [currentUid, otherUid].sort();

  await setDoc(ref, {
    participantIds,
    lastMessage: '',
    lastMessagePreview: '',
    lastMessageAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  }, { merge: true });

  return id;
}

export async function sendMediaToUser(currentUid, recipientUid, media) {
  if (!currentUid || !recipientUid) {
    throw new Error('You must be signed in to send messages');
  }
  if (currentUid === recipientUid) {
    throw new Error('You cannot message yourself');
  }
  if (!media?.item?.id) {
    throw new Error('This item cannot be shared yet');
  }

  const recipientSnap = await getDoc(doc(db, 'users', recipientUid));
  if (!recipientSnap.exists()) {
    throw new Error('That user could not be found');
  }

  const conversationId = conversationIdFor(currentUid, recipientUid);
  const convRef = doc(db, 'conversations', conversationId);
  const participantIds = [currentUid, recipientUid].sort();
  const { preview, data: messageData } = buildMediaMessage(currentUid, media);
  const messageRef = doc(collection(db, 'conversations', conversationId, 'messages'));

  const batch = writeBatch(db);
  batch.set(convRef, {
    participantIds,
    lastMessage: preview,
    lastMessagePreview: preview,
    lastMessageAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  }, { merge: true });
  batch.set(messageRef, messageData);

  try {
    await batch.commit();
    await waitForPendingWrites(db);
    const verifySnap = await getDocs(collection(db, 'conversations', conversationId, 'messages'));
    if (verifySnap.empty) {
      throw new Error('Message did not save — try again.');
    }
  } catch (err) {
    err.step = 'send';
    throw err;
  }

  return conversationId;
}

// Used by Messages.js for plain text
export async function sendTextMessage(conversationId, senderId, text) {
  const trimmed = (text || '').trim();
  if (!trimmed) return null;

  const convRef = doc(db, 'conversations', conversationId);
  const convSnap = await getDoc(convRef);
  if (!convSnap.exists()) {
    throw new Error('Conversation not found');
  }

  const messageRef = doc(collection(db, 'conversations', conversationId, 'messages'));
  await setDoc(messageRef, {
    senderId,
    type: 'text',
    text: trimmed.slice(0, 2000),
    createdAt: serverTimestamp(),
    readBy: [senderId],
  });
  await updateDoc(convRef, {
    lastMessage: trimmed.slice(0, 120),
    lastMessagePreview: trimmed.slice(0, 120),
    lastMessageAt: serverTimestamp(),
  });
  return messageRef.id;
}

export { clipPayload, setPayload };
