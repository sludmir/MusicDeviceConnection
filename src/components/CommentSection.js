import React, { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  doc,
  updateDoc,
  increment,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import { FaHeart, FaRegHeart } from 'react-icons/fa';
import { Sheet, Avatar, useToast } from '../ui';
import './CommentSection.css';

function formatRelativeTime(ts) {
  if (!ts?.toDate) return '';
  const d = ts.toDate();
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString();
}

function CommentSectionInner({
  targetType,
  targetId,
  commentCount = 0,
  onCountChange,
  embedded = false,
  active = true,
  onProfileClick,
}) {
  const toast = useToast();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const [likedIds, setLikedIds] = useState(new Set());

  const currentUid = auth.currentUser?.uid;
  const currentName = auth.currentUser?.displayName || 'User';
  const collectionPath = targetType === 'set' ? 'sets' : 'clips';

  const loadComments = useCallback(async () => {
    if (!targetId || !active) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, collectionPath, targetId, 'comments'),
        orderBy('createdAt', 'desc'),
        limit(100)
      );
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setComments(list);
      const liked = new Set();
      if (currentUid) {
        list.forEach((c) => {
          if (c.likedBy?.includes(currentUid)) liked.add(c.id);
        });
      }
      setLikedIds(liked);
    } catch (err) {
      console.error('Error loading comments:', err);
      toast.error('Could not load comments.');
    } finally {
      setLoading(false);
    }
  }, [targetId, active, collectionPath, currentUid, toast]);

  useEffect(() => {
    if (active) loadComments();
    else {
      setComments([]);
      setText('');
    }
  }, [active, loadComments]);

  const handlePost = async (e) => {
    e.preventDefault();
    if (!currentUid) {
      toast.error('Sign in to comment.');
      return;
    }
    const trimmed = text.trim();
    if (!trimmed || !targetId) return;
    setPosting(true);
    try {
      const commentsRef = collection(db, collectionPath, targetId, 'comments');
      const commentRef = doc(commentsRef);
      const targetRef = doc(db, collectionPath, targetId);
      const batch = writeBatch(db);
      batch.set(commentRef, {
        authorId: currentUid,
        authorName: currentName,
        text: trimmed.slice(0, 500),
        createdAt: serverTimestamp(),
        likes: 0,
        likedBy: [],
      });
      batch.update(targetRef, { commentCount: increment(1) });
      await batch.commit();
      onCountChange?.(commentCount + 1);
      setText('');
      await loadComments();
    } catch (err) {
      console.error('Error posting comment:', err);
      const code = err?.code || '';
      if (code === 'permission-denied') {
        toast.error('Comments are not enabled yet — Firestore rules may need deploying.');
      } else {
        toast.error('Could not post comment.');
      }
    } finally {
      setPosting(false);
    }
  };

  const handleLikeComment = async (comment) => {
    if (!currentUid) return;
    const isLiked = likedIds.has(comment.id);
    const commentRef = doc(db, collectionPath, targetId, 'comments', comment.id);
    const nextLiked = new Set(likedIds);
    if (isLiked) nextLiked.delete(comment.id);
    else nextLiked.add(comment.id);
    setLikedIds(nextLiked);
    setComments((prev) => prev.map((c) => {
      if (c.id !== comment.id) return c;
      const likes = Math.max(0, (c.likes || 0) + (isLiked ? -1 : 1));
      const likedBy = isLiked
        ? (c.likedBy || []).filter((id) => id !== currentUid)
        : [...(c.likedBy || []), currentUid];
      return { ...c, likes, likedBy };
    }));
    try {
      await updateDoc(commentRef, isLiked
        ? { likes: increment(-1), likedBy: arrayRemove(currentUid) }
        : { likes: increment(1), likedBy: arrayUnion(currentUid) });
    } catch (err) {
      console.error('Error liking comment:', err);
      await loadComments();
    }
  };

  return (
    <div className={`comment-section ${embedded ? 'comment-section--embedded' : ''}`}>
      {embedded && (
        <header className="comment-section__header">
          <span className="comment-section__header-title">Comments</span>
          {commentCount > 0 && (
            <span className="comment-section__header-count">{commentCount}</span>
          )}
        </header>
      )}
      <div className="comment-section__list">
        {loading ? (
          <div className="comment-section__empty">Loading…</div>
        ) : comments.length === 0 ? (
          <div className="comment-section__empty">No comments yet. Be the first.</div>
        ) : (
          comments.map((comment) => (
            <article key={comment.id} className="comment-section__item">
              <button
                type="button"
                className="comment-section__avatar-btn press"
                onClick={() => comment.authorId && onProfileClick?.(comment.authorId)}
                disabled={!comment.authorId || !onProfileClick}
                aria-label={`View ${comment.authorName || 'User'}'s profile`}
              >
                <Avatar name={comment.authorName || 'User'} size={embedded ? 48 : 32} />
              </button>
              <div className="comment-section__body">
                <div className="comment-section__meta">
                  <button
                    type="button"
                    className="comment-section__author comment-section__author-btn"
                    onClick={() => comment.authorId && onProfileClick?.(comment.authorId)}
                    disabled={!comment.authorId || !onProfileClick}
                  >
                    {comment.authorName || 'User'}
                  </button>
                  <span className="comment-section__time">{formatRelativeTime(comment.createdAt)}</span>
                </div>
                <p className="comment-section__text">{comment.text}</p>
              </div>
              <button
                type="button"
                className={`comment-section__like ${likedIds.has(comment.id) ? 'comment-section__like--active' : ''}`}
                onClick={() => handleLikeComment(comment)}
                aria-label={likedIds.has(comment.id) ? 'Unlike comment' : 'Like comment'}
                disabled={!currentUid}
              >
                {likedIds.has(comment.id) ? <FaHeart size={14} /> : <FaRegHeart size={14} />}
                {(comment.likes || 0) > 0 && <span>{comment.likes}</span>}
              </button>
            </article>
          ))
        )}
      </div>
      <form className="comment-section__composer" onSubmit={handlePost}>
        <input
          type="text"
          className="comment-section__input"
          placeholder={currentUid ? 'Add a comment…' : 'Sign in to comment'}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          disabled={!currentUid || posting}
        />
        <button
          type="submit"
          className="comment-section__post"
          disabled={!currentUid || posting || !text.trim()}
        >
          Post
        </button>
      </form>
    </div>
  );
}

function CommentSection({
  open,
  onClose,
  targetType,
  targetId,
  commentCount = 0,
  onCountChange,
  variant = 'sheet',
  onProfileClick,
}) {
  const title = targetType === 'set' ? 'Set comments' : 'Clip comments';
  const embedded = variant === 'embedded';

  if (embedded) {
    if (!open || !targetId) return null;
    return (
      <CommentSectionInner
        targetType={targetType}
        targetId={targetId}
        commentCount={commentCount}
        onCountChange={onCountChange}
        embedded
        active={open}
        onProfileClick={onProfileClick}
      />
    );
  }

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <CommentSectionInner
        targetType={targetType}
        targetId={targetId}
        commentCount={commentCount}
        onCountChange={onCountChange}
        active={open}
        onProfileClick={onProfileClick}
      />
    </Sheet>
  );
}

export default CommentSection;
