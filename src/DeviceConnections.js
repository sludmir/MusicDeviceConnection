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
          // Ensure 'cable' is an array before trying to join it
          const cables = Array.isArray(connection.cable) ? connection.cable.join(', ') : connection.cable;
          return (
            <li key={index}>
              Connects to {connection.device} using {cables}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default DeviceConnections;
