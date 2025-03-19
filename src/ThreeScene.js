import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { collection, getDocs, doc, getDoc, updateDoc, addDoc } from "firebase/firestore"; // Import Firestore methods
import { db } from "./firebaseConfig"; // Import Firestore
import { auth } from "./firebaseConfig"; // Add auth import at the top
import ProductForm from './ProductForm'; // Import ProductForm component

function ThreeScene({ devices, isInitialized }) {
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

    // Function to determine product type based on product data
    function getProductType(product) {
        const name = product.name.toLowerCase();
        
        // Mixer detection
        if (name.includes('mixer') || name.includes('djm')) {
            return PRODUCT_TYPES.MIXER;
        }
        
        // Player detection
        if (name.includes('cdj') || name.includes('player') || name.includes('turntable')) {
            return PRODUCT_TYPES.PLAYER;
        }
        
        // FX Unit detection (wide units like RMX-1000)
        if (name.includes('rmx') || product.width > 0.5) {
            return PRODUCT_TYPES.FX_UNIT_WIDE;
        }
        
        // Regular FX units
        if (name.includes('fx') || name.includes('effect') || name.includes('echo')) {
            return PRODUCT_TYPES.FX_UNIT;
        }
        
        return null;
    }

    // Function to find the best available spot for a product
    function findBestSpot(product, occupiedSpots) {
        const productType = getProductType(product);
        const availableSpots = djSetupSpots.filter(spot => !occupiedSpots.includes(spot));

        switch (productType) {
            case PRODUCT_TYPES.MIXER:
                return availableSpots.find(spot => spot.type === SPOT_TYPES.MIDDLE);

            case PRODUCT_TYPES.PLAYER:
                // Try spots in preferred order
                const playerSpotTypes = [
                    SPOT_TYPES.MIDDLE_LEFT,
                    SPOT_TYPES.MIDDLE_RIGHT,
                    SPOT_TYPES.FAR_LEFT,
                    SPOT_TYPES.FAR_RIGHT,
                    SPOT_TYPES.MIDDLE_LEFT_INNER,
                    SPOT_TYPES.MIDDLE_RIGHT_INNER
                ];
                
                for (const spotType of playerSpotTypes) {
                    const spot = availableSpots.find(s => s.type === spotType);
                    if (spot) return spot;
                }
                break;

            case PRODUCT_TYPES.FX_UNIT_WIDE:
                // Wide FX units prefer the front spot
                return availableSpots.find(spot => spot.type === SPOT_TYPES.FX_FRONT) ||
                       availableSpots.find(spot => spot.type === SPOT_TYPES.FX_TOP);

            case PRODUCT_TYPES.FX_UNIT:
                // Regular FX units prefer side spots first
                const fxSpotTypes = [
                    SPOT_TYPES.FX_LEFT,
                    SPOT_TYPES.FX_RIGHT,
                    SPOT_TYPES.FX_TOP,
                    SPOT_TYPES.FX_FRONT
                ];
                
                for (const spotType of fxSpotTypes) {
                    const spot = availableSpots.find(s => s.type === spotType);
                    if (spot) return spot;
                }
                break;
        }

        // If no specific spot found, return first available spot
        return availableSpots[0];
    }

    // Update handleProductSelect to use the new placement logic
    const handleProductSelect = (product) => {
        if (!product) return;

        console.log(`Adding selected product: ${product.name}`);
        
        // Get currently occupied spots
        const occupiedSpots = Object.values(devicesRef.current).map(device => {
            const position = device.model.position;
            return djSetupSpots.find(spot => 
                Math.abs(spot.x - position.x) < 0.1 && 
                Math.abs(spot.y - position.y) < 0.1 && 
                Math.abs(spot.z - position.z) < 0.1
            );
        }).filter(Boolean);

        // Find the best spot for the product
        const bestSpot = findBestSpot(product, occupiedSpots);
        
        if (bestSpot) {
            const spotIndex = djSetupSpots.indexOf(bestSpot);
            addProductToPosition(product, spotIndex);
        } else {
            alert("No suitable spots available for this product.");
        }

        setShowSearch(false);
        setSearchMode('');
        setSearchQuery('');
    };

    const addProductToPosition = (product, positionIndex) => {
        const position = ghostSpotsRef.current[positionIndex]?.position;
        if (position) {
            const loader = new GLTFLoader();
            
            // Check if the product has a valid modelUrl from Firebase
            if (!product.modelUrl) {
                console.error("No model URL found for product:", product.name);
                alert("This product doesn't have a 3D model available.");
                return;
            }

            console.log(`Loading 3D model from: ${product.modelUrl}`);
            
            loader.load(
                product.modelUrl, // Use the Firebase Storage URL
                (gltf) => {
                    const model = gltf.scene;
                    model.position.set(position.x, position.y, position.z);
                    
                    // Store additional product data with the model
                    model.userData = {
                        productId: product.id,
                        name: product.name,
                        connections: product.connections || [],
                        inputs: product.inputs || [],
                        outputs: product.outputs || []
                    };

                    sceneRef.current.add(model);
                    devicesRef.current[product.id] = {
                        model,
                        data: product,
                        connectionsInUse: { inputs: [], outputs: [] }
                    };
                    
                    console.log(`Added ${product.name} to position ${positionIndex}`);
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

            // Only check root collection first
            const productsCollectionRef = collection(db, "products");
            const productsSnapshot = await getDocs(productsCollectionRef);
            
            if (!productsSnapshot.empty) {
                const products = productsSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                
                console.log("Found products:", products.length);
                setSearchResults(products);
                setFilteredResults(products);
                return;
            }

            console.log("No products found. Please add products to get started.");
            setSearchResults([]);
            setFilteredResults([]);

        } catch (error) {
            console.error("Error fetching products:", error);
            setError("Failed to fetch products. Please try again.");
            setSearchResults([]);
            setFilteredResults([]);
        }
    };

    // Update the search input handler to filter results
    const handleSearchInputChange = (e) => {
        const query = e.target.value;
        setSearchQuery(query);
        
        // Filter the search results based on the query
        const filteredResults = searchResults.filter(product =>
            product.name.toLowerCase().includes(query.toLowerCase()) ||
            product.category.toLowerCase().includes(query.toLowerCase()) ||
            product.description.toLowerCase().includes(query.toLowerCase())
        );
        
        setFilteredResults(filteredResults);
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

    const currentSetupType = 'DJ'; // Change this dynamically based on user selection

    const cableColors = {
        'AUX Cable': 0x00ff00,
        'RCA Cable': 0xff00ff,
        'XLR Cable': 0xffff00,
        'USB Cable': 0x00ffff,
        'Digital Cable': 0xff8000,
        'Audio Cable': 0x8080ff,
    };

    useEffect(() => {
        console.log('Devices prop updated:', devices);
        devices.forEach((device, index) => {
            console.log(`Device ${index}:`, device.name, 'ID:', device.id);
        });
    }, [devices]);

    useEffect(() => {
        if (!mountRef.current) return;

        try {
            console.log("Initializing ThreeScene...");
            
            // Check Firebase initialization first
            if (!db || !auth) {
                console.error("Firebase not initialized");
                setError('Firebase not properly initialized. Please refresh the page.');
                return;
            }

            // Initialize scene only if Firebase is ready
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
            camera.position.set(0, 3, 5);
            const controls = new OrbitControls(camera, renderer.domElement);
            controlsRef.current = controls;
            controls.enableDamping = true;
            controls.dampingFactor = 0.25;
            controls.enableZoom = true;
            controls.update();

            // Create environment
            createClubEnvironment(scene);
            
            // Create ghost spots and setup raycasting immediately
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

            // Cleanup
            return () => {
                window.removeEventListener('resize', handleResize);
                if (cleanupRaycasting) cleanupRaycasting();
                if (mountRef.current && renderer.domElement) {
                    mountRef.current.removeChild(renderer.domElement);
                }
                scene.traverse((object) => {
                    if (object.geometry) object.geometry.dispose();
                    if (object.material) {
                        if (Array.isArray(object.material)) {
                            object.material.forEach(material => material.dispose());
                        } else {
                            object.material.dispose();
                        }
                    }
                });
                renderer.dispose();
            };
        } catch (err) {
            console.error('Error initializing Three.js scene:', err);
            setError('Failed to initialize 3D scene. Please refresh the page.');
        }
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

    function drawCables(device, deviceIndex) {
        console.log('Drawing cables for:', device.name, 'Index:', deviceIndex);

        console.log('****** Devices in devicesRef:');
        console.log(devicesRef.current);

        if (device.connections) {
            device.connections.forEach(connection => {
                const endDeviceId = getDeviceId(connection.device);
                if (endDeviceId == null) {
                    return;
                }

                console.log("startDevice: " + device.name + "startDevice id: " + device.id + ". endDevice: " + connection.device + " endDevice id: " + endDeviceId)
                const startDeviceRender = devicesRef.current[device.id]?.model;
                const startDeviceConnectionsInUse = devicesRef.current[device.id]?.connectionsInUse;
                const endDeviceRender = devicesRef.current[endDeviceId]?.model;
                const endDeviceConnectionsInUse = devicesRef.current[endDeviceId]?.connectionsInUse;

                const startDevice = device;
                const endDevice = findDeviceByName(connection.device);

                if (!connectionIsAvailable(connection, startDeviceConnectionsInUse, endDeviceConnectionsInUse)) {
                    return;
                }

                if (startDevice && endDevice) {
                    startDeviceConnectionsInUse.inputs.push(connection.from);
                    endDeviceConnectionsInUse.inputs.push(connection.to);

                    let start = getConnectionPoint(startDevice, startDeviceRender, connection.from, 'output');
                    let end = getConnectionPoint(endDevice, endDeviceRender, connection.to, 'input');

                    const cableColor = getRandomColor(); //cableColors[connection.cable] || 0xffffff;

                    // Create a curved path for the cable
                    const midPoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
                    midPoint.y += 0.05; // Raise the midpoint slightly

                    const curve = new THREE.QuadraticBezierCurve3(start, midPoint, end);
                    const points = curve.getPoints(50);
                    const geometry = new THREE.BufferGeometry().setFromPoints(points);
                    const material = new THREE.LineBasicMaterial({ color: cableColor });
                    const line = new THREE.Line(geometry, material);

                    // Add the cable (line) to the scene and store it in cablesRef
                    sceneRef.current.add(line);
                    cablesRef.current.push(line);  // Store the cable
                }
            });
        }
    }

    function getRandomColor() {
        return Math.floor(Math.random() * 16777215);
    }

    function connectionIsAvailable(connection, startDeviceConnectionsInUse, endDeviceConnectionsInUse) {
        // if neither input nor output are in use, then it is available
        if (!startDeviceConnectionsInUse.inputs.includes(connection.from) &&
            !endDeviceConnectionsInUse.inputs.includes(connection.to)) {
            return true;
        }

        return false;
    }

    function updateConnections(devices) {
        removeOldCables();

        const sortedDevices = [...devices].sort((a, b) => a.locationPriority - b.locationPriority);

        setTimeout(() => {
            sortedDevices.forEach((device, index) => {
                if (device.connections) {
                    device.connections.forEach(connection => {
                        const targetDevice = devices.find(d => d.id === connection.targetDeviceId);
                        if (targetDevice) {
                            drawCable(device, targetDevice, connection);
                        }
                    });
                }
            });
            rendererRef.current.render(sceneRef.current, cameraRef.current);
        }, 1000);
    }

    function removeOldCables() {
        // Assuming cables are stored in an array cablesRef.current
        if (cablesRef.current && cablesRef.current.length > 0) {
            cablesRef.current.forEach(cable => {
                sceneRef.current.remove(cable);  // Remove each cable from the scene
            });
            cablesRef.current = [];  // Clear the array after removing all cables
        }
    }

    function getConnectionPoint(device, deviceRender, connectionName, connectionType) {
        console.log("getConnectionPoint: device: " + device.name + ", connectionName: " + connectionName + ", connectionType:" + connectionType)
        console.log("device: " + device.name)

        const connections = connectionType === 'input' ? device.inputs : device.outputs;
        const connection = connections.find(conn => conn.type === connectionName);

        console.log(deviceRender);
        if (connection) {
            console.log("Found connection: " + connection.type)
            const devicePosition = deviceRender.position.clone();
            return devicePosition.add(connection.coordinate);
        }

        // Default to the top position if not found
        return deviceRender.position.clone().add(new THREE.Vector3(0, 0.25, 0));
    }

    function findDeviceByName(name) {
        return devices.find(device => device.name === name);
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

    function drawCable(startDevice, endDevice, connection) {
        const startModel = devicesRef.current[startDevice.id]?.model;
        const endModel = devicesRef.current[endDevice.id]?.model;
        
        if (!startModel || !endModel) return;

        // Get connection points from the devices
        const startPoint = getConnectionPointFromDevice(startDevice, connection.from, 'output');
        const endPoint = getConnectionPointFromDevice(endDevice, connection.to, 'input');

        // Create a curved path for the cable
        const midPoint = new THREE.Vector3().addVectors(startPoint, endPoint).multiplyScalar(0.5);
        midPoint.y += 0.05; // Raise the midpoint slightly

        const curve = new THREE.QuadraticBezierCurve3(startPoint, midPoint, endPoint);
        const points = curve.getPoints(50);
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ 
            color: cableColors[connection.cableType] || 0xffffff 
        });
        const line = new THREE.Line(geometry, material);

        sceneRef.current.add(line);
        cablesRef.current.push(line);
    }

    function getConnectionPointFromDevice(device, connectionName, type) {
        const model = devicesRef.current[device.id]?.model;
        if (!model) return new THREE.Vector3();

        const connections = type === 'input' ? device.inputs : device.outputs;
        const connection = connections?.find(c => c.type === connectionName);
        
        if (connection?.position) {
            // Convert the stored local position to world position
            const worldPosition = model.localToWorld(
                new THREE.Vector3(
                    connection.position.x,
                    connection.position.y,
                    connection.position.z
                )
            );
            return worldPosition;
        }

        // Fallback to model position if no connection point is defined
        return model.position.clone();
    }

    function createGhostPlacementSpots(scene) {
        if (!djTableRef.current) return;

        const spots = currentSetupType === 'DJ' ? djSetupSpots : producerSetupSpots;
        ghostSpotsRef.current.forEach(spot => scene.remove(spot)); // Clear previous spots
        ghostSpotsRef.current = []; // Reset the array

        spots.forEach((position, index) => {
            // Determine if this is an FX spot or the middle back spot
            const isFXSpot = position.type?.includes('fx_');
            const isMiddleBack = position.type === SPOT_TYPES.MIDDLE_BACK;
            const shouldBeSmall = isFXSpot || isMiddleBack;
            
            // Create smaller geometry for FX spots and middle back spot
            const geometry = new THREE.BoxGeometry(
                shouldBeSmall ? 0.15 : 0.3,  // Half width for FX and middle back spots
                0.05,                         // Keep height the same
                shouldBeSmall ? 0.15 : 0.3    // Half depth for FX and middle back spots
            );
            
            const material = new THREE.MeshBasicMaterial({ 
                color: 0x808080, // Grey color
                transparent: true, 
                opacity: 0.4 
            });
            const ghostSquare = new THREE.Mesh(geometry, material);

            ghostSquare.position.set(position.x, position.y, position.z);
            ghostSquare.userData = { 
                index,
                defaultColor: 0x808080,
                hoverColor: 0xa0a0a0 // Lighter grey for hover
            }; 

            scene.add(ghostSquare);
            ghostSpotsRef.current.push(ghostSquare);
        });
    }

    function setupRaycasting() {
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();
        let hoveredSquare = null;

        function onMouseMove(event) {
            if (!rendererRef.current?.domElement) return;
            
            // Get the canvas element's bounding rectangle
            const rect = rendererRef.current.domElement.getBoundingClientRect();
            
            // Calculate mouse position in normalized device coordinates (-1 to +1)
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

            raycaster.setFromCamera(mouse, cameraRef.current);
            const intersects = raycaster.intersectObjects(ghostSpotsRef.current);

            // Reset previously hovered square
            if (hoveredSquare) {
                hoveredSquare.material.color.setHex(hoveredSquare.userData.defaultColor);
                hoveredSquare.material.opacity = 0.4;
            }

            // Set new hovered square
            if (intersects.length > 0) {
                hoveredSquare = intersects[0].object;
                hoveredSquare.material.color.setHex(hoveredSquare.userData.hoverColor);
                hoveredSquare.material.opacity = 0.6;
            } else {
                hoveredSquare = null;
            }
        }

        function onMouseClick(event) {
            if (!rendererRef.current?.domElement) return;
            
            event.preventDefault();

            // Get the canvas element's bounding rectangle
            const rect = rendererRef.current.domElement.getBoundingClientRect();
            
            // Calculate mouse position in normalized device coordinates (-1 to +1)
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

            raycaster.setFromCamera(mouse, cameraRef.current);
            const intersects = raycaster.intersectObjects(ghostSpotsRef.current);

            if (intersects.length > 0) {
                const clickedIndex = intersects[0].object.userData.index;
                handleGhostSquareClick(clickedIndex);
            }
        }

        // Only add listeners if we're within the canvas bounds
        if (rendererRef.current?.domElement) {
            rendererRef.current.domElement.addEventListener("mousemove", onMouseMove);
            rendererRef.current.domElement.addEventListener("click", onMouseClick);
        }

        return () => {
            if (rendererRef.current?.domElement) {
                rendererRef.current.domElement.removeEventListener("mousemove", onMouseMove);
                rendererRef.current.domElement.removeEventListener("click", onMouseClick);
            }
        };
    }

    return (
        <div ref={mountRef} style={{ width: "100%", height: "100%" }}>
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
                    top: '20px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    backgroundColor: 'white',
                    padding: '20px',
                    borderRadius: '8px',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                    zIndex: 1000
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
                <div className="search-modal" style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    backgroundColor: 'white',
                    padding: '20px',
                    borderRadius: '8px',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                    zIndex: 1000,
                    minWidth: '300px', // Added minimum width
                    maxWidth: '500px'   // Added maximum width
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                        <h3 style={{ margin: 0 }}>
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
                                cursor: 'pointer'
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
                        style={{
                            width: '100%',
                            padding: '8px',
                            marginBottom: '15px',
                            borderRadius: '4px',
                            border: '1px solid #ddd'
                        }}
                        autoFocus
                    />
                    <div style={{
                        marginBottom: '10px',
                        padding: '8px',
                        backgroundColor: '#f5f5f5',
                        borderRadius: '4px'
                    }}>
                        {searchMode === 'ghost' ? 
                            `Selecting device for position ${selectedGhostIndex + 1}` : 
                            'Select a device from the list below'}
                    </div>
                    <div style={{
                        maxHeight: '300px',
                        overflowY: 'auto',
                        border: '1px solid #ddd',
                        borderRadius: '4px'
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
                                            '&:hover': {
                                                backgroundColor: '#f5f5f5'
                                            }
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div>
                                                <div style={{ fontWeight: 'bold' }}>{product.name}</div>
                                                <div style={{ fontSize: '0.8em', color: '#666' }}>{product.category}</div>
                                            </div>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleConnectionPointMapping(product);
                                                }}
                                                style={{
                                                    padding: '4px 8px',
                                                    backgroundColor: '#4CAF50',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                Map
                                            </button>
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
                <div className="position-modal" style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    backgroundColor: 'white',
                    padding: '20px',
                    borderRadius: '8px',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                    zIndex: 1000
                }}>
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
            {showProductForm && <ProductForm onClose={() => setShowProductForm(false)} />}
        </div>
    );
}

export default ThreeScene;