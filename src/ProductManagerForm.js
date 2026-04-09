import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { productManager, PRODUCT_CATEGORIES, CONNECTION_TYPES, DEFAULT_PRODUCT_TEMPLATE } from './productManager';
import { computeAutoScale, getRealDimensions } from './dimensionScaler';
import './ProductManagerForm.css';

function ModelViewer({ modelSource, scale, productName, onDimensionsChange, onAutoScaleComputed }) {
  const containerRef = useRef(null);
  const threeRef = useRef({
    renderer: null, scene: null, camera: null,
    controls: null, model: null, frameId: null, blobURL: null,
  });
  const scaleRef = useRef(scale);
  scaleRef.current = scale;

  const teardown = useCallback(() => {
    const t = threeRef.current;
    if (t.frameId) cancelAnimationFrame(t.frameId);
    if (t.controls) t.controls.dispose();
    const mount = containerRef.current;
    if (t.renderer) {
      if (mount && mount.contains(t.renderer.domElement)) mount.removeChild(t.renderer.domElement);
      t.renderer.dispose();
    }
    if (t.blobURL) URL.revokeObjectURL(t.blobURL);
    Object.assign(t, { renderer: null, scene: null, camera: null, controls: null, model: null, frameId: null, blobURL: null });
  }, []);

  useEffect(() => {
    const mount = containerRef.current;
    if (!mount || !modelSource) return;
    teardown();
    if (onDimensionsChange) onDimensionsChange(null);

    const t = threeRef.current;
    const width = mount.clientWidth || 400;
    const height = mount.clientHeight || 340;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111118);
    t.scene = scene;

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.005, 500);
    t.camera = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    mount.appendChild(renderer.domElement);
    t.renderer = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 0.05;
    controls.maxDistance = 80;
    t.controls = controls;

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const key = new THREE.DirectionalLight(0xffffff, 0.9);
    key.position.set(3, 5, 3);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x8899ff, 0.25);
    fill.position.set(-2, 1, -1);
    scene.add(fill);

    const grid = new THREE.GridHelper(4, 20, 0x333333, 0x222222);
    scene.add(grid);

    // Reference cube (0.3m = roughly a CDJ for scale comparison)
    const refGeo = new THREE.BoxGeometry(0.3, 0.05, 0.25);
    const refMat = new THREE.MeshStandardMaterial({ color: 0x335566, transparent: true, opacity: 0.35, wireframe: true });
    const refCube = new THREE.Mesh(refGeo, refMat);
    refCube.position.set(0.6, 0.025, 0);
    scene.add(refCube);

    const url = typeof modelSource === 'string' ? modelSource : URL.createObjectURL(modelSource);
    if (typeof modelSource !== 'string') t.blobURL = url;

    const loader = new GLTFLoader();
    loader.load(url, (gltf) => {
      if (!t.scene) return;
      const model = gltf.scene;
      t.model = model;

      const box = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getCenter(center);
      box.getSize(size);
      if (onDimensionsChange) onDimensionsChange({ x: size.x, y: size.y, z: size.z });

      const auto = productName ? computeAutoScale(productName, size) : null;
      if (onAutoScaleComputed) onAutoScaleComputed(auto);

      model.position.set(-center.x, -center.y + size.y / 2, -center.z);
      scene.add(model);

      const viewSize = auto !== null ? size.clone().multiplyScalar(auto) : size;
      camera.position.set(viewSize.x * 2 + 0.5, viewSize.y * 2 + 0.5, viewSize.z * 2 + 0.5);
      controls.target.set(0, viewSize.y * 0.4, 0);
      controls.update();
    }, undefined, (err) => console.error('Model preview load error:', err));

    const animate = () => {
      t.frameId = requestAnimationFrame(animate);
      if (t.model) t.model.scale.setScalar(scaleRef.current);
      if (t.controls) t.controls.update();
      if (t.renderer && t.scene && t.camera) t.renderer.render(t.scene, t.camera);
    };
    animate();

    const handleResize = () => {
      if (!mount || !t.camera || !t.renderer) return;
      const w = mount.clientWidth || 400;
      const h = mount.clientHeight || 340;
      t.camera.aspect = w / h;
      t.camera.updateProjectionMatrix();
      t.renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);
    return () => { window.removeEventListener('resize', handleResize); teardown(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelSource, teardown]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%', borderRadius: '8px', overflow: 'hidden' }} />;
}

const ProductManagerForm = ({ onClose, editingProduct = null }) => {
  const [formData, setFormData] = useState({ ...DEFAULT_PRODUCT_TEMPLATE });
  const [modelFile, setModelFile] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState([]);
  const [previewImage, setPreviewImage] = useState(null);
  const [modelScale, setModelScale] = useState(1.0);
  const [rawDims, setRawDims] = useState(null);
  const [autoScaleValue, setAutoScaleValue] = useState(null);
  const [connectionPoints, setConnectionPoints] = useState({
    inputs: [],
    outputs: []
  });

  const existingModelPath = editingProduct?.modelPath || null;
  const hasNewFile = !!modelFile;
  const modelSource = hasNewFile ? modelFile : existingModelPath || null;

  useEffect(() => {
    if (editingProduct) {
      setFormData({ ...editingProduct });
      setModelScale(editingProduct.modelScale || 1.0);

      const normalizeConnectionPoints = (points) => {
        if (!Array.isArray(points)) return [];
        return points.map(point => ({
          type: point.type || '',
          coordinate: point.coordinate ? {
            x: typeof point.coordinate.x === 'number' ? point.coordinate.x : (point.coordinate.x || 0),
            y: typeof point.coordinate.y === 'number' ? point.coordinate.y : (point.coordinate.y || 0),
            z: typeof point.coordinate.z === 'number' ? point.coordinate.z : (point.coordinate.z || 0)
          } : { x: 0, y: 0, z: 0 },
          description: point.description || ''
        }));
      };

      setConnectionPoints({
        inputs: normalizeConnectionPoints(editingProduct.inputs),
        outputs: normalizeConnectionPoints(editingProduct.outputs)
      });
      if (editingProduct.imageUrl) {
        setPreviewImage(editingProduct.imageUrl);
      }
    }
  }, [editingProduct]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileChange = (file, type) => {
    if (type === 'model') {
      setModelFile(file);
      setModelScale(1.0);
    } else if (type === 'image') {
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (e) => setPreviewImage(e.target.result);
      reader.readAsDataURL(file);
    }
  };

  const addConnectionPoint = (type) => {
    const newPoint = { type: '', coordinate: { x: 0, y: 0, z: 0 }, description: '' };
    setConnectionPoints(prev => ({ ...prev, [type]: [...prev[type], newPoint] }));
  };

  const updateConnectionPoint = (type, index, field, value) => {
    setConnectionPoints(prev => ({
      ...prev,
      [type]: prev[type].map((point, i) => i === index ? { ...point, [field]: value } : point)
    }));
  };

  const removeConnectionPoint = (type, index) => {
    setConnectionPoints(prev => ({ ...prev, [type]: prev[type].filter((_, i) => i !== index) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrors([]);

    const validation = productManager.validateProduct(formData);
    if (!validation.isValid) {
      setErrors(validation.errors);
      setLoading(false);
      return;
    }

    if (modelFile) {
      if (!modelFile.name.toLowerCase().endsWith('.glb')) {
        setErrors(['3D model must be a GLB file']);
        setLoading(false);
        return;
      }
      if (modelFile.size > 50 * 1024 * 1024) {
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
      if (imageFile.size > 5 * 1024 * 1024) {
        setErrors(['Image file is too large (max 5MB)']);
        setLoading(false);
        return;
      }
    }

    const normalizeForFirestore = (points) => {
      return points.map(point => ({
        type: point.type,
        coordinate: {
          x: typeof point.coordinate?.x === 'number' ? point.coordinate.x : 0,
          y: typeof point.coordinate?.y === 'number' ? point.coordinate.y : 0,
          z: typeof point.coordinate?.z === 'number' ? point.coordinate.z : 0
        },
        description: point.description || ''
      }));
    };

    const productData = {
      ...formData,
      modelScale,
      inputs: normalizeForFirestore(connectionPoints.inputs),
      outputs: normalizeForFirestore(connectionPoints.outputs)
    };

    try {
      let result;
      if (editingProduct) {
        result = await productManager.updateProduct(editingProduct.id, productData, modelFile, imageFile);
      } else {
        result = await productManager.addProduct(productData, modelFile, imageFile);
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

  const effectiveScale = autoScaleValue !== null ? autoScaleValue * modelScale : modelScale;
  const realWorldDims = getRealDimensions(formData.name);

  const scaledDims = rawDims ? {
    x: (rawDims.x * effectiveScale).toFixed(3),
    y: (rawDims.y * effectiveScale).toFixed(3),
    z: (rawDims.z * effectiveScale).toFixed(3),
  } : null;

  const realDimsMM = realWorldDims ? {
    w: realWorldDims.width_mm,
    d: realWorldDims.depth_mm,
    h: realWorldDims.height_mm,
  } : null;

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="product-manager-overlay">
      <div className="product-manager-form pmf-two-panel">
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

        <div className="pmf-body">
          {/* Left: form fields */}
          <form className="pmf-left" onSubmit={handleSubmit}>
            {/* Basic Information */}
            <div className="form-section">
              <h3>Basic Information</h3>

              <div className="form-row">
                <div className="form-group">
                  <label>Product Name *</label>
                  <input type="text" value={formData.name} onChange={(e) => handleInputChange('name', e.target.value)} placeholder="e.g., CDJ-3000" required />
                </div>
                <div className="form-group">
                  <label>Brand *</label>
                  <input type="text" value={formData.brand} onChange={(e) => handleInputChange('brand', e.target.value)} placeholder="e.g., Pioneer DJ" required />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Setup Type *</label>
                  <select value={formData.category} onChange={(e) => handleInputChange('category', e.target.value)} required>
                    <option value="">Select Setup Type</option>
                    <option value="DJ">DJ</option>
                    <option value="Producer">Producer</option>
                    <option value="Musician">Musician</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Category *</label>
                  <select value={formData.subcategory} onChange={(e) => handleInputChange('subcategory', e.target.value)} required disabled={!formData.category}>
                    <option value="">Select Category</option>
                    {getSubcategories().map(subcat => (
                      <option key={subcat} value={subcat}>{PRODUCT_CATEGORIES[formData.category][subcat].name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Product Type *</label>
                <input type="text" value={formData.type} onChange={(e) => handleInputChange('type', e.target.value)} placeholder="e.g., player, mixer, fx_unit" required />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea value={formData.description} onChange={(e) => handleInputChange('description', e.target.value)} placeholder="Brief description of the product" rows="3" />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Price ($)</label>
                  <input type="number" value={formData.price} onChange={(e) => handleInputChange('price', parseFloat(e.target.value) || 0)} min="0" step="0.01" />
                </div>
                <div className="form-group">
                  <label>Location Priority</label>
                  <input type="number" value={formData.locationPriority} onChange={(e) => handleInputChange('locationPriority', parseInt(e.target.value) || 1000)} min="0" />
                </div>
              </div>
            </div>

            {/* Connection Points */}
            <div className="form-section">
              <h3>Connection Points</h3>

              {['inputs', 'outputs'].map(direction => (
                <div key={direction} className="connection-group">
                  <div className="connection-header">
                    <h4>{direction === 'inputs' ? 'Inputs' : 'Outputs'}</h4>
                    <button type="button" onClick={() => addConnectionPoint(direction)} className="add-connection-btn">
                      + Add {direction === 'inputs' ? 'Input' : 'Output'}
                    </button>
                  </div>

                  {connectionPoints[direction].map((point, index) => (
                    <div key={index} className="connection-point">
                      <select value={point.type} onChange={(e) => updateConnectionPoint(direction, index, 'type', e.target.value)}>
                        <option value="">Select Connection Type</option>
                        {Object.keys(CONNECTION_TYPES).map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                      <div className="coordinate-inputs">
                        {['x', 'y', 'z'].map(axis => (
                          <input key={axis} type="number" placeholder={axis.toUpperCase()} value={point.coordinate[axis]}
                            onChange={(e) => updateConnectionPoint(direction, index, 'coordinate', { ...point.coordinate, [axis]: parseFloat(e.target.value) || 0 })}
                            step="0.01" />
                        ))}
                      </div>
                      <button type="button" onClick={() => removeConnectionPoint(direction, index)} className="remove-connection-btn">Remove</button>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Product Image */}
            <div className="form-section">
              <h3>Product Image</h3>
              <div className="file-group">
                <input type="file" accept="image/*" onChange={(e) => handleFileChange(e.target.files[0], 'image')} />
                {previewImage && (
                  <div className="image-preview">
                    <img src={previewImage} alt="Preview" />
                  </div>
                )}
              </div>
            </div>

            {/* Submit Buttons */}
            <div className="form-actions">
              <button type="button" onClick={onClose} className="cancel-btn">Cancel</button>
              <button type="submit" disabled={loading} className="submit-btn">
                {loading ? 'Saving...' : (editingProduct ? 'Update Product' : 'Add Product')}
              </button>
            </div>
          </form>

          {/* Right: 3D model preview panel */}
          <div className="pmf-right">
            <h3>3D Model</h3>

            {/* Current model status */}
            <div className="pmf-model-status">
              {existingModelPath && !hasNewFile && (
                <div className="pmf-current-model">
                  <span className="pmf-model-indicator">Current model loaded</span>
                  <span className="pmf-model-name" title={editingProduct?.name}>{editingProduct?.name}.glb</span>
                </div>
              )}
              {hasNewFile && (
                <div className="pmf-current-model pmf-new-file">
                  <span className="pmf-model-indicator">New file selected</span>
                  <span className="pmf-model-name">{modelFile.name}</span>
                  <span className="pmf-model-size">{formatFileSize(modelFile.size)}</span>
                </div>
              )}
              {!existingModelPath && !hasNewFile && (
                <div className="pmf-current-model pmf-no-model">
                  <span className="pmf-model-indicator">No 3D model</span>
                </div>
              )}
            </div>

            {/* Upload / Replace button */}
            <div className="pmf-model-upload">
              <label className="pmf-upload-btn">
                {modelSource ? 'Replace 3D Model' : 'Upload 3D Model (.glb)'}
                <input type="file" accept=".glb" onChange={(e) => {
                  if (e.target.files[0]) handleFileChange(e.target.files[0], 'model');
                }} style={{ display: 'none' }} />
              </label>
              {hasNewFile && (
                <button type="button" className="pmf-revert-btn" onClick={() => setModelFile(null)}>
                  {existingModelPath ? 'Revert to Current' : 'Remove'}
                </button>
              )}
            </div>

            {/* 3D Viewer */}
            <div className="pmf-viewer-container">
              {modelSource ? (
                <ModelViewer
                  modelSource={modelSource}
                  scale={effectiveScale}
                  productName={formData.name}
                  onDimensionsChange={setRawDims}
                  onAutoScaleComputed={setAutoScaleValue}
                />
              ) : (
                <div className="pmf-viewer-placeholder">
                  <div className="pmf-placeholder-text">
                    Upload a .glb file to preview
                  </div>
                </div>
              )}
            </div>

            {/* Auto-scale info */}
            {modelSource && autoScaleValue !== null && (
              <div className="pmf-auto-badge">
                Auto-scaled from <strong>{realWorldDims?.name || formData.name}</strong> dimensions
                <span className="pmf-auto-factor">base: {autoScaleValue.toFixed(4)}x</span>
              </div>
            )}
            {modelSource && autoScaleValue === null && formData.name && (
              <div className="pmf-auto-badge pmf-auto-miss">
                No dimensions found for "{formData.name}" — set scale manually
              </div>
            )}

            {/* Real-world dimensions from JSON */}
            {realDimsMM && (
              <div className="pmf-real-dims">
                <span className="pmf-real-label">Real-world size</span>
                <span className="pmf-real-values">{realDimsMM.w} x {realDimsMM.d} x {realDimsMM.h} mm</span>
              </div>
            )}

            {/* Scale controls — manual multiplier on top of auto-scale */}
            {modelSource && (
              <div className="pmf-scale-controls">
                <div className="pmf-scale-header">
                  <label>{autoScaleValue !== null ? 'Manual Multiplier' : 'Scale'}</label>
                  <span className="pmf-scale-value">{modelScale.toFixed(3)}x</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="5"
                  step="0.01"
                  value={modelScale}
                  onChange={(e) => setModelScale(parseFloat(e.target.value))}
                  className="pmf-scale-slider"
                />
                <div className="pmf-scale-presets">
                  {[0.25, 0.5, 1.0, 1.5, 2.0, 3.0].map(v => (
                    <button key={v} type="button"
                      className={`pmf-preset-btn ${modelScale === v ? 'active' : ''}`}
                      onClick={() => setModelScale(v)}>
                      {v}x
                    </button>
                  ))}
                </div>

                {scaledDims && (
                  <div className="pmf-dimensions">
                    <span className="pmf-dim-label">Scene size (units)</span>
                    {[['W', scaledDims.x], ['H', scaledDims.y], ['D', scaledDims.z]].map(([label, val]) => (
                      <span key={label} className="pmf-dim">
                        {label}: <strong>{val}</strong>
                      </span>
                    ))}
                  </div>
                )}

                <div className="pmf-viewer-hint">Drag to orbit · Scroll to zoom · Wireframe box = reference size</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductManagerForm;
