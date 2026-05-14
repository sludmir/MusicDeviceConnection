import * as THREE from 'three';

export function build(scene, ctx) {
  const added = [];
  const disposables = [];

  function add(obj) { scene.add(obj); added.push(obj); }
  function trackDispose(thing) { disposables.push(thing); }

  // Floor
  const floorGeo = new THREE.PlaneGeometry(30, 30);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8, metalness: 0.2 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  floor.userData.type = 'environment';
  add(floor);
  trackDispose(floorGeo); trackDispose(floorMat);

  // Table (anchor for device placement)
  const tableTopGeo = new THREE.PlaneGeometry(8, 1.4);
  const tableTopMat = new THREE.MeshStandardMaterial({ color: 0x222222, side: THREE.DoubleSide });
  const tableTop = new THREE.Mesh(tableTopGeo, tableTopMat);
  tableTop.rotation.x = -Math.PI / 2;
  tableTop.position.set(0, 0.95, -0.25);
  tableTop.receiveShadow = true;
  tableTop.userData.type = 'environment';
  add(tableTop);
  trackDispose(tableTopGeo); trackDispose(tableTopMat);

  if (ctx?.djTableRef) ctx.djTableRef.current = tableTop;

  // Booth back panel
  const boothBackGeo = new THREE.PlaneGeometry(8.6, 0.9);
  const boothBackMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.7, roughness: 0.3 });
  const boothBack = new THREE.Mesh(boothBackGeo, boothBackMat);
  boothBack.position.set(0, 0.45, -0.7);
  boothBack.userData.type = 'environment';
  add(boothBack);
  trackDispose(boothBackGeo); trackDispose(boothBackMat);

  // Club walls (simple back wall, side walls)
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x0c0c12, roughness: 0.95 });
  trackDispose(wallMat);
  const backWallGeo = new THREE.PlaneGeometry(30, 8);
  const backWall = new THREE.Mesh(backWallGeo, wallMat);
  backWall.position.set(0, 4, -10);
  backWall.userData.type = 'environment';
  add(backWall);
  trackDispose(backWallGeo);

  // Ambient + spot
  const ambient = new THREE.AmbientLight(0x404060, 0.4);
  ambient.userData.type = 'environment';
  add(ambient);

  const spot = new THREE.SpotLight(0xffffff, 0.8, 30, Math.PI / 6, 0.4, 1);
  spot.position.set(0, 8, 4);
  spot.target.position.set(0, 1, 0);
  spot.userData.type = 'environment';
  add(spot); add(spot.target);

  return {
    dispose() {
      added.forEach((obj) => scene.remove(obj));
      disposables.forEach((d) => d.dispose && d.dispose());
    },
  };
}
