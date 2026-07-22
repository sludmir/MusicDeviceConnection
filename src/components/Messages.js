import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  limit,
} from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import { conversationIdFor, getOrCreateConversation } from '../utils/conversations';
import ChatMediaPlayer from './ChatMediaPlayer';
import { Avatar, EmptyState, SectionHeader, useToast } from '../ui';
import { MdArrowBack, MdSend } from 'react-icons/md';
import './Messages.css';

function formatMessageTime(ts) {
  if (!ts?.toDate) return '';
  const d = ts.toDate();
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatInboxTime(ts) {
  if (!ts?.toDate) return '';
  const d = ts.toDate();
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function MessagesInbox({ onOpenConversation, onProfileClick }) {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);
  const [userNames, setUserNames] = useState({});
  const [loading, setLoading] = useState(true);
  const currentUid = auth.currentUser?.uid;

  useEffect(() => {
    if (!currentUid) return undefined;
    const q = query(
      collection(db, 'conversations'),
      where('participantIds', 'array-contains', currentUid),
      orderBy('lastMessageAt', 'desc'),
      limit(50)
    );
    const unsub = onSnapshot(q, async (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setConversations(list);
      const names = {};
      await Promise.all(list.map(async (conv) => {
        const otherId = conv.participantIds.find((id) => id !== currentUid);
        if (!otherId || userNames[otherId]) return;
        try {
          const userSnap = await getDoc(doc(db, 'users', otherId));
          names[otherId] = userSnap.data()?.displayName || otherId.slice(0, 8);
        } catch {
          names[otherId] = otherId.slice(0, 8);
        }
      }));
      setUserNames((prev) => ({ ...prev, ...names }));
      setLoading(false);
    }, (err) => {
      console.error('Inbox listener error:', err);
      setLoading(false);
    });
    return unsub;
  }, [currentUid]);

  const goProfile = (userId, e) => {
    if (!userId) return;
    e?.stopPropagation?.();
    if (onProfileClick) onProfileClick(userId);
    else navigate(`/profile/${userId}`);
  };

  if (loading) {
    return <div className="messages__loading">Loading messages…</div>;
  }

  if (conversations.length === 0) {
    return (
      <EmptyState
        eyebrow="INBOX"
        title="No messages yet"
        body="Share a clip or set from the feed, or message someone from their profile."
      />
    );
  }

  return (
    <ul className="messages-inbox">
      {conversations.map((conv) => {
        const otherId = conv.participantIds.find((id) => id !== currentUid);
        const name = userNames[otherId] || 'User';
        return (
          <li key={conv.id}>
            <div
              className="messages-inbox__item press"
              role="button"
              tabIndex={0}
              onClick={() => onOpenConversation(conv.id, otherId, name)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onOpenConversation(conv.id, otherId, name);
                }
              }}
            >
              <div
                className="messages-inbox__avatar-btn press"
                role="button"
                tabIndex={0}
                onClick={(e) => goProfile(otherId, e)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    goProfile(otherId, e);
                  }
                }}
                aria-label={`View ${name}'s profile`}
              >
                <Avatar name={name} size={48} />
              </div>
              <div className="messages-inbox__body">
                <div className="messages-inbox__row">
                  <span
                    className="messages-inbox__name messages-inbox__name-btn"
                    role="button"
                    tabIndex={0}
                    onClick={(e) => goProfile(otherId, e)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        goProfile(otherId, e);
                      }
                    }}
                  >
                    {name}
                  </span>
                  <span className="messages-inbox__time">{formatInboxTime(conv.lastMessageAt)}</span>
                </div>
                <p className="messages-inbox__preview">{conv.lastMessagePreview || conv.lastMessage || 'Say hi'}</p>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function sortMessages(docs) {
  return docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => {
      const aMs = a.createdAt?.toMillis?.() ?? 0;
      const bMs = b.createdAt?.toMillis?.() ?? 0;
      return aMs - bMs;
    });
}

function MessageThread({ conversationId, otherUserId, otherUserName, onBack, onProfileClick }) {
  const toast = useToast();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);
  const currentUid = auth.currentUser?.uid;

  useEffect(() => {
    if (!conversationId) return undefined;
    setLoadingMessages(true);

    const messagesRef = collection(db, 'conversations', conversationId, 'messages');
    const orderedQuery = query(
      messagesRef,
      orderBy('createdAt', 'asc'),
      limit(200)
    );

    const loadFallback = async () => {
      try {
        const snap = await getDocs(messagesRef);
        setMessages(sortMessages(snap.docs));
      } catch (err) {
        console.error('Messages fallback load error:', err);
        setMessages([]);
      } finally {
        setLoadingMessages(false);
      }
    };

    const unsub = onSnapshot(
      orderedQuery,
      (snap) => {
        setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoadingMessages(false);
      },
      (err) => {
        console.error('Messages listener error:', err);
        loadFallback();
      }
    );

    return unsub;
  }, [conversationId]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || !currentUid || sending) return;
    setSending(true);
    try {
      await addDoc(collection(db, 'conversations', conversationId, 'messages'), {
        senderId: currentUid,
        type: 'text',
        text: trimmed.slice(0, 2000),
        createdAt: serverTimestamp(),
        readBy: [currentUid],
      });
      await updateDoc(doc(db, 'conversations', conversationId), {
        lastMessage: trimmed.slice(0, 120),
        lastMessagePreview: trimmed.slice(0, 120),
        lastMessageAt: serverTimestamp(),
      });
      setText('');
    } catch (err) {
      console.error('Send error:', err);
      toast.error('Could not send message.');
    } finally {
      setSending(false);
    }
  };

  const goProfile = () => {
    if (!otherUserId) return;
    if (onProfileClick) onProfileClick(otherUserId);
    else navigate(`/profile/${otherUserId}`);
  };

  return (
    <div className="messages-thread">
      <header className="messages-thread__header">
        <button type="button" className="messages-thread__back press" onClick={onBack} aria-label="Back">
          <MdArrowBack size={22} />
        </button>
        <button
          type="button"
          className="messages-thread__avatar-btn press"
          onClick={goProfile}
          aria-label={`View ${otherUserName || 'User'}'s profile`}
        >
          <Avatar name={otherUserName || 'User'} size={48} />
        </button>
        <button
          type="button"
          className="messages-thread__title messages-thread__title-btn"
          onClick={goProfile}
        >
          {otherUserName || 'User'}
        </button>
      </header>
      <div className="messages-thread__list" ref={listRef}>
        {loadingMessages && messages.length === 0 && (
          <p className="messages-thread__empty">Loading messages…</p>
        )}
        {!loadingMessages && messages.length === 0 && (
          <p className="messages-thread__empty">No messages yet.</p>
        )}
        {messages.map((msg) => {
          const isMine = msg.senderId === currentUid;
          return (
            <div
              key={msg.id}
              className={`messages-thread__bubble-wrap ${isMine ? 'messages-thread__bubble-wrap--mine' : ''}`}
            >
              {msg.type === 'text' ? (
                <div className={`messages-thread__bubble ${isMine ? 'messages-thread__bubble--mine' : ''}`}>
                  {msg.text}
                </div>
              ) : (
                <div className={`messages-thread__media ${isMine ? 'messages-thread__media--mine' : ''}`}>
                  <ChatMediaPlayer message={msg} compact />
                </div>
              )}
              <span className="messages-thread__time">{formatMessageTime(msg.createdAt)}</span>
            </div>
          );
        })}
      </div>
      <form className="messages-thread__composer" onSubmit={handleSend}>
        <input
          type="text"
          className="messages-thread__input"
          placeholder="Message…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={2000}
        />
        <button type="submit" className="messages-thread__send press" disabled={!text.trim() || sending} aria-label="Send">
          <MdSend size={20} />
        </button>
      </form>
    </div>
  );
}

function Messages({ onProfileClick }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { conversationId: routeConversationId } = useParams();
  const [threadMeta, setThreadMeta] = useState(null);

  const openConversation = useCallback((convId, otherUserId, otherUserName) => {
    navigate(`/messages/${convId}`, { state: { otherUserId, otherUserName } });
  }, [navigate]);

  useEffect(() => {
    if (!routeConversationId) {
      setThreadMeta(null);
      return;
    }
    const state = location.state;
    if (state?.otherUserId) {
      setThreadMeta({
        conversationId: routeConversationId,
        otherUserId: state.otherUserId,
        otherUserName: state.otherUserName,
      });
      return;
    }
    (async () => {
      const currentUid = auth.currentUser?.uid;
      if (!currentUid) return;
      try {
        const convSnap = await getDoc(doc(db, 'conversations', routeConversationId));
        if (!convSnap.exists()) return;
        const otherId = convSnap.data().participantIds.find((id) => id !== currentUid);
        const userSnap = otherId ? await getDoc(doc(db, 'users', otherId)) : null;
        setThreadMeta({
          conversationId: routeConversationId,
          otherUserId: otherId,
          otherUserName: userSnap?.data()?.displayName || 'User',
        });
      } catch (err) {
        console.error('Error loading conversation:', err);
      }
    })();
  }, [routeConversationId, location.state]);

  if (threadMeta) {
    return (
      <div className="messages">
        <MessageThread
          conversationId={threadMeta.conversationId}
          otherUserId={threadMeta.otherUserId}
          otherUserName={threadMeta.otherUserName}
          onBack={() => navigate('/messages')}
          onProfileClick={onProfileClick}
        />
      </div>
    );
  }

  return (
    <div className="messages">
      <SectionHeader title="Messages" />
      <MessagesInbox onOpenConversation={openConversation} onProfileClick={onProfileClick} />
    </div>
  );
}

export { getOrCreateConversation, conversationIdFor };
export default Messages;
