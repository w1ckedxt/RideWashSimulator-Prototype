// Level 2 — Swinging Ship. Piratenschip in ruststand: A-frames, hangarmen
// en een houten romp vol vogelpoep en blaadjes.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CellAtlas } from '../atlas.js';
import { createCleanableMaterial } from '../materials.js';
import { buildEnvironment, makeSign, makeFenceLine, FENCE_GREEN } from '../environment.js';

const Y = new THREE.Vector3(0, 1, 0);

function tubeBetween(a, b, r, segs = 8) {
  const dir = b.clone().sub(a);
  const len = dir.length();
  const geo = new THREE.CylinderGeometry(r, r, len, segs);
  geo.applyMatrix4(new THREE.Matrix4()
    .makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(Y, dir.normalize()))
    .setPosition(a.clone().add(b).multiplyScalar(0.5)));
  return geo;
}

export const SHIP = {
  id: 'ship',
  name: 'Swinging Ship',
  tagline: 'The old pirate ship — barnacles optional, grime guaranteed.',

  build({ scene, dirt, cleanables }) {
    const group = new THREE.Group();
    const apexY = 8;

    // ---------- frame (A-frames + hoofdas) ----------
    const frameAtlas = new CellAtlas(dirt, {
      id: 'frame', label: 'Support frame', cols: 4, rows: 3,
      texW: 512, texH: 384, cellWorld: 3.5, seed: 311, leafDensity: 0.6,
    });
    const frameMat = createCleanableMaterial(
      { color: 0x5b6e7e, metalness: 0.55, roughness: 0.45 }, frameAtlas.mask.texture);
    const frameGeos = [];
    for (const side of [-1, 1]) {
      const apex = new THREE.Vector3(0, apexY, side * 3.2);
      for (const lx of [-3.6, 3.6]) {
        frameAtlas.claim(new THREE.Vector3(lx / 2, apexY / 2, side * 3.2));
        frameGeos.push(frameAtlas.add(tubeBetween(new THREE.Vector3(lx, 0, side * 3.2), apex, 0.2, 10)));
      }
      frameAtlas.claim(new THREE.Vector3(0, 4, side * 3.2));
      frameGeos.push(frameAtlas.add(tubeBetween(
        new THREE.Vector3(-1.85, 4, side * 3.2), new THREE.Vector3(1.85, 4, side * 3.2), 0.12, 8)));
    }
    frameAtlas.claim(new THREE.Vector3(0, apexY, 0));
    frameGeos.push(frameAtlas.add(tubeBetween(
      new THREE.Vector3(0, apexY, -3.2), new THREE.Vector3(0, apexY, 3.2), 0.17, 10)));

    // ---------- hangarmen ----------
    const armAtlas = new CellAtlas(dirt, {
      id: 'arms', label: 'Swing arms', cols: 2, rows: 2,
      texW: 256, texH: 256, cellWorld: 3, seed: 313, leafDensity: 0.4,
    });
    const armMat = createCleanableMaterial(
      { color: 0x9e3528, metalness: 0.5, roughness: 0.45 }, armAtlas.mask.texture);
    const armGeos = [];
    for (const az of [-1.4, 1.4]) {
      armAtlas.claim(new THREE.Vector3(0, 5, az));
      armGeos.push(armAtlas.add(tubeBetween(
        new THREE.Vector3(0, apexY, az), new THREE.Vector3(0, 2.6, az), 0.11, 8)));
    }

    // ---------- romp ----------
    const hullMask = dirt.createMask({
      id: 'hull', label: 'Ship hull', w: 512, h: 256,
      worldU: 12, worldV: 7, seed: 317, leafDensity: 2.4,
      lookup: () => new THREE.Vector3(0, 1.6, 0),
    });
    const hullMat = createCleanableMaterial(
      { color: 0x6e4a28, metalness: 0.08, roughness: 0.55 }, hullMask.texture);
    const hullGeo = new THREE.CapsuleGeometry(1.05, 4.2, 6, 14);
    hullGeo.rotateZ(Math.PI / 2);
    hullGeo.scale(1, 0.6, 0.85);
    const hull = new THREE.Mesh(hullGeo, hullMat);
    hull.position.y = 1.55;
    hull.castShadow = hull.receiveShadow = true;
    hull.userData.maskId = 'hull';
    group.add(hull);
    cleanables.push(hull);

    // boeg- en heksteven
    const hullExtraGeos = [];
    for (const side of [-1, 1]) {
      const fig = new THREE.ConeGeometry(0.32, 1.5, 8);
      fig.rotateZ(side * -Math.PI / 3.2);
      fig.translate(side * 3.4, 2.45, 0);
      hullExtraGeos.push(fig);
    }
    const hullExtra = new THREE.Mesh(mergeGeometries(hullExtraGeos), hullMat);
    hullExtra.castShadow = true;
    hullExtra.userData.maskId = 'hull';
    group.add(hullExtra);
    cleanables.push(hullExtra);

    // ---------- bankjes ----------
    const benchAtlas = new CellAtlas(dirt, {
      id: 'benches', label: 'Benches', cols: 3, rows: 2,
      texW: 256, texH: 192, cellWorld: 1.6, seed: 331, leafDensity: 1.6,
    });
    const benchMat = createCleanableMaterial(
      { color: 0xb08a3e, metalness: 0.2, roughness: 0.5 }, benchAtlas.mask.texture);
    const benchGeos = [];
    for (let k = -2; k <= 2; k++) {
      const bx = k * 1.05;
      benchAtlas.claim(new THREE.Vector3(bx, 2.1, 0));
      const seat = new THREE.BoxGeometry(0.45, 0.1, 1.5);
      benchAtlas.add(seat);
      seat.translate(bx, 2.0 + Math.abs(k) * 0.12, 0);
      benchGeos.push(seat);
      const back = new THREE.BoxGeometry(0.08, 0.45, 1.5);
      benchAtlas.add(back);
      back.translate(bx - 0.22, 2.2 + Math.abs(k) * 0.12, 0);
      benchGeos.push(back);
    }
    const benches = new THREE.Mesh(mergeGeometries(benchGeos), benchMat);
    benches.castShadow = true;
    benches.userData.maskId = 'benches';
    group.add(benches);
    cleanables.push(benches);

    const frame = new THREE.Mesh(mergeGeometries(frameGeos), frameMat);
    frame.castShadow = frame.receiveShadow = true;
    frame.userData.maskId = 'frame';
    group.add(frame);
    cleanables.push(frame);

    const arms = new THREE.Mesh(mergeGeometries(armGeos), armMat);
    arms.castShadow = true;
    arms.userData.maskId = 'arms';
    group.add(arms);
    cleanables.push(arms);

    scene.add(group);
    scene.add(makeSign('Swinging Ship', { x: -7, z: 10, rotY: Math.PI / 5 }));
    scene.add(makeFenceLine(
      [[-7, 6], [-7, -6], [7, -6], [7, 6], [2.5, 6]], 1.0, FENCE_GREEN()));

    buildEnvironment(scene, {
      clearFn: (x, z) => (x * x / 100 + z * z / 64) > 1.6 && !(x > -9 && x < 9 && z > 5 && z < 18),
      treeCount: 90,
      treeArea: { x0: -60, x1: 60, z0: -60, z1: 50 },
      fencePts: [[-32, 26], [-32, -32], [32, -32], [32, 26], [7, 26]],
      plaza: { x: 0, z: 11, w: 20, d: 9, queues: [] },
    });

    return { spawn: { pos: [0, 1.8, 13], yaw: 0, pitch: 0.06 } };
  },
};
