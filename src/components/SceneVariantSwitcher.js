import React, { useState } from 'react';
import { MdLandscape } from 'react-icons/md';
import { listSettings, getSetting } from '../data/settings';
import './SceneVariantSwitcher.css';

// Bottom-center upward dropdown for switching the scene environment (setting)
// while building. Reads available settings for the current setup type from the
// settings registry. Hidden when a setup type only has one setting.
export default function SceneVariantSwitcher({ setupType, value, onChange }) {
  const settings = listSettings(setupType);
  const [open, setOpen] = useState(false);
  if (settings.length <= 1) return null;

  const current = getSetting(setupType, value);
  const currentLabel = (current && current.label) || settings[0].label;

  return (
    <div className={`svs-root ${open ? 'is-open' : ''}`}>
      {open && (
        <ul className="svs-menu">
          {settings.map((s) => (
            <li
              key={s.key}
              className={`svs-item ${s.key === value ? 'is-active' : ''}`}
              onClick={() => { onChange(s.key); setOpen(false); }}
            >
              {s.label}
            </li>
          ))}
        </ul>
      )}
      <button className="svs-trigger" onClick={() => setOpen((s) => !s)}>
        <MdLandscape className="svs-icon" size={22} aria-hidden="true" />
        <span className="builder-ctl-label">Scene: {currentLabel}</span>
        <span className="svs-caret">▴</span>
      </button>
    </div>
  );
}
