import * as THREE from 'three';
import { glow, mulberry32, toon } from './toon.js';
import { mat, ROCK } from './world.js';
import { RAIL_GAP, RAIL_SWITCH_EVERY, RAIL_SWITCH_LENGTH } from './race/shared.js';

const WHEEL_X = 2.2;
const LANTERN_STEP = 26;
const WALL = 27;
const ROOF = 15;
const CAVE_LENGTH = 190;

export const MINE_COLORS = { sleeper: 0x5e3d24, timber: 0x8a5a33, timberDark: 0x5e3d24, railSteel: 0xc3cdd8, ore: 0xffc62e, orePale: 0xffe48a, dynamite: 0xe0503a };

const wave = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const noise = (x, z) => 0.5 + 0.25 * Math.sin(x * 0.21 + Math.sin(z * 0.13) * 2) + 0.15 * Math.sin(z * 0.34 + x * 0.11) + 0.1 * Math.sin((x - z) * 0.57);
const BOX = new THREE.BoxGeometry(1, 1, 1);
const BOLT = new THREE.CylinderGeometry(1, 1, 1, 8);
const SPIKE = new THREE.ConeGeometry(1, 1, 5).toNonIndexed();
SPIKE.computeVertexNormals();

function bars(track) {
  const { launch, span } = track.river.land;
  return { first: launch + 110, last: launch + span - 6, caveMid: launch + span * 0.62 };
}

const caveOpen = (mid, s) => wave(mid - CAVE_LENGTH * 0.62, mid - CAVE_LENGTH * 0.32, s) * (1 - wave(mid + CAVE_LENGTH * 0.32, mid + CAVE_LENGTH * 0.62, s));

function frameAt(track, s) {
  const at = s / track.spacing;
  const i = track.wrap(Math.floor(at));
  const j = track.wrap(Math.floor(at) + 1);
  const u = at - Math.floor(at);
  const nx = track.nx[i] + (track.nx[j] - track.nx[i]) * u;
  const nz = track.nz[i] + (track.nz[j] - track.nz[i]) * u;
  return { i, x: track.px[i] + (track.px[j] - track.px[i]) * u, z: track.pz[i] + (track.pz[j] - track.pz[i]) * u, y: track.level(s), nx, nz, yaw: Math.atan2(-nz, nx) };
}

function buildRails(group, track) {
  const { first, last } = bars(track);
  const sleepers = [];
  const rails = [];
  const place = (s, lat, list, y, sx) => {
    const f = frameAt(track, s);
    list.push([f.x + f.nx * lat, f.y + y, f.z + f.nz * lat, f.yaw, sx]);
  };
  for (let s = first; s < last; s += 1.5) {
    for (let lane = -1; lane <= 1; lane++) {
      place(s, lane * RAIL_GAP, sleepers, -0.24, 0);
      for (const side of [-1, 1]) place(s, lane * RAIL_GAP + side * WHEEL_X, rails, -0.02, 0);
    }
  }
  const brace = [];
  for (let node = Math.ceil((first - track.river.land.launch) / RAIL_SWITCH_EVERY); ; node++) {
    const start = track.river.land.launch + node * RAIL_SWITCH_EVERY;
    if (start + RAIL_SWITCH_LENGTH > last) break;
    for (const [from, to] of [[-1, 0], [0, -1], [0, 1], [1, 0]]) {
      for (let u = 0; u < 1; u += 0.018) {
        const k = u * u * u * (u * (u * 6 - 15) + 10);
        const lat = (from + (to - from) * k) * RAIL_GAP;
        const s = start + u * RAIL_SWITCH_LENGTH;
        for (const side of [-1, 1]) brace.push([s, lat + side * WHEEL_X, (to - from) * 30 * u * u * (1 - u) * (1 - u) * RAIL_GAP / RAIL_SWITCH_LENGTH]);
      }
    }
  }
  const dummy = new THREE.Object3D();
  const instanced = (geometry, color, count) => {
    const mesh = new THREE.InstancedMesh(geometry, toon(color), count);
    mesh.frustumCulled = false;
    group.add(mesh);
    return mesh;
  };
  const sleeperMesh = instanced(new THREE.BoxGeometry(6.8, 0.28, 0.72), MINE_COLORS.sleeper, sleepers.length);
  sleepers.forEach(([x, y, z, yaw], k) => {
    dummy.position.set(x, y, z);
    dummy.rotation.set(0, yaw, 0);
    dummy.updateMatrix();
    sleeperMesh.setMatrixAt(k, dummy.matrix);
  });
  const railMesh = instanced(new THREE.BoxGeometry(0.26, 0.3, 1.6), MINE_COLORS.railSteel, rails.length + brace.length);
  rails.forEach(([x, y, z, yaw], k) => {
    dummy.position.set(x, y, z);
    dummy.rotation.set(0, yaw, 0);
    dummy.updateMatrix();
    railMesh.setMatrixAt(k, dummy.matrix);
  });
  brace.forEach(([s, lat, bend], k) => {
    const f = frameAt(track, s);
    dummy.position.set(f.x + f.nx * lat, f.y - 0.02, f.z + f.nz * lat);
    dummy.rotation.set(0, f.yaw + Math.atan(bend), 0);
    dummy.updateMatrix();
    railMesh.setMatrixAt(rails.length + k, dummy.matrix);
  });
}

function buildCaveMesh(group, track) {
  const { launch, span } = track.river.land;
  const { caveMid } = bars(track);
  const from = launch + 322;
  const to = launch + span - 82;
  const around = 34;
  const step = 3.2;
  const lanterns = [];
  for (let s = from + 18; s < to; s += LANTERN_STEP) lanterns.push(s);
  const dark = new THREE.Color(0x46352c);
  const mid = new THREE.Color(0x77573f);
  const gold = new THREE.Color(0xffc62e);
  const warm = new THREE.Color(0xffb060);
  const c = new THREE.Color();
  const pos = [];
  const col = [];
  const index = [];
  let rows = 0;
  for (let s = from; s <= to; s += step) {
    const f = frameAt(track, s);
    const open = caveOpen(caveMid, s);
    const w = WALL + open * 46;
    const h = ROOF + open * 24;
    const floor = f.y - 0.45 - open * 26;
    const near = Math.min(...lanterns.map((l) => Math.abs(l - s)));
    const lamp = 1 - wave(0, 11, near);
    for (let k = 0; k <= around; k++) {
      const a = (k / around) * Math.PI * 2;
      const bump = 1 + 0.13 * (noise(s * 0.23 + k * 3, k * 2.1) - 0.5) + 0.07 * Math.sin(s * 0.3 + k * 1.7);
      const across = Math.cos(a) * w * bump;
      const up = Math.sin(a) * h * bump;
      const x = f.x + f.nx * across;
      const z = f.z + f.nz * across;
      const y = Math.max(floor + (noise(x * 0.5, z * 0.5) - 0.5) * (1 + open * 5), f.y + 2 + up);
      pos.push(x, y, z);
      const vein = wave(0.65 - open * 0.13, 0.71 - open * 0.13, noise(x * 0.7 + s * 0.3, y * 0.9 - s * 0.4));
      c.copy(dark).lerp(mid, wave(0.42, 0.6, noise(x * 0.4, y * 0.6 + s * 0.2)));
      c.multiplyScalar(0.5 + open * 0.34 + lamp * 0.85);
      c.lerp(warm, lamp * 0.18);
      c.lerp(gold, vein * (0.74 + open * 0.26));
      col.push(c.r, c.g, c.b);
    }
    if (rows) {
      for (let k = 0; k < around; k++) {
        const a = (rows - 1) * (around + 1) + k;
        const b = a + around + 1;
        index.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
    rows++;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(index);
  const flat = g.toNonIndexed();
  flat.computeVertexNormals();
  const mesh = new THREE.Mesh(flat, toon(0xffffff, { vertexColors: true, side: THREE.DoubleSide }));
  mesh.frustumCulled = false;
  group.add(mesh);
  return lanterns;
}

function localBox(batch, key, f, lat, up, along, sx, sy, sz, rz = 0) {
  const c = Math.cos(f.yaw);
  const s = Math.sin(f.yaw);
  batch.add(key, BOX, mat(f.x + f.nx * lat + s * along, f.y + up, f.z + f.nz * lat + c * along, sx, sy, sz, 0, f.yaw, rz));
}

function lantern(batch, trim, f, lat, up) {
  trim.add('oreGlow', BOX, mat(f.x + f.nx * lat, f.y + up, f.z + f.nz * lat, 0.9, 1.2, 0.9, 0, f.yaw, 0));
  batch.add('timberDark', BOX, mat(f.x + f.nx * lat, f.y + up + 0.72, f.z + f.nz * lat, 1.1, 0.2, 1.1, 0, f.yaw, 0));
}

function dressMine(batch, trim, track, lanterns, rand) {
  const { caveMid, last } = bars(track);
  for (const s of lanterns) {
    const f = frameAt(track, s);
    const open = caveOpen(caveMid, s);
    if (open < 0.08) {
      for (const side of [-1, 1]) {
        localBox(batch, 'timber', f, side * 22.5, 7, 0, 1.2, 15, 1.2);
        localBox(batch, 'timberDark', f, side * 19.6, 12.2, 0, 0.5, 5.4, 0.5, side * 0.8);
        lantern(batch, trim, f, side * 18, 11.6);
      }
      localBox(batch, 'timber', f, 0, 14.4, 0, 46, 1.3, 1.3);
    } else {
      for (const lane of [-6, 6]) {
        localBox(batch, 'timber', f, lane, 3.6, 0, 0.42, 7.2, 0.42);
        localBox(batch, 'timberDark', f, lane + 0.8, 7.1, 0, 2, 0.26, 0.26);
        lantern(batch, trim, f, lane + 1.6, 6.3);
      }
    }
  }
  for (let s = caveMid - CAVE_LENGTH * 0.5; s < caveMid + CAVE_LENGTH * 0.5; s += 12) {
    const open = caveOpen(caveMid, s);
    if (open < 0.3) continue;
    const f = frameAt(track, s);
    const depth = 0.45 + open * 26;
    for (const side of [-1, 1]) {
      for (const lat of [14, 3.4]) localBox(batch, 'timber', f, side * (lat + 2) * 1, -depth / 2, 0, 0.6, depth, 0.6, side * -0.07);
    }
    for (const u of [0.32, 0.66]) localBox(batch, 'timberDark', f, 0, -depth * u, 0, 34, 0.3, 0.3);
    localBox(batch, 'timberDark', f, 0, -depth * 0.5, 0, 0.26, depth * 0.9, 0.26, 0.4 * ((Math.round(s) % 24) > 11 ? 1 : -1));
    localBox(batch, 'timberDark', f, 0, -0.52, 0, 36, 0.42, 3.2);
  }
  for (let k = 0; k < 150; k++) {
    const s = caveMid - CAVE_LENGTH * 0.5 + rand() * CAVE_LENGTH;
    const open = caveOpen(caveMid, s);
    if (open < 0.5) continue;
    const f = frameAt(track, s);
    const lat = (rand() < 0.5 ? -1 : 1) * (20 + rand() * 40);
    const size = 0.9 + rand() * 3;
    const y = f.y - 0.5 - open * 26;
    batch.add(k % 3 ? 'ore' : 'orePale', SPIKE, mat(f.x + f.nx * lat, y + size * 1.4, f.z + f.nz * lat, size * 0.55, size * 3.2, size * 0.55, (rand() - 0.5) * 0.7, rand() * 3, (rand() - 0.5) * 0.7));
  }
  for (let k = 0; k < 90; k++) {
    const s = bars(track).first + 240 + rand() * (last - bars(track).first - 300);
    if (caveOpen(caveMid, s) > 0.1) continue;
    const f = frameAt(track, s);
    const lat = (rand() < 0.5 ? -1 : 1) * (21.5 + rand() * 3);
    const size = 0.5 + rand() * 0.9;
    batch.add('ore', ROCK, mat(f.x + f.nx * lat, f.y + 1 + rand() * 9, f.z + f.nz * lat, size, size, size, rand() * 3, rand() * 3, 0));
  }
  for (let n = 1; ; n++) {
    const s = track.river.land.launch + n * RAIL_SWITCH_EVERY - 22;
    if (s < bars(track).first) continue;
    if (s > last - 40) break;
    const f = frameAt(track, s);
    for (const lat of [-RAIL_GAP / 2, RAIL_GAP / 2]) {
      localBox(batch, 'timberDark', f, lat, 1.6, 0, 0.3, 3.2, 0.3);
      lantern(batch, trim, f, lat, 3.4);
    }
  }
}

function buildCaveIn(batch, track, rand) {
  const { launch } = track.river.land;
  const level = track.baseLevel(launch);
  const across = track.halfWidth + 14;
  for (let k = 0; k < 90; k++) {
    const f = frameAt(track, launch + 40 + rand() * 48);
    const lat = (rand() * 2 - 1) * across;
    const size = 3 + rand() * 6.5;
    batch.add(k % 3 ? 'sandstone' : 'sandstoneDark', ROCK, mat(f.x + f.nx * lat, level + 2 + rand() * 5, f.z + f.nz * lat, size, size * 0.8, size, rand() * 3, rand() * 3, rand() * 3));
  }
  for (let k = 0; k < 16; k++) {
    const f = frameAt(track, launch + 32 + rand() * 46);
    const lat = (rand() * 2 - 1) * across * 0.8;
    batch.add(k % 2 ? 'timber' : 'timberDark', BOX, mat(f.x + f.nx * lat, level + 4 + rand() * 7, f.z + f.nz * lat, 1, 1, 15 + rand() * 9, rand() * 0.7, rand() * 3, rand() * 0.5));
  }
  for (let k = 0; k < 6; k++) {
    const f = frameAt(track, launch + 140 + k * 26);
    const side = k % 2 ? 1 : -1;
    const s = 1.6 + rand();
    localBox(batch, 'timber', f, side * 19, s + 0.2, 0, s * 2, s * 2, s * 2);
    if (k % 3 === 0) batch.add('dynamite', BOLT, mat(f.x + f.nx * side * 19.4, f.y + 1.2, f.z + f.nz * side * 19.4 + 3, 1.1, 2.4, 1.1));
  }
}

export function buildGoldMine(batch, trim, group, track, rand) {
  buildRails(group, track);
  const lanterns = buildCaveMesh(group, track);
  dressMine(batch, trim, track, lanterns, rand);
  buildCaveIn(batch, track, rand);
  const { caveMid } = bars(track);
  const mineFog = new THREE.Color(0x140d09);
  const caveFog = new THREE.Color(0x4a2f12);
  const mix = new THREE.Color();
  return {
    update(camera, surface, fog, day, sky) {
      const { s, dist } = surface.sample(camera.position.x, camera.position.z);
      const inside = track.inMine(s) && dist < WALL + 60;
      sky.visible = !inside;
      if (!inside) {
        fog.color.copy(day.color);
        fog.near = day.near;
        fog.far = day.far;
        return null;
      }
      const open = caveOpen(caveMid, s);
      mix.copy(mineFog).lerp(caveFog, open);
      fog.color.copy(mix);
      fog.near = 30 + open * 40;
      fog.far = 180 + open * 120;
      return mix;
    },
  };
}
