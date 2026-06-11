// Level 4 — Wooden Coaster "Timber Howl". Out-and-back woodie: stalen
// strips op gelamineerde houtstapels, ledgers en een echt houten
// trestle-frame (bents met diagonalen). Alles vies, alles schoonmaakbaar.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { computeTrackData, v3 } from '../layout.js';
import { buildTubeChunks, addChunkMeshes } from '../track.js';
import { buildWalkway } from '../walkway.js';
import { buildTrain } from '../train.js';
import { CellAtlas } from '../atlas.js';
import { createCleanableMaterial } from '../materials.js';
import { buildEnvironment, makeBooth, makeSign, makeFenceLine, makeStairs, FENCE_GREEN } from '../environment.js';

const TAU = Math.PI * 2;
const GAUGE = 1.2;

function timberHowlPoints() {
  return [
    // station + lift
    v3(-2, 2, 0), v3(8, 2, 0), v3(18, 2, 0),
    v3(26, 4, 0), v3(36, 9, 0), v3(44, 13, 0), v3(50, 14.5, 0),
    // drop
    v3(57, 13, 0), v3(63, 7, -1.5), v3(68, 3.2, -5),
    // heenweg met camelbacks
    v3(74, 3, -10), v3(80, 8.5, -12), v3(86, 9.5, -12.5), v3(92, 4, -13),
    v3(98, 7.5, -13.5), v3(104, 5, -15),
    // turnaround
    v3(110, 5.5, -17.5), v3(113, 6, -22), v3(111, 5.5, -27), v3(105, 5, -30),
    // terugweg met bunny hops
    v3(96, 3.2, -29), v3(88, 7, -28.5), v3(80, 3.4, -28), v3(72, 6.5, -27.5),
    v3(64, 3.4, -27), v3(56, 6, -26.5), v3(48, 3.5, -26), v3(40, 5.5, -25.5),
    v3(30, 3, -25),
    // bocht terug naar het station
    v3(18, 3.2, -25), v3(8, 3.5, -23), v3(0, 4, -18), v3(-4, 3.5, -11), v3(-4, 2.5, -4),
  ];
}

export const WOODIE = {
  id: 'woodie',
  name: 'Wooden Coaster',
  tagline: 'Timber Howl — a creaking classic woodie, caked in years of dust.',

  build({ scene, dirt, cleanables }) {
    const trackData = computeTrackData(timberHowlPoints(), {
      maxBankDeg: 30, energyLossFactor: 0.85,
    });
    const { samples, length, ds } = trackData;
    const N = samples.length;
    const group = new THREE.Group();

    const railOffset = (side) => (i) => {
      const s = samples[i];
      return s.pos.clone().addScaledVector(s.right, side * GAUGE * 0.5);
    };
    const timberOffset = (side) => (i) =>
      railOffset(side)(i).addScaledVector(samples[i].up, -0.21);
    const railLookup = (side) => (u) => railOffset(side)(Math.floor(u * N) % N);

    // ---------- stalen strips ----------
    const tubeOpts = { samples, N, chunkSamples: 100 };
    for (const [side, id, label, seed] of [[-1, 'railL', 'Left rail', 11], [1, 'railR', 'Right rail', 23]]) {
      const mask = dirt.createMask({
        id, label, w: 4096, h: 32, worldU: length, worldV: TAU * 0.05,
        wrapU: true, wrapV: true, seed, leafDensity: 0.8,
        lookup: railLookup(side),
      });
      const mat = createCleanableMaterial(
        { color: 0x8c9298, metalness: 0.85, roughness: 0.35 }, mask.texture);
      addChunkMeshes(
        buildTubeChunks({ ...tubeOpts, offsetFn: railOffset(side), radius: 0.05, radialSegs: 8 }),
        mat, id, group, cleanables);
    }

    // ---------- houtstapels (gelamineerde balken onder de strips) ----------
    for (const [side, id, label, seed] of [[-1, 'timberL', 'Left timber', 37], [1, 'timberR', 'Right timber', 41]]) {
      const mask = dirt.createMask({
        id, label, w: 4096, h: 64, worldU: length, worldV: 1.1,
        wrapU: true, wrapV: true, seed, leafDensity: 2.0,
        lookup: (u) => timberOffset(side)(Math.floor(u * N) % N),
      });
      const mat = createCleanableMaterial(
        { color: 0x96703f, metalness: 0.03, roughness: 0.6 }, mask.texture);
      addChunkMeshes(
        buildTubeChunks({
          ...tubeOpts, offsetFn: timberOffset(side),
          radius: 0.2, radialSegs: 4, phase: Math.PI / 4,
        }),
        mat, id, group, cleanables);
    }

    // ---------- ledgers (dwarsplanken) ----------
    const tieCols = 32, tieRows = 16;
    const tiePositions = [];
    const tieMask = dirt.createMask({
      id: 'ties', label: 'Crossties', w: 2048, h: 128,
      worldU: tieCols * 1.8, worldV: tieRows * 0.5,
      cellsU: tieCols, cellsV: tieRows, seed: 53, leafDensity: 1.4,
      lookup: (u, v) => {
        const k = Math.min(tiePositions.length - 1,
          Math.floor(v * tieRows) * tieCols + Math.floor(u * tieCols));
        return tiePositions[Math.max(0, k)] || new THREE.Vector3();
      },
    });
    const tieMat = createCleanableMaterial(
      { color: 0x84603a, metalness: 0.03, roughness: 0.65 }, tieMask.texture);
    const tieGeos = [];
    const tieSpacing = 0.8;
    const tieCount = Math.min(Math.floor(length / tieSpacing), tieCols * tieRows);
    for (let k = 0; k < tieCount; k++) {
      const i = Math.round((k * tieSpacing) / ds) % N;
      const s = samples[i];
      tiePositions.push(s.pos.clone());
      const col = k % tieCols, row = Math.floor(k / tieCols);
      const tie = new THREE.BoxGeometry(GAUGE + 0.7, 0.07, 0.22);
      const uv = tie.attributes.uv;
      for (let q = 0; q < uv.count; q++) {
        uv.setXY(q,
          (col + 0.05 + uv.getX(q) * 0.9) / tieCols,
          (row + 0.05 + uv.getY(q) * 0.9) / tieRows);
      }
      tie.applyMatrix4(new THREE.Matrix4().makeBasis(s.right, s.up, s.T)
        .setPosition(s.pos.clone().addScaledVector(s.up, -0.46)));
      tieGeos.push(tie);
    }
    for (let c = 0; c < tieGeos.length; c += 80) {
      const mesh = new THREE.Mesh(mergeGeometries(tieGeos.slice(c, c + 80)), tieMat);
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.userData.maskId = 'ties';
      group.add(mesh);
      cleanables.push(mesh);
    }

    // ---------- trestle-bents (het houten frame) ----------
    const bentAtlas = new CellAtlas(dirt, {
      id: 'bents', label: 'Timber frame', cols: 16, rows: 8,
      texW: 1024, texH: 512, cellWorld: 3.2, seed: 61, leafDensity: 2.0,
    });
    const bentMat = createCleanableMaterial(
      { color: 0x9c7642, metalness: 0.02, roughness: 0.7 }, bentAtlas.mask.texture);
    const bentGeos = [];
    const bentStep = Math.max(1, Math.round(3.0 / ds));
    let bentCount = 0;
    let diagFlip = 1;
    for (let i = 0; i < N && bentCount < 16 * 8; i += bentStep) {
      const s = samples[i];
      const topY = s.pos.y - 0.5;
      if (topY < 1.0) continue;
      bentCount++;
      bentAtlas.claim(new THREE.Vector3(s.pos.x, topY / 2, s.pos.z));

      const posts = [];
      for (const side of [-1, 1]) {
        const base = s.pos.clone().addScaledVector(s.right, side * (GAUGE / 2 + 0.25));
        const post = new THREE.BoxGeometry(0.15, topY, 0.15);
        bentAtlas.add(post);
        post.translate(base.x, topY / 2, base.z);
        bentGeos.push(post);
        posts.push(new THREE.Vector3(base.x, 0, base.z));
      }
      // horizontale klossen + diagonaal
      const levels = Math.max(1, Math.floor(topY / 2.2));
      for (let L = 1; L <= levels; L++) {
        const hy = (L / (levels + 0.4)) * topY;
        const beam = new THREE.BoxGeometry(GAUGE + 0.8, 0.12, 0.12);
        bentAtlas.add(beam);
        beam.applyMatrix4(new THREE.Matrix4().makeBasis(s.right, s.up, s.T)
          .setPosition(new THREE.Vector3(
            (posts[0].x + posts[1].x) / 2, hy, (posts[0].z + posts[1].z) / 2)));
        bentGeos.push(beam);
      }
      const a = new THREE.Vector3(posts[0].x, diagFlip > 0 ? 0.2 : topY - 0.3, posts[0].z);
      const b = new THREE.Vector3(posts[1].x, diagFlip > 0 ? topY - 0.3 : 0.2, posts[1].z);
      diagFlip *= -1;
      const dir = b.clone().sub(a);
      const len = dir.length();
      const diag = new THREE.BoxGeometry(0.1, len, 0.1);
      bentAtlas.add(diag);
      diag.applyMatrix4(new THREE.Matrix4()
        .makeRotationFromQuaternion(new THREE.Quaternion()
          .setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()))
        .setPosition(a.clone().add(b).multiplyScalar(0.5)));
      bentGeos.push(diag);
    }
    for (let c = 0; c < bentGeos.length; c += 60) {
      const mesh = new THREE.Mesh(mergeGeometries(bentGeos.slice(c, c + 60)), bentMat);
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.userData.maskId = 'bents';
      group.add(mesh);
      cleanables.push(mesh);
    }

    // ---------- houten perron ----------
    const platMask = dirt.createMask({
      id: 'platform', label: 'Platform', w: 512, h: 128,
      worldU: 20, worldV: 4, seed: 83, leafDensity: 2.0,
      lookup: (u, v) => new THREE.Vector3(-2 + u * 20, 1.6, 1.0 + v * 4),
    });
    const platMat = createCleanableMaterial(
      { color: 0x86653c, metalness: 0.04, roughness: 0.65 }, platMask.texture);
    const platform = new THREE.Mesh(new THREE.BoxGeometry(20, 0.5, 4), platMat);
    platform.position.set(8, 1.25, 3);
    platform.castShadow = platform.receiveShadow = true;
    platform.userData.maskId = 'platform';
    group.add(platform);
    cleanables.push(platform);

    scene.add(group);
    scene.add(buildWalkway(trackData, dirt, cleanables));
    scene.add(buildTrain({
      trackData, dirt, cleanables,
      startMeters: 3, bodyColor: 0x4f3722, noseColor: 0x8a2e2e, seatColor: 0x2e2a26,
    }));
    scene.add(makeSign('Timber Howl', { x: 22, z: 12, rotY: -Math.PI / 2.6 }));
    scene.add(makeBooth(dirt, cleanables, { x: -5.5, z: 8.5, rotY: 0.5 }));

    // stationshekwerk: zijkanten + airgates met instap-gaten, plus trapjes
    const fenceMat = FENCE_GREEN();
    const fenceLines = [
      [[-2, 1.0], [-2, 4.9]],
      [[18, 1.0], [18, 4.9]],
      [[-2, 1.0], [0.5, 1.0]],
      [[2.5, 1.0], [4, 1.0]],
      [[6, 1.0], [7, 1.0]],
      [[9, 1.0], [18, 1.0]],
    ];
    for (const line of fenceLines) {
      const fence = makeFenceLine(line, 1.0, fenceMat);
      fence.position.y = 1.5;
      scene.add(fence);
    }
    scene.add(makeStairs({ x: 2, z: 6.1, h: 1.5, steps: 4 }));
    scene.add(makeStairs({ x: 14, z: 6.1, h: 1.5, steps: 4 }));
    scene.add(makeFenceLine([[-3, 5.2], [18, 5.2]], 1.0, FENCE_GREEN()).translateY(1.5));

    const env = buildEnvironment(scene, {
      clearFn: (x, z) => {
        for (let i = 0; i < samples.length; i += 3) {
          const p = samples[i].pos;
          const dx = p.x - x, dz = p.z - z;
          if (dx * dx + dz * dz < 5.5 * 5.5) return false;
        }
        return !(x > -8 && x < 28 && z > -4 && z < 20);
      },
      treeCount: 110,
      treeArea: { x0: -40, x1: 135, z0: -65, z1: 35 },
      fencePts: [[-26, 22], [-26, -50], [128, -50], [128, 22], [26, 22]],
      plaza: { x: 8, z: 12, w: 34, d: 14, queues: [[[0, 9], [14, 9]], [[14, 12], [0, 12]]] },
    });

    return { spawn: { pos: [14, 1.7, 13], yaw: -0.3, pitch: 0.04 }, envUpdate: env.update };
  },
};
