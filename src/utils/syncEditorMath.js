// Pure math for the set editor sync screen: offset nudging, the master→angle
// time mapping shared by every seek path, and the ms-precision offset readout.

export function nudgeOffset(current, deltaSec, previewDuration) {
  const next = (current || 0) + deltaSec;
  const limit = Math.max(0, previewDuration || 0);
  return Math.max(-limit, Math.min(limit, next));
}

export function angleTimeAtMaster(masterSec, offsetSec) {
  return masterSec - (offsetSec || 0);
}

export function formatOffsetMs(sec) {
  const v = Number.isFinite(sec) ? sec : 0;
  const sign = v < 0 ? '−' : '+';
  return `${sign}${Math.abs(v).toFixed(3)}s`;
}

// "83" | "1:23" | "1:02:03" (fractional seconds allowed) → seconds, else null.
export function parseClockTime(text) {
  if (typeof text !== 'string' || !text.trim()) return null;
  const parts = text.trim().split(':');
  if (parts.length > 3) return null;
  for (const p of parts) {
    if (!/^\d+(\.\d+)?$/.test(p.trim())) return null;
  }
  let sec = 0;
  for (const p of parts) sec = sec * 60 + Number(p);
  return Number.isFinite(sec) ? sec : null;
}

// Seconds → "m:ss" or "h:mm:ss", keeping fractional seconds when present.
export function formatClockTime(sec) {
  const v = Number.isFinite(sec) && sec > 0 ? sec : 0;
  const whole = Math.floor(v);
  const frac = Number((v - whole).toFixed(3));
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const s = whole % 60;
  const sStr = String(s).padStart(2, '0') + (frac ? String(frac).slice(1) : '');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sStr}` : `${m}:${sStr}`;
}
