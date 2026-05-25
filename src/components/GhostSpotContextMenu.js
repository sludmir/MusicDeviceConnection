import React from 'react';
import './GhostSpotContextMenu.css';

export default function GhostSpotContextMenu({
  screenPosition,
  recommendedType,
  onMove,
  onAdd,
  onRemove,
  onClose,
}) {
  if (!screenPosition) return null;
  const left = screenPosition.x ?? 0;
  const top = screenPosition.y ?? 0;

  return (
    <div
      className="gscm-anchor"
      style={{ left, top }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="gscm-bubble">
        <div className="gscm-label">{recommendedType || 'Ghost spot'}</div>
        <button className="gscm-btn" onClick={onMove}>Move</button>
        <button className="gscm-btn" onClick={onAdd}>Add adjacent</button>
        <button className="gscm-btn gscm-danger" onClick={onRemove}>Remove</button>
      </div>
    </div>
  );
}
