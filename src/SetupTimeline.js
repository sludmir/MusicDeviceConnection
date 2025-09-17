import React, { useState, useEffect } from 'react';

const SetupTimeline = ({ setupType, currentDevices, onCategorySelect, selectedCategory, onToggleCategory }) => {
    const [categories, setCategories] = useState([]);
    const [completedCategories, setCompletedCategories] = useState(new Set());
    const [hiddenCategories, setHiddenCategories] = useState(new Set());

    // Define categories for each setup type
    const setupCategories = {
        DJ: [
            { id: 'players', name: 'Players', description: 'CDJs, Turntables, Controllers' },
            { id: 'mixers', name: 'Mixers', description: 'DJM Series, Xone, etc.' },
            { id: 'effects', name: 'Effects', description: 'RMX, SP-1, etc.' },
            { id: 'speakers', name: 'Speakers', description: 'Monitors, PA Systems' },
            { id: 'cables', name: 'Cables', description: 'RCA, XLR, Ethernet' },
            { id: 'accessories', name: 'Accessories', description: 'Headphones, Cases' }
        ],
        Producer: [
            { id: 'audio-interface', name: 'Audio Interface', description: 'Focusrite, PreSonus, etc.' },
            { id: 'synthesizers', name: 'Synthesizers', description: 'Moog, Korg, Sequential' },
            { id: 'controllers', name: 'Controllers', description: 'MIDI, Pad Controllers' },
            { id: 'monitors', name: 'Monitors', description: 'Studio Monitors, Subwoofers' },
            { id: 'microphones', name: 'Microphones', description: 'Condenser, Dynamic, USB' },
            { id: 'software', name: 'Software', description: 'DAW, Plugins, Samples' }
        ],
        Musician: [
            { id: 'instruments', name: 'Instruments', description: 'Guitars, Basses, Keyboards' },
            { id: 'amplifiers', name: 'Amplifiers', description: 'Guitar Amps, Bass Amps' },
            { id: 'effects', name: 'Effects', description: 'Pedals, Rack Units' },
            { id: 'microphones', name: 'Microphones', description: 'Vocal, Instrument' },
            { id: 'cables', name: 'Cables', description: 'Instrument, Speaker, XLR' },
            { id: 'accessories', name: 'Accessories', description: 'Stands, Cases, Tuners' }
        ]
    };

    // Update categories when setup type changes
    useEffect(() => {
        setCategories(setupCategories[setupType] || []);
        setCompletedCategories(new Set());
        setHiddenCategories(new Set());
    }, [setupType]);

    // Handle category toggle
    const handleCategoryToggle = (categoryId) => {
        const newHiddenCategories = new Set(hiddenCategories);
        const wasHidden = newHiddenCategories.has(categoryId);
        if (wasHidden) {
            newHiddenCategories.delete(categoryId);
        } else {
            newHiddenCategories.add(categoryId);
        }
        setHiddenCategories(newHiddenCategories);
        
        const isNowVisible = !newHiddenCategories.has(categoryId);
        
        // Call parent callback to toggle device visibility
        if (onToggleCategory) {
            onToggleCategory(categoryId, isNowVisible);
        }
    };

    // Check which categories are completed based on current devices
    useEffect(() => {
        if (!currentDevices || currentDevices.length === 0) {
            setCompletedCategories(new Set());
            return;
        }

        const completed = new Set();
        categories.forEach(category => {
            const categoryDevices = currentDevices.filter(device => {
                // Simple category matching based on device name/type
                const deviceName = device.name.toLowerCase();
                const deviceType = device.type?.toLowerCase() || '';
                
                switch (category.id) {
                    case 'players':
                        return deviceName.includes('cdj') || deviceName.includes('turntable') || deviceName.includes('controller');
                    case 'mixers':
                        return deviceName.includes('djm') || deviceName.includes('mixer') || deviceName.includes('xone');
                    case 'effects':
                        return deviceName.includes('rmx') || deviceName.includes('effect') || deviceName.includes('sp-1');
                    case 'speakers':
                        return deviceName.includes('speaker') || deviceName.includes('monitor') || deviceName.includes('pa');
                    case 'cables':
                        return deviceName.includes('cable') || deviceName.includes('rca') || deviceName.includes('xlr');
                    case 'accessories':
                        return deviceName.includes('headphone') || deviceName.includes('case') || deviceName.includes('stand');
                    case 'audio-interface':
                        return deviceName.includes('interface') || deviceName.includes('focusrite') || deviceName.includes('presonus');
                    case 'synthesizers':
                        return deviceName.includes('synth') || deviceName.includes('moog') || deviceName.includes('korg');
                    case 'controllers':
                        return deviceName.includes('midi') || deviceName.includes('controller') || deviceName.includes('pad');
                    case 'monitors':
                        return deviceName.includes('monitor') || deviceName.includes('speaker') || deviceName.includes('subwoofer');
                    case 'microphones':
                        return deviceName.includes('mic') || deviceName.includes('microphone') || deviceName.includes('condenser');
                    case 'software':
                        return deviceName.includes('daw') || deviceName.includes('plugin') || deviceName.includes('software');
                    case 'instruments':
                        return deviceName.includes('guitar') || deviceName.includes('bass') || deviceName.includes('keyboard');
                    case 'amplifiers':
                        return deviceName.includes('amp') || deviceName.includes('amplifier') || deviceName.includes('head');
                    default:
                        return false;
                }
            });
            
            if (categoryDevices.length > 0) {
                completed.add(category.id);
            }
        });
        
        setCompletedCategories(completed);
    }, [currentDevices, categories]);

    const getCategoryCount = (categoryId) => {
        if (!currentDevices) return 0;
        
        return currentDevices.filter(device => {
            const deviceName = device.name.toLowerCase();
            const deviceType = device.type?.toLowerCase() || '';
            
            switch (categoryId) {
                case 'players':
                    return deviceName.includes('cdj') || deviceName.includes('turntable') || deviceName.includes('controller');
                case 'mixers':
                    return deviceName.includes('djm') || deviceName.includes('mixer') || deviceName.includes('xone');
                case 'effects':
                    return deviceName.includes('rmx') || deviceName.includes('effect') || deviceName.includes('sp-1');
                case 'speakers':
                    return deviceName.includes('speaker') || deviceName.includes('monitor') || deviceName.includes('pa');
                case 'cables':
                    return deviceName.includes('cable') || deviceName.includes('rca') || deviceName.includes('xlr');
                case 'accessories':
                    return deviceName.includes('headphone') || deviceName.includes('case') || deviceName.includes('stand');
                case 'audio-interface':
                    return deviceName.includes('interface') || deviceName.includes('focusrite') || deviceName.includes('presonus');
                case 'synthesizers':
                    return deviceName.includes('synth') || deviceName.includes('moog') || deviceName.includes('korg');
                case 'controllers':
                    return deviceName.includes('midi') || deviceName.includes('controller') || deviceName.includes('pad');
                case 'monitors':
                    return deviceName.includes('monitor') || deviceName.includes('speaker') || deviceName.includes('subwoofer');
                case 'microphones':
                    return deviceName.includes('mic') || deviceName.includes('microphone') || deviceName.includes('condenser');
                case 'software':
                    return deviceName.includes('daw') || deviceName.includes('plugin') || deviceName.includes('software');
                case 'instruments':
                    return deviceName.includes('guitar') || deviceName.includes('bass') || deviceName.includes('keyboard');
                case 'amplifiers':
                    return deviceName.includes('amp') || deviceName.includes('amplifier') || deviceName.includes('head');
                default:
                    return false;
            }
        }).length;
    };

    return (
        <div         style={{
            position: 'fixed',
            bottom: 0, // Back to bottom position
            left: 0,
            right: '45%', // Stretch slightly further right to fit all categories
            backgroundColor: '#1a1a1a',
            borderTop: '1px solid #333',
            padding: '12px 20px',
            zIndex: 1000,
            overflowX: 'auto',
            overflowY: 'hidden'
        }}>
            <div style={{
                display: 'flex',
                gap: '12px',
                minWidth: 'max-content',
                alignItems: 'center'
            }}>
                {categories.map((category, index) => {
                    const isCompleted = completedCategories.has(category.id);
                    const isSelected = selectedCategory === category.id;
                    const count = getCategoryCount(category.id);
                    
                    return (
                        <div
                            key={category.id}
                            onClick={() => handleCategoryToggle(category.id)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '8px 12px',
                                backgroundColor: isSelected ? '#00a2ff' : isCompleted ? '#2d5a2d' : '#2a2a2a',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                border: isSelected ? '2px solid #00a2ff' : '2px solid transparent',
                                minWidth: '120px',
                                justifyContent: 'center',
                                opacity: hiddenCategories.has(category.id) ? 0.5 : 1
                            }}
                        >
                            <div style={{ textAlign: 'center' }}>
                                <div style={{
                                    color: '#fff',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    marginBottom: '2px'
                                }}>
                                    {category.name}
                                </div>
                                {count > 0 && (
                                    <div style={{
                                        color: isCompleted ? '#4ade80' : '#00a2ff',
                                        fontSize: '12px',
                                        fontWeight: '500'
                                    }}>
                                        {count} selected
                                    </div>
                                )}
                            </div>
                            {isCompleted && (
                                <div style={{
                                    color: '#4ade80',
                                    fontSize: '16px',
                                    marginLeft: '4px'
                                }}>
                                    ✓
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default SetupTimeline;
