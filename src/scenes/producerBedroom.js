import * as THREE from 'three';

export function build(scene, ctx) {
  const added = []; const disposables = [];
  const add = (o) => { scene.add(o); added.push(o); };
  const td = (d) => disposables.push(d);

  // Warm wood floor
  const floorGeo = new THREE.PlaneGeometry(18, 18);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2b, roughness: 0.85 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
  floor.userData.type = 'environment';
  add(floor); td(floorGeo); td(floorMat);

  // Rug under desk
  const rugGeo = new THREE.PlaneGeometry(7, 4);
  const rugMat = new THREE.MeshStandardMaterial({ color: 0x4a2222, roughness: 1.0 });
  const rug = new THREE.Mesh(rugGeo, rugMat);
  rug.rotation.x = -Math.PI / 2; rug.position.set(0, 0.005, 1.5);
  rug.userData.type = 'environment';
  add(rug); td(rugGeo); td(rugMat);

  // Desk surface (anchor)
  const deskGeo = new THREE.PlaneGeometry(8, 1.4);
  const deskMat = new THREE.MeshStandardMaterial({ color: 0x4e3a26, side: THREE.DoubleSide });
  const desk = new THREE.Mesh(deskGeo, deskMat);
  desk.rotation.x = -Math.PI / 2; desk.position.set(0, 0.95, -0.25);
  desk.userData.type = 'environment';
  add(desk); td(deskGeo); td(deskMat);
  if (ctx?.djTableRef) ctx.djTableRef.current = desk;

  // Back wall with acoustic foam panels (tiled boxes)
  const wallGeo = new THREE.PlaneGeometry(18, 6);
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xc9b89a, roughness: 1.0 });
  const wall = new THREE.Mesh(wallGeo, wallMat);
  wall.position.set(0, 3, -7); wall.userData.type = 'environment';
  add(wall); td(wallGeo); td(wallMat);

  const foamMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 1.0 });
  td(foamMat);
  const foamGeo = new THREE.BoxGeometry(0.7, 0.7, 0.05);
  td(foamGeo);
  for (let row = 0; row < 3; row++) {
    for (let col = -3; col <= 3; col++) {
      const panel = new THREE.Mesh(foamGeo, foamMat);
      panel.position.set(col * 0.8, 2.2 + row * 0.8, -6.95);
      panel.userData.type = 'environment';
      add(panel);
    }
  }

  // Window (light blue plane embedded in wall)
  const windowGeo = new THREE.PlaneGeometry(3, 2);
  const windowMat = new THREE.MeshBasicMaterial({ color: 0xbcdfff });
  const win = new THREE.Mesh(windowGeo, windowMat);
  win.position.set(5, 3, -6.94); win.userData.type = 'environment';
  add(win); td(windowGeo); td(windowMat);

  // Tungsten desk lamp light (warm point light)
  const lamp = new THREE.PointLight(0xffb070, 1.2, 8, 2);
  lamp.position.set(-2, 1.6, 0.5);
  lamp.userData.type = 'environment';
  add(lamp);

  // Soft daylight from window direction
  const day = new THREE.DirectionalLight(0xeaf2ff, 0.5);
  day.position.set(6, 4, 2); day.userData.type = 'environment';
  add(day);
  add(Object.assign(new THREE.AmbientLight(0x554433, 0.35), { userData: { type: 'environment' } }));

  return {
    dispose() {
      added.forEach((o) => scene.remove(o));
      disposables.forEach((d) => d.dispose && d.dispose());
    },
  };
}
