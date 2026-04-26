import React, { useEffect, useRef, useState } from 'react';
import { SCENE_UNIT_MM } from '../dimensionScaler';
import './SetupDiagram.css';

const BOUNDS_MARGIN = 0.35; // scene units of padding around the device cluster
const LABEL_WIDTH = 140;
const LABEL_HEIGHT = 34;

export default function SetupDiagram({ diagram, onDeviceClick }) {
  const containerRef = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    if (!containerRef.current) return undefined;
    const el = containerRef.current;
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!diagram || !Array.isArray(diagram.devices) || diagram.devices.length === 0) {
    return (
      <div className="setup-diagram-empty" ref={containerRef}>
        <p>No devices placed in this setup yet.</p>
      </div>
    );
  }

  const { bounds } = diagram;
  const boundW = Math.max(0.1, (bounds.maxX - bounds.minX) + BOUNDS_MARGIN * 2);
  const boundH = Math.max(0.1, (bounds.maxZ - bounds.minZ) + BOUNDS_MARGIN * 2);

  const scale = size.w > 0 && size.h > 0
    ? Math.min(size.w / boundW, size.h / boundH)
    : 0;

  const renderedW = boundW * scale;
  const renderedH = boundH * scale;
  const offsetX = (size.w - renderedW) / 2;
  const offsetY = (size.h - renderedH) / 2;

  const project = (worldX, worldZ) => ({
    x: offsetX + (worldX - bounds.minX + BOUNDS_MARGIN) * scale,
    y: offsetY + (worldZ - bounds.minZ + BOUNDS_MARGIN) * scale,
  });

  return (
    <div className="setup-diagram" ref={containerRef}>
      {scale > 0 && diagram.devices.map((d) => {
        const center = project(d.x, d.z);
        const w = (d.widthMm / SCENE_UNIT_MM) * scale;
        const h = (d.depthMm / SCENE_UNIT_MM) * scale;
        const rot = d.rotationDegY || 0;

        return (
          <React.Fragment key={d.uniqueId}>
            <button
              type="button"
              className="setup-diagram-device"
              style={{
                left: center.x - w / 2,
                top: center.y - h / 2,
                width: w,
                height: h,
                transform: `rotate(${rot}deg)`,
              }}
              onClick={() => onDeviceClick && onDeviceClick(d)}
              aria-label={d.name}
              title={d.name}
            >
              {d.imageUrl ? (
                <img src={d.imageUrl} alt="" draggable={false} />
              ) : (
                <span className="setup-diagram-device-fallback">{d.name}</span>
              )}
            </button>
            <div
              className="setup-diagram-label"
              style={{
                left: center.x - LABEL_WIDTH / 2,
                top: center.y + h / 2 + 6,
                width: LABEL_WIDTH,
                height: LABEL_HEIGHT,
              }}
            >
              {d.name}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}
