/**
 * Paste this entire script into your browser console to update Master Out coordinates
 * Make sure you're signed in first!
 */

(async function updateMixerMasterOut() {
  try {
    // Try to access Firebase from the React app's context
    // First, try to get it from the window or React DevTools
    let db, auth, collection, getDocs, query, where, doc, updateDoc;
    
    // Method 1: Try to import from the app's modules (if available in window)
    try {
      const firebaseModule = await import('./src/firebaseConfig.js');
      db = firebaseModule.db;
      auth = firebaseModule.auth;
      const firestoreModule = await import('firebase/firestore');
      collection = firestoreModule.collection;
      getDocs = firestoreModule.getDocs;
      query = firestoreModule.query;
      where = firestoreModule.where;
      doc = firestoreModule.doc;
      updateDoc = firestoreModule.updateDoc;
    } catch (e) {
      console.log('Trying alternative method to access Firebase...');
      // Method 2: Use Firebase from CDN (fallback)
      const firebaseApp = window.firebase || window.firebaseApp;
      if (!firebaseApp) {
        throw new Error('Firebase not found. Make sure you are on the app page and Firebase is loaded.');
      }
      db = firebaseApp.firestore();
      auth = firebaseApp.auth();
      collection = firebaseApp.firestore().collection;
      getDocs = firebaseApp.firestore().getDocs;
      query = firebaseApp.firestore().query;
      where = firebaseApp.firestore().where;
      doc = firebaseApp.firestore().doc;
      updateDoc = firebaseApp.firestore().updateDoc;
    }
    
    // Check if user is authenticated
    if (!auth || !auth.currentUser) {
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
    let masterOutFound = false;
    const updatedOutputs = existingOutputs.map(output => {
      if (output.type && output.type.toLowerCase().includes('master')) {
        masterOutFound = true;
        console.log('Updating Master Out coordinates from:', output.coordinate, 'to: { x: 0.06, y: 0.075, z: -0.28 }');
        return {
          ...output,
          coordinate: { x: 0.06, y: 0.075, z: -0.28 }  // On top of mixer, slightly right of CDJ cables
        };
      }
      return output;
    });
    
    // Check if Master Out was found and updated
    if (!masterOutFound) {
      console.warn('⚠️ Master Out port not found in outputs. Adding it...');
      updatedOutputs.push({
        type: "Master Out",
        coordinate: { x: 0.06, y: 0.075, z: -0.28 }
      });
    }

    // Update the mixer with new output coordinates
    const productRef = doc(db, 'products', productId);
    await updateDoc(productRef, {
      outputs: updatedOutputs
    });

    console.log('✅ Successfully updated Master Out coordinates!');
    console.log('New outputs:', updatedOutputs);
    console.log('🔄 Please refresh the page for changes to take effect');
    return { success: true };
  } catch (error) {
    console.error('Error updating mixer coordinates:', error);
    return { success: false, error: error.message };
  }
})();
