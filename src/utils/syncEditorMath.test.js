import { nudgeOffset, angleTimeAtMaster, formatOffsetMs, parseClockTime, formatClockTime } from './syncEditorMath';

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

describe('parseClockTime', () => {
  test('parses seconds, m:ss, and h:mm:ss', () => {
    expect(parseClockTime('83')).toBe(83);
    expect(parseClockTime('1:23')).toBe(83);
    expect(parseClockTime('1:02:03')).toBe(3723);
    expect(parseClockTime('0:05.5')).toBe(5.5);
  });
  test('empty or invalid input returns null', () => {
    expect(parseClockTime('')).toBeNull();
    expect(parseClockTime('  ')).toBeNull();
    expect(parseClockTime('abc')).toBeNull();
    expect(parseClockTime('1:xx')).toBeNull();
    expect(parseClockTime(null)).toBeNull();
  });
});

describe('formatClockTime', () => {
  test('formats m:ss and h:mm:ss', () => {
    expect(formatClockTime(83)).toBe('1:23');
    expect(formatClockTime(3723)).toBe('1:02:03');
    expect(formatClockTime(0)).toBe('0:00');
  });
  test('keeps fractional seconds when present', () => {
    expect(formatClockTime(5.5)).toBe('0:05.5');
  });
  test('round-trips with parseClockTime', () => {
    expect(parseClockTime(formatClockTime(383.5))).toBe(383.5);
  });
});
