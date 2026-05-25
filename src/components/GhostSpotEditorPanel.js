import React, { useState, useEffect, useCallback } from 'react';
import './GhostSpotEditorPanel.css';
import { SUGGESTION_OPTIONS } from '../utils/ghostSpotLayout';

const POS_STEP = 0.05;
const SIZE_STEP = 0.05;

export default function GhostSpotEditorPanel({ mode, spot, onChange, onSave, onCancel }) {
  const [draft, setDraft] = useState(spot);

  useEffect(() => { setDraft(spot); }, [spot]);

  const update = useCallback((patch) => {
    setDraft((prev) => {
      const next = { ...prev, ...patch };
      onChange(next);
      return next;
    });
  }, [onChange]);

  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

  const axisRow = (label, key) => (
    <div className="gsep-row" key={key}>
      <label className="gsep-axis-label" htmlFor={`gsep-${key}`}>{label}</label>
      <button type="button" className="gsep-nudge" onClick={() => update({ [key]: Math.round((num(draft[key]) - POS_STEP) * 1000) / 1000 })}>−</button>
      <input
        id={`gsep-${key}`}
        aria-label={label}
        type="number"
        step={POS_STEP}
        value={draft[key]}
        onChange={(e) => update({ [key]: num(e.target.value) })}
      />
      <button type="button" className="gsep-nudge" onClick={() => update({ [key]: Math.round((num(draft[key]) + POS_STEP) * 1000) / 1000 })}>+</button>
    </div>
  );

  const sizeRow = (label, dim) => (
    <div className="gsep-row" key={dim}>
      <label className="gsep-axis-label" htmlFor={`gsep-size-${dim}`}>{label}</label>
      <button type="button" className="gsep-nudge" onClick={() => update({ size: { ...draft.size, [dim]: Math.max(0.05, Math.round((num(draft.size?.[dim]) - SIZE_STEP) * 1000) / 1000) } })}>−</button>
      <input
        id={`gsep-size-${dim}`}
        aria-label={label}
        type="number"
        step={SIZE_STEP}
        min="0.05"
        value={draft.size?.[dim] ?? 0.3}
        onChange={(e) => update({ size: { ...draft.size, [dim]: num(e.target.value) } })}
      />
      <button type="button" className="gsep-nudge" onClick={() => update({ size: { ...draft.size, [dim]: Math.round((num(draft.size?.[dim]) + SIZE_STEP) * 1000) / 1000 } })}>+</button>
    </div>
  );

  return (
    <div className="gsep-panel" onClick={(e) => e.stopPropagation()}>
      <div className="gsep-title">{mode === 'add' ? 'Add ghost spot' : 'Move ghost spot'}</div>

      {mode === 'add' && (
        <div className="gsep-row gsep-select-row">
          <label className="gsep-axis-label" htmlFor="gsep-type">Suggested type</label>
          <select
            id="gsep-type"
            aria-label="Suggested type"
            value={draft.recommendedType}
            onChange={(e) => update({ recommendedType: e.target.value })}
          >
            {SUGGESTION_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      )}

      <div className="gsep-section">Position</div>
      {axisRow('X', 'x')}
      {axisRow('Y', 'y')}
      {axisRow('Z', 'z')}

      <div className="gsep-section">Rotation (Y, radians)</div>
      {axisRow('Rotation', 'rotationY')}

      <div className="gsep-section">Size</div>
      {sizeRow('Width', 'width')}
      {sizeRow('Depth', 'depth')}

      <div className="gsep-actions">
        <button type="button" className="gsep-btn gsep-cancel" onClick={onCancel}>Cancel</button>
        <button type="button" className="gsep-btn gsep-save" onClick={() => onSave(draft)}>Save</button>
      </div>
    </div>
  );
}
