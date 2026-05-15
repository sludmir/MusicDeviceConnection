import * as THREE from 'three';

export function build(scene, ctx) {
  const added = [];
  const disposables = [];
  const add = (obj) => { scene.add(obj); added.push(obj); };
  const td = (d) => disposables.push(d);

  // ── Shared prefix: floor (material set below) + table group (replaced below) ──

  const floorSize = 20; // Musician uses the smaller floor
  const floorGeo = new THREE.PlaneGeometry(floorSize, floorSize);
  const floor = new THREE.Mesh(floorGeo, null);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  floor.userData.type = 'environment';
  td(floorGeo);

  // tableGroup placeholder (replaced by invisible stage reference below)
  const tableGroup = new THREE.Group();
  tableGroup.position.set(0, 0, 0);
  tableGroup.userData.type = 'environment';

  // ── Musician case: cozy rehearsal / live-room studio ─────────────────────

  // Warm hardwood floor
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x3d2816, roughness: 0.7, metalness: 0.05,
  });
  floor.material = floorMat;
  td(floorMat);

  // Replace default table with invisible floor-level reference
  const stageRefGeo = new THREE.BoxGeometry(8, 0.01, 6);
  const stageRefMat = new THREE.MeshStandardMaterial({ visible: false });
  const stageRef = new THREE.Mesh(stageRefGeo, stageRefMat);
  stageRef.position.set(0, 0.005, 0);
  tableGroup.add(stageRef);
  td(stageRefGeo); td(stageRefMat);

  if (ctx?.djTableRef) ctx.djTableRef.current = stageRef;

  const mRoomW = 12, mRoomD = 10, mRoomH = 3.4;
  const mWallMat = new THREE.MeshStandardMaterial({
    color: 0x1a1510, roughness: 0.95, metalness: 0.0, side: THREE.DoubleSide,
  });
  td(mWallMat);

  // Back wall
  const mBackWallGeo = new THREE.PlaneGeometry(mRoomW, mRoomH);
  const mBackWall = new THREE.Mesh(mBackWallGeo, mWallMat);
  mBackWall.rotation.y = Math.PI;
  mBackWall.position.set(0, mRoomH / 2, -mRoomD / 2);
  mBackWall.receiveShadow = true;
  mBackWall.userData.type = 'environment';
  add(mBackWall); td(mBackWallGeo);

  // Left wall
  const mLeftWallMat = mWallMat.clone();
  const mLeftWallGeo = new THREE.PlaneGeometry(mRoomD, mRoomH);
  const mLeftWall = new THREE.Mesh(mLeftWallGeo, mLeftWallMat);
  mLeftWall.rotation.y = Math.PI / 2;
  mLeftWall.position.set(-mRoomW / 2, mRoomH / 2, 0);
  mLeftWall.receiveShadow = true;
  mLeftWall.userData.type = 'environment';
  add(mLeftWall); td(mLeftWallGeo); td(mLeftWallMat);

  // Right wall
  const mRightWallMat = mWallMat.clone();
  const mRightWallGeo = new THREE.PlaneGeometry(mRoomD, mRoomH);
  const mRightWall = new THREE.Mesh(mRightWallGeo, mRightWallMat);
  mRightWall.rotation.y = -Math.PI / 2;
  mRightWall.position.set(mRoomW / 2, mRoomH / 2, 0);
  mRightWall.receiveShadow = true;
  mRightWall.userData.type = 'environment';
  add(mRightWall); td(mRightWallGeo); td(mRightWallMat);

  // Front wall
  const mFrontWallMat = mWallMat.clone();
  const mFrontWallGeo = new THREE.PlaneGeometry(mRoomW, mRoomH);
  const mFrontWall = new THREE.Mesh(mFrontWallGeo, mFrontWallMat);
  mFrontWall.position.set(0, mRoomH / 2, mRoomD / 2);
  mFrontWall.receiveShadow = true;
  mFrontWall.userData.type = 'environment';
  add(mFrontWall); td(mFrontWallGeo); td(mFrontWallMat);

  // Ceiling
  const mCeilingMat = mWallMat.clone();
  const mCeilingGeo = new THREE.PlaneGeometry(mRoomW, mRoomD);
  const mCeiling = new THREE.Mesh(mCeilingGeo, mCeilingMat);
  mCeiling.rotation.x = Math.PI / 2;
  mCeiling.position.set(0, mRoomH, 0);
  mCeiling.userData.type = 'environment';
  add(mCeiling); td(mCeilingGeo); td(mCeilingMat);

  // Recording studio glass pane (left wall — control room window)
  const glassPaneMat = new THREE.MeshPhysicalMaterial({
    color: 0x88aacc, transparent: true, opacity: 0.18,
    roughness: 0.05, metalness: 0.1, transmission: 0.7,
    side: THREE.DoubleSide,
  });
  td(glassPaneMat);
  const glassPaneGeo = new THREE.BoxGeometry(0.06, 1.6, 2.8);
  const glassPane = new THREE.Mesh(glassPaneGeo, glassPaneMat);
  glassPane.position.set(-mRoomW / 2 + 0.08, 1.5, -1.0);
  glassPane.userData.type = 'environment';
  add(glassPane); td(glassPaneGeo);

  // Glass frame
  const gFrameMat = new THREE.MeshStandardMaterial({
    color: 0x111111, metalness: 0.8, roughness: 0.3,
  });
  td(gFrameMat);

  const gfTopGeo = new THREE.BoxGeometry(0.08, 0.04, 2.88);
  const gfTop = new THREE.Mesh(gfTopGeo, gFrameMat);
  gfTop.position.set(-mRoomW / 2 + 0.08, 2.32, -1.0);
  gfTop.userData.type = 'environment';
  add(gfTop); td(gfTopGeo);

  const gfBotGeo = new THREE.BoxGeometry(0.08, 0.04, 2.88);
  const gfBot = new THREE.Mesh(gfBotGeo, gFrameMat);
  gfBot.position.set(-mRoomW / 2 + 0.08, 0.68, -1.0);
  gfBot.userData.type = 'environment';
  add(gfBot); td(gfBotGeo);

  const gfLGeo = new THREE.BoxGeometry(0.08, 1.68, 0.04);
  const gfL = new THREE.Mesh(gfLGeo, gFrameMat);
  gfL.position.set(-mRoomW / 2 + 0.08, 1.5, -2.44);
  gfL.userData.type = 'environment';
  add(gfL); td(gfLGeo);

  const gfRGeo = new THREE.BoxGeometry(0.08, 1.68, 0.04);
  const gfR = new THREE.Mesh(gfRGeo, gFrameMat);
  gfR.position.set(-mRoomW / 2 + 0.08, 1.5, 0.44);
  gfR.userData.type = 'environment';
  add(gfR); td(gfRGeo);

  // Dim light behind glass (simulates control room glow)
  const ctrlGlow = new THREE.PointLight(0x4466aa, 0.3, 5);
  ctrlGlow.position.set(-mRoomW / 2 - 0.5, 1.5, -1.0);
  ctrlGlow.userData.type = 'environment';
  add(ctrlGlow);

  // Soundproofing panels on back wall
  const spColors = [0x2a211a, 0x332a1e, 0x261e16, 0x2e2518];
  for (let row = 0; row < 3; row++) {
    for (let col = -3; col <= 3; col++) {
      const panelGeo = new THREE.BoxGeometry(0.75, 0.75, 0.07);
      const panelMat = new THREE.MeshStandardMaterial({
        color: spColors[(row + col + 8) % 4],
        roughness: 1.0,
      });
      const panel = new THREE.Mesh(panelGeo, panelMat);
      panel.position.set(col * 0.85, 0.8 + row * 0.85, -mRoomD / 2 + 0.04);
      panel.userData.type = 'environment';
      add(panel); td(panelGeo); td(panelMat);
    }
  }

  // Acoustic panels on right wall
  const mFoamColors = [0x2a211a, 0x332a1e, 0x261e16];
  for (let row = 0; row < 3; row++) {
    for (let col = -2; col <= 2; col++) {
      const rfpGeo = new THREE.BoxGeometry(0.06, 0.55, 0.55);
      const rfpMat = new THREE.MeshStandardMaterial({
        color: mFoamColors[(row + col + 6) % 3], roughness: 1.0,
      });
      const rfp = new THREE.Mesh(rfpGeo, rfpMat);
      rfp.position.set(mRoomW / 2 - 0.04, 0.9 + row * 0.65, col * 0.65);
      rfp.userData.type = 'environment';
      add(rfp); td(rfpGeo); td(rfpMat);
    }
  }

  // Area rug
  const rugMat = new THREE.MeshStandardMaterial({
    color: 0x1e1412, roughness: 1.0, side: THREE.DoubleSide,
  });
  td(rugMat);
  const rugGeo = new THREE.PlaneGeometry(5, 4);
  const rug = new THREE.Mesh(rugGeo, rugMat);
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0, 0.005, 0);
  rug.userData.type = 'environment';
  add(rug); td(rugGeo);

  const rugBorderMat = new THREE.MeshStandardMaterial({
    color: 0x2a1c14, roughness: 1.0, side: THREE.DoubleSide,
  });
  td(rugBorderMat);
  const rugBorderGeo = new THREE.PlaneGeometry(5.3, 4.3);
  const rugBorder = new THREE.Mesh(rugBorderGeo, rugBorderMat);
  rugBorder.rotation.x = -Math.PI / 2;
  rugBorder.position.set(0, 0.003, 0);
  rugBorder.userData.type = 'environment';
  add(rugBorder); td(rugBorderGeo);

  // Furniture: keyboard stand, instrument table, drum riser
  const standMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a, metalness: 0.7, roughness: 0.3,
  });
  td(standMat);
  const standTopMat = new THREE.MeshStandardMaterial({
    color: 0x222226, metalness: 0.4, roughness: 0.6,
  });
  td(standTopMat);

  const buildStand = (sx, sz, sw, sd, sh) => {
    const g = new THREE.Group();
    const topGeo = new THREE.BoxGeometry(sw, 0.025, sd);
    const top = new THREE.Mesh(topGeo, standTopMat);
    top.position.set(0, sh, 0);
    top.receiveShadow = true;
    g.add(top);
    td(topGeo);

    const legH = sh - 0.012;
    const legGeo = new THREE.BoxGeometry(0.04, legH, 0.04);
    td(legGeo);
    [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(legGeo, standMat);
      leg.position.set(lx * (sw / 2 - 0.04), legH / 2, lz * (sd / 2 - 0.04));
      leg.castShadow = true;
      g.add(leg);
    });
    g.position.set(sx, 0, sz);
    g.userData.type = 'environment';
    return g;
  };

  // Keyboard stand — back left
  add(buildStand(-1.8, -1.2, 1.2, 0.5, 0.78));
  // Instrument table — back right
  add(buildStand(1.8, -1.2, 1.0, 0.5, 0.78));

  // Drum riser — back center
  const drumRiserMat = new THREE.MeshStandardMaterial({ color: 0x1a1614, roughness: 0.8 });
  td(drumRiserMat);
  const drumRiserGeo = new THREE.BoxGeometry(1.6, 0.12, 1.2);
  const drumRiser = new THREE.Mesh(drumRiserGeo, drumRiserMat);
  drumRiser.position.set(0, 0.06, -1.3);
  drumRiser.receiveShadow = true;
  drumRiser.userData.type = 'environment';
  add(drumRiser); td(drumRiserGeo);

  // Guitar / bass racks
  const buildGuitarRack = (rx, rz) => {
    const g = new THREE.Group();
    const rackMat = new THREE.MeshStandardMaterial({
      color: 0x111111, metalness: 0.8, roughness: 0.3,
    });
    td(rackMat);

    const basePlateGeo = new THREE.BoxGeometry(0.5, 0.03, 0.4);
    const basePlate = new THREE.Mesh(basePlateGeo, rackMat);
    basePlate.position.set(0, 0.015, 0);
    g.add(basePlate); td(basePlateGeo);

    const backPostGeo = new THREE.BoxGeometry(0.04, 1.1, 0.04);
    const backPost = new THREE.Mesh(backPostGeo, rackMat);
    backPost.position.set(0, 0.58, -0.16);
    g.add(backPost); td(backPostGeo);

    const armGeo = new THREE.BoxGeometry(0.02, 0.02, 0.18);
    td(armGeo);
    const tipGeo = new THREE.BoxGeometry(0.02, 0.06, 0.02);
    td(tipGeo);
    [-0.08, 0.08].forEach((ox) => {
      const arm = new THREE.Mesh(armGeo, rackMat);
      arm.position.set(ox, 1.05, -0.05);
      g.add(arm);

      const tip = new THREE.Mesh(tipGeo, rackMat);
      tip.position.set(ox, 1.07, 0.04);
      g.add(tip);
    });

    const cradleGeo = new THREE.BoxGeometry(0.35, 0.02, 0.2);
    const cradle = new THREE.Mesh(cradleGeo, rackMat);
    cradle.position.set(0, 0.35, 0.02);
    g.add(cradle); td(cradleGeo);

    const lipGeo = new THREE.BoxGeometry(0.35, 0.06, 0.02);
    const lip = new THREE.Mesh(lipGeo, rackMat);
    lip.position.set(0, 0.37, 0.11);
    g.add(lip); td(lipGeo);

    const padMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });
    td(padMat);
    const padGeo = new THREE.BoxGeometry(0.04, 0.025, 0.18);
    td(padGeo);
    [-0.1, 0, 0.1].forEach((px) => {
      const pad = new THREE.Mesh(padGeo, padMat);
      pad.position.set(px, 0.36, 0.02);
      g.add(pad);
    });

    g.position.set(rx, 0, rz);
    g.userData.type = 'environment';
    return g;
  };

  add(buildGuitarRack(-2.0, 0.4));
  add(buildGuitarRack(2.0, 0.4));

  // Edison-style pendant lights
  const pendantPositions = [
    { x: -2.0, z: -0.5 }, { x: -0.7, z: 0.2 }, { x: 0, z: -0.4 },
    { x: 0.7, z: 0.2 }, { x: 2.0, z: -0.5 },
    { x: -1.0, z: -1.2 }, { x: 1.0, z: -1.2 },
  ];
  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0xffaa44, emissive: 0xffaa44, emissiveIntensity: 0.8,
  });
  td(bulbMat);
  const wireMat = new THREE.MeshStandardMaterial({
    color: 0x222222, metalness: 0.8, roughness: 0.3,
  });
  td(wireMat);

  pendantPositions.forEach(({ x, z }, i) => {
    const wireLen = 0.5 + (i % 3) * 0.2;
    const bulbY = mRoomH - wireLen;

    const wireGeo = new THREE.CylinderGeometry(0.005, 0.005, wireLen, 6);
    const wire = new THREE.Mesh(wireGeo, wireMat);
    wire.position.set(x, mRoomH - wireLen / 2, z);
    wire.userData.type = 'environment';
    add(wire); td(wireGeo);

    const bulbGeo = new THREE.SphereGeometry(0.04, 12, 12);
    const bulb = new THREE.Mesh(bulbGeo, bulbMat);
    bulb.position.set(x, bulbY, z);
    bulb.userData.type = 'environment';
    add(bulb); td(bulbGeo);

    const pLight = new THREE.PointLight(0xffaa44, 0.35, 5);
    pLight.position.set(x, bulbY, z);
    pLight.userData.type = 'environment';
    add(pLight);
  });

  // Warm fill light
  const mFillLight = new THREE.PointLight(0xffd0a0, 0.25);
  mFillLight.position.set(0, mRoomH - 0.2, 0);
  mFillLight.userData.type = 'environment';
  add(mFillLight);

  // Stage accent spots
  [[-2.2, 0.4], [0, -1.0], [2.2, 0.4]].forEach(([tx, tz]) => {
    const spot = new THREE.SpotLight(0xffcc88, 0.25);
    spot.position.set(tx, mRoomH - 0.3, tz + 1.5);
    spot.target.position.set(tx, 0, tz);
    spot.angle = Math.PI / 5;
    spot.penumbra = 0.7;
    spot.userData.type = 'environment';
    spot.target.userData = { type: 'environment' };
    add(spot);
    add(spot.target);
  });

  // ── Common elements (floor, table, ambient) ──────────────────────────────

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
