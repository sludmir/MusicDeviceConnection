import React from 'react';
import './DeviceHoverMenu.css';

export default function DeviceHoverMenu({ device, screenPosition, onRemove, onSwap, onClose, onBuy }) {
  if (!device) return null;
  const left = (screenPosition?.x ?? 0);
  const top = (screenPosition?.y ?? 0);

  return (
    <div
      className="dhm-anchor"
      style={{ left, top }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="dhm-bubble">
        <div className="dhm-label">{device.name}</div>
        <div className="dhm-actions">
          {onBuy && (
            <button
              className="dhm-btn dhm-buy"
              aria-label="Buy product"
              title="Buy"
              onClick={() => onBuy(device)}
            >
              🛒
            </button>
          )}
          <button
            className="dhm-btn dhm-swap"
            aria-label="Swap product"
            title="Swap"
            onClick={() => onSwap(device)}
          >
            ⟳
          </button>
          <button
            className="dhm-btn dhm-remove"
            aria-label="Remove device"
            title="Remove"
            onClick={() => onRemove(device)}
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}
