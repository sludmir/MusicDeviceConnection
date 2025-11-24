import React from 'react';
import DeviceConnections from './DeviceConnections';

function DeviceDisplay({ device, onAddToDeviceSetup }) {
  if (!device) {
    return <p>No device selected</p>;
  }

  const handleAddToSetup = () => {
    console.log("Add to Setup clicked for:", device.name);
    if (onAddToDeviceSetup) {
      onAddToDeviceSetup(device);
    } else {
      console.error('onAddToDeviceSetup function is not provided');
    }
  };

  return (
    <div className='device-display'>
      <h2>{device.name}</h2>
      {device.image && <img src={device.image} alt={`${device.name}`} style={{ width: '100%', maxWidth: '300px' }} />}
      <p>{device.description}</p>
      <button onClick={handleAddToSetup}>Add to My Setup</button>
      <h3>Inputs:</h3>
      <ul>
        {device.inputs && device.inputs.map((input, index) => (
          <li key={input.type || index}> {/* Use input.type if available */}
            {input.type} at {input.coordinate.toArray().join(', ')} {/* Display type and coordinate */}
          </li>
        ))}
      </ul>
      <h3>Outputs:</h3>
      <ul>
        {device.outputs && device.outputs.map((output, index) => (
          <li key={output.type || index}> {/* Use output.type if available */}
            {output.type} at {output.coordinate.toArray().join(', ')} {/* Display type and coordinate */}
          </li>
        ))}
      </ul>
      <h3>Cables:</h3>
      <ul>
        {device.cables && device.cables.map((cable, index) => (
          <li key={index}>{cable}</li>
        ))}
      </ul>
      <DeviceConnections device={device} />
    </div>
  );
}

export default DeviceDisplay;