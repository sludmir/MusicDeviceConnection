import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, orderBy, limit, doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import { Avatar, EmptyState, SectionHeader } from '../ui';
import './Notifications.css';

function formatRelativeTime(ts) {
  if (!ts?.toDate) return '';
  const d = ts.toDate();
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString();
}

function bucketOf(ts) {
  if (!ts?.toDate) return 'EARLIER';
  const d = ts.toDate();
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (d >= startOfToday) return 'TODAY';
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  if (d >= startOfYesterday) return 'YESTERDAY';
  return 'EARLIER';
}

function Notifications({ onBack, onProfileClick }) {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser?.uid) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const q = query(
          collection(db, 'users', auth.currentUser.uid, 'notifications'),
          orderBy('createdAt', 'desc'),
          limit(50)
        );
        const snap = await getDocs(q);
        if (!cancelled) {
          setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        }
      } catch (err) {
        console.error('Error loading notifications:', err);
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const grouped = useMemo(() => {
    const groups = { TODAY: [], YESTERDAY: [], EARLIER: [] };
    for (const item of items) {
      groups[bucketOf(item.createdAt)].push(item);
    }
    return groups;
  }, [items]);

  const markAllRead = async () => {
    if (!auth.currentUser?.uid) return;
    const unread = items.filter((i) => !i.read);
    if (unread.length === 0) return;
    try {
      await Promise.all(unread.map((i) =>
        updateDoc(doc(db, 'users', auth.currentUser.uid, 'notifications', i.id), { read: true })
      ));
      setItems((prev) => prev.map((i) => ({ ...i, read: true })));
    } catch (err) {
      console.error('Error marking all read:', err);
    }
  };

  const handleClick = async (item) => {
    if (!item.read && auth.currentUser?.uid) {
      try {
        await updateDoc(doc(db, 'users', auth.currentUser.uid, 'notifications', item.id), { read: true });
        setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, read: true } : i));
      } catch { /* ignore */ }
    }
    if (item.type === 'message' && item.conversationId) {
      navigate(`/messages/${item.conversationId}`, {
        state: {
          otherUserId: item.fromUserId,
          otherUserName: item.fromUserName,
        },
      });
      return;
    }
    if (item.fromUserId && onProfileClick) onProfileClick(item.fromUserId);
  };

  const renderItem = (item) => {
    const name = item.fromUserName || 'Someone';
    let body;
    if (item.type === 'follow') {
      body = <><strong>{name}</strong> started following you.</>;
    } else if (item.type === 'like') {
      body = <><strong>{name}</strong> liked your clip.</>;
    } else if (item.type === 'message') {
      body = (
        <>
          <strong>{name}</strong> sent you a message
          {item.preview ? <> — {item.preview}</> : '.'}
        </>
      );
    } else {
      body = <><strong>{name}</strong> — {item.type}</>;
    }
    return (
      <li key={item.id} className={`notif ${item.read ? 'notif--read' : ''}`}>
        <button type="button" className="notif__btn" onClick={() => handleClick(item)}>
          <Avatar name={name} size={32} />
          <div className="notif__body">{body}</div>
          <span className="notif__time mono-label">{formatRelativeTime(item.createdAt)}</span>
        </button>
      </li>
    );
  };

  const hasUnread = items.some((i) => !i.read);

  return (
    <div className="notifications">
      <div className="notifications__inner">
        <SectionHeader
          eyebrow="ACTIVITY"
          title="Notifications"
          action={hasUnread && (
            <button type="button" className="notifications__mark-all" onClick={markAllRead}>
              Mark all read
            </button>
          )}
        />

        {loading ? (
          <div className="notifications__loading">Loading…</div>
        ) : items.length === 0 ? (
          <EmptyState
            eyebrow="EMPTY"
            title="Nothing yet"
            body="When someone follows you, likes your clips, or sends you a message, you'll see it here."
          />
        ) : (
          <div className="notifications__groups">
            {['TODAY', 'YESTERDAY', 'EARLIER'].map((bucket) => (
              grouped[bucket].length > 0 && (
                <section key={bucket} className="notifications__group">
                  <h3 className="mono-label notifications__group-title">{bucket}</h3>
                  <ul className="notifications__list">
                    {grouped[bucket].map(renderItem)}
                  </ul>
                </section>
              )
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Notifications;
