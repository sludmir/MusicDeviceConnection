import React, { useRef, useEffect, useCallback, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

const PANEL_BG = 0x0a0a0f;

function cloneSceneObjects(sourceScene) {
    const group = new THREE.Group();
    sourceScene.children.forEach(child => {
        if (child.isLight) return;
        if (child instanceof THREE.Line || child instanceof THREE.LineSegments || child instanceof THREE.LineLoop) return;
        if (child.userData?.isCable || child.userData?.isConnection) return;

        try {
            const clone = child.clone(true);
            clone.traverse(obj => {
                if (obj.isMesh && obj.material) {
                    obj.material = obj.material.clone();
                    if (obj.material.emissive) {
                        obj.material.emissive.set(0, 0, 0);
                        obj.material.emissiveIntensity = 0;
                    }
                }
            });
            group.add(clone);
        } catch (_) { /* skip objects that can't clone */ }
    });
    return group;
}

function ModelPreviewPanel({ file, scale, onClose, mainSceneRef, ghostSpotPosition }) {
    const containerRef = useRef(null);
    const [rawDims, setRawDims] = useState(null);
    const threeRef = useRef({
        renderer: null, scene: null, camera: null,
        controls: null, model: null, frameId: null,
        blobURL: null, basePos: null,
    });
    const scaleRef = useRef(scale);
    scaleRef.current = scale;

    const teardown = useCallback(() => {
        const t = threeRef.current;
        if (t.frameId) cancelAnimationFrame(t.frameId);
        if (t.controls) t.controls.dispose();
        const mount = containerRef.current;
        if (t.renderer) {
            if (mount && mount.contains(t.renderer.domElement)) mount.removeChild(t.renderer.domElement);
            t.renderer.dispose();
        }
        if (t.blobURL) URL.revokeObjectURL(t.blobURL);
        Object.assign(t, { renderer: null, scene: null, camera: null, controls: null, model: null, frameId: null, blobURL: null, basePos: null });
    }, []);

    useEffect(() => {
        const mount = containerRef.current;
        if (!mount || !file) return;
        teardown();
        setRawDims(null);

        const t = threeRef.current;
        const width = mount.clientWidth || 420;
        const height = mount.clientHeight || 360;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(PANEL_BG);
        t.scene = scene;

        const spotPos = ghostSpotPosition || { x: 0, y: 0.5, z: 0 };

        const camera = new THREE.PerspectiveCamera(45, width / height, 0.005, 500);
        camera.position.set(spotPos.x + 2.5, spotPos.y + 2.0, spotPos.z + 3.0);
        camera.lookAt(spotPos.x, spotPos.y, spotPos.z);
        t.camera = camera;

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.0;
        mount.appendChild(renderer.domElement);
        t.renderer = renderer;

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.target.set(spotPos.x, spotPos.y, spotPos.z);
        controls.minDistance = 0.1;
        controls.maxDistance = 80;
        controls.update();
        t.controls = controls;

        scene.add(new THREE.AmbientLight(0xffffff, 0.5));
        const key = new THREE.DirectionalLight(0xffffff, 0.85);
        key.position.set(3, 5, 3);
        scene.add(key);
        const fill = new THREE.DirectionalLight(0x8899ff, 0.2);
        fill.position.set(-2, 1, -1);
        scene.add(fill);

        if (mainSceneRef?.current) {
            const envGroup = cloneSceneObjects(mainSceneRef.current);
            scene.add(envGroup);
        } else {
            scene.add(new THREE.GridHelper(6, 30, 0x333333, 0x222222));
        }

        const blobURL = URL.createObjectURL(file);
        t.blobURL = blobURL;

        const loader = new GLTFLoader();
        loader.load(blobURL, (gltf) => {
            if (!t.scene) return;
            const model = gltf.scene;
            t.model = model;

            const box = new THREE.Box3().setFromObject(model);
            const size = new THREE.Vector3();
            const center = new THREE.Vector3();
            box.getCenter(center);
            box.getSize(size);
            setRawDims({ x: size.x, y: size.y, z: size.z });

            model.position.set(
                spotPos.x - center.x,
                spotPos.y - center.y + size.y / 2,
                spotPos.z - center.z
            );
            t.basePos = model.position.clone();

            const highlightRing = new THREE.Mesh(
                new THREE.RingGeometry(0.25, 0.35, 32),
                new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
            );
            highlightRing.rotation.x = -Math.PI / 2;
            highlightRing.position.set(spotPos.x, spotPos.y + 0.01, spotPos.z);
            scene.add(highlightRing);

            scene.add(model);
        }, undefined, (err) => console.error('Preview load error:', err));

        const animate = () => {
            t.frameId = requestAnimationFrame(animate);
            if (t.model) {
                t.model.scale.setScalar(scaleRef.current);
            }
            if (t.controls) t.controls.update();
            if (t.renderer && t.scene && t.camera) t.renderer.render(t.scene, t.camera);
        };
        animate();

        const handleResize = () => {
            if (!mount || !t.camera || !t.renderer) return;
            const w = mount.clientWidth || 420;
            const h = mount.clientHeight || 360;
            t.camera.aspect = w / h;
            t.camera.updateProjectionMatrix();
            t.renderer.setSize(w, h);
        };
        window.addEventListener('resize', handleResize);
        return () => { window.removeEventListener('resize', handleResize); teardown(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [file, teardown]);

    const scaledDims = rawDims ? {
        x: (rawDims.x * scale).toFixed(3),
        y: (rawDims.y * scale).toFixed(3),
        z: (rawDims.z * scale).toFixed(3),
    } : null;

    return (
        <div style={{
            position: 'absolute',
            top: '50%', left: 'calc(50% + 340px)',
            transform: 'translateY(-50%)',
            width: '420px',
            background: 'rgba(10,10,10,0.95)',
            border: '1px solid rgba(0,162,255,0.25)',
            borderRadius: '10px',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            zIndex: 1001,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px 10px' }}>
                <span style={{ color: '#fff', fontWeight: '600', fontSize: '14px', fontFamily: 'Space Grotesk, sans-serif' }}>
                    Model Preview
                </span>
                <button
                    onClick={onClose}
                    style={{ background: 'none', border: 'none', color: '#888', fontSize: '20px', cursor: 'pointer', lineHeight: 1, padding: '2px' }}
                >×</button>
            </div>

            <div ref={containerRef} style={{ width: '100%', height: '320px', background: '#0a0a0f' }} />

            <div style={{ padding: '12px 16px 14px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                {scaledDims && (
                    <div style={{ display: 'flex', gap: '14px', marginBottom: '6px', justifyContent: 'center' }}>
                        {['W', 'H', 'D'].map((label, i) => (
                            <span key={label} style={{ color: '#888', fontSize: '11px', fontFamily: 'monospace' }}>
                                {label}: <span style={{ color: '#ccc' }}>{[scaledDims.x, scaledDims.y, scaledDims.z][i]}</span>
                            </span>
                        ))}
                    </div>
                )}
                <div style={{ color: '#555', fontSize: '11px', textAlign: 'center' }}>
                    Drag to orbit &nbsp;·&nbsp; Scroll to zoom
                </div>
            </div>
        </div>
    );
}

export default ModelPreviewPanel;
