import * as THREE from 'three';
import { createWater } from './water.js';
import { mulberry32 } from './toon.js';
import { Batcher, createSky, slicer, SUN_DIR, mat, addPalm, ROCK } from './world.js';
import { smooth, noise } from './terrain.js';
import { frame } from './alpine.js';
import { JUNGLE_COLORS, SKY_GREEN, tikiHead, addGiant, addBroadleaf, addBanana, addBush, addFern } from './jungle.js';
import { arenaGround, addClouds, finishArena, obstacleList, shoresOf, beyond, islandHeight } from './arenaKit.js';

const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 10);
const BLOB = new THREE.SphereGeometry(1, 10, 7);
const WEDGE = new THREE.CylinderGeometry(0, 1, 1, 4).rotateY(Math.PI / 4);
const COLORS = {
  ...JUNGLE_COLORS,
  temple: 0xb7ab92,
  templeDark: 0x8c826e,
  templeLight: 0xd3c8ad,
  thatch: 0xc9a25a,
  jade: 0x3fb59a,
};
const CROWNS = [['paintTeal', 'paintYellow'], ['paintRed', 'paintTeal'], ['paintYellow', 'paintRed']];

function pyramid(batch, x, y, z, yaw, rand) {
  const put = frame(batch, x, y, z, yaw, 0, 0, 1);
  const tiers = 5;
  let half = 21;
  let top = 0;
  for (let k = 0; k < tiers; k++) {
    const h = 3.4;
    put(k % 2 ? 'temple' : 'templeLight', BOX, 0, top + h / 2, 0, half * 2, h, half * 2);
    put('templeDark', BOX, 0, top + h - 0.15, 0, half * 2 + 0.6, 0.35, half * 2 + 0.6);
    for (let m = 0; m < 6; m++) {
      const a = Math.floor(rand() * 4) * (Math.PI / 2);
      const along = (rand() - 0.5) * half * 1.6;
      put('moss', BLOB, Math.cos(a) * half + Math.sin(a) * along, top + h * rand(), Math.sin(a) * half - Math.cos(a) * along, 1.6 + rand() * 1.6, 0.8 + rand() * 1.2, 1.2 + rand());
    }
    top += h;
    half -= 3.6;
  }
  const run = top / 0.9;
  const out = 22 - run / 2;
  const pitch = Math.atan2(top, run);
  for (let side = 0; side < 4; side++) {
    const stair = frame(batch, x, y, z, yaw + (side * Math.PI) / 2, 0, 0, 1);
    stair('templeDark', BOX, 0, top / 2, out, 6, 0.6, Math.hypot(run, top), pitch);
    for (const s of [-1, 1]) stair('temple', BOX, s * 3.6, top / 2 + 0.4, out, 1.2, 1.4, Math.hypot(run, top), pitch);
  }
  put('templeLight', BOX, 0, top + 2.6, 0, 8, 5.2, 8);
  put('mouth', BOX, 0, top + 2, 4.05, 2.4, 3.2, 0.2);
  put('mouth', BOX, 0, top + 2, -4.05, 2.4, 3.2, 0.2);
  put('templeDark', BOX, 0, top + 5.5, 0, 9.4, 0.6, 9.4);
  put('thatch', WEDGE, 0, top + 7.6, 0, 7, 4, 7);
  put('jade', BLOB, 0, top + 10, 0, 0.9, 0.9, 0.9);
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) put('paintYellow', CYL, sx * 5, top + 1.2, sz * 5, 0.5, 2.4, 0.5);
  return top;
}

function ruin(batch, o, rand, height) {
  const c = Math.cos(o.rot);
  const s = Math.sin(o.rot);
  const at = (lx, lz) => ({ x: o.x + lx * c + lz * s, z: o.z - lx * s + lz * c });
  const columns = Math.round(o.rx / 3.2);
  for (let k = 0; k < columns; k++) {
    for (const row of [-1, 1]) {
      const p = at((k - (columns - 1) / 2) * 5.6, row * o.rz * 0.42);
      const y = height(p.x, p.z) - 0.4;
      const broken = rand();
      if (broken < 0.25) {
        const fall = rand() * Math.PI * 2;
        batch.add('temple', CYL, mat(p.x + Math.cos(fall) * 3, y + 0.9, p.z + Math.sin(fall) * 3, 0.9, 6, 0.9, Math.PI / 2, fall, 0));
        continue;
      }
      const h = broken < 0.6 ? 3 + rand() * 4 : 9 + rand() * 2;
      batch.add('templeDark', BOX, mat(p.x, y + 0.4, p.z, 2.6, 0.8, 2.6, 0, o.rot, 0));
      batch.add('temple', CYL, mat(p.x, y + 0.8 + h / 2, p.z, 0.95, h, 0.95));
      if (h > 8) batch.add('templeLight', BOX, mat(p.x, y + 1.1 + h, p.z, 2.6, 0.6, 2.6, 0, o.rot, 0));
      if (rand() < 0.6) batch.add('vine', BLOB, mat(p.x + 0.6, y + h * 0.6, p.z, 0.5, h * 0.4, 0.5));
    }
  }
  if (rand() < 0.8) {
    const p = at(0, 0);
    const y = height(p.x, p.z);
    batch.add('templeLight', BOX, mat(p.x, y + 10.4, p.z, o.rx * 0.9, 1.1, 2.4, 0, o.rot, 0));
  }
  for (let k = 0; k < 6; k++) {
    const p = at((rand() - 0.5) * o.rx * 1.4, (rand() - 0.5) * o.rz * 1.2);
    batch.add('templeDark', BOX, mat(p.x, height(p.x, p.z) + 0.4, p.z, 1.5 + rand() * 2, 1 + rand(), 1.5 + rand() * 2, rand() * 0.3, rand() * 6, rand() * 0.3));
  }
}

export async function createJungleArena(group, track) {
  const arena = track.map.arena;
  const tick = slicer();
  const fog = new THREE.Fog(SKY_GREEN, 320, 1050);
  const sky = createSky();
  group.add(sky);
  group.add(new THREE.HemisphereLight(0xeaffea, 0x3c8f6a, 1.4));
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.4);
  sun.position.copy(SUN_DIR).multiplyScalar(100);
  group.add(sun);

  const obstacles = obstacleList(arena);
  const shores = shoresOf(obstacles);
  const homes = arena.bases.map(([x, z]) => ({ x: Math.sign(x) * (arena.rx + 46), z }));
  const plaza = (x, z) => Math.max(...homes.map((h) => smooth(90, 50, Math.hypot(x - h.x, (z - h.z) * 0.8))));
  const rim = (d, x, z) => {
    const flat = plaza(x, z);
    let y = -2 + 3.4 * smooth(-2, 9, d);
    y += smooth(12, 60, d) * (3 + 8 * noise(x * 1.3, z * 1.3)) * (1 - flat);
    y += smooth(50, 240, d) * (25 + 60 * noise(x * 0.8 + 40, z * 0.8 - 60)) * (1 - flat * 0.8);
    return y + flat * 1.6 * smooth(10, 30, d);
  };
  const shades = {
    bed: new THREE.Color(0x1f6f63),
    sand: new THREE.Color(0xe7d6a2),
    floor: new THREE.Color(0x3f8f3a),
    floorDeep: new THREE.Color(0x2b7533),
    rock: new THREE.Color(0x857a66),
    stone: new THREE.Color(0xb7ab92),
  };
  const tint = new THREE.Color();
  const paint = (x, y, z, ny, color) => {
    if (y < -1.6) return color.copy(shades.bed);
    color.copy(shades.floor).lerp(shades.floorDeep, smooth(0.3, 0.75, noise(x * 1.8, z * 1.8)));
    color.lerp(shades.rock, smooth(0.78, 0.62, ny));
    color.lerp(shades.sand, smooth(1.8, 0.4, y));
    if (plaza(x, z) > 0.6 && y > 0.8) color.lerp(shades.stone, 0.75);
    color.multiply(tint.setScalar(0.94 + 0.08 * noise(x * 5 + 7, z * 5)));
  };
  const { mesh: ground, height, bounds } = await arenaGround(arena, { rim, obstacles, paint, tick });
  group.add(ground);

  const water = createWater({ deep: 0x1c8f86, shallow: 0x4fd6b4 });
  group.add(water.mesh);

  const rand = mulberry32(27182);
  const batch = new Batcher();
  const taken = [];
  const free = (x, z, r) => !taken.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + r);
  const face = (x, z) => Math.atan2(-x, -z);

  for (const o of obstacles) {
    if (o.kind === 'pyramid') {
      pyramid(batch, o.x, 1.4, o.z, Math.PI / 4, rand);
    } else if (o.kind === 'tiki') {
      tikiHead(batch, o.x, -2.2, o.z, face(o.x, o.z), rand, { snarl: rand() < 0.5, crown: CROWNS[Math.floor(rand() * CROWNS.length)] });
      for (let k = 0; k < 7; k++) {
        const a = rand() * Math.PI * 2;
        batch.add('rock', ROCK, mat(o.x + Math.cos(a) * 9.5, -0.6, o.z + Math.sin(a) * 9.5, 2 + rand() * 2, 1 + rand(), 2 + rand() * 2, 0, rand() * 6, 0));
      }
    } else if (o.kind === 'ruin') {
      ruin(batch, o, rand, height);
    } else if (o.kind === 'palms') {
      const top = islandHeight([o], o.x, o.z);
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + rand();
        const px = o.x + Math.cos(a) * 2.5;
        const pz = o.z + Math.sin(a) * 2.5;
        addPalm(batch, px, islandHeight([o], px, pz) - 0.3, pz, rand, { height: 8 + rand() * 5, lean: 0.3 + rand() * 0.3, dir: a });
      }
      for (let k = 0; k < 5; k++) addBush(batch, o.x + (rand() - 0.5) * 6, top - 1, o.z + (rand() - 0.5) * 6, rand);
    }
    if (o.kind === 'ruin' || o.kind === 'pyramid') {
      for (let k = 0; k < 8; k++) {
        const a = rand() * Math.PI * 2;
        const x = o.x + Math.cos(a) * o.rx * 0.95;
        const z = o.z + Math.sin(a) * o.rz * 0.95;
        if (height(x, z) > 0) addFern(batch, x, height(x, z), z, rand);
      }
    }
  }

  for (const home of homes) {
    const side = Math.sign(home.x);
    const y = height(home.x, home.z);
    pyramid(batch, home.x + side * 30, y - 0.5, home.z, Math.PI / 4, rand);
    taken.push({ x: home.x + side * 30, z: home.z, r: 30 });
    for (const sz of [-1, 1]) {
      const x = side * (arena.rx + 8);
      const z = sz * 52;
      tikiHead(batch, x, height(x, z) - 1.5, z, face(x, z) + sz * side * 0.35, rand, { snarl: sz > 0, crown: CROWNS[(sz + 1) / 2] });
      taken.push({ x, z, r: 11 });
    }
  }

  for (let tries = 0, palms = 0; palms < 90 && tries < 3000; tries++) {
    const a = rand() * Math.PI * 2;
    const d = 3 + rand() * 22;
    const x = Math.cos(a) * (arena.rx + d);
    const z = Math.sin(a) * (arena.rz + d);
    const y = height(x, z);
    if (y < 0.4 || !free(x, z, 4)) continue;
    addPalm(batch, x, y - 0.2, z, rand, { height: 9 + rand() * 7, lean: 0.3 + rand() * 0.4, dir: Math.atan2(-z, -x) + (rand() - 0.5) });
    taken.push({ x, z, r: 4 });
    palms++;
  }
  for (let tries = 0, made = 0; made < 900 && tries < 16000; tries++) {
    if (tries % 300 === 0) await tick();
    const x = bounds.minX + rand() * (bounds.maxX - bounds.minX);
    const z = bounds.minZ + rand() * (bounds.maxZ - bounds.minZ);
    const d = beyond(arena, x, z);
    if (d < 14) continue;
    const y = height(x, z);
    if (y < 1 || !free(x, z, 3)) continue;
    const roll = rand();
    if (roll < 0.22) addGiant(batch, x, y - 0.3, z, rand, 0.9 + rand() * 0.4);
    else if (roll < 0.62) addBroadleaf(batch, x, y - 0.2, z, rand, 1 + rand() * 0.4);
    else if (roll < 0.8) addBanana(batch, x, y, z, rand, rand() < 0.4);
    else addBush(batch, x, y, z, rand);
    taken.push({ x, z, r: roll < 0.22 ? 6 : 3 });
    made++;
  }
  for (let k = 0; k < 260; k++) {
    const a = rand() * Math.PI * 2;
    const d = 6 + rand() * 30;
    const x = Math.cos(a) * (arena.rx + d);
    const z = Math.sin(a) * (arena.rz + d);
    const y = height(x, z);
    if (y < 0.6 || !free(x, z, 1.5)) continue;
    (rand() < 0.5 ? addFern : addBush)(batch, x, y, z, rand);
  }

  const scenery = new THREE.Group();
  const chunks = await batch.buildAsync(scenery, 0.1, COLORS, 110, tick);
  group.add(scenery);
  const clouds = addClouds(group, rand, 12);
  return finishArena({ group, sky, water, fog, sun, height, shores, chunks: [chunks], clouds, tick });
}
