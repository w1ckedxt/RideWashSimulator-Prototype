// DirtSystem — per oppervlak een vuilmasker als DataTexture.
// R = hoeveelheid vuil, G = blad-factor (kleurmix), B = variatieruis.
// Sprayen gumt elliptisch (anisotroop: wereldradius → uv-radius per as) en
// progressie wordt incrementeel geteld zodat we nooit hele textures hoeven
// te scannen tijdens het spelen.
import * as THREE from 'three';
import { CONFIG } from './config.js';

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Eenvoudige 2D value-noise met fbm.
function makeNoise2D(seed) {
  const rand = mulberry32(seed);
  const perm = new Uint8Array(512);
  const vals = new Float32Array(256);
  for (let i = 0; i < 256; i++) { perm[i] = i; vals[i] = rand(); }
  for (let i = 255; i > 0; i--) {
    const j = (rand() * (i + 1)) | 0;
    const tmp = perm[i]; perm[i] = perm[j]; perm[j] = tmp;
  }
  for (let i = 0; i < 256; i++) perm[256 + i] = perm[i];
  const lattice = (x, y) => vals[perm[perm[x & 255] + (y & 255)]];
  const sm = (t) => t * t * (3 - 2 * t);
  const noise = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = sm(x - xi), yf = sm(y - yi);
    const a = lattice(xi, yi), b = lattice(xi + 1, yi);
    const c = lattice(xi, yi + 1), d = lattice(xi + 1, yi + 1);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };
  return (x, y, octaves = 3) => {
    let sum = 0, amp = 0.5, freq = 1;
    for (let o = 0; o < octaves; o++) {
      sum += amp * noise(x * freq, y * freq);
      amp *= 0.5; freq *= 2.07;
    }
    return sum / (1 - Math.pow(0.5, octaves)); // ~0..1
  };
}

export class DirtSystem {
  constructor() {
    this.masks = new Map();
    this.onSectionClean = null; // callback(label)
  }

  /**
   * @param {object} o  { id, label, w, h, worldU, worldV, cellsU, cellsV,
   *                      wrapU, wrapV, seed, leafDensity, lookup(u,v)→Vector3 }
   */
  createMask(o) {
    const w = o.w, h = o.h;
    const data = new Uint8Array(w * h * 4);
    const mask = {
      id: o.id, label: o.label, w, h, data,
      worldU: o.worldU, worldV: o.worldV,
      cellsU: o.cellsU || 1, cellsV: o.cellsV || 1,
      wrapU: !!o.wrapU, wrapV: !!o.wrapV,
      lookup: o.lookup || null,
      total: w * h, cleaned: 0, done: false,
      texture: null,
    };
    this.#generate(mask, o.seed || 1, o.leafDensity ?? 1);

    const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.UnsignedByteType);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    tex.anisotropy = 8;
    tex.needsUpdate = true;
    mask.texture = tex;

    this.masks.set(o.id, mask);
    return mask;
  }

  #generate(mask, seed, leafDensity) {
    const { w, h, data } = mask;
    const grime = makeNoise2D(seed * 7919 + 13);
    const vary = makeNoise2D(seed * 104729 + 71);
    const rand = mulberry32(seed * 31 + 7);
    const mU = mask.worldU / w; // meter per pixel
    const mV = mask.worldV / h;

    for (let y = 0; y < h; y++) {
      const ym = y * mV;
      for (let x = 0; x < w; x++) {
        const xm = x * mU;
        const i = (y * w + x) * 4;
        const n = grime(xm * 0.55, ym * 0.55, 3);
        data[i] = Math.max(45, Math.min(255, 170 + (n - 0.5) * 240)) | 0; // R vuil (vlekkerig)
        data[i + 1] = (vary(xm * 1.3 + 50, ym * 1.3, 2) * 55) | 0;        // G lichte blad-ruis
        data[i + 2] = (vary(xm * 0.4, ym * 0.4 + 90, 2) * 255) | 0;       // B variatie
        data[i + 3] = 255;
      }
    }

    // Bladeren/rommel: elliptische blobs in G (+ extra vuil in R).
    const area = mask.worldU * mask.worldV;
    const count = Math.round(area * 0.8 * leafDensity);
    const leafR = 0.16; // ~16 cm rommelplekjes
    const rxBase = Math.max(1, leafR / mU);
    const ryBase = Math.max(1, leafR / mV);
    for (let k = 0; k < count; k++) {
      const cx = rand() * w, cy = rand() * h;
      const rx = rxBase * (0.5 + rand()), ry = ryBase * (0.5 + rand());
      const x0 = Math.floor(cx - rx), x1 = Math.ceil(cx + rx);
      const y0 = Math.floor(cy - ry), y1 = Math.ceil(cy + ry);
      for (let y = y0; y <= y1; y++) {
        const yy = ((y % h) + h) % h;
        for (let x = x0; x <= x1; x++) {
          const xx = ((x % w) + w) % w;
          const dx = (x - cx) / rx, dy = (y - cy) / ry;
          const d = dx * dx + dy * dy;
          if (d > 1) continue;
          const i = (yy * w + xx) * 4;
          data[i + 1] = Math.min(255, data[i + 1] + ((1 - d) * 235) | 0);
          data[i] = Math.min(255, data[i] + 45);
        }
      }
    }
  }

  /** Gum een ellips rond (u,v); geeft aantal vers-schoongemaakte pixels terug. */
  erase(id, u, v, worldR, strength) {
    const m = this.masks.get(id);
    if (!m || m.done) return 0;
    const { w, h, data } = m;

    u = u - Math.floor(u);
    v = v - Math.floor(v);
    const cw = w / m.cellsU, ch = h / m.cellsV;
    const cellX0 = Math.min(m.cellsU - 1, Math.floor(u * m.cellsU)) * cw;
    const cellY0 = Math.min(m.cellsV - 1, Math.floor(v * m.cellsV)) * ch;

    const px = u * w, py = v * h;
    const ru = Math.min(Math.max(1.5, (worldR / m.worldU) * w), cw * 0.5);
    const rv = Math.min(Math.max(1.5, (worldR / m.worldV) * h), ch * 0.5);
    const dec = strength * 255;
    const snap = CONFIG.dirt.cleanSnapBelow;

    let cleaned = 0;
    let touched = false;
    const ri = Math.ceil(ru), rj = Math.ceil(rv);

    for (let dy = -rj; dy <= rj; dy++) {
      let yy = py + dy;
      if (m.wrapV) {
        yy = cellY0 + ((((yy - cellY0) % ch) + ch) % ch);
      } else if (yy < cellY0 || yy >= cellY0 + ch) continue;
      const row = Math.min(h - 1, Math.floor(yy)) * w;

      for (let dx = -ri; dx <= ri; dx++) {
        let xx = px + dx;
        if (m.wrapU) {
          xx = cellX0 + ((((xx - cellX0) % cw) + cw) % cw);
        } else if (xx < cellX0 || xx >= cellX0 + cw) continue;

        const fall = 1 - ((dx * dx) / (ru * ru) + (dy * dy) / (rv * rv));
        if (fall <= 0) continue;

        const i = (row + Math.min(w - 1, Math.floor(xx))) * 4;
        const old = data[i];
        if (old === 0) continue;
        let nv = old - dec * fall;
        if (nv < snap) nv = 0;
        data[i] = nv;
        touched = true;
        if (nv === 0) cleaned++;
      }
    }

    if (touched) m.texture.needsUpdate = true;
    m.cleaned += cleaned;
    return cleaned;
  }

  /** Check secties op auto-voltooiing (voorkomt pixel-jacht). */
  update() {
    for (const m of this.masks.values()) {
      if (m.done) continue;
      if (m.cleaned / m.total >= CONFIG.dirt.sectionDoneRatio) {
        this.#finish(m);
      }
    }
  }

  #finish(m) {
    const { data } = m;
    for (let i = 0; i < data.length; i += 4) data[i] = 0;
    m.cleaned = m.total;
    m.done = true;
    m.texture.needsUpdate = true;
    if (this.onSectionClean) this.onSectionClean(m.label);
  }

  progress() {
    let c = 0, t = 0;
    for (const m of this.masks.values()) { c += m.cleaned; t += m.total; }
    return t === 0 ? 0 : c / t;
  }

  allDone() {
    for (const m of this.masks.values()) if (!m.done) return false;
    return this.masks.size > 0;
  }

  /** Vind een vieze plek (wereldpositie) voor de vuilzoeker-baken. */
  findDirtySpot() {
    let worst = null, worstRatio = 2;
    for (const m of this.masks.values()) {
      if (m.done || !m.lookup) continue;
      const r = m.cleaned / m.total;
      if (r < worstRatio) { worstRatio = r; worst = m; }
    }
    if (!worst) return null;
    const { w, h, data } = worst;
    const n = w * h;
    const start = (Math.random() * n) | 0;
    for (let k = 0; k < n; k += 89) {
      const idx = (start + k) % n;
      if (data[idx * 4] > 90) {
        const x = idx % w, y = (idx / w) | 0;
        return worst.lookup((x + 0.5) / w, (y + 0.5) / h);
      }
    }
    return null;
  }
}
