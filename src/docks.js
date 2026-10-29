import * as THREE from 'three';
import { Collider } from './collider.js';
import { createWater } from './water.js';
import { toon, mulberry32 } from './toon.js';
import { Batcher, cullChunks, slicer, COLORS, mat, createSky, createArch } from './world.js';
import { DockHazards, SEARCH_BEAM, SEARCH_POOL } from './docksHazards.js';
import { courseSurface, buildHeightfield, courseBuoys, noise } from './terrain.js';
import { DOCK_COLORS, GLOW_COLORS, CONTAINER, Decals, containerStack, quayCrane, goliathCrane, cargoShip, warehouse, oilTank, floodMast, bollard, drums, pallets, chimney, pipeBridge } from './docksProps.js';

const COLORS_ALL = { ...COLORS, ...DOCK_COLORS, ...GLOW_COLORS };
const QUAY_TOP = 2.2;
const WALK = 5;
export const SKY_TOP = 0x04061a;
export const SKY_HORIZON = 0x1b1530;
export const HAZE = 0x0f0f1e;

const BEAM_VERT = /* glsl */ `
  varying float vAlong;
  varying float vFacing;
  varying vec3 vTint;
  #include <common>
  #include <fog_pars_vertex>
  void main() {
    vAlong = -position.y;
    vec4 local = vec4(position, 1.0);
    vec3 n = normal;
    #ifdef USE_INSTANCING
      local = instanceMatrix * local;
      n = mat3(instanceMatrix) * n;
    #endif
    vTint = vec3(1.0);
    #ifdef USE_INSTANCING_COLOR
      vTint = instanceColor;
    #endif
    vec4 mvPosition = modelViewMatrix * local;
    vec3 viewN = normalize(normalMatrix * n);
    vFacing = abs(dot(viewN, normalize(-mvPosition.xyz)));
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const BEAM_FRAG = /* glsl */ `
  uniform float uStrength;
  varying float vAlong;
  varying float vFacing;
  varying vec3 vTint;
  #include <common>
  #include <fog_pars_fragment>
  void main() {
    float fade = pow(1.0 - clamp(vAlong, 0.0, 1.0), 1.6) * pow(vFacing, 1.4);
    #ifdef USE_FOG
      fade *= 1.0 - smoothstep(fogNear, fogFar, vFogDepth);
    #endif
    gl_FragColor = vec4(vTint * fade * uStrength, 1.0);
  }
`;

const POOL_VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vTint;
  #include <common>
  #include <fog_pars_vertex>
  void main() {
    vUv = uv * 2.0 - 1.0;
    vec4 local = vec4(position, 1.0);
    #ifdef USE_INSTANCING
      local = instanceMatrix * local;
    #endif
    vTint = vec3(1.0);
    #ifdef USE_INSTANCING_COLOR
      vTint = instanceColor;
    #endif
    vec4 mvPosition = modelViewMatrix * local;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const POOL_FRAG = /* glsl */ `
  uniform float uStrength;
  varying vec2 vUv;
  varying vec3 vTint;
  #include <common>
  #include <fog_pars_fragment>
  void main() {
    float r = length(vUv);
    float fade = (1.0 - smoothstep(0.0, 1.0, r)) * (0.65 + 0.35 * (1.0 - smoothstep(0.0, 0.45, r)));
    #ifdef USE_FOG
      fade *= 1.0 - smoothstep(fogNear, fogFar, vFogDepth);
    #endif
    gl_FragColor = vec4(vTint * fade * uStrength, 1.0);
  }
`;

function additive(vertexShader, fragmentShader, strength) {
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uStrength: { value: strength } }]),
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: true,
  });
}

const DRUM = new THREE.CylinderGeometry(1, 1, 1, 8);
const TOWER = new THREE.CylinderGeometry(1, 1.4, 1, 8);
const CAP = new THREE.BoxGeometry(1, 1, 1);
const LAMP = new THREE.SphereGeometry(1, 10, 8);
const BEAM = new THREE.ConeGeometry(1, 1, 18, 1, true).translate(0, -0.5, 0);
const POOL = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
export const WARM = new THREE.Color(0xffc27a);
export const COOL = new THREE.Color(0xbcd4ff);
const SEARCH = new THREE.Color(0xe6f0ff);
const UP = new THREE.Vector3(0, 1, 0);

export class Lights {
  constructor() {
    this.beams = [];
    this.pools = [];
    this.sweepers = [];
  }

  beam(from, to, radius, color = WARM, strength = 1) {
    this.beams.push({ from: from.clone(), to: to.clone(), radius, color, strength });
    return this.beams.length - 1;
  }

  pool(x, y, z, r, color = WARM, strength = 1) {
    this.pools.push({ x, y, z, r, color, strength });
    return this.pools.length - 1;
  }

  build(group) {
    const beamMesh = new THREE.InstancedMesh(BEAM, additive(BEAM_VERT, BEAM_FRAG, 0.16), this.beams.length);
    const poolMesh = new THREE.InstancedMesh(POOL, additive(POOL_VERT, POOL_FRAG, 0.26), this.pools.length);
    this.beamMesh = beamMesh;
    this.poolMesh = poolMesh;
    this.beams.forEach((b, k) => {
      this.placeBeam(k, b.from, b.to, b.radius);
      beamMesh.setColorAt(k, b.color.clone().multiplyScalar(b.strength));
    });
    this.pools.forEach((p, k) => {
      this.placePool(k, p.x, p.y, p.z, p.r);
      poolMesh.setColorAt(k, p.color.clone().multiplyScalar(p.strength));
    });
    for (const mesh of [beamMesh, poolMesh]) {
      mesh.renderOrder = 5;
      mesh.computeBoundingSphere();
      group.add(mesh);
    }
  }

  placeBeam(k, from, to, radius) {
    const dir = new THREE.Vector3().subVectors(from, to);
    const length = dir.length();
    const q = new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize());
    this.beamMesh.setMatrixAt(k, new THREE.Matrix4().compose(from, q, new THREE.Vector3(radius, length, radius)));
  }

  placePool(k, x, y, z, r) {
    this.poolMesh.setMatrixAt(k, new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(r, 1, r)));
  }
}

function quayWalls(track, landAt) {
  const positions = [];
  const colors = [];
  const face = new THREE.Color(0x4f5054);
  const slime = new THREE.Color(0x2f3624);
  const paving = new THREE.Color(0x77787c);
  const stripe = new THREE.Color(DOCK_COLORS.hazard);
  const quad = (a, b, c, d, color) => {
    for (const v of [a, b, c, a, c, d]) {
      positions.push(v.x, v.y, v.z);
      colors.push(color.r, color.g, color.b);
    }
  };
  const P = (i, lat, y) => {
    const p = track.point(i, lat);
    return new THREE.Vector3(p.x, y, p.z);
  };
  const within = (seg, p) => {
    for (let i = seg.start; i <= seg.end; i += 2) {
      if (Math.hypot(p.x - track.px[i], p.z - track.pz[i]) < track.hw[i] - 0.5) return true;
    }
    return false;
  };
  const open = (seg, i, side) => {
    const p = track.point(i, side * track.hw[i]);
    return track.segments.some((other) => other !== seg && within(other, p));
  };
  for (const seg of track.segments) for (const side of [-1, 1]) {
    for (let i = seg.start; i <= seg.end; i++) {
      const j = seg.ring ? (i + 1) % track.N : track.next[i];
      if (!seg.ring && i === seg.end) continue;
      if (!landAt(i, side) || !landAt(j, side) || open(seg, i, side) || open(seg, j, side)) continue;
      const li = side * track.hw[i];
      const lj = side * track.hw[j];
      const si = side * (track.hw[i] + 0.6);
      const sj = side * (track.hw[j] + 0.6);
      const ri = side * (track.hw[i] + WALK);
      const rj = side * (track.hw[j] + WALK);
      quad(P(i, li, -3), P(j, lj, -3), P(j, lj, 0.6), P(i, li, 0.6), slime);
      quad(P(i, li, 0.6), P(j, lj, 0.6), P(j, lj, QUAY_TOP), P(i, li, QUAY_TOP), face);
      quad(P(i, li, QUAY_TOP), P(j, lj, QUAY_TOP), P(j, sj, QUAY_TOP), P(i, si, QUAY_TOP), stripe);
      quad(P(i, si, QUAY_TOP), P(j, sj, QUAY_TOP), P(j, rj, QUAY_TOP), P(i, ri, QUAY_TOP), paving);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, toon(0xffffff, { vertexColors: true, side: THREE.DoubleSide }));
}

export function starfield(rand) {
  const positions = [];
  for (let k = 0; k < 420; k++) {
    const a = rand() * Math.PI * 2;
    const y = 0.12 + rand() * 0.88;
    const r = Math.sqrt(1 - y * y);
    positions.push(Math.cos(a) * r * 1300, y * 1300, Math.sin(a) * r * 1300);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0xdfe6ff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.8 }));
}

export function unlit(group) {
  const flat = new THREE.MeshBasicMaterial();
  const painted = new THREE.MeshBasicMaterial({ vertexColors: true });
  group.traverse((o) => {
    if (o.isMesh) o.material = o.isInstancedMesh ? flat : painted;
  });
}

export async function createDocks(group, track, fx) {
  const tick = slicer();
  const fog = new THREE.Fog(HAZE, 150, 720);
  const sky = createSky({ top: SKY_TOP, horizon: SKY_HORIZON });
  sky.material.uniforms.uSunDir.value.set(0.2, -0.4, 0.9).normalize();
  const rand = mulberry32(5150);
  sky.add(starfield(rand));
  const moon = new THREE.Mesh(new THREE.CircleGeometry(38, 32), new THREE.MeshBasicMaterial({ color: 0xf4efd8, fog: false }));
  moon.position.set(-520, 760, -900);
  moon.lookAt(0, 0, 0);
  sky.add(moon);
  group.add(sky);
  group.add(new THREE.HemisphereLight(0x6a7cc4, 0x1c1a24, 0.5));
  const sun = new THREE.DirectionalLight(0xffb37a, 0.55);
  sun.position.set(-60, 45, 80);
  group.add(sun);
  const moonLight = new THREE.DirectionalLight(0x9db4ff, 0.5);
  moonLight.position.set(-40, 80, -60);
  group.add(moonLight);

  const N = track.N;
  const surface = await courseSurface(track, tick, { margin: 230, amp: () => 0.3 });
  const height = (x, z) => (surface.sample(x, z).edge < 1.5 ? -4 : QUAY_TOP - 0.05);
  const paint = (x, y, z, ny, color) => {
    if (y < 0) return color.set(0x2b3324);
    const edge = surface.sample(x, z).edge;
    const tile = (Math.floor(x / 7) + Math.floor(z / 7)) % 2 ? 0x6b6c70 : 0x626367;
    color.set(tile).multiplyScalar(0.9 + 0.2 * noise(x * 3, z * 3));
    const lane = Math.abs(((x + z * 0.3) % 26) + 26) % 26;
    if (edge > 9 && lane < 0.6) color.set(0xb89a3a);
  };
  group.add(await buildHeightfield({ bounds: surface.bounds, step: 3, height, paint, tick }));
  const landAt = (i, side) => {
    const p = track.point(i, side * (track.hw[i] + WALK + 1));
    return surface.sample(p.x, p.z).edge > 1.5;
  };
  group.add(quayWalls(track, landAt));

  const water = createWater({ deep: 0x10161a, shallow: 0x232d1d, foam: 0x4a4834, amp: 0.8 });
  group.add(water.mesh);

  const batch = new Batcher();
  const glow = new Batcher();
  const lights = new Lights();
  const decals = new Decals();
  const straightAt = (i) => {
    const a = track.heading(track.wrap(i - 20));
    const b = track.heading(track.wrap(i + 20));
    return Math.abs(Math.atan2(Math.sin(b - a), Math.cos(b - a))) < 0.06;
  };
  const taken = [];
  const barrels = [];
  const free = (x, z, r) => !taken.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + r);
  const shores = [];
  const blinks = [];
  const inward = (i, side) => Math.atan2(-side * track.nx[i], -side * track.nz[i]);
  const quayPoint = (i, side, extra) => track.point(i, side * (track.hw[i] + extra));
  const bridgeIdx = track.routes.length ? track.routes[0].first + Math.round(track.routes[0].count * 0.5) : -1;
  if (bridgeIdx >= 0) for (const side of [-1, 1]) {
    const p = track.point(bridgeIdx, side * (track.hw[bridgeIdx] + 5));
    taken.push({ x: p.x, z: p.z, r: 9 });
  }
  const nearRouteEnd = (x, z, d) => track.routes.some((r) => [r.from, r.to].some((k) => Math.hypot(track.px[k] - x, track.pz[k] - z) < d));
  const clearOfWater = (x, z, r) => {
    for (let a = 0; a < 6; a++) {
      const ang = (a / 6) * Math.PI * 2;
      if (surface.sample(x + Math.cos(ang) * r, z + Math.sin(ang) * r).edge < WALK) return false;
    }
    return surface.sample(x, z).edge > WALK + r * 0.5;
  };

  {
    const i = track.wrap(Math.round(0.985 * N));
    const side = -1;
    const p = track.point(i, side * (track.hw[i] - 8));
    shores.push(cargoShip(batch, glow, p.x, p.z, track.heading(i), rand, { length: 104, beam: 15, decals }));
    for (const along of [-30, 0, 30]) {
      const k = track.wrap(i + Math.round(along / track.spacing));
      const q = quayPoint(k, side, WALK + 9);
      const crane = quayCrane(batch, glow, q.x, QUAY_TOP, q.z, inward(k, side), rand, { reach: 24, color: 'craneBlue', decals });
      blinks.push(...crane.blinks);
      for (const pool of crane.pools) lights.pool(pool.x, 0.5, pool.z, pool.r, WARM, 0.9);
      taken.push(...crane.footprint);
    }
  }

  const sweepers = [];
  for (const [f, side] of [[0.1, -1], [0.27, -1], [0.45, 1], [0.66, -1], [0.79, 1], [0.93, 1]]) {
    const i = Math.round(f * N);
    const p = quayPoint(i, side, WALK + 2);
    if (!free(p.x, p.z, 3) || surface.sample(p.x, p.z).edge < 2) continue;
    batch.add('steelDark', TOWER, mat(p.x, QUAY_TOP + 15, p.z, 1, 30, 1));
    batch.add('steel', CAP, mat(p.x, QUAY_TOP + 30.5, p.z, 4, 1, 4));
    glow.add('lampCool', LAMP, mat(p.x, QUAY_TOP + 31.6, p.z, 1.3, 1.3, 1.3));
    const head = new THREE.Vector3(p.x, QUAY_TOP + 31.6, p.z);
    const beam = lights.beam(head, head.clone().add(new THREE.Vector3(0, -30, 30)), SEARCH_BEAM, SEARCH, 3.4);
    const pool = lights.pool(p.x, 0.5, p.z, SEARCH_POOL, SEARCH, 3);
    sweepers.push({ head, beam, pool, idx: i, phase: rand() * Math.PI * 2, speed: 0.35 + rand() * 0.25 });
    taken.push({ x: p.x, z: p.z, r: 3 });
  }

  for (const f of [0.135, 0.17, 0.225, 0.26, 0.64, 0.675]) {
    const i = Math.round(f * N);
    const side = 1;
    if (!landAt(i, side) || !straightAt(i)) continue;
    const q = quayPoint(i, side, WALK + 9);
    if (!free(q.x, q.z, 10)) continue;
    const crane = quayCrane(batch, glow, q.x, QUAY_TOP, q.z, inward(i, side), rand, { reach: 30, color: rand() < 0.5 ? 'craneRed' : 'craneWhite', decals });
    blinks.push(...crane.blinks);
    for (const pool of crane.pools) lights.pool(pool.x, 0.5, pool.z, pool.r, WARM, 1);
    taken.push(...crane.footprint);
  }

  const gantries = [];
  for (const f of [0.5, 0.585]) {
    const i = Math.round(f * N);
    const half = track.hw[i] + WALK + 4;
    const p = track.point(i);
    const crane = goliathCrane(batch, glow, p.x, QUAY_TOP, p.z, track.heading(i), half, 44, { decals, moving: true });
    gantries.push({ x: p.x, y: QUAY_TOP, z: p.z, yaw: track.heading(i), half, height: 44, reach: track.hw[i] - 7 });
    blinks.push(...crane.blinks);
    for (const pool of crane.pools) lights.pool(pool.x, 0.5, pool.z, pool.r, COOL, 0.8);
    for (const pool of crane.pools.filter((_, n) => n % 2 === 0)) {
      lights.beam(new THREE.Vector3(pool.x, pool.y, pool.z), new THREE.Vector3(pool.x, 0, pool.z), 7, COOL, 0.6);
    }
    taken.push(...crane.footprint);
  }

  for (const r of track.routes) {
    for (const u of [0.3, 0.68]) {
      const i = r.first + Math.round(r.count * u);
      const p = track.point(i);
      taken.push(...pipeBridge(batch, glow, p.x, QUAY_TOP, p.z, track.heading(i), track.hw[i] + WALK - 1, 13));
      lights.pool(p.x, 0.5, p.z, 8, WARM, 0.9);
    }
  }

  {
    const i = Math.round(0.74 * N);
    const side = 1;
    const base = quayPoint(i, side, WALK + 70);
    for (let k = 0; k < 9; k++) {
      const x = base.x + (k % 3 - 1) * 30 + (rand() - 0.5) * 4;
      const z = base.z + (Math.floor(k / 3) - 1) * 30 + (rand() - 0.5) * 4;
      const r = 8 + rand() * 4;
      if (!clearOfWater(x, z, r + 2) || !free(x, z, r)) continue;
      taken.push(oilTank(batch, x, QUAY_TOP, z, r, 9 + rand() * 6, rand));
    }
  }

  const smoke = [];
  {
    const i = Math.round(0.36 * N);
    const side = -1;
    const base = quayPoint(i, side, WALK + 60);
    for (let k = 0; k < 3; k++) {
      const x = base.x + (k - 1) * 14;
      const z = base.z + (k % 2) * 8;
      if (!clearOfWater(x, z, 6) || !free(x, z, 4)) continue;
      smoke.push(chimney(batch, x, QUAY_TOP, z, 46 + k * 6));
      taken.push({ x, z, r: 5 });
    }
    if (smoke.length) {
      const x = base.x;
      const z = base.z - 26;
      if (clearOfWater(x, z, 22) && free(x, z, 20)) taken.push(warehouse(batch, glow, x, QUAY_TOP, z, inward(i, side), 44, 22, 18, rand, { decals }));
    }
  }

  for (const seg of track.segments) for (const side of [-1, 1]) {
    for (let i = seg.start; i <= seg.end; i += 3) {
      if (!landAt(i, side)) continue;
      const b = quayPoint(i, side, 1.4);
      if (surface.sample(b.x, b.z).edge < 0.8 || !free(b.x, b.z, 0.6)) continue;
      bollard(batch, b.x, QUAY_TOP, b.z);
    }
  }

  for (const seg of track.segments) for (const side of [-1, 1]) {
    const count = seg.end - seg.start + 1;
    for (let k = 0; k < count; k += Math.round(30 / track.spacing)) {
      const i = seg.ring ? track.wrap(k) : seg.start + k;
      if (!landAt(i, side) || rand() < 0.35) continue;
      const p = quayPoint(i, side, 3.2);
      if (!free(p.x, p.z, 2) || surface.sample(p.x, p.z).edge < 2) continue;
      const mast = floodMast(batch, glow, p.x, QUAY_TOP, p.z, 16 + rand() * 8, rand);
      const head = new THREE.Vector3(p.x, mast.y, p.z);
      const out = track.point(i, side * (track.hw[i] * (0.2 + rand() * 0.5)));
      if (rand() < 0.55) lights.beam(head, new THREE.Vector3(out.x, 0, out.z), 6 + rand() * 3, WARM, 0.8);
      lights.pool(out.x, 0.5, out.z, 9 + rand() * 5, WARM, 0.8);
      lights.pool(p.x, QUAY_TOP + 0.08, p.z, 7, WARM, 0.6);
      taken.push({ x: p.x, z: p.z, r: 2 });
    }
  }

  for (const seg of track.segments) for (const side of [-1, 1]) {
    const count = seg.end - seg.start + 1;
    let k = 0;
    while (k < count) {
      const steps = Math.max(3, Math.round((18 + rand() * 20) / track.spacing));
      const mid = seg.ring ? track.wrap(k + Math.floor(steps / 2)) : seg.start + Math.min(count - 1, k + Math.floor(steps / 2));
      k += steps;
      if (!landAt(mid, side)) continue;
      const yaw = inward(mid, side) + Math.PI / 2;
      const depth = 6 + rand() * 10;
      const c = quayPoint(mid, side, WALK + 4 + depth);
      if (rand() < 0.22) {
        const w = 26 + rand() * 18;
        const d = 16 + rand() * 8;
        const at = quayPoint(mid, side, WALK + 6 + d / 2);
        if (!clearOfWater(at.x, at.z, Math.min(w, d) / 2) || !free(at.x, at.z, Math.max(w, d) / 2)) continue;
        taken.push(warehouse(batch, glow, at.x, QUAY_TOP, at.z, inward(mid, side), w, d, 10 + rand() * 6, rand, { decals }));
        continue;
      }
      const rows = 2 + Math.floor(rand() * 4);
      const bays = 1 + Math.floor(rand() * 2);
      const r = Math.hypot(bays * (CONTAINER.long + 0.5), rows * (CONTAINER.width + 0.25)) / 2;
      if (!clearOfWater(c.x, c.z, r) || !free(c.x, c.z, r)) {
        if (rand() < 0.5 && free(c.x, c.z, 2.5) && surface.sample(c.x, c.z).edge > WALK + 1) {
          if (rand() < 0.5) drums(batch, c.x, QUAY_TOP, c.z, rand, barrels);
          else pallets(batch, c.x, QUAY_TOP, c.z, yaw, rand);
          taken.push({ x: c.x, z: c.z, r: 2.5 });
        }
        continue;
      }
      taken.push(containerStack(batch, c.x, QUAY_TOP, c.z, yaw, rand, { rows, bays, tiers: 4, detail: true, decals }));
    }
  }

  const { minX, maxX, minZ, maxZ } = surface.bounds;
  for (let gx = minX; gx < maxX; gx += 40) {
    await tick();
    for (let gz = minZ; gz < maxZ; gz += 30) {
      const x = gx + (rand() - 0.5) * 6;
      const z = gz + (rand() - 0.5) * 6;
      const s = surface.sample(x, z);
      if (s.edge < 22 || rand() < 0.12) continue;
      const yaw = track.heading(s.idx) + (rand() < 0.5 ? 0 : Math.PI / 2);
      const rows = 3 + Math.floor(rand() * 4);
      const bays = 1 + Math.floor(rand() * 2);
      const r = Math.hypot(bays * (CONTAINER.long + 0.5), rows * (CONTAINER.width + 0.25)) / 2;
      if (!free(x, z, r)) continue;
      if (rand() < 0.1) {
        if (!clearOfWater(x, z, 16) || !free(x, z, 16)) continue;
        taken.push(warehouse(batch, glow, x, QUAY_TOP, z, yaw, 30, 18, 12 + rand() * 4, rand, { decals }));
        continue;
      }
      taken.push(containerStack(batch, x, QUAY_TOP, z, yaw, rand, { rows, bays, tiers: 5, detail: s.edge < 50, decals: s.edge < 50 ? decals : null }));
    }
  }

  for (let k = 0, made = 0; made < 26 && k < 400; k++) {
    const x = minX + rand() * (maxX - minX);
    const z = minZ + rand() * (maxZ - minZ);
    const s = surface.sample(x, z);
    if (s.edge < 30 || !free(x, z, 3)) continue;
    const mast = floodMast(batch, glow, x, QUAY_TOP, z, 26 + rand() * 10, rand);
    lights.pool(x, QUAY_TOP + 0.1, z, 22 + rand() * 8, rand() < 0.5 ? WARM : COOL, 0.75);
    if (rand() < 0.5) {
      const a = mast.yaw + Math.PI / 2;
      lights.beam(new THREE.Vector3(x, mast.y, z), new THREE.Vector3(x + Math.sin(a) * 14, QUAY_TOP, z + Math.cos(a) * 14), 9, WARM, 0.5);
    }
    taken.push({ x, z, r: 3 });
    made++;
  }

  for (const seg of track.segments) for (let i = seg.start; i <= seg.end; i += 7) {
    if (rand() < 0.75) continue;
    const side = rand() < 0.5 ? -1 : 1;
    if (!landAt(i, side)) continue;
    const p = track.point(i, side * (track.hw[i] - 0.9 - rand() * 0.8));
    if (nearRouteEnd(p.x, p.z, 50)) continue;
    const key = ['drumBlue', 'drumRed', 'drumYellow', 'rubber'][Math.floor(rand() * 4)];
    const yaw = rand() * 6;
    if (key === 'drumRed') barrels.push({ x: p.x, y: 0.15, z: p.z, yaw, lying: true });
    else batch.add(key, DRUM, mat(p.x, 0.15, p.z, 0.45, 1.1, 0.45, Math.PI / 2, yaw, 0));
  }

  const edgeRand = mulberry32(5151);
  for (const seg of track.segments) for (const side of [-1, 1]) {
    for (let i = seg.start + Math.floor(edgeRand() * 20); i <= seg.end; i += Math.round((70 + edgeRand() * 50) / track.spacing)) {
      if (!landAt(i, side)) continue;
      const c = quayPoint(i, side, 2.6);
      if (surface.sample(c.x, c.z).edge < 1.5 || !free(c.x, c.z, 1.6) || nearRouteEnd(c.x, c.z, 30)) continue;
      const n = 1 + Math.floor(edgeRand() * 3);
      for (let k = 0; k < n; k++) {
        const along = (k - (n - 1) / 2) * 1.05;
        barrels.push({ x: c.x + track.tx[i] * along, y: QUAY_TOP + 0.55, z: c.z + track.tz[i] * along, yaw: edgeRand() * 6, lying: false });
      }
      taken.push({ x: c.x, z: c.z, r: 1.6 });
    }
  }

  const scenery = new THREE.Group();
  const chunks = await batch.buildAsync(scenery, 0.1, COLORS_ALL, undefined, tick);
  const glowGroup = new THREE.Group();
  const glowChunks = await glow.buildAsync(glowGroup, 0, COLORS_ALL, undefined, tick);
  unlit(glowGroup);
  group.add(scenery, glowGroup);
  const labels = decals.build(group);
  lights.build(group);
  const hazards = new DockHazards({ group, track, lights, rand, amp: 0.8, gantries, sweepers, barrels, bridge: bridgeIdx >= 0 ? { idx: bridgeIdx } : null });

  const blinkMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2a1f, fog: false }), blinks.length);
  blinks.forEach((b, k) => blinkMesh.setMatrixAt(k, new THREE.Matrix4().compose(new THREE.Vector3(b.x, b.y, b.z), new THREE.Quaternion(), new THREE.Vector3(0.9, 0.9, 0.9))));
  blinkMesh.computeBoundingSphere();
  group.add(blinkMesh);

  const buoys = courseBuoys(track, (idx, side) => !landAt(idx, side));
  group.add(buoys);
  group.add(createArch(track, track.hw[0]));

  const collider = new Collider();
  await collider.addObject(group, new Set([sky, water.mesh, buoys, lights.beamMesh, lights.poolMesh, blinkMesh, glowGroup, labels, hazards.group]), tick);

  let puffClock = 0;
  return {
    fog,
    hazards,
    spray: { foam: 0x6a6a4a, tint: 0x3c4426, wake: 0x485030, glow: 0x161a10 },
    water,
    sun,
    surface,
    shores,
    collider,
    raycast: (origin, dir, far) => collider.raycast(origin, dir, dir.y < 0 ? Math.min(far, (origin.y + 0.3) / -dir.y) : far),
    update(t, dt, camera) {
      water.update(t);
      cullChunks(chunks, camera, fog.far);
      cullChunks(glowChunks, camera, fog.far);
      sky.position.copy(camera.position);
      buoys.userData.update(t, camera);
      blinkMesh.visible = t % 1.4 < 0.7;
      hazards.animate(t, dt);
      puffClock -= dt;
      if (puffClock <= 0 && fx) {
        puffClock = 0.18;
        for (const c of smoke) {
          if (Math.hypot(c.x - camera.position.x, c.z - camera.position.z) > 600) continue;
          fx.puffs.emit(c.x + (Math.random() - 0.5) * 1.5, c.y, c.z + (Math.random() - 0.5) * 1.5, 1.5 + Math.random(), 4 + Math.random() * 2, 0.6, 3 + Math.random() * 2, 5 + Math.random() * 2, 0x3a3a40, -0.6, 0.4, 2);
        }
      }
    },
  };
}
