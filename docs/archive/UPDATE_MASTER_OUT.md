# Update Master Out Coordinates

Copy and paste this entire script into your browser console (while on the app page):

```javascript
(async function updateMixerMasterOut() {
  try {
    // Access Firebase from the React app's module cache
    // This works because React apps bundle Firebase
    const React = window.__REACT_DEVTOOLS_GLOBAL_HOOK__?.renderers?.get(1)?.version ? 
      require('react') : null;
    
    // Try to get Firebase from the app's context
    // Method 1: Use the Firebase instance from the app if exposed
    let db, auth, collection, getDocs, query, where, doc, updateDoc;
    
    // Check if Firebase is available in window (some apps expose it)
    if (window.firebase || window.__FIREBASE__) {
      const firebase = window.firebase || window.__FIREBASE__;
      db = firebase.firestore();
      auth = firebase.auth();
    } else {
      // Method 2: Try to access through React DevTools or module system
      // Since we can't easily import, let's use a direct Firestore call
      // We'll need to construct the Firestore instance manually
      throw new Error('Please use the Product Manager form in the app to update this, or contact support.');
    }
    
    if (!auth || !auth.currentUser) {
      console.error('❌ Please sign in first');
      return { success: false, error: 'User not authenticated' };
    }

    console.log('Finding DJM-900NXS2 mixer...');
    
    const productsRef = collection(db, 'products');
    const q = query(productsRef, where('name', '==', 'DJM-900NXS2'));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      console.error('❌ DJM-900NXS2 mixer not found');
      return { success: false, error: 'Mixer not found' };
    }

    const productDoc = querySnapshot.docs[0];
    const productId = productDoc.id;
    const productData = productDoc.data();
    
    console.log('Found mixer:', productId);
    
    const existingOutputs = productData.outputs || [];
    const updatedOutputs = existingOutputs.map(output => {
      if (output.type && output.type.toLowerCase().includes('master')) {
        console.log('Updating Master Out coordinates');
        return {
          ...output,
          coordinate: { x: 0.06, y: 0.075, z: -0.28 }
        };
      }
      return output;
    });
    
    const productRef = doc(db, 'products', productId);
    await updateDoc(productRef, { outputs: updatedOutputs });

    console.log('✅ Successfully updated! Refresh the page.');
    return { success: true };
  } catch (error) {
    console.error('Error:', error);
    console.log('\n💡 Alternative: Use the Product Manager form in the app to manually update the Master Out coordinates to: { x: 0.06, y: 0.075, z: -0.28 }');
    return { success: false, error: error.message };
  }
})();
```

**OR** use the Product Manager form in your app to manually update the Master Out port coordinates to:
```json
{ "x": 0.06, "y": 0.075, "z": -0.28 }
```
