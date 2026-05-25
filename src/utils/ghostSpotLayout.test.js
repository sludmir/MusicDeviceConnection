import { getDefaultLayout, SUGGESTION_OPTIONS, makeSpotType } from './ghostSpotLayout';

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
