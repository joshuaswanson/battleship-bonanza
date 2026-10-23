import * as THREE from 'three';
import { waveHeight, isWater } from './water.js';
import { HULL_L } from './boatModel.js';

const LIFE = 1.7;
const MAX_POINTS = 40;
const STRIPS = 3;
const MAX_VERTS = 8 * MAX_POINTS * STRIPS * 6;

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
    const strips = [
      { side: -1, arm: true },
      { side: 1, arm: true },
      { side: 0, arm: false },
    ];
    for (const trail of this.trails.values()) {
      for (let i = 0; i < trail.length - 1; i++) {
        const a = trail[i];
        const b = trail[i + 1];
        if (a.cut) continue;
        const ends = [a, b].map((p) => {
          const age = time - p.t;
          const u = Math.min(1, age / LIFE);
          return { p, u, age, y: waveHeight(p.x, p.z, time) + 0.06 };
        });
        if (Math.abs(ends[0].y - ends[1].y) > 1.5) continue;
        for (const strip of strips) {
          if (v + 6 > MAX_VERTS) break;
          const edgesOf = ({ p, u, age }) => {
            if (strip.arm) {
              const center = strip.side * (1.5 + p.speed * 15 * age);
              const half = 0.45 + 1.2 * u;
              const alpha = Math.pow(1 - u, 1.1) * (0.6 + 0.6 * p.speed);
              return { inner: center - half, outer: center + half, alpha };
            }
            const half = 1.5 + 2.5 * u;
            return { inner: -half, outer: half, alpha: Math.pow(1 - u, 2.5) * (0.5 + 0.6 * p.speed) };
          };
          const ea = edgesOf(ends[0]);
          const eb = edgesOf(ends[1]);
          const at = (end, lateral) => [end.p.x + end.p.lx * lateral, end.y, end.p.z + end.p.lz * lateral];
          const a0 = at(ends[0], ea.inner);
          const a1 = at(ends[0], ea.outer);
          const b0 = at(ends[1], eb.inner);
          const b1 = at(ends[1], eb.outer);
          put(...a0, ea.alpha, -1);
          put(...b0, eb.alpha, -1);
          put(...a1, ea.alpha, 1);
          put(...a1, ea.alpha, 1);
          put(...b0, eb.alpha, -1);
          put(...b1, eb.alpha, 1);
        }
      }
    }
    this.geometry.setDrawRange(0, v);
    for (const name of ['position', 'aAlpha', 'aEdge']) this.geometry.attributes[name].needsUpdate = true;
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.geometry.dispose();
    this.material.dispose();
  }
}
