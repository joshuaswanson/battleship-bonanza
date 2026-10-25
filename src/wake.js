import * as THREE from 'three';
import { waveHeight, isWater } from './water.js';
import { HULL_L } from './boatModel.js';

const LIFE = 1.7;
const MAX_POINTS = 40;
const STRIPS = 3;
const MAX_VERTS = 8 * MAX_POINTS * STRIPS * 6;

const SIDES = [-1, 1, 0];
const BAND_A = { inner: 0, outer: 0, alpha: 0 };
const BAND_B = { inner: 0, outer: 0, alpha: 0 };
function band(p, age, u, side, out) {
  if (side) {
    const center = side * (1.5 + p.speed * 15 * age);
    const half = 0.45 + 1.2 * u;
    out.inner = center - half;
    out.outer = center + half;
    out.alpha = Math.pow(1 - u, 1.1) * (0.6 + 0.6 * p.speed);
  } else {
    const half = 1.5 + 2.5 * u;
    out.inner = -half;
    out.outer = half;
    out.alpha = Math.pow(1 - u, 2.5) * (0.5 + 0.6 * p.speed);
  }
  return out;
}

const VERT = /* glsl */ `
  attribute float aAlpha;
  attribute float aEdge;
  varying float vAlpha;
  varying float vEdge;
  varying vec2 vXZ;
  #include <common>
  #include <fog_pars_vertex>
  void main() {
    vAlpha = aAlpha;
    vEdge = aEdge;
    vXZ = position.xz;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const FRAG = /* glsl */ `
  uniform float uTime;
  varying float vAlpha;
  varying float vEdge;
  varying vec2 vXZ;
  #include <common>
  #include <fog_pars_fragment>
  void main() {
    vec2 p = vXZ * 0.9;
    float n = sin(p.x * 1.7 + sin(p.y * 1.3 + uTime * 0.8) * 1.6) * sin(p.y * 1.9 + sin(p.x * 1.1 - uTime * 0.6) * 1.6);
    float edge = 1.0 - smoothstep(0.35, 1.0, abs(vEdge));
    float foam = vAlpha * edge * (0.55 + 0.45 * n);
    float a = smoothstep(0.26, 0.32, foam);
    if (a < 0.01) discard;
    gl_FragColor = vec4(mix(vec3(0.8, 0.95, 1.0), vec3(1.0), smoothstep(0.4, 0.7, foam)), a * 0.85);
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

export class Wakes {
  constructor(scene) {
    this.scene = scene;
    this.positions = new Float32Array(MAX_VERTS * 3);
    this.alphas = new Float32Array(MAX_VERTS);
    this.edges = new Float32Array(MAX_VERTS);
    this.ys = new Float32Array(MAX_POINTS);
    this.us = new Float32Array(MAX_POINTS);
    this.ages = new Float32Array(MAX_POINTS);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('aAlpha', new THREE.BufferAttribute(this.alphas, 1).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('aEdge', new THREE.BufferAttribute(this.edges, 1).setUsage(THREE.DynamicDrawUsage));
    this.geometry = geometry;
    this.material = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 } }]),
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      fog: true,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    scene.add(this.mesh);
    this.trails = new Map();
  }

  record(b, time) {
    let trail = this.trails.get(b);
    if (!trail) {
      trail = [];
      this.trails.set(b, trail);
    }
    while (trail.length && time - trail[0].t > LIFE) trail.shift();
    const fx = Math.sin(b.heading);
    const fz = Math.cos(b.heading);
    const x = b.pos.x - fx * (HULL_L - 0.6);
    const z = b.pos.z - fz * (HULL_L - 0.6);
    const moving = b.alive && !b.air && Math.abs(b.speed) > 4 && isWater(x, z);
    if (!moving) {
      if (trail.length && !trail[trail.length - 1].cut) trail[trail.length - 1].cut = true;
      return;
    }
    const last = trail[trail.length - 1];
    if (last && !last.cut && time - last.t < 0.05 && Math.hypot(x - last.x, z - last.z) < 1.5) return;
    trail.push({ x, z, lx: Math.cos(b.heading), lz: -Math.sin(b.heading), speed: Math.min(1.2, Math.abs(b.speed) / 40), t: time, cut: false });
    if (trail.length > MAX_POINTS) trail.shift();
  }

  update(boats, time) {
    this.material.uniforms.uTime.value = time;
    for (const b of boats) this.record(b, time);
    let v = 0;
    const put = (x, y, z, alpha, edge) => {
      this.positions[v * 3] = x;
      this.positions[v * 3 + 1] = y;
      this.positions[v * 3 + 2] = z;
      this.alphas[v] = alpha;
      this.edges[v] = edge;
      v++;
    };
    const { ys, us, ages } = this;
    for (const trail of this.trails.values()) {
      for (let i = 0; i < trail.length; i++) {
        const p = trail[i];
        ages[i] = time - p.t;
        us[i] = Math.min(1, ages[i] / LIFE);
        ys[i] = waveHeight(p.x, p.z, time) + 0.06;
      }
      for (let i = 0; i < trail.length - 1; i++) {
        const a = trail[i];
        const b = trail[i + 1];
        if (a.cut) continue;
        if (Math.abs(ys[i] - ys[i + 1]) > 1.5) continue;
        for (const side of SIDES) {
          if (v + 6 > MAX_VERTS) break;
          const ea = band(a, ages[i], us[i], side, BAND_A);
          const eb = band(b, ages[i + 1], us[i + 1], side, BAND_B);
          const ya = ys[i];
          const yb = ys[i + 1];
          put(a.x + a.lx * ea.inner, ya, a.z + a.lz * ea.inner, ea.alpha, -1);
          put(b.x + b.lx * eb.inner, yb, b.z + b.lz * eb.inner, eb.alpha, -1);
          put(a.x + a.lx * ea.outer, ya, a.z + a.lz * ea.outer, ea.alpha, 1);
          put(a.x + a.lx * ea.outer, ya, a.z + a.lz * ea.outer, ea.alpha, 1);
          put(b.x + b.lx * eb.inner, yb, b.z + b.lz * eb.inner, eb.alpha, -1);
          put(b.x + b.lx * eb.outer, yb, b.z + b.lz * eb.outer, eb.alpha, 1);
        }
      }
    }
    this.geometry.setDrawRange(0, v);
    for (const name of ['position', 'aAlpha', 'aEdge']) {
      const attribute = this.geometry.attributes[name];
      attribute.clearUpdateRanges();
      attribute.addUpdateRange(0, v * attribute.itemSize);
      attribute.needsUpdate = true;
    }
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.geometry.dispose();
    this.material.dispose();
  }
}
