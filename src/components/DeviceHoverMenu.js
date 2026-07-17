import React from 'react';
import './DeviceHoverMenu.css';

export default function DeviceHoverMenu({
  device,
  screenPosition,
  onRemove,
  onSwap,
  onClose,
  onBuy,
  buyMonetized = null,
  buyTitle = 'Buy',
}) {
  if (!device) return null;
  const left = (screenPosition?.x ?? 0);
  const top = (screenPosition?.y ?? 0);

  const buyClass = buyMonetized === true
    ? 'dhm-btn dhm-buy dhm-buy--monetized'
    : buyMonetized === false
      ? 'dhm-btn dhm-buy dhm-buy--non-monetized'
      : 'dhm-btn dhm-buy';

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
              className={buyClass}
              aria-label={buyTitle || 'Buy product'}
              title={buyTitle || 'Buy'}
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
