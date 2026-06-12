/**
 * Product Recommendation Utilities
 *
 * Pure functions for matching and filtering products based on ghost spot
 * recommendations (e.g., "Mixer (DJM)", "Player (CDJ)", "Effects Unit").
 *
 * These are consumed by ProductSelectorModal (Task 9) and ThreeScene.js
 * to hard-filter and sort product lists when a ghost spot is clicked.
 */

const NORMALIZE = (s) => (s || '').toString().toLowerCase();

/**
 * Check if a product matches a recommended type string.
 * @param {Object} product - Product object with id, name, type, subcategory, etc.
 * @param {string} recommendedType - Recommendation string (e.g., "Mixer (DJM)", "Any Device")
 * @returns {boolean} True if product matches the recommended type
 */
export function isProductRecommended(product, recommendedType) {
  if (!product || !recommendedType) return false;

  // Special cases: "Any Device" and "Instrument or Effects" return no matches
  if (recommendedType === 'Any Device' || recommendedType === 'Instrument or Effects') {
    return false;
  }

  const name = NORMALIZE(product.name);
  const type = NORMALIZE(product.type);
  const sub = NORMALIZE(product.subcategory);

  switch (recommendedType) {
    case 'Mixer (DJM)':
      return (
        type.includes('mixer') ||
        sub.includes('mixer') ||
        name.includes('djm') ||
        name.includes('mixer')
      );

    case 'Player (CDJ)':
      return (
        type.includes('player') ||
        sub.includes('player') ||
        name.includes('cdj') ||
        name.includes('player')
      );

    case 'Effects Unit':
    case 'Effects Pedal':
      return (
        type.includes('effect') ||
        sub.includes('effect') ||
        name.includes('rmx') ||
        name.includes('fx')
      );

    case 'Speaker':
      return (
        type.includes('speaker') ||
        sub.includes('monitor') ||
        sub.includes('speaker')
      );

    case 'Studio Monitor':
      return (
        type.includes('monitor') ||
        sub.includes('monitor') ||
        name.includes('monitor') ||
        name.includes('genelec') ||
        name.includes('krk') ||
        name.includes('adam') ||
        name.includes('yamaha hs')
      );

    case 'Audio Interface':
      return type.includes('interface') || sub.includes('interface');

    case 'Laptop':
      return (
        type.includes('laptop') ||
        name.includes('laptop') ||
        name.includes('macbook')
      );

    case 'Synthesizer':
      return type.includes('synth') || sub.includes('synth');

    case 'Controller':
      return type.includes('controller') || sub.includes('controller');

    case 'Microphone':
      return type.includes('mic') || sub.includes('microphone');

    case 'Guitar / Bass':
      return (
        type.includes('guitar') ||
        type.includes('bass') ||
        name.includes('guitar') ||
        name.includes('bass')
      );

    case 'Amplifier':
      return (
        type.includes('amp') ||
        sub.includes('amp') ||
        name.includes('amp')
      );

    default: {
      // Fallback: match recommendedType string against product fields
      const r = NORMALIZE(recommendedType);
      return type.includes(r) || sub.includes(r) || name.includes(r);
    }
  }
}

/**
 * Hard-filter products by recommended type.
 * Returns all products for "Any Device"; returns empty array for empty/invalid type.
 * @param {Array} products - Array of product objects
 * @param {string} recommendedType - Recommendation string
 * @returns {Array} Filtered products
 */
export function filterByRecommendedType(products, recommendedType) {
  if (!recommendedType || recommendedType === 'Instrument or Effects') {
    return products;
  }

  if (recommendedType === 'Any Device') {
    return products;
  }

  return products.filter((p) => isProductRecommended(p, recommendedType));
}

/**
 * Sort products by recommendation match.
 * Matching products appear first, then sorted alphabetically by name.
 * Non-matching products follow, also sorted alphabetically.
 * @param {Array} products - Array of product objects
 * @param {string} recommendedType - Recommendation string
 * @returns {Array} Sorted products
 */
export function sortProductsByRecommendation(products, recommendedType) {
  if (!recommendedType) {
    return [...products];
  }

  return [...products].sort((a, b) => {
    const aRecommended = isProductRecommended(a, recommendedType) ? 0 : 1;
    const bRecommended = isProductRecommended(b, recommendedType) ? 0 : 1;

    // Recommended products come first
    if (aRecommended !== bRecommended) {
      return aRecommended - bRecommended;
    }

    // Then sort alphabetically by name
    return (a.name || '').localeCompare(b.name || '');
  });
}
