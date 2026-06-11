// Omgeving: lucht, wolken, licht, grond, bos, plaza met wachtrij, parkhek,
// station (met schoonmaakbaar perron) en het parkbord.
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
  const geo = new THREE.SphereGeometry(440, 24, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x4f9fe8) },
      bottomColor: { value: new THREE.Color(0xd9ecfb) },
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
      varying vec3 vWorld;
      void main() {
        float h = clamp(normalize(vWorld).y * 1.4 + 0.12, 0.0, 1.0);
        gl_FragColor = vec4(mix(bottomColor, topColor, pow(h, 0.8)), 1.0);
      }`,
  });
  return new THREE.Mesh(geo, mat);
}

function makeClouds() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const ctx = c.getContext('2d');
  for (let i = 0; i < 14; i++) {
    const x = 40 + Math.random() * 176, y = 40 + Math.random() * 48;
    const r = 18 + Math.random() * 26;
    const grad = ctx.createRadialGradient(x, y, 2, x, y, r);
    grad.addColorStop(0, 'rgba(255,255,255,0.55)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 128);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const group = new THREE.Group();
  for (let i = 0; i < 9; i++) {
    const mat = new THREE.SpriteMaterial({
      map: tex, transparent: true, opacity: 0.85, depthWrite: false, fog: false,
    });
    const spr = new THREE.Sprite(mat);
    const a = (i / 9) * Math.PI * 2 + Math.random();
    const dist = 180 + Math.random() * 150;
    spr.position.set(35 + Math.cos(a) * dist, 65 + Math.random() * 35, -25 + Math.sin(a) * dist);
    const s = 55 + Math.random() * 55;
    spr.scale.set(s, s * 0.45, 1);
    group.add(spr);
  }
  return group;
}

// Bos: veel bomen, verspreid met rejection sampling zodat ze nooit in of
// vlak naast de baan staan. Twee soorten (loofboom + den), met kleurvariatie.
function makeForest(samples) {
  const trunkGeos = [];
  const leafBuckets = [[], [], []];
  const leafMats = [
    new THREE.MeshStandardMaterial({ color: 0x3f6b2a, roughness: 0.9 }),
    new THREE.MeshStandardMaterial({ color: 0x4d7a30, roughness: 0.9 }),
    new THREE.MeshStandardMaterial({ color: 0x32562b, roughness: 0.9 }),
  ];

  const clearOfTrack = (x, z) => {
    for (let i = 0; i < samples.length; i += 3) {
      const p = samples[i].pos;
      const dx = p.x - x, dz = p.z - z;
      if (dx * dx + dz * dz < 6.5 * 6.5) return false;
    }
    return true;
  };
  const inStationZone = (x, z) => x > -10 && x < 32 && z > -6 && z < 22;

  const placed = [];
  let tries = 0;
  while (placed.length < 120 && tries < 4000) {
    tries++;
    const x = -72 + Math.random() * 215;   // [-72, 143]
    const z = -93 + Math.random() * 130;   // [-93, 37]
    if (inStationZone(x, z) || !clearOfTrack(x, z)) continue;
    let tooClose = false;
    for (const [px, pz] of placed) {
      const dx = px - x, dz = pz - z;
      if (dx * dx + dz * dz < 9) { tooClose = true; break; }
    }
    if (tooClose) continue;
    placed.push([x, z]);

    const bucket = leafBuckets[(Math.random() * 3) | 0];
    if (Math.random() < 0.45) {
      // den: stam + 2 gestapelde kegels
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
      // loofboom: stam + 3 bollen
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
  const trunks = new THREE.Mesh(
    mergeGeometries(trunkGeos),
    new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 0.95 })
  );
  trunks.castShadow = true;
  group.add(trunks);
  leafBuckets.forEach((geos, i) => {
    if (!geos.length) return;
    const m = new THREE.Mesh(mergeGeometries(geos), leafMats[i]);
    m.castShadow = true;
    group.add(m);
  });
  return group;
}

// Hekje: posten + 2 horizontale buizen langs een lijst hoekpunten.
function makeFenceLine(points, height, mat) {
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

function makePlaza() {
  const group = new THREE.Group();
  const concrete = makeNoiseTexture('#9b958c', (r) => {
    const g = 120 + r * 60;
    return [g, g * 0.97, g * 0.92];
  }, 10);
  const plaza = new THREE.Mesh(
    new THREE.PlaneGeometry(42, 18),
    new THREE.MeshStandardMaterial({ map: concrete, roughness: 0.95 })
  );
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.set(10, 0.02, 13);
  plaza.receiveShadow = true;
  group.add(plaza);

  const fenceMat = new THREE.MeshStandardMaterial({ color: 0x2e4d3a, metalness: 0.6, roughness: 0.5 });
  // wachtrij-slingers op de plaza
  group.add(makeFenceLine([[0, 8], [16, 8]], 1.0, fenceMat));
  group.add(makeFenceLine([[16, 11], [0, 11]], 1.0, fenceMat));
  group.add(makeFenceLine([[0, 14], [16, 14]], 1.0, fenceMat));
  return group;
}

function makeSign() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 320;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#10243d';
  ctx.fillRect(0, 0, 1024, 320);
  ctx.strokeStyle = '#4dc3ff';
  ctx.lineWidth = 10;
  ctx.strokeRect(14, 14, 996, 292);
  ctx.fillStyle = '#ffd866';
  ctx.font = 'bold 110px "Avenir Next", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('STEEL COMET', 512, 150);
  ctx.fillStyle = '#9be8ff';
  ctx.font = '52px "Avenir Next", sans-serif';
  ctx.fillText('— gesloten voor grote schoonmaak —', 512, 245);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;

  const group = new THREE.Group();
  const sideMat = new THREE.MeshStandardMaterial({ color: 0x0c1a2e, roughness: 0.6 });
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(7, 2.2, 0.15),
    [sideMat, sideMat, sideMat, sideMat,
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }),
      sideMat]
  );
  board.position.set(26, 3.1, 13);
  board.rotation.y = -Math.PI / 2.4;
  const postMat = new THREE.MeshStandardMaterial({ color: 0x39424d, roughness: 0.5, metalness: 0.5 });
  for (const off of [-2.8, 2.8]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.4, 8), postMat);
    post.position.set(26 - Math.sin(-Math.PI / 2.4) * off * -1, 1.2, 13 + Math.cos(-Math.PI / 2.4) * off);
    group.add(post);
  }
  board.castShadow = true;
  group.add(board);
  return group;
}

function makeStation(dirt, cleanables) {
  const group = new THREE.Group();

  const platformMask = dirt.createMask({
    id: 'platform', label: 'Perron', w: 512, h: 128,
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
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(23.5, 0.25, 8.2),
    new THREE.MeshStandardMaterial({ color: 0x1d3a5f, metalness: 0.3, roughness: 0.5 })
  );
  roof.position.set(8, 5.75, 1.55);
  roof.castShadow = true;
  group.add(roof);

  // hekwerk op de achterrand van het perron
  const fenceMat = new THREE.MeshStandardMaterial({ color: 0x2e4d3a, metalness: 0.6, roughness: 0.5 });
  const fence = makeFenceLine([[-3, 5.4], [19, 5.4]], 1.0, fenceMat);
  fence.position.y = 1.5;
  group.add(fence);

  return group;
}

export function buildEnvironment(scene, dirt, cleanables, trackData) {
  scene.background = new THREE.Color(0xbcdcf5);
  scene.fog = new THREE.Fog(0xc9e2f6, 150, 430);
  scene.add(makeSky());
  scene.add(makeClouds());

  const hemi = new THREE.HemisphereLight(0xbfd9f2, 0x55663d, 0.85);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff2dd, 2.6);
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

  const grass = makeNoiseTexture('#5e7d43', (r) => {
    const g = 90 + r * 60;
    return [g * 0.75, g, g * 0.5];
  }, 60);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 900),
    new THREE.MeshStandardMaterial({ map: grass, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  scene.add(makeForest(trackData.samples));
  scene.add(makePlaza());
  scene.add(makeSign());
  scene.add(makeStation(dirt, cleanables));

  // parkhek rond het hele terrein
  const parkFenceMat = new THREE.MeshStandardMaterial({ color: 0x3a4046, metalness: 0.7, roughness: 0.45 });
  scene.add(makeFenceLine(
    [[-42, 24], [-42, -72], [126, -72], [126, 24], [30, 24]],
    1.15, parkFenceMat
  ));
}
