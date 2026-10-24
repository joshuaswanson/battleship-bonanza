import * as THREE from 'three';
import { createWater } from './water.js';
import { toon, mulberry32 } from './toon.js';
import { Batcher, cullChunks, slicer, COLORS, mat, ROCK, createSky, createCloud, createArch, SUN_DIR } from './world.js';
import { courseSurface, buildHeightfield, courseBuoys, swissFlag, smooth, noise } from './terrain.js';
import { FLORA_COLORS, tree, shrub, boulder, flowers, cow } from './alpine.js';

const ALPS_COLORS = {
  ...COLORS,
  ...FLORA_COLORS,
  plaster: 0xf6f0e2,
  wood: 0xa8683a,
  woodDark: 0x6e4224,
  roof: 0x7a3f2a,
  roofRed: 0xc9503a,
  flower: 0xff4f6d,
  flowerLeaf: 0x3f9a45,
  window: 0x2b3440,
  shutter: 0x3f8f5a,
  stone: 0xdcd5c7,
  stoneDark: 0xa9a196,
  copper: 0x62b3a0,
  clock: 0xffffff,
  horn: 0xf3e6c4,
  bell: 0xffd23f,
  flagPole: 0xeeeeee,
  flagRed: 0xe5332a,
  flagWhite: 0xffffff,
  islet: 0x9a958c,
};

const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 12);
const OCT = new THREE.CylinderGeometry(1, 1, 1, 8);
const SPIRE = new THREE.ConeGeometry(1, 1, 4).rotateY(Math.PI / 4);
const TURRET = new THREE.ConeGeometry(1, 1, 12);
const BALL = new THREE.SphereGeometry(1, 10, 8);
const roofShape = new THREE.Shape([new THREE.Vector2(-1, 0), new THREE.Vector2(1, 0), new THREE.Vector2(0, 1)]);
const ROOF = new THREE.ExtrudeGeometry(roofShape, { depth: 1, bevelEnabled: false }).translate(0, 0, -0.5);

function lakeness(f) {
  if (f >= 0.31 && f <= 0.88) return 0;
  if (f > 0.26 && f < 0.31) return 1 - smooth(0.26, 0.31, f);
  if (f > 0.88 && f < 0.94) return smooth(0.88, 0.94, f);
  return 1;
}

function placer(batch) {
  return (key, geometry, origin, yaw, lx, y, lz, sx, sy, sz, rx = 0, rz = 0, extraYaw = 0) => {
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    batch.add(key, geometry, mat(origin.x + lx * c + lz * s, origin.y + y, origin.z - lx * s + lz * c, sx, sy, sz, rx, yaw + extraYaw, rz));
  };
}

function chalet(batch, x, y, z, yaw, rand) {
  const put = placer(batch);
  const o = new THREE.Vector3(x, y, z);
  const w = 7 + rand() * 3;
  const d = 6 + rand() * 2.5;
  put('stoneDark', BOX, o, yaw, 0, -1.2, 0, w + 0.4, 3, d + 0.4);
  put('plaster', BOX, o, yaw, 0, 1.8, 0, w, 3.6, d);
  put('wood', BOX, o, yaw, 0, 5.2, 0, w, 3.2, d);
  put(rand() < 0.6 ? 'roof' : 'roofRed', ROOF, o, yaw, 0, 6.8, 0, w / 2 + 1.1, 3.4, d + 1.6);
  put('woodDark', BOX, o, yaw, 0, 3.9, d / 2 + 0.7, w + 0.6, 0.3, 1.4);
  put('woodDark', BOX, o, yaw, 0, 4.6, d / 2 + 1.35, w + 0.6, 1, 0.15);
  put('flower', BOX, o, yaw, 0, 5.3, d / 2 + 1.4, w * 0.9, 0.5, 0.5);
  put('flowerLeaf', BOX, o, yaw, 0, 5.05, d / 2 + 1.42, w * 0.92, 0.25, 0.55);
  for (const lx of [-w / 4, w / 4]) {
    for (const fy of [1.9, 5.4]) {
      put('window', BOX, o, yaw, lx, fy, d / 2 + 0.05, 1.3, 1.3, 0.2);
      put('shutter', BOX, o, yaw, lx - 1.05, fy, d / 2 + 0.08, 0.5, 1.4, 0.15);
      put('shutter', BOX, o, yaw, lx + 1.05, fy, d / 2 + 0.08, 0.5, 1.4, 0.15);
    }
  }
}

function church(batch, x, y, z, yaw) {
  const put = placer(batch);
  const o = new THREE.Vector3(x, y, z);
  put('stoneDark', BOX, o, yaw, 0, -1.5, -4, 10, 3, 22);
  put('plaster', BOX, o, yaw, 0, 4.5, -6, 9, 9, 16);
  put('roofRed', ROOF, o, yaw, 0, 9, -6, 5.6, 4.5, 17);
  put('plaster', BOX, o, yaw, 0, 11, 4, 5.2, 22, 5.2);
  put('stoneDark', BOX, o, yaw, 0, 22.4, 4, 5.8, 0.8, 5.8);
  put('copper', SPIRE, o, yaw, 0, 28, 4, 4, 11, 4);
  put('bell', BALL, o, yaw, 0, 34, 4, 0.5, 0.5, 0.5);
  put('clock', CYL, o, yaw, 0, 18.5, 6.65, 1.5, 0.15, 1.5, Math.PI / 2);
  put('window', BOX, o, yaw, 0, 18.5, 6.75, 0.15, 1.2, 0.12, 0, 0.5);
  for (const lz of [-11, -6, -1]) for (const side of [-1, 1]) put('window', BOX, o, yaw, side * 4.55, 5, lz, 0.2, 3.2, 1.4);
}

function castle(batch, x, z, yaw, rand) {
  const put = placer(batch);
  const o = new THREE.Vector3(x, 0, z);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const r = 15 + rand() * 5;
    const s = 4 + rand() * 4;
    batch.add('islet', ROCK, mat(x + Math.cos(a) * r, 0.4, z + Math.sin(a) * r, s, s * 0.6, s, rand(), rand() * 6, rand()));
  }
  put('stoneDark', OCT, o, yaw, 0, 0.5, 0, 17, 3, 17);
  for (const [lx, lz, w, d] of [[0, -9, 22, 3], [0, 9, 22, 3], [-10, 0, 3, 18], [10, 0, 3, 18]]) {
    put('stone', BOX, o, yaw, lx, 6, lz, w, 9, d);
    for (let k = -w / 2 + 1; k < w / 2; k += 2.5) put('stone', BOX, o, yaw, lx + (w > d ? k : 0), 11, lz + (w > d ? 0 : k), 1.2, 1.3, 1.2);
  }
  put('plaster', BOX, o, yaw, -2, 11, -1, 9, 22, 9);
  put('roofRed', SPIRE, o, yaw, -2, 26, -1, 7.4, 8, 7.4);
  for (const [lx, lz] of [[-11, -10], [11, -10], [-11, 10], [11, 10]]) {
    put('stone', CYL, o, yaw, lx, 8, lz, 3.2, 14, 3.2);
    put('roofRed', TURRET, o, yaw, lx, 18.5, lz, 4, 7, 4);
  }
  for (const lx of [-4, 0]) put('window', BOX, o, yaw, lx, 15, 3.6, 1, 2, 0.2);
  swissFlag(batch, x, 26, z, yaw, 1.2);
}

function coveredBridge(batch, track, idx) {
  const put = placer(batch);
  const i = track.wrap(idx);
  const p = track.point(i);
  const o = new THREE.Vector3(p.x, 0, p.z);
  const yaw = track.heading(i) + Math.PI / 2;
  const span = track.hw[i] + 10;
  put('wood', BOX, o, yaw, 0, 11, 0, 5, 0.8, span * 2);
  put('roof', ROOF, o, yaw, 0, 15, 0, 3.6, 2.6, span * 2 + 1);
  for (let lz = -span; lz <= span; lz += 4) {
    for (const lx of [-2.3, 2.3]) put('woodDark', BOX, o, yaw, lx, 13, lz, 0.35, 3.6, 0.35);
    put(Math.round(lz / 4) % 2 ? 'flower' : 'flowerLeaf', BOX, o, yaw, 2.6, 11.9, lz + 2, 0.4, 0.4, 2.2);
  }
  for (const side of [-1, 1]) put('stoneDark', BOX, o, yaw, 0, 5, side * (track.hw[i] + 4), 5.5, 12, 4);
  const towerAt = side(track, i, 1, track.hw[i] + 6);
  batch.add('stone', OCT, mat(towerAt.x, 9, towerAt.z, 4.5, 24, 4.5));
  batch.add('roof', TURRET, mat(towerAt.x, 24.5, towerAt.z, 5.6, 7, 5.6));
  for (let k = 0; k < 4; k++) batch.add('window', BOX, mat(towerAt.x + Math.cos(k * 1.57) * 4.45, 15, towerAt.z + Math.sin(k * 1.57) * 4.45, 0.8, 1.6, 0.8));
}

function side(track, i, sign, lateral) {
  return track.point(i, sign * lateral);
}

function buildSteamer() {
  const group = new THREE.Group();
  const add = (geometry, color, x, y, z, sx, sy, sz, rx = 0) => {
    const mesh = new THREE.Mesh(geometry, toon(color));
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    mesh.rotation.x = rx;
    group.add(mesh);
    return mesh;
  };
  add(BOX, 0xffffff, 0, 1, 0, 5, 2.4, 18);
  add(SPIRE, 0xffffff, 0, 1, 9.6, 2.5, 2.4, 3, Math.PI / 2);
  add(BOX, 0x22313f, 0, 0, 0, 5.1, 0.6, 18.1);
  add(BOX, 0xf4e6c8, 0, 3.1, -1, 4, 2, 11);
  add(BOX, 0xc89a62, 0, 4.2, -1, 4.4, 0.25, 12);
  for (const side of [-1, 1]) add(CYL, 0xe5332a, side * 3, 1.8, 1, 2.2, 0.8, 2.2, 0).rotation.z = Math.PI / 2;
  add(CYL, 0xffd23f, 0, 6.2, 1.5, 0.75, 4, 0.75);
  add(CYL, 0x22313f, 0, 8.3, 1.5, 0.8, 0.4, 0.8);
  add(BOX, 0xe5332a, 0, 4.6, -8.5, 0.12, 1.6, 1.6);
  add(BOX, 0xffffff, 0, 4.6, -8.5, 0.18, 0.4, 1.0);
  add(BOX, 0xffffff, 0, 4.6, -8.5, 0.18, 1.0, 0.4);
  return group;
}

function buildJet() {
  const group = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 1.4, 1, 10, 1, true), material);
  column.scale.set(1, 70, 1);
  column.position.y = 35;
  group.add(column);
  const plume = new THREE.Mesh(BALL, material);
  plume.scale.set(3, 5, 3);
  plume.position.y = 70;
  group.add(plume);
  return group;
}

export async function createAlps(group, track, fx) {
  const tick = slicer();
  const fog = new THREE.Fog(0xdcefff, 420, 1000);
  const sky = createSky();
  group.add(sky);
  group.add(new THREE.HemisphereLight(0xeaf6ff, 0x5aa36a, 1.4));
  const sun = new THREE.DirectionalLight(0xfff4e0, 2.4);
  sun.position.copy(SUN_DIR).multiplyScalar(100);
  group.add(sun);

  const N = track.N;
  const lakeAt = (idx) => lakeness(idx / N);
  const surface = await courseSurface(track, tick, { amp: (i) => 0.35 + 0.35 * lakeAt(i) });
  const shoreOf = (x, z) => {
    const s = surface.sample(x, z);
    return s.edge - lakeAt(s.idx) * (32 + 40 * noise(x * 1.3 + 50, z * 1.3));
  };
  const height = (x, z) => {
    const shore = shoreOf(x, z);
    let y = -5 + 8.5 * smooth(-2, 7, shore);
    y += smooth(5, 70, shore) * (4 + 14 * noise(x * 1.7, z * 1.7));
    const ridge = 1 - Math.abs(Math.sin(x * 0.011 + Math.sin(z * 0.007) * 2) * Math.cos(z * 0.013 - x * 0.004));
    y += smooth(60, 300, shore) * (80 + 140 * ridge * noise(x * 0.7 + 200, z * 0.7 - 100));
    const mx = x - 110;
    const mz = z - 500;
    const pyramid = Math.max(Math.abs(mx * 0.71 + mz * 0.71), Math.abs(mx * 0.71 - mz * 0.71));
    y += Math.max(0, 280 - pyramid * 1.7) * smooth(40, 140, shore);
    return y;
  };
  const tint = new THREE.Color();
  const paint = (x, y, z, ny, color) => {
    const snowLine = 105 + 30 * noise(x * 2, z * 2);
    if (y < 0.8) color.set(0xcfc6ad);
    else if (y > snowLine && ny > 0.4) color.set(0xf6f9ff);
    else if (ny < 0.66) color.set(y > snowLine - 30 ? 0x8f8c8a : 0xa49e95);
    else if (y > 70) color.set(0xa3b06e);
    else color.set(noise(x * 3, z * 3) > 0.55 ? 0x7bd35a : 0x93df63);
    color.multiply(tint.setScalar(0.93 + 0.1 * noise(x * 5 + 7, z * 5)));
  };
  group.add(await buildHeightfield({ bounds: surface.bounds, step: 5, height, paint, tick }));

  const water = createWater({ deep: 0x1677b8, shallow: 0x4fd0e6 });
  group.add(water.mesh);

  const rand = mulberry32(4207);
  const batch = new Batcher();
  const petals = new Batcher();
  const slope = (x, z) => {
    const e = 2;
    const gx = (height(x + e, z) - height(x - e, z)) / (2 * e);
    const gz = (height(x, z + e) - height(x, z - e)) / (2 * e);
    return 1 / Math.hypot(gx, gz, 1);
  };
  const { minX, maxX, minZ, maxZ } = surface.bounds;
  const taken = [];
  const free = (x, z, r) => !taken.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + r);

  const shoreline = (idx, sign) => {
    const i = track.wrap(idx);
    for (let lat = track.hw[i]; lat < track.hw[i] + 140; lat += 2) {
      const p = track.point(i, sign * lat);
      if (height(p.x, p.z) > 1.2) return { lat, p };
    }
    return null;
  };

  const villageSide = 1;
  for (let f = 0.02; f < 0.22; f += 0.012) {
    const idx = Math.round(f * N);
    const edge = shoreline(idx, villageSide);
    if (!edge) continue;
    for (let row = 0; row < 3; row++) {
      const lat = edge.lat + 8 + row * 13 + rand() * 4;
      const p = track.point(idx + Math.round((rand() - 0.5) * 6), villageSide * lat);
      const y = height(p.x, p.z);
      if (y < 1.5 || y > 30 || slope(p.x, p.z) < 0.8 || !free(p.x, p.z, 8)) continue;
      const c = track.point(idx);
      const yaw = Math.atan2(c.x - p.x, c.z - p.z);
      if (row === 1 && Math.abs(f - 0.1) < 0.008) church(batch, p.x, y, p.z, yaw);
      else chalet(batch, p.x, y, p.z, yaw + (rand() - 0.5) * 0.3, rand);
      taken.push({ x: p.x, z: p.z, r: 9 });
    }
  }
  {
    const idx = Math.round(0.035 * N);
    const edge = shoreline(idx, villageSide);
    if (edge) {
      const i = track.wrap(idx);
      const yaw = track.heading(i) + Math.PI / 2;
      const put = placer(batch);
      const pierLen = edge.lat - track.hw[i] + 4;
      const start = track.point(i, villageSide * (track.hw[i] + 5 + pierLen / 2));
      put('wood', BOX, new THREE.Vector3(start.x, 0, start.z), yaw, 0, 1.2, 0, 4, 0.5, pierLen);
      for (let k = -pierLen / 2; k <= pierLen / 2; k += 4) for (const lx of [-1.8, 1.8]) put('woodDark', BOX, new THREE.Vector3(start.x, 0, start.z), yaw, lx, -0.5, k, 0.4, 3.5, 0.4);
      const flagAt = track.point(i, villageSide * (track.hw[i] + 6));
      swissFlag(batch, flagAt.x, 1.4, flagAt.z, yaw, 1);
    }
  }

  const castleAt = (() => {
    const idx = Math.round(0.15 * N);
    const edge = shoreline(idx, -villageSide);
    const i = track.wrap(idx);
    const lat = edge ? Math.min(edge.lat - 18, track.hw[i] + 26) : track.hw[i] + 26;
    return { p: track.point(i, -villageSide * lat), yaw: track.heading(i) };
  })();
  castle(batch, castleAt.p.x, castleAt.p.z, castleAt.yaw, rand);
  taken.push({ x: castleAt.p.x, z: castleAt.p.z, r: 26 });

  const jet = buildJet();
  const jetAt = (() => {
    const idx = Math.round(0.06 * N);
    const i = track.wrap(idx);
    for (const lat of [30, 24, 18]) {
      const p = track.point(i, -villageSide * (track.hw[i] + lat));
      if (height(p.x, p.z) < -2) return p;
    }
    return track.point(i, -villageSide * (track.hw[i] + 18));
  })();
  jet.position.set(jetAt.x, 0, jetAt.z);
  group.add(jet);

  coveredBridge(batch, track, Math.round(0.62 * N));
  const bridgeAt = track.point(Math.round(0.62 * N));
  taken.push({ x: bridgeAt.x, z: bridgeAt.z, r: track.hw[Math.round(0.62 * N)] + 16 });

  const meadow = (x, z) => {
    const y = height(x, z);
    return y > 2 && y < 40 && shoreOf(x, z) > 7 && slope(x, z) > 0.88;
  };
  const herdSpots = [];
  group.userData.herds = herdSpots;
  for (let tries = 0, herds = 0; herds < 9 && tries < 4000; tries++) {
    const idx = Math.floor(rand() * N);
    const sign = rand() < 0.5 ? -1 : 1;
    const c = track.point(idx, sign * (track.hw[track.wrap(idx)] + 16 + rand() * 40));
    if (!meadow(c.x, c.z) || !free(c.x, c.z, 14)) continue;
    const facing = rand() * Math.PI * 2;
    const size = 2 + Math.floor(rand() * 5);
    const herd = [];
    const roomFor = (x, z, r) => meadow(x, z) && herd.every((o) => Math.hypot(o.x - x, o.z - z) > o.r + r);
    for (let k = 0, tries2 = 0; k < size && tries2 < 40; tries2++) {
      const a = rand() * Math.PI * 2;
      const d = 3 + rand() * 11;
      const x = c.x + Math.cos(a) * d;
      const z = c.z + Math.sin(a) * d;
      if (!roomFor(x, z, 2.6)) continue;
      cow(batch, x, height(x, z), z, facing + (rand() - 0.5) * 1.6, rand);
      herd.push({ x, z, r: 2.6 });
      k++;
      if (rand() < 0.3) {
        const b = rand() * Math.PI * 2;
        const cx = x + Math.cos(b) * 4.5;
        const cz = z + Math.sin(b) * 4.5;
        if (roomFor(cx, cz, 1.6)) {
          cow(batch, cx, height(cx, cz), cz, facing + (rand() - 0.5) * 2, rand, { calf: true });
          herd.push({ x: cx, z: cz, r: 1.6 });
        }
      }
    }
    taken.push({ x: c.x, z: c.z, r: 14 });
    herdSpots.push({ x: c.x, y: height(c.x, c.z), z: c.z });
    herds++;
  }

  for (let tries = 0, patches = 0; patches < 160 && tries < 3000; tries++) {
    const idx = Math.floor(rand() * N);
    const sign = rand() < 0.5 ? -1 : 1;
    const p = track.point(idx, sign * (track.hw[track.wrap(idx)] + 8 + rand() * 60));
    if (!meadow(p.x, p.z)) continue;
    flowers(petals, p.x, height(p.x, p.z), p.z, rand, height);
    patches++;
  }

  for (let tries = 0, rocks = 0; rocks < 140 && tries < 4000; tries++) {
    const x = minX + rand() * (maxX - minX);
    const z = minZ + rand() * (maxZ - minZ);
    const shore = shoreOf(x, z);
    if (shore < -1 || shore > 160) continue;
    const y = height(x, z);
    if (y < -0.5 || y > 110 || !free(x, z, 3)) continue;
    boulder(batch, x, y, z, rand, shore < 4 ? 1 + rand() * 1.5 : 1.2 + rand() * 2.8);
    rocks++;
  }

  let trees = 0;
  for (let tries = 0, groves = 0; groves < 420 && tries < 9000; tries++) {
    if (tries % 200 === 0) await tick();
    const cx = minX + rand() * (maxX - minX);
    const cz = minZ + rand() * (maxZ - minZ);
    if (noise(cx * 2.1 + 90, cz * 2.1 - 40) < 0.4 || shoreOf(cx, cz) < 6) continue;
    const cy = height(cx, cz);
    if (cy < 2 || cy > 100) continue;
    groves++;
    const count = 3 + Math.floor(rand() * 14);
    const spread = 6 + rand() * 18;
    for (let k = 0; k < count; k++) {
      const a = rand() * Math.PI * 2;
      const d = spread * Math.sqrt(rand());
      const x = cx + Math.cos(a) * d;
      const z = cz + Math.sin(a) * d;
      if (shoreOf(x, z) < 5) continue;
      const y = height(x, z);
      if (y < 2 || y > 102 || slope(x, z) < 0.7 || !free(x, z, 3)) continue;
      const edge = d / spread;
      tree(batch, x, y, z, y, rand, (1.15 - edge * 0.45) * (y > 85 ? 0.7 : 1));
      trees++;
      if (rand() < 0.12) shrub(batch, x + (rand() - 0.5) * 6, y, z + (rand() - 0.5) * 6, rand);
    }
  }
  for (let tries = 0, singles = 0; singles < 260 && tries < 6000; tries++) {
    const idx = Math.floor(rand() * N);
    const sign = rand() < 0.5 ? -1 : 1;
    const p = track.point(idx, sign * (track.hw[track.wrap(idx)] + 6 + rand() * 50));
    const y = height(p.x, p.z);
    if (y < 1.5 || y > 60 || shoreOf(p.x, p.z) < 5 || !free(p.x, p.z, 4)) continue;
    if (rand() < 0.35) shrub(batch, p.x, y, p.z, rand);
    else tree(batch, p.x, y, p.z, y, rand, 0.7 + rand() * 0.6);
    singles++;
  }

  const scenery = new THREE.Group();
  const chunks = await batch.buildAsync(scenery, 0.1, ALPS_COLORS, undefined, tick);
  const blooms = await petals.buildAsync(scenery, 0, ALPS_COLORS, undefined, tick);
  group.add(scenery);

  const buoys = courseBuoys(track, (idx) => lakeAt(idx) > 0.4);
  group.add(buoys);
  group.add(createArch(track, track.hw[0]));

  const steamer = buildSteamer();
  group.add(steamer);
  const route = [];
  for (let f = -0.05; f < 0.11; f += 0.004) {
    const i = track.wrap(Math.round(f * N));
    const p = track.point(i, -villageSide * (track.hw[i] + 9));
    if (height(p.x, p.z) < -2 && Math.hypot(p.x - jetAt.x, p.z - jetAt.z) > 12) route.push(p);
  }

  const clouds = [];
  for (let i = 0; i < 14; i++) {
    const cloud = createCloud(rand);
    const a = rand() * Math.PI * 2;
    const d = 150 + rand() * 600;
    cloud.position.set(Math.cos(a) * d, 150 + rand() * 80, Math.sin(a) * d);
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
      cullChunks(blooms, camera, 260);
      sky.position.copy(camera.position);
      buoys.userData.update(t);
      for (const cloud of clouds) {
        cloud.position.x += cloud.userData.speed * dt;
        if (cloud.position.x > 800) cloud.position.x = -800;
      }
      if (route.length > 2) {
        const u = (Math.sin(t * 0.02) * 0.5 + 0.5) * (route.length - 1.001);
        const k = Math.floor(u);
        const a = route[k];
        const b = route[k + 1];
        const w = u - k;
        steamer.position.set(a.x + (b.x - a.x) * w, Math.sin(t * 1.3) * 0.15, a.z + (b.z - a.z) * w);
        const forward = Math.cos(t * 0.02) >= 0 ? 1 : -1;
        steamer.rotation.y = Math.atan2((b.x - a.x) * forward, (b.z - a.z) * forward);
      }
      jet.scale.y = 1 + 0.04 * Math.sin(t * 9);
      if (Math.random() < dt * 14) fx.droplet(jetAt.x + (Math.random() - 0.5) * 2, 66 + Math.random() * 6, jetAt.z + (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 6, -2, (Math.random() - 0.5) * 6, 0.6);
      if (Math.random() < dt * 6) fx.mist(jetAt.x, 0.5, jetAt.z);
    },
  };
}
