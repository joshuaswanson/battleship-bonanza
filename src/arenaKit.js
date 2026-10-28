import * as THREE from 'three';
import { Collider } from './collider.js';
import { cullChunks, createCloud } from './world.js';
import { buildHeightfield, ellipseHit, groundHit, smooth, noise } from './terrain.js';

export const FLOOR = -4;

export function beyond(arena, x, z) {
  const q = Math.hypot(x / arena.rx, z / arena.rz);
  return q === 0 ? -Math.min(arena.rx, arena.rz) : Math.hypot(x, z) * (1 - 1 / q);
}

const local = (o, x, z) => {
  const dx = x - o.x;
  const dz = z - o.z;
  const c = Math.cos(o.rot);
  const s = Math.sin(o.rot);
  return Math.hypot((dx * c - dz * s) / o.rx, (dx * s + dz * c) / o.rz);
};

export const obstacleList = (arena) => arena.obstacles.map(([x, z, rx, rz, rot, peak, kind]) => ({ x, z, rx, rz, rot, peak, kind }));

export function islandHeight(obstacles, x, z) {
  let y = -Infinity;
  for (const o of obstacles) {
    if (!o.peak) continue;
    if (Math.abs(x - o.x) > o.rx + o.rz + 12 || Math.abs(z - o.z) > o.rx + o.rz + 12) continue;
    const e = local(o, x, z);
    if (e > 1.35) continue;
    const top = e < 1 ? o.peak * (1 - e * e) ** 0.7 + (0.6 + 0.4 * noise(x * 3 + o.x, z * 3)) * smooth(0.95, 0.4, e) * Math.min(4, o.peak * 0.3) : FLOOR * smooth(1, 1.35, e);
    y = Math.max(y, top);
  }
  return y;
}

export const shoresOf = (obstacles) => obstacles.map((o) => ({ x: o.x, z: o.z, rx: o.rx, rz: o.rz, rot: o.rot, top: o.peak ? Math.max(4, o.peak) : o.top ?? 6 }));

export async function arenaGround(arena, { rim, obstacles, paint, tick, margin = 320, step = 4 }) {
  const height = (x, z) => {
    const d = beyond(arena, x, z);
    let y = d < -2 ? FLOOR : rim(d, x, z);
    if (d < 40) y = Math.max(y, islandHeight(obstacles, x, z));
    return y;
  };
  const bounds = { minX: -arena.rx - margin, maxX: arena.rx + margin, minZ: -arena.rz - margin, maxZ: arena.rz + margin };
  const mesh = await buildHeightfield({ bounds, step, height, paint, tick, smooth: true });
  return { mesh, height, bounds };
}

export function addClouds(group, rand, count = 14, color = null) {
  const clouds = [];
  for (let i = 0; i < count; i++) {
    const cloud = createCloud(rand, color);
    const a = rand() * Math.PI * 2;
    const d = 150 + rand() * 600;
    cloud.position.set(Math.cos(a) * d, 120 + rand() * 70, Math.sin(a) * d);
    cloud.userData.speed = 2 + rand() * 3;
    clouds.push(cloud);
    group.add(cloud);
  }
  return clouds;
}

export async function finishArena({ group, sky, water, fog, sun, height, shores, chunks, clouds = [], skip = [], tick, spray, update }) {
  const collider = new Collider();
  await collider.addObject(group, new Set([sky, water.mesh, ...clouds, ...skip]), tick);
  return {
    fog,
    water,
    sun,
    shores,
    spray,
    collider,
    solid: (p) => ellipseHit(shores, p) ?? groundHit(height, p),
    raycast: (origin, dir, far) => collider.raycast(origin, dir, dir.y < 0 ? Math.min(far, (origin.y + 0.3) / -dir.y) : far),
    update(t, dt, camera) {
      water.update(t);
      for (const list of chunks) cullChunks(list, camera, fog.far);
      sky.position.copy(camera.position);
      for (const cloud of clouds) {
        cloud.position.x += cloud.userData.speed * dt;
        if (cloud.position.x > 800) cloud.position.x = -800;
      }
      update?.(t, dt, camera);
    },
  };
}
