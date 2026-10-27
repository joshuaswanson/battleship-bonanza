import * as THREE from 'three';
import { Collider } from './collider.js';
import { createWater } from './water.js';
import { toon, glow, mulberry32 } from './toon.js';
import { Batcher, cullChunks, slicer, COLORS, mat, createSky, createCloud, createArch, SUN_DIR } from './world.js';
import { courseSurface, buildHeightfield, courseBuoys, noise } from './terrain.js';
import { Laundry, LINE_HEIGHT, LINE_POST } from './veniceHazards.js';
import { DETAIL_COLORS, building, archBridge, gondola, pole, streetLamp, dogesPalace, campanile } from './veniceDetail.js';

const FACADES = ['terracotta', 'ochre', 'pink', 'salmon', 'cream', 'rose', 'butter', 'brick', 'sage'];

const VENICE_COLORS = {
  ...COLORS,
  ...DETAIL_COLORS,
  terracotta: 0xd9734e,
  ochre: 0xe8b04b,
  pink: 0xf2a7a0,
  salmon: 0xf08a6a,
  cream: 0xf3e2c0,
  rose: 0xe58c8a,
  butter: 0xf5d77a,
  brick: 0xc4553f,
  sage: 0xb9d6c4,
  trim: 0xf3eee2,
  roof: 0xc0573a,
  roofDark: 0xa84a32,
  chimney: 0xd98a6a,
  window: 0x3b2b2b,
  door: 0x2a2a35,
  shutter: 0x3f8f5a,
  flower: 0xff4f6d,
  leafy: 0x4fae4a,
  palace: 0xf4c8bd,
  lead: 0x9fb2b5,
  domeWhite: 0xeef0ee,
  belfry: 0xf6f1e6,
  spire: 0x6fae8a,
  gold: 0xffd23f,
  gondola: 0x1c1c22,
  ferro: 0xd9dde3,
  cushion: 0xd0343a,
  wood: 0x8a5a33,
  woodDark: 0x5e3b22,
  rope: 0xf5f5f5,
  poleBlue: 0x3d7fd6,
  poleRed: 0xe0503a,
  poleWhite: 0xffffff,
  lamp: 0x2b3440,
  quay: 0xd9ccb0,
  clothA: 0xff7ab8,
  clothB: 0x5ec8f2,
  clothC: 0xffd23f,
  clothD: 0x8ce06a,
};

const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 12);
const OCT = new THREE.CylinderGeometry(1, 1, 1, 8);
const BALL = new THREE.SphereGeometry(1, 12, 10);
const DOME = new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2);
const HIP = new THREE.ConeGeometry(Math.SQRT2 / 2, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0);
const FUNNEL = new THREE.CylinderGeometry(1, 0.35, 1, 8);
const roofShape = new THREE.Shape([new THREE.Vector2(-1, 0), new THREE.Vector2(1, 0), new THREE.Vector2(0, 1)]);
const ROOF = new THREE.ExtrudeGeometry(roofShape, { depth: 1, bevelEnabled: false }).translate(0, 0, -0.5);

const WALL_TOP = 1.25;
const WALK = 3;
const LINE_AHEAD = 35;

function placer(batch) {
  return (key, geometry, o, yaw, lx, y, lz, sx, sy, sz, rx = 0, rz = 0) => {
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    batch.add(key, geometry, mat(o.x + lx * c + lz * s, y, o.z - lx * s + lz * c, sx, sy, sz, rx, yaw, rz));
  };
}

function landmarks(batch, group, track, idx, side) {
  const i = track.wrap(idx);
  const put = placer(batch);
  const at = (along, lateral) => {
    const k = track.wrap(i + Math.round(along / track.spacing));
    return track.point(k, side * (track.hw[k] + lateral));
  };
  const face = Math.atan2(-side * track.nx[i], -side * track.nz[i]);

  const palace = at(38, WALK + 10);
  dogesPalace(batch, group, palace.x, palace.z, face);
  const tower = at(-14, WALK + 26);
  campanile(batch, tower.x, tower.z);

  const basilica = at(14, WALK + 62);
  const bo = new THREE.Vector3(basilica.x, 0, basilica.z);
  put('cream', BOX, bo, face, 0, WALL_TOP + 9, 0, 40, 18, 30);
  put('trim', BOX, bo, face, 0, WALL_TOP + 18.4, 0, 41, 0.8, 31);
  for (const k of [-16, -8, 0, 8, 16]) {
    put('gold', BOX, bo, face, k, WALL_TOP + 7, 15.05, 6, 10, 0.2);
    put('door', BOX, bo, face, k, WALL_TOP + 4, 15.2, 4.4, 8, 0.2);
    put('door', BALL, bo, face, k, WALL_TOP + 8, 15.2, 2.2, 2.2, 0.1);
    put('cream', ROOF, bo, face, k, WALL_TOP + 18.8, 14, 3.4, 4, 2, 0, 0);
  }
  for (const [lx, lz, r] of [[0, 0, 8], [-12, 0, 6], [12, 0, 6], [0, -10, 6], [0, 10, 6]]) {
    put('lead', CYL, bo, face, lx, WALL_TOP + 20.5, lz, r * 0.8, 4, r * 0.8);
    put('lead', DOME, bo, face, lx, WALL_TOP + 22.5, lz, r, r * 1.1, r);
    put('gold', BALL, bo, face, lx, WALL_TOP + 23 + r * 1.1, lz, 0.7, 1.2, 0.7);
  }
  for (const along of [-2, 10]) {
    const c = at(along, WALK - 0.5);
    batch.add('trim', CYL, mat(c.x, WALL_TOP + 8, c.z, 0.9, 16, 0.9));
    batch.add('gold', BOX, mat(c.x, WALL_TOP + 16.6, c.z, 1.6, 1.2, 2.4));
    batch.add('gold', BALL, mat(c.x, WALL_TOP + 17.8, c.z, 0.7, 0.9, 0.7));
  }
  const library = at(-34, WALK + 9);
  const lo = new THREE.Vector3(library.x, 0, library.z);
  put('trim', BOX, lo, face, 0, WALL_TOP + 8, 0, 36, 16, 16);
  for (let k = -16; k <= 16; k += 4) {
    put('door', BOX, lo, face, k, WALL_TOP + 3, 8.05, 2.4, 4.6, 0.2);
    put('window', BOX, lo, face, k, WALL_TOP + 11, 8.05, 1.6, 3, 0.2);
    put('cream', CYL, lo, face, k + 2, WALL_TOP + 8, 8.3, 0.4, 16, 0.4);
  }
  return [
    { x: palace.x, z: palace.z, r: 34 },
    { x: tower.x, z: tower.z, r: 10 },
    { x: basilica.x, z: basilica.z, r: 32 },
    { x: library.x, z: library.z, r: 24 },
    { x: (palace.x + library.x) / 2, z: (palace.z + library.z) / 2, r: 30 },
    { x: (basilica.x + tower.x) / 2, z: (basilica.z + tower.z) / 2, r: 30 },
  ];
}

function salute(batch, x, z) {
  batch.add('trim', OCT, mat(x, WALL_TOP + 8, z, 14, 16, 14));
  batch.add('trim', CYL, mat(x, WALL_TOP + 19, z, 10, 6, 10));
  batch.add('domeWhite', DOME, mat(x, WALL_TOP + 22, z, 11, 12, 11));
  batch.add('trim', CYL, mat(x, WALL_TOP + 35, z, 2, 4, 2));
  batch.add('lead', DOME, mat(x, WALL_TOP + 37, z, 2.2, 2.2, 2.2));
  batch.add('gold', BALL, mat(x, WALL_TOP + 40, z, 0.6, 1, 0.6));
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    batch.add('trim', BALL, mat(x + Math.cos(a) * 12.5, WALL_TOP + 17, z + Math.sin(a) * 12.5, 2, 2.4, 2));
    batch.add('door', BOX, mat(x + Math.cos(a) * 13.3, WALL_TOP + 6, z + Math.sin(a) * 13.3, 0.3, 7, 3, 0, -a, 0));
  }
}

function sanGiorgio(batch, x, z) {
  batch.add('quay', CYL, mat(x, -0.8, z, 42, 4, 30));
  batch.add('trim', BOX, mat(x, WALL_TOP + 9, z, 22, 18, 26));
  batch.add('trim', ROOF, mat(x, WALL_TOP + 18, z + 13.2, 11.5, 5, 1));
  for (const k of [-7, -2.5, 2.5, 7]) batch.add('trim', CYL, mat(x + k, WALL_TOP + 8, z + 13.4, 0.7, 16, 0.7));
  batch.add('door', BOX, mat(x, WALL_TOP + 3.5, z + 13.1, 3, 7, 0.2));
  batch.add('domeWhite', DOME, mat(x, WALL_TOP + 18, z - 4, 7, 8, 7));
  batch.add('brick', BOX, mat(x + 16, WALL_TOP + 17, z - 6, 6, 34, 6));
  batch.add('belfry', BOX, mat(x + 16, WALL_TOP + 36, z - 6, 6.4, 4, 6.4));
  batch.add('spire', HIP, mat(x + 16, WALL_TOP + 38, z - 6, 6, 8, 6));
  for (let k = 0; k < 6; k++) batch.add(FACADES[k], BOX, mat(x - 26 + k * 6, WALL_TOP + 5, z - 20 + (k % 2) * 3, 5.6, 10 + (k % 3) * 2, 8));
}

function canalWalls(track, landAt) {
  const positions = [];
  const colors = [];
  const stone = new THREE.Color(0xefe8d8);
  const algae = new THREE.Color(0x4c7a5a);
  const paving = new THREE.Color(VENICE_COLORS.quay);
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
      const ri = side * (track.hw[i] + WALK);
      const rj = side * (track.hw[j] + WALK);
      quad(P(i, li, -3), P(j, lj, -3), P(j, lj, 0.3), P(i, li, 0.3), algae);
      quad(P(i, li, 0.3), P(j, lj, 0.3), P(j, lj, WALL_TOP), P(i, li, WALL_TOP), stone);
      quad(P(i, li, WALL_TOP), P(j, lj, WALL_TOP), P(j, rj, WALL_TOP), P(i, ri, WALL_TOP), paving);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, toon(0xffffff, { vertexColors: true, side: THREE.DoubleSide }));
}

export async function createVenice(group, track, fx) {
  const tick = slicer();
  const fog = new THREE.Fog(0xe6f0f2, 420, 950);
  const sky = createSky();
  group.add(sky);
  group.add(new THREE.HemisphereLight(0xfff1dc, 0x6fb8b0, 1.4));
  const sun = new THREE.DirectionalLight(0xffe6c0, 2.5);
  sun.position.copy(SUN_DIR).multiplyScalar(100);
  group.add(sun);

  const N = track.N;
  const surface = await courseSurface(track, tick, { margin: 220, amp: () => 0.3 });
  const island = (x, z) => ((x + 11) / 448) ** 2 + ((z - 168) / 297) ** 2 + 0.08 * (noise(x * 1.8, z * 1.8) - 0.5) < 1;
  const lagoon = (x, z) => z < -54 + 11 * Math.sin(x * 0.018);
  const dry = (x, z) => island(x, z) && !lagoon(x, z);
  const height = (x, z) => {
    if (!dry(x, z)) return -4;
    const edge = surface.sample(x, z).edge;
    return edge < 1.5 ? -4 : WALL_TOP - 0.05;
  };
  const paint = (x, y, z, ny, color) => {
    if (y < 0) color.set(0x2c6e66);
    else if (ny < 0.6) color.set(0xefe8d8);
    else color.set((Math.floor(x / 5) + Math.floor(z / 5)) % 2 ? 0xd9ccb0 : 0xcfc0a2);
  };
  group.add(await buildHeightfield({ bounds: surface.bounds, step: 3, height, paint, tick }));
  const landAt = (i, side) => {
    const p = track.point(i, side * (track.hw[i] + WALK + 1));
    return dry(p.x, p.z);
  };
  group.add(canalWalls(track, landAt));

  const water = createWater({ deep: 0x1d8a84, shallow: 0x52c9b0, amp: 1 });
  group.add(water.mesh);

  const rand = mulberry32(1797);
  const batch = new Batcher();
  const windows = new Batcher();
  const taken = [];
  const free = (x, z, r) => !taken.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + r);
  const shores = [];

  const landSide = landAt(0, 1) ? 1 : -1;
  const landmarkSpots = landmarks(batch, group, track, 0, landSide);
  taken.push(...landmarkSpots);

  const mouth = Math.round(0.125 * N);
  const saluteSide = -landSide;
  if (landAt(mouth, saluteSide)) {
    const p = track.point(mouth, saluteSide * (track.hw[mouth] + WALK + 16));
    salute(batch, p.x, p.z);
    taken.push({ x: p.x, z: p.z, r: 18 });
  }
  sanGiorgio(batch, 45, -224);

  const bridges = [];
  const curvature = (f) => {
    const i = Math.round(f * N);
    const a = track.heading(i - 8);
    const b = track.heading(i + 8);
    return Math.abs(Math.atan2(Math.sin(b - a), Math.cos(b - a)));
  };
  const straightest = (from, to) => {
    let best = from;
    for (let f = from; f <= to; f += 0.005) if (curvature(f) < curvature(best)) best = f;
    return best;
  };
  const rialto = Math.round(straightest(0.24, 0.34) * N);
  group.userData.rialto = rialto;
  bridges.push(archBridge(batch, track, rialto, { rise: 10, peak: 9, width: 16, color: 'trim', shops: true }));
  bridges.push(archBridge(batch, track, Math.round(straightest(0.4, 0.46) * N), { rise: 8, peak: 8.5, width: 6, color: 'wood' }));
  for (const [a, b] of [[0.58, 0.62], [0.66, 0.7], [0.74, 0.77], [0.8, 0.83]]) {
    bridges.push(archBridge(batch, track, Math.round(straightest(a, b) * N), { rise: 7, peak: 7.5, width: 5, color: 'trim' }));
  }
  taken.push(...bridges.map((b) => ({ x: b.x, z: b.z, r: 6 })));

  for (const r of track.routes) {
    const mid = r.first + Math.round(r.count / 2);
    const bridge = archBridge(batch, track, mid, { rise: 6, peak: 7, width: 5, color: 'wood' });
    bridges.push(bridge);
    taken.push({ x: bridge.x, z: bridge.z, r: 6 });
  }
  const laundryLines = track.map.ramps
    .filter(([, , routeId]) => routeId === undefined)
    .map(([f]) => track.wrap(Math.round(f * N) + Math.round(LINE_AHEAD / track.spacing)))
    .filter((i) => !bridges.some((b) => Math.hypot(b.x - track.px[i], b.z - track.pz[i]) < 30));
  for (const i of laundryLines) for (const side of [-1, 1]) {
    const p = track.point(i, side * (track.hw[i] + LINE_POST));
    batch.add('woodDark', CYL, mat(p.x, (LINE_HEIGHT - 1) / 2, p.z, 0.28, LINE_HEIGHT + 1.6, 0.28));
    batch.add('wood', BOX, mat(p.x, LINE_HEIGHT + 0.2, p.z, 0.2, 0.2, 1.6, 0, track.heading(i), 0));
    taken.push({ x: p.x, z: p.z, r: 1.5 });
  }
  for (const seg of track.segments) for (const side of [-1, 1]) {
    const count = seg.end - seg.start + 1;
    let k = 0;
    while (k < count) {
      const w = 8 + rand() * 6;
      const steps = Math.max(2, Math.round(w / track.spacing));
      const mid = seg.ring ? track.wrap(k + Math.floor(steps / 2)) : seg.start + Math.min(count - 1, k + Math.floor(steps / 2));
      k += steps;
      if (!landAt(mid, side)) continue;
      const hw = track.hw[mid];
      const d = 11 + rand() * 7;
      const h = 11 + rand() * 13 + (hw > 22 ? 4 : 0);
      const front = hw + (hw > 22 && rand() < 0.5 ? 0.2 : WALK);
      const c = track.point(mid, side * (front + d / 2));
      if (!free(c.x, c.z, Math.min(w, d) / 2)) continue;
      const yaw = Math.atan2(-side * track.nx[mid], -side * track.nz[mid]);
      const corner = [-1, 1].every((a) => [-1, 1].every((b) => {
        const x = c.x + Math.cos(yaw) * (a * w / 2) + Math.sin(yaw) * (b * d / 2);
        const z = c.z - Math.sin(yaw) * (a * w / 2) + Math.cos(yaw) * (b * d / 2);
        return dry(x, z) && surface.sample(x, z).edge > -0.5;
      }));
      if (!corner) continue;
      building(batch, windows, c.x, c.z, yaw, w, d, h, rand, { canal: true, onWater: front < hw + 1, color: FACADES[Math.floor(rand() * FACADES.length)] });
      taken.push({ x: c.x, z: c.z, r: Math.min(w, d) / 2 });
      if (rand() < 0.3) {
        const pp = track.point(mid, side * (hw - 0.4));
        const color = ['poleBlue', 'poleRed'][Math.floor(rand() * 2)];
        pole(batch, pp.x, pp.z, color, rand);
        const q = track.point(mid + 2, side * (hw - 0.4));
        pole(batch, q.x, q.z, color, rand);
        if (rand() < 0.4) {
          const r = track.point(mid + 4, side * (hw - 0.4));
          pole(batch, r.x, r.z, color, rand);
        }
      }
    }
  }

  const { minX, maxX, minZ, maxZ } = surface.bounds;
  for (let gx = minX; gx < maxX; gx += 15) {
    await tick();
    for (let gz = minZ; gz < maxZ; gz += 15) {
      const x = gx + (rand() - 0.5) * 6;
      const z = gz + (rand() - 0.5) * 6;
      if (!dry(x, z)) continue;
      const s = surface.sample(x, z);
      if (s.edge < 14) continue;
      const w = 9 + rand() * 6;
      const d = 9 + rand() * 6;
      if (!free(x, z, Math.max(w, d) * 0.45)) continue;
      const corners = [[-1, -1], [1, -1], [-1, 1], [1, 1]].every(([a, b]) => dry(x + a * w * 0.6, z + b * d * 0.6));
      if (!corners) continue;
      const yaw = track.heading(s.idx);
      building(batch, windows, x, z, yaw, w, d, 10 + rand() * 14, rand, { color: FACADES[Math.floor(rand() * FACADES.length)] });
      taken.push({ x, z, r: Math.max(w, d) * 0.45 });
    }
  }

  const inRoute = (x, z, margin) => track.routes.some((r) => {
    for (let k = r.first; k <= r.last; k++) if (Math.hypot(track.px[k] - x, track.pz[k] - z) < track.hw[k] + margin) return true;
    return false;
  });
  for (let i = 0; i < N; i += 4) {
    const f = i / N;
    if (track.hw[i] > 30 || rand() < 0.75) continue;
    const side = rand() < 0.5 ? -1 : 1;
    if (!landAt(i, side)) continue;
    if (bridges.some((b) => Math.hypot(b.x - track.px[i], b.z - track.pz[i]) < 14)) continue;
    if (track.routes.some((r) => [r.from, r.to].some((k) => Math.hypot(track.px[k] - track.px[i], track.pz[k] - track.pz[i]) < 70))) continue;
    const p = track.point(i, side * (track.hw[i] - 1.1));
    if (inRoute(p.x, p.z, 8)) continue;
    const yaw = track.heading(i);
    gondola(batch, p.x, p.z, yaw, rand, { covered: rand() >= 0.4 && rand() < 0.35 });
    shores.push({ x: p.x, z: p.z, rx: 1, rz: 5, rot: yaw });
    if (f > 0.56 && f < 0.84 && rand() < 0.3) {
      const a = track.point(i, -(track.hw[i] + 1));
      const b = track.point(i, track.hw[i] + 1);
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      const lineYaw = Math.atan2(b.x - a.x, b.z - a.z);
      batch.add('rope', BOX, mat((a.x + b.x) / 2, 12, (a.z + b.z) / 2, 0.08, 0.08, len, 0, lineYaw, 0));
      for (let c = 0; c < 7; c++) {
        const u = 0.15 + (c / 6) * 0.7 + (rand() - 0.5) * 0.05;
        batch.add(['clothA', 'clothB', 'clothC', 'clothD'][Math.floor(rand() * 4)], BOX, mat(a.x + (b.x - a.x) * u, 11.1, a.z + (b.z - a.z) * u, 1.3, 1.6, 0.1, 0, lineYaw + Math.PI / 2, 0));
      }
    }
  }

  for (let tries = 0, made = 0; made < 26 && tries < 400; tries++) {
    const x = -336 + rand() * 672;
    const z = -67 - rand() * 246;
    const s = surface.sample(x, z);
    if (s.edge < 6 || !lagoon(x, z) || Math.hypot(x - 45, z + 224) < 56) continue;
    for (let k = 0; k < 3; k++) batch.add('woodDark', CYL, mat(x + Math.cos(k * 2.1) * 0.5, 1.5, z + Math.sin(k * 2.1) * 0.5, 0.3, 7, 0.3, Math.cos(k * 2.1) * 0.12, 0, Math.sin(k * 2.1) * 0.12));
    batch.add('rope', CYL, mat(x, 3.5, z, 0.9, 0.3, 0.9));
    made++;
  }

  for (let i = 0, n = 0; i < N; i += 11, n++) {
    const side = track.hw[i] > 30 ? landSide : n % 2 ? 1 : -1;
    if (!landAt(i, side)) continue;
    const p = track.point(i, side * (track.hw[i] + 1.1));
    if (!free(p.x, p.z, 1.2) || surface.sample(p.x, p.z).edge < 0.5) continue;
    streetLamp(batch, p.x, WALL_TOP, p.z);
  }

  const scenery = new THREE.Group();
  const chunks = await batch.buildAsync(scenery, 0.1, VENICE_COLORS, undefined, tick);
  const glass = await windows.buildAsync(scenery, 0, VENICE_COLORS, undefined, tick);
  group.add(scenery);
  const hazards = new Laundry({ group, track, lines: laundryLines, rand: mulberry32(4207) });

  const buoys = courseBuoys(track, (idx, side) => !landAt(idx, side));
  group.add(buoys);
  group.add(createArch(track, track.hw[0]));

  const clouds = [];
  for (let i = 0; i < 12; i++) {
    const cloud = createCloud(rand);
    const a = rand() * Math.PI * 2;
    const d = 150 + rand() * 600;
    cloud.position.set(Math.cos(a) * d, 120 + rand() * 60, Math.sin(a) * d);
    cloud.userData.speed = 2 + rand() * 3;
    clouds.push(cloud);
    group.add(cloud);
  }

  const collider = new Collider();
  await collider.addObject(group, new Set([sky, water.mesh, buoys, hazards.group, ...clouds]), tick);

  return {
    fog,
    hazards,
    water,
    sun,
    surface,
    shores,
    collider,
    raycast: (origin, dir, far) => collider.raycast(origin, dir, dir.y < 0 ? Math.min(far, (origin.y + 0.3) / -dir.y) : far),
    update(t, dt, camera) {
      water.update(t);
      cullChunks(chunks, camera, fog.far);
      cullChunks(glass, camera, fog.far * 0.6);
      sky.position.copy(camera.position);
      buoys.userData.update(t, camera);
      hazards.animate(t);
      for (const cloud of clouds) {
        cloud.position.x += cloud.userData.speed * dt;
        if (cloud.position.x > 800) cloud.position.x = -800;
      }
    },
  };
}
