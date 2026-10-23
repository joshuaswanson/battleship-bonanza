import * as THREE from 'three';

let surface = null;

export function setSurface(next) {
  surface = next;
}

export const seaWaves = (x, z, t) =>
  0.45 * Math.sin(x * 0.06 + t * 1.3) +
  0.35 * Math.sin(z * 0.08 - t * 1.1) +
  0.2 * Math.sin((x + z) * 0.13 + t * 2.0);

export function waveHeight(x, z, t) {
  if (!surface) return seaWaves(x, z, t);
  const { level, amp } = surface.sample(x, z);
  return level + amp * seaWaves(x, z, t);
}

export function isWater(x, z) {
  return !surface || surface.sample(x, z).amp > 0;
}

const VERT = /* glsl */ `
  uniform float uTime;
  uniform float uAmp;
  varying vec3 vWorld;
  varying float vHeight;
  varying vec3 vNormalW;
  #include <common>
  #include <fog_pars_vertex>
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    float a = world.x * 0.06 + uTime * 1.3;
    float b = world.z * 0.08 - uTime * 1.1;
    float c = (world.x + world.z) * 0.13 + uTime * 2.0;
    float h = (0.45 * sin(a) + 0.35 * sin(b) + 0.2 * sin(c)) * uAmp;
    float dx = (0.027 * cos(a) + 0.026 * cos(c)) * uAmp;
    float dz = (0.028 * cos(b) + 0.026 * cos(c)) * uAmp;
    world.y += h;
    vHeight = h;
    vWorld = world.xyz;
    vNormalW = normalize(vec3(-dx, 1.0, -dz));
    vec4 mvPosition = viewMatrix * world;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uAmp;
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec3 uFoam;
  uniform vec3 uSunDir;
  varying vec3 vWorld;
  varying float vHeight;
  varying vec3 vNormalW;
  #include <common>
  #include <fog_pars_fragment>
  void main() {
    float h = clamp(vHeight / max(uAmp, 0.01) * 0.5 + 0.5, 0.0, 1.0);
    vec3 color = mix(uDeep, uShallow, smoothstep(0.25, 0.85, h));

    float light = dot(normalize(vNormalW), normalize(uSunDir));
    color *= mix(0.9, 1.06, step(0.62, light));

    vec2 p = vWorld.xz * 0.11;
    float warpA = sin(p.y * 1.7 + uTime * 0.9) * 1.4;
    float warpB = sin(p.x * 1.9 - uTime * 0.7) * 1.4;
    float ripple = sin(p.x * 2.6 + warpA + uTime * 0.6) * sin(p.y * 2.6 + warpB - uTime * 0.5);
    color = mix(color, uFoam, smoothstep(0.8, 0.86, ripple) * 0.45);
    color = mix(color, uFoam, smoothstep(0.9, 0.96, h) * 0.7);

    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

export function createWater({ size = 1800, segments = 240, geometry = null, flat = false, amp = 1, deep = 0x0f8fb8, shallow = 0x35d6e0 } = {}) {
  geometry ??= new THREE.PlaneGeometry(size, size, segments, segments);
  if (!flat) geometry.rotateX(-Math.PI / 2);
  const material = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: { value: 0 },
        uAmp: { value: amp },
        uDeep: { value: new THREE.Color(deep) },
        uShallow: { value: new THREE.Color(shallow) },
        uFoam: { value: new THREE.Color(0xf4fbff) },
        uSunDir: { value: new THREE.Vector3(0.4, 1, 0.3) },
      },
    ]),
    vertexShader: VERT,
    fragmentShader: FRAG,
    fog: true,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  return {
    mesh,
    update(t) {
      material.uniforms.uTime.value = t;
    },
  };
}
