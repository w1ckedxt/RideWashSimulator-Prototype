// Lifthill-walkway: een echte catwalk naast de kettinglift zoals bij echte
// coasters — roosterplanken, stringers, leuningposten met dubbele handrail,
// plus de liftketting tussen de rails. Alles vies en schoonmaakbaar:
// elk onderdeel krijgt een cel in het 'walkway' dirt-mask.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CellAtlas } from './atlas.js';
import { createCleanableMaterial } from './materials.js';

/** Vind de aaneengesloten lift-samples (klimmend, rechtdoor langs z≈0). */
function liftSampleIndices(samples) {
  const idx = [];
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    // alleen het klimmende/vlakke deel van de lift (niet de drop)
    if (s.pos.x >= 24 && s.pos.x <= 90 && Math.abs(s.pos.z) < 4 && s.T.x > 0.4 && s.T.y > -0.05) {
      idx.push(i);
    }
  }
  idx.sort((a, b) => a - b);
  return idx;
}

export function buildWalkway(trackData, dirt, cleanables) {
  const { samples } = trackData;
  const lift = liftSampleIndices(samples);
  const group = new THREE.Group();
  if (lift.length < 10) return group;

  const atlas = new CellAtlas(dirt, {
    id: 'walkway', label: 'Catwalk', cols: 16, rows: 16,
    texW: 1024, texH: 1024, cellWorld: 1.0, seed: 97, leafDensity: 1.6,
  });

  const grateMat = createCleanableMaterial(
    { color: 0x626c78, metalness: 0.6, roughness: 0.6 }, atlas.mask.texture);
  const railMat = createCleanableMaterial(
    { color: 0xb9bfc6, metalness: 0.85, roughness: 0.35 }, atlas.mask.texture);
  const chainMat = createCleanableMaterial(
    { color: 0x2a2d31, metalness: 0.7, roughness: 0.6 }, atlas.mask.texture);

  const grates = [];
  const rails = [];
  const chain = [];

  const side = 1;            // rechterkant in klimrichting
  const off = 1.3;           // afstand van baanhart
  const drop = 0.42;         // walkway iets onder railniveau
  const width = 0.85;

  const basisAt = (i) => {
    const s = samples[i];
    return {
      s,
      basis: new THREE.Matrix4().makeBasis(s.right, s.up, s.T),
      deck: s.pos.clone().addScaledVector(s.right, side * off).addScaledVector(s.up, -drop),
    };
  };

  for (let k = 0; k < lift.length; k++) {
    const i = lift[k];
    const { s, basis, deck } = basisAt(i);

    // per 2 planken één atlas-cel (plank + stringers + kettingschakel samen)
    if (k % 2 === 0) atlas.claim(deck);

    const plank = new THREE.BoxGeometry(width, 0.05, 0.46);
    atlas.add(plank);
    plank.applyMatrix4(basis.clone().setPosition(deck));
    grates.push(plank);

    for (const so of [-width / 2 + 0.06, width / 2 - 0.06]) {
      const st = new THREE.BoxGeometry(0.07, 0.16, 0.5);
      atlas.add(st);
      st.applyMatrix4(basis.clone().setPosition(
        deck.clone().addScaledVector(s.right, so).addScaledVector(s.up, -0.1)));
      grates.push(st);
    }

    const link = new THREE.BoxGeometry(0.11, 0.07, 0.5);
    atlas.add(link);
    link.applyMatrix4(basis.clone().setPosition(
      s.pos.clone().addScaledVector(s.up, -0.1)));
    chain.push(link);

    // leuningpost + handrails om de 4 samples (buitenzijde), eigen cel
    if (k % 4 === 0 && k + 4 < lift.length) {
      const postBase = deck.clone().addScaledVector(s.right, side * (width / 2 - 0.04));
      atlas.claim(postBase.clone().addScaledVector(s.up, 0.8));

      const post = new THREE.CylinderGeometry(0.028, 0.028, 1.05, 6);
      atlas.add(post);
      post.applyMatrix4(basis.clone().setPosition(
        postBase.clone().addScaledVector(s.up, 0.55)));
      rails.push(post);

      const next = basisAt(lift[k + 4]);
      const nextBase = next.deck.clone().addScaledVector(next.s.right, side * (width / 2 - 0.04));
      for (const hh of [0.6, 1.02]) {
        const a = postBase.clone().addScaledVector(s.up, hh);
        const b = nextBase.clone().addScaledVector(next.s.up, hh);
        const dir = b.clone().sub(a);
        const len = dir.length();
        const tube = new THREE.CylinderGeometry(0.024, 0.024, len, 6);
        atlas.add(tube);
        tube.applyMatrix4(new THREE.Matrix4()
          .makeRotationFromQuaternion(new THREE.Quaternion()
            .setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()))
          .setPosition(a.clone().add(b).multiplyScalar(0.5)));
        rails.push(tube);
      }
    }
  }

  for (const [geos, mat] of [[grates, grateMat], [rails, railMat], [chain, chainMat]]) {
    if (!geos.length) continue;
    const mesh = new THREE.Mesh(mergeGeometries(geos), mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.maskId = 'walkway';
    group.add(mesh);
    cleanables.push(mesh);
  }
  return group;
}
