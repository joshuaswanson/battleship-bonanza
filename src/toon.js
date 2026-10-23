import * as THREE from 'three';

export const INK = 0x0e2a47;

let gradientTexture;
function gradientMap() {
  if (!gradientTexture) {
    gradientTexture = new THREE.DataTexture(new Uint8Array([120, 200, 255]), 3, 1, THREE.RedFormat);
    gradientTexture.minFilter = THREE.NearestFilter;
    gradientTexture.magFilter = THREE.NearestFilter;
    gradientTexture.generateMipmaps = false;
    gradientTexture.needsUpdate = true;
  }
  return gradientTexture;
}

export function toon(color, options = {}) {
  return new THREE.MeshToonMaterial({ color, gradientMap: gradientMap(), ...options });
}

export function glow(color, options = {}) {
  return new THREE.MeshBasicMaterial({ color, ...options });
}

const OUTLINE_VERT = /* glsl */ `
  uniform float uThickness;
  #include <common>
  #include <fog_pars_vertex>
  void main() {
    vec4 mvPosition = vec4(position + normal * uThickness, 1.0);
    #ifdef USE_INSTANCING
      mvPosition = instanceMatrix * mvPosition;
    #endif
    mvPosition = modelViewMatrix * mvPosition;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const OUTLINE_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  #include <common>
  #include <fog_pars_fragment>
  void main() {
    gl_FragColor = vec4(uColor, uOpacity);
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

const outlineCache = new Map();
export function outlineMaterial(thickness) {
  let material = outlineCache.get(thickness);
  if (!material) {
    material = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        { uThickness: { value: thickness }, uColor: { value: new THREE.Color(INK) }, uOpacity: { value: 1 } },
      ]),
      vertexShader: OUTLINE_VERT,
      fragmentShader: OUTLINE_FRAG,
      side: THREE.BackSide,
      fog: true,
    });
    outlineCache.set(thickness, material);
  }
  return material;
}

export function outlined(geometry, material, thickness = 0.05) {
  const mesh = new THREE.Mesh(geometry, material);
  if (thickness > 0) mesh.add(new THREE.Mesh(geometry, outlineMaterial(thickness)));
  return mesh;
}

const geometryCache = new Map();
export function cachedGeometry(key, build) {
  let geometry = geometryCache.get(key);
  if (!geometry) {
    geometry = build();
    geometryCache.set(key, geometry);
  }
  return geometry;
}

export function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
