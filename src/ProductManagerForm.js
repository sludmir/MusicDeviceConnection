import React, { useState, useEffect } from 'react';
import { productManager, PRODUCT_CATEGORIES, CONNECTION_TYPES, DEFAULT_PRODUCT_TEMPLATE } from './productManager';
import './ProductManagerForm.css';

const ProductManagerForm = ({ onClose, editingProduct = null }) => {
  const [formData, setFormData] = useState({ ...DEFAULT_PRODUCT_TEMPLATE });
  const [modelFile, setModelFile] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState([]);
  const [previewImage, setPreviewImage] = useState(null);
  const [connectionPoints, setConnectionPoints] = useState({
    inputs: [],
    outputs: []
  });

  // Initialize form data if editing
  useEffect(() => {
    if (editingProduct) {
      setFormData({ ...editingProduct });
      setConnectionPoints({
        inputs: editingProduct.inputs || [],
        outputs: editingProduct.outputs || []
      });
      if (editingProduct.imageUrl) {
        setPreviewImage(editingProduct.imageUrl);
      }
    }
  }, [editingProduct]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleFileChange = (file, type) => {
    if (type === 'model') {
      setModelFile(file);
    } else if (type === 'image') {
      setImageFile(file);
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => setPreviewImage(e.target.result);
      reader.readAsDataURL(file);
    }
  };

  const addConnectionPoint = (type) => {
    const newPoint = {
      type: '',
      coordinate: { x: 0, y: 0, z: 0 },
      description: ''
    };

    setConnectionPoints(prev => ({
      ...prev,
      [type]: [...prev[type], newPoint]
    }));
  };

  const updateConnectionPoint = (type, index, field, value) => {
    setConnectionPoints(prev => ({
      ...prev,
      [type]: prev[type].map((point, i) => 
        i === index ? { ...point, [field]: value } : point
      )
    }));
  };

  const removeConnectionPoint = (type, index) => {
    setConnectionPoints(prev => ({
      ...prev,
      [type]: prev[type].filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrors([]);

    // Validate form
    const validation = productManager.validateProduct(formData);
    if (!validation.isValid) {
      setErrors(validation.errors);
      setLoading(false);
      return;
    }

    // Validate files
    if (modelFile) {
      if (!modelFile.name.toLowerCase().endsWith('.glb')) {
        setErrors(['3D model must be a GLB file']);
        setLoading(false);
        return;
      }
      if (modelFile.size > 50 * 1024 * 1024) { // 50MB
        setErrors(['3D model file is too large (max 50MB)']);
        setLoading(false);
        return;
      }
    }

    if (imageFile) {
      if (!imageFile.type.startsWith('image/')) {
        setErrors(['Image must be a valid image file']);
        setLoading(false);
        return;
      }
      if (imageFile.size > 5 * 1024 * 1024) { // 5MB
        setErrors(['Image file is too large (max 5MB)']);
        setLoading(false);
        return;
      }
    }

    // Prepare product data with connection points
    const productData = {
      ...formData,
      inputs: connectionPoints.inputs,
      outputs: connectionPoints.outputs
    };

    try {
      console.log('Submitting product:', productData);
      console.log('Model file:', modelFile);
      console.log('Image file:', imageFile);

      let result;
      if (editingProduct) {
        result = await productManager.updateProduct(
          editingProduct.id, 
          productData, 
          modelFile, 
          imageFile
        );
      } else {
        result = await productManager.addProduct(
          productData, 
          modelFile, 
          imageFile
        );
      }

      if (result.success) {
        alert(editingProduct ? 'Product updated successfully!' : 'Product added successfully!');
        onClose();
      } else {
        setErrors([result.error]);
      }
    } catch (error) {
      console.error('Error submitting product:', error);
      setErrors([error.message || 'An unexpected error occurred']);
    }

    setLoading(false);
  };

  const getSubcategories = () => {
    if (!formData.category) return [];
    return Object.keys(PRODUCT_CATEGORIES[formData.category] || {});
  };

  return (
    <div className="product-manager-overlay">
      <div className="product-manager-form">
        <div className="form-header">
          <h2>{editingProduct ? 'Edit Product' : 'Add New Product'}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        {errors.length > 0 && (
          <div className="error-messages">
            {errors.map((error, index) => (
              <div key={index} className="error-message">{error}</div>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Basic Information */}
          <div className="form-section">
            <h3>Basic Information</h3>
            
            <div className="form-row">
              <div className="form-group">
                <label>Product Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="e.g., CDJ-3000"
                  required
                />
              </div>
              
              <div className="form-group">
                <label>Brand *</label>
                <input
                  type="text"
                  value={formData.brand}
                  onChange={(e) => handleInputChange('brand', e.target.value)}
                  placeholder="e.g., Pioneer DJ"
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Setup Type *</label>
                <select
                  value={formData.category}
                  onChange={(e) => handleInputChange('category', e.target.value)}
                  required
                >
                  <option value="">Select Setup Type</option>
                  <option value="DJ">DJ</option>
                  <option value="Producer">Producer</option>
                  <option value="Musician">Musician</option>
                </select>
              </div>
              
              <div className="form-group">
                <label>Category *</label>
                <select
                  value={formData.subcategory}
                  onChange={(e) => handleInputChange('subcategory', e.target.value)}
                  required
                  disabled={!formData.category}
                >
                  <option value="">Select Category</option>
                  {getSubcategories().map(subcat => (
                    <option key={subcat} value={subcat}>
                      {PRODUCT_CATEGORIES[formData.category][subcat].name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Product Type *</label>
              <input
                type="text"
                value={formData.type}
                onChange={(e) => handleInputChange('type', e.target.value)}
                placeholder="e.g., player, mixer, fx_unit"
                required
              />
            </div>

            <div className="form-group">
              <label>Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Brief description of the product"
                rows="3"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Price ($)</label>
                <input
                  type="number"
                  value={formData.price}
                  onChange={(e) => handleInputChange('price', parseFloat(e.target.value) || 0)}
                  min="0"
                  step="0.01"
                />
              </div>
              
              <div className="form-group">
                <label>Location Priority</label>
                <input
                  type="number"
                  value={formData.locationPriority}
                  onChange={(e) => handleInputChange('locationPriority', parseInt(e.target.value) || 1000)}
                  min="0"
                />
              </div>
            </div>
          </div>

          {/* Connection Points */}
          <div className="form-section">
            <h3>Connection Points</h3>
            
            {/* Inputs */}
            <div className="connection-group">
              <div className="connection-header">
                <h4>Inputs</h4>
                <button 
                  type="button" 
                  onClick={() => addConnectionPoint('inputs')}
                  className="add-connection-btn"
                >
                  + Add Input
                </button>
              </div>
              
              {connectionPoints.inputs.map((input, index) => (
                <div key={index} className="connection-point">
                  <select
                    value={input.type}
                    onChange={(e) => updateConnectionPoint('inputs', index, 'type', e.target.value)}
                  >
                    <option value="">Select Connection Type</option>
                    {Object.keys(CONNECTION_TYPES).map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                  
                  <div className="coordinate-inputs">
                    <input
                      type="number"
                      placeholder="X"
                      value={input.coordinate.x}
                      onChange={(e) => updateConnectionPoint('inputs', index, 'coordinate', {
                        ...input.coordinate,
                        x: parseFloat(e.target.value) || 0
                      })}
                      step="0.01"
                    />
                    <input
                      type="number"
                      placeholder="Y"
                      value={input.coordinate.y}
                      onChange={(e) => updateConnectionPoint('inputs', index, 'coordinate', {
                        ...input.coordinate,
                        y: parseFloat(e.target.value) || 0
                      })}
                      step="0.01"
                    />
                    <input
                      type="number"
                      placeholder="Z"
                      value={input.coordinate.z}
                      onChange={(e) => updateConnectionPoint('inputs', index, 'coordinate', {
                        ...input.coordinate,
                        z: parseFloat(e.target.value) || 0
                      })}
                      step="0.01"
                    />
                  </div>
                  
                  <button 
                    type="button"
                    onClick={() => removeConnectionPoint('inputs', index)}
                    className="remove-connection-btn"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            {/* Outputs */}
            <div className="connection-group">
              <div className="connection-header">
                <h4>Outputs</h4>
                <button 
                  type="button" 
                  onClick={() => addConnectionPoint('outputs')}
                  className="add-connection-btn"
                >
                  + Add Output
                </button>
              </div>
              
              {connectionPoints.outputs.map((output, index) => (
                <div key={index} className="connection-point">
                  <select
                    value={output.type}
                    onChange={(e) => updateConnectionPoint('outputs', index, 'type', e.target.value)}
                  >
                    <option value="">Select Connection Type</option>
                    {Object.keys(CONNECTION_TYPES).map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                  
                  <div className="coordinate-inputs">
                    <input
                      type="number"
                      placeholder="X"
                      value={output.coordinate.x}
                      onChange={(e) => updateConnectionPoint('outputs', index, 'coordinate', {
                        ...output.coordinate,
                        x: parseFloat(e.target.value) || 0
                      })}
                      step="0.01"
                    />
                    <input
                      type="number"
                      placeholder="Y"
                      value={output.coordinate.y}
                      onChange={(e) => updateConnectionPoint('outputs', index, 'coordinate', {
                        ...output.coordinate,
                        y: parseFloat(e.target.value) || 0
                      })}
                      step="0.01"
                    />
                    <input
                      type="number"
                      placeholder="Z"
                      value={output.coordinate.z}
                      onChange={(e) => updateConnectionPoint('outputs', index, 'coordinate', {
                        ...output.coordinate,
                        z: parseFloat(e.target.value) || 0
                      })}
                      step="0.01"
                    />
                  </div>
                  
                  <button 
                    type="button"
                    onClick={() => removeConnectionPoint('outputs', index)}
                    className="remove-connection-btn"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Files */}
          <div className="form-section">
            <h3>Files</h3>
            
            <div className="file-uploads">
              <div className="file-group">
                <label>3D Model (GLB file)</label>
                <input
                  type="file"
                  accept=".glb"
                  onChange={(e) => handleFileChange(e.target.files[0], 'model')}
                />
                {modelFile && <p className="file-info">Selected: {modelFile.name}</p>}
              </div>
              
              <div className="file-group">
                <label>Product Image</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileChange(e.target.files[0], 'image')}
                />
                {previewImage && (
                  <div className="image-preview">
                    <img src={previewImage} alt="Preview" />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="form-actions">
            <button type="button" onClick={onClose} className="cancel-btn">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="submit-btn">
              {loading ? 'Saving...' : (editingProduct ? 'Update Product' : 'Add Product')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProductManagerForm;
