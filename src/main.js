// RideWash Simulator — bootstrap & game-loop.
// Eén level per pagina-load (?level=<id>); het levelregister bepaalt de
// volgorde en unlock-progressie.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { dirtVisionUniform, dirtTimeUniform } from './materials.js';
import { DirtSystem } from './dirt.js';
import { PlayerControls } from './player.js';
import { Washer } from './washer.js';
import { AudioFX } from './audio.js';
import { UI } from './ui.js';
import { LEVELS, markDone, isUnlocked } from './levels/index.js';

// ---------- Level kiezen ----------
const params = new URLSearchParams(location.search);
const requestedId = params.get('level') || LEVELS[0].id;
let levelIndex = Math.max(0, LEVELS.findIndex((l) => l.id === requestedId));
if (!isUnlocked(levelIndex)) levelIndex = 0;
const level = LEVELS[levelIndex];

// ---------- Renderer & scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.05, 600);
scene.add(camera);

// Realistische reflecties op metaal/lak (ipv platte kleuren)
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.45;

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- Level bouwen ----------
const dirt = new DirtSystem();
const cleanables = [];
const levelResult = level.build({ scene, dirt, cleanables });
const envUpdate = levelResult.envUpdate || null;

// ---------- Speler, spuit, audio, UI ----------
const player = new PlayerControls(camera, renderer.domElement);
const [sx, sy, sz] = levelResult.spawn.pos;
camera.position.set(sx, sy, sz);
player.yaw = levelResult.spawn.yaw;
player.pitch = levelResult.spawn.pitch;

// Oppervlakken waar het poppetje op kan staan (grond, plaza, perrons,
// walkway, rails — alles wat schoonmaakbaar is, is ook beklimbaar).
const walkSurfaces = [];
scene.traverse((m) => {
  if (m.isMesh && (m.userData.walkable || m.userData.maskId)) walkSurfaces.push(m);
});
player.setWalkSurfaces(walkSurfaces);

const washer = new Washer(camera, scene, dirt, cleanables);
const audio = new AudioFX();
const ui = new UI(dirt, level);

// ---------- Settings (persistent) ----------
const SETTINGS_KEY = 'rws_settings';
let settings = { sound: true, sensitivity: 1 };
try {
  settings = { ...settings, ...(JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}) };
} catch { /* default */ }
const saveSettings = () => localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
audio.setMuted(!settings.sound);
player.sensitivity = settings.sensitivity;
ui.initSettings(settings, {
  onSound: (on) => { settings.sound = on; audio.setMuted(!on); saveSettings(); },
  onSensitivity: (v) => { settings.sensitivity = v; player.sensitivity = v; saveSettings(); },
  onReset: () => { localStorage.removeItem('rws_done'); location.search = ''; },
});

dirt.onSectionClean = (label) => {
  ui.toast(`✨ ${label} clean!`);
  audio.sectionDing();
};
player.onModeChange = (mode) => {
  ui.toast(mode === 'lift' ? '🛗 Cherry picker ON — Space/C for up/down' : '🚶 Back on foot');
};

let started = false;
let won = false;
let playSeconds = 0;

ui.onStart(() => {
  audio.start();
  player.lock();
});
ui.onNext(() => {
  const next = LEVELS[levelIndex + 1];
  if (next) location.search = `?level=${next.id}`;
});
ui.onMenu(() => {
  location.search = '';
});
ui.onRestart(() => location.reload());

// Share-knop op het winscherm (URL bijwerken naar de itch.io-pagina na release)
const SHARE_URL = 'https://lifthill.studio';
ui.onShare(() => {
  const mins = Math.floor(playSeconds / 60);
  const secs = Math.round(playSeconds % 60);
  const text = `I pressure-washed the ${level.name} spotless in ${mins}m ${secs}s in RideWash Simulator 💦🎢 ` +
    `A free PowerWash-style prototype by @ThomasGeelens — try to beat my time!`;
  window.open(
    `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(SHARE_URL)}`,
    '_blank'
  );
});
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
  new THREE.CylinderGeometry(0.8, 0.8, 70, 12, 1, true),
  new THREE.MeshBasicMaterial({
    color: 0x3dff7f, transparent: true, opacity: 0.45,
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
    // PowerWash-stijl dirt vision: ál het resterende vuil licht op
    dirtVisionUniform.value = beaconActive ? 1 : 0;
    ui.toast(beaconActive ? '🔍 Dirt vision ON' : '🔍 Dirt vision OFF');
  }
});

function updateBeacon(dt) {
  if (!beaconActive) {
    beacon.visible = false;
    return;
  }
  beaconTimer -= dt;
  if (beaconTimer <= 0) {
    beaconTimer = 3;
    const spot = dirt.findDirtySpot(camera.position);
    if (spot) {
      beacon.position.set(spot.x, 35, spot.z);
      beacon.visible = true;
    } else {
      beacon.visible = false;
    }
  }
  beacon.material.opacity = 0.35 + 0.18 * Math.sin(performance.now() * 0.004);
}

// ---------- Game-loop ----------
const clock = new THREE.Clock();
let uiTimer = 0;
let wasSpraying = false;
let wasHitting = false;
let loadingHidden = false;

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);

  player.update(dt);
  if (envUpdate) envUpdate(dt);
  dirtTimeUniform.value += dt;
  const spraying = player.spraying && started && !won;
  washer.update(dt, spraying);

  if (spraying !== wasSpraying) {
    audio.setSpray(spraying);
    wasSpraying = spraying;
  }
  const hitting = spraying && !!washer.lastHit;
  if (hitting !== wasHitting) {
    ui.setSprayingHit(hitting);
    wasHitting = hitting;
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
        markDone(level.id);
        // best time bijhouden
        let isNewBest = false;
        try {
          const best = JSON.parse(localStorage.getItem('rws_best')) || {};
          if (!best[level.id] || playSeconds < best[level.id]) {
            best[level.id] = Math.round(playSeconds);
            localStorage.setItem('rws_best', JSON.stringify(best));
            isNewBest = true;
          }
        } catch { /* localStorage uit */ }
        audio.setSpray(false);
        audio.win();
        document.exitPointerLock();
        ui.showWin(playSeconds, washer.litersUsed, levelIndex + 1 < LEVELS.length, isNewBest);
      }
    }
  }

  renderer.render(scene, camera);

  if (!loadingHidden) {
    loadingHidden = true;
    const el = document.getElementById('loading');
    if (el) el.remove();
  }
}
tick();

// Debug-hook (alleen voor inspectie in de console; geen gameplay-effect)
window.__game = { scene, camera, dirt, player, washer, level, envUpdate };
