import React, { useMemo, useState } from 'react';
import SetupDiagram from './SetupDiagram';
import { buildMobileDiagram } from '../utils/buildMobileDiagram';
import './ConnectionGuideButton.css';

export default function ConnectionGuideButton({ currentDevices, setupType }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const diagram = useMemo(
    () => (open ? buildMobileDiagram(currentDevices, setupType) : null),
    [open, currentDevices, setupType]
  );

  const close = () => {
    setOpen(false);
    setSelected(null);
  };

  return (
    <>
      <button
        type="button"
        className="connection-guide-btn"
        onClick={() => setOpen(true)}
        title="View top-down layout of this setup"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <line x1="3" y1="10" x2="21" y2="10" />
          <line x1="9" y1="10" x2="9" y2="20" />
          <line x1="15" y1="10" x2="15" y2="20" />
        </svg>
        <span className="builder-ctl-label">Connection Guide</span>
      </button>

      {open && (
        <div className="connection-guide-overlay" onClick={close}>
          <div className="connection-guide-modal" onClick={(e) => e.stopPropagation()}>
            <div className="connection-guide-header">
              <div>
                <h2 className="connection-guide-title">Connection Guide</h2>
                <p className="connection-guide-subtitle">
                  Top-down layout {diagram && diagram.devices.length > 0
                    ? `\u00B7 ${diagram.devices.length} device${diagram.devices.length === 1 ? '' : 's'}`
                    : ''}
                </p>
              </div>
              <button
                type="button"
                className="connection-guide-close"
                onClick={close}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="connection-guide-canvas">
              <SetupDiagram diagram={diagram} onDeviceClick={setSelected} />
            </div>

            {selected && (
              <div className="connection-guide-detail">
                {selected.imageUrl && (
                  <img
                    className="connection-guide-detail-img"
                    src={selected.imageUrl}
                    alt=""
                  />
                )}
                <div className="connection-guide-detail-text">
                  <div className="connection-guide-detail-name">{selected.name}</div>
                  {selected.brand && (
                    <div className="connection-guide-detail-brand">{selected.brand}</div>
                  )}
                  <div className="connection-guide-detail-meta">
                    {[selected.category, selected.subcategory].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <button
                  type="button"
                  className="connection-guide-detail-close"
                  onClick={() => setSelected(null)}
                  aria-label="Clear selection"
                >
                  ×
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
