import * as THREE from 'three';

export function build(scene, ctx) {
  const added = [];
  const disposables = [];
  const add = (obj) => { scene.add(obj); added.push(obj); };
  const td = (d) => disposables.push(d);

  // ── Shared prefix: floor (material set below) + table group (replaced below) ──

  const floorSize = 20; // Producer uses the smaller floor
  const floorGeo = new THREE.PlaneGeometry(floorSize, floorSize);
  const floor = new THREE.Mesh(floorGeo, null);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  floor.userData.type = 'environment';
  td(floorGeo);

  // tableGroup placeholder (will be replaced by the narrower studio desk below)
  const tableGroup = new THREE.Group();
  tableGroup.position.set(0, 0, 0);
  tableGroup.userData.type = 'environment';

  // ── Producer case ─────────────────────────────────────────────────────────

  // Dark polished concrete floor
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x1a1715,
    roughness: 0.6,
    metalness: 0.15,
  });
  floor.material = floorMat;
  td(floorMat);

  // Narrow studio desk replaces the default wide DJ table
  const deskW = 2.8, deskD = 0.9;
  const studioDeskTopGeo = new THREE.BoxGeometry(deskW, 0.035, deskD);
  const studioDeskTopMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a1e, metalness: 0.3, roughness: 0.7,
  });
  const studioDeskTop = new THREE.Mesh(studioDeskTopGeo, studioDeskTopMat);
  studioDeskTop.position.set(0, 0.93, -0.25);
  studioDeskTop.receiveShadow = true;
  tableGroup.add(studioDeskTop);
  td(studioDeskTopGeo); td(studioDeskTopMat);

  if (ctx?.djTableRef) ctx.djTableRef.current = studioDeskTop;

  const deskLegGeo = new THREE.BoxGeometry(0.05, 0.9, 0.05);
  const deskLegMat = new THREE.MeshStandardMaterial({
    color: 0x111115, metalness: 0.5, roughness: 0.4,
  });
  td(deskLegGeo); td(deskLegMat);
  [
    { x: -deskW / 2 + 0.06, z: -0.25 + deskD / 2 - 0.06 },
    { x: deskW / 2 - 0.06, z: -0.25 + deskD / 2 - 0.06 },
    { x: -deskW / 2 + 0.06, z: -0.25 - deskD / 2 + 0.06 },
    { x: deskW / 2 - 0.06, z: -0.25 - deskD / 2 + 0.06 },
  ].forEach((pos) => {
    const leg = new THREE.Mesh(deskLegGeo, deskLegMat);
    leg.position.set(pos.x, 0.47, pos.z);
    leg.castShadow = true;
    tableGroup.add(leg);
  });

  const studioW = 10;
  const studioD = 8;
  const studioH = 3.5;

  const studioWallMat = new THREE.MeshStandardMaterial({
    color: 0x12121a, roughness: 0.95, metalness: 0.0, side: THREE.DoubleSide,
  });
  td(studioWallMat);

  // Back wall
  const sBackWallGeo = new THREE.PlaneGeometry(studioW, studioH);
  const sBackWall = new THREE.Mesh(sBackWallGeo, studioWallMat);
  sBackWall.rotation.y = Math.PI;
  sBackWall.position.set(0, studioH / 2, -studioD / 2);
  sBackWall.receiveShadow = true;
  sBackWall.userData.type = 'environment';
  add(sBackWall); td(sBackWallGeo);

  // Left wall
  const sLeftWallMat = studioWallMat.clone();
  const sLeftWallGeo = new THREE.PlaneGeometry(studioD, studioH);
  const sLeftWall = new THREE.Mesh(sLeftWallGeo, sLeftWallMat);
  sLeftWall.rotation.y = Math.PI / 2;
  sLeftWall.position.set(-studioW / 2, studioH / 2, 0);
  sLeftWall.receiveShadow = true;
  sLeftWall.userData.type = 'environment';
  add(sLeftWall); td(sLeftWallGeo); td(sLeftWallMat);

  // Right wall
  const sRightWallMat = studioWallMat.clone();
  const sRightWallGeo = new THREE.PlaneGeometry(studioD, studioH);
  const sRightWall = new THREE.Mesh(sRightWallGeo, sRightWallMat);
  sRightWall.rotation.y = -Math.PI / 2;
  sRightWall.position.set(studioW / 2, studioH / 2, 0);
  sRightWall.receiveShadow = true;
  sRightWall.userData.type = 'environment';
  add(sRightWall); td(sRightWallGeo); td(sRightWallMat);

  // Front wall
  const sFrontWallMat = studioWallMat.clone();
  const sFrontWallGeo = new THREE.PlaneGeometry(studioW, studioH);
  const sFrontWall = new THREE.Mesh(sFrontWallGeo, sFrontWallMat);
  sFrontWall.position.set(0, studioH / 2, studioD / 2);
  sFrontWall.receiveShadow = true;
  sFrontWall.userData.type = 'environment';
  add(sFrontWall); td(sFrontWallGeo); td(sFrontWallMat);

  // Ceiling
  const sCeilingMat = studioWallMat.clone();
  const sCeilingGeo = new THREE.PlaneGeometry(studioW, studioD);
  const sCeiling = new THREE.Mesh(sCeilingGeo, sCeilingMat);
  sCeiling.rotation.x = Math.PI / 2;
  sCeiling.position.set(0, studioH, 0);
  sCeiling.receiveShadow = true;
  sCeiling.userData.type = 'environment';
  add(sCeiling); td(sCeilingGeo); td(sCeilingMat);

  // Acoustic foam panels on back wall
  const foamColors = [0x2a1a35, 0x1a2535, 0x221a30];
  for (let row = 0; row < 4; row++) {
    for (let col = -4; col <= 4; col++) {
      if (Math.abs(col) <= 1 && row >= 1 && row <= 2) continue;
      const foamGeo = new THREE.BoxGeometry(0.45, 0.45, 0.06);
      const foamMat = new THREE.MeshStandardMaterial({
        color: foamColors[(row + col + 10) % 3], roughness: 1.0,
      });
      const foam = new THREE.Mesh(foamGeo, foamMat);
      foam.position.set(col * 0.55, 0.6 + row * 0.55, -studioD / 2 + 0.04);
      foam.userData.type = 'environment';
      add(foam); td(foamGeo); td(foamMat);
    }
  }

  // Acoustic panels on side walls
  for (let row = 0; row < 3; row++) {
    for (let col = -2; col <= 2; col++) {
      const fc = foamColors[(row + col + 6) % 3];

      const lFoamGeo = new THREE.BoxGeometry(0.06, 0.45, 0.45);
      const lFoamMat = new THREE.MeshStandardMaterial({ color: fc, roughness: 1.0 });
      const lFoam = new THREE.Mesh(lFoamGeo, lFoamMat);
      lFoam.position.set(-studioW / 2 + 0.04, 0.8 + row * 0.55, col * 0.55);
      lFoam.userData.type = 'environment';
      add(lFoam); td(lFoamGeo); td(lFoamMat);

      const rFoamGeo = new THREE.BoxGeometry(0.06, 0.45, 0.45);
      const rFoamMat = new THREE.MeshStandardMaterial({ color: fc, roughness: 1.0 });
      const rFoam = new THREE.Mesh(rFoamGeo, rFoamMat);
      rFoam.position.set(studioW / 2 - 0.04, 0.8 + row * 0.55, col * 0.55);
      rFoam.userData.type = 'environment';
      add(rFoam); td(rFoamGeo); td(rFoamMat);
    }
  }

  // Bass traps in back corners
  const btMat = new THREE.MeshStandardMaterial({ color: 0x201828, roughness: 1.0 });
  td(btMat);
  const btShape = new THREE.Shape();
  btShape.moveTo(0, 0);
  btShape.lineTo(0.35, 0);
  btShape.lineTo(0, 0.35);
  btShape.closePath();
  const btGeo = new THREE.ExtrudeGeometry(btShape, { depth: studioH - 0.2, bevelEnabled: false });
  td(btGeo);

  const btLeft = new THREE.Mesh(btGeo, btMat);
  btLeft.rotation.x = -Math.PI / 2;
  btLeft.position.set(-studioW / 2 + 0.01, 0.1, -studioD / 2 + 0.35);
  btLeft.userData.type = 'environment';
  add(btLeft);

  const btRight = new THREE.Mesh(btGeo, btMat);
  btRight.rotation.x = -Math.PI / 2;
  btRight.rotation.z = Math.PI / 2;
  btRight.position.set(studioW / 2 - 0.35, 0.1, -studioD / 2 + 0.01);
  btRight.userData.type = 'environment';
  add(btRight);

  // Equipment Racks (19-inch style, angled 45° toward center)
  const rackSlotYPositions = [0.35, 0.65, 0.95, 1.25];
  const rackConfigs = [
    { x: -2.2, rotY: Math.PI / 4 },
    { x: 2.2, rotY: -Math.PI / 4 },
  ];

  rackConfigs.forEach(({ x: rackX, rotY }) => {
    const rack = new THREE.Group();
    const rW = 0.55, rD = 0.4, rH = 1.5, rBase = 0.1;

    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x111111, metalness: 0.85, roughness: 0.25,
    });
    td(frameMat);
    const panelMat = new THREE.MeshStandardMaterial({
      color: 0x0a0a0e, metalness: 0.5, roughness: 0.4, side: THREE.DoubleSide,
    });
    td(panelMat);

    // Vertical corner posts
    const postGeo = new THREE.BoxGeometry(0.035, rH, 0.035);
    td(postGeo);
    [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([sx, sz]) => {
      const p = new THREE.Mesh(postGeo, frameMat);
      p.position.set(sx * rW / 2, rBase + rH / 2, sz * rD / 2);
      rack.add(p);
    });

    // Front rack rails
    const fRailGeo = new THREE.BoxGeometry(0.018, rH - 0.04, 0.012);
    td(fRailGeo);
    [-1, 1].forEach((sx) => {
      const r = new THREE.Mesh(fRailGeo, frameMat);
      r.position.set(sx * (rW / 2 - 0.05), rBase + rH / 2, rD / 2 - 0.005);
      rack.add(r);
    });

    // Top & bottom frame rails
    const hGeo = new THREE.BoxGeometry(rW, 0.022, 0.022);
    td(hGeo);
    const dGeo = new THREE.BoxGeometry(0.022, 0.022, rD);
    td(dGeo);
    [rBase, rBase + rH].forEach((y) => {
      [-rD / 2, rD / 2].forEach((z) => {
        const hr = new THREE.Mesh(hGeo, frameMat);
        hr.position.set(0, y, z);
        rack.add(hr);
      });
      [-rW / 2, rW / 2].forEach((x) => {
        const dr = new THREE.Mesh(dGeo, frameMat);
        dr.position.set(x, y, 0);
        rack.add(dr);
      });
    });

    // Side panels
    [-rW / 2, rW / 2].forEach((x) => {
      const spGeo = new THREE.PlaneGeometry(rD - 0.04, rH - 0.04);
      const sp = new THREE.Mesh(spGeo, panelMat);
      sp.rotation.y = Math.PI / 2;
      sp.position.set(x, rBase + rH / 2, 0);
      rack.add(sp);
      td(spGeo);
    });

    // Back panel
    const bpGeo = new THREE.PlaneGeometry(rW - 0.04, rH - 0.04);
    const bp = new THREE.Mesh(bpGeo, panelMat);
    bp.position.set(0, rBase + rH / 2, -rD / 2);
    rack.add(bp);
    td(bpGeo);

    // Shelves at each slot level
    const shelfMat = new THREE.MeshStandardMaterial({
      color: 0x181820, metalness: 0.6, roughness: 0.4,
    });
    td(shelfMat);
    rackSlotYPositions.forEach((slotY) => {
      const shelfGeo = new THREE.BoxGeometry(rW - 0.07, 0.008, rD - 0.07);
      const shelf = new THREE.Mesh(shelfGeo, shelfMat);
      shelf.position.set(0, slotY - 0.03, 0);
      rack.add(shelf);
      td(shelfGeo);
    });

    // Feet
    const footGeo = new THREE.CylinderGeometry(0.025, 0.025, rBase, 8);
    td(footGeo);
    const footMat = new THREE.MeshStandardMaterial({
      color: 0x222222, metalness: 0.7, roughness: 0.3,
    });
    td(footMat);
    [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([sx, sz]) => {
      const f = new THREE.Mesh(footGeo, footMat);
      f.position.set(sx * (rW / 2 - 0.04), rBase / 2, sz * (rD / 2 - 0.04));
      rack.add(f);
    });

    rack.position.set(rackX, 0, -0.25);
    rack.rotation.y = rotY;
    rack.userData.type = 'environment';
    add(rack);
  });

  // Studio Lighting
  const studioMainLight = new THREE.PointLight(0xffeedd, 1.0);
  studioMainLight.position.set(0, studioH - 0.3, 0.5);
  studioMainLight.castShadow = true;
  studioMainLight.userData.type = 'environment';
  add(studioMainLight);

  const deskSpot = new THREE.SpotLight(0xffffff, 0.8);
  deskSpot.position.set(0, studioH - 0.5, 0.8);
  deskSpot.target.position.set(0, 0.95, -0.25);
  deskSpot.angle = Math.PI / 5;
  deskSpot.penumbra = 0.6;
  deskSpot.userData.type = 'environment';
  deskSpot.target.userData = { type: 'environment' };
  add(deskSpot);
  add(deskSpot.target);

  // Cool-tinted accent lights over each rack
  rackConfigs.forEach(({ x: rackX }) => {
    const rLight = new THREE.SpotLight(0x8899cc, 0.5);
    rLight.position.set(rackX, studioH - 0.5, 0.5);
    rLight.target.position.set(rackX, 0.8, -0.25);
    rLight.angle = Math.PI / 5;
    rLight.penumbra = 0.5;
    rLight.userData.type = 'environment';
    rLight.target.userData = { type: 'environment' };
    add(rLight);
    add(rLight.target);
  });

  // Subtle LED accent strip along desk back edge
  const ledMat = new THREE.MeshStandardMaterial({
    color: 0x003388, emissive: 0x0033ff, emissiveIntensity: 0.3, side: THREE.DoubleSide,
  });
  td(ledMat);
  const ledStripGeo = new THREE.PlaneGeometry(deskW, 0.015);
  const ledStrip = new THREE.Mesh(ledStripGeo, ledMat);
  ledStrip.rotation.x = -Math.PI / 2;
  ledStrip.position.set(0, 0.95, -0.25 - deskD / 2 + 0.01);
  ledStrip.userData.type = 'environment';
  add(ledStrip); td(ledStripGeo);

  // Monitor speaker stands (poles from ground)
  const monPoleMat = new THREE.MeshStandardMaterial({
    color: 0x111111, metalness: 0.8, roughness: 0.25,
  });
  td(monPoleMat);
  const monPlatMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a1e, metalness: 0.4, roughness: 0.6,
  });
  td(monPlatMat);
  [{ x: -1.2, z: -0.9 }, { x: 1.2, z: -0.9 }].forEach(({ x, z }) => {
    const baseGeo = new THREE.CylinderGeometry(0.15, 0.18, 0.03, 16);
    const base = new THREE.Mesh(baseGeo, monPoleMat);
    base.position.set(x, 0.015, z);
    base.userData.type = 'environment';
    add(base); td(baseGeo);

    const poleGeo = new THREE.CylinderGeometry(0.025, 0.025, 1.1, 8);
    const pole = new THREE.Mesh(poleGeo, monPoleMat);
    pole.position.set(x, 0.58, z);
    pole.userData.type = 'environment';
    add(pole); td(poleGeo);

    const platGeo = new THREE.BoxGeometry(0.28, 0.02, 0.22);
    const plat = new THREE.Mesh(platGeo, monPlatMat);
    plat.position.set(x, 1.14, z);
    plat.userData.type = 'environment';
    add(plat); td(platGeo);
  });

  // Wall details — LED strips along floor edges
  const wallLedMat = new THREE.MeshStandardMaterial({
    color: 0x220044, emissive: 0x6622cc, emissiveIntensity: 0.25, side: THREE.DoubleSide,
  });
  td(wallLedMat);

  const backFloorLedGeo = new THREE.PlaneGeometry(studioW - 1, 0.02);
  const backFloorLed = new THREE.Mesh(backFloorLedGeo, wallLedMat);
  backFloorLed.rotation.x = -Math.PI / 2;
  backFloorLed.position.set(0, 0.01, -studioD / 2 + 0.06);
  backFloorLed.userData.type = 'environment';
  add(backFloorLed); td(backFloorLedGeo);

  [-studioW / 2 + 0.06, studioW / 2 - 0.06].forEach((wx) => {
    const sideLedGeo = new THREE.PlaneGeometry(studioD - 1, 0.02);
    const sideLed = new THREE.Mesh(sideLedGeo, wallLedMat);
    sideLed.rotation.x = -Math.PI / 2;
    sideLed.rotation.z = Math.PI / 2;
    sideLed.position.set(wx, 0.01, 0);
    sideLed.userData.type = 'environment';
    add(sideLed); td(sideLedGeo);
  });

  // Floating shelves on side walls (away from foam panels)
  const shelfDecMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a1e, metalness: 0.3, roughness: 0.7,
  });
  td(shelfDecMat);
  [
    { x: -studioW / 2 + 0.18, z: -2.5 },
    { x: -studioW / 2 + 0.18, z: 2.0 },
    { x: studioW / 2 - 0.18, z: -2.5 },
    { x: studioW / 2 - 0.18, z: 2.0 },
  ].forEach(({ x, z }) => {
    const shelfGeo = new THREE.BoxGeometry(0.22, 0.02, 0.45);
    const shelf = new THREE.Mesh(shelfGeo, shelfDecMat);
    shelf.position.set(x, 1.6, z);
    shelf.userData.type = 'environment';
    add(shelf); td(shelfGeo);

    const objGeo = new THREE.BoxGeometry(0.12, 0.14, 0.02);
    const objMat = new THREE.MeshStandardMaterial({ color: 0x222230, roughness: 0.6 });
    const obj = new THREE.Mesh(objGeo, objMat);
    obj.position.set(x, 1.69, z);
    obj.userData.type = 'environment';
    add(obj); td(objGeo); td(objMat);
  });

  // Framed prints / gold records on back wall
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a, metalness: 0.7, roughness: 0.3,
  });
  td(frameMat);
  const artMat = new THREE.MeshStandardMaterial({ color: 0x141420, roughness: 0.5 });
  td(artMat);
  [-1.8, 0, 1.8].forEach((fx) => {
    const frameGeo = new THREE.BoxGeometry(0.5, 0.5, 0.03);
    const frame = new THREE.Mesh(frameGeo, frameMat);
    frame.position.set(fx, 2.8, -studioD / 2 + 0.08);
    frame.userData.type = 'environment';
    add(frame); td(frameGeo);

    const artGeo = new THREE.BoxGeometry(0.4, 0.4, 0.01);
    const art = new THREE.Mesh(artGeo, artMat);
    art.position.set(fx, 2.8, -studioD / 2 + 0.10);
    art.userData.type = 'environment';
    add(art); td(artGeo);
  });

  // Gold record disc on center frame
  const discMat = new THREE.MeshStandardMaterial({
    color: 0xc9a84c, metalness: 0.9, roughness: 0.2,
  });
  td(discMat);
  const discGeo = new THREE.CircleGeometry(0.12, 24);
  const disc = new THREE.Mesh(discGeo, discMat);
  disc.position.set(0, 2.8, -studioD / 2 + 0.11);
  disc.userData.type = 'environment';
  add(disc); td(discGeo);

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
