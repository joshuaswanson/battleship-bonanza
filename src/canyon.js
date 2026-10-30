import * as THREE from 'three';
import { toon, mulberry32 } from './toon.js';
import { canyonGround } from './groundShader.js';
import { groundHit } from './terrain.js';
import { frame } from './alpine.js';
import { Batcher, cullChunks, slicer, COLORS, mat, ROCK, createSky, createCloud, createArch, SUN_DIR } from './world.js';
import {
  riverSurface,
  buildRiver,
  buildFalls,
  buildCurtain,
  buildTube,
  caveDetails,
  buildShell,
  buildMouth,
  buildCap,
  caveTorches,
  buildTorches,
  highLevel,
  tunnelMask,
  isHole,
  lowLevel,
  copyLevel,
  ARCH_TOP,
  ARCH_FLOOR,
  LID,
  GHOST,
  CAVE_HALF,
  TORCH_EVERY,
} from './jungle.js';
import { MINE_COLORS, buildGoldMine } from './goldMine.js';
import { PROP_COLORS, town, waterTower, oreCart, rails, trestle, train, sign } from './canyonProps.js';

const SKY = 0xf3d9b4;

const CANYON_COLORS = {
  ...MINE_COLORS,
  sandstone: 0xc28144,
  sandstoneDark: 0x8f5a30,
  oreGlow: 0xffe9a0,
  ...COLORS,
  ...PROP_COLORS,
  caveRock: 0x9a5a3a,
  caveRockDark: 0x7a4430,
  caveRockLight: 0xb06a44,
  caveIn: 0x3a2418,
  caveInDark: 0x2a1a12,
  caveInLight: 0x4a3020,
  torchWood: 0x6e4424,
  torchIron: 0x2f3338,
  timber: 0x8a5a32,
  timberDark: 0x5e3a1e,
  rail: 0x4a4d52,
  boulder: 0xb4673f,
  boulderDark: 0x8e4c2e,
  boulderLight: 0xcf8452,
  cactus: 0x5e9a4a,
  cactusDark: 0x467a3a,
  sage: 0x9aa866,
  sageDark: 0x7a8a4e,
  deadwood: 0x9c8466,
  foam: 0xffffff,
};

const STRATA = [0xc4552f, 0xdc7c3e, 0xe9b47c, 0xb24a2c, 0xf1d4a2, 0xd06a38, 0x9c4632].map((c) => new THREE.Color(c));

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function noise(x, z) {
  return 0.5 + 0.25 * Math.sin(x * 0.021 + Math.sin(z * 0.013) * 2) + 0.15 * Math.sin(z * 0.034 + x * 0.011) + 0.1 * Math.sin((x - z) * 0.057);
}

function rim(track, x, z) {
  return track.river.top + 26 + 18 * noise(x * 0.6 + 40, z * 0.6 - 20);
}

const buttes = [];

function findButtes(track) {
  buttes.length = 0;
  for (const r of track.routes) {
    for (let i = r.first + 4; i <= r.last - 4; i += 3) {
      let near = r.from;
      let best = Infinity;
      for (let j = r.from; j !== r.to; j = track.next[j]) {
        const d = Math.hypot(track.px[j] - track.px[i], track.pz[j] - track.pz[i]);
        if (d < best) {
          best = d;
          near = j;
        }
      }
      const gap = best - track.hw[i] - track.hw[near];
      if (gap < 8) continue;
      buttes.push({ x: (track.px[i] + track.px[near]) / 2, z: (track.pz[i] + track.pz[near]) / 2, r: gap / 2 });
    }
  }
}

function butteAt(x, z) {
  let lift = 0;
  for (const b of buttes) {
    const d = Math.hypot(x - b.x, z - b.z);
    if (d < b.r + 4) lift = Math.max(lift, smooth(b.r + 2, b.r - 5, d));
  }
  return lift;
}

function canyonHeight(surface, track, x, z) {
  const { level, edge, s } = surface.sample(x, z);
  const hw = track.halfWidth;
  const dist = edge + hw;
  const lift = buttes.length ? butteAt(x, z) : 0;
  if (lift > 0) {
    const floor = level - 4 + smooth(hw - 4, hw + 6, dist) * 6.5;
    const cliff = floor + (rim(track, x, z) + 8 - floor) * lift;
    const top = Math.floor((cliff - floor) / 9) * 9 + floor + smooth(0.6, 1, ((cliff - floor) / 9) % 1) * 9;
    return Math.max(floor, top);
  }
  const land = track.landAmount(s);
  const floor = level - 4 * (1 - land) - 0.8 * land + smooth(hw - 4, hw + 6, dist) * 6.5;
  const top = Math.max(floor + 14, rim(track, x, z));
  const across = smooth(hw + 5, hw + 95 + 30 * noise(x * 1.3, z * 1.3), dist);
  const steps = 5;
  const q = across * steps;
  const terrace = (Math.floor(q) + smooth(0.72, 1, q - Math.floor(q))) / steps;
  const butte = smooth(0.62, 0.82, noise(x * 2.4 + 90, z * 2.4 - 30)) * 26 * smooth(hw + 60, hw + 110, dist);
  const normal = floor + (top - floor) * terrace + butte;
  const mask = tunnelMask(track, s);
  if (mask <= 0) return normal;
  const ridge = highLevel(track, s) + LID + 6 + 10 * noise(x * 2.3, z * 2.3) * smooth(hw + 10, hw + 40, dist);
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
  for (let r = 0; r < rows; r++) {
    await tick();
    for (let c = 0; c < cols; c++) {
      const x = minX + c * step;
      const z = minZ + r * step;
      heights[r * cols + c] = canyonHeight(surface, track, x, z);
      levels[r * cols + c] = surface.sample(x, z).level;
      holes[r * cols + c] = isHole(surface, track, x, z) ? 1 : 0;
    }
  }
  const positions = [];
  const colors = [];
  const kinds = [];
  const sand = new THREE.Color(0xd9b98a);
  const wetSand = new THREE.Color(0xa88a62);
  const dust = new THREE.Color(0xd8a46a);
  const sage = new THREE.Color(0x9aa266);
  const tint = new THREE.Color();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c3 = new THREE.Vector3();
  const n = new THREE.Vector3();
  const tri = (i0, i1, i2, cIdx) => {
    if (holes[i0] || holes[i1] || holes[i2]) return;
    for (const [v, idx] of [[a, i0], [b, i1], [c3, i2]]) {
      v.set(minX + (idx % cols) * step, heights[idx], minZ + Math.floor(idx / cols) * step);
    }
    n.subVectors(b, a).cross(c3.clone().sub(a)).normalize();
    const lvl = levels[cIdx];
    const steep = 1 - Math.abs(n.y);
    for (const v of [a, b, c3]) {
      const band = Math.floor((v.y + 3 * noise(v.x * 2, v.z * 2)) / 5.5);
      const layer = STRATA[((band % STRATA.length) + STRATA.length) % STRATA.length];
      if (v.y < lvl + 1.6) tint.copy(wetSand).lerp(sand, smooth(lvl - 0.5, lvl + 1.6, v.y));
      else if (steep > 0.35) tint.copy(layer).multiplyScalar(0.86 + 0.18 * noise(v.x * 7, v.z * 7) - (steep > 0.7 ? 0.08 : 0));
      else {
        tint.copy(layer).lerp(dust, 0.55);
        if (noise(v.x * 4 + 13, v.z * 4) > 0.62) tint.lerp(sage, 0.55);
      }
      positions.push(v.x, v.y, v.z);
      colors.push(tint.r, tint.g, tint.b);
      kinds.push(v.y < lvl + 1.6 ? 0 : 1);
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
  geometry.setAttribute('aKind', new THREE.Float32BufferAttribute(kinds, 1));
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, canyonGround(toon(0xffffff, { vertexColors: true })));
}

const CYL = new THREE.CylinderGeometry(1, 1, 1, 10);
const CAP = new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
const BOX = new THREE.BoxGeometry(1, 1, 1);
const BUSH = new THREE.IcosahedronGeometry(1, 0);

function saguaro(batch, x, y, z, rand) {
  const h = 5 + rand() * 6;
  const r = 0.45 + rand() * 0.25;
  const put = frame(batch, x, y, z, rand() * 6, (rand() - 0.5) * 0.08, (rand() - 0.5) * 0.08, 1);
  put('cactus', CYL, 0, h / 2, 0, r, h, r);
  put('cactus', CAP, 0, h, 0, r, r * 0.9, r);
  const arms = 1 + Math.floor(rand() * 3);
  for (let k = 0; k < arms; k++) {
    const side = k % 2 ? -1 : 1;
    const at = h * (0.35 + rand() * 0.3);
    const out = 1.2 + rand() * 0.6;
    const up = 1.5 + rand() * 2.2;
    const ar = r * 0.72;
    put('cactusDark', CYL, side * out / 2, at, 0, ar, out, ar, 0, 0, Math.PI / 2);
    put('cactus', CYL, side * out, at + up / 2, 0, ar, up, ar);
    put('cactus', CAP, side * out, at + up, 0, ar, ar * 0.9, ar);
  }
}

function sagebrush(batch, x, y, z, rand) {
  const s = 0.6 + rand() * 0.9;
  for (let k = 0; k < 3; k++) {
    batch.add(k % 2 ? 'sage' : 'sageDark', BUSH, mat(x + (rand() - 0.5) * s * 1.6, y + s * 0.45, z + (rand() - 0.5) * s * 1.6, s * (0.8 + rand() * 0.4), s * 0.7, s * (0.8 + rand() * 0.4), rand(), rand() * 6, rand()));
  }
}

function boulder(batch, x, y, z, size, rand) {
  const key = ['boulder', 'boulderDark', 'boulderLight'][Math.floor(rand() * 3)];
  batch.add(key, ROCK, mat(x, y, z, size * (0.9 + rand() * 0.3), size * (0.6 + rand() * 0.4), size * (0.9 + rand() * 0.3), rand() * 6, rand() * 6, rand() * 6));
}

function mineFrames(batch, track, from, to, levelAt) {
  for (let k = from + 3; k < to - 2; k += 4) {
    const i = track.wrap(k);
    const y = levelAt(k * track.spacing);
    const put = frame(batch, track.px[i], y, track.pz[i], track.heading(i), 0, 0, 1);
    const half = CAVE_HALF - 4;
    const top = ARCH_TOP - 3.2;
    for (const side of [-1, 1]) put('timber', BOX, side * half, (ARCH_FLOOR + top) / 2 + 1, 0, 1.4, top - ARCH_FLOOR, 1.4);
    put('timberDark', BOX, 0, top, 0, half * 2 + 2.6, 1.3, 1.6);
    for (const side of [-1, 1]) put('timberDark', BOX, side * (half - 2.2), top - 1.6, 0, 3.6, 0.7, 0.9, 0, 0, side * 0.75);
  }
  for (const side of [-1, 1]) {
    for (let k = from; k < to; k += 2) {
      const i = track.wrap(k);
      const j = track.wrap(k + 2);
      const lat = side * (CAVE_HALF - 6);
      const a = track.point(i, lat);
      const b = track.point(j, lat);
      const ya = levelAt(k * track.spacing) + 0.9;
      const yb = levelAt((k + 2) * track.spacing) + 0.9;
      const len = Math.hypot(b.x - a.x, b.z - a.z, yb - ya);
      batch.add('rail', BOX, new THREE.Matrix4().lookAt(new THREE.Vector3(a.x, ya, a.z), new THREE.Vector3(b.x, yb, b.z), new THREE.Vector3(0, 1, 0)).setPosition((a.x + b.x) / 2, (ya + yb) / 2, (a.z + b.z) / 2).multiply(new THREE.Matrix4().makeScale(0.25, 0.25, len)));
    }
  }
}

function minePortal(batch, track, k, levelAt, top) {
  const i = track.wrap(k);
  const y = levelAt(k * track.spacing);
  const put = frame(batch, track.px[i], y, track.pz[i], track.heading(i), 0, 0, 1);
  const half = CAVE_HALF + 1;
  for (const side of [-1, 1]) put('timber', BOX, side * half, (ARCH_FLOOR + ARCH_TOP) / 2, 0, 2.6, ARCH_TOP - ARCH_FLOOR + 2, 2.6);
  put('timberDark', BOX, 0, ARCH_TOP + 0.6, 0, half * 2 + 6, 2.4, 3);
  put('timber', BOX, 0, ARCH_TOP + 3.4, 0, 16, 3.2, 0.6);
  for (const side of [-1, 1]) put('timberDark', BOX, side * (half - 3), ARCH_TOP - 2.2, 0, 7, 1.2, 1.6, 0, 0, side * 0.7);
  return top;
}

function sandstoneTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const rand = mulberry32(77);
  const bands = ['#c4552f', '#dc7c3e', '#e9b47c', '#b24a2c', '#d06a38', '#9c4632'];
  for (let y = 0, k = 0; y < 256; k++) {
    const h = 14 + rand() * 26;
    g.fillStyle = bands[k % bands.length];
    g.fillRect(0, y, 256, h + 1);
    y += h;
  }
  for (let k = 0; k < 90; k++) {
    g.fillStyle = `rgba(60,24,12,${0.12 + rand() * 0.18})`;
    g.fillRect(rand() * 256, rand() * 256, 4 + rand() * 30, 1 + rand() * 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function buildMine(track, ground) {
  const { river, spacing } = track;
  const kIn = Math.round(river.tunnelIn / spacing);
  const kOut = Math.round(river.tunnelOut / spacing);
  const kSeam = Math.round(river.seam / spacing);
  const low = lowLevel(track);
  const high = copyLevel(track);
  const group = new THREE.Group();
  const palette = { tones: [0x8a4e32, 0xa45e3c, 0x96553a], crack: 0x4a2a1c, wet: 0x4a3426, moss: 0x9a6a3a };
  const lowLamps = caveTorches(track, kIn, kOut, low);
  const highFrom = kSeam - GHOST;
  const highOnly = caveTorches(track, kIn, kOut, high).filter((_, n) => kIn + 6 + n * TORCH_EVERY >= highFrom);
  group.add(buildTube(track, kIn, kOut, low, [kIn, kOut], lowLamps, palette));
  group.add(buildTube(track, highFrom, kOut, high, [kIn, kOut], highOnly, palette));
  const batch = new Batcher();
  caveDetails(batch, track, kIn, kOut, low);
  caveDetails(batch, track, highFrom, kOut, high);
  mineFrames(batch, track, kIn, kOut, low);
  mineFrames(batch, track, highFrom, kOut, high);
  minePortal(batch, track, kIn, low);
  minePortal(batch, track, kOut, high);
  const flames = buildTorches(batch, [...lowLamps, ...highOnly]);
  group.add(flames);
  group.userData.torches = flames;
  const details = new THREE.Group();
  group.userData.chunks = batch.build(details, 0.08, CANYON_COLORS);
  group.add(details);
  group.add(buildShell(track, kIn, kOut));
  group.add(buildMouth(track, kIn, low, highLevel(track, river.tunnelIn) + LID, 0xffffff, sandstoneTexture()));
  group.add(buildMouth(track, kOut, high, highLevel(track, river.tunnelOut) + LID, 0xffffff, sandstoneTexture()));
  group.add(buildCap(track, kOut, low, 0xfbe8cf, 3));
  group.add(buildCap(track, kSeam - GHOST, high, 0x150d08));
  return group;
}

export async function createCanyon(group, track, fx) {
  const tick = slicer();
  const fog = new THREE.Fog(SKY, 240, 900);
  const sky = createSky({ top: 0x4aa3e0, horizon: SKY });
  group.add(sky);
  group.add(new THREE.HemisphereLight(0xfff1dc, 0xc0704a, 1.35));
  const sun = new THREE.DirectionalLight(0xffe2b8, 2.6);
  sun.position.copy(SUN_DIR).multiplyScalar(100);
  group.add(sun);

  const surface = await riverSurface(track, tick);
  findButtes(track);
  const height = (x, z) => canyonHeight(surface, track, x, z);
  group.add(await buildTerrain(surface, track, tick));
  await tick();
  const rapidsAt = (s) => {
    if (track.inTunnel(s)) return 0;
    let foam = 0.18 * smooth(0.45, 0.8, 0.5 + 0.5 * Math.sin(s * 0.021) * Math.sin(s * 0.0071 + 1.3));
    foam = Math.max(foam, 0.8 * smooth(0.55, 0.85, 0.5 + 0.5 * Math.sin(s * 0.017 + 2) * Math.sin(s * 0.0053)));
    for (const d of track.river.drops) {
      const before = track.ahead(s, d.s);
      const after = track.ahead(d.s, s);
      if (before < 26) foam = Math.max(foam, 0.75 * (1 - before / 26));
      if (after < 45) foam = Math.max(foam, 0.85 * (1 - after / 45));
    }
    return foam;
  };
  const water = buildRiver(track, {
    deep: 0x23807a,
    shallow: 0x62c9ad,
    flowSpeed: 1.05,
    rapids: 0.6,
    foamAt: (s, lat) => Math.min(1, rapidsAt(s) + 0.22 * smooth(0.75, 1, Math.abs(lat))),
  });
  group.add(water.mesh);
  const falls = track.river.drops.map((drop) => buildFalls(track, drop));
  for (const f of falls) group.add(f.mesh);
  await tick();
  const mine = buildMine(track, height);
  group.add(mine);
  const kExit = Math.round(track.river.tunnelOut / track.spacing);
  for (const curtain of [buildCurtain(track, kExit, lowLevel(track)), buildCurtain(track, kExit, copyLevel(track))]) {
    group.add(curtain.mesh);
    falls.push({ material: curtain.material, base: curtain.base, curtain: true });
  }

  const rand = mulberry32(1849);
  const batch = new Batcher();
  const trim = new Batcher();
  const hw = track.halfWidth;
  const shores = [];
  const nearDrop = (s, before, after) => track.river.drops.some((d) => track.ahead(s, d.s) < before || track.ahead(d.s, s) < after);
  const startClear = (s) => track.ahead(s, 0) < 60 || track.ahead(0, s) < 50;

  for (let n = 0, tries = 0; n < 12 && tries < 900; tries++) {
    const idx = Math.floor(rand() * track.N);
    const s = idx * track.spacing;
    if (tunnelMask(track, s) > 0 || track.formAt(s) || nearDrop(s, 70, 70) || startClear(s) || rapidsAt(s) > 0.15) continue;
    const size = 2.2 + rand() * 2.4;
    const room = hw - 2.5 - size - 8;
    if (room < 5) continue;
    const lateral = (rand() < 0.5 ? -1 : 1) * (4 + rand() * (room - 4));
    const p = track.point(idx, lateral);
    if (shores.some((o) => Math.hypot(o.x - p.x, o.z - p.z) < o.rx + size + 9)) continue;
    boulder(batch, p.x, track.level(s) - size * 0.25, p.z, size, rand);
    for (let k = 0; k < 2; k++) {
      const a = rand() * Math.PI * 2;
      const r = size * (0.9 + rand() * 0.5);
      boulder(batch, p.x + Math.cos(a) * r, track.level(s) - 0.6, p.z + Math.sin(a) * r, size * (0.35 + rand() * 0.25), rand);
    }
    batch.add('foam', CYL, mat(p.x, track.level(s) + 0.12, p.z, size * 1.35, 0.05, size * 1.35));
    shores.push({ x: p.x, z: p.z, rx: size * 0.9, rz: size * 0.9, rot: 0, top: track.level(s) + size * 0.55, launch: true });
    n++;
  }

  for (let n = 0, tries = 0; n < 900 && tries < 9000; tries++) {
    await tick();
    const idx = Math.floor(rand() * track.N);
    const side = rand() < 0.5 ? -1 : 1;
    const p = track.point(idx, side * (hw + 4 + rand() * 6));
    const s = surface.sample(p.x, p.z).s;
    if (tunnelMask(track, s) > 0 || nearDrop(s, 12, 8)) continue;
    const y = height(p.x, p.z);
    const level = track.level(s);
    if (y > level + 4) continue;
    boulder(batch, p.x, Math.max(y, level - 0.4), p.z, 0.8 + rand() * 2.2, rand);
    n++;
  }

  const { minX, maxX, minZ, maxZ } = surface.bounds;
  const flat = (x, z) => {
    const y = height(x, z);
    return Math.max(Math.abs(height(x + 3, z) - y), Math.abs(height(x, z + 3) - y)) < 1.2;
  };
  for (let n = 0, tries = 0; n < 520 && tries < 14000; tries++) {
    await tick();
    const x = minX + rand() * (maxX - minX);
    const z = minZ + rand() * (maxZ - minZ);
    const { dist, s } = surface.sample(x, z);
    if (dist < hw + 8 || dist > 330 || tunnelMask(track, s) > 0.2 || !flat(x, z)) continue;
    const y = height(x, z);
    if (rand() < 0.45) saguaro(batch, x, y - 0.2, z, rand);
    else sagebrush(batch, x, y - 0.2, z, rand);
    n++;
  }

  const straightest = (from, to) => {
    let best = from;
    let bestTurn = Infinity;
    for (let f = from; f <= to; f += 0.004) {
      const i = Math.round(f * track.N);
      const a = track.heading(i - 12);
      const b = track.heading(i + 12);
      const turn = Math.abs(Math.atan2(Math.sin(b - a), Math.cos(b - a)));
      if (turn < bestTurn) {
        bestTurn = turn;
        best = i;
      }
    }
    return track.wrap(best);
  };
  const facing = (i, side) => Math.atan2(-side * track.nx[i], -side * track.nz[i]);
  const signs = [];

  const bridgeAt = straightest(0.09, 0.16);
  const ends = [-1, 1].map((side) => track.point(bridgeAt, side * (hw + 165)));
  const deck = Math.max(...ends.map((p) => height(p.x, p.z)), rim(track, track.px[bridgeAt], track.pz[bridgeAt])) + 3;
  trestle(batch, ends[0], ends[1], deck, height, (x, z) => surface.sample(x, z).dist < hw + 9);
  const runTrain = train(group, ends[0], ends[1], deck + 0.2, fx);

  const townAt = track.wrap(Math.round(0.035 * track.N));
  const townSide = -1;
  const townSpot = track.point(townAt, townSide * (hw + 13));
  const townY = height(townSpot.x, townSpot.z);
  signs.push(...town(batch, townSpot.x, townY, townSpot.z, facing(townAt, townSide)));
  const towerAt = track.wrap(townAt + Math.round(26 / track.spacing));
  const tower = track.point(towerAt, townSide * (hw + 16));
  waterTower(batch, tower.x, height(tower.x, tower.z), tower.z);

  const portal = Math.round(track.river.tunnelIn / track.spacing);
  const portalI = track.wrap(portal);
  const portalY = lowLevel(track)(portal * track.spacing);
  signs.push({ text: 'GOLD MINE', x: track.px[portalI], y: portalY, z: track.pz[portalI], yaw: track.heading(portalI), lx: 0, ly: ARCH_TOP + 3.4, lz: -0.35, w: 15, h: 3, back: true });
  for (const side of [-1, 1]) {
    const cartAt = track.wrap(portal - Math.round(16 / track.spacing));
    const c = track.point(cartAt, side * (hw + 5.5));
    const cy = Math.max(height(c.x, c.z), portalY + 0.4);
    oreCart(batch, c.x, cy, c.z, track.heading(cartAt));
    const r0 = track.point(track.wrap(portal - Math.round(30 / track.spacing)), side * (hw + 5.5));
    const r1 = track.point(track.wrap(portal - Math.round(3 / track.spacing)), side * (hw + 5.5));
    rails(batch, r0, r1, Math.max(height(r0.x, r0.z), portalY + 0.4), portalY + 0.4);
  }

  for (const sg of signs) {
    const mesh = sign(sg.text, sg.w, sg.h);
    const base = new THREE.Matrix4().compose(new THREE.Vector3(sg.x, sg.y, sg.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), sg.yaw), new THREE.Vector3(1, 1, 1));
    mesh.applyMatrix4(new THREE.Matrix4().makeTranslation(sg.lx, sg.ly, sg.lz).premultiply(base));
    if (sg.back) mesh.rotateY(Math.PI);
    group.add(mesh);
  }

  const gold = buildGoldMine(batch, trim, group, track, rand);
  const { launch, span } = track.river.land;
  const mineIn = Math.round((launch + 330) / track.spacing);
  const mineOut = Math.round((launch + span - 90) / track.spacing);
  const railLevel = (at) => track.level(at);
  group.add(buildMouth(track, mineIn, railLevel, track.level(launch + 330) + LID + 24, 0xffffff, sandstoneTexture()));
  group.add(buildMouth(track, mineOut, railLevel, track.level(launch + span - 90) + LID + 24, 0xffffff, sandstoneTexture()));
  minePortal(batch, track, mineIn, railLevel);
  minePortal(batch, track, mineOut, railLevel);
  const scenery = new THREE.Group();
  const chunks = await batch.buildAsync(scenery, 0.1, CANYON_COLORS, undefined, tick);
  chunks.push(...(await trim.buildAsync(scenery, 0, CANYON_COLORS, undefined, tick)));
  group.add(scenery);
  group.add(createArch(track, hw));

  const clouds = [];
  for (let i = 0; i < 10; i++) {
    const cloud = createCloud(rand);
    const a = rand() * Math.PI * 2;
    const d = 150 + rand() * 600;
    cloud.position.set(Math.cos(a) * d, track.river.top + 120 + rand() * 70, Math.sin(a) * d);
    cloud.userData.speed = 2 + rand() * 3;
    clouds.push(cloud);
    group.add(cloud);
  }

  const big = falls.filter((f) => f.big);
  const daylight = { color: fog.color.clone(), near: fog.near, far: fog.far };
  return {
    fog,
    water,
    sun,
    surface,
    shores,
    solid(p) {
      const { s, dist, idx, level } = surface.sample(p.x, p.z);
      const pastExit = track.ahead(track.river.tunnelOut, s);
      if ((track.inTunnel(s) || track.inMine(s) || pastExit < 12) && dist < track.halfWidth + 6) return null;
      if (pastExit < 120 && p.y < level - 12) return null;
      if (track.inTunnel(s) || track.inMine(s)) {
        const i = track.norm(idx);
        const side = (p.x - track.px[i]) * track.nx[i] + (p.z - track.pz[i]) * track.nz[i] > 0 ? 1 : -1;
        return p.y >= level + ARCH_TOP - 4 ? new THREE.Vector3(0, -1, 0) : new THREE.Vector3(-track.nx[i] * side, 0, -track.nz[i] * side);
      }
      return groundHit(height, p);
    },
    update(t, dt, camera) {
      water.update(t);
      runTrain(t, dt);
      gold.update(camera, surface, fog, daylight, sky);
      cullChunks(chunks, camera, fog.far);
      cullChunks(mine.userData.chunks, camera, fog.far);
      mine.userData.torches.userData.update(t);
      for (const f of falls) f.material.uniforms.uTime.value = t;
      sky.position.copy(camera.position);
      for (const cloud of clouds) {
        cloud.position.x += cloud.userData.speed * dt;
        if (cloud.position.x > 800) cloud.position.x = -800;
      }
      for (const f of [...big, ...falls.filter((x) => x.curtain)]) {
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

