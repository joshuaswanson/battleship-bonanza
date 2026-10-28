import * as THREE from 'three';
import { createWater } from './water.js';
import { mulberry32 } from './toon.js';
import { Batcher, createSky, slicer, COLORS, mat } from './world.js';
import { smooth, noise } from './terrain.js';
import { DOCK_COLORS, GLOW_COLORS, CONTAINER, containerStack, quayCrane, cargoShip, warehouse, oilTank, floodMast, bollard, drums, pallets } from './docksProps.js';
import { Lights, starfield, unlit, WARM, COOL, SKY_TOP, SKY_HORIZON, HAZE } from './docks.js';
import { arenaGround, finishArena, obstacleList, shoresOf, beyond, FLOOR } from './arenaKit.js';

const QUAY_TOP = 2.2;
const COPING = 5;
const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 16);
const LAMP = new THREE.SphereGeometry(1, 10, 8);
const COLORS_ALL = { ...COLORS, ...DOCK_COLORS, ...GLOW_COLORS };

function quayRing(arena) {
  const positions = [];
  const colors = [];
  const face = new THREE.Color(0x4f5054);
  const slime = new THREE.Color(0x2f3624);
  const paving = new THREE.Color(0x77787c);
  const stripe = new THREE.Color(DOCK_COLORS.hazard);
  const at = (a, out) => {
    const x = Math.cos(a) * arena.rx;
    const z = Math.sin(a) * arena.rz;
    const nx = x / arena.rx ** 2;
    const nz = z / arena.rz ** 2;
    const l = Math.hypot(nx, nz);
    return [x + (nx / l) * out, z + (nz / l) * out];
  };
  const quad = (p, q, r, s, c) => {
    for (const v of [p, q, r, p, r, s]) {
      positions.push(...v);
      colors.push(c.r, c.g, c.b);
    }
  };
  const STEPS = 720;
  for (let k = 0; k < STEPS; k++) {
    const a0 = (k / STEPS) * Math.PI * 2;
    const a1 = ((k + 1) / STEPS) * Math.PI * 2;
    const [x0, z0] = at(a0, 0);
    const [x1, z1] = at(a1, 0);
    const [ox0, oz0] = at(a0, COPING);
    const [ox1, oz1] = at(a1, COPING);
    quad([x0, FLOOR - 0.5, z0], [x0, -0.4, z0], [x1, -0.4, z1], [x1, FLOOR - 0.5, z1], slime);
    quad([x0, -0.4, z0], [x0, QUAY_TOP + 0.05, z0], [x1, QUAY_TOP + 0.05, z1], [x1, -0.4, z1], face);
    quad([x0, QUAY_TOP + 0.05, z0], [ox0, QUAY_TOP + 0.05, oz0], [ox1, QUAY_TOP + 0.05, oz1], [x1, QUAY_TOP + 0.05, z1], k % 24 < 12 ? stripe : paving);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
}

function barge(batch, glow, o, rand, kind) {
  const L = o.rx * 1.7;
  const W = o.rz * 1.5;
  const put = (key, geometry, lx, y, lz, sx, sy, sz) => {
    const c = Math.cos(o.rot);
    const s = Math.sin(o.rot);
    batch.add(key, geometry, mat(o.x + lx * c + lz * s, y, o.z - lx * s + lz * c, sx, sy, sz, 0, o.rot, 0));
  };
  put(kind === 'pontoon' ? 'steel' : 'hullBlack', BOX, 0, -0.4, 0, L, 2.6, W);
  put('hullRed', BOX, 0, -1.2, 0, L + 0.1, 1.2, W + 0.1);
  put('steelDark', BOX, 0, 0.95, 0, L - 0.6, 0.2, W - 0.6);
  for (const side of [-1, 1]) put('rubber', BOX, 0, 0.7, side * (W / 2 + 0.25), L * 0.8, 0.6, 0.5);
  const c = Math.cos(o.rot);
  const s = Math.sin(o.rot);
  if (kind === 'pontoon') {
    for (let k = 0; k < 4; k++) {
      const lx = (k - 1.5) * (L / 4.5);
      if (rand() < 0.5) drums(batch, o.x + lx * c, 1.05, o.z - lx * s, rand);
      else pallets(batch, o.x + lx * c, 1.05, o.z - lx * s, o.rot, rand);
    }
    return;
  }
  const bays = Math.max(1, Math.floor((L - 2) / (CONTAINER.long + 0.5)));
  const rows = Math.max(1, Math.floor((W - 1) / (CONTAINER.width + 0.25)));
  containerStack(batch, o.x, 1.05, o.z, o.rot, rand, { rows, bays, tiers: 3 });
  for (const end of [-1, 1]) {
    const lx = end * (L / 2 - 0.6);
    glow.add('signal', LAMP, mat(o.x + lx * c, 1.6, o.z - lx * s, 0.3, 0.3, 0.3));
  }
}

export async function createHarborArena(group, track) {
  const arena = track.map.arena;
  const tick = slicer();
  const fog = new THREE.Fog(HAZE, 220, 950);
  const sky = createSky({ top: SKY_TOP, horizon: SKY_HORIZON });
  sky.material.uniforms.uSunDir.value.set(0.2, -0.4, 0.9).normalize();
  const rand = mulberry32(8086);
  sky.add(starfield(rand));
  const moon = new THREE.Mesh(new THREE.CircleGeometry(38, 32), new THREE.MeshBasicMaterial({ color: 0xf4efd8, fog: false }));
  moon.position.set(-520, 760, -900);
  moon.lookAt(0, 0, 0);
  sky.add(moon);
  group.add(sky);
  group.add(new THREE.HemisphereLight(0x6a7cc4, 0x1c1a24, 0.75));
  const sun = new THREE.DirectionalLight(0xffb37a, 0.75);
  sun.position.set(-60, 45, 80);
  group.add(sun);
  const moonLight = new THREE.DirectionalLight(0x9db4ff, 0.7);
  moonLight.position.set(-40, 80, -60);
  group.add(moonLight);

  const obstacles = obstacleList(arena);
  const shores = shoresOf(obstacles).map((blob) => ({ ...blob, top: 8 }));
  const rim = (d) => (d > 3 ? QUAY_TOP : FLOOR + (QUAY_TOP - FLOOR) * smooth(-1, 3, d));
  const paint = (x, y, z, ny, color) => {
    if (y < 0) return color.set(0x2b3324);
    const tile = (Math.floor(x / 7) + Math.floor(z / 7)) % 2 ? 0x6b6c70 : 0x626367;
    color.set(tile).multiplyScalar(0.9 + 0.2 * noise(x * 3, z * 3));
    const lane = Math.abs(((x + z * 0.3) % 26) + 26) % 26;
    if (beyond(arena, x, z) > 12 && lane < 0.6) color.set(0xb89a3a);
  };
  const { mesh: ground, height } = await arenaGround(arena, { rim, obstacles, paint, tick, margin: 260 });
  group.add(ground, quayRing(arena));

  const water = createWater({ deep: 0x10161a, shallow: 0x232d1d, foam: 0x4a4834, amp: 0.8 });
  group.add(water.mesh);

  const batch = new Batcher();
  const glow = new Batcher();
  const lights = new Lights();
  const blinks = [];
  const taken = [];
  const free = (x, z, r) => !taken.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + r);
  const edge = (a, out) => {
    const x = Math.cos(a) * arena.rx;
    const z = Math.sin(a) * arena.rz;
    const nx = x / arena.rx ** 2;
    const nz = z / arena.rz ** 2;
    const l = Math.hypot(nx, nz);
    return { x: x + (nx / l) * out, z: z + (nz / l) * out, yaw: Math.atan2(-nx, -nz) };
  };

  for (const o of obstacles) {
    if (o.kind === 'ship') {
      cargoShip(batch, glow, o.x, o.z, Math.PI / 2 + o.rot, rand, { length: o.rx * 1.85, beam: o.rz * 1.45 });
      lights.pool(o.x, 0.5, o.z, 30, WARM, 0.5);
    } else if (o.kind === 'barge' || o.kind === 'pontoon') {
      barge(batch, glow, o, rand, o.kind);
      lights.pool(o.x, 0.4, o.z, o.rx + 6, COOL, 0.35);
    } else if (o.kind === 'beacon') {
      batch.add('concrete', CYL, mat(o.x, -1, o.z, o.rx * 0.95, 5, o.rx * 0.95));
      batch.add('hazard', CYL, mat(o.x, 1.7, o.z, o.rx * 0.97, 0.5, o.rx * 0.97));
      batch.add('craneWhite', CYL, mat(o.x, 8, o.z, 2, 12, 2));
      batch.add('craneRed', CYL, mat(o.x, 11, o.z, 2.05, 2, 2.05));
      batch.add('steelDark', CYL, mat(o.x, 14.4, o.z, 2.6, 0.4, 2.6));
      glow.add('signal', LAMP, mat(o.x, 15.6, o.z, 1.1, 1.1, 1.1));
      blinks.push({ x: o.x, y: 15.6, z: o.z });
      lights.pool(o.x, 0.5, o.z, 16, WARM, 0.6);
    }
  }

  for (const [bx] of arena.bases) {
    const side = Math.sign(bx);
    const behind = edge(side > 0 ? 0 : Math.PI, 40);
    taken.push(warehouse(batch, glow, behind.x + side * 30, QUAY_TOP, behind.z, Math.PI / 2, 60, 34, 16, rand));
    for (const sz of [-1, 1]) {
      const a = (side > 0 ? 0 : Math.PI) + sz * side * 0.32;
      const p = edge(a, COPING + 8);
      const crane = quayCrane(batch, glow, p.x, QUAY_TOP, p.z, p.yaw, rand, { reach: 26, color: side > 0 ? 'craneRed' : 'craneBlue' });
      blinks.push(...crane.blinks);
      for (const pool of crane.pools) lights.pool(pool.x, 0.5, pool.z, pool.r, WARM, 0.9);
      taken.push(...crane.footprint);
    }
  }

  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2 + 0.16;
    if (Math.abs(Math.cos(a)) > 0.92) continue;
    const p = edge(a, COPING + 10);
    if (!free(p.x, p.z, 12)) continue;
    const crane = quayCrane(batch, glow, p.x, QUAY_TOP, p.z, p.yaw, rand, { reach: 28, color: ['craneRed', 'craneWhite', 'craneBlue'][k % 3] });
    blinks.push(...crane.blinks);
    for (const pool of crane.pools) lights.pool(pool.x, 0.5, pool.z, pool.r, WARM, 0.85);
    taken.push(...crane.footprint);
  }

  for (let a = 0; a < Math.PI * 2; a += 0.05) {
    const p = edge(a, 1.4);
    if (free(p.x, p.z, 1)) bollard(batch, p.x, QUAY_TOP, p.z);
  }

  for (let k = 0; k < 22; k++) {
    const a = (k / 22) * Math.PI * 2;
    const p = edge(a, COPING + 3);
    if (!free(p.x, p.z, 3)) continue;
    const mast = floodMast(batch, glow, p.x, QUAY_TOP, p.z, 20, rand);
    for (const h of mast.heads) {
      const out = edge(a, -14);
      lights.beam(new THREE.Vector3(h.x, mast.y, h.z), new THREE.Vector3(out.x, 0, out.z), 6, WARM, 0.45);
    }
    lights.pool(edge(a, -10).x, 0.5, edge(a, -10).z, 14, WARM, 0.7);
    taken.push({ x: p.x, z: p.z, r: 3 });
  }

  for (let ring = 0; ring < 5; ring++) {
    const out = COPING + 30 + ring * 32;
    const count = Math.round(((arena.rx + arena.rz) * Math.PI) / 24) + ring * 8;
    for (let k = 0; k < count; k++) {
      const a = (k / count) * Math.PI * 2 + ring * 0.07;
      const p = edge(a, out + (rand() - 0.5) * 8);
      if (!free(p.x, p.z, 9) || rand() < 0.1) continue;
      if (ring === 4 && rand() < 0.3) {
        taken.push(oilTank(batch, p.x, QUAY_TOP, p.z, 9 + rand() * 4, 10 + rand() * 6, rand));
        continue;
      }
      const stack = containerStack(batch, p.x, QUAY_TOP, p.z, p.yaw + Math.PI / 2, rand, { rows: 3 + Math.floor(rand() * 3), bays: 1 + Math.floor(rand() * 2), tiers: 2 + ring });
      taken.push(stack);
    }
    await tick();
  }

  const scenery = new THREE.Group();
  const chunks = await batch.buildAsync(scenery, 0.1, COLORS_ALL, undefined, tick);
  const glowGroup = new THREE.Group();
  const glowChunks = await glow.buildAsync(glowGroup, 0, COLORS_ALL, undefined, tick);
  unlit(glowGroup);
  group.add(scenery, glowGroup);
  lights.build(group);
  const blinkMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2a1f, fog: false }), blinks.length);
  blinks.forEach((b, k) => blinkMesh.setMatrixAt(k, new THREE.Matrix4().compose(new THREE.Vector3(b.x, b.y, b.z), new THREE.Quaternion(), new THREE.Vector3(0.9, 0.9, 0.9))));
  blinkMesh.computeBoundingSphere();
  group.add(blinkMesh);

  return finishArena({
    group,
    sky,
    water,
    fog,
    sun,
    height,
    shores,
    chunks: [chunks, glowChunks],
    skip: [glowGroup, lights.beamMesh, lights.poolMesh, blinkMesh],
    tick,
    spray: { foam: 0x6a6a4a, tint: 0x3c4426, wake: 0x485030, glow: 0x161a10 },
    update(t) {
      blinkMesh.visible = t % 1.4 < 0.7;
    },
  });
}
