import * as THREE from 'three';
import { createWater } from './water.js';
import { mulberry32 } from './toon.js';
import { Batcher, createSky, slicer, SUN_DIR } from './world.js';
import { smooth, noise } from './terrain.js';
import { tree, sapling, boulder } from './alpine.js';
import { chalet, lakeDock } from './alpsLandmarks.js';
import { ALPS_COLORS, church } from './alps.js';
import { alpineGround } from './groundShader.js';
import { arenaGround, addClouds, finishArena, obstacleList, shoresOf, beyond, islandHeight } from './arenaKit.js';

export async function createAlpineArena(group, track) {
  const arena = track.map.arena;
  const tick = slicer();
  const fog = new THREE.Fog(0xdcecf4, 520, 1300);
  const sky = createSky();
  group.add(sky);
  group.add(new THREE.HemisphereLight(0xf2f8ff, 0x5f9a5a, 1.35));
  const sun = new THREE.DirectionalLight(0xfff2dc, 2.4);
  sun.position.copy(SUN_DIR).multiplyScalar(100);
  group.add(sun);

  const obstacles = obstacleList(arena);
  const shores = shoresOf(obstacles);
  const homes = arena.bases.map(([x, z]) => ({ x: Math.sign(x) * (arena.rx + 70), z }));
  const village = (x, z) => Math.max(...homes.map((h) => smooth(150, 70, Math.hypot(x - h.x, z - h.z))));
  const rim = (d, x, z) => {
    const flat = village(x, z);
    let y = -2 + 3.2 * smooth(-2, 7, d);
    y += smooth(6, 45, d) * (2 + 7 * noise(x * 1.5, z * 1.5)) * (1 - flat * 0.6);
    const ridge = 1 - Math.abs(Math.sin(x * 0.011 + Math.sin(z * 0.007) * 2) * Math.cos(z * 0.013 - x * 0.004));
    y += smooth(45, 270, d) * (70 + 160 * ridge * noise(x * 0.7 + 200, z * 0.7 - 100)) * (1 - flat * 0.75);
    return y;
  };
  const shades = {
    sand: new THREE.Color(0xcfc6ad),
    grass: new THREE.Color(0x6cb83f),
    grassDeep: new THREE.Color(0x4f9b33),
    alp: new THREE.Color(0x8fa556),
    rock: new THREE.Color(0xa49e95),
    rockHigh: new THREE.Color(0x8f8c8a),
    snow: new THREE.Color(0xf6f9ff),
    bed: new THREE.Color(0x2f6f7a),
  };
  const mixed = new THREE.Color();
  const tint = new THREE.Color();
  const paint = (x, y, z, ny, color) => {
    if (y < -1.5) return color.copy(shades.bed);
    color.copy(shades.grass).lerp(shades.grassDeep, smooth(0.35, 0.75, noise(x * 1.6, z * 1.6)));
    color.lerp(shades.alp, smooth(55, 85, y));
    mixed.copy(shades.rock).lerp(shades.rockHigh, smooth(60, 110, y));
    const cliff = 0.68 + 0.1 * (noise(x * 0.9 + 30, z * 0.9) - 0.5);
    color.lerp(mixed, smooth(cliff + 0.04, cliff - 0.04, ny));
    const snowLine = 110 + 30 * noise(x * 2, z * 2);
    color.lerp(shades.snow, smooth(snowLine - 6, snowLine + 6, y) * smooth(0.35, 0.55, ny));
    color.lerp(shades.sand, smooth(1.6, 0.2, y));
    color.multiply(tint.setScalar(0.94 + 0.08 * noise(x * 5 + 7, z * 5)));
  };
  const { mesh: ground, height, bounds } = await arenaGround(arena, { rim, obstacles, paint, tick });
  alpineGround(ground.material);
  group.add(ground);

  const water = createWater({ deep: 0x1677b8, shallow: 0x4fd0e6 });
  group.add(water.mesh);

  const rand = mulberry32(31415);
  const batch = new Batcher();
  const taken = [];
  const free = (x, z, r) => !taken.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + r);
  const slope = (x, z) => {
    const e = 2;
    return 1 / Math.hypot((height(x + e, z) - height(x - e, z)) / (2 * e), (height(x, z + e) - height(x, z - e)) / (2 * e), 1);
  };
  const onIsland = (o, spread) => {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * spread;
    const lx = Math.cos(a) * o.rx * r;
    const lz = Math.sin(a) * o.rz * r;
    const c = Math.cos(o.rot);
    const s = Math.sin(o.rot);
    const x = o.x + lx * c + lz * s;
    const z = o.z - lx * s + lz * c;
    return { x, z, y: islandHeight([o], x, z) };
  };

  for (const o of obstacles) {
    if (o.kind === 'chapel') {
      church(batch, o.x, islandHeight([o], o.x, o.z) - 0.6, o.z, Math.PI / 2 - o.rot);
      taken.push({ x: o.x, z: o.z, r: 14 });
      for (let k = 0; k < 26; k++) {
        const p = onIsland(o, 0.85);
        if (p.y < 1.5 || !free(p.x, p.z, 2.5)) continue;
        tree(batch, p.x, p.y - 0.3, p.z, rand, 0.8 + rand() * 0.3);
        taken.push({ x: p.x, z: p.z, r: 2.5 });
      }
    } else if (o.kind === 'pines') {
      const count = Math.round((o.rx * o.rz) / 14);
      for (let k = 0; k < count; k++) {
        const p = onIsland(o, 0.8);
        if (p.y < 1.2 || !free(p.x, p.z, 2.2)) continue;
        tree(batch, p.x, p.y - 0.3, p.z, rand, 0.75 + rand() * 0.45);
        taken.push({ x: p.x, z: p.z, r: 2.2 });
      }
    }
    for (let k = 0; k < Math.round((o.rx + o.rz) / (o.kind === 'rocks' ? 2 : 5)); k++) {
      const p = onIsland(o, o.kind === 'rocks' ? 0.9 : 1);
      if (p.y < -0.6 || !free(p.x, p.z, 1)) continue;
      boulder(batch, p.x, p.y, p.z, rand, o.kind === 'rocks' ? 1.6 + rand() * 2.4 : 1 + rand() * 1.6);
    }
    if (o.kind === 'rocks') for (let k = 0; k < 4; k++) {
      const p = onIsland(o, 0.5);
      if (p.y > 1) sapling(batch, p.x, p.y, p.z, rand);
    }
  }

  for (const home of homes) {
    const side = Math.sign(home.x);
    const shoreX = side * arena.rx;
    const pierLen = 30;
    const px = shoreX - side * (pierLen / 2 - 6);
    for (const pz of [-34, 34]) {
      lakeDock(batch, px, pz, Math.PI / 2, pierLen, rand);
      shores.push({ x: px, z: pz, rx: pierLen / 2, rz: 3, rot: 0, top: 2.5 });
    }
    for (let k = 0; k < 16; k++) {
      const x = shoreX + side * (22 + rand() * 80);
      const z = (rand() - 0.5) * 190;
      const y = height(x, z);
      if (y < 1.5 || y > 26 || slope(x, z) < 0.82 || !free(x, z, 9)) continue;
      const face = Math.atan2(-side, 0) + (rand() - 0.5) * 0.5;
      if (k === 0) church(batch, x, y, z, face);
      else chalet(batch, x, y, z, face, rand);
      taken.push({ x, z, r: 9 });
    }
  }

  for (let tries = 0, rocks = 0; rocks < 110 && tries < 3000; tries++) {
    const x = bounds.minX + rand() * (bounds.maxX - bounds.minX);
    const z = bounds.minZ + rand() * (bounds.maxZ - bounds.minZ);
    const d = beyond(arena, x, z);
    if (d < -1 || d > 150) continue;
    const y = height(x, z);
    if (y < -0.5 || y > 110 || !free(x, z, 3)) continue;
    boulder(batch, x, y, z, rand, d < 5 ? 1 + rand() * 1.5 : 1.2 + rand() * 2.6);
    taken.push({ x, z, r: 2 });
  }

  for (let tries = 0, groves = 0; groves < 300 && tries < 7000; tries++) {
    if (tries % 200 === 0) await tick();
    const cx = bounds.minX + rand() * (bounds.maxX - bounds.minX);
    const cz = bounds.minZ + rand() * (bounds.maxZ - bounds.minZ);
    if (noise(cx * 2.1 + 90, cz * 2.1 - 40) < 0.38 || beyond(arena, cx, cz) < 8) continue;
    const cy = height(cx, cz);
    if (cy < 2 || cy > 100) continue;
    groves++;
    const count = 3 + Math.floor(rand() * 12);
    const spread = 6 + rand() * 18;
    for (let k = 0; k < count; k++) {
      const a = rand() * Math.PI * 2;
      const r = spread * Math.sqrt(rand());
      const x = cx + Math.cos(a) * r;
      const z = cz + Math.sin(a) * r;
      if (beyond(arena, x, z) < 7) continue;
      const y = height(x, z);
      if (y < 2 || y > 102 || slope(x, z) < 0.7 || !free(x, z, 2.6)) continue;
      tree(batch, x, y - 0.3, z, rand, (1.15 - (r / spread) * 0.45) * (y > 85 ? 0.7 : 1));
      taken.push({ x, z, r: 2.4 });
    }
  }

  const scenery = new THREE.Group();
  const chunks = await batch.buildAsync(scenery, 0.1, ALPS_COLORS, undefined, tick);
  group.add(scenery);
  const clouds = addClouds(group, rand);
  return finishArena({ group, sky, water, fog, sun, height, shores, chunks: [chunks], clouds, tick });
}
