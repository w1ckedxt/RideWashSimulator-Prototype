// Gedeelde omgeving voor alle levels: lucht, wolken, licht, grond, bos,
// hekken, plaza en borden. Per level configureerbaar via buildEnvironment-opts.
// Geen gameplay-logica hier — alleen de wereld.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG } from './config.js';
import { createCleanableMaterial } from './materials.js';

function makeNoiseTexture(base, speckle, repeat) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 5200; i++) {
    const [r, g, b] = speckle(Math.random());
    ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeSky() {
  const geo = new THREE.SphereGeometry(440, 32, 20);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x4584bd) },
      bottomColor: { value: new THREE.Color(0xccdbe8) },
      sunDir: { value: new THREE.Vector3(0.5, 0.6, 0.4).normalize() },
      glowColor: { value: new THREE.Color(0xffd9a0) },
      glowStrength: { value: 0.35 },
    },
    vertexShader: `
      varying vec3 vWorld;
      void main() {
        vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      uniform vec3 sunDir;
      uniform vec3 glowColor;
      uniform float glowStrength;
      varying vec3 vWorld;
      void main() {
        vec3 dir = normalize(vWorld);
        float h = clamp(dir.y * 1.4 + 0.12, 0.0, 1.0);
        vec3 col = mix(bottomColor, topColor, pow(h, 0.8));
        // zachte zonnegloed + felle kern (mooie zonsondergangen)
        float d = max(dot(dir, sunDir), 0.0);
        col += glowColor * (pow(d, 9.0) * glowStrength + pow(d, 90.0) * 0.9);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  return new THREE.Mesh(geo, mat);
}

// Hogere-resolutie wolken: grote zachte stapelwolken van meerdere plukken.
function makeClouds() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const ctx = c.getContext('2d');
  for (let i = 0; i < 26; i++) {
    const x = 70 + Math.random() * 372, y = 95 + Math.random() * 90;
    const r = 28 + Math.random() * 55;
    const grad = ctx.createRadialGradient(x, y - r * 0.25, 4, x, y, r);
    grad.addColorStop(0, 'rgba(255,255,255,0.85)');
    grad.addColorStop(0.55, 'rgba(245,248,252,0.35)');
    grad.addColorStop(1, 'rgba(240,245,250,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 256);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const group = new THREE.Group();
  const sprites = [];
  for (let i = 0; i < 11; i++) {
    const mat = new THREE.SpriteMaterial({
      map: tex, transparent: true, opacity: 0.9, depthWrite: false, fog: false,
    });
    const spr = new THREE.Sprite(mat);
    const a = (i / 11) * Math.PI * 2 + Math.random();
    const dist = 180 + Math.random() * 150;
    spr.position.set(35 + Math.cos(a) * dist, 70 + Math.random() * 40, -25 + Math.sin(a) * dist);
    const s = 70 + Math.random() * 70;
    spr.scale.set(s, s * 0.5, 1);
    group.add(spr);
    sprites.push(spr);
  }
  return { group, sprites };
}

// Bergketen in de verte — silhouetten die in de nevel wegvallen.
function makeMountains() {
  const geos = [];
  const n = 18;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (i % 3) * 0.11;
    const dist = 330 + (i % 5) * 20;
    const h = 50 + ((i * 37) % 55);
    const r = 65 + ((i * 53) % 70);
    const cone = new THREE.ConeGeometry(r, h, 7);
    cone.translate(Math.cos(a) * dist + 35, h / 2 - 3, Math.sin(a) * dist - 25);
    geos.push(cone);
  }
  const mesh = new THREE.Mesh(
    mergeGeometries(geos),
    new THREE.MeshStandardMaterial({ color: 0x5d7488, roughness: 1, flatShading: true })
  );
  mesh.receiveShadow = false;
  return mesh;
}

// Bos: bomen via rejection sampling, nooit in/naast de attractie (clearFn).
function makeForest({ clearFn, count, area }) {
  const trunkGeos = [];
  const leafBuckets = [[], [], []];
  const leafMats = [
    new THREE.MeshStandardMaterial({ color: 0x2f5222, roughness: 0.9 }),
    new THREE.MeshStandardMaterial({ color: 0x3a5e26, roughness: 0.9 }),
    new THREE.MeshStandardMaterial({ color: 0x274421, roughness: 0.9 }),
  ];

  const placed = [];
  let tries = 0;
  while (placed.length < count && tries < count * 40) {
    tries++;
    const x = area.x0 + Math.random() * (area.x1 - area.x0);
    const z = area.z0 + Math.random() * (area.z1 - area.z0);
    if (!clearFn(x, z)) continue;
    let tooClose = false;
    for (const [px, pz] of placed) {
      const dx = px - x, dz = pz - z;
      if (dx * dx + dz * dz < 9) { tooClose = true; break; }
    }
    if (tooClose) continue;
    placed.push([x, z]);

    const bucket = leafBuckets[(Math.random() * 3) | 0];
    if (Math.random() < 0.45) {
      const h = 3 + Math.random() * 3;
      const trunk = new THREE.CylinderGeometry(0.16, 0.26, h, 6);
      trunk.translate(x, h / 2, z);
      trunkGeos.push(trunk);
      const r = 1.5 + Math.random() * 1.1;
      const cone1 = new THREE.ConeGeometry(r, r * 2.1, 8);
      cone1.translate(x, h + r * 0.8, z);
      const cone2 = new THREE.ConeGeometry(r * 0.7, r * 1.7, 8);
      cone2.translate(x, h + r * 1.9, z);
      bucket.push(cone1, cone2);
    } else {
      const h = 3.5 + Math.random() * 4;
      const trunk = new THREE.CylinderGeometry(0.2, 0.34, h, 6);
      trunk.translate(x, h / 2, z);
      trunkGeos.push(trunk);
      for (let k = 0; k < 3; k++) {
        const r = 1.4 + Math.random() * 1.5;
        const blob = new THREE.SphereGeometry(r, 7, 6);
        blob.translate(x + (Math.random() - 0.5) * 1.8, h + k * 1.0, z + (Math.random() - 0.5) * 1.8);
        bucket.push(blob);
      }
    }
  }

  const group = new THREE.Group();
  if (trunkGeos.length) {
    const trunks = new THREE.Mesh(
      mergeGeometries(trunkGeos),
      new THREE.MeshStandardMaterial({ color: 0x4f3722, roughness: 0.95 })
    );
    trunks.castShadow = true;
    group.add(trunks);
  }
  leafBuckets.forEach((geos, i) => {
    if (!geos.length) return;
    const m = new THREE.Mesh(mergeGeometries(geos), leafMats[i]);
    m.castShadow = true;
    group.add(m);
  });
  return group;
}

// Hekje: posten + 2 horizontale buizen langs een lijst hoekpunten [x,z].
export function makeFenceLine(points, height, mat) {
  const geos = [];
  for (let p = 0; p < points.length - 1; p++) {
    const a = new THREE.Vector3(points[p][0], 0, points[p][1]);
    const b = new THREE.Vector3(points[p + 1][0], 0, points[p + 1][1]);
    const len = a.distanceTo(b);
    const n = Math.max(1, Math.round(len / 3.5));
    for (let k = 0; k <= n; k++) {
      const pos = a.clone().lerp(b, k / n);
      const post = new THREE.CylinderGeometry(0.035, 0.035, height, 6);
      post.translate(pos.x, height / 2, pos.z);
      geos.push(post);
    }
    for (const hh of [height * 0.55, height * 0.97]) {
      const mid = a.clone().lerp(b, 0.5);
      const dir = b.clone().sub(a).normalize();
      const tube = new THREE.CylinderGeometry(0.028, 0.028, len, 6);
      tube.applyMatrix4(new THREE.Matrix4()
        .makeRotationFromQuaternion(new THREE.Quaternion()
          .setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir))
        .setPosition(mid.x, hh, mid.z));
      geos.push(tube);
    }
  }
  const mesh = new THREE.Mesh(mergeGeometries(geos), mat);
  mesh.castShadow = true;
  return mesh;
}

export const FENCE_GREEN = () =>
  new THREE.MeshStandardMaterial({ color: 0x2e4d3a, metalness: 0.6, roughness: 0.5 });

/** Echte beloopbare trap: treden + zijwangen + leuninkjes. */
export function makeStairs({ x, z, w = 1.6, h, steps = 4, rotY = 0 }) {
  const group = new THREE.Group();
  const stepMat = new THREE.MeshStandardMaterial({ color: 0x7d7872, roughness: 0.85 });
  const railMat = FENCE_GREEN();
  const stepH = h / steps;
  const stepD = 0.34;

  for (let k = 0; k < steps; k++) {
    const tread = new THREE.Mesh(new THREE.BoxGeometry(w, stepH, stepD), stepMat);
    tread.position.set(0, stepH * (k + 0.5), -k * stepD);
    tread.castShadow = tread.receiveShadow = true;
    tread.userData.walkable = true;
    group.add(tread);
  }
  for (const side of [-1, 1]) {
    for (let k = 0; k < steps; k++) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.85, 6), railMat);
      post.position.set(side * (w / 2 + 0.04), stepH * (k + 1) + 0.42, -k * stepD);
      group.add(post);
    }
    const len = Math.hypot(steps * stepD, h);
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, len, 6), railMat);
    rail.position.set(side * (w / 2 + 0.04), h / 2 + 0.88, -(steps - 1) * stepD / 2);
    rail.rotation.x = Math.PI / 2 - Math.atan2(h, steps * stepD);
    group.add(rail);
  }
  group.position.set(x, 0, z);
  group.rotation.y = rotY;
  return group;
}

export function makePlaza({ x, z, w, d, queues = [] }) {
  const group = new THREE.Group();
  const concrete = makeNoiseTexture('#9b958c', (r) => {
    const g = 120 + r * 60;
    return [g, g * 0.97, g * 0.92];
  }, Math.max(4, w / 4));
  const plaza = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshStandardMaterial({ map: concrete, roughness: 0.95 })
  );
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.set(x, 0.02, z);
  plaza.receiveShadow = true;
  plaza.userData.walkable = true;
  group.add(plaza);
  const fenceMat = FENCE_GREEN();
  for (const line of queues) group.add(makeFenceLine(line, 1.0, fenceMat));
  return group;
}

export function makeSign(dirt, cleanables, title, { x, z, rotY = 0 }) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 320;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#10243d';
  ctx.fillRect(0, 0, 1024, 320);
  ctx.strokeStyle = '#4dc3ff';
  ctx.lineWidth = 10;
  ctx.strokeRect(14, 14, 996, 292);
  ctx.fillStyle = '#ffd866';
  ctx.font = 'bold 96px "Avenir Next", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title.toUpperCase(), 512, 145);
  ctx.fillStyle = '#9be8ff';
  ctx.font = '50px "Avenir Next", sans-serif';
  ctx.fillText('— closed for deep cleaning —', 512, 240);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;

  const group = new THREE.Group();
  // het bord zit zó onder de smurrie dat je de naam pas leest na het spuiten
  const mask = dirt.createMask({
    id: 'sign', label: 'Ride sign', w: 256, h: 96,
    worldU: 7, worldV: 2.4, seed: 919, leafDensity: 2.4,
    lookup: () => new THREE.Vector3(x, 3.1, z),
  });
  const sideMat = createCleanableMaterial(
    { color: 0x0c1a2e, metalness: 0.2, roughness: 0.6 }, mask.texture);
  const faceMat = createCleanableMaterial(
    { color: 0xffffff, map: tex, metalness: 0.05, roughness: 0.55 }, mask.texture);
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(7, 2.2, 0.15),
    [sideMat, sideMat, sideMat, sideMat, faceMat, sideMat]
  );
  board.position.set(x, 3.1, z);
  board.rotation.y = rotY;
  board.castShadow = true;
  board.userData.maskId = 'sign';
  cleanables.push(board);
  group.add(board);
  const postMat = new THREE.MeshStandardMaterial({ color: 0x39424d, roughness: 0.5, metalness: 0.5 });
  for (const off of [-2.8, 2.8]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.4, 8), postMat);
    post.position.set(x + Math.cos(rotY) * off, 1.2, z - Math.sin(rotY) * off);
    group.add(post);
  }
  return group;
}

/** Operator-booth: een écht inloopbaar hokje — deuropening, doorkijkramen,
 *  bedieningspaneel met knoppen en een hendel binnen. Schoonmaakbaar. */
export function makeBooth(dirt, cleanables, { x, z, rotY = 0 }) {
  const group = new THREE.Group();
  const W = 3.0, D = 3.0, WALL_H = 2.5;
  const mask = dirt.createMask({
    id: 'booth', label: 'Operator booth', w: 256, h: 128,
    worldU: 12, worldV: 2.6, seed: 911, leafDensity: 1.8,
    lookup: () => new THREE.Vector3(x, 1.3, z),
  });
  const wallMat = createCleanableMaterial(
    { color: 0xd8cfbb, metalness: 0.1, roughness: 0.55 }, mask.texture);
  const roofMat = createCleanableMaterial(
    { color: 0x9e3528, metalness: 0.25, roughness: 0.5 }, mask.texture);

  const wallGeos = [];
  const addWall = (w, h, d, px, py, pz) => {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(px, py, pz);
    wallGeos.push(g);
  };
  // borstwering (onder, rondom) — deuropening van 1.1 m in de voorkant (+z)
  const SILL = 1.05;
  addWall(W, SILL, 0.1, 0, SILL / 2, -D / 2);                       // achter
  addWall(0.1, SILL, D, -W / 2, SILL / 2, 0);                       // links
  addWall(0.1, SILL, D, W / 2, SILL / 2, 0);                        // rechts
  const sidePanelW = (W - 1.1) / 2;
  const sidePanelX = 1.1 / 2 + sidePanelW / 2;
  addWall(sidePanelW, WALL_H, 0.1, -sidePanelX, WALL_H / 2, D / 2); // voor-links
  addWall(sidePanelW, WALL_H, 0.1, sidePanelX, WALL_H / 2, D / 2);  // voor-rechts
  // bovenlatei + hoekstijlen + bovenrand rondom
  addWall(W, 0.45, 0.1, 0, WALL_H - 0.225, -D / 2);
  addWall(0.1, 0.45, D, -W / 2, WALL_H - 0.225, 0);
  addWall(0.1, 0.45, D, W / 2, WALL_H - 0.225, 0);
  for (const [cx, cz] of [[-W / 2, -D / 2], [W / 2, -D / 2], [-W / 2, D / 2], [W / 2, D / 2]]) {
    addWall(0.14, WALL_H, 0.14, cx, WALL_H / 2, cz);
  }
  const walls = new THREE.Mesh(mergeGeometries(wallGeos), wallMat);
  walls.castShadow = walls.receiveShadow = true;
  walls.userData.maskId = 'booth';
  group.add(walls);
  cleanables.push(walls);

  // doorkijkramen (echt transparant) tussen borstwering en latei
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xa8c8da, metalness: 0.3, roughness: 0.08,
    transparent: true, opacity: 0.28, depthWrite: false,
  });
  const glassH = WALL_H - 0.45 - SILL;
  for (const [w, d, px, pz] of [
    [W - 0.2, 0.04, 0, -D / 2], [0.04, D - 0.2, -W / 2, 0], [0.04, D - 0.2, W / 2, 0],
  ]) {
    const pane = new THREE.Mesh(new THREE.BoxGeometry(w, glassH, d || 0.04), glassMat);
    pane.geometry.scale(1, 1, 1);
    pane.position.set(px, SILL + glassH / 2, pz);
    group.add(pane);
  }

  // vloer (beloopbaar) + dak
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(W, 0.12, D),
    new THREE.MeshStandardMaterial({ color: 0x6f6a64, roughness: 0.9 }));
  floor.position.y = 0.06;
  floor.receiveShadow = true;
  floor.userData.walkable = true;
  group.add(floor);

  const roof = new THREE.Mesh(new THREE.BoxGeometry(W + 0.6, 0.16, D + 0.6), roofMat);
  roof.position.y = WALL_H + 0.08;
  roof.castShadow = true;
  roof.userData.maskId = 'booth';
  group.add(roof);
  cleanables.push(roof);

  // bedieningspaneel binnen: lessenaar tegen de achterwand met knoppen + hendel
  const deskMat = new THREE.MeshStandardMaterial({ color: 0x2b2e33, metalness: 0.4, roughness: 0.5 });
  const desk = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.55), deskMat);
  desk.position.set(0, 1.02, -D / 2 + 0.45);
  desk.rotation.x = 0.25;
  group.add(desk);
  const deskFront = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.85, 0.1), deskMat);
  deskFront.position.set(0, 0.5, -D / 2 + 0.62);
  group.add(deskFront);
  const buttonColors = [0xc23028, 0x4d8a3a, 0xf0c43c, 0x2f5276, 0xc23028];
  buttonColors.forEach((c, i) => {
    const btn = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.045, 0.05, 8),
      new THREE.MeshStandardMaterial({ color: c, roughness: 0.3, emissive: c, emissiveIntensity: 0.25 }));
    btn.position.set(-0.5 + i * 0.25, 1.1, -D / 2 + 0.42);
    btn.rotation.x = 0.25;
    group.add(btn);
  });
  const lever = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.025, 0.4, 6),
    new THREE.MeshStandardMaterial({ color: 0x9aa3ad, metalness: 0.8, roughness: 0.3 }));
  lever.position.set(0.55, 1.25, -D / 2 + 0.45);
  lever.rotation.x = -0.5;
  group.add(lever);
  const knob = new THREE.Mesh(
    new THREE.SphereGeometry(0.06, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0xc23028, roughness: 0.35 }));
  knob.position.set(0.55, 1.44, -D / 2 + 0.55);
  group.add(knob);

  group.position.set(x, 0, z);
  group.rotation.y = rotY;
  return group;
}

/** Station van de stalen coaster (perron + dak zijn schoonmaakbaar). */
export function makeStation(dirt, cleanables) {
  const group = new THREE.Group();

  const platformMask = dirt.createMask({
    id: 'platform', label: 'Platform', w: 512, h: 128,
    worldU: 22, worldV: 4.5, seed: 83, leafDensity: 2.2,
    lookup: (u, v) => new THREE.Vector3(-3 + u * 22, 1.6, 1.0 + v * 4.5),
  });
  const platformMat = createCleanableMaterial(
    { color: CONFIG.colors.platform, metalness: 0.05, roughness: 0.6 }, platformMask.texture
  );
  const platform = new THREE.Mesh(new THREE.BoxGeometry(22, 0.5, 4.5), platformMat);
  platform.position.set(8, 1.25, 3.25);
  platform.castShadow = platform.receiveShadow = true;
  platform.userData.maskId = 'platform';
  group.add(platform);
  cleanables.push(platform);

  const colMat = new THREE.MeshStandardMaterial({ color: 0x39424d, metalness: 0.5, roughness: 0.45 });
  for (const [cx, cz] of [[-2, 4.9], [18, 4.9], [-2, -1.8], [18, -1.8]]) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 5.6, 10), colMat);
    col.position.set(cx, 2.8, cz);
    col.castShadow = true;
    group.add(col);
  }

  // stationsdak — ligt vol bladeren, dus ook schoonmaakbaar
  const roofMask = dirt.createMask({
    id: 'roof', label: 'Station roof', w: 512, h: 256,
    worldU: 23.5, worldV: 8.2, seed: 101, leafDensity: 3.0,
    lookup: (u, v) => new THREE.Vector3(-3.75 + u * 23.5, 6.0, -2.55 + v * 8.2),
  });
  const roofMat = createCleanableMaterial(
    { color: 0x1d3a5f, metalness: 0.3, roughness: 0.5 }, roofMask.texture
  );
  const roof = new THREE.Mesh(new THREE.BoxGeometry(23.5, 0.25, 8.2), roofMat);
  roof.position.set(8, 5.75, 1.55);
  roof.castShadow = true;
  roof.userData.maskId = 'roof';
  group.add(roof);
  cleanables.push(roof);

  // hekwerk: achterrand + zijkanten + airgates langs de baan (met instap-gaten)
  const fenceMat = FENCE_GREEN();
  const fenceLines = [
    [[-3, 5.4], [19, 5.4]],                 // achterrand
    [[-3, 1.05], [-3, 5.4]],                // zijkant west
    [[19, 1.05], [19, 5.4]],                // zijkant oost
    [[-3, 1.05], [0, 1.05]],                // airgates met gaten bij de wagons
    [[2, 1.05], [3.5, 1.05]],
    [[5.5, 1.05], [6.5, 1.05]],
    [[8.5, 1.05], [19, 1.05]],
  ];
  for (const line of fenceLines) {
    const fence = makeFenceLine(line, 1.0, fenceMat);
    fence.position.y = 1.5;
    group.add(fence);
  }

  // echte trapjes vanaf het plein het perron op
  group.add(makeStairs({ x: 0, z: 6.5, h: 1.5, steps: 4 }));
  group.add(makeStairs({ x: 16, z: 6.5, h: 1.5, steps: 4 }));

  return group;
}

/**
 * Gedeelde wereld voor elk level.
 * @param {object} o { clearFn(x,z)→bool, treeCount, treeArea{x0,x1,z0,z1},
 *                     fencePts [[x,z],...], plaza {x,z,w,d,queues} | null }
 */
// Kleurpaletten voor de dag/nacht-cyclus.
const DAY = {
  sun: 0xffe2ae, sunI: 2.25, top: 0x4a86b8, bot: 0xd9dcc6,
  fog: 0xc8cfbd, hemiI: 0.62, glow: 0xffe6b8, glowS: 0.3,
};
const SUNSET = {
  sun: 0xff9148, sunI: 1.5, top: 0x35507c, bot: 0xf0a45c,
  fog: 0xd9a06c, hemiI: 0.38, glow: 0xff8a3c, glowS: 1.1,
};
const NIGHT = {
  sun: 0x9db8e8, sunI: 0.45, top: 0x0a1428, bot: 0x1d2d4a,
  fog: 0x141f33, hemiI: 0.16, glow: 0xb8ccf0, glowS: 0.12,
};

function blendPalettes(wDay, wSunset, wNight) {
  const mix = (key) => new THREE.Color(0, 0, 0)
    .add(new THREE.Color(DAY[key]).multiplyScalar(wDay))
    .add(new THREE.Color(SUNSET[key]).multiplyScalar(wSunset))
    .add(new THREE.Color(NIGHT[key]).multiplyScalar(wNight));
  return {
    sun: mix('sun'), top: mix('top'), bot: mix('bot'), fog: mix('fog'), glow: mix('glow'),
    sunI: DAY.sunI * wDay + SUNSET.sunI * wSunset + NIGHT.sunI * wNight,
    hemiI: DAY.hemiI * wDay + SUNSET.hemiI * wSunset + NIGHT.hemiI * wNight,
    glowS: DAY.glowS * wDay + SUNSET.glowS * wSunset + NIGHT.glowS * wNight,
  };
}

export function buildEnvironment(scene, o) {
  scene.background = new THREE.Color(0xafc9de);
  scene.fog = new THREE.Fog(0xbcd0e0, 140, 420);
  const sky = makeSky();
  scene.add(sky);
  const clouds = makeClouds();
  scene.add(clouds.group);
  scene.add(makeMountains());

  const hemi = new THREE.HemisphereLight(0xb6cfe4, 0x46532f, 0.6);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffeacc, 2.25);
  sun.position.set(90, 120, 70);
  sun.target.position.set(40, 0, -28);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -120;
  sun.shadow.camera.right = 120;
  sun.shadow.camera.top = 100;
  sun.shadow.camera.bottom = -100;
  sun.shadow.camera.near = 20;
  sun.shadow.camera.far = 320;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.6;
  scene.add(sun, sun.target);

  const grass = makeNoiseTexture('#465633', (r) => {
    const g = 90 + r * 60;
    return [g * 0.75, g, g * 0.5];
  }, 60);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 900),
    new THREE.MeshStandardMaterial({ map: grass, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.userData.walkable = true;
  scene.add(ground);

  scene.add(makeForest({ clearFn: o.clearFn, count: o.treeCount, area: o.treeArea }));
  if (o.plaza) scene.add(makePlaza(o.plaza));
  if (o.fencePts) {
    scene.add(makeFenceLine(o.fencePts, 1.15,
      new THREE.MeshStandardMaterial({ color: 0x3a4046, metalness: 0.7, roughness: 0.45 })));
  }

  // ---------- vast daglicht ----------
  // Dag/nacht-cyclus staat uit (op verzoek permanent dag). De code blijft
  // staan zodat hij later zo weer aan kan: laat update() weer per frame
  // draaien met t += dt / 360.
  const t = 0.22; // vast moment: halverwege de ochtend
  const sunCenter = new THREE.Vector3(40, 0, -28);

  function update() {
    const theta = t * Math.PI * 2;
    const el = Math.sin(theta); // zonshoogte (-1..1); negatief = nacht (maan)

    const wDay = THREE.MathUtils.clamp((el - 0.06) / 0.3, 0, 1);
    const wNight = THREE.MathUtils.clamp((-el - 0.06) / 0.3, 0, 1);
    const wSunset = Math.max(0, 1 - wDay - wNight);
    const p = blendPalettes(wDay, wSunset, wNight);

    // zon (of 's nachts: maan, zelfde lamp aan de overkant)
    const elAbs = Math.max(Math.abs(el), 0.08);
    const az = Math.cos(theta) * (el >= 0 ? 1 : -1);
    sun.position.set(
      sunCenter.x + az * 150,
      elAbs * 130 + 12,
      sunCenter.z + 60 + Math.cos(theta * 0.5) * 20
    );
    sun.color.copy(p.sun);
    sun.intensity = p.sunI;
    hemi.intensity = p.hemiI;
    hemi.color.copy(p.top).lerp(new THREE.Color(0xffffff), 0.4);

    sky.material.uniforms.topColor.value.copy(p.top);
    sky.material.uniforms.bottomColor.value.copy(p.bot);
    sky.material.uniforms.glowColor.value.copy(p.glow);
    sky.material.uniforms.glowStrength.value = p.glowS;
    sky.material.uniforms.sunDir.value
      .copy(sun.position).sub(sunCenter).normalize();

    scene.fog.color.copy(p.fog);
    scene.background.copy(p.fog);

    // wolken kleuren mee met het licht
    const cloudTint = new THREE.Color(0xffffff).lerp(p.glow, wSunset * 0.55)
      .lerp(new THREE.Color(0x2a3a55), wNight * 0.8);
    for (const spr of clouds.sprites) spr.material.color.copy(cloudTint);
  }
  update();

  return { update: () => {} };
}
