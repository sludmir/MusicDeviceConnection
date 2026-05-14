import * as THREE from 'three';

export function build(scene, ctx) {
  const added = []; const disposables = [];
  const add = (o) => { scene.add(o); added.push(o); };
  const td = (d) => disposables.push(d);

  // Black house floor
  const houseGeo = new THREE.PlaneGeometry(30, 30);
  const houseMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 1.0 });
  const house = new THREE.Mesh(houseGeo, houseMat);
  house.rotation.x = -Math.PI / 2;
  house.userData.type = 'environment';
  add(house); td(houseGeo); td(houseMat);

  // Raised wooden stage platform
  const stageGeo = new THREE.BoxGeometry(14, 0.2, 8);
  const stageMat = new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.7 });
  const stage = new THREE.Mesh(stageGeo, stageMat);
  stage.position.set(0, 0.1, 0); stage.receiveShadow = true;
  stage.userData.type = 'environment';
  add(stage); td(stageGeo); td(stageMat);

  // Stage top anchor (the deck device-placement uses)
  const deckGeo = new THREE.PlaneGeometry(8, 1.4);
  const deckMat = new THREE.MeshStandardMaterial({ color: 0x6a4a2c, side: THREE.DoubleSide });
  const deck = new THREE.Mesh(deckGeo, deckMat);
  deck.rotation.x = -Math.PI / 2; deck.position.set(0, 0.95, -0.25);
  deck.userData.type = 'environment';
  add(deck); td(deckGeo); td(deckMat);
  if (ctx?.djTableRef) ctx.djTableRef.current = deck;

  // Brick backdrop
  const brickGeo = new THREE.PlaneGeometry(20, 8);
  const brickMat = new THREE.MeshStandardMaterial({ color: 0x4a2422, roughness: 0.95 });
  const brick = new THREE.Mesh(brickGeo, brickMat);
  brick.position.set(0, 4, -7.9); brick.userData.type = 'environment';
  add(brick); td(brickGeo); td(brickMat);

  // Edge LED strip along front of stage (emissive bar)
  const ledGeo = new THREE.BoxGeometry(14, 0.04, 0.04);
  const ledMat = new THREE.MeshBasicMaterial({ color: 0xff3060 });
  const led = new THREE.Mesh(ledGeo, ledMat);
  led.position.set(0, 0.22, 4); led.userData.type = 'environment';
  add(led); td(ledGeo); td(ledMat);

  // Wedge monitors (boxes at stage corners)
  const wedgeMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.7 });
  td(wedgeMat);
  function wedge(x) {
    const geo = new THREE.BoxGeometry(0.9, 0.5, 0.7);
    const m = new THREE.Mesh(geo, wedgeMat);
    m.position.set(x, 0.45, 3.4); m.rotation.y = x < 0 ? 0.3 : -0.3;
    m.userData.type = 'environment';
    add(m); td(geo);
  }
  wedge(-5.5); wedge(5.5);

  // Warm PAR cans (point lights overhead)
  function par(x, color) {
    const l = new THREE.PointLight(color, 1.2, 12, 1.8);
    l.position.set(x, 6, 2); l.userData.type = 'environment';
    add(l);
  }
  par(-3, 0xff9050);
  par(0, 0xffe0a0);
  par(3, 0xff9050);

  add(Object.assign(new THREE.AmbientLight(0x221122, 0.35), { userData: { type: 'environment' } }));

  return {
    dispose() {
      added.forEach((o) => scene.remove(o));
      disposables.forEach((d) => d.dispose && d.dispose());
    },
  };
}
