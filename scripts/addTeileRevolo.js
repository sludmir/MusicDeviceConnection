/**
 * Script to add Teile Revolo as an FX unit to Firestore
 * Run this from the browser console after signing in
 * 
 * Usage in browser console:
 * import('./addTeileRevolo.js').then(module => module.default())
 */

import { productManager } from './src/productManager.js';
import { auth } from './src/firebaseConfig.js';

async function addTeileRevolo() {
  try {
    // Check if user is authenticated
    if (!auth.currentUser) {
      console.error('❌ Please sign in first before adding products');
      console.log('💡 Sign in through the app, then run this script again');
      return { success: false, error: 'User not authenticated' };
    }

    console.log('Adding Teile Revolo product to Firestore...');
    console.log('Signed in as:', auth.currentUser.email);
    
    // Product data for Teile Revolo
    const productData = {
      name: "Teile Revolo",
      type: "fx_unit", // This will map to EFFECTS role in devicePlacement
      brand: "Revolo",
      description: "FX unit for DJ setups",
      category: "DJ",
      subcategory: "effects", // FX unit category
      price: 440, // Set price as requested
      locationPriority: 1000,
      inputs: [
        {
          type: "Return In",
          coordinate: { x: -0.065, y: 0.09, z: -0.3 }
        },
        {
          type: "Send In", 
          coordinate: { x: -0.12, y: 0.09, z: -0.3 }
        }
      ],
      outputs: [
        {
          type: "Return Out",
          coordinate: { x: 0.5, y: 0.2, z: 0.5 }
        },
        {
          type: "Send Out",
          coordinate: { x: 0.6, y: 0.2, z: 0.5 }
        }
      ],
      connections: [],
      specifications: {},
      features: [],
      modelPath: "/models/RENDERS/small_Teile_Revolo.glb", // Local path to model for testing
      isActive: true,
      setupTypes: ["DJ"] // Can be used in DJ setups
    };

    // Validate product data
    const validation = productManager.validateProduct(productData);
    if (!validation.isValid) {
      console.error('Validation errors:', validation.errors);
      return { success: false, error: validation.errors.join(', ') };
    }

    // Add product to Firestore (without uploading model file - using local path)
    const result = await productManager.addProduct(productData);
    
    if (result.success) {
      console.log('✅ Successfully added Teile Revolo!');
      console.log('Product ID:', result.id);
      console.log('Name:', productData.name);
      console.log('Category: DJ > Effects');
      console.log('Price: $' + productData.price);
      console.log('Model Path:', productData.modelPath);
      return result;
    } else {
      console.error('❌ Failed to add product:', result.error);
      return result;
    }
  } catch (error) {
    console.error('Error adding Teile Revolo:', error);
    return { success: false, error: error.message };
  }
}

// Export for use in browser console
if (typeof window !== 'undefined') {
  window.addTeileRevolo = addTeileRevolo;
}

// Run if called directly (for Node.js environments)
if (typeof process !== 'undefined' && process.argv) {
  // This would require Firebase Admin SDK for Node.js
  console.log('For Node.js, use Firebase Admin SDK or run from browser console');
}

export default addTeileRevolo;
