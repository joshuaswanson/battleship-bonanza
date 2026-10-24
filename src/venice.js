import * as THREE from 'three';
import { createWater } from './water.js';
import { toon, glow, mulberry32 } from './toon.js';
import { Batcher, cullChunks, slicer, COLORS, mat, createSky, createCloud, createArch, SUN_DIR } from './world.js';
import { courseSurface, buildHeightfield, courseBuoys, noise } from './terrain.js';

const FACADES = ['terracotta', 'ochre', 'pink', 'salmon', 'cream', 'rose', 'butter', 'brick', 'sage'];

const VENICE_COLORS = {
  ...COLORS,
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
  shirt: 0xffffff,
  stripe: 0xe33b3b,
  skin: 0xffd2b0,
  hat: 0xf2d27a,
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

function placer(batch) {
  return (key, geometry, o, yaw, lx, y, lz, sx, sy, sz, rx = 0, rz = 0) => {
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    batch.add(key, geometry, mat(o.x + lx * c + lz * s, y, o.z - lx * s + lz * c, sx, sy, sz, rx, yaw, rz));
  };
}

function building(batch, windows, o, yaw, w, d, h, rand, { canal = false, color } = {}) {
  const put = placer(batch);
  const win = placer(windows);
  const facade = color ?? FACADES[Math.floor(rand() * FACADES.length)];
  put('trim', BOX, o, yaw, 0, WALL_TOP + 0.9, 0, w + 0.3, 1.8, d + 0.3);
  put(facade, BOX, o, yaw, 0, WALL_TOP + h / 2, 0, w, h, d);
  put('trim', BOX, o, yaw, 0, WALL_TOP + h + 0.25, 0, w + 0.7, 0.5, d + 0.7);
  put(rand() < 0.5 ? 'roof' : 'roofDark', HIP, o, yaw, 0, WALL_TOP + h + 0.5, 0, w * 1.02, 2.4 + rand() * 1.2, d * 1.02);
  if (rand() < 0.65) {
    const cx = (rand() - 0.5) * w * 0.6;
    const cz = (rand() - 0.5) * d * 0.6;
    put('chimney', CYL, o, yaw, cx, WALL_TOP + h + 2.6, cz, 0.35, 3.2, 0.35);
    put('chimney', FUNNEL, o, yaw, cx, WALL_TOP + h + 4.6, cz, 0.85, 1.4, 0.85);
  }
  const floors = Math.floor((h - 3) / 3.6);
  const cols = Math.max(1, Math.floor(w / 3));
  const shutters = rand() < 0.4;
  const faces = canal ? [1] : [1, -1];
  for (const face of faces) {
    for (let f = 0; f < floors; f++) {
      const y = WALL_TOP + 4.2 + f * 3.6;
      for (let c = 0; c < cols; c++) {
        const lx = (c - (cols - 1) / 2) * (w / cols);
        if (canal && f === 0 && c === Math.floor(cols / 2)) continue;
        win('window', BOX, o, yaw, lx, y, face * (d / 2 + 0.03), 1.1, 2, 0.2);
        win('window', BALL, o, yaw, lx, y + 1, face * (d / 2 + 0.03), 0.55, 0.55, 0.1);
        if (shutters) {
          win('shutter', BOX, o, yaw, lx - 0.95, y + 0.2, face * (d / 2 + 0.06), 0.6, 2.4, 0.12);
          win('shutter', BOX, o, yaw, lx + 0.95, y + 0.2, face * (d / 2 + 0.06), 0.6, 2.4, 0.12);
        } else if (rand() < 0.25) {
          win('flower', BOX, o, yaw, lx, y - 1.15, face * (d / 2 + 0.35), 1.4, 0.45, 0.5);
        }
      }
    }
  }
  if (canal) {
    win('door', BOX, o, yaw, 0, WALL_TOP + 1.6, d / 2 + 0.03, 2.4, 3.2, 0.2);
    win('door', BALL, o, yaw, 0, WALL_TOP + 3.2, d / 2 + 0.03, 1.2, 1.2, 0.1);
    if (h > 14 && rand() < 0.4) put('trim', BOX, o, yaw, 0, WALL_TOP + 7.2, d / 2 + 0.7, Math.min(w - 1, 6), 0.4, 1.4);
  }
}

function archBridge(batch, track, idx, { rise, peak, width, color, shops = false }) {
  const i = track.wrap(idx);
  const half = track.hw[i] + 7;
  const open = track.hw[i] + 2;
  const deck = (x) => 2 + (peak - 2) * (1 - (x / half) ** 2);
  const pts = [new THREE.Vector2(-half, -1)];
  for (let k = 0; k <= 24; k++) {
    const x = -half + (2 * half * k) / 24;
    pts.push(new THREE.Vector2(x, deck(x)));
  }
  pts.push(new THREE.Vector2(half, -1));
  for (let k = 0; k <= 24; k++) {
    const a = (k / 24) * Math.PI;
    pts.push(new THREE.Vector2(Math.cos(a) * open, Math.sin(a) * rise - 1));
  }
  const geometry = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: width, bevelEnabled: false }).translate(0, 0, -width / 2);
  const p = track.point(i);
  const yaw = track.heading(i) + Math.PI / 2;
  batch.add(color, geometry, mat(p.x, 0, p.z, 1, 1, 1, 0, yaw - Math.PI / 2, 0));
  const put = placer(batch);
  const o = new THREE.Vector3(p.x, 0, p.z);
  const span = (x) => x;
  for (let k = -half + 2; k <= half - 2; k += 1.5) {
    for (const side of [-1, 1]) put('trim', BOX, o, yaw - Math.PI / 2, span(k), deck(k) + 0.7, side * (width / 2 - 0.3), 0.45, 1.4, 0.45);
  }
  if (shops) {
    for (let k = -half + 5; k <= half - 5; k += 5) {
      if (Math.abs(k) < 5) continue;
      for (const side of [-1, 1]) {
        put('cream', BOX, o, yaw - Math.PI / 2, k, deck(k) + 2.2, side * (width / 2 - 2.2), 4.6, 4, 3.6);
        put('roof', ROOF, o, yaw - Math.PI / 2, k, deck(k) + 4.2, side * (width / 2 - 2.2), 2.6, 1.6, 4.8, 0, 0);
        put('door', BOX, o, yaw - Math.PI / 2, k, deck(k) + 1.8, side * (width / 2 - 4.05), 2, 2.6, 0.15);
      }
    }
    put('trim', BOX, o, yaw - Math.PI / 2, 0, deck(0) + 3.5, 0, 6, 6, width - 1);
    put('roof', ROOF, o, yaw - Math.PI / 2, 0, deck(0) + 6.5, 0, 3.6, 2.6, width);
    put('door', BOX, o, yaw - Math.PI / 2, 0, deck(0) + 2.8, 0, 3, 4, width - 0.6);
  } else {
    for (const side of [-1, 1]) {
      put('lamp', CYL, o, yaw - Math.PI / 2, side * 3, deck(3) + 2.2, width / 2 - 0.3, 0.12, 3.4, 0.12);
      put('lamp', BOX, o, yaw - Math.PI / 2, side * 3, deck(3) + 4.1, width / 2 - 0.3, 0.7, 0.8, 0.7);
    }
  }
  return { x: p.x, z: p.z, r: half };
}

function gondola(batch, x, z, yaw, rand, rower) {
  const put = placer(batch);
  const o = new THREE.Vector3(x, 0, z);
  put('gondola', BALL, o, yaw, 0, 0.25, 0, 0.95, 0.55, 5.2);
  put('gondola', BOX, o, yaw, 0, 1.0, 4.9, 0.35, 1.4, 0.6, -0.5);
  put('gondola', BOX, o, yaw, 0, 1.0, -4.9, 0.35, 1.2, 0.6, 0.5);
  put('ferro', BOX, o, yaw, 0, 1.85, 5.35, 0.12, 0.9, 0.5);
  put('cushion', BOX, o, yaw, 0, 0.8, 0.6, 1.1, 0.5, 1.6);
  if (rower) {
    put('shirt', CYL, o, yaw, 0, 1.9, -3.6, 0.42, 1.5, 0.42);
    put('stripe', CYL, o, yaw, 0, 1.75, -3.6, 0.44, 0.25, 0.44);
    put('stripe', CYL, o, yaw, 0, 2.25, -3.6, 0.44, 0.25, 0.44);
    put('skin', BALL, o, yaw, 0, 3.0, -3.6, 0.38, 0.4, 0.38);
    put('hat', CYL, o, yaw, 0, 3.35, -3.6, 0.65, 0.1, 0.65);
    put('stripe', CYL, o, yaw, 0, 3.45, -3.6, 0.42, 0.14, 0.42);
    put('wood', BOX, o, yaw, 0.6, 1.6, -3.4, 0.12, 0.12, 4.4, 0.5);
  }
}

function pole(batch, x, z, colorKey, height = 6) {
  for (let k = 0; k < 5; k++) batch.add(k % 2 ? 'poleWhite' : colorKey, CYL, mat(x, -1 + (k + 0.5) * (height / 5), z, 0.28, height / 5, 0.28));
  batch.add('gold', BALL, mat(x, height - 0.8, z, 0.38, 0.38, 0.38));
}

function landmarks(batch, windows, track, idx, side, rand) {
  const i = track.wrap(idx);
  const put = placer(batch);
  const at = (along, lateral) => {
    const k = track.wrap(i + Math.round(along / track.spacing));
    return track.point(k, side * (track.hw[k] + lateral));
  };
  const face = Math.atan2(-side * track.nx[i], -side * track.nz[i]);

  const palace = at(38, WALK + 10);
  const po = new THREE.Vector3(palace.x, 0, palace.z);
  put('palace', BOX, po, face, 0, WALL_TOP + 13, 0, 44, 15, 18);
  put('trim', BOX, po, face, 0, WALL_TOP + 3, 0, 44, 6, 18);
  put('trim', BOX, po, face, 0, WALL_TOP + 20.8, 0, 45, 0.8, 19);
  for (let k = -20; k <= 20; k += 4) {
    put('trim', CYL, po, face, k, WALL_TOP + 3, 9.4, 0.55, 6, 0.55);
    put('door', BOX, po, face, k + 2, WALL_TOP + 2.6, 9.05, 2.6, 4.2, 0.2);
    put('trim', CYL, po, face, k, WALL_TOP + 8.2, 9.4, 0.35, 4, 0.35);
    put('window', BOX, po, face, k, WALL_TOP + 14, 9.05, 1.6, 3, 0.2);
    put('trim', BOX, po, face, k + 2, WALL_TOP + 22, 0, 1, 1.6, 19);
  }

  const tower = at(-14, WALK + 26);
  batch.add('brick', BOX, mat(tower.x, WALL_TOP + 22, tower.z, 8, 44, 8));
  batch.add('belfry', BOX, mat(tower.x, WALL_TOP + 47, tower.z, 8.6, 6, 8.6));
  for (let k = 0; k < 4; k++) {
    const a = k * (Math.PI / 2);
    batch.add('door', BOX, mat(tower.x + Math.sin(a) * 4.3, WALL_TOP + 47, tower.z + Math.cos(a) * 4.3, 2.2, 3.6, 2.2, 0, a, 0));
  }
  batch.add('belfry', BOX, mat(tower.x, WALL_TOP + 51.5, tower.z, 7, 3, 7));
  batch.add('spire', HIP, mat(tower.x, WALL_TOP + 53, tower.z, 7.4, 12, 7.4));
  batch.add('gold', BALL, mat(tower.x, WALL_TOP + 65.6, tower.z, 0.9, 0.9, 0.9));

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
  for (const side of [-1, 1]) {
    for (let i = 0; i < track.N; i++) {
      const j = (i + 1) % track.N;
      if (!landAt(i, side) || !landAt(j, side)) continue;
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
  const island = (x, z) => ((x + 10) / 400) ** 2 + ((z - 150) / 265) ** 2 + 0.08 * (noise(x * 2, z * 2) - 0.5) < 1;
  const lagoon = (x, z) => z < -48 + 10 * Math.sin(x * 0.02);
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
  taken.push(...landmarks(batch, windows, track, 0, landSide, rand));

  const mouth = Math.round(0.125 * N);
  const saluteSide = -landSide;
  if (landAt(mouth, saluteSide)) {
    const p = track.point(mouth, saluteSide * (track.hw[mouth] + WALK + 16));
    salute(batch, p.x, p.z);
    taken.push({ x: p.x, z: p.z, r: 18 });
  }
  sanGiorgio(batch, 40, -200);

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

  for (const side of [-1, 1]) {
    let k = 0;
    while (k < N) {
      const w = 8 + rand() * 6;
      const steps = Math.max(2, Math.round(w / track.spacing));
      const mid = track.wrap(k + Math.floor(steps / 2));
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
      building(batch, windows, new THREE.Vector3(c.x, 0, c.z), yaw, w, d, h, rand, { canal: true });
      taken.push({ x: c.x, z: c.z, r: Math.min(w, d) / 2 });
      if (rand() < 0.3) {
        const pp = track.point(mid, side * (hw - 0.4));
        const color = ['poleBlue', 'poleRed'][Math.floor(rand() * 2)];
        pole(batch, pp.x, pp.z, color);
        const q = track.point(mid + 2, side * (hw - 0.4));
        pole(batch, q.x, q.z, color);
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
      building(batch, windows, new THREE.Vector3(x, 0, z), yaw, w, d, 10 + rand() * 14, rand);
      taken.push({ x, z, r: Math.max(w, d) * 0.45 });
    }
  }

  for (let i = 0; i < N; i += 4) {
    const f = i / N;
    if (track.hw[i] > 30 || rand() < 0.75) continue;
    const side = rand() < 0.5 ? -1 : 1;
    if (!landAt(i, side)) continue;
    if (bridges.some((b) => Math.hypot(b.x - track.px[i], b.z - track.pz[i]) < 14)) continue;
    const p = track.point(i, side * (track.hw[i] - 1.1));
    const yaw = track.heading(i);
    gondola(batch, p.x, p.z, yaw, rand, rand() < 0.4);
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
    const x = -300 + rand() * 600;
    const z = -60 - rand() * 220;
    const s = surface.sample(x, z);
    if (s.edge < 6 || !lagoon(x, z) || Math.hypot(x - 40, z + 200) < 50) continue;
    for (let k = 0; k < 3; k++) batch.add('woodDark', CYL, mat(x + Math.cos(k * 2.1) * 0.5, 1.5, z + Math.sin(k * 2.1) * 0.5, 0.3, 7, 0.3, Math.cos(k * 2.1) * 0.12, 0, Math.sin(k * 2.1) * 0.12));
    batch.add('rope', CYL, mat(x, 3.5, z, 0.9, 0.3, 0.9));
    made++;
  }

  const lamps = [];
  for (let i = 0; i < N; i += 14) {
    if (track.hw[i] < 30) continue;
    if (!landAt(i, landSide)) continue;
    const p = track.point(i, landSide * (track.hw[i] + 1));
    if (!free(p.x, p.z, 1)) continue;
    batch.add('lamp', CYL, mat(p.x, WALL_TOP + 2.2, p.z, 0.14, 4.4, 0.14));
    batch.add('lamp', BOX, mat(p.x, WALL_TOP + 4.6, p.z, 0.8, 1, 0.8));
    lamps.push(new THREE.Vector3(p.x, WALL_TOP + 4.6, p.z));
  }

  const scenery = new THREE.Group();
  const chunks = await batch.buildAsync(scenery, 0.1, VENICE_COLORS, undefined, tick);
  const glass = await windows.buildAsync(scenery, 0, VENICE_COLORS, undefined, tick);
  group.add(scenery);
  const lampGlow = new THREE.InstancedMesh(BALL, glow(0xfff2b0), Math.max(1, lamps.length));
  lamps.forEach((p, k) => lampGlow.setMatrixAt(k, mat(p.x, p.y, p.z, 0.32, 0.4, 0.32)));
  lampGlow.count = lamps.length;
  group.add(lampGlow);

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

  return {
    fog,
    water,
    sun,
    surface,
    shores,
    update(t, dt, camera) {
      water.update(t);
      cullChunks(chunks, camera, fog.far);
      cullChunks(glass, camera, fog.far * 0.6);
      sky.position.copy(camera.position);
      buoys.userData.update(t);
      for (const cloud of clouds) {
        cloud.position.x += cloud.userData.speed * dt;
        if (cloud.position.x > 800) cloud.position.x = -800;
      }
    },
  };
}
