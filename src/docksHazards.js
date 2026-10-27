import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { toon, outlined, outlineMaterial } from './toon.js';
import { CONTAINER, CONTAINER_GEOMETRY } from './docksProps.js';
import { FLAME_REACH } from './race/shared.js';

const SLICK_GRIP = 0.16;
const DRUM_REACH = 8.5;
const DRUM_SIZE = 1.9;
const DRUM_RESPAWN = 25;
const BRIDGE_HEIGHT = 7;
const BRIDGE_WIDTH = 7;
const BRIDGE_CYCLE = [5, 2, 5, 2];
const BRIDGE_OPEN = 1.25;
const LOAD_BOTTOM = 1;
export const SEARCH_BEAM = 8;
export const SEARCH_POOL = 16;

const SLICK_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uAmp;
  attribute float aBurn;
  attribute float aSeed;
  varying vec2 vLocal;
  varying vec3 vWorld;
  varying float vBurn;
  varying float vSeed;
  #include <common>
  #include <fog_pars_vertex>
  void main() {
    vLocal = position.xz;
    vBurn = aBurn;
    vSeed = aSeed;
    vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
    float a = world.x * 0.06 + uTime * 1.3;
    float b = world.z * 0.08 - uTime * 1.1;
    float c = (world.x + world.z) * 0.13 + uTime * 2.0;
    world.y += (0.45 * sin(a) + 0.35 * sin(b) + 0.2 * sin(c)) * uAmp + 0.08;
    vWorld = world.xyz;
    vec4 mvPosition = viewMatrix * world;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const SLICK_FRAG = /* glsl */ `
  uniform float uTime;
  varying vec2 vLocal;
  varying vec3 vWorld;
  varying float vBurn;
  varying float vSeed;
  #include <common>
  #include <fog_pars_fragment>
  void main() {
    float ang = atan(vLocal.y, vLocal.x);
    float r = length(vLocal);
    float edge = 0.84 + 0.09 * sin(ang * 3.0 + vSeed * 6.0) + 0.05 * sin(ang * 7.0 + vSeed * 13.0);
    if (r > edge) discard;
    vec2 o = vWorld.xz * 0.2;
    float swirl = sin(o.x * 1.3 + sin(o.y * 1.7 + uTime * 0.2) * 1.6) * sin(o.y * 1.1 + sin(o.x * 1.4 - uTime * 0.15) * 1.8);
    float band = floor(fract(swirl * 1.3 + r * 1.6 + vSeed) * 6.0) / 6.0;
    vec3 sheen = 0.5 + 0.5 * cos(6.2831 * (band + vec3(0.0, 0.33, 0.67)));
    vec3 oil = mix(vec3(0.04, 0.04, 0.05), sheen * 0.45, 0.3);
    oil = mix(oil, vec3(0.02), smoothstep(edge - 0.1, edge, r) * 0.7);
    float flicker = 0.7 + 0.3 * sin(uTime * 19.0 + vWorld.x * 0.9) * sin(uTime * 13.0 + vWorld.z * 1.1);
    vec3 fire = mix(vec3(0.9, 0.22, 0.03), vec3(1.0, 0.8, 0.3), flicker * (1.0 - r * 0.8));
    oil = mix(oil, fire, vBurn);
    gl_FragColor = vec4(oil, mix(0.86, 0.95, vBurn));
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

function drumGeometry() {
  const paint = (g, hex) => {
    const c = new THREE.Color(hex);
    const flat = g.toNonIndexed();
    flat.deleteAttribute('uv');
    const n = flat.attributes.position.count;
    flat.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: n * 3 }, (_, k) => [c.r, c.g, c.b][k % 3]), 3));
    return flat;
  };
  const cyl = (r, h, y, hex) => paint(new THREE.CylinderGeometry(r, r, h, 14).translate(0, y, 0), hex);
  return mergeGeometries([
    cyl(0.62, 1.5, 0, 0xc23a26),
    cyl(0.66, 0.1, 0.42, 0x2a2b30),
    cyl(0.66, 0.1, -0.42, 0x2a2b30),
    cyl(0.635, 0.34, 0, 0xf0c23a),
    cyl(0.5, 0.06, 0.78, 0x8a2618),
  ]);
}

const smooth = (u) => u * u * (3 - 2 * u);

export class DockHazards {
  constructor({ group, track, lights, rand, amp, gantries, sweepers, bridge }) {
    this.track = track;
    this.lights = lights;
    this.group = new THREE.Group();
    group.add(this.group);
    this.clock = null;
    this.frozen = false;
    this.pending = [];
    this.obstacles = [];
    this.buildSlicks(rand, amp);
    this.buildDrums(rand);
    this.gantries = gantries.map((g) => this.buildGantry(g, rand));
    this.sweepers = sweepers.map((s) => ({ ...s, aim: new THREE.Vector3(s.head.x, 0, s.head.z) }));
    this.bridge = bridge ? this.buildBridge(bridge) : null;
  }

  spot(f, lateral, routeId) {
    const t = this.track;
    const route = t.routes[routeId];
    const idx = route ? route.first + Math.round(f * route.count) : t.wrap(Math.round(f * t.N));
    return { idx, p: t.point(idx, lateral * t.hw[idx]) };
  }

  buildSlicks(rand, amp) {
    const spots = [[0.055, 0.45], [0.2, -0.4], [0.29, 0.35], [0.44, -0.3], [0.62, 0.4], [0.705, -0.45], [0.845, 0.35], [0.935, -0.5], [0.3, 0.3, 0], [0.75, -0.3, 0]];
    this.slicks = spots.map(([f, lateral, routeId]) => {
      const { p } = this.spot(f, lateral, routeId);
      return { x: p.x, z: p.z, r: 8 + rand() * 5, burn: 0, igniter: null };
    });
    const geometry = new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2);
    const seeds = new Float32Array(this.slicks.length);
    this.slickBurn = new THREE.InstancedBufferAttribute(new Float32Array(this.slicks.length), 1);
    this.slickBurn.setUsage(THREE.DynamicDrawUsage);
    this.slicks.forEach((_, k) => (seeds[k] = rand()));
    geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
    geometry.setAttribute('aBurn', this.slickBurn);
    this.slickMaterial = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uAmp: { value: amp } }]),
      vertexShader: SLICK_VERT,
      fragmentShader: SLICK_FRAG,
      transparent: true,
      depthWrite: false,
      fog: true,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    });
    const mesh = new THREE.InstancedMesh(geometry, this.slickMaterial, this.slicks.length);
    this.slicks.forEach((s, k) => mesh.setMatrixAt(k, new THREE.Matrix4().compose(new THREE.Vector3(s.x, 0, s.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * 6), new THREE.Vector3(s.r, 1, s.r))));
    mesh.computeBoundingSphere();
    mesh.renderOrder = 1;
    this.group.add(mesh);
  }

  buildDrums(rand) {
    const t = this.track;
    this.drums = [];
    for (let k = 0; k < 9; k++) {
      const f = (k + 0.3 + rand() * 0.4) / 9;
      const lateral = (rand() - 0.5) * 1.3;
      const idx = t.wrap(Math.round(f * t.N));
      const base = t.point(idx, lateral * t.hw[idx]);
      const count = 1 + Math.floor(rand() * 3);
      for (let n = 0; n < count; n++) {
        const a = rand() * Math.PI * 2;
        this.drums.push({ x: base.x + Math.cos(a) * n * 4.2, z: base.z + Math.sin(a) * n * 4.2, alive: true, timer: 0, fuse: 0, owner: null, phase: rand() * 6, grow: 1 });
      }
    }
    const r = t.routes[0];
    if (r) {
      const p = t.point(r.first + Math.round(r.count * 0.62), r.halfWidth * 0.3);
      this.drums.push({ x: p.x, z: p.z, alive: true, timer: 0, fuse: 0, owner: null, phase: 1, grow: 1 });
    }
    const geometry = drumGeometry();
    this.drumMesh = new THREE.InstancedMesh(geometry, toon(0xffffff, { vertexColors: true }), this.drums.length);
    this.drumLines = new THREE.InstancedMesh(geometry, outlineMaterial(0.06), this.drums.length);
    this.drumLines.instanceMatrix = this.drumMesh.instanceMatrix;
    for (const m of [this.drumMesh, this.drumLines]) {
      m.frustumCulled = false;
      this.group.add(m);
    }
    this.drumMatrix = new THREE.Matrix4();
  }

  buildGantry(g, rand) {
    const root = new THREE.Group();
    root.position.set(g.x, g.y, g.z);
    root.rotation.y = g.yaw;
    const trolley = new THREE.Group();
    root.add(trolley);
    const steel = toon(0x34383e);
    const add = (parent, geometry, material, x, y, z, sx, sy, sz, line = 0.05) => {
      const mesh = outlined(geometry, material, line);
      mesh.position.set(x, y, z);
      mesh.scale.set(sx, sy, sz);
      parent.add(mesh);
      return mesh;
    };
    const box = new THREE.BoxGeometry(1, 1, 1);
    add(trolley, box, steel, 0, g.height + 6, 0, 8, 3, 8.4);
    add(trolley, box, toon(0xe3ded3), -1, g.height + 8.4, 0, 4, 1.8, 4);
    const top = g.height + 4.4;
    const water = -g.y;
    const hookY = water + LOAD_BOTTOM + CONTAINER.height + 0.6;
    const ropes = [];
    for (const lz of [-1.4, 1.4]) for (const lx of [-3, 3]) ropes.push(add(trolley, box, toon(0x9aa0a8), lx, (top + hookY) / 2, lz, 0.1, top - hookY, 0.1, 0));
    const load = new THREE.Group();
    load.position.y = top;
    trolley.add(load);
    add(load, box, toon(0xe2b62f), 0, hookY + 0.3 - top, 0, 12.6, 0.6, 2.6);
    const paints = [0xb3412f, 0x2f5e9e, 0x3f7d4f, 0xd9772b, 0x2f8a87];
    const crate = outlined(CONTAINER_GEOMETRY, toon(paints[Math.floor(rand() * paints.length)]), 0.06);
    crate.position.set(0, water + LOAD_BOTTOM - top, 0);
    load.add(crate);
    this.group.add(root);
    const reach = g.reach;
    return { ...g, root, trolley, load, reach, phase: rand() * 6, speed: (Math.PI * 2) / (8 + rand() * 4), lx: 0, vx: 0, ax: 0 };
  }

  buildBridge(b) {
    const t = this.track;
    const idx = b.idx;
    const hw = t.hw[idx];
    const p = t.point(idx);
    const root = new THREE.Group();
    root.position.set(p.x, 0, p.z);
    root.rotation.y = t.heading(idx);
    const deck = toon(0x5a6068);
    const stripe = toon(0xe2b62f);
    const tower = toon(0x7c7d80);
    const box = new THREE.BoxGeometry(1, 1, 1);
    const length = hw + 1.2;
    const leaves = [-1, 1].map((side) => {
      const pivot = new THREE.Group();
      pivot.position.set(side * (hw + 1), BRIDGE_HEIGHT, 0);
      const leaf = new THREE.Group();
      leaf.scale.x = -side;
      pivot.add(leaf);
      const slab = outlined(box, deck, 0.05);
      slab.position.set(length / 2, 0, 0);
      slab.scale.set(length, 0.9, BRIDGE_WIDTH);
      leaf.add(slab);
      for (const z of [-1, 1]) {
        const rail = outlined(box, stripe, 0.04);
        rail.position.set(length / 2, 1, z * (BRIDGE_WIDTH / 2 - 0.2));
        rail.scale.set(length, 0.25, 0.25);
        leaf.add(rail);
        for (let x = 1; x < length; x += 2.5) {
          const post = outlined(box, stripe, 0);
          post.position.set(x, 0.6, z * (BRIDGE_WIDTH / 2 - 0.2));
          post.scale.set(0.18, 0.9, 0.18);
          leaf.add(post);
        }
      }
      const weight = outlined(box, tower, 0.05);
      weight.position.set(-3, -1.5, 0);
      weight.scale.set(4, 3, BRIDGE_WIDTH - 1);
      leaf.add(weight);
      root.add(pivot);
      const pier = outlined(box, tower, 0.05);
      pier.position.set(side * (hw + 4.5), BRIDGE_HEIGHT / 2, 0);
      pier.scale.set(6, BRIDGE_HEIGHT - 0.5, BRIDGE_WIDTH + 1);
      root.add(pier);
      const hut = outlined(box, toon(0xe3ded3), 0.05);
      hut.position.set(side * (hw + 5), BRIDGE_HEIGHT + 2.25, side * 5.5);
      hut.scale.set(4, 5, 3.6);
      root.add(hut);
      return { pivot, side };
    });
    const lampGeometry = new THREE.SphereGeometry(0.5, 10, 8);
    const lamps = [];
    for (const side of [-1, 1]) {
      for (const z of [-1, 1]) {
        const lamp = new THREE.Mesh(lampGeometry, new THREE.MeshBasicMaterial({ color: 0xff3b30, fog: false }));
        lamp.position.set(side * (hw + 2), BRIDGE_HEIGHT + 3, z * (BRIDGE_WIDTH / 2 + 0.8));
        root.add(lamp);
        const pole = outlined(box, toon(0x34383e), 0);
        pole.position.set(side * (hw + 2), BRIDGE_HEIGHT + 1.3, z * (BRIDGE_WIDTH / 2 + 0.8));
        pole.scale.set(0.2, 3, 0.2);
        root.add(pole);
        lamps.push(lamp);
      }
    }
    this.group.add(root);
    return { idx, hw, length, x: p.x, z: p.z, heading: t.heading(idx), root, leaves, lamps, angle: 0, moving: false };
  }

  reset(race) {
    for (const d of this.drums) Object.assign(d, { alive: true, timer: 0, fuse: 0, owner: null, grow: 1 });
    for (const s of this.slicks) Object.assign(s, { burn: 0, igniter: null });
    this.pending.length = 0;
    for (const b of race.boats) b.grip = 1;
  }

  animate(worldTime, dt) {
    const time = this.clock ?? worldTime;
    this.slickMaterial.uniforms.uTime.value = time;
    this.slicks.forEach((s, k) => this.slickBurn.setX(k, Math.min(1, s.burn * 1.5)));
    this.slickBurn.needsUpdate = true;
    this.animateDrums(time, dt);
    for (const g of this.gantries) this.animateGantry(g, time, dt);
    if (this.bridge) this.animateBridge(time);
    this.animateSweepers(time, dt);
  }

  animateDrums(time, dt) {
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    this.drums.forEach((d, k) => {
      if (d.alive && d.grow < 1) d.grow = Math.min(1, d.grow + dt * 1.5);
      const s = (d.alive ? d.grow : 0) * DRUM_SIZE;
      const bob = Math.sin(time * 1.7 + d.phase) * 0.18;
      e.set(Math.sin(time * 1.1 + d.phase) * 0.12, d.phase, Math.cos(time * 0.9 + d.phase) * 0.12);
      this.drumMatrix.compose(new THREE.Vector3(d.x, 0.65 + bob, d.z), q.setFromEuler(e), new THREE.Vector3(s, s, s));
      this.drumMesh.setMatrixAt(k, this.drumMatrix);
    });
    this.drumMesh.instanceMatrix.needsUpdate = true;
  }

  animateGantry(g, time, dt) {
    const lx = Math.sin(time * g.speed + g.phase) * g.reach;
    const vx = (lx - g.lx) / Math.max(dt, 1e-3);
    g.ax = (vx - g.vx) / Math.max(dt, 1e-3);
    g.lx = lx;
    g.vx = vx;
    g.trolley.position.x = lx;
    g.load.rotation.z += (THREE.MathUtils.clamp(-g.ax * 0.004, -0.08, 0.08) - g.load.rotation.z) * Math.min(1, dt * 3);
  }

  bridgeAngle(time) {
    const total = BRIDGE_CYCLE.reduce((a, b) => a + b, 0);
    let u = time % total;
    const [open, lower, shut] = BRIDGE_CYCLE;
    if (u < open) return { angle: BRIDGE_OPEN, moving: false };
    u -= open;
    if (u < lower) return { angle: BRIDGE_OPEN * (1 - smooth(u / lower)), moving: true };
    u -= lower;
    if (u < shut) return { angle: 0, moving: false };
    u -= shut;
    return { angle: BRIDGE_OPEN * smooth(u / BRIDGE_CYCLE[3]), moving: true };
  }

  animateBridge(time) {
    const b = this.bridge;
    const { angle, moving } = this.bridgeAngle(time);
    b.angle = angle;
    b.moving = moving;
    for (const { pivot, side } of b.leaves) pivot.rotation.z = side * -angle;
    const open = angle > BRIDGE_OPEN * 0.95;
    const blink = Math.floor(time * 3) % 2 === 0;
    for (const lamp of b.lamps) {
      lamp.material.color.set(open ? 0x3ddc6f : 0xff3b30);
      lamp.visible = open || !moving || blink;
    }
  }

  sweep(s, time, dt) {
    const t = this.track;
    const a = time * s.speed + s.phase;
    const idx = t.wrap(s.idx + Math.round((Math.sin(a) * 55) / t.spacing));
    const p = t.point(idx, Math.sin(a * 1.7) * t.hw[idx] * 0.75);
    s.aim.lerp(new THREE.Vector3(p.x, 0, p.z), Math.min(1, dt * 3));
  }

  animateSweepers(time, dt) {
    for (const s of this.sweepers) {
      if (!this.frozen) this.sweep(s, time, dt);
      this.lights.placeBeam(s.beam, s.head, s.aim, SEARCH_BEAM);
      this.lights.placePool(s.pool, s.aim.x, 0.5, s.aim.z, SEARCH_POOL);
    }
    if (this.sweepers.length) {
      this.lights.beamMesh.instanceMatrix.needsUpdate = true;
      this.lights.poolMesh.instanceMatrix.needsUpdate = true;
    }
  }

  snapshot() {
    const out = new Float32Array(this.drums.length * 2 + this.slicks.length + this.sweepers.length * 2);
    let o = 0;
    for (const d of this.drums) {
      out[o++] = d.alive ? 1 : 0;
      out[o++] = d.grow;
    }
    for (const s of this.slicks) out[o++] = s.burn;
    for (const s of this.sweepers) {
      out[o++] = s.aim.x;
      out[o++] = s.aim.z;
    }
    return out;
  }

  restore(data, clock) {
    let o = 0;
    for (const d of this.drums) {
      d.alive = data[o++] > 0.5;
      d.grow = data[o++];
    }
    for (const s of this.slicks) s.burn = data[o++];
    for (const s of this.sweepers) s.aim.set(data[o++], 0, data[o++]);
    this.clock = clock;
    this.frozen = true;
  }

  play(race, dt) {
    this.clock = race.time;
    this.frozen = false;
    const blasts = [...race.blasts, ...this.pending];
    this.pending.length = 0;
    this.playSlicks(race, dt, blasts);
    this.playDrums(race, dt, blasts);
    for (const g of this.gantries) this.playGantry(race, g);
    if (this.bridge) this.playBridge(race);
    this.listObstacles();
  }

  listObstacles() {
    const list = this.obstacles;
    list.length = 0;
    for (const g of this.gantries) {
      const c = Math.cos(g.yaw);
      const s = Math.sin(g.yaw);
      for (const k of [-1, 0, 1]) list.push({ x: g.x + (g.lx + k * 4) * c, z: g.z - (g.lx + k * 4) * s, r: 3.5 });
    }
    for (const d of this.drums) if (d.alive) list.push({ x: d.x, z: d.z, r: 1.4 * DRUM_SIZE, drum: true });
    for (const s of this.slicks) if (s.burn > 0) list.push({ x: s.x, z: s.z, r: s.r * 0.85 });
  }

  flamesHit(race, x, z, r) {
    for (const b of race.boats) {
      const f = b.flameRay;
      if (!f || race.time - f.time > 0.05) continue;
      for (let d = 1; d <= FLAME_REACH; d += 1.5) {
        if (Math.hypot(f.x + f.dx * d - x, f.z + f.dz * d - z) < r) return b;
      }
    }
    return null;
  }

  playSlicks(race, dt, blasts) {
    const fx = race.fx;
    for (const s of this.slicks) {
      const reach = s.r * 0.85;
      if (s.burn > 0) {
        s.burn = Math.max(0, s.burn - dt / 7);
        for (let k = 0; k < 4; k++) {
          const a = Math.random() * Math.PI * 2;
          const d = Math.sqrt(Math.random()) * reach;
          fx.flame(s.x + Math.cos(a) * d, 0.5, s.z + Math.sin(a) * d, 0, 5 + Math.random() * 4, 0);
        }
        if (Math.random() < 0.3) fx.blackSmoke(s.x + (Math.random() - 0.5) * reach, 3, s.z + (Math.random() - 0.5) * reach, { x: 0, z: 0 });
        continue;
      }
      let igniter = null;
      for (const blast of blasts) if (Math.hypot(blast.x - s.x, blast.z - s.z) < reach + 6) igniter = blast.owner;
      igniter ??= this.flamesHit(race, s.x, s.z, reach);
      for (const b of race.boats) if (b.alive && b.burn && Math.hypot(b.pos.x - s.x, b.pos.z - s.z) < reach) igniter = b.burn.source;
      if (igniter) {
        s.burn = 1;
        s.igniter = igniter;
        race.sfx.play('ignite', { x: s.x, y: 0, z: s.z });
        fx.explosion(s.x, 0.6, s.z, 0.6);
      }
    }
    for (const b of race.boats) {
      let grip = 1;
      if (b.alive && !b.air) {
        for (const s of this.slicks) {
          if (Math.hypot(b.pos.x - s.x, b.pos.z - s.z) > s.r * 0.85) continue;
          grip = SLICK_GRIP;
          if (s.burn > 0 && !(b.burn?.time > 0.5)) race.ignite(b, s.igniter ?? b);
        }
      }
      b.grip = (b.grip ?? 1) + (grip - (b.grip ?? 1)) * Math.min(1, dt * (grip < 1 ? 10 : 2));
    }
  }

  playDrums(race, dt, blasts) {
    for (const d of this.drums) {
      if (!d.alive) {
        d.timer -= dt;
        if (d.timer <= 0 && race.boats.every((b) => Math.hypot(b.pos.x - d.x, b.pos.z - d.z) > 12)) {
          d.alive = true;
          d.grow = 0;
          d.owner = null;
        }
        continue;
      }
      if (d.fuse > 0) {
        d.fuse -= dt;
        if (d.fuse <= 0) this.detonate(race, d, d.owner);
        continue;
      }
      for (const blast of blasts) {
        if (Math.hypot(blast.x - d.x, blast.z - d.z) < DRUM_REACH) {
          d.fuse = 0.12 + Math.random() * 0.1;
          d.owner = blast.owner;
        }
      }
      if (d.fuse > 0) continue;
      const flamer = this.flamesHit(race, d.x, d.z, 2.6);
      if (flamer) {
        d.fuse = 0.4;
        d.owner = flamer;
        continue;
      }
      let hit = null;
      for (const bullet of race.bullets) {
        if (Math.hypot(bullet.pos.x - d.x, bullet.pos.z - d.z) < 1.4 * DRUM_SIZE && bullet.pos.y < 3.6) hit = bullet.owner;
      }
      if (hit) {
        this.detonate(race, d, hit);
        continue;
      }
      for (const b of race.boats) {
        if (!b.alive || b.yOffset > 1.6) continue;
        if (b.distanceToAxis2D(d.x, d.z) < 1.4 + 0.65 * DRUM_SIZE) {
          this.detonate(race, d, d.owner ?? b);
          break;
        }
      }
    }
  }

  detonate(race, d, owner) {
    d.alive = false;
    d.timer = DRUM_RESPAWN;
    d.fuse = 0;
    race.fx.explosion(d.x, 1.2, d.z, 1.7);
    race.fx.column(d.x, 1, d.z, { x: 0, z: 0 }, 1.2);
    race.sfx.play('mineBoom', { x: d.x, y: 0, z: d.z });
    this.pending.push({ x: d.x, z: d.z, owner });
    for (const o of race.boats) {
      if (!o.alive) continue;
      const dx = o.pos.x - d.x;
      const dz = o.pos.z - d.z;
      const dist = Math.hypot(dx, dz);
      if (dist > DRUM_REACH || o.yOffset > 4) continue;
      const near = 1 - dist / DRUM_REACH;
      const source = owner && owner.alive !== undefined ? owner : o;
      const push = 10 * near / Math.max(dist, 0.5);
      race.damage(o, 14 + 18 * near, source, source === o ? 'drum' : 'mine', { knockX: dx * push, knockZ: dz * push, spin: 0.9, launch: 0.6 + near * 0.5 });
      if (o.isPlayer) race.emit('lockShake', { amount: 1.4 * near + 0.4 });
    }
  }

  playGantry(race, g) {
    const c = Math.cos(g.yaw);
    const s = Math.sin(g.yaw);
    const cx = g.x + g.lx * c;
    const cz = g.z - g.lx * s;
    for (const b of race.boats) {
      if (!b.alive || b.yOffset > LOAD_BOTTOM + CONTAINER.height + 0.6) continue;
      if (race.time < (b.craneHit ?? 0)) continue;
      const rx = b.pos.x - cx;
      const rz = b.pos.z - cz;
      const across = rx * c - rz * s;
      const along = rx * s + rz * c;
      const reachAlong = CONTAINER.width / 2 + 2;
      if (Math.abs(across) > CONTAINER.long / 2 + 1.4 || Math.abs(along) > reachAlong) continue;
      const sgn = Math.sign(along) || 1;
      const out = reachAlong - Math.abs(along) + 0.2;
      b.pos.x += s * sgn * out;
      b.pos.z += c * sgn * out;
      const vn = (b.vel.x * s + b.vel.z * c) * sgn;
      if (vn < 0) {
        b.vel.x -= s * sgn * vn * 1.6;
        b.vel.z -= c * sgn * vn * 1.6;
      }
      b.vel.x += c * g.vx * 0.8;
      b.vel.z -= s * g.vx * 0.8;
      b.speed *= 0.55;
      b.craneHit = race.time + 0.6;
      if (b.spinTime <= 0) {
        b.spinTime = 0.8;
        b.spinDur = 0.8;
      }
      b.bump(6);
      const p = b.center();
      race.fx.sparkBurst(p.x, p.y + 1, p.z, 0xffe066, 16);
      race.sfx.play('clank', b.pos);
      if (b.isPlayer) race.emit('lockShake', { amount: 1 });
    }
  }

  playBridge(race) {
    const br = this.bridge;
    const fx = Math.sin(br.heading);
    const fz = Math.cos(br.heading);
    const tan = Math.tan(br.angle);
    const reach = br.length * Math.cos(br.angle);
    for (const b of race.boats) {
      if (!b.alive || race.time < (b.bridgeHit ?? 0)) continue;
      const rx = b.pos.x - br.x;
      const rz = b.pos.z - br.z;
      const along = rx * fx + rz * fz;
      if (Math.abs(along) > BRIDGE_WIDTH / 2 + 1.4) continue;
      const lateral = Math.abs(rx * fz - rz * fx);
      const fromHinge = br.hw + 1 - lateral;
      if (fromHinge < 0 || fromHinge > reach) continue;
      const under = BRIDGE_HEIGHT - 0.45 + fromHinge * tan;
      const top = b.yOffset + 2.6;
      if (top < under || b.yOffset > under + 1.3) continue;
      const moving = Math.sign(b.vel.x * fx + b.vel.z * fz) || Math.sign(-along) || 1;
      const back = BRIDGE_WIDTH / 2 + 1.6 - Math.abs(along);
      b.pos.x -= fx * moving * back;
      b.pos.z -= fz * moving * back;
      const vn = b.vel.x * fx + b.vel.z * fz;
      b.vel.x -= fx * vn * 1.3;
      b.vel.z -= fz * vn * 1.3;
      b.speed *= 0.35;
      if (b.air && !b.air.fall) b.air = { fall: true, y: (b.surfaceLevel ?? 0) + b.yOffset, vy: -3 };
      if (b.spinTime <= 0) {
        b.spinTime = 0.6;
        b.spinDur = 0.6;
      }
      b.bump(8);
      b.bridgeHit = race.time + 0.8;
      const p = b.center();
      race.fx.sparkBurst(p.x, p.y + 2, p.z, 0xffffff, 18);
      race.sfx.play('clank', b.pos);
      if (b.isPlayer) race.emit('lockShake', { amount: 1.3 });
    }
  }
}
