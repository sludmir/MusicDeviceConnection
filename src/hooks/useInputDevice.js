// Live trackpad-vs-mouse classification for camera controls.
//
// We deliberately do NOT cache the result. A one-time guess that gets stored
// forever is the worst failure mode: if the first few wheel events are
// ambiguous, the user is stuck with the wrong controls. Instead we classify
// every wheel event and let the active device switch on the fly.

// Classify a single wheel event.
//   'pinch'    — trackpad pinch gesture (browser sets ctrlKey); always a zoom
//   'trackpad' — high-confidence trackpad signal (horizontal delta, or a
//                fractional / small vertical delta from inertial scrolling)
//   'mouse'    — large, integer, purely-vertical delta = a mouse wheel notch
//   'unknown'  — no signal (e.g. deltaY 0)
export function classifyWheelEvent(e) {
  if (e.ctrlKey) return 'pinch';
  const dy = Math.abs(e.deltaY || 0);
  const dx = Math.abs(e.deltaX || 0);
  // A plain mouse wheel cannot produce horizontal movement.
  if (dx > 0.5) return 'trackpad';
  // Inertial trackpad scrolling produces fractional pixel deltas.
  const fractional = Math.abs((e.deltaY || 0) - Math.round(e.deltaY || 0)) > 0.0001;
  if (fractional) return 'trackpad';
  // Small discrete steps are trackpad; big notches (100/120/...) are a mouse.
  if (dy > 0 && dy < 50) return 'trackpad';
  if (dy >= 50) return 'mouse';
  return 'unknown';
}

// Number of consecutive mouse-like events required to switch INTO mouse mode.
// Trackpad signals are high-confidence and switch back immediately; mouse
// signals need confirmation so a single hard trackpad flick can't flip modes.
const MOUSE_CONFIRM = 2;

// Stateful detector with hysteresis. Feed it wheel events; it returns the
// current best-guess device. Not a React hook — usable inside event handlers
// and refs without re-renders.
export function createWheelDeviceDetector(initial = 'trackpad') {
  let device = initial;
  let mouseStreak = 0;
  return {
    get device() {
      return device;
    },
    feed(e) {
      const cls = classifyWheelEvent(e);
      if (cls === 'trackpad') {
        mouseStreak = 0;
        device = 'trackpad';
      } else if (cls === 'mouse') {
        mouseStreak += 1;
        if (mouseStreak >= MOUSE_CONFIRM) device = 'mouse';
      }
      // 'pinch' and 'unknown' leave the current device unchanged.
      return device;
    },
  };
}
