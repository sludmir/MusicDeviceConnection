import { db, storage } from "./firebaseConfig";
import { collection, addDoc, serverTimestamp, getDocs, doc, setDoc, getDoc, writeBatch } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import deviceLibrary from './deviceLibrary';

// Function to upload 3D model and add product to Firestore
export async function addProduct(productData, modelFile) {
    try {
        let modelURL = "";
        
        if (modelFile) {
            const storageRef = ref(storage, `models/${modelFile.name}`);
            const uploadTask = await uploadBytesResumable(storageRef, modelFile);
            modelURL = await getDownloadURL(uploadTask.ref);
        }

        // Add product to the root products collection
        const productsRef = collection(db, "products");
        const docRef = await addDoc(productsRef, {
            ...productData,
            modelPath: modelURL,
            createdAt: serverTimestamp()
        });

        console.log("Product added with ID:", docRef.id);
        return { success: true, id: docRef.id };
    } catch (error) {
        console.error("Error adding product:", error);
        return { success: false, error };
    }
}

// Function to initialize the database with products from deviceLibrary
export async function initializeDatabase() {
    try {
        console.log("Starting database initialization...");
        
        // Check if products already exist in the root collection
        const productsRef = collection(db, "products");
        const snapshot = await getDocs(productsRef);
        
        if (!snapshot.empty) {
            console.log("Database already contains products");
            return { success: true, message: "Database already contains products" };
        }

        // Add products to root collection using batch
        const products = Object.entries(deviceLibrary);
        console.log(`Adding ${products.length} products to database...`);

        // Use multiple batches if needed (Firestore limit is 500 operations per batch)
        const batchSize = 400;
        const batches = [];
        let currentBatch = writeBatch(db);
        let operationCount = 0;

        for (const [key, product] of products) {
            if (operationCount >= batchSize) {
                batches.push(currentBatch);
                currentBatch = writeBatch(db);
                operationCount = 0;
            }

            const productData = {
                name: product.name,
                type: product.type,
                brand: product.brand,
                description: product.description,
                modelUrl: product.modelPath,
                inputs: product.inputs || [],
                outputs: product.outputs || [],
                connections: product.connections || [],
                price: product.price,
                locationPriority: product.locationPriority || 0,
                createdAt: serverTimestamp()
            };

            const newProductRef = doc(productsRef);
            currentBatch.set(newProductRef, productData);
            operationCount++;
            console.log(`Prepared product: ${product.name}`);
        }

        // Add the last batch if it contains operations
        if (operationCount > 0) {
            batches.push(currentBatch);
        }

        // Commit all batches
        await Promise.all(batches.map(batch => batch.commit()));
        
        console.log("Database initialization complete");
        return { success: true, message: "Database initialized with default products" };
    } catch (error) {
        console.error("Error initializing database:", error);
        return { success: false, error: error.message };
    }
}