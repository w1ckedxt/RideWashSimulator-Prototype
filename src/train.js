// Geparkeerde coastertrein in het station — natuurlijk ook vies en
// schoonmaakbaar. Wagonnetjes volgen de baan-frames, dus dit werkt op
// elke coaster (staal én hout).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CellAtlas } from './atlas.js';
import { createCleanableMaterial } from './materials.js';

export function buildTrain({
  trackData, dirt, cleanables,
  startMeters = 2, cars = 3, carSpacing = 3.0,
  bodyColor = 0x1d4e89, noseColor = 0xe8b23a, seatColor = 0x2a2d31,
  maskId = 'train', label = 'Train', seed = 701,
}) {
  const { samples, ds } = trackData;
  const N = samples.length;
  const group = new THREE.Group();

  const atlas = new CellAtlas(dirt, {
    id: maskId, label, cols: cars, rows: 1,
    texW: 128 * cars, texH: 128, cellWorld: 3.0, seed, leafDensity: 1.0,
  });
  const bodyMat = createCleanableMaterial(
    { color: bodyColor, metalness: 0.45, roughness: 0.35 }, atlas.mask.texture);
  const noseMat = createCleanableMaterial(
    { color: noseColor, metalness: 0.5, roughness: 0.35 }, atlas.mask.texture);
  const seatMat = createCleanableMaterial(
    { color: seatColor, metalness: 0.2, roughness: 0.55 }, atlas.mask.texture);

  const bodyGeos = [];
  const noseGeos = [];
  const seatGeos = [];

  for (let car = 0; car < cars; car++) {
    const i = Math.round((startMeters + car * carSpacing) / ds) % N;
    const s = samples[i];
    const basis = new THREE.Matrix4().makeBasis(s.right, s.up, s.T);
    const at = (geo, ox, oy, oz) => {
      atlas.add(geo);
      geo.applyMatrix4(basis.clone().setPosition(
        s.pos.clone()
          .addScaledVector(s.right, ox)
          .addScaledVector(s.up, oy)
          .addScaledVector(s.T, oz)));
      return geo;
    };
    atlas.claim(s.pos.clone());

    // bak + zijwanden + bodem
    bodyGeos.push(at(new THREE.BoxGeometry(1.5, 0.22, 2.7), 0, 0.25, 0));
    for (const sx of [-0.7, 0.7]) {
      bodyGeos.push(at(new THREE.BoxGeometry(0.12, 0.42, 2.7), sx, 0.55, 0));
    }
    bodyGeos.push(at(new THREE.BoxGeometry(1.5, 0.42, 0.14), 0, 0.55, -1.3));
    bodyGeos.push(at(new THREE.BoxGeometry(1.5, 0.42, 0.14), 0, 0.55, 1.3));

    // neuskap op de eerste wagon
    if (car === 0) {
      const nose = new THREE.SphereGeometry(0.72, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2);
      nose.scale(1.0, 0.75, 1.1);
      nose.rotateX(Math.PI / 2);
      noseGeos.push(at(nose, 0, 0.4, 1.55));
    }

    // 2 zitrijen met rugleuning + beugel
    for (const rz of [-0.6, 0.55]) {
      seatGeos.push(at(new THREE.BoxGeometry(1.2, 0.16, 0.55), 0, 0.42, rz));
      seatGeos.push(at(new THREE.BoxGeometry(1.2, 0.5, 0.12), 0, 0.72, rz - 0.32));
      const bar = new THREE.CylinderGeometry(0.035, 0.035, 1.1, 6);
      bar.rotateZ(Math.PI / 2);
      seatGeos.push(at(bar, 0, 0.62, rz + 0.28));
    }
  }

  for (const [geos, mat] of [[bodyGeos, bodyMat], [noseGeos, noseMat], [seatGeos, seatMat]]) {
    if (!geos.length) continue;
    const mesh = new THREE.Mesh(mergeGeometries(geos), mat);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.userData.maskId = maskId;
    group.add(mesh);
    cleanables.push(mesh);
  }
  return group;
}
