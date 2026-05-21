import {
  isProductRecommended,
  filterByRecommendedType,
  sortProductsByRecommendation,
} from './productRecommendation';

const mixer = { id: 'm1', name: 'DJM-900', type: 'mixer', subcategory: 'mixers' };
const cdj = { id: 'p1', name: 'CDJ-3000', type: 'player', subcategory: 'players' };
const fx = { id: 'f1', name: 'RMX-1000', type: 'effects', subcategory: 'effects' };

describe('isProductRecommended', () => {
  test('returns false for empty/any recommended type', () => {
    expect(isProductRecommended(mixer, '')).toBe(false);
    expect(isProductRecommended(mixer, 'Any Device')).toBe(false);
    expect(isProductRecommended(mixer, 'Instrument or Effects')).toBe(false);
  });

  test('matches a mixer to "Mixer (DJM)"', () => {
    expect(isProductRecommended(mixer, 'Mixer (DJM)')).toBe(true);
    expect(isProductRecommended(cdj, 'Mixer (DJM)')).toBe(false);
  });

  test('matches a player to "Player (CDJ)"', () => {
    expect(isProductRecommended(cdj, 'Player (CDJ)')).toBe(true);
    expect(isProductRecommended(mixer, 'Player (CDJ)')).toBe(false);
  });

  test('matches effects to "Effects Pedal" or "Effects Unit"', () => {
    expect(isProductRecommended(fx, 'Effects Unit')).toBe(true);
    expect(isProductRecommended(fx, 'Effects Pedal')).toBe(true);
  });
});

describe('filterByRecommendedType', () => {
  const products = [mixer, cdj, fx];

  test('hard-filters to only matching products', () => {
    expect(filterByRecommendedType(products, 'Mixer (DJM)')).toEqual([mixer]);
  });

  test('returns all products for "Any Device"', () => {
    expect(filterByRecommendedType(products, 'Any Device')).toEqual(products);
  });
});

describe('sortProductsByRecommendation', () => {
  test('places matching products before non-matching', () => {
    const sorted = sortProductsByRecommendation([cdj, mixer, fx], 'Mixer (DJM)');
    expect(sorted[0]).toBe(mixer);
  });
});
