import React, { useRef, useEffect } from 'react';

function DeviceCanvas({ device }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!device || !device.connections) {
      return;  // Early return if no device or connections
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    canvas.width = 300;  // Width of the canvas
    canvas.height = 200; // Height of the canvas

    ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear the canvas for new drawing

    // Iterate over each connection to draw it
    device.connections.forEach((connection, index) => {
      const startY = 20 + index * 50; // Starting Y position for each connection line
      const endY = startY;

      // Start drawing
      ctx.beginPath();
      ctx.moveTo(10, startY);  // Start point of the line on the left
      ctx.lineTo(290, endY);   // End point of the line on the right
      ctx.strokeStyle = getLineColor(connection.cable); // Set line color based on cable type
      ctx.lineWidth = 4;       // Set line width
      ctx.stroke();            // Execute the drawing

      // Adding text description near the line
      ctx.fillStyle = 'black';
      ctx.font = '12px Arial';
      // Handle both single string and array for cable
      const cableText = Array.isArray(connection.cable) ? connection.cable.join(', ') : connection.cable;
      ctx.fillText(`${connection.device} (${cableText})`, 150, startY - 5);
    });
  }, [device]);

  // Function to determine line color based on cable type
  function getLineColor(cable) {
    if (Array.isArray(cable) && cable.includes('Audio Cable')) {
      return 'red';
    } else if (Array.isArray(cable) && cable.includes('HDMI Cable')) {
      return 'blue';
    } else if (Array.isArray(cable) && cable.includes('Speaker Wire')) {
      return 'green';
    } else {
      return 'black';  // Default color for other types or single string cable
    }
  }

  return (
    <canvas ref={canvasRef} style={{ width: '100%', height: 'auto', maxWidth: '300px', backgroundColor: 'orange' }} />
  );
}

export default DeviceCanvas;
