import * as THREE from 'three';
import { toon, outlineMaterial } from './toon.js';

const SHEET_VERT = /* glsl */ `
  attribute vec3 aFlow;
  attribute float aShade;
  attribute float aSeed;
  varying vec3 vFlow;
  varying float vShade;
  varying float vSeed;
  #include <common>
  #include <fog_pars_vertex>
  void main() {
    vFlow = aFlow;
    vShade = aShade;
    vSeed = aSeed;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const SHEET_FRAG = /* glsl */ `
  uniform float uTime;
  varying vec3 vFlow;
  varying float vShade;
  varying float vSeed;
  #include <common>
  #include <fog_pars_fragment>
  float hash1(float n) {
    return fract(sin(n * 12.9898) * 43758.5453);
  }
  void main() {
    float across = vFlow.x;
    float t = vFlow.y;
    float edge = abs(across - 0.5) * 2.0;
    float wob = 0.07 * sin(vFlow.z * 0.45 - uTime * 7.0 + vSeed * 6.0) + 0.05 * sin(vFlow.z * 1.3 + uTime * 11.0 + vSeed * 3.0);
    float rim = 0.95 + wob - 0.12 * smoothstep(0.55, 1.0, t);
    if (edge > rim) discard;
    float fall = pow(max(vFlow.z, 0.0), 0.85);
    float r1 = hash1(floor(across * 26.0) + vSeed * 31.0);
    float s1 = fract(fall * 0.12 - uTime * (1.1 + r1 * 0.7) + r1);
    float thin = smoothstep(0.0, 0.05, s1) * (1.0 - smoothstep(0.18, 0.4, s1));
    float r2 = hash1(floor(across * 9.0) + vSeed * 17.0 + 5.0);
    float s2 = fract(fall * 0.05 - uTime * (0.6 + r2 * 0.4) + r2);
    float broad = smoothstep(0.0, 0.2, s2) * (1.0 - smoothstep(0.45, 0.8, s2));
    vec3 color = mix(vec3(0.16, 0.52, 0.66), vec3(0.45, 0.82, 0.95), smoothstep(0.02, 0.18, t));
    color *= 0.8 + 0.2 * (1.0 - edge * edge);
    color = mix(color, vec3(0.86, 0.97, 1.0), broad * 0.45);
    color = mix(color, vec3(1.0), thin * 0.85);
    color = mix(color, vec3(1.0), smoothstep(rim - 0.18, rim - 0.03, edge) * 0.9);
    color = mix(color, vec3(1.0), smoothstep(0.6, 0.95, t) * 0.8);
    color = mix(color, vec3(0.9, 1.0, 1.0), smoothstep(0.035, 0.0, abs(t - 0.04)) * (1.0 - edge) * 0.7);
    gl_FragColor = vec4(color * vShade, 1.0);
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

const PUFF = new THREE.SphereGeometry(1, 12, 8);
const RIPPLE = new THREE.TorusGeometry(1, 0.07, 5, 40).rotateX(Math.PI / 2);
const ROWS = 26;
const COLS = 14;
const DEPTH = 0.62;
const SINK = 0.35;
const CHURN = 30;
const LIP = 5;
const MIST = 7;
const RIPPLES = 3;
const MIST_RANGE = 260;

function fallPath({ top, foot, dx, dz }, t) {
  const out = Math.min(1, t * 5) * 0.6;
  return [top.x + (foot.x - top.x) * t + dx * out, top.y + 0.5 - (top.y + 0.5 - foot.y) * t * t, top.z + (foot.z - top.z) * t + dz * out];
}

function streamGeometry(spec, seed) {
  const { dx, dz } = spec;
  const across = new THREE.Vector3(-dz, 0, dx);
  const rows = spec.rows ?? ROWS;
  const path = spec.path ?? fallPath;
  const points = Array.from({ length: rows + 1 }, (_, r) => new THREE.Vector3(...path(spec, r / rows)));
  const positions = [];
  const flows = [];
  const shades = [];
  const seeds = [];
  const indices = [];
  const along = new THREE.Vector3();
  const out = new THREE.Vector3();
  let run = 0;
  for (let r = 0; r <= rows; r++) {
    const t = r / rows;
    const c = points[r];
    if (r) run += c.distanceTo(points[r - 1]);
    along.subVectors(points[Math.min(rows, r + 1)], points[Math.max(0, r - 1)]).normalize();
    out.crossVectors(across, along).normalize();
    const w = spec.width * (0.75 + 0.9 * t) * 0.5;
    const deep = w * DEPTH;
    for (let k = 0; k <= COLS; k++) {
      const a = (k / COLS) * Math.PI * 2;
      const side = Math.cos(a) * w;
      const lift = (Math.sin(a) + 1 - SINK) * deep;
      positions.push(c.x + across.x * side + out.x * lift, c.y + out.y * lift, c.z + across.z * side + out.z * lift);
      flows.push(0.5 + 0.42 * Math.sin(a), t, run);
      shades.push((spec.shade ? spec.shade(t) : 1) * (0.86 + 0.14 * Math.sin(a)));
      seeds.push(seed);
    }
  }
  for (let r = 0; r < rows; r++) {
    for (let k = 0; k < COLS; k++) {
      const i = r * (COLS + 1) + k;
      indices.push(i, i + COLS + 1, i + 1, i + 1, i + COLS + 1, i + COLS + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('aFlow', new THREE.Float32BufferAttribute(flows, 3));
  g.setAttribute('aShade', new THREE.Float32BufferAttribute(shades, 1));
  g.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1));
  g.setIndex(indices);
  g.computeBoundingSphere();
  return g;
}

export function createWaterfalls(specs, rand) {
  const group = new THREE.Group();
  const material = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 } }]),
    vertexShader: SHEET_VERT,
    fragmentShader: SHEET_FRAG,
    side: THREE.DoubleSide,
    fog: true,
  });
  for (const spec of specs) {
    const seed = rand();
    group.add(new THREE.Mesh(streamGeometry(spec, seed), material));
  }

  const puffCount = specs.length * (CHURN + LIP);
  const puffs = new THREE.InstancedMesh(PUFF, toon(0xffffff), puffCount);
  const inks = new THREE.InstancedMesh(PUFF, outlineMaterial(0.08), puffCount);
  inks.instanceMatrix = puffs.instanceMatrix;
  const ripples = new THREE.InstancedMesh(RIPPLE, new THREE.MeshBasicMaterial({ color: 0xf4fbff }), specs.length * RIPPLES);
  const veil = new THREE.InstancedMesh(PUFF, new THREE.MeshBasicMaterial({ color: 0xf4fbff, transparent: true, opacity: 0.32, depthWrite: false, fog: true }), specs.length * MIST);
  veil.renderOrder = 3;
  for (const mesh of [puffs, inks, ripples, veil]) {
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    group.add(mesh);
  }

  const falls = specs.map(({ top, foot, dx, dz, width, path }) => ({
    lipless: !!path,
    top,
    foot,
    dx,
    dz,
    width,
    churn: Array.from({ length: CHURN }, () => ({ phase: rand(), lat: (rand() - 0.5) * 2, size: 0.45 + rand() * 0.6, reach: 1.5 + rand() * 3.5, rate: 0.7 + rand() * 0.6, lift: 0.4 + rand() * 1 })),
    lip: Array.from({ length: LIP }, (_, k) => ({ lat: (k / (LIP - 1) - 0.5) * 0.8, size: 0.6 + rand() * 0.35, phase: rand() * 6 })),
    mist: Array.from({ length: MIST }, () => ({ phase: rand(), lat: (rand() - 0.5) * 1.6, drift: 1 + rand() * 3, rate: 0.3 + rand() * 0.2, size: 0.8 + rand() * 0.6 })),
  }));

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const place = (mesh, i, x, y, z, sx, sy, sz) => mesh.setMatrixAt(i, m.compose(p.set(x, y, z), q, s.set(sx, sy, sz)));

  return {
    group,
    update(t, dt, camera, fx) {
      material.uniforms.uTime.value = t;
      let i = 0;
      let k = 0;
      let v = 0;
      for (const f of falls) {
        const tx = -f.dz;
        const tz = f.dx;
        const w = f.width * 1.35;
        for (const c of f.churn) {
          const life = (t * c.rate + c.phase) % 1;
          const swell = Math.sin(Math.PI * life);
          const out = 1 + life * c.reach;
          const size = c.size * swell;
          place(puffs, i++, f.foot.x + f.dx * out + tx * c.lat * w * (0.6 + life * 0.6), f.foot.y - 0.1 + swell * c.lift, f.foot.z + f.dz * out + tz * c.lat * w * (0.6 + life * 0.6), size * 1.2, size, size * 1.2);
        }
        for (const c of f.lip) {
          const bob = 1 + Math.sin(t * 3 + c.phase) * 0.12;
          const size = f.lipless ? 0 : c.size * bob;
          place(puffs, i++, f.top.x - f.dx * 0.2 + tx * c.lat * f.width, f.top.y + 0.6, f.top.z - f.dz * 0.2 + tz * c.lat * f.width, size * 1.3, size * 0.7, size * 1.3);
        }
        for (const c of f.mist) {
          const life = (t * c.rate + c.phase) % 1;
          const size = f.width * c.size * (0.5 + life) * Math.sin(Math.PI * Math.min(1, life * 1.4));
          place(veil, v++, f.foot.x + f.dx * (1.5 + life * c.drift) + tx * c.lat * w, f.foot.y + 0.4 + life * 5, f.foot.z + f.dz * (1.5 + life * c.drift) + tz * c.lat * w, size, size * 0.8, size);
        }
        for (let r = 0; r < RIPPLES; r++) {
          const life = (t * 0.4 + r / RIPPLES) % 1;
          const size = f.width * (1 + life * 2.4);
          place(ripples, k++, f.foot.x + f.dx * 3, f.foot.y + 0.1 - life * 0.9, f.foot.z + f.dz * 3, size, 1 + life * 2, size);
        }
        if (fx && Math.hypot(camera.position.x - f.foot.x, camera.position.z - f.foot.z) < MIST_RANGE && Math.random() < dt * 14) {
          const lat = (Math.random() - 0.5) * w;
          fx.mist(f.foot.x + f.dx * 2.5 + tx * lat, f.foot.y + 0.8, f.foot.z + f.dz * 2.5 + tz * lat);
        }
      }
      puffs.instanceMatrix.needsUpdate = true;
      ripples.instanceMatrix.needsUpdate = true;
      veil.instanceMatrix.needsUpdate = true;
    },
  };
}
