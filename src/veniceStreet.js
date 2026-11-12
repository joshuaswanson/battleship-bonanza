import * as THREE from 'three';
import { toon } from './toon.js';
import { mat } from './world.js';
import { building, streetLamp } from './veniceDetail.js';

export const STREET_COLORS = {
  awningRed: 0xd8423c,
  awningGreen: 0x2f8f6a,
  awningCream: 0xf4e3b8,
  potClay: 0xb5623e,
  leafLime: 0x9ad84a,
  leafGreen: 0x6cc24a,
  cafeTable: 0xf6f1e6,
  cafeChair: 0x3f7a55,
  crate: 0xb98a55,
  orange: 0xff9a2e,
  lemon: 0xffd94a,
  tomato: 0xe2452f,
  bridgeStone: 0xe4dac6,
  bridgeDark: 0xc9bca4,
};

const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 10);
const CLUMP = new THREE.DodecahedronGeometry(1, 0);
const SIDEWALK = 4.4;
const KERB = 2.8;
const FLIGHT = 230;
const BRIDGE = 134;
const LINE_HEIGHT = 15;
const FACADES = ['terracotta', 'ochre', 'pink', 'salmon', 'cream', 'rose', 'butter', 'brick', 'sage'];
const AWNINGS = ['awningRed', 'awningGreen', 'awningCream'];
const CLOTHS = ['clothA', 'clothB', 'clothC', 'clothD'];
const FRUIT = ['orange', 'lemon', 'tomato'];

function cobbles() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const c = canvas.getContext('2d');
  c.fillStyle = '#c9bca4';
  c.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 4; x++) {
    c.fillStyle = ['#d9ccb0', '#cfc0a2', '#d3c5a8'][(x + y * 3) % 3];
    c.fillRect(x * 64 + (y % 2) * 32 + 2, y * 32 + 2, 60, 28);
    if (y % 2) c.fillRect(x * 64 - 32 + 2, y * 32 + 2, 28, 28);
  }
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(4, 1);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function ribbon(track, from, to, step, across, y) {
  const pos = [];
  const uv = [];
  const index = [];
  let rows = 0;
  for (let s = from; s <= to; s += step) {
    const i = track.wrap(Math.round(s / track.spacing));
    across.forEach((lat, k) => {
      const p = track.point(i, lat(i));
      pos.push(p.x, y(s, k), p.z);
      uv.push(k / (across.length - 1), (s - from) / 12);
    });
    rows++;
  }
  const cols = across.length;
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const a = r * cols + c;
      index.push(a, a + 1, a + cols, a + 1, a + cols + 1, a + cols);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

function clump(batch, x, y, z, size, rand) {
  for (let k = 0; k < 3; k++) {
    const a = rand() * Math.PI * 2;
    batch.add(k % 2 ? 'leafLime' : 'leafGreen', CLUMP, mat(x + Math.cos(a) * size * 0.35, y + size * (0.5 + k * 0.28), z + Math.sin(a) * size * 0.35, size * (0.75 - k * 0.12), size * (0.7 - k * 0.1), size * (0.75 - k * 0.12), rand(), rand() * 6, rand()));
  }
}

function planter(batch, x, y, z, rand) {
  batch.add('potClay', CYL, mat(x, y + 0.45, z, 0.55, 0.9, 0.55));
  clump(batch, x, y + 0.8, z, 0.95, rand);
}

function cafe(batch, x, y, z, yaw) {
  batch.add('cafeTable', CYL, mat(x, y + 0.78, z, 0.55, 0.07, 0.55));
  batch.add('cafeTable', CYL, mat(x, y + 0.4, z, 0.06, 0.8, 0.06));
  for (const side of [-1, 1]) {
    const cx = x + Math.sin(yaw) * side * 0.95;
    const cz = z + Math.cos(yaw) * side * 0.95;
    batch.add('cafeChair', BOX, mat(cx, y + 0.45, cz, 0.42, 0.06, 0.42, 0, yaw, 0));
    batch.add('cafeChair', BOX, mat(cx + Math.sin(yaw) * side * 0.2, y + 0.75, cz + Math.cos(yaw) * side * 0.2, 0.42, 0.6, 0.05, 0, yaw, 0));
    batch.add('cafeChair', BOX, mat(cx, y + 0.22, cz, 0.36, 0.44, 0.36, 0, yaw, 0));
  }
}

function stall(batch, x, y, z, yaw, rand) {
  const awning = AWNINGS[Math.floor(rand() * AWNINGS.length)];
  batch.add('crate', BOX, mat(x, y + 0.45, z, 0.9, 0.9, 2.6, 0, yaw, 0));
  batch.add(awning, BOX, mat(x, y + 2.5, z, 1.5, 0.12, 3, 0, yaw, 0.22));
  for (const end of [-1, 1]) {
    batch.add('crate', CYL, mat(x + Math.sin(yaw) * end * 1.35, y + 1.25, z + Math.cos(yaw) * end * 1.35, 0.05, 2.5, 0.05));
  }
  for (let k = 0; k < 3; k++) {
    const u = (k - 1) * 0.8;
    batch.add(FRUIT[(k + Math.floor(rand() * 3)) % 3], BOX, mat(x + Math.sin(yaw) * u, y + 1.0, z + Math.cos(yaw) * u, 0.7, 0.22, 0.66, 0, yaw, 0));
  }
}

export async function buildStreet({ group, batch, windows, track, rand, tick, taken, dry, top }) {
  const { launch, span } = track.river.land;
  const level = (s) => track.level(s);
  const hw = (i) => track.hw[i];
  const at = (s) => track.wrap(Math.round(s / track.spacing));
  const paving = toon(0xffffff, { map: cobbles(), side: THREE.DoubleSide });
  group.add(new THREE.Mesh(ribbon(track, launch + 6, launch + span, 3, [(i) => -(hw(i) + SIDEWALK + 0.6), (i) => hw(i) + SIDEWALK + 0.6], (s) => level(s) + 0.03), paving));
  await tick();

  for (let k = 0; k < 9; k++) {
    const s = launch - 1 + k * 2.6;
    const i = at(s);
    const c = track.point(i, 0);
    const y = -1.3 + k * 0.34;
    batch.add(k % 2 ? 'bridgeStone' : 'bridgeDark', BOX, mat(c.x, y - 1.5, c.z, hw(i) * 2 + 8, 3, 2.7, 0, track.heading(i), 0));
  }

  const clearOfCourse = (x, z, reach) => {
    const near = track.project(x, z);
    return near.distance > track.hw[near.idx] + reach;
  };
  let lot = 0;
  for (const side of [-1, 1]) {
    for (let d = 22; d < span - 8;) {
      const w = 9 + rand() * 6.7;
      const s = launch + d + w / 2;
      d += w + 0.4;
      const i = at(s);
      const deep = 12.3 + rand() * 7.8;
      const tall = 12.3 + rand() * 14.5;
      const front = hw(i) + SIDEWALK;
      const c = track.point(i, side * (front + deep / 2));
      const base = Math.max(top, level(s) - 0.2);
      if (!dry(c.x, c.z) || !clearOfCourse(c.x, c.z, SIDEWALK + deep / 2 - 1.5)) continue;
      const yaw = Math.atan2(-side * track.nx[i], -side * track.nz[i]);
      const rising = d > span - BRIDGE - 20;
      if (!rising) building(batch, windows, c.x, c.z, yaw, w, deep, tall, rand, { color: FACADES[Math.floor(rand() * FACADES.length)], base });
      taken.push({ x: c.x, z: c.z, r: Math.max(w, deep) / 2 });
      if (rising) continue;
      const kerb = track.point(i, side * (hw(i) + KERB));
      const heading = track.heading(i);
      const pick = lot++ % 5;
      if (pick === 0) {
        const p = track.point(i, side * (front - 1.25));
        batch.add(AWNINGS[Math.floor(rand() * AWNINGS.length)], BOX, mat(p.x, base + 4.3, p.z, 2.4, 0.14, w - 2.5, 0, heading, side * 0.3));
      } else if (pick === 1) {
        cafe(batch, kerb.x, base + 0.05, kerb.z, heading);
      } else if (pick === 2) {
        planter(batch, kerb.x, base + 0.05, kerb.z, rand);
        const next = track.point(at(s + 3.2), side * (hw(i) + KERB));
        planter(batch, next.x, base + 0.05, next.z, rand);
      } else if (pick === 3 && rand() < 0.6) {
        stall(batch, kerb.x, base + 0.05, kerb.z, heading, rand);
      } else if (pick === 4) {
        streetLamp(batch, kerb.x, base, kerb.z);
      }
    }
    await tick();
  }

  for (let d = FLIGHT + 70; d < span - BRIDGE - 120; d += 85) {
    const s = launch + d;
    const i = at(s);
    const a = track.point(i, -(hw(i) + SIDEWALK));
    const b = track.point(i, hw(i) + SIDEWALK);
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const yaw = Math.atan2(b.x - a.x, b.z - a.z);
    const y = level(s) + LINE_HEIGHT;
    batch.add('rope', BOX, mat((a.x + b.x) / 2, y, (a.z + b.z) / 2, 0.09, 0.09, len, 0, yaw, 0));
    for (let c = 0; c < 9; c++) {
      const u = 0.1 + (c / 8) * 0.8 + (rand() - 0.5) * 0.04;
      batch.add(CLOTHS[Math.floor(rand() * CLOTHS.length)], BOX, mat(a.x + (b.x - a.x) * u, y - 1.0, a.z + (b.z - a.z) * u, 1.46, 1.79, 0.11, 0, yaw + Math.PI / 2, 0));
    }
  }

  const from = launch + span - BRIDGE;
  const stone = toon(STREET_COLORS.bridgeStone, { side: THREE.DoubleSide });
  for (const side of [-1, 1]) {
    group.add(new THREE.Mesh(ribbon(track, from, launch + span, 4, [(i) => side * (hw(i) + SIDEWALK + 0.6), (i) => side * (hw(i) + SIDEWALK + 0.6)], (s, k) => (k ? level(s) + 1.5 : top - 1)), stone));
    for (let s = from + 6; s < launch + span - 4; s += 9) {
      const i = at(s);
      const p = track.point(i, side * (hw(i) + SIDEWALK + 0.6));
      batch.add('bridgeDark', BOX, mat(p.x, level(s) + 1.7, p.z, 0.9, 0.5, 1.4, 0, track.heading(i), 0));
    }
  }
  {
    const s = launch + span;
    const i = at(s);
    const c = track.point(i, 0);
    for (const side of [-1, 1]) {
      const p = track.point(i, side * (hw(i) + SIDEWALK - 0.4));
      batch.add('bridgeStone', BOX, mat(p.x, level(s - 2) - 2.6, p.z, 3.2, level(s - 2) + 6, 3.4, 0, track.heading(i), 0));
      batch.add('bridgeDark', BOX, mat(p.x, level(s - 2) + 1.2, p.z, 3.8, 0.6, 4, 0, track.heading(i), 0));
    }
    const face = track.point(at(s + 1.5), 0);
    batch.add('bridgeDark', BOX, mat(face.x, (level(s - 3) - 6) / 2, face.z, hw(i) * 2 + 16, level(s - 3) + 6, 5, 0, track.heading(i), 0));
  }
  await tick();
}
