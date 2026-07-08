import { CLIP_MIN_SEC, CLIP_MAX_SEC, normalizeClipRange, resizeClipRanges } from './clipRanges';

describe('normalizeClipRange', () => {
  test('passes through a valid range', () => {
    expect(normalizeClipRange({ start: 20, end: 50 }, 300)).toEqual({ start: 20, end: 50 });
  });

  test('falls back to a minimum clip when duration unknown', () => {
    expect(normalizeClipRange({ start: 5, end: 8 }, 0)).toEqual({ start: 0, end: CLIP_MIN_SEC });
  });

  test('clamps end to duration and start+max', () => {
    const r = normalizeClipRange({ start: 10, end: 500 }, 120);
    expect(r.end).toBe(Math.min(120, 10 + CLIP_MAX_SEC));
  });

  test('enforces minimum clip length', () => {
    const r = normalizeClipRange({ start: 30, end: 32 }, 300);
    expect(r.end - r.start).toBeGreaterThanOrEqual(CLIP_MIN_SEC);
  });

  test('handles NaN inputs', () => {
    const r = normalizeClipRange({ start: NaN, end: NaN }, 300);
    expect(Number.isFinite(r.start)).toBe(true);
    expect(Number.isFinite(r.end)).toBe(true);
    expect(r.end - r.start).toBeGreaterThanOrEqual(CLIP_MIN_SEC);
  });

  test('short video still yields a valid range', () => {
    const r = normalizeClipRange({ start: 0, end: 60 }, 12);
    expect(r.start).toBe(0);
    expect(r.end).toBeLessThanOrEqual(12);
    expect(r.end - r.start).toBeGreaterThanOrEqual(CLIP_MIN_SEC);
  });
});

describe('resizeClipRanges', () => {
  test('grows the list, spacing new clips after the last', () => {
    const next = resizeClipRanges([{ start: 0, end: 30 }], 3, 600);
    expect(next).toHaveLength(3);
    expect(next[1].start).toBeGreaterThanOrEqual(next[0].end);
    expect(next[2].start).toBeGreaterThanOrEqual(next[1].end);
    next.forEach((r) => {
      expect(r.end - r.start).toBeGreaterThanOrEqual(CLIP_MIN_SEC);
      expect(r.end).toBeLessThanOrEqual(600);
    });
  });

  test('shrinks the list', () => {
    const three = [
      { start: 0, end: 30 },
      { start: 60, end: 90 },
      { start: 120, end: 150 },
    ];
    expect(resizeClipRanges(three, 1, 600)).toEqual([{ start: 0, end: 30 }]);
  });

  test('normalizes existing out-of-bounds ranges', () => {
    const next = resizeClipRanges([{ start: -5, end: 900 }], 1, 300);
    expect(next[0].start).toBeGreaterThanOrEqual(0);
    expect(next[0].end - next[0].start).toBeLessThanOrEqual(CLIP_MAX_SEC);
  });

  test('empty input produces a starter clip', () => {
    const next = resizeClipRanges([], 1, 300);
    expect(next).toHaveLength(1);
    expect(next[0].start).toBe(0);
  });

  test('clips near the end of a short video stay in bounds', () => {
    const next = resizeClipRanges([{ start: 0, end: 15 }], 3, 40);
    next.forEach((r) => {
      expect(r.start).toBeGreaterThanOrEqual(0);
      expect(r.end).toBeLessThanOrEqual(40);
      expect(r.end - r.start).toBeGreaterThanOrEqual(CLIP_MIN_SEC);
    });
  });
});
