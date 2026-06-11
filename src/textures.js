// Kleine procedurele canvas-texturen, gedeeld door levels.
import * as THREE from 'three';

export function stripeTexture(colorA, colorB, stripes) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 64;
  const ctx = c.getContext('2d');
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 ? colorA : colorB;
    ctx.fillRect((i * 512) / stripes, 0, 512 / stripes + 1, 64);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

/** Kermis-look: ondergrondkleur met witte/gele sterren (zoals echte Top Spin-torens). */
export function starsTexture(bg = '#c23028', count = 14) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 256, 256);
  const star = (cx, cy, r, color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 ? r * 0.45 : r;
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      ctx[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
  };
  for (let i = 0; i < count; i++) {
    star(20 + Math.random() * 216, 20 + Math.random() * 216, 8 + Math.random() * 14,
      Math.random() < 0.5 ? '#f5f0e6' : '#f0c43c');
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** Witte banner met gekleurde stippen (gondelrand van een Top Spin). */
export function dotsTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#efe9da';
  ctx.fillRect(0, 0, 512, 64);
  const colors = ['#c23028', '#e07b33', '#f0c43c', '#4d8a3a', '#2f5276', '#7b4a8f'];
  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = colors[i % colors.length];
    ctx.beginPath();
    ctx.arc(21 + i * 42, 32, 13, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

export function woodTexture(base = '#83613c') {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = `rgba(60,40,20,${0.08 + Math.random() * 0.12})`;
    ctx.fillRect(0, Math.random() * 256, 256, 1 + Math.random() * 3);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  return tex;
}
