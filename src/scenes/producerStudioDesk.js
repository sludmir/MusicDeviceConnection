import * as THREE from 'three';

export function build(scene, ctx) {
  const added = []; const disposables = [];
  const add = (o) => { scene.add(o); added.push(o); };
  const td = (d) => disposables.push(d);

  const floorGeo = new THREE.PlaneGeometry(20, 20);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x2a2520, roughness: 0.9 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
  floor.userData.type = 'environment';
  add(floor); td(floorGeo); td(floorMat);

  const deskGeo = new THREE.PlaneGeometry(8, 1.4);
  const deskMat = new THREE.MeshStandardMaterial({ color: 0x3a2f25, side: THREE.DoubleSide });
  const desk = new THREE.Mesh(deskGeo, deskMat);
  desk.rotation.x = -Math.PI / 2; desk.position.set(0, 0.95, -0.25);
  desk.userData.type = 'environment';
  add(desk); td(deskGeo); td(deskMat);
  if (ctx?.djTableRef) ctx.djTableRef.current = desk;

  const backWallGeo = new THREE.PlaneGeometry(20, 6);
  const backWallMat = new THREE.MeshStandardMaterial({ color: 0x1c1c20, roughness: 0.95 });
  const backWall = new THREE.Mesh(backWallGeo, backWallMat);
  backWall.position.set(0, 3, -8);
  backWall.userData.type = 'environment';
  add(backWall); td(backWallGeo); td(backWallMat);

  add(Object.assign(new THREE.AmbientLight(0x6678aa, 0.5), { userData: { type: 'environment' } }));
  const key = new THREE.DirectionalLight(0xffffff, 0.7);
  key.position.set(2, 5, 4); key.userData.type = 'environment';
  add(key);

  return {
    dispose() {
      added.forEach((o) => scene.remove(o));
      disposables.forEach((d) => d.dispose && d.dispose());
    },
  };
}
