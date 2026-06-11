// Baan-wiskunde, herbruikbaar voor elke coaster: gesloten centripetal
// Catmull-Rom door controlepunten + frames met realistische banking.
// Banking volgt de "gevoelde verticaal" (zwaartekracht + centripetale kracht),
// precies zoals echte coasters gebankt worden — daardoor zijn alle bochten
// automatisch zo soepel mogelijk.
import * as THREE from 'three';
import { CONFIG } from './config.js';

export const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const smooth01 = (t) => t * t * (3 - 2 * t);

// Layout van de Steel Comet: station → kettinglift (26m) → eerste drop met
// bocht → turnaround → airtime-heuvel → dalende helix → remstraat.
export function steelCometPoints() {
  const pts = [
    // Station (heading +X, z = 0)
    v3(-2, 2, 0), v3(8, 2, 0), v3(18, 2, 0),
    v3(28, 3, 0),
    // Kettinglift (~22°)
    v3(40, 7.5, 0), v3(52, 12.5, 0), v3(64, 17.5, 0), v3(76, 22.5, 0),
    // Top
    v3(85, 25.6, 0), v3(93, 24.8, -1.5),
    // Eerste drop, draait naar rechts
    v3(101, 19, -6), v3(107, 10, -13), v3(110.5, 4.2, -22),
    // Dal
    v3(110.5, 3.2, -31),
    // Omhoog de turnaround in (gebankte 180°)
    v3(106.5, 9, -42), v3(98.5, 13.5, -50), v3(87, 15.2, -55),
    v3(75, 13.2, -54.5), v3(66, 9.5, -47.5),
    // Dip en airtime-heuvel op de terugweg
    v3(56, 5.2, -42.5), v3(46, 10.8, -40.5), v3(38, 11.6, -40.2),
    v3(27, 6.2, -41),
    // Aanloop naar de helix
    v3(12, 6.8, -39), v3(-2, 7.4, -33.5),
  ];

  // Dalende helix: 510° rechtsom, r = 13, eindigt op z = 0 richting +X
  // zodat hij naadloos in de remstraat naar het station overloopt.
  const cx = -20, cz = -13, r = 13;
  const aStart = -120, aEnd = -630, step = -30;
  const yStart = 7.2, yEnd = 2.6;
  for (let a = aStart; a >= aEnd; a += step) {
    const t = (a - aStart) / (aEnd - aStart);
    const rad = (a * Math.PI) / 180;
    pts.push(v3(cx + r * Math.cos(rad), yStart + (yEnd - yStart) * smooth01(t), cz + r * Math.sin(rad)));
  }

  // Remstraat terug naar het station (gesloten lus sluit op het eerste punt)
  pts.push(v3(-12, 2.3, 0));
  return pts;
}

// Box-blur over een gesloten array van Vector3 (per component).
function smoothClosedVec3(arr, window, passes) {
  const n = arr.length;
  for (let p = 0; p < passes; p++) {
    const src = arr.map((v) => v.clone());
    for (let i = 0; i < n; i++) {
      const acc = new THREE.Vector3();
      for (let k = -window; k <= window; k++) {
        acc.add(src[(i + k + n) % n]);
      }
      arr[i].copy(acc.multiplyScalar(1 / (2 * window + 1)));
    }
  }
}

export function computeTrackData(points = steelCometPoints(), opts = {}) {
  const C = { ...CONFIG.track, ...opts };
  const g = CONFIG.world.gravity;

  const curve = new THREE.CatmullRomCurve3(points, true, 'centripetal');
  curve.arcLengthDivisions = 3000;
  const length = curve.getLength();
  const N = Math.round(length / C.sampleSpacing);
  const ds = length / N;

  // Posities + tangenten, arc-length-uniform gesampled.
  const pos = [], tan = [];
  for (let i = 0; i < N; i++) {
    const t = i / N;
    pos.push(curve.getPointAt(t));
    tan.push(curve.getTangentAt(t).normalize());
  }

  // Snelheidsprofiel via energiebehoud (+ globale frictiefactor).
  let maxY = -Infinity;
  for (const p of pos) maxY = Math.max(maxY, p.y);
  const v2 = pos.map((p) =>
    Math.max(2 * g * (maxY + 1.5 - p.y) * C.energyLossFactor, C.minSpeed * C.minSpeed)
  );

  // Horizontale centripetale versnelling: a_c = v² · dT_h/ds
  const maxLat = g * Math.tan((C.maxBankDeg * Math.PI) / 180);
  const acc = [];
  for (let i = 0; i < N; i++) {
    const tPrev = tan[(i - 1 + N) % N];
    const tNext = tan[(i + 1) % N];
    const dT = tNext.clone().sub(tPrev).multiplyScalar(1 / (2 * ds));
    dT.y = 0; // alleen horizontale kromming bepaalt banking
    const a = dT.multiplyScalar(v2[i]);
    if (a.length() > maxLat) a.setLength(maxLat);
    acc.push(a);
  }
  smoothClosedVec3(acc, C.bankSmoothWindow, C.bankSmoothPasses);

  // Frames: up = richting van de gevoelde verticaal (g·up + a_c),
  // geprojecteerd loodrecht op de tangent en georthonormaliseerd.
  const samples = [];
  const worldUp = v3(0, 1, 0);
  for (let i = 0; i < N; i++) {
    const T = tan[i];
    const felt = worldUp.clone().multiplyScalar(g).add(acc[i]).normalize();
    // projecteer loodrecht op T
    felt.addScaledVector(T, -felt.dot(T)).normalize();
    const right = new THREE.Vector3().crossVectors(T, felt).normalize();
    const up = new THREE.Vector3().crossVectors(right, T).normalize();
    samples.push({ pos: pos[i], T, up, right, s: i * ds });
  }

  // Up-vectoren nog één keer licht smoothen tegen restjitter.
  const ups = samples.map((s) => s.up);
  smoothClosedVec3(ups, 3, 1);
  for (let i = 0; i < N; i++) {
    const s = samples[i];
    s.up.copy(ups[i]).addScaledVector(s.T, -ups[i].dot(s.T)).normalize();
    s.right.crossVectors(s.T, s.up).normalize();
    s.up.crossVectors(s.right, s.T).normalize();
  }

  return { curve, samples, length, ds };
}
