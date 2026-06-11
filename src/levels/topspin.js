// Level 3 — Top Spin, gemodelleerd naar een echte kermis-Top Spin:
// zware rode A-torens met sterren, dikke hoofdas, contragewicht-armen,
// gondelrij met stippenbanner en hoofdsteunen, omheind platform.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CellAtlas } from '../atlas.js';
import { createCleanableMaterial } from '../materials.js';
import { buildEnvironment, makeBooth, makeSign, makeFenceLine, makeStairs, FENCE_GREEN } from '../environment.js';
import { stripeTexture, starsTexture, dotsTexture } from '../textures.js';

const Y = new THREE.Vector3(0, 1, 0);

function beamBetween(a, b, w, h) {
  const dir = b.clone().sub(a);
  const len = dir.length();
  const geo = new THREE.BoxGeometry(w, len, h);
  geo.applyMatrix4(new THREE.Matrix4()
    .makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(Y, dir.normalize()))
    .setPosition(a.clone().add(b).multiplyScalar(0.5)));
  return geo;
}

export const TOPSPIN = {
  id: 'topspin',
  name: 'Top Spin',
  tagline: 'The fairground monster — twin star towers, one filthy gondola.',

  build({ scene, dirt, cleanables }) {
    const group = new THREE.Group();
    const hubY = 7.6;
    const gondolaY = 1.7;   // startpositie: laag boven het instapplatform

    // ---------- torens (rood met sterren, zoals echt) ----------
    const towerAtlas = new CellAtlas(dirt, {
      id: 'towers', label: 'Towers', cols: 4, rows: 3,
      texW: 512, texH: 384, cellWorld: 3.5, seed: 411, leafDensity: 0.5,
    });
    const towerMat = createCleanableMaterial(
      { color: 0xffffff, map: starsTexture('#c23028', 12), metalness: 0.35, roughness: 0.4 },
      towerAtlas.mask.texture);
    const towerEdgeMat = createCleanableMaterial(
      { color: 0xe07b33, metalness: 0.4, roughness: 0.4 }, towerAtlas.mask.texture);

    const towerGeos = [];
    const edgeGeos = [];
    for (const side of [-1, 1]) {
      const hub = new THREE.Vector3(side * 5.6, hubY, 0);
      // hoofdmast (dik, taps) + achterpoot = A-vorm
      towerAtlas.claim(new THREE.Vector3(side * 6.3, hubY / 2, 0.8));
      towerGeos.push(towerAtlas.add(
        beamBetween(new THREE.Vector3(side * 7.6, 0, 1.7), hub, 0.95, 0.6)));
      towerAtlas.claim(new THREE.Vector3(side * 6.3, hubY / 2, -0.8));
      towerGeos.push(towerAtlas.add(
        beamBetween(new THREE.Vector3(side * 7.6, 0, -1.7), hub, 0.95, 0.6)));
      // oranje randbalken
      towerAtlas.claim(new THREE.Vector3(side * 5.2, hubY / 2, 0));
      edgeGeos.push(towerAtlas.add(
        beamBetween(new THREE.Vector3(side * 4.6, 0, 0), hub, 0.4, 0.4)));
      // voetbalk
      const foot = new THREE.BoxGeometry(3.6, 0.45, 4.2);
      towerAtlas.claim(new THREE.Vector3(side * 6.6, 0.3, 0));
      towerAtlas.add(foot);
      foot.translate(side * 6.6, 0.22, 0);
      towerGeos.push(foot);
    }
    for (const [geos, mat] of [[towerGeos, towerMat], [edgeGeos, towerEdgeMat]]) {
      const mesh = new THREE.Mesh(mergeGeometries(geos), mat);
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.userData.maskId = 'towers';
      group.add(mesh);
      cleanables.push(mesh);
    }

    // ---------- hoofdas + armen + contragewicht ----------
    const armAtlas = new CellAtlas(dirt, {
      id: 'tarms', label: 'Arms & axle', cols: 3, rows: 2,
      texW: 384, texH: 256, cellWorld: 3, seed: 421, leafDensity: 0.4,
    });
    const armMat = createCleanableMaterial(
      { color: 0xc23028, metalness: 0.45, roughness: 0.4 }, armAtlas.mask.texture);
    const steelMat = createCleanableMaterial(
      { color: 0x6a7178, metalness: 0.8, roughness: 0.35 }, armAtlas.mask.texture);

    const armGeos = [];
    const steelGeos = [];
    // doorlopende hoofdas tussen de torens
    const axle = new THREE.CylinderGeometry(0.24, 0.24, 11.6, 12);
    axle.rotateZ(Math.PI / 2);
    armAtlas.claim(new THREE.Vector3(0, hubY, 0));
    armAtlas.add(axle);
    axle.translate(0, hubY, 0);
    steelGeos.push(axle);

    for (const side of [-1, 1]) {
      // hub-schijf
      const hubDisc = new THREE.CylinderGeometry(0.95, 0.95, 0.4, 16);
      hubDisc.rotateZ(Math.PI / 2);
      armAtlas.claim(new THREE.Vector3(side * 5.6, hubY, 0));
      armAtlas.add(hubDisc);
      hubDisc.translate(side * 5.6, hubY, 0);
      armGeos.push(hubDisc);

      // hoofdarm naar de gondel
      armAtlas.claim(new THREE.Vector3(side * 5, 5.5, 0));
      armGeos.push(armAtlas.add(beamBetween(
        new THREE.Vector3(side * 5.6, hubY, 0),
        new THREE.Vector3(side * 4.5, gondolaY, 0), 0.62, 0.4)));

      // contragewicht-arm met knots (zoals op de foto)
      armAtlas.claim(new THREE.Vector3(side * 5.9, hubY + 1.4, 0));
      armGeos.push(armAtlas.add(beamBetween(
        new THREE.Vector3(side * 5.6, hubY, 0),
        new THREE.Vector3(side * 6.1, hubY + 1.9, 0), 0.45, 0.35)));
      const weight = new THREE.SphereGeometry(0.55, 10, 8);
      armAtlas.add(weight);
      weight.translate(side * 6.2, hubY + 2.3, 0);
      armGeos.push(weight);
    }
    for (const [geos, mat] of [[armGeos, armMat], [steelGeos, steelMat]]) {
      const mesh = new THREE.Mesh(mergeGeometries(geos), mat);
      mesh.castShadow = true;
      mesh.userData.maskId = 'tarms';
      group.add(mesh);
      cleanables.push(mesh);
    }

    // ---------- gondel: 2 rijen rug-aan-rug + stippenbanner ----------
    const gondolaMask = dirt.createMask({
      id: 'gondola', label: 'Gondola', w: 512, h: 128,
      worldU: 10, worldV: 4, seed: 431, leafDensity: 1.2,
      lookup: () => new THREE.Vector3(0, gondolaY, 0),
    });
    const gondolaMat = createCleanableMaterial(
      { color: 0xc23028, metalness: 0.4, roughness: 0.4 }, gondolaMask.texture);
    const seatMat = createCleanableMaterial(
      { color: 0x8a2024, metalness: 0.25, roughness: 0.5 }, gondolaMask.texture);
    const blackMat = createCleanableMaterial(
      { color: 0x232528, metalness: 0.5, roughness: 0.45 }, gondolaMask.texture);
    const bannerMat = createCleanableMaterial(
      { color: 0xffffff, map: dotsTexture(), metalness: 0.1, roughness: 0.5 }, gondolaMask.texture);

    const bodyGeos = [];
    const seatGeos = [];
    const blackGeos = [];
    // gondelvloer (rechtop, stoeltjes erbovenop — startpositie)
    const deck = new THREE.BoxGeometry(9.0, 0.45, 2.2);
    deck.translate(0, gondolaY, 0);
    bodyGeos.push(deck);
    // dwarsas waar de armen aan grijpen
    const gAxle = new THREE.CylinderGeometry(0.14, 0.14, 9.4, 10);
    gAxle.rotateZ(Math.PI / 2);
    gAxle.translate(0, gondolaY, 0);
    blackGeos.push(gAxle);
    // gedeelde ruggengraat-wand waar beide rijen tegenaan leunen
    const spine = new THREE.BoxGeometry(8.8, 1.15, 0.18);
    spine.translate(0, gondolaY + 0.78, 0);
    seatGeos.push(spine);

    for (let k = 0; k < 9; k++) {
      const sx = -4 + k * 1.0;
      for (const dirZ of [-1, 1]) {
        // zitje óp het dek, rug naar het midden
        const seat = new THREE.BoxGeometry(0.8, 0.45, 0.6);
        seat.translate(sx, gondolaY + 0.45, dirZ * 0.45);
        seatGeos.push(seat);
        // hoofdsteun-pin omhoog (de zwarte knoppen op de foto)
        const pin = new THREE.CylinderGeometry(0.05, 0.05, 0.5, 6);
        pin.translate(sx, gondolaY + 1.55, dirZ * 0.12);
        blackGeos.push(pin);
        const headrest = new THREE.BoxGeometry(0.45, 0.38, 0.14);
        headrest.translate(sx, gondolaY + 1.22, dirZ * 0.14);
        blackGeos.push(headrest);
        // beugel voor de schoot
        const bar = new THREE.TorusGeometry(0.27, 0.045, 6, 10, Math.PI);
        bar.rotateZ(Math.PI / 2);
        bar.rotateY(Math.PI / 2);
        bar.translate(sx, gondolaY + 0.75, dirZ * 0.85);
        blackGeos.push(bar);
      }
    }
    for (const [geos, mat] of [[bodyGeos, gondolaMat], [seatGeos, seatMat], [blackGeos, blackMat]]) {
      const mesh = new THREE.Mesh(mergeGeometries(geos), mat);
      mesh.castShadow = true;
      mesh.userData.maskId = 'gondola';
      group.add(mesh);
      cleanables.push(mesh);
    }
    // stippenbanners op beide lange zijden van de gondelvloer
    for (const bz of [-1.13, 1.13]) {
      const banner = new THREE.Mesh(new THREE.BoxGeometry(9.0, 0.42, 0.06), bannerMat);
      banner.position.set(0, gondolaY, bz);
      banner.castShadow = true;
      banner.userData.maskId = 'gondola';
      group.add(banner);
      cleanables.push(banner);
    }

    // ---------- platform + omheining ----------
    const floorMask = dirt.createMask({
      id: 'tfloor', label: 'Floor platform', w: 512, h: 256,
      worldU: 13, worldV: 6, seed: 433, leafDensity: 2.6,
      lookup: () => new THREE.Vector3(0, 0.4, 0),
    });
    const floorMat = createCleanableMaterial(
      { color: 0x7c8288, metalness: 0.3, roughness: 0.6 }, floorMask.texture);
    const floor = new THREE.Mesh(new THREE.BoxGeometry(13, 0.4, 6), floorMat);
    floor.position.y = 0.2;
    floor.castShadow = floor.receiveShadow = true;
    floor.userData.maskId = 'tfloor';
    floor.userData.walkable = true;
    group.add(floor);
    cleanables.push(floor);

    const hazardMat = new THREE.MeshStandardMaterial({
      map: stripeTexture('#d8b020', '#1d1d1d', 24), roughness: 0.7,
    });
    for (const hz of [-2.95, 2.95]) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(13, 0.42, 0.18), hazardMat);
      strip.position.set(0, 0.2, hz);
      group.add(strip);
    }

    scene.add(group);
    scene.add(makeSign(dirt, cleanables, 'Top Spin', { x: -9, z: 11, rotY: Math.PI / 5 }));
    scene.add(makeBooth(dirt, cleanables, { x: 11.5, z: 6.5, rotY: -0.7 }));

    // volledige omheining rond de ride met instap-opening + trapje
    const fenceMat = FENCE_GREEN();
    scene.add(makeFenceLine(
      [[1.8, 4.6], [9.5, 4.6], [9.5, -4.6], [-9.5, -4.6], [-9.5, 4.6], [-1.8, 4.6]],
      1.0, fenceMat));
    scene.add(makeStairs({ x: 0, z: 4.6, h: 0.4, steps: 2, w: 2.4 }));

    const env = buildEnvironment(scene, {
      clearFn: (x, z) => (Math.abs(x) > 12 || Math.abs(z) > 9) && !(x > -10 && x < 10 && z > 4 && z < 20),
      treeCount: 90,
      treeArea: { x0: -60, x1: 60, z0: -60, z1: 50 },
      fencePts: [[-34, 26], [-34, -32], [34, -32], [34, 26], [8, 26]],
      plaza: {
        x: 0, z: 12, w: 24, d: 11,
        queues: [[[-7, 14], [7, 14]], [[7, 17], [-7, 17]]],
      },
    });

    return { spawn: { pos: [0, 1.7, 15], yaw: 0, pitch: 0.08 }, envUpdate: env.update };
  },
};
