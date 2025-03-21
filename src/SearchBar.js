import React, { useState, useEffect } from 'react';
import { db } from './firebaseConfig';
import { collection, getDocs } from 'firebase/firestore';
import './SearchBar.css';

function SearchBar({ onDeviceSelect }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [products, setProducts] = useState([]);

  useEffect(() => {
    // Fetch products from Firestore when component mounts
    const fetchProducts = async () => {
      try {
        const productsRef = collection(db, "products");
        const snapshot = await getDocs(productsRef);
        const productsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setProducts(productsData);
        console.log('Products loaded from Firestore:', productsData);
      } catch (error) {
        console.error('Error fetching products:', error);
      }
    };

    fetchProducts();
  }, []);

  const handleInputChange = (event) => {
    const value = event.target.value.toLowerCase();
    setSearchTerm(value);

    // Filter products based on search term
    const filteredSuggestions = products.filter(product =>
      product.name.toLowerCase().includes(value) ||
      product.category?.toLowerCase().includes(value) ||
      product.description?.toLowerCase().includes(value)
    );

    setSuggestions(filteredSuggestions);
  };

  const handleSuggestionClick = (product) => {
    console.log('Selected product:', product);
    onDeviceSelect(product);
    setSearchTerm('');
    setSuggestions([]);
  };

  return (
    <div className="search-container">
      <input
        type="text"
        value={searchTerm}
        onChange={handleInputChange}
        placeholder="Search for a device..."
        className="search-input"
      />
      {suggestions.length > 0 && (
        <ul className="suggestions-list">
          {suggestions.map((product) => (
            <li
              key={product.id}
              onClick={() => handleSuggestionClick(product)}
              className="suggestion-item"
            >
              {product.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default SearchBar;