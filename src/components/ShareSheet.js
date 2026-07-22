import React, { useState, useCallback, useMemo } from 'react';
import { collection, getDocs, query, where, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import { sendMediaToUser } from '../utils/conversations';
import {
  getMediaShareUrl,
  getMediaShareText,
  copyShareLink,
  openSmsShare,
  openWhatsAppShare,
  openEmailShare,
  openXShare,
  shareToInstagram,
} from '../utils/shareUrl';
import { Modal, Avatar, Input, useToast } from '../ui';
import { MdLink, MdSms, MdEmail } from 'react-icons/md';
import { FaWhatsapp, FaXTwitter, FaInstagram } from 'react-icons/fa6';
import './ShareSheet.css';

const LINK_CHANNELS = [
  { id: 'copy', label: 'Copy link', Icon: MdLink },
  { id: 'sms', label: 'Messages', Icon: MdSms },
  { id: 'whatsapp', label: 'WhatsApp', Icon: FaWhatsapp },
  { id: 'email', label: 'Email', Icon: MdEmail },
  { id: 'x', label: 'X', Icon: FaXTwitter },
  { id: 'instagram', label: 'Instagram', Icon: FaInstagram },
];

function ShareSheet({ open, onClose, media, onSent }) {
  const toast = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [following, setFollowing] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(null);

  const currentUid = auth.currentUser?.uid;
  const shareUrl = useMemo(() => getMediaShareUrl(media), [media]);
  const shareText = useMemo(() => getMediaShareText(media), [media]);

  const loadFollowing = useCallback(async () => {
    if (!currentUid) return;
    try {
      const meSnap = await getDoc(doc(db, 'users', currentUid));
      const followingIds = meSnap.data()?.following || [];
      if (!followingIds.length) {
        setFollowing([]);
        return;
      }
      const users = await Promise.all(
        followingIds.slice(0, 24).map(async (uid) => {
          const snap = await getDoc(doc(db, 'users', uid));
          return snap.exists() ? { id: uid, ...snap.data() } : null;
        })
      );
      setFollowing(users.filter(Boolean));
    } catch (err) {
      console.error('Error loading following:', err);
    }
  }, [currentUid]);

  React.useEffect(() => {
    if (open) {
      setSearchTerm('');
      setResults([]);
      loadFollowing();
    }
  }, [open, loadFollowing]);

  const searchUsers = async () => {
    const term = (searchTerm || '').trim().toLowerCase();
    if (!term) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const q = query(
        collection(db, 'users'),
        where('displayName', '>=', term),
        where('displayName', '<=', term + '\uf8ff'),
        orderBy('displayName'),
        limit(20)
      );
      const snap = await getDocs(q);
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((u) => u.id !== currentUid);
      setResults(list);
    } catch (err) {
      console.error('Error searching users:', err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSendToUser = async (recipient) => {
    if (!currentUid || !media || sending) return;
    setSending(recipient.id);
    try {
      const conversationId = await sendMediaToUser(currentUid, recipient.id, media);
      toast.success(`Sent to ${recipient.displayName || 'user'}`);
      onSent?.(conversationId);
      onClose?.();
    } catch (err) {
      console.error('Error sending message:', err, {
        recipientId: recipient.id,
        mediaType: media?.type,
        mediaId: media?.item?.id,
        step: err?.step,
      });
      const step = err?.step ? ` (${err.step})` : '';
      if (err?.code === 'permission-denied') {
        toast.error(`Messaging blocked${step} — try again after a refresh.`);
      } else {
        toast.error(err?.message || 'Could not send message.');
      }
    } finally {
      setSending(null);
    }
  };

  const handleLinkChannel = async (channelId) => {
    if (!shareUrl) {
      toast.error('Could not build share link.');
      return;
    }
    switch (channelId) {
      case 'copy': {
        const ok = await copyShareLink(media);
        toast.success(ok ? 'Link copied' : 'Could not copy link');
        break;
      }
      case 'sms':
        openSmsShare(shareUrl, shareText);
        break;
      case 'whatsapp':
        openWhatsAppShare(shareUrl, shareText);
        break;
      case 'email':
        openEmailShare(shareUrl, shareText);
        break;
      case 'x':
        openXShare(shareUrl, shareText);
        break;
      case 'instagram': {
        const ok = await shareToInstagram(shareUrl);
        if (ok) toast.success('Link copied — paste in Instagram');
        else toast.error('Could not copy link');
        break;
      }
      default:
        break;
    }
  };

  const displayList = searchTerm.trim() ? results : following;
  const title = media?.type === 'set' ? 'Share set' : 'Share clip';

  return (
    <Modal open={open} onClose={onClose} title={title} className="share-sheet-modal">
      <div className="share-sheet">
        <section className="share-sheet__section">
          <h3 className="share-sheet__heading mono-label">Send to</h3>
          <div className="share-sheet__search">
            <Input
              type="search"
              placeholder="Search users…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') searchUsers(); }}
            />
          </div>
          <div className="share-sheet__users">
            {loading && <p className="share-sheet__hint">Searching…</p>}
            {!loading && displayList.length === 0 && (
              <p className="share-sheet__hint">
                {searchTerm.trim()
                  ? 'No users found.'
                  : 'Follow creators to send sets and clips directly.'}
              </p>
            )}
            {displayList.map((user) => (
              <button
                key={user.id}
                type="button"
                className="share-sheet__user press"
                onClick={() => handleSendToUser(user)}
                disabled={!!sending}
                aria-label={`Send to ${user.displayName || 'user'}`}
              >
                <Avatar name={user.displayName || 'User'} size={48} />
                <span className="share-sheet__user-name">
                  {(user.displayName || user.id.slice(0, 8)).split(' ')[0]}
                </span>
                {sending === user.id && <span className="share-sheet__sending">…</span>}
              </button>
            ))}
          </div>
        </section>

        <section className="share-sheet__section">
          <h3 className="share-sheet__heading mono-label">Share link</h3>
          <div className="share-sheet__channels">
            {LINK_CHANNELS.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                className="share-sheet__channel press"
                onClick={() => handleLinkChannel(id)}
                aria-label={label}
              >
                <span className="share-sheet__channel-icon">
                  <Icon size={22} aria-hidden="true" />
                </span>
                <span className="share-sheet__channel-label">{label}</span>
              </button>
            ))}
          </div>
          {shareUrl && (
            <p className="share-sheet__url" title={shareUrl}>{shareUrl}</p>
          )}
        </section>
      </div>
    </Modal>
  );
}

export default ShareSheet;
