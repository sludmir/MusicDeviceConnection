import {
  VARIANTS_BY_SETUP,
  getDefaultVariant,
  getVariantLabel,
  isValidVariant,
} from './sceneVariants';

describe('sceneVariants', () => {
  test('every setup type has exactly 2 variants', () => {
    expect(VARIANTS_BY_SETUP.DJ).toHaveLength(2);
    expect(VARIANTS_BY_SETUP.Producer).toHaveLength(2);
    expect(VARIANTS_BY_SETUP.Musician).toHaveLength(2);
  });

  test('default variant is the first one (legacy "A")', () => {
    expect(getDefaultVariant('DJ')).toBe('dj-club');
    expect(getDefaultVariant('Producer')).toBe('producer-studio-desk');
    expect(getDefaultVariant('Musician')).toBe('musician-rehearsal');
  });

  test('getVariantLabel returns label for known key', () => {
    expect(getVariantLabel('dj-rooftop')).toBe('Rooftop');
  });

  test('getVariantLabel returns null for unknown key', () => {
    expect(getVariantLabel('not-a-thing')).toBeNull();
  });

  test('isValidVariant checks key against setup type', () => {
    expect(isValidVariant('DJ', 'dj-rooftop')).toBe(true);
    expect(isValidVariant('DJ', 'producer-bedroom')).toBe(false);
    expect(isValidVariant('Producer', 'unknown')).toBe(false);
  });
});
