/**
 * Script to categorize existing products by setup type
 * This helps organize products that were created before proper categorization
 * 
 * Usage: Import this in browser console or create a UI for it
 */

import { db, auth } from './firebaseConfig';
import { collection, getDocs, doc, updateDoc, query, where } from 'firebase/firestore';
import { PRODUCT_CATEGORIES } from './productManager';

/**
 * Categorize a product based on its name, type, and description
 */
function categorizeProduct(product) {
  const name = (product.name || '').toLowerCase();
  const type = (product.type || '').toLowerCase();
  const description = (product.description || '').toLowerCase();
  const brand = (product.brand || '').toLowerCase();
  
  // DJ Equipment patterns
  const djPatterns = {
    players: ['cdj', 'xdj', 'turntable', 'player', 'controller', 'ddj', 'plx'],
    mixers: ['djm', 'mixer', 'xone', 'djm-', 'djm900', 'djm-900'],
    effects: ['rmx', 'fx', 'effects', 'sp-1', 'effects processor'],
    speakers: ['speaker', 'monitor', 'pa system', 'subwoofer'],
    cables: ['cable', 'rca', 'xlr', 'ethernet', 'usb cable'],
    accessories: ['headphone', 'case', 'stand', 'bag']
  };
  
  // Producer Equipment patterns
  const producerPatterns = {
    'audio-interface': ['audio interface', 'focusrite', 'presonus', 'scarlett', 'interface'],
    synthesizers: ['synthesizer', 'synth', 'moog', 'korg', 'sequential', 'prophet', 'minilogue'],
    controllers: ['midi controller', 'pad controller', 'launchpad', 'push', 'mpc'],
    monitors: ['studio monitor', 'monitor', 'yamaha hs', 'krk', 'genelec'],
    microphones: ['microphone', 'mic', 'condenser', 'dynamic mic', 'usb mic'],
    software: ['daw', 'ableton', 'logic', 'pro tools', 'fl studio', 'plugin']
  };
  
  // Musician Equipment patterns
  const musicianPatterns = {
    instruments: ['guitar', 'bass', 'keyboard', 'piano', 'drums', 'violin', 'saxophone'],
    amplifiers: ['amp', 'amplifier', 'guitar amp', 'bass amp', 'combo amp', 'marshall', 'fender'],
    effects: ['pedal', 'effects pedal', 'stompbox', 'rack unit', 'effects processor'],
    microphones: ['microphone', 'mic', 'vocal mic', 'instrument mic', 'shure', 'sm57', 'sm58'],
    cables: ['instrument cable', 'speaker cable', 'guitar cable', 'patch cable'],
    accessories: ['tuner', 'strap', 'pick', 'case', 'stand']
  };
  
  // Check DJ patterns
  for (const [subcategory, patterns] of Object.entries(djPatterns)) {
    for (const pattern of patterns) {
      if (name.includes(pattern) || type.includes(pattern) || description.includes(pattern) || brand.includes(pattern)) {
        return {
          category: 'DJ',
          subcategory: subcategory
        };
      }
    }
  }
  
  // Check Producer patterns
  for (const [subcategory, patterns] of Object.entries(producerPatterns)) {
    for (const pattern of patterns) {
      if (name.includes(pattern) || type.includes(pattern) || description.includes(pattern) || brand.includes(pattern)) {
        return {
          category: 'Producer',
          subcategory: subcategory
        };
      }
    }
  }
  
  // Check Musician patterns
  for (const [subcategory, patterns] of Object.entries(musicianPatterns)) {
    for (const pattern of patterns) {
      if (name.includes(pattern) || type.includes(pattern) || description.includes(pattern) || brand.includes(pattern)) {
        return {
          category: 'Musician',
          subcategory: subcategory
        };
      }
    }
  }
  
  // Default fallback based on type
  if (type.includes('player') || type.includes('cdj') || type.includes('xdj')) {
    return { category: 'DJ', subcategory: 'players' };
  }
  if (type.includes('mixer') || type.includes('djm')) {
    return { category: 'DJ', subcategory: 'mixers' };
  }
  if (type.includes('fx') || type.includes('effects')) {
    return { category: 'DJ', subcategory: 'effects' };
  }
  if (type.includes('computer') || type.includes('laptop')) {
    return { category: 'DJ', subcategory: 'players' }; // Laptops can be used in DJ setups
  }
  
  // Default to DJ if we can't determine
  return { category: 'DJ', subcategory: 'players' };
}

/**
 * Get all products and categorize them
 */
export async function getAllProductsForCategorization() {
  try {
    const productsRef = collection(db, 'products');
    const snapshot = await getDocs(productsRef);
    
    const products = [];
    snapshot.forEach((doc) => {
      products.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return products;
  } catch (error) {
    console.error('Error fetching products:', error);
    return [];
  }
}

/**
 * Categorize a single product
 */
export async function categorizeProductById(productId, category, subcategory) {
  try {
    if (!auth.currentUser) {
      throw new Error('You must be signed in to categorize products');
    }
    
    const productRef = doc(db, 'products', productId);
    await updateDoc(productRef, {
      category: category,
      subcategory: subcategory,
      updatedAt: new Date()
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error categorizing product:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Auto-categorize all products based on their name/type/description
 */
export async function autoCategorizeAllProducts() {
  try {
    if (!auth.currentUser) {
      throw new Error('You must be signed in to categorize products');
    }
    
    const products = await getAllProductsForCategorization();
    const results = {
      updated: [],
      skipped: [],
      errors: []
    };
    
    for (const product of products) {
      // Skip if already properly categorized
      if (product.category && product.subcategory && 
          PRODUCT_CATEGORIES[product.category]?.[product.subcategory]) {
        results.skipped.push({
          id: product.id,
          name: product.name,
          reason: 'Already categorized'
        });
        continue;
      }
      
      // Auto-categorize
      const categorization = categorizeProduct(product);
      
      try {
        await categorizeProductById(product.id, categorization.category, categorization.subcategory);
        results.updated.push({
          id: product.id,
          name: product.name,
          category: categorization.category,
          subcategory: categorization.subcategory
        });
        console.log(`✅ Categorized: ${product.name} → ${categorization.category}/${categorization.subcategory}`);
      } catch (error) {
        results.errors.push({
          id: product.id,
          name: product.name,
          error: error.message
        });
        console.error(`❌ Error categorizing ${product.name}:`, error);
      }
    }
    
    return results;
  } catch (error) {
    console.error('Error in auto-categorization:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get products that need categorization
 */
export async function getUncategorizedProducts() {
  try {
    const products = await getAllProductsForCategorization();
    
    return products.filter(product => {
      // Product needs categorization if:
      // 1. No category/subcategory, OR
      // 2. Category/subcategory doesn't exist in PRODUCT_CATEGORIES
      if (!product.category || !product.subcategory) {
        return true;
      }
      
      if (!PRODUCT_CATEGORIES[product.category]?.[product.subcategory]) {
        return true;
      }
      
      return false;
    });
  } catch (error) {
    console.error('Error getting uncategorized products:', error);
    return [];
  }
}

// Export for browser console use
if (typeof window !== 'undefined') {
  window.categorizeProducts = {
    getAllProductsForCategorization,
    categorizeProductById,
    autoCategorizeAllProducts,
    getUncategorizedProducts,
    categorizeProduct
  };
}

