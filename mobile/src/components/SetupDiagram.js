import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  ScrollView,
  Animated,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import {
  isMixer,
  isDeck,
  isFxUnit,
  isSpeaker,
  isAudioInterface,
  isLaptop,
  inferConnections,
} from '../utils/inferConnections';
import { colors, radius, spacing } from '../theme';

// ---------- layout constants ----------
const CARD_W = 130;
const CARD_H_COLLAPSED = 96;
const CARD_H_EXPANDED = 240;
const CARD_GAP_X = 14;
const LANE_GAP_Y = 88; // vertical gap between lanes (room for cable + port pills)
const LANE_HEADER_H = 22;
const CANVAS_PADDING = 20;

// ---------- role → lane assignment ----------

function assignLane(d, setupType) {
  if (setupType === 'DJ') {
    if (isDeck(d)) return 0;
    if (isMixer(d)) return 1;
    if (isFxUnit(d)) return 2;
    if (isSpeaker(d)) return 3;
    return 4;
  }
  if (setupType === 'Producer') {
    if (isSpeaker(d)) return 2;
    if (isAudioInterface(d) || isLaptop(d)) return 1;
    return 0;
  }
  if (setupType === 'Musician') {
    if (isSpeaker(d)) return 3;
    const sub = (d.subcategory || '').toLowerCase();
    const t = (d.type || '').toLowerCase();
    if (sub.includes('amp') || t.includes('amp')) return 2;
    if (sub.includes('effect') || sub.includes('pedal')) return 1;
    return 0;
  }
  return 0;
}

const LANE_LABELS = {
  DJ: ['Decks', 'Mixer', 'FX', 'Speakers', 'Other'],
  Producer: ['Sources', 'Interface', 'Monitors'],
  Musician: ['Instruments', 'Pedals', 'Amps', 'Speakers'],
};

// ---------- diagram layout solver ----------

function buildLayout(diagram) {
  const setupType = diagram.setupType || 'DJ';
  const labels = LANE_LABELS[setupType] || LANE_LABELS.DJ;
  const lanes = labels.map(() => []);

  // Group devices by lane
  diagram.devices.forEach((d) => {
    const lane = Math.min(assignLane(d, setupType), lanes.length - 1);
    lanes[lane].push(d);
  });

  // For DJ, sort decks left-to-right by their original x (preserves "my left CDJ"
  // intuition even though lanes themselves are role-based).
  lanes.forEach((laneList) => {
    laneList.sort((a, b) => (a.x || 0) - (b.x || 0));
  });

  // Drop empty lanes (so we don't render headers for empty rows)
  const usedLanes = lanes
    .map((list, idx) => ({ list, idx, label: labels[idx] }))
    .filter((l) => l.list.length > 0);

  return { setupType, usedLanes };
}

function computeCardPositions(usedLanes, expanded) {
  // Each lane: row centered horizontally; row height = max(card height in lane).
  // Map { uniqueId -> { x, y, w, h, lane } } in canvas-local pixel space.
  const positions = {};
  let canvasWidth = 0;
  let cursorY = CANVAS_PADDING;

  const laneRows = usedLanes.map((lane) => {
    const heights = lane.list.map((d) =>
      expanded[d.uniqueId] ? CARD_H_EXPANDED : CARD_H_COLLAPSED
    );
    const rowH = Math.max(CARD_H_COLLAPSED, ...heights);
    const rowW = lane.list.length * CARD_W + (lane.list.length - 1) * CARD_GAP_X;
    return { lane, rowH, rowW };
  });

  const maxRowW = Math.max(0, ...laneRows.map((r) => r.rowW));
  canvasWidth = maxRowW + CANVAS_PADDING * 2;

  laneRows.forEach((row) => {
    const startX = CANVAS_PADDING + (maxRowW - row.rowW) / 2;
    cursorY += LANE_HEADER_H;
    row.lane.list.forEach((d, i) => {
      const x = startX + i * (CARD_W + CARD_GAP_X);
      const h = expanded[d.uniqueId] ? CARD_H_EXPANDED : CARD_H_COLLAPSED;
      positions[d.uniqueId] = {
        x,
        y: cursorY,
        w: CARD_W,
        h,
        lane: row.lane.label,
      };
    });
    cursorY += row.rowH + LANE_GAP_Y;
  });

  const canvasHeight = cursorY - LANE_GAP_Y + CANVAS_PADDING;
  return { positions, canvasWidth, canvasHeight, laneRows };
}

// ---------- cable path geometry ----------

function spreadX(card, slotIndex, slotCount) {
  // Distribute cable endpoints across the card width with margin.
  const margin = 16;
  if (slotCount <= 1) return card.x + card.w / 2;
  const usable = card.w - margin * 2;
  return card.x + margin + (usable * slotIndex) / (slotCount - 1);
}

function buildCablePath(from, to) {
  // Smooth cubic Bezier from (x1,y1) to (x2,y2).
  const dy = Math.abs(to.y - from.y);
  const cy1 = from.y + dy * 0.45;
  const cy2 = to.y - dy * 0.45;
  return `M${from.x},${from.y} C${from.x},${cy1} ${to.x},${cy2} ${to.x},${to.y}`;
}

function buildSendReturnPath(from, to, role) {
  // Slight horizontal offset for send/return so they don't overlap the main bus.
  const offset = role === 'send' ? -22 : 22;
  const midY = (from.y + to.y) / 2;
  const cx1 = from.x + offset * 0.6;
  const cx2 = to.x + offset * 0.6;
  return `M${from.x},${from.y} C${cx1},${midY} ${cx2},${midY} ${to.x},${to.y}`;
}

// ---------- main component ----------

export default function SetupDiagram({ diagram, fallbackDevices }) {
  const [expanded, setExpanded] = useState({});
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });

  const enriched = useMemo(() => {
    if (!diagram) return null;
    if (Array.isArray(diagram.connections) && diagram.connections.length > 0) return diagram;
    // Fallback: legacy v1 diagrams have no connections. Run inference on
    // the original devices array (which still has full inputs/outputs metadata).
    if (Array.isArray(fallbackDevices) && fallbackDevices.length > 0) {
      return {
        ...diagram,
        connections: inferConnections(fallbackDevices, diagram.setupType || 'DJ'),
      };
    }
    return { ...diagram, connections: [] };
  }, [diagram, fallbackDevices]);

  const layout = useMemo(() => (enriched ? buildLayout(enriched) : null), [enriched]);

  const { positions, canvasWidth, canvasHeight } = useMemo(() => {
    if (!layout) return { positions: {}, canvasWidth: 0, canvasHeight: 0, laneRows: [] };
    return computeCardPositions(layout.usedLanes, expanded);
  }, [layout, expanded]);

  // Per-pair slot indexing so multiple cables to the same card spread out.
  const cablesWithSlots = useMemo(() => {
    if (!enriched) return [];
    const outSlots = new Map(); // uniqueId -> count
    const inSlots = new Map();
    return enriched.connections.map((c) => {
      const fromIdx = outSlots.get(c.fromUniqueId) || 0;
      outSlots.set(c.fromUniqueId, fromIdx + 1);
      const toIdx = inSlots.get(c.toUniqueId) || 0;
      inSlots.set(c.toUniqueId, toIdx + 1);
      return { ...c, fromIdx, toIdx };
    }).map((c) => ({
      ...c,
      fromCount: outSlots.get(c.fromUniqueId),
      toCount: inSlots.get(c.toUniqueId),
    }));
  }, [enriched]);

  // ---------- gesture (pinch + pan) ----------
  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const baseScale = useRef(1);
  const baseTx = useRef(0);
  const baseTy = useRef(0);

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      const s = Math.max(0.5, Math.min(3, baseScale.current * e.scale));
      scale.setValue(s);
    })
    .onEnd(() => {
      // @ts-ignore  — _value is fine here for our manual base tracking.
      baseScale.current = scale._value;
    });

  const pan = Gesture.Pan()
    .minPointers(2)
    .onUpdate((e) => {
      translateX.setValue(baseTx.current + e.translationX);
      translateY.setValue(baseTy.current + e.translationY);
    })
    .onEnd(() => {
      baseTx.current = translateX._value;
      baseTy.current = translateY._value;
    });

  const composed = Gesture.Simultaneous(pinch, pan);

  // ---------- empty / loading ----------
  if (!enriched || !layout || enriched.devices.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No devices in this setup.</Text>
      </View>
    );
  }

  // Decide whether canvas overflows the visible area; if so, allow scroll
  const overflowsX = canvasWidth > containerSize.w;
  const overflowsY = canvasHeight > containerSize.h;

  const onContainerLayout = (e) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== containerSize.w || height !== containerSize.h) {
      setContainerSize({ w: width, h: height });
    }
  };

  const toggleExpand = (uniqueId) =>
    setExpanded((prev) => ({ ...prev, [uniqueId]: !prev[uniqueId] }));

  // Index devices by id for lookups inside connection rendering
  const byId = {};
  enriched.devices.forEach((d) => {
    byId[d.uniqueId] = d;
  });

  // Resolve cable endpoint coordinates on each card edge
  const resolved = cablesWithSlots
    .map((c) => {
      const fromCard = positions[c.fromUniqueId];
      const toCard = positions[c.toUniqueId];
      if (!fromCard || !toCard) return null;
      const fromIsAbove = fromCard.y < toCard.y;
      const fromPoint = {
        x: spreadX(fromCard, c.fromIdx, c.fromCount),
        y: fromIsAbove ? fromCard.y + fromCard.h : fromCard.y,
      };
      const toPoint = {
        x: spreadX(toCard, c.toIdx, c.toCount),
        y: fromIsAbove ? toCard.y : toCard.y + toCard.h,
      };
      return { ...c, fromPoint, toPoint, fromIsAbove };
    })
    .filter(Boolean);

  // ---------- render ----------
  const Canvas = (
    <View style={{ width: canvasWidth, height: canvasHeight }}>
      {/* Lane headings */}
      {layout.usedLanes.map((lane) => {
        const first = lane.list[0];
        const pos = positions[first.uniqueId];
        if (!pos) return null;
        return (
          <Text
            key={`lane-${lane.label}`}
            style={[styles.laneLabel, { left: CANVAS_PADDING, top: pos.y - LANE_HEADER_H + 2 }]}
          >
            {lane.label.toUpperCase()}
          </Text>
        );
      })}

      {/* Cable layer */}
      <Svg
        width={canvasWidth}
        height={canvasHeight}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        {resolved.map((c, idx) => {
          const path =
            c.role === 'send' || c.role === 'return'
              ? buildSendReturnPath(c.fromPoint, c.toPoint, c.role)
              : buildCablePath(c.fromPoint, c.toPoint);
          return (
            <React.Fragment key={`cable-${idx}`}>
              <Path
                d={path}
                stroke={c.cableColor || '#ef4444'}
                strokeWidth={2.5}
                fill="none"
                strokeDasharray={c.role === 'send' ? '6,4' : undefined}
                strokeLinecap="round"
                opacity={0.9}
              />
              <Circle cx={c.fromPoint.x} cy={c.fromPoint.y} r={3} fill={c.cableColor || '#ef4444'} />
              <Circle cx={c.toPoint.x} cy={c.toPoint.y} r={3} fill={c.cableColor || '#ef4444'} />
            </React.Fragment>
          );
        })}
      </Svg>

      {/* Port pill labels (above SVG so they're readable) */}
      {resolved.map((c, idx) => (
        <React.Fragment key={`pill-${idx}`}>
          <PortPill
            label={c.fromPort}
            cableType={c.cableType}
            cableColor={c.cableColor}
            x={c.fromPoint.x}
            y={c.fromPoint.y}
            anchor={c.fromIsAbove ? 'above-down' : 'below-up'}
          />
          <PortPill
            label={c.toPort}
            cableType={null}
            cableColor={c.cableColor}
            x={c.toPoint.x}
            y={c.toPoint.y}
            anchor={c.fromIsAbove ? 'below-up' : 'above-down'}
          />
        </React.Fragment>
      ))}

      {/* Cards */}
      {enriched.devices.map((d) => {
        const pos = positions[d.uniqueId];
        if (!pos) return null;
        const isExpanded = !!expanded[d.uniqueId];
        const wiredOutPorts = new Set(
          resolved.filter((c) => c.fromUniqueId === d.uniqueId).map((c) => c.fromPort)
        );
        const wiredInPorts = new Set(
          resolved.filter((c) => c.toUniqueId === d.uniqueId).map((c) => c.toPort)
        );
        const connectionCount = wiredOutPorts.size + wiredInPorts.size;
        return (
          <DeviceCard
            key={d.uniqueId}
            device={d}
            x={pos.x}
            y={pos.y}
            w={pos.w}
            h={pos.h}
            isExpanded={isExpanded}
            onPress={() => toggleExpand(d.uniqueId)}
            wiredOutPorts={wiredOutPorts}
            wiredInPorts={wiredInPorts}
            connectionCount={connectionCount}
            // Original device data with full inputs/outputs is stored on the
            // legacy fallback path; the diagram itself only stores trimmed device fields.
            fallback={fallbackDevices && fallbackDevices.find((x) => x.uniqueId === d.uniqueId)}
          />
        );
      })}
    </View>
  );

  return (
    <View style={styles.root} onLayout={onContainerLayout}>
      <GestureDetector gesture={composed}>
        <Animated.View
          style={{
            flex: 1,
            transform: [{ translateX }, { translateY }, { scale }],
          }}
        >
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ minWidth: canvasWidth, minHeight: canvasHeight }}
            horizontal={false}
            showsVerticalScrollIndicator={overflowsY}
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={overflowsX}
              contentContainerStyle={{ minWidth: canvasWidth }}
            >
              {Canvas}
            </ScrollView>
          </ScrollView>
        </Animated.View>
      </GestureDetector>
      <View style={styles.legend} pointerEvents="none">
        <Text style={styles.legendHint}>Pinch to zoom · two-finger drag to pan · tap a card for ports</Text>
      </View>
    </View>
  );
}

// ---------- card subcomponent ----------

function DeviceCard({
  device,
  x,
  y,
  w,
  h,
  isExpanded,
  onPress,
  wiredOutPorts,
  wiredInPorts,
  connectionCount,
  fallback,
}) {
  const inputs = (fallback && fallback.inputs) || [];
  const outputs = (fallback && fallback.outputs) || [];

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.card,
        {
          left: x,
          top: y,
          width: w,
          height: h,
        },
      ]}
    >
      {device.imageUrl ? (
        <Image
          source={{ uri: device.imageUrl }}
          style={styles.cardImage}
          resizeMode="contain"
        />
      ) : (
        <View style={[styles.cardImage, styles.cardImagePlaceholder]} />
      )}
      <Text style={styles.cardName} numberOfLines={2}>
        {device.name}
      </Text>
      {!isExpanded ? (
        <View style={styles.cardDots}>
          {Array.from({ length: Math.min(connectionCount, 6) }).map((_, i) => (
            <View key={i} style={styles.cardDot} />
          ))}
        </View>
      ) : (
        <View style={styles.cardPorts}>
          {outputs.length > 0 && (
            <>
              <Text style={styles.portsHeading}>OUTPUTS</Text>
              {outputs.map((o, idx) => {
                const label = o.label || o.type || `OUT ${idx + 1}`;
                const wired = wiredOutPorts.has(label);
                return (
                  <Text
                    key={`o-${idx}`}
                    style={[styles.portLine, wired && styles.portLineWired]}
                    numberOfLines={1}
                  >
                    {wired ? '●' : '○'} {label}
                  </Text>
                );
              })}
            </>
          )}
          {inputs.length > 0 && (
            <>
              <Text style={[styles.portsHeading, { marginTop: 6 }]}>INPUTS</Text>
              {inputs.map((i, idx) => {
                const label = i.label || i.type || `IN ${idx + 1}`;
                const wired = wiredInPorts.has(label);
                return (
                  <Text
                    key={`i-${idx}`}
                    style={[styles.portLine, wired && styles.portLineWired]}
                    numberOfLines={1}
                  >
                    {wired ? '●' : '○'} {label}
                  </Text>
                );
              })}
            </>
          )}
          {inputs.length === 0 && outputs.length === 0 && (
            <Text style={styles.portLine}>No port info</Text>
          )}
        </View>
      )}
    </Pressable>
  );
}

// ---------- port pill subcomponent ----------

function PortPill({ label, cableType, cableColor, x, y, anchor }) {
  // anchor === 'above-down' means the cable enters going downward (pill above point)
  // anchor === 'below-up' means cable enters going upward (pill below point)
  const pillH = cableType ? 30 : 18;
  const above = anchor === 'above-down';
  const top = above ? y - pillH - 6 : y + 6;
  return (
    <View
      pointerEvents="none"
      style={[
        styles.portPill,
        {
          left: x - 60,
          top,
          width: 120,
          borderColor: cableColor || colors.border,
        },
      ]}
    >
      <Text style={styles.portPillText} numberOfLines={1}>
        {label}
      </Text>
      {cableType ? (
        <Text style={[styles.portPillCable, { color: cableColor || colors.textDim }]}>
          {cableType}
        </Text>
      ) : null}
    </View>
  );
}

// ---------- styles ----------

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0a0a0c',
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyText: { color: colors.textDim, fontSize: 14 },
  laneLabel: {
    position: 'absolute',
    color: colors.textDim,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  card: {
    position: 'absolute',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 8,
    overflow: 'hidden',
  },
  cardImage: {
    width: '100%',
    height: 48,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    marginBottom: 6,
  },
  cardImagePlaceholder: { backgroundColor: '#22222a' },
  cardName: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  cardDots: {
    position: 'absolute',
    bottom: 6,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 3,
  },
  cardDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accent,
  },
  cardPorts: {
    marginTop: 6,
  },
  portsHeading: {
    color: colors.textDim,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  portLine: {
    color: colors.textDim,
    fontSize: 10,
    marginTop: 2,
  },
  portLineWired: {
    color: colors.text,
    fontWeight: '600',
  },
  portPill: {
    position: 'absolute',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(15,15,20,0.92)',
    alignItems: 'center',
  },
  portPillText: {
    color: colors.text,
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'center',
  },
  portPillCable: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 1,
  },
  legend: {
    position: 'absolute',
    bottom: 6,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  legendHint: {
    color: 'rgba(154,154,165,0.7)',
    fontSize: 10,
    textAlign: 'center',
  },
});
