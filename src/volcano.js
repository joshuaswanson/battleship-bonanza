import * as THREE from 'three';
import { toon, mulberry32 } from './toon.js';
import { groundHit } from './terrain.js';
import { jungleClump } from './foliage.js';
import { Batcher, cullChunks, slicer, COLORS, mat, ROCK, addPalm, createSky, createCloud, createArch, SUN_DIR } from './world.js';
import { riverSurface, buildFalls } from './jungle.js';
import { createWater } from './water.js';
import { BASE_COLORS, buildBase } from './volcanoBase.js';
import { groundMesh, noise, seaStrip, smooth } from './mapKit.js';

const SKY = 0xf0c8a0;
const RIM = 92;
const PEAK = 236;
const LAVA_Y = 208;
const PLATEAU = 58;
const CLIFF = 488;
const CANYON_HALF = 60;
const CANYON_IN = 430;
const CANYON_OUT = 720;
const FIELD_CELL = 14;
const PALETTE = {
  ...COLORS,
  ...BASE_COLORS,
  basalt: 0x3d3a3f,
  basaltLight: 0x5c565a,
  ash: 0x7f7670,
  concrete: 0xb6b8ba,
  steel: 0x6d7a88,
  steelDark: 0x2e3744,
  hazard: 0xffd23f,
  hazardDark: 0x20262e,
  villain: 0xc62838,
  villainDark: 0x7a1524,
  lamp: 0xfff0a0,
  screen: 0x46e0c0,
  moss: 0x5e9e26,
  mossDark: 0x3c7a1c,
  bark: 0x7a5230,
  fronds: 0x5e9e26,
  coconut: 0x7a5230,
};

function islandHeight(x, z) {
  const r = Math.hypot(x, z);
  const lump = 8 * noise(x * 1.3, z * 1.3) + 4 * noise(x * 3.1 + 50, z * 3.1);
  const cone = PEAK * Math.max(0, 1 - (r - RIM) / 400) ** 1.12 + lump;
  const crater = smooth(62, RIM, r);
  const volcano = LAVA_Y - 6 + (cone - (LAVA_Y - 6)) * crater;
  const table = PLATEAU + 0.5 * lump;
  const sea = -16;
  const angle = Math.atan2(z, x);
  const south = Math.atan2(Math.sin(angle + Math.PI / 2), Math.cos(angle + Math.PI / 2));
  const edge = CLIFF + 14 * Math.sin(angle * 7) * 0.4 + 190 * Math.exp(-((south / 0.6) ** 2));
  return Math.max(volcano * (1 - smooth(edge + 2, edge + 12, r)) + sea * smooth(edge + 2, edge + 12, r), table + (sea - table) * smooth(edge, edge + 10, r));
}

function groundHeight(surface, track, x, z) {
  const { edge, s } = surface.sample(x, z);
  const base = openHeight(surface, track, x, z);
  const field = track.river.flight;
  if (!field) return base;
  const ridge = canyonRidge(field, x, z);
  if (ridge <= base) return base;
  return base + (ridge - base) * (track.formAt(s) ? 1 : smooth(22, 75, edge));
}

function openHeight(surface, track, x, z) {
  const { edge, s, level } = surface.sample(x, z);
  const raw = shapedHeight(track, edge, s, level, x, z);
  const past = track.ahead(track.river.land.launch, s);
  if (past > 170) return raw;
  const notch = smooth(1, 6, past) * (1 - smooth(12, 40, edge));
  return raw + (-16 - raw) * notch;
}

const canyonFade = (s, start, end) => smooth(0, 260, s - start) * smooth(0, 300, end - s);

async function flightField(surface, track, tick) {
  const { launch, lip } = track.river.land;
  const start = launch + CANYON_IN;
  const end = lip - CANYON_OUT;
  const points = [];
  for (let s = start; s < end; s += 12) {
    const i = track.wrap(Math.round(s / track.spacing));
    points.push({ x: track.px[i], z: track.pz[i], w: canyonFade(s, start, end) });
  }
  const { minX, maxX, minZ, maxZ } = surface.bounds;
  const cols = Math.ceil((maxX - minX) / FIELD_CELL) + 2;
  const rows = Math.ceil((maxZ - minZ) / FIELD_CELL) + 2;
  const dist = new Float32Array(cols * rows);
  const weight = new Float32Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    await tick();
    const z = minZ + r * FIELD_CELL;
    for (let c = 0; c < cols; c++) {
      const x = minX + c * FIELD_CELL;
      let best = Infinity;
      let w = 0;
      for (const p of points) {
        const d = (x - p.x) ** 2 + (z - p.z) ** 2;
        if (d < best) {
          best = d;
          w = p.w;
        }
      }
      dist[r * cols + c] = Math.sqrt(best);
      weight[r * cols + c] = w;
    }
  }
  const at = (grid, x, z) => {
    const fx = Math.min(cols - 1.001, Math.max(0, (x - minX) / FIELD_CELL));
    const fz = Math.min(rows - 1.001, Math.max(0, (z - minZ) / FIELD_CELL));
    const c = Math.floor(fx);
    const r = Math.floor(fz);
    const u = fx - c;
    const v = fz - r;
    const a = grid[r * cols + c];
    const b = grid[r * cols + c + 1];
    const e = grid[(r + 1) * cols + c];
    const f = grid[(r + 1) * cols + c + 1];
    return a + (b - a) * u + (e + (f - e) * u - a - (b - a) * u) * v;
  };
  return { dist: (x, z) => at(dist, x, z), weight: (x, z) => at(weight, x, z), start, end };
}

function canyonRidge(field, x, z) {
  const d = field.dist(x, z);
  const w = field.weight(x, z);
  if (w <= 0 || d > 320) return -16;
  const top = 86 + 36 * noise(x * 1.1, z * 1.1) + 14 * noise(x * 3, z * 3);
  return -16 + (top + 16) * w * smooth(CANYON_HALF + 8, CANYON_HALF + 46, d) * (1 - smooth(200, 310, d));
}

function shapedHeight(track, edge, s, level, x, z) {
  const land = islandHeight(x, z);
  const free = track.formAt(s) ? track.landAmount(s) : 0;
  if (free >= 1) return land + (Math.min(land, level - 10) - land) * (1 - smooth(4, 30, edge));
  const hw = track.halfWidth;
  const dist = edge + hw;
  const bank = smooth(hw - 6, hw + 8, dist);
  const levee = Math.max(land, level + 4 + 3 * noise(x, z));
  const shoulder = levee + (land - levee) * smooth(hw + 14, hw + 90, dist);
  const carved = level - 5 + (shoulder - level + 5) * bank;
  return carved + (land - carved) * free;
}

const LAVA_VERT = /* glsl */ `
  attribute vec2 aFlow;
  varying vec3 vWorld;
  varying vec2 vFlow;
  void main() {
    vFlow = aFlow;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const LAVA_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uStream;
  varying vec3 vWorld;
  varying vec2 vFlow;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) { return noise(p) * 0.5 + noise(p * 2.1 + 3.0) * 0.3 + noise(p * 4.3 + 7.0) * 0.2; }
  vec3 cells(vec2 p, float t) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float first = 8.0;
    float second = 8.0;
    float id = 0.0;
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 g = vec2(float(x), float(y));
        vec2 o = vec2(hash(i + g), hash(i + g + 19.0));
        o = 0.5 + 0.42 * sin(t + 6.28 * o);
        float d = length(g + o - f);
        if (d < first) {
          second = first;
          first = d;
          id = hash(i + g + 41.0);
        } else if (d < second) second = d;
      }
    }
    return vec3(first, second - first, id);
  }
  vec3 ramp(float heat) {
    vec3 c = mix(vec3(0.13, 0.03, 0.04), vec3(0.72, 0.08, 0.03), smoothstep(0.1, 0.45, heat));
    c = mix(c, vec3(1.0, 0.42, 0.05), smoothstep(0.4, 0.7, heat));
    c = mix(c, vec3(1.0, 0.84, 0.25), smoothstep(0.68, 0.9, heat));
    return mix(c, vec3(1.0, 0.98, 0.78), smoothstep(0.9, 1.0, heat));
  }
  void main() {
    vec2 p = uStream > 0.5 ? vec2(vFlow.x * 2.2, vFlow.y * 0.05 - uTime * 0.55) : vWorld.xz * 0.05;
    vec2 warp = vec2(fbm(p * 0.8 + uTime * 0.05), fbm(p * 0.8 + 11.0 - uTime * 0.04)) - 0.5;
    vec2 q = p + warp * 1.4;
    vec3 crust = cells(q, uTime * 0.3);
    vec3 fine = cells(q * 2.6 + 4.0, uTime * 0.45);
    float seam = 1.0 - smoothstep(0.0, 0.2, crust.y);
    float thin = 1.0 - smoothstep(0.0, 0.1, fine.y);
    float plate = crust.z * 0.2 + fbm(q * 3.0) * 0.18;
    float pulse = 0.5 + 0.5 * sin(uTime * 1.4 + crust.z * 18.0);
    float heat = plate + seam * 0.95 + thin * 0.22 + pulse * 0.08;
    if (uStream > 0.5) heat += 0.4 * (1.0 - smoothstep(0.1, 0.95, abs(vFlow.x)));
    if (uStream < 0.5) heat += 0.3 * (1.0 - smoothstep(10.0, 76.0, length(vWorld.xz)));
    gl_FragColor = vec4(ramp(heat), 1.0);
    #include <colorspace_fragment>
  }
`;

function lavaStream(angle, height, tick) {
  const steps = 54;
  const pos = [];
  const flow = [];
  const index = [];
  for (let k = 0; k <= steps; k++) {
    const t = k / steps;
    const r = 84 + t * 150;
    const a = angle + 0.16 * Math.sin(t * 7 + angle * 3) * t + 0.05 * Math.sin(t * 19);
    const width = 3 + 4 * t + 1.2 * Math.sin(t * 11 + angle);
    const nx = -Math.sin(a);
    const nz = Math.cos(a);
    for (const side of [-1, -0.45, 0, 0.45, 1]) {
      const x = Math.cos(a) * r + nx * width * side;
      const z = Math.sin(a) * r + nz * width * side;
      pos.push(x, height(x, z) + 0.7 - Math.abs(side) * 0.4, z);
      flow.push(side, t * 150);
    }
  }
  for (let k = 0; k < steps; k++) {
    for (let l = 0; l < 4; l++) {
      const a = k * 5 + l;
      index.push(a, a + 5, a + 1, a + 1, a + 5, a + 6);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aFlow', new THREE.Float32BufferAttribute(flow, 2));
  g.setIndex(index);
  return g;
}

function disc(x, z, radius, y, material) {
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(radius, 48).rotateX(-Math.PI / 2), material);
  mesh.position.set(x, y, z);
  return mesh;
}

const COLUMN = new THREE.CylinderGeometry(1, 1, 1, 6).toNonIndexed();
COLUMN.deleteAttribute('uv');
COLUMN.computeVertexNormals();

async function buildCanyon(batch, canyon, track, height, rand, tick) {
  const { start, end } = track.river.flight;
  const tiers = [[4, 15, 34], [12, 34, 62], [21, 60, 96]];
  let n = 0;
  for (let s = start + 40; s < end - 40; s += 10.5) {
    if (++n % 24 === 0) await tick();
    const i = track.wrap(Math.round(s / track.spacing));
    const fade = canyonFade(s, start, end);
    for (const side of [-1, 1]) {
      const wave = Math.sin(s * 0.013 + side) * 3 + Math.sin(s * 0.041) * 1.6;
      for (const [out, low, high] of tiers) {
        const p = track.point(i, side * (CANYON_HALF + out + wave + rand() * 2.5));
        const r = 5.4 + rand() * 2.2;
        const h = (low + rand() * (high - low)) * fade;
        const yaw = rand() * 1;
        if (h < 3) continue;
        canyon.add(rand() < 0.55 ? 'basalt' : 'basaltLight', COLUMN, mat(p.x, (h - 18) / 2, p.z, r, h + 18, r, 0, yaw, 0));
        canyon.add(rand() < 0.5 ? 'ash' : 'basaltLight', COLUMN, mat(p.x, h + 0.35, p.z, r * 0.94, 0.7, r * 0.94, 0, yaw, 0));
        if (out > 12 && rand() < 0.42) canyon.add('moss', COLUMN, mat(p.x, h + 0.9, p.z, r * 0.8, 0.5, r * 0.8, 0, yaw, 0));
        if (out > 12 && rand() < 0.1) jungleClump(batch, p.x, h + 0.4, p.z, rand, 3 + rand() * 2.4);
      }
    }
  }
}

function canyonFoam(track) {
  const { start, end } = track.river.flight;
  const positions = [];
  const index = [];
  let row = 0;
  for (const side of [-1, 1]) {
    const first = row;
    for (let s = start + 40; s < end - 40; s += 9) {
      const i = track.wrap(Math.round(s / track.spacing));
      const wave = Math.sin(s * 0.013 + side) * 3 + Math.sin(s * 0.041) * 1.6;
      const inner = CANYON_HALF + wave - 4 - 2.4 * Math.sin(s * 0.31 + side);
      const a = track.point(i, side * inner);
      const b = track.point(i, side * (CANYON_HALF + wave + 5));
      positions.push(a.x, 0.5, a.z, b.x, 0.5, b.z);
      if (row > first) {
        const k = row * 2;
        if (side > 0) index.push(k - 2, k, k - 1, k - 1, k, k + 1);
        else index.push(k - 2, k - 1, k, k - 1, k + 1, k);
      }
      row++;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(index);
  return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.72, side: THREE.DoubleSide }));
}

function cliffRocks(batch, track, s, rand) {
  for (let k = 0; k < 26; k++) {
    const i = track.wrap(Math.round((s - 12 + rand() * 22) / track.spacing));
    const side = k % 2 ? 1 : -1;
    const p = track.point(i, side * (track.hw[i] + 2 + rand() * 12));
    const r = 3 + rand() * 6;
    batch.add(k % 3 ? 'basalt' : 'basaltLight', ROCK, mat(p.x, track.baseLevel(s - 6) + r * 0.3, p.z, r, r * 1.2, r, rand(), rand() * 6, rand()));
  }
}

function buildSource(batch, group, track, rand) {
  const lakeIdx = track.wrap(Math.round((track.river.land.lip + 26) / track.spacing));
  const lake = track.point(lakeIdx, 0);
  const top = track.river.top;
  const back = new THREE.Vector3(track.nx[lakeIdx], 0, track.nz[lakeIdx]);
  const cave = new THREE.Vector3(lake.x + back.x * 92, 0, lake.z + back.z * 92);
  for (let k = 0; k < 34; k++) {
    const a = (k / 34) * Math.PI;
    const r = 10 + rand() * 7;
    const lat = Math.cos(a) * 30;
    const up = Math.sin(a) * 34;
    batch.add(k % 2 ? 'basalt' : 'basaltLight', ROCK, mat(cave.x - back.z * lat, top + up + 4, cave.z + back.x * lat, r, r, r, rand(), rand() * 6, rand()));
  }
  const sheet = new THREE.Mesh(new THREE.CylinderGeometry(26, 34, 44, 28, 1, true, 0, Math.PI), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }));
  sheet.position.set(cave.x, top + 20, cave.z);
  sheet.rotation.y = Math.atan2(back.x, back.z) + Math.PI / 2;
  group.add(sheet);
  return { x: lake.x, y: top, z: lake.z, cave, back };
}

export async function createVolcano(group, track, fx) {
  const tick = slicer();
  const fog = new THREE.Fog(SKY, 300, 1500);
  const sky = createSky({ top: 0x3f7fc8, horizon: SKY });
  group.add(sky);
  group.add(new THREE.HemisphereLight(0xfff0e0, 0x5a4a50, 1.4));
  const sun = new THREE.DirectionalLight(0xffe0c0, 2.6);
  sun.position.copy(SUN_DIR).multiplyScalar(100);
  group.add(sun);

  const surface = await riverSurface(track, tick);
  track.river.flight = await flightField(surface, track, tick);
  const height = (x, z) => groundHeight(surface, track, x, z);
  const sand = new THREE.Color(0x4a4448);
  const mossy = new THREE.Color(0x3c7a1c);
  const grass = new THREE.Color(0x5e9e26);
  const dark = new THREE.Color(PALETTE.basalt);
  const pale = new THREE.Color(PALETTE.basaltLight);
  const ember = new THREE.Color(0xff5a1f);
  group.add(await groundMesh(surface, height, (x, y, z, n, out) => {
    const r = Math.hypot(x, z);
    const steep = 1 - n.y;
    if (y < 3) out.copy(sand);
    else if (steep > 0.3) out.copy(noise(x * 2, z * 2) > 0.5 ? dark : pale);
    else if (y < 100 && r > 200) out.copy(grass).lerp(mossy, noise(x * 3, z * 3) > 0.55 ? 0.6 : 0);
    else out.copy(noise(x * 2, z * 2) > 0.52 ? dark : pale);
    if (r > 66 && r < 108) out.lerp(ember, (1 - smooth(80, 108, r)) * 0.6);
  }, tick, 6));
  await tick();

  const { launch, lip } = track.river.land;
  const water = seaStrip(track, Math.round((lip - 2) / track.spacing), Math.round((launch + 2) / track.spacing) + track.N, { deep: 0x0f7fa8, shallow: 0x35d0d4 });
  group.add(water.mesh);
  const ocean = createWater({ size: 2600, segments: 180, amp: 0.45 });
  ocean.mesh.position.y = 0;
  group.add(ocean.mesh);

  const rapids = track.river.drops.map((drop) => buildFalls(track, drop));
  for (const f of rapids) group.add(f.mesh);
  const edgeLevel = track.baseLevel(launch - 2);
  const bigFalls = buildFalls({ ...track, level: () => 0, halfWidth: track.halfWidth + 22 }, { s: launch, height: edgeLevel });
  bigFalls.material.side = THREE.DoubleSide;
  group.add(bigFalls.mesh);
  rapids.push(bigFalls);

  const lavaMat = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uStream: { value: 0 } }, vertexShader: LAVA_VERT, fragmentShader: LAVA_FRAG });
  const streamMat = lavaMat.clone();
  streamMat.side = THREE.DoubleSide;
  streamMat.uniforms.uStream.value = 1;
  group.add(disc(0, 0, 90, LAVA_Y - 1, lavaMat));
  for (const a of [0.5, 1.15, 1.9, 2.5, 3.2, 5.7, 6.05]) {
    group.add(new THREE.Mesh(lavaStream(a, height, tick), streamMat));
    await tick();
  }

  const batch = new Batcher();
  const rand = mulberry32(6660);
  const blobs = [];
  cliffRocks(batch, track, launch, rand);
  const source = buildSource(batch, group, track, rand);
  const trim = new Batcher();
  const canyon = new Batcher();
  const occupied = buildBase(batch, trim, track, height, launch);
  for (let k = 0; k < 420; k++) {
    const a = rand() * 6.3;
    const r = 240 + rand() * 240;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const near = surface.sample(x, z);
    if (near.edge < 8 || occupied(x, z)) continue;
    const y = height(x, z);
    if (y < PLATEAU - 8 || y > 130) continue;
    addPalm(batch, x, y - 0.4, z, rand, { height: 7 + rand() * 7, lean: rand() * 0.4, dir: rand() * 6.3 });
    if (k % 30 === 0) await tick();
  }
  for (let k = 0; k < 120; k++) {
    const a = rand() * 6.3;
    const r = 110 + rand() * 360;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (surface.sample(x, z).edge < 6 || occupied(x, z)) continue;
    const s = 3 + rand() * 7;
    batch.add(k % 2 ? 'basalt' : 'basaltLight', ROCK, mat(x, height(x, z) + s * 0.2, z, s, s * 0.8, s, rand(), rand() * 6, rand()));
  }
  for (let k = 0; k < 30; k++) {
    const s = 120 + rand() * (launch - 240);
    const i = track.wrap(Math.round(s / track.spacing));
    const lat = (rand() < 0.5 ? -1 : 1) * (track.hw[i] * 0.3 + rand() * track.hw[i] * 0.5);
    const p = track.point(i, lat);
    const level = track.level(s);
    const r = 2.8 + rand() * 2.2;
    batch.add('basalt', ROCK, mat(p.x, level + 0.5, p.z, r, r * 0.9, r, rand(), rand() * 6, rand()));
    blobs.push({ x: p.x, z: p.z, rx: r * 0.9, rz: r * 0.9, rot: 0, top: level + r * 0.6, launch: true });
  }
  await buildCanyon(batch, canyon, track, height, rand, tick);
  const scenery = new THREE.Group();
  const chunks = await batch.buildAsync(scenery, 0.1, PALETTE, 120, tick);
  chunks.push(...(await trim.buildAsync(scenery, 0, PALETTE, 120, tick)));
  chunks.push(...(await canyon.buildAsync(scenery, 0.12, PALETTE, 280, tick)));
  group.add(canyonFoam(track));
  group.add(scenery);
  group.add(createArch(track, track.halfWidth));

  const clouds = [];
  for (let i = 0; i < 10; i++) {
    const cloud = createCloud(rand);
    const a = rand() * Math.PI * 2;
    const d = 300 + rand() * 500;
    cloud.position.set(Math.cos(a) * d, 150 + rand() * 80, Math.sin(a) * d);
    clouds.push(cloud);
    group.add(cloud);
  }

  return {
    fog,
    water,
    sun,
    surface,
    shores: blobs,
    spray: { foam: 0xffffff, tint: 0xbff6ff, wake: 0xe7f9ff, glow: 0x1c1a1c },
    solid(p) {
      return groundHit(height, p);
    },
    update(t, dt, camera) {
      water.update(t);
      ocean.update(t);
      ocean.mesh.position.x = Math.round(camera.position.x / 30) * 30;
      ocean.mesh.position.z = Math.round(camera.position.z / 30) * 30;
      for (const f of rapids) f.material.uniforms.uTime.value = t;
      lavaMat.uniforms.uTime.value = t;
      streamMat.uniforms.uTime.value = t;
      cullChunks(chunks, camera, fog.far);
      sky.position.copy(camera.position);
      if (Math.random() < dt * 60) {
        const a = Math.random() * 6.3;
        const r = 12 + Math.random() * 22;
        fx.puffs.emit(source.cave.x + Math.cos(a) * r, source.y + 2, source.cave.z + Math.sin(a) * r, (Math.random() - 0.5) * 6, 24 + Math.random() * 30, (Math.random() - 0.5) * 6, 2 + Math.random() * 3, 3, 0xffffff, 8, 0.2, 0);
      }
      if (Math.random() < dt * 40) {
        const p = bigFalls.base;
        const lat = (Math.random() - 0.5) * 2 * (p.hw + 24);
        fx.puffs.emit(p.x + p.nx * lat, 2, p.z + p.nz * lat, (Math.random() - 0.5) * 8, 7 + Math.random() * 12, (Math.random() - 0.5) * 8, 2.4 + Math.random() * 3, 1.6, 0xffffff, 2, 0.4, 0);
      }
      if (Math.random() < dt * 34) {
        const a = Math.random() * 6.3;
        const r = Math.random() * 46;
        fx.puffs.emit(Math.cos(a) * r, LAVA_Y + 4, Math.sin(a) * r, (Math.random() - 0.5) * 3, 22 + Math.random() * 12, (Math.random() - 0.5) * 3, 3 + Math.random() * 3, 4.5, Math.random() < 0.2 ? 0xff7a1f : 0x4a4448, -1, 0.3, 0);
      }
      if (Math.random() < dt * 26) {
        const a = Math.random() * 6.3;
        const r = 8 + Math.random() * 46;
        const up = 26 + Math.random() * 46;
        fx.puffs.emit(Math.cos(a) * r, LAVA_Y, Math.sin(a) * r, Math.cos(a) * 9 + (Math.random() - 0.5) * 8, up, Math.sin(a) * 9 + (Math.random() - 0.5) * 8, 0.7 + Math.random() * 1.4, 2.6, Math.random() < 0.5 ? 0xffb02e : 0xff5a1f, 26, 0, 0);
      }
    },
  };
}
