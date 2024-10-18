import React, { useState } from 'react';
import './App.css';
import SearchBar from './SearchBar';
import DeviceDisplay from './DeviceDisplay';
import ThreeScene from './ThreeScene';
import deviceLibrary from './deviceLibrary';

function App() {
  const [device, setDevice] = useState(null);
  const [setupDevices, setSetupDevices] = useState([]);

  function handleDeviceSearch(deviceData) {
    console.log("Received device data:", deviceData);
    if (deviceData && deviceData.name) {
      setDevice(deviceData);
      console.log("Device set:", deviceData.name);
    } else {
      setDevice(null);
      console.error("Invalid device data received");
      alert('Device not found in library');
    }
  }

  const handleAddToDeviceSetup = (deviceToAdd) => {
    console.log("Attempting to add device:", deviceToAdd.name);
    const newDevice = { ...deviceToAdd, id: Date.now() };
    setSetupDevices(prevDevices => {
      const updatedDevices = [...prevDevices, newDevice];
      console.log("Updated setup devices:", updatedDevices);
      return updatedDevices;
    });
    console.log("Device added to setup:", newDevice.name, "with ID:", newDevice.id);
  };

  const handleRemoveFromSetup = (deviceId) => {
    setSetupDevices(prevDevices => {
      const updatedDevices = prevDevices.filter(d => d.id !== deviceId);
      console.log("Updated setup devices after removal:", updatedDevices);
      return updatedDevices;
    });
    console.log("Device removed from setup with ID:", deviceId);
  };

  const calculateTotalPrice = () => {
    return setupDevices.reduce((total, device) => total + (device.price || 0), 0);
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Pioneer DJ Equipment Configurator</h1>
      </header>
      <div className="main-content">
        <div className="sidebar">
          <SearchBar onSearch={handleDeviceSearch} />
          {device && <DeviceDisplay device={device} onAddToDeviceSetup={handleAddToDeviceSetup} />}
          <div className="my-setup">
            <h2>My Setup</h2>
            <ul>
              {setupDevices.map(device => (
                <li key={device.id}>
                  {device.name}
                  <button onClick={() => handleRemoveFromSetup(device.id)}>Remove</button>
                </li>
              ))}
            </ul>
            <div className="total-price">
              Total: ${calculateTotalPrice().toFixed(2)}
            </div>
            <button className="buy-now-btn">Buy Now</button>
          </div>
        </div>
        <div className="render-area">
          <ThreeScene devices={setupDevices} />
        </div>
      </div>
    </div>
  );
}

export default App;