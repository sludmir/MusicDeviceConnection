import * as THREE from 'three';

export function build(scene, ctx) {
  const added = [];
  const disposables = [];
  const add = (obj) => { scene.add(obj); added.push(obj); };
  const td = (d) => disposables.push(d);

  // ── Shared prefix: floor + table + legs ──────────────────────────────────

  const floorSize = 30; // DJ gets the larger floor
  const floorGeo = new THREE.PlaneGeometry(floorSize, floorSize);
  const floor = new THREE.Mesh(floorGeo, null); // material set below
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  floor.userData.type = 'environment';
  td(floorGeo);

  const tableGroup = new THREE.Group();

  const tableTopGeo = new THREE.PlaneGeometry(8, 1.4);
  const tableTopMat = new THREE.MeshStandardMaterial({
    color: 0x222222,
    side: THREE.DoubleSide,
  });
  const tableTop = new THREE.Mesh(tableTopGeo, tableTopMat);
  tableTop.rotation.x = -Math.PI / 2;
  tableTop.position.set(0, 0.95, -0.25);
  tableTop.receiveShadow = true;
  tableTop.castShadow = false;
  tableGroup.add(tableTop);
  td(tableTopGeo); td(tableTopMat);

  const legGeometry = new THREE.BoxGeometry(0.1, 0.9, 0.1);
  const legMaterial = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
  td(legGeometry); td(legMaterial);

  [{ x: -3.9, z: 0.2 }, { x: 3.9, z: 0.2 }].forEach((pos) => {
    const leg = new THREE.Mesh(legGeometry, legMaterial);
    leg.position.set(pos.x, 0.5, pos.z);
    leg.receiveShadow = true;
    leg.castShadow = true;
    tableGroup.add(leg);
  });

  tableGroup.position.set(0, 0, 0);
  tableGroup.userData.type = 'environment';

  if (ctx?.djTableRef) ctx.djTableRef.current = tableTop;

  // ── DJ case: Hï Ibiza-inspired club environment ───────────────────────────

  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x111111,
    roughness: 0.8,
    metalness: 0.2,
  });
  floor.material = floorMat;
  td(floorMat);

  // DJ Booth frame structure
  const boothGroup = new THREE.Group();
  const boothMaterial = new THREE.MeshStandardMaterial({
    color: 0x333333,
    metalness: 0.7,
    roughness: 0.3,
  });
  td(boothMaterial);

  const boothTopGeo = new THREE.PlaneGeometry(8.6, 1.6);
  const boothTop = new THREE.Mesh(boothTopGeo, boothMaterial);
  boothTop.rotation.x = -Math.PI / 2;
  boothTop.position.set(0, 0.9, -0.25);
  boothTop.receiveShadow = true;
  boothGroup.add(boothTop);
  td(boothTopGeo);

  const boothBackGeo = new THREE.PlaneGeometry(8.6, 0.9);
  const boothBack = new THREE.Mesh(boothBackGeo, boothMaterial);
  boothBack.position.set(0, 0.45, -1.05);
  boothBack.receiveShadow = true;
  boothGroup.add(boothBack);
  td(boothBackGeo);

  const sideMaterial = boothMaterial.clone();
  td(sideMaterial);

  const leftSideGeo = new THREE.PlaneGeometry(1.6, 0.9);
  const leftSide = new THREE.Mesh(leftSideGeo, sideMaterial);
  leftSide.rotation.y = Math.PI / 2;
  leftSide.position.set(-4.3, 0.45, -0.25);
  leftSide.receiveShadow = true;
  boothGroup.add(leftSide);
  td(leftSideGeo);

  const rightSideGeo = new THREE.PlaneGeometry(1.6, 0.9);
  const rightSide = new THREE.Mesh(rightSideGeo, sideMaterial);
  rightSide.rotation.y = -Math.PI / 2;
  rightSide.position.set(4.3, 0.45, -0.25);
  rightSide.receiveShadow = true;
  boothGroup.add(rightSide);
  td(rightSideGeo);

  boothGroup.position.set(0, 0, 0);
  boothGroup.userData.type = 'environment';
  add(boothGroup);

  const roomWidth = 24;
  const roomDepth = 28;
  const roomHeight = 10;
  const crowdFloorY = -1.2;

  const djWallMaterial = new THREE.MeshStandardMaterial({
    color: 0x080808,
    roughness: 0.95,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });
  td(djWallMaterial);

  // Back wall
  const backWallGeo = new THREE.PlaneGeometry(roomWidth, roomHeight);
  const backWall = new THREE.Mesh(backWallGeo, djWallMaterial);
  backWall.rotation.y = Math.PI;
  backWall.position.set(0, roomHeight / 2 + crowdFloorY, -roomDepth / 2);
  backWall.receiveShadow = true;
  backWall.userData.type = 'environment';
  add(backWall); td(backWallGeo);

  // Left wall
  const leftWallMat = djWallMaterial.clone();
  const leftWallGeo = new THREE.PlaneGeometry(roomDepth, roomHeight);
  const leftWall = new THREE.Mesh(leftWallGeo, leftWallMat);
  leftWall.rotation.y = Math.PI / 2;
  leftWall.position.set(-roomWidth / 2, roomHeight / 2 + crowdFloorY, 0);
  leftWall.receiveShadow = true;
  leftWall.userData.type = 'environment';
  add(leftWall); td(leftWallGeo); td(leftWallMat);

  // Right wall
  const rightWallMat = djWallMaterial.clone();
  const rightWallGeo = new THREE.PlaneGeometry(roomDepth, roomHeight);
  const rightWall = new THREE.Mesh(rightWallGeo, rightWallMat);
  rightWall.rotation.y = -Math.PI / 2;
  rightWall.position.set(roomWidth / 2, roomHeight / 2 + crowdFloorY, 0);
  rightWall.receiveShadow = true;
  rightWall.userData.type = 'environment';
  add(rightWall); td(rightWallGeo); td(rightWallMat);

  // Front wall
  const frontWallMat = djWallMaterial.clone();
  const frontWallGeo = new THREE.PlaneGeometry(roomWidth, roomHeight);
  const frontWall = new THREE.Mesh(frontWallGeo, frontWallMat);
  frontWall.position.set(0, roomHeight / 2 + crowdFloorY, roomDepth / 4);
  frontWall.receiveShadow = true;
  frontWall.userData.type = 'environment';
  add(frontWall); td(frontWallGeo); td(frontWallMat);

  // Ceiling
  const ceilingMat = new THREE.MeshStandardMaterial({
    color: 0x0a0a0a,
    roughness: 0.9,
    metalness: 0.3,
    side: THREE.DoubleSide,
  });
  const ceilingGeo = new THREE.PlaneGeometry(roomWidth, roomDepth);
  const ceiling = new THREE.Mesh(ceilingGeo, ceilingMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, roomHeight + crowdFloorY, 0);
  ceiling.userData.type = 'environment';
  add(ceiling); td(ceilingGeo); td(ceilingMat);

  // Crowd floor (lower level)
  const crowdFloorMat = new THREE.MeshStandardMaterial({
    color: 0x0d0d0d,
    roughness: 0.85,
    metalness: 0.1,
  });
  const crowdFloorGeo = new THREE.PlaneGeometry(roomWidth, roomDepth - 4);
  const crowdFloor = new THREE.Mesh(crowdFloorGeo, crowdFloorMat);
  crowdFloor.rotation.x = -Math.PI / 2;
  crowdFloor.position.set(0, crowdFloorY, -roomDepth / 4);
  crowdFloor.receiveShadow = true;
  crowdFloor.userData.type = 'environment';
  add(crowdFloor); td(crowdFloorGeo); td(crowdFloorMat);

  // DJ platform edge
  const platformEdgeMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a,
    roughness: 0.5,
    metalness: 0.6,
  });
  const platformFrontGeo = new THREE.PlaneGeometry(roomWidth, 1.2);
  const platformFront = new THREE.Mesh(platformFrontGeo, platformEdgeMat);
  platformFront.position.set(0, crowdFloorY + 0.6, -1.5);
  platformFront.userData.type = 'environment';
  add(platformFront); td(platformFrontGeo); td(platformEdgeMat);

  // LED strip along platform edge
  const platformLedMat = new THREE.MeshStandardMaterial({
    color: 0x330000,
    emissive: 0xff2200,
    emissiveIntensity: 0.5,
    side: THREE.DoubleSide,
  });
  const platformLedGeo = new THREE.PlaneGeometry(roomWidth - 2, 0.06);
  const platformLed = new THREE.Mesh(platformLedGeo, platformLedMat);
  platformLed.position.set(0, crowdFloorY + 1.18, -1.49);
  platformLed.userData.type = 'environment';
  add(platformLed); td(platformLedGeo); td(platformLedMat);

  // Crowd group (phone lights + silhouettes + hands)
  const crowdGroup = new THREE.Group();
  crowdGroup.userData.type = 'environment';

  const crowdWash = new THREE.PointLight(0xffaa88, 0.5, 20, 1.5);
  crowdWash.position.set(0, 4, -roomDepth / 4);
  crowdWash.userData.type = 'environment';
  add(crowdWash);

  const phoneLightMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffeedd,
    emissiveIntensity: 0.8,
    transparent: true,
    opacity: 0.7,
  });
  td(phoneLightMat);
  const phoneLightGeo = new THREE.SphereGeometry(0.04, 6, 6);
  td(phoneLightGeo);
  const numPhoneLights = 80;
  for (let i = 0; i < numPhoneLights; i++) {
    const lightMesh = new THREE.Mesh(phoneLightGeo, phoneLightMat.clone());
    const px = (Math.random() - 0.5) * (roomWidth - 6);
    const pz = -3 - Math.random() * (roomDepth / 2 - 2);
    const py = crowdFloorY + 0.8 + Math.random() * 1.2;
    lightMesh.position.set(px, py, pz);
    lightMesh.material.emissiveIntensity = 0.3 + Math.random() * 0.7;
    lightMesh.material.opacity = 0.3 + Math.random() * 0.5;
    td(lightMesh.material);
    crowdGroup.add(lightMesh);
  }
  add(crowdGroup);

  // Silhouette crowd
  const silhouetteMat = new THREE.MeshStandardMaterial({
    color: 0x0a0a0a,
    roughness: 1.0,
    metalness: 0.0,
  });
  td(silhouetteMat);
  const capsuleGeo = new THREE.CapsuleGeometry(0.15, 0.6, 4, 6);
  td(capsuleGeo);
  const numSilhouettes = 120;
  for (let i = 0; i < numSilhouettes; i++) {
    const person = new THREE.Mesh(capsuleGeo, silhouetteMat);
    const px = (Math.random() - 0.5) * (roomWidth - 4);
    const pz = -2.5 - Math.random() * (roomDepth / 2 - 1);
    person.position.set(px, crowdFloorY + 0.55, pz);
    person.rotation.y = Math.random() * Math.PI * 2;
    const s = 0.8 + Math.random() * 0.4;
    person.scale.set(s, s, s);
    person.userData.type = 'environment';
    crowdGroup.add(person);
  }

  // Raised hands
  const handMat = new THREE.MeshStandardMaterial({
    color: 0x1a1410,
    roughness: 0.9,
    metalness: 0.0,
  });
  td(handMat);
  const handGeo = new THREE.CylinderGeometry(0.03, 0.04, 0.5, 5);
  td(handGeo);
  const numHands = 40;
  for (let i = 0; i < numHands; i++) {
    const hand = new THREE.Mesh(handGeo, handMat);
    const px = (Math.random() - 0.5) * (roomWidth - 6);
    const pz = -3 - Math.random() * (roomDepth / 3);
    hand.position.set(px, crowdFloorY + 1.5 + Math.random() * 0.4, pz);
    hand.rotation.z = (Math.random() - 0.5) * 0.5;
    hand.rotation.x = (Math.random() - 0.5) * 0.3;
    hand.userData.type = 'environment';
    crowdGroup.add(hand);
  }

  // Vertical LED light pillars
  const pillarPositions = [
    { x: -8, z: -roomDepth / 2 + 1, h: roomHeight - 1 },
    { x: -5.5, z: -roomDepth / 2 + 1, h: roomHeight - 0.5 },
    { x: -3, z: -roomDepth / 2 + 1, h: roomHeight - 1.5 },
    { x: -1, z: -roomDepth / 2 + 1, h: roomHeight - 0.8 },
    { x: 1, z: -roomDepth / 2 + 1, h: roomHeight - 0.8 },
    { x: 3, z: -roomDepth / 2 + 1, h: roomHeight - 1.5 },
    { x: 5.5, z: -roomDepth / 2 + 1, h: roomHeight - 0.5 },
    { x: 8, z: -roomDepth / 2 + 1, h: roomHeight - 1 },
    { x: -7, z: -roomDepth / 3, h: roomHeight - 2 },
    { x: -4, z: -roomDepth / 3, h: roomHeight - 2.5 },
    { x: 0, z: -roomDepth / 3, h: roomHeight - 2 },
    { x: 4, z: -roomDepth / 3, h: roomHeight - 2.5 },
    { x: 7, z: -roomDepth / 3, h: roomHeight - 2 },
    { x: -roomWidth / 2 + 1, z: -5, h: roomHeight - 1.5 },
    { x: -roomWidth / 2 + 1, z: -9, h: roomHeight - 1 },
    { x: roomWidth / 2 - 1, z: -5, h: roomHeight - 1.5 },
    { x: roomWidth / 2 - 1, z: -9, h: roomHeight - 1 },
  ];

  pillarPositions.forEach(({ x, z, h }) => {
    const pillarGeo = new THREE.CylinderGeometry(0.06, 0.06, h, 8);
    const pillarMat = new THREE.MeshStandardMaterial({
      color: 0x220000,
      emissive: 0xff1100,
      emissiveIntensity: 0.7,
      transparent: true,
      opacity: 0.85,
    });
    const pillar = new THREE.Mesh(pillarGeo, pillarMat);
    pillar.position.set(x, crowdFloorY + h / 2, z);
    pillar.userData.type = 'environment';
    add(pillar); td(pillarGeo); td(pillarMat);

    const glowGeo = new THREE.CylinderGeometry(0.2, 0.2, h, 8);
    const glowMat = new THREE.MeshStandardMaterial({
      color: 0x110000,
      emissive: 0xff2200,
      emissiveIntensity: 0.25,
      transparent: true,
      opacity: 0.15,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.set(x, crowdFloorY + h / 2, z);
    glow.userData.type = 'environment';
    add(glow); td(glowGeo); td(glowMat);
  });

  // Ceiling light fixtures
  const fixtureMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a,
    metalness: 0.8,
    roughness: 0.3,
  });
  td(fixtureMat);
  const fixtureLightMat = new THREE.MeshStandardMaterial({
    color: 0x331100,
    emissive: 0xff3300,
    emissiveIntensity: 0.6,
    transparent: true,
    opacity: 0.9,
  });
  td(fixtureLightMat);

  const fixturePositions = [
    { x: -6, z: -4 }, { x: -3, z: -4 }, { x: 0, z: -4 },
    { x: 3, z: -4 }, { x: 6, z: -4 },
    { x: -7, z: -8 }, { x: -3.5, z: -8 }, { x: 0, z: -8 },
    { x: 3.5, z: -8 }, { x: 7, z: -8 },
    { x: -5, z: -12 }, { x: 0, z: -12 }, { x: 5, z: -12 },
  ];
  const ceilingY = roomHeight + crowdFloorY;
  fixturePositions.forEach(({ x, z }) => {
    const rodLen = 0.6 + Math.random() * 0.8;
    const rodGeo = new THREE.CylinderGeometry(0.02, 0.02, rodLen, 6);
    const rod = new THREE.Mesh(rodGeo, fixtureMat);
    rod.position.set(x, ceilingY - rodLen / 2, z);
    rod.userData.type = 'environment';
    add(rod); td(rodGeo);

    const bodyH = 0.3 + Math.random() * 0.2;
    const bodyGeo = new THREE.CylinderGeometry(0.12, 0.15, bodyH, 8);
    const bodyMat = fixtureLightMat.clone();
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.set(x, ceilingY - rodLen - bodyH / 2, z);
    body.userData.type = 'environment';
    add(body); td(bodyGeo); td(bodyMat);
  });

  // Balconies (left and right)
  const balconyMat = new THREE.MeshStandardMaterial({
    color: 0x151515,
    roughness: 0.6,
    metalness: 0.5,
    side: THREE.DoubleSide,
  });
  td(balconyMat);
  const balconyRailMat = new THREE.MeshStandardMaterial({
    color: 0x222222,
    metalness: 0.7,
    roughness: 0.3,
  });
  td(balconyRailMat);

  [-1, 1].forEach((side) => {
    const bx = side * (roomWidth / 2 - 1.5);

    const bFloorGeo = new THREE.BoxGeometry(3, 0.15, roomDepth / 2 - 2);
    const balconyFloor = new THREE.Mesh(bFloorGeo, balconyMat);
    balconyFloor.position.set(bx, crowdFloorY + 3, -roomDepth / 4 - 1);
    balconyFloor.userData.type = 'environment';
    add(balconyFloor); td(bFloorGeo);

    const railGeo = new THREE.BoxGeometry(0.08, 1.0, roomDepth / 2 - 2);
    const rail = new THREE.Mesh(railGeo, balconyRailMat);
    rail.position.set(bx - side * 1.4, crowdFloorY + 3.6, -roomDepth / 4 - 1);
    rail.userData.type = 'environment';
    add(rail); td(railGeo);

    const topBarGeo = new THREE.BoxGeometry(0.12, 0.05, roomDepth / 2 - 2);
    const topBar = new THREE.Mesh(topBarGeo, balconyRailMat);
    topBar.position.set(bx - side * 1.4, crowdFloorY + 4.1, -roomDepth / 4 - 1);
    topBar.userData.type = 'environment';
    add(topBar); td(topBarGeo);

    for (let p = 0; p < 6; p++) {
      const postGeo = new THREE.CylinderGeometry(0.025, 0.025, 1.0, 6);
      const post = new THREE.Mesh(postGeo, balconyRailMat);
      const pz = -3 - p * 1.8;
      post.position.set(bx - side * 1.4, crowdFloorY + 3.6, pz);
      post.userData.type = 'environment';
      add(post); td(postGeo);
    }

    const bLedMat = platformLedMat.clone();
    const bLedGeo = new THREE.PlaneGeometry(2.5, 0.05);
    const balconyLed = new THREE.Mesh(bLedGeo, bLedMat);
    balconyLed.rotation.x = -Math.PI / 2;
    balconyLed.position.set(bx, crowdFloorY + 2.93, -roomDepth / 4 - 1);
    balconyLed.userData.type = 'environment';
    add(balconyLed); td(bLedGeo); td(bLedMat);

    const colMat = new THREE.MeshStandardMaterial({
      color: 0x111111,
      metalness: 0.6,
      roughness: 0.4,
    });
    td(colMat);
    [-4, -8, -12].forEach((cz) => {
      const colGeo = new THREE.CylinderGeometry(0.15, 0.15, 3 + Math.abs(crowdFloorY), 8);
      const col = new THREE.Mesh(colGeo, colMat);
      col.position.set(bx - side * 0.5, crowdFloorY + 1.5, cz);
      col.userData.type = 'environment';
      add(col); td(colGeo);
    });
  });

  // Main spotlights
  const boothKey = new THREE.SpotLight(0xffeedd, 1.5);
  boothKey.position.set(0, 6, 2);
  boothKey.target.position.set(0, 1, 0);
  boothKey.angle = Math.PI / 5;
  boothKey.penumbra = 0.6;
  boothKey.decay = 1.5;
  boothKey.distance = 12;
  boothKey.castShadow = true;
  boothKey.userData.type = 'environment';
  boothKey.target.userData = { type: 'environment' };
  add(boothKey);
  add(boothKey.target);

  // Red spots (Hï signature)
  const redSpotPositions = [
    { x: -5, z: -4, tx: -4, tz: -5 },
    { x: 5, z: -4, tx: 4, tz: -5 },
    { x: -3, z: -7, tx: -2, tz: -8 },
    { x: 3, z: -7, tx: 2, tz: -8 },
    { x: 0, z: -5, tx: 0, tz: -7 },
    { x: -7, z: -9, tx: -5, tz: -10 },
    { x: 7, z: -9, tx: 5, tz: -10 },
  ];
  redSpotPositions.forEach(({ x, z, tx, tz }) => {
    const spot = new THREE.SpotLight(0xff2200, 1.2);
    spot.position.set(x, ceilingY - 0.5, z);
    spot.target.position.set(tx, crowdFloorY, tz);
    spot.angle = Math.PI / 8;
    spot.penumbra = 0.5;
    spot.decay = 1.5;
    spot.distance = 15;
    spot.castShadow = false;
    spot.userData.type = 'environment';
    spot.target.userData = { type: 'environment' };
    add(spot);
    add(spot.target);
  });

  // Ambient fill
  const ambientFill = new THREE.HemisphereLight(0x110505, 0x050505, 0.3);
  ambientFill.userData.type = 'environment';
  add(ambientFill);

  // Ceiling structural beams
  const beamMat = new THREE.MeshStandardMaterial({
    color: 0x111111,
    metalness: 0.7,
    roughness: 0.4,
  });
  td(beamMat);
  for (let bz = -2; bz >= -roomDepth / 2 + 2; bz -= 4) {
    const beamGeo = new THREE.BoxGeometry(roomWidth - 2, 0.2, 0.15);
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.set(0, ceilingY - 0.15, bz);
    beam.userData.type = 'environment';
    add(beam); td(beamGeo);
  }

  // Cross beams
  for (let bx = -roomWidth / 2 + 4; bx <= roomWidth / 2 - 4; bx += 5) {
    const crossBeamGeo = new THREE.BoxGeometry(0.12, 0.15, roomDepth / 2);
    const crossBeam = new THREE.Mesh(crossBeamGeo, beamMat);
    crossBeam.position.set(bx, ceilingY - 0.25, -roomDepth / 4);
    crossBeam.userData.type = 'environment';
    add(crossBeam); td(crossBeamGeo);
  }

  // Red accent LEDs on walls
  const wallLedMat = new THREE.MeshStandardMaterial({
    color: 0x220000,
    emissive: 0xff1100,
    emissiveIntensity: 0.5,
    transparent: true,
    opacity: 0.8,
  });
  td(wallLedMat);
  for (let wz = -3; wz >= -roomDepth / 2 + 2; wz -= 3) {
    const wLedGeo = new THREE.PlaneGeometry(0.08, roomHeight * 0.6);
    const wLed = new THREE.Mesh(wLedGeo, wallLedMat);
    wLed.rotation.y = Math.PI / 2;
    wLed.position.set(-roomWidth / 2 + 0.05, crowdFloorY + roomHeight * 0.4, wz);
    wLed.userData.type = 'environment';
    add(wLed); td(wLedGeo);
  }
  for (let wz = -3; wz >= -roomDepth / 2 + 2; wz -= 3) {
    const wLedGeo = new THREE.PlaneGeometry(0.08, roomHeight * 0.6);
    const wLed = new THREE.Mesh(wLedGeo, wallLedMat);
    wLed.rotation.y = -Math.PI / 2;
    wLed.position.set(roomWidth / 2 - 0.05, crowdFloorY + roomHeight * 0.4, wz);
    wLed.userData.type = 'environment';
    add(wLed); td(wLedGeo);
  }

  // Fog/haze planes
  const hazeMat = new THREE.MeshStandardMaterial({
    color: 0x221111,
    transparent: true,
    opacity: 0.04,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  td(hazeMat);
  for (let hy = 2; hy <= 6; hy += 1.5) {
    const hazeGeo = new THREE.PlaneGeometry(roomWidth - 4, roomDepth / 2);
    const hazeMesh = new THREE.Mesh(hazeGeo, hazeMat.clone());
    hazeMesh.rotation.x = -Math.PI / 2;
    hazeMesh.position.set(0, hy + crowdFloorY, -roomDepth / 4);
    hazeMesh.userData.type = 'environment';
    add(hazeMesh);
    td(hazeGeo);
    td(hazeMesh.material);
  }

  // ── Common elements (floor, table, ambient) ───────────────────────────────

  add(floor);
  add(tableGroup);

  const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
  ambientLight.userData.type = 'environment';
  add(ambientLight);

  return {
    dispose() {
      added.forEach((o) => scene.remove(o));
      disposables.forEach((d) => d.dispose && d.dispose());
    },
  };
}
