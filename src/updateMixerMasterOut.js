/**
 * Helper function to update Master Out port coordinates for the DJM-900NXS2 mixer
 * Run this from browser console after signing in:
 * 
 * import('./src/updateMixerMasterOut.js').then(m => m.updateMixerMasterOut())
 */

import { productManager } from './productManager';
import { auth } from './firebaseConfig';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebaseConfig';

export async function updateMixerMasterOut() {
  try {
    // Check if user is authenticated
    if (!auth.currentUser) {
      console.error('❌ Please sign in first before updating products');
      return { success: false, error: 'User not authenticated' };
    }

    console.log('Finding DJM-900NXS2 mixer...');
    
    // Find the mixer by name
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
    console.log('Current outputs:', productData.outputs);
    
    // Get existing outputs
    const existingOutputs = productData.outputs || [];
    
    // Find Master Out port and update its coordinates
    const updatedOutputs = existingOutputs.map(output => {
      if (output.type && output.type.toLowerCase().includes('master')) {
        console.log('Updating Master Out coordinates from:', output.coordinate, 'to: { x: 0.06, y: 0.075, z: -0.28 }');
        return {
          ...output,
          coordinate: { x: 0.06, y: 0.075, z: -0.28 }  // On top of mixer, slightly right of CDJ cables
        };
      }
      return output;
    });
    
    // Check if Master Out was found and updated
    const masterOutFound = existingOutputs.some(output => 
      output.type && output.type.toLowerCase().includes('master')
    );
    
    if (!masterOutFound) {
      console.warn('⚠️ Master Out port not found in outputs. Adding it...');
      updatedOutputs.push({
        type: "Master Out",
        coordinate: { x: 0.06, y: 0.075, z: -0.28 }
      });
    }

    // Update the mixer with new output coordinates
    const updateData = {
      ...productData,
      outputs: updatedOutputs
    };

    console.log('Updating mixer with new Master Out coordinates:', updateData);
    
    const result = await productManager.updateProduct(productId, updateData);
    
    if (result.success) {
      console.log('✅ Successfully updated Master Out coordinates!');
      console.log('New outputs:', updatedOutputs);
      console.log('🔄 Please refresh the page for changes to take effect');
      return result;
    } else {
      console.error('❌ Failed to update mixer coordinates:', result.error);
      return result;
    }
  } catch (error) {
    console.error('Error updating mixer coordinates:', error);
    return { success: false, error: error.message };
  }
}

// Make it available globally for easy access
if (typeof window !== 'undefined') {
  window.updateMixerMasterOut = updateMixerMasterOut;
}
