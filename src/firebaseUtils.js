import { db, storage } from "./firebaseConfig";
import { collection, addDoc, serverTimestamp, getDocs, doc, getDoc } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";

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

// Function to check database status
export const initializeDatabase = async () => {
    try {
        console.log("Checking Firestore database status...");
        const productsRef = collection(db, "products");
        const snapshot = await getDocs(productsRef);
        console.log(`Found ${snapshot.size} products in database`);
        return { success: true, message: `Database contains ${snapshot.size} products` };
    } catch (error) {
        console.error("Error checking database:", error);
        return { success: false, message: error.message };
    }
};