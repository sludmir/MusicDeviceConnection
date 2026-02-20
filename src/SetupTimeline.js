import React, { useState, useEffect, useMemo } from 'react';

const SetupTimeline = ({ setupType, currentDevices, onCategorySelect, selectedCategory, onToggleCategory }) => {
    const [categories, setCategories] = useState([]);
    const [completedCategories, setCompletedCategories] = useState(new Set());
    const [hiddenCategories, setHiddenCategories] = useState(new Set());

    // Define categories for each setup type (memoized to prevent dependency issues)
    const setupCategories = useMemo(() => ({
        DJ: [
            { id: 'players', name: 'Players', description: 'CDJs, Turntables, Controllers', icon: '🎧' },
            { id: 'mixers', name: 'Mixers', description: 'DJM Series, Xone, etc.', icon: '🎛️' },
            { id: 'effects', name: 'Effects', description: 'RMX, SP-1, etc.', icon: '🎚️' },
            { id: 'speakers', name: 'Speakers', description: 'Monitors, PA Systems', icon: '🔊' },
            { id: 'cables', name: 'Cables', description: 'RCA, XLR, Ethernet', icon: '🔌' },
            { id: 'accessories', name: 'Accessories', description: 'Headphones, Cases', icon: '🎧' }
        ],
        Producer: [
            { id: 'audio-interface', name: 'Audio Interface', description: 'Focusrite, PreSonus, etc.', icon: '🎤' },
            { id: 'synthesizers', name: 'Synthesizers', description: 'Moog, Korg, Sequential', icon: '🎹' },
            { id: 'controllers', name: 'Controllers', description: 'MIDI, Pad Controllers', icon: '🎮' },
            { id: 'monitors', name: 'Monitors', description: 'Studio Monitors, Subwoofers', icon: '🔊' },
            { id: 'microphones', name: 'Microphones', description: 'Condenser, Dynamic, USB', icon: '🎤' },
            { id: 'software', name: 'Software', description: 'DAW, Plugins, Samples', icon: '💻' }
        ],
        Musician: [
            { id: 'instruments', name: 'Instruments', description: 'Guitars, Basses, Keyboards', icon: '🎸' },
            { id: 'amplifiers', name: 'Amplifiers', description: 'Guitar Amps, Bass Amps', icon: '🔊' },
            { id: 'effects', name: 'Effects', description: 'Pedals, Rack Units', icon: '🎚️' },
            { id: 'microphones', name: 'Microphones', description: 'Vocal, Instrument', icon: '🎤' },
            { id: 'cables', name: 'Cables', description: 'Instrument, Speaker, XLR', icon: '🔌' },
            { id: 'accessories', name: 'Accessories', description: 'Stands, Cases, Tuners', icon: '🎧' }
        ]
    }), []);

    // Update categories when setup type changes
    useEffect(() => {
        setCategories(setupCategories[setupType] || []);
        setCompletedCategories(new Set());
        setHiddenCategories(new Set());
    }, [setupType, setupCategories]);

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
        <div
            className="setup-timeline-bar"
            style={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                backgroundColor: 'rgba(12, 12, 18, 0.95)',
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                padding: '16px 24px',
                zIndex: 1000,
                backdropFilter: 'blur(12px)',
                boxShadow: '0 -4px 24px rgba(0, 0, 0, 0.3)'
            }}
        >
            <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '14px',
                justifyContent: 'center',
                alignItems: 'center',
                maxWidth: '100%',
                margin: '0 auto'
            }}>
                {categories.map((category) => {
                    const isCompleted = completedCategories.has(category.id);
                    const isSelected = selectedCategory === category.id;
                    const isHidden = hiddenCategories.has(category.id);
                    const count = getCategoryCount(category.id);
                    const icon = category.icon || '•';

                    return (
                        <button
                            key={category.id}
                            type="button"
                            onClick={() => {
                                handleCategoryToggle(category.id);
                                if (onCategorySelect) onCategorySelect(category.id);
                            }}
                            className="setup-timeline-category-btn"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                padding: '12px 18px',
                                backgroundColor: isSelected
                                    ? 'rgba(0, 162, 255, 0.25)'
                                    : isCompleted
                                        ? 'rgba(45, 90, 45, 0.4)'
                                        : 'rgba(255, 255, 255, 0.06)',
                                borderRadius: '12px',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                border: isSelected
                                    ? '1px solid rgba(0, 162, 255, 0.6)'
                                    : '1px solid rgba(255, 255, 255, 0.1)',
                                minWidth: '130px',
                                justifyContent: 'center',
                                opacity: isHidden ? 0.5 : 1,
                                color: '#fff',
                                fontFamily: 'inherit',
                                fontSize: '14px',
                                fontWeight: '600',
                                boxShadow: isSelected ? '0 0 20px rgba(0, 162, 255, 0.15)' : 'none',
                                outline: 'none'
                            }}
                            onMouseEnter={(e) => {
                                if (isHidden) return;
                                e.currentTarget.style.backgroundColor = isSelected
                                    ? 'rgba(0, 162, 255, 0.35)'
                                    : isCompleted
                                        ? 'rgba(45, 90, 45, 0.55)'
                                        : 'rgba(255, 255, 255, 0.12)';
                                e.currentTarget.style.transform = 'translateY(-1px)';
                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = isSelected
                                    ? 'rgba(0, 162, 255, 0.25)'
                                    : isCompleted
                                        ? 'rgba(45, 90, 45, 0.4)'
                                        : 'rgba(255, 255, 255, 0.06)';
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = isSelected ? '0 0 20px rgba(0, 162, 255, 0.15)' : 'none';
                            }}
                        >
                            <span style={{ fontSize: '18px', lineHeight: 1 }} aria-hidden>{icon}</span>
                            <div style={{ textAlign: 'left' }}>
                                <div style={{ marginBottom: count > 0 ? '2px' : 0 }}>
                                    {category.name}
                                </div>
                                {count > 0 && (
                                    <div style={{
                                        color: isCompleted ? '#4ade80' : 'rgba(0, 162, 255, 0.9)',
                                        fontSize: '11px',
                                        fontWeight: '500'
                                    }}>
                                        {count} in setup
                                    </div>
                                )}
                            </div>
                            {isCompleted && (
                                <span style={{ color: '#4ade80', fontSize: '14px', marginLeft: '2px' }}>✓</span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default SetupTimeline;
