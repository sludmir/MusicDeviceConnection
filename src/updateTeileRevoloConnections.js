/**
 * Helper function to update Teile Revolo connection points
 * Run this from browser console after signing in:
 * 
 * import('./updateTeileRevoloConnections.js').then(m => m.updateTeileRevoloConnections())
 */

import { productManager } from './productManager';
import { auth } from './firebaseConfig';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebaseConfig';

export async function updateTeileRevoloConnections() {
  try {
    // Check if user is authenticated
    if (!auth.currentUser) {
      console.error('❌ Please sign in first before updating products');
      return { success: false, error: 'User not authenticated' };
    }

    console.log('Finding Teile Revolo product...');
    
    // Find the product by name
    const productsRef = collection(db, 'products');
    const q = query(productsRef, where('name', '==', 'Teile Revolo'));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      console.error('❌ Teile Revolo product not found. Please add it first.');
      return { success: false, error: 'Product not found' };
    }

    const productDoc = querySnapshot.docs[0];
    const productId = productDoc.id;
    const productData = productDoc.data();
    
    console.log('Found Teile Revolo:', productId);
    console.log('Current product data:', productData);
    
    // Define connection points for Teile Revolo
    // Based on the helper script, these are FX unit connection points
    const connectionPoints = {
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
      ]
    };

    // Update the product with connection points
    const updateData = {
      ...productData,
      inputs: connectionPoints.inputs,
      outputs: connectionPoints.outputs
    };

    console.log('Updating product with connection points:', updateData);
    
    const result = await productManager.updateProduct(productId, updateData);
    
    if (result.success) {
      console.log('✅ Successfully updated Teile Revolo connection points!');
      console.log('Inputs:', connectionPoints.inputs);
      console.log('Outputs:', connectionPoints.outputs);
      return result;
    } else {
      console.error('❌ Failed to update connection points:', result.error);
      return result;
    }
  } catch (error) {
    console.error('Error updating Teile Revolo connections:', error);
    return { success: false, error: error.message };
  }
}

// Make it available globally for easy access
if (typeof window !== 'undefined') {
  window.updateTeileRevoloConnections = updateTeileRevoloConnections;
}
