import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { getStorageModelURL } from '../firebaseUtils';
import './FaveProductViewer.css';

const VIEWER_HEIGHT = 280;
const SPIN_SPEED = 0.35; // radians per second

async function resolveModelURL(product) {
  if (!product) return null;
  let url = product.modelPath || product.modelUrl || null;
  const isLocalPath = url && !url.startsWith('http') && !url.startsWith('gs://');
  const isCDJ3000 = product.name && (String(product.name).includes('CDJ-3000') || String(product.name).includes('CDJ3000'));
  if (!url || (isCDJ3000 && (isLocalPath || (url && url.includes('localhost'))))) {
    const firebaseURL = await getStorageModelURL(`${product.name}.glb`);
    if (firebaseURL) url = firebaseURL;
    else if (isCDJ3000) url = null;
  }
  if (url && !url.startsWith('http') && !url.startsWith('gs://')) {
    url = url.startsWith('/') ? `${window.location.origin}${url}` : `${window.location.origin}/${url}`;
  }
  return url || null;
}

function FaveProductViewer({ product }) {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const modelRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const frameIdRef = useRef(null);

  useEffect(() => {
    if (!product || !containerRef.current) return;

    let modelURL = null;
    const mount = containerRef.current;
    const width = mount.clientWidth || 320;
    const height = VIEWER_HEIGHT;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0c0c12);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(0, 0, 3.2);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(2, 3, 2);
    scene.add(dir);
    const fill = new THREE.DirectionalLight(0x8899ff, 0.25);
    fill.position.set(-1, 0, -1);
    scene.add(fill);

    let cancelled = false;

    (async () => {
      modelURL = await resolveModelURL(product);
      if (cancelled || !modelURL) {
        if (!modelURL && !cancelled) console.warn('FaveProductViewer: no model URL for', product?.name);
        return;
      }

      const loader = new GLTFLoader();
      loader.load(
        modelURL,
        (gltf) => {
          if (cancelled || !sceneRef.current) return;
          const model = gltf.scene.clone();
          modelRef.current = model;

          const box = new THREE.Box3().setFromObject(model);
          const center = new THREE.Vector3();
          const size = new THREE.Vector3();
          box.getCenter(center);
          box.getSize(size);
          model.position.sub(center);
          const maxDim = Math.max(size.x, size.y, size.z, 0.001);
          const scale = 1.8 / maxDim;
          model.scale.setScalar(scale);

          model.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });

          scene.add(model);
        },
        undefined,
        (err) => console.error('FaveProductViewer load error:', err)
      );
    })();

    const animate = () => {
      frameIdRef.current = requestAnimationFrame(animate);
      if (modelRef.current) {
        modelRef.current.rotation.y += (SPIN_SPEED * Math.PI) / 180;
      }
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();

    const handleResize = () => {
      if (!mount || !cameraRef.current || !rendererRef.current) return;
      const w = mount.clientWidth || 320;
      const h = VIEWER_HEIGHT;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelled = true;
      window.removeEventListener('resize', handleResize);
      if (frameIdRef.current) cancelAnimationFrame(frameIdRef.current);
      if (rendererRef.current && mount.contains(rendererRef.current.domElement)) {
        mount.removeChild(rendererRef.current.domElement);
        rendererRef.current.dispose();
      }
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      modelRef.current = null;
    };
  }, [product?.id, product?.name, product?.modelPath, product?.modelUrl]);

  if (!product) return null;

  return (
    <div className="fave-product-viewer-wrap">
      <div ref={containerRef} className="fave-product-viewer" style={{ height: VIEWER_HEIGHT }} />
    </div>
  );
}

export default FaveProductViewer;
