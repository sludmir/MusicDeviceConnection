import * as THREE from 'three';

export function build(scene, ctx) {
  const added = [];
  const disposables = [];
  const add = (obj) => { scene.add(obj); added.push(obj); };
  const td = (d) => disposables.push(d);

  // Concrete patio floor
  const floorGeo = new THREE.PlaneGeometry(30, 30);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x8a8a8a, roughness: 0.95, metalness: 0.05 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  floor.userData.type = 'environment';
  add(floor); td(floorGeo); td(floorMat);

  // DJ table (same anchor)
  const tableTopGeo = new THREE.PlaneGeometry(8, 1.4);
  const tableTopMat = new THREE.MeshStandardMaterial({ color: 0x202020, side: THREE.DoubleSide });
  const tableTop = new THREE.Mesh(tableTopGeo, tableTopMat);
  tableTop.rotation.x = -Math.PI / 2;
  tableTop.position.set(0, 0.95, -0.25);
  tableTop.receiveShadow = true;
  tableTop.userData.type = 'environment';
  add(tableTop); td(tableTopGeo); td(tableTopMat);
  if (ctx?.djTableRef) ctx.djTableRef.current = tableTop;

  // Low parapet wall (concrete)
  const parapetMat = new THREE.MeshStandardMaterial({ color: 0x9a9a9a, roughness: 0.9 });
  td(parapetMat);
  function parapet(x, z, w, d) {
    const geo = new THREE.BoxGeometry(w, 1.0, d);
    const m = new THREE.Mesh(geo, parapetMat);
    m.position.set(x, 0.5, z);
    m.userData.type = 'environment';
    add(m); td(geo);
  }
  parapet(0, -10, 30, 0.3);     // back
  parapet(0, 10, 30, 0.3);      // front
  parapet(-15, 0, 0.3, 20);     // left
  parapet(15, 0, 0.3, 20);      // right

  // Skyline silhouette plane (back)
  const skylineGeo = new THREE.PlaneGeometry(40, 8);
  const skylineMat = new THREE.MeshBasicMaterial({ color: 0x2a3550, transparent: true, opacity: 0.85 });
  const skyline = new THREE.Mesh(skylineGeo, skylineMat);
  skyline.position.set(0, 4, -14);
  skyline.userData.type = 'environment';
  add(skyline); td(skylineGeo); td(skylineMat);

  // Sky backdrop (large blue plane behind skyline)
  const skyGeo = new THREE.PlaneGeometry(80, 30);
  const skyMat = new THREE.MeshBasicMaterial({ color: 0x6fb6ff });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.position.set(0, 8, -18);
  sky.userData.type = 'environment';
  add(sky); td(skyGeo); td(skyMat);

  // Cloud planes (a few translucent quads scattered)
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 });
  td(cloudMat);
  const cloudPositions = [
    { x: -8, y: 9, z: -17, w: 6, h: 1.2 },
    { x: 6, y: 11, z: -17, w: 7, h: 1.4 },
    { x: 0, y: 13, z: -17, w: 5, h: 1.0 },
    { x: -12, y: 12, z: -17, w: 4, h: 0.9 },
  ];
  cloudPositions.forEach((c) => {
    const geo = new THREE.PlaneGeometry(c.w, c.h);
    const m = new THREE.Mesh(geo, cloudMat);
    m.position.set(c.x, c.y, c.z);
    m.userData.type = 'environment';
    add(m); td(geo);
  });

  // Daylight + warm rim
  const sun = new THREE.DirectionalLight(0xfff2d6, 1.1);
  sun.position.set(8, 12, 6);
  sun.userData.type = 'environment';
  add(sun);

  const sky2 = new THREE.HemisphereLight(0x9ecbff, 0x8a8a8a, 0.6);
  sky2.userData.type = 'environment';
  add(sky2);

  return {
    dispose() {
      added.forEach((o) => scene.remove(o));
      disposables.forEach((d) => d.dispose && d.dispose());
    },
  };
}
