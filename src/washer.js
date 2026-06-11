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
  // Parkonderhoud-vibe: teal body met oranje accenten, RWS-logo's, manometer
  // en een slang die naar je heup loopt — alsof hij echt uit het magazijn komt.
  const gun = new THREE.Group();
  const teal = new THREE.MeshStandardMaterial({ color: 0x44706a, roughness: 0.45, metalness: 0.2 });
  const orange = new THREE.MeshStandardMaterial({ color: 0xe08a35, roughness: 0.4, metalness: 0.25 });
  const black = new THREE.MeshStandardMaterial({ color: 0x1d1f24, roughness: 0.55 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x9aa3ad, metalness: 0.85, roughness: 0.3 });

  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.16, 0.07), black);
  handle.position.set(0, -0.1, 0.1);
  handle.rotation.x = 0.25;
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.064, 0.095, 0.3), teal);
  const capF = new THREE.Mesh(new THREE.BoxGeometry(0.066, 0.097, 0.05), orange);
  capF.position.z = -0.13;
  const capB = new THREE.Mesh(new THREE.BoxGeometry(0.066, 0.097, 0.05), orange);
  capB.position.z = 0.13;
  const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.06, 0.025), black);
  trigger.position.set(0, -0.06, 0.05);
  const lance = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.55, 8), steel);
  lance.rotation.x = Math.PI / 2;
  lance.position.set(0, 0.01, -0.42);
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.016, 0.07, 8), black);
  nozzle.rotation.x = Math.PI / 2;
  nozzle.position.set(0, 0.01, -0.72);
  gun.add(handle, body, capF, capB, trigger, lance, nozzle);

  // manometer bovenop (wijzertje op druk)
  const gauge = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.018, 12), black);
  gauge.position.set(0, 0.058, -0.06);
  const gaugeFace = new THREE.Mesh(
    new THREE.CylinderGeometry(0.021, 0.021, 0.02, 12),
    new THREE.MeshStandardMaterial({ color: 0xf3e3c2, roughness: 0.3 }));
  gaugeFace.position.set(0, 0.059, -0.06);
  const needle = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.002, 0.016),
    new THREE.MeshStandardMaterial({ color: 0xc23028 }));
  needle.position.set(0, 0.07, -0.065);
  needle.rotation.y = 0.6;
  gun.add(gauge, gaugeFace, needle);

  // slang naar beneden (uit beeld richting heup)
  const hoseCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.17, 0.12),
    new THREE.Vector3(0.03, -0.3, 0.22),
    new THREE.Vector3(0.1, -0.46, 0.3),
    new THREE.Vector3(0.22, -0.6, 0.34),
  ]);
  const hose = new THREE.Mesh(
    new THREE.TubeGeometry(hoseCurve, 10, 0.013, 8),
    new THREE.MeshStandardMaterial({ color: 0x2a2d31, roughness: 0.7 }));
  gun.add(hose);

  // groot, goed leesbaar RWS-logo op beide flanken + bovenop
  const c = document.createElement('canvas');
  c.width = 256; c.height = 96;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#e08a35';
  ctx.fillRect(0, 0, 256, 96);
  ctx.strokeStyle = '#3a2a1d';
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, 248, 88);
  ctx.fillStyle = '#3a2a1d';
  ctx.font = '900 64px "Avenir Next", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('RWS', 128, 70);
  const labelTex = new THREE.CanvasTexture(c);
  labelTex.colorSpace = THREE.SRGBColorSpace;
  const labelMat = new THREE.MeshStandardMaterial({ map: labelTex, roughness: 0.4 });
  for (const sideX of [-0.0335, 0.0335]) {
    const label = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.068), labelMat);
    label.position.set(sideX, 0.005, 0.0);
    label.rotation.y = sideX > 0 ? Math.PI / 2 : -Math.PI / 2;
    gun.add(label);
  }
  const topLabel = new THREE.Mesh(new THREE.PlaneGeometry(0.055, 0.022), labelMat);
  topLabel.position.set(0, 0.049, 0.08);
  topLabel.rotation.x = -Math.PI / 2;
  gun.add(topLabel);

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
    this.prevStroke = null;
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
    } else {
      this.prevStroke = null;
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
      this.raycaster.setFromCamera({ x: jitterX * 3, y: jitterY * 3 }, this.camera);
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

    // Vloeiende streek: vul het pad tussen het vorige en huidige raakpunt op,
    // zodat snelle bewegingen geen stippellijn maar een mooie veeg geven.
    if (nearest) {
      const maskId = nearest.object.userData.maskId;
      const stroke = {
        maskId, u: nearest.uv.x, v: nearest.uv.y, point: nearest.point.clone(),
      };
      const prev = this.prevStroke;
      if (prev && prev.maskId === maskId) {
        const dist = nearest.point.distanceTo(prev.point);
        const radius = S.baseRadius + S.radiusPerMeter * nearest.distance;
        const du = stroke.u - prev.u;
        const dv = stroke.v - prev.v;
        // geen interpolatie over een uv-seam heen
        if (dist > radius * 0.4 && dist < 4 && Math.abs(du) < 0.45 && Math.abs(dv) < 0.45) {
          const steps = Math.min(8, Math.ceil(dist / (radius * 0.55)));
          const strength = S.cleanRate * dt * (1 - S.distanceFalloff * (nearest.distance / S.range));
          for (let k = 1; k < steps; k++) {
            const f = k / steps;
            this.dirt.erase(maskId, prev.u + du * f, prev.v + dv * f, radius, strength);
          }
        }
      }
      this.prevStroke = stroke;
    } else {
      this.prevStroke = null;
    }
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
