import React, { useState } from 'react';
import { getVariantsForSetup, getVariantLabel } from '../utils/sceneVariants';
import './SceneVariantSwitcher.css';

export default function SceneVariantSwitcher({ setupType, value, onChange }) {
  const variants = getVariantsForSetup(setupType);
  const [open, setOpen] = useState(false);
  if (!variants.length) return null;

  const currentLabel = getVariantLabel(value) || variants[0].label;

  return (
    <div className={`svs-root ${open ? 'is-open' : ''}`}>
      {open && (
        <ul className="svs-menu">
          {variants.map((v) => (
            <li
              key={v.key}
              className={`svs-item ${v.key === value ? 'is-active' : ''}`}
              onClick={() => { onChange(v.key); setOpen(false); }}
            >
              {v.label}
            </li>
          ))}
        </ul>
      )}
      <button className="svs-trigger" onClick={() => setOpen((s) => !s)}>
        <span>Scene: {currentLabel}</span>
        <span className="svs-caret">▴</span>
      </button>
    </div>
  );
}
