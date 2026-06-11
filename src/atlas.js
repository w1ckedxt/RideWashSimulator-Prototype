// CellAtlas — generiek hulpmiddel om losse geometrie-onderdelen (planken,
// palen, paardjes, balken...) elk een eigen cel in één dirt-mask te geven.
// Zo wordt élk onderdeel van een attractie vies en individueel schoonmaakbaar.
import * as THREE from 'three';

export function remapUV(geo, fn) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    const [u, v] = fn(uv.getX(i), uv.getY(i));
    uv.setXY(i, u, v);
  }
}

export class CellAtlas {
  /**
   * @param {DirtSystem} dirt
   * @param {object} o { id, label, cols, rows, texW, texH, cellWorld, seed, leafDensity }
   */
  constructor(dirt, o) {
    this.cols = o.cols;
    this.rows = o.rows;
    this.positions = [];
    this.cursor = 0;
    this.mask = dirt.createMask({
      id: o.id, label: o.label, w: o.texW, h: o.texH,
      worldU: o.cols * o.cellWorld, worldV: o.rows * o.cellWorld,
      cellsU: o.cols, cellsV: o.rows,
      seed: o.seed, leafDensity: o.leafDensity ?? 1,
      lookup: (u, v) => {
        const k = Math.min(this.positions.length - 1,
          Math.floor(v * this.rows) * this.cols + Math.floor(u * this.cols));
        return this.positions[Math.max(0, k)] || new THREE.Vector3();
      },
    });
  }

  /** Reserveer een cel; alle daarna ge-add-de geo's delen hem tot de volgende claim. */
  claim(worldPos) {
    this.cursor = Math.min(this.positions.length, this.cols * this.rows - 1);
    this.positions.push(worldPos.clone());
    return this.cursor;
  }

  /** Remap de uv's van een geometry naar de huidige (laatst geclaimde) cel. */
  add(geo) {
    const col = this.cursor % this.cols;
    const row = Math.floor(this.cursor / this.cols);
    remapUV(geo, (u, v) => [
      (col + 0.06 + u * 0.88) / this.cols,
      (row + 0.06 + v * 0.88) / this.rows,
    ]);
    return geo;
  }
}
