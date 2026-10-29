import * as THREE from 'three';
import { toon, outlineMaterial } from './toon.js';

const SHEET_VERT = /* glsl */ `
  attribute vec3 aFlow;
  varying vec3 vFlow;
  #include <common>
  #include <fog_pars_vertex>
  void main() {
    vFlow = aFlow;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const SHEET_FRAG = /* glsl */ `
  uniform float uTime;
  varying vec3 vFlow;
  #include <common>
  #include <fog_pars_fragment>
  void main() {
    float across = vFlow.x;
    float t = vFlow.y;
    float col = floor(across * 16.0);
    float r = fract(sin(col * 12.9898) * 43758.5453);
    float flow = fract(vFlow.z * 0.09 - uTime * (0.8 + r * 0.6) + r);
    float streak = smoothstep(0.5, 0.56, flow) * (1.0 - smoothstep(0.8, 0.9, flow));
    float edge = abs(across - 0.5) * 2.0;
    vec3 color = mix(vec3(0.72, 0.93, 1.0), vec3(0.33, 0.7, 0.9), edge * 0.7 + r * 0.2);
    color = mix(color, vec3(1.0), streak * 0.85);
    color = mix(color, vec3(1.0), smoothstep(0.7, 1.0, t) * 0.75 + smoothstep(0.1, 0.0, t) * 0.6);
    color = mix(color, vec3(0.16, 0.4, 0.6), smoothstep(0.88, 0.96, edge));
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

const PUFF = new THREE.SphereGeometry(1, 12, 8);
const RIPPLE = new THREE.TorusGeometry(1, 0.07, 5, 40).rotateX(Math.PI / 2);
const ROWS = 26;
const COLS = 12;
const CHURN = 24;
const LIP = 5;
const RIPPLES = 3;
const MIST_RANGE = 260;

function fallPath({ top, foot, dx, dz }, t) {
  const out = Math.sin(Math.PI * t) * 2.2 + t * 1.5 + Math.min(1, t * 6) * 1.2 - 1;
  return [top.x + (foot.x - top.x) * t + dx * out, top.y + 0.5 - (top.y + 0.5 - foot.y) * t, top.z + (foot.z - top.z) * t + dz * out];
}

function sheetGeometry(spec) {
  const { dx, dz, width } = spec;
  const tx = -dz;
  const tz = dx;
  const positions = [];
  const flows = [];
  const indices = [];
  let along = 0;
  let prev = null;
  for (let r = 0; r <= ROWS; r++) {
    const t = r / ROWS;
    const [cx, cy, cz] = (spec.path ?? fallPath)(spec, t);
    if (prev) along += Math.hypot(cx - prev[0], cy - prev[1], cz - prev[2]);
    prev = [cx, cy, cz];
    const w = width * (0.75 + 0.6 * t);
    for (let c = 0; c <= COLS; c++) {
      const u = c / COLS - 0.5;
      const bulge = (1 - 4 * u * u) * w * 0.35;
      if (spec.path) positions.push(cx + tx * u * w, cy + bulge, cz + tz * u * w);
      else positions.push(cx + tx * u * w + dx * bulge, cy, cz + tz * u * w + dz * bulge);
      flows.push(c / COLS, t, along);
    }
  }
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const a = r * (COLS + 1) + c;
      indices.push(a, a + COLS + 1, a + 1, a + 1, a + COLS + 1, a + COLS + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('aFlow', new THREE.Float32BufferAttribute(flows, 3));
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
  for (const spec of specs) group.add(new THREE.Mesh(sheetGeometry(spec), material));

  const puffCount = specs.length * (CHURN + LIP);
  const puffs = new THREE.InstancedMesh(PUFF, toon(0xffffff), puffCount);
  const inks = new THREE.InstancedMesh(PUFF, outlineMaterial(0.08), puffCount);
  inks.instanceMatrix = puffs.instanceMatrix;
  const ripples = new THREE.InstancedMesh(RIPPLE, new THREE.MeshBasicMaterial({ color: 0xf4fbff }), specs.length * RIPPLES);
  for (const mesh of [puffs, inks, ripples]) {
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
    churn: Array.from({ length: CHURN }, () => ({ phase: rand(), lat: (rand() - 0.5) * 2, size: 0.7 + rand() * 0.9, reach: 2 + rand() * 5, rate: 0.6 + rand() * 0.5, lift: 0.6 + rand() * 1.4 })),
    lip: Array.from({ length: LIP }, (_, k) => ({ lat: (k / (LIP - 1) - 0.5) * 0.8, size: 0.9 + rand() * 0.5, phase: rand() * 6 })),
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
      for (const f of falls) {
        const tx = -f.dz;
        const tz = f.dx;
        const w = f.width * 1.35;
        for (const c of f.churn) {
          const life = (t * c.rate + c.phase) % 1;
          const swell = Math.sin(Math.PI * life);
          const out = 1 + life * c.reach;
          const size = c.size * swell;
          place(puffs, i++, f.foot.x + f.dx * out + tx * c.lat * w * (0.6 + life * 0.6), 0.1 + swell * c.lift, f.foot.z + f.dz * out + tz * c.lat * w * (0.6 + life * 0.6), size * 1.2, size, size * 1.2);
        }
        for (const c of f.lip) {
          const bob = 1 + Math.sin(t * 3 + c.phase) * 0.12;
          const size = f.lipless ? 0 : c.size * bob;
          place(puffs, i++, f.top.x - f.dx * 0.2 + tx * c.lat * f.width, f.top.y + 0.6, f.top.z - f.dz * 0.2 + tz * c.lat * f.width, size * 1.3, size * 0.7, size * 1.3);
        }
        for (let r = 0; r < RIPPLES; r++) {
          const life = (t * 0.4 + r / RIPPLES) % 1;
          const size = f.width * (1 + life * 2.4);
          place(ripples, k++, f.foot.x + f.dx * 3, 0.3 - life * 0.9, f.foot.z + f.dz * 3, size, 1 + life * 2, size);
        }
        if (fx && Math.hypot(camera.position.x - f.foot.x, camera.position.z - f.foot.z) < MIST_RANGE && Math.random() < dt * 14) {
          const lat = (Math.random() - 0.5) * w;
          fx.mist(f.foot.x + f.dx * 2.5 + tx * lat, 1, f.foot.z + f.dz * 2.5 + tz * lat);
        }
      }
      puffs.instanceMatrix.needsUpdate = true;
      ripples.instanceMatrix.needsUpdate = true;
    },
  };
}
