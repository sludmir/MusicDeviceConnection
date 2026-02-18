/**
 * Helper function to add Teile Revolo product
 * Run this from browser console after signing in:
 * 
 * import('./addTeileRevoloHelper.js').then(m => m.addTeileRevolo())
 */

import { productManager } from './productManager';
import { auth } from './firebaseConfig';

export async function addTeileRevolo() {
  try {
    // Check if user is authenticated
    if (!auth.currentUser) {
      console.error('❌ Please sign in first before adding products');
      return { success: false, error: 'User not authenticated' };
    }

    console.log('Adding Teile Revolo product to Firestore...');
    console.log('Signed in as:', auth.currentUser.email);
    
    // Product data for Teile Revolo
    const productData = {
      name: "Teile Revolo",
      type: "fx_unit",
      brand: "Revolo",
      description: "FX unit for DJ setups",
      category: "DJ",
      subcategory: "effects",
      price: 440,
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
      modelPath: "/models/RENDERS/small_Teile_Revolo.glb",
      isActive: true,
      setupTypes: ["DJ"] // Make sure it appears in DJ setups
    };

    // Validate product data
    const validation = productManager.validateProduct(productData);
    if (!validation.isValid) {
      console.error('Validation errors:', validation.errors);
      return { success: false, error: validation.errors.join(', ') };
    }

    // Store the modelPath before adding (since addProduct overwrites it)
    const modelPath = productData.modelPath;
    
    // Add product to Firestore (without model file - we'll set modelPath after)
    const result = await productManager.addProduct(productData);
    
    if (result.success) {
      // Update the product with the local model path
      const updateResult = await productManager.updateProduct(result.id, { modelPath });
      
      if (updateResult.success) {
        console.log('✅ Successfully added Teile Revolo!');
        console.log('Product ID:', result.id);
        console.log('Name:', productData.name);
        console.log('Category: DJ > Effects');
        console.log('Price: $' + productData.price);
        console.log('Model Path:', modelPath);
        return { ...result, modelPath };
      } else {
        console.warn('⚠️ Product added but modelPath update failed:', updateResult.error);
        return result;
      }
    } else {
      console.error('❌ Failed to add product:', result.error);
      return result;
    }
  } catch (error) {
    console.error('Error adding Teile Revolo:', error);
    return { success: false, error: error.message };
  }
}

// Make it available globally for easy access
if (typeof window !== 'undefined') {
  window.addTeileRevolo = addTeileRevolo;
}

// Also export a function to add Send/Return ports to mixer
export async function addMixerSendReturnPorts() {
  try {
    // Check if user is authenticated
    if (!auth.currentUser) {
      console.error('❌ Please sign in first before updating products');
      return { success: false, error: 'User not authenticated' };
    }

    console.log('Finding DJM-900NXS2 mixer...');
    
    // Import Firestore functions
    const firestoreModule = await import('firebase/firestore');
    const { collection, getDocs, query, where } = firestoreModule;
    
    // Import db from firebaseConfig
    const firebaseConfigModule = await import('./firebaseConfig.js');
    const db = firebaseConfigModule.db;
    
    const productsRef = collection(db, 'products');
    const q = query(productsRef, where('name', '==', 'DJM-900NXS2'));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      console.error('❌ DJM-900NXS2 mixer not found. Please add it first.');
      return { success: false, error: 'Mixer not found' };
    }

    const productDoc = querySnapshot.docs[0];
    const productId = productDoc.id;
    const productData = productDoc.data();
    
    console.log('Found mixer:', productId);
    console.log('Current mixer data:', productData);
    
    // Get existing inputs and outputs
    const existingInputs = productData.inputs || [];
    const existingOutputs = productData.outputs || [];
    
    // Check if Send/Return ports already exist
    const hasSendOut = existingOutputs.some(output => 
      output.type && output.type.toLowerCase().includes('send')
    );
    const hasReturnIn = existingInputs.some(input => 
      input.type && input.type.toLowerCase().includes('return')
    );
    
    if (hasSendOut && hasReturnIn) {
      console.log('✅ Mixer already has Send/Return ports!');
      return { success: true, message: 'Ports already exist' };
    }
    
    // Define Send/Return ports for the mixer
    const newInputs = [...existingInputs];
    const newOutputs = [...existingOutputs];
    
    // Add Send Out (output) if it doesn't exist
    if (!hasSendOut) {
      newOutputs.push({
        type: "Send Out",
        coordinate: { x: 0.3, y: 0.2, z: 0.5 }
      });
      console.log('Adding Send Out port');
    }
    
    // Add Return In (input) if it doesn't exist
    if (!hasReturnIn) {
      newInputs.push({
        type: "Return In",
        coordinate: { x: 0.08, y: 0.09, z: -0.3 }
      });
      console.log('Adding Return In port');
    }

    // Update the mixer with new ports
    const updateData = {
      ...productData,
      inputs: newInputs,
      outputs: newOutputs
    };

    console.log('Updating mixer with Send/Return ports...');
    
    const result = await productManager.updateProduct(productId, updateData);
    
    if (result.success) {
      console.log('✅ Successfully added Send/Return ports to mixer!');
      console.log('New inputs:', newInputs);
      console.log('New outputs:', newOutputs);
      console.log('🔄 Please refresh the page for changes to take effect');
      return result;
    } else {
      console.error('❌ Failed to update mixer ports:', result.error);
      return result;
    }
  } catch (error) {
    console.error('Error updating mixer ports:', error);
    return { success: false, error: error.message };
  }
}

// Make it available globally
if (typeof window !== 'undefined') {
  window.addMixerSendReturnPorts = addMixerSendReturnPorts;
}
