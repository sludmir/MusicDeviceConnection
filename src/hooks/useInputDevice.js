import { useEffect, useState } from 'react';

const STORAGE_KEY = 'liveset-input-device';
const SAMPLE_COUNT = 3;

// Heuristic classifier for a single wheel event.
// Trackpad: small deltaY, often fractional, often paired with non-zero deltaX.
// Mouse wheel: large discrete deltaY (typically multiples of 100/120), deltaX = 0.
export function classifyWheelEvent(e) {
  const dy = Math.abs(e.deltaY || 0);
  const dx = Math.abs(e.deltaX || 0);
  const fractional = e.deltaY !== Math.trunc(e.deltaY);

  if (dx > 0) return 'trackpad';
  if (fractional && dy < 100) return 'trackpad';
  if (dy < 40) return 'trackpad';
  if (dy >= 100) return 'mouse';
  // ambiguous middle ground → assume trackpad (the safer default since current
  // controls were tuned for it)
  return 'trackpad';
}

function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && parsed.device ? parsed : null;
  } catch {
    return null;
  }
}

function writeStored(device, source) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ device, source, at: Date.now() }));
  } catch {
    // ignore
  }
}

// Returns { device: 'trackpad' | 'mouse', source: 'cached' | 'detected' | 'override', setOverride }.
// - Reads cached value from localStorage on mount.
// - If no cache and no override, attaches a wheel listener to window and classifies
//   from the first SAMPLE_COUNT events. Majority wins.
// - `setOverride(value)` writes the override to localStorage and updates state.
//   Pass `null` to clear the override and trigger re-detection.
export default function useInputDevice() {
  const [state, setState] = useState(() => {
    const stored = readStored();
    if (stored) return stored;
    return { device: 'trackpad', source: 'default' };
  });

  useEffect(() => {
    if (state.source !== 'default') return;

    const samples = [];
    const onWheel = (e) => {
      samples.push(classifyWheelEvent(e));
      if (samples.length >= SAMPLE_COUNT) {
        window.removeEventListener('wheel', onWheel, { passive: true });
        const mouseVotes = samples.filter((s) => s === 'mouse').length;
        const device = mouseVotes > samples.length / 2 ? 'mouse' : 'trackpad';
        writeStored(device, 'detected');
        setState({ device, source: 'detected' });
      }
    };
    window.addEventListener('wheel', onWheel, { passive: true });
    return () => window.removeEventListener('wheel', onWheel, { passive: true });
  }, [state.source]);

  const setOverride = (value) => {
    if (value === null) {
      try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
      setState({ device: 'trackpad', source: 'default' });
      return;
    }
    writeStored(value, 'override');
    setState({ device: value, source: 'override' });
  };

  return { device: state.device, source: state.source, setOverride };
}
