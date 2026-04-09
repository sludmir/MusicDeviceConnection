import React, { useState } from 'react';
import { PRODUCT_CATEGORIES } from './productManager';

const SETUP_TYPES = ['DJ', 'Producer', 'Musician'];

const ProductSuggestionForm = ({ onClose, recommendedType, spotType, onModelFileChange, onScaleChange, modelScale: externalScale }) => {
    const [formData, setFormData] = useState({
        name: '',
        brand: '',
        setupType: '',
        subcategory: '',
        description: '',
        inputs: [{ type: '', position: '' }],
        outputs: [{ type: '', position: '' }],
        modelFile: null,
        additionalNotes: ''
    });
    const modelScale = externalScale ?? 1.0;

    const subcategories = formData.setupType && PRODUCT_CATEGORIES[formData.setupType]
        ? Object.entries(PRODUCT_CATEGORIES[formData.setupType])
        : [];

    const handleSubmit = async (e) => {
        e.preventDefault();

        const emailSubject = encodeURIComponent('New Product Suggestion for LiveSet');
        const emailBody = encodeURIComponent(`
Product Information:
-------------------
Name: ${formData.name}
Brand: ${formData.brand}
Setup Type: ${formData.setupType}
Category: ${formData.subcategory}
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
Scale Factor: ${modelScale}
Model File Name: ${formData.modelFile?.name || 'No file selected'}

Additional Notes:
--------------
${formData.additionalNotes}
`);

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
                    .product-suggestion-form * { box-sizing: border-box; }
                    .product-suggestion-form h2,
                    .product-suggestion-form h3,
                    .product-suggestion-form h4 {
                        font-family: inherit;
                        font-style: italic;
                    }
                    .product-suggestion-form input,
                    .product-suggestion-form select,
                    .product-suggestion-form textarea,
                    .product-suggestion-form button {
                        font-family: inherit;
                    }
                    .psf-scroll::-webkit-scrollbar { width: 8px; background-color: #000; }
                    .psf-scroll::-webkit-scrollbar-thumb { background-color: #333; border-radius: 4px; }
                    .psf-scroll::-webkit-scrollbar-track { background-color: #000; }
                `}
            </style>
            <h2 style={{
                marginBottom: '20px',
                fontSize: '24px',
                fontWeight: '600',
                letterSpacing: '-0.5px',
                fontStyle: 'italic'
            }}>Suggest New Product</h2>

            <form onSubmit={handleSubmit} className="psf-scroll" style={{
                height: 'calc(100% - 60px)',
                overflowY: 'auto',
                paddingRight: '6px',
                scrollbarWidth: 'thin',
                scrollbarColor: '#333333 #000000',
            }}>
                <div className="form-section">
                    <h3 style={sectionHeaderStyle}>Basic Information</h3>
                    <input
                        type="text"
                        placeholder="Product Name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                        style={fieldStyle}
                    />
                    <input
                        type="text"
                        placeholder="Brand"
                        value={formData.brand}
                        onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                        required
                        style={fieldStyle}
                    />

                    <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                        <select
                            value={formData.setupType}
                            onChange={(e) => setFormData({ ...formData, setupType: e.target.value, subcategory: '' })}
                            required
                            style={{ ...fieldStyle, flex: 1, marginBottom: 0 }}
                        >
                            <option value="">Setup Type</option>
                            {SETUP_TYPES.map(t => (
                                <option key={t} value={t}>{t}</option>
                            ))}
                        </select>
                        <select
                            value={formData.subcategory}
                            onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
                            required
                            disabled={!formData.setupType}
                            style={{ ...fieldStyle, flex: 1, marginBottom: 0, opacity: formData.setupType ? 1 : 0.5 }}
                        >
                            <option value="">Category</option>
                            {subcategories.map(([key, cat]) => (
                                <option key={key} value={key}>{cat.icon} {cat.name}</option>
                            ))}
                        </select>
                    </div>

                    <textarea
                        placeholder="Description"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        style={{ ...fieldStyle, height: '72px', resize: 'vertical' }}
                    />
                </div>

                <div className="form-section" style={{ marginTop: '20px' }}>
                    <h3 style={sectionHeaderStyle}>Connection Points</h3>

                    <div style={{ marginBottom: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                            <h4 style={subHeaderStyle}>Inputs</h4>
                            <button type="button" onClick={addInput} style={smallBtnStyle}>+ Add Input</button>
                        </div>
                        {formData.inputs.map((input, index) => (
                            <div key={index} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                                <input
                                    type="text"
                                    placeholder="Type (e.g., Line In)"
                                    value={input.type}
                                    onChange={(e) => {
                                        const newInputs = [...formData.inputs];
                                        newInputs[index].type = e.target.value;
                                        setFormData({ ...formData, inputs: newInputs });
                                    }}
                                    style={{ ...fieldStyle, flex: 1, marginBottom: 0 }}
                                />
                                <input
                                    type="text"
                                    placeholder="Position"
                                    value={input.position}
                                    onChange={(e) => {
                                        const newInputs = [...formData.inputs];
                                        newInputs[index].position = e.target.value;
                                        setFormData({ ...formData, inputs: newInputs });
                                    }}
                                    style={{ ...fieldStyle, flex: 1, marginBottom: 0 }}
                                />
                            </div>
                        ))}
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                            <h4 style={subHeaderStyle}>Outputs</h4>
                            <button type="button" onClick={addOutput} style={smallBtnStyle}>+ Add Output</button>
                        </div>
                        {formData.outputs.map((output, index) => (
                            <div key={index} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                                <input
                                    type="text"
                                    placeholder="Type (e.g., Line Out)"
                                    value={output.type}
                                    onChange={(e) => {
                                        const newOutputs = [...formData.outputs];
                                        newOutputs[index].type = e.target.value;
                                        setFormData({ ...formData, outputs: newOutputs });
                                    }}
                                    style={{ ...fieldStyle, flex: 1, marginBottom: 0 }}
                                />
                                <input
                                    type="text"
                                    placeholder="Position"
                                    value={output.position}
                                    onChange={(e) => {
                                        const newOutputs = [...formData.outputs];
                                        newOutputs[index].position = e.target.value;
                                        setFormData({ ...formData, outputs: newOutputs });
                                    }}
                                    style={{ ...fieldStyle, flex: 1, marginBottom: 0 }}
                                />
                            </div>
                        ))}
                    </div>
                </div>

                <div className="form-section" style={{ marginTop: '20px' }}>
                    <h3 style={sectionHeaderStyle}>3D Model</h3>
                    <input
                        type="file"
                        accept=".glb"
                        onChange={(e) => {
                            const f = e.target.files[0] || null;
                            setFormData({ ...formData, modelFile: f });
                            if (onModelFileChange) onModelFileChange(f);
                        }}
                        required
                        style={{ ...fieldStyle, padding: '8px' }}
                    />
                    {formData.modelFile && (
                        <div style={{ marginTop: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                                <label style={{ color: '#ccc', fontSize: '13px', fontWeight: '500', whiteSpace: 'nowrap' }}>Scale</label>
                                <span style={{ color: '#00a2ff', fontSize: '13px', fontVariantNumeric: 'tabular-nums', minWidth: '42px' }}>{modelScale.toFixed(2)}x</span>
                            </div>
                            <input
                                type="range"
                                min="0.001"
                                max="5"
                                step="0.001"
                                value={modelScale}
                                onChange={(e) => { if (onScaleChange) onScaleChange(parseFloat(e.target.value)); }}
                                style={{
                                    width: '100%', height: '6px', borderRadius: '3px',
                                    background: '#444', outline: 'none', cursor: 'pointer',
                                    WebkitAppearance: 'none', appearance: 'none',
                                }}
                            />
                            <div style={{ display: 'flex', gap: '4px', marginTop: '8px' }}>
                                {[0.01, 0.05, 0.1, 0.5, 1.0, 2.0].map(v => (
                                    <button
                                        key={v}
                                        type="button"
                                        onClick={() => { if (onScaleChange) onScaleChange(v); }}
                                        style={{
                                            flex: 1, padding: '5px 0', borderRadius: '5px', fontSize: '11px', cursor: 'pointer',
                                            border: modelScale === v ? '1px solid #00a2ff' : '1px solid rgba(255,255,255,0.15)',
                                            background: modelScale === v ? 'rgba(0,162,255,0.2)' : 'rgba(255,255,255,0.06)',
                                            color: modelScale === v ? '#00a2ff' : '#aaa',
                                            fontWeight: modelScale === v ? '600' : '400',
                                            fontFamily: 'inherit',
                                            transition: 'all 0.15s ease',
                                        }}
                                    >
                                        {v}x
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="form-section" style={{ marginTop: '20px' }}>
                    <h3 style={sectionHeaderStyle}>Additional Notes</h3>
                    <textarea
                        placeholder="Any additional information about the product"
                        value={formData.additionalNotes}
                        onChange={(e) => setFormData({ ...formData, additionalNotes: e.target.value })}
                        style={{ ...fieldStyle, height: '72px', resize: 'vertical' }}
                    />
                </div>

                <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                    <button type="submit" style={{
                        ...smallBtnStyle,
                        backgroundColor: 'rgba(46, 204, 113, 0.2)',
                        border: '1px solid rgba(46, 204, 113, 0.3)',
                        color: '#2ecc71',
                        flex: 1,
                        padding: '10px 16px',
                        fontSize: '14px',
                        fontWeight: '500',
                    }}>
                        Submit Suggestion
                    </button>
                    <button type="button" onClick={onClose} style={{
                        ...smallBtnStyle,
                        flex: 1,
                        padding: '10px 16px',
                        fontSize: '14px',
                        fontWeight: '500',
                    }}>
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    );
};

const fieldStyle = {
    width: '100%',
    padding: '9px 12px',
    marginBottom: '10px',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '6px',
    color: '#ffffff',
    outline: 'none',
    fontSize: '14px',
    lineHeight: '1.4',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
};

const sectionHeaderStyle = {
    fontSize: '16px',
    marginBottom: '12px',
    fontWeight: '500',
    letterSpacing: '-0.3px',
    fontStyle: 'italic',
    color: '#00a2ff',
};

const subHeaderStyle = {
    fontSize: '14px',
    fontWeight: '500',
    letterSpacing: '-0.2px',
    fontStyle: 'italic',
    margin: 0,
};

const smallBtnStyle = {
    padding: '8px 14px',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '6px',
    color: '#ffffff',
    cursor: 'pointer',
    fontSize: '13px',
    fontFamily: 'inherit',
};

export default ProductSuggestionForm;
