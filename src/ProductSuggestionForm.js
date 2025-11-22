import React, { useState } from 'react';
// import { getConnectionSuggestions } from './chatGPTService';

const ProductSuggestionForm = ({ onClose, recommendedType, spotType }) => {
    const [formData, setFormData] = useState({
        name: '',
        brand: '',
        category: '',
        description: '',
        inputs: [{ type: '', position: '' }],
        outputs: [{ type: '', position: '' }],
        scaleFactor: '',
        modelFile: null,
        additionalNotes: ''
    });
    // const [connectionSuggestions, setConnectionSuggestions] = useState('');
    // const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Get connection suggestions from ChatGPT
        // setIsLoading(true);
        // try {
        //     const suggestions = await getConnectionSuggestions([formData]);
        //     setConnectionSuggestions(suggestions);
        // } catch (error) {
        //     console.error('Error getting connection suggestions:', error);
        //     alert('Failed to get connection suggestions. Please try again.');
        // }
        // setIsLoading(false);
        
        // Create email content
        const emailSubject = encodeURIComponent('New Product Suggestion for Music Equipment Configurator');
        const emailBody = encodeURIComponent(`
Product Information:
-------------------
Name: ${formData.name}
Brand: ${formData.brand}
Category: ${formData.category}
Description: ${formData.description}

Connection Points:
---------------
Inputs:
${formData.inputs.map(input => `- Type: ${input.type}\n  Position: ${input.position}`).join('\n')}

Outputs:
${formData.outputs.map(output => `- Type: ${output.type}\n  Position: ${output.position}`).join('\n')}

Placement Preferences:
-------------------
Recommended Ghost Square: ${recommendedType}
Preferred Position Type: ${spotType}

3D Model Information:
------------------
Scale Factor: ${formData.scaleFactor}
Model File Name: ${formData.modelFile?.name || 'No file selected'}

Additional Notes:
--------------
${formData.additionalNotes}

Connection Suggestions:
-------------------
Connection suggestions temporarily disabled
`);

        // Open email client with the form data
        window.location.href = `mailto:your-email@example.com?subject=${emailSubject}&body=${emailBody}`;
        onClose();
    };

    const addInput = () => {
        setFormData({
            ...formData,
            inputs: [...formData.inputs, { type: '', position: '' }]
        });
    };

    const addOutput = () => {
        setFormData({
            ...formData,
            outputs: [...formData.outputs, { type: '', position: '' }]
        });
    };

    return (
        <div className="product-suggestion-form" style={{
            color: '#ffffff',
            padding: '20px',
            height: '100%',
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }}>
            <style>
                {`
                    .product-suggestion-form {
                        font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                    }
                    .product-suggestion-form h2,
                    .product-suggestion-form h3,
                    .product-suggestion-form h4 {
                        font-family: inherit;
                        font-style: italic;
                    }
                    .product-suggestion-form input,
                    .product-suggestion-form textarea,
                    .product-suggestion-form button {
                        font-family: inherit;
                    }
                `}
            </style>
            <h2 style={{ 
                marginBottom: '20px', 
                fontSize: '24px',
                fontWeight: '600',
                letterSpacing: '-0.5px',
                fontStyle: 'italic'
            }}>Suggest New Product</h2>
            
            <form onSubmit={handleSubmit} style={{
                height: 'calc(100% - 60px)',
                overflowY: 'auto',
                paddingRight: '10px',
                scrollbarWidth: 'thin',
                scrollbarColor: '#333333 #000000',
                msOverflowStyle: 'none'
            }}>
                <style>
                    {`
                        form::-webkit-scrollbar {
                            width: 8px;
                            background-color: #000000;
                        }
                        form::-webkit-scrollbar-thumb {
                            background-color: #333333;
                            border-radius: 4px;
                        }
                        form::-webkit-scrollbar-track {
                            background-color: #000000;
                        }
                    `}
                </style>

                <div className="form-section">
                    <h3 style={{ 
                        fontSize: '18px', 
                        marginBottom: '16px',
                        fontWeight: '500',
                        letterSpacing: '-0.3px',
                        fontStyle: 'italic'
                    }}>Basic Information</h3>
                    <input
                        type="text"
                        placeholder="Product Name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                        style={{...inputStyle, fontFamily: 'inherit'}}
                    />
                    <input
                        type="text"
                        placeholder="Brand"
                        value={formData.brand}
                        onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                        required
                        style={{...inputStyle, fontFamily: 'inherit'}}
                    />
                    <input
                        type="text"
                        placeholder="Category (e.g., Player, Mixer, FX Unit)"
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        required
                        style={{...inputStyle, fontFamily: 'inherit'}}
                    />
                    <textarea
                        placeholder="Description"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        required
                        style={{ ...inputStyle, height: '80px', fontFamily: 'inherit' }}
                    />
                </div>

                <div className="form-section" style={{ marginTop: '24px' }}>
                    <h3 style={{ 
                        fontSize: '18px', 
                        marginBottom: '16px',
                        fontWeight: '500',
                        letterSpacing: '-0.3px',
                        fontStyle: 'italic'
                    }}>Connection Points</h3>
                    
                    <div style={{ marginBottom: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <h4 style={{ 
                                fontSize: '16px',
                                fontWeight: '500',
                                letterSpacing: '-0.2px',
                                fontStyle: 'italic'
                            }}>Inputs</h4>
                            <button type="button" onClick={addInput} style={{...buttonStyle, fontFamily: 'inherit'}}>+ Add Input</button>
                        </div>
                        {formData.inputs.map((input, index) => (
                            <div key={index} style={{ marginBottom: '12px' }}>
                                <input
                                    type="text"
                                    placeholder="Input Type (e.g., Line In, Digital)"
                                    value={input.type}
                                    onChange={(e) => {
                                        const newInputs = [...formData.inputs];
                                        newInputs[index].type = e.target.value;
                                        setFormData({ ...formData, inputs: newInputs });
                                    }}
                                    style={{...inputStyle, fontFamily: 'inherit'}}
                                />
                                <input
                                    type="text"
                                    placeholder="Position on Device"
                                    value={input.position}
                                    onChange={(e) => {
                                        const newInputs = [...formData.inputs];
                                        newInputs[index].position = e.target.value;
                                        setFormData({ ...formData, inputs: newInputs });
                                    }}
                                    style={{...inputStyle, fontFamily: 'inherit'}}
                                />
                            </div>
                        ))}
                    </div>

                    <div style={{ marginBottom: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <h4 style={{ 
                                fontSize: '16px',
                                fontWeight: '500',
                                letterSpacing: '-0.2px',
                                fontStyle: 'italic'
                            }}>Outputs</h4>
                            <button type="button" onClick={addOutput} style={{...buttonStyle, fontFamily: 'inherit'}}>+ Add Output</button>
                        </div>
                        {formData.outputs.map((output, index) => (
                            <div key={index} style={{ marginBottom: '12px' }}>
                                <input
                                    type="text"
                                    placeholder="Output Type (e.g., Line Out, Digital)"
                                    value={output.type}
                                    onChange={(e) => {
                                        const newOutputs = [...formData.outputs];
                                        newOutputs[index].type = e.target.value;
                                        setFormData({ ...formData, outputs: newOutputs });
                                    }}
                                    style={{...inputStyle, fontFamily: 'inherit'}}
                                />
                                <input
                                    type="text"
                                    placeholder="Position on Device"
                                    value={output.position}
                                    onChange={(e) => {
                                        const newOutputs = [...formData.outputs];
                                        newOutputs[index].position = e.target.value;
                                        setFormData({ ...formData, outputs: newOutputs });
                                    }}
                                    style={{...inputStyle, fontFamily: 'inherit'}}
                                />
                            </div>
                        ))}
                    </div>
                </div>

                <div className="form-section" style={{ marginTop: '24px' }}>
                    <h3 style={{ 
                        fontSize: '18px', 
                        marginBottom: '16px',
                        fontWeight: '500',
                        letterSpacing: '-0.3px',
                        fontStyle: 'italic'
                    }}>3D Model Information</h3>
                    <input
                        type="text"
                        placeholder="Scale Factor (e.g., 0.01)"
                        value={formData.scaleFactor}
                        onChange={(e) => setFormData({ ...formData, scaleFactor: e.target.value })}
                        required
                        style={{...inputStyle, fontFamily: 'inherit'}}
                    />
                    <input
                        type="file"
                        accept=".glb"
                        onChange={(e) => setFormData({ ...formData, modelFile: e.target.files[0] })}
                        required
                        style={{ ...inputStyle, padding: '8px', fontFamily: 'inherit' }}
                    />
                </div>

                <div className="form-section" style={{ marginTop: '24px' }}>
                    <h3 style={{ 
                        fontSize: '18px', 
                        marginBottom: '16px',
                        fontWeight: '500',
                        letterSpacing: '-0.3px',
                        fontStyle: 'italic'
                    }}>Additional Notes</h3>
                    <textarea
                        placeholder="Any additional information about the product"
                        value={formData.additionalNotes}
                        onChange={(e) => setFormData({ ...formData, additionalNotes: e.target.value })}
                        style={{ ...inputStyle, height: '80px', fontFamily: 'inherit' }}
                    />
                </div>

                <div className="form-section" style={{ marginTop: '24px' }}>
                    <h3 style={{ 
                        fontSize: '18px', 
                        marginBottom: '16px',
                        fontWeight: '500',
                        letterSpacing: '-0.3px',
                        fontStyle: 'italic'
                    }}>Connection Suggestions</h3>
                    
                    {/* {isLoading ? (
                        <div style={{ color: '#666', fontStyle: 'italic' }}>Getting connection suggestions...</div>
                    ) : connectionSuggestions ? (
                        <div style={{ 
                            backgroundColor: '#1a1a1a',
                            padding: '15px',
                            borderRadius: '8px',
                            marginTop: '10px',
                            whiteSpace: 'pre-wrap',
                            fontFamily: 'inherit'
                        }}>
                            {connectionSuggestions}
                        </div>
                    ) : (
                        <div style={{ color: '#666', fontStyle: 'italic' }}>
                            Connection suggestions will appear here after you submit the form
                        </div>
                    )} */}
                    <div style={{ color: '#666', fontStyle: 'italic' }}>
                        Connection suggestions temporarily disabled
                    </div>
                </div>

                <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
                    <button type="submit" style={{
                        ...buttonStyle,
                        backgroundColor: 'rgba(46, 204, 113, 0.2)',
                        border: '1px solid rgba(46, 204, 113, 0.3)',
                        color: '#2ecc71',
                        flex: 1,
                        fontFamily: 'inherit',
                        fontSize: '14px',
                        fontWeight: '500'
                    }}>
                        Submit Suggestion
                    </button>
                    <button type="button" onClick={onClose} style={{
                        ...buttonStyle,
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        flex: 1,
                        fontFamily: 'inherit',
                        fontSize: '14px',
                        fontWeight: '500'
                    }}>
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    );
};

const inputStyle = {
    width: '100%',
    padding: '10px 14px',
    marginBottom: '12px',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '6px',
    color: '#ffffff',
    outline: 'none',
    fontSize: '14px',
    lineHeight: '1.4',
    transition: 'all 0.2s ease',
    '&:focus': {
        borderColor: 'rgba(46, 204, 113, 0.5)',
        backgroundColor: 'rgba(255, 255, 255, 0.15)'
    },
    '&::placeholder': {
        color: 'rgba(255, 255, 255, 0.5)'
    }
};

const buttonStyle = {
    padding: '10px 16px',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '6px',
    color: '#ffffff',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    fontSize: '14px',
    '&:hover': {
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        borderColor: 'rgba(255, 255, 255, 0.3)'
    }
};

export default ProductSuggestionForm; 