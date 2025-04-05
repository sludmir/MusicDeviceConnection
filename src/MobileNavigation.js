import React, { useState } from 'react';

const MobileNavigation = ({ 
    onSetView, 
    onConnectionsView,
    onOpenSearch,
    placedDevicesList,
    onRemoveDevice,
    isUpdatingPaths,
    onUpdateModelPaths
}) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            {/* Hamburger Button */}
            <button 
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    position: 'fixed',
                    top: '20px',
                    left: '20px',
                    zIndex: 2000,
                    background: 'none',
                    border: 'none',
                    padding: '10px',
                    cursor: 'pointer',
                    width: '44px',
                    height: '44px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center'
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
                left: 0,
                width: '80%',
                maxWidth: '300px',
                height: '100vh',
                backgroundColor: 'rgba(10, 10, 10, 0.95)',
                transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
                transition: 'transform 0.3s ease',
                zIndex: 1999,
                boxShadow: '4px 0 15px rgba(0,0,0,0.3)',
                backdropFilter: 'blur(10px)',
                display: 'flex',
                flexDirection: 'column',
                padding: '80px 20px 20px 20px'
            }}>
                {/* View Controls */}
                <div style={{ marginBottom: '24px' }}>
                    <h3 style={{ 
                        color: '#ffffff', 
                        marginBottom: '12px',
                        fontSize: '14px',
                        opacity: 0.7 
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
                        opacity: 0.7 
                    }}>ACTIONS</h3>
                    <button 
                        onClick={() => {
                            onOpenSearch();
                            setIsOpen(false);
                        }}
                        style={mobileButtonStyle}
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
                        opacity: 0.7 
                    }}>CURRENT SETUP</h3>
                    <div style={{
                        maxHeight: '40vh',
                        overflowY: 'auto',
                        scrollbarWidth: 'thin',
                        scrollbarColor: '#333333 #000000'
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
                                    padding: '8px 12px',
                                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                    borderRadius: '4px',
                                    marginBottom: '8px'
                                }}
                            >
                                <span style={{ color: '#ffffff' }}>{device.name}</span>
                                <button 
                                    onClick={() => onRemoveDevice(device.uniqueId)}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: '#ff6b6b',
                                        cursor: 'pointer',
                                        padding: '4px 8px',
                                        fontSize: '12px'
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
                                padding: '20px 0'
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
                        zIndex: 1998
                    }}
                />
            )}
        </>
    );
};

const mobileButtonStyle = {
    width: '100%',
    padding: '12px',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '4px',
    color: '#ffffff',
    marginBottom: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    textAlign: 'left',
    fontSize: '14px'
};

export default MobileNavigation; 