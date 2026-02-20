/**
 * Paste this entire script into your browser console to add Send/Return ports to the mixer
 * Make sure you're signed in first!
 */

(async function addMixerSendReturnPorts() {
  try {
    // Import Firebase functions
    const { collection, getDocs, query, where, doc, updateDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
    const { db } = await import('./src/firebaseConfig.js');
    const { auth } = await import('./src/firebaseConfig.js');
    const { productManager } = await import('./src/productManager.js');
    
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
        coordinate: { x: 0.3, y: 0.2, z: 0.5 } // Position on the mixer's output side
      });
      console.log('Adding Send Out port');
    }
    
    // Add Return In (input) if it doesn't exist
    if (!hasReturnIn) {
      newInputs.push({
        type: "Return In",
        coordinate: { x: 0.08, y: 0.09, z: -0.3 } // Position on the mixer's input side
      });
      console.log('Adding Return In port');
    }

    // Update the mixer with new ports using productManager
    const result = await productManager.updateProduct(productId, {
      ...productData,
      inputs: newInputs,
      outputs: newOutputs
    });
    
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
    console.error('Full error:', error);
    return { success: false, error: error.message };
  }
})();
