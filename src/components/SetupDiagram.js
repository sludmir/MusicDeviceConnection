import React, { useEffect, useRef, useState, useMemo } from 'react';
import { SCENE_UNIT_MM } from '../dimensionScaler';
import { inferConnections } from '../utils/inferConnections';
import './SetupDiagram.css';

const BOUNDS_MARGIN = 0.35; // scene units of padding around the device cluster
const LABEL_WIDTH = 140;
const LABEL_HEIGHT = 34;

export default function SetupDiagram({ diagram, fallbackDevices, onDeviceClick }) {
  const containerRef = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  const enriched = useMemo(() => {
    if (!diagram) return null;
    if (Array.isArray(diagram.connections) && diagram.connections.length > 0) return diagram;
    if (Array.isArray(fallbackDevices) && fallbackDevices.length > 0) {
      return {
        ...diagram,
        connections: inferConnections(fallbackDevices, diagram.setupType || 'DJ'),
      };
    }
    return { ...diagram, connections: [] };
  }, [diagram, fallbackDevices]);

  useEffect(() => {
    if (!containerRef.current) return undefined;
    const el = containerRef.current;
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!enriched || !Array.isArray(enriched.devices) || enriched.devices.length === 0) {
    return (
      <div className="setup-diagram-empty" ref={containerRef}>
        <p>No devices placed in this setup yet.</p>
      </div>
    );
  }

  const { bounds } = enriched;
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

  const deviceById = new Map(enriched.devices.map((d) => [d.uniqueId, d]));

  return (
    <div className="setup-diagram" ref={containerRef}>
      {scale > 0 && (
        <svg className="setup-diagram-cables" aria-hidden="true">
          {(enriched.connections || []).map((conn, idx) => {
            const from = deviceById.get(conn.fromUniqueId);
            const to = deviceById.get(conn.toUniqueId);
            if (!from || !to) return null;
            const p1 = project(from.x, from.z);
            const p2 = project(to.x, to.z);
            return (
              <line
                key={`${conn.fromUniqueId}-${conn.toUniqueId}-${idx}`}
                x1={p1.x}
                y1={p1.y}
                x2={p2.x}
                y2={p2.y}
                stroke={conn.cableColor || '#ef4444'}
                strokeWidth={2.5}
                strokeLinecap="round"
                opacity={0.9}
              />
            );
          })}
        </svg>
      )}
      {scale > 0 && enriched.devices.map((d) => {
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
