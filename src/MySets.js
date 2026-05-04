import React, { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, query, where, doc, deleteDoc } from 'firebase/firestore';
import { db, auth } from './firebaseConfig';
import { MdMoreVert, MdDelete, MdAdd } from 'react-icons/md';
import { Card, Chip, SectionHeader, EmptyState, useToast } from './ui';
import './MySets.css';

const FILTERS = ['All', 'DJ', 'Producer', 'Musician'];

function formatTimestamp(ts) {
  if (!ts?.toDate) return '';
  const d = ts.toDate();
  const now = new Date();
  const diff = now - d;
  if (diff < 86400000) return 'Today';
  if (diff < 172800000) return 'Yesterday';
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return d.toLocaleDateString();
}

function MySets({ onSelectSetup, onNewSetup }) {
  const toast = useToast();
  const [savedSetups, setSavedSetups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [openMenuId, setOpenMenuId] = useState(null);

  useEffect(() => {
    if (!auth.currentUser) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const setupsRef = collection(db, 'setups');
        const q = query(setupsRef, where('ownerId', '==', auth.currentUser.uid));
        const snapshot = await getDocs(q);
        const list = [];
        snapshot.forEach((d) => list.push({ id: d.id, ...d.data() }));
        list.sort((a, b) => {
          const at = a.createdAt?.toDate?.()?.getTime() ?? 0;
          const bt = b.createdAt?.toDate?.()?.getTime() ?? 0;
          return bt - at;
        });
        if (!cancelled) setSavedSetups(list);
      } catch (err) {
        console.error('Error loading setups:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (!e.target.closest('.mysets-card__menu-wrap')) setOpenMenuId(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = useMemo(() => {
    if (filter === 'All') return savedSetups;
    return savedSetups.filter((s) => (s.setupType || 'DJ') === filter);
  }, [savedSetups, filter]);

  const handleDelete = async (setup) => {
    if (!auth.currentUser || setup.ownerId !== auth.currentUser.uid) return;
    if (!window.confirm(`Delete "${setup.name || 'Untitled Setup'}"? This can't be undone.`)) return;
    try {
      await deleteDoc(doc(db, 'setups', setup.id));
      setSavedSetups((prev) => prev.filter((s) => s.id !== setup.id));
      toast.success('Setup deleted.');
    } catch (err) {
      console.error('Error deleting setup:', err);
      toast.error('Failed to delete setup.');
    }
    setOpenMenuId(null);
  };

  return (
    <div className="mysets">
      <div className="mysets__inner">
        <SectionHeader
          eyebrow="LIBRARY"
          title="My sets"
          action={
            <button
              type="button"
              className="mysets__new-link"
              onClick={() => onNewSetup && onNewSetup('DJ')}
            >
              <MdAdd size={16} /> New setup
            </button>
          }
        />

        <div className="mysets__filters" role="tablist" aria-label="Filter setups">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={filter === f}
              className={`mysets__filter mono-label ${filter === f ? 'mysets__filter--active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="mysets__loading">Loading…</div>
        ) : savedSetups.length === 0 ? (
          <EmptyState
            eyebrow="EMPTY"
            title="No setups yet"
            body="Build your first virtual rig from the Hub or pick a setup type to begin."
            action={
              <button
                type="button"
                className="mysets__cta"
                onClick={() => onNewSetup && onNewSetup('DJ')}
              >
                Start building
              </button>
            }
          />
        ) : filtered.length === 0 ? (
          <p className="mysets__empty-filter">No {filter} setups yet.</p>
        ) : (
          <div className="mysets__grid">
            {filtered.map((setup) => (
              <Card
                key={setup.id}
                padding="md"
                className="mysets-card"
                onClick={() => onSelectSetup && onSelectSetup(setup)}
              >
                <div className="mysets-card__top">
                  <Chip>{(setup.setupType || 'DJ').toUpperCase()}</Chip>
                  <div className="mysets-card__menu-wrap" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="mysets-card__kebab"
                      aria-label="Setup actions"
                      onClick={() => setOpenMenuId(openMenuId === setup.id ? null : setup.id)}
                    >
                      <MdMoreVert size={18} />
                    </button>
                    {openMenuId === setup.id && (
                      <div className="mysets-card__menu">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleDelete(setup); }}
                        >
                          <MdDelete size={14} /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <h4 className="mysets-card__name">{setup.name || 'Untitled Setup'}</h4>
                <div className="mysets-card__bottom mono-label">
                  {(setup.devices?.length || 0)} DEVICES · {formatTimestamp(setup.updatedAt || setup.createdAt)}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default MySets;
