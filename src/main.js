// Ride Cleaner Simulator — bootstrap & game-loop.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { computeTrackData } from './layout.js';
import { DirtSystem } from './dirt.js';
import { buildTrack } from './track.js';
import { buildEnvironment } from './environment.js';
import { buildWalkway } from './walkway.js';
import { PlayerControls } from './player.js';
import { Washer } from './washer.js';
import { AudioFX } from './audio.js';
import { UI } from './ui.js';

// ---------- Renderer & scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.05, 600);
scene.add(camera);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- Wereld bouwen ----------
const dirt = new DirtSystem();
const trackData = computeTrackData();
const cleanables = [];

const track = buildTrack(trackData, dirt);
scene.add(track.group);
cleanables.push(...track.cleanables);

buildEnvironment(scene, dirt, cleanables, trackData);
scene.add(buildWalkway(trackData));

// ---------- Speler, spuit, audio, UI ----------
const player = new PlayerControls(camera, renderer.domElement);
const washer = new Washer(camera, scene, dirt, cleanables);
const audio = new AudioFX();
const ui = new UI(dirt);

dirt.onSectionClean = (label) => {
  ui.toast(label);
  audio.sectionDing();
};

let started = false;
let won = false;
let playSeconds = 0;

ui.onStart(() => {
  audio.start();
  player.lock();
});
ui.onRestart(() => location.reload());
player.onLockChange = (locked) => {
  if (won) return;
  if (locked) {
    started = true;
    ui.showPlaying();
  } else {
    ui.showPause();
  }
};

// ---------- Vuilzoeker-baken (F) ----------
const beacon = new THREE.Mesh(
  new THREE.CylinderGeometry(0.55, 0.55, 70, 12, 1, true),
  new THREE.MeshBasicMaterial({
    color: 0x47ff88, transparent: true, opacity: 0.3,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  })
);
beacon.visible = false;
scene.add(beacon);
let beaconActive = false;
let beaconTimer = 0;

document.addEventListener('keydown', (e) => {
  if (e.code === 'KeyF' && player.locked) {
    beaconActive = !beaconActive;
    beaconTimer = 0;
    beacon.visible = false;
  }
});

function updateBeacon(dt) {
  if (!beaconActive) {
    beacon.visible = false;
    return;
  }
  beaconTimer -= dt;
  if (beaconTimer <= 0) {
    beaconTimer = 4;
    const spot = dirt.findDirtySpot();
    if (spot) {
      beacon.position.set(spot.x, 35, spot.z);
      beacon.visible = true;
    } else {
      beacon.visible = false;
    }
  }
  beacon.material.opacity = 0.2 + 0.14 * Math.sin(performance.now() * 0.004);
}

// ---------- Game-loop ----------
const clock = new THREE.Clock();
let uiTimer = 0;
let wasSpraying = false;

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);

  player.update(dt);
  const spraying = player.spraying && started && !won;
  washer.update(dt, spraying);

  if (spraying !== wasSpraying) {
    audio.setSpray(spraying);
    wasSpraying = spraying;
  }

  if (started && !won) {
    playSeconds += dt;
    dirt.update();
    updateBeacon(dt);

    uiTimer -= dt;
    if (uiTimer <= 0) {
      uiTimer = 0.25;
      ui.refresh(playSeconds, washer.litersUsed);
      if (dirt.allDone()) {
        won = true;
        audio.setSpray(false);
        audio.win();
        document.exitPointerLock();
        ui.showWin(playSeconds, washer.litersUsed);
      }
    }
  }

  renderer.render(scene, camera);
}
tick();

// Debug-hook (alleen voor inspectie in de console; geen gameplay-effect)
window.__game = { scene, camera, dirt, player, washer, trackData };
