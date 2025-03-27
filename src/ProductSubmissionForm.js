import React, { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from './firebaseConfig';

function ProductSubmissionForm({ onClose }) {
    const [formData, setFormData] = useState({
        name: '',
        category: '',
        modelUrl: '',
        description: '',
        inputs: [],
        outputs: []
    });
    const [newConnection, setNewConnection] = useState({ type: '', coordinate: { x: 0, y: 0, z: 0 } });
    const [connectionType, setConnectionType] = useState('inputs'); // 'inputs' or 'outputs'
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    const connectionTypes = [
        'Digital',
        'Link',
        'Line Out',
        'Line In',
        'Line1',
        'Line2',
        'Line3',
        'Line4',
        'RCA',
        'USB',
        'Audio'
    ];

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleConnectionChange = (e) => {
        const { name, value } = e.target;
        if (name.startsWith('coordinate')) {
            const coord = name.split('.')[1];
            setNewConnection(prev => ({
                ...prev,
                coordinate: {
                    ...prev.coordinate,
                    [coord]: parseFloat(value) || 0
                }
            }));
        } else {
            setNewConnection(prev => ({
                ...prev,
                [name]: value
            }));
        }
    };

    const addConnection = () => {
        if (!newConnection.type) return;

        setFormData(prev => ({
            ...prev,
            [connectionType]: [
                ...prev[connectionType],
                { ...newConnection }
            ]
        }));

        // Reset new connection form
        setNewConnection({ type: '', coordinate: { x: 0, y: 0, z: 0 } });
    };

    const removeConnection = (type, index) => {
        setFormData(prev => ({
            ...prev,
            [type]: prev[type].filter((_, i) => i !== index)
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError('');

        try {
            // Validate required fields
            if (!formData.name || !formData.category || !formData.modelUrl) {
                throw new Error('Please fill in all required fields');
            }

            // Add to Firestore
            const docRef = await addDoc(collection(db, 'products'), {
                ...formData,
                createdAt: new Date()
            });

            console.log('Product added with ID:', docRef.id);
            onClose();
        } catch (error) {
            console.error('Error adding product:', error);
            setError(error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '90vh',
            overflowY: 'auto',
            color: 'black',
            zIndex: 1000
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ margin: 0 }}>Add New Product</h2>
                <button 
                    onClick={onClose}
                    style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '24px',
                        cursor: 'pointer',
                        color: 'black'
                    }}
                >
                    ×
                </button>
            </div>

            {error && (
                <div style={{ 
                    padding: '10px', 
                    backgroundColor: '#ffebee', 
                    color: '#c62828', 
                    borderRadius: '4px',
                    marginBottom: '15px'
                }}>
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px' }}>
                        Product Name *
                    </label>
                    <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        style={{
                            width: '100%',
                            padding: '8px',
                            borderRadius: '4px',
                            border: '1px solid #ddd'
                        }}
                        required
                    />
                </div>

                <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px' }}>
                        Category *
                    </label>
                    <select
                        name="category"
                        value={formData.category}
                        onChange={handleInputChange}
                        style={{
                            width: '100%',
                            padding: '8px',
                            borderRadius: '4px',
                            border: '1px solid #ddd'
                        }}
                        required
                    >
                        <option value="">Select a category</option>
                        <option value="CDJ">CDJ</option>
                        <option value="Mixer">Mixer</option>
                        <option value="Effects">Effects</option>
                        <option value="Controller">Controller</option>
                    </select>
                </div>

                <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px' }}>
                        3D Model URL *
                    </label>
                    <input
                        type="url"
                        name="modelUrl"
                        value={formData.modelUrl}
                        onChange={handleInputChange}
                        style={{
                            width: '100%',
                            padding: '8px',
                            borderRadius: '4px',
                            border: '1px solid #ddd'
                        }}
                        required
                    />
                </div>

                <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px' }}>
                        Description
                    </label>
                    <textarea
                        name="description"
                        value={formData.description}
                        onChange={handleInputChange}
                        style={{
                            width: '100%',
                            padding: '8px',
                            borderRadius: '4px',
                            border: '1px solid #ddd',
                            minHeight: '100px'
                        }}
                    />
                </div>

                {/* Connection Management Section */}
                <div style={{ marginBottom: '20px', border: '1px solid #ddd', padding: '15px', borderRadius: '4px' }}>
                    <h3 style={{ marginTop: 0 }}>Connection Points</h3>
                    
                    <div style={{ marginBottom: '15px' }}>
                        <button
                            type="button"
                            onClick={() => setConnectionType('inputs')}
                            style={{
                                padding: '8px 16px',
                                backgroundColor: connectionType === 'inputs' ? '#4CAF50' : '#f5f5f5',
                                color: connectionType === 'inputs' ? 'white' : 'black',
                                border: 'none',
                                borderRadius: '4px',
                                marginRight: '10px',
                                cursor: 'pointer'
                            }}
                        >
                            Inputs
                        </button>
                        <button
                            type="button"
                            onClick={() => setConnectionType('outputs')}
                            style={{
                                padding: '8px 16px',
                                backgroundColor: connectionType === 'outputs' ? '#4CAF50' : '#f5f5f5',
                                color: connectionType === 'outputs' ? 'white' : 'black',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer'
                            }}
                        >
                            Outputs
                        </button>
                    </div>

                    {/* Connection Type Selection */}
                    <div style={{ marginBottom: '15px' }}>
                        <select
                            name="type"
                            value={newConnection.type}
                            onChange={handleConnectionChange}
                            style={{
                                width: '100%',
                                padding: '8px',
                                borderRadius: '4px',
                                border: '1px solid #ddd',
                                marginBottom: '10px'
                            }}
                        >
                            <option value="">Select connection type</option>
                            {connectionTypes.map(type => (
                                <option key={type} value={type}>{type}</option>
                            ))}
                        </select>
                    </div>

                    {/* Coordinate Inputs */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '15px' }}>
                        {['x', 'y', 'z'].map(coord => (
                            <div key={coord}>
                                <label style={{ display: 'block', marginBottom: '5px' }}>
                                    {coord.toUpperCase()} Coordinate
                                </label>
                                <input
                                    type="number"
                                    name={`coordinate.${coord}`}
                                    value={newConnection.coordinate[coord]}
                                    onChange={handleConnectionChange}
                                    step="0.1"
                                    style={{
                                        width: '100%',
                                        padding: '8px',
                                        borderRadius: '4px',
                                        border: '1px solid #ddd'
                                    }}
                                />
                            </div>
                        ))}
                    </div>

                    <button
                        type="button"
                        onClick={addConnection}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: '#4CAF50',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            width: '100%'
                        }}
                    >
                        Add Connection Point
                    </button>

                    {/* Display Current Connections */}
                    <div style={{ marginTop: '15px' }}>
                        <h4>Current {connectionType}:</h4>
                        <ul style={{ listStyle: 'none', padding: 0 }}>
                            {formData[connectionType].map((conn, index) => (
                                <li key={index} style={{ 
                                    display: 'flex', 
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '8px',
                                    backgroundColor: '#f5f5f5',
                                    marginBottom: '5px',
                                    borderRadius: '4px'
                                }}>
                                    <span>
                                        {conn.type} ({conn.coordinate.x}, {conn.coordinate.y}, {conn.coordinate.z})
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => removeConnection(connectionType, index)}
                                        style={{
                                            padding: '4px 8px',
                                            backgroundColor: '#ff4444',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '4px',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Remove
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={isSubmitting}
                    style={{
                        padding: '12px 24px',
                        backgroundColor: isSubmitting ? '#cccccc' : '#4CAF50',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: isSubmitting ? 'not-allowed' : 'pointer',
                        width: '100%'
                    }}
                >
                    {isSubmitting ? 'Submitting...' : 'Add Product'}
                </button>
            </form>
        </div>
    );
}

export default ProductSubmissionForm; 