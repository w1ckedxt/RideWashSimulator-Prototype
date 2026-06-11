// Level 6 — Fairy Tale Flume (dark ride). Binnen in een donkere hal loopt
// een logflume-geul met één boomstambootje langs een sprookjesscène:
// kabouters, paddenstoelen, een huisje en een fee, allemaal uitgelicht met
// spotjes — en alles zit onder een dikke laag schimmel en stof.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CellAtlas } from '../atlas.js';
import { createCleanableMaterial } from '../materials.js';

function dotsCapTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#c23028';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#f3e3c2';
  for (let i = 0; i < 9; i++) {
    ctx.beginPath();
    ctx.arc(15 + (i % 3) * 45 + (i % 2) * 10, 18 + Math.floor(i / 3) * 42, 9, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export const DARKRIDE = {
  id: 'flume',
  name: 'Fairy Tale Flume',
  tagline: 'Once upon a grime… a mouldy dark-ride scene begs for a wash.',

  build({ scene, dirt, cleanables }) {
    const group = new THREE.Group();

    // ---------- donkere hal ----------
    scene.background = new THREE.Color(0x07070d);
    scene.fog = new THREE.Fog(0x0a0a14, 18, 55);

    const ROOM_W = 30, ROOM_D = 18, ROOM_H = 6;
    const roomAtlas = new CellAtlas(dirt, {
      id: 'room', label: 'Hall & floor', cols: 3, rows: 2,
      texW: 768, texH: 512, cellWorld: 16, seed: 601, leafDensity: 1.2,
    });
    const wallMat = createCleanableMaterial(
      { color: 0x46527a, metalness: 0.1, roughness: 0.65 }, roomAtlas.mask.texture);
    const floorMat = createCleanableMaterial(
      { color: 0x565b6c, metalness: 0.15, roughness: 0.6 }, roomAtlas.mask.texture);

    const addRoomPiece = (geo, mat, walkable = false) => {
      roomAtlas.add(geo);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.receiveShadow = true;
      mesh.userData.maskId = 'room';
      if (walkable) mesh.userData.walkable = true;
      group.add(mesh);
      cleanables.push(mesh);
      return mesh;
    };

    roomAtlas.claim(new THREE.Vector3(0, 0, 0));
    const floorGeo = new THREE.BoxGeometry(ROOM_W, 0.2, ROOM_D);
    floorGeo.translate(0, -0.1, 0);
    addRoomPiece(floorGeo, floorMat, true);

    const wallDefs = [
      [ROOM_W, ROOM_H, 0.25, 0, ROOM_H / 2, -ROOM_D / 2],
      [ROOM_W, ROOM_H, 0.25, 0, ROOM_H / 2, ROOM_D / 2],
      [0.25, ROOM_H, ROOM_D, -ROOM_W / 2, ROOM_H / 2, 0],
      [0.25, ROOM_H, ROOM_D, ROOM_W / 2, ROOM_H / 2, 0],
    ];
    for (const [w, h, d, x, y, z] of wallDefs) {
      roomAtlas.claim(new THREE.Vector3(x, y, z));
      const geo = new THREE.BoxGeometry(w, h, d);
      geo.translate(x, y, z);
      addRoomPiece(geo, wallMat);
    }
    // plafond (niet schoonmaakbaar, gewoon donker)
    const ceiling = new THREE.Mesh(
      new THREE.BoxGeometry(ROOM_W, 0.2, ROOM_D),
      new THREE.MeshStandardMaterial({ color: 0x14141c, roughness: 0.9 }));
    ceiling.position.y = ROOM_H + 0.1;
    group.add(ceiling);

    // ---------- de geul (flume-trog) met water ----------
    const troughAtlas = new CellAtlas(dirt, {
      id: 'trough', label: 'Flume trough', cols: 3, rows: 1,
      texW: 768, texH: 128, cellWorld: 24, seed: 613, leafDensity: 2.6,
    });
    const troughMat = createCleanableMaterial(
      { color: 0x5e8a96, metalness: 0.2, roughness: 0.45 }, troughAtlas.mask.texture);
    const TROUGH_Z = -3.2;
    const troughDefs = [
      [24, 0.18, 2.0, 0, 0.09, TROUGH_Z],        // bodem
      [24, 0.85, 0.22, 0, 0.43, TROUGH_Z - 1.1], // wand achter
      [24, 0.85, 0.22, 0, 0.43, TROUGH_Z + 1.1], // wand voor
    ];
    for (const [w, h, d, x, y, z] of troughDefs) {
      troughAtlas.claim(new THREE.Vector3(x, y, z));
      const geo = new THREE.BoxGeometry(w, h, d);
      troughAtlas.add(geo);
      geo.translate(x, y, z);
      const mesh = new THREE.Mesh(geo, troughMat);
      mesh.receiveShadow = true;
      mesh.userData.maskId = 'trough';
      group.add(mesh);
      cleanables.push(mesh);
    }
    const water = new THREE.Mesh(
      new THREE.BoxGeometry(23.6, 0.06, 1.9),
      new THREE.MeshStandardMaterial({
        color: 0x1d3b46, metalness: 0.6, roughness: 0.15,
        transparent: true, opacity: 0.85,
      }));
    water.position.set(0, 0.42, TROUGH_Z);
    group.add(water);

    // ---------- het boomstambootje ----------
    const boatMask = dirt.createMask({
      id: 'logboat', label: 'Log boat', w: 256, h: 128,
      worldU: 8, worldV: 4, seed: 617, leafDensity: 2.2,
      lookup: () => new THREE.Vector3(-4, 0.8, TROUGH_Z),
    });
    const logMat = createCleanableMaterial(
      { color: 0x7a5230, metalness: 0.05, roughness: 0.6 }, boatMask.texture);
    const logGeos = [];
    const hull = new THREE.CapsuleGeometry(0.62, 1.9, 6, 12);
    hull.rotateZ(Math.PI / 2);
    hull.scale(1, 0.62, 0.95);
    hull.translate(-4, 0.62, TROUGH_Z);
    logGeos.push(hull);
    for (const sx of [-4.7, -3.9, -3.1]) {
      const seatBack = new THREE.BoxGeometry(0.16, 0.42, 0.85);
      seatBack.translate(sx, 0.92, TROUGH_Z);
      logGeos.push(seatBack);
    }
    const logRing = new THREE.TorusGeometry(0.55, 0.07, 6, 14);
    logRing.rotateY(Math.PI / 2);
    logRing.scale(1, 0.62, 0.95);
    logRing.translate(-5.15, 0.62, TROUGH_Z);
    logGeos.push(logRing);
    const logBoat = new THREE.Mesh(mergeGeometries(logGeos), logMat);
    logBoat.castShadow = logBoat.receiveShadow = true;
    logBoat.userData.maskId = 'logboat';
    group.add(logBoat);
    cleanables.push(logBoat);

    // ---------- sprookjesfiguren (poppen) ----------
    const figAtlas = new CellAtlas(dirt, {
      id: 'figures', label: 'Fairy figures', cols: 3, rows: 2,
      texW: 384, texH: 256, cellWorld: 1.6, seed: 631, leafDensity: 1.4,
    });
    const figMats = {
      skin: createCleanableMaterial({ color: 0xeac394, roughness: 0.4 }, figAtlas.mask.texture),
      red: createCleanableMaterial({ color: 0xc23028, roughness: 0.4 }, figAtlas.mask.texture),
      teal: createCleanableMaterial({ color: 0x44706a, roughness: 0.4 }, figAtlas.mask.texture),
      orange: createCleanableMaterial({ color: 0xe08a35, roughness: 0.4 }, figAtlas.mask.texture),
      pink: createCleanableMaterial({ color: 0xd4799e, roughness: 0.4 }, figAtlas.mask.texture),
      gold: createCleanableMaterial({ color: 0xc9a227, metalness: 0.7, roughness: 0.3 }, figAtlas.mask.texture),
      white: createCleanableMaterial({ color: 0xf3e3c2, roughness: 0.45 }, figAtlas.mask.texture),
    };
    const figBuckets = { skin: [], red: [], teal: [], orange: [], pink: [], gold: [], white: [] };
    const addFig = (bucket, geo, x, y, z) => {
      figAtlas.add(geo);
      geo.translate(x, y, z);
      figBuckets[bucket].push(geo);
    };

    // drie kabouters op het podium
    const gnome = (x, z, coat, h = 1.0) => {
      figAtlas.claim(new THREE.Vector3(x, h * 0.6, z));
      const body = new THREE.CylinderGeometry(0.16, 0.26, h * 0.55, 10);
      addFig(coat, body, x, h * 0.34, z);
      const head = new THREE.SphereGeometry(0.16, 10, 8);
      addFig('skin', head, x, h * 0.7, z);
      const beard = new THREE.ConeGeometry(0.12, 0.22, 8);
      beard.rotateX(Math.PI);
      addFig('white', beard, x, h * 0.6, z + 0.08);
      const hat = new THREE.ConeGeometry(0.17, h * 0.45, 10);
      addFig('red', hat, x, h * 0.95, z);
      for (const fx of [-0.09, 0.09]) {
        const foot = new THREE.SphereGeometry(0.07, 6, 5);
        addFig('red', foot, x + fx, 0.06, z + 0.12);
      }
    };
    gnome(-7.5, 1.6, 'teal', 1.05);
    gnome(-6.6, 2.4, 'orange', 0.9);
    gnome(-5.8, 1.5, 'teal', 1.15);

    // de fee bij het huisje
    const fx = 6.2, fz = 2.0;
    figAtlas.claim(new THREE.Vector3(fx, 1, fz));
    const dress = new THREE.ConeGeometry(0.4, 1.25, 12);
    addFig('pink', dress, fx, 0.62, fz);
    const fairyHead = new THREE.SphereGeometry(0.15, 10, 8);
    addFig('skin', fairyHead, fx, 1.42, fz);
    const crown = new THREE.ConeGeometry(0.1, 0.18, 6);
    addFig('gold', crown, fx, 1.62, fz);
    const wand = new THREE.CylinderGeometry(0.015, 0.015, 0.5, 6);
    wand.rotateZ(0.7);
    addFig('gold', wand, fx + 0.35, 1.15, fz);

    for (const [key, geos] of Object.entries(figBuckets)) {
      if (!geos.length) continue;
      const mesh = new THREE.Mesh(mergeGeometries(geos), figMats[key]);
      mesh.castShadow = true;
      mesh.userData.maskId = 'figures';
      group.add(mesh);
      cleanables.push(mesh);
    }

    // ---------- paddenstoelen ----------
    const shroomAtlas = new CellAtlas(dirt, {
      id: 'shrooms', label: 'Mushrooms', cols: 2, rows: 2,
      texW: 256, texH: 256, cellWorld: 1.6, seed: 641, leafDensity: 1.8,
    });
    const stemMat = createCleanableMaterial(
      { color: 0xf3e3c2, roughness: 0.5 }, shroomAtlas.mask.texture);
    const capMat = createCleanableMaterial(
      { color: 0xffffff, map: dotsCapTexture(), roughness: 0.45 }, shroomAtlas.mask.texture);
    const stems = [];
    const caps = [];
    const shroomDefs = [[-1.5, 1.8, 1.1], [-0.4, 2.6, 0.75], [0.7, 1.6, 0.95], [-0.9, 1.2, 0.6]];
    for (const [x, z, s] of shroomDefs) {
      shroomAtlas.claim(new THREE.Vector3(x, s, z));
      const stem = new THREE.CylinderGeometry(0.16 * s, 0.22 * s, 0.85 * s, 10);
      shroomAtlas.add(stem);
      stem.translate(x, 0.42 * s, z);
      stems.push(stem);
      const cap = new THREE.SphereGeometry(0.5 * s, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
      shroomAtlas.add(cap);
      cap.scale(1, 0.66, 1);
      cap.translate(x, 0.8 * s, z);
      caps.push(cap);
    }
    for (const [geos, mat] of [[stems, stemMat], [caps, capMat]]) {
      const mesh = new THREE.Mesh(mergeGeometries(geos), mat);
      mesh.castShadow = true;
      mesh.userData.maskId = 'shrooms';
      group.add(mesh);
      cleanables.push(mesh);
    }

    // ---------- sprookjeshuisje ----------
    const cottageMask = dirt.createMask({
      id: 'cottage', label: 'Cottage', w: 384, h: 192,
      worldU: 10, worldV: 5, seed: 653, leafDensity: 2.8,
      lookup: () => new THREE.Vector3(7.8, 1.4, 3.4),
    });
    const cottageWallMat = createCleanableMaterial(
      { color: 0xe8d9b8, roughness: 0.55 }, cottageMask.texture);
    const cottageRoofMat = createCleanableMaterial(
      { color: 0x9e3528, roughness: 0.5 }, cottageMask.texture);
    const cottage = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.4, 2.4), cottageWallMat);
    cottage.position.set(7.8, 1.2, 3.4);
    cottage.castShadow = cottage.receiveShadow = true;
    cottage.userData.maskId = 'cottage';
    group.add(cottage);
    cleanables.push(cottage);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.6, 4), cottageRoofMat);
    roof.position.set(7.8, 3.2, 3.4);
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    roof.userData.maskId = 'cottage';
    group.add(roof);
    cleanables.push(roof);
    // deurtje + gloeiende raampjes (cozy!)
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.3, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x5d4226, roughness: 0.6 }));
    door.position.set(7.2, 0.65, 2.16);
    group.add(door);
    for (const wx of [8.3, 6.9]) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.06),
        new THREE.MeshStandardMaterial({
          color: 0xffd27a, emissive: 0xffb347, emissiveIntensity: 1.6,
        }));
      win.position.set(wx, 1.55, 2.16);
      group.add(win);
    }

    // ---------- lampen op de scène (zichtbare spots + echt licht) ----------
    scene.add(new THREE.HemisphereLight(0x3a4668, 0x1a1812, 0.55));
    // werklampen aan het plafond — de ride is immers dicht voor de schoonmaak
    for (const wx of [-9, 0, 9]) {
      const work = new THREE.PointLight(0xfff2d8, 18, 14, 1.8);
      work.position.set(wx, 5.4, 0);
      scene.add(work);
      const fixture = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.08, 0.18),
        new THREE.MeshStandardMaterial({
          color: 0xfff2d8, emissive: 0xfff2d8, emissiveIntensity: 1.4,
        }));
      fixture.position.set(wx, 5.55, 0);
      group.add(fixture);
    }
    // footlights aan de geulkant: de verlichte kant wijst naar de bezoeker
    const lampDefs = [
      { x: -6.6, z: -5.6, tx: -6.6, tz: 2.0, color: 0xffc878, name: 'gnomes' },
      { x: -0.5, z: -5.6, tx: -0.5, tz: 1.8, color: 0x9fd8ff, name: 'shrooms' },
      { x: 6.0, z: -5.6, tx: 7.6, tz: 3.2, color: 0xffb8d8, name: 'cottage' },
      { x: -8.5, z: -6.0, tx: -4.0, tz: TROUGH_Z, color: 0xfff0c8, name: 'boat' },
    ];
    const lampMat = new THREE.MeshStandardMaterial({ color: 0x232528, metalness: 0.6, roughness: 0.4 });
    for (const L of lampDefs) {
      // statief + behuizing + gloeiende lens
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 2.6, 8), lampMat);
      pole.position.set(L.x, 1.3, L.z);
      group.add(pole);
      const housing = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.34, 10), lampMat);
      housing.position.set(L.x, 2.65, L.z);
      housing.lookAt(L.tx, 1.0, L.tz);
      housing.rotateX(-Math.PI / 2);
      group.add(housing);
      const lens = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6),
        new THREE.MeshStandardMaterial({
          color: L.color, emissive: L.color, emissiveIntensity: 2.2,
        }));
      lens.position.set(L.x, 2.62, L.z);
      group.add(lens);

      const spot = new THREE.SpotLight(L.color, 140, 20, 0.6, 0.5, 1.6);
      spot.position.set(L.x, 2.7, L.z);
      spot.target.position.set(L.tx, 0.8, L.tz);
      // schaduw alleen op de twee belangrijkste spots (performance)
      if (L.name === 'gnomes' || L.name === 'cottage') {
        spot.castShadow = true;
        spot.shadow.mapSize.set(512, 512);
      }
      scene.add(spot, spot.target);
    }

    scene.add(group);

    return { spawn: { pos: [-12.5, 1.7, 5.5], yaw: 0.9, pitch: 0.02 } };
  },
};
