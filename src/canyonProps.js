import * as THREE from 'three';
import { toon, outlined } from './toon.js';
import { frame } from './alpine.js';
import { mat } from './world.js';

const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 12);
const CONE = new THREE.ConeGeometry(1, 1, 12);
const WHEEL = new THREE.CylinderGeometry(1, 1, 0.3, 14).rotateZ(Math.PI / 2);

export const PROP_COLORS = {
  plank: 0xb07a46,
  plankDark: 0x7e5230,
  plankLight: 0xcf9a62,
  roofTin: 0x8c8f94,
  trim: 0xf3e2c0,
  saloonRed: 0xb4442e,
  storeBlue: 0x5f7f9a,
  window: 0x2b3440,
  barrel: 0x8a5a32,
  hoop: 0x4a4d52,
  iron: 0x34373c,
  ironLight: 0x5a5e64,
  ore: 0x7a6a5a,
  gold: 0xffc93c,
  rail: 0x4a4d52,
  sleeper: 0x6e4a2a,
};

function signTexture(text, background, color) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = background;
  g.fillRect(0, 0, 512, 128);
  g.strokeStyle = '#3a2414';
  g.lineWidth = 10;
  g.strokeRect(5, 5, 502, 118);
  g.fillStyle = color;
  g.font = '900 86px "Saira Condensed", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 256, 70);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function sign(text, width, height, background = '#e9cf9a', color = '#5a2a14') {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), toon(0xffffff, { map: signTexture(text, background, color), side: THREE.DoubleSide }));
  return mesh;
}

function building(put, lx, lz, w, d, h, color, front) {
  put(color, BOX, lx, h / 2, lz, w, h, d);
  put('roofTin', BOX, lx, h + 0.15, lz - 0.5, w + 0.6, 0.3, d + 1);
  put(color, BOX, lx, h + front / 2, lz + d / 2 - 0.15, w, front, 0.3);
  put('trim', BOX, lx, h + front + 0.15, lz + d / 2 - 0.15, w + 0.4, 0.3, 0.5);
  put('trim', BOX, lx, h, lz + d / 2 - 0.1, w + 0.2, 0.25, 0.4);
  for (const k of [-1, 1]) put('window', BOX, lx + k * w * 0.27, h * 0.55, lz + d / 2 + 0.02, w * 0.2, h * 0.32, 0.1);
  put('plankDark', BOX, lx, h * 0.32, lz + d / 2 + 0.02, w * 0.18, h * 0.62, 0.12);
  put('plank', BOX, lx, h * 0.92, lz + d / 2 + 1.6, w, 0.25, 3.4);
  for (const k of [-0.46, 0, 0.46]) put('plankDark', CYL, lx + k * w, h * 0.46, lz + d / 2 + 3.1, 0.18, h * 0.92, 0.18);
}

export function town(batch, x, y, z, yaw) {
  const put = frame(batch, x, y, z, yaw, 0, 0, 1);
  put('plank', BOX, 0, 0.25, 4.8, 30, 0.5, 3.6);
  building(put, -9, 0, 9, 8, 6.5, 'saloonRed', 3.2);
  building(put, 1.5, 0, 8, 7, 5.5, 'storeBlue', 2.4);
  building(put, 10.5, 0.5, 7, 6, 5, 'plank', 2);
  for (let k = 0; k < 6; k++) {
    const bx = -13 + k * 1.3;
    put('barrel', CYL, bx, 0.95, 6.4, 0.55, 1.1, 0.55);
    put('hoop', CYL, bx, 0.75, 6.4, 0.58, 0.08, 0.58);
    put('hoop', CYL, bx, 1.2, 6.4, 0.58, 0.08, 0.58);
  }
  for (const k of [-4, 7]) {
    put('plankDark', BOX, k, 0.9, 7.4, 0.2, 1.3, 0.2);
    put('plankDark', BOX, k + 1.6, 0.9, 7.4, 0.2, 1.3, 0.2);
    put('plank', BOX, k + 0.8, 1.45, 7.4, 2, 0.16, 0.16);
  }
  return [
    { text: 'SALOON', lx: -9, ly: 8.3, lz: 4.03, w: 7, h: 1.8 },
    { text: 'GENERAL STORE', lx: 1.5, ly: 6.9, lz: 3.53, w: 7, h: 1.4 },
  ].map((s) => ({ ...s, x, y, z, yaw }));
}

export function waterTower(batch, x, y, z) {
  const put = frame(batch, x, y, z, 0.4, 0, 0, 1);
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) put('plankDark', BOX, a * 2.2, 4.5, b * 2.2, 0.45, 9, 0.45);
  for (const h of [3, 6.5]) {
    put('plankDark', BOX, 0, h, 2.2, 4.8, 0.25, 0.25);
    put('plankDark', BOX, 0, h, -2.2, 4.8, 0.25, 0.25);
    put('plankDark', BOX, 2.2, h, 0, 0.25, 0.25, 4.8);
    put('plankDark', BOX, -2.2, h, 0, 0.25, 0.25, 4.8);
  }
  put('plank', CYL, 0, 11.5, 0, 3.2, 5, 3.2);
  for (const h of [9.6, 11.5, 13.4]) put('hoop', CYL, 0, h, 0, 3.26, 0.2, 3.26);
  put('roofTin', CONE, 0, 15, 0, 3.6, 2.2, 3.6);
  put('iron', CYL, 2.2, 7.5, 2.6, 0.22, 4, 0.22, 0.5, 0, 0);
}

export function oreCart(batch, x, y, z, yaw) {
  const put = frame(batch, x, y, z, yaw, 0, 0, 1);
  put('iron', BOX, 0, 1.4, 0, 2, 1.2, 3);
  put('ironLight', BOX, 0, 2.05, 0, 2.2, 0.15, 3.2);
  put('ore', BOX, 0, 2.15, 0, 1.7, 0.4, 2.6);
  for (let k = 0; k < 5; k++) put('gold', BOX, (k % 2 - 0.5) * 0.9, 2.45, (k - 2) * 0.5, 0.35, 0.3, 0.35);
  for (const a of [-1, 1]) for (const b of [-1, 1]) put('iron', WHEEL, a * 0.95, 0.55, b * 0.95, 0.5, 1, 0.5);
}

export function rails(batch, from, to, y0, y1) {
  const len = Math.hypot(to.x - from.x, to.z - from.z);
  const yaw = Math.atan2(to.x - from.x, to.z - from.z);
  const steps = Math.max(1, Math.round(len / 1.4));
  for (let k = 0; k <= steps; k++) {
    const u = k / steps;
    batch.add('sleeper', BOX, mat(from.x + (to.x - from.x) * u, y0 + (y1 - y0) * u + 0.1, from.z + (to.z - from.z) * u, 3, 0.2, 0.5, 0, yaw, 0));
  }
  for (const side of [-1, 1]) {
    const ox = Math.cos(yaw) * side * 0.75;
    const oz = -Math.sin(yaw) * side * 0.75;
    const pitch = Math.atan2(y1 - y0, len);
    batch.add('rail', BOX, mat((from.x + to.x) / 2 + ox, (y0 + y1) / 2 + 0.3, (from.z + to.z) / 2 + oz, 0.18, 0.18, Math.hypot(len, y1 - y0), -pitch, yaw, 0));
  }
}

export function trestle(batch, a, b, deck, ground, clear) {
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  const yaw = Math.atan2(b.x - a.x, b.z - a.z);
  const dir = { x: (b.x - a.x) / len, z: (b.z - a.z) / len };
  const side = { x: dir.z, z: -dir.x };
  const at = (u, s = 0) => ({ x: a.x + dir.x * u + side.x * s, z: a.z + dir.z * u + side.z * s });
  batch.add('plank', BOX, mat((a.x + b.x) / 2, deck - 0.5, (a.z + b.z) / 2, 5, 1, len, 0, yaw, 0));
  rails(batch, a, b, deck, deck);
  for (const s of [-2.4, 2.4]) {
    const p = at(len / 2, s);
    batch.add('plankDark', BOX, mat(p.x, deck + 0.8, p.z, 0.2, 0.8, len, 0, yaw, 0));
  }
  for (let u = 4; u < len - 2; u += 7) {
    const mid = at(u);
    const g = ground(mid.x, mid.z);
    if (clear(mid.x, mid.z)) {
      for (const s of [-2.6, 2.6]) {
        const p = at(u, s);
        batch.add('plankDark', BOX, mat(p.x, deck - 3, p.z, 0.4, 5, 0.4));
      }
      const p = at(u);
      batch.add('plankDark', BOX, mat(p.x, deck - 5.5, p.z, 5.6, 0.4, 0.4, 0, yaw, 0));
      continue;
    }
    const h = deck - g;
    if (h < 1) continue;
    for (const s of [-2.8, 2.8]) {
      const p = at(u, s);
      batch.add('plankDark', BOX, mat(p.x, g + h / 2 - 0.5, p.z, 0.5, h, 0.5, 0, yaw, s > 0 ? -0.06 : 0.06));
    }
    for (let y = g + 4; y < deck - 1; y += 5) {
      const p = at(u);
      batch.add('plank', BOX, mat(p.x, y, p.z, 6, 0.3, 0.3, 0, yaw, 0));
      batch.add('plankDark', BOX, mat(p.x, y + 2.5, p.z, 0.25, 0.25, 7.2, 0.7, yaw + Math.PI / 2, 0));
    }
  }
}

function car(kind) {
  const g = new THREE.Group();
  const add = (geometry, color, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) => {
    const mesh = outlined(geometry, toon(color), 0.05);
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    mesh.rotation.set(rx, ry, rz);
    g.add(mesh);
    return mesh;
  };
  const wheels = [];
  if (kind === 'engine') {
    add(CYL, 0x2f3338, 0, 2.6, 0.8, 1.2, 4.6, 1.2, Math.PI / 2, 0, 0);
    add(CYL, 0xc4553a, 0, 2.6, 0.8, 1.26, 0.3, 1.26, Math.PI / 2, 0, 0).position.z = 2.2;
    add(CONE, 0x2f3338, 0, 4.9, 2.4, 0.6, 1.6, 0.6, Math.PI, 0, 0);
    add(CYL, 0x2f3338, 0, 4.1, 2.4, 0.35, 1.2, 0.35);
    add(BOX, 0xc4553a, 0, 3.1, -2.1, 2.6, 3, 2.4);
    add(BOX, 0x2f3338, 0, 4.75, -2.1, 3, 0.3, 2.8);
    add(CONE, 0xb3b6ba, 0, 1.2, 3.6, 1.3, 1.4, 1.3, -Math.PI / 2, 0, 0).scale.set(1.3, 1.4, 0.7);
    add(BOX, 0xffc93c, 0, 3, 3.3, 0.5, 0.5, 0.3);
  } else {
    add(BOX, kind === 'coach' ? 0xb4442e : 0x7a4a26, 0, 2.6, 0, 2.6, 2.4, 6);
    add(BOX, 0x2f3338, 0, 3.95, 0, 2.9, 0.3, 6.3);
    if (kind === 'coach') for (let k = -2; k <= 2; k++) for (const s of [-1, 1]) add(BOX, 0xf3e2c0, s * 1.31, 2.9, k * 1.1, 0.05, 0.8, 0.7);
  }
  add(BOX, 0x2f3338, 0, 1.15, 0, 2.2, 0.4, kind === 'engine' ? 7 : 6);
  for (const z of kind === 'engine' ? [-2.4, -0.8, 0.8, 2.4] : [-2, 2]) {
    for (const s of [-1, 1]) {
      const w = add(WHEEL, 0x34373c, s * 1.05, 0.85, z, kind === 'engine' && Math.abs(z) < 1 ? 0.85 : 0.6, 1, kind === 'engine' && Math.abs(z) < 1 ? 0.85 : 0.6);
      wheels.push(w);
    }
  }
  g.userData.wheels = wheels;
  return g;
}

export function train(group, a, b, deck, fx) {
  const cars = ['engine', 'coach', 'coach', 'box'].map((kind) => {
    const c = car(kind);
    group.add(c);
    return c;
  });
  const gaps = [0, 7.6, 14.6, 21.6];
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  const dir = new THREE.Vector3(b.x - a.x, 0, b.z - a.z).normalize();
  const yaw = Math.atan2(dir.x, dir.z);
  const speed = 16;
  const cycle = (len + 60) / speed + 6;
  const stack = new THREE.Vector3();
  let puff = 0;
  return (t, dt) => {
    const u = (t % cycle) * speed - 30;
    cars.forEach((c, k) => {
      const at = u - gaps[k];
      c.visible = at > -2 && at < len + 2;
      c.position.set(a.x + dir.x * at, deck, a.z + dir.z * at);
      c.rotation.y = yaw;
      for (const w of c.userData.wheels) w.rotation.x = -at / 0.7;
    });
    if (!cars[0].visible) return;
    puff -= dt;
    if (puff <= 0) {
      puff = 0.12;
      stack.set(0, 5.6, 2.4).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw).add(cars[0].position);
      fx.puffs.emit(stack.x, stack.y, stack.z, -dir.x * 3 + (Math.random() - 0.5), 3 + Math.random() * 2, -dir.z * 3 + (Math.random() - 0.5), 1.2 + Math.random() * 0.8, 2.2, Math.random() < 0.5 ? 0xf2efe8 : 0xd8d3ca, -0.3, 0.6, 0);
    }
  };
}
