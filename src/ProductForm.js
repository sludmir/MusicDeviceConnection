import React, { useState } from "react";
import { addProduct } from "./firebaseUtils";

function ProductForm({ onClose }) {
    const [productName, setProductName] = useState("");
    const [category, setCategory] = useState("DJ Equipment");
    const [description, setDescription] = useState("");
    const [modelFile, setModelFile] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        const productData = {
            name: productName,
            category,
            description,
            connections: [] // Placeholder for now
        };

        const result = await addProduct(productData, modelFile);

        if (result.success) {
            alert("Product added successfully!");
            onClose(); // Close the form
        } else {
            alert("Error adding product.");
        }

        setLoading(false);
    };

    return (
        <div className="product-form">
            <h2>Add a New Product</h2>
            <form onSubmit={handleSubmit}>
                <label>Name:</label>
                <input type="text" value={productName} onChange={(e) => setProductName(e.target.value)} required />

                <label>Category:</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)}>
                    <option>DJ Equipment</option>
                    <option>Studio Gear</option>
                    <option>Speakers</option>
                    <option>Accessories</option>
                </select>

                <label>Description:</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} required />

                <label>Upload 3D Model:</label>
                <input type="file" accept=".glb,.gltf" onChange={(e) => setModelFile(e.target.files[0])} />

                <button type="submit" disabled={loading}>{loading ? "Uploading..." : "Add Product"}</button>
                <button type="button" onClick={onClose}>Cancel</button>
            </form>
        </div>
    );
}

export default ProductForm;