import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import deviceLibrary, { CDJ3000Connections, DJM900Connections } from './deviceLibrary';

function ThreeScene({ devices }) {
    const mountRef = useRef(null);
    const sceneRef = useRef(null);
    const cameraRef = useRef(null);
    const controlsRef = useRef(null);
    const rendererRef = useRef(null);
    const devicesRef = useRef({});
    const djModelRef = useRef(null);

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
        if (!sceneRef.current || !cameraRef.current || !controlsRef.current) return;

        const scene = sceneRef.current;
        const camera = cameraRef.current;
        const controls = controlsRef.current;
        const loader = new GLTFLoader();

        console.log('Devices to render:', devices);

        // Clear previous devices
        Object.values(devicesRef.current).forEach(obj => {
            if (Array.isArray(obj)) {
                obj.forEach(device => scene.remove(device));
            } else {
                scene.remove(obj);
            }
        });
        devicesRef.current = {};
        scene.children = scene.children.filter(child => !(child instanceof THREE.Line));

        // Find the mixer (if any)
        const mixer = devices.find(device => device.name.includes('DJM'));
        const mixerPosition = new THREE.Vector3(0, 1.15, -0.25);

        // Get CDJs
        const cdjs = devices.filter(d => d.name.includes('CDJ'));

        devices.forEach((device, index) => {
            console.log('Processing device:', device.name, 'Index:', index, 'ID:', device.id);
            let position;
            
            if (device.name.includes('CDJ')) {
                const cdjIndex = cdjs.indexOf(device);
                const cdjPositions = [
                    new THREE.Vector3(-0.9, 1.15, -0.25),  // left of mixer
                    new THREE.Vector3(0.9, 1.15, -0.25),   // right of mixer
                    new THREE.Vector3(-1.8, 1.15, -0.25),  // far left
                    new THREE.Vector3(1.8, 1.15, -0.25)    // far right
                ];
                position = cdjPositions[cdjIndex];
            } else if (device.name.includes('DJM')) {
                position = mixerPosition;
            } else if (device.name.includes('Speaker')) {
                position = new THREE.Vector3(device.name.includes('Left') ? -2.5 : 2.5, 0.5, 0);
            } else if (device.name.includes('Headphones') && djModelRef.current) {
                position = new THREE.Vector3(0, 1.8, -0.75);
            } else {
                position = new THREE.Vector3(0, 1.15, -0.25);
            }

            loadDevice(device, position, loader, scene);
        });

        // Draw cables after all devices are loaded
        setTimeout(() => {
            devices.forEach((device, index) => {
                drawCables(device, index);
            });
            adjustCameraView();
            rendererRef.current.render(scene, camera);
        }, 1000);

    }, [devices]);

    function loadDevice(device, position, loader, scene) {
        if (device.modelPath) {
            console.log('Loading model from path:', device.modelPath);
            loader.load(
                device.modelPath,
                (gltf) => {
                    console.log('GLTF loaded successfully:', device.name);
                    const model = gltf.scene;
                    model.position.copy(position);
                    scene.add(model);

                    if (!devicesRef.current[device.name]) {
                        devicesRef.current[device.name] = [];
                    }
                    devicesRef.current[device.name].push(model);

                    const box = new THREE.Box3().setFromObject(model);
                    const center = box.getCenter(new THREE.Vector3());
                    model.position.sub(center).add(position);

                    const scale = 0.5;
                    model.scale.set(scale, scale, scale);

                    model.traverse((child) => {
                        if (child.isMesh) {
                            child.material.side = THREE.DoubleSide;
                            child.castShadow = true;
                            child.receiveShadow = true;
                        }
                    });

                    if (device.name.includes('Headphones') && djModelRef.current) {
                        djModelRef.current.add(model);
                    }
                },
                undefined,
                (error) => {
                    console.error('Error loading model:', device.name, error);
                    createPlaceholder(device, position, scene);
                }
            );
        } else {
            console.log('No model path for device:', device.name);
            createPlaceholder(device, position, scene);
        }
    }

    function createPlaceholder(device, position, scene) {
        console.log('Creating placeholder for:', device.name);
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshBasicMaterial({ color: 0x888888 });
        const cube = new THREE.Mesh(geometry, material);
        cube.position.copy(position);
        scene.add(cube);
        if (!devicesRef.current[device.name]) {
            devicesRef.current[device.name] = [];
        }
        devicesRef.current[device.name].push(cube);
    }

    function drawCables(device, deviceIndex) {
        console.log('Drawing cables for:', device.name, 'Index:', deviceIndex);
        if (device.connections) {
            device.connections.forEach(connection => {
                const startDevice = devicesRef.current[device.name][deviceIndex];
                const endDevices = devicesRef.current[connection.device];
                if (startDevice && endDevices && endDevices.length > 0) {
                    const endDevice = endDevices[0]; // Connect to the first instance of the target device
                    const start = getConnectionPoint(startDevice, device.name, connection.from);
                    const end = getConnectionPoint(endDevice, connection.device, connection.to);
                    
                    const cableColor = cableColors[connection.cable] || 0xffffff;
                    
                    // Create a curved path for the cable
                    const midPoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
                    midPoint.y += 0.05; // Raise the midpoint slightly

                    const curve = new THREE.QuadraticBezierCurve3(
                        start,
                        midPoint,
                        end
                    );

                    const points = curve.getPoints(50);
                    const geometry = new THREE.BufferGeometry().setFromPoints(points);
                    const material = new THREE.LineBasicMaterial({ color: cableColor });
                    const line = new THREE.Line(geometry, material);
                    sceneRef.current.add(line);
                }
            });
        }
    }

    function getConnectionPoint(deviceModel, deviceName, connectionName) {
        const connectionPoints = deviceName.includes('CDJ') ? CDJ3000Connections : DJM900Connections;
        const offset = connectionPoints[connectionName] || new THREE.Vector3(0, 0.25, 0); // Default to top if not found
        const devicePosition = deviceModel.position.clone();
        return devicePosition.add(offset);
    }

    function adjustCameraView() {
        const box = new THREE.Box3().setFromObject(sceneRef.current);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = cameraRef.current.fov * (Math.PI / 180);
        let cameraZ = Math.abs(maxDim / 2 * Math.tan(fov / 2));

        cameraZ *= 1.5;
        const cameraY = size.y / 2;

        cameraRef.current.position.set(center.x, center.y + cameraY, center.z + cameraZ);
        cameraRef.current.lookAt(center);
        cameraRef.current.updateProjectionMatrix();

        controlsRef.current.target.copy(center);
        controlsRef.current.update();
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
    }

    return <div ref={mountRef} style={{ width: '100%', height: '100%' }} />;
}

export default ThreeScene;