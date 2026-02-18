import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebaseConfig";
import { getRecommendedPosition } from "./devicePlacement";

/**
 * Find a product by name in Firestore products collection.
 */
export async function findProductByName(name) {
  if (!name || !db) return null;
  try {
    const productsRef = collection(db, "products");
    const q = query(productsRef, where("name", "==", name.trim()));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() };
  } catch (err) {
    console.error("findProductByName error:", err);
    return null;
  }
}

/**
 * Check if the product can be added to the setup.
 */
export function canAddProductToSetup(product, selectedSetup, actualDevices) {
  if (!product) return { canAdd: false, reason: "No product" };
  const name = product.name || product.id;
  const already = (actualDevices || []).some((d) => (d.name || "").toLowerCase() === (name || "").toLowerCase());
  if (already) return { canAdd: false, reason: `${name} is already in the setup` };
  return { canAdd: true };
}

/**
 * Build device object for the scene (uniqueId, placement, inputs/outputs from product).
 */
export function prepareProductForSetup(product, selectedSetup, actualDevices, spotConfig) {
  if (!product || !spotConfig) return null;
  const { index, spot } = getRecommendedPosition(actualDevices || [], spotConfig);
  const uniqueId = `device-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return {
    uniqueId,
    name: product.name || product.id || "Device",
    spotType: spot?.type ?? "middle",
    placementIndex: index,
    inputs: Array.isArray(product.inputs) ? product.inputs : [],
    outputs: Array.isArray(product.outputs) ? product.outputs : [],
    modelPath: product.modelPath || null,
  };
}
