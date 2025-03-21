import React from 'react';

function DeviceConnections({ device }) {
  if (!device || !device.connections) {
    return <p>No connections available</p>;
  }

  return (
    <div>
      <h3>Connections:</h3>
      <ul>
        {device.connections.map((connection, index) => {
          
          const cables = connection.cable || 'Unknown cable'; // Fallback if cable is undefined
          const targetDevice = connection.device || 'Unknown device';
          
          console.log("DeviceConnections 123");
          console.log(connection);
          console.log(cables);

          return (
            <li key={index}>
              Connects to {targetDevice} using {cables}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default DeviceConnections;
