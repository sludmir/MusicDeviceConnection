import React, { useState, useEffect } from 'react';
import { getConnectionSuggestions } from './chatGPTService';

const ConnectionPanel = ({ devices, setupType }) => {
    const [suggestions, setSuggestions] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchSuggestions = async () => {
            if (devices && devices.length > 0) {
                setIsLoading(true);
                setError(null);
                try {
                    const result = await getConnectionSuggestions(devices);
                    setSuggestions(result);
                } catch (err) {
                    setError('Failed to get connection suggestions. Please try again.');
                    console.error('Error fetching suggestions:', err);
                }
                setIsLoading(false);
            }
        };

        fetchSuggestions();
    }, [devices]);

    return (
        <div style={{
            width: '300px',
            height: '100%',
            backgroundColor: '#1a1a1a',
            borderRight: '1px solid #333',
            padding: '20px',
            overflowY: 'auto',
            color: '#fff',
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }}>
            <h2 style={{
                fontSize: '20px',
                marginBottom: '20px',
                fontWeight: '600',
                letterSpacing: '-0.5px',
                fontStyle: 'italic'
            }}>
                Connection Guide
            </h2>
            
            {isLoading ? (
                <div style={{ color: '#666', fontStyle: 'italic' }}>
                    Analyzing your setup...
                </div>
            ) : error ? (
                <div style={{ color: '#ff6b6b', fontStyle: 'italic' }}>
                    {error}
                </div>
            ) : suggestions ? (
                <div style={{
                    backgroundColor: '#2a2a2a',
                    padding: '15px',
                    borderRadius: '8px',
                    whiteSpace: 'pre-wrap',
                    fontSize: '14px',
                    lineHeight: '1.6'
                }}>
                    {suggestions}
                </div>
            ) : (
                <div style={{ color: '#666', fontStyle: 'italic' }}>
                    Add devices to your setup to see connection suggestions
                </div>
            )}

            <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#2a2a2a', borderRadius: '8px' }}>
                <h3 style={{ fontSize: '16px', marginBottom: '10px', fontWeight: '500' }}>Current Setup</h3>
                <div style={{ fontSize: '14px', color: '#ccc' }}>
                    {devices && devices.length > 0 ? (
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                            {devices.map((device, index) => (
                                <li key={index} style={{ marginBottom: '8px' }}>
                                    {device.name || 'Unnamed Device'}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p style={{ fontStyle: 'italic', color: '#666' }}>No devices added yet</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ConnectionPanel; 