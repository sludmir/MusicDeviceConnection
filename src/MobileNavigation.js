import React, { useState } from 'react';

const MobileNavigation = ({ 
    onSetView, 
    onConnectionsView,
    onOpenSearch,
    placedDevicesList,
    onRemoveDevice,
    isUpdatingPaths,
    onUpdateModelPaths,
    style
}) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            {/* Hamburger Button */}
            <button 
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    ...style,
                    background: 'rgba(0, 0, 0, 0.7)',
                    border: 'none',
                    padding: '12px',
                    cursor: 'pointer',
                    borderRadius: '8px',
                    backdropFilter: 'blur(10px)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                }}
            >
                <div style={{
                    width: '24px',
                    height: '2px',
                    backgroundColor: '#ffffff',
                    marginBottom: '6px',
                    transition: 'transform 0.3s ease',
                    transform: isOpen ? 'rotate(45deg) translate(6px, 6px)' : 'none'
                }}/>
                <div style={{
                    width: '24px',
                    height: '2px',
                    backgroundColor: '#ffffff',
                    marginBottom: '6px',
                    opacity: isOpen ? 0 : 1,
                    transition: 'opacity 0.3s ease'
                }}/>
                <div style={{
                    width: '24px',
                    height: '2px',
                    backgroundColor: '#ffffff',
                    transition: 'transform 0.3s ease',
                    transform: isOpen ? 'rotate(-45deg) translate(6px, -6px)' : 'none'
                }}/>
            </button>

            {/* Mobile Menu */}
            <div style={{
                position: 'fixed',
                top: 0,
                right: 0,
                width: '80%',
                maxWidth: '300px',
                height: '100vh',
                backgroundColor: 'rgba(10, 10, 10, 0.95)',
                transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
                transition: 'transform 0.3s ease',
                zIndex: 1999,
                boxShadow: '-4px 0 15px rgba(0,0,0,0.3)',
                backdropFilter: 'blur(10px)',
                display: 'flex',
                flexDirection: 'column',
                padding: '80px 20px 20px 20px',
                overflowY: 'auto',
                WebkitOverflowScrolling: 'touch'
            }}>
                {/* View Controls */}
                <div style={{ marginBottom: '24px' }}>
                    <h3 style={{ 
                        color: '#ffffff', 
                        marginBottom: '12px',
                        fontSize: '14px',
                        opacity: 0.7,
                        letterSpacing: '1px'
                    }}>VIEW</h3>
                    <button 
                        onClick={() => {
                            onSetView();
                            setIsOpen(false);
                        }}
                        style={mobileButtonStyle}
                    >
                        Set View
                    </button>
                    <button 
                        onClick={() => {
                            onConnectionsView();
                            setIsOpen(false);
                        }}
                        style={mobileButtonStyle}
                    >
                        Connections View
                    </button>
                </div>

                {/* Actions */}
                <div style={{ marginBottom: '24px' }}>
                    <h3 style={{ 
                        color: '#ffffff', 
                        marginBottom: '12px',
                        fontSize: '14px',
                        opacity: 0.7,
                        letterSpacing: '1px'
                    }}>ACTIONS</h3>
                    <button 
                        onClick={() => {
                            onOpenSearch();
                            setIsOpen(false);
                        }}
                        style={{
                            ...mobileButtonStyle,
                            backgroundColor: 'rgba(0, 162, 255, 0.2)',
                            borderColor: 'rgba(0, 162, 255, 0.3)'
                        }}
                    >
                        Add Device
                    </button>
                    <button
                        onClick={() => {
                            onUpdateModelPaths();
                            setIsOpen(false);
                        }}
                        disabled={isUpdatingPaths}
                        style={mobileButtonStyle}
                    >
                        Update Model Paths
                    </button>
                </div>

                {/* Current Setup */}
                <div>
                    <h3 style={{ 
                        color: '#ffffff', 
                        marginBottom: '12px',
                        fontSize: '14px',
                        opacity: 0.7,
                        letterSpacing: '1px'
                    }}>CURRENT SETUP</h3>
                    <div style={{
                        maxHeight: '40vh',
                        overflowY: 'auto',
                        scrollbarWidth: 'thin',
                        scrollbarColor: '#333333 #000000',
                        WebkitOverflowScrolling: 'touch'
                    }}>
                        <style>
                            {`
                                div::-webkit-scrollbar {
                                    width: 8px;
                                    background-color: #000000;
                                }
                                div::-webkit-scrollbar-thumb {
                                    background-color: #333333;
                                    border-radius: 4px;
                                }
                                div::-webkit-scrollbar-track {
                                    background-color: #000000;
                                }
                            `}
                        </style>
                        {placedDevicesList.map((device) => (
                            <div 
                                key={device.uniqueId} 
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '12px 16px',
                                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                    borderRadius: '8px',
                                    marginBottom: '8px'
                                }}
                            >
                                <span style={{ 
                                    color: '#ffffff',
                                    fontSize: '14px'
                                }}>{device.name}</span>
                                <button 
                                    onClick={() => onRemoveDevice(device.uniqueId)}
                                    style={{
                                        background: 'rgba(255, 107, 107, 0.2)',
                                        border: '1px solid rgba(255, 107, 107, 0.3)',
                                        color: '#ff6b6b',
                                        cursor: 'pointer',
                                        padding: '6px 12px',
                                        fontSize: '12px',
                                        borderRadius: '4px',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    Remove
                                </button>
                            </div>
                        ))}
                        {placedDevicesList.length === 0 && (
                            <div style={{ 
                                textAlign: 'center', 
                                color: '#ffffff',
                                opacity: 0.5,
                                padding: '20px 0',
                                fontSize: '14px'
                            }}>
                                No devices added yet
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Backdrop */}
            {isOpen && (
                <div 
                    onClick={() => setIsOpen(false)}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        backdropFilter: 'blur(4px)',
                        zIndex: 1998
                    }}
                />
            )}
        </>
    );
};

const mobileButtonStyle = {
    width: '100%',
    padding: '12px 16px',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '8px',
    color: '#ffffff',
    marginBottom: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    textAlign: 'left',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
};

export default MobileNavigation; 