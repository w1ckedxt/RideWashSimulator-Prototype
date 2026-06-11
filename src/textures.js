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
