import { db, storage } from "./firebaseConfig";
import { collection, addDoc, serverTimestamp, getDocs, doc, updateDoc } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";

// Map of old filenames to new filenames
const MODEL_FILENAME_MAP = {
    'DJM900(v2).glb': 'DJM900NXS2.glb',
    'DJM900NXS2': 'DJM900NXS2.glb',
    'DJM-900NXS2': 'DJM900NXS2.glb',
    'RMX-1000': 'RMX1000.glb',
    'RMX1000': 'RMX1000.glb',
    'RMX1000.glb': 'RMX1000.glb'
    // Add more mappings as needed
};

// Function to upload 3D model and add product to Firestore
export async function addProduct(productData, modelFile) {
    try {
        let modelURL = "";
        
        if (modelFile) {
            console.log("Uploading model file to Firebase Storage:", modelFile.name);
            // Create a reference to the models folder in Firebase Storage
            const storageRef = ref(storage, `models/${modelFile.name}`);
            console.log("Storage reference created:", storageRef.fullPath);
            
            // Upload the file
            const uploadTask = await uploadBytesResumable(storageRef, modelFile);
            console.log("Upload completed:", uploadTask);
            
            // Get the download URL from Firebase Storage
            modelURL = await getDownloadURL(uploadTask.ref);
            console.log("Firebase Storage download URL obtained:", modelURL);
        }

        // Add product to the root products collection
        const productsRef = collection(db, "products");
        const docRef = await addDoc(productsRef, {
            ...productData,
            modelPath: modelURL, // Store the Firebase Storage URL
            createdAt: serverTimestamp()
        });

        console.log("Product added with ID:", docRef.id, "and modelPath:", modelURL);
        return { success: true, id: docRef.id };
    } catch (error) {
        console.error("Error adding product:", error);
        return { success: false, error };
    }
}

// Function to check database status
export const initializeDatabase = async () => {
    try {
        console.log("Checking Firestore database status...");
        const usersRef = collection(db, "users");
        const snapshot = await getDocs(usersRef);
        console.log(`Found ${snapshot.size} users in database`);
        return { success: true, message: `Database contains ${snapshot.size} users` };
    } catch (error) {
        console.error("Error checking database:", error);
        return { success: false, message: error.message };
    }
};

// Function to get Firebase Storage URL for a model
export async function getStorageModelURL(modelName) {
    try {
        const storageRef = ref(storage, `models/${modelName}`);
        const url = await getDownloadURL(storageRef);
        return url;
    } catch (error) {
        console.error("Error getting storage URL:", error);
        return null;
    }
}

// Function to update model paths for all products
export async function updateAllModelPaths() {
    try {
        const productsRef = collection(db, "products");
        const snapshot = await getDocs(productsRef);
        
        const updates = [];
        
        for (const docSnapshot of snapshot.docs) {
            const productData = docSnapshot.data();
            const oldPath = productData.modelPath;
            
            // Skip if no model path
            if (!oldPath) continue;
            
            try {
                // Extract the filename from the path
                const oldFilename = oldPath.split('/').pop();
                if (!oldFilename) continue;
                
                // Use the mapped filename if it exists, otherwise use the original
                const newFilename = MODEL_FILENAME_MAP[oldFilename] || oldFilename;
                
                // Create storage reference directly to the model file
                const storageRef = ref(storage, `models/${newFilename}`);
                console.log(`Getting download URL for: models/${newFilename}`);
                
                const newPath = await getDownloadURL(storageRef);
                console.log(`New Firebase Storage URL: ${newPath}`);
                
                // Update the document with the new Firebase Storage URL
                const productRef = doc(db, "products", docSnapshot.id);
                updates.push(updateDoc(productRef, { 
                    modelPath: newPath,
                    lastUpdated: serverTimestamp()
                }));
                
                console.log(`Updated model path for ${productData.name}:`);
                console.log('Old path:', oldPath);
                console.log('New path:', newPath);
            } catch (error) {
                console.error(`Failed to update model path for ${productData.name}:`, error);
                console.error('Error details:', error.message);
                continue;
            }
        }
        
        await Promise.all(updates);
        console.log(`Successfully updated ${updates.length} model paths`);
        return { success: true, updatedCount: updates.length };
    } catch (error) {
        console.error("Error updating model paths:", error);
        return { success: false, error };
    }
}

// Helper function to check if a path is a Firebase Storage URL
export function isFirebaseStorageUrl(url) {
    return url && url.startsWith('https://firebasestorage.googleapis.com/');
}

// Helper function to get model path from Firebase Storage
export async function getModelPath(relativePath) {
    try {
        // If the path is already a full URL, return it
        if (relativePath.startsWith('https://')) {
            return relativePath;
        }

        // Extract the filename from the path
        let filename = relativePath.split('/').pop();
        if (!filename) {
            console.error('Could not extract filename from path:', relativePath);
            throw new Error('Could not extract filename from path');
        }

        // Remove any file extension for mapping lookup
        const nameWithoutExt = filename.replace('.glb', '');
        
        // Use the mapped filename if it exists, otherwise use the original
        const mappedName = MODEL_FILENAME_MAP[nameWithoutExt] || MODEL_FILENAME_MAP[filename];
        const finalFilename = mappedName || filename;
        
        console.log('Path processing:', {
            original: relativePath,
            extracted: filename,
            nameWithoutExt,
            mapped: mappedName,
            final: finalFilename
        });
        
        // Create storage reference directly to the model file
        const storageRef = ref(storage, `models/${finalFilename}`);
        console.log('Getting download URL for:', `models/${finalFilename}`);
        
        const downloadURL = await getDownloadURL(storageRef);
        console.log('Got download URL:', downloadURL);
        return downloadURL;
    } catch (error) {
        console.error('Error getting model path:', error);
        console.error('Failed path:', relativePath);
        return null;
    }
}

// Function to set model path for a specific product
export async function setProductModelPath(productId, productName) {
    try {
        // Get the correct filename for this product
        const filename = MODEL_FILENAME_MAP[productName] || `${productName}.glb`;
        
        // Create storage reference
        const storageRef = ref(storage, `models/${filename}`);
        console.log(`Getting download URL for: models/${filename}`);
        
        // Get the download URL
        const downloadURL = await getDownloadURL(storageRef);
        console.log('Got download URL:', downloadURL);
        
        // Update the product document
        const productRef = doc(db, "products", productId);
        await updateDoc(productRef, {
            modelPath: downloadURL,
            lastUpdated: serverTimestamp()
        });
        
        console.log(`Updated model path for product ${productId}`);
        return { success: true };
    } catch (error) {
        console.error('Error setting model path:', error);
        return { success: false, error };
    }
}