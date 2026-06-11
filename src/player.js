// First-person besturing: pointer lock + WASD, met hoogwerker-modus
// (Spatie/C voor omhoog/omlaag) zodat je overal bij de baan kunt.
import * as THREE from 'three';
import { CONFIG } from './config.js';

export class PlayerControls {
  constructor(camera, domElement) {
    this.camera = camera;
    this.dom = domElement;
    this.yaw = -0.35;            // kijkt richting station + lifthill
    this.pitch = 0.02;
    this.velocity = new THREE.Vector3();
    this.keys = new Set();
    this.locked = false;
    this.spraying = false;

    camera.rotation.order = 'YXZ';
    camera.position.set(16, CONFIG.player.eyeHeight, 14);

    document.addEventListener('keydown', (e) => this.keys.add(e.code));
    document.addEventListener('keyup', (e) => this.keys.delete(e.code));
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.yaw -= e.movementX * 0.0023;
      this.pitch -= e.movementY * 0.0023;
      this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
    });
    document.addEventListener('mousedown', (e) => {
      if (this.locked && e.button === 0) this.spraying = true;
    });
    document.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.spraying = false;
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.dom;
      if (!this.locked) this.spraying = false;
      if (this.onLockChange) this.onLockChange(this.locked);
    });
  }

  lock() {
    this.dom.requestPointerLock();
  }

  update(dt) {
    const P = CONFIG.player;
    const cam = this.camera;
    cam.rotation.set(this.pitch, this.yaw, 0);

    const wish = new THREE.Vector3();
    if (this.locked) {
      const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
      const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
      if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) wish.add(fwd);
      if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) wish.sub(fwd);
      if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) wish.add(right);
      if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) wish.sub(right);
      if (wish.lengthSq() > 0) wish.normalize();

      let speed = P.walkSpeed;
      if (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')) speed *= P.fastMultiplier;
      wish.multiplyScalar(speed);

      if (this.keys.has('Space')) wish.y += P.verticalSpeed;
      if (this.keys.has('KeyC')) wish.y -= P.verticalSpeed;
    }

    const k = 1 - Math.exp(-P.accel * dt);
    this.velocity.lerp(wish, k);
    cam.position.addScaledVector(this.velocity, dt);

    const b = P.bounds;
    cam.position.x = Math.max(b.minX, Math.min(b.maxX, cam.position.x));
    cam.position.z = Math.max(b.minZ, Math.min(b.maxZ, cam.position.z));
    cam.position.y = Math.max(b.minY, Math.min(b.maxY, cam.position.y));
  }
}
