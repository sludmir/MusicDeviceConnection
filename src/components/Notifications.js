import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, limit, doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import './Notifications.css';

function Notifications({ onBack, onProfileClick }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser?.uid) return;
    const load = async () => {
      setLoading(true);
      try {
        const ref = collection(db, 'users', auth.currentUser.uid, 'notifications');
        const q = query(ref, orderBy('createdAt', 'desc'), limit(50));
        const snapshot = await getDocs(q);
        const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setItems(list);
      } catch (error) {
        console.error('Error loading notifications:', error);
        setItems([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const markAsRead = async (notificationId) => {
    if (!auth.currentUser?.uid) return;
    try {
      const notifRef = doc(db, 'users', auth.currentUser.uid, 'notifications', notificationId);
      await updateDoc(notifRef, { read: true });
      setItems((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
      );
    } catch (error) {
      console.error('Error marking notification read:', error);
    }
  };

  const handleClick = (item) => {
    if (!item.read) markAsRead(item.id);
    if (item.type === 'follow' && item.fromUserId && onProfileClick) {
      onProfileClick(item.fromUserId);
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp?.toDate) return '';
    const d = timestamp.toDate();
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
  };

  return (
    <div className="notifications-container">
      <div className="notifications-header">
        {onBack && (
          <button type="button" className="notifications-back" onClick={onBack}>
            ← Back
          </button>
        )}
        <h1>Notifications</h1>
      </div>
      <div className="notifications-list-wrap">
        {loading && (
          <div className="notifications-loading">Loading…</div>
        )}
        {!loading && items.length === 0 && (
          <div className="notifications-empty">
            No notifications yet. When someone follows you or likes your clips, you’ll see it here.
          </div>
        )}
        {!loading && items.length > 0 && (
          <ul className="notifications-list">
            {items.map((item) => (
              <li key={item.id} className={`notifications-item ${item.read ? 'read' : ''}`}>
                <button
                  type="button"
                  className="notifications-item-btn"
                  onClick={() => handleClick(item)}
                >
                  <div className="notifications-avatar">
                    {(item.fromUserName || item.fromUserId || '?')[0].toUpperCase()}
                  </div>
                  <div className="notifications-body">
                    {item.type === 'follow' && (
                      <span>
                        <strong>{item.fromUserName || 'Someone'}</strong> started following you.
                      </span>
                    )}
                    {item.type === 'like' && (
                      <span>
                        <strong>{item.fromUserName || 'Someone'}</strong> liked your clip.
                      </span>
                    )}
                    {!['follow', 'like'].includes(item.type) && (
                      <span>{item.fromUserName || 'Someone'} — {item.type}</span>
                    )}
                    <span className="notifications-time">{formatTime(item.createdAt)}</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default Notifications;
