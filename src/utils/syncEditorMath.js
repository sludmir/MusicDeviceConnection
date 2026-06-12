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
