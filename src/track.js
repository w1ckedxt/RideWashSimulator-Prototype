// Bouwt de complete coaster: twee buisrails, ruggengraat, dwarsbalken en
// steunpilaren. Alles in chunks (snelle raycasts) en alles schoonmaakbaar
// via het DirtSystem. UV-conventie: u loopt langs de baan / atlas-cellen,
// v rond de buis of langs de hoogte.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG } from './config.js';
import { createCleanableMaterial } from './materials.js';

const TAU = Math.PI * 2;

/** Buis langs de baan, opgeknipt in chunks. offsetFn(i) → middelpunt van de buis. */
function buildTubeChunks({ samples, N, offsetFn, radius, radialSegs, chunkSamples }) {
  const geos = [];
  const M = radialSegs;
  for (let i0 = 0; i0 < N; i0 += chunkSamples) {
    const i1 = Math.min(i0 + chunkSamples, N);
    const rows = i1 - i0 + 1;
    const positions = new Float32Array(rows * (M + 1) * 3);
    const normals = new Float32Array(rows * (M + 1) * 3);
    const uvs = new Float32Array(rows * (M + 1) * 2);
    const index = [];
    let p = 0, nrm = 0, t = 0;

    for (let i = i0; i <= i1; i++) {
      const s = samples[i % N];
      const center = offsetFn(i % N);
      for (let j = 0; j <= M; j++) {
        const a = (j / M) * TAU;
        const dx = Math.cos(a), dy = Math.sin(a);
        const nx = s.right.x * dx + s.up.x * dy;
        const ny = s.right.y * dx + s.up.y * dy;
        const nz = s.right.z * dx + s.up.z * dy;
        positions[p++] = center.x + nx * radius;
        positions[p++] = center.y + ny * radius;
        positions[p++] = center.z + nz * radius;
        normals[nrm++] = nx; normals[nrm++] = ny; normals[nrm++] = nz;
        uvs[t++] = i / N;
        uvs[t++] = j / M;
      }
    }
    for (let r = 0; r < rows - 1; r++) {
      for (let j = 0; j < M; j++) {
        const a = r * (M + 1) + j;
        const b = a + M + 1;
        index.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(index);
    geos.push(geo);
  }
  return geos;
}

function remapUV(geo, fn) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    const [u, v] = fn(uv.getX(i), uv.getY(i));
    uv.setXY(i, u, v);
  }
}

function addChunkMeshes(geos, material, maskId, group, cleanables) {
  for (const geo of geos) {
    const mesh = new THREE.Mesh(geo, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.maskId = maskId;
    group.add(mesh);
    cleanables.push(mesh);
  }
}

export function buildTrack(trackData, dirt) {
  const C = CONFIG.track;
  const S = CONFIG.supports;
  const { samples, length, ds } = trackData;
  const N = samples.length;
  const group = new THREE.Group();
  const cleanables = [];

  const railOffset = (side) => (i) => {
    const s = samples[i];
    return s.pos.clone().addScaledVector(s.right, side * C.gauge * 0.5);
  };
  const spineOffset = (i) => {
    const s = samples[i];
    return s.pos.clone().addScaledVector(s.up, -C.spineDrop);
  };
  const railLookup = (side) => (u) => railOffset(side)(Math.floor(u * N) % N);

  // ---------- Masks ----------
  const railMaskL = dirt.createMask({
    id: 'railL', label: 'Linkerrail', w: 8192, h: 64,
    worldU: length, worldV: TAU * C.railRadius,
    wrapU: true, wrapV: true, seed: 11, leafDensity: 1.0,
    lookup: railLookup(-1),
  });
  const railMaskR = dirt.createMask({
    id: 'railR', label: 'Rechterrail', w: 8192, h: 64,
    worldU: length, worldV: TAU * C.railRadius,
    wrapU: true, wrapV: true, seed: 23, leafDensity: 1.0,
    lookup: railLookup(1),
  });
  const spineMask = dirt.createMask({
    id: 'spine', label: 'Ruggengraat', w: 8192, h: 128,
    worldU: length, worldV: TAU * C.spineRadius,
    wrapU: true, wrapV: true, seed: 37, leafDensity: 1.4,
    lookup: (u) => spineOffset(Math.floor(u * N) % N),
  });

  // ---------- Rails & ruggengraat ----------
  const railMatL = createCleanableMaterial({ color: CONFIG.colors.rail }, railMaskL.texture);
  const railMatR = createCleanableMaterial({ color: CONFIG.colors.rail }, railMaskR.texture);
  const spineMat = createCleanableMaterial({ color: CONFIG.colors.spine }, spineMask.texture);

  const tubeOpts = { samples, N, chunkSamples: C.chunkSamples };
  addChunkMeshes(
    buildTubeChunks({ ...tubeOpts, offsetFn: railOffset(-1), radius: C.railRadius, radialSegs: C.railSegments }),
    railMatL, 'railL', group, cleanables
  );
  addChunkMeshes(
    buildTubeChunks({ ...tubeOpts, offsetFn: railOffset(1), radius: C.railRadius, radialSegs: C.railSegments }),
    railMatR, 'railR', group, cleanables
  );
  addChunkMeshes(
    buildTubeChunks({ ...tubeOpts, offsetFn: spineOffset, radius: C.spineRadius, radialSegs: C.spineSegments }),
    spineMat, 'spine', group, cleanables
  );

  // ---------- Dwarsbalken (ties) ----------
  const tieCount = Math.floor(length / C.tieSpacing);
  const tieCols = 32, tieRows = 16;
  const tiePositions = [];
  const tieMask = dirt.createMask({
    id: 'ties', label: 'Dwarsbalken', w: 2048, h: 128,
    worldU: tieCols * 1.6, worldV: tieRows * 0.6,
    cellsU: tieCols, cellsV: tieRows, seed: 53, leafDensity: 1.2,
    lookup: (u, v) => {
      const k = Math.min(tiePositions.length - 1,
        Math.floor(v * tieRows) * tieCols + Math.floor(u * tieCols));
      return tiePositions[Math.max(0, k)];
    },
  });
  const tieMat = createCleanableMaterial(
    { color: CONFIG.colors.tie, metalness: 0.45, roughness: 0.45 }, tieMask.texture
  );

  const tieGeos = [];
  for (let k = 0; k < tieCount && k < tieCols * tieRows; k++) {
    const i = Math.round((k * C.tieSpacing) / ds) % N;
    const s = samples[i];
    tiePositions.push(s.pos.clone());
    const basis = new THREE.Matrix4().makeBasis(s.right, s.up, s.T);
    const col = k % tieCols, row = Math.floor(k / tieCols);
    const intoCell = (u, v) => [(col + 0.05 + u * 0.9) / tieCols, (row + 0.05 + v * 0.9) / tieRows];

    const cross = new THREE.BoxGeometry(C.gauge + 0.34, 0.09, 0.2);
    remapUV(cross, intoCell);
    cross.applyMatrix4(basis.clone().setPosition(
      s.pos.clone().addScaledVector(s.up, -0.12)));
    tieGeos.push(cross);

    const strut = new THREE.BoxGeometry(0.16, C.spineDrop - 0.2, 0.3);
    remapUV(strut, intoCell);
    strut.applyMatrix4(basis.clone().setPosition(
      s.pos.clone().addScaledVector(s.up, -(C.spineDrop + 0.12) * 0.5)));
    tieGeos.push(strut);
  }
  // Merge in chunks van 40 ties (snelle raycast-culling via bounding spheres).
  for (let c = 0; c < tieGeos.length; c += 80) {
    const merged = mergeGeometries(tieGeos.slice(c, c + 80));
    const mesh = new THREE.Mesh(merged, tieMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.maskId = 'ties';
    group.add(mesh);
    cleanables.push(mesh);
  }

  // ---------- Steunpilaren ----------
  // Kandidaten om de ~spacing meter waar de baan hoog genoeg ligt; een steun
  // wijkt opzij uit (met diagonale arm) als er lager spoor onder hangt, zoals
  // bij echte helixen.
  const candidates = [];
  const step = Math.max(1, Math.round(S.spacing / ds));
  for (let i = 0; i < N; i += step) {
    const sc = spineOffset(i);
    if (sc.y < S.minSpineHeight) continue;
    let blocker = null;
    for (let j = 0; j < N; j += 4) {
      const arc = Math.min(Math.abs(i - j), N - Math.abs(i - j));
      if (arc < 24) continue;
      const pj = samples[j].pos;
      const dx = pj.x - sc.x, dz = pj.z - sc.z;
      if (dx * dx + dz * dz < S.clearance * S.clearance && pj.y < sc.y - 1.5) {
        blocker = pj;
        break;
      }
    }
    candidates.push({ i, spineCenter: sc, blocker });
  }
  let supports = candidates;
  if (supports.length > S.maxCount) {
    supports = [];
    for (let k = 0; k < S.maxCount; k++) {
      supports.push(candidates[Math.floor((k * candidates.length) / S.maxCount)]);
    }
  }

  const supportPositions = [];
  const supportMask = dirt.createMask({
    id: 'supports', label: 'Steunpilaren', w: 1024, h: 256,
    worldU: S.maxCount * TAU * S.radius, worldV: S.maxHeight,
    cellsU: S.maxCount, wrapU: true, seed: 67, leafDensity: 0.5,
    lookup: (u) => {
      const k = Math.min(supportPositions.length - 1, Math.floor(u * S.maxCount));
      return supportPositions[Math.max(0, k)];
    },
  });
  const supportMat = createCleanableMaterial(
    { color: CONFIG.colors.support, metalness: 0.3, roughness: 0.35 }, supportMask.texture
  );
  const concreteMat = new THREE.MeshStandardMaterial({ color: 0x8d8a84, roughness: 0.9 });

  const supportGeos = [];
  const footerGeos = [];
  const yAxis = new THREE.Vector3(0, 1, 0);
  supports.forEach((cand, col) => {
    const sc = cand.spineCenter;
    let bx = sc.x, bz = sc.z;
    let topY = sc.y - 0.15;
    if (cand.blocker) {
      const dir = new THREE.Vector3(sc.x - cand.blocker.x, 0, sc.z - cand.blocker.z).normalize();
      bx = sc.x + dir.x * S.sideOffset;
      bz = sc.z + dir.z * S.sideOffset;
      topY = sc.y - 1.0;
    }
    const intoCell = (u, v, hFrac) => [(col + 0.04 + u * 0.92) / S.maxCount, v * hFrac];

    const colGeo = new THREE.CylinderGeometry(S.radius * 0.92, S.radius * 1.07, topY, 10);
    remapUV(colGeo, (u, v) => intoCell(u, v, topY / S.maxHeight));
    colGeo.translate(bx, topY / 2, bz);
    supportGeos.push(colGeo);

    if (cand.blocker) {
      const a = new THREE.Vector3(bx, topY, bz);
      const dir = sc.clone().sub(a);
      const len = dir.length();
      const arm = new THREE.CylinderGeometry(0.14, 0.14, len, 8);
      remapUV(arm, (u, v) => intoCell(u, v, len / S.maxHeight));
      arm.applyMatrix4(new THREE.Matrix4()
        .makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(yAxis, dir.normalize()))
        .setPosition(a.clone().add(sc).multiplyScalar(0.5)));
      supportGeos.push(arm);
    }

    const footer = new THREE.BoxGeometry(0.95, 0.5, 0.95);
    footer.translate(bx, 0.25, bz);
    footerGeos.push(footer);

    supportPositions.push(new THREE.Vector3(bx, topY * 0.55, bz));
  });

  for (let c = 0; c < supportGeos.length; c += 10) {
    const merged = mergeGeometries(supportGeos.slice(c, c + 10));
    const mesh = new THREE.Mesh(merged, supportMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.maskId = 'supports';
    group.add(mesh);
    cleanables.push(mesh);
  }
  if (footerGeos.length) {
    const footers = new THREE.Mesh(mergeGeometries(footerGeos), concreteMat);
    footers.castShadow = true;
    footers.receiveShadow = true;
    group.add(footers);
  }

  return { group, cleanables };
}
