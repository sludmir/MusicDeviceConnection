import React, { useState, useEffect } from 'react';
import deviceLibrary from './deviceLibrary';
import './SearchBar.css';
console.log('Device Library:', deviceLibrary);

function SearchBar({ onSearch }) {
  const [inputValue, setInputValue] = useState('');
  const [selectedDevice, setSelectedDevice] = useState('');
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    if (inputValue.length > 0) {
      const filteredSuggestions = Object.entries(deviceLibrary)
        .filter(([key, device]) =>
          key.toLowerCase().includes(inputValue.toLowerCase()) ||
          device.type.toLowerCase().includes(inputValue.toLowerCase()) ||
          device.name.toLowerCase().includes(inputValue.toLowerCase())
        )
        .map(([key, device]) => ({
          label: `${device.type} > ${device.name}`,
          value: key
        }));
      setSuggestions(filteredSuggestions);
    } else {
      setSuggestions([]);
    }
  }, [inputValue]);

  const handleInputChange = (event) => {
    setInputValue(event.target.value);
  };

  const handleSuggestionClick = (deviceKey) => {
    console.log('Clicked device key:', deviceKey);
    console.log('Device from library:', deviceLibrary[deviceKey]);
    const device = deviceLibrary[deviceKey];
    if (device) {
      console.log('Device found, calling onSearch with:', device);
      onSearch(device);
      setSelectedDevice(device.name);
      setInputValue('')
      setSuggestions([]);
      console.log('suggestions: ', suggestions)
    } else {
      console.error(`Device not found: ${deviceKey}`);
      alert('Device not found in library');
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const device = Object.values(deviceLibrary).find(
      d => d.name.toLowerCase() === inputValue.toLowerCase()
    );
    if (device) {
      onSearch(device);
    } else {
      console.error(`Device not found: ${inputValue}`);
      alert('Device not found in library');
      // Fallback to API call if needed
      // ... (keep your existing API call logic here)
    }
  };

  return (
    <div className="search-bar-container">
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          placeholder="Enter device name..."
        />
        <button type="submit">Search</button>
      </form>
      <div className="search-bar-suggestions">
        {suggestions.length > 0 && (
          <ul className="suggestions-list">
            {suggestions.map((suggestion, index) => (
              <li
                key={index}
                onClick={() => handleSuggestionClick(suggestion.value)}
              >
                {suggestion.label}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default SearchBar;