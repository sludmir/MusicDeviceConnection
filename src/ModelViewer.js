import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

const ModelViewer = ({ modelPath }) => {
    const mountRef = useRef(null);

    useEffect(() => {
        // Scene setup
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.set(0, 0, 10); // Set z to a higher value if the model is too large or too close        
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        mountRef.current.appendChild(renderer.domElement);

        // Lighting
        const ambientLight = new THREE.AmbientLight(0x404040); // soft white light
        scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
        directionalLight.position.set(0, 1, 1);
        scene.add(directionalLight);

        // Load the GLB model
        const loader = new GLTFLoader();
        loader.load(modelPath, gltf => {
            scene.add(gltf.scene);
            camera.position.z = 5; // Adjust camera position based on the size and scale of the model
            const model = gltf.scene;
            model.scale.setLength(0.1, 0.1, 0.1) // Adjust scale values according to the model size
            scene.add(model);
            animate();
        }, undefined, error => {
            console.error('An error happened loading the model:', error);
        });

        // Animation loop
        const animate = () => {
            requestAnimationFrame(animate);
            renderer.render(scene, camera);
        };

        // Cleanup function
        return () => {
            mountRef.current.removeChild(renderer.domElement);
        };
    }, [modelPath]);

    return <div ref={mountRef} />;
};

export default ModelViewer;
