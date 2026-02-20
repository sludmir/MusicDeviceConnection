import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { TOUCH } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { collection, getDocs, doc, getDoc, updateDoc } from "firebase/firestore"; // Import Firestore methods
import { db } from "./firebaseConfig"; // Import Firestore
import { auth } from "./firebaseConfig"; // Add auth import at the top
import { gsap } from 'gsap';
import { updateAllModelPaths, getStorageModelURL } from './firebaseUtils'; // Add this import
import ProductSuggestionForm from './ProductSuggestionForm';
import MobileNavigation from './MobileNavigation';
import { getConnectionSuggestions } from './chatGPTService';

function ThreeScene({ devices, isInitialized, setupType, onDevicesChange, onCategoryToggle }) {
    const mountRef = useRef(null);
    const sceneRef = useRef(null);
    const cameraRef = useRef(null);
    const controlsRef = useRef(null);
    const rendererRef = useRef(null);
    const devicesRef = useRef({});
    const prevDevicesRef = useRef(devices);
    const cablesRef = useRef([]);
    const djTableRef = useRef(null);
    const ghostSpotsRef = useRef([]);
    const placedDevices = useRef([]);
    const onDevicesChangeRef = useRef(onDevicesChange);
    const placedDevicesListRef = useRef([]);
    const hasLoadedFromSavedRef = useRef(false);
    const isPinchingRef = useRef(false);
    const [selectedGhostIndex, setSelectedGhostIndex] = useState(null);
    const [searchResults, setSearchResults] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [showSearch, setShowSearch] = useState(false);
    const [searchMode, setSearchMode] = useState(''); // 'hamburger' or 'ghost'
    const [isConnectionMapping, setIsConnectionMapping] = useState(false);
    const [selectedConnectionType, setSelectedConnectionType] = useState(null);
    const [selectedConnectionMode, setSelectedConnectionMode] = useState(null); // 'input' or 'output'
    const [currentMappingDevice, setCurrentMappingDevice] = useState(null);
    const [filteredResults, setFilteredResults] = useState([]);
    const [sceneInitialized, setSceneInitialized] = useState(false);
    const [error, setError] = useState(null);
    const [isMobile, setIsMobile] = useState(false);
    const [placedDevicesList, setPlacedDevicesList] = useState([]);
    const [basicSetupComplete, setBasicSetupComplete] = useState(false);
    const [currentSetupType, setCurrentSetupType] = useState(setupType || 'DJ'); // Initialize with prop value
    const [isSetupListExpanded, setIsSetupListExpanded] = useState(false);
    const [isUpdatingPaths, setIsUpdatingPaths] = useState(false);
    const [showSuggestionForm, setShowSuggestionForm] = useState(false);
    const [connectionAdvice, setConnectionAdvice] = useState('');
    const [isAdviceLoading, setIsAdviceLoading] = useState(false);
    const [hasQuotaError, setHasQuotaError] = useState(false);
    const [showMiniProfile, setShowMiniProfile] = useState(false);
    const [miniProfileDevice, setMiniProfileDevice] = useState(null);
    const [editConnectionsMode, setEditConnectionsMode] = useState(false);
    const [cameraView, setCameraView] = useState('set');
    const [lastApiCall, setLastApiCall] = useState(0);
    const [hiddenCategories, setHiddenCategories] = useState(new Set());

    // Removed unused PRODUCT_TYPES constant

    // Define spot types for better organization
    const SPOT_TYPES = {
        MIDDLE: 'middle',
        MIDDLE_LEFT: 'middle_left',
        MIDDLE_RIGHT: 'middle_right',
        FAR_LEFT: 'far_left',
        FAR_RIGHT: 'far_right',
        MIDDLE_LEFT_INNER: 'middle_left_inner',
        MIDDLE_RIGHT_INNER: 'middle_right_inner',
        MIDDLE_BACK: 'middle_back',
        FX_TOP: 'fx_top',
        FX_LEFT: 'fx_left',
        FX_RIGHT: 'fx_right',
        FX_FRONT: 'fx_front',
        SPEAKER_LEFT: 'speaker_left',
        SPEAKER_RIGHT: 'speaker_right'
    };

    const djSetupSpots = [
        { x: 0, y: 1.05, z: 0, type: SPOT_TYPES.MIDDLE },           // Middle (Mixer)
        { x: -0.8, y: 1.05, z: 0, type: SPOT_TYPES.MIDDLE_LEFT },   // Middle Left (Player)
        { x: 0.8, y: 1.05, z: 0, type: SPOT_TYPES.MIDDLE_RIGHT },   // Middle Right (Player)
        { x: -1.6, y: 1.05, z: 0, type: SPOT_TYPES.FAR_LEFT },      // Far Left (Player)
        { x: 1.6, y: 1.05, z: 0, type: SPOT_TYPES.FAR_RIGHT },      // Far Right (Player)
        { x: -0.4, y: 1.05, z: 0, type: SPOT_TYPES.MIDDLE_LEFT_INNER },  // Between Middle and Left
        { x: 0.4, y: 1.05, z: 0, type: SPOT_TYPES.MIDDLE_RIGHT_INNER },  // Between Middle and Right
        { x: 0, y: 1.05, z: -0.2, type: SPOT_TYPES.MIDDLE_BACK },   // Behind Middle
        { x: 0, y: 1.5, z: -0.5, type: SPOT_TYPES.FX_TOP },        // FX Top (moved from z: -0.3 to z: -0.5)
        { x: -0.4, y: 1.05, z: -0.3, type: SPOT_TYPES.FX_LEFT },    // FX Left
        { x: 0.4, y: 1.05, z: -0.3, type: SPOT_TYPES.FX_RIGHT },    // FX Right
        { x: 0, y: 1.05, z: 0.3, type: SPOT_TYPES.FX_FRONT },       // FX Front (Wide units)
        { x: 3.5, y: 0.05, z: -0.25, type: SPOT_TYPES.SPEAKER_LEFT, size: { width: 0.4, depth: 0.4 } },  // Left Speaker (on floor)
        { x: -3.5, y: 0.05, z: -0.25, type: SPOT_TYPES.SPEAKER_RIGHT, size: { width: 0.4, depth: 0.4 } }   // Right Speaker (on floor)
    ];

    // Add searchModalStyle and positionModalStyle definitions
    const searchModalStyle = {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        backgroundColor: 'rgba(10, 10, 10, 0.95)',
        padding: isMobile ? '16px' : '24px',
        borderRadius: '8px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        zIndex: 1000,
        width: isMobile ? '90%' : '400px',
        maxWidth: '500px',
        maxHeight: isMobile ? '80vh' : '90vh',
        overflowY: 'auto',
        color: '#ffffff',
        border: '1px solid rgba(0, 162, 255, 0.2)',
        backdropFilter: 'blur(12px)',
        scrollbarWidth: 'thin',
        scrollbarColor: '#333333 #000000',
        msOverflowStyle: 'none'
    };

    // Removed unused positionModalStyle

    // Add these camera positions after your other constants
    const CAMERA_POSITIONS = {
        default: {
            position: { x: 0, y: isMobile ? 3 : 2.2, z: isMobile ? 2.5 : 1.8 },
            target: { x: 0, y: 0.9, z: 0 }
        },
        set: {
            position: { x: 0, y: isMobile ? 3.2 : 2.4, z: isMobile ? 2.8 : 2.0 },
            target: { x: 0, y: 0.9, z: 0 }
        },
        connections: {
            position: { x: 0, y: isMobile ? 3 : 2.2, z: isMobile ? -2.5 : -1.8 },
            target: { x: 0, y: 0.9, z: 0 }
        }
    };

    // Removed unused findBestSpot and getProductType functions

    // Update handleProductSelect to use the new placement logic. Fetch fresh product from Firestore
    // so we always get the latest connection points (inputs/outputs coordinates) after edits.
    const handleProductSelect = async (product) => {
        if (!product) return;

        let productToAdd = product;
        if (product.id && db) {
            try {
                const productRef = doc(db, 'products', product.id);
                const snap = await getDoc(productRef);
                if (snap.exists()) {
                    productToAdd = { id: snap.id, ...snap.data() };
                }
            } catch (e) {
                console.warn('Could not fetch latest product, using cached:', e);
            }
        }

        console.log(`Adding selected product: ${productToAdd.name} to position ${selectedGhostIndex}`);
        addProductToPosition(productToAdd, selectedGhostIndex);

        setShowSearch(false);
        setSearchMode('');
        setSearchQuery('');
    };

    // Removed unused getConnectionKey function

    // Update the updateConnections function to maintain all connections
    function updateConnections(devices) {
        console.log('=== updateConnections called ===');
        console.log('Total devices passed:', devices.length);
        console.log('Device names:', devices.map(d => d.name));
        console.log('Full device list:', devices.map(d => ({
            name: d.name,
            id: d.id,
            uniqueId: d.uniqueId,
            hasInputs: !!(d.inputs && d.inputs.length > 0),
            hasOutputs: !!(d.outputs && d.outputs.length > 0),
            inputCount: d.inputs?.length || 0,
            outputCount: d.outputs?.length || 0
        })));
        
        // Find the mixer device
        const mixer = devices.find(device => device.name.includes('DJM'));
        if (!mixer) {
            console.log('❌ No mixer found in devices');
            return;
        }
        console.log('✅ Found mixer:', mixer.name);
        console.log('   Mixer inputs:', mixer.inputs?.map(i => i.type) || []);
        console.log('   Mixer outputs:', mixer.outputs?.map(o => o.type) || []);

        // Find all CDJs
        const cdjs = devices.filter(device => device.name.includes('CDJ'));
        console.log(`✅ Found ${cdjs.length} CDJ(s):`, cdjs.map(c => c.name));
        cdjs.forEach(cdj => {
            console.log(`   ${cdj.name} outputs:`, cdj.outputs?.map(o => o.type) || []);
        });

        // Find all FX units (RMX, Teile Revolo, etc.)
        const fxUnits = devices.filter(device => {
            const name = device.name.toLowerCase();
            return name.includes('rmx') || 
                   name.includes('revolo') || 
                   name.includes('fx') ||
                   (device.type && device.type.toLowerCase().includes('fx'));
        });
        console.log(`✅ Found ${fxUnits.length} FX unit(s):`, fxUnits.map(f => f.name));
        fxUnits.forEach(fx => {
            console.log(`   ${fx.name} inputs:`, fx.inputs?.map(i => i.type) || []);
            console.log(`   ${fx.name} outputs:`, fx.outputs?.map(o => o.type) || []);
        });

        // Clear all existing cables
        cablesRef.current.forEach(cable => {
            sceneRef.current.remove(cable);
        });
        cablesRef.current = [];

        // Sort CDJs by x position (left to right)
        const sortedCDJs = [...cdjs].sort((a, b) => {
            const posA = a.position?.x || 0;
            const posB = b.position?.x || 0;
            return posA - posB;
        });
        
        console.log('Sorted CDJs by position:', sortedCDJs.map(c => ({ name: c.name, x: c.position?.x })));
        
        // Get mixer position
        const mixerX = mixer.position?.x || 0;
        console.log('Mixer position x:', mixerX);
        
        // Split CDJs into left and right groups relative to mixer
        const leftCDJs = sortedCDJs.filter(cdj => (cdj.position?.x || 0) < mixerX);
        const rightCDJs = sortedCDJs.filter(cdj => (cdj.position?.x || 0) > mixerX);
        
        console.log('Left CDJs (x < mixer):', leftCDJs.map(c => ({ name: c.name, x: c.position?.x })));
        console.log('Right CDJs (x > mixer):', rightCDJs.map(c => ({ name: c.name, x: c.position?.x })));
        
        // Create channel assignment map: { cdjUniqueId: channelNumber }
        // Priority: CH2, CH3 (inner channels) first, then CH1, CH4 (outer channels)
        const channelAssignment = new Map();
        
        const totalCDJs = sortedCDJs.length;
        
        if (totalCDJs === 1) {
            // Single CDJ: assign to LINE1
            channelAssignment.set(sortedCDJs[0].uniqueId, 1);
            console.log(`Single CDJ: ${sortedCDJs[0].name} → LINE1`);
        } else if (totalCDJs === 2) {
            // Two CDJs: left → LINE1, right → LINE2
            channelAssignment.set(sortedCDJs[0].uniqueId, 1);
            channelAssignment.set(sortedCDJs[1].uniqueId, 2);
            console.log(`Two CDJs: left → LINE1, right → LINE2`);
        } else if (totalCDJs === 3) {
            // Three CDJs: leftmost → LINE1, middle → LINE2, rightmost → LINE3
            channelAssignment.set(sortedCDJs[0].uniqueId, 1);
            channelAssignment.set(sortedCDJs[1].uniqueId, 2);
            channelAssignment.set(sortedCDJs[2].uniqueId, 3);
            console.log(`Three CDJs: leftmost → LINE1, middle → LINE2, rightmost → LINE3`);
        } else if (totalCDJs >= 4) {
            // Four or more CDJs: assign sequentially from left to right
            // leftmost → LINE1, second left → LINE2, middle right → LINE3, rightmost → LINE4
            if (sortedCDJs.length > 0) channelAssignment.set(sortedCDJs[0].uniqueId, 1); // leftmost → LINE1
            if (sortedCDJs.length > 1) channelAssignment.set(sortedCDJs[1].uniqueId, 2); // second left → LINE2
            if (sortedCDJs.length > 2) channelAssignment.set(sortedCDJs[2].uniqueId, 3); // middle right → LINE3
            if (sortedCDJs.length > 3) channelAssignment.set(sortedCDJs[3].uniqueId, 4); // rightmost → LINE4
            console.log(`Four+ CDJs: leftmost → LINE1, second left → LINE2, middle right → LINE3, rightmost → LINE4`);
        }
        
        console.log('Channel assignments:', Array.from(channelAssignment.entries()).map(([id, ch]) => {
            const cdj = sortedCDJs.find(c => c.uniqueId === id);
            return `${cdj?.name || id} → CH${ch}`;
        }));
        
        // Track which mixer input indices have been used (by index so duplicate types still get distinct inputs)
        const usedMixerInputIndices = new Set();
        const mixerInputs = mixer.inputs || [];
        
        // Draw cables for each CDJ to mixer - SIMPLE: one cable per CDJ
        sortedCDJs.forEach((cdj, index) => {
            let assignedChannel = channelAssignment.get(cdj.uniqueId);
            
            // If no channel was assigned, assign one now based on position
            if (!assignedChannel) {
                const channelOrder = [2, 3, 1, 4];
                assignedChannel = channelOrder[index % 4];
                channelAssignment.set(cdj.uniqueId, assignedChannel);
                console.warn(`⚠️ CDJ ${cdj.name} had no assigned channel, assigning CH${assignedChannel} as fallback`);
            }
            
            console.log(`Processing CDJ ${index + 1}/${sortedCDJs.length}: ${cdj.name} at position x:${cdj.position?.x}, assigned to CH${assignedChannel}`);
            
            const cdjOutput = (cdj.outputs || []).find(o => {
                const type = o.type || '';
                return type === 'Line Out' || type === 'RCA' || type === '1/4"' ||
                       type.toLowerCase().includes('line') || type.toLowerCase().includes('rca');
            }) || (cdj.outputs || [])[0];
            
            if (!cdjOutput) {
                console.warn(`⚠️ CDJ ${cdj.name} has no outputs!`);
                return;
            }
            
            let mixerInput = null;
            let mixerInputIndex = -1;
            
            // Strategy 1: Match by Line/CH type (e.g. Line1, CH2)
            if (assignedChannel && mixerInputs.length > 0) {
                const idx = mixerInputs.findIndex((i, idx) => {
                    if (usedMixerInputIndices.has(idx)) return false;
                    const type = (i.type || '').toLowerCase();
                    return type.includes(`line${assignedChannel}`) || type.includes(`ch${assignedChannel}`);
                });
                if (idx >= 0) { mixerInput = mixerInputs[idx]; mixerInputIndex = idx; }
            }
            
            // Strategy 2: Use input at index (assignedChannel - 1) if available and unused
            if (!mixerInput && assignedChannel >= 1 && assignedChannel <= 4) {
                const idx = assignedChannel - 1;
                if (idx < mixerInputs.length && !usedMixerInputIndices.has(idx)) {
                    mixerInput = mixerInputs[idx];
                    mixerInputIndex = idx;
                }
            }
            
            // Strategy 3: First unused input by index (handles duplicate types like "1/4 inch")
            if (!mixerInput) {
                const idx = mixerInputs.findIndex((_, idx) => !usedMixerInputIndices.has(idx));
                if (idx >= 0) { mixerInput = mixerInputs[idx]; mixerInputIndex = idx; }
            }
            
            if (!mixerInput && mixerInputs.length > 0) {
                console.warn(`⚠️ All mixer inputs used, connecting ${cdj.name} to first input`);
                mixerInput = mixerInputs[0];
                mixerInputIndex = 0;
            }
            if (mixerInput && mixerInputIndex >= 0) {
                usedMixerInputIndices.add(mixerInputIndex);
            }
            if (!mixerInput) {
                console.error(`❌ No mixer inputs available for ${cdj.name}`);
                return;
            }
            
            const baseOutputCoord = cdjOutput.coordinate || { x: 0.08, y: 0.09, z: -0.32 };
            const outputCoord = {
                ...baseOutputCoord,
                x: (baseOutputCoord.x || 0) + 0.44
            };
            
            // Use the mixer input's actual coordinate (so Edit connections works); fallback to defaults only when missing
            const rawInputCoord = mixerInput.coordinate || {};
            const hasValid = typeof rawInputCoord.x === 'number' && typeof rawInputCoord.y === 'number' && typeof rawInputCoord.z === 'number';
            const defaultByChannel = {
                1: { x: -0.04, y: 0.075, z: -0.28 },
                2: { x: -0.02, y: 0.075, z: -0.28 },
                3: { x: 0.01, y: 0.075, z: -0.28 },
                4: { x: 0.04, y: 0.075, z: -0.28 }
            };
            const inputCoord = hasValid
                ? { x: rawInputCoord.x, y: rawInputCoord.y, z: rawInputCoord.z }
                : (defaultByChannel[assignedChannel] || { x: -0.08, y: 0.075, z: -0.28 });
            
            const connection = {
                sourcePort: {
                    ...cdjOutput,
                    coordinate: outputCoord
                },
                targetPort: {
                    ...mixerInput,
                    coordinate: inputCoord
                },
                type: cdjOutput.type || 'Line Out'
            };
            
            // Create a unique key for this connection
            const connectionKey = `${cdj.uniqueId}-${mixer.uniqueId}-${connection.sourcePort.type}-${connection.targetPort.type}`;
            
            // Check if this connection already exists
            const existingCable = cablesRef.current.find(cable => 
                cable.userData && cable.userData.connectionKey === connectionKey
            );

            // Only create new cable if it doesn't exist
            if (!existingCable) {
                console.log(`✅ Creating cable for: ${cdj.name} → mixer (CH${assignedChannel || '?'}, ${cdjOutput.type} → ${mixerInput.type})`);
                drawCable(cdj, mixer, connection);
            } else {
                console.log(`⏭️  Skipping duplicate connection: ${cdj.name} to mixer`);
            }
        });

        // Draw cables for mixer to FX units (Send/Return connections)
        fxUnits.forEach(fxUnit => {
            console.log(`Processing FX unit: ${fxUnit.name}`);
            
            // Send connection: Mixer -> FX Unit
            const sendConnections = findMatchingPorts(mixer, fxUnit);
            console.log(`  Found ${sendConnections.length} Send connection(s) from mixer to ${fxUnit.name}`);
            
            if (sendConnections.length === 0) {
                console.warn(`  ⚠️ No Send connection found from mixer to ${fxUnit.name}`);
                console.warn(`     Mixer outputs:`, mixer.outputs?.map(o => o.type) || []);
                console.warn(`     FX unit inputs:`, fxUnit.inputs?.map(i => i.type) || []);
            }
            
            sendConnections.forEach(connection => {
                const connectionKey = `${mixer.uniqueId}-${fxUnit.uniqueId}-${connection.sourcePort.type}-${connection.targetPort.type}`;
                
                const existingCable = cablesRef.current.find(cable => 
                    cable.userData && cable.userData.connectionKey === connectionKey
                );

                if (!existingCable) {
                    console.log(`  ✅ Creating Send cable from mixer to ${fxUnit.name} (${connection.sourcePort.type} -> ${connection.targetPort.type})`);
                    drawCable(mixer, fxUnit, connection);
                } else {
                    console.log(`  ⏭️  Skipping duplicate Send connection: ${fxUnit.name}`);
                }
            });
            
            // Return connection: FX Unit -> Mixer
            const returnConnections = findMatchingPorts(fxUnit, mixer);
            console.log(`  Found ${returnConnections.length} Return connection(s) from ${fxUnit.name} to mixer`);
            
            if (returnConnections.length === 0) {
                console.warn(`  ⚠️ No Return connection found from ${fxUnit.name} to mixer`);
                console.warn(`     FX unit outputs:`, fxUnit.outputs?.map(o => o.type) || []);
                console.warn(`     Mixer inputs:`, mixer.inputs?.map(i => i.type) || []);
            }
            
            returnConnections.forEach(connection => {
                const connectionKey = `${fxUnit.uniqueId}-${mixer.uniqueId}-${connection.sourcePort.type}-${connection.targetPort.type}`;
                
                const existingCable = cablesRef.current.find(cable => 
                    cable.userData && cable.userData.connectionKey === connectionKey
                );

                if (!existingCable) {
                    console.log(`  ✅ Creating Return cable from ${fxUnit.name} to mixer (${connection.sourcePort.type} -> ${connection.targetPort.type})`);
                    drawCable(fxUnit, mixer, connection);
                } else {
                    console.log(`  ⏭️  Skipping duplicate Return connection: ${fxUnit.name}`);
                }
            });
        });

        // Draw cables from mixer master out to speakers (only when speakers are added)
        if (mixer && currentSetupType === 'DJ') {
            // Find speakers by checking spotType OR device name/type
            const speakers = devices.filter(device => {
                const spotType = device.spotType || '';
                const deviceName = (device.name || '').toLowerCase();
                const deviceType = (device.type || '').toLowerCase();
                
                // Check by spotType first
                if (spotType === SPOT_TYPES.SPEAKER_LEFT || spotType === SPOT_TYPES.SPEAKER_RIGHT) {
                    return true;
                }
                
                // Fallback: check by device name/type
                return deviceName.includes('speaker') || 
                       deviceName.includes('monitor') || 
                       deviceName.includes('pa') ||
                       deviceType.includes('speaker') ||
                       deviceType.includes('monitor');
            });

            console.log(`🔍 Found ${speakers.length} speaker(s) in devices:`, speakers.map(s => ({
                name: s.name,
                spotType: s.spotType,
                position: s.position
            })));

            if (speakers.length > 0) {
                // Find mixer's master out port
                const masterOut = (mixer.outputs || []).find(o => {
                    const type = (o.type || '').toLowerCase();
                    return type.includes('master') || 
                           type.includes('main') ||
                           type.includes('xlr') ||
                           type.includes('output');
                }) || (mixer.outputs || [])[0];

                if (masterOut) {
                    // Use master out coordinate from product data (should be on top of mixer, slightly right of CDJ cables)
                    // If coordinate doesn't exist, use default
                    const masterOutWithCoord = {
                        ...masterOut,
                        coordinate: masterOut.coordinate || { x: 0.06, y: 0.075, z: -0.28 }
                    };

                    // Track which spots already have cables drawn
                    const leftCableExists = cablesRef.current.some(cable => 
                        cable.userData && cable.userData.connectionKey === 'mixer-ghost-speaker-left'
                    );
                    const rightCableExists = cablesRef.current.some(cable => 
                        cable.userData && cable.userData.connectionKey === 'mixer-ghost-speaker-right'
                    );
                    
                    // Track which spots are already assigned in this iteration
                    const assignedSpots = new Set();
                    
                    console.log(`📊 Processing ${speakers.length} speaker(s) for cable assignment`);
                    console.log(`   Existing cables - Left: ${leftCableExists}, Right: ${rightCableExists}`);
                    
                    // Draw cable for each speaker that exists
                    speakers.forEach((speaker, index) => {
                        // Determine which speaker spot to use
                        let speakerSpotType;
                        
                        console.log(`  Speaker ${index + 1}: ${speaker.name}, spotType: ${speaker.spotType || 'none'}`);
                        
                        // If speaker has spotType, use it (if not already assigned and cable doesn't exist)
                        if (speaker.spotType === SPOT_TYPES.SPEAKER_LEFT || speaker.spotType === SPOT_TYPES.SPEAKER_RIGHT) {
                            // Check if this spot already has a cable or is assigned in this batch
                            const spotHasCable = speaker.spotType === SPOT_TYPES.SPEAKER_LEFT ? leftCableExists : rightCableExists;
                            if (!spotHasCable && !assignedSpots.has(speaker.spotType)) {
                                speakerSpotType = speaker.spotType;
                                console.log(`    -> Using speaker's spotType: ${speakerSpotType}`);
                            } else {
                                // Spot already has cable or assigned, use the other one
                                speakerSpotType = speaker.spotType === SPOT_TYPES.SPEAKER_LEFT 
                                    ? SPOT_TYPES.SPEAKER_RIGHT 
                                    : SPOT_TYPES.SPEAKER_LEFT;
                                const otherSpotHasCable = speakerSpotType === SPOT_TYPES.SPEAKER_LEFT ? leftCableExists : rightCableExists;
                                if (otherSpotHasCable || assignedSpots.has(speakerSpotType)) {
                                    console.warn(`    -> Both spots taken! Left cable: ${leftCableExists}, Right cable: ${rightCableExists}, Assigned:`, Array.from(assignedSpots));
                                } else {
                                    console.log(`    -> Spot ${speaker.spotType} unavailable, using: ${speakerSpotType}`);
                                }
                            }
                        } else {
                            // No spotType: assign to first available spot
                            if (!leftCableExists && !assignedSpots.has(SPOT_TYPES.SPEAKER_LEFT)) {
                                speakerSpotType = SPOT_TYPES.SPEAKER_LEFT;
                                console.log(`    -> Assigning to LEFT (first available)`);
                            } else if (!rightCableExists && !assignedSpots.has(SPOT_TYPES.SPEAKER_RIGHT)) {
                                speakerSpotType = SPOT_TYPES.SPEAKER_RIGHT;
                                console.log(`    -> Assigning to RIGHT (second available)`);
                            } else if (!assignedSpots.has(SPOT_TYPES.SPEAKER_LEFT)) {
                                // Left spot not assigned in this batch, use it
                                speakerSpotType = SPOT_TYPES.SPEAKER_LEFT;
                                console.log(`    -> Assigning to LEFT (not assigned in batch)`);
                            } else if (!assignedSpots.has(SPOT_TYPES.SPEAKER_RIGHT)) {
                                // Right spot not assigned in this batch, use it
                                speakerSpotType = SPOT_TYPES.SPEAKER_RIGHT;
                                console.log(`    -> Assigning to RIGHT (not assigned in batch)`);
                            } else {
                                // Both already assigned in this batch - shouldn't happen with 2 speakers
                                // Fallback: alternate based on index
                                speakerSpotType = index % 2 === 0 ? SPOT_TYPES.SPEAKER_LEFT : SPOT_TYPES.SPEAKER_RIGHT;
                                console.warn(`    -> Both spots assigned in batch, fallback to: ${speakerSpotType}`);
                            }
                        }
                        
                        // Mark this spot as assigned
                        assignedSpots.add(speakerSpotType);
                        console.log(`    -> Final assignment: ${speakerSpotType}, assignedSpots:`, Array.from(assignedSpots));

                        const speakerSpot = djSetupSpots.find(s => s.type === speakerSpotType);
                        
                        if (speakerSpot) {
                            const side = speakerSpotType === SPOT_TYPES.SPEAKER_LEFT ? 'left' : 'right';
                            const connectionKey = `mixer-ghost-speaker-${side}`;
                            const existingCable = cablesRef.current.find(cable => 
                                cable.userData && cable.userData.connectionKey === connectionKey
                            );

                            if (!existingCable) {
                                console.log(`✅ Creating XLR cable from mixer master out to ${side} speaker (${speaker.name})`);
                                drawCableToGhostSquare(mixer, speakerSpot, masterOutWithCoord, 0x0000ff, side); // Blue for XLR, pass side explicitly
                            } else {
                                console.log(`⏭️  Cable already exists for ${side} speaker`);
                            }
                        } else {
                            console.warn(`⚠️ Could not find speaker spot for type: ${speakerSpotType}`);
                        }
                    });
                } else {
                    console.warn('⚠️ Mixer has no master out port found for speaker cables');
                }
            } else {
                console.log('ℹ️ No speakers found in devices yet');
            }
        }

        // Log summary of connections
        const redCables = cablesRef.current.filter(c => {
            const color = c.material?.color?.getHexString();
            return color === 'ff0000' || color === 'ff0000';
        });
        const cdjCables = cablesRef.current.filter(c => {
            const source = c.userData?.sourceDevice || '';
            return source.toLowerCase().includes('cdj');
        });
        
        console.log('=== Connection Summary ===');
        console.log(`Total cables drawn: ${cablesRef.current.length}`);
        console.log(`CDJ cables (red): ${redCables.length} out of ${cdjs.length} CDJs`);
        console.log(`CDJ connections: ${cdjs.length} CDJs processed, ${cdjCables.length} cables created`);
        console.log(`FX unit connections: ${fxUnits.length} FX units processed`);
        if (cdjs.length > cdjCables.length) {
            console.error(`❌ ERROR: Missing ${cdjs.length - cdjCables.length} CDJ cable(s)!`);
            console.error(`   Expected: ${cdjs.length}, Got: ${cdjCables.length}`);
        }
        console.log(`Cable types:`, cablesRef.current.map(c => ({
            from: c.userData?.sourceDevice,
            to: c.userData?.targetDevice,
            type: c.userData?.connectionType || c.userData?.sourcePort,
            color: c.material.color.getHexString()
        })));
        console.log('========================');

        // Ensure the scene is re-rendered
        if (rendererRef.current && sceneRef.current && cameraRef.current) {
            rendererRef.current.render(sceneRef.current, cameraRef.current);
        }
    }

    // Modify the drawCable function to create more pronounced arch-like curves
    function drawCable(sourceDevice, targetDevice, connection) {
        if (!sourceDevice || !targetDevice || !connection) return;

        // Get device positions and port coordinates
        const sourcePosition = sourceDevice.position;
        const targetPosition = targetDevice.position;
        
        // Normalize coordinates - handle both object format and Vector3 format
        const normalizeCoord = (coord) => {
            if (!coord) return { x: 0, y: 0, z: 0 };
            if (coord.x !== undefined && coord.y !== undefined && coord.z !== undefined) {
                return { x: coord.x, y: coord.y, z: coord.z };
            }
            // If it's a Vector3-like object, extract values
            if (typeof coord === 'object') {
                return {
                    x: coord.x || 0,
                    y: coord.y || 0,
                    z: coord.z || 0
                };
            }
            return { x: 0, y: 0, z: 0 };
        };
        
        const sourcePortCoord = normalizeCoord(connection.sourcePort.coordinate);
        const targetPortCoord = normalizeCoord(connection.targetPort.coordinate);

        // Calculate actual world positions
        const startPoint = new THREE.Vector3(
            sourcePosition.x + sourcePortCoord.x,
            sourcePosition.y + sourcePortCoord.y,
            sourcePosition.z + sourcePortCoord.z
        );

        const endPoint = new THREE.Vector3(
            targetPosition.x + targetPortCoord.x,
            targetPosition.y + targetPortCoord.y,
            targetPosition.z + targetPortCoord.z
        );
        
        console.log(`Drawing cable from ${sourceDevice.name} to ${targetDevice.name}`);
        console.log(`  Source device pos:`, sourcePosition);
        console.log(`  Source port coord:`, sourcePortCoord);
        console.log(`  Start point:`, startPoint);
        console.log(`  Target device pos:`, targetPosition);
        console.log(`  Target port coord:`, targetPortCoord);
        console.log(`  End point:`, endPoint);

        // Calculate the midpoint
        const midPoint = new THREE.Vector3().addVectors(startPoint, endPoint).multiplyScalar(0.5);
        
        // Calculate arch parameters
        // const distance = startPoint.distanceTo(endPoint); // Unused but kept for potential future use
        const baseArchHeight = 0.6; // Base height for arch
        
        // Determine line number and arch variation for Line connections
        let lineNumber = null;
        let archVariation = 0;
        const isLineConnection = connection.targetPort.type && connection.targetPort.type.startsWith('Line');
        
        if (isLineConnection) {
            lineNumber = parseInt(connection.targetPort.type.replace('Line', ''));
            archVariation = (lineNumber - 2.5) * 0.08;
        }

        // Create the arch peak point (middle of the cable)
        const archPeak = midPoint.clone();
        archPeak.z -= baseArchHeight + archVariation;

        // Create control points that curve towards the arch peak
        const control1 = startPoint.clone().lerp(archPeak, 0.5);
        const control2 = endPoint.clone().lerp(archPeak, 0.5);

        // Create the curve with the new control points
        const curve = new THREE.CubicBezierCurve3(
            startPoint,
            control1,
            control2,
            endPoint
        );

        // Create the cable geometry
        const points = curve.getPoints(50);
        const geometry = new THREE.BufferGeometry().setFromPoints(points);

        // Set up the material with the appropriate color
        // Use red for Send/Return connections, or line-specific colors for Line connections
        let cableColor;
        if (isLineConnection && lineNumber) {
            cableColor = cableColors[`Line${lineNumber}`] || cableColors.Default;
        } else if (connection.type === 'Send' || connection.sourcePort.type?.toLowerCase().includes('send')) {
            cableColor = 0xff6600; // Orange for Send connections
        } else if (connection.type === 'Return' || connection.sourcePort.type?.toLowerCase().includes('return')) {
            cableColor = 0x00ff66; // Green for Return connections
        } else {
            cableColor = cableColors.Default; // Default red
        }
        const material = new THREE.LineBasicMaterial({
            color: cableColor
        });

        // Create the line and add metadata
        const line = new THREE.Line(geometry, material);
        const connectionKey = `${sourceDevice.uniqueId}-${targetDevice.uniqueId}-${connection.sourcePort.type}-${connection.targetPort.type}`;
        
        line.userData = {
            connectionKey: connectionKey,
            sourceDevice: sourceDevice.id,
            targetDevice: targetDevice.id,
            sourcePort: connection.sourcePort.type,
            targetPort: connection.targetPort.type,
            connectionType: connection.type
        };

        // Add to scene and store reference
        sceneRef.current.add(line);
        cablesRef.current.push(line);
    }

    // Function to draw cable from device to a ghost square position
    function drawCableToGhostSquare(sourceDevice, targetPosition, sourcePort, cableColor = 0x0000ff, side = null) {
        if (!sourceDevice || !targetPosition || !sourcePort) return;

        // Get device position and port coordinates
        const sourcePosition = sourceDevice.position;
        const sourcePortCoord = sourcePort.coordinate || { x: 0, y: 0, z: 0 };

        // Calculate actual world positions
        const startPoint = new THREE.Vector3(
            sourcePosition.x + sourcePortCoord.x,
            sourcePosition.y + sourcePortCoord.y,
            sourcePosition.z + sourcePortCoord.z
        );

        // Connect to the front edge of the ghost square
        // Ghost squares are at z: -0.25 with depth 0.4, so front edge is at z: -0.25 + 0.2 = -0.05
        const endPoint = new THREE.Vector3(
            targetPosition.x,
            targetPosition.y,
            targetPosition.z + 0.2  // Front edge of the ghost square (half of depth 0.4)
        );

        // Calculate the midpoint
        const midPoint = new THREE.Vector3().addVectors(startPoint, endPoint).multiplyScalar(0.5);
        
        // Calculate arch parameters
        // const distance = startPoint.distanceTo(endPoint); // Unused but kept for potential future use
        const baseArchHeight = 0.6;
        
        // Create the arch peak point (middle of the cable)
        const archPeak = midPoint.clone();
        archPeak.z -= baseArchHeight;

        // Create control points that curve towards the arch peak
        const control1 = startPoint.clone().lerp(archPeak, 0.5);
        const control2 = endPoint.clone().lerp(archPeak, 0.5);

        // Create the curve with the new control points
        const curve = new THREE.CubicBezierCurve3(
            startPoint,
            control1,
            control2,
            endPoint
        );

        // Create the cable geometry
        const points = curve.getPoints(50);
        const geometry = new THREE.BufferGeometry().setFromPoints(points);

        // Set up the material with XLR cable color (blue)
        const material = new THREE.LineBasicMaterial({
            color: cableColor,
            linewidth: 2
        });

        // Create the line and add metadata
        const line = new THREE.Line(geometry, material);
        // Use provided side, or fallback to position-based detection
        const speakerSide = side || (targetPosition.x > 0 ? 'right' : 'left');
        const connectionKey = `mixer-ghost-speaker-${speakerSide}`;
        
        line.userData = {
            connectionKey: connectionKey,
            sourceDevice: sourceDevice.id,
            targetType: 'ghost_speaker',
            sourcePort: sourcePort.type,
            cableType: 'XLR'
        };

        // Add to scene and store reference
        sceneRef.current.add(line);
        cablesRef.current.push(line);
    }

    // Helper function to check if basic setup is complete (2 players + 1 mixer)
    const checkBasicSetupComplete = (devicesList) => {
        if (currentSetupType !== 'DJ') return false;
        
        console.log('Checking basic setup with devices:', devicesList.map(d => d.name));
        
        // Count CDJs and check for mixer
        const playerCount = devicesList.filter(device => {
            const name = device.name.toLowerCase();
            return name.includes('cdj') || name.includes('player');
        }).length;
        
        const hasMixer = devicesList.some(device => {
            const name = device.name.toLowerCase();
            return name.includes('djm') || name.includes('mixer');
        });
        
        const isComplete = playerCount >= 2 && hasMixer;
        
        console.log('Basic setup check results:', {
            playerCount,
            hasMixer,
            isComplete,
            devices: devicesList.map(d => d.name)
        });
        
        return isComplete;
    };

    // Keep the ref updated with the latest callback
    useEffect(() => {
        onDevicesChangeRef.current = onDevicesChange;
    }, [onDevicesChange]);

    // Update useEffect to watch both placedDevicesList and basicSetupComplete
    useEffect(() => {
        if (placedDevicesList.length > 0) {
            console.log('Device list changed, current state:', {
                devices: placedDevicesList.map(d => d.name),
                currentBasicSetupComplete: basicSetupComplete
            });
            
            const isComplete = checkBasicSetupComplete(placedDevicesList);
            console.log(`Basic setup is ${isComplete ? 'complete' : 'not complete'}`);

            if (isComplete !== basicSetupComplete) {
                console.log(`Basic setup state changed from ${basicSetupComplete} to ${isComplete}, updating ghost spots...`);
                setBasicSetupComplete(isComplete);
                
                // We need to update ghost spots after the state has been updated
                setTimeout(() => {
                    if (sceneRef.current) {
                        // Clear existing ghost spots
                        ghostSpotsRef.current.forEach(spot => {
                            if (spot && spot.parent) {
                                sceneRef.current.remove(spot);
                            }
                        });
                        ghostSpotsRef.current = [];
                        
                        // Recreate ghost spots with updated positions
                        console.log('Recreating ghost spots with basic setup =', isComplete);
                        createGhostPlacementSpots(sceneRef.current, isComplete);
                        
                        // Force a re-render
                        if (rendererRef.current && cameraRef.current) {
                            rendererRef.current.render(sceneRef.current, cameraRef.current);
                        }
                    }
                }, 0);
            }
        }
        
        // Keep ref in sync for use in load-from-saved delayed update
        placedDevicesListRef.current = placedDevicesList;

        // Update connections whenever placedDevicesList changes
        if (sceneRef.current && placedDevicesList.length > 0) {
            console.log('Updating connections due to placedDevicesList change');
            updateConnections(placedDevicesList);
        }
        
        // Communicate device changes to parent component using ref to avoid dependency issues
        if (onDevicesChangeRef.current) {
            onDevicesChangeRef.current(placedDevicesList);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- checkBasicSetupComplete, createGhostPlacementSpots, updateConnections are stable refs/functions
    }, [placedDevicesList, basicSetupComplete]);

    // Update addProductToPosition to ensure proper state updates
    const addProductToPosition = async (product, positionIndex) => {
        const position = ghostSpotsRef.current[positionIndex]?.position;
        if (!position) {
            console.error('Invalid position index:', positionIndex);
            return;
        }

        try {
            console.log(`Loading 3D model for ${product.name} at position:`, position);
            // Check for Firebase Storage URL in either modelPath or modelUrl
            let modelURL = product.modelPath || product.modelUrl;
            const isLocalPath = modelURL && !modelURL.startsWith('http') && !modelURL.startsWith('gs://');
            const isCDJ3000 = product.name && (product.name.includes('CDJ-3000') || product.name.includes('CDJ3000'));
            // Prefer Firebase URL when missing or when CDJ-3000 (avoids corrupt local CDJ3000Centered.glb)
            if (!modelURL || (isCDJ3000 && (isLocalPath || (modelURL && modelURL.includes('localhost'))))) {
                const firebaseURL = await getStorageModelURL(`${product.name}.glb`);
                if (firebaseURL) modelURL = firebaseURL;
                else if (isCDJ3000) modelURL = null; // don't use corrupt local file
            }
            if (modelURL && !modelURL.startsWith('http') && !modelURL.startsWith('gs://')) {
                if (modelURL.startsWith('/')) {
                    modelURL = `${window.location.origin}${modelURL}`;
                } else {
                    modelURL = `${window.location.origin}/${modelURL}`;
                }
            }
            console.log(`Using model URL:`, modelURL);
            if (!modelURL) {
                console.warn('No model URL for', product.name, '- adding placeholder');
                const deviceWithPosition = {
                    ...product,
                    id: product.id,
                    position: { x: position.x, y: position.y, z: position.z },
                    inputs: product.inputs || [],
                    outputs: product.outputs || [],
                    uniqueId: `${product.id}-${position.x}-${position.y}-${position.z}`,
                    modelPath: null,
                    spotType: ghostSpotsRef.current[positionIndex]?.userData?.type ?? null,
                    placementIndex: positionIndex
                };
                const scene = sceneRef.current;
                if (scene) {
                    const geometry = new THREE.BoxGeometry(0.25, 0.25, 0.25);
                    const material = new THREE.MeshBasicMaterial({ color: 0x444444 });
                    const cube = new THREE.Mesh(geometry, material);
                    cube.position.set(position.x, position.y, position.z);
                    scene.add(cube);
                    cube.userData = { productId: product.id, name: product.name, position: deviceWithPosition.position, uniqueId: deviceWithPosition.uniqueId };
                    devicesRef.current[deviceWithPosition.uniqueId] = { model: cube, data: deviceWithPosition };
                    const idx = placedDevices.current.findIndex(d => d.uniqueId === deviceWithPosition.uniqueId);
                    if (idx !== -1) placedDevices.current[idx] = deviceWithPosition;
                    else placedDevices.current.push(deviceWithPosition);
                    updatePlacedDevicesList(deviceWithPosition, 'add');
                    if (rendererRef.current && cameraRef.current) rendererRef.current.render(scene, cameraRef.current);
                }
                return;
            }

            return new Promise((resolve) => {
                const loader = new GLTFLoader();
                loader.load(
                    modelURL,
                    (gltf) => {
                        console.log("Model loaded successfully:", product.name);
                        const model = gltf.scene;

                        // Scale down the RMX-1000 model even more
                        if (product.name.includes('RMX-1000') || product.name.includes('RMX1000')) {
                            console.log('Scaling down RMX-1000 model');
                            model.scale.set(0.01, 0.01, 0.01); // Changed from 0.02 to 0.01 (2x smaller)
                        }

                        // Set the model position directly to the ghost square position
                        model.position.set(position.x, position.y, position.z);

                        // Create device object with exact position, unique identifier, and which ghost spot it's on (for save/load)
                        const spotType = ghostSpotsRef.current[positionIndex]?.userData?.type ?? null;
                        const deviceWithPosition = {
                            ...product,
                            id: product.id,
                            position: {
                                x: position.x,
                                y: position.y,
                                z: position.z
                            },
                            inputs: product.inputs || [],
                            outputs: product.outputs || [],
                            uniqueId: `${product.id}-${position.x}-${position.y}-${position.z}`,
                            modelPath: modelURL, // Ensure modelPath is set for future reference
                            spotType,
                            placementIndex: positionIndex
                        };

                        // Store the complete device data with the model
                        model.userData = {
                            productId: product.id,
                            name: product.name,
                            position: deviceWithPosition.position,
                            inputs: deviceWithPosition.inputs,
                            outputs: deviceWithPosition.outputs,
                            uniqueId: deviceWithPosition.uniqueId
                        };

                        sceneRef.current.add(model);

                        // Store device reference with uniqueId as the key
                        devicesRef.current[deviceWithPosition.uniqueId] = {
                            model,
                            data: deviceWithPosition
                        };

                        // Update placedDevices array
                        const existingDeviceIndex = placedDevices.current.findIndex(d => d.uniqueId === deviceWithPosition.uniqueId);
                        if (existingDeviceIndex !== -1) {
                            placedDevices.current[existingDeviceIndex] = deviceWithPosition;
                        } else {
                            placedDevices.current.push(deviceWithPosition);
                        }

                        console.log(`Added ${product.name} at position:`, deviceWithPosition.position);

                        // Update the placed devices list
                        updatePlacedDevicesList(deviceWithPosition, 'add');

                        // Force a re-render of the scene
                        if (rendererRef.current && sceneRef.current && cameraRef.current) {
                            rendererRef.current.render(sceneRef.current, cameraRef.current);
                        }
                        resolve();
                    },
                    (progress) => {
                        const percentComplete = (progress.loaded / progress.total) * 100;
                        console.log(`Loading progress: ${percentComplete.toFixed(2)}%`);
                    },
                    (error) => {
                        console.error("Error loading model:", error);
                        console.error("Failed model URL:", modelURL);
                        alert(`Failed to load 3D model for ${product.name}. Please check the console for details.`);
                        resolve(); // resolve so saved-setup load loop continues
                    }
                );
            });
        } catch (error) {
            console.error("Error processing model:", error);
            console.error("Product data:", product);
            alert(`Failed to process model for ${product.name}. Please check the console for details.`);
        }
    };

    // Removed unused handlePositionSelect and handleAddNewProduct functions

    // Function to open search from hamburger menu
    const openHamburgerSearch = () => {
        openSearch('hamburger');
    };

    // Update fetchProductsFromFirestore to be more efficient
    const fetchProductsFromFirestore = async () => {
        try {
            console.log("Starting to fetch products from Firestore...");
            
            if (auth.currentUser) {
                console.log("Authenticated as:", auth.currentUser.email);
            }

            if (!db) {
                console.error("Firebase database not initialized");
                return;
            }

            const productsRef = collection(db, "products");
            const querySnapshot = await getDocs(productsRef);
            
            if (querySnapshot.empty) {
                console.log("No products found in database");
                return;
            }

            const products = [];
            querySnapshot.forEach((doc) => {
                const productData = doc.data();
                console.log("Found product in Firestore:", productData.name);
                console.log("Full product data:", JSON.stringify(productData, null, 2));
                
                products.push({
                    id: doc.id,
                    ...productData
                });
            });

            console.log(`Found ${products.length} products in Firestore:`, products);
            setSearchResults(products);
            setFilteredResults(products);
            setError(null);
        } catch (error) {
            console.error("Error fetching products:", error);
            setError("Failed to fetch products. Please try again.");
        }
    };

    // Update the search input handler to filter results
    const handleSearchInputChange = (e) => {
        const query = e.target.value.toLowerCase();
        setSearchQuery(query);
        
        console.log("Filtering products with query:", query);
        console.log("Available products:", searchResults);
        
        // Filter the search results based on the query
        const filtered = searchResults.filter(product => {
            const nameMatch = product.name?.toLowerCase().includes(query);
            const categoryMatch = product.category?.toLowerCase().includes(query);
            const descriptionMatch = product.description?.toLowerCase().includes(query);
            return nameMatch || categoryMatch || descriptionMatch;
        });

        // Get the recommended type for the current ghost spot
        const currentSpot = ghostSpotsRef.current[selectedGhostIndex];
        const recommendedType = currentSpot?.userData?.recommendedType;
        
        // Sort filtered results to put recommended products first
        const sortedResults = filtered.sort((a, b) => {
            const aIsRecommended = isProductRecommended(a, recommendedType);
            const bIsRecommended = isProductRecommended(b, recommendedType);
            
            if (aIsRecommended && !bIsRecommended) return -1;
            if (!aIsRecommended && bIsRecommended) return 1;
            return 0;
        });
        
        console.log("Filtered and sorted results:", sortedResults);
        setFilteredResults(sortedResults);
    };

    // Add helper function to check if a product matches the recommended type
    const isProductRecommended = (product, recommendedType) => {
        if (!recommendedType || !product) return false;
        
        const productName = product.name?.toLowerCase() || '';
        const productCategory = product.category?.toLowerCase() || '';
        
        switch (recommendedType) {
            case 'Player (CDJ)':
                return productName.includes('cdj') || 
                       productName.includes('player') ||
                       productCategory.includes('player');
            case 'Mixer (DJM)':
                return productName.includes('djm') || 
                       productName.includes('mixer') ||
                       productCategory.includes('mixer');
            case 'RMX-1000':
                return productName.includes('rmx') ||
                       productName === 'rmx-1000' ||
                       (productCategory.includes('fx') && productName.includes('1000'));
            default:
                return false;
        }
    };

    // Update openSearch to properly handle Firebase fetching
    const openSearch = async (mode, ghostIndex = null) => {
        try {
            console.log(`Opening search with mode: ${mode}, ghostIndex: ${ghostIndex}`);
            setSearchMode(mode);
            setSelectedGhostIndex(ghostIndex);
            setShowSearch(true);
            setSearchQuery('');
            setFilteredResults([]);
            
            await fetchProductsFromFirestore();
        } catch (error) {
            console.error("Error in openSearch:", error);
            alert("Failed to open search. Please try again.");
        }
    };

    function handleGhostSquareClick(index) {
        const list = placedDevicesListRef.current || placedDevicesList;
        const spot = ghostSpotsRef.current[index];
        const deviceAtSpot = list.find(d => d.placementIndex === index) || (spot?.position && list.find(d => {
            const p = d.position;
            if (!p || typeof p.x !== 'number') return false;
            const dx = p.x - spot.position.x, dz = (p.z ?? 0) - (spot.position.z ?? 0);
            return Math.abs(dx) < 0.05 && Math.abs(dz) < 0.05;
        }));
        if (deviceAtSpot) {
            setShowSearch(false);
            setSearchMode('');
            setMiniProfileDevice(deviceAtSpot);
            setShowMiniProfile(true);
            setEditConnectionsMode(false);
            return;
        }
        openSearch('ghost', index);
    }

    // Removed unused producerSetupSpots

    const cableColors = {
        'Line1': 0xff0000,  // Pure red
        'Line2': 0xff3333,  // Lighter red
        'Line3': 0xcc0000,  // Darker red
        'Line4': 0xff6666,  // Even lighter red
        'Default': 0xff0000
    };

    useEffect(() => {
        console.log('Devices prop updated:', devices);
        devices.forEach((device, index) => {
            console.log(`Device ${index}:`, device.name, 'ID:', device.id);
        });
    }, [devices]);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (!mountRef.current) return;

        let isInitialized = false;

        const initializeScene = async () => {
            try {
                console.log("Initializing ThreeScene...");
                
                // Wait for Firebase auth to be ready
                if (!auth?.currentUser) {
                    console.log("Waiting for authentication...");
                    return;
                }

                if (isInitialized) return;
                isInitialized = true;

                const width = mountRef.current.clientWidth;
                const height = mountRef.current.clientHeight;

                const scene = new THREE.Scene();
                const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
                const renderer = new THREE.WebGLRenderer({ antialias: true });

                sceneRef.current = scene;
                cameraRef.current = camera;
                rendererRef.current = renderer;

                scene.background = new THREE.Color(0xf0f0f0);
                renderer.setSize(width, height);
                renderer.shadowMap.enabled = true;
                mountRef.current.appendChild(renderer.domElement);

                // Add lights
                const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
                scene.add(ambientLight);

                const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
                directionalLight.position.set(5, 5, 5);
                scene.add(directionalLight);

                const hemisphereLight = new THREE.HemisphereLight(0xffffbb, 0x080820, 1);
                scene.add(hemisphereLight);

                // Set up camera and controls
                camera.position.set(
                    CAMERA_POSITIONS.default.position.x,
                    CAMERA_POSITIONS.default.position.y,
                    CAMERA_POSITIONS.default.position.z
                );
        const controls = new OrbitControls(camera, renderer.domElement);
        controlsRef.current = controls;
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        
        // Configure mouse buttons: left click = pan, disable right click rotation
        // OrbitControls actions: ROTATE = 0, DOLLY = 1, PAN = 2
        // Set left mouse button to pan (action code 2), disable right mouse button
        controls.mouseButtons.LEFT = 2; // PAN action
        controls.mouseButtons.RIGHT = null; // Disable right click
        
        // Enable zoom so pinch (two-finger) does dolly/zoom; wheel is overridden below to rotate only
        controls.enableZoom = true;
        controls.zoomSpeed = 1.2;
        controls.minDistance = 1;
        controls.maxDistance = 25;
        // Disable OrbitControls two-finger handling; we handle pinch via pointer events (OrbitControls uses pointer, not touch)
        controls.touches = { ONE: TOUCH.ROTATE, TWO: -1 };
        
        // Pinch-to-zoom via pointer events (capture phase so we run before OrbitControls)
        const activePointers = new Map();
        let pinchStartDistance = 0;
        let pinchStartCameraDistance = 0;
        const minDist = 1;
        const maxDist = 25;
        function getPointersDistance(map) {
            const arr = Array.from(map.values());
            if (arr.length < 2) return 0;
            const a = arr[0], b = arr[1];
            return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        }
        function onPointerDown(e) {
            activePointers.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
            if (activePointers.size === 2) {
                isPinchingRef.current = true;
                pinchStartDistance = getPointersDistance(activePointers);
                pinchStartCameraDistance = camera.position.distanceTo(controls.target);
            }
        }
        function onPointerMove(e) {
            if (activePointers.has(e.pointerId)) {
                activePointers.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
                if (activePointers.size === 2 && pinchStartDistance > 0) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    const dist = getPointersDistance(activePointers);
                    if (dist <= 0) return;
                    const ratio = pinchStartDistance / dist;
                    let newDist = pinchStartCameraDistance * ratio;
                    newDist = Math.max(minDist, Math.min(maxDist, newDist));
                    const dir = camera.position.clone().sub(controls.target).normalize();
                    camera.position.copy(controls.target).add(dir.multiplyScalar(newDist));
                    controls.update();
                }
            }
        }
        function onPointerUp(e) {
            activePointers.delete(e.pointerId);
            if (activePointers.size < 2) {
                pinchStartDistance = 0;
                setTimeout(() => { isPinchingRef.current = false; }, 150);
            }
        }
        const el = renderer.domElement;
        const capture = true;
        el.addEventListener('pointerdown', onPointerDown, { capture });
        el.addEventListener('pointermove', onPointerMove, { capture });
        el.addEventListener('pointerup', onPointerUp, { capture });
        el.addEventListener('pointercancel', onPointerUp, { capture });
        
        // Wheel: zoom when ctrlKey (trackpad pinch), otherwise rotate
        const handleWheel = (event) => {
            event.preventDefault();
            event.stopImmediatePropagation();
            
            const deltaY = event.deltaY !== undefined ? event.deltaY : (event.wheelDeltaY ? -event.wheelDeltaY / 120 : 0);
            const deltaX = event.deltaX !== undefined ? event.deltaX : (event.wheelDeltaX ? -event.wheelDeltaX / 120 : 0);
            
            if (event.ctrlKey) {
                // Trackpad pinch / zoom gesture: dolly in/out
                const currentDist = camera.position.distanceTo(controls.target);
                const zoomSpeed = 0.002;
                const newDist = Math.max(minDist, Math.min(maxDist, currentDist + deltaY * zoomSpeed * currentDist));
                const dir = camera.position.clone().sub(controls.target).normalize();
                camera.position.copy(controls.target).add(dir.multiplyScalar(newDist));
            } else {
                // Normal scroll: rotate
                const rotationSpeed = 0.002;
                const spherical = new THREE.Spherical();
                const offset = camera.position.clone().sub(controls.target);
                spherical.setFromVector3(offset);
                if (deltaX !== 0) {
                    spherical.theta += deltaX * rotationSpeed;
                    spherical.theta = ((spherical.theta % (Math.PI * 2)) + (Math.PI * 2)) % (Math.PI * 2);
                }
                if (deltaY !== 0) {
                    spherical.phi += deltaY * rotationSpeed;
                    spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));
                }
                const newPosition = new THREE.Vector3();
                newPosition.setFromSpherical(spherical);
                newPosition.add(controls.target);
                camera.position.copy(newPosition);
            }
            controls.update();
        };
        
        renderer.domElement.addEventListener('wheel', handleWheel, { passive: false, capture: true });
        
        controls.target.set(
            CAMERA_POSITIONS.default.target.x,
            CAMERA_POSITIONS.default.target.y,
            CAMERA_POSITIONS.default.target.z
        );
        
        // Ensure initial theta is normalized to prevent boundary issues
        const initialSpherical = new THREE.Spherical();
        const initialOffset = camera.position.clone().sub(controls.target);
        initialSpherical.setFromVector3(initialOffset);
        initialSpherical.theta = ((initialSpherical.theta % (Math.PI * 2)) + (Math.PI * 2)) % (Math.PI * 2);
        const normalizedPosition = new THREE.Vector3();
        normalizedPosition.setFromSpherical(initialSpherical);
        normalizedPosition.add(controls.target);
        camera.position.copy(normalizedPosition);
        
        controls.update();

                // Create environment
                createClubEnvironment(scene);
                
                // Create ghost spots and setup raycasting
                createGhostPlacementSpots(scene);
                const cleanupRaycasting = setupRaycasting();
                setSceneInitialized(true);

                // Animation loop
                const animate = () => {
            requestAnimationFrame(animate);
            controls.update();
            renderer.render(scene, camera);
        };
        animate();

                // Handle window resize
        const handleResize = () => {
            if (!mountRef.current) return;
            const width = mountRef.current.clientWidth;
            const height = mountRef.current.clientHeight;
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            renderer.setSize(width, height);
        };
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            renderer.domElement.removeEventListener('wheel', handleWheel, { capture: true });
            el.removeEventListener('pointerdown', onPointerDown, { capture: true });
            el.removeEventListener('pointermove', onPointerMove, { capture: true });
            el.removeEventListener('pointerup', onPointerUp, { capture: true });
            el.removeEventListener('pointercancel', onPointerUp, { capture: true });
            if (cleanupRaycasting) cleanupRaycasting();
        };
            } catch (err) {
                console.error('Error initializing Three.js scene:', err);
                setError('Failed to initialize 3D scene. Please refresh the page.');
            }
        };

        // Set up auth state listener
        const unsubscribe = auth.onAuthStateChanged((user) => {
            if (user) {
                initializeScene();
            } else {
                setError("Please sign in to access the application");
            }
        });

        return () => {
            unsubscribe();
            // eslint-disable-next-line react-hooks/exhaustive-deps
            const mountElement = mountRef.current; // Copy ref to avoid ESLint warning
            if (mountElement && rendererRef.current?.domElement) {
                mountElement.removeChild(rendererRef.current.domElement);
            }
            if (sceneRef.current) {
                sceneRef.current.traverse((object) => {
                if (object.geometry) object.geometry.dispose();
                if (object.material) {
                    if (Array.isArray(object.material)) {
                        object.material.forEach(material => material.dispose());
                    } else {
                        object.material.dispose();
                    }
                }
            });
            }
            if (rendererRef.current) {
                rendererRef.current.dispose();
            }
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Load devices from prop. When loading a saved setup (many devices at once), use addProductToPosition
    // so the scene is built exactly like one-by-one. Otherwise use loadDeviceWithFirebase for incremental adds.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (!sceneInitialized || !sceneRef.current || !cameraRef.current || !controlsRef.current) return;
        if (!devices || devices.length === 0) {
            prevDevicesRef.current = [];
            hasLoadedFromSavedRef.current = false;
            return;
        }

        const scene = sceneRef.current;
        const loader = new GLTFLoader();
        const previousDevices = prevDevicesRef.current;
        const sortedDevices = [...devices].sort((a, b) => (a.locationPriority ?? 0) - (b.locationPriority ?? 0));

        // Treat as "load from saved" when we have devices and either we haven't done a saved load yet,
        // or the device list changed (e.g. user picked a different setup from hub). First mount with
        // saved setup: previousDevices equals devices (ref init), so we need a separate flag.
        const deviceListChanged = previousDevices.length !== devices.length ||
            previousDevices.some((p, i) => p.id !== devices[i]?.id);
        const isLoadFromSaved = sortedDevices.length > 0 && ghostSpotsRef.current?.length > 0 &&
            (!hasLoadedFromSavedRef.current || deviceListChanged);

        // Remove devices that are no longer in the prop (by uniqueId)
        const currentUniqueIdSet = new Set(devices.map(d => d.uniqueId).filter(Boolean));
        previousDevices.forEach(prevDevice => {
            if (!prevDevice.uniqueId || currentUniqueIdSet.has(prevDevice.uniqueId)) return;
            const ref = devicesRef.current[prevDevice.uniqueId];
            if (ref?.model) {
                scene.remove(ref.model);
                delete devicesRef.current[prevDevice.uniqueId];
            }
        });

        if (isLoadFromSaved) {
            hasLoadedFromSavedRef.current = true;
            // Clear placed list so we build it from scratch for this setup (avoids stale devices from previous setup)
            placedDevices.current = [];
            setPlacedDevicesList([]);

            // Simulate "re-build" order: create ghost spots with FX *before* placing, so saved placementIndex/spotType match.
            // Otherwise FX spots don't exist yet (they only appear after 2 CDJs + mixer), so FX devices land on wrong spots.
            const isBasicCompleteFromSaved = checkBasicSetupComplete(sortedDevices);
            createGhostPlacementSpots(scene, isBasicCompleteFromSaved);
            if (isBasicCompleteFromSaved) setBasicSetupComplete(true);

            // Helper: find ghost spot index closest to saved position (for old saves without spotType/placementIndex)
            const findGhostIndexByPosition = (pos) => {
                if (!pos || typeof pos.x !== 'number') return -1;
                let best = -1;
                let bestDist = Infinity;
                ghostSpotsRef.current.forEach((spot, idx) => {
                    if (!spot?.position) return;
                    const dx = spot.position.x - pos.x;
                    const dy = (spot.position.y || 0) - (pos.y || 0);
                    const dz = (spot.position.z || 0) - (pos.z || 0);
                    const d = dx * dx + dy * dy + dz * dz;
                    if (d < bestDist) { bestDist = d; best = idx; }
                });
                return best;
            };

            const usedSpotIndices = new Set();

            // Load saved setup one-by-one via addProductToPosition, each device on its saved ghost spot (await so order is stable)
            (async () => {
                for (let i = 0; i < sortedDevices.length; i++) {
                    const device = sortedDevices[i];
                    let placementIndex = device.placementIndex;

                    if (placementIndex == null && device.spotType != null) {
                        const foundIdx = ghostSpotsRef.current.findIndex((spot, i) => spot?.userData?.type === device.spotType && !usedSpotIndices.has(i));
                        if (foundIdx >= 0) placementIndex = foundIdx;
                    }
                    // Old saves: no spotType/placementIndex — match by closest saved position to a ghost spot
                    if (placementIndex == null && device.position && typeof device.position.x === 'number') {
                        placementIndex = findGhostIndexByPosition(device.position);
                    }
                    if (placementIndex == null) placementIndex = i;

                    // Avoid double-booking the same spot; move to next free if needed
                    while (usedSpotIndices.has(placementIndex) && placementIndex < ghostSpotsRef.current.length - 1) placementIndex++;
                    usedSpotIndices.add(placementIndex);

                    placementIndex = Math.min(placementIndex, ghostSpotsRef.current.length - 1);
                    if (placementIndex < 0) continue;

                    const spot = ghostSpotsRef.current[placementIndex];
                    if (!spot?.position) continue;
                    const pos = spot.position;
                    const uniqueId = `${device.id}-${pos.x}-${pos.y}-${pos.z}`;
                    if (devicesRef.current[uniqueId]?.model) continue;

                    let product = { ...device };
                    if (!product.modelPath || (!product.modelPath.startsWith('http') && !product.modelPath.startsWith('gs://'))) {
                        const url = await getFirebaseModelURL(product.name);
                        if (url) product = { ...product, modelPath: url };
                    }
                    if (!product.modelPath) continue;
                    await addProductToPosition(product, placementIndex);
                }

                // Run connections several times as models finish loading
                [500, 1000, 1500, 2000, 2500].forEach((ms) => {
                    setTimeout(() => {
                        const list = placedDevicesListRef.current || [];
                        if (sceneRef.current && list.length > 0) {
                            updateConnections(list);
                            if (rendererRef.current && cameraRef.current) {
                                rendererRef.current.render(sceneRef.current, cameraRef.current);
                            }
                        }
                    }, ms);
                });
            })();
        } else {
            // Incremental: add/reposition using loadDeviceWithFirebase for any not already in scene
            // Check by uniqueId (set by addProductToPosition) or by device.id to avoid double-loading
            sortedDevices.forEach((device, index) => {
                const ref = device.uniqueId ? devicesRef.current[device.uniqueId] : devicesRef.current[device.id];
                if (ref?.model) {
                    const model = ref.model;
                    const modelSize = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
                    const position = getDevicePosition(device, index, modelSize);
                    model.position.set(position.x, position.y, position.z);
                } else {
                    loadDeviceWithFirebase(device, index, loader, scene);
                }
            });
            updateConnections(devices);
        }

        prevDevicesRef.current = devices;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [devices, sceneInitialized]);

    function loadDevice(device, index, loader, scene) {
        let position = { x: 1, y: 1, z: 2 };  // Default position if needed
        if (device.modelPath) {
            // Resolve relative paths to full URLs
            let modelURL = device.modelPath;
            if (!modelURL.startsWith('http') && !modelURL.startsWith('gs://')) {
                // If it's a relative path starting with /, convert to full URL
                if (modelURL.startsWith('/')) {
                    modelURL = `${window.location.origin}${modelURL}`;
                } else {
                    // If it's a relative path without /, make it relative to current origin
                    modelURL = `${window.location.origin}/${modelURL}`;
                }
            }
            console.log('Loading model from URL:', modelURL, index);
            loader.load(
                modelURL,
                (gltf) => {
                    console.log('GLTF loaded successfully:', device.name, index);
                    const model = gltf.scene;

                    // Compute the bounding box of the model AFTER it is loaded
                    const box = new THREE.Box3().setFromObject(model);

                    // Get the size (width, height, depth) of the model's bounding box
                    const size = new THREE.Vector3();
                    box.getSize(size);  // size contains width (x), height (y), and depth (z)
                    console.log(`Model dimensions(width, height, depth): ${size.x}, ${size.y}, ${size.z}`);

                    // Get the device position from your custom logic (optional)
                    position = getDevicePosition(device, index, size);
                    console.log(`loadDevice position setting: ${position.x}, ${position.y}, ${position.z}`);

                    // Set the model position using the calculated position
                    model.position.set(position.x, position.y, position.z);

                    // Optionally, adjust the position based on the model's center
                    const center = box.getCenter(new THREE.Vector3());
                    model.position.sub(center);  // Center the model on its position

                    // Add the model to the scene
                    scene.add(model);

                    // Store reference to the model for future use
                    devicesRef.current[device.id] = {
                        model,
                        data: device,
                        connectionsInUse: { inputs: [], outputs: [] }
                    };

                    // Scale the model (if needed)
                    const scale = 1.0;
                    model.scale.set(scale, scale, scale);

                    // Traverse the model to access individual meshes and set up materials and shadows
                    model.traverse((child) => {
                        if (child.isMesh) {
                            console.log('Mesh geometry:', child.geometry);  // Access geometry here
                            child.material.side = THREE.DoubleSide;
                            child.castShadow = true;
                            child.receiveShadow = true;
                        }
                    });
                },
                (progress) => {
                    console.log(`Loading progress: ${(progress.loaded / progress.total * 100)}%`);
                },
                (error) => {
                    console.error('Error loading model:', device.name, error);
                    createPlaceholderRender(device, position, scene);  // Handle fallback if model fails to load
                }
            );
        } else {
            console.log('No model URL for device:', device.name);
            createPlaceholderRender(device, position, scene);  // Handle devices with no model URL
        }
    }

    // Function to get Firebase Storage URL for a device model
    const getFirebaseModelURL = async (deviceName) => {
        try {
            // Use the statically imported function
            const modelURL = await getStorageModelURL(`${deviceName}.glb`);
            return modelURL;
        } catch (error) {
            console.error('Error getting Firebase model URL for:', deviceName, error);
            return null;
        }
    };

    // Function to load device with Firebase Storage URL
    const loadDeviceWithFirebase = async (device, index, loader, scene) => {
        let position = { x: 1, y: 1, z: 2 };  // Default position if needed
        
        // If device already has a Firebase Storage URL, use it
        if (device.modelPath && (device.modelPath.startsWith('https://') || device.modelPath.startsWith('gs://'))) {
            loadDevice(device, index, loader, scene);
            return;
        }
        
        // Try to get Firebase Storage URL for the device
        console.log('Attempting to get Firebase Storage URL for:', device.name);
        const firebaseURL = await getFirebaseModelURL(device.name);
        
        if (firebaseURL) {
            console.log('Found Firebase Storage URL for', device.name, ':', firebaseURL);
            // Create a copy of the device with the Firebase URL
            const deviceWithURL = { ...device, modelPath: firebaseURL };
            loadDevice(deviceWithURL, index, loader, scene);
        } else {
            console.log('No Firebase Storage URL found for:', device.name, '- using placeholder');
            createPlaceholderRender(device, position, scene);
        }
    };

    function getDevicePosition(device, index, modelSize) {
        let position = { x: 1, y: 1, z: 2 };
        if (!djTableRef.current) {
            console.log("getDevicePosition No table ref object set ");
            return position;
        }

        if (device == null) {
            console.log("getDevicePosition No device or model ref object set ");
            return position;
        }

        // Use smart placement if device has spotType (from placement system)
        if (device.spotType && device.x !== undefined && device.y !== undefined && device.z !== undefined) {
            console.log(`Using smart placement for ${device.name} at spot: ${device.spotType}`);
            const tablePosition = djTableRef.current.position.clone();
            const tableGeometry = djTableRef.current.geometry;
            // Handle both BoxGeometry (has parameters.height) and PlaneGeometry (no height)
            const tableHeight = tableGeometry.parameters?.height || 0.02;   // y dimension, default to 0.02 for PlaneGeometry
            const deviceHeight = modelSize.y;
            
            // Use the recommended position from placement system
            position = {
                x: device.x,
                y: tablePosition.y + (tableHeight / 2) + (deviceHeight / 2),
                z: device.z
            };
            
            console.log(`Smart placement for ${device.name}: x:${position.x}, y:${position.y}, z:${position.z}`);
            return position;
        }

        // Fallback to original index-based placement
        const distanceBetweenObjects = 0.75;

        const tablePosition = djTableRef.current.position.clone(); // Clone the position of the DJ table
        const tableGeometry = djTableRef.current.geometry;
        // Handle both BoxGeometry (has parameters.height) and PlaneGeometry (no height)
        const tableHeight = tableGeometry.parameters?.height || 0.02;   // y dimension, default to 0.02 for PlaneGeometry

        const deviceHeight = modelSize.y;   // y dimension

        console.log("Looking for location: " + device.name);
        console.log(`finding location for Device ${index}:`, device.name, 'ID:', device.id);
        const tableSideMultiplier = ((index % 2) === 0) ? -1 : 1;
        const distanceMultiplier = index === 0 ? 0 : Math.floor((index - 1) / 2) + 1;
        const x = ((tablePosition.x / 2)) + (tableSideMultiplier * distanceMultiplier * distanceBetweenObjects);
        const y = tablePosition.y + (tableHeight / 2) + (deviceHeight / 2);
        const z = tablePosition.z;

        position = { x: x, y: y, z: z };

        console.log(`Setting location for ${device.name}.x:${position.x}, y:${position.y}, z:${position.z}`);
        return position;
    }

    function createPlaceholderRender(device, position, scene) {
        console.log('Creating placeholder for:', device.name);
        const geometry = new THREE.BoxGeometry(0.25, 0.25, 0.25);
        const material = new THREE.MeshBasicMaterial({ color: 0x333333 });
        const cube = new THREE.Mesh(geometry, material);
        const pos = position && typeof position.x === 'number' ? position : { x: 0, y: 1.05, z: 0 };
        cube.position.set(pos.x, pos.y, pos.z);
        scene.add(cube);
        devicesRef.current[device.id] = {
            model: cube,
            data: device,
            connectionsInUse: { inputs: [], outputs: [] }
        };
    }

    // Removed unused getDeviceId function

    function findMatchingPorts(sourceDevice, targetDevice, usedInputs = new Set(), assignedChannel = null) {
        if (!sourceDevice || !targetDevice) return [];

        const connections = [];
        
        // Get outputs from source device
        const outputs = sourceDevice.outputs || [];
        // Get inputs from target device
        const inputs = targetDevice.inputs || [];

        console.log('Checking connections between:', sourceDevice.name, 'and', targetDevice.name);
        console.log('Source device position:', sourceDevice.position);
        console.log('Source outputs:', outputs.map(o => o.type));
        console.log('Target inputs:', inputs.map(i => i.type));
        console.log('Used inputs:', Array.from(usedInputs));
        console.log('Assigned channel:', assignedChannel ? `CH${assignedChannel}` : 'none');

        // If this is a mixer connecting to an FX unit, handle Send connection
        const isMixer = sourceDevice.name.includes('DJM');
        const isFXUnit = targetDevice.name.toLowerCase().includes('rmx') || 
                        targetDevice.name.toLowerCase().includes('revolo') ||
                        targetDevice.name.toLowerCase().includes('fx') ||
                        (targetDevice.type && targetDevice.type.toLowerCase().includes('fx'));
        
        if (isMixer && isFXUnit) {
            console.log('Processing mixer to FX unit connection (Send)');
            console.log('Mixer outputs available:', outputs.map(o => o.type));
            console.log('FX unit inputs available:', inputs.map(i => i.type));

            const isSendOutput = (o) => o.type && (o.type === 'Send' || o.type === 'Send Out' || o.type.toLowerCase().includes('send'));
            const isSendInput = (i) => i.type && (i.type === 'Send' || i.type === 'Send In' || i.type.toLowerCase().includes('send'));

            let sendOutput = outputs.find(isSendOutput);
            let sendInput = inputs.find(isSendInput);

            if (!sendOutput && outputs.length > 0) {
                sendOutput = outputs.find(o =>
                    !o.type?.toLowerCase().includes('line') &&
                    !o.type?.toLowerCase().includes('rca') &&
                    !o.type?.toLowerCase().includes('1/4')
                ) || outputs[0];
                console.log('⚠️ No Send/Send Out port found, using fallback:', sendOutput?.type);
            }
            if (!sendInput && inputs.length > 0) {
                sendInput = inputs.find(i =>
                    !i.type?.toLowerCase().includes('line') &&
                    !i.type?.toLowerCase().includes('rca') &&
                    !i.type?.toLowerCase().includes('1/4')
                ) || inputs[0];
                console.log('⚠️ No Send/Send In port found, using fallback:', sendInput?.type);
            }

            console.log('Using Send Output:', sendOutput?.type);
            console.log('Using Send Input:', sendInput?.type);

            if (sendOutput && sendInput) {
                const def = (c) => (c && c.x !== undefined && c.y !== undefined && c.z !== undefined)
                    ? { x: Number(c.x), y: Number(c.y), z: Number(c.z) }
                    : null;
                const sendOutCoord = def(sendOutput.coordinate) || { x: 0.02, y: 0.075, z: -0.28 };
                const sendInCoord = def(sendInput.coordinate) || { x: 0.06, y: 0.075, z: -0.28 };
                connections.push({
                    sourcePort: { ...sendOutput, coordinate: sendOutCoord },
                    targetPort: { ...sendInput, coordinate: sendInCoord },
                    type: 'Send'
                });
                console.log('✅ Connected mixer to FX unit (Send)');
                console.log('   Send Out coord (mixer):', sendOutCoord);
                console.log('   Send In coord (FX/Revolo):', sendInCoord);
            } else {
                console.warn('❌ Cannot connect: No available ports');
                if (!sendOutput) console.warn('  - Mixer has no Send/Send Out');
                if (!sendInput) console.warn('  - FX unit has no Send/Send In');
            }
        }
        
        // If this is an FX unit connecting to a mixer, handle Return connection
        const isFXSource = sourceDevice.name.toLowerCase().includes('rmx') || 
                          sourceDevice.name.toLowerCase().includes('revolo') ||
                          sourceDevice.name.toLowerCase().includes('fx') ||
                          (sourceDevice.type && sourceDevice.type.toLowerCase().includes('fx'));
        const isMixerTarget = targetDevice.name.includes('DJM');
        
        if (isFXSource && isMixerTarget) {
            console.log('Processing FX unit to mixer connection (Return)');
            console.log('FX unit outputs available:', outputs.map(o => o.type));
            console.log('Mixer inputs available:', inputs.map(i => i.type));

            const isReturnOutput = (o) => {
                if (!o.type) return false;
                const t = o.type.toLowerCase();
                return t === 'return' || t === 'return out' || (t.includes('return') && (t.includes('out') || !t.includes('in')));
            };
            const isReturnInput = (i) => {
                if (!i.type) return false;
                const t = i.type.toLowerCase();
                return t === 'return' || t === 'return in' || (t.includes('return') && (t.includes('in') || !t.includes('out')));
            };

            let returnOutput = outputs.find(isReturnOutput);
            let returnInput = inputs.find(isReturnInput);

            if (!returnOutput && outputs.length > 0) {
                returnOutput = outputs.find(o => !o.type?.toLowerCase().includes('send')) || outputs[0];
                console.log('⚠️ No Return/Return Out port found, using fallback:', returnOutput?.type);
            }
            if (!returnInput && inputs.length > 0) {
                returnInput = inputs.find(i =>
                    !i.type?.toLowerCase().includes('line') &&
                    !i.type?.toLowerCase().includes('rca') &&
                    !i.type?.toLowerCase().includes('1/4')
                ) || inputs[0];
                console.log('⚠️ No Return/Return In port found, using fallback:', returnInput?.type);
            }

            console.log('Using Return Output (FX/Revolo):', returnOutput?.type);
            console.log('Using Return Input (mixer):', returnInput?.type);

            if (returnOutput && returnInput) {
                const def = (c) => (c && c.x !== undefined && c.y !== undefined && c.z !== undefined)
                    ? { x: Number(c.x), y: Number(c.y), z: Number(c.z) }
                    : null;
                const returnOutCoord = def(returnOutput.coordinate) || { x: 0.06, y: 0.075, z: -0.28 };
                const returnInCoord = def(returnInput.coordinate) || { x: 0.02, y: 0.075, z: -0.28 };
                connections.push({
                    sourcePort: { ...returnOutput, coordinate: returnOutCoord },
                    targetPort: { ...returnInput, coordinate: returnInCoord },
                    type: 'Return'
                });
                console.log('✅ Connected FX unit to mixer (Return)');
                console.log('   Return Out coord (FX/Revolo):', returnOutCoord);
                console.log('   Return In coord (mixer):', returnInCoord);
            } else {
                console.warn('❌ Cannot connect: No available ports');
                if (!returnOutput) console.warn('  - FX unit has no Return/Return Out');
                if (!returnInput) console.warn('  - Mixer has no Return/Return In');
            }
        }
        
        // If this is a CDJ connecting to a mixer, handle line assignments using assigned channel
        if (sourceDevice.name.includes('CDJ') && targetDevice.name.includes('DJM')) {
            const lineNumber = assignedChannel; // Use the assigned channel directly
            
            if (lineNumber) {
                console.log(`CDJ "${sourceDevice.name}" assigned to CH${lineNumber} (Line${lineNumber})`);
            } else {
                console.warn(`⚠️ CDJ "${sourceDevice.name}" has no assigned channel - this should not happen!`);
                console.warn(`   CDJ position: x:${sourceDevice.position?.x}, y:${sourceDevice.position?.y}, z:${sourceDevice.position?.z}`);
            }

            // Test coordinates for CDJ outputs - handle multiple port types
            // PRIORITY: Connect every CDJ to the mixer using the assigned channel
            outputs.forEach((output) => {
                // Check for Line Out, RCA, or 1/4" outputs
                const isCompatibleOutput = output.type === 'Line Out' || 
                                          output.type === 'RCA' ||
                                          output.type === '1/4"' ||
                                          (output.type?.toLowerCase().includes('line') && output.type?.toLowerCase().includes('out')) ||
                                          output.type?.toLowerCase().includes('rca');
                
                if (isCompatibleOutput) {
                    let targetInput = null;
                    
                    if (!lineNumber) {
                        console.warn(`⚠️ CDJ "${sourceDevice.name}" has no assigned channel - skipping connection`);
                        return;
                    }
                    
                    // Strategy 1: Try to find the specific Line/CH input matching the assigned channel
                    // Look for: "Line{lineNumber}", "CH{lineNumber}", "Line {lineNumber}", etc.
                    targetInput = inputs.find(input => {
                        if (usedInputs.has(input.type)) return false;
                        const inputType = input.type || '';
                        const inputTypeLower = inputType.toLowerCase();
                        // Match patterns like "Line2", "CH2", "Line 2", "CH 2", "CH2 LINE", etc.
                        return (inputTypeLower.includes(`line${lineNumber}`) || 
                                inputTypeLower.includes(`ch${lineNumber}`) ||
                                inputTypeLower.includes(`line ${lineNumber}`) ||
                                inputTypeLower.includes(`ch ${lineNumber}`) ||
                                inputType === `Line${lineNumber}` ||
                                inputType === `CH${lineNumber}`);
                    });
                    
                    // Strategy 2: If not found by name, try to find RCA or 1/4" input by coordinate position
                    // Expected coordinates for each channel (based on mixer back panel layout)
                    if (!targetInput) {
                        const expectedX = lineNumber === 1 ? 0.085 :  // CH1 (rightmost)
                                        lineNumber === 2 ? -0.04 :   // CH2 (inner left)
                                        lineNumber === 3 ? 0.005 :   // CH3 (inner right)
                                        lineNumber === 4 ? -0.12 :   // CH4 (leftmost)
                                        0;
                        
                        targetInput = inputs.find(input => {
                            if (usedInputs.has(input.type)) return false;
                            const isRCA = input.type === 'RCA' || input.type === '1/4"' || input.type?.toLowerCase().includes('rca');
                            if (!isRCA) return false;
                            const coord = input.coordinate || {};
                            const coordX = coord.x || 0;
                            // Match coordinates within tolerance
                            return Math.abs(coordX - expectedX) < 0.1;
                        });
                    }
                    
                    // Strategy 3: If still not found, use ANY available RCA/1/4" input (most permissive)
                    if (!targetInput) {
                        targetInput = inputs.find(input => {
                            if (usedInputs.has(input.type)) return false;
                            const isRCA = input.type === 'RCA' || input.type === '1/4"' || input.type?.toLowerCase().includes('rca');
                            const isLine = input.type?.toLowerCase().includes('line') && input.type?.toLowerCase().includes('in');
                            return isRCA || isLine;
                        });
                    }
                    
                    // Strategy 4: Last resort - use ANY unused input
                    if (!targetInput) {
                        targetInput = inputs.find(input => !usedInputs.has(input.type));
                    }
                    
                    if (targetInput) {
                        // Check if this input is already used (double-check)
                        if (usedInputs.has(targetInput.type)) {
                            console.log(`⏭️  Skipping ${targetInput.type} - already in use`);
                            return; // Skip this output
                        }
                        
                        // Use actual port coordinates - don't override them!
                        // Only use defaults if coordinates are completely missing
                        const outputCoord = output.coordinate || {};
                        const inputCoord = targetInput.coordinate || {};
                        
                        // Check if coordinates are valid (have at least x, y, z properties)
                        const hasValidOutputCoord = outputCoord && 
                            (outputCoord.x !== undefined || outputCoord.x !== null) &&
                            (outputCoord.y !== undefined || outputCoord.y !== null) &&
                            (outputCoord.z !== undefined || outputCoord.z !== null);
                            
                        const hasValidInputCoord = inputCoord && 
                            (inputCoord.x !== undefined || inputCoord.x !== null) &&
                            (inputCoord.y !== undefined || inputCoord.y !== null) &&
                            (inputCoord.z !== undefined || inputCoord.z !== null);
                        
                        // Use actual coordinates if available, otherwise use defaults
                        const finalOutputCoord = hasValidOutputCoord ? outputCoord : {
                            x: lineNumber === 3 ? 0.06 : 0.08,
                            y: 0.09,
                            z: -0.32
                        };
                        
                        const finalInputCoord = hasValidInputCoord ? inputCoord : (() => {
                            // Default coordinates based on line number
                            switch(lineNumber) {
                                case 1: return { x: -0.12, y: 0.075, z: -0.28 };
                                case 2: return { x: -0.04, y: 0.075, z: -0.28 };
                                case 3: return { x: 0.005, y: 0.075, z: -0.28 };
                                case 4: return { x: 0.085, y: 0.075, z: -0.28 };
                                default: return { x: (lineNumber - 2.5) * 0.08, y: 0.075, z: -0.28 };
                            }
                        })();
                        
                        connections.push({
                            sourcePort: {
                                ...output,
                                coordinate: finalOutputCoord
                            },
                            targetPort: {
                                ...targetInput,
                                coordinate: finalInputCoord
                            },
                            type: output.type
                        });
                        
                        console.log(`✅ Connected CDJ ${output.type} to Mixer ${targetInput.type} (Line${lineNumber})`);
                        console.log(`   Using ${hasValidOutputCoord ? 'actual' : 'default'} output coord:`, finalOutputCoord);
                        console.log(`   Using ${hasValidInputCoord ? 'actual' : 'default'} input coord:`, finalInputCoord);
                    } else {
                        console.warn(`⚠️ No matching input found for CDJ output "${output.type}"`);
                        console.warn(`   Available inputs:`, inputs.map(i => ({ type: i.type, used: usedInputs.has(i.type) })));
                        console.warn(`   Used inputs:`, Array.from(usedInputs));
                        console.warn(`   This CDJ will not be connected to the mixer!`);
                    }
                }
            });
        }

        console.log('Found connections:', connections);
        return connections;
    }

    // Removed unused isCompatibleConnection function

    function createClubEnvironment(scene) {
        // Clear any existing environment elements
        scene.children = scene.children.filter(child => 
            child.userData.type !== 'environment'
        );

        // Common floor setup - extend to match room dimensions for DJ setup
        const floorSize = currentSetupType === 'DJ' ? 30 : 20; // Larger floor for warehouse club
        const floorGeometry = new THREE.PlaneGeometry(floorSize, floorSize);
        const floor = new THREE.Mesh(floorGeometry, null);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        floor.userData.type = 'environment';

        // Common table setup - create as a shelf (thin top with legs, open front for cable visibility)
        const tableGroup = new THREE.Group();
        
        // Very thin top surface - use PlaneGeometry for minimal thickness
        const tableTop = new THREE.Mesh(
            new THREE.PlaneGeometry(4.5, 1),
            new THREE.MeshStandardMaterial({ 
                color: 0x222222,
                side: THREE.DoubleSide  // Visible from both sides
            })
        );
        tableTop.rotation.x = -Math.PI / 2; // Rotate to be horizontal
        tableTop.position.set(0, 0.95, -0.25);
        tableTop.receiveShadow = true;
        tableTop.castShadow = false; // Don't cast shadow to avoid visual clutter
        tableGroup.add(tableTop);
        
        // Add corner legs for support (only back legs, front is open for cables)
        const legGeometry = new THREE.BoxGeometry(0.1, 0.9, 0.1);
        const legMaterial = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
        
        // Only back legs to keep front open for cable visibility
        const legPositions = [
            { x: -2.15, z: 0.2 },   // Back left
            { x: 2.15, z: 0.2 }      // Back right
        ];
        
        legPositions.forEach(pos => {
            const leg = new THREE.Mesh(legGeometry, legMaterial);
            leg.position.set(pos.x, 0.5, pos.z);
            leg.receiveShadow = true;
            leg.castShadow = true;
            tableGroup.add(leg);
        });
        
        tableGroup.position.set(0, 0, 0);
        tableGroup.userData.type = 'environment';
        
        // Use the table top for positioning reference (maintain compatibility)
        djTableRef.current = tableTop;

        switch (currentSetupType) {
            case 'DJ':
                // Club environment
                floor.material = new THREE.MeshStandardMaterial({ 
                    color: 0x111111,
                    roughness: 0.8,
                    metalness: 0.2
                });

                // DJ Booth as a frame structure (open front for cable visibility)
                const boothGroup = new THREE.Group();
                const boothMaterial = new THREE.MeshStandardMaterial({ 
                    color: 0x333333,
                    metalness: 0.7,
                    roughness: 0.3
                });
                
                // Top surface (thin)
                const boothTop = new THREE.Mesh(
                    new THREE.PlaneGeometry(5, 1.2),
                    boothMaterial
                );
                boothTop.rotation.x = -Math.PI / 2;
                boothTop.position.set(0, 0.9, -0.25);
                boothTop.receiveShadow = true;
                boothGroup.add(boothTop);
                
                // Back panel
                const boothBack = new THREE.Mesh(
                    new THREE.PlaneGeometry(5, 0.9),
                    boothMaterial
                );
                boothBack.position.set(0, 0.45, -0.85);
                boothBack.receiveShadow = true;
                boothGroup.add(boothBack);
                
                // Side panels (left and right)
                const sideMaterial = boothMaterial.clone();
                const leftSide = new THREE.Mesh(
                    new THREE.PlaneGeometry(1.2, 0.9),
                    sideMaterial
                );
                leftSide.rotation.y = Math.PI / 2;
                leftSide.position.set(-2.5, 0.45, -0.25);
                leftSide.receiveShadow = true;
                boothGroup.add(leftSide);
                
                const rightSide = new THREE.Mesh(
                    new THREE.PlaneGeometry(1.2, 0.9),
                    sideMaterial
                );
                rightSide.rotation.y = -Math.PI / 2;
                rightSide.position.set(2.5, 0.45, -0.25);
                rightSide.receiveShadow = true;
                boothGroup.add(rightSide);
                
                boothGroup.position.set(0, 0, 0);
                boothGroup.userData.type = 'environment';
                const booth = boothGroup;

                // Add colored spotlights
                const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xff00ff];
                colors.forEach((color, i) => {
                    const spotlight = new THREE.SpotLight(color, 2);
                    spotlight.position.set(
                        Math.cos(i * Math.PI/2) * 3,
                        4,
                        Math.sin(i * Math.PI/2) * 3
                    );
                    spotlight.angle = Math.PI / 6;
                    spotlight.penumbra = 0.3;
                    spotlight.decay = 1;
                    spotlight.distance = 10;
                    spotlight.target.position.set(0, 0, 0);
                    spotlight.castShadow = true;
                    spotlight.userData.type = 'environment';
                    scene.add(spotlight);
                    scene.add(spotlight.target);
                });

                scene.add(booth);
                
                // Add dance floor past the DJ setup
                const danceFloorGroup = new THREE.Group();
                
                // Main dance floor surface with checkerboard pattern
                const danceFloorGeometry = new THREE.PlaneGeometry(12, 8);
                const danceFloorMaterial = new THREE.MeshStandardMaterial({ 
                    color: 0x1a1a1a,
                    roughness: 0.3,
                    metalness: 0.8,
                    side: THREE.DoubleSide
                });
                
                const danceFloor = new THREE.Mesh(danceFloorGeometry, danceFloorMaterial);
                danceFloor.rotation.x = -Math.PI / 2;
                danceFloor.position.set(0, 0.01, -7); // Closer to back wall (z: -10), further from booth
                danceFloor.receiveShadow = true;
                danceFloorGroup.add(danceFloor);
                
                // Add checkerboard pattern using smaller tiles
                const tileSize = 1;
                const tileColors = [0x2a2a2a, 0x0a0a0a]; // Dark gray and very dark gray
                const tilesX = 12;
                const tilesZ = 8;
                const danceFloorCenterZ = -7; // Center of dance floor, closer to back wall
                
                for (let x = 0; x < tilesX; x++) {
                    for (let z = 0; z < tilesZ; z++) {
                        const tile = new THREE.Mesh(
                            new THREE.PlaneGeometry(tileSize, tileSize),
                            new THREE.MeshStandardMaterial({ 
                                color: tileColors[(x + z) % 2],
                                roughness: 0.2,
                                metalness: 0.9,
                                side: THREE.DoubleSide
                            })
                        );
                        tile.rotation.x = -Math.PI / 2;
                        tile.position.set(
                            -6 + (x * tileSize) + (tileSize / 2),
                            0.02,
                            danceFloorCenterZ - (z * tileSize) + (tileSize / 2)
                        );
                        tile.receiveShadow = true;
                        danceFloorGroup.add(tile);
                    }
                }
                
                // Add subtle edge lighting/glow effect
                const edgeLightGeometry = new THREE.PlaneGeometry(12, 0.2);
                const edgeLightMaterial = new THREE.MeshStandardMaterial({ 
                    color: 0x444444,
                    emissive: 0x222222,
                    emissiveIntensity: 0.3,
                    side: THREE.DoubleSide
                });
                
                // Front edge (closer to booth)
                const frontEdge = new THREE.Mesh(edgeLightGeometry, edgeLightMaterial);
                frontEdge.rotation.x = -Math.PI / 2;
                frontEdge.position.set(0, 0.03, -3);
                danceFloorGroup.add(frontEdge);
                
                // Back edge (closer to wall)
                const backEdge = new THREE.Mesh(edgeLightGeometry, edgeLightMaterial);
                backEdge.rotation.x = -Math.PI / 2;
                backEdge.position.set(0, 0.03, -11);
                danceFloorGroup.add(backEdge);
                
                // Left edge
                const leftEdge = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 8), edgeLightMaterial);
                leftEdge.rotation.x = -Math.PI / 2;
                leftEdge.position.set(-6, 0.03, danceFloorCenterZ);
                danceFloorGroup.add(leftEdge);
                
                // Right edge
                const rightEdge = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 8), edgeLightMaterial);
                rightEdge.rotation.x = -Math.PI / 2;
                rightEdge.position.set(6, 0.03, danceFloorCenterZ);
                danceFloorGroup.add(rightEdge);
                
                scene.add(danceFloorGroup);
                
                // Add room walls to create a closed space (warehouse club setting)
                const djWallMaterial = new THREE.MeshStandardMaterial({ 
                    color: 0x000000,  // Pure black for club setting
                    roughness: 0.95,
                    metalness: 0.0,
                    side: THREE.DoubleSide  // Make walls visible from both sides
                });
                
                // Extended room dimensions for warehouse feel
                const roomWidth = 30;  // Wider for warehouse feel
                const roomDepth = 30;  // Deeper to accommodate dance floor
                const roomHeight = 12; // Taller ceiling for warehouse
                
                // Back wall (moved further back to accommodate dance floor)
                const backWall = new THREE.Mesh(
                    new THREE.PlaneGeometry(roomWidth, roomHeight),
                    djWallMaterial
                );
                backWall.rotation.y = Math.PI;
                backWall.position.set(0, roomHeight / 2, -roomDepth / 2);
                backWall.receiveShadow = true;
                scene.add(backWall);
                
                // Add red LED strips on left and right sides of back wall (cool rave design)
                const ledStripMaterial = new THREE.MeshStandardMaterial({ 
                    color: 0x660000,  // Darker red
                    emissive: 0xff0000,
                    emissiveIntensity: 0.4,
                    side: THREE.DoubleSide
                });
                
                // Left side vertical LED strips with staggered pattern
                const leftSideX = -roomWidth / 2 + 0.5;
                const numLeftStrips = 5;
                for (let i = 0; i < numLeftStrips; i++) {
                    const verticalLed = new THREE.Mesh(
                        new THREE.PlaneGeometry(0.12, 2 + (i % 2) * 1.5), // Varying heights for design
                        ledStripMaterial.clone()
                    );
                    verticalLed.rotation.y = Math.PI;
                    const yOffset = (i - (numLeftStrips - 1) / 2) * 2.5;
                    const yPos = roomHeight / 2 + yOffset;
                    verticalLed.position.set(leftSideX, yPos, -roomDepth / 2 + 0.01);
                    scene.add(verticalLed);
                }
                
                // Right side vertical LED strips with staggered pattern (mirrored)
                const rightSideX = roomWidth / 2 - 0.5;
                for (let i = 0; i < numLeftStrips; i++) {
                    const verticalLed = new THREE.Mesh(
                        new THREE.PlaneGeometry(0.12, 2 + (i % 2) * 1.5), // Varying heights for design
                        ledStripMaterial.clone()
                    );
                    verticalLed.rotation.y = Math.PI;
                    const yOffset = (i - (numLeftStrips - 1) / 2) * 2.5;
                    const yPos = roomHeight / 2 + yOffset;
                    verticalLed.position.set(rightSideX, yPos, -roomDepth / 2 + 0.01);
                    scene.add(verticalLed);
                }
                
                // Add diagonal accent strips on corners for extra design flair
                const diagonalMaterial = ledStripMaterial.clone();
                diagonalMaterial.emissiveIntensity = 0.2;
                
                // Top-left diagonal
                const topLeftDiagonal = new THREE.Mesh(
                    new THREE.PlaneGeometry(0.1, 3),
                    diagonalMaterial
                );
                topLeftDiagonal.rotation.y = Math.PI;
                topLeftDiagonal.rotation.z = Math.PI / 4;
                topLeftDiagonal.position.set(leftSideX + 0.5, roomHeight - 1, -roomDepth / 2 + 0.01);
                scene.add(topLeftDiagonal);
                
                // Top-right diagonal
                const topRightDiagonal = new THREE.Mesh(
                    new THREE.PlaneGeometry(0.1, 3),
                    diagonalMaterial
                );
                topRightDiagonal.rotation.y = Math.PI;
                topRightDiagonal.rotation.z = -Math.PI / 4;
                topRightDiagonal.position.set(rightSideX - 0.5, roomHeight - 1, -roomDepth / 2 + 0.01);
                scene.add(topRightDiagonal);
                
                // Add subtle red laser spotlights pointing down from ceiling (less intense)
                const numLasers = 8;
                for (let i = 0; i < numLasers; i++) {
                    const laser = new THREE.SpotLight(0xff0000, 0.5); // Much lower intensity
                    const xPos = -roomWidth / 2 + 2 + (i * (roomWidth - 4) / (numLasers - 1));
                    laser.position.set(xPos, roomHeight - 1, -roomDepth / 2 + 2);
                    laser.target.position.set(xPos, 0, -roomDepth / 2 + 2);
                    laser.angle = Math.PI / 12; // Narrower beam for laser effect
                    laser.penumbra = 0.2;
                    laser.decay = 2;
                    laser.distance = roomHeight;
                    laser.castShadow = false; // Don't cast shadows to avoid washing out
                    scene.add(laser);
                    scene.add(laser.target);
                }
                
                // Left wall (extended)
                const leftWall = new THREE.Mesh(
                    new THREE.PlaneGeometry(roomDepth, roomHeight),
                    djWallMaterial.clone()
                );
                leftWall.rotation.y = Math.PI / 2;
                leftWall.position.set(-roomWidth / 2, roomHeight / 2, 0);
                leftWall.receiveShadow = true;
                scene.add(leftWall);
                
                // Right wall (extended)
                const rightWall = new THREE.Mesh(
                    new THREE.PlaneGeometry(roomDepth, roomHeight),
                    djWallMaterial.clone()
                );
                rightWall.rotation.y = -Math.PI / 2;
                rightWall.position.set(roomWidth / 2, roomHeight / 2, 0);
                rightWall.receiveShadow = true;
                scene.add(rightWall);
                
                // Front wall (extended)
                const frontWall = new THREE.Mesh(
                    new THREE.PlaneGeometry(roomWidth, roomHeight),
                    djWallMaterial.clone()
                );
                frontWall.position.set(0, roomHeight / 2, roomDepth / 2);
                frontWall.receiveShadow = true;
                scene.add(frontWall);
                
                // Ceiling (extended to match new room dimensions)
                const ceiling = new THREE.Mesh(
                    new THREE.PlaneGeometry(roomWidth, roomDepth),
                    djWallMaterial.clone()
                );
                ceiling.rotation.x = Math.PI / 2;
                ceiling.position.set(0, roomHeight, 0);
                ceiling.receiveShadow = true;
                scene.add(ceiling);
                
                break;

            case 'Producer':
                // Studio environment
                floor.material = new THREE.MeshStandardMaterial({ 
                    color: 0x444444,
                    roughness: 0.9
                });

                // Add acoustic panels on walls
                const wallGeometry = new THREE.BoxGeometry(0.5, 1, 1);
                const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x666666 });
                
                for (let i = -2; i <= 2; i++) {
                    // Back wall panels
                    const backPanel = new THREE.Mesh(wallGeometry, wallMaterial);
                    backPanel.position.set(i * 1.2, 1.5, -2);
                    backPanel.userData.type = 'environment';
                    scene.add(backPanel);

                    // Side wall panels
                    if (i > -2 && i < 2) {
                        const leftPanel = new THREE.Mesh(wallGeometry, wallMaterial);
                        leftPanel.rotation.y = Math.PI / 2;
                        leftPanel.position.set(-3, 1.5, i * 1.2);
                        leftPanel.userData.type = 'environment';
                        scene.add(leftPanel);

                        const rightPanel = new THREE.Mesh(wallGeometry, wallMaterial);
                        rightPanel.rotation.y = Math.PI / 2;
                        rightPanel.position.set(3, 1.5, i * 1.2);
                        rightPanel.userData.type = 'environment';
                        scene.add(rightPanel);
                    }
                }

                // Studio lighting
                const studioLight1 = new THREE.PointLight(0xffffff, 1);
                studioLight1.position.set(2, 3, 2);
                studioLight1.userData.type = 'environment';
                scene.add(studioLight1);

                const studioLight2 = new THREE.PointLight(0xffffff, 1);
                studioLight2.position.set(-2, 3, -2);
                studioLight2.userData.type = 'environment';
                scene.add(studioLight2);
                break;

            case 'Musician':
                // Recording studio environment
                floor.material = new THREE.MeshStandardMaterial({ 
                    color: 0x332211,  // Wooden floor color
                    roughness: 0.8
                });

                // Add recording booth glass
                const glassGeometry = new THREE.BoxGeometry(6, 3, 0.1);
                const glassMaterial = new THREE.MeshPhysicalMaterial({
                    color: 0xaaaaaa,
                    transparent: true,
                    opacity: 0.3,
                    roughness: 0.1,
                    metalness: 0.1,
                    transmission: 0.5
                });

                const glass = new THREE.Mesh(glassGeometry, glassMaterial);
                glass.position.set(0, 1.5, -2);
                glass.userData.type = 'environment';
                scene.add(glass);

                // Add warm studio lighting
                const warmLight = new THREE.PointLight(0xffaa66, 1);
                warmLight.position.set(0, 3, 0);
                warmLight.userData.type = 'environment';
                scene.add(warmLight);

                // Add accent lights
                const accent1 = new THREE.SpotLight(0xff9966, 0.8);
                accent1.position.set(-2, 2, -1);
                accent1.angle = Math.PI / 6;
                accent1.penumbra = 0.5;
                accent1.userData.type = 'environment';
                scene.add(accent1);

                const accent2 = new THREE.SpotLight(0xff9966, 0.8);
                accent2.position.set(2, 2, -1);
                accent2.angle = Math.PI / 6;
                accent2.penumbra = 0.5;
                accent2.userData.type = 'environment';
                scene.add(accent2);
                break;
            default:
                // Default environment
                floor.material = new THREE.MeshStandardMaterial({ 
                    color: 0x888888,
                    roughness: 0.8
                });
                break;
        }

        // Add common elements
        scene.add(floor);
        scene.add(tableGroup);

        // Add ambient light for all setups
        const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
        ambientLight.userData.type = 'environment';
        scene.add(ambientLight);
    }

    // Removed unused handleConnectionPointMapping function

    // Function to handle the actual click on the 3D model for mapping
    const handleModelClick = (event) => {
        if (!isConnectionMapping || !currentMappingDevice || !selectedConnectionType) return;

        event.preventDefault();

        const mouse = new THREE.Vector2();
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, cameraRef.current);

        // Get the current device's model
        const deviceModel = devicesRef.current[currentMappingDevice.id]?.model;
        if (!deviceModel) return;

        const intersects = raycaster.intersectObject(deviceModel, true);
        if (intersects.length > 0) {
            const point = intersects[0].point;
            // Convert world coordinates to local coordinates relative to the model
            const localPoint = deviceModel.worldToLocal(point.clone());
            
            // Update the connection point in Firebase
            updateConnectionPoint(
                currentMappingDevice.id,
                selectedConnectionMode,
                selectedConnectionType,
                localPoint
            );

            // Reset mapping state
            setIsConnectionMapping(false);
            setSelectedConnectionType(null);
            setSelectedConnectionMode(null);
            setCurrentMappingDevice(null);
        }
    };

    // Function to update connection point in Firebase. Use portIndex when known so we don't rely on type string match.
    const updateConnectionPoint = async (deviceId, mode, typeOrIndex, position, portIndex = undefined) => {
        try {
            const deviceRef = doc(db, "products", deviceId);
            const deviceDoc = await getDoc(deviceRef);

            if (!deviceDoc.exists()) return;

            const data = deviceDoc.data();
            const connections = [...(data[mode] || [])];
            const connectionIndex = typeof portIndex === 'number' && portIndex >= 0 && portIndex < connections.length
                ? portIndex
                : connections.findIndex(c => c.type === typeOrIndex);

            if (connectionIndex === -1) return;

            const point = { x: position.x, y: position.y, z: position.z };
            connections[connectionIndex] = {
                ...connections[connectionIndex],
                coordinate: point,
                position: point
            };

            await updateDoc(deviceRef, { [mode]: connections });
            console.log(`Updated ${mode} connection point at index ${connectionIndex}`);
        } catch (error) {
            console.error("Error updating connection point:", error);
            alert("Failed to update connection point.");
        }
    };

    const isDJM900Mixer = (device) => {
        if (!device?.name) return false;
        const n = device.name.toLowerCase();
        return n.includes('djm') || n.includes('900nxs2') || n.includes('900 nxs2') || n.includes('mixer');
    };

    // Add Send Out (output) and Return In (input) to mixer product if missing (for DJM900NXS2 etc.)
    const addMixerSendReturnPorts = async () => {
        if (!miniProfileDevice?.id || !db) return;
        if (!isDJM900Mixer(miniProfileDevice)) return;
        try {
            const deviceRef = doc(db, 'products', miniProfileDevice.id);
            const snap = await getDoc(deviceRef);
            if (!snap.exists()) {
                alert('Product not found in database.');
                return;
            }
            const data = snap.data();
            const existingInputs = data.inputs || [];
            const existingOutputs = data.outputs || [];
            const hasSendOut = existingOutputs.some(o => o.type && o.type.toLowerCase().includes('send'));
            const hasReturnIn = existingInputs.some(i => i.type && i.type.toLowerCase().includes('return'));
            if (hasSendOut && hasReturnIn) {
                alert('Mixer already has Send and Return ports.');
                return;
            }
            const newInputs = [...existingInputs];
            const newOutputs = [...existingOutputs];
            if (!hasSendOut) {
                newOutputs.push({ type: 'Send Out', coordinate: { x: 0.02, y: 0.075, z: -0.28 } });
            }
            if (!hasReturnIn) {
                newInputs.push({ type: 'Return In', coordinate: { x: 0.06, y: 0.075, z: -0.28 } });
            }
            await updateDoc(deviceRef, { inputs: newInputs, outputs: newOutputs });
            const fresh = (await getDoc(deviceRef)).data();
            const updated = { ...miniProfileDevice, inputs: fresh.inputs || newInputs, outputs: fresh.outputs || newOutputs };
            setMiniProfileDevice(updated);
            const list = placedDevicesListRef.current || [];
            placedDevicesListRef.current = list.map(d => d.uniqueId === miniProfileDevice.uniqueId ? updated : d);
            setPlacedDevicesList(placedDevicesListRef.current);
            if (sceneRef.current && placedDevicesListRef.current.length > 0) updateConnections(placedDevicesListRef.current);
            alert('Send Out and Return In ports added. Open "Edit connection positions" to see and adjust them.');
        } catch (err) {
            console.error('Error adding Send/Return ports:', err);
            alert('Failed to add ports: ' + (err.message || 'check console'));
        }
    };

    // Add click event listener for model mapping
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (isConnectionMapping) {
            window.addEventListener('click', handleModelClick);
            return () => window.removeEventListener('click', handleModelClick);
        }
    }, [isConnectionMapping, currentMappingDevice, selectedConnectionType]); // eslint-disable-line react-hooks/exhaustive-deps

    function createGhostPlacementSpots(scene, isBasicComplete = null) {
        if (!djTableRef.current) {
            console.log('Cannot create ghost spots: No DJ table reference');
                    return;
                }

        // Use the parameter if provided, otherwise fall back to the state
        const isBasicSetupCompleted = isBasicComplete !== null ? isBasicComplete : basicSetupComplete;
        
        console.log('Creating ghost spots with:', {
            setupType: currentSetupType,
            basicSetupComplete: isBasicSetupCompleted,
            stateBasicSetupComplete: basicSetupComplete
        });

        // Clear previous spots
        ghostSpotsRef.current.forEach(spot => {
            if (spot && spot.parent) {
                scene.remove(spot);
            }
        });
        ghostSpotsRef.current = [];

        // Get initial spots based on setup type
        let initialSpots = [];
        switch (currentSetupType) {
            case 'DJ':
                // Initially show only mixer and player positions
                initialSpots = [
                    djSetupSpots[0],  // Middle (Mixer)
                    djSetupSpots[1],  // Middle Left (Player)
                    djSetupSpots[2],  // Middle Right (Player)
                    djSetupSpots[3],  // Far Left (Player)
                    djSetupSpots[4],  // Far Right (Player)
                    djSetupSpots[12], // Left Speaker (on floor)
                    djSetupSpots[13], // Right Speaker (on floor)
                ];
                
                // Add additional spots if basic setup is complete
                if (isBasicSetupCompleted) {
                    console.log('Adding FX spots for completed DJ setup');
                    initialSpots = [
                        ...initialSpots,
                        djSetupSpots[8],   // FX Top
                        djSetupSpots[9],   // FX Left
                        djSetupSpots[10],  // FX Right
                        djSetupSpots[11],  // FX Front (Wide units)
                    ];
                }
                break;

            case 'Producer':
                // Show laptop and synth/FX positions
                initialSpots = [
                    { x: 0, y: 1.05, z: 0, type: 'interface' },          // Middle (Interface)
                    { x: -0.8, y: 1.05, z: 0, type: 'synth_left' },     // Left Synth
                    { x: 0.8, y: 1.05, z: 0, type: 'synth_right' },     // Right Synth
                    { x: -1.6, y: 1.05, z: 0, type: 'fx_left' },        // Left FX
                    { x: 1.6, y: 1.05, z: 0, type: 'fx_right' }         // Right FX
                ];
                break;

            case 'Musician':
                // Show just two basic spots initially
                initialSpots = [
                    // Main instrument position (center)
                    { 
                        x: 0, 
                        y: 1.05, 
                        z: 0, 
                        type: 'main_instrument',
                        size: { width: 0.4, depth: 0.4 }  // Larger spot for main instrument
                    },
                    // Effects position (in front)
                    { 
                        x: 0, 
                        y: 0.05,  // Lower position for floor effects
                        z: 0.5,   // In front of the main instrument
                        type: 'effects',
                        size: { width: 0.8, depth: 0.3 }  // Wide but shallow for pedals
                    }
                ];
                break;
            default:
                // Default spots
                initialSpots = [
                    { x: 0, y: 1.05, z: 0, type: 'default' }
                ];
                break;
        }

        console.log(`Creating ${initialSpots.length} ghost spots, including FX: ${isBasicSetupCompleted}`);

        // Create ghost squares for the selected spots
        initialSpots.forEach((position, index) => {
            const isFXSpot = position.type?.includes('fx_') || position.type === 'effects';
            const customSize = position.size || null;
            
            // Determine geometry size based on spot type and custom size
            const geometry = new THREE.BoxGeometry(
                customSize ? customSize.width : (isFXSpot ? 0.15 : 0.3),
                0.05,
                customSize ? customSize.depth : (isFXSpot ? 0.15 : 0.3)
            );
            
            const material = new THREE.MeshBasicMaterial({ 
                color: 0x808080,
                transparent: true, 
                opacity: 0.4 
            });

            const ghostSquare = new THREE.Mesh(geometry, material);
            ghostSquare.position.set(position.x, position.y, position.z);
            ghostSquare.userData = { 
                index,
                defaultColor: 0x808080,
                hoverColor: 0xa0a0a0,
                type: position.type,
                recommendedType: getRecommendedProductType(position.type)
            };

            scene.add(ghostSquare);
            ghostSpotsRef.current.push(ghostSquare);
            console.log(`Created ghost square ${index} at position:`, position);
        });

        // Force a re-render after creating ghost spots
        if (rendererRef.current && cameraRef.current) {
            rendererRef.current.render(scene, cameraRef.current);
        }
    }

    function setupRaycasting() {
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();
        let hoveredSquare = null;

        function handlePointerEvent(event) {
            if (!rendererRef.current?.domElement) return;
            if (event.touches && event.touches.length >= 2) return;

            const rect = rendererRef.current.domElement.getBoundingClientRect();
            const clientX = event.touches ? event.touches[0].clientX : event.clientX;
            const clientY = event.touches ? event.touches[0].clientY : event.clientY;
            mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
            raycaster.setFromCamera(mouse, cameraRef.current);

            // When not mapping connections, check for click on a placed device first (open product profile)
            if (!isConnectionMapping) {
                const deviceMeshes = Object.values(devicesRef.current).map(r => r.model).filter(Boolean);
                if (deviceMeshes.length > 0) {
                    const deviceHits = raycaster.intersectObjects(deviceMeshes, true);
                    if (deviceHits.length > 0) {
                        let obj = deviceHits[0].object;
                        while (obj && !obj.userData?.uniqueId) obj = obj.parent;
                        const uniqueId = obj?.userData?.uniqueId;
                        if (uniqueId) {
                            const ref = devicesRef.current[uniqueId];
                            if (ref?.data && (event.type === 'click' || (event.type === 'touchend' && !isPinchingRef.current))) {
                                setShowSearch(false);
                                setSearchMode('');
                                setMiniProfileDevice(ref.data);
                                setShowMiniProfile(true);
                                setEditConnectionsMode(false);
                                return;
                            }
                        }
                    }
                }
            }

            const intersects = raycaster.intersectObjects(ghostSpotsRef.current);

            if (hoveredSquare) {
                hoveredSquare.material.color.setHex(hoveredSquare.userData.defaultColor);
                hoveredSquare.material.opacity = 0.4;
            }

            if (intersects.length > 0) {
                hoveredSquare = intersects[0].object;
                hoveredSquare.material.color.setHex(hoveredSquare.userData.hoverColor);
                hoveredSquare.material.opacity = 0.6;

                if (event.type === 'click' || (event.type === 'touchend' && !isPinchingRef.current)) {
                    const clickedIndex = intersects[0].object.userData.index;
                    handleGhostSquareClick(clickedIndex);
                }
            } else {
                hoveredSquare = null;
            }
        }

        const element = rendererRef.current?.domElement;
        if (element) {
            // Add touch event listeners
            element.addEventListener('touchstart', handlePointerEvent, { passive: false });
            element.addEventListener('touchmove', handlePointerEvent, { passive: false });
            element.addEventListener('touchend', handlePointerEvent, { passive: false });
            
            // Keep mouse events for non-touch devices
            element.addEventListener('mousemove', handlePointerEvent);
            element.addEventListener('click', handlePointerEvent);
        }

        return () => {
            if (element) {
                element.removeEventListener('touchstart', handlePointerEvent);
                element.removeEventListener('touchmove', handlePointerEvent);
                element.removeEventListener('touchend', handlePointerEvent);
                element.removeEventListener('mousemove', handlePointerEvent);
                element.removeEventListener('click', handlePointerEvent);
            }
        };
    }

    // Add useEffect for mobile detection
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth <= 768);
        };
        
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Update the removeDevice function to handle position-specific removal
    const removeDevice = (uniqueId) => {
        const device = placedDevicesList.find(d => d.uniqueId === uniqueId);
        if (device) {
            // Find the specific device reference using uniqueId
            const deviceRef = Object.values(devicesRef.current).find(ref => 
                ref.data?.uniqueId === uniqueId
            );

            if (deviceRef?.model) {
                sceneRef.current.remove(deviceRef.model);
                // Remove the specific device reference
                delete devicesRef.current[device.id];
            }
            
            // Remove any cables connected to this device's position
            cablesRef.current = cablesRef.current.filter(cable => {
                if (cable.userData.sourceDevice === device.id || cable.userData.targetDevice === device.id) {
                    sceneRef.current.remove(cable);
        return false;
    }
                return true;
            });
            
            // Update the placed devices list using the unique identifier
            // This will trigger the useEffect that calls updateConnections
            updatePlacedDevicesList(device, 'remove');

            // Force a re-render of the scene
            if (rendererRef.current && sceneRef.current && cameraRef.current) {
                rendererRef.current.render(sceneRef.current, cameraRef.current);
            }
        }
    };

    // Update currentSetupType when setupType prop changes
    useEffect(() => {
        setCurrentSetupType(setupType || 'DJ');
    }, [setupType]);

    // Add function to determine recommended product types based on setup and position
    const getRecommendedProductType = (spotType) => {
        switch (currentSetupType) {
            case 'DJ':
                switch (spotType) {
                    case SPOT_TYPES.MIDDLE: return 'Mixer (DJM)';
                    case SPOT_TYPES.MIDDLE_LEFT:
                    case SPOT_TYPES.MIDDLE_RIGHT:
                    case SPOT_TYPES.FAR_LEFT:
                    case SPOT_TYPES.FAR_RIGHT: return 'Player (CDJ)';
                    case SPOT_TYPES.FX_TOP:
                    case SPOT_TYPES.FX_LEFT:
                    case SPOT_TYPES.FX_RIGHT: return 'RMX-1000';
                    case SPOT_TYPES.SPEAKER_LEFT:
                    case SPOT_TYPES.SPEAKER_RIGHT: return 'Speaker';
                    default: return 'Any Device';
                }
            case 'Producer':
                switch (spotType) {
                    case SPOT_TYPES.MIDDLE: return 'Audio Interface';
                    case SPOT_TYPES.MIDDLE_LEFT:
                    case SPOT_TYPES.MIDDLE_RIGHT: return 'Synthesizer';
                    case SPOT_TYPES.FAR_LEFT:
                    case SPOT_TYPES.FAR_RIGHT: return 'Effects Unit';
                    default: return 'Any Device';
                }
            case 'Musician':
                return 'Instrument or Effects';
            default:
                return 'Any Device';
        }
    };

    const COORD_STEP = 0.01;
    const getCoord = (c) => ({ x: Number(c?.x) || 0, y: Number(c?.y) || 0, z: Number(c?.z) || 0 });

    const updateConnectionCoordinate = (portKind, portIndex, axis, newValue) => {
        if (!miniProfileDevice) return;
        const ports = [...(miniProfileDevice[portKind] || [])];
        if (portIndex < 0 || portIndex >= ports.length) return;
        const port = { ...ports[portIndex], coordinate: { ...getCoord(ports[portIndex].coordinate) } };
        port.coordinate[axis] = Math.round(Number(newValue) * 1000) / 1000;
        ports[portIndex] = port;
        const updatedDevice = { ...miniProfileDevice, [portKind]: ports };
        const currentList = placedDevicesListRef.current || [];
        const newList = currentList.map(d => d.uniqueId === miniProfileDevice.uniqueId ? updatedDevice : d);
        placedDevicesListRef.current = newList;
        setPlacedDevicesList(newList);
        setMiniProfileDevice(updatedDevice);
        if (sceneRef.current && newList.length > 0) {
            updateConnections(newList);
        }
        if (rendererRef.current && sceneRef.current && cameraRef.current) {
            rendererRef.current.render(sceneRef.current, cameraRef.current);
        }
    };

    // Update updatePlacedDevicesList to check for basic setup completion
    const updatePlacedDevicesList = (device, action = 'add') => {
        if (action === 'add') {
            const deviceWithPosition = {
                ...device,
                uniqueId: `${device.id}-${device.position.x}-${device.position.y}-${device.position.z}`
            };
            
            setPlacedDevicesList(prev => {
                const newList = [...prev, deviceWithPosition];
                // Check if basic setup is complete after adding device
                const isComplete = checkBasicSetupComplete(newList);
                console.log('After adding device:', {
                    deviceName: device.name,
                    isBasicSetupComplete: isComplete,
                    currentDevices: newList.map(d => d.name)
                });
                
                if (isComplete !== basicSetupComplete) {
                    console.log(`Basic setup status changed to: ${isComplete}`);
                    
                    // Update the state
                    setBasicSetupComplete(isComplete);
                    
                    // Force a refresh of ghost spots with the new status
        setTimeout(() => {
                        if (sceneRef.current) {
                            // Clear existing ghost spots
                            ghostSpotsRef.current.forEach(spot => {
                                if (spot && spot.parent) {
                                    sceneRef.current.remove(spot);
                                }
                            });
                            ghostSpotsRef.current = [];
                            
                            // Recreate ghost spots with the new setup status
                            console.log('Recreating ghost spots with updated basic setup status:', isComplete);
                            createGhostPlacementSpots(sceneRef.current, isComplete);
                            
                            // Force a re-render
                            if (rendererRef.current && cameraRef.current) {
            rendererRef.current.render(sceneRef.current, cameraRef.current);
                            }
                        }
                    }, 0);
                }
                
                return newList;
            });
        } else {
            setPlacedDevicesList(prev => {
                const newList = prev.filter(d => d.uniqueId !== device.uniqueId);
                // Check if basic setup is still complete after removing device
                const isComplete = checkBasicSetupComplete(newList);
                console.log('After removing device:', {
                    deviceName: device.name,
                    isBasicSetupComplete: isComplete,
                    currentDevices: newList.map(d => d.name)
                });
                
                if (isComplete !== basicSetupComplete) {
                    console.log(`Basic setup status changed to: ${isComplete}`);
                    
                    // Update the state
                    setBasicSetupComplete(isComplete);
                    
                    // Force a refresh of ghost spots with the new status
                    setTimeout(() => {
                        if (sceneRef.current) {
                            // Clear existing ghost spots
                            ghostSpotsRef.current.forEach(spot => {
                                if (spot && spot.parent) {
                                    sceneRef.current.remove(spot);
                                }
                            });
                            ghostSpotsRef.current = [];
                            
                            // Recreate ghost spots with the new setup status
                            console.log('Recreating ghost spots with updated basic setup status:', isComplete);
                            createGhostPlacementSpots(sceneRef.current, isComplete);
                            
                            // Force a re-render
                            if (rendererRef.current && cameraRef.current) {
                                rendererRef.current.render(sceneRef.current, cameraRef.current);
                            }
                        }
                    }, 0);
                }
                
                return newList;
            });
        }
    };

    // Add this new function after your other functions
    const moveCameraToPosition = (positionName) => {
        const position = CAMERA_POSITIONS[positionName];
        if (!position) return;
        setCameraView(positionName);

        gsap.to(cameraRef.current.position, {
            x: position.position.x,
            y: position.position.y,
            z: position.position.z,
            duration: 1.5,
            ease: "power2.inOut",
            onUpdate: () => {
                cameraRef.current.lookAt(position.target.x, position.target.y, position.target.z);
            }
        });

        gsap.to(controlsRef.current.target, {
            x: position.target.x,
            y: position.target.y,
            z: position.target.z,
            duration: 1.5,
            ease: "power2.inOut",
            onUpdate: () => {
                controlsRef.current.update();
            }
        });
    };

    // Zoom camera in close to a placed device (for product profile)
    const moveCameraToDevice = (device) => {
        if (!cameraRef.current || !controlsRef.current || !device?.position) return;
        const p = device.position;
        const tx = typeof p.x === 'number' ? p.x : 0;
        const ty = typeof p.y === 'number' ? p.y : 1;
        const tz = typeof p.z === 'number' ? p.z : 0;
        const dist = 0.8;
        const camX = tx;
        const camY = ty + 0.15;
        const camZ = tz + dist;
        gsap.to(cameraRef.current.position, {
            x: camX, y: camY, z: camZ,
            duration: 1,
            ease: 'power2.inOut',
            onUpdate: () => {
                cameraRef.current.lookAt(tx, ty, tz);
            }
        });
        gsap.to(controlsRef.current.target, {
            x: tx, y: ty, z: tz,
            duration: 1,
            ease: 'power2.inOut',
            onUpdate: () => { controlsRef.current.update(); }
        });
    };

    // Add this useEffect after your other effects
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (sceneRef.current && sceneInitialized) {
            console.log('Setup type changed to:', currentSetupType);
            createClubEnvironment(sceneRef.current);
            
            // Force a re-render
            if (rendererRef.current && cameraRef.current) {
                rendererRef.current.render(sceneRef.current, cameraRef.current);
            }
        }
    }, [currentSetupType, sceneInitialized]); // eslint-disable-line react-hooks/exhaustive-deps

    // Removed unused handleGhostHover function

    // Add this useEffect after the initialization to check for basic setup
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (sceneInitialized && placedDevicesList.length > 0) {
            console.log('Checking initial placed devices for basic setup:', 
                placedDevicesList.map(d => d.name));
            
            // Check if the basic setup is already complete with initial devices
            const isComplete = checkBasicSetupComplete(placedDevicesList);
            
            console.log('Initial basic setup check:', { 
                isComplete, 
                currentState: basicSetupComplete 
            });
            
            if (isComplete !== basicSetupComplete) {
                console.log('Updating basic setup state on initialization');
                setBasicSetupComplete(isComplete);
                
                // Force an update of ghost spots
                setTimeout(() => {
                    if (sceneRef.current) {
                        // Recreate ghost spots with the correct status
                        createGhostPlacementSpots(sceneRef.current, isComplete);
                        
                        // Force a re-render
                        if (rendererRef.current && cameraRef.current) {
                            rendererRef.current.render(sceneRef.current, cameraRef.current);
                        }
                    }
                }, 100);
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sceneInitialized, placedDevicesList.length]);

    // Add this function
    const handleUpdateModelPaths = async () => {
        setIsUpdatingPaths(true);
        try {
            const result = await updateAllModelPaths();
            if (result.success) {
                alert(`Successfully updated ${result.updatedCount} model paths. Please refresh the page.`);
                // Refresh the products list
                fetchProductsFromFirestore();
            } else {
                alert('Failed to update model paths. Please check the console for details.');
            }
        } catch (error) {
            console.error('Error updating model paths:', error);
            alert('An error occurred while updating model paths.');
        } finally {
            setIsUpdatingPaths(false);
        }
    };

    // Add this function after your other functions
    const handleSuggestNewProduct = () => {
        setShowSuggestionForm(true);
    };

    useEffect(() => {
      // Prevent API calls if we have a quota error
      if (hasQuotaError) {
        return;
      }

      // Debounce API calls - only call if it's been at least 5 seconds since last call
      const now = Date.now();
      if (now - lastApiCall < 5000) {
        return;
      }

      if (placedDevicesList && placedDevicesList.length >= 3) {
        setIsAdviceLoading(true);
        setLastApiCall(now);
        
        getConnectionSuggestions(placedDevicesList)
          .then(setConnectionAdvice)
          .catch((error) => {
            console.error('ChatGPT API error:', error);
            if (error.message.includes('quota') || error.message.includes('429')) {
              setHasQuotaError(true);
              setConnectionAdvice('API quota exceeded. Please try again later or upgrade your OpenAI plan.');
            } else {
              setConnectionAdvice('Could not get connection advice. Please try again.');
            }
          })
          .finally(() => setIsAdviceLoading(false));
      } else {
        setConnectionAdvice('');
      }
    }, [placedDevicesList, hasQuotaError, lastApiCall]);

    // Handle category toggle for device visibility
    const handleCategoryToggle = (categoryId, isVisible) => {
        console.log(`Toggling category ${categoryId} visibility: ${isVisible}`);
        setHiddenCategories(prev => {
            const newHidden = new Set(prev);
            if (isVisible) {
                newHidden.delete(categoryId);
            } else {
                newHidden.add(categoryId);
            }
            console.log('New hidden categories:', Array.from(newHidden));
            return newHidden;
        });
    };

    // Expose the toggle function to parent (only once)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (onCategoryToggle) {
            onCategoryToggle(handleCategoryToggle);
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (showMiniProfile && miniProfileDevice?.uniqueId) {
            const updated = placedDevicesList.find(d => d.uniqueId === miniProfileDevice.uniqueId);
            if (updated) setMiniProfileDevice(updated);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only update when list changes, not when panel/device changes
    }, [placedDevicesList]);

    useEffect(() => {
        if (showMiniProfile && miniProfileDevice && cameraRef.current && controlsRef.current) {
            moveCameraToDevice(miniProfileDevice);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only run when panel opens, zoom to device
    }, [showMiniProfile]);

    // Update device visibility when hidden categories change
    useEffect(() => {
        if (sceneRef.current && placedDevicesList.length > 0) {
            console.log('Processing devices for visibility:', placedDevicesList.map(d => d.name));
            console.log('Hidden categories:', Array.from(hiddenCategories));
            
            placedDevicesList.forEach(device => {
                // Get the device object from devicesRef instead of scene
                const deviceRef = devicesRef.current[device.uniqueId];
                if (deviceRef && deviceRef.model) {
                    // Determine if this device should be hidden based on its category
                    const deviceCategory = getDeviceCategory(device);
                    const shouldHide = hiddenCategories.has(deviceCategory);
                    console.log(`Device: ${device.name} -> Category: ${deviceCategory} -> Should hide: ${shouldHide}`);
                    deviceRef.model.visible = !shouldHide;
                } else {
                    console.log(`Device object not found for: ${device.name} (${device.uniqueId})`);
                }
            });
            
            // Force a re-render
            if (rendererRef.current && cameraRef.current) {
                rendererRef.current.render(sceneRef.current, cameraRef.current);
            }
        }
    }, [hiddenCategories, placedDevicesList]);

    // Helper function to determine device category
    const getDeviceCategory = (device) => {
        const name = device.name.toLowerCase();
        console.log(`Categorizing device: "${device.name}" -> "${name}"`);
        
        if (name.includes('cdj') || name.includes('turntable') || name.includes('controller')) {
            console.log(`  -> Matched players category`);
            return 'players';
        } else if (name.includes('djm') || name.includes('mixer')) {
            console.log(`  -> Matched mixers category`);
            return 'mixers';
        } else if (name.includes('rmx') || name.includes('effect')) {
            console.log(`  -> Matched effects category`);
            return 'effects';
        } else if (name.includes('speaker') || name.includes('monitor')) {
            console.log(`  -> Matched speakers category`);
            return 'speakers';
        } else if (name.includes('cable') || name.includes('rca') || name.includes('xlr')) {
            console.log(`  -> Matched cables category`);
            return 'cables';
        } else if (name.includes('headphone') || name.includes('case')) {
            console.log(`  -> Matched accessories category`);
            return 'accessories';
        }
        console.log(`  -> Default to players category`);
        return 'players'; // default category
    };

    return (
        <>
            <div ref={mountRef} style={{ 
                width: "100%", 
                height: isMobile ? "calc(100vh - 60px)" : "100%",
                touchAction: "none",
                backgroundColor: "#0a0a0a"
            }}>
                {error && (
                    <div className="error-message fade-in" style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        backgroundColor: 'rgba(255, 82, 82, 0.9)',
                        padding: '20px',
                        borderRadius: '8px',
                        textAlign: 'center',
                        color: '#ffffff',
                        backdropFilter: 'blur(8px)'
                    }}>
                        <h3 style={{ marginBottom: '12px' }}>Error</h3>
                        <p style={{ marginBottom: '16px' }}>{error}</p>
                        <button onClick={() => window.location.reload()}
                            style={{
                                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                                border: 'none',
                                padding: '8px 16px',
                                borderRadius: '4px',
                                color: '#ffffff',
                                cursor: 'pointer'
                            }}>
                            Retry
                        </button>
                    </div>
                )}

                {/* Product profile: right-side panel with product info, purchase link, and Edit connections at bottom */}
                {showMiniProfile && miniProfileDevice && (
                    <div className="mini-profile-panel" style={{
                        position: 'fixed',
                        top: 0,
                        right: 0,
                        bottom: 0,
                        width: isMobile ? '100%' : '320px',
                        maxWidth: '100%',
                        zIndex: 900,
                        background: 'linear-gradient(180deg, #1a1a1e 0%, #121218 100%)',
                        boxShadow: '-4px 0 24px rgba(0,0,0,0.4), inset 1px 0 0 rgba(255,255,255,0.06)',
                        borderLeft: '1px solid rgba(255,255,255,0.1)',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden'
                    }}>
                        <div style={{ padding: '20px 20px 16px', flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h3 style={{ margin: 0, color: '#fff', fontSize: '18px' }}>{miniProfileDevice.name}</h3>
                                <button type="button" aria-label="Close" style={{
                                    background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', fontSize: '24px', cursor: 'pointer', padding: '0 4px', lineHeight: 1
                                }} onClick={() => { setShowMiniProfile(false); setEditConnectionsMode(false); setMiniProfileDevice(null); }}>×</button>
                            </div>
                        </div>
                        <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {/* Product info: cost and link to purchase */}
                            <div style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.06)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
                                <div style={{ marginBottom: '10px' }}>
                                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Cost</span>
                                    <div style={{ color: '#fff', fontSize: '16px', fontWeight: 600 }}>
                                        {typeof miniProfileDevice.price === 'number' && miniProfileDevice.price > 0
                                            ? `$${Number(miniProfileDevice.price).toLocaleString()}`
                                            : '—'}
                                    </div>
                                </div>
                                <div>
                                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Purchase</span>
                                    <div style={{ marginTop: '4px' }}>
                                        <button type="button" style={{ color: '#00a2ff', fontSize: '14px', textDecoration: 'none', background: 'none', border: 'none', padding: 0, cursor: 'default', font: 'inherit' }}>
                                            Link to purchase (coming soon)
                                        </button>
                                    </div>
                                </div>
                            </div>
                            {!editConnectionsMode ? (
                                <>
                                    {isDJM900Mixer(miniProfileDevice) && (() => {
                                        const outs = miniProfileDevice.outputs || [];
                                        const ins = miniProfileDevice.inputs || [];
                                        const missing = !outs.some(o => o.type && o.type.toLowerCase().includes('send')) || !ins.some(i => i.type && i.type.toLowerCase().includes('return'));
                                        return missing ? (
                                            <div style={{ marginBottom: '4px' }}>
                                                <button type="button" style={{
                                                    width: '100%', padding: '12px 16px', fontSize: '14px', fontWeight: 600, color: '#2ecc71',
                                                    background: 'rgba(46, 204, 113, 0.2)', border: '1px solid rgba(46, 204, 113, 0.5)', borderRadius: '10px',
                                                    cursor: 'pointer', fontFamily: 'inherit'
                                                }} onClick={addMixerSendReturnPorts}>
                                                    Add Send &amp; Return ports to mixer
                                                </button>
                                                <p style={{ margin: '8px 0 0', color: 'rgba(255,255,255,0.5)', fontSize: '12px' }}>Adds &quot;Send Out&quot; (output) and &quot;Return In&quot; (input) for FX/Revolo cables. Then use Edit connection positions below to place them.</p>
                                            </div>
                                        ) : null;
                                    })()}
                                    <p style={{ margin: '0 0 8px', color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>Adjust where cables attach to this device (X, Y, Z). Changes appear in the scene.</p>
                                    <button type="button" className="edit-connections-btn" style={{
                                        width: '100%', padding: '12px 16px', fontSize: '14px', fontWeight: 600, color: '#00a2ff',
                                        background: 'rgba(0, 162, 255, 0.15)', border: '1px solid rgba(0, 162, 255, 0.4)', borderRadius: '10px',
                                        cursor: 'pointer', fontFamily: 'inherit', marginTop: 'auto'
                                    }} onClick={() => setEditConnectionsMode(true)}>
                                        Edit connection positions
                                    </button>
                                </>
                            ) : (
                                <>
                                    <p style={{ margin: '0 0 12px', color: 'rgba(255,255,255,0.7)', fontSize: '13px' }}>Nudge X, Y, Z so cable endpoints match the 3D model. Watch the scene update.</p>
                                    {(() => {
                                        const mixerMissingSendReturn = isDJM900Mixer(miniProfileDevice) && (
                                            !(miniProfileDevice.outputs || []).some(o => o.type && o.type.toLowerCase().includes('send')) ||
                                            !(miniProfileDevice.inputs || []).some(i => i.type && i.type.toLowerCase().includes('return'))
                                        );
                                        return mixerMissingSendReturn ? (
                                            <div style={{ marginBottom: '16px' }}>
                                                <button type="button" style={{
                                                    width: '100%', padding: '10px 16px', fontSize: '13px', fontWeight: 600, color: '#2ecc71',
                                                    background: 'rgba(46, 204, 113, 0.15)', border: '1px solid rgba(46, 204, 113, 0.4)', borderRadius: '8px',
                                                    cursor: 'pointer', fontFamily: 'inherit'
                                                }} onClick={addMixerSendReturnPorts}>
                                                    Add Send &amp; Return ports
                                                </button>
                                                <p style={{ margin: '8px 0 0', color: 'rgba(255,255,255,0.5)', fontSize: '12px' }}>Adds &quot;Send Out&quot; (output) and &quot;Return In&quot; (input) for FX/Revolo cables.</p>
                                            </div>
                                        ) : null;
                                    })()}
                                    {(['inputs', 'outputs']).map(portKind => {
                                        const ports = miniProfileDevice[portKind] || [];
                                        const label = portKind === 'inputs' ? 'Inputs' : 'Outputs';
                                        const isMixer = (miniProfileDevice.name || '').toLowerCase().includes('djm') || (miniProfileDevice.name || '').toLowerCase().includes('mixer');
                                        const getDisplayLabel = (p, idx) => {
                                            if (isMixer && portKind === 'inputs') {
                                                const t = (p.type || '').toLowerCase();
                                                if (t.includes('return')) return 'Return';
                                                if (t.match(/^line\s*(\d)$/)) {
                                                    const num = t.replace(/\D/g, '');
                                                    if (num === '6') return 'Return';
                                                    return `Line ${num}`;
                                                }
                                                if (t.includes('1/4') || t === 'rca' || (t && !t.match(/^line\s*\d$/) && !t.match(/^ch\s*\d$/))) {
                                                    if (idx + 1 === 6) return 'Return';
                                                    return `Line ${idx + 1}`;
                                                }
                                            }
                                            return p.type || `${label.slice(0, -1)} ${idx + 1}`;
                                        };
                                        if (ports.length === 0) return null;
                                        return (
                                            <div key={portKind} style={{ marginBottom: '20px' }}>
                                                <h4 style={{ margin: '0 0 8px', color: 'rgba(255,255,255,0.9)', fontSize: '14px' }}>{label}</h4>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                    {ports.map((port, i) => {
                                                        const coord = getCoord(port.coordinate);
                                                        const axisStyle = { display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' };
                                                        const btnStyle = { width: '28px', height: '28px', padding: 0, border: '1px solid rgba(255,255,255,0.25)', borderRadius: '4px', background: 'rgba(255,255,255,0.1)', color: '#fff', cursor: 'pointer', fontSize: '14px', fontFamily: 'inherit' };
                                                        const numStyle = { width: '76px', padding: '6px 8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', color: '#fff', fontSize: '13px', textAlign: 'center' };
                                                        const displayLabel = getDisplayLabel(port, i);
                                                        return (
                                                            <div key={i} style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.06)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
                                                                <div style={{ color: '#fff', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>{displayLabel}</div>
                                                                {['x', 'y', 'z'].map(axis => (
                                                                    <div key={axis} style={axisStyle}>
                                                                        <span style={{ width: '14px', color: 'rgba(255,255,255,0.7)', fontSize: '12px', textTransform: 'uppercase' }}>{axis}</span>
                                                                        <button type="button" aria-label={`${axis} minus`} style={btnStyle} onClick={() => updateConnectionCoordinate(portKind, i, axis, coord[axis] - COORD_STEP)}>−</button>
                                                                        <input type="number" step={COORD_STEP} value={coord[axis]} style={numStyle} onChange={e => updateConnectionCoordinate(portKind, i, axis, e.target.value)} />
                                                                        <button type="button" aria-label={`${axis} plus`} style={btnStyle} onClick={() => updateConnectionCoordinate(portKind, i, axis, coord[axis] + COORD_STEP)}>+</button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    <button type="button" style={{
                                        marginTop: '16px', width: '100%', padding: '10px', fontSize: '13px', color: 'rgba(255,255,255,0.8)',
                                        background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit'
                                    }} onClick={async () => {
                                        let saved = false;
                                        if (miniProfileDevice?.id) {
                                            const pos = (c) => ({ x: Number(c?.x) || 0, y: Number(c?.y) || 0, z: Number(c?.z) || 0 });
                                            const inputs = miniProfileDevice.inputs || [];
                                            for (let i = 0; i < inputs.length; i++) {
                                                const port = inputs[i];
                                                if (port?.coordinate) {
                                                    await updateConnectionPoint(miniProfileDevice.id, 'inputs', port.type, pos(port.coordinate), i);
                                                    saved = true;
                                                }
                                            }
                                            const outputs = miniProfileDevice.outputs || [];
                                            for (let i = 0; i < outputs.length; i++) {
                                                const port = outputs[i];
                                                if (port?.coordinate) {
                                                    await updateConnectionPoint(miniProfileDevice.id, 'outputs', port.type, pos(port.coordinate), i);
                                                    saved = true;
                                                }
                                            }
                                        }
                                        setEditConnectionsMode(false);
                                        if (saved) alert('Connection positions saved to product.');
                                    }}>Done</button>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* Mobile Navigation */}
                {isMobile && (
                    <MobileNavigation 
                        onSetView={() => moveCameraToPosition('set')}
                        onConnectionsView={() => moveCameraToPosition('connections')}
                        onOpenSearch={openHamburgerSearch}
                        placedDevicesList={placedDevicesList}
                        onRemoveDevice={removeDevice}
                        isUpdatingPaths={isUpdatingPaths}
                        onUpdateModelPaths={handleUpdateModelPaths}
                        style={{
                            position: 'fixed',
                            top: '20px',
                            right: '20px',
                            zIndex: 2000
                        }}
                    />
                )}

                {/* Setup List Box - Bottom right, only on desktop */}
                {!isMobile && (
                    <div className={`setup-list-box ${isSetupListExpanded ? 'expanded' : ''}`}
                        style={{
                            position: 'fixed',
                            right: 'max(24px, env(safe-area-inset-right))',
                            bottom: 'max(100px, env(safe-area-inset-bottom))',
                            maxHeight: isSetupListExpanded ? '70vh' : '48px',
                            overflow: 'hidden',
                            transition: 'max-height 0.3s ease'
                        }}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            cursor: 'pointer',
                            marginBottom: isSetupListExpanded ? '12px' : '0'
                        }}
                        onClick={() => setIsSetupListExpanded(!isSetupListExpanded)}>
                            <h3>Current Setup</h3>
                            <span style={{
                                transform: isSetupListExpanded ? 'rotate(180deg)' : 'rotate(0)',
                                transition: 'transform 0.3s ease'
                            }}>▲</span>
                        </div>
                        {isSetupListExpanded && (
                            <div className="setup-list-box-inner" style={{
                                overflowY: 'auto',
                                maxHeight: 'calc(70vh - 80px)',
                                paddingRight: '4px'
                            }}>
                                <div className="fade-in">
                                    {placedDevicesList.map((device) => (
                                        <div key={device.uniqueId} className="setup-list-item">
                                            <span>{device.name}</span>
                                            <button onClick={() => removeDevice(device.uniqueId)}>Remove</button>
                                        </div>
                                    ))}
                                    {placedDevicesList.length === 0 && (
                                        <div style={{
                                            textAlign: 'center',
                                            opacity: 0.7,
                                            padding: '12px 0'
                                        }}>
                                            No devices added yet
                                        </div>
                                    )}
                                </div>
                                <div style={{ marginTop: '16px' }}>
                                    <h4 style={{ color: '#89CFF0', marginBottom: '8px' }}>Connection Guide</h4>
                                    {placedDevicesList.length < 3 ? (
                                        <div style={{ color: '#aaa', fontStyle: 'italic' }}>
                                            Add at least 3 devices to get connection advice
                                        </div>
                                    ) : hasQuotaError ? (
                                        <div>
                                            <div style={{ color: '#ff6b6b', marginBottom: '8px' }}>
                                                {connectionAdvice}
                                            </div>
                                            <button
                                                onClick={() => setHasQuotaError(false)}
                                                style={{
                                                    background: 'rgba(0, 162, 255, 0.2)',
                                                    border: '1px solid rgba(0, 162, 255, 0.3)',
                                                    color: '#00a2ff',
                                                    padding: '4px 8px',
                                                    fontSize: '12px',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                Try Again
                                            </button>
                                        </div>
                                    ) : isAdviceLoading ? (
                                        <div style={{ color: '#aaa', fontStyle: 'italic' }}>Loading connection advice...</div>
                                    ) : (
                                        <div style={{ color: '#fff', whiteSpace: 'pre-wrap' }}>{connectionAdvice}</div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Camera Controls - Set / Connections - Only show on desktop */}
                {!isMobile && (
                    <div className="camera-controls fade-in" style={{
                        position: 'fixed',
                        left: '20px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                        zIndex: 1000
                    }}>
                        <button
                            type="button"
                            className={`camera-button ${cameraView === 'set' ? 'camera-button-active' : ''}`}
                            onClick={() => moveCameraToPosition('set')}
                        >
                            Set
                        </button>
                        <button
                            type="button"
                            className={`camera-button ${cameraView === 'connections' ? 'camera-button-active' : ''}`}
                            onClick={() => moveCameraToPosition('connections')}
                        >
                            Connections
                        </button>
                    </div>
                )}

                {/* Search Modal - Updated with recommended highlighting */}
            {showSearch && (
                    <div className="search-modal fade-in" style={searchModalStyle}>
                        <style>
                            {`
                                .search-modal::-webkit-scrollbar {
                                    width: 8px;
                                    background-color: #000000;
                                }
                                .search-modal::-webkit-scrollbar-thumb {
                                    background-color: #333333;
                                    border-radius: 4px;
                                }
                                .search-modal::-webkit-scrollbar-track {
                                    background-color: #000000;
                                }
                            `}
                        </style>
                        <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center', 
                            marginBottom: '20px'
                        }}>
                            <h3 style={{ 
                                margin: 0, 
                                color: '#ffffff',
                                fontSize: '16px',
                                fontFamily: 'Space Grotesk, sans-serif'
                            }}>
                                {searchMode === 'ghost' ? 'Add Device' : 'Search Products'}
                            </h3>
                            <button 
                                onClick={() => {
                                    setShowSearch(false);
                                    setSearchMode('');
                                    setSearchQuery('');
                                }}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    fontSize: '24px',
                                    cursor: 'pointer',
                                    color: '#ffffff',
                                    opacity: 0.7,
                                    transition: 'opacity 0.2s ease'
                                }}
                            >
                                ×
                            </button>
                        </div>
                        
                    <input
                        type="text"
                        placeholder="Search for a product..."
                        value={searchQuery}
                            onChange={handleSearchInputChange}
                            className="fade-in"
                            style={{
                                width: '100%',
                                padding: '12px',
                                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                border: '1px solid rgba(255, 255, 255, 0.2)',
                                borderRadius: '4px',
                                color: '#ffffff',
                                marginBottom: '20px',
                                outline: 'none'
                            }}
                        />

                        {!showSuggestionForm ? (
                            <>
                                <button
                                    onClick={handleSuggestNewProduct}
                                    style={{
                                        width: '100%',
                                        padding: '12px',
                                        backgroundColor: 'rgba(46, 204, 113, 0.2)',
                                        border: '1px solid rgba(46, 204, 113, 0.3)',
                                        borderRadius: '4px',
                                        color: '#2ecc71',
                                        marginBottom: '20px',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                        fontWeight: '500',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px'
                                    }}
                                >
                                    <span>+</span> Suggest New Product
                                </button>

                                <div className="search-results fade-in" style={{
                                    maxHeight: '400px',
                                    overflowY: 'auto'
                                }}>
                                    {filteredResults.map(product => {
                                        const currentSpot = ghostSpotsRef.current[selectedGhostIndex];
                                        const recommendedType = currentSpot?.userData?.recommendedType;
                                        const isRecommended = isProductRecommended(product, recommendedType);
                                        
                                        return (
                                            <div 
                                                key={product.id}
                                                onClick={() => handleProductSelect(product)}
                                                style={{
                                                    padding: '12px',
                                                    marginBottom: isRecommended ? '8px' : '0',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s ease',
                                                    backgroundColor: isRecommended ? 'rgba(39, 174, 96, 0.1)' : 'transparent',
                                                    boxShadow: isRecommended ? '0 0 15px rgba(39, 174, 96, 0.2)' : 'none',
                                                    borderRadius: isRecommended ? '4px' : '0',
                                                    border: isRecommended ? '1px solid rgba(39, 174, 96, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)',
                                                    position: 'relative'
                                                }}
                                            >
                                                <div style={{ 
                                                    fontWeight: '500',
                                                    color: isRecommended ? '#2ecc71' : '#ffffff',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between'
                                                }}>
                                    {product.name}
                                                    {isRecommended && (
                                                        <span style={{ 
                                                            fontSize: '12px',
                                                            padding: '2px 6px',
                                                            backgroundColor: 'rgba(46, 204, 113, 0.2)',
                                                            borderRadius: '4px',
                                                            marginLeft: '8px'
                                                        }}>
                                                            Recommended
                                                        </span>
                                                    )}
                                                </div>
                                                <div style={{ 
                                                    fontSize: '12px', 
                                                    opacity: 0.7,
                                                    marginTop: '4px',
                                                    color: isRecommended ? '#2ecc71' : '#ffffff'
                                                }}>
                                                    {product.category}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {filteredResults.length === 0 && (
                                        <div style={{ 
                                            textAlign: 'center', 
                                            padding: '20px',
                                            color: 'rgba(255, 255, 255, 0.5)'
                                        }}>
                                            No products found
                </div>
            )}
        </div>
                            </>
                        ) : (
                            <ProductSuggestionForm
                                onClose={() => {
                                    setShowSuggestionForm(false);
                                }}
                                recommendedType={ghostSpotsRef.current[selectedGhostIndex]?.userData?.recommendedType || 'Any Device'}
                                spotType={ghostSpotsRef.current[selectedGhostIndex]?.userData?.type || 'standard'}
                            />
                        )}
                    </div>
                )}
            </div>
        </>
    );
}

export { ThreeScene };
export default ThreeScene;