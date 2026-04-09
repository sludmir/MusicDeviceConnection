import React, { useState, useEffect, useMemo, useCallback } from 'react';

const CATEGORY_DEFS = {
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
};

const SPOT_TO_CATEGORY = {
    middle: 'mixers',
    middle_left: 'players', middle_right: 'players',
    far_left: 'players', far_right: 'players',
    middle_left_inner: 'players', middle_right_inner: 'players',
    middle_back: 'mixers',
    fx_top: 'effects', fx_left: 'effects', fx_right: 'effects', fx_front: 'effects',
    speaker_left: 'speakers', speaker_right: 'speakers',
    desk_center: 'audio-interface',
    desk_left: 'controllers', desk_right: 'controllers',
    rack_left_1: 'effects', rack_left_2: 'effects', rack_left_3: 'effects', rack_left_4: 'effects',
    rack_right_1: 'effects', rack_right_2: 'effects', rack_right_3: 'effects', rack_right_4: 'effects',
    monitor_left: 'monitors', monitor_right: 'monitors',
    stage_center: 'instruments',
    stage_left: 'instruments', stage_right: 'instruments',
    stage_back_left: 'instruments', stage_back_right: 'instruments', stage_back_center: 'instruments',
    pedal_1: 'effects', pedal_2: 'effects', pedal_3: 'effects', pedal_4: 'effects',
    amp_left: 'amplifiers', amp_right: 'amplifiers',
};

function categorizeDevice(device, setupType) {
    const name = (device.name || '').toLowerCase();
    const sub = (device.subcategory || '').toLowerCase();
    const type = (device.type || '').toLowerCase();
    const spot = (device.spotType || '').toLowerCase();

    if (setupType === 'DJ') {
        if (sub === 'players' || sub === 'mixers' || sub === 'effects' || sub === 'speakers' || sub === 'cables' || sub === 'accessories') return sub;
        if (name.includes('djm') || name.includes('mixer') || name.includes('xone') || type.includes('mixer')) return 'mixers';
        if (name.includes('cdj') || name.includes('player') || name.includes('turntable') || name.includes('xdj') || name.includes('ddj') || type.includes('player') || type.includes('controller')) return 'players';
        if (name.includes('rmx') || name.includes('sp-1') || name.includes('effect') || type.includes('fx') || type.includes('effect')) return 'effects';
        if (name.includes('speaker') || name.includes('monitor') || name.includes('pa ') || name.includes('subwoofer') || type.includes('speaker') || type.includes('monitor')) return 'speakers';
        if (name.includes('cable') || name.includes('rca') || name.includes('xlr') || name.includes('ethernet') || type.includes('cable')) return 'cables';
        if (name.includes('headphone') || name.includes('case') || name.includes('stand') || name.includes('laptop') || type.includes('headphone')) return 'accessories';
    }

    if (setupType === 'Producer') {
        if (sub === 'audio-interface' || sub === 'synthesizers' || sub === 'controllers' || sub === 'monitors' || sub === 'microphones' || sub === 'software') return sub;
        if (name.includes('interface') || name.includes('focusrite') || name.includes('scarlett') || name.includes('presonus') || name.includes('apollo') || type.includes('interface')) return 'audio-interface';
        if (name.includes('synth') || name.includes('moog') || name.includes('korg') || name.includes('sequential') || name.includes('prophet') || type.includes('synth')) return 'synthesizers';
        if (name.includes('controller') || name.includes('midi') || name.includes('pad') || name.includes('launchpad') || name.includes('push') || type.includes('controller') || type.includes('midi')) return 'controllers';
        if (name.includes('monitor') || name.includes('speaker') || name.includes('genelec') || name.includes('krk') || name.includes('adam') || name.includes('yamaha hs') || type.includes('monitor')) return 'monitors';
        if (name.includes('mic') || name.includes('microphone') || name.includes('condenser') || name.includes('dynamic') || name.includes('sm7') || name.includes('u87') || type.includes('mic')) return 'microphones';
        if (name.includes('daw') || name.includes('plugin') || name.includes('software') || name.includes('laptop') || type.includes('daw') || type.includes('software')) return 'software';
    }

    if (setupType === 'Musician') {
        if (sub === 'instruments' || sub === 'amplifiers' || sub === 'effects' || sub === 'microphones' || sub === 'cables' || sub === 'accessories') return sub;
        if (name.includes('guitar') || name.includes('bass') || name.includes('keyboard') || name.includes('piano') || name.includes('drum') || name.includes('violin') || name.includes('synth') || name.includes('fender') || name.includes('gibson') || type.includes('guitar') || type.includes('bass') || type.includes('keyboard') || type.includes('drum')) return 'instruments';
        if (name.includes('amp') || name.includes('amplifier') || name.includes('combo') || name.includes('cabinet') || name.includes('head') || type.includes('amp')) return 'amplifiers';
        if (name.includes('pedal') || name.includes('stomp') || name.includes('effect') || name.includes('overdrive') || name.includes('distortion') || name.includes('delay') || name.includes('reverb') || name.includes('chorus') || name.includes('wah') || type.includes('pedal') || type.includes('effect') || type.includes('fx')) return 'effects';
        if (name.includes('mic') || name.includes('microphone') || type.includes('mic')) return 'microphones';
        if (name.includes('cable') || type.includes('cable')) return 'cables';
        if (name.includes('stand') || name.includes('case') || name.includes('tuner') || name.includes('strap') || type.includes('stand') || type.includes('tuner')) return 'accessories';
    }

    if (spot && SPOT_TO_CATEGORY[spot]) return SPOT_TO_CATEGORY[spot];

    return null;
}

const SetupTimeline = ({ setupType, currentDevices, onCategorySelect, selectedCategory, onToggleCategory }) => {
    const [activeHighlight, setActiveHighlight] = useState(null);

    const categories = useMemo(() => CATEGORY_DEFS[setupType] || [], [setupType]);

    useEffect(() => {
        setActiveHighlight(null);
    }, [setupType]);

    const handleCategoryToggle = (categoryId) => {
        const next = activeHighlight === categoryId ? null : categoryId;
        setActiveHighlight(next);
        if (onToggleCategory) onToggleCategory(categoryId);
    };

    const getCategoryCounts = useCallback(() => {
        const counts = {};
        if (!currentDevices || currentDevices.length === 0) return counts;
        for (const device of currentDevices) {
            const cat = categorizeDevice(device, setupType);
            if (cat) counts[cat] = (counts[cat] || 0) + 1;
        }
        return counts;
    }, [currentDevices, setupType]);

    const counts = getCategoryCounts();

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
                    const count = counts[category.id] || 0;
                    const isCompleted = count > 0;
                    const isGlowing = activeHighlight === category.id;

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
                                backgroundColor: isGlowing
                                    ? 'rgba(0, 162, 255, 0.3)'
                                    : isCompleted
                                        ? 'rgba(45, 90, 45, 0.4)'
                                        : 'rgba(255, 255, 255, 0.06)',
                                borderRadius: '12px',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                border: isGlowing
                                    ? '1px solid rgba(0, 162, 255, 0.7)'
                                    : '1px solid rgba(255, 255, 255, 0.1)',
                                minWidth: '130px',
                                justifyContent: 'center',
                                color: '#fff',
                                fontFamily: 'inherit',
                                fontSize: '14px',
                                fontWeight: '600',
                                boxShadow: isGlowing ? '0 0 24px rgba(0, 162, 255, 0.3), inset 0 0 12px rgba(0, 162, 255, 0.1)' : 'none',
                                outline: 'none'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = isGlowing
                                    ? 'rgba(0, 162, 255, 0.4)'
                                    : isCompleted
                                        ? 'rgba(45, 90, 45, 0.55)'
                                        : 'rgba(255, 255, 255, 0.12)';
                                e.currentTarget.style.transform = 'translateY(-1px)';
                                if (!isGlowing) e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = isGlowing
                                    ? 'rgba(0, 162, 255, 0.3)'
                                    : isCompleted
                                        ? 'rgba(45, 90, 45, 0.4)'
                                        : 'rgba(255, 255, 255, 0.06)';
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = isGlowing ? '0 0 24px rgba(0, 162, 255, 0.3), inset 0 0 12px rgba(0, 162, 255, 0.1)' : 'none';
                            }}
                        >
                            <span style={{ fontSize: '18px', lineHeight: 1 }} aria-hidden>{category.icon || '•'}</span>
                            <div style={{ textAlign: 'left' }}>
                                <div style={{ marginBottom: count > 0 ? '2px' : 0 }}>
                                    {category.name}
                                </div>
                                {count > 0 && (
                                    <div style={{
                                        color: '#4ade80',
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
