import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import deviceLibrary, { CDJ3000Connections, DJM900Connections } from './deviceLibrary';
import { mod } from 'three/webgpu';

function ThreeScene({ devices }) {
    const mountRef = useRef(null);
    const sceneRef = useRef(null);
    const cameraRef = useRef(null);
    const controlsRef = useRef(null);
    const rendererRef = useRef(null);

    const devicesRef = useRef([]);
    const prevDevicesRef = useRef(devices);

    const cablesRef = useRef([]);
    const djTableRef = useRef(null);

    const [isSceneInitialized, setIsSceneInitialized] = useState(false);

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

        const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
        scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(5, 5, 5);
        scene.add(directionalLight);

        const hemisphereLight = new THREE.HemisphereLight(0xffffbb, 0x080820, 1);
        scene.add(hemisphereLight);

        createClubEnvironment(scene);

        const controls = new OrbitControls(camera, renderer.domElement);
        controlsRef.current = controls;
        controls.enableDamping = true;
        controls.dampingFactor = 0.25;
        controls.enableZoom = true;

        camera.position.set(0, 3, 5);
        controls.update();

        const animate = function () {
            requestAnimationFrame(animate);
            controls.update();
            renderer.render(scene, camera);
        };
        animate();

        const handleResize = () => {
            if (!mountRef.current) return;
            const width = mountRef.current.clientWidth;
            const height = mountRef.current.clientHeight;
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            renderer.setSize(width, height);
        };
        window.addEventListener('resize', handleResize);

        // Mark the scene as initialized
        setIsSceneInitialized(true);

        return () => {
            window.removeEventListener('resize', handleResize);
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
    }, []);

    useEffect(() => {
        if (!isSceneInitialized || !sceneRef.current || !cameraRef.current || !controlsRef.current) return;

        const scene = sceneRef.current;
        const loader = new GLTFLoader();
        const previousDevices = prevDevicesRef.current;

        // Compare current devices with previous devices
        let removedDevices = previousDevices; //.filter(prevDevice => !devices.some(dev => dev.id === prevDevice.id));
        let addedDevices = devices.filter(device => !previousDevices.some(prevDev => prevDev.id === device.id));

        const sortedDevices = [...devices].sort((a, b) => a.locationPriority - b.locationPriority);
        console.log('sorted devices: ', sortedDevices);

        // Remove old devices that are no longer present
        removedDevices.forEach(device => {
            if (devicesRef.current[device.id]) {
                const model = devicesRef.current[device.id];
                scene.remove(model);
                delete devicesRef.current[device.id];
                console.log('removed devices ', device.id);
            }
        });

        // Add or reposition devices based on sorted order
        sortedDevices.forEach((device, index) => {
            if (devicesRef.current[device.id]) {
                // const model = devicesRef.current[device.id];
                // const box = new THREE.Box3().setFromObject(model);
                // const size = new THREE.Vector3();
                // box.getSize(size);
                // console.log('Model dimensions:', size.x, size.y, size.z);
                // const position = getDevicePosition(device, index, size);
                // model.position.set(position.x, position.y, position.z);
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
        if (device.modelPath) {
            console.log('Loading model from path:', device.modelPath, index);
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
                    console.log(`Model dimensions (width, height, depth): ${size.x}, ${size.y}, ${size.z}`);

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
                    devicesRef.current[device.id] = model;

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
                undefined,
                (error) => {
                    console.error('Error loading model:', device.name, error);
                    createPlaceholderRender(device, position, scene);  // Handle fallback if model fails to load
                }
            );
        } else {
            console.log('No model path for device:', device.name);
            createPlaceholderRender(device, position, scene);  // Handle devices with no model path
        }
    }


    // Define getDevicePosition if it's not defined yet
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

        console.log(`Setting location for ${device.name}. x:${position.x}, y:${position.y}, z:${position.z}`);
        return position;
    }

    function createPlaceholderRender(device, position, scene) {
        console.log('Creating placeholder for:', device.name);
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshBasicMaterial({ color: 0x888888 });
        const cube = new THREE.Mesh(geometry, material);
        cube.position.copy(position);
        scene.add(cube);
        devicesRef.current[device.id] = cube;
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
                const startDeviceRender = devicesRef.current[device.id];
                const endDeviceRender = devicesRef.current[endDeviceId];

                const startDevice = device;
                const endDevice = findDeviceByName(connection.device);
                if (startDevice && endDevice) {
                    let start = getConnectionPoint(startDevice, startDeviceRender, connection.from, 'output');
                    let end = getConnectionPoint(endDevice, endDeviceRender, connection.to, 'input');

                    const cableColor = cableColors[connection.cable] || 0xffffff;

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


    function updateConnections(devices) {
        // First, remove old cables (or connections) before adding new ones
        removeOldCables();  // You will define this function to clean up old cables

        setTimeout(() => {
            devices.forEach((device, index) => {
                drawCables(device, index);  // Add cables for each device
            });
            rendererRef.current.render(sceneRef.current, cameraRef.current);
        }, 1000);
    }

    function removeOldCables() {
        // Assuming cables are stored in an array `cablesRef.current`
        if (cablesRef.current && cablesRef.current.length > 0) {
            cablesRef.current.forEach(cable => {
                sceneRef.current.remove(cable);  // Remove each cable from the scene
            });
            cablesRef.current = [];  // Clear the array after removing all cables
        }
    }

    function getConnectionPoint(deviceModel, deviceRender, connectionName, connectionType) {
        console.log("getConnectionPoint: device: " + deviceModel.name + ", connectionName: " + connectionName + ", connectionType:" + connectionType)
        console.log("device: " + deviceModel.name)

        const connections = connectionType === 'input' ? deviceModel.inputs : deviceModel.outputs;
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
        return Object.values(deviceLibrary).find(device => device.name === name);
    }

    // function adjustCameraView() {
    //     const box = new THREE.Box3().setFromObject(sceneRef.current);
    //     const size = box.getSize(new THREE.Vector3());
    //     const center = box.getCenter(new THREE.Vector3());

    //     const maxDim = Math.max(size.x, size.y, size.z);
    //     const fov = cameraRef.current.fov * (Math.PI / 180);
    //     let cameraZ = Math.abs(maxDim / 2 * Math.tan(fov / 2));

    //     cameraZ *= 1.5;
    //     const cameraY = size.y / 2;

    //     cameraRef.current.position.set(center.x, center.y + cameraY, center.z + cameraZ);
    //     cameraRef.current.lookAt(center);
    //     cameraRef.current.updateProjectionMatrix();

    //     controlsRef.current.target.copy(center);
    //     controlsRef.current.update();
    // }

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

    return <div ref={mountRef} style={{ width: '100%', height: '100%' }} />;
}

export default ThreeScene;