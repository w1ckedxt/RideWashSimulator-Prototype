// Level 1 — Carousel. Klein en knus: draaimolen met paardjes, luifel en
// middenkolom. Perfecte eerste schoonmaakklus.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CellAtlas } from '../atlas.js';
import { createCleanableMaterial } from '../materials.js';
import { buildEnvironment, makeSign, makeFenceLine, FENCE_GREEN } from '../environment.js';

function buildHorse(atlas, geos, angle, r, lift) {
  // onderdelen in lokale ruimte: +X = kijkrichting (tangent), Y omhoog
  const horse = [];

  const body = new THREE.CapsuleGeometry(0.22, 0.55, 4, 8);
  body.rotateZ(Math.PI / 2);
  horse.push([body, 0, 0, 0]);

  const head = new THREE.CapsuleGeometry(0.12, 0.28, 4, 8);
  head.rotateZ(Math.PI / 3);
  horse.push([head, 0.42, 0.32, 0]);

  const saddle = new THREE.BoxGeometry(0.3, 0.07, 0.3);
  horse.push([saddle, 0, 0.22, 0]);

  for (const [lx, lz, tilt] of [[0.28, 0.1, 0.3], [0.28, -0.1, -0.1], [-0.28, 0.1, 0.1], [-0.28, -0.1, -0.3]]) {
    const leg = new THREE.CylinderGeometry(0.04, 0.035, 0.5, 6);
    leg.rotateX(tilt);
    horse.push([leg, lx, -0.4, lz]);
  }

  const cy = 1.55 + lift;
  for (const [geo, ox, oy, oz] of horse) {
    atlas.add(geo);
    geo.translate(ox, oy, oz);              // lokale plek t.o.v. paard-anker
    geo.rotateY(angle + Math.PI / 2);       // neus in draairichting
    geo.translate(Math.cos(angle) * r, cy, Math.sin(angle) * r);
    geos.push(geo);
  }
}

export const CAROUSEL = {
  id: 'carousel',
  name: 'Carousel',
  tagline: 'A cozy classic — horses, brass poles and a striped canopy.',

  build({ scene, dirt, cleanables }) {
    const group = new THREE.Group();

    // ---------- platform ----------
    const platMask = dirt.createMask({
      id: 'cplatform', label: 'Platform', w: 512, h: 128,
      worldU: 30, worldV: 10, seed: 211, leafDensity: 2.0,
      lookup: () => new THREE.Vector3(0, 0.8, 3),
    });
    const platMat = createCleanableMaterial(
      { color: 0x46656e, metalness: 0.25, roughness: 0.5 }, platMask.texture);
    const platform = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.8, 0.35, 24), platMat);
    platform.position.y = 0.55;
    platform.castShadow = platform.receiveShadow = true;
    platform.userData.maskId = 'cplatform';
    group.add(platform);
    cleanables.push(platform);

    // ---------- middenkolom ----------
    const colMask = dirt.createMask({
      id: 'ccolumn', label: 'Center column', w: 256, h: 256,
      worldU: 2.5, worldV: 3.8, seed: 223, leafDensity: 0.8,
      lookup: () => new THREE.Vector3(0, 2.5, 0.5),
    });
    const colMat = createCleanableMaterial(
      { color: 0xa8323b, metalness: 0.35, roughness: 0.4 }, colMask.texture);
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.44, 3.6, 14), colMat);
    column.position.y = 2.5;
    column.castShadow = true;
    column.userData.maskId = 'ccolumn';
    group.add(column);
    cleanables.push(column);

    // ---------- luifel ----------
    const canopyMask = dirt.createMask({
      id: 'canopy', label: 'Canopy roof', w: 512, h: 256,
      worldU: 33, worldV: 6, seed: 227, leafDensity: 3.2,
      lookup: () => new THREE.Vector3(0, 5.2, 2),
    });
    const canopyMat = createCleanableMaterial(
      { color: 0xb98a2e, metalness: 0.2, roughness: 0.5 }, canopyMask.texture);
    const canopy = new THREE.Mesh(new THREE.ConeGeometry(5.5, 1.9, 18), canopyMat);
    canopy.position.y = 5.15;
    canopy.castShadow = true;
    canopy.userData.maskId = 'canopy';
    group.add(canopy);
    cleanables.push(canopy);

    const topBall = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xe8b23a, metalness: 0.7, roughness: 0.3 }));
    topBall.position.y = 6.2;
    group.add(topBall);

    // ---------- paardjes & palen ----------
    const atlas = new CellAtlas(dirt, {
      id: 'horses', label: 'Horses & poles', cols: 4, rows: 2,
      texW: 512, texH: 256, cellWorld: 2.2, seed: 229, leafDensity: 0.7,
    });
    const horseMat = createCleanableMaterial(
      { color: 0xf2ede4, metalness: 0.1, roughness: 0.35 }, atlas.mask.texture);
    const poleMat = createCleanableMaterial(
      { color: 0xc9a227, metalness: 0.85, roughness: 0.25 }, atlas.mask.texture);

    const horseGeos = [];
    const poleGeos = [];
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const r = 3.3;
      const px = Math.cos(a) * r, pz = Math.sin(a) * r;
      atlas.claim(new THREE.Vector3(px, 1.6, pz));

      const pole = new THREE.CylinderGeometry(0.045, 0.045, 3.4, 8);
      atlas.add(pole);
      pole.translate(px, 2.45, pz);
      poleGeos.push(pole);

      buildHorse(atlas, horseGeos, a, r, (k % 2) * 0.35);
    }
    for (const [geos, mat] of [[horseGeos, horseMat], [poleGeos, poleMat]]) {
      const mesh = new THREE.Mesh(mergeGeometries(geos), mat);
      mesh.castShadow = true;
      mesh.userData.maskId = 'horses';
      group.add(mesh);
      cleanables.push(mesh);
    }

    scene.add(group);
    scene.add(makeSign('Carousel', { x: -6, z: 9, rotY: Math.PI / 5 }));

    // achthoekig hekje rondom
    const fencePts = [];
    for (let k = 0; k <= 8; k++) {
      const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
      fencePts.push([Math.cos(a) * 7.2, Math.sin(a) * 7.2]);
    }
    scene.add(makeFenceLine(fencePts, 1.0, FENCE_GREEN()));

    buildEnvironment(scene, {
      clearFn: (x, z) => x * x + z * z > 10 * 10 && !(x > -8 && x < 8 && z > 6 && z < 18),
      treeCount: 90,
      treeArea: { x0: -60, x1: 60, z0: -60, z1: 50 },
      fencePts: [[-30, 26], [-30, -30], [30, -30], [30, 26], [6, 26]],
      plaza: { x: 0, z: 11, w: 18, d: 9, queues: [] },
    });

    return { spawn: { pos: [0, 1.8, 12], yaw: 0, pitch: 0.02 } };
  },
};
