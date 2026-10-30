import * as THREE from 'three';
import { waveHeight, isWater } from './water.js';

const MAX_QUADS = 9000;
const STEP = 1.8;
const LIFE = 26;
const WIDTH = 0.62;
const TRACK = 2.3;
const AXLE = 3.05;

const VERT = /* glsl */ `
  attribute float aBorn;
  attribute float aDepth;
  attribute vec2 aMark;
  uniform float uTime;
  varying float vFade;
  varying float vDepth;
  varying vec2 vMark;
  #include <common>
  #include <fog_pars_vertex>
  void main() {
    vFade = 1.0 - smoothstep(${(LIFE * 0.6).toFixed(1)}, ${LIFE.toFixed(1)}, uTime - aBorn);
    vDepth = aDepth;
    vMark = aMark;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const FRAG = /* glsl */ `
  varying float vFade;
  varying float vDepth;
  varying vec2 vMark;
  #include <common>
  #include <fog_pars_fragment>
  void main() {
    float edge = 1.0 - smoothstep(0.72, 1.0, abs(vMark.y));
    float chevron = step(0.46, fract(vMark.x * 1.5 + abs(vMark.y) * 0.7));
    float strength = vDepth * vFade * edge * mix(0.62, 1.0, chevron);
    if (strength < 0.04) discard;
    vec3 color = mix(vec3(0.42, 0.28, 0.16), vec3(0.2, 0.13, 0.08), vDepth);
    gl_FragColor = vec4(color, min(0.92, strength * 1.25));
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

export class TireMarks {
  constructor(scene) {
    this.scene = scene;
    const verts = MAX_QUADS * 6;
    this.positions = new Float32Array(verts * 3);
    this.born = new Float32Array(verts).fill(-1000);
    this.depth = new Float32Array(verts);
    this.marks = new Float32Array(verts * 2);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aBorn', new THREE.BufferAttribute(this.born, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aDepth', new THREE.BufferAttribute(this.depth, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aMark', new THREE.BufferAttribute(this.marks, 2).setUsage(THREE.DynamicDrawUsage));
    this.geometry = g;
    this.material = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 } }]),
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      fog: true,
      polygonOffset: true,
      polygonOffsetFactor: -3,
    });
    this.mesh = new THREE.Mesh(g, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    scene.add(this.mesh);
    this.next = 0;
    this.trails = new Map();
    this.dirty = false;
  }

  quad(a, b, time, depthA, depthB) {
    const i = this.next * 6;
    this.next = (this.next + 1) % MAX_QUADS;
    const corners = [[a.lx, a.ly, a.lz, -1, a.run, depthA], [b.lx, b.ly, b.lz, -1, b.run, depthB], [a.rx, a.ly, a.rz, 1, a.run, depthA], [a.rx, a.ly, a.rz, 1, a.run, depthA], [b.lx, b.ly, b.lz, -1, b.run, depthB], [b.rx, b.ly, b.rz, 1, b.run, depthB]];
    corners.forEach(([x, y, z, side, run, depth], k) => {
      const v = i + k;
      this.positions[v * 3] = x;
      this.positions[v * 3 + 1] = y;
      this.positions[v * 3 + 2] = z;
      this.born[v] = time;
      this.depth[v] = depth;
      this.marks[v * 2] = run;
      this.marks[v * 2 + 1] = side;
    });
    this.dirty = true;
  }

  stamp(b, side, time, slip) {
    const key = side > 0 ? 'right' : 'left';
    const trails = this.trails.get(b) ?? {};
    this.trails.set(b, trails);
    const fx = Math.sin(b.heading);
    const fz = Math.cos(b.heading);
    const x = b.pos.x - fx * AXLE + fz * side * TRACK;
    const z = b.pos.z - fz * AXLE - fx * side * TRACK;
    const last = trails[key];
    if (last && Math.hypot(x - last.x, z - last.z) < STEP) return;
    if (last && Math.hypot(x - last.x, z - last.z) > STEP * 4) trails[key] = null;
    const y = waveHeight(x, z, time) + 0.2;
    const point = { x, z, lx: x - fz * WIDTH, lz: z + fx * WIDTH, rx: x + fz * WIDTH, rz: z - fx * WIDTH, ly: y, run: (last?.run ?? 0) + STEP };
    if (trails[key]) this.quad(trails[key], point, time, Math.min(1, 0.35 + slip), Math.min(1, 0.35 + slip));
    trails[key] = point;
  }

  update(boats, time) {
    this.material.uniforms.uTime.value = time;
    for (const b of boats) {
      const on = b.alive && !b.air && Math.abs(b.speed) > 3 && !isWater(b.pos.x, b.pos.z);
      if (!on) {
        this.trails.delete(b);
        continue;
      }
      const fx = Math.sin(b.heading);
      const fz = Math.cos(b.heading);
      const across = Math.abs(b.vel.x * fz - b.vel.z * fx);
      const slip = Math.min(0.65, across * 0.06 + Math.abs(b.steerVis) * 0.25);
      this.stamp(b, 1, time, slip);
      this.stamp(b, -1, time, slip);
    }
    if (!this.dirty) return;
    this.dirty = false;
    for (const attribute of Object.values(this.geometry.attributes)) attribute.needsUpdate = true;
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.geometry.dispose();
    this.material.dispose();
  }
}
