import { productManager } from './productManager';
import deviceLibrary from './deviceLibrary';

// Migration script to move local products to Firebase
export const migrateLocalProductsToFirebase = async () => {
  console.log('Starting migration of local products to Firebase...');
  
  const results = {
    successful: [],
    failed: [],
    skipped: []
  };

  for (const [productId, productData] of Object.entries(deviceLibrary)) {
    try {
      console.log(`Migrating ${productData.name}...`);
      
      // Determine category and subcategory based on product type
      let category = 'DJ'; // Default to DJ
      let subcategory = 'players'; // Default subcategory
      
      if (productData.type === 'player') {
        category = 'DJ';
        subcategory = 'players';
      } else if (productData.type === 'mixer') {
        category = 'DJ';
        subcategory = 'mixers';
      } else if (productData.type === 'FX') {
        category = 'DJ';
        subcategory = 'effects';
      } else if (productData.type === 'computer') {
        category = 'DJ';
        subcategory = 'players'; // Laptop as a player
      }

      // Prepare product data for Firebase
      const firebaseProductData = {
        name: productData.name,
        type: productData.type,
        brand: productData.brand || 'Unknown',
        description: productData.description || '',
        category: category,
        subcategory: subcategory,
        price: productData.price || 0,
        locationPriority: productData.locationPriority || 1000,
        inputs: productData.inputs || [],
        outputs: productData.outputs || [],
        connections: productData.connections || [],
        specifications: {},
        features: [],
        isActive: true
      };

      // Add product to Firebase (without model file for now)
      const result = await productManager.addProduct(firebaseProductData);
      
      if (result.success) {
        results.successful.push({
          name: productData.name,
          id: result.id,
          firebaseId: result.id
        });
        console.log(`✅ Successfully migrated ${productData.name} with ID: ${result.id}`);
      } else {
        results.failed.push({
          name: productData.name,
          error: result.error
        });
        console.log(`❌ Failed to migrate ${productData.name}: ${result.error}`);
      }
      
    } catch (error) {
      results.failed.push({
        name: productData.name,
        error: error.message
      });
      console.log(`❌ Error migrating ${productData.name}: ${error.message}`);
    }
  }

  console.log('\n=== Migration Results ===');
  console.log(`✅ Successful: ${results.successful.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);
  console.log(`⏭️ Skipped: ${results.skipped.length}`);
  
  if (results.successful.length > 0) {
    console.log('\nSuccessfully migrated products:');
    results.successful.forEach(product => {
      console.log(`  - ${product.name} (ID: ${product.firebaseId})`);
    });
  }
  
  if (results.failed.length > 0) {
    console.log('\nFailed to migrate products:');
    results.failed.forEach(product => {
      console.log(`  - ${product.name}: ${product.error}`);
    });
  }

  return results;
};

// Function to check if products already exist in Firebase
export const checkExistingProducts = async () => {
  try {
    const products = await productManager.getAllProducts();
    console.log(`Found ${products.length} existing products in Firebase:`);
    
    products.forEach(product => {
      console.log(`  - ${product.name} (${product.category}/${product.subcategory})`);
    });
    
    return products;
  } catch (error) {
    console.error('Error checking existing products:', error);
    return [];
  }
};

// Function to update existing products with model paths
export const updateProductModelPaths = async () => {
  try {
    const products = await productManager.getAllProducts();
    console.log(`Updating model paths for ${products.length} products...`);
    
    const modelMappings = {
      'CDJ-3000': 'CDJ3000.glb',
      'DJM-900NXS2': 'DJM900NXS2.glb', 
      'RMX-1000': 'RMX1000.glb',
      'Laptop': 'laptop.glb'
    };
    
    for (const product of products) {
      const modelFilename = modelMappings[product.name];
      if (modelFilename) {
        try {
          // Get the Firebase Storage URL for the model
          const modelURL = await productManager.getStorageModelURL(modelFilename);
          if (modelURL) {
            await productManager.updateProduct(product.id, { modelPath: modelURL });
            console.log(`✅ Updated model path for ${product.name}`);
          } else {
            console.log(`⚠️ Model file not found for ${product.name}: ${modelFilename}`);
          }
        } catch (error) {
          console.log(`❌ Error updating model path for ${product.name}: ${error.message}`);
        }
      }
    }
  } catch (error) {
    console.error('Error updating model paths:', error);
  }
};

// Helper function to get Firebase Storage model URL
export const getStorageModelURL = async (modelName) => {
  try {
    const { storage } = await import('./firebaseConfig');
    const { ref, getDownloadURL } = await import('firebase/storage');
    
    const storageRef = ref(storage, `models/${modelName}`);
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
  } catch (error) {
    console.log(`Model not found: ${modelName}`);
    return null;
  }
};

// Main migration function
export const runMigration = async () => {
  console.log('🚀 Starting Product Migration Process...\n');
  
  // Step 1: Check existing products
  console.log('Step 1: Checking existing products in Firebase...');
  const existingProducts = await checkExistingProducts();
  
  if (existingProducts.length > 0) {
    const shouldContinue = confirm(
      `Found ${existingProducts.length} existing products in Firebase. ` +
      'Do you want to continue with migration? This will add new products but may create duplicates.'
    );
    
    if (!shouldContinue) {
      console.log('Migration cancelled by user.');
      return;
    }
  }
  
  // Step 2: Migrate local products
  console.log('\nStep 2: Migrating local products to Firebase...');
  const migrationResults = await migrateLocalProductsToFirebase();
  
  // Step 3: Update model paths
  console.log('\nStep 3: Updating model paths...');
  await updateProductModelPaths();
  
  console.log('\n🎉 Migration process completed!');
  return migrationResults;
};

// Export for use in browser console or components
if (typeof window !== 'undefined') {
  window.migrateProducts = {
    runMigration,
    migrateLocalProductsToFirebase,
    checkExistingProducts,
    updateProductModelPaths
  };
}

