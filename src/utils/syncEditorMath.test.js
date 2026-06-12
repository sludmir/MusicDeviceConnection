import { nudgeOffset, angleTimeAtMaster, formatOffsetMs } from './syncEditorMath';

describe('nudgeOffset', () => {
  test('adds delta to current offset', () => {
    expect(nudgeOffset(1.0, 0.01, 60)).toBeCloseTo(1.01);
    expect(nudgeOffset(1.0, -0.1, 60)).toBeCloseTo(0.9);
  });
  test('treats null/undefined current as 0', () => {
    expect(nudgeOffset(undefined, 0.1, 60)).toBeCloseTo(0.1);
    expect(nudgeOffset(null, -0.01, 60)).toBeCloseTo(-0.01);
  });
  test('clamps to ±previewDuration', () => {
    expect(nudgeOffset(59.95, 0.1, 60)).toBe(60);
    expect(nudgeOffset(-59.95, -0.1, 60)).toBe(-60);
  });
});

describe('angleTimeAtMaster', () => {
  test('subtracts offset from master time', () => {
    expect(angleTimeAtMaster(10, 2)).toBe(8);
    expect(angleTimeAtMaster(10, -1.5)).toBe(11.5);
  });
  test('missing offset means 0', () => {
    expect(angleTimeAtMaster(10, undefined)).toBe(10);
  });
});

describe('formatOffsetMs', () => {
  test('formats with sign and 3 decimals', () => {
    expect(formatOffsetMs(1.2345)).toBe('+1.234s');
    expect(formatOffsetMs(-0.01)).toBe('−0.010s');
    expect(formatOffsetMs(0)).toBe('+0.000s');
  });
  test('non-finite input renders as zero', () => {
    expect(formatOffsetMs(NaN)).toBe('+0.000s');
  });
});
