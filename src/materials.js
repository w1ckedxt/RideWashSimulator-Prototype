// Materialen — schoon geverfd staal met een vuillaag uit het dirt-mask.
// Eén gedeelde onBeforeCompile (zelfde shadercode → één GPU-programma),
// uniforms per materiaal.
import * as THREE from 'three';
import { CONFIG } from './config.js';

const dustColor = new THREE.Color(...CONFIG.colors.dust);
const leafColor = new THREE.Color(...CONFIG.colors.leaf);

function injectDirt(shader, texture) {
  shader.uniforms.uDirtMap = { value: texture };
  shader.uniforms.uDustColor = { value: dustColor };
  shader.uniforms.uLeafColor = { value: leafColor };
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', [
      '#include <common>',
      'uniform sampler2D uDirtMap;',
      'uniform vec3 uDustColor;',
      'uniform vec3 uLeafColor;',
    ].join('\n'))
    .replace('#include <map_fragment>', [
      '#include <map_fragment>',
      'vec4 dirtTex = texture2D(uDirtMap, vUv);',
      'float dirtAmt = dirtTex.r;',
      'vec3 dirtCol = mix(uDustColor, uLeafColor, dirtTex.g);',
      'dirtCol *= 0.78 + 0.45 * dirtTex.b;',
      'diffuseColor.rgb = mix(diffuseColor.rgb, dirtCol, dirtAmt);',
    ].join('\n'))
    .replace('#include <roughnessmap_fragment>', [
      '#include <roughnessmap_fragment>',
      'roughnessFactor = mix(roughnessFactor, 0.96, texture2D(uDirtMap, vUv).r);',
    ].join('\n'))
    .replace('#include <metalnessmap_fragment>', [
      '#include <metalnessmap_fragment>',
      'metalnessFactor = mix(metalnessFactor, 0.02, texture2D(uDirtMap, vUv).r);',
    ].join('\n'));
}

export function createCleanableMaterial({ color, map = null, metalness = 0.35, roughness = 0.25 }, dirtTexture) {
  // map-support: ook getextureerde (asset pack-)modellen krijgen de vuillaag
  const mat = new THREE.MeshStandardMaterial({ color, map, metalness, roughness });
  mat.defines = { USE_UV: '' };
  mat.onBeforeCompile = (shader) => injectDirt(shader, dirtTexture);
  // Zelfde programma voor alle vuil-materialen (uniforms verschillen per materiaal).
  mat.customProgramCacheKey = () => 'dirt-overlay-v1';
  return mat;
}
