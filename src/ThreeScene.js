import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { collection, getDocs, doc, getDoc, updateDoc } from "firebase/firestore"; // Import Firestore methods
import { db } from "./firebaseConfig"; // Import Firestore
import { auth } from "./firebaseConfig"; // Add auth import at the top
import { gsap } from 'gsap';
import { updateAllModelPaths } from './firebaseUtils'; // Add this import
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
    const [selectedGhostIndex, setSelectedGhostIndex] = useState(null);
    const [searchResults, setSearchResults] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [showSearch, setShowSearch] = useState(false);
    const [searchMode, setSearchMode] = useState(''); // 'hamburger' or 'ghost'
    const [selectedProduct, setSelectedProduct] = useState(null);
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
    const [showTooltip, setShowTooltip] = useState(false);
    const [tooltipContent, setTooltipContent] = useState('');
    const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
    const [isUpdatingPaths, setIsUpdatingPaths] = useState(false);
    const [showSuggestionForm, setShowSuggestionForm] = useState(false);
    const [connectionAdvice, setConnectionAdvice] = useState('');
    const [isAdviceLoading, setIsAdviceLoading] = useState(false);
    const [hasQuotaError, setHasQuotaError] = useState(false);
    const [lastApiCall, setLastApiCall] = useState(0);
    const [hiddenCategories, setHiddenCategories] = useState(new Set());

    // Product type constants
    const PRODUCT_TYPES = {
        MIXER: 'mixer',
        PLAYER: 'player',
        FX_UNIT: 'fx_unit',
        FX_UNIT_WIDE: 'fx_unit_wide'
    };

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
        FX_FRONT: 'fx_front'
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
        { x: 0, y: 1.05, z: 0.3, type: SPOT_TYPES.FX_FRONT }       // FX Front (Wide units)
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
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        zIndex: 1000,
        width: isMobile ? '90%' : 'auto',
        maxHeight: isMobile ? '80vh' : '300px',
        overflowY: 'auto',
        color: 'black'
    };

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

    // Removed unused findBestSpot function

    // Update getProductType to better identify mixers
    function getProductType(product) {
        const name = product.name.toLowerCase();
        
        // Mixer detection - expanded to catch more mixer types
        if (name.includes('mixer') || 
            name.includes('djm') || 
            name.includes('mix') || 
            (product.category && product.category.toLowerCase().includes('mixer'))) {
            console.log('Detected as MIXER:', product.name);
            return PRODUCT_TYPES.MIXER;
        }
        
        // Player detection - expanded to catch more player types
        if (name.includes('cdj') || 
            name.includes('player') || 
            name.includes('turntable') || 
            name.includes('deck') ||
            (product.category && product.category.toLowerCase().includes('player'))) {
            console.log('Detected as PLAYER:', product.name);
            return PRODUCT_TYPES.PLAYER;
        }
        
        // FX Unit detection (wide units like RMX-1000)
        if (name.includes('rmx') || product.width > 0.5) {
            console.log('Detected as FX_UNIT_WIDE:', product.name);
            return PRODUCT_TYPES.FX_UNIT_WIDE;
        }
        
        // Regular FX units
        if (name.includes('fx') || name.includes('effect')) {
            console.log('Detected as FX_UNIT:', product.name);
            return PRODUCT_TYPES.FX_UNIT;
        }
        
        console.log('No specific type detected for:', product.name);
        return null;
    }

    // Update handleProductSelect to use the new placement logic
    const handleProductSelect = (product) => {
        if (!product) return;

        console.log(`Selected product:`, product);
        console.log(`Model path for ${product.name}:`, product.modelPath);
        
        console.log(`Adding selected product: ${product.name} to position ${selectedGhostIndex}`);
        
        // Directly add the product to the selected ghost position
        addProductToPosition(product, selectedGhostIndex);

        setShowSearch(false);
        setSearchMode('');
        setSearchQuery('');
    };

    // Removed unused getConnectionKey function

    // Update the updateConnections function to maintain all connections
    function updateConnections(devices) {
        console.log('Updating connections for devices:', devices);
        
        // Find the mixer device
        const mixer = devices.find(device => device.name.includes('DJM'));
        if (!mixer) {
            console.log('No mixer found in devices');
            return;
        }

        // Find all CDJs
        const cdjs = devices.filter(device => device.name.includes('CDJ'));
        console.log('Found CDJs:', cdjs.length);

        // Clear all existing cables
        cablesRef.current.forEach(cable => {
            sceneRef.current.remove(cable);
        });
        cablesRef.current = [];

        // Draw cables for each CDJ to mixer
        cdjs.forEach(cdj => {
            const connections = findMatchingPorts(cdj, mixer);
            connections.forEach(connection => {
                // Create a unique key for this connection using uniqueIds
                const connectionKey = `${cdj.uniqueId}-${mixer.uniqueId}-${connection.sourcePort.type}-${connection.targetPort.type}`;
                
                // Check if this connection already exists
                const existingCable = cablesRef.current.find(cable => 
                    cable.userData && cable.userData.connectionKey === connectionKey
                );

                // Only create new cable if it doesn't exist
                if (!existingCable) {
                    console.log('Creating new cable for:', cdj.name, 'to mixer');
                    drawCable(cdj, mixer, connection);
                }
            });
        });

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
        const sourcePort = connection.sourcePort.coordinate;
        const targetPort = connection.targetPort.coordinate;

        // Calculate actual world positions
        const startPoint = new THREE.Vector3(
            sourcePosition.x + sourcePort.x,
            sourcePosition.y + sourcePort.y,
            sourcePosition.z + sourcePort.z
        );

        const endPoint = new THREE.Vector3(
            targetPosition.x + targetPort.x,
            targetPosition.y + targetPort.y,
            targetPosition.z + targetPort.z
        );

        // Get the line number and calculate the midpoint
        const lineNumber = parseInt(connection.targetPort.type.replace('Line', ''));
        const midPoint = new THREE.Vector3().addVectors(startPoint, endPoint).multiplyScalar(0.5);
        
        // Calculate arch parameters
        startPoint.distanceTo(endPoint); // Calculate distance for arch height
        const baseArchHeight = 0.6; // Increased base height for more pronounced arch
        const archVariation = (lineNumber - 2.5) * 0.08; // Increased variation

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
        const cableColor = cableColors[`Line${lineNumber}`] || cableColors.Default;
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
        
        // Communicate device changes to parent component
        if (onDevicesChange) {
            onDevicesChange(placedDevicesList);
        }
    }, [placedDevicesList, onDevicesChange]);

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
            const modelURL = product.modelPath || product.modelUrl;
            console.log(`Using model URL:`, modelURL);
            
            if (!modelURL) {
                console.error('No model URL found for product:', product.name);
                alert(`No 3D model found for ${product.name}. Please check the product configuration.`);
                return;
            }
            
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
                    
                    // Create device object with exact position and unique identifier
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
                        modelPath: modelURL // Ensure modelPath is set for future reference
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

                    // Update connections for all devices
                    updateConnections(placedDevices.current);

                    // Force a re-render of the scene
                    if (rendererRef.current && sceneRef.current && cameraRef.current) {
                        rendererRef.current.render(sceneRef.current, cameraRef.current);
                    }
                },
                (progress) => {
                    const percentComplete = (progress.loaded / progress.total) * 100;
                    console.log(`Loading progress: ${percentComplete.toFixed(2)}%`);
                },
                (error) => {
                    console.error("Error loading model:", error);
                    console.error("Failed model URL:", modelURL);
                    alert(`Failed to load 3D model for ${product.name}. Please check the console for details.`);
                }
            );
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
        console.log(`Ghost Square ${index} clicked! Open device selection.`);
        openSearch('ghost', index);
    }

    // Removed unused producerSetupSpots
        { x: -0.8, y: 1.05, z: -0.3 }, // Extra Synth Left (was -1.5)
        { x: 0.8, y: 1.05, z: -0.3 },  // Extra Synth Right (was 1.5)
        { x: -1.2, y: 1.3, z: 0 },    // Left Speaker (was -2)
        { x: 1.2, y: 1.3, z: 0 },     // Right Speaker (was 2)
    ];

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
                controls.target.set(
                    CAMERA_POSITIONS.default.target.x,
                    CAMERA_POSITIONS.default.target.y,
                    CAMERA_POSITIONS.default.target.z
                );
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
            if (mountRef.current && rendererRef.current?.domElement) {
                mountRef.current.removeChild(rendererRef.current.domElement);
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
    }, []);

    useEffect(() => {
        if (!sceneInitialized || !sceneRef.current || !cameraRef.current || !controlsRef.current) return;

        const scene = sceneRef.current;
        const loader = new GLTFLoader();
        const previousDevices = prevDevicesRef.current;

        // Compare current devices with previous devices
        let removedDevices = previousDevices;
        // Removed unused addedDevices variable

        const sortedDevices = [...devices].sort((a, b) => a.locationPriority - b.locationPriority);
        console.log('sorted devices: ', sortedDevices);

        // Remove old devices that are no longer present
        removedDevices.forEach(device => {
            if (devicesRef.current[device.id]?.model) {
                const model = devicesRef.current[device.id].model;
                scene.remove(model);
                delete devicesRef.current[device.id];
                console.log('removed devices ', device.id);
            }
        });

        // Add or reposition devices based on sorted order
        sortedDevices.forEach((device, index) => {
            if (devicesRef.current[device.id]?.model) {
                // Reposition existing device
                const model = devicesRef.current[device.id].model;
                const modelSize = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
                const position = getDevicePosition(device, index, modelSize);
                model.position.set(position.x, position.y, position.z);
                console.log(`repositioning device ${device.id} to x: ${position.x}, y: ${position.y}, z: ${position.z}`);
            } else {
                // Load new device if it's not already present
                loadDeviceWithFirebase(device, index, loader, scene);
            }
            console.log('loading/repositioning device ', device.id, index);
        });

        // Update connections for all devices (removes old cables and adds new ones)
        updateConnections(devices);

        // Update the previous devices ref to the current state of devices
        prevDevicesRef.current = devices;

    }, [devices]);

    function loadDevice(device, index, loader, scene) {
        let position = { x: 1, y: 1, z: 2 };  // Default position if needed
        if (device.modelPath) {
            console.log('Loading model from URL:', device.modelPath, index);
            loader.load(
                device.modelPath,
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
            // Import the function from firebaseUtils
            const { getStorageModelURL } = await import('./firebaseUtils');
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

        const distanceBetweenObjects = 0.75;

        const tablePosition = djTableRef.current.position.clone(); // Clone the position of the DJ table
        const tableGeometry = djTableRef.current.geometry;
        const tableHeight = tableGeometry.parameters.height;   // y dimension

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
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshBasicMaterial({ color: 0x888888 });
        const cube = new THREE.Mesh(geometry, material);
        cube.position.copy(position);
        scene.add(cube);
        devicesRef.current[device.id] = {
            model: cube,
            data: device,
            connectionsInUse: { inputs: [], outputs: [] }
        };
    }

    // Removed unused getDeviceId function

    function findMatchingPorts(sourceDevice, targetDevice) {
        if (!sourceDevice || !targetDevice) return [];

        const connections = [];
        
        // Get outputs from source device
        const outputs = sourceDevice.outputs || [];
        // Get inputs from target device
        const inputs = targetDevice.inputs || [];

        console.log('Checking connections between:', sourceDevice.name, 'and', targetDevice.name);
        console.log('Source device position:', sourceDevice.position);
        console.log('Source outputs:', outputs);
        console.log('Target inputs:', inputs);

        // If this is a CDJ connecting to a mixer, handle line assignments based on position
        if (sourceDevice.name.includes('CDJ') && targetDevice.name.includes('DJM')) {
            const sourcePosition = sourceDevice.position;
            let lineNumber;

            // Determine line number based on CDJ position
            // Use exact position matching with a small tolerance
            const tolerance = 0.1;
            
            if (Math.abs(sourcePosition.x + 1.6) < tolerance) {  // Far left (-1.6)
                lineNumber = 1;
            } else if (Math.abs(sourcePosition.x + 0.8) < tolerance) {  // Middle left (-0.8)
                lineNumber = 2;
            } else if (Math.abs(sourcePosition.x - 0.8) < tolerance) {  // Middle right (0.8)
                lineNumber = 3;
            } else if (Math.abs(sourcePosition.x - 1.6) < tolerance) {  // Far right (1.6)
                lineNumber = 4;
            }

            console.log(`CDJ at position ${sourcePosition.x} assigned to Line${lineNumber}`);

            // Test coordinates for CDJ outputs
            outputs.forEach((output) => {
                if (output.type === 'Line Out') {
                    const targetInput = inputs.find(input => input.type === `Line${lineNumber}`);
                    if (targetInput) {
                        // Coordinates for output (CDJ) - revert channel 4 back to original
                        const testOutputCoordinate = {
                            x: lineNumber === 3 ? 0.06 : 0.08,    // Only channel 3 is adjusted, channel 4 back to 0.08
                            y: 0.09,    // Kept the same
                            z: -0.32    // Back of CDJ (unchanged)
                        };

                        // Calculate input coordinates based on line number
                        let inputX, inputY, inputZ;
                        
                        // Channel-specific adjustments
                        switch(lineNumber) {
                            case 1:  // Channel 1 (perfect, use as reference)
                                inputX = -0.12;  // Reference position
                                inputY = 0.075;
                                inputZ = -0.28;
                                break;
                            case 2:  // Channel 2 (move away from Phono to Line In)
                                inputX = -0.04;  // Adjusted to match Line In position
                                inputY = 0.075;
                                inputZ = -0.28;
                                break;
                            case 3:  // Channel 3 (final fine-tuning)
                                inputX = 0.005;   // Adjusted from 0.01 to 0.005
                                inputY = 0.075;
                                inputZ = -0.28;
                                break;
                            case 4:  // Channel 4 (final fine-tuning)
                                inputX = 0.085;   // Adjusted from 0.09 to 0.085
                                inputY = 0.075;
                                inputZ = -0.28;
                                break;
                            default:
                                inputX = (lineNumber - 2.5) * 0.08;
                                inputY = 0.075;
                                inputZ = -0.28;
                        }

                        const testInputCoordinate = {
                            x: inputX,
                            y: inputY,
                            z: inputZ
                        };

                        connections.push({
                            sourcePort: {
                                ...output,
                                coordinate: testOutputCoordinate
                            },
                            targetPort: {
                                ...targetInput,
                                coordinate: testInputCoordinate
                            },
                            type: output.type
                        });
                        
                        console.log(`Connected CDJ Line Out to Mixer Line${lineNumber} with coordinates:`, 
                            { output: testOutputCoordinate, input: testInputCoordinate });
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

        // Common floor setup
        const floorGeometry = new THREE.PlaneGeometry(20, 20);
        const floor = new THREE.Mesh(floorGeometry, null);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        floor.userData.type = 'environment';

        // Common table setup
        const table = new THREE.Mesh(
            new THREE.BoxGeometry(4.5, 0.1, 1),
            new THREE.MeshStandardMaterial({ color: 0x222222 })
        );
        table.position.set(0, 0.95, -0.25);
        table.receiveShadow = true;
        table.castShadow = true;
        table.userData.type = 'environment';
        djTableRef.current = table;

        switch (currentSetupType) {
            case 'DJ':
                // Club environment
                floor.material = new THREE.MeshStandardMaterial({ 
                    color: 0x111111,
                    roughness: 0.8,
                    metalness: 0.2
                });

                // DJ Booth with metallic finish
                const booth = new THREE.Mesh(
                    new THREE.BoxGeometry(5, 0.9, 1.2),
                    new THREE.MeshStandardMaterial({ 
                        color: 0x333333,
                        metalness: 0.7,
                        roughness: 0.3
                    })
                );
                booth.position.set(0, 0.45, -0.25);
                booth.receiveShadow = true;
                booth.castShadow = true;
                booth.userData.type = 'environment';

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
        }

        // Add common elements
        scene.add(floor);
        scene.add(table);

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

    // Function to update connection point in Firebase
    const updateConnectionPoint = async (deviceId, mode, type, position) => {
        try {
            const deviceRef = doc(db, "products", deviceId);
            const deviceDoc = await getDoc(deviceRef);
            
            if (deviceDoc.exists()) {
                const data = deviceDoc.data();
                const connections = [...(data[mode] || [])];
                const connectionIndex = connections.findIndex(c => c.type === type);
                
                if (connectionIndex !== -1) {
                    connections[connectionIndex] = {
                        ...connections[connectionIndex],
                        position: {
                            x: position.x,
                            y: position.y,
                            z: position.z
                        }
                    };
                    
                    await updateDoc(deviceRef, {
                        [mode]: connections
                    });
                    
                    console.log(`Updated ${mode} connection point for ${type}`);
                }
            }
        } catch (error) {
            console.error("Error updating connection point:", error);
            alert("Failed to update connection point.");
        }
    };

    // Add click event listener for model mapping
    useEffect(() => {
        if (isConnectionMapping) {
            window.addEventListener('click', handleModelClick);
            return () => window.removeEventListener('click', handleModelClick);
        }
    }, [isConnectionMapping, currentMappingDevice, selectedConnectionType]);

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
            
            const rect = rendererRef.current.domElement.getBoundingClientRect();
            
            // Handle both mouse and touch events
            const clientX = event.touches ? event.touches[0].clientX : event.clientX;
            const clientY = event.touches ? event.touches[0].clientY : event.clientY;
            
            mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

            raycaster.setFromCamera(mouse, cameraRef.current);
            const intersects = raycaster.intersectObjects(ghostSpotsRef.current);

            if (hoveredSquare) {
                hoveredSquare.material.color.setHex(hoveredSquare.userData.defaultColor);
                hoveredSquare.material.opacity = 0.4;
            }

            if (intersects.length > 0) {
                hoveredSquare = intersects[0].object;
                hoveredSquare.material.color.setHex(hoveredSquare.userData.hoverColor);
                hoveredSquare.material.opacity = 0.6;

                // Handle click/tap
                if (event.type === 'click' || event.type === 'touchend') {
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
            updatePlacedDevicesList(device, 'remove');
            
            // Update connections after removal
            const updatedDevicesList = placedDevicesList.filter(d => d.uniqueId !== uniqueId);
            updateConnections(updatedDevicesList);

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

    // Add this useEffect after your other effects
    useEffect(() => {
        if (sceneRef.current && sceneInitialized) {
            console.log('Setup type changed to:', currentSetupType);
            createClubEnvironment(sceneRef.current);
            
            // Force a re-render
            if (rendererRef.current && cameraRef.current) {
                rendererRef.current.render(sceneRef.current, cameraRef.current);
            }
        }
    }, [currentSetupType, sceneInitialized]);

    // Removed unused handleGhostHover function
        setTooltipPosition({
            x: rect.left + window.scrollX,
            y: rect.top + window.scrollY - 30
        });
        setShowTooltip(true);
    };

    // Add this useEffect after the initialization to check for basic setup
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
    useEffect(() => {
        if (onCategoryToggle) {
            onCategoryToggle(handleCategoryToggle);
        }
    }, []); // Empty dependency array to run only once

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

                {/* Tooltip */}
                {showTooltip && (
                    <div style={{
                        position: 'fixed',
                        top: tooltipPosition.y,
                        left: tooltipPosition.x,
                        transform: 'translateX(-50%)',
                        backgroundColor: 'rgba(10, 10, 10, 0.9)',
                        padding: '8px 12px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        color: '#ffffff',
                        zIndex: 1100,
                        pointerEvents: 'none',
                        backdropFilter: 'blur(8px)',
                        border: '1px solid rgba(0, 162, 255, 0.2)'
                    }}>
                        {tooltipContent}
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

                {/* Setup List Box - Only show on desktop */}
                {!isMobile && (
                    <div className={`setup-list-box ${isSetupListExpanded ? 'expanded' : ''}`}
                        style={{
                            transform: isSetupListExpanded ? 'translateY(0)' : 'translateY(calc(100% - 40px))',
                            transition: 'transform 0.3s ease'
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
                            }}>▼</span>
                        </div>
                        {isSetupListExpanded && (
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
                        )}
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

                {/* Camera Controls - Only show on desktop */}
                {!isMobile && (
                    <div className="camera-controls fade-in">
                        <button 
                            className="camera-button"
                            onClick={() => moveCameraToPosition('set')}
                        >
                            Set
                        </button>
                        <button 
                            className="camera-button"
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

export default ThreeScene;