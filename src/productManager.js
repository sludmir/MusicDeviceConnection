import { db, storage, auth } from "./firebaseConfig";
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import * as THREE from 'three';

// Product categories and their properties
export const PRODUCT_CATEGORIES = {
  DJ: {
    players: {
      name: "Players",
      description: "CDJs, Turntables, Controllers",
      icon: "🎧",
      types: ["cdj", "turntable", "controller", "media_player"]
    },
    mixers: {
      name: "Mixers", 
      description: "DJM Series, Xone, etc.",
      icon: "🎛️",
      types: ["mixer", "djm", "xone"]
    },
    effects: {
      name: "Effects",
      description: "RMX, SP-1, etc.", 
      icon: "🎚️",
      types: ["fx_unit", "effects_processor", "rmx"]
    },
    speakers: {
      name: "Speakers",
      description: "Monitors, PA Systems",
      icon: "🔊", 
      types: ["monitor", "pa_speaker", "subwoofer"]
    },
    cables: {
      name: "Cables",
      description: "RCA, XLR, Ethernet",
      icon: "🔌",
      types: ["rca", "xlr", "ethernet", "usb"]
    },
    accessories: {
      name: "Accessories", 
      description: "Headphones, Cases",
      icon: "🎧",
      types: ["headphones", "case", "stand"]
    }
  },
  Producer: {
    "audio-interface": {
      name: "Audio Interface",
      description: "Focusrite, PreSonus, etc.",
      icon: "🎤",
      types: ["audio_interface", "soundcard"]
    },
    synthesizers: {
      name: "Synthesizers",
      description: "Moog, Korg, Sequential", 
      icon: "🎹",
      types: ["synthesizer", "synth", "keyboard"]
    },
    controllers: {
      name: "Controllers",
      description: "MIDI, Pad Controllers",
      icon: "🎮", 
      types: ["midi_controller", "pad_controller"]
    },
    monitors: {
      name: "Monitors",
      description: "Studio Monitors, Subwoofers",
      icon: "🔊",
      types: ["studio_monitor", "monitor_speaker"]
    },
    microphones: {
      name: "Microphones", 
      description: "Condenser, Dynamic, USB",
      icon: "🎤",
      types: ["condenser", "dynamic", "usb_mic"]
    },
    software: {
      name: "Software",
      description: "DAW, Plugins, Samples",
      icon: "💻",
      types: ["daw", "plugin", "sample_pack"]
    }
  },
  Musician: {
    instruments: {
      name: "Instruments",
      description: "Guitars, Basses, Keyboards",
      icon: "🎸",
      types: ["guitar", "bass", "keyboard", "piano"]
    },
    amplifiers: {
      name: "Amplifiers", 
      description: "Guitar Amps, Bass Amps",
      icon: "🔊",
      types: ["guitar_amp", "bass_amp", "combo_amp"]
    },
    effects: {
      name: "Effects",
      description: "Pedals, Rack Units", 
      icon: "🎚️",
      types: ["pedal", "rack_unit", "effects_processor"]
    },
    microphones: {
      name: "Microphones",
      description: "Vocal, Instrument",
      icon: "🎤", 
      types: ["vocal_mic", "instrument_mic"]
    },
    cables: {
      name: "Cables",
      description: "Instrument, Speaker, XLR",
      icon: "🔌",
      types: ["instrument_cable", "speaker_cable", "xlr"]
    },
    accessories: {
      name: "Accessories",
      description: "Stands, Cases, Tuners", 
      icon: "🎧",
      types: ["stand", "case", "tuner", "strap"]
    }
  }
};

// Default product template
export const DEFAULT_PRODUCT_TEMPLATE = {
  name: "",
  type: "",
  brand: "",
  description: "",
  category: "",
  subcategory: "",
  price: 0,
  locationPriority: 1000,
  inputs: [],
  outputs: [],
  connections: [],
  specifications: {},
  features: [],
  modelPath: "",
  imageUrl: "",
  isActive: true,
  createdAt: null,
  updatedAt: null
};

// Input/Output types with their properties
export const CONNECTION_TYPES = {
  // Audio connections
  "RCA": { type: "audio", color: "red_white", description: "RCA stereo connection" },
  "XLR": { type: "audio", color: "xlr", description: "XLR balanced connection" },
  "1/4\"": { type: "audio", color: "ts", description: "1/4 inch jack" },
  "3.5mm": { type: "audio", color: "trs", description: "3.5mm mini jack" },
  
  // Digital connections  
  "USB": { type: "digital", color: "usb", description: "USB connection" },
  "USB-C": { type: "digital", color: "usb_c", description: "USB-C connection" },
  "Ethernet": { type: "digital", color: "ethernet", description: "Ethernet/LAN connection" },
  "Link": { type: "digital", color: "link", description: "Pioneer Link connection" },
  "MIDI": { type: "digital", color: "midi", description: "MIDI connection" },
  
  // Media connections
  "SD": { type: "media", color: "sd", description: "SD card slot" },
  "CF": { type: "media", color: "cf", description: "CompactFlash slot" },
  
  // Power connections
  "Power": { type: "power", color: "power", description: "Power connection" },
  "DC": { type: "power", color: "dc", description: "DC power input" }
};

// Product Manager Class
export class ProductManager {
  constructor() {
    this.products = [];
    this.categories = PRODUCT_CATEGORIES;
  }

  // Get all products from Firebase
  async getAllProducts() {
    try {
      const productsRef = collection(db, "products");
      const snapshot = await getDocs(productsRef);
      
      this.products = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      return this.products;
    } catch (error) {
      console.error("Error fetching products:", error);
      throw error;
    }
  }

  // Get products by category
  async getProductsByCategory(setupType, category) {
    const allProducts = await this.getAllProducts();
    return allProducts.filter(product => 
      product.category === setupType && 
      product.subcategory === category
    );
  }

  // Add a new product
  async addProduct(productData, modelFile = null, imageFile = null) {
    try {
      let modelURL = "";
      let imageURL = "";

      // Upload 3D model if provided
      if (modelFile) {
        modelURL = await this.uploadModel(modelFile);
      }

      // Upload image if provided
      if (imageFile) {
        imageURL = await this.uploadImage(imageFile);
      }

      // Get current user ID for ownership tracking
      const currentUser = auth.currentUser;
      if (!currentUser) {
        return { success: false, error: "You must be signed in to add products" };
      }

      // Prepare product data
      const newProduct = {
        ...DEFAULT_PRODUCT_TEMPLATE,
        ...productData,
        modelPath: modelURL,
        imageUrl: imageURL,
        ownerId: currentUser.uid, // Track who created this product
        createdBy: currentUser.email || currentUser.uid, // Also store email for display
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      // Add to Firestore
      const productsRef = collection(db, "products");
      const docRef = await addDoc(productsRef, newProduct);

      console.log("Product added successfully:", docRef.id);
      return { success: true, id: docRef.id, product: newProduct };
    } catch (error) {
      console.error("Error adding product:", error);
      return { success: false, error: error.message };
    }
  }

  // Update an existing product
  async updateProduct(productId, updateData, modelFile = null, imageFile = null) {
    // Get current user to verify ownership
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return { success: false, error: "You must be signed in to update products" };
    }
    try {
      let modelURL = updateData.modelPath || "";
      let imageURL = updateData.imageUrl || "";

      // Upload new model if provided
      if (modelFile) {
        modelURL = await this.uploadModel(modelFile);
      }

      // Upload new image if provided
      if (imageFile) {
        imageURL = await this.uploadImage(imageFile);
      }

      // Prepare update data (don't allow changing ownerId)
      const { ownerId, createdBy, createdAt, ...dataToUpdate } = updateData;
      const updatePayload = {
        ...dataToUpdate,
        modelPath: modelURL,
        imageUrl: imageURL,
        updatedAt: serverTimestamp()
        // Note: ownerId, createdBy, and createdAt are preserved from original document
      };

      // Update in Firestore
      const productRef = doc(db, "products", productId);
      await updateDoc(productRef, updatePayload);

      console.log("Product updated successfully:", productId);
      return { success: true, id: productId };
    } catch (error) {
      console.error("Error updating product:", error);
      return { success: false, error: error.message };
    }
  }

  // Delete a product
  async deleteProduct(productId) {
    try {
      // Get product data first to delete associated files
      const product = this.products.find(p => p.id === productId);
      
      // Delete model file from storage
      if (product?.modelPath) {
        await this.deleteFileFromStorage(product.modelPath);
      }

      // Delete image file from storage
      if (product?.imageUrl) {
        await this.deleteFileFromStorage(product.imageUrl);
      }

      // Delete from Firestore
      const productRef = doc(db, "products", productId);
      await deleteDoc(productRef);

      console.log("Product deleted successfully:", productId);
      return { success: true };
    } catch (error) {
      console.error("Error deleting product:", error);
      return { success: false, error: error.message };
    }
  }

  // Upload 3D model to Firebase Storage
  async uploadModel(file) {
    try {
      if (!file) {
        throw new Error("No file provided for upload");
      }
      
      console.log("Uploading model file:", file.name, "Size:", file.size, "Type:", file.type);
      
      const storageRef = ref(storage, `models/${file.name}`);
      const uploadTask = await uploadBytesResumable(storageRef, file);
      const downloadURL = await getDownloadURL(uploadTask.ref);
      
      console.log("Model uploaded successfully:", downloadURL);
      return downloadURL;
    } catch (error) {
      console.error("Error uploading model:", error);
      throw new Error(`Failed to upload model: ${error.message}`);
    }
  }

  // Upload image to Firebase Storage
  async uploadImage(file) {
    try {
      if (!file) {
        throw new Error("No file provided for upload");
      }
      
      console.log("Uploading image file:", file.name, "Size:", file.size, "Type:", file.type);
      
      const storageRef = ref(storage, `images/${file.name}`);
      const uploadTask = await uploadBytesResumable(storageRef, file);
      const downloadURL = await getDownloadURL(uploadTask.ref);
      
      console.log("Image uploaded successfully:", downloadURL);
      return downloadURL;
    } catch (error) {
      console.error("Error uploading image:", error);
      throw new Error(`Failed to upload image: ${error.message}`);
    }
  }

  // Delete file from Firebase Storage
  async deleteFileFromStorage(fileURL) {
    try {
      const fileRef = ref(storage, fileURL);
      await deleteObject(fileRef);
      console.log("File deleted successfully:", fileURL);
    } catch (error) {
      console.error("Error deleting file:", error);
      // Don't throw error for file deletion failures
    }
  }

  // Create input/output coordinate
  createConnectionPoint(type, coordinate) {
    return {
      type,
      coordinate: new THREE.Vector3(coordinate.x, coordinate.y, coordinate.z),
      description: CONNECTION_TYPES[type]?.description || `${type} connection`
    };
  }

  // Validate product data
  validateProduct(productData) {
    const errors = [];

    if (!productData.name) errors.push("Product name is required");
    if (!productData.type) errors.push("Product type is required");
    if (!productData.brand) errors.push("Brand is required");
    if (!productData.category) errors.push("Category is required");
    if (!productData.subcategory) errors.push("Subcategory is required");
    if (productData.price < 0) errors.push("Price must be positive");

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Get product statistics
  getProductStats() {
    const stats = {
      total: this.products.length,
      byCategory: {},
      bySetupType: {}
    };

    this.products.forEach(product => {
      // Count by setup type
      if (!stats.bySetupType[product.category]) {
        stats.bySetupType[product.category] = 0;
      }
      stats.bySetupType[product.category]++;

      // Count by subcategory
      if (!stats.byCategory[product.subcategory]) {
        stats.byCategory[product.subcategory] = 0;
      }
      stats.byCategory[product.subcategory]++;
    });

    return stats;
  }
}

// Export singleton instance
export const productManager = new ProductManager();
