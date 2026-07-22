const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { defineSecret, defineString } = require('firebase-functions/params');
const admin = require('firebase-admin');

const RESEND_API_KEY = defineSecret('RESEND_API_KEY');
const MESSAGE_EMAIL_FROM = defineString('MESSAGE_EMAIL_FROM', {
  default: 'LiveSet <onboarding@resend.dev>',
});
const LIVESET_SITE_URL = defineString('LIVESET_SITE_URL', {
  default: 'https://liveset.io',
});

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function messagePreview(data) {
  if (!data) return 'Sent you a message';
  if (data.type === 'text') {
    const text = (data.text || '').trim();
    return text ? text.slice(0, 120) : 'Sent you a message';
  }
  if (data.type === 'clip') {
    return `Sent you a clip: ${data.clip?.title || 'Clip'}`;
  }
  if (data.type === 'liveSet' || data.type === 'set') {
    const setData = data.sharedSet || data.set;
    return `Sent you a set: ${setData?.title || 'Live set'}`;
  }
  return 'Sent you a message';
}

async function sendMessageEmail({ to, senderName, preview, conversationId, apiKey, from, siteUrl }) {
  if (!to || !apiKey) return { skipped: true };

  const safeName = escapeHtml(senderName);
  const safePreview = escapeHtml(preview);
  const threadUrl = `${siteUrl.replace(/\/$/, '')}/messages/${encodeURIComponent(conversationId)}`;

  const subject = `${senderName} sent you a message on LiveSet`;
  const html = `
    <div style="font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.5; color: #1a1816; max-width: 520px;">
      <p style="font-size: 18px; font-weight: 600; margin: 0 0 12px;">
        ${safeName} sent you a message on liveset.io!
      </p>
      <p style="margin: 0 0 20px; color: #5c5650;">${safePreview}</p>
      <p style="margin: 0;">
        <a href="${threadUrl}" style="display: inline-block; background: #d9c2a0; color: #1a1816; text-decoration: none; font-weight: 600; padding: 10px 18px; border-radius: 999px;">
          View message
        </a>
      </p>
    </div>
  `.trim();

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend ${res.status}: ${body}`);
  }

  return res.json();
}

function createMessageNotifyHandler(deps = {}) {
  const getFirestore = deps.getFirestore || (() => admin.firestore());
  const getAuth = deps.getAuth || (() => admin.auth());
  const sendEmail = deps.sendEmail || sendMessageEmail;

  return async (event) => {
    const message = event.data?.data();
    if (!message?.senderId) return;

    const conversationId = event.params.conversationId;
    const db = getFirestore();
    const convSnap = await db.doc(`conversations/${conversationId}`).get();
    if (!convSnap.exists) return;

    const participantIds = convSnap.data()?.participantIds || [];
    const recipientId = participantIds.find((id) => id !== message.senderId);
    if (!recipientId) return;

    const senderSnap = await db.doc(`users/${message.senderId}`).get();
    const senderName = senderSnap.data()?.displayName || 'Someone';
    const preview = messagePreview(message);

    await db.collection(`users/${recipientId}/notifications`).add({
      type: 'message',
      fromUserId: message.senderId,
      fromUserName: senderName,
      conversationId,
      preview,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    let recipientEmail = null;
    try {
      const userRecord = await getAuth().getUser(recipientId);
      recipientEmail = userRecord.email || null;
    } catch (err) {
      console.warn('Could not load recipient auth profile:', recipientId, err.message);
      return;
    }

    if (!recipientEmail) {
      console.warn('Recipient has no email; skipped message email:', recipientId);
      return;
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn('RESEND_API_KEY not configured; skipped message email');
      return;
    }

    try {
      await sendEmail({
        to: recipientEmail,
        senderName,
        preview,
        conversationId,
        apiKey,
        from: MESSAGE_EMAIL_FROM.value(),
        siteUrl: LIVESET_SITE_URL.value(),
      });
    } catch (err) {
      console.error('Failed to send message email:', err.message);
    }
  };
}

function createOnMessageCreated() {
  const handler = createMessageNotifyHandler();
  return onDocumentCreated(
    {
      document: 'conversations/{conversationId}/messages/{messageId}',
      secrets: [RESEND_API_KEY],
    },
    handler
  );
}

module.exports = {
  createOnMessageCreated,
  createMessageNotifyHandler,
  messagePreview,
  sendMessageEmail,
};
