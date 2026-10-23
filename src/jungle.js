import * as THREE from 'three';
import { createWater } from './water.js';
import { toon, glow, mulberry32 } from './toon.js';
import { Batcher, cullChunks, slicer, COLORS, mat, CONE, ROCK, addPalm, createSky, createCloud, createArch, SUN_DIR } from './world.js';

const CELL = 3;
const MARGIN = 340;
const RIVER_AMP = 0.4;
const SKY_GREEN = 0xd2f2dc;

const JUNGLE_COLORS = {
  ...COLORS,
  bark: 0x7a5230,
  barkLight: 0x9c7046,
  barkPale: 0xb3a487,
  moss: 0x4f9a3a,
  leaf: 0x2f9a45,
  leafLight: 0x56c04f,
  leafDark: 0x1d7a3e,
  leafLime: 0x8ccf45,
  leafTeal: 0x1b8a5e,
  monstera: 0x1f7f45,
  caveRock: 0x7a6a5a,
  caveRockDark: 0x5b4d41,
  caveRockLight: 0x958270,
  fern: 0x4cbf5a,
  vine: 0x3f7a2c,
  banana: 0x62d04c,
  bananaDark: 0x3aa843,
  rock: 0x9a958c,
  pillar: 0x5b4636,
  railYellow: 0xffd23f,
  railDark: 0x2b3440,
};

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function noise(x, z) {
  return (
    0.5 +
    0.25 * Math.sin(x * 0.021 + Math.sin(z * 0.013) * 2) +
    0.15 * Math.sin(z * 0.034 + x * 0.011) +
    0.1 * Math.sin((x - z) * 0.057)
  );
}

export async function riverSurface(track, tick) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < track.N; i++) {
    minX = Math.min(minX, track.px[i]);
    maxX = Math.max(maxX, track.px[i]);
    minZ = Math.min(minZ, track.pz[i]);
    maxZ = Math.max(maxZ, track.pz[i]);
  }
  minX -= MARGIN;
  minZ -= MARGIN;
  maxX += MARGIN;
  maxZ += MARGIN;
  const cols = Math.ceil((maxX - minX) / CELL) + 1;
  const rows = Math.ceil((maxZ - minZ) / CELL) + 1;
  const nearest = new Int16Array(cols * rows);
  const { N, px, pz, tx, tz, wrap, spacing } = track;
  const step = 4;
  for (let r = 0; r < rows; r++) {
    await tick();
    const z = minZ + r * CELL;
    for (let c = 0; c < cols; c++) {
      const x = minX + c * CELL;
      let best = 0;
      let bestD = Infinity;
      for (let i = 0; i < N; i += step) {
        const d = (x - px[i]) ** 2 + (z - pz[i]) ** 2;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      for (let k = best - step; k <= best + step; k++) {
        const i = wrap(k);
        const d = (x - px[i]) ** 2 + (z - pz[i]) ** 2;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      nearest[r * cols + c] = best;
    }
  }

  const out = { level: 0, amp: 0, s: 0, dist: 0 };
  return {
    bounds: { minX, maxX, minZ, maxZ },
    sample(x, z) {
      const c = Math.min(cols - 1, Math.max(0, Math.round((x - minX) / CELL)));
      const r = Math.min(rows - 1, Math.max(0, Math.round((z - minZ) / CELL)));
      const i = nearest[r * cols + c];
      const along = (x - px[i]) * tx[i] + (z - pz[i]) * tz[i];
      const s = i * spacing + along;
      out.s = s;
      out.level = track.level(s);
      out.amp = track.inTunnel(s) ? 0.2 : RIVER_AMP;
      out.dist = Math.hypot(x - px[i], z - pz[i]);
      return out;
    },
  };
}

const ARCH_TOP = 16;
const ARCH_FLOOR = -5;
const LID = 18;

function highLevel(track, s) {
  let d = track.ahead(track.river.seam, s);
  if (d > track.length / 2) d -= track.length;
  return track.river.top - track.river.slope * d;
}

function tunnelMask(track, s) {
  if (track.inTunnel(s)) return 1;
  const r = track.river;
  const toEntrance = track.ahead(s, r.tunnelIn);
  const fromExit = track.ahead(r.tunnelOut, s);
  return Math.max(0, 1 - smooth(0, 60, toEntrance), 1 - smooth(0, 60, fromExit));
}

function isHole(surface, track, x, z) {
  const { s, dist } = surface.sample(x, z);
  return track.inTunnel(s) && dist < track.halfWidth + 10;
}

function terrainHeight(surface, track, x, z) {
  const { level, dist, s } = surface.sample(x, z);
  const hw = track.halfWidth;
  const bank = smooth(hw - 4, hw + 7, dist);
  const hills = smooth(hw + 7, hw + 70, dist) * (2 + 7 * noise(x, z));
  const mountains = smooth(140, 330, dist) * 70 * (0.5 + 0.6 * noise(x * 1.7 + 300, z * 1.7));
  const normal = level - 4 + bank * 8.5 + hills + mountains;
  const mask = tunnelMask(track, s);
  if (mask <= 0) return normal;
  const ridge = highLevel(track, s) + LID + 4 + 14 * noise(x * 2.3, z * 2.3) * smooth(hw + 10, hw + 40, dist);
  const weight = mask * smooth(hw + 6, hw + 11, dist);
  return normal + (Math.max(normal, ridge) - normal) * weight;
}

async function buildTerrain(surface, track, tick) {
  const { minX, maxX, minZ, maxZ } = surface.bounds;
  const step = 4;
  const cols = Math.ceil((maxX - minX) / step) + 1;
  const rows = Math.ceil((maxZ - minZ) / step) + 1;
  const heights = new Float32Array(cols * rows);
  const levels = new Float32Array(cols * rows);
  const holes = new Uint8Array(cols * rows);
  const shade = new Float32Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    await tick();
    for (let c = 0; c < cols; c++) {
      const x = minX + c * step;
      const z = minZ + r * step;
      heights[r * cols + c] = terrainHeight(surface, track, x, z);
      const sampled = surface.sample(x, z);
      levels[r * cols + c] = sampled.level;
      shade[r * cols + c] = smooth(track.halfWidth + 9, track.halfWidth + 26, sampled.dist);
      holes[r * cols + c] = isHole(surface, track, x, z) ? 1 : 0;
    }
  }
  const positions = [];
  const colors = [];
  const grass = new THREE.Color(0x6fc94f);
  const grassDark = new THREE.Color(0x4fae45);
  const mud = new THREE.Color(0xc9a46b);
  const floor = new THREE.Color(0x2c6b33);
  const rock = new THREE.Color(0xa69b8f);
  const rockDark = new THREE.Color(0x8b8076);
  const tint = new THREE.Color();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c3 = new THREE.Vector3();
  const n = new THREE.Vector3();
  const tri = (i0, i1, i2, cIdx) => {
    if (holes[i0] || holes[i1] || holes[i2]) return;
    for (const [v, idx] of [[a, i0], [b, i1], [c3, i2]]) {
      const rr = Math.floor(idx / cols);
      const cc = idx % cols;
      v.set(minX + cc * step, heights[idx], minZ + rr * step);
    }
    n.subVectors(b, a).cross(c3.clone().sub(a)).normalize();
    const lvl = levels[cIdx];
    const steep = 1 - Math.abs(n.y);
    const lush = noise(a.x * 3, a.z * 3) > 0.55 ? grassDark : grass;
    for (const v of [a, b, c3]) {
      if (steep > 0.45) tint.copy(steep > 0.7 ? rockDark : rock);
      else tint.copy(mud).lerp(lush, smooth(lvl + 0.4, lvl + 2.4, v.y)).lerp(floor, shade[cIdx] * 0.8);
      positions.push(v.x, v.y, v.z);
      colors.push(tint.r, tint.g, tint.b);
    }
  };
  for (let r = 0; r < rows - 1; r++) {
    await tick();
    for (let c = 0; c < cols - 1; c++) {
      const i = r * cols + c;
      tri(i, i + cols, i + 1, i);
      tri(i + 1, i + cols, i + cols + 1, i);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, toon(0xffffff, { vertexColors: true }));
}

function ribbon(track, from, to, levelAt, positions) {
  const hw = track.halfWidth + 8;
  const lanes = 10;
  const at = (k, lane) => {
    const i = track.wrap(k);
    const lat = -hw + (2 * hw * lane) / lanes;
    return [track.px[i] + track.nx[i] * lat, track.pz[i] + track.nz[i] * lat];
  };
  for (let k = from; k < to; k++) {
    const s0 = k * track.spacing;
    const s1 = (k + 1) * track.spacing;
    if (track.river.drops.some((d) => track.ahead(s0, d.s) < track.spacing)) continue;
    const y0 = levelAt(s0);
    const y1 = levelAt(s1);
    for (let lane = 0; lane < lanes; lane++) {
      const [ax, az] = at(k, lane);
      const [bx, bz] = at(k, lane + 1);
      const [cx, cz] = at(k + 1, lane);
      const [dx, dz] = at(k + 1, lane + 1);
      positions.push(ax, y0, az, cx, y1, cz, bx, y0, bz);
      positions.push(bx, y0, bz, cx, y1, cz, dx, y1, dz);
    }
  }
}

const lowLevel = (track) => (s) => track.level(s, track.pastSeam(s) ? 1 : 0);
const copyLevel = (track) => (s) => highLevel(track, s);

function buildRiver(track) {
  const { river, spacing, N } = track;
  const kIn = Math.round(river.tunnelIn / spacing);
  const kOut = Math.round(river.tunnelOut / spacing);
  const kSeam = Math.round(river.seam / spacing);
  const positions = [];
  ribbon(track, kOut, kIn + N, (s) => track.level(s), positions);
  ribbon(track, kIn, kOut, lowLevel(track), positions);
  ribbon(track, kSeam - GHOST, kOut, copyLevel(track), positions);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return createWater({ geometry, flat: true, amp: RIVER_AMP, deep: 0x1c8f86, shallow: 0x4fd6b4 });
}

const GHOST = 45;

const CAVE_STEPS = 30;

function hash(a, b) {
  const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return v - Math.floor(v);
}

function rockOffset(k, j) {
  const theta = (j / CAVE_STEPS) * Math.PI;
  const lumps = 2.2 * Math.sin(k * 0.21 + j * 0.7) * Math.sin(k * 0.07 + j * 0.31 + 1.7);
  const ledges = 1.6 * Math.max(0, Math.sin(k * 0.13 + j * 1.9)) ** 3;
  const jag = 1.5 * (hash(k, j) - 0.5);
  const ceiling = Math.sin(theta) ** 2;
  let d = lumps + jag * (0.7 + ceiling) - ledges;
  if (theta < 0.3 || theta > Math.PI - 0.3) d = Math.max(d, -1.2);
  return d;
}

function profile(k, j, extra = 0) {
  const theta = (j / CAVE_STEPS) * Math.PI;
  const w = CAVE_HALF;
  const h = ARCH_TOP - ARCH_FLOOR;
  const d = rockOffset(k, j) + extra;
  const nx = Math.cos(theta) * h;
  const ny = Math.sin(theta) * w;
  const n = Math.hypot(nx, ny);
  return { lat: Math.cos(theta) * w + (d * nx) / n, up: ARCH_FLOOR + h * Math.sin(theta) + (d * ny) / n };
}

const CAVE_HALF = 29;

function tubePoint(track, k, j, levelAt, extra = 0) {
  const i = track.wrap(k);
  const { lat, up } = profile(k, j, extra);
  return new THREE.Vector3(track.px[i] + track.nx[i] * lat, levelAt(k * track.spacing) + up, track.pz[i] + track.nz[i] * lat);
}

function buildTube(track, from, to, levelAt, ends) {
  const positions = [];
  const colors = [];
  const tones = [new THREE.Color(0x6e5d4e), new THREE.Color(0x85725f), new THREE.Color(0x7a6655)];
  const crack = new THREE.Color(0x3e342c);
  const wet = new THREE.Color(0x3d4038);
  const moss = new THREE.Color(0x4f8a3a);
  const c = new THREE.Color();
  const grid = [];
  for (let k = from; k <= to + 1; k++) {
    const row = [];
    for (let j = 0; j <= CAVE_STEPS; j++) row.push(tubePoint(track, k, j, levelAt));
    grid.push(row);
  }
  const tri = (a, b, d, k, j) => {
    const level = levelAt(k * track.spacing);
    const cy = (a.y + b.y + d.y) / 3 - level;
    const band = Math.floor((cy + 1.2 * Math.sin(k * 0.17)) / 2.4);
    c.copy(tones[((band % 3) + 3) % 3]);
    c.multiplyScalar(0.88 + hash(k * 3 + 1, j * 5 + (a === d ? 1 : 0)) * 0.24);
    if (hash(k + 0.5, j + 0.25) < 0.07) c.copy(crack);
    if (cy < 1.4) c.lerp(wet, 0.75);
    const nearMouth = Math.min(...ends.map((e) => Math.abs(k - e)));
    if (nearMouth < 16 && hash(k * 1.3, j * 0.7) < 0.55 * (1 - nearMouth / 16)) c.lerp(moss, 0.8);
    if (cy > 9) c.multiplyScalar(0.82);
    for (const p of [a, b, d]) {
      positions.push(p.x, p.y, p.z);
      colors.push(c.r, c.g, c.b);
    }
  };
  for (let r = 0; r < grid.length - 1; r++) {
    const k = from + r;
    for (let j = 0; j < CAVE_STEPS; j++) {
      const p00 = grid[r][j];
      const p10 = grid[r + 1][j];
      const p01 = grid[r][j + 1];
      const p11 = grid[r + 1][j + 1];
      if (hash(k, j) < 0.5) {
        tri(p00, p10, p01, k, j);
        tri(p01, p10, p11, k, j);
      } else {
        tri(p00, p10, p11, k, j);
        tri(p00, p11, p01, k, j);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, toon(0xffffff, { vertexColors: true, side: THREE.DoubleSide }));
}

const CAVE_KEYS = ['caveRock', 'caveRockDark', 'caveRockLight'];
const DRIP = new THREE.ConeGeometry(1, 1, 6).rotateX(Math.PI);

function caveDetails(batch, track, from, to, levelAt) {
  for (let k = from; k < to; k++) {
    if (hash(k, 91) < 0.4) {
      const j = Math.round(CAVE_STEPS * (0.28 + hash(k, 17) * 0.44));
      const top = tubePoint(track, k, j, levelAt, -0.4);
      const count = 1 + Math.floor(hash(k, 23) * 3);
      for (let n = 0; n < count; n++) {
        const len = 1.6 + hash(k, 30 + n) * 4;
        const r = 0.35 + hash(k, 40 + n) * 0.6;
        const ox = (hash(k, 50 + n) - 0.5) * 2.4;
        const oz = (hash(k, 60 + n) - 0.5) * 2.4;
        batch.add(CAVE_KEYS[(k + n) % 3], DRIP, mat(top.x + ox, top.y - len / 2 + 0.3, top.z + oz, r, len, r));
      }
    }
    for (const side of [0, 1]) {
      if (hash(k, 70 + side) > 0.32) continue;
      const j = side ? CAVE_STEPS - 2 - Math.floor(hash(k, 80) * 2) : 2 + Math.floor(hash(k, 81) * 2);
      const p = tubePoint(track, k, j, levelAt, -0.6);
      const size = 1 + hash(k, 90 + side) * 1.8;
      batch.add(CAVE_KEYS[(k + side) % 3], ROCK, mat(p.x, Math.max(p.y, levelAt(k * track.spacing) + size * 0.2), p.z, size, size * (0.6 + hash(k, 95) * 0.6), size, hash(k, 1), hash(k, 2) * 6, hash(k, 3)));
      if (hash(k, 99 + side) < 0.3) {
        const h = 1.5 + hash(k, 100) * 2.5;
        batch.add(CAVE_KEYS[(k + 1) % 3], CONE, mat(p.x, levelAt(k * track.spacing) + h / 2, p.z, 0.7, h, 0.7));
      }
    }
  }
}

function mouthRocks(batch, track, k, levelAt, toward, rand) {
  const i = track.wrap(k);
  for (let j = 0; j <= CAVE_STEPS; j += 1) {
    for (let ring = 0; ring < 2; ring++) {
      if (rand() < 0.25) continue;
      const p = tubePoint(track, k, j, levelAt, 1.2 + ring * 3 + rand() * 1.5);
      const size = 1.8 + rand() * 2.4 + ring * 0.8;
      const along = toward * (rand() * 2.5 - 0.5);
      batch.add(CAVE_KEYS[Math.floor(rand() * 3)], ROCK, mat(p.x + track.tx[i] * along, p.y, p.z + track.tz[i] * along, size, size * (0.7 + rand() * 0.5), size, rand() * 6, rand() * 6, rand() * 6));
    }
    if (j > 6 && j < CAVE_STEPS - 6 && rand() < 0.45) {
      const p = tubePoint(track, k, j, levelAt, 0.5);
      vine(batch, p.clone().add(new THREE.Vector3(track.tx[i] * toward * 1.2, 0, track.tz[i] * toward * 1.2)), 2 + rand() * 6, rand, new THREE.Vector3((rand() - 0.5) * 0.8, 0, (rand() - 0.5) * 0.8));
    }
  }
}

function buildShell(track, from, to) {
  const positions = [];
  const hw = track.halfWidth + 10;
  const corner = (k, lat, y) => {
    const i = track.wrap(k);
    return [track.px[i] + track.nx[i] * lat, y, track.pz[i] + track.nz[i] * lat];
  };
  const lowAt = lowLevel(track);
  for (let k = from; k < to; k++) {
    const lid0 = highLevel(track, k * track.spacing) + LID;
    const lid1 = highLevel(track, (k + 1) * track.spacing) + LID;
    const base0 = lowAt(k * track.spacing) + ARCH_FLOOR - 2;
    const base1 = lowAt((k + 1) * track.spacing) + ARCH_FLOOR - 2;
    for (const side of [-1, 1]) {
      const a = corner(k, side * hw, base0);
      const b = corner(k + 1, side * hw, base1);
      const c = corner(k, side * hw, lid0);
      const d = corner(k + 1, side * hw, lid1);
      positions.push(...a, ...b, ...c, ...c, ...b, ...d);
    }
    const a = corner(k, -hw, lid0);
    const b = corner(k + 1, -hw, lid1);
    const c = corner(k, hw, lid0);
    const d = corner(k + 1, hw, lid1);
    positions.push(...a, ...b, ...c, ...c, ...b, ...d);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, toon(0x8b7d6e, { side: THREE.DoubleSide }));
}

function buildMouth(track, k, levelAt, top) {
  const hw = track.halfWidth + 14;
  const i = track.wrap(k);
  const base = levelAt(k * track.spacing);
  const shape = new THREE.Shape();
  shape.moveTo(-hw, base + ARCH_FLOOR - 2);
  shape.lineTo(hw, base + ARCH_FLOOR - 2);
  shape.lineTo(hw, top);
  shape.lineTo(-hw, top);
  shape.closePath();
  const hole = new THREE.Path();
  for (let j = 0; j <= CAVE_STEPS; j++) {
    const { lat, up } = profile(k, j);
    if (j === 0) hole.moveTo(lat, base + up);
    else hole.lineTo(lat, base + up);
  }
  shape.holes.push(hole);
  const geometry = new THREE.ShapeGeometry(shape);
  const mesh = new THREE.Mesh(geometry, toon(0x6e5d4e, { side: THREE.DoubleSide }));
  const basis = new THREE.Matrix4().makeBasis(
    new THREE.Vector3(track.nx[i], 0, track.nz[i]),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(track.tx[i], 0, track.tz[i]),
  );
  mesh.applyMatrix4(basis);
  mesh.position.set(track.px[i], 0, track.pz[i]);
  return mesh;
}

function buildCap(track, k, levelAt, color, along = 0) {
  const i = track.wrap(k + along);
  const w = track.halfWidth + 8;
  const geometry = new THREE.PlaneGeometry(w * 2, ARCH_TOP - ARCH_FLOOR + 2);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, fog: false }));
  mesh.position.set(track.px[i], levelAt(k * track.spacing) + (ARCH_TOP + ARCH_FLOOR) / 2, track.pz[i]);
  mesh.rotation.y = track.heading(i);
  return mesh;
}

function buildCrystals(track, from, to, levelAt) {
  const group = new THREE.Group();
  const materials = [glow(0x6cf2ff), glow(0xff7ad9), glow(0xb6ff6c)];
  for (let k = from; k < to; k++) {
    if (k % 11 !== 0) continue;
    for (const side of [-1, 1]) {
      const p = tubePoint(track, k, side < 0 ? CAVE_STEPS - 5 : 5, levelAt, -0.8);
      for (let n = 0; n < 3; n++) {
        const seed = Math.sin((k * 7 + n * 13 + side * 5) * 12.9898) * 43758.5453;
        const r = seed - Math.floor(seed);
        const mesh = new THREE.Mesh(CRYSTAL, materials[(k + n + (side > 0 ? 1 : 0)) % 3]);
        mesh.position.set(p.x + (r - 0.5) * 1.6, p.y - 0.4 + n * 0.3, p.z + (r - 0.5) * 1.6);
        mesh.scale.set(0.35 + r * 0.25, 0.9 + r * 0.9, 0.35 + r * 0.25);
        mesh.rotation.set((r - 0.5) * 0.8, r * 3, (n - 1) * 0.5 * side);
        group.add(mesh);
      }
    }
  }
  return group;
}

const CRYSTAL = new THREE.OctahedronGeometry(1, 0);

function buildTunnel(track) {
  const { river, spacing } = track;
  const kIn = Math.round(river.tunnelIn / spacing);
  const kOut = Math.round(river.tunnelOut / spacing);
  const kSeam = Math.round(river.seam / spacing);
  const low = lowLevel(track);
  const high = copyLevel(track);
  const group = new THREE.Group();
  group.add(buildTube(track, kIn, kOut, low, [kIn, kOut]));
  group.add(buildTube(track, kSeam - GHOST, kOut, high, [kIn, kOut]));
  const batch = new Batcher();
  caveDetails(batch, track, kIn, kOut, low);
  caveDetails(batch, track, kSeam - GHOST, kOut, high);
  const rand = mulberry32(4411);
  mouthRocks(batch, track, kIn, low, -1, rand);
  mouthRocks(batch, track, kOut, high, 1, rand);
  const details = new THREE.Group();
  group.userData.chunks = batch.build(details, 0.08, JUNGLE_COLORS);
  group.add(details);
  group.add(buildCrystals(track, kIn, kOut, low));
  group.add(buildCrystals(track, kSeam - GHOST, kOut, high));
  group.add(buildShell(track, kIn, kOut));
  group.add(buildMouth(track, kIn, low, highLevel(track, river.tunnelIn) + LID));
  group.add(buildMouth(track, kOut, high, highLevel(track, river.tunnelOut) + LID));
  group.add(buildCap(track, kOut, low, 0xdff7ec, 3));
  group.add(buildCap(track, kSeam - GHOST, high, 0x15110d));
  return group;
}

const FALL_VERT = /* glsl */ `
  varying vec2 vUv;
  #include <common>
  #include <fog_pars_vertex>
  void main() {
    vUv = uv;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const FALL_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uAlpha;
  varying vec2 vUv;
  #include <common>
  #include <fog_pars_fragment>
  void main() {
    float col = floor(vUv.x * 46.0);
    float r = fract(sin(col * 12.9898) * 43758.5453);
    float flow = fract(vUv.y * 2.5 - uTime * (1.2 + r * 0.8) + r);
    float streak = smoothstep(0.5, 0.56, flow) * (1.0 - smoothstep(0.8, 0.9, flow));
    vec3 base = mix(vec3(0.42, 0.86, 0.84), vec3(0.75, 0.96, 0.95), vUv.y);
    vec3 color = mix(base, vec3(1.0), streak * 0.75 + smoothstep(0.82, 1.0, vUv.y) * 0.7 + smoothstep(0.08, 0.0, vUv.y) * 0.5);
    gl_FragColor = vec4(color, mix(uAlpha, 1.0, streak));
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

function fallMaterial(alpha = 1) {
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uAlpha: { value: alpha } }]),
    vertexShader: FALL_VERT,
    fragmentShader: FALL_FRAG,
    side: THREE.DoubleSide,
    transparent: alpha < 1,
    depthWrite: alpha >= 1,
    fog: true,
  });
}

function buildCurtain(track, k, levelAt) {
  const i = track.wrap(k);
  const base = levelAt(k * track.spacing);
  const hw = CAVE_HALF + 6;
  const top = LID + 2;
  const cols = 28;
  const rows = 16;
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let r = 0; r <= rows; r++) {
    const u = r / rows;
    const along = -1 + 3.5 * Math.sqrt(u);
    const y = base - 0.4 + top * (1 - u);
    for (let c = 0; c <= cols; c++) {
      const lat = -hw + (2 * hw * c) / cols;
      positions.push(track.px[i] + track.tx[i] * along + track.nx[i] * lat, y, track.pz[i] + track.tz[i] * along + track.nz[i] * lat);
      uvs.push(c / cols, u);
    }
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = r * (cols + 1) + c;
      indices.push(a, a + cols + 1, a + 1, a + 1, a + cols + 1, a + cols + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  const material = fallMaterial(0.88);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 4;
  return { mesh, material, base: { x: track.px[i] + track.tx[i] * 2.5, y: base, z: track.pz[i] + track.tz[i] * 2.5, nx: track.nx[i], nz: track.nz[i], hw: CAVE_HALF } };
}

function buildFalls(track, drop) {
  const s = drop.s;
  const i = Math.floor(s / track.spacing);
  const px = track.px[i], pz = track.pz[i], tx = track.tx[i], tz = track.tz[i], nx = track.nx[i], nz = track.nz[i];
  const height = drop.height;
  const bottom = track.level(s + 1);
  const hw = track.halfWidth + 8;
  const cols = 24;
  const rows = 14;
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let r = 0; r <= rows; r++) {
    const u = r / rows;
    const along = 1 + (height > 8 ? 9 : 3) * Math.sqrt(u);
    const y = bottom + height * (1 - u) + 0.3 * (1 - u);
    for (let c = 0; c <= cols; c++) {
      const lat = -hw + (2 * hw * c) / cols;
      positions.push(px + tx * along + nx * lat, y, pz + tz * along + nz * lat);
      uvs.push(c / cols, u);
    }
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = r * (cols + 1) + c;
      indices.push(a, a + cols + 1, a + 1, a + 1, a + cols + 1, a + cols + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  const material = fallMaterial();
  const mesh = new THREE.Mesh(geometry, material);
  return { mesh, material, base: { x: px + tx * 10, y: bottom, z: pz + tz * 10, nx, nz, hw: track.halfWidth }, big: height > 8, lip: { i, top: bottom + height } };
}

const CANOPY = new THREE.IcosahedronGeometry(1, 1);
const LIMB = new THREE.CylinderGeometry(0.55, 1, 1, 7).translate(0, 0.5, 0);
const LEAF = new THREE.SphereGeometry(1, 8, 4).scale(0.5, 0.07, 1.25).translate(0, 0, 1.2);
const STEM = new THREE.CylinderGeometry(0.06, 0.09, 1, 5).translate(0, 0.5, 0);
const UP = new THREE.Vector3(0, 1, 0);

const tilted = (x, y, z, sx, sy, sz, pitch, yaw) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ')), new THREE.Vector3(sx, sy, sz));

const canopyKey = (rand) => ['leaf', 'leafLight', 'leafDark', 'leafTeal', 'leaf', 'leafLime'][Math.floor(rand() * 6)];

function limb(batch, key, from, to, radius) {
  const dir = to.clone().sub(from);
  const len = dir.length();
  const m = new THREE.Matrix4().compose(from, new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize()), new THREE.Vector3(radius, len, radius));
  batch.add(key, LIMB, m);
}

function clump(batch, c, size, rand, flat = 0.5) {
  const key = canopyKey(rand);
  const lumps = 4 + Math.floor(rand() * 3);
  for (let i = 0; i < lumps; i++) {
    const a = (i / lumps) * Math.PI * 2 + rand();
    const off = i === 0 ? 0 : size * (0.45 + rand() * 0.35);
    const r = size * (i === 0 ? 0.8 : 0.45 + rand() * 0.25);
    const drop = i === 0 ? size * 0.15 : -size * 0.1 * rand();
    batch.add(rand() < 0.75 ? key : canopyKey(rand), CANOPY, mat(c.x + Math.cos(a) * off, c.y + drop, c.z + Math.sin(a) * off, r, r * flat, r, 0, rand() * 6, 0));
  }
}

function vine(batch, top, length, rand, sway) {
  const pts = [];
  for (let i = 0; i <= 5; i++) {
    const t = i / 5;
    pts.push(new THREE.Vector3(top.x + sway.x * t * t, top.y - length * t, top.z + sway.z * t * t));
  }
  batch.add('vine', new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 6, 0.07 + rand() * 0.05, 4));
  for (let i = 1; i < 5; i++) {
    if (rand() < 0.4) continue;
    const p = pts[i];
    batch.add(rand() < 0.5 ? 'leaf' : 'leafLight', LEAF, tilted(p.x, p.y, p.z, 0.45, 0.45, 0.45, 0.6 + rand() * 0.6, rand() * 6));
  }
}

function liana(batch, from, ground, rand) {
  const mid = from.clone().lerp(ground, 0.5);
  mid.y -= from.distanceTo(ground) * 0.25;
  const curve = new THREE.QuadraticBezierCurve3(from, mid, ground);
  batch.add('vine', new THREE.TubeGeometry(curve, 10, 0.12 + rand() * 0.06, 4));
}

function epiphyte(batch, p, rand) {
  const leaves = 4 + Math.floor(rand() * 3);
  for (let i = 0; i < leaves; i++) {
    batch.add(rand() < 0.5 ? 'banana' : 'leafLime', LEAF, tilted(p.x, p.y, p.z, 0.55, 0.55, 0.55, -0.5 - rand() * 0.5, (i / leaves) * Math.PI * 2 + rand()));
  }
}

function tree(batch, x, y, z, rand, { height, girth, river, reach, branches, layers }) {
  const lean = 0.06 + rand() * 0.12;
  const toward = river && rand() < 0.75 ? Math.atan2(river.z, river.x) + (rand() - 0.5) * 0.8 : rand() * Math.PI * 2;
  const bend = new THREE.Vector3(Math.cos(toward), 0, Math.sin(toward));
  const barkKey = ['bark', 'barkLight', 'barkPale'][Math.floor(rand() * 3)];
  const trunk = [];
  const segs = 4;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    trunk.push(new THREE.Vector3(x + bend.x * height * lean * t * t + (rand() - 0.5) * 0.6 * t, y - 1 + height * t, z + bend.z * height * lean * t * t + (rand() - 0.5) * 0.6 * t));
  }
  for (let i = 0; i < segs; i++) limb(batch, barkKey, trunk[i], trunk[i + 1].clone().add(new THREE.Vector3(0, 0.3, 0)), girth * (1 - 0.45 * (i / segs)));
  if (rand() < 0.5) batch.add('moss', CANOPY, mat(trunk[1].x, trunk[1].y + 1, trunk[1].z, girth * 1.05, 1.4, girth * 1.05));
  const top = trunk[segs];
  const ends = [];
  const spin = rand() * Math.PI * 2;
  for (let b = 0; b < branches; b++) {
    const a = spin + (b / branches) * Math.PI * 2 + (rand() - 0.5) * 0.7;
    const len = reach * (0.7 + rand() * 0.5);
    const start = trunk[segs - 1].clone().lerp(top, 0.4 + rand() * 0.6);
    const end = start.clone().add(new THREE.Vector3(Math.cos(a) * len, len * (0.35 + rand() * 0.45), Math.sin(a) * len));
    limb(batch, barkKey, start, end, girth * 0.32);
    ends.push(end);
    if (rand() < 0.35) epiphyte(batch, start.clone().lerp(end, 0.4).add(new THREE.Vector3(0, 0.3, 0)), rand);
  }
  ends.push(top.clone().add(new THREE.Vector3(0, reach * 0.35, 0)));
  for (const e of ends) clump(batch, e, reach * (0.75 + rand() * 0.3), rand, 0.45 + rand() * 0.15);
  for (let l = 1; l < layers; l++) {
    const p = trunk[segs - l - 1];
    const a = rand() * Math.PI * 2;
    const len = reach * 0.6;
    const end = p.clone().add(new THREE.Vector3(Math.cos(a) * len, len * 0.3, Math.sin(a) * len));
    limb(batch, barkKey, p, end, girth * 0.22);
    clump(batch, end, reach * 0.55, rand, 0.5);
  }
  const vines = Math.floor(rand() * (2 + branches));
  for (let v = 0; v < vines; v++) {
    const e = ends[Math.floor(rand() * ends.length)];
    vine(batch, e.clone().add(new THREE.Vector3((rand() - 0.5) * reach, -reach * 0.25, (rand() - 0.5) * reach)), 3 + rand() * height * 0.45, rand, new THREE.Vector3((rand() - 0.5) * 1.5, 0, (rand() - 0.5) * 1.5));
  }
  if (rand() < 0.4) {
    const e = ends[0];
    const a = rand() * Math.PI * 2;
    const d = 4 + rand() * 6;
    liana(batch, e, new THREE.Vector3(x + Math.cos(a) * d, y, z + Math.sin(a) * d), rand);
  }
  return { top, ends };
}

function addGiant(batch, x, y, z, rand, scale = 1, river = null) {
  const height = (19 + rand() * 12) * scale;
  const girth = 1.05 + rand() * 0.4;
  const fins = 3 + Math.floor(rand() * 2);
  const spin = rand() * Math.PI;
  for (let i = 0; i < fins; i++) {
    const a = spin + (i / fins) * Math.PI * 2;
    batch.add('bark', CONE, mat(x + Math.cos(a) * girth * 0.9, y + 1.2, z + Math.sin(a) * girth * 0.9, 0.22, 3.6, 1.7, 0, -a, 0));
  }
  tree(batch, x, y, z, rand, { height, girth, river, reach: 4.5 + rand() * 2.5, branches: 3 + Math.floor(rand() * 2), layers: 2 });
}

function addBroadleaf(batch, x, y, z, rand, tall = 1, river = null) {
  const height = (8 + rand() * 7) * tall;
  tree(batch, x, y, z, rand, { height, girth: 0.45 + height * 0.02, river, reach: 2.6 + rand() * 1.8, branches: 2 + Math.floor(rand() * 2), layers: 1 });
}

function addBanana(batch, x, y, z, rand, big = false) {
  const leaves = 5 + Math.floor(rand() * 4);
  const size = (1.1 + rand() * 1.2) * (big ? 1.8 : 1);
  const stem = (1 + rand() * 1.6) * (big ? 1.4 : 1);
  for (let i = 0; i < leaves; i++) {
    const yaw = (i / leaves) * Math.PI * 2 + rand() * 0.5;
    const pitch = -0.2 - rand() * 0.6;
    const h = stem * (0.6 + rand() * 0.6);
    batch.add('vine', STEM, tilted(x, y, z, 1, h, 1, Math.sin(yaw) * 0.25, 0));
    const key = big ? (rand() < 0.5 ? 'monstera' : 'leafTeal') : rand() < 0.5 ? 'banana' : 'bananaDark';
    batch.add(key, LEAF, tilted(x, y + h, z, size, size, size * (1 + rand() * 0.6), -pitch, yaw));
  }
}

function addBush(batch, x, y, z, rand) {
  const lumps = 2 + Math.floor(rand() * 2);
  for (let i = 0; i < lumps; i++) {
    const a = rand() * Math.PI * 2;
    const s = 1.8 + rand() * 1.8;
    const key = ['leaf', 'leafLight', 'leafDark', 'fern'][Math.floor(rand() * 4)];
    batch.add(key, CANOPY, mat(x + Math.cos(a) * s * 0.5, y + s * 0.35, z + Math.sin(a) * s * 0.5, s, s * 0.7, s));
  }
}

function addReeds(batch, x, y, z, rand, out) {
  const blades = 4 + Math.floor(rand() * 4);
  for (let i = 0; i < blades; i++) {
    const h = 1.6 + rand() * 2.4;
    const ox = (rand() - 0.5) * 1.2;
    const oz = (rand() - 0.5) * 1.2;
    batch.add(rand() < 0.5 ? 'fern' : 'leafLight', CONE, mat(x + ox, y + h / 2, z + oz, 0.18, h, 0.18, out.z * 0.35 + (rand() - 0.5) * 0.3, 0, -out.x * 0.35 + (rand() - 0.5) * 0.3));
  }
}

function addFern(batch, x, y, z, rand) {
  const leaves = 5 + Math.floor(rand() * 3);
  const size = 1.2 + rand() * 1.4;
  for (let i = 0; i < leaves; i++) {
    const a = (i / leaves) * Math.PI * 2 + rand() * 0.4;
    batch.add('fern', CONE, mat(x + Math.cos(a) * size * 0.6, y + size * 0.35, z + Math.sin(a) * size * 0.6, 0.35 * size, size * 1.4, 0.18 * size, Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9));
  }
}

export async function createJungle(group, track, fx) {
  const tick = slicer();
  const fog = new THREE.Fog(SKY_GREEN, 130, 560);
  const sky = createSky();
  group.add(sky);
  group.add(new THREE.HemisphereLight(0xeaffea, 0x3c8f6a, 1.4));
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.4);
  sun.position.copy(SUN_DIR).multiplyScalar(100);
  group.add(sun);

  const surface = await riverSurface(track, tick);
  group.add(await buildTerrain(surface, track, tick));
  await tick();
  const water = buildRiver(track);
  group.add(water.mesh);
  const falls = track.river.drops.map((drop) => buildFalls(track, drop));
  for (const f of falls) group.add(f.mesh);
  await tick();
  const tunnel = buildTunnel(track);
  await tick();
  group.add(tunnel);
  const kExit = Math.round(track.river.tunnelOut / track.spacing);
  const curtains = [buildCurtain(track, kExit, lowLevel(track)), buildCurtain(track, kExit, copyLevel(track))];
  for (const c of curtains) {
    group.add(c.mesh);
    falls.push({ material: c.material, base: c.base, curtain: true });
  }

  const batch = new Batcher();

  const rand = mulberry32(7203);
  const hw = track.halfWidth;
  const { minX, maxX, minZ, maxZ } = surface.bounds;
  const steep = (x, z) => {
    const h = terrainHeight(surface, track, x, z);
    return Math.max(
      Math.abs(terrainHeight(surface, track, x + 3, z) - h),
      Math.abs(terrainHeight(surface, track, x, z + 3) - h),
    ) > 2.4;
  };
  const bankSpot = (from, to) => {
    const idx = Math.floor(rand() * track.N);
    const side = rand() < 0.5 ? -1 : 1;
    const p = track.point(idx, side * (hw + from + rand() * (to - from)));
    const { dist, s } = surface.sample(p.x, p.z);
    if (dist < hw + from - 0.5 || tunnelMask(track, s) > 0 || steep(p.x, p.z)) return null;
    const i = track.wrap(idx);
    p.river = { x: -side * track.nx[i], z: -side * track.nz[i] };
    return p;
  };
  const place = async (count, from, to, plant) => {
    for (let n = 0, tries = 0; n < count && tries < count * 6; tries++) {
      await tick();
      const p = bankSpot(from, to);
      if (!p) continue;
      plant(p.x, terrainHeight(surface, track, p.x, p.z), p.z, p.river);
      n++;
    }
  };
  await place(300, 9, 50, (x, y, z, river) => addGiant(batch, x, y, z, rand, 1, river));
  await place(850, 6, 40, (x, y, z, river) => addBroadleaf(batch, x, y, z, rand, 0.9 + rand() * 0.5, river));
  await place(500, 6, 45, (x, y, z) => addBanana(batch, x, y, z, rand, true));
  await place(180, 5, 30, (x, y, z) => addPalm(batch, x, y - 0.5, z, rand, { height: 4 + rand() * 4, lean: rand() * 0.2, dir: rand() * Math.PI * 2 }));
  await place(160, 6, 30, (x, y, z) => addPalm(batch, x, y - 0.5, z, rand, { height: 11 + rand() * 8, lean: rand() * 0.5, dir: rand() * Math.PI * 2 }));
  await place(800, 3, 22, (x, y, z) => addBanana(batch, x, y, z, rand));
  await place(700, 3.5, 16, (x, y, z) => addBush(batch, x, y, z, rand));
  await place(400, 5, 30, (x, y, z) => addFern(batch, x, y, z, rand));
  for (const side of [-1, 1]) {
    for (let k = 0; k < track.N; k += 1) {
      await tick();
      const i = track.wrap(k);
      const out = { x: side * track.nx[i], z: side * track.nz[i] };
      for (let n = 0; n < 2; n++) {
        const lat = side * (hw - 0.5 + rand() * 4.5);
        const along = (rand() - 0.5) * track.spacing;
        const x = track.px[i] + track.nx[i] * lat + track.tx[i] * along;
        const z = track.pz[i] + track.nz[i] * lat + track.tz[i] * along;
        const { s } = surface.sample(x, z);
        if (tunnelMask(track, s) > 0 || track.river.drops.some((d) => Math.abs(track.ahead(d.s, s) - 2) < 10 || track.ahead(s, d.s) < 6)) continue;
        const ground = Math.max(terrainHeight(surface, track, x, z), track.level(s) - 0.3);
        const roll = rand();
        if (roll < 0.45) addBush(batch, x, ground - 0.4, z, rand);
        else if (roll < 0.75) addReeds(batch, x, ground - 0.3, z, rand, out);
        else addBanana(batch, x, ground - 0.2, z, rand, rand() < 0.4);
      }
    }
  }
  for (let n = 0, tries = 0; n < 300 && tries < 9000; tries++) {
    await tick();
    const x = minX + rand() * (maxX - minX);
    const z = minZ + rand() * (maxZ - minZ);
    const { dist } = surface.sample(x, z);
    if (dist < hw + 42 || dist > 260 || steep(x, z)) continue;
    addGiant(batch, x, terrainHeight(surface, track, x, z), z, rand, 1 + rand() * 0.3);
    n++;
  }
  const big = falls.find((f) => f.big);
  const li = big.lip.i;
  for (const side of [-1, 1]) {
    for (let k = 0; k < 4; k++) {
      const lat = side * (hw + 2 + k * 3);
      const along = -4 + k * 4;
      const x = track.px[li] + track.nx[li] * lat + track.tx[li] * along;
      const z = track.pz[li] + track.nz[li] * lat + track.tz[li] * along;
      const s = 3 + rand() * 3;
      batch.add('rock', ROCK, mat(x, big.lip.top + s * 0.3 - (along > 2 ? 4 : 0), z, s, s * 0.8, s, rand(), rand(), rand()));
    }
  }
  const scenery = new THREE.Group();
  const chunks = await batch.buildAsync(scenery, 0.1, JUNGLE_COLORS, undefined, tick);
  group.add(scenery);

  group.add(createArch(track, hw));

  const clouds = [];
  for (let i = 0; i < 12; i++) {
    const cloud = createCloud(rand);
    const a = rand() * Math.PI * 2;
    const d = 150 + rand() * 600;
    cloud.position.set(Math.cos(a) * d, 140 + rand() * 70, Math.sin(a) * d);
    cloud.userData.speed = 2 + rand() * 3;
    clouds.push(cloud);
    group.add(cloud);
  }

  return {
    fog,
    water,
    sun,
    surface,
    shores: [],
    update(t, dt, camera) {
      water.update(t);
      cullChunks(chunks, camera, fog.far);
      cullChunks(tunnel.userData.chunks, camera, fog.far);
      for (const f of falls) f.material.uniforms.uTime.value = t;
      sky.position.copy(camera.position);
      for (const cloud of clouds) {
        cloud.position.x += cloud.userData.speed * dt;
        if (cloud.position.x > 800) cloud.position.x = -800;
      }
      for (const f of [big, ...falls.filter((x) => x.curtain)]) {
        const spot = f.base;
        for (let i = 0; i < 3; i++) {
          if (Math.random() > dt * (f.curtain ? 18 : 30)) continue;
          const lat = (Math.random() - 0.5) * 2 * (spot.hw + 4);
          fx.mist(spot.x + spot.nx * lat, spot.y + 0.5, spot.z + spot.nz * lat);
        }
      }
    },
  };
}
