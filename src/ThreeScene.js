import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { TOUCH } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment';
import { SETTINGS, defaultSettingFor, getSetting, listSettings } from './data/settings';
import { collection, getDocs, doc, getDoc, updateDoc } from "firebase/firestore"; // Import Firestore methods
import { db } from "./firebaseConfig"; // Import Firestore
import { auth } from "./firebaseConfig"; // Add auth import at the top
import { gsap } from 'gsap';
import { updateAllModelPaths, getStorageModelURL } from './firebaseUtils'; // Add this import
import ProductSuggestionForm from './ProductSuggestionForm';
import ModelPreviewPanel from './ModelPreviewPanel';
import ProductSelectorModal from './components/ProductSelectorModal';
import DeviceHoverMenu from './components/DeviceHoverMenu';
import BuilderInstructionsModal from './components/BuilderInstructionsModal';
import ConnectionGuideButton from './components/ConnectionGuideButton';
import GhostSpotContextMenu from './components/GhostSpotContextMenu';
import GhostSpotEditorPanel from './components/GhostSpotEditorPanel';
import CameraAngleControls from './components/CameraAngleControls';
import { getDefaultLayout, loadLayout, saveLayout, makeSpotType } from './utils/ghostSpotLayout';
import { buildBuyLink, purchaseLinkNotice } from './utils/affiliateLink';
import { midpoint, panOffsetFromMidpointDelta } from './utils/cameraPan';
import { buildClickPayload, logAffiliateClick } from './utils/affiliateClicks';
import { registerScenePreviewCapture } from './utils/scenePreviewCapture';
import MobileNavigation from './MobileNavigation';
import { MdWbSunny, MdNightlight } from 'react-icons/md';
import Modal from './ui/Modal';
import Button from './ui/Button';
import { computeAutoScale } from './dimensionScaler';
import { createWheelDeviceDetector } from './hooks/useInputDevice';

// Module-level shared DRACOLoader. Decoder served from the unpkg CDN to avoid
// bundling the wasm/js. Configured once and reused by every GLB-backed setting.
const dracoLoaderShared = new DRACOLoader();
dracoLoaderShared.setDecoderPath('https://unpkg.com/three@0.162.0/examples/jsm/libs/draco/');
dracoLoaderShared.setDecoderConfig({ type: 'js' });

function disposeObject3DTree(root) {
    if (!root) return;
    root.traverse((obj) => {
        if (obj.geometry && typeof obj.geometry.dispose === 'function') {
            obj.geometry.dispose();
        }
        if (obj.material) {
            const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
            mats.forEach((m) => {
                if (!m) return;
                ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap'].forEach((k) => {
                    if (m[k] && typeof m[k].dispose === 'function') m[k].dispose();
                });
                if (typeof m.dispose === 'function') m.dispose();
            });
        }
    });
}

function ThreeScene({ devices, isInitialized, setupType, setting, onSettingChange, onSetupTypeChange, onDevicesChange, onCategoryToggle, initialCameraAngles, onCameraAnglesChange, affiliateAttribution }) {
    const mountRef = useRef(null);
    const sceneRef = useRef(null);
    const cameraRef = useRef(null);
    const controlsRef = useRef(null);
    const rendererRef = useRef(null);
    const devicesRef = useRef({});
    const prevDevicesRef = useRef(devices);
    const cablesRef = useRef([]);
    const djTableRef = useRef(null);
    const environmentRootRef = useRef(null);
    const globalLightsRef = useRef(null);
    const currentSettingConfigRef = useRef(null);
    const envMapIntensityRef = useRef(1);
    // In-scene day/night lighting toggle — independent of the app UI theme.
    // Ref mirrors the state so buildSetting (not recreated per render) can
    // read the current mode without stale closure values.
    const [lightingMode, setLightingMode] = useState('day');
    const lightingModeRef = useRef('day');
    const ghostSpotsRef = useRef([]);
    const [isAdmin, setIsAdmin] = useState(false);
    const isAdminRef = useRef(false);
    const currentLayoutRef = useRef(getDefaultLayout(setupType || 'DJ'));
    const layoutLoadTokenRef = useRef(0);
    const [ghostMenu, setGhostMenu] = useState(null);   // { screenX, screenY, spotIndex }
    const [ghostEditor, setGhostEditor] = useState(null); // { mode, spot, originalSpot, insert }
    const placedDevices = useRef([]);
    const onDevicesChangeRef = useRef(onDevicesChange);
    const placedDevicesListRef = useRef([]);
    const hasLoadedFromSavedRef = useRef(false);
    const isPinchingRef = useRef(false);
    const swapTargetUniqueIdRef = useRef(null);
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
    const [currentSetting, setCurrentSetting] = useState(setting || defaultSettingFor(setupType || 'DJ'));
    // Scene-switch confirmation: holds the { type, key } the user asked to
    // switch to while placed gear would be discarded (ghost-spot layouts are
    // unique per scene, so devices can't carry over). type may differ from
    // currentSetupType when switching to a scene of a different setup type.
    const [pendingSwitch, setPendingSwitch] = useState(null);
    // "More scenes" dropdown: lets the switcher offer scenes from every setup
    // type, not just the current one (the pill row only lists same-type scenes).
    const [showSceneMenu, setShowSceneMenu] = useState(false);
    const [isSetupListExpanded, setIsSetupListExpanded] = useState(false);
    const [isUpdatingPaths, setIsUpdatingPaths] = useState(false);
    const [showSuggestionForm, setShowSuggestionForm] = useState(false);
    const [suggestionModelFile, setSuggestionModelFile] = useState(null);
    const [suggestionModelScale, setSuggestionModelScale] = useState(1.0);
    const [menuDevice, setMenuDevice] = useState(null);
    const [menuScreenPos, setMenuScreenPos] = useState({ x: 0, y: 0 });
    const hoveredDeviceUniqueIdRef = useRef(null);
    const hoverHighlightStateRef = useRef(new Map());
    const menuDeviceRef = useRef(null);

    const [cameraAngles, setCameraAngles] = useState(initialCameraAngles ?? [null, null, null]);

    // Reset angles when a different setup is loaded (initialCameraAngles reference changes)
    useEffect(() => {
        setCameraAngles(initialCameraAngles ?? [null, null, null]);
    }, [initialCameraAngles]);

    // Swap scene lighting when the in-scene day/night toggle changes.
    useEffect(() => {
        lightingModeRef.current = lightingMode;
        if (!sceneInitialized || !environmentRootRef.current) return;
        rebuildSettingLights();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lightingMode, sceneInitialized]);

    // Live trackpad-vs-mouse detector. Re-classifies every wheel event (with
    // hysteresis) so camera controls self-correct instead of relying on a
    // one-time cached guess. The applied-mode ref avoids redundant control
    // mutations when the device hasn't changed.
    const wheelDetectorRef = useRef(createWheelDeviceDetector());
    const appliedInputModeRef = useRef(null);

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
        SPEAKER_RIGHT: 'speaker_right',
        DESK_CENTER: 'desk_center',
        DESK_LEFT: 'desk_left',
        DESK_RIGHT: 'desk_right',
        RACK_LEFT_1: 'rack_left_1',
        RACK_LEFT_2: 'rack_left_2',
        RACK_LEFT_3: 'rack_left_3',
        RACK_LEFT_4: 'rack_left_4',
        RACK_RIGHT_1: 'rack_right_1',
        RACK_RIGHT_2: 'rack_right_2',
        RACK_RIGHT_3: 'rack_right_3',
        RACK_RIGHT_4: 'rack_right_4',
        MONITOR_LEFT: 'monitor_left',
        MONITOR_RIGHT: 'monitor_right',
        STAGE_CENTER: 'stage_center',
        STAGE_LEFT: 'stage_left',
        STAGE_RIGHT: 'stage_right',
        STAGE_BACK_LEFT: 'stage_back_left',
        STAGE_BACK_CENTER: 'stage_back_center',
        STAGE_BACK_RIGHT: 'stage_back_right',
        PEDAL_1: 'pedal_1',
        PEDAL_2: 'pedal_2',
        PEDAL_3: 'pedal_3',
        PEDAL_4: 'pedal_4',
        AMP_LEFT: 'amp_left',
        AMP_RIGHT: 'amp_right'
    };

    const djSetupSpots = [
        { x: 0, y: 1.05, z: 0, type: SPOT_TYPES.MIDDLE },             // Middle (Mixer)
        { x: -1.5, y: 1.05, z: 0, type: SPOT_TYPES.MIDDLE_LEFT },     // Middle Left (Player)
        { x: 1.5, y: 1.05, z: 0, type: SPOT_TYPES.MIDDLE_RIGHT },     // Middle Right (Player)
        { x: -3.0, y: 1.05, z: 0, type: SPOT_TYPES.FAR_LEFT },        // Far Left (Player)
        { x: 3.0, y: 1.05, z: 0, type: SPOT_TYPES.FAR_RIGHT },        // Far Right (Player)
        { x: -0.75, y: 1.05, z: 0, type: SPOT_TYPES.MIDDLE_LEFT_INNER },   // Between Mixer and Left CDJ
        { x: 0.75, y: 1.05, z: 0, type: SPOT_TYPES.MIDDLE_RIGHT_INNER },   // Between Mixer and Right CDJ
        { x: 0, y: 1.05, z: -0.5, type: SPOT_TYPES.MIDDLE_BACK },     // Behind Mixer
        { x: 0, y: 1.42, z: -0.55, type: SPOT_TYPES.FX_TOP, size: { width: 0.28, depth: 0.22 } },  // FX rack shelf (RMX-1000) — elevated behind mixer
        { x: -0.75, y: 1.05, z: -0.22, type: SPOT_TYPES.FX_LEFT, size: { width: 0.22, depth: 0.22 } },  // FX left of mixer, back half of table (Teile Revolo)
        { x: 0.75, y: 1.05, z: -0.22, type: SPOT_TYPES.FX_RIGHT, size: { width: 0.22, depth: 0.22 } },  // FX right of mixer, back half of table (Teile Revolo)
        { x: 0, y: 1.05, z: 0.45, type: SPOT_TYPES.FX_FRONT, size: { width: 0.28, depth: 0.18 } }, // FX in front of deck (wide units)
        { x: 5.5, y: 0.05, z: -0.25, type: SPOT_TYPES.SPEAKER_LEFT, size: { width: 0.5, depth: 0.5 } },
        { x: -5.5, y: 0.05, z: -0.25, type: SPOT_TYPES.SPEAKER_RIGHT, size: { width: 0.5, depth: 0.5 } }
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
        width: isMobile ? '90%' : '580px',
        maxWidth: '680px',
        maxHeight: isMobile ? '80vh' : '90vh',
        overflowY: 'auto',
        color: '#ffffff',
        border: '1px solid var(--primary-border)',
        backdropFilter: 'blur(12px)',
        scrollbarWidth: 'thin',
        scrollbarColor: '#333333 #000000',
        msOverflowStyle: 'none'
    };

    // Removed unused positionModalStyle

    const CAMERA_POSITIONS = {
        default: {
            position: { x: 0, y: isMobile ? 3 : 2.2, z: isMobile ? 2.5 : 1.8 },
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

    const handleProductSelected = (product) => {
        const swapId = swapTargetUniqueIdRef.current;
        if (swapId) {
            const existing = placedDevicesListRef.current.find((d) => d.uniqueId === swapId);
            if (existing) {
                const spotIndex = existing.placementIndex;
                removeDevice(swapId);
                addProductToPosition(product, spotIndex);
            }
            swapTargetUniqueIdRef.current = null;
        } else {
            addProductToPosition(product, selectedGhostIndex);
        }
        setShowSearch(false);
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
            sourceDeviceUniqueId: sourceDevice.uniqueId || null,
            targetDeviceUniqueId: targetDevice.uniqueId || null,
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
            sourceDeviceUniqueId: sourceDevice.uniqueId || null,
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

        // Count players: CDJs, turntables, controllers, XDJs, media players
        const playerCount = devicesList.filter(device => {
            const n = (device.name || '').toLowerCase();
            const t = (device.type || '').toLowerCase();
            const sub = (device.subcategory || '').toLowerCase();
            return n.includes('cdj') || n.includes('xdj') || n.includes('ddj') ||
                   n.includes('turntable') || n.includes('sl-1210') || n.includes('sl1210') || n.includes('technics') ||
                   n.includes('player') || n.includes('kontrol s') ||
                   t.includes('turntable') || t.includes('cdj') || t.includes('controller') || t.includes('media_player') ||
                   sub === 'players';
        }).length;

        // Check for mixer/brain: DJM, Xone, Rane, MODEL 1, or anything with mixer type
        const hasMixer = devicesList.some(device => {
            const n = (device.name || '').toLowerCase();
            const t = (device.type || '').toLowerCase();
            const sub = (device.subcategory || '').toLowerCase();
            return n.includes('djm') || n.includes('mixer') || n.includes('xone') ||
                   n.includes('rane') || n.includes('model 1') || n.includes('rotary') ||
                   t.includes('mixer') || sub === 'mixers';
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

                        const bbox = new THREE.Box3().setFromObject(model);
                        const bboxSize = bbox.getSize(new THREE.Vector3());
                        const productDims = (product.width_mm && product.depth_mm && product.height_mm)
                          ? { width_mm: product.width_mm, depth_mm: product.depth_mm, height_mm: product.height_mm } : null;
                        const autoScale = computeAutoScale(product.name, bboxSize, productDims);
                        const manualMultiplier = product.modelScale || 1.0;
                        const finalScale = autoScale !== null ? autoScale * manualMultiplier : manualMultiplier;
                        model.scale.setScalar(finalScale);
                        console.log(`Scale for ${product.name}: auto=${autoScale}, manual=${manualMultiplier}, final=${finalScale}`);

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

    // Bridge: the builder's bottom action bar lives in App.js (outside this
    // component). Its "Add device" button dispatches this window event so we can
    // open the same add-device search from here.
    useEffect(() => {
        const handler = () => openHamburgerSearch();
        window.addEventListener('liveset:add-device', handler);
        return () => window.removeEventListener('liveset:add-device', handler);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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
            const sorted = sortProductsByRecommendation(products, selectedGhostIndex);
            setFilteredResults(sorted);
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

        const sortedResults = sortProductsByRecommendation(filtered, selectedGhostIndex);
        console.log("Filtered and sorted results:", sortedResults);
        setFilteredResults(sortedResults);
    };

    const isProductRecommended = (product, recommendedType) => {
        if (!recommendedType || !product || recommendedType === 'Any Device' || recommendedType === 'Instrument or Effects') return false;

        const n = (product.name || '').toLowerCase();
        const sub = (product.subcategory || '').toLowerCase();
        const t = (product.type || '').toLowerCase();

        switch (recommendedType) {
            case 'Player (CDJ)':
                return n.includes('cdj') || n.includes('player') || n.includes('turntable') || t.includes('player') || sub.includes('player');
            case 'Mixer (DJM)':
                return n.includes('djm') || n.includes('mixer') || n.includes('xone') || t.includes('mixer') || sub.includes('mixer');
            case 'RMX-1000':
                return n.includes('rmx') || n.includes('sp-1') || t.includes('fx') || sub.includes('effect');
            case 'Speaker':
                return n.includes('speaker') || n.includes('monitor') || n.includes('pa ') || t.includes('speaker') || sub.includes('speaker');
            case 'Audio Interface':
                return n.includes('interface') || n.includes('focusrite') || n.includes('scarlett') || n.includes('presonus') || n.includes('apollo') || t.includes('interface') || sub.includes('audio-interface');
            case 'Controller / Synth':
                return n.includes('controller') || n.includes('synth') || n.includes('midi') || n.includes('keyboard') || n.includes('launchpad') || n.includes('push') || t.includes('controller') || sub.includes('controller') || sub.includes('synthesizer');
            case 'Rack Unit / Processor':
                return n.includes('rack') || n.includes('processor') || n.includes('compressor') || n.includes('eq') || n.includes('preamp') || n.includes('reverb') || t.includes('rack') || sub.includes('effect');
            case 'Studio Monitor':
                return n.includes('monitor') || n.includes('speaker') || n.includes('genelec') || n.includes('yamaha hs') || n.includes('krk') || n.includes('adam') || t.includes('monitor') || sub.includes('monitor');
            case 'Instrument / Mic':
                return n.includes('guitar') || n.includes('bass') || n.includes('mic') || n.includes('vocal') || n.includes('drum') || sub.includes('instrument') || sub.includes('microphone');
            case 'Guitar / Bass':
                return n.includes('guitar') || n.includes('bass') || n.includes('strat') || n.includes('tele') || n.includes('les paul') || n.includes('fender') || n.includes('gibson') || sub.includes('instrument');
            case 'Keyboard / Instrument':
                return n.includes('keyboard') || n.includes('piano') || n.includes('synth') || n.includes('organ') || n.includes('rhodes') || sub.includes('synthesizer') || sub.includes('instrument');
            case 'Drums / Instrument':
                return n.includes('drum') || n.includes('percussion') || n.includes('cymbal') || n.includes('snare') || n.includes('kick') || sub.includes('instrument');
            case 'Effects Pedal':
                return n.includes('pedal') || n.includes('stomp') || n.includes('overdrive') || n.includes('distortion') || n.includes('delay') || n.includes('reverb') || n.includes('chorus') || n.includes('wah') || t.includes('pedal') || sub.includes('effect');
            case 'Amplifier / Monitor':
                return n.includes('amp') || n.includes('amplifier') || n.includes('combo') || n.includes('head') || n.includes('cabinet') || n.includes('monitor') || t.includes('amp') || sub.includes('amplifier');
            default:
                return false;
        }
    };

    const isBrainProduct = (product) => {
        const n = (product.name || '').toLowerCase();
        const t = (product.type || '').toLowerCase();
        if (currentSetupType === 'DJ') {
            return n.includes('mixer') || n.includes('djm') || n.includes('xone') || n.includes('laptop') || t.includes('mixer');
        }
        if (currentSetupType === 'Producer') {
            return n.includes('interface') || n.includes('laptop') || n.includes('console') || n.includes('focusrite') || n.includes('scarlett') || n.includes('apollo') || t.includes('interface');
        }
        return false;
    };

    const setupHasBrain = () => {
        const devices = placedDevicesListRef.current || [];
        return devices.some(d => {
            const n = (d.name || '').toLowerCase();
            if (currentSetupType === 'DJ') return n.includes('mixer') || n.includes('djm') || n.includes('xone') || n.includes('laptop');
            if (currentSetupType === 'Producer') return n.includes('interface') || n.includes('laptop') || n.includes('console') || n.includes('focusrite') || n.includes('scarlett');
            return false;
        });
    };

    const sortProductsByRecommendation = (products, ghostIndex) => {
        const spot = ghostSpotsRef.current[ghostIndex];
        const recType = spot?.userData?.recommendedType;
        const hasBrain = setupHasBrain();
        const needsBrain = !hasBrain && (currentSetupType === 'DJ' || currentSetupType === 'Producer');

        return [...products].sort((a, b) => {
            if (needsBrain) {
                const aB = isBrainProduct(a);
                const bB = isBrainProduct(b);
                if (aB && !bB) return -1;
                if (!aB && bB) return 1;
            }
            const aR = isProductRecommended(a, recType);
            const bR = isProductRecommended(b, recType);
            if (aR && !bR) return -1;
            if (!aR && bR) return 1;
            return 0;
        });
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
            setMenuDevice(deviceAtSpot);
            setMenuScreenPos(projectMenuAnchor(deviceAtSpot.uniqueId));
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
        let unregisterPreviewCapture = null;

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
                renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
                renderer.setSize(width, height);
                renderer.shadowMap.enabled = true;
                renderer.shadowMap.type = THREE.PCFSoftShadowMap;
                renderer.toneMapping = THREE.ACESFilmicToneMapping;
                renderer.toneMappingExposure = 1.0; // overridden per-scene by applyGlobalLighting
                mountRef.current.appendChild(renderer.domElement);

                // Setup previews: the save flow grabs a JPEG of the viewport.
                // Render-then-copy must happen in the same task — the drawing
                // buffer is not preserved, so a fresh render() right before
                // drawImage guarantees pixels. Downscale to cap file size.
                unregisterPreviewCapture = registerScenePreviewCapture(({ maxWidth = 800, quality = 0.85 } = {}) => {
                    const r = rendererRef.current;
                    const s = sceneRef.current;
                    const cam = cameraRef.current;
                    if (!r || !s || !cam) return null;
                    r.render(s, cam);
                    const src = r.domElement;
                    const scale = Math.min(1, maxWidth / (src.width || 1));
                    const canvas = document.createElement('canvas');
                    canvas.width = Math.max(1, Math.round(src.width * scale));
                    canvas.height = Math.max(1, Math.round(src.height * scale));
                    canvas.getContext('2d').drawImage(src, 0, 0, canvas.width, canvas.height);
                    return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
                });

                // Image-based environment lighting: gives PBR gear/scene
                // materials realistic fill and reflections instead of the flat
                // look of pure ambient light. Strength is tuned per setting via
                // lighting.envMapIntensity (see setEnvMapIntensity).
                const pmrem = new THREE.PMREMGenerator(renderer);
                scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
                pmrem.dispose();

                // Add lights
                const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
                scene.add(ambientLight);

                const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
                directionalLight.position.set(5, 8, 5);
                // Soft key shadow over the booth/table area (origin-centred);
                // gear casts, env geometry receives.
                directionalLight.castShadow = true;
                directionalLight.shadow.mapSize.set(2048, 2048);
                directionalLight.shadow.camera.left = -10;
                directionalLight.shadow.camera.right = 10;
                directionalLight.shadow.camera.top = 10;
                directionalLight.shadow.camera.bottom = -10;
                directionalLight.shadow.camera.near = 0.5;
                directionalLight.shadow.camera.far = 40;
                directionalLight.shadow.bias = -0.0002;
                directionalLight.shadow.normalBias = 0.02;
                scene.add(directionalLight);

                const hemisphereLight = new THREE.HemisphereLight(0xffffbb, 0x080820, 1);
                scene.add(hemisphereLight);

                // Captured so per-setting configs can dim the global fill for
                // moody GLB environments and restore it on the way out.
                globalLightsRef.current = {
                    ambient: ambientLight,
                    directional: directionalLight,
                    hemisphere: hemisphereLight,
                    defaults: { ambient: 0.5, directional: 1, hemisphere: 1 },
                    defaultBackground: 0xf0f0f0,
                };

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

        // Disable OrbitControls two-finger handling; we handle pinch via pointer events (OrbitControls uses pointer, not touch)
        controls.touches = { ONE: TOUCH.ROTATE, TWO: -1 };
        
        // Pinch-to-zoom via pointer events (capture phase so we run before OrbitControls)
        const activePointers = new Map();
        let pinchStartDistance = 0;
        let pinchStartCameraDistance = 0;
        let panLastMid = null; // last two-finger midpoint, screen px
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
                const pts = Array.from(activePointers.values());
                panLastMid = midpoint(pts[0], pts[1]);
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
                    // Pinch → dolly (unchanged).
                    const ratio = pinchStartDistance / dist;
                    const newDist = pinchStartCameraDistance * ratio;
                    const dir = camera.position.clone().sub(controls.target).normalize();
                    camera.position.copy(controls.target).add(dir.multiplyScalar(newDist));
                    // Two-finger drag → pan camera + target along camera basis.
                    const pts = Array.from(activePointers.values());
                    if (panLastMid && pts.length === 2) {
                        const newMid = midpoint(pts[0], pts[1]);
                        const { rightUnits, upUnits } = panOffsetFromMidpointDelta({
                            dxScreen: newMid.x - panLastMid.x,
                            dyScreen: newMid.y - panLastMid.y,
                            cameraDistance: camera.position.distanceTo(controls.target),
                            viewportHeight: renderer.domElement.clientHeight,
                            fovRad: (camera.fov * Math.PI) / 180,
                        });
                        const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0);
                        const up = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 1);
                        const panVec = right.multiplyScalar(rightUnits).add(up.multiplyScalar(upUnits));
                        camera.position.add(panVec);
                        controls.target.add(panVec);
                        panLastMid = newMid;
                    }
                    controls.update();
                }
            }
        }
        function onPointerUp(e) {
            activePointers.delete(e.pointerId);
            if (activePointers.size < 2) {
                pinchStartDistance = 0;
                panLastMid = null;
                setTimeout(() => { isPinchingRef.current = false; }, 150);
            }
        }
        const el = renderer.domElement;
        const capture = true;
        el.addEventListener('pointerdown', onPointerDown, { capture });
        el.addEventListener('pointermove', onPointerMove, { capture });
        el.addEventListener('pointerup', onPointerUp, { capture });
        el.addEventListener('pointercancel', onPointerUp, { capture });
        
        // Wheel handling depends on input device:
        //   trackpad: two-finger scroll = rotate, pinch (ctrlKey) = zoom
        //   mouse:    wheel = zoom (conventional), drag = rotate (via OrbitControls)
        const handleWheel = (event) => {
            event.preventDefault();
            event.stopImmediatePropagation();

            const deltaY = event.deltaY !== undefined ? event.deltaY : (event.wheelDeltaY ? -event.wheelDeltaY / 120 : 0);
            const deltaX = event.deltaX !== undefined ? event.deltaX : (event.wheelDeltaX ? -event.wheelDeltaX / 120 : 0);

            // Live device classification — adapts on every event, no caching.
            const device = wheelDetectorRef.current.feed(event);
            if (device !== appliedInputModeRef.current) {
                appliedInputModeRef.current = device;
                if (device === 'mouse') {
                    controls.mouseButtons.LEFT = 0; // ROTATE — conventional for mouse
                    controls.rotateSpeed = 0.7;
                    controls.dampingFactor = 0.08;
                } else {
                    controls.mouseButtons.LEFT = 2; // PAN — keeps trackpad feel
                    controls.rotateSpeed = 1.0;
                    controls.dampingFactor = 0.05;
                }
            }

            const isMouse = device === 'mouse';
            const wantZoom = event.ctrlKey || isMouse;

            if (wantZoom) {
                // Mouse wheel notches are big (typically |deltaY| >= 100); trackpad
                // pinch sends tiny fractional deltas. Use a slower factor for mouse
                // so each notch isn't a huge dolly.
                const zoomSpeed = isMouse ? 0.0006 : 0.002;
                const currentDist = camera.position.distanceTo(controls.target);
                const step = deltaY * zoomSpeed * Math.max(currentDist, 1);
                const newDist = currentDist + step;
                const dir = camera.position.clone().sub(controls.target).normalize();
                if (newDist < 0.3) {
                    // Push orbit target forward so camera can zoom past the centre of the scene
                    const advance = 0.3 - newDist;
                    controls.target.addScaledVector(dir, -advance);
                    camera.position.copy(controls.target).addScaledVector(dir, 0.3);
                } else {
                    camera.position.copy(controls.target).add(dir.multiplyScalar(newDist));
                }
                controls.update();
            } else {
                // Trackpad two-finger scroll: orbit
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

                // Create environment via the setting registry (defaults to
                // the current setupType's first setting key).
                const initialSettingKey = currentSetting || defaultSettingFor(currentSetupType);
                buildSetting(scene, initialSettingKey);
                applySettingCamera(getSetting(currentSetupType, initialSettingKey));

                // Create ghost spots and setup raycasting
                createGhostPlacementSpots(scene);
                const cleanupRaycasting = setupRaycasting();
                setSceneInitialized(true);

                // Animation loop
                let lastMenuPos = { x: -9999, y: -9999 };
                const animate = () => {
            requestAnimationFrame(animate);
            controls.update();
            renderer.render(scene, camera);
            // Keep hover menu anchor synced while menu is open (only update when moved > 1px)
            if (menuDeviceRef.current) {
                const uid = menuDeviceRef.current.uniqueId;
                const newPos = projectMenuAnchor(uid);
                const dx = newPos.x - lastMenuPos.x;
                const dy = newPos.y - lastMenuPos.y;
                if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
                    lastMenuPos = newPos;
                    setMenuScreenPos(newPos);
                }
            } else {
                lastMenuPos = { x: -9999, y: -9999 };
            }
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
        // The mount can resize without a window resize now that the builder
        // lives in the app shell (e.g. collapsing/expanding the sidebar).
        // Observe the mount, not the canvas — the canvas only changes size
        // when handleResize itself calls renderer.setSize.
        let resizeObserver = null;
        if (typeof ResizeObserver !== 'undefined' && mountRef.current) {
            resizeObserver = new ResizeObserver(handleResize);
            resizeObserver.observe(mountRef.current);
        }

        return () => {
            if (resizeObserver) resizeObserver.disconnect();
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
                user.getIdTokenResult()
                    .then((token) => setIsAdmin(token.claims.admin === true || token.claims.admin === 'true'))
                    .catch(() => setIsAdmin(false));
                initializeScene();
            } else {
                setIsAdmin(false);
                setError("Please sign in to access the application");
            }
        });

        return () => {
            if (unregisterPreviewCapture) { unregisterPreviewCapture(); unregisterPreviewCapture = null; }
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
                // Ensure the variant-specific ghost-spot layout is loaded BEFORE we build
                // spots and resolve saved placementIndex/spotType. Otherwise the saved-setup
                // branch races the async layout loader and falls back to hardcoded defaults,
                // making saved devices land at default-layout coordinates (e.g. mixer ends up
                // off the booth in custom variants like Dojo).
                try {
                    const variantSpots = await loadLayout(currentSetupType, currentSetting);
                    if (Array.isArray(variantSpots) && variantSpots.length > 0) {
                        currentLayoutRef.current = variantSpots;
                    }
                } catch (e) {
                    console.warn('loadLayout failed during saved-setup load; using current/default layout', e);
                }
                createGhostPlacementSpots(scene, isBasicCompleteFromSaved);

                for (let i = 0; i < sortedDevices.length; i++) {
                    const device = sortedDevices[i];
                    let placementIndex = null;

                    // Primary: match by spotType (stable string identifier — survives layout
                    // reorders and index shifts that would corrupt a raw numeric placementIndex).
                    if (device.spotType != null) {
                        const foundIdx = ghostSpotsRef.current.findIndex((spot, idx) =>
                            spot?.userData?.type === device.spotType && !usedSpotIndices.has(idx));
                        if (foundIdx >= 0) placementIndex = foundIdx;
                    }

                    // Secondary: fall back to saved numeric index when spotType is absent
                    // (backwards-compat for very old saves saved before spotType was added).
                    if (placementIndex == null && device.placementIndex != null && !usedSpotIndices.has(device.placementIndex)) {
                        placementIndex = device.placementIndex;
                    }

                    // Tertiary: match by closest saved position (very old saves without either field)
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

                // Auto-snap camera to saved slot 0 if present
                if (initialCameraAngles?.[0]) {
                    snapCameraToAngle(initialCameraAngles[0]);
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

                    const box = new THREE.Box3().setFromObject(model);
                    const rawSize = new THREE.Vector3();
                    box.getSize(rawSize);

                    const deviceDims = (device.width_mm && device.depth_mm && device.height_mm)
                      ? { width_mm: device.width_mm, depth_mm: device.depth_mm, height_mm: device.height_mm } : null;
                    const autoScale = computeAutoScale(device.name, rawSize, deviceDims);
                    const manualMultiplier = device.modelScale || 1.0;
                    const finalScale = autoScale !== null ? autoScale * manualMultiplier : manualMultiplier;
                    model.scale.setScalar(finalScale);
                    console.log(`loadDevice scale for ${device.name}: auto=${autoScale}, manual=${manualMultiplier}, final=${finalScale}`);

                    // Use scaled size for position calculations
                    const scaledSize = rawSize.clone().multiplyScalar(finalScale);
                    position = getDevicePosition(device, index, scaledSize);

                    model.position.set(position.x, position.y, position.z);
                    const center = box.getCenter(new THREE.Vector3()).multiplyScalar(finalScale);
                    model.position.sub(center);

                    scene.add(model);

                    const refKey = device.uniqueId || device.id;
                    model.userData = { ...model.userData, productId: device.id, name: device.name, uniqueId: refKey };
                    devicesRef.current[refKey] = {
                        model,
                        data: device,
                        connectionsInUse: { inputs: [], outputs: [] }
                    };

                    model.traverse((child) => {
                        if (child.isMesh) {
                            child.material.side = THREE.DoubleSide;
                            child.castShadow = true;
                            child.receiveShadow = true;
                            if (child.material.envMapIntensity !== undefined) {
                                child.material.envMapIntensity = envMapIntensityRef.current;
                            }
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
        const refKey = device.uniqueId || device.id;
        cube.userData = { ...cube.userData, productId: device.id, name: device.name, uniqueId: refKey };
        scene.add(cube);
        devicesRef.current[refKey] = {
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

    function disposeEnvironment() {
        const root = environmentRootRef.current;
        if (root) {
            disposeObject3DTree(root);
            if (root.parent) root.parent.remove(root);
        }
        environmentRootRef.current = null;
        djTableRef.current = null;
    }

    // Scale the image-based lighting (scene.environment) contribution on every
    // PBR material under root. three r162 has no scene.environmentIntensity,
    // so the per-setting knob is applied material-by-material.
    function setEnvMapIntensity(root, value) {
        if (!root) return;
        root.traverse((obj) => {
            if (!obj.isMesh || !obj.material) return;
            const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
            mats.forEach((m) => {
                if (m && m.envMapIntensity !== undefined) m.envMapIntensity = value;
            });
        });
    }

    // Pick the day or night lighting block for the current in-scene toggle
    // mode, falling back to day so a missing night block never blanks a scene.
    function activeLightingBlock(settingConfig) {
        const lighting = settingConfig.lighting || {};
        return lighting[lightingModeRef.current] || lighting.day || null;
    }

    // Apply global lights, background colour, and tone mapping exposure from
    // the setting's lighting block for the active day/night mode.
    function applyGlobalLighting(scene, settingConfig) {
        const g = globalLightsRef.current;
        if (!g) return;
        const cfg = activeLightingBlock(settingConfig);
        if (!cfg) {
            console.error(`applyGlobalLighting: setting "${settingConfig.label}" has no lighting blocks`);
            return;
        }
        const o = cfg.globalLights || {};
        g.ambient.intensity = o.ambient ?? g.defaults.ambient;
        g.directional.intensity = o.directional ?? g.defaults.directional;
        g.hemisphere.intensity = o.hemisphere ?? g.defaults.hemisphere;
        const bg = cfg.background ?? g.defaultBackground;
        if (scene.background instanceof THREE.Color) scene.background.set(bg);
        else scene.background = new THREE.Color(bg);
        const r = rendererRef.current;
        if (r) r.toneMappingExposure = cfg.toneMappingExposure ?? 1.0;
        envMapIntensityRef.current = cfg.envMapIntensity ?? 1;
        // Re-apply to everything already in the scene (placed gear persists
        // across setting swaps); new env/gear meshes pick it up on load.
        setEnvMapIntensity(scene, envMapIntensityRef.current);
    }

    // Build the lights declared on a setting into the (possibly rotated) envRoot
    // so they ride along with the environment geometry. Each created light is
    // tagged userData.isSettingLight = true so setting swaps can remove only
    // our lights without touching any lights baked into the GLB itself.
    function addSettingLights(envRoot, settingConfig) {
        // Light positions live in the env's local frame, so envRoot's scale moves
        // them with the geometry. PointLight `distance` is a world-space scalar the
        // matrix doesn't touch, so scale it by s; with inverse-square decay, keep
        // illuminance constant by scaling intensity by s^2.
        const s = settingConfig.scale || 1;
        const cfg = activeLightingBlock(settingConfig);
        if (!cfg) return;
        (cfg.lights || []).forEach((l) => {
            let light;
            if (l.kind === 'point') {
                light = new THREE.PointLight(l.color ?? 0xffffff, (l.intensity ?? 1) * s * s, (l.distance ?? 0) * s, l.decay ?? 2);
            } else if (l.kind === 'directional') {
                light = new THREE.DirectionalLight(l.color ?? 0xffffff, l.intensity ?? 1);
            } else {
                return;
            }
            if (l.position) light.position.set(l.position[0], l.position[1], l.position[2]);
            light.userData.isSettingLight = true;
            envRoot.add(light);
        });
    }

    // Swap accent lights and global lighting for the current day/night mode
    // without rebuilding the full environment. Called by the toggle useEffect.
    function rebuildSettingLights() {
        const envRoot = environmentRootRef.current;
        const config = currentSettingConfigRef.current;
        if (!envRoot || !config) return;

        // Remove only lights we added (tagged), preserving any GLB-embedded lights.
        // Dispose to free GPU shadow-map textures.
        const toRemove = envRoot.children.filter(c => c.isLight && c.userData.isSettingLight);
        toRemove.forEach(c => { envRoot.remove(c); c.dispose?.(); });

        addSettingLights(envRoot, config);
        applyGlobalLighting(sceneRef.current, config);

        if (rendererRef.current && sceneRef.current && cameraRef.current) {
            rendererRef.current.render(sceneRef.current, cameraRef.current);
        }
    }

    function loadGlbEnvironment(envRoot, settingConfig) {
        const loader = new GLTFLoader();
        if (settingConfig.draco) loader.setDRACOLoader(dracoLoaderShared);
        loader.load(
            settingConfig.source,
            (gltf) => {
                if (environmentRootRef.current !== envRoot) {
                    // Another setting swap happened while we were loading; discard.
                    disposeObject3DTree(gltf.scene);
                    return;
                }
                gltf.scene.traverse((obj) => {
                    if (obj.isMesh) {
                        obj.castShadow = false;
                        obj.receiveShadow = true;
                    }
                });
                setEnvMapIntensity(gltf.scene, envMapIntensityRef.current);
                envRoot.add(gltf.scene);
                addSettingLights(envRoot, settingConfig);
                if (rendererRef.current && sceneRef.current && cameraRef.current) {
                    rendererRef.current.render(sceneRef.current, cameraRef.current);
                }
            },
            undefined,
            (err) => {
                console.error('Failed to load GLB setting:', settingConfig.source, err);
            }
        );
    }

    function buildSetting(scene, settingKey) {
        if (!scene) return;
        const settingConfig = getSetting(currentSetupType, settingKey);
        if (!settingConfig) return;

        disposeEnvironment();

        currentSettingConfigRef.current = settingConfig;
        applyGlobalLighting(scene, settingConfig);

        const envRoot = new THREE.Group();
        envRoot.name = 'environmentRoot';
        if (settingConfig.rotationY) envRoot.rotation.y = settingConfig.rotationY;
        if (settingConfig.scale) envRoot.scale.setScalar(settingConfig.scale);
        environmentRootRef.current = envRoot;
        scene.add(envRoot);

        // Anchor for ghost-spot logic. Procedural settings will overwrite this
        // with the real table-top mesh; GLB settings rely on this placeholder
        // since the booth zone is at world origin per the GLB contract.
        const tableAnchor = new THREE.Mesh(
            new THREE.PlaneGeometry(8, 1.4),
            new THREE.MeshBasicMaterial({ visible: false })
        );
        tableAnchor.rotation.x = -Math.PI / 2;
        tableAnchor.position.set(0, 0.95, -0.25);
        envRoot.add(tableAnchor);
        djTableRef.current = tableAnchor;

        if (settingConfig.type === 'procedural') {
            // Redirect scene.add() into envRoot for the duration of the
            // procedural build so existing createClubEnvironment internals
            // (87+ scene.add calls) land inside the swappable group.
            const origAdd = scene.add.bind(scene);
            scene.add = function (...objs) {
                objs.forEach((o) => envRoot.add(o));
                return scene;
            };
            try {
                createClubEnvironment(scene);
            } finally {
                scene.add = origAdd;
            }
            setEnvMapIntensity(envRoot, envMapIntensityRef.current);
            addSettingLights(envRoot, settingConfig);
        } else if (settingConfig.type === 'glb') {
            loadGlbEnvironment(envRoot, settingConfig);
        }
    }

    function applySettingCamera(settingConfig) {
        if (!cameraRef.current || !controlsRef.current || !settingConfig?.camera) return;
        const { position, target } = settingConfig.camera;
        // Camera coords are in the env's authored frame; scale them with the
        // environment so the framing is preserved at any setting scale.
        const s = settingConfig.scale || 1;
        cameraRef.current.position.set(position[0] * s, position[1] * s, position[2] * s);
        controlsRef.current.target.set(target[0] * s, target[1] * s, target[2] * s);
        controlsRef.current.update();
    }

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
        
        const tableTop = new THREE.Mesh(
            new THREE.PlaneGeometry(8, 1.4),
            new THREE.MeshStandardMaterial({ 
                color: 0x222222,
                side: THREE.DoubleSide
            })
        );
        tableTop.rotation.x = -Math.PI / 2;
        tableTop.position.set(0, 0.95, -0.25);
        tableTop.receiveShadow = true;
        tableTop.castShadow = false;
        tableGroup.add(tableTop);
        
        const legGeometry = new THREE.BoxGeometry(0.1, 0.9, 0.1);
        const legMaterial = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
        
        const legPositions = [
            { x: -3.9, z: 0.2 },
            { x: 3.9, z: 0.2 }
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
                
                const boothTop = new THREE.Mesh(
                    new THREE.PlaneGeometry(8.6, 1.6),
                    boothMaterial
                );
                boothTop.rotation.x = -Math.PI / 2;
                boothTop.position.set(0, 0.9, -0.25);
                boothTop.receiveShadow = true;
                boothGroup.add(boothTop);
                
                const boothBack = new THREE.Mesh(
                    new THREE.PlaneGeometry(8.6, 0.9),
                    boothMaterial
                );
                boothBack.position.set(0, 0.45, -1.05);
                boothBack.receiveShadow = true;
                boothGroup.add(boothBack);
                
                const sideMaterial = boothMaterial.clone();
                const leftSide = new THREE.Mesh(
                    new THREE.PlaneGeometry(1.6, 0.9),
                    sideMaterial
                );
                leftSide.rotation.y = Math.PI / 2;
                leftSide.position.set(-4.3, 0.45, -0.25);
                leftSide.receiveShadow = true;
                boothGroup.add(leftSide);
                
                const rightSide = new THREE.Mesh(
                    new THREE.PlaneGeometry(1.6, 0.9),
                    sideMaterial
                );
                rightSide.rotation.y = -Math.PI / 2;
                rightSide.position.set(4.3, 0.45, -0.25);
                rightSide.receiveShadow = true;
                boothGroup.add(rightSide);
                
                boothGroup.position.set(0, 0, 0);
                boothGroup.userData.type = 'environment';
                const booth = boothGroup;

                scene.add(booth);

                // ============================================
                // Hï Ibiza-inspired club environment
                // ============================================

                const roomWidth = 24;
                const roomDepth = 28;
                const roomHeight = 10;
                const crowdFloorY = -1.2; // Crowd floor is below the DJ booth

                // --- Dark wall material ---
                const djWallMaterial = new THREE.MeshStandardMaterial({
                    color: 0x080808,
                    roughness: 0.95,
                    metalness: 0.05,
                    side: THREE.DoubleSide
                });

                // --- Room shell (walls, ceiling, floor below booth) ---

                // Back wall
                const backWall = new THREE.Mesh(
                    new THREE.PlaneGeometry(roomWidth, roomHeight),
                    djWallMaterial
                );
                backWall.rotation.y = Math.PI;
                backWall.position.set(0, roomHeight / 2 + crowdFloorY, -roomDepth / 2);
                backWall.receiveShadow = true;
                backWall.userData.type = 'environment';
                scene.add(backWall);

                // Left wall
                const leftWall = new THREE.Mesh(
                    new THREE.PlaneGeometry(roomDepth, roomHeight),
                    djWallMaterial.clone()
                );
                leftWall.rotation.y = Math.PI / 2;
                leftWall.position.set(-roomWidth / 2, roomHeight / 2 + crowdFloorY, 0);
                leftWall.receiveShadow = true;
                leftWall.userData.type = 'environment';
                scene.add(leftWall);

                // Right wall
                const rightWall = new THREE.Mesh(
                    new THREE.PlaneGeometry(roomDepth, roomHeight),
                    djWallMaterial.clone()
                );
                rightWall.rotation.y = -Math.PI / 2;
                rightWall.position.set(roomWidth / 2, roomHeight / 2 + crowdFloorY, 0);
                rightWall.receiveShadow = true;
                rightWall.userData.type = 'environment';
                scene.add(rightWall);

                // Front wall (behind the DJ)
                const frontWall = new THREE.Mesh(
                    new THREE.PlaneGeometry(roomWidth, roomHeight),
                    djWallMaterial.clone()
                );
                frontWall.position.set(0, roomHeight / 2 + crowdFloorY, roomDepth / 4);
                frontWall.receiveShadow = true;
                frontWall.userData.type = 'environment';
                scene.add(frontWall);

                // Ceiling - dark industrial
                const ceilingMat = new THREE.MeshStandardMaterial({
                    color: 0x0a0a0a,
                    roughness: 0.9,
                    metalness: 0.3,
                    side: THREE.DoubleSide
                });
                const ceiling = new THREE.Mesh(
                    new THREE.PlaneGeometry(roomWidth, roomDepth),
                    ceilingMat
                );
                ceiling.rotation.x = Math.PI / 2;
                ceiling.position.set(0, roomHeight + crowdFloorY, 0);
                ceiling.userData.type = 'environment';
                scene.add(ceiling);

                // --- Crowd floor (lower level, dark) ---
                const crowdFloorMat = new THREE.MeshStandardMaterial({
                    color: 0x0d0d0d,
                    roughness: 0.85,
                    metalness: 0.1
                });
                const crowdFloor = new THREE.Mesh(
                    new THREE.PlaneGeometry(roomWidth, roomDepth - 4),
                    crowdFloorMat
                );
                crowdFloor.rotation.x = -Math.PI / 2;
                crowdFloor.position.set(0, crowdFloorY, -roomDepth / 4);
                crowdFloor.receiveShadow = true;
                crowdFloor.userData.type = 'environment';
                scene.add(crowdFloor);

                // --- DJ platform edge (the drop-off from booth to crowd) ---
                const platformEdgeMat = new THREE.MeshStandardMaterial({
                    color: 0x1a1a1a,
                    roughness: 0.5,
                    metalness: 0.6
                });
                // Front face of the elevated platform
                const platformFront = new THREE.Mesh(
                    new THREE.PlaneGeometry(roomWidth, 1.2),
                    platformEdgeMat
                );
                platformFront.position.set(0, crowdFloorY + 0.6, -1.5);
                platformFront.userData.type = 'environment';
                scene.add(platformFront);

                // LED strip along platform edge
                const platformLedMat = new THREE.MeshStandardMaterial({
                    color: 0x330000,
                    emissive: 0xff2200,
                    emissiveIntensity: 0.5,
                    side: THREE.DoubleSide
                });
                const platformLed = new THREE.Mesh(
                    new THREE.PlaneGeometry(roomWidth - 2, 0.06),
                    platformLedMat
                );
                platformLed.position.set(0, crowdFloorY + 1.18, -1.49);
                platformLed.userData.type = 'environment';
                scene.add(platformLed);

                // --- Crowd simulation (scattered point lights for phone flashlights / hands) ---
                const crowdGroup = new THREE.Group();
                crowdGroup.userData.type = 'environment';

                // Dim warm wash on the crowd area
                const crowdWash = new THREE.PointLight(0xffaa88, 0.5, 20, 1.5);
                crowdWash.position.set(0, 4, -roomDepth / 4);
                crowdWash.userData.type = 'environment';
                scene.add(crowdWash);

                // Small emissive dots to simulate phone lights / crowd glow
                const phoneLightMat = new THREE.MeshStandardMaterial({
                    color: 0xffffff,
                    emissive: 0xffeedd,
                    emissiveIntensity: 0.8,
                    transparent: true,
                    opacity: 0.7
                });
                const phoneLightGeo = new THREE.SphereGeometry(0.04, 6, 6);
                const numPhoneLights = 80;
                for (let i = 0; i < numPhoneLights; i++) {
                    const light = new THREE.Mesh(phoneLightGeo, phoneLightMat.clone());
                    const px = (Math.random() - 0.5) * (roomWidth - 6);
                    const pz = -3 - Math.random() * (roomDepth / 2 - 2);
                    const py = crowdFloorY + 0.8 + Math.random() * 1.2;
                    light.position.set(px, py, pz);
                    light.material.emissiveIntensity = 0.3 + Math.random() * 0.7;
                    light.material.opacity = 0.3 + Math.random() * 0.5;
                    crowdGroup.add(light);
                }
                scene.add(crowdGroup);

                // --- Silhouette crowd (dark capsule shapes suggesting people) ---
                const silhouetteMat = new THREE.MeshStandardMaterial({
                    color: 0x0a0a0a,
                    roughness: 1.0,
                    metalness: 0.0
                });
                const capsuleGeo = new THREE.CapsuleGeometry(0.15, 0.6, 4, 6);
                const numSilhouettes = 120;
                for (let i = 0; i < numSilhouettes; i++) {
                    const person = new THREE.Mesh(capsuleGeo, silhouetteMat);
                    const px = (Math.random() - 0.5) * (roomWidth - 4);
                    const pz = -2.5 - Math.random() * (roomDepth / 2 - 1);
                    person.position.set(px, crowdFloorY + 0.55, pz);
                    person.rotation.y = Math.random() * Math.PI * 2;
                    const s = 0.8 + Math.random() * 0.4;
                    person.scale.set(s, s, s);
                    person.userData.type = 'environment';
                    crowdGroup.add(person);
                }

                // --- Raised hands (thin cylinders sticking up from crowd) ---
                const handMat = new THREE.MeshStandardMaterial({
                    color: 0x1a1410,
                    roughness: 0.9,
                    metalness: 0.0
                });
                const handGeo = new THREE.CylinderGeometry(0.03, 0.04, 0.5, 5);
                const numHands = 40;
                for (let i = 0; i < numHands; i++) {
                    const hand = new THREE.Mesh(handGeo, handMat);
                    const px = (Math.random() - 0.5) * (roomWidth - 6);
                    const pz = -3 - Math.random() * (roomDepth / 3);
                    hand.position.set(px, crowdFloorY + 1.5 + Math.random() * 0.4, pz);
                    hand.rotation.z = (Math.random() - 0.5) * 0.5;
                    hand.rotation.x = (Math.random() - 0.5) * 0.3;
                    hand.userData.type = 'environment';
                    crowdGroup.add(hand);
                }

                // --- Vertical LED light pillars (signature Hï Ibiza look) ---
                const pillarPositions = [
                    // Back row - tall pillars across the back wall
                    { x: -8, z: -roomDepth / 2 + 1, h: roomHeight - 1 },
                    { x: -5.5, z: -roomDepth / 2 + 1, h: roomHeight - 0.5 },
                    { x: -3, z: -roomDepth / 2 + 1, h: roomHeight - 1.5 },
                    { x: -1, z: -roomDepth / 2 + 1, h: roomHeight - 0.8 },
                    { x: 1, z: -roomDepth / 2 + 1, h: roomHeight - 0.8 },
                    { x: 3, z: -roomDepth / 2 + 1, h: roomHeight - 1.5 },
                    { x: 5.5, z: -roomDepth / 2 + 1, h: roomHeight - 0.5 },
                    { x: 8, z: -roomDepth / 2 + 1, h: roomHeight - 1 },
                    // Mid row - slightly shorter
                    { x: -7, z: -roomDepth / 3, h: roomHeight - 2 },
                    { x: -4, z: -roomDepth / 3, h: roomHeight - 2.5 },
                    { x: 0, z: -roomDepth / 3, h: roomHeight - 2 },
                    { x: 4, z: -roomDepth / 3, h: roomHeight - 2.5 },
                    { x: 7, z: -roomDepth / 3, h: roomHeight - 2 },
                    // Side accent pillars
                    { x: -roomWidth / 2 + 1, z: -5, h: roomHeight - 1.5 },
                    { x: -roomWidth / 2 + 1, z: -9, h: roomHeight - 1 },
                    { x: roomWidth / 2 - 1, z: -5, h: roomHeight - 1.5 },
                    { x: roomWidth / 2 - 1, z: -9, h: roomHeight - 1 },
                ];

                pillarPositions.forEach(({ x, z, h }) => {
                    // Each pillar: thin glowing cylinder
                    const pillarGeo = new THREE.CylinderGeometry(0.06, 0.06, h, 8);
                    const pillarMat = new THREE.MeshStandardMaterial({
                        color: 0x220000,
                        emissive: 0xff1100,
                        emissiveIntensity: 0.7,
                        transparent: true,
                        opacity: 0.85
                    });
                    const pillar = new THREE.Mesh(pillarGeo, pillarMat);
                    pillar.position.set(x, crowdFloorY + h / 2, z);
                    pillar.userData.type = 'environment';
                    scene.add(pillar);

                    // Outer glow cylinder (larger, more transparent)
                    const glowGeo = new THREE.CylinderGeometry(0.2, 0.2, h, 8);
                    const glowMat = new THREE.MeshStandardMaterial({
                        color: 0x110000,
                        emissive: 0xff2200,
                        emissiveIntensity: 0.25,
                        transparent: true,
                        opacity: 0.15
                    });
                    const glow = new THREE.Mesh(glowGeo, glowMat);
                    glow.position.set(x, crowdFloorY + h / 2, z);
                    glow.userData.type = 'environment';
                    scene.add(glow);
                });

                // --- Ceiling light fixtures (Hï has ornate hanging lights) ---
                const fixtureMat = new THREE.MeshStandardMaterial({
                    color: 0x1a1a1a,
                    metalness: 0.8,
                    roughness: 0.3
                });
                const fixtureLightMat = new THREE.MeshStandardMaterial({
                    color: 0x331100,
                    emissive: 0xff3300,
                    emissiveIntensity: 0.6,
                    transparent: true,
                    opacity: 0.9
                });

                // Hanging cylindrical fixtures
                const fixturePositions = [
                    { x: -6, z: -4 }, { x: -3, z: -4 }, { x: 0, z: -4 },
                    { x: 3, z: -4 }, { x: 6, z: -4 },
                    { x: -7, z: -8 }, { x: -3.5, z: -8 }, { x: 0, z: -8 },
                    { x: 3.5, z: -8 }, { x: 7, z: -8 },
                    { x: -5, z: -12 }, { x: 0, z: -12 }, { x: 5, z: -12 },
                ];
                const ceilingY = roomHeight + crowdFloorY;
                fixturePositions.forEach(({ x, z }) => {
                    // Rod
                    const rodLen = 0.6 + Math.random() * 0.8;
                    const rod = new THREE.Mesh(
                        new THREE.CylinderGeometry(0.02, 0.02, rodLen, 6),
                        fixtureMat
                    );
                    rod.position.set(x, ceilingY - rodLen / 2, z);
                    rod.userData.type = 'environment';
                    scene.add(rod);

                    // Light body
                    const bodyH = 0.3 + Math.random() * 0.2;
                    const body = new THREE.Mesh(
                        new THREE.CylinderGeometry(0.12, 0.15, bodyH, 8),
                        fixtureLightMat.clone()
                    );
                    body.position.set(x, ceilingY - rodLen - bodyH / 2, z);
                    body.userData.type = 'environment';
                    scene.add(body);
                });

                // --- Balcony / mezzanine on sides ---
                const balconyMat = new THREE.MeshStandardMaterial({
                    color: 0x151515,
                    roughness: 0.6,
                    metalness: 0.5,
                    side: THREE.DoubleSide
                });
                const balconyRailMat = new THREE.MeshStandardMaterial({
                    color: 0x222222,
                    metalness: 0.7,
                    roughness: 0.3
                });

                // Left and right balconies
                [-1, 1].forEach(side => {
                    const bx = side * (roomWidth / 2 - 1.5);
                    const balconyFloor = new THREE.Mesh(
                        new THREE.BoxGeometry(3, 0.15, roomDepth / 2 - 2),
                        balconyMat
                    );
                    balconyFloor.position.set(bx, crowdFloorY + 3, -roomDepth / 4 - 1);
                    balconyFloor.userData.type = 'environment';
                    scene.add(balconyFloor);

                    // Railing
                    const railGeo = new THREE.BoxGeometry(0.08, 1.0, roomDepth / 2 - 2);
                    const rail = new THREE.Mesh(railGeo, balconyRailMat);
                    rail.position.set(bx - side * 1.4, crowdFloorY + 3.6, -roomDepth / 4 - 1);
                    rail.userData.type = 'environment';
                    scene.add(rail);

                    // Rail top bar
                    const topBar = new THREE.Mesh(
                        new THREE.BoxGeometry(0.12, 0.05, roomDepth / 2 - 2),
                        balconyRailMat
                    );
                    topBar.position.set(bx - side * 1.4, crowdFloorY + 4.1, -roomDepth / 4 - 1);
                    topBar.userData.type = 'environment';
                    scene.add(topBar);

                    // Vertical rail posts
                    for (let p = 0; p < 6; p++) {
                        const post = new THREE.Mesh(
                            new THREE.CylinderGeometry(0.025, 0.025, 1.0, 6),
                            balconyRailMat
                        );
                        const pz = -3 - p * 1.8;
                        post.position.set(bx - side * 1.4, crowdFloorY + 3.6, pz);
                        post.userData.type = 'environment';
                        scene.add(post);
                    }

                    // Under-balcony LED strip
                    const balconyLed = new THREE.Mesh(
                        new THREE.PlaneGeometry(2.5, 0.05),
                        platformLedMat.clone()
                    );
                    balconyLed.rotation.x = -Math.PI / 2;
                    balconyLed.position.set(bx, crowdFloorY + 2.93, -roomDepth / 4 - 1);
                    balconyLed.userData.type = 'environment';
                    scene.add(balconyLed);

                    // Balcony support columns
                    const colMat = new THREE.MeshStandardMaterial({
                        color: 0x111111,
                        metalness: 0.6,
                        roughness: 0.4
                    });
                    [-4, -8, -12].forEach(cz => {
                        const col = new THREE.Mesh(
                            new THREE.CylinderGeometry(0.15, 0.15, 3 + Math.abs(crowdFloorY), 8),
                            colMat
                        );
                        col.position.set(bx - side * 0.5, crowdFloorY + 1.5, cz);
                        col.userData.type = 'environment';
                        scene.add(col);
                    });
                });

                // --- Main spotlights (warm reds, pointing down at crowd & booth) ---

                // Booth key light (warm white from above)
                const boothKey = new THREE.SpotLight(0xffeedd, 1.5);
                boothKey.position.set(0, 6, 2);
                boothKey.target.position.set(0, 1, 0);
                boothKey.angle = Math.PI / 5;
                boothKey.penumbra = 0.6;
                boothKey.decay = 1.5;
                boothKey.distance = 12;
                boothKey.castShadow = true;
                boothKey.userData.type = 'environment';
                scene.add(boothKey);
                scene.add(boothKey.target);

                // Red spots pointing down at crowd (Hï signature)
                const redSpotPositions = [
                    { x: -5, z: -4, tx: -4, tz: -5 },
                    { x: 5, z: -4, tx: 4, tz: -5 },
                    { x: -3, z: -7, tx: -2, tz: -8 },
                    { x: 3, z: -7, tx: 2, tz: -8 },
                    { x: 0, z: -5, tx: 0, tz: -7 },
                    { x: -7, z: -9, tx: -5, tz: -10 },
                    { x: 7, z: -9, tx: 5, tz: -10 },
                ];
                redSpotPositions.forEach(({ x, z, tx, tz }) => {
                    const spot = new THREE.SpotLight(0xff2200, 1.2);
                    spot.position.set(x, ceilingY - 0.5, z);
                    spot.target.position.set(tx, crowdFloorY, tz);
                    spot.angle = Math.PI / 8;
                    spot.penumbra = 0.5;
                    spot.decay = 1.5;
                    spot.distance = 15;
                    spot.castShadow = false;
                    spot.userData.type = 'environment';
                    scene.add(spot);
                    scene.add(spot.target);
                });

                // Subtle ambient fill (very dark warm)
                const ambientFill = new THREE.HemisphereLight(0x110505, 0x050505, 0.3);
                ambientFill.userData.type = 'environment';
                scene.add(ambientFill);

                // --- Ceiling structural beams (industrial look) ---
                const beamMat = new THREE.MeshStandardMaterial({
                    color: 0x111111,
                    metalness: 0.7,
                    roughness: 0.4
                });
                for (let bz = -2; bz >= -roomDepth / 2 + 2; bz -= 4) {
                    const beam = new THREE.Mesh(
                        new THREE.BoxGeometry(roomWidth - 2, 0.2, 0.15),
                        beamMat
                    );
                    beam.position.set(0, ceilingY - 0.15, bz);
                    beam.userData.type = 'environment';
                    scene.add(beam);
                }

                // Cross beams
                for (let bx = -roomWidth / 2 + 4; bx <= roomWidth / 2 - 4; bx += 5) {
                    const crossBeam = new THREE.Mesh(
                        new THREE.BoxGeometry(0.12, 0.15, roomDepth / 2),
                        beamMat
                    );
                    crossBeam.position.set(bx, ceilingY - 0.25, -roomDepth / 4);
                    crossBeam.userData.type = 'environment';
                    scene.add(crossBeam);
                }

                // --- Red accent LEDs on walls (vertical strips like Hï) ---
                const wallLedMat = new THREE.MeshStandardMaterial({
                    color: 0x220000,
                    emissive: 0xff1100,
                    emissiveIntensity: 0.5,
                    transparent: true,
                    opacity: 0.8
                });
                // Left wall accent strips
                for (let wz = -3; wz >= -roomDepth / 2 + 2; wz -= 3) {
                    const wLed = new THREE.Mesh(
                        new THREE.PlaneGeometry(0.08, roomHeight * 0.6),
                        wallLedMat
                    );
                    wLed.rotation.y = Math.PI / 2;
                    wLed.position.set(-roomWidth / 2 + 0.05, crowdFloorY + roomHeight * 0.4, wz);
                    wLed.userData.type = 'environment';
                    scene.add(wLed);
                }
                // Right wall accent strips
                for (let wz = -3; wz >= -roomDepth / 2 + 2; wz -= 3) {
                    const wLed = new THREE.Mesh(
                        new THREE.PlaneGeometry(0.08, roomHeight * 0.6),
                        wallLedMat
                    );
                    wLed.rotation.y = -Math.PI / 2;
                    wLed.position.set(roomWidth / 2 - 0.05, crowdFloorY + roomHeight * 0.4, wz);
                    wLed.userData.type = 'environment';
                    scene.add(wLed);
                }

                // --- Fog/haze effect (subtle transparent planes) ---
                const hazeMat = new THREE.MeshStandardMaterial({
                    color: 0x221111,
                    transparent: true,
                    opacity: 0.04,
                    side: THREE.DoubleSide,
                    depthWrite: false
                });
                for (let hy = 2; hy <= 6; hy += 1.5) {
                    const haze = new THREE.Mesh(
                        new THREE.PlaneGeometry(roomWidth - 4, roomDepth / 2),
                        hazeMat.clone()
                    );
                    haze.rotation.x = -Math.PI / 2;
                    haze.position.set(0, hy + crowdFloorY, -roomDepth / 4);
                    haze.userData.type = 'environment';
                    scene.add(haze);
                }

                break;

            case 'Producer': {
                // Producer studio — dark polished concrete floor
                floor.material = new THREE.MeshStandardMaterial({ 
                    color: 0x1a1715,
                    roughness: 0.6,
                    metalness: 0.15
                });

                // Replace the wide DJ table with a narrower studio desk
                while (tableGroup.children.length > 0) tableGroup.remove(tableGroup.children[0]);
                const deskW = 2.8, deskD = 0.9;
                const studioDeskTop = new THREE.Mesh(
                    new THREE.BoxGeometry(deskW, 0.035, deskD),
                    new THREE.MeshStandardMaterial({ color: 0x1a1a1e, metalness: 0.3, roughness: 0.7 })
                );
                studioDeskTop.position.set(0, 0.93, -0.25);
                studioDeskTop.receiveShadow = true;
                tableGroup.add(studioDeskTop);
                djTableRef.current = studioDeskTop;

                const deskLegGeo = new THREE.BoxGeometry(0.05, 0.9, 0.05);
                const deskLegMat = new THREE.MeshStandardMaterial({ color: 0x111115, metalness: 0.5, roughness: 0.4 });
                [
                    { x: -deskW / 2 + 0.06, z: -0.25 + deskD / 2 - 0.06 },
                    { x: deskW / 2 - 0.06, z: -0.25 + deskD / 2 - 0.06 },
                    { x: -deskW / 2 + 0.06, z: -0.25 - deskD / 2 + 0.06 },
                    { x: deskW / 2 - 0.06, z: -0.25 - deskD / 2 + 0.06 },
                ].forEach(pos => {
                    const leg = new THREE.Mesh(deskLegGeo, deskLegMat);
                    leg.position.set(pos.x, 0.47, pos.z);
                    leg.castShadow = true;
                    tableGroup.add(leg);
                });

                const studioW = 10;
                const studioD = 8;
                const studioH = 3.5;

                const studioWallMat = new THREE.MeshStandardMaterial({ 
                    color: 0x12121a, roughness: 0.95, metalness: 0.0, side: THREE.DoubleSide
                });

                // Back wall
                const sBackWall = new THREE.Mesh(new THREE.PlaneGeometry(studioW, studioH), studioWallMat);
                sBackWall.rotation.y = Math.PI;
                sBackWall.position.set(0, studioH / 2, -studioD / 2);
                sBackWall.receiveShadow = true;
                sBackWall.userData.type = 'environment';
                scene.add(sBackWall);

                // Left wall
                const sLeftWall = new THREE.Mesh(new THREE.PlaneGeometry(studioD, studioH), studioWallMat.clone());
                sLeftWall.rotation.y = Math.PI / 2;
                sLeftWall.position.set(-studioW / 2, studioH / 2, 0);
                sLeftWall.receiveShadow = true;
                sLeftWall.userData.type = 'environment';
                scene.add(sLeftWall);

                // Right wall
                const sRightWall = new THREE.Mesh(new THREE.PlaneGeometry(studioD, studioH), studioWallMat.clone());
                sRightWall.rotation.y = -Math.PI / 2;
                sRightWall.position.set(studioW / 2, studioH / 2, 0);
                sRightWall.receiveShadow = true;
                sRightWall.userData.type = 'environment';
                scene.add(sRightWall);

                // Front wall
                const sFrontWall = new THREE.Mesh(new THREE.PlaneGeometry(studioW, studioH), studioWallMat.clone());
                sFrontWall.position.set(0, studioH / 2, studioD / 2);
                sFrontWall.receiveShadow = true;
                sFrontWall.userData.type = 'environment';
                scene.add(sFrontWall);

                // Ceiling
                const sCeiling = new THREE.Mesh(new THREE.PlaneGeometry(studioW, studioD), studioWallMat.clone());
                sCeiling.rotation.x = Math.PI / 2;
                sCeiling.position.set(0, studioH, 0);
                sCeiling.receiveShadow = true;
                sCeiling.userData.type = 'environment';
                scene.add(sCeiling);

                // Acoustic foam panels on back wall
                const foamColors = [0x2a1a35, 0x1a2535, 0x221a30];
                for (let row = 0; row < 4; row++) {
                    for (let col = -4; col <= 4; col++) {
                        if (Math.abs(col) <= 1 && row >= 1 && row <= 2) continue;
                        const foam = new THREE.Mesh(
                            new THREE.BoxGeometry(0.45, 0.45, 0.06),
                            new THREE.MeshStandardMaterial({ color: foamColors[(row + col + 10) % 3], roughness: 1.0 })
                        );
                        foam.position.set(col * 0.55, 0.6 + row * 0.55, -studioD / 2 + 0.04);
                        foam.userData.type = 'environment';
                        scene.add(foam);
                    }
                }

                // Acoustic panels on side walls
                for (let row = 0; row < 3; row++) {
                    for (let col = -2; col <= 2; col++) {
                        const fc = foamColors[(row + col + 6) % 3];
                        const lFoam = new THREE.Mesh(
                            new THREE.BoxGeometry(0.06, 0.45, 0.45),
                            new THREE.MeshStandardMaterial({ color: fc, roughness: 1.0 })
                        );
                        lFoam.position.set(-studioW / 2 + 0.04, 0.8 + row * 0.55, col * 0.55);
                        lFoam.userData.type = 'environment';
                        scene.add(lFoam);

                        const rFoam = new THREE.Mesh(
                            new THREE.BoxGeometry(0.06, 0.45, 0.45),
                            new THREE.MeshStandardMaterial({ color: fc, roughness: 1.0 })
                        );
                        rFoam.position.set(studioW / 2 - 0.04, 0.8 + row * 0.55, col * 0.55);
                        rFoam.userData.type = 'environment';
                        scene.add(rFoam);
                    }
                }

                // Bass traps in back corners
                const btMat = new THREE.MeshStandardMaterial({ color: 0x201828, roughness: 1.0 });
                const btShape = new THREE.Shape();
                btShape.moveTo(0, 0);
                btShape.lineTo(0.35, 0);
                btShape.lineTo(0, 0.35);
                btShape.closePath();
                const btGeo = new THREE.ExtrudeGeometry(btShape, { depth: studioH - 0.2, bevelEnabled: false });

                const btLeft = new THREE.Mesh(btGeo, btMat);
                btLeft.rotation.x = -Math.PI / 2;
                btLeft.position.set(-studioW / 2 + 0.01, 0.1, -studioD / 2 + 0.35);
                btLeft.userData.type = 'environment';
                scene.add(btLeft);

                const btRight = new THREE.Mesh(btGeo, btMat);
                btRight.rotation.x = -Math.PI / 2;
                btRight.rotation.z = Math.PI / 2;
                btRight.position.set(studioW / 2 - 0.35, 0.1, -studioD / 2 + 0.01);
                btRight.userData.type = 'environment';
                scene.add(btRight);

                // --- Equipment Racks (19-inch style, angled 45° toward center) ---
                const rackSlotYPositions = [0.35, 0.65, 0.95, 1.25];
                const rackConfigs = [
                    { x: -2.2, rotY: Math.PI / 4 },
                    { x: 2.2, rotY: -Math.PI / 4 }
                ];

                rackConfigs.forEach(({ x: rackX, rotY }) => {
                    const rack = new THREE.Group();
                    const rW = 0.55, rD = 0.4, rH = 1.5, rBase = 0.1;

                    const frameMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.85, roughness: 0.25 });
                    const panelMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0e, metalness: 0.5, roughness: 0.4, side: THREE.DoubleSide });

                    // Vertical corner posts
                    const postGeo = new THREE.BoxGeometry(0.035, rH, 0.035);
                    [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([sx, sz]) => {
                        const p = new THREE.Mesh(postGeo, frameMat);
                        p.position.set(sx * rW / 2, rBase + rH / 2, sz * rD / 2);
                        rack.add(p);
                    });

                    // Front rack rails
                    const fRailGeo = new THREE.BoxGeometry(0.018, rH - 0.04, 0.012);
                    [-1, 1].forEach(sx => {
                        const r = new THREE.Mesh(fRailGeo, frameMat);
                        r.position.set(sx * (rW / 2 - 0.05), rBase + rH / 2, rD / 2 - 0.005);
                        rack.add(r);
                    });

                    // Top & bottom frame rails
                    const hGeo = new THREE.BoxGeometry(rW, 0.022, 0.022);
                    const dGeo = new THREE.BoxGeometry(0.022, 0.022, rD);
                    [rBase, rBase + rH].forEach(y => {
                        [-rD / 2, rD / 2].forEach(z => {
                            const hr = new THREE.Mesh(hGeo, frameMat);
                            hr.position.set(0, y, z);
                            rack.add(hr);
                        });
                        [-rW / 2, rW / 2].forEach(x => {
                            const dr = new THREE.Mesh(dGeo, frameMat);
                            dr.position.set(x, y, 0);
                            rack.add(dr);
                        });
                    });

                    // Side panels
                    [-rW / 2, rW / 2].forEach(x => {
                        const sp = new THREE.Mesh(new THREE.PlaneGeometry(rD - 0.04, rH - 0.04), panelMat);
                        sp.rotation.y = Math.PI / 2;
                        sp.position.set(x, rBase + rH / 2, 0);
                        rack.add(sp);
                    });

                    // Back panel
                    const bp = new THREE.Mesh(new THREE.PlaneGeometry(rW - 0.04, rH - 0.04), panelMat);
                    bp.position.set(0, rBase + rH / 2, -rD / 2);
                    rack.add(bp);

                    // Shelves at each slot level
                    const shelfMat = new THREE.MeshStandardMaterial({ color: 0x181820, metalness: 0.6, roughness: 0.4 });
                    rackSlotYPositions.forEach(slotY => {
                        const shelf = new THREE.Mesh(
                            new THREE.BoxGeometry(rW - 0.07, 0.008, rD - 0.07),
                            shelfMat
                        );
                        shelf.position.set(0, slotY - 0.03, 0);
                        rack.add(shelf);
                    });

                    // Feet
                    const footGeo = new THREE.CylinderGeometry(0.025, 0.025, rBase, 8);
                    const footMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.7, roughness: 0.3 });
                    [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([sx, sz]) => {
                        const f = new THREE.Mesh(footGeo, footMat);
                        f.position.set(sx * (rW / 2 - 0.04), rBase / 2, sz * (rD / 2 - 0.04));
                        rack.add(f);
                    });

                    rack.position.set(rackX, 0, -0.25);
                    rack.rotation.y = rotY;
                    rack.userData.type = 'environment';
                    scene.add(rack);
                });

                // --- Studio Lighting ---
                const studioMainLight = new THREE.PointLight(0xffeedd, 1.0);
                studioMainLight.position.set(0, studioH - 0.3, 0.5);
                studioMainLight.castShadow = true;
                studioMainLight.userData.type = 'environment';
                scene.add(studioMainLight);

                // Focused desk light
                const deskSpot = new THREE.SpotLight(0xffffff, 0.8);
                deskSpot.position.set(0, studioH - 0.5, 0.8);
                deskSpot.target.position.set(0, 0.95, -0.25);
                deskSpot.angle = Math.PI / 5;
                deskSpot.penumbra = 0.6;
                deskSpot.userData.type = 'environment';
                scene.add(deskSpot);
                scene.add(deskSpot.target);

                // Cool-tinted accent lights over each rack
                rackConfigs.forEach(({ x: rackX }) => {
                    const rLight = new THREE.SpotLight(0x8899cc, 0.5);
                    rLight.position.set(rackX, studioH - 0.5, 0.5);
                    rLight.target.position.set(rackX, 0.8, -0.25);
                    rLight.angle = Math.PI / 5;
                    rLight.penumbra = 0.5;
                    rLight.userData.type = 'environment';
                    scene.add(rLight);
                    scene.add(rLight.target);
                });

                // Subtle LED accent strip along desk back edge
                const ledMat = new THREE.MeshStandardMaterial({
                    color: 0x003388, emissive: 0x0033ff, emissiveIntensity: 0.3, side: THREE.DoubleSide
                });
                const ledStrip = new THREE.Mesh(new THREE.PlaneGeometry(deskW, 0.015), ledMat);
                ledStrip.rotation.x = -Math.PI / 2;
                ledStrip.position.set(0, 0.95, -0.25 - deskD / 2 + 0.01);
                ledStrip.userData.type = 'environment';
                scene.add(ledStrip);

                // --- Monitor speaker stands (poles from ground) ---
                const monPoleMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.8, roughness: 0.25 });
                const monPlatMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1e, metalness: 0.4, roughness: 0.6 });
                [{ x: -1.2, z: -0.9 }, { x: 1.2, z: -0.9 }].forEach(({ x, z }) => {
                    // Base
                    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 0.03, 16), monPoleMat);
                    base.position.set(x, 0.015, z);
                    base.userData.type = 'environment';
                    scene.add(base);
                    // Pole
                    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.1, 8), monPoleMat);
                    pole.position.set(x, 0.58, z);
                    pole.userData.type = 'environment';
                    scene.add(pole);
                    // Top platform
                    const plat = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.02, 0.22), monPlatMat);
                    plat.position.set(x, 1.14, z);
                    plat.userData.type = 'environment';
                    scene.add(plat);
                });

                // --- Wall details ---
                // LED strip along floor on back wall
                const wallLedMat = new THREE.MeshStandardMaterial({
                    color: 0x220044, emissive: 0x6622cc, emissiveIntensity: 0.25, side: THREE.DoubleSide
                });
                const backFloorLed = new THREE.Mesh(new THREE.PlaneGeometry(studioW - 1, 0.02), wallLedMat);
                backFloorLed.rotation.x = -Math.PI / 2;
                backFloorLed.position.set(0, 0.01, -studioD / 2 + 0.06);
                backFloorLed.userData.type = 'environment';
                scene.add(backFloorLed);

                // LED strips along floor on side walls
                [-studioW / 2 + 0.06, studioW / 2 - 0.06].forEach(wx => {
                    const sideLed = new THREE.Mesh(new THREE.PlaneGeometry(studioD - 1, 0.02), wallLedMat);
                    sideLed.rotation.x = -Math.PI / 2;
                    sideLed.rotation.z = Math.PI / 2;
                    sideLed.position.set(wx, 0.01, 0);
                    sideLed.userData.type = 'environment';
                    scene.add(sideLed);
                });

                // Floating shelves on side walls — placed away from foam panels (foam at z ≈ -1.1 to 1.1)
                const shelfDecMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1e, metalness: 0.3, roughness: 0.7 });
                [
                    { x: -studioW / 2 + 0.18, z: -2.5 },
                    { x: -studioW / 2 + 0.18, z: 2.0 },
                    { x: studioW / 2 - 0.18, z: -2.5 },
                    { x: studioW / 2 - 0.18, z: 2.0 },
                ].forEach(({ x, z }) => {
                    const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.02, 0.45), shelfDecMat);
                    shelf.position.set(x, 1.6, z);
                    shelf.userData.type = 'environment';
                    scene.add(shelf);
                    const obj = new THREE.Mesh(
                        new THREE.BoxGeometry(0.12, 0.14, 0.02),
                        new THREE.MeshStandardMaterial({ color: 0x222230, roughness: 0.6 })
                    );
                    obj.position.set(x, 1.69, z);
                    obj.userData.type = 'environment';
                    scene.add(obj);
                });

                // Framed prints / gold records on back wall — above the foam panels (top row ends ~y=2.5)
                const frameMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.7, roughness: 0.3 });
                const artMat = new THREE.MeshStandardMaterial({ color: 0x141420, roughness: 0.5 });
                [-1.8, 0, 1.8].forEach(fx => {
                    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.03), frameMat);
                    frame.position.set(fx, 2.8, -studioD / 2 + 0.08);
                    frame.userData.type = 'environment';
                    scene.add(frame);
                    const art = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.01), artMat);
                    art.position.set(fx, 2.8, -studioD / 2 + 0.10);
                    art.userData.type = 'environment';
                    scene.add(art);
                });

                // Gold record disc on center frame
                const discMat = new THREE.MeshStandardMaterial({ color: 0xc9a84c, metalness: 0.9, roughness: 0.2 });
                const disc = new THREE.Mesh(new THREE.CircleGeometry(0.12, 24), discMat);
                disc.position.set(0, 2.8, -studioD / 2 + 0.11);
                disc.userData.type = 'environment';
                scene.add(disc);

                break;
            }

            case 'Musician': {
                // Cozy rehearsal / live-room studio — warm hardwood floor
                floor.material = new THREE.MeshStandardMaterial({ 
                    color: 0x3d2816, roughness: 0.7, metalness: 0.05
                });

                // Replace default table with invisible floor-level reference
                while (tableGroup.children.length > 0) tableGroup.remove(tableGroup.children[0]);
                const stageRef = new THREE.Mesh(
                    new THREE.BoxGeometry(8, 0.01, 6),
                    new THREE.MeshStandardMaterial({ visible: false })
                );
                stageRef.position.set(0, 0.005, 0);
                tableGroup.add(stageRef);
                djTableRef.current = stageRef;

                const mRoomW = 12, mRoomD = 10, mRoomH = 3.4;
                const mWallMat = new THREE.MeshStandardMaterial({
                    color: 0x1a1510, roughness: 0.95, metalness: 0.0, side: THREE.DoubleSide
                });

                // Walls
                const mBackWall = new THREE.Mesh(new THREE.PlaneGeometry(mRoomW, mRoomH), mWallMat);
                mBackWall.rotation.y = Math.PI;
                mBackWall.position.set(0, mRoomH / 2, -mRoomD / 2);
                mBackWall.receiveShadow = true;
                mBackWall.userData.type = 'environment';
                scene.add(mBackWall);

                const mLeftWall = new THREE.Mesh(new THREE.PlaneGeometry(mRoomD, mRoomH), mWallMat.clone());
                mLeftWall.rotation.y = Math.PI / 2;
                mLeftWall.position.set(-mRoomW / 2, mRoomH / 2, 0);
                mLeftWall.receiveShadow = true;
                mLeftWall.userData.type = 'environment';
                scene.add(mLeftWall);

                const mRightWall = new THREE.Mesh(new THREE.PlaneGeometry(mRoomD, mRoomH), mWallMat.clone());
                mRightWall.rotation.y = -Math.PI / 2;
                mRightWall.position.set(mRoomW / 2, mRoomH / 2, 0);
                mRightWall.receiveShadow = true;
                mRightWall.userData.type = 'environment';
                scene.add(mRightWall);

                const mFrontWall = new THREE.Mesh(new THREE.PlaneGeometry(mRoomW, mRoomH), mWallMat.clone());
                mFrontWall.position.set(0, mRoomH / 2, mRoomD / 2);
                mFrontWall.receiveShadow = true;
                mFrontWall.userData.type = 'environment';
                scene.add(mFrontWall);

                const mCeiling = new THREE.Mesh(new THREE.PlaneGeometry(mRoomW, mRoomD), mWallMat.clone());
                mCeiling.rotation.x = Math.PI / 2;
                mCeiling.position.set(0, mRoomH, 0);
                mCeiling.userData.type = 'environment';
                scene.add(mCeiling);

                // --- Recording studio glass pane (left wall — control room window) ---
                const glassPane = new THREE.Mesh(
                    new THREE.BoxGeometry(0.06, 1.6, 2.8),
                    new THREE.MeshPhysicalMaterial({
                        color: 0x88aacc, transparent: true, opacity: 0.18,
                        roughness: 0.05, metalness: 0.1, transmission: 0.7,
                        side: THREE.DoubleSide
                    })
                );
                glassPane.position.set(-mRoomW / 2 + 0.08, 1.5, -1.0);
                glassPane.userData.type = 'environment';
                scene.add(glassPane);

                // Glass frame (dark metal border)
                const gFrameMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.8, roughness: 0.3 });
                const gfTop = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 2.88), gFrameMat);
                gfTop.position.set(-mRoomW / 2 + 0.08, 2.32, -1.0);
                gfTop.userData.type = 'environment';
                scene.add(gfTop);
                const gfBot = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 2.88), gFrameMat);
                gfBot.position.set(-mRoomW / 2 + 0.08, 0.68, -1.0);
                gfBot.userData.type = 'environment';
                scene.add(gfBot);
                const gfL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.68, 0.04), gFrameMat);
                gfL.position.set(-mRoomW / 2 + 0.08, 1.5, -2.44);
                gfL.userData.type = 'environment';
                scene.add(gfL);
                const gfR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.68, 0.04), gFrameMat);
                gfR.position.set(-mRoomW / 2 + 0.08, 1.5, 0.44);
                gfR.userData.type = 'environment';
                scene.add(gfR);

                // Dim light behind glass (simulates control room glow)
                const ctrlGlow = new THREE.PointLight(0x4466aa, 0.3, 5);
                ctrlGlow.position.set(-mRoomW / 2 - 0.5, 1.5, -1.0);
                ctrlGlow.userData.type = 'environment';
                scene.add(ctrlGlow);

                // --- Soundproofing panels on back wall ---
                const spColors = [0x2a211a, 0x332a1e, 0x261e16, 0x2e2518];
                for (let row = 0; row < 3; row++) {
                    for (let col = -3; col <= 3; col++) {
                        const panel = new THREE.Mesh(
                            new THREE.BoxGeometry(0.75, 0.75, 0.07),
                            new THREE.MeshStandardMaterial({
                                color: spColors[(row + col + 8) % 4],
                                roughness: 1.0
                            })
                        );
                        panel.position.set(col * 0.85, 0.8 + row * 0.85, -mRoomD / 2 + 0.04);
                        panel.userData.type = 'environment';
                        scene.add(panel);
                    }
                }

                // --- Acoustic panels on right wall ---
                const mFoamColors = [0x2a211a, 0x332a1e, 0x261e16];
                for (let row = 0; row < 3; row++) {
                    for (let col = -2; col <= 2; col++) {
                        const rfp = new THREE.Mesh(
                            new THREE.BoxGeometry(0.06, 0.55, 0.55),
                            new THREE.MeshStandardMaterial({ color: mFoamColors[(row + col + 6) % 3], roughness: 1.0 })
                        );
                        rfp.position.set(mRoomW / 2 - 0.04, 0.9 + row * 0.65, col * 0.65);
                        rfp.userData.type = 'environment';
                        scene.add(rfp);
                    }
                }

                // --- Area rug ---
                const rug = new THREE.Mesh(
                    new THREE.PlaneGeometry(5, 4),
                    new THREE.MeshStandardMaterial({ color: 0x1e1412, roughness: 1.0, side: THREE.DoubleSide })
                );
                rug.rotation.x = -Math.PI / 2;
                rug.position.set(0, 0.005, 0);
                rug.userData.type = 'environment';
                scene.add(rug);
                const rugBorder = new THREE.Mesh(
                    new THREE.PlaneGeometry(5.3, 4.3),
                    new THREE.MeshStandardMaterial({ color: 0x2a1c14, roughness: 1.0, side: THREE.DoubleSide })
                );
                rugBorder.rotation.x = -Math.PI / 2;
                rugBorder.position.set(0, 0.003, 0);
                rugBorder.userData.type = 'environment';
                scene.add(rugBorder);

                // --- Furniture: keyboard stand (back-left), instrument table (back-right), drum riser (back-center) ---
                const standMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.7, roughness: 0.3 });
                const standTopMat = new THREE.MeshStandardMaterial({ color: 0x222226, metalness: 0.4, roughness: 0.6 });

                // Helper: builds a small table (flat top + 4 legs)
                const buildStand = (sx, sz, sw, sd, sh) => {
                    const g = new THREE.Group();
                    const top = new THREE.Mesh(new THREE.BoxGeometry(sw, 0.025, sd), standTopMat);
                    top.position.set(0, sh, 0);
                    top.receiveShadow = true;
                    g.add(top);
                    const legH = sh - 0.012;
                    const legGeo = new THREE.BoxGeometry(0.04, legH, 0.04);
                    [[-1,-1],[-1,1],[1,-1],[1,1]].forEach(([lx, lz]) => {
                        const leg = new THREE.Mesh(legGeo, standMat);
                        leg.position.set(lx * (sw / 2 - 0.04), legH / 2, lz * (sd / 2 - 0.04));
                        leg.castShadow = true;
                        g.add(leg);
                    });
                    g.position.set(sx, 0, sz);
                    g.userData.type = 'environment';
                    return g;
                };

                // Keyboard stand — back left
                scene.add(buildStand(-1.8, -1.2, 1.2, 0.5, 0.78));
                // Instrument table — back right
                scene.add(buildStand(1.8, -1.2, 1.0, 0.5, 0.78));
                // Drum riser — back center (wide low platform)
                const drumRiser = new THREE.Mesh(
                    new THREE.BoxGeometry(1.6, 0.12, 1.2),
                    new THREE.MeshStandardMaterial({ color: 0x1a1614, roughness: 0.8 })
                );
                drumRiser.position.set(0, 0.06, -1.3);
                drumRiser.receiveShadow = true;
                drumRiser.userData.type = 'environment';
                scene.add(drumRiser);

                // Guitar / bass racks for front-left and front-right
                const buildGuitarRack = (rx, rz) => {
                    const g = new THREE.Group();
                    const rackMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.8, roughness: 0.3 });

                    // Base plate
                    const basePlate = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.03, 0.4), rackMat);
                    basePlate.position.set(0, 0.015, 0);
                    g.add(basePlate);

                    // Vertical back post
                    const backPost = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.1, 0.04), rackMat);
                    backPost.position.set(0, 0.58, -0.16);
                    g.add(backPost);

                    // Upper yoke arms (two prongs to hold guitar neck)
                    [-0.08, 0.08].forEach(ox => {
                        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.18), rackMat);
                        arm.position.set(ox, 1.05, -0.05);
                        g.add(arm);
                        const tip = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.06, 0.02), rackMat);
                        tip.position.set(ox, 1.07, 0.04);
                        g.add(tip);
                    });

                    // Lower body cradle — angled rest
                    const cradle = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.02, 0.2), rackMat);
                    cradle.position.set(0, 0.35, 0.02);
                    g.add(cradle);
                    // Cradle lip (front edge to stop guitar sliding)
                    const lip = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.06, 0.02), rackMat);
                    lip.position.set(0, 0.37, 0.11);
                    g.add(lip);

                    // Rubber padding strips on cradle (subtle detail)
                    const padMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });
                    [-0.1, 0, 0.1].forEach(px => {
                        const pad = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.025, 0.18), padMat);
                        pad.position.set(px, 0.36, 0.02);
                        g.add(pad);
                    });

                    g.position.set(rx, 0, rz);
                    g.userData.type = 'environment';
                    return g;
                };

                scene.add(buildGuitarRack(-2.0, 0.4));
                scene.add(buildGuitarRack(2.0, 0.4));

                // --- Edison-style pendant lights ---
                const pendantPositions = [
                    { x: -2.0, z: -0.5 }, { x: -0.7, z: 0.2 }, { x: 0, z: -0.4 },
                    { x: 0.7, z: 0.2 }, { x: 2.0, z: -0.5 },
                    { x: -1.0, z: -1.2 }, { x: 1.0, z: -1.2 }
                ];
                const bulbMat = new THREE.MeshStandardMaterial({
                    color: 0xffaa44, emissive: 0xffaa44, emissiveIntensity: 0.8
                });
                const wireMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8, roughness: 0.3 });

                pendantPositions.forEach(({ x, z }, i) => {
                    const wireLen = 0.5 + (i % 3) * 0.2;
                    const bulbY = mRoomH - wireLen;
                    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, wireLen, 6), wireMat);
                    wire.position.set(x, mRoomH - wireLen / 2, z);
                    wire.userData.type = 'environment';
                    scene.add(wire);
                    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 12), bulbMat);
                    bulb.position.set(x, bulbY, z);
                    bulb.userData.type = 'environment';
                    scene.add(bulb);
                    const pLight = new THREE.PointLight(0xffaa44, 0.35, 5);
                    pLight.position.set(x, bulbY, z);
                    pLight.userData.type = 'environment';
                    scene.add(pLight);
                });

                // Warm fill light
                const mFillLight = new THREE.PointLight(0xffd0a0, 0.25);
                mFillLight.position.set(0, mRoomH - 0.2, 0);
                mFillLight.userData.type = 'environment';
                scene.add(mFillLight);

                // Stage accent spots
                [[-2.2, 0.4], [0, -1.0], [2.2, 0.4]].forEach(([tx, tz]) => {
                    const spot = new THREE.SpotLight(0xffcc88, 0.25);
                    spot.position.set(tx, mRoomH - 0.3, tz + 1.5);
                    spot.target.position.set(tx, 0, tz);
                    spot.angle = Math.PI / 5;
                    spot.penumbra = 0.7;
                    spot.userData.type = 'environment';
                    scene.add(spot);
                    scene.add(spot.target);
                });

                break;
            }
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

        // NDC from the canvas rect, not the window — the canvas no longer
        // spans the full viewport (header above, framed panel on desktop).
        const rect = rendererRef.current.domElement.getBoundingClientRect();
        const mouse = new THREE.Vector2();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

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

        const isBasicSetupCompleted = isBasicComplete !== null ? isBasicComplete : basicSetupComplete;

        // Clear previous spots
        ghostSpotsRef.current.forEach((spot) => {
            if (spot && spot.parent) scene.remove(spot);
            if (spot?.geometry) spot.geometry.dispose();
            if (spot?.material) spot.material.dispose();
        });
        ghostSpotsRef.current = [];

        const layout = (currentLayoutRef.current && currentLayoutRef.current.length)
            ? currentLayoutRef.current
            : getDefaultLayout(currentSetupType);

        // Reveal-gated spots only show once basic setup is complete.
        const visibleSpots = layout.filter((s) => !s.revealAfterBasic || isBasicSetupCompleted);

        visibleSpots.forEach((spot, index) => {
            const width = spot.size?.width ?? 0.3;
            const depth = spot.size?.depth ?? 0.3;
            const geometry = new THREE.BoxGeometry(width, 0.05, depth);
            const material = new THREE.MeshBasicMaterial({
                color: 0x808080,
                transparent: true,
                opacity: 0.4,
            });

            const ghostSquare = new THREE.Mesh(geometry, material);
            ghostSquare.position.set(spot.x, spot.y, spot.z);
            if (spot.rotationY) ghostSquare.rotation.y = spot.rotationY;
            ghostSquare.userData = {
                index,
                defaultColor: 0x808080,
                hoverColor: 0xa0a0a0,
                type: spot.type,
                recommendedType: spot.recommendedType || 'Any Device',
                spotId: spot.id,
            };

            scene.add(ghostSquare);
            ghostSpotsRef.current.push(ghostSquare);
        });

        // Hide ghost squares that already have a product on them, then render.
        applyGhostOccupancyVisibility();
    }

    // Hide a ghost square whenever a placed device occupies its spot (matched by
    // placementIndex, with a position fallback to mirror handleGhostSquareClick),
    // and show it again when the spot is empty.
    function applyGhostOccupancyVisibility() {
        const list = placedDevicesListRef.current || [];
        ghostSpotsRef.current.forEach((ghost, index) => {
            if (!ghost) return;
            const occupied = list.some((d) => d.placementIndex === index) || list.some((d) => {
                const p = d.position;
                if (!p || typeof p.x !== 'number') return false;
                const dx = p.x - ghost.position.x;
                const dz = (p.z ?? 0) - (ghost.position.z ?? 0);
                return Math.abs(dx) < 0.05 && Math.abs(dz) < 0.05;
            });
            ghost.visible = !occupied;
        });
        if (rendererRef.current && sceneRef.current && cameraRef.current) {
            rendererRef.current.render(sceneRef.current, cameraRef.current);
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

            const isClick = event.type === 'click' || (event.type === 'touchend' && !isPinchingRef.current);
            const isMove = event.type === 'mousemove';

            // When not mapping connections, check for hit on a placed device
            if (!isConnectionMapping) {
                const deviceMeshes = Object.values(devicesRef.current).map(r => r.model).filter(Boolean);
                if (deviceMeshes.length > 0) {
                    const deviceHits = raycaster.intersectObjects(deviceMeshes, true);

                    // --- Hover highlight (mousemove only) ---
                    if (isMove) {
                        let newHoverId = null;
                        if (deviceHits.length > 0) {
                            let node = deviceHits[0].object;
                            while (node && !node.userData?.uniqueId) node = node.parent;
                            newHoverId = node?.userData?.uniqueId || null;
                        }
                        if (newHoverId !== hoveredDeviceUniqueIdRef.current) {
                            if (hoveredDeviceUniqueIdRef.current) clearHoverHighlight(hoveredDeviceUniqueIdRef.current);
                            if (newHoverId) applyHoverHighlight(newHoverId);
                            hoveredDeviceUniqueIdRef.current = newHoverId;
                            if (rendererRef.current?.domElement) {
                                rendererRef.current.domElement.style.cursor = newHoverId ? 'pointer' : '';
                            }
                        }
                    }

                    // --- Click: open hover menu ---
                    if (isClick && deviceHits.length > 0) {
                        let obj = deviceHits[0].object;
                        while (obj && !obj.userData?.uniqueId) obj = obj.parent;
                        const uniqueId = obj?.userData?.uniqueId;
                        if (uniqueId) {
                            const ref = devicesRef.current[uniqueId];
                            if (ref?.data) {
                                setMenuDevice(ref.data);
                                setMenuScreenPos(projectMenuAnchor(uniqueId));
                                // Prevent this click from bubbling to the window-level
                                // dismiss listener that would otherwise close the menu
                                // before the user sees it.
                                event.stopPropagation();
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

                if (isClick) {
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

    const removeDevice = (uniqueId) => {
        const device = placedDevicesList.find(d => d.uniqueId === uniqueId);
        if (device) {
            const ref = devicesRef.current[uniqueId];
            if (ref?.model) {
                sceneRef.current.remove(ref.model);
                ref.model.traverse(child => {
                    if (child.isMesh) {
                        child.geometry?.dispose();
                        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                        else child.material?.dispose();
                    }
                });
            }
            delete devicesRef.current[uniqueId];

            // Remove cables connected to this specific device instance
            cablesRef.current = cablesRef.current.filter(cable => {
                const ud = cable.userData;
                if (ud.sourceDeviceUniqueId === uniqueId || ud.targetDeviceUniqueId === uniqueId ||
                    (ud.sourceDevice === device.id && !ud.sourceDeviceUniqueId) ||
                    (ud.targetDevice === device.id && !ud.targetDeviceUniqueId)) {
                    sceneRef.current.remove(cable);
                    cable.geometry?.dispose();
                    cable.material?.dispose();
                    return false;
                }
                return true;
            });

            if (menuDevice?.uniqueId === uniqueId) {
                setMenuDevice(null);
            }

            updatePlacedDevicesList(device, 'remove');

            if (rendererRef.current && sceneRef.current && cameraRef.current) {
                rendererRef.current.render(sceneRef.current, cameraRef.current);
            }
        }
    };

    // Remove every placed device and cable from the scene. Used when switching
    // scene variants: ghost-spot layouts are unique per scene, so carried-over
    // gear would float in mid-air in the new environment.
    const clearAllDevices = () => {
        Object.values(devicesRef.current).forEach((ref) => {
            if (ref?.model) {
                sceneRef.current.remove(ref.model);
                ref.model.traverse(child => {
                    if (child.isMesh) {
                        child.geometry?.dispose();
                        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                        else child.material?.dispose();
                    }
                });
            }
        });
        devicesRef.current = {};

        cablesRef.current.forEach(cable => {
            sceneRef.current.remove(cable);
            cable.geometry?.dispose();
            cable.material?.dispose();
        });
        cablesRef.current = [];

        setMenuDevice(null);
        setBasicSetupComplete(false);
        setPlacedDevicesList([]);
    };

    // Perform the actual switch. Same-type switches keep internal state in
    // sync directly; cross-type switches go through App state so the devices
    // prop, ghost-spot layout, and brain logic all follow the new type (the
    // [setupType, setting] prop effect then updates internal state).
    const performSwitch = (type, key) => {
        if (type === currentSetupType) {
            setCurrentSetting(key);
            onSettingChange?.(key);
        } else if (onSetupTypeChange) {
            onSetupTypeChange(type, key);
        } else {
            setCurrentSetupType(type);
            setCurrentSetting(key);
        }
    };

    // Scene switcher entry point: ask before discarding placed gear; switch
    // silently when the scene is empty.
    const requestSettingSwitch = (type, key) => {
        if (type === currentSetupType && key === currentSetting) return;
        if (placedDevicesList.length > 0) {
            setPendingSwitch({ type, key });
        } else {
            performSwitch(type, key);
        }
    };

    const confirmSettingSwitch = () => {
        if (!pendingSwitch) return;
        clearAllDevices();
        performSwitch(pendingSwitch.type, pendingSwitch.key);
        setPendingSwitch(null);
    };

    // Hover highlight helpers
    const applyHoverHighlight = (uniqueId) => {
        const entry = devicesRef.current[uniqueId];
        if (!entry || !entry.model) return;
        const saved = [];
        entry.model.traverse((node) => {
            if (node.isMesh && node.material && 'emissive' in node.material) {
                saved.push({ mesh: node, emissive: node.material.emissive.clone(), intensity: node.material.emissiveIntensity });
                node.material.emissive.setHex(0xD9C2A0);
                node.material.emissiveIntensity = 0.35;
            }
        });
        hoverHighlightStateRef.current.set(uniqueId, saved);
    };

    const clearHoverHighlight = (uniqueId) => {
        const saved = hoverHighlightStateRef.current.get(uniqueId);
        if (!saved) return;
        saved.forEach(({ mesh, emissive, intensity }) => {
            if (mesh.material && 'emissive' in mesh.material) {
                mesh.material.emissive.copy(emissive);
                mesh.material.emissiveIntensity = intensity;
            }
        });
        hoverHighlightStateRef.current.delete(uniqueId);
    };

    const projectMenuAnchor = (uniqueId) => {
        const entry = devicesRef.current[uniqueId];
        if (!entry?.model || !cameraRef.current || !mountRef.current) return { x: 0, y: 0 };
        const box = new THREE.Box3().setFromObject(entry.model);
        const top = new THREE.Vector3(
            (box.min.x + box.max.x) / 2,
            box.max.y,
            (box.min.z + box.max.z) / 2
        );
        top.project(cameraRef.current);
        const rect = mountRef.current.getBoundingClientRect();
        return {
            x: rect.left + ((top.x + 1) / 2) * rect.width,
            y: rect.top + ((1 - top.y) / 2) * rect.height,
        };
    };

    // Keep menuDeviceRef in sync for use inside animation loop closures
    useEffect(() => {
        menuDeviceRef.current = menuDevice;
    }, [menuDevice]);

    // Dismiss hover menu on Escape or outside click
    useEffect(() => {
        if (!menuDevice) return;
        const onKey = (e) => { if (e.key === 'Escape') setMenuDevice(null); };
        const onDown = () => setMenuDevice(null);
        window.addEventListener('keydown', onKey);
        // Use 'click' (not 'mousedown') so the menu's onClick stopPropagation
        // can prevent dismissal when the user clicks a button inside the menu.
        window.addEventListener('click', onDown);
        return () => {
            window.removeEventListener('keydown', onKey);
            window.removeEventListener('click', onDown);
        };
    }, [menuDevice]);

    // Dismiss the "more scenes" dropdown on Escape or outside click
    useEffect(() => {
        if (!showSceneMenu) return;
        const onKey = (e) => { if (e.key === 'Escape') setShowSceneMenu(false); };
        const onDown = () => setShowSceneMenu(false);
        window.addEventListener('keydown', onKey);
        window.addEventListener('click', onDown);
        return () => {
            window.removeEventListener('keydown', onKey);
            window.removeEventListener('click', onDown);
        };
    }, [showSceneMenu]);

    // Update currentSetupType when setupType prop changes. Reset the setting
    // to that type's default unless a setting prop is supplied explicitly.
    useEffect(() => {
        const nextType = setupType || 'DJ';
        setCurrentSetupType(nextType);
        if (setting && SETTINGS[nextType]?.[setting]) {
            setCurrentSetting(setting);
        } else {
            setCurrentSetting(defaultSettingFor(nextType));
        }
    }, [setupType, setting]);

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
                    case SPOT_TYPES.FX_TOP: return 'FX Unit (RMX-1000)';
                    case SPOT_TYPES.FX_LEFT: return 'FX / Filter (Revolo)';
                    case SPOT_TYPES.FX_RIGHT: return 'FX / Filter (Revolo)';
                    case SPOT_TYPES.FX_FRONT: return 'FX Unit / Sampler';
                    case SPOT_TYPES.SPEAKER_LEFT:
                    case SPOT_TYPES.SPEAKER_RIGHT: return 'Speaker';
                    default: return 'Any Device';
                }
            case 'Producer':
                switch (spotType) {
                    case SPOT_TYPES.DESK_CENTER: return 'Audio Interface';
                    case SPOT_TYPES.DESK_LEFT:
                    case SPOT_TYPES.DESK_RIGHT: return 'Controller / Synth';
                    case SPOT_TYPES.RACK_LEFT_1:
                    case SPOT_TYPES.RACK_LEFT_2:
                    case SPOT_TYPES.RACK_LEFT_3:
                    case SPOT_TYPES.RACK_LEFT_4:
                    case SPOT_TYPES.RACK_RIGHT_1:
                    case SPOT_TYPES.RACK_RIGHT_2:
                    case SPOT_TYPES.RACK_RIGHT_3:
                    case SPOT_TYPES.RACK_RIGHT_4: return 'Rack Unit / Processor';
                    case SPOT_TYPES.MONITOR_LEFT:
                    case SPOT_TYPES.MONITOR_RIGHT: return 'Studio Monitor';
                    default: return 'Any Device';
                }
            case 'Musician':
                switch (spotType) {
                    case SPOT_TYPES.STAGE_CENTER: return 'Instrument / Mic';
                    case SPOT_TYPES.STAGE_LEFT:
                    case SPOT_TYPES.STAGE_RIGHT: return 'Guitar / Bass';
                    case SPOT_TYPES.STAGE_BACK_LEFT:
                    case SPOT_TYPES.STAGE_BACK_RIGHT: return 'Keyboard / Instrument';
                    case SPOT_TYPES.STAGE_BACK_CENTER: return 'Drums / Instrument';
                    case SPOT_TYPES.PEDAL_1:
                    case SPOT_TYPES.PEDAL_2:
                    case SPOT_TYPES.PEDAL_3:
                    case SPOT_TYPES.PEDAL_4: return 'Effects Pedal';
                    case SPOT_TYPES.AMP_LEFT:
                    case SPOT_TYPES.AMP_RIGHT: return 'Amplifier / Monitor';
                    default: return 'Instrument or Effects';
                }
            default:
                return 'Any Device';
        }
    };

    const rebuildGhostSpots = useCallback(() => {
        if (!sceneRef.current) return;
        const isComplete = checkBasicSetupComplete(placedDevicesListRef.current || []);
        createGhostPlacementSpots(sceneRef.current, isComplete);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const persistLayout = useCallback((spots) => {
        currentLayoutRef.current = spots;
        rebuildGhostSpots();
        saveLayout(currentSetupType, currentSetting, spots).catch((err) =>
            console.error('Failed to save ghost-spot layout:', err)
        );
    }, [currentSetupType, currentSetting, rebuildGhostSpots]);

    const previewSpot = useCallback((draftSpot) => {
        const layout = currentLayoutRef.current.map((s) => (s.id === draftSpot.id ? draftSpot : s));
        currentLayoutRef.current = layout;
        rebuildGhostSpots();
    }, [rebuildGhostSpots]);

    const handleGhostContextMenu = (event) => {
        if (!isAdminRef.current || !rendererRef.current || !cameraRef.current) return;
        const rect = rendererRef.current.domElement.getBoundingClientRect();
        const mouse = new THREE.Vector2(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1
        );
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, cameraRef.current);
        const hits = raycaster.intersectObjects(ghostSpotsRef.current);
        if (hits.length === 0) return;
        event.preventDefault();
        const spotIndex = hits[0].object.userData.index;
        setGhostMenu({
            screenX: event.clientX - rect.left,
            screenY: event.clientY - rect.top,
            spotIndex,
        });
    };

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

    const snapCameraToAngle = ({ position, target }) => {
        if (!cameraRef.current || !controlsRef.current) return;
        gsap.to(cameraRef.current.position, {
            x: position.x, y: position.y, z: position.z,
            duration: 1.5,
            ease: 'power2.inOut',
            onUpdate: () => { cameraRef.current.lookAt(target.x, target.y, target.z); }
        });
        gsap.to(controlsRef.current.target, {
            x: target.x, y: target.y, z: target.z,
            duration: 1.5,
            ease: 'power2.inOut',
            onUpdate: () => { controlsRef.current.update(); }
        });
    };

    const handleSaveCameraAngle = (slotIndex) => {
        if (!cameraRef.current || !controlsRef.current) return;
        const newAngles = [...cameraAngles];
        newAngles[slotIndex] = {
            position: {
                x: cameraRef.current.position.x,
                y: cameraRef.current.position.y,
                z: cameraRef.current.position.z,
            },
            target: {
                x: controlsRef.current.target.x,
                y: controlsRef.current.target.y,
                z: controlsRef.current.target.z,
            }
        };
        setCameraAngles(newAngles);
        onCameraAnglesChange?.(newAngles);
    };

    const handleRecallCameraAngle = (slotIndex) => {
        const angle = cameraAngles[slotIndex];
        if (!angle) return;
        snapCameraToAngle(angle);
    };

    // Add this useEffect after your other effects
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (sceneRef.current && sceneInitialized) {
            console.log('Setup type / setting changed to:', currentSetupType, currentSetting);
            buildSetting(sceneRef.current, currentSetting);
            applySettingCamera(getSetting(currentSetupType, currentSetting));

            // Force a re-render
            if (rendererRef.current && cameraRef.current) {
                rendererRef.current.render(sceneRef.current, cameraRef.current);
            }
        }
    }, [currentSetupType, currentSetting, sceneInitialized]); // eslint-disable-line react-hooks/exhaustive-deps

    // Keep a ref copy of admin status for use inside imperative event handlers.
    useEffect(() => { isAdminRef.current = isAdmin; }, [isAdmin]);

    // Load the per-variant ghost-spot layout whenever the setup type / setting changes.
    useEffect(() => {
        if (!sceneInitialized) return;
        const token = ++layoutLoadTokenRef.current;
        loadLayout(currentSetupType, currentSetting).then((spots) => {
            if (token !== layoutLoadTokenRef.current) return; // a newer load superseded us
            currentLayoutRef.current = spots;
            if (sceneRef.current) {
                const isComplete = checkBasicSetupComplete(placedDevicesListRef.current || []);
                createGhostPlacementSpots(sceneRef.current, isComplete);
            }
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentSetupType, currentSetting, sceneInitialized]);

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

    // Toggle ghost-square visibility whenever devices are added/removed/loaded.
    useEffect(() => {
        applyGhostOccupancyVisibility();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- applyGhostOccupancyVisibility is a stable hoisted function
    }, [placedDevicesList]);


    const handleBuyClick = (device, source) => {
        const link = buildBuyLink(device, affiliateAttribution);
        if (!link) return;
        // window.open must run synchronously in the click handler or popup
        // blockers eat it; the ledger write is fire-and-forget afterwards.
        window.open(link.url, '_blank', 'noopener');
        logAffiliateClick(db, buildClickPayload({
            product: device,
            attribution: affiliateAttribution,
            clickerUid: auth?.currentUser?.uid || null,
            source,
            urlKind: link.urlKind,
            retailer: link.retailer,
            monetized: link.monetized,
        }));
    };

    const menuBuyLink = menuDevice ? buildBuyLink(menuDevice, affiliateAttribution) : null;

    return (
        <>
            <BuilderInstructionsModal />
            <div ref={mountRef} onContextMenu={handleGhostContextMenu} style={{
                width: "100%",
                height: isMobile ? "calc(100vh - 60px)" : "100%",
                touchAction: "none",
                backgroundColor: "#0a0a0a"
            }}>
                <div
                    style={{
                        position: 'absolute',
                        top: '20px',
                        left: '20px',
                        zIndex: 250,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                    }}
                >
                    <div
                        className="setting-switcher"
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '4px',
                            borderRadius: '999px',
                            background: 'rgba(15, 15, 20, 0.72)',
                            backdropFilter: 'blur(10px)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
                            gap: '2px',
                        }}
                        role="group"
                        aria-label="Scene setting"
                    >
                        {listSettings(currentSetupType).map((s) => {
                            const active = s.key === currentSetting;
                            return (
                                <button
                                    key={s.key}
                                    type="button"
                                    onClick={() => requestSettingSwitch(currentSetupType, s.key)}
                                    style={{
                                        appearance: 'none',
                                        border: 'none',
                                        padding: '6px 14px',
                                        borderRadius: '999px',
                                        fontSize: '12px',
                                        fontWeight: 600,
                                        letterSpacing: '0.02em',
                                        cursor: 'pointer',
                                        color: active ? '#0a0a0a' : 'rgba(255,255,255,0.78)',
                                        background: active ? '#fff' : 'transparent',
                                        transition: 'background 0.15s ease, color 0.15s ease',
                                    }}
                                    aria-pressed={active}
                                >
                                    {s.label}
                                </button>
                            );
                        })}
                        <button
                            type="button"
                            className="scene-menu-toggle"
                            onClick={(e) => { e.stopPropagation(); setShowSceneMenu((v) => !v); }}
                            aria-label="Scenes in other setup types"
                            title="More scenes"
                            style={{
                                appearance: 'none',
                                border: 'none',
                                background: 'transparent',
                                cursor: 'pointer',
                                padding: '6px 10px 6px 8px',
                                borderRadius: '999px',
                                borderTopLeftRadius: 0,
                                borderBottomLeftRadius: 0,
                                borderLeft: '1px solid rgba(255,255,255,0.12)',
                                marginLeft: '2px',
                                color: 'rgba(255,255,255,0.78)',
                                fontSize: '12px',
                                fontWeight: 600,
                                display: 'flex',
                                alignItems: 'center',
                            }}
                        >
                            ▾
                        </button>
                    </div>
                    <button
                        type="button"
                        className="lighting-toggle"
                        onClick={() => setLightingMode((m) => (m === 'day' ? 'night' : 'day'))}
                        aria-label={lightingMode === 'day' ? 'Switch scene to night lighting' : 'Switch scene to day lighting'}
                        title={lightingMode === 'day' ? 'Night lighting' : 'Day lighting'}
                        style={{
                            appearance: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '34px',
                            height: '34px',
                            padding: 0,
                            borderRadius: '999px',
                            background: 'rgba(15, 15, 20, 0.72)',
                            backdropFilter: 'blur(10px)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
                            color: 'rgba(255,255,255,0.85)',
                            cursor: 'pointer',
                        }}
                    >
                        {lightingMode === 'day' ? <MdNightlight size={16} /> : <MdWbSunny size={16} />}
                    </button>
                    {showSceneMenu && (
                        <div
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                position: 'absolute',
                                top: 'calc(100% + 8px)',
                                left: 0,
                                zIndex: 260,
                                minWidth: '200px',
                                maxHeight: '60vh',
                                overflowY: 'auto',
                                background: 'rgba(15, 15, 20, 0.92)',
                                backdropFilter: 'blur(12px)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                borderRadius: '12px',
                                boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                                padding: '8px',
                            }}
                        >
                            {Object.keys(SETTINGS).filter((type) => type !== currentSetupType).map((type) => (
                                <div key={type}>
                                    <div
                                        style={{
                                            fontSize: '10px',
                                            letterSpacing: '0.08em',
                                            textTransform: 'uppercase',
                                            color: 'rgba(255,255,255,0.45)',
                                            padding: '6px 10px 2px',
                                        }}
                                    >
                                        {type}
                                    </div>
                                    {listSettings(type).map((s) => (
                                        <button
                                            key={`${type}-${s.key}`}
                                            type="button"
                                            onClick={() => { setShowSceneMenu(false); requestSettingSwitch(type, s.key); }}
                                            style={{
                                                appearance: 'none',
                                                border: 'none',
                                                background: 'transparent',
                                                padding: '7px 10px',
                                                borderRadius: '8px',
                                                fontSize: '13px',
                                                cursor: 'pointer',
                                                display: 'block',
                                                width: '100%',
                                                textAlign: 'left',
                                                color: 'rgba(255,255,255,0.78)',
                                            }}
                                        >
                                            {s.label}
                                        </button>
                                    ))}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <Modal
                    open={!!pendingSwitch}
                    onClose={() => setPendingSwitch(null)}
                    title={`Switch to ${getSetting(pendingSwitch?.type, pendingSwitch?.key)?.label || 'this scene'}?`}
                    footer={(
                        <>
                            <Button variant="ghost" onClick={() => setPendingSwitch(null)}>
                                Cancel
                            </Button>
                            <Button variant="danger" onClick={confirmSettingSwitch}>
                                Clear gear & switch
                            </Button>
                        </>
                    )}
                >
                    <p style={{ margin: 0 }}>
                        Each scene has its own gear layout, so switching clears the gear
                        placed in this one. Unsaved changes to this scene will be lost —
                        hit Save Setup first if you want to keep this build.
                    </p>
                    {pendingSwitch && pendingSwitch.type !== currentSetupType && (
                        <p style={{ margin: 0, marginTop: 8 }}>
                            This also switches your builder from a {currentSetupType} setup to a {pendingSwitch.type} setup.
                        </p>
                    )}
                </Modal>
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

                {/* Mobile Navigation */}
                {isMobile && (
                    <MobileNavigation
                        onOpenSearch={openHamburgerSearch}
                        placedDevicesList={placedDevicesList}
                        onRemoveDevice={removeDevice}
                        isUpdatingPaths={isUpdatingPaths}
                        onUpdateModelPaths={handleUpdateModelPaths}
                        actionsSlot={
                            <ConnectionGuideButton
                                currentDevices={placedDevicesList}
                                setupType={currentSetupType}
                            />
                        }
                        style={{
                            position: 'fixed',
                            top: '20px',
                            right: '20px',
                            zIndex: 2000
                        }}
                    />
                )}

                {/* Product Selector Modal */}
                {showSearch && (
                  <ProductSelectorModal
                    isOpen={showSearch}
                    mode={swapTargetUniqueIdRef.current ? 'swap' : 'place'}
                    recommendedType={ghostSpotsRef.current[selectedGhostIndex]?.userData?.recommendedType || 'Any Device'}
                    currentProductId={
                      swapTargetUniqueIdRef.current
                        ? placedDevicesListRef.current.find((d) => d.uniqueId === swapTargetUniqueIdRef.current)?.id
                        : null
                    }
                    products={searchResults}
                    onSelect={(product) => handleProductSelected(product)}
                    onClose={() => {
                      setShowSearch(false);
                      setSearchMode('');
                      swapTargetUniqueIdRef.current = null;
                    }}
                  />
                )}

                {showSuggestionForm && suggestionModelFile && (() => {
                    const spot = ghostSpotsRef.current[selectedGhostIndex];
                    const pos = spot ? { x: spot.position.x, y: spot.position.y, z: spot.position.z } : null;
                    return (
                        <ModelPreviewPanel
                            file={suggestionModelFile}
                            scale={suggestionModelScale}
                            onClose={() => setSuggestionModelFile(null)}
                            mainSceneRef={sceneRef}
                            ghostSpotPosition={pos}
                        />
                    );
                })()}

                {/* Device hover action menu */}
                <DeviceHoverMenu
                    device={menuDevice}
                    screenPosition={menuScreenPos}
                    onRemove={(d) => {
                        removeDevice(d.uniqueId);
                        setMenuDevice(null);
                    }}
                    onSwap={(d) => {
                        swapTargetUniqueIdRef.current = d.uniqueId;
                        const entry = placedDevicesListRef.current.find((x) => x.uniqueId === d.uniqueId);
                        if (entry) {
                            setSelectedGhostIndex(entry.placementIndex);
                            setShowSearch(true);
                        }
                        setMenuDevice(null);
                    }}
                    onBuy={menuBuyLink ? (d) => {
                        handleBuyClick(d, 'hover-menu');
                        setMenuDevice(null);
                    } : undefined}
                    buyMonetized={menuBuyLink?.cartMonetized ?? null}
                    buyTitle={menuBuyLink ? purchaseLinkNotice(menuBuyLink, affiliateAttribution) : 'Buy'}
                    onClose={() => setMenuDevice(null)}
                />

                {isAdmin && ghostMenu && (() => {
                    const layout = currentLayoutRef.current;
                    const ghost = ghostSpotsRef.current[ghostMenu.spotIndex];
                    const spotId = ghost?.userData?.spotId;
                    const spot = layout.find((s) => s.id === spotId);
                    if (!spot) return null;
                    return (
                        <GhostSpotContextMenu
                            screenPosition={{ x: ghostMenu.screenX, y: ghostMenu.screenY }}
                            recommendedType={spot.recommendedType}
                            onMove={() => {
                                setGhostEditor({ mode: 'move', spot, originalSpot: spot, insert: false });
                                setGhostMenu(null);
                            }}
                            onAdd={() => {
                                const newSpot = {
                                    ...spot,
                                    id: makeSpotType(),
                                    type: makeSpotType(),
                                    x: Math.round((spot.x + 0.4) * 1000) / 1000,
                                };
                                setGhostEditor({ mode: 'add', spot: newSpot, originalSpot: null, insert: true });
                                setGhostMenu(null);
                            }}
                            onRemove={() => {
                                // eslint-disable-next-line no-restricted-globals, no-alert
                                if (window.confirm('Remove this ghost spot for all users?')) {
                                    persistLayout(currentLayoutRef.current.filter((s) => s.id !== spot.id));
                                }
                                setGhostMenu(null);
                            }}
                            onClose={() => setGhostMenu(null)}
                        />
                    );
                })()}

                {isAdmin && ghostEditor && (
                    <GhostSpotEditorPanel
                        mode={ghostEditor.mode}
                        spot={ghostEditor.spot}
                        onChange={(draft) => {
                            if (ghostEditor.insert) {
                                const base = currentLayoutRef.current.filter((s) => s.id !== draft.id);
                                currentLayoutRef.current = [...base, draft];
                                rebuildGhostSpots();
                            } else {
                                previewSpot(draft);
                            }
                        }}
                        onSave={(draft) => {
                            if (ghostEditor.insert) {
                                const base = currentLayoutRef.current.filter((s) => s.id !== draft.id);
                                persistLayout([...base, draft]);
                            } else {
                                persistLayout(currentLayoutRef.current.map((s) => (s.id === draft.id ? draft : s)));
                            }
                            setGhostEditor(null);
                        }}
                        onCancel={() => {
                            if (ghostEditor.insert) {
                                currentLayoutRef.current = currentLayoutRef.current.filter((s) => s.id !== ghostEditor.spot.id);
                            } else if (ghostEditor.originalSpot) {
                                currentLayoutRef.current = currentLayoutRef.current.map((s) =>
                                    s.id === ghostEditor.originalSpot.id ? ghostEditor.originalSpot : s
                                );
                            }
                            rebuildGhostSpots();
                            setGhostEditor(null);
                        }}
                    />
                )}

                {sceneInitialized && (
                    <CameraAngleControls
                        cameraAngles={cameraAngles}
                        onSave={handleSaveCameraAngle}
                        onRecall={handleRecallCameraAngle}
                    />
                )}
            </div>
        </>
    );
}

export { ThreeScene };
export default ThreeScene;