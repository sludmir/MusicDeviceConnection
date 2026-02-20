import React, { useState, useCallback } from 'react';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import './UserSearch.css';

function UserSearch({ onBack, onProfileClick }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const searchUsers = useCallback(async () => {
    const term = (searchTerm || '').trim().toLowerCase();
    if (!term.length) {
      setResults([]);
      setSearched(true);
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const usersRef = collection(db, 'users');
      // Prefix search on displayName (case-insensitive would need lowercase field or client filter)
      const start = term;
      const end = term + '\uf8ff';
      const q = query(
        usersRef,
        where('displayName', '>=', start),
        where('displayName', '<=', end),
        orderBy('displayName'),
        limit(30)
      );
      const snapshot = await getDocs(q);
      const list = [];
      const currentUid = auth.currentUser?.uid;
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const uid = docSnap.id;
        if (uid !== currentUid) {
          list.push({ id: uid, ...data });
        }
      });
      setResults(list);
    } catch (error) {
      console.error('Error searching users:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [searchTerm]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') searchUsers();
  };

  const handleSelectUser = (userId) => {
    if (onProfileClick) onProfileClick(userId);
  };

  return (
    <div className="user-search-container">
      <div className="user-search-header">
        {onBack && (
          <button type="button" className="user-search-back" onClick={onBack}>
            ← Back
          </button>
        )}
        <h1>Search users</h1>
      </div>
      <div className="user-search-input-wrap">
        <input
          type="text"
          className="user-search-input"
          placeholder="Search by display name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
        />
        <button type="button" className="user-search-btn" onClick={searchUsers} disabled={loading}>
          {loading ? 'Searching…' : 'Search'}
        </button>
      </div>
      <div className="user-search-results">
        {loading && <div className="user-search-loading">Loading…</div>}
        {!loading && searched && results.length === 0 && (
          <div className="user-search-empty">
            {searchTerm.trim() ? 'No users match that name.' : 'Enter a name to search.'}
          </div>
        )}
        {!loading && results.length > 0 && (
          <ul className="user-search-list">
            {results.map((user) => (
              <li key={user.id} className="user-search-item">
                <button
                  type="button"
                  className="user-search-item-btn"
                  onClick={() => handleSelectUser(user.id)}
                >
                  <div className="user-search-avatar">
                    {(user.displayName || user.id)?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="user-search-info">
                    <span className="user-search-name">{user.displayName || user.id.slice(0, 12)}</span>
                    {user.email && (
                      <span className="user-search-email">{user.email}</span>
                    )}
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

export default UserSearch;
