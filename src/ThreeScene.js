import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { collection, getDocs, doc, getDoc, updateDoc, addDoc } from "firebase/firestore"; // Import Firestore methods
import { db } from "./firebaseConfig"; // Import Firestore
import { auth } from "./firebaseConfig"; // Add auth import at the top
import ProductSubmissionForm from './ProductSubmissionForm'; // Replace the old ProductForm import

function ThreeScene({ devices, isInitialized, setupType }) {
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
    const [showProductForm, setShowProductForm] = useState(false);
    const [selectedGhostIndex, setSelectedGhostIndex] = useState(null);
    const [searchResults, setSearchResults] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [showSearch, setShowSearch] = useState(false);
    const [searchMode, setSearchMode] = useState(''); // 'hamburger' or 'ghost'
    const [showPositionModal, setShowPositionModal] = useState(false);
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
        { x: 0, y: 1.5, z: -0.3, type: SPOT_TYPES.FX_TOP },        // FX Top
        { x: -0.6, y: 1.05, z: -0.3, type: SPOT_TYPES.FX_LEFT },    // FX Left
        { x: 0.6, y: 1.05, z: -0.3, type: SPOT_TYPES.FX_RIGHT },    // FX Right
        { x: 0, y: 1.05, z: 0.3, type: SPOT_TYPES.FX_FRONT }       // FX Front (Wide units)
    ];

    // Add searchModalStyle and positionModalStyle definitions
    const searchModalStyle = {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        backgroundColor: 'white',
        padding: isMobile ? '15px' : '20px',
        borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        zIndex: 1000,
        width: isMobile ? '90%' : '500px',
        maxWidth: '500px',
        maxHeight: isMobile ? '80vh' : 'auto',
        overflowY: 'auto',
        color: 'black'
    };

    const positionModalStyle = {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        backgroundColor: 'white',
        padding: isMobile ? '15px' : '20px',
        borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        zIndex: 1000,
        width: isMobile ? '90%' : 'auto',
        maxHeight: isMobile ? '80vh' : '300px',
        overflowY: 'auto',
        color: 'black'
    };

    // Function to find the best spot for a product
    function findBestSpot(product, occupiedSpots) {
        const productType = getProductType(product);
        
        // Get all available spots (not occupied)
        const availableSpots = djSetupSpots.filter(spot => 
            !occupiedSpots.some(occupied => 
                occupied.x === spot.x && 
                occupied.y === spot.y && 
                occupied.z === spot.z
            )
        );

        console.log('Finding spot for:', product.name, 'Type:', productType);
        console.log('Occupied spots:', occupiedSpots);
        console.log('Available spots:', availableSpots);

        switch (productType) {
            case PRODUCT_TYPES.MIXER:
                // For mixers, always try to place in the middle first
                const middleSpot = djSetupSpots.find(spot => spot.type === SPOT_TYPES.MIDDLE);
                if (!occupiedSpots.some(occupied => 
                    occupied.x === middleSpot.x && 
                    occupied.y === middleSpot.y && 
                    occupied.z === middleSpot.z
                )) {
                    console.log('Placing mixer in middle spot');
                    return middleSpot;
                }
                break;

            case PRODUCT_TYPES.PLAYER:
                // Define player spot types in order of preference
                const playerSpotTypes = [
                    SPOT_TYPES.MIDDLE_LEFT,
                    SPOT_TYPES.MIDDLE_RIGHT,
                    SPOT_TYPES.FAR_LEFT,
                    SPOT_TYPES.FAR_RIGHT
                ];

                // Get all occupied player spots
                const occupiedPlayerSpots = occupiedSpots.filter(spot => 
                    playerSpotTypes.includes(spot.type)
                );

                console.log('Occupied player spots:', occupiedPlayerSpots);

                // Find the first available preferred spot
                for (const spotType of playerSpotTypes) {
                    const spot = availableSpots.find(s => s.type === spotType);
                    if (spot) {
                        console.log('Found available player spot:', spotType);
                        return spot;
                    }
                }
                break;
        }

        // If no specific spot found, return first available spot
        console.log('No specific spot found, using first available spot');
        return availableSpots[0];
    }

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

        console.log(`Adding selected product: ${product.name} to position ${selectedGhostIndex}`);
        
        // Directly add the product to the selected ghost position
        addProductToPosition(product, selectedGhostIndex);

        setShowSearch(false);
        setSearchMode('');
        setSearchQuery('');
    };

    // Add this helper function to track existing connections
    function getConnectionKey(sourceDevice, targetDevice, connection) {
        return `${sourceDevice.id}-${targetDevice.id}-${connection.sourcePort.type}-${connection.targetPort.type}`;
    }

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
        const distance = startPoint.distanceTo(endPoint);
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
        
        // Count CDJs and check for mixer
        const playerCount = devicesList.filter(device => 
            device.name.toLowerCase().includes('cdj') || 
            device.name.toLowerCase().includes('player')
        ).length;
        
        const hasMixer = devicesList.some(device => 
            device.name.toLowerCase().includes('djm') || 
            device.name.toLowerCase().includes('mixer')
        );
        
        const isComplete = playerCount >= 2 && hasMixer;
        
        console.log('Checking basic setup:', {
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
            console.log('Checking basic setup on mount/update:', {
                devices: placedDevicesList.map(d => d.name),
                currentBasicSetupComplete: basicSetupComplete
            });
            
            const isComplete = checkBasicSetupComplete(placedDevicesList);
            console.log('Basic setup check result:', {
                isComplete,
                playerCount: placedDevicesList.filter(d => 
                    d.name.toLowerCase().includes('cdj') || 
                    d.name.toLowerCase().includes('player')
                ).length,
                hasMixer: placedDevicesList.some(d => 
                    d.name.toLowerCase().includes('djm') || 
                    d.name.toLowerCase().includes('mixer')
                )
            });

            if (isComplete !== basicSetupComplete) {
                console.log('Basic setup state changed, updating...');
                setBasicSetupComplete(isComplete);
                
                // Force a complete scene reload
                if (sceneRef.current) {
                    // Clear existing ghost spots
                    ghostSpotsRef.current.forEach(spot => {
                        if (spot.parent) {
                            sceneRef.current.remove(spot);
                        }
                    });
                    ghostSpotsRef.current = [];
                    
                    // Recreate ghost spots with updated positions
                    createGhostPlacementSpots(sceneRef.current);
                    
                    // Force a re-render
                    if (rendererRef.current && cameraRef.current) {
                        rendererRef.current.render(sceneRef.current, cameraRef.current);
                    }
                }
            }
        }
    }, [placedDevicesList, basicSetupComplete]);

    // Update addProductToPosition to ensure proper state updates
    const addProductToPosition = async (product, positionIndex) => {
        const position = ghostSpotsRef.current[positionIndex]?.position;
        if (position) {
            const loader = new GLTFLoader();
            
            if (!product.modelUrl) {
                console.error("No model URL found for product:", product.name);
                alert("This product doesn't have a 3D model available.");
                return;
            }

            console.log(`Loading 3D model for ${product.name} at position:`, position);
            
            loader.load(
                product.modelUrl,
                (gltf) => {
                    const model = gltf.scene;
                    
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
                        uniqueId: `${product.id}-${position.x}-${position.y}-${position.z}`
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

                    // Update placedDevices array with the position-aware device
                    const existingDeviceIndex = placedDevices.current.findIndex(d => d.uniqueId === deviceWithPosition.uniqueId);
                    if (existingDeviceIndex !== -1) {
                        placedDevices.current[existingDeviceIndex] = deviceWithPosition;
                    } else {
                        placedDevices.current.push(deviceWithPosition);
                    }
                    
                    console.log(`Added ${product.name} to position ${positionIndex}:`, deviceWithPosition.position);
                    console.log('Current placed devices:', placedDevices.current);

                    // Update the placed devices list and check for basic setup completion
                    setPlacedDevicesList(prev => {
                        const newList = [...prev, deviceWithPosition];
                        console.log('Updated placed devices list:', {
                            newList: newList.map(d => d.name),
                            currentBasicSetupComplete: basicSetupComplete
                        });
                        return newList;
                    });

                    // Update connections for all devices
                    updateConnections(placedDevices.current);

                    // Force a re-render of the scene
                    if (rendererRef.current && sceneRef.current && cameraRef.current) {
                        rendererRef.current.render(sceneRef.current, cameraRef.current);
                    }
                },
                (progress) => {
                    console.log(`Loading progress: ${(progress.loaded / progress.total * 100)}%`);
                },
                (error) => {
                    console.error("Error loading model:", error);
                    alert("Failed to load 3D model. Please try again later.");
                }
            );
        }
    };

    const handlePositionSelect = (positionIndex) => {
        if (selectedProduct) {
            addProductToPosition(selectedProduct, positionIndex);
            setSelectedProduct(null);
            setShowPositionModal(false);
        }
    };

    const handleAddNewProduct = () => {
        setShowSearch(false); // Close search UI
        setShowProductForm(true); // Open product creation form
        setSearchMode(''); // Reset search mode
    };

    // Function to open search from hamburger menu
    const openHamburgerSearch = () => {
        openSearch('hamburger');
    };

    // Update fetchProductsFromFirestore to be more efficient
    const fetchProductsFromFirestore = async () => {
        try {
            console.log("Starting to fetch products from Firestore...");
            
            if (!db || !auth?.currentUser) {
                console.error("Firebase not properly initialized or user not authenticated");
                setError("Please sign in to access the product database");
                return;
            }

            console.log("Authenticated as:", auth.currentUser.email);

            // Get products from Firestore
            const productsRef = collection(db, "products");
            const querySnapshot = await getDocs(productsRef);
            
            const products = [];
            querySnapshot.forEach((doc) => {
                const productData = doc.data();
                console.log("Found product in Firestore:", productData.name);
                products.push({
                    id: doc.id,
                    ...productData
                });
            });

            console.log(`Found ${products.length} products in Firestore:`, products);
                setSearchResults(products);
            setFilteredResults(products);

            } catch (error) {
                console.error("Error fetching products:", error);
            setError("Failed to fetch products. Please try again.");
            setSearchResults([]);
            setFilteredResults([]);
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
        
        console.log("Filtered results:", filtered);
        setFilteredResults(filtered);
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

    const producerSetupSpots = [
        { x: 0, y: 1.05, z: 0 },      // Middle
        { x: 0, y: 1.05, z: -0.5 },   // In Front of Laptop (was -0.7)
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

                scene.background = new THREE.Color(0x111111);
                renderer.setSize(width, height);
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
                if (isMobile) {
                    camera.position.set(0, 4, 6); // Slightly closer on mobile (was 7)
                    camera.fov = 85; // Wider field of view for mobile
                    camera.updateProjectionMatrix();
                } else {
                    camera.position.set(0, 2.5, 4); // Start closer (was 0, 3, 5)
                }
        const controls = new OrbitControls(camera, renderer.domElement);
        controlsRef.current = controls;
        controls.enableDamping = true;
        controls.dampingFactor = 0.25;
        controls.enableZoom = true;
                controls.enablePan = !isMobile; // Disable panning on mobile
                controls.maxPolarAngle = Math.PI / 2; // Limit vertical rotation
                controls.minDistance = isMobile ? 3 : 2; // Allow closer zoom (was 4 and 3)
                controls.maxDistance = isMobile ? 10 : 8;
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
        let addedDevices = devices.filter(device => !previousDevices.some(prevDev => prevDev.id === device.id));

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
                loadDevice(device, index, loader, scene);
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
        if (device.modelUrl) {
            console.log('Loading model from URL:', device.modelUrl, index);
            loader.load(
                device.modelUrl,
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
        const tableWidth = tableGeometry.parameters.width;     // x dimension
        const tableHeight = tableGeometry.parameters.height;   // y dimension
        const tableDepth = tableGeometry.parameters.depth;    // z dimension

        const deviceWidth = modelSize.x;     // x dimension
        const deviceHeight = modelSize.y;   // y dimension
        const deviceDepth = modelSize.z;

        console.log("Looking for location: " + device.name);
        console.log(`finding location for Device ${index}:`, device.name, 'ID:', device.id);
        const tableSideMultiplier = ((index % 2) == 0) ? -1 : 1;
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

    function getDeviceId(name) {
        const device = devices.find(device => device.name === name);
        return device ? device.id : null;
    }

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
                        // Coordinates for output (CDJ) - with right offset
                        const testOutputCoordinate = {
                            x: 0.12,   // Slight right offset for CDJ output
                            y: 0.07,      // Height on CDJ
                            z: -0.32    // Back of CDJ
                        };

                        // Coordinates for input (mixer) - spread across width
                        const testInputCoordinate = {
                            x: (lineNumber - 2.5) * 0.15,  // Spread inputs across mixer width
                            y: 0.072,                          // Height on mixer
                            z: -0.3                        // Back of mixer
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

    // Helper function to determine if two connection types are compatible
    function isCompatibleConnection(outputType, inputType) {
        console.log('Checking compatibility between:', outputType, 'and', inputType);
        
        // Define compatible connection types
        const compatibilityMap = {
            'Digital': ['Digital'],
            'Line Out': ['Line In', 'Line1', 'Line2', 'Line3', 'Line4'], // Add mixer line inputs
            'RCA': ['RCA'],
            'Link': ['Link'],
            'USB': ['USB'],
            'Audio': ['Audio', 'Line In', 'Line1', 'Line2', 'Line3', 'Line4'] // Add mixer line inputs
        };

        // Get compatible types for the output
        const compatibleTypes = compatibilityMap[outputType] || [];
        const isCompatible = compatibleTypes.includes(inputType);
        console.log('Compatible types for', outputType, ':', compatibleTypes);
        console.log('Is compatible:', isCompatible);
        return isCompatible;
    }

    function createClubEnvironment(scene) {
        // Floor
        const floorGeometry = new THREE.PlaneGeometry(20, 20);
        const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x111111 });
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        scene.add(floor);

        // DJ Booth
        const boothGeometry = new THREE.BoxGeometry(5, 0.9, 1.2);
        const boothMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
        const booth = new THREE.Mesh(boothGeometry, boothMaterial);
        booth.position.set(0, 0.45, -0.25);
        booth.receiveShadow = true;
        booth.castShadow = true;
        scene.add(booth);

        // DJ Table
        const tableGeometry = new THREE.BoxGeometry(4.5, 0.1, 1);
        const tableMaterial = new THREE.MeshStandardMaterial({ color: 0x222222 });
        const table = new THREE.Mesh(tableGeometry, tableMaterial);
        table.position.set(0, 0.95, -0.25);
        table.receiveShadow = true;
        table.castShadow = true;
        scene.add(table);

        djTableRef.current = table;  // Store the reference in the djTableRef
    }

    // Add this function to handle connection point mapping
    const handleConnectionPointMapping = (device) => {
        setCurrentMappingDevice(device);
        setIsConnectionMapping(true);
    };

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

    function createGhostPlacementSpots(scene) {
        if (!djTableRef.current) {
            console.log('Cannot create ghost spots: No DJ table reference');
            return;
        }

        console.log('Creating ghost spots with setup type:', currentSetupType);
        console.log('Basic setup complete:', basicSetupComplete);

        // Clear previous spots
        ghostSpotsRef.current.forEach(spot => {
            if (spot.parent) {
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
                if (basicSetupComplete) {
                    console.log('Basic setup complete, adding additional spots');
                    initialSpots = [
                        ...initialSpots,
                        djSetupSpots[7],   // Behind Middle
                        djSetupSpots[8],   // FX Top
                        djSetupSpots[9],   // FX Left
                        djSetupSpots[10],  // FX Right
                        djSetupSpots[11],  // FX Front
                    ];
                } else {
                    console.log('Basic setup not complete, showing only initial spots');
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
        }

        console.log('Creating ghost spots:', {
            setupType: currentSetupType,
            basicSetupComplete,
            numberOfSpots: initialSpots.length,
            spots: initialSpots.map(s => ({ type: s.type, position: { x: s.x, y: s.y, z: s.z } }))
        });

        // Create ghost squares for the selected spots
        initialSpots.forEach((position, index) => {
            const isFXSpot = position.type?.includes('fx_') || position.type === 'effects';
            const isMiddleBack = position.type === SPOT_TYPES.MIDDLE_BACK;
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
                    case SPOT_TYPES.FX_RIGHT: return 'Effects Unit';
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
                console.log('Basic setup status after adding device:', {
                    isComplete,
                    deviceName: device.name,
                    currentList: newList.map(d => d.name)
                });
                if (isComplete !== basicSetupComplete) {
                    setBasicSetupComplete(isComplete);
                    // Force a complete scene reload when basic setup is complete
                    if (sceneRef.current) {
                        // Clear existing ghost spots
                        ghostSpotsRef.current.forEach(spot => sceneRef.current.remove(spot));
                        ghostSpotsRef.current = [];
                        
                        // Recreate ghost spots with additional positions
                        createGhostPlacementSpots(sceneRef.current);
                        
                        // Force a re-render
                        if (rendererRef.current && cameraRef.current) {
                            rendererRef.current.render(sceneRef.current, cameraRef.current);
                        }
                    }
                }
                return newList;
            });
        } else {
            setPlacedDevicesList(prev => {
                const newList = prev.filter(d => d.uniqueId !== device.uniqueId);
                // Check if basic setup is still complete after removing device
                const isComplete = checkBasicSetupComplete(newList);
                console.log('Basic setup status after removing device:', {
                    isComplete,
                    deviceName: device.name,
                    currentList: newList.map(d => d.name)
                });
                if (isComplete !== basicSetupComplete) {
                    setBasicSetupComplete(isComplete);
                    // Force a complete scene reload when basic setup is no longer complete
                    if (sceneRef.current) {
                        // Clear existing ghost spots
                        ghostSpotsRef.current.forEach(spot => sceneRef.current.remove(spot));
                        ghostSpotsRef.current = [];
                        
                        // Recreate ghost spots without additional positions
                        createGhostPlacementSpots(sceneRef.current);
                        
                        // Force a re-render
                        if (rendererRef.current && cameraRef.current) {
                            rendererRef.current.render(sceneRef.current, cameraRef.current);
                        }
                    }
                }
                return newList;
            });
        }
    };

    return (
        <div ref={mountRef} style={{ 
            width: "100%", 
            height: isMobile ? "calc(100vh - 60px)" : "100%",
            touchAction: "none" // Prevent default touch actions
        }}>
            {error && (
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    padding: '20px',
                    borderRadius: '8px',
                    textAlign: 'center'
                }}>
                    <h3>Error</h3>
                    <p>{error}</p>
                    <button onClick={() => window.location.reload()}>Retry</button>
                </div>
            )}
            {/* Connection Mapping Modal */}
            {isConnectionMapping && (
                <div style={{
                    position: 'absolute',
                    top: isMobile ? '10px' : '20px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    backgroundColor: 'white',
                    padding: isMobile ? '15px' : '20px',
                    borderRadius: '8px',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                    zIndex: 1000,
                    width: isMobile ? '90%' : 'auto',
                    maxWidth: '500px'
                }}>
                    <h3>Mapping {currentMappingDevice?.name} Connection Points</h3>
                    <div style={{ marginBottom: '10px' }}>
                        <button
                            onClick={() => setSelectedConnectionMode('inputs')}
                            style={{
                                backgroundColor: selectedConnectionMode === 'inputs' ? '#4CAF50' : '#f5f5f5',
                                color: selectedConnectionMode === 'inputs' ? 'white' : 'black',
                                marginRight: '10px'
                            }}
                        >
                            Inputs
                        </button>
                        <button
                            onClick={() => setSelectedConnectionMode('outputs')}
                            style={{
                                backgroundColor: selectedConnectionMode === 'outputs' ? '#4CAF50' : '#f5f5f5',
                                color: selectedConnectionMode === 'outputs' ? 'white' : 'black'
                            }}
                        >
                            Outputs
                        </button>
                    </div>
                    {selectedConnectionMode && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                            {currentMappingDevice[selectedConnectionMode]?.map((conn, index) => (
                                <button
                                    key={index}
                                    onClick={() => setSelectedConnectionType(conn.type)}
                                    style={{
                                        padding: '8px 16px',
                                        backgroundColor: selectedConnectionType === conn.type ? '#4CAF50' : '#f5f5f5',
                                        color: selectedConnectionType === conn.type ? 'white' : 'black',
                                        border: '1px solid #ddd',
                                        borderRadius: '4px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {conn.type}
                                </button>
                            ))}
                        </div>
                    )}
                    <div style={{ marginTop: '20px' }}>
                        <button
                            onClick={() => {
                                setIsConnectionMapping(false);
                                setSelectedConnectionType(null);
                                setSelectedConnectionMode(null);
                                setCurrentMappingDevice(null);
                            }}
                            style={{
                                padding: '8px 16px',
                                backgroundColor: '#ff4444',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer'
                            }}
                        >
                            Cancel Mapping
                        </button>
                    </div>
                </div>
            )}

            {/* Search Modal */}
            {showSearch && (
                <div className="search-modal" style={searchModalStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                        <h3 style={{ margin: 0, color: 'black' }}>
                            {searchMode === 'ghost' ? `Select Device for Position ${selectedGhostIndex + 1}` : 'Search Products'}
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
                                fontSize: '20px',
                                cursor: 'pointer',
                                color: 'black'
                            }}
                        >
                            ×
                        </button>
                    </div>
                    {searchMode === 'ghost' && ghostSpotsRef.current[selectedGhostIndex] && (
                        <div style={{
                            marginBottom: '15px',
                            padding: '8px',
                            backgroundColor: '#f0f8ff',
                            borderRadius: '4px',
                            color: 'black',
                            border: '1px solid #b8daff'
                        }}>
                            <strong>Recommended:</strong> {ghostSpotsRef.current[selectedGhostIndex].userData.recommendedType}
                        </div>
                    )}
                    <input
                        type="text"
                        placeholder="Search for a product..."
                        value={searchQuery}
                        onChange={handleSearchInputChange}
                        style={{
                            width: '100%',
                            padding: '8px',
                            marginBottom: '15px',
                            borderRadius: '4px',
                            border: '1px solid #ddd',
                            color: 'black'
                        }}
                        autoFocus
                    />
                    <div style={{
                        marginBottom: '10px',
                        padding: '8px',
                        backgroundColor: '#f5f5f5',
                        borderRadius: '4px',
                        color: 'black'
                    }}>
                        {searchMode === 'ghost' ? 
                            `Selecting device for position ${selectedGhostIndex + 1}` : 
                            'Select a device from the list below'}
                    </div>
                    <div style={{
                        maxHeight: '300px',
                        overflowY: 'auto',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        color: 'black'
                    }}>
                        {searchResults.length === 0 ? (
                            <div style={{ padding: '10px', textAlign: 'center', color: '#666' }}>
                                No products found. Add a new product to get started.
                            </div>
                        ) : (
                            <ul style={{
                                listStyle: 'none',
                                padding: 0,
                                margin: 0
                            }}>
                                {(searchQuery ? filteredResults : searchResults).map(product => (
                                    <li 
                                        key={product.id}
                                        onClick={() => handleProductSelect(product)}
                                        style={{
                                            padding: '10px',
                                            borderBottom: '1px solid #eee',
                                            cursor: 'pointer',
                                            backgroundColor: 'white',
                                            transition: 'background-color 0.2s',
                                            color: 'black'
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div>
                                                <div style={{ fontWeight: 'bold', color: 'black' }}>{product.name}</div>
                                                <div style={{ fontSize: '0.8em', color: '#666' }}>{product.category}</div>
                                            </div>
                                        </div>
                                </li>
                                ))}
                    </ul>
                        )}
                    </div>
                    <div style={{ marginTop: '15px', display: 'flex', justifyContent: 'space-between' }}>
                        <button 
                            onClick={handleAddNewProduct}
                            style={{
                                padding: '8px 16px',
                                backgroundColor: '#4CAF50',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer'
                            }}
                        >
                            + Add a New Product
                        </button>
                    </div>
                </div>
            )}

            {/* Position Selection Modal */}
            {showPositionModal && (
                <div className="position-modal" style={positionModalStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                        <h3 style={{ margin: 0 }}>Select Position for {selectedProduct?.name}</h3>
                        <button 
                            onClick={() => {
                                setShowPositionModal(false);
                                setSelectedProduct(null);
                            }}
                            style={{
                                background: 'none',
                                border: 'none',
                                fontSize: '20px',
                                cursor: 'pointer'
                            }}
                        >
                            ×
                        </button>
                    </div>
                    <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(2, 1fr)',
                        gap: '10px',
                        maxHeight: '300px',
                        overflowY: 'auto'
                    }}>
                        {(currentSetupType === 'DJ' ? djSetupSpots : producerSetupSpots).map((spot, index) => (
                            <button
                                key={index}
                                onClick={() => handlePositionSelect(index)}
                                style={{
                                    padding: '15px',
                                    backgroundColor: '#f5f5f5',
                                    border: '1px solid #ddd',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '5px'
                                }}
                            >
                                <span style={{ fontWeight: 'bold' }}>Position {index + 1}</span>
                                <span style={{ fontSize: '0.8em', color: '#666' }}>
                                    {index === 0 ? 'Middle' :
                                     index === 1 ? 'Left' :
                                     index === 2 ? 'Right' :
                                     index === 3 ? 'Far Left' :
                                     index === 4 ? 'Far Right' :
                                     'FX Position'}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Product Form Modal */}
            {showProductForm && <ProductSubmissionForm onClose={() => setShowProductForm(false)} />}

            {/* Setup List Box */}
            <div className="setup-list-box">
                <h3>Current Setup</h3>
                {placedDevicesList.map((device) => {
                    // Determine the position label based on x coordinate
                    let positionLabel = '';
                    if (device.name.includes('CDJ')) {
                        if (Math.abs(device.position.x + 1.6) < 0.1) {
                            positionLabel = '(Far Left)';
                        } else if (Math.abs(device.position.x + 0.8) < 0.1) {
                            positionLabel = '(Middle Left)';
                        } else if (Math.abs(device.position.x - 0.8) < 0.1) {
                            positionLabel = '(Middle Right)';
                        } else if (Math.abs(device.position.x - 1.6) < 0.1) {
                            positionLabel = '(Far Right)';
                        }
                    }
                    
                    return (
                        <div key={device.uniqueId} className="setup-list-item">
                            <span>{device.name} {positionLabel}</span>
                            <button onClick={() => removeDevice(device.uniqueId)}>Remove</button>
                        </div>
                    );
                })}
                {placedDevicesList.length === 0 && (
                    <div style={{ textAlign: 'center', opacity: 0.7 }}>
                        No devices added yet
                    </div>
                )}
            </div>
        </div>
    );
}

export default ThreeScene;