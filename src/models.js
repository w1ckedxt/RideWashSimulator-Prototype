// Asset pack-pijplijn: laad een GLB/GLTF-model en maak elke mesh erin vies
// en schoonmaakbaar. Werkt met elk model dat UV's heeft (Synty, Sketchfab,
// Quaternius, ...). Originele kleur/texture blijft behouden onder het vuil.
//
// Gebruik in een level:
//   const ride = await loadCleanableModel('./assets/models/coaster.glb', {
//     dirt, cleanables,
//     position: [0, 0, 0], scale: 1,
//     sections: [                       // mesh-naam (substring) → sectie
//       { match: 'track', label: 'Track' },
//       { match: 'support', label: 'Supports' },
//     ],
//     defaultLabel: 'Ride',
//   });
//   scene.add(ride);
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createCleanableMaterial } from './materials.js';

const loader = new GLTFLoader();

function sectionFor(meshName, sections, defaultLabel) {
  const lower = meshName.toLowerCase();
  for (const s of sections) {
    if (lower.includes(s.match.toLowerCase())) return s.label;
  }
  return defaultLabel;
}

export async function loadCleanableModel(url, opts) {
  const {
    dirt, cleanables,
    position = [0, 0, 0], rotationY = 0, scale = 1,
    sections = [], defaultLabel = 'Ride', leafDensity = 1.2,
  } = opts;

  const gltf = await loader.loadAsync(url);
  const root = gltf.scene;
  root.scale.setScalar(scale);
  root.rotation.y = rotationY;
  root.position.set(...position);
  root.updateMatrixWorld(true);

  // Meshes groeperen per sectie-label; elke mesh krijgt een eigen mask
  // (UV's per mesh zijn onafhankelijk), labels delen de naam in de HUD.
  let maskIndex = 0;
  root.traverse((m) => {
    if (!m.isMesh) return;
    if (!m.geometry.attributes.uv) {
      // geen UV's → wel zichtbaar, niet schoonmaakbaar (zeldzaam)
      m.castShadow = m.receiveShadow = true;
      return;
    }

    const label = sectionFor(m.name || '', sections, defaultLabel);
    const box = new THREE.Box3().setFromObject(m);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    // ruwe wereld-schaal van het uv-vlak: omtrek-achtige maten
    const worldU = Math.max(1.5, size.x + size.z);
    const worldV = Math.max(1.5, size.y + Math.min(size.x, size.z) * 0.5);
    const area = worldU * worldV;
    const texW = Math.min(1024, Math.max(128, Math.pow(2, Math.ceil(Math.log2(Math.sqrt(area) * 24)))));
    const texH = Math.max(64, texW / 2);

    const id = `model-${maskIndex++}-${(m.name || 'mesh').slice(0, 24)}`;
    const mask = dirt.createMask({
      id, label, w: texW, h: texH, worldU, worldV,
      seed: 500 + maskIndex * 17, leafDensity,
      lookup: () => center.clone(),
    });

    const orig = Array.isArray(m.material) ? m.material[0] : m.material;
    m.material = createCleanableMaterial({
      color: orig.color ? orig.color.clone() : 0xffffff,
      map: orig.map || null,
      metalness: orig.metalness ?? 0.2,
      roughness: orig.roughness ?? 0.6,
    }, mask.texture);
    m.castShadow = m.receiveShadow = true;
    m.userData.maskId = id;
    cleanables.push(m);
  });

  return root;
}
