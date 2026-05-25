jest.mock('firebase/firestore', () => ({
  doc: jest.fn((_db, col, id) => ({ col, id })),
  getDoc: jest.fn(),
  setDoc: jest.fn(() => Promise.resolve()),
  serverTimestamp: jest.fn(() => 'SERVER_TS'),
}));
jest.mock('../firebaseConfig', () => ({ db: {}, auth: { currentUser: { uid: 'admin-uid' } } }));

import { getDefaultLayout, SUGGESTION_OPTIONS, makeSpotType, loadLayout, saveLayout, layoutDocId } from './ghostSpotLayout';
import { getDoc, setDoc, doc } from 'firebase/firestore';

describe('getDefaultLayout', () => {
  test('DJ layout contains the mixer spot and four player spots', () => {
    const dj = getDefaultLayout('DJ');
    const types = dj.map((s) => s.type);
    expect(types).toContain('middle');
    expect(types).toContain('middle_left');
    expect(types).toContain('middle_right');
    expect(types).toContain('far_left');
    expect(types).toContain('far_right');
  });

  test('DJ mixer spot has Mixer recommendedType and is not reveal-gated', () => {
    const mixer = getDefaultLayout('DJ').find((s) => s.type === 'middle');
    expect(mixer.recommendedType).toBe('Mixer (DJM)');
    expect(mixer.revealAfterBasic).toBe(false);
    expect(mixer).toMatchObject({ x: 0, y: 1.05, z: 0 });
  });

  test('DJ FX spots are reveal-gated (revealAfterBasic true)', () => {
    const fxTop = getDefaultLayout('DJ').find((s) => s.type === 'fx_top');
    expect(fxTop.revealAfterBasic).toBe(true);
    expect(fxTop.recommendedType).toBe('FX Unit (RMX-1000)');
  });

  test('DJ default layout does NOT include the never-rendered inner/back spots', () => {
    const types = getDefaultLayout('DJ').map((s) => s.type);
    expect(types).not.toContain('middle_left_inner');
    expect(types).not.toContain('middle_right_inner');
    expect(types).not.toContain('middle_back');
  });

  test('Producer layout has desk center as Audio Interface and 8 rack spots', () => {
    const prod = getDefaultLayout('Producer');
    expect(prod.find((s) => s.type === 'desk_center').recommendedType).toBe('Audio Interface');
    expect(prod.filter((s) => s.type.startsWith('rack_')).length).toBe(8);
  });

  test('Musician layout has 4 pedal spots and 2 amps', () => {
    const mus = getDefaultLayout('Musician');
    expect(mus.filter((s) => s.type.startsWith('pedal_')).length).toBe(4);
    expect(mus.filter((s) => s.type.startsWith('amp_')).length).toBe(2);
  });

  test('every default spot has a stable id, numeric coords and a recommendedType', () => {
    for (const setupType of ['DJ', 'Producer', 'Musician']) {
      for (const spot of getDefaultLayout(setupType)) {
        expect(typeof spot.id).toBe('string');
        expect(typeof spot.type).toBe('string');
        expect(typeof spot.recommendedType).toBe('string');
        expect(typeof spot.x).toBe('number');
        expect(typeof spot.y).toBe('number');
        expect(typeof spot.z).toBe('number');
        expect(typeof spot.revealAfterBasic).toBe('boolean');
      }
    }
  });

  test('unknown setup type returns empty array', () => {
    expect(getDefaultLayout('Nope')).toEqual([]);
  });
});

describe('SUGGESTION_OPTIONS', () => {
  test('includes the union of recommendedType labels plus Any Device', () => {
    expect(SUGGESTION_OPTIONS).toEqual(expect.arrayContaining([
      'Mixer (DJM)', 'Player (CDJ)', 'FX Unit (RMX-1000)', 'FX / Filter (Revolo)',
      'FX Unit / Sampler', 'Speaker', 'Audio Interface', 'Controller / Synth',
      'Rack Unit / Processor', 'Studio Monitor', 'Instrument / Mic', 'Guitar / Bass',
      'Keyboard / Instrument', 'Drums / Instrument', 'Effects Pedal',
      'Amplifier / Monitor', 'Any Device',
    ]));
  });

  test('has no duplicate entries', () => {
    expect(new Set(SUGGESTION_OPTIONS).size).toBe(SUGGESTION_OPTIONS.length);
  });
});

describe('makeSpotType', () => {
  test('generates a unique custom- prefixed type', () => {
    const a = makeSpotType();
    const b = makeSpotType();
    expect(a.startsWith('custom-')).toBe(true);
    expect(a).not.toBe(b);
  });
});

describe('layoutDocId', () => {
  test('joins setupType and settingKey', () => {
    expect(layoutDocId('DJ', 'club')).toBe('DJ__club');
    expect(layoutDocId('Musician', 'guitarRoom')).toBe('Musician__guitarRoom');
  });
});

describe('loadLayout', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns stored spots when the doc exists', async () => {
    const stored = [{ id: 'x', type: 'x', recommendedType: 'Speaker', x: 1, y: 2, z: 3, rotationY: 0, size: { width: 0.3, depth: 0.3 }, revealAfterBasic: false }];
    getDoc.mockResolvedValueOnce({ exists: () => true, data: () => ({ spots: stored }) });
    const result = await loadLayout('DJ', 'club');
    expect(doc).toHaveBeenCalledWith({}, 'ghostSpotLayouts', 'DJ__club');
    expect(result).toEqual(stored);
  });

  test('falls back to default layout when the doc does not exist', async () => {
    getDoc.mockResolvedValueOnce({ exists: () => false });
    const result = await loadLayout('DJ', 'club');
    expect(result.find((s) => s.type === 'middle').recommendedType).toBe('Mixer (DJM)');
  });

  test('falls back to default layout on read error', async () => {
    getDoc.mockRejectedValueOnce(new Error('offline'));
    const result = await loadLayout('Producer', 'studio');
    expect(result.find((s) => s.type === 'desk_center')).toBeTruthy();
  });
});

describe('saveLayout', () => {
  beforeEach(() => jest.clearAllMocks());

  test('writes the doc with metadata', async () => {
    const spots = [{ id: 'a', type: 'a', recommendedType: 'Speaker', x: 0, y: 0, z: 0, rotationY: 0, size: { width: 0.3, depth: 0.3 }, revealAfterBasic: false }];
    await saveLayout('DJ', 'rooftop', spots);
    expect(setDoc).toHaveBeenCalledTimes(1);
    const [, payload] = setDoc.mock.calls[0];
    expect(payload).toMatchObject({
      setupType: 'DJ',
      settingKey: 'rooftop',
      spots,
      updatedBy: 'admin-uid',
      updatedAt: 'SERVER_TS',
    });
  });
});
