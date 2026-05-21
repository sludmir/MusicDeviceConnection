// Live trackpad-vs-mouse classification for camera controls.
//
// We deliberately do NOT cache the result. A one-time guess that gets stored
// forever is the worst failure mode: if the first few wheel events are
// ambiguous, the user is stuck with the wrong controls. Instead we classify
// every wheel event and let the active device switch on the fly.

// Magnitude threshold above which a vertical-only wheel event is treated as a
// mouse-wheel notch. Real-world data: a smooth-scroll mouse emits fractional
// deltas that ramp to peaks of 150–360 per notch, while a trackpad's normal
// two-finger scroll stays well below this. Fractionality is NOT a useful
// signal — both devices produce fractional pixel deltas in Chrome.
const MOUSE_DELTA_THRESHOLD = 80;

// Classify a single wheel event.
//   'pinch'    — trackpad pinch gesture (browser sets ctrlKey); always a zoom
//   'trackpad' — horizontal component present (a plain wheel can't do this)
//   'mouse'    — large vertical magnitude = a mouse wheel notch
//   'soft'     — small vertical, no horizontal → ambiguous, leave mode as-is
export function classifyWheelEvent(e) {
  if (e.ctrlKey) return 'pinch';
  const dy = Math.abs(e.deltaY || 0);
  const dx = Math.abs(e.deltaX || 0);
  // A plain mouse wheel cannot produce horizontal movement.
  if (dx > 0.5) return 'trackpad';
  // Large vertical magnitude is the reliable mouse-wheel signal.
  if (dy >= MOUSE_DELTA_THRESHOLD) return 'mouse';
  return 'soft';
}

// Stateful detector. Feed it wheel events; it returns the current best-guess
// device. Not a React hook — usable inside event handlers and refs without
// re-renders. 'mouse' and 'trackpad' are high-confidence and switch the mode;
// 'soft' / 'pinch' leave the current mode unchanged (so a notch's small
// leading/trailing events don't flap the mode mid-gesture).
export function createWheelDeviceDetector(initial = 'trackpad') {
  let device = initial;
  return {
    get device() {
      return device;
    },
    feed(e) {
      const cls = classifyWheelEvent(e);
      if (cls === 'mouse') device = 'mouse';
      else if (cls === 'trackpad') device = 'trackpad';
      return device;
    },
  };
}
