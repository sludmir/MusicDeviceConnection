import React, { useState, useEffect } from 'react';
import { productManager, PRODUCT_CATEGORIES } from './productManager';
import ProductManagerForm from './ProductManagerForm';
import { auth } from './firebaseConfig';
import './ProductDashboard.css';

const ProductDashboard = ({ onClose }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState({});
  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Get current user for ownership checks and admin status
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          // Check for admin custom claim
          const tokenResult = await user.getIdTokenResult();
          setIsAdmin(tokenResult.claims.admin === true || tokenResult.claims.admin === 'true');
        } catch (error) {
          console.error('Error checking admin status:', error);
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const allProducts = await productManager.getAllProducts();
      setProducts(allProducts);
      setStats(productManager.getProductStats());
    } catch (error) {
      console.error('Error loading products:', error);
    }
    setLoading(false);
  };

  const handleDeleteProduct = async (productId, productName) => {
    if (window.confirm(`Are you sure you want to delete "${productName}"? This action cannot be undone.`)) {
      try {
        const result = await productManager.deleteProduct(productId);
        if (result.success) {
          await loadProducts(); // Reload products
          alert('Product deleted successfully!');
        } else {
          alert('Error deleting product: ' + result.error);
        }
      } catch (error) {
        alert('Error deleting product: ' + error.message);
      }
    }
  };

  // Get compatible setup types for a product
  // If product has compatibleSetupTypes array, use that; otherwise use the category field
  const getCompatibleSetupTypes = (product) => {
    if (product.compatibleSetupTypes && Array.isArray(product.compatibleSetupTypes)) {
      return product.compatibleSetupTypes;
    }
    // Default: product is compatible with its primary category
    return product.category ? [product.category] : [];
  };

  // Filter products based on search term
  const matchesSearch = (product) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      product.name.toLowerCase().includes(searchLower) ||
      product.brand?.toLowerCase().includes(searchLower) ||
      product.description?.toLowerCase().includes(searchLower)
    );
  };

  // Group products by setup type
  const setupTypes = ['DJ', 'Producer', 'Musician'];
  const productsBySetupType = setupTypes.reduce((acc, setupType) => {
    acc[setupType] = products.filter(product => {
      const compatibleTypes = getCompatibleSetupTypes(product);
      return compatibleTypes.includes(setupType) && matchesSearch(product);
    });
    return acc;
  }, {});

  const getCategoryName = (setupType, subcategory) => {
    return PRODUCT_CATEGORIES[setupType]?.[subcategory]?.name || subcategory;
  };

  const getCategoryIcon = (setupType, subcategory) => {
    return PRODUCT_CATEGORIES[setupType]?.[subcategory]?.icon || '📦';
  };

  const totalFilteredProducts = Object.values(productsBySetupType).reduce((sum, products) => sum + products.length, 0);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a', color: '#ffffff', padding: '40px 20px' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <div className="loading">Loading products...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a', color: '#ffffff', padding: '40px 20px' }}>
      <div className="product-dashboard" style={{ maxWidth: '1400px', margin: '0 auto', maxHeight: 'none', overflow: 'visible' }}>
        <div className="dashboard-header" style={{ marginBottom: '30px' }}>
          <div>
            <h2 style={{ margin: 0, color: '#00a2ff', fontSize: '32px', fontWeight: '600' }}>Product Management</h2>
            <p style={{ margin: '8px 0 0 0', opacity: 0.7, fontSize: '14px' }}>
              Manage all products and their prices
            </p>
          </div>
          <button 
            className="close-btn" 
            onClick={onClose}
            style={{
              background: '#333',
              color: '#fff',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              transition: 'background-color 0.2s ease'
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#444'}
            onMouseLeave={(e) => e.target.style.backgroundColor = '#333'}
          >
            ← Back
          </button>
        </div>

        {/* Statistics */}
        <div className="stats-section">
          <div className="stat-card">
            <div className="stat-number">{stats.total}</div>
            <div className="stat-label">Total Products</div>
          </div>
          {Object.entries(stats.bySetupType).map(([setupType, count]) => (
            <div key={setupType} className="stat-card">
              <div className="stat-number">{count}</div>
              <div className="stat-label">{setupType} Products</div>
            </div>
          ))}
        </div>

        {/* Controls */}
        <div className="controls-section">
          <div className="search-controls">
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
          
          <button 
            className="add-product-btn"
            onClick={() => setShowAddForm(true)}
          >
            + Add New Product
          </button>
        </div>

        {/* Products List - Organized by Setup Type */}
        <div className="products-section">
          <div className="products-header">
            <h3>All Products ({totalFilteredProducts})</h3>
            <p style={{ fontSize: '14px', opacity: 0.7, marginTop: '4px' }}>
              Products are organized by setup type. Products compatible with multiple types appear in all relevant sections.
            </p>
          </div>
          
          {products.length === 0 ? (
            <div className="no-products">
              <div>
                <p>No products found. Add your first product to get started!</p>
                <button 
                  className="add-first-product-btn"
                  onClick={() => setShowAddForm(true)}
                >
                  Add First Product
                </button>
              </div>
            </div>
          ) : (
            <div className="products-by-setup-type">
              {setupTypes.map(setupType => {
                const setupProducts = productsBySetupType[setupType] || [];
                if (setupProducts.length === 0 && searchTerm) return null; // Hide empty sections when searching
                
                return (
                  <div key={setupType} className="setup-type-section">
                    <div className="setup-type-header">
                      <h2>{setupType} Products</h2>
                      <span className="product-count-badge">{setupProducts.length}</span>
                    </div>
                    
                    {setupProducts.length === 0 ? (
                      <div className="no-products-in-section">
                        <p>No {setupType.toLowerCase()} products found.</p>
                      </div>
                    ) : (
                      <div className="products-grid">
                        {setupProducts.map(product => {
                          const compatibleTypes = getCompatibleSetupTypes(product);
                          const isMultiCompatible = compatibleTypes.length > 1;
                          // Check if user owns this product (handle legacy products without ownerId)
                          const isOwner = currentUser && product.ownerId && product.ownerId === currentUser.uid;
                          // Admin can delete/edit any product, or if user owns it
                          const canEdit = isAdmin || isOwner;
                          const canDelete = isAdmin || isOwner;
                          
                          return (
                            <div key={`${setupType}-${product.id}`} className="product-card">
                              {isMultiCompatible && (
                                <div className="multi-compatible-badge" title="Compatible with multiple setup types">
                                  🔄 Multi-compatible
                                </div>
                              )}
                              {isOwner && (
                                <div className="owner-badge" title="You created this product">
                                  👤 Your Product
                                </div>
                              )}
                              {isAdmin && !isOwner && (
                                <div className="admin-badge" title="Admin - You can manage this product">
                                  ⚡ Admin
                                </div>
                              )}
                              <div className="product-header">
                                <div className="product-icon">
                                  {getCategoryIcon(product.category || setupType, product.subcategory)}
                                </div>
                                <div className="product-info">
                                  <h4>{product.name}</h4>
                                  <p className="product-brand">{product.brand}</p>
                                </div>
                                <div className="product-actions">
                                  {canEdit && (
                                    <button 
                                      className="edit-btn"
                                      onClick={() => setEditingProduct(product)}
                                      title={isAdmin ? "Edit Product (Admin)" : "Edit Product"}
                                    >
                                      ✏️
                                    </button>
                                  )}
                                  {canDelete && (
                                    <button 
                                      className="delete-btn"
                                      onClick={() => handleDeleteProduct(product.id, product.name)}
                                      title={isAdmin ? "Delete Product (Admin)" : "Delete Product"}
                                    >
                                      🗑️
                                    </button>
                                  )}
                                  {!canEdit && !canDelete && (
                                    <span className="read-only-indicator" title="You can only delete products you created">
                                      View Only
                                    </span>
                                  )}
                                </div>
                              </div>
                              
                              <div className="product-details">
                                <div className="product-category">
                                  <span className="category-badge">
                                    {product.category || setupType} • {getCategoryName(product.category || setupType, product.subcategory)}
                                  </span>
                                  {isMultiCompatible && (
                                    <span className="compatible-badge" title={`Also compatible with: ${compatibleTypes.filter(t => t !== setupType).join(', ')}`}>
                                      Also: {compatibleTypes.filter(t => t !== setupType).join(', ')}
                                    </span>
                                  )}
                                </div>
                                
                                {product.description && (
                                  <p className="product-description">{product.description}</p>
                                )}
                                
                                <div className="product-specs">
                                  {product.price > 0 && (
                                    <span className="price">${product.price.toLocaleString()}</span>
                                  )}
                                  <span className="type">{product.type}</span>
                                </div>
                                
                                <div className="product-connections">
                                  <span className="connection-count">
                                    {product.inputs?.length || 0} inputs, {product.outputs?.length || 0} outputs
                                  </span>
                                </div>
                                
                                {(product.modelPath || product.modelUrl) && (
                                  <div className="model-status">
                                    <span className="model-indicator">3D Model ✓</span>
                                  </div>
                                )}
                                
                                {product.createdBy && (
                                  <div className="product-owner">
                                    <span className="owner-info" title={`Created by: ${product.createdBy}`}>
                                      Created by: {product.createdBy === currentUser?.email ? 'You' : product.createdBy}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Forms */}
        {showAddForm && (
          <ProductManagerForm
            onClose={() => {
              setShowAddForm(false);
              loadProducts();
            }}
          />
        )}
        
        {editingProduct && (
          <ProductManagerForm
            editingProduct={editingProduct}
            onClose={() => {
              setEditingProduct(null);
              loadProducts();
            }}
          />
        )}
      </div>
    </div>
  );
};

export default ProductDashboard;

