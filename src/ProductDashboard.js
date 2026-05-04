import React, { useState, useEffect } from 'react';
import { productManager, PRODUCT_CATEGORIES } from './productManager';
import ProductManagerForm from './ProductManagerForm';
import { auth } from './firebaseConfig';
import { IoArrowBack } from 'react-icons/io5';
import { MdEdit, MdDelete } from 'react-icons/md';
import {
  Button,
  IconButton,
  Input,
  Card,
  Chip,
  SectionHeader,
  EmptyState,
  useToast,
} from './ui';
import './ProductDashboard.css';

const SETUP_TYPES = ['DJ', 'Producer', 'Musician'];

const getCompatibleSetupTypes = (product) => {
  if (Array.isArray(product.compatibleSetupTypes)) return product.compatibleSetupTypes;
  return product.category ? [product.category] : [];
};

const getCategoryName = (setupType, subcategory) =>
  PRODUCT_CATEGORIES[setupType]?.[subcategory]?.name || subcategory;

const getInitial = (product) => {
  const source = product.brand || product.name || '?';
  return source.trim().charAt(0).toUpperCase();
};

const ProductDashboard = ({ onClose }) => {
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState({ total: 0, bySetupType: {} });
  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
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
    if (!window.confirm(`Delete "${productName}"? This action cannot be undone.`)) return;
    try {
      const result = await productManager.deleteProduct(productId);
      if (result.success) {
        await loadProducts();
        toast.success('Product deleted.');
      } else {
        toast.error('Error deleting product: ' + result.error);
      }
    } catch (error) {
      toast.error('Error deleting product: ' + error.message);
    }
  };

  const matchesSearch = (product) => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      product.name?.toLowerCase().includes(q) ||
      product.brand?.toLowerCase().includes(q) ||
      product.description?.toLowerCase().includes(q)
    );
  };

  const productsBySetupType = SETUP_TYPES.reduce((acc, setupType) => {
    acc[setupType] = products.filter(
      (p) => getCompatibleSetupTypes(p).includes(setupType) && matchesSearch(p)
    );
    return acc;
  }, {});

  const totalFilteredProducts = Object.values(productsBySetupType).reduce(
    (sum, arr) => sum + arr.length,
    0
  );

  const renderProductCard = (product, setupType) => {
    const compatibleTypes = getCompatibleSetupTypes(product);
    const isMultiCompatible = compatibleTypes.length > 1;
    const isOwner = currentUser && product.ownerId && product.ownerId === currentUser.uid;
    const canEdit = isAdmin || isOwner;
    const canDelete = isAdmin || isOwner;
    const hasModel = !!(product.modelPath || product.modelUrl);
    const ioCount = `${product.inputs?.length || 0} IN · ${product.outputs?.length || 0} OUT`;

    return (
      <Card key={`${setupType}-${product.id}`} className="pdash-card" padding="md">
        {(isMultiCompatible || isOwner || (isAdmin && !isOwner)) && (
          <div className="pdash-card__tags">
            {isOwner && <Chip className="pdash-chip--success">Yours</Chip>}
            {isAdmin && !isOwner && <Chip className="pdash-chip--accent">Admin</Chip>}
            {isMultiCompatible && <Chip>Multi-compat</Chip>}
          </div>
        )}

        <div className="pdash-card__head">
          <div className="pdash-card__thumb" aria-hidden="true">
            {product.imageUrl ? (
              <img src={product.imageUrl} alt="" />
            ) : (
              getInitial(product)
            )}
          </div>
          <div className="pdash-card__id">
            <h3 className="pdash-card__name">{product.name}</h3>
            {product.brand && <p className="pdash-card__brand">{product.brand}</p>}
          </div>
          <div className="pdash-card__actions">
            {canEdit && (
              <IconButton
                size="sm"
                onClick={() => setEditingProduct(product)}
                title={isAdmin && !isOwner ? 'Edit (Admin)' : 'Edit'}
                aria-label="Edit product"
              >
                <MdEdit size={16} />
              </IconButton>
            )}
            {canDelete && (
              <IconButton
                size="sm"
                onClick={() => handleDeleteProduct(product.id, product.name)}
                title={isAdmin && !isOwner ? 'Delete (Admin)' : 'Delete'}
                aria-label="Delete product"
              >
                <MdDelete size={16} />
              </IconButton>
            )}
            {!canEdit && !canDelete && <span className="pdash-card__readonly">View</span>}
          </div>
        </div>

        {product.description && (
          <p className="pdash-card__desc">{product.description}</p>
        )}

        <div className="pdash-card__meta">
          <Chip>{getCategoryName(product.category || setupType, product.subcategory)}</Chip>
          {product.price > 0 && (
            <Chip className="pdash-chip--price">${product.price.toLocaleString()}</Chip>
          )}
          <Chip>{ioCount}</Chip>
          {hasModel && <Chip className="pdash-chip--success">3D Model</Chip>}
        </div>

        {product.createdBy && (
          <p className="pdash-card__owner">
            By {product.createdBy === currentUser?.email ? 'You' : product.createdBy}
          </p>
        )}
      </Card>
    );
  };

  return (
    <div className="pdash">
      <div className="pdash__inner">
        <div className="pdash__head">
          <div>
            <h1 className="pdash__title">Product Management</h1>
            <p className="pdash__subtitle">
              Manage all products, their pricing, and 3D models.
            </p>
            {!loading && (
              <div className="pdash__stat-strip mono-label">
                <span><strong>{stats.total || 0}</strong> Total</span>
                {SETUP_TYPES.map((t) => (
                  <span key={t}><strong>{stats.bySetupType?.[t] || 0}</strong> {t}</span>
                ))}
              </div>
            )}
          </div>
          <Button variant="ghost" onClick={onClose}>
            <IoArrowBack size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />
            Back
          </Button>
        </div>

        <div className="pdash__toolbar">
          <Input
            className="pdash__search"
            type="search"
            placeholder="Search products by name, brand, or description"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Button variant="primary" onClick={() => setShowAddForm(true)}>
            Add Product
          </Button>
        </div>

        {loading ? (
          <EmptyState eyebrow="Loading" title="Fetching products…" />
        ) : products.length === 0 ? (
          <EmptyState
            eyebrow="Empty"
            title="No products yet"
            body="Add your first product to get started."
            action={
              <Button variant="primary" onClick={() => setShowAddForm(true)}>
                Add First Product
              </Button>
            }
          />
        ) : totalFilteredProducts === 0 ? (
          <EmptyState
            eyebrow="No matches"
            title={`No products match "${searchTerm}"`}
            body="Try a different search term."
          />
        ) : (
          <div className="pdash__sections">
            {SETUP_TYPES.map((setupType) => {
              const setupProducts = productsBySetupType[setupType] || [];
              if (setupProducts.length === 0 && searchTerm) return null;

              return (
                <section key={setupType}>
                  <SectionHeader
                    eyebrow={setupType}
                    title={`${setupType} Products`}
                    action={<Chip>{setupProducts.length}</Chip>}
                  />
                  {setupProducts.length === 0 ? (
                    <p className="pdash__section-empty">
                      No {setupType.toLowerCase()} products yet.
                    </p>
                  ) : (
                    <div className="pdash__grid">
                      {setupProducts.map((p) => renderProductCard(p, setupType))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>

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
  );
};

export default ProductDashboard;
