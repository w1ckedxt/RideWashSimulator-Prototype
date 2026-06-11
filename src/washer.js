// De hogedrukspuit: pistoolmodel aan de camera, raycast-spray die het
// DirtSystem aanstuurt, en twee particle-systemen (straal + mist).
import * as THREE from 'three';
import { CONFIG } from './config.js';

const JET_COUNT = 700;
const MIST_COUNT = 350;

function makeDropletSprite() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255,255,255,0.95)');
  grad.addColorStop(0.4, 'rgba(210,235,255,0.55)');
  grad.addColorStop(1, 'rgba(190,225,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

class ParticlePool {
  constructor(count, material) {
    this.count = count;
    this.positions = new Float32Array(count * 3);
    this.velocities = new Float32Array(count * 3);
    this.life = new Float32Array(count);
    this.maxDist = new Float32Array(count);
    this.origin = new Float32Array(count * 3);
    this.positions.fill(-9999);
    this.cursor = 0;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6); // nooit gecullen
    this.points = new THREE.Points(geo, material);
    this.points.frustumCulled = false;
  }

  spawn(pos, vel, life, maxDist = Infinity) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.count;
    this.positions.set([pos.x, pos.y, pos.z], i * 3);
    this.origin.set([pos.x, pos.y, pos.z], i * 3);
    this.velocities.set([vel.x, vel.y, vel.z], i * 3);
    this.life[i] = life;
    this.maxDist[i] = maxDist;
  }

  /** @param {(i:number)=>void} onDeath aangeroepen bij afstands-dood */
  update(dt, gravity, onDeath) {
    const p = this.positions, v = this.velocities;
    for (let i = 0; i < this.count; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const i3 = i * 3;
      p[i3] += v[i3] * dt;
      p[i3 + 1] += v[i3 + 1] * dt;
      p[i3 + 2] += v[i3 + 2] * dt;
      v[i3 + 1] -= gravity * dt;

      const dx = p[i3] - this.origin[i3];
      const dy = p[i3 + 1] - this.origin[i3 + 1];
      const dz = p[i3 + 2] - this.origin[i3 + 2];
      const reached = dx * dx + dy * dy + dz * dz >= this.maxDist[i] * this.maxDist[i];
      if (this.life[i] <= 0 || reached) {
        if (reached && onDeath) onDeath(i);
        this.life[i] = 0;
        p[i3 + 1] = -9999;
      }
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }
}

function buildGunModel() {
  const gun = new THREE.Group();
  const yellow = new THREE.MeshStandardMaterial({ color: 0xf2b705, roughness: 0.5 });
  const black = new THREE.MeshStandardMaterial({ color: 0x1d1f24, roughness: 0.55 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x9aa3ad, metalness: 0.85, roughness: 0.3 });

  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.16, 0.07), black);
  handle.position.set(0, -0.1, 0.1);
  handle.rotation.x = 0.25;
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.09, 0.3), yellow);
  const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.06, 0.025), black);
  trigger.position.set(0, -0.06, 0.05);
  const lance = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.55, 8), steel);
  lance.rotation.x = Math.PI / 2;
  lance.position.set(0, 0.01, -0.42);
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.016, 0.07, 8), black);
  nozzle.rotation.x = Math.PI / 2;
  nozzle.position.set(0, 0.01, -0.72);
  gun.add(handle, body, trigger, lance, nozzle);

  const tip = new THREE.Object3D();
  tip.position.set(0, 0.01, -0.76);
  gun.add(tip);
  return { gun, tip };
}

export class Washer {
  constructor(camera, scene, dirt, cleanables) {
    this.camera = camera;
    this.dirt = dirt;
    this.cleanables = cleanables;
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = CONFIG.spray.range + 2;
    this.litersUsed = 0;
    this.time = 0;

    const { gun, tip } = buildGunModel();
    this.gun = gun;
    this.tip = tip;
    gun.position.set(0.33, -0.3, -0.45);
    camera.add(gun);

    const sprite = makeDropletSprite();
    this.jet = new ParticlePool(JET_COUNT, new THREE.PointsMaterial({
      size: 0.075, map: sprite, transparent: true, opacity: 0.85,
      depthWrite: false, color: 0xdaf0ff, blending: THREE.AdditiveBlending,
    }));
    this.mist = new ParticlePool(MIST_COUNT, new THREE.PointsMaterial({
      size: 0.5, map: sprite, transparent: true, opacity: 0.22,
      depthWrite: false, color: 0xe8f5ff,
    }));
    scene.add(this.jet.points, this.mist.points);

    this.lastHit = null;
  }

  update(dt, spraying) {
    const S = CONFIG.spray;
    this.time += dt;

    // subtiele gun-sway + terugslag tijdens sprayen
    const sway = Math.sin(this.time * 2.1) * 0.004;
    this.gun.position.set(
      0.33 + sway,
      -0.3 + Math.cos(this.time * 1.7) * 0.004 + (spraying ? Math.sin(this.time * 55) * 0.0035 : 0),
      -0.45 + (spraying ? 0.012 : 0)
    );

    this.lastHit = null;
    if (spraying) {
      this.litersUsed += S.flowLitersPerSec * dt;
      this.#sprayRays(dt);
      this.#emitJet(dt);
    }

    this.jet.update(dt, 5.5, (i) => this.#jetToMist(i));
    this.mist.update(dt, 1.2, null);
  }

  #sprayRays(dt) {
    const S = CONFIG.spray;
    const spread = (S.coneSpreadDeg * Math.PI) / 180;
    let nearest = null;

    for (let r = 0; r < S.raysPerFrame; r++) {
      const jitterX = (Math.random() - 0.5) * 2 * spread;
      const jitterY = (Math.random() - 0.5) * 2 * spread;
      this.raycaster.setFromCamera({ x: jitterX * 8, y: jitterY * 8 }, this.camera);
      const hits = this.raycaster.intersectObjects(this.cleanables, false);
      if (!hits.length) continue;
      const hit = hits[0];
      if (hit.distance > S.range || !hit.uv) continue;
      if (!nearest || hit.distance < nearest.distance) nearest = hit;

      const radius = S.baseRadius + S.radiusPerMeter * hit.distance;
      const strength = S.cleanRate * dt * (1 - S.distanceFalloff * (hit.distance / S.range));
      this.dirt.erase(hit.object.userData.maskId, hit.uv.x, hit.uv.y, radius, strength);
    }
    this.lastHit = nearest;
  }

  #emitJet(dt) {
    const S = CONFIG.spray;
    const tipPos = new THREE.Vector3();
    this.tip.getWorldPosition(tipPos);

    const targetDist = this.lastHit ? this.lastHit.distance : S.range;
    const camDir = new THREE.Vector3();
    this.camera.getWorldDirection(camDir);
    const target = this.camera.position.clone().addScaledVector(camDir, targetDist);
    const dir = target.sub(tipPos);
    const dist = dir.length();
    dir.normalize();

    const n = Math.min(40, Math.ceil(dt * 950));
    for (let k = 0; k < n; k++) {
      const vel = dir.clone()
        .addScaledVector(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5), 0.035)
        .multiplyScalar(30 + Math.random() * 4);
      this.jet.spawn(tipPos, vel, 0.8, dist * (0.97 + Math.random() * 0.06));
    }
  }

  #jetToMist(i) {
    if (!this.lastHit) return;
    const i3 = i * 3;
    const p = new THREE.Vector3(
      this.jet.positions[i3], this.jet.positions[i3 + 1], this.jet.positions[i3 + 2]
    );
    const normal = this.lastHit.face ? this.lastHit.face.normal : new THREE.Vector3(0, 1, 0);
    const vel = new THREE.Vector3(
      (Math.random() - 0.5) * 1.6 + normal.x * 1.2,
      Math.random() * 1.2 + normal.y * 1.2,
      (Math.random() - 0.5) * 1.6 + normal.z * 1.2
    );
    this.mist.spawn(p, vel, 0.35 + Math.random() * 0.3);
  }
}
