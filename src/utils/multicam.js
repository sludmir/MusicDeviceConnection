// Pure cut-list math for multicam sets. A cut list is
// [{ timeSec, angleIndex }] in MASTER-timeline seconds, sorted ascending,
// with cuts[0].timeSec === 0. A cut at T shows angles[angleIndex] until the
// next cut. Consecutive same-angle cuts are merged; segments shorter than
// MIN_SEGMENT_SEC are rejected.

export const MIN_SEGMENT_SEC = 0.5;

const DEFAULT_CUTS = [{ timeSec: 0, angleIndex: 0 }];

function clampAngle(idx, maxAngleIndex) {
  const n = Number(idx);
  if (!Number.isFinite(n) || n < 0) return 0;
  const max = Number.isFinite(maxAngleIndex) ? maxAngleIndex : Infinity;
  return Math.min(Math.floor(n), max);
}

export function normalizeCuts(cuts, { maxAngleIndex } = {}) {
  if (!Array.isArray(cuts) || cuts.length === 0) return DEFAULT_CUTS.map((c) => ({ ...c }));
  const cleaned = cuts
    .filter((c) => c && Number.isFinite(Number(c.timeSec)))
    .map((c) => ({
      timeSec: Math.max(0, Number(c.timeSec)),
      angleIndex: clampAngle(c.angleIndex, maxAngleIndex),
    }))
    .sort((a, b) => a.timeSec - b.timeSec);
  if (cleaned.length === 0) return DEFAULT_CUTS.map((c) => ({ ...c }));
  cleaned[0] = { ...cleaned[0], timeSec: 0 };
  const out = [cleaned[0]];
  for (let i = 1; i < cleaned.length; i++) {
    const prev = out[out.length - 1];
    const cur = cleaned[i];
    if (cur.timeSec - prev.timeSec < MIN_SEGMENT_SEC) continue; // too close
    if (cur.angleIndex === prev.angleIndex) continue;           // no-op cut
    out.push(cur);
  }
  return out;
}

export function angleIndexAt(cuts, tSec) {
  if (!Array.isArray(cuts) || cuts.length === 0) return 0;
  let angle = cuts[0].angleIndex || 0;
  for (let i = 1; i < cuts.length; i++) {
    if (cuts[i].timeSec <= tSec) angle = cuts[i].angleIndex;
    else break;
  }
  return angle;
}

export function addCut(cuts, tSec, angleIndex) {
  const base = normalizeCuts(cuts);
  // Retarget an existing cut if we're within MIN_SEGMENT_SEC of it.
  const nearIdx = base.findIndex((c) => Math.abs(c.timeSec - tSec) < MIN_SEGMENT_SEC);
  if (nearIdx >= 0) {
    const next = base.map((c, i) => (i === nearIdx ? { ...c, angleIndex } : c));
    return normalizeCuts(next);
  }
  return normalizeCuts([...base, { timeSec: tSec, angleIndex }]);
}

export function moveCut(cuts, index, tSec) {
  const base = normalizeCuts(cuts);
  if (index <= 0 || index >= base.length) return base;
  const lo = base[index - 1].timeSec + MIN_SEGMENT_SEC;
  const hi = index + 1 < base.length ? base[index + 1].timeSec - MIN_SEGMENT_SEC : Infinity;
  const clamped = Math.min(Math.max(tSec, lo), hi);
  return base.map((c, i) => (i === index ? { ...c, timeSec: clamped } : c));
}

export function removeCut(cuts, index) {
  const base = normalizeCuts(cuts);
  if (index <= 0 || index >= base.length) return base;
  return normalizeCuts(base.filter((_, i) => i !== index));
}

export function setSegmentAngle(cuts, index, angleIndex) {
  const base = normalizeCuts(cuts);
  if (index < 0 || index >= base.length) return base;
  return normalizeCuts(base.map((c, i) => (i === index ? { ...c, angleIndex } : c)));
}

export function cutsToSegments(cuts, durationSec) {
  const base = normalizeCuts(cuts);
  const dur = Math.max(0, Number(durationSec) || 0);
  const segs = [];
  for (let i = 0; i < base.length; i++) {
    if (base[i].timeSec >= dur) break;
    const end = i + 1 < base.length ? Math.min(base[i + 1].timeSec, dur) : dur;
    segs.push({ start: base[i].timeSec, end, angleIndex: base[i].angleIndex });
  }
  return segs;
}
