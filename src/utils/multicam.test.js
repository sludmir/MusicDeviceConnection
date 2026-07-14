import {
  MIN_SEGMENT_SEC,
  normalizeCuts,
  angleIndexAt,
  addCut,
  moveCut,
  removeCut,
  setSegmentAngle,
  cutsToSegments,
} from './multicam';

describe('normalizeCuts', () => {
  it('returns the default cut list for empty/invalid input', () => {
    expect(normalizeCuts(null)).toEqual([{ timeSec: 0, angleIndex: 0 }]);
    expect(normalizeCuts([])).toEqual([{ timeSec: 0, angleIndex: 0 }]);
    expect(normalizeCuts('nope')).toEqual([{ timeSec: 0, angleIndex: 0 }]);
  });

  it('sorts by time and forces the first cut to timeSec 0', () => {
    expect(normalizeCuts([
      { timeSec: 10, angleIndex: 1 },
      { timeSec: 4, angleIndex: 2 },
    ])).toEqual([
      { timeSec: 0, angleIndex: 2 },
      { timeSec: 10, angleIndex: 1 },
    ]);
  });

  it('clamps angleIndex into [0, maxAngleIndex] and floors NaN to 0', () => {
    expect(normalizeCuts([
      { timeSec: 0, angleIndex: 7 },
      { timeSec: 5, angleIndex: -1 },
      { timeSec: 12, angleIndex: NaN },
    ], { maxAngleIndex: 2 })).toEqual([
      { timeSec: 0, angleIndex: 2 },
      { timeSec: 5, angleIndex: 0 },
      // 12s cut dropped: angle NaN→0 equals previous angle 0 → merged
    ]);
  });

  it('drops cuts closer than MIN_SEGMENT_SEC to the previous cut', () => {
    expect(normalizeCuts([
      { timeSec: 0, angleIndex: 0 },
      { timeSec: 5, angleIndex: 1 },
      { timeSec: 5.2, angleIndex: 2 },
    ])).toEqual([
      { timeSec: 0, angleIndex: 0 },
      { timeSec: 5, angleIndex: 1 },
    ]);
  });

  it('merges consecutive same-angle cuts', () => {
    expect(normalizeCuts([
      { timeSec: 0, angleIndex: 0 },
      { timeSec: 5, angleIndex: 0 },
      { timeSec: 9, angleIndex: 1 },
    ])).toEqual([
      { timeSec: 0, angleIndex: 0 },
      { timeSec: 9, angleIndex: 1 },
    ]);
  });
});

describe('angleIndexAt', () => {
  const cuts = [
    { timeSec: 0, angleIndex: 0 },
    { timeSec: 10, angleIndex: 1 },
    { timeSec: 20, angleIndex: 0 },
  ];
  it('returns the angle of the segment containing t', () => {
    expect(angleIndexAt(cuts, 0)).toBe(0);
    expect(angleIndexAt(cuts, 9.99)).toBe(0);
    expect(angleIndexAt(cuts, 10)).toBe(1);
    expect(angleIndexAt(cuts, 15)).toBe(1);
    expect(angleIndexAt(cuts, 25)).toBe(0);
  });
  it('is safe for empty lists and negative times', () => {
    expect(angleIndexAt([], 5)).toBe(0);
    expect(angleIndexAt(cuts, -3)).toBe(0);
  });
});

describe('addCut', () => {
  const base = [{ timeSec: 0, angleIndex: 0 }];
  it('inserts a sorted cut', () => {
    expect(addCut(base, 12, 1)).toEqual([
      { timeSec: 0, angleIndex: 0 },
      { timeSec: 12, angleIndex: 1 },
    ]);
  });
  it('does not mutate the input', () => {
    const copy = base.slice();
    addCut(base, 12, 1);
    expect(base).toEqual(copy);
  });
  it('retargets an existing cut within MIN_SEGMENT_SEC instead of stacking', () => {
    const cuts = [
      { timeSec: 0, angleIndex: 0 },
      { timeSec: 10, angleIndex: 1 },
    ];
    expect(addCut(cuts, 10.2, 2)).toEqual([
      { timeSec: 0, angleIndex: 0 },
      { timeSec: 10, angleIndex: 2 },
    ]);
  });
  it('adding at 0 replaces the opening angle', () => {
    expect(addCut(base, 0, 2)).toEqual([{ timeSec: 0, angleIndex: 2 }]);
  });
  it('drops a cut that would not change the angle', () => {
    expect(addCut(base, 12, 0)).toEqual(base);
  });
});

describe('moveCut', () => {
  const cuts = [
    { timeSec: 0, angleIndex: 0 },
    { timeSec: 10, angleIndex: 1 },
    { timeSec: 20, angleIndex: 2 },
  ];
  it('moves a cut, clamped between neighbors ± MIN_SEGMENT_SEC', () => {
    expect(moveCut(cuts, 1, 14)[1].timeSec).toBe(14);
    expect(moveCut(cuts, 1, 0.1)[1].timeSec).toBe(MIN_SEGMENT_SEC);
    expect(moveCut(cuts, 1, 25)[1].timeSec).toBe(20 - MIN_SEGMENT_SEC);
  });
  it('never moves index 0', () => {
    expect(moveCut(cuts, 0, 5)).toEqual(cuts);
  });
});

describe('removeCut / setSegmentAngle', () => {
  const cuts = [
    { timeSec: 0, angleIndex: 0 },
    { timeSec: 10, angleIndex: 1 },
    { timeSec: 20, angleIndex: 0 },
  ];
  it('removes a non-zero cut (segment merges into previous)', () => {
    expect(removeCut(cuts, 1)).toEqual([
      { timeSec: 0, angleIndex: 0 },
      // 20s cut survives; still a change vs previous angle 0? No: previous is
      // now angle 0 and cut 20 targets 0 → merged away by normalize.
    ]);
  });
  it('refuses to remove index 0', () => {
    expect(removeCut(cuts, 0)).toEqual(cuts);
  });
  it('setSegmentAngle changes one segment and re-normalizes', () => {
    expect(setSegmentAngle(cuts, 1, 2)[1]).toEqual({ timeSec: 10, angleIndex: 2 });
    // Setting segment 1 to angle 0 merges it into both neighbors:
    expect(setSegmentAngle(cuts, 1, 0)).toEqual([{ timeSec: 0, angleIndex: 0 }]);
  });
});

describe('cutsToSegments', () => {
  it('converts cuts to [start,end) segments ending at duration', () => {
    expect(cutsToSegments([
      { timeSec: 0, angleIndex: 0 },
      { timeSec: 10, angleIndex: 1 },
    ], 30)).toEqual([
      { start: 0, end: 10, angleIndex: 0 },
      { start: 10, end: 30, angleIndex: 1 },
    ]);
  });
  it('drops cuts at/after duration', () => {
    expect(cutsToSegments([
      { timeSec: 0, angleIndex: 0 },
      { timeSec: 40, angleIndex: 1 },
    ], 30)).toEqual([{ start: 0, end: 30, angleIndex: 0 }]);
  });
});
