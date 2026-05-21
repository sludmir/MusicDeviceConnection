import React, { useMemo, useState } from 'react';
import { filterByRecommendedType, sortProductsByRecommendation } from '../utils/productRecommendation';
import './ProductSelectorModal.css';

export default function ProductSelectorModal({
  isOpen,
  mode = 'place',          // 'place' | 'swap'
  recommendedType,
  currentProductId,
  products = [],
  onSelect,
  onClose,
}) {
  const [showAll, setShowAll] = useState(false);
  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    const base = showAll
      ? sortProductsByRecommendation(products, recommendedType)
      : filterByRecommendedType(products, recommendedType);
    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base.filter((p) => (p.name || '').toLowerCase().includes(q));
  }, [products, recommendedType, showAll, query]);

  if (!isOpen) return null;

  const title = (() => {
    if (!recommendedType || recommendedType === 'Any Device') return 'Choose a Product';
    return `Choose ${recommendedType.startsWith('Effects') ? 'an' : 'a'} ${recommendedType}`;
  })();

  return (
    <div className="psm-overlay" onClick={onClose}>
      <div className="psm-modal" onClick={(e) => e.stopPropagation()}>
        <header className="psm-header">
          <h2>{title}</h2>
          <button className="psm-close" onClick={onClose} aria-label="Close">×</button>
        </header>

        <div className="psm-controls">
          <input
            className="psm-search"
            placeholder="Search products…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <label className="psm-show-all">
            <input
              type="checkbox"
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
            />
            Show all products
          </label>
        </div>

        <ul className="psm-grid">
          {visible.map((product) => {
            const isCurrent = mode === 'swap' && product.id === currentProductId;
            return (
              <li
                key={product.id}
                className={`psm-card${isCurrent ? ' is-current' : ''}`}
                onClick={() => (isCurrent ? onClose() : onSelect(product))}
              >
                {product.imageUrl && (
                  <img src={product.imageUrl} alt={product.name} className="psm-thumb" />
                )}
                <div className="psm-name">{product.name}</div>
                {isCurrent && <span className="psm-badge">Current</span>}
              </li>
            );
          })}
          {visible.length === 0 && <li className="psm-empty">No matching products.</li>}
        </ul>
      </div>
    </div>
  );
}
