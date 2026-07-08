import React, { useState, useCallback } from 'react';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import { MdSearch } from 'react-icons/md';
import { Avatar, Button, Input, SectionHeader } from '../ui';
import './UserSearch.css';

function UserSearch({ onProfileClick }) {
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
      const start = term;
      const end = term + '';
      const q = query(
        collection(db, 'users'),
        where('displayName', '>=', start),
        where('displayName', '<=', end),
        orderBy('displayName'),
        limit(30)
      );
      const snapshot = await getDocs(q);
      const list = [];
      const currentUid = auth.currentUser?.uid;
      snapshot.forEach((d) => {
        const uid = d.id;
        if (uid !== currentUid) list.push({ id: uid, ...d.data() });
      });
      setResults(list);
    } catch (err) {
      console.error('Error searching users:', err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [searchTerm]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') searchUsers();
  };

  return (
    <div className="search-page">
      <div className="search-page__inner">
        <SectionHeader eyebrow="DISCOVER" title="Search" />

        <div className="search-page__input-row">
          <div className="search-page__input">
            <MdSearch size={18} className="search-page__input-icon" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search users by display name…"
              autoFocus
              aria-label="Search users"
            />
          </div>
          <Button onClick={searchUsers} loading={loading}>Search</Button>
        </div>

        {loading ? (
          <div className="search-page__loading">Searching…</div>
        ) : searched && results.length === 0 ? (
          <div className="search-page__empty">
            {searchTerm.trim() ? 'No users match that name.' : 'Enter a name to search.'}
          </div>
        ) : (
          <ul className="search-page__list">
            {results.map((user) => (
              <li key={user.id}>
                <button
                  type="button"
                  className="search-result"
                  onClick={() => onProfileClick && onProfileClick(user.id)}
                >
                  <Avatar name={user.displayName || user.id} size={48} />
                  <div className="search-result__meta">
                    <span className="search-result__name">{user.displayName || user.id.slice(0, 12)}</span>
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
