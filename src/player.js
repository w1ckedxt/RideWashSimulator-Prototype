// First-person besturing, PowerWash-stijl: een geaard poppetje met
// zwaartekracht, lopen, springen en op objecten kunnen staan (raycast naar
// beneden). Voor hoge plekken is er een hoogwerker-modus (V): vrij
// omhoog/omlaag zoals een cherry picker.
import * as THREE from 'three';
import { CONFIG } from './config.js';

const DOWN = new THREE.Vector3(0, -1, 0);

export class PlayerControls {
  constructor(camera, domElement) {
    this.camera = camera;
    this.dom = domElement;
    this.yaw = -0.35;
    this.pitch = 0.02;
    this.velocity = new THREE.Vector3();   // horizontaal (gesmoothed)
    this.vy = 0;                           // verticaal (zwaartekracht)
    this.onGround = false;
    this.mode = 'walk';                    // 'walk' | 'lift'
    this.walkSurfaces = [];                // meshes waar je op kunt staan
    this.keys = new Set();
    this.locked = false;
    this.spraying = false;
    this.downRay = new THREE.Raycaster();
    this.downRay.far = 80;
    this.onModeChange = null;
    this.sensitivity = 1;

    camera.rotation.order = 'YXZ';
    camera.position.set(16, CONFIG.player.eyeHeight, 14);

    document.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (e.code === 'KeyV' && this.locked) {
        this.mode = this.mode === 'walk' ? 'lift' : 'walk';
        this.vy = 0;
        if (this.onModeChange) this.onModeChange(this.mode);
      }
    });
    document.addEventListener('keyup', (e) => this.keys.delete(e.code));
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.yaw -= e.movementX * 0.0023 * this.sensitivity;
      this.pitch -= e.movementY * 0.0023 * this.sensitivity;
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

  setWalkSurfaces(meshes) {
    this.walkSurfaces = meshes;
  }

  /** Hoogste opstapbare oppervlak onder de camera (max. stap boven de voeten). */
  #groundBelow(feetY) {
    this.downRay.set(this.camera.position, DOWN);
    const hits = this.downRay.intersectObjects(this.walkSurfaces, false);
    for (const h of hits) {
      if (h.point.y <= feetY + CONFIG.player.stepHeight) return h.point.y;
    }
    return 0; // grasveld
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
    }

    const k = 1 - Math.exp(-P.accel * dt);
    this.velocity.lerp(wish, k);
    cam.position.x += this.velocity.x * dt;
    cam.position.z += this.velocity.z * dt;

    if (this.mode === 'lift') {
      // hoogwerker: vrij zweven, geen zwaartekracht
      let vyWish = 0;
      if (this.locked) {
        if (this.keys.has('Space')) vyWish += P.verticalSpeed;
        if (this.keys.has('KeyC')) vyWish -= P.verticalSpeed;
      }
      this.vy += (vyWish - this.vy) * k;
      cam.position.y += this.vy * dt;
      cam.position.y = Math.min(P.bounds.maxY, Math.max(P.eyeHeight, cam.position.y));
      this.onGround = false;
    } else {
      // geaard poppetje: zwaartekracht + springen + op objecten staan
      if (this.locked && this.keys.has('Space') && this.onGround) {
        this.vy = P.jumpSpeed;
        this.onGround = false;
      }
      this.vy -= P.gravity * dt;
      cam.position.y += this.vy * dt;

      const feetY = cam.position.y - P.eyeHeight;
      const groundY = this.#groundBelow(feetY + 0.3);
      if (feetY <= groundY + 0.02 && this.vy <= 0) {
        cam.position.y = groundY + P.eyeHeight;
        this.vy = 0;
        this.onGround = true;
      } else if (this.onGround && feetY < groundY + CONFIG.player.stepHeight && this.vy <= 0) {
        // trapje op: zachtjes omhoog snappen
        cam.position.y = groundY + P.eyeHeight;
        this.vy = 0;
      } else {
        this.onGround = false;
      }
    }

    const b = P.bounds;
    cam.position.x = Math.max(b.minX, Math.min(b.maxX, cam.position.x));
    cam.position.z = Math.max(b.minZ, Math.min(b.maxZ, cam.position.z));
  }
}
