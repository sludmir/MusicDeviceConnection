/**
 * Infer cable connections between devices in a setup.
 *
 * Pure function: takes a list of devices (with inputs/outputs metadata) and
 * a setup type, returns an array of connection records suitable for both
 * 3D rendering and the mobile schematic view.
 *
 * Connection record:
 *   {
 *     fromUniqueId, fromPort, fromPortType,
 *     toUniqueId,   toPort,   toPortType,
 *     cableType,    // human-readable cable label (XLR, RCA, 1/4", USB, MIDI, ...)
 *     cableColor,   // hex color used by both 3D and schematic renderers
 *     role,         // 'main' | 'send' | 'return' — schematic uses to draw curved sends
 *   }
 *
 * Currently DJ-complete; Producer/Musician are best-effort.
 */

const lower = (s) => (s || '').toString().toLowerCase();

// ---------- role detection ----------

export function isMixer(d) {
  const n = lower(d?.name);
  const t = lower(d?.type);
  const sub = lower(d?.subcategory);
  return (
    n.includes('djm') ||
    sub.includes('mixer') ||
    t.includes('mixer') ||
    n.includes(' mixer') ||
    n.startsWith('mixer')
  );
}

export function isDeck(d) {
  const n = lower(d?.name);
  const t = lower(d?.type);
  const sub = lower(d?.subcategory);
  return (
    n.includes('cdj') ||
    n.includes('xdj') ||
    n.includes('turntable') ||
    sub.includes('player') ||
    t.includes('player') ||
    t.includes('turntable')
  );
}

export function isFxUnit(d) {
  const n = lower(d?.name);
  const t = lower(d?.type);
  const sub = lower(d?.subcategory);
  return (
    n.includes('rmx') ||
    n.includes('revolo') ||
    n.includes('fx') ||
    sub.includes('effect') ||
    t.includes('fx') ||
    t.includes('effect')
  );
}

export function isSpeaker(d) {
  const n = lower(d?.name);
  const t = lower(d?.type);
  const sub = lower(d?.subcategory);
  const spot = lower(d?.spotType);
  return (
    spot.includes('speaker') ||
    sub.includes('speaker') ||
    sub.includes('monitor') ||
    n.includes('speaker') ||
    n.includes('monitor') ||
    t.includes('speaker') ||
    t.includes('monitor')
  );
}

export function isAudioInterface(d) {
  const n = lower(d?.name);
  const sub = lower(d?.subcategory);
  return sub.includes('audio-interface') || sub.includes('interface') || n.includes('interface');
}

export function isLaptop(d) {
  const n = lower(d?.name);
  const t = lower(d?.type);
  return n.includes('laptop') || n.includes('macbook') || t.includes('laptop');
}

// ---------- port matching ----------

const portTypeMatchers = {
  send: (t) => t.includes('send'),
  return: (t) => t.includes('return'),
  master: (t) => t.includes('master') || t.includes('main out'),
  line: (t) => /\bline\b/.test(t) || /\bch\d/.test(t) || t.includes('phono'),
  rca: (t) => t.includes('rca'),
  xlr: (t) => t.includes('xlr'),
  quarter: (t) => t.includes('1/4') || t.includes('jack') || t.includes('trs') || t.includes('ts'),
  usb: (t) => t.includes('usb'),
  midi: (t) => t.includes('midi'),
};

function matches(port, kind) {
  if (!port) return false;
  return portTypeMatchers[kind](lower(port.type));
}

function findPort(ports, predicate, used) {
  if (!Array.isArray(ports)) return -1;
  for (let i = 0; i < ports.length; i++) {
    if (used && used.has(i)) continue;
    if (predicate(ports[i], i)) return i;
  }
  return -1;
}

// ---------- cable type / color ----------

function deriveCable(sourcePortType, targetPortType) {
  const a = lower(sourcePortType);
  const b = lower(targetPortType);
  const both = `${a} ${b}`;
  if (both.includes('xlr')) return { cableType: 'XLR', cableColor: '#3b82f6' };
  if (both.includes('rca')) return { cableType: 'RCA', cableColor: '#ef4444' };
  if (both.includes('1/4') || both.includes('trs') || both.includes('jack')) {
    return { cableType: '1/4" TRS', cableColor: '#f59e0b' };
  }
  if (both.includes('usb-c')) return { cableType: 'USB-C', cableColor: '#9ca3af' };
  if (both.includes('usb')) return { cableType: 'USB', cableColor: '#9ca3af' };
  if (both.includes('midi')) return { cableType: 'MIDI', cableColor: '#a855f7' };
  if (both.includes('ethernet') || both.includes('link')) {
    return { cableType: 'Ethernet', cableColor: '#10b981' };
  }
  // Sensible default for line-level audio when we couldn't identify the connector
  return { cableType: 'Line', cableColor: '#ef4444' };
}

// ---------- DJ inference ----------

function inferDJ(devices) {
  const mixer = devices.find(isMixer);
  if (!mixer) return [];

  const connections = [];
  const decks = devices.filter(isDeck).sort((a, b) => (a?.position?.x || 0) - (b?.position?.x || 0));
  const fxUnits = devices.filter(isFxUnit);
  const speakers = devices.filter(isSpeaker);

  const usedMixerInputs = new Set();
  const mixerInputs = mixer.inputs || [];

  // Decks → mixer line/CH inputs (one cable each, channel by left-to-right order)
  decks.forEach((deck, idx) => {
    const channel = idx + 1; // 1..N
    const deckOut =
      (deck.outputs || []).find((o) => matches(o, 'line') || matches(o, 'rca')) ||
      (deck.outputs || [])[0];
    if (!deckOut) return;

    let inputIdx = findPort(
      mixerInputs,
      (p) => {
        const t = lower(p.type);
        return t.includes(`line${channel}`) || t.includes(`ch${channel}`) || t === `line ${channel}`;
      },
      usedMixerInputs
    );
    if (inputIdx < 0 && channel - 1 < mixerInputs.length && !usedMixerInputs.has(channel - 1)) {
      inputIdx = channel - 1;
    }
    if (inputIdx < 0) inputIdx = findPort(mixerInputs, (p) => matches(p, 'line') || matches(p, 'rca'), usedMixerInputs);
    if (inputIdx < 0) inputIdx = findPort(mixerInputs, () => true, usedMixerInputs);
    if (inputIdx < 0) return;
    usedMixerInputs.add(inputIdx);

    const mixerInput = mixerInputs[inputIdx];
    connections.push({
      fromUniqueId: deck.uniqueId,
      fromPort: deckOut.label || deckOut.type || 'Line Out',
      fromPortType: deckOut.type || 'Line Out',
      toUniqueId: mixer.uniqueId,
      toPort: mixerInput.label || mixerInput.type || `LINE ${channel}`,
      toPortType: mixerInput.type || `LINE ${channel}`,
      ...deriveCable(deckOut.type, mixerInput.type),
      role: 'main',
    });
  });

  // Mixer ↔ FX (send / return)
  fxUnits.forEach((fx) => {
    const sendOut =
      (mixer.outputs || []).find((o) => matches(o, 'send')) ||
      (mixer.outputs || []).find((o) => !matches(o, 'master') && !matches(o, 'line') && !matches(o, 'rca'));
    const sendIn =
      (fx.inputs || []).find((i) => matches(i, 'send')) ||
      (fx.inputs || []).find((i) => !matches(i, 'line') && !matches(i, 'rca')) ||
      (fx.inputs || [])[0];
    if (sendOut && sendIn) {
      connections.push({
        fromUniqueId: mixer.uniqueId,
        fromPort: sendOut.label || sendOut.type || 'SEND',
        fromPortType: sendOut.type || 'SEND',
        toUniqueId: fx.uniqueId,
        toPort: sendIn.label || sendIn.type || 'SEND IN',
        toPortType: sendIn.type || 'SEND IN',
        ...deriveCable(sendOut.type, sendIn.type),
        role: 'send',
      });
    }

    const returnOut =
      (fx.outputs || []).find((o) => matches(o, 'return')) ||
      (fx.outputs || []).find((o) => !matches(o, 'line') && !matches(o, 'rca')) ||
      (fx.outputs || [])[0];
    const returnIn =
      (mixer.inputs || []).find((i) => matches(i, 'return')) ||
      (mixer.inputs || []).find((i) => {
        const idx = mixer.inputs.indexOf(i);
        return !usedMixerInputs.has(idx);
      });
    if (returnOut && returnIn) {
      const idx = (mixer.inputs || []).indexOf(returnIn);
      if (idx >= 0) usedMixerInputs.add(idx);
      connections.push({
        fromUniqueId: fx.uniqueId,
        fromPort: returnOut.label || returnOut.type || 'RETURN',
        fromPortType: returnOut.type || 'RETURN',
        toUniqueId: mixer.uniqueId,
        toPort: returnIn.label || returnIn.type || 'RETURN IN',
        toPortType: returnIn.type || 'RETURN IN',
        ...deriveCable(returnOut.type, returnIn.type),
        role: 'return',
      });
    }
  });

  // Mixer master out → speakers (XLR pair, one cable per speaker)
  if (speakers.length > 0) {
    const masterOut =
      (mixer.outputs || []).find((o) => matches(o, 'master') || matches(o, 'xlr')) ||
      (mixer.outputs || [])[0];
    if (masterOut) {
      speakers.forEach((spk) => {
        const spkIn =
          (spk.inputs || []).find((i) => matches(i, 'xlr')) ||
          (spk.inputs || []).find((i) => matches(i, 'quarter')) ||
          (spk.inputs || [])[0];
        if (!spkIn) return;
        connections.push({
          fromUniqueId: mixer.uniqueId,
          fromPort: masterOut.label || masterOut.type || 'MASTER OUT',
          fromPortType: masterOut.type || 'MASTER OUT',
          toUniqueId: spk.uniqueId,
          toPort: spkIn.label || spkIn.type || 'INPUT',
          toPortType: spkIn.type || 'INPUT',
          ...deriveCable(masterOut.type || 'XLR', spkIn.type || 'XLR'),
          role: 'main',
        });
      });
    }
  }

  return connections;
}

// ---------- Producer inference (best-effort) ----------

function inferProducer(devices) {
  const interfaceDev = devices.find(isAudioInterface) || devices.find(isLaptop);
  if (!interfaceDev) return [];

  const connections = [];
  const sources = devices.filter(
    (d) => d !== interfaceDev && !isSpeaker(d) && !isLaptop(d)
  );
  const monitors = devices.filter(isSpeaker);

  const usedInputs = new Set();
  sources.forEach((src) => {
    const out = (src.outputs || [])[0];
    if (!out) return;
    const inputIdx = findPort(interfaceDev.inputs || [], () => true, usedInputs);
    if (inputIdx < 0) return;
    usedInputs.add(inputIdx);
    const port = (interfaceDev.inputs || [])[inputIdx];
    connections.push({
      fromUniqueId: src.uniqueId,
      fromPort: out.label || out.type || 'OUT',
      fromPortType: out.type || 'OUT',
      toUniqueId: interfaceDev.uniqueId,
      toPort: port.label || port.type || `IN ${inputIdx + 1}`,
      toPortType: port.type || `IN ${inputIdx + 1}`,
      ...deriveCable(out.type, port.type),
      role: 'main',
    });
  });

  // Interface → monitors (assume L/R outputs)
  monitors.forEach((mon, idx) => {
    const ifaceOut = (interfaceDev.outputs || [])[idx] || (interfaceDev.outputs || [])[0];
    const monIn = (mon.inputs || [])[0];
    if (!ifaceOut || !monIn) return;
    connections.push({
      fromUniqueId: interfaceDev.uniqueId,
      fromPort: ifaceOut.label || ifaceOut.type || `OUT ${idx + 1}`,
      fromPortType: ifaceOut.type || `OUT ${idx + 1}`,
      toUniqueId: mon.uniqueId,
      toPort: monIn.label || monIn.type || 'INPUT',
      toPortType: monIn.type || 'INPUT',
      ...deriveCable(ifaceOut.type, monIn.type),
      role: 'main',
    });
  });

  return connections;
}

// ---------- Musician inference (best-effort linear chain) ----------

function inferMusician(devices) {
  // Heuristic: instruments → pedals (in order) → amps. Improve once the
  // musician setup type has clearer port metadata.
  const instruments = devices.filter((d) => {
    const sub = lower(d?.subcategory);
    const t = lower(d?.type);
    return sub.includes('instrument') || t.includes('guitar') || t.includes('bass') || t.includes('keyboard');
  });
  const pedals = devices.filter((d) => {
    const sub = lower(d?.subcategory);
    return sub.includes('effect') || sub.includes('pedal');
  });
  const amps = devices.filter((d) => {
    const sub = lower(d?.subcategory);
    const t = lower(d?.type);
    return sub.includes('amp') || t.includes('amp');
  });

  const connections = [];
  instruments.forEach((inst, idx) => {
    const chain = [...pedals, ...amps];
    let prev = inst;
    chain.forEach((next) => {
      const out = (prev.outputs || [])[0];
      const inp = (next.inputs || [])[0];
      if (!out || !inp) return;
      connections.push({
        fromUniqueId: prev.uniqueId,
        fromPort: out.label || out.type || 'OUT',
        fromPortType: out.type || 'OUT',
        toUniqueId: next.uniqueId,
        toPort: inp.label || inp.type || 'IN',
        toPortType: inp.type || 'IN',
        ...deriveCable(out.type, inp.type),
        role: 'main',
      });
      prev = next;
    });
    void idx;
  });
  return connections;
}

// ---------- entry point ----------

export function inferConnections(devices, setupType) {
  if (!Array.isArray(devices) || devices.length === 0) return [];
  const type = (setupType || 'DJ').toString();
  if (type === 'DJ') return inferDJ(devices);
  if (type === 'Producer') return inferProducer(devices);
  if (type === 'Musician') return inferMusician(devices);
  return [];
}
