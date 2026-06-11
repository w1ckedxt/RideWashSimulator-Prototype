// Level 3 — Top Spin (HUSS-stijl): twee zware torens, draaiarmen en een
// gondelrij met zitjes, geparkeerd boven het bewegende platform.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CellAtlas } from '../atlas.js';
import { createCleanableMaterial } from '../materials.js';
import { buildEnvironment, makeSign, makeFenceLine, FENCE_GREEN } from '../environment.js';
import { stripeTexture } from '../textures.js';

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
  tagline: 'Twin towers, swinging gondola — and every inch of it filthy.',

  build({ scene, dirt, cleanables }) {
    const group = new THREE.Group();
    const hubY = 6.8;

    // ---------- torens ----------
    const towerAtlas = new CellAtlas(dirt, {
      id: 'towers', label: 'Towers', cols: 4, rows: 3,
      texW: 512, texH: 384, cellWorld: 3, seed: 411, leafDensity: 0.5,
    });
    const towerMat = createCleanableMaterial(
      { color: 0x3e5a78, metalness: 0.55, roughness: 0.45 }, towerAtlas.mask.texture);
    const towerGeos = [];
    for (const side of [-1, 1]) {
      const hub = new THREE.Vector3(side * 5.2, hubY, 0);
      for (const lz of [-1.9, 1.9]) {
        towerAtlas.claim(new THREE.Vector3(side * 5.6, hubY / 2, lz / 2));
        towerGeos.push(towerAtlas.add(
          beamBetween(new THREE.Vector3(side * 6.3, 0, lz), hub, 0.42, 0.42)));
      }
      for (const hh of [2.2, 4.4]) {
        towerAtlas.claim(new THREE.Vector3(side * 5.8, hh, 0));
        const t = hh / hubY;
        const zspan = 1.9 * (1 - t) + 0.25;
        towerGeos.push(towerAtlas.add(beamBetween(
          new THREE.Vector3(side * (6.3 - 1.1 * t * 0 + (5.2 - 6.3) * t), hh, -zspan),
          new THREE.Vector3(side * (6.3 + (5.2 - 6.3) * t), hh, zspan), 0.22, 0.22)));
      }
    }
    const towers = new THREE.Mesh(mergeGeometries(towerGeos), towerMat);
    towers.castShadow = towers.receiveShadow = true;
    towers.userData.maskId = 'towers';
    group.add(towers);
    cleanables.push(towers);

    // ---------- draaiarmen ----------
    const armAtlas = new CellAtlas(dirt, {
      id: 'tarms', label: 'Spin arms', cols: 2, rows: 2,
      texW: 256, texH: 256, cellWorld: 2.5, seed: 421, leafDensity: 0.4,
    });
    const armMat = createCleanableMaterial(
      { color: 0xb8551e, metalness: 0.5, roughness: 0.4 }, armAtlas.mask.texture);
    const armGeos = [];
    const gondolaY = 3.4;
    for (const side of [-1, 1]) {
      armAtlas.claim(new THREE.Vector3(side * 4.7, 5, 0));
      armGeos.push(armAtlas.add(beamBetween(
        new THREE.Vector3(side * 5.2, hubY, 0),
        new THREE.Vector3(side * 4.2, gondolaY, 0), 0.5, 0.34)));
      // hub-schijf
      const hubDisc = new THREE.CylinderGeometry(0.75, 0.75, 0.3, 14);
      hubDisc.rotateZ(Math.PI / 2);
      armAtlas.add(hubDisc);
      hubDisc.translate(side * 5.45, hubY, 0);
      armGeos.push(hubDisc);
    }
    const arms = new THREE.Mesh(mergeGeometries(armGeos), armMat);
    arms.castShadow = true;
    arms.userData.maskId = 'tarms';
    group.add(arms);
    cleanables.push(arms);

    // ---------- gondel ----------
    const gondolaMask = dirt.createMask({
      id: 'gondola', label: 'Gondola', w: 512, h: 128,
      worldU: 10, worldV: 4, seed: 431, leafDensity: 1.2,
      lookup: () => new THREE.Vector3(0, gondolaY, 0),
    });
    const gondolaMat = createCleanableMaterial(
      { color: 0xc7a83c, metalness: 0.35, roughness: 0.4 }, gondolaMask.texture);
    const seatMatA = createCleanableMaterial(
      { color: 0xa83236, metalness: 0.25, roughness: 0.45 }, gondolaMask.texture);
    const seatMatB = createCleanableMaterial(
      { color: 0x2f5276, metalness: 0.25, roughness: 0.45 }, gondolaMask.texture);
    const barMat = createCleanableMaterial(
      { color: 0x2a2d31, metalness: 0.7, roughness: 0.4 }, gondolaMask.texture);

    const beamGeos = [];
    const seatsA = [];
    const seatsB = [];
    const barGeos = [];
    const beam = new THREE.BoxGeometry(8.4, 0.55, 0.8);
    beam.translate(0, gondolaY, 0);
    beamGeos.push(beam);
    for (let k = 0; k < 8; k++) {
      const sx = -3.5 + k * 1.0;
      const bucket = k % 2 ? seatsA : seatsB;
      for (const sz of [-0.85, 0.85]) {
        const seat = new THREE.BoxGeometry(0.7, 0.8, 0.6);
        seat.translate(sx, gondolaY - 0.75, sz);
        bucket.push(seat);
        const headrest = new THREE.BoxGeometry(0.5, 0.5, 0.18);
        headrest.translate(sx, gondolaY - 0.1, sz + (sz > 0 ? 0.24 : -0.24));
        bucket.push(headrest);
        // veiligheidsbeugel
        const bar = new THREE.TorusGeometry(0.26, 0.04, 6, 10, Math.PI);
        bar.rotateZ(Math.PI / 2);
        bar.rotateY(Math.PI / 2);
        bar.translate(sx, gondolaY - 0.55, sz + (sz > 0 ? -0.3 : 0.3));
        barGeos.push(bar);
      }
    }
    for (const [geos, mat] of [[beamGeos, gondolaMat], [seatsA, seatMatA], [seatsB, seatMatB], [barGeos, barMat]]) {
      const mesh = new THREE.Mesh(mergeGeometries(geos), mat);
      mesh.castShadow = true;
      mesh.userData.maskId = 'gondola';
      group.add(mesh);
      cleanables.push(mesh);
    }

    // ---------- bewegend platform ----------
    const floorMask = dirt.createMask({
      id: 'tfloor', label: 'Floor platform', w: 512, h: 256,
      worldU: 11, worldV: 5, seed: 433, leafDensity: 2.6,
      lookup: () => new THREE.Vector3(0, 0.4, 0),
    });
    const floorMat = createCleanableMaterial(
      { color: 0x7c8288, metalness: 0.3, roughness: 0.6 }, floorMask.texture);
    const floor = new THREE.Mesh(new THREE.BoxGeometry(11, 0.4, 5), floorMat);
    floor.position.y = 0.2;
    floor.castShadow = floor.receiveShadow = true;
    floor.userData.maskId = 'tfloor';
    group.add(floor);
    cleanables.push(floor);

    // hazard-strepen langs de platformranden + betonvoeten onder de torens
    const hazardMat = new THREE.MeshStandardMaterial({
      map: stripeTexture('#d8b020', '#1d1d1d', 24), roughness: 0.7,
    });
    for (const hz of [-2.45, 2.45]) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(11, 0.42, 0.18), hazardMat);
      strip.position.set(0, 0.2, hz);
      group.add(strip);
    }
    const footMat = new THREE.MeshStandardMaterial({ color: 0x8d8a84, roughness: 0.9 });
    for (const side of [-1, 1]) {
      for (const lz of [-1.9, 1.9]) {
        const foot = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.5, 1.1), footMat);
        foot.position.set(side * 6.3, 0.25, lz);
        foot.castShadow = foot.receiveShadow = true;
        group.add(foot);
      }
    }

    scene.add(group);
    scene.add(makeSign('Top Spin', { x: -8, z: 10, rotY: Math.PI / 5 }));
    scene.add(makeFenceLine(
      [[-8.5, 4.5], [-8.5, -4.5], [8.5, -4.5], [8.5, 4.5], [3, 4.5]], 1.0, FENCE_GREEN()));

    buildEnvironment(scene, {
      clearFn: (x, z) => (Math.abs(x) > 11 || Math.abs(z) > 8) && !(x > -10 && x < 10 && z > 4 && z < 18),
      treeCount: 90,
      treeArea: { x0: -60, x1: 60, z0: -60, z1: 50 },
      fencePts: [[-34, 26], [-34, -32], [34, -32], [34, 26], [8, 26]],
      plaza: { x: 0, z: 11, w: 22, d: 9, queues: [[[-6, 13], [6, 13]]] },
    });

    return { spawn: { pos: [0, 1.8, 14], yaw: 0, pitch: 0.08 } };
  },
};
