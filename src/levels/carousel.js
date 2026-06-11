// Level 1 — Carousel. Klein en knus: draaimolen met paardjes in vier
// vachtkleuren, koperen palen, gestreepte luifel en gouden details.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CellAtlas } from '../atlas.js';
import { createCleanableMaterial } from '../materials.js';
import { buildEnvironment, makeBooth, makeSign, makeFenceLine, FENCE_GREEN } from '../environment.js';
import { stripeTexture, woodTexture } from '../textures.js';

// Paardje in lokale ruimte: +X = kijkrichting. Onderdelen verdeeld over
// kleur-buckets zodat elk paard een eigen vacht/zadel kan hebben.
function buildHorse(atlas, buckets, coatKey, accentKey, angle, r, lift) {
  const coat = [];
  const dark = [];
  const accent = [];

  const body = new THREE.CapsuleGeometry(0.2, 0.52, 4, 10);
  body.rotateZ(Math.PI / 2);
  coat.push([body, 0, 0, 0]);

  const neck = new THREE.CylinderGeometry(0.1, 0.14, 0.36, 8);
  neck.rotateZ(-0.55);
  coat.push([neck, 0.3, 0.24, 0]);

  const head = new THREE.BoxGeometry(0.3, 0.14, 0.12);
  head.rotateZ(-0.45);
  coat.push([head, 0.48, 0.4, 0]);
  const muzzle = new THREE.BoxGeometry(0.12, 0.1, 0.1);
  muzzle.rotateZ(-0.45);
  coat.push([muzzle, 0.62, 0.33, 0]);

  for (const ez of [-0.045, 0.045]) {
    const ear = new THREE.ConeGeometry(0.03, 0.09, 5);
    coat.push([ear, 0.42, 0.52, ez]);
  }

  const mane = new THREE.BoxGeometry(0.34, 0.2, 0.05);
  mane.rotateZ(-0.55);
  dark.push([mane, 0.24, 0.32, 0]);

  const tail = new THREE.ConeGeometry(0.06, 0.4, 6);
  tail.rotateZ(2.5);
  dark.push([tail, -0.46, 0.02, 0]);

  // galop-pose: benen om-en-om naar voren/achteren
  const legPose = [[0.22, 0.09, 0.45], [0.24, -0.09, -0.25], [-0.24, 0.09, -0.4], [-0.22, -0.09, 0.3]];
  for (const [lx, lz, swing] of legPose) {
    const leg = new THREE.CylinderGeometry(0.05, 0.04, 0.5, 6);
    leg.rotateX(swing * 0.25);
    leg.rotateZ(swing);
    coat.push([leg, lx, -0.38, lz]);
    const hoof = new THREE.CylinderGeometry(0.05, 0.05, 0.06, 6);
    dark.push([hoof, lx + swing * 0.16, -0.62, lz]);
  }

  const blanket = new THREE.BoxGeometry(0.34, 0.05, 0.32);
  accent.push([blanket, -0.02, 0.18, 0]);
  const saddle = new THREE.BoxGeometry(0.26, 0.08, 0.24);
  accent.push([saddle, -0.02, 0.24, 0]);

  const cy = 1.55 + lift;
  const place = (list, bucket) => {
    for (const [geo, ox, oy, oz] of list) {
      atlas.add(geo);
      geo.translate(ox, oy, oz);
      geo.rotateY(angle + Math.PI / 2);
      geo.translate(Math.cos(angle) * r, cy, Math.sin(angle) * r);
      bucket.push(geo);
    }
  };
  place(coat, buckets[coatKey]);
  place(dark, buckets.dark);
  place(accent, buckets[accentKey]);
}

export const CAROUSEL = {
  id: 'carousel',
  name: 'Carousel',
  tagline: 'A cozy classic — painted horses, brass poles and a striped canopy.',

  build({ scene, dirt, cleanables }) {
    const group = new THREE.Group();
    // goud-decor is óók vies; elk stuk lift mee op het masker van zijn sectie
    const goldOn = (maskTexture) => createCleanableMaterial(
      { color: 0xc9a227, metalness: 0.85, roughness: 0.3 }, maskTexture);
    const addGold = (mesh, maskId) => {
      mesh.userData.maskId = maskId;
      mesh.castShadow = true;
      group.add(mesh);
      cleanables.push(mesh);
    };

    // ---------- platform (houten dek) ----------
    const platMask = dirt.createMask({
      id: 'cplatform', label: 'Platform', w: 512, h: 128,
      worldU: 30, worldV: 10, seed: 211, leafDensity: 2.0,
      lookup: () => new THREE.Vector3(0, 0.8, 3),
    });
    const platMat = createCleanableMaterial(
      { color: 0xffffff, map: woodTexture(), metalness: 0.05, roughness: 0.6 }, platMask.texture);
    const platform = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.8, 0.35, 24), platMat);
    platform.position.y = 0.55;
    platform.castShadow = platform.receiveShadow = true;
    platform.userData.maskId = 'cplatform';
    group.add(platform);
    cleanables.push(platform);

    const trim = new THREE.Mesh(new THREE.TorusGeometry(4.62, 0.05, 8, 32), goldOn(platMask.texture));
    trim.rotation.x = Math.PI / 2;
    trim.position.y = 0.74;
    addGold(trim, 'cplatform');

    // ---------- middenkolom met spiegels en gouden banden ----------
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

    for (const by of [1.1, 3.9]) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.04, 8, 18), goldOn(colMask.texture));
      band.rotation.x = Math.PI / 2;
      band.position.y = by;
      addGold(band, 'ccolumn');
    }
    const mirrorMat = new THREE.MeshStandardMaterial({ color: 0xcfe4ee, metalness: 1.0, roughness: 0.08 });
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.02, 1.2, 0.28), mirrorMat);
      mirror.position.set(Math.cos(a) * 0.43, 2.5, Math.sin(a) * 0.43);
      mirror.rotation.y = -a;
      group.add(mirror);
    }

    // ---------- gestreepte luifel + kroonring ----------
    const canopyMask = dirt.createMask({
      id: 'canopy', label: 'Canopy roof', w: 512, h: 256,
      worldU: 33, worldV: 6, seed: 227, leafDensity: 3.2,
      lookup: () => new THREE.Vector3(0, 5.2, 2),
    });
    const canopyMat = createCleanableMaterial(
      { color: 0xffffff, map: stripeTexture('#b03a30', '#e8e0cc', 16), metalness: 0.1, roughness: 0.5 },
      canopyMask.texture);
    const canopy = new THREE.Mesh(new THREE.ConeGeometry(5.5, 1.9, 18), canopyMat);
    canopy.position.y = 5.15;
    canopy.castShadow = true;
    canopy.userData.maskId = 'canopy';
    group.add(canopy);
    cleanables.push(canopy);

    const crown = new THREE.Mesh(new THREE.TorusGeometry(5.42, 0.09, 8, 36), goldOn(canopyMask.texture));
    crown.rotation.x = Math.PI / 2;
    crown.position.y = 4.26;
    addGold(crown, 'canopy');
    const topBall = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), goldOn(canopyMask.texture));
    topBall.position.y = 6.25;
    addGold(topBall, 'canopy');

    // ---------- paardjes & palen ----------
    const atlas = new CellAtlas(dirt, {
      id: 'horses', label: 'Horses & poles', cols: 4, rows: 2,
      texW: 512, texH: 256, cellWorld: 2.2, seed: 229, leafDensity: 0.7,
    });
    const mats = {
      white: createCleanableMaterial({ color: 0xf2ede4, metalness: 0.1, roughness: 0.3 }, atlas.mask.texture),
      chestnut: createCleanableMaterial({ color: 0x8a5a33, metalness: 0.1, roughness: 0.35 }, atlas.mask.texture),
      palomino: createCleanableMaterial({ color: 0xc8913a, metalness: 0.15, roughness: 0.3 }, atlas.mask.texture),
      black: createCleanableMaterial({ color: 0x35312e, metalness: 0.2, roughness: 0.3 }, atlas.mask.texture),
      grey: createCleanableMaterial({ color: 0xb9bdc4, metalness: 0.1, roughness: 0.3 }, atlas.mask.texture),
      dark: createCleanableMaterial({ color: 0x4a3526, metalness: 0.1, roughness: 0.5 }, atlas.mask.texture),
      accentRed: createCleanableMaterial({ color: 0xb03a30, metalness: 0.3, roughness: 0.35 }, atlas.mask.texture),
      accentBlue: createCleanableMaterial({ color: 0x2f5276, metalness: 0.3, roughness: 0.35 }, atlas.mask.texture),
      pole: createCleanableMaterial({ color: 0xc9a227, metalness: 0.85, roughness: 0.25 }, atlas.mask.texture),
    };
    const buckets = {
      white: [], chestnut: [], palomino: [], black: [], grey: [],
      dark: [], accentRed: [], accentBlue: [], pole: [],
    };
    const coats = ['white', 'chestnut', 'palomino', 'black', 'grey'];

    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const r = 3.3;
      const px = Math.cos(a) * r, pz = Math.sin(a) * r;
      atlas.claim(new THREE.Vector3(px, 1.6, pz));

      const pole = new THREE.CylinderGeometry(0.045, 0.045, 3.4, 8);
      atlas.add(pole);
      pole.translate(px, 2.45, pz);
      buckets.pole.push(pole);

      buildHorse(atlas, buckets, coats[k % 5], k % 2 ? 'accentRed' : 'accentBlue', a, r, (k % 2) * 0.35);
    }
    for (const [key, geos] of Object.entries(buckets)) {
      if (!geos.length) continue;
      const mesh = new THREE.Mesh(mergeGeometries(geos), mats[key]);
      mesh.castShadow = true;
      mesh.userData.maskId = 'horses';
      group.add(mesh);
      cleanables.push(mesh);
    }

    scene.add(group);
    scene.add(makeSign('Carousel', { x: -6, z: 9, rotY: Math.PI / 5 }));
    scene.add(makeBooth(dirt, cleanables, { x: 7.2, z: 8.5, rotY: -0.6 }));

    const fencePts = [];
    for (let k = 0; k <= 8; k++) {
      const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
      fencePts.push([Math.cos(a) * 7.2, Math.sin(a) * 7.2]);
    }
    scene.add(makeFenceLine(fencePts, 1.0, FENCE_GREEN()));

    const env = buildEnvironment(scene, {
      clearFn: (x, z) => x * x + z * z > 10 * 10 && !(x > -8 && x < 8 && z > 6 && z < 18),
      treeCount: 90,
      treeArea: { x0: -60, x1: 60, z0: -60, z1: 50 },
      fencePts: [[-30, 26], [-30, -30], [30, -30], [30, 26], [6, 26]],
      plaza: { x: 0, z: 11, w: 18, d: 9, queues: [[[-4, 9.5], [4, 9.5]], [[4, 12], [-4, 12]]] },
    });

    return { spawn: { pos: [0, 1.7, 12], yaw: 0, pitch: 0.02 }, envUpdate: env.update };
  },
};
