import * as THREE from 'three';
import { Batcher, COLORS } from './world.js';
import { frame, pick, STONES } from './alpine.js';
import { swissFlag, flagCloth } from './terrain.js';

export const LANDMARK_COLORS = {
  castleWall: 0xebe3d1,
  castleTrim: 0xd3c9b5,
  castleBase: 0xa79e91,
  castleDark: 0x8c8478,
  tile: 0xb8462f,
  tileDark: 0x8f3524,
  tileLight: 0xcc5a3d,
  timber: 0x8a5a33,
  timberDark: 0x5a3a22,
  iron: 0x2b2f36,
  glass: 0x24324a,
  gateWood: 0x4a3222,
  gold: 0xffd23f,
  shieldRed: 0xe5332a,
  shieldWhite: 0xffffff,
  masonry: 0xcbc1b0,
  masonryDark: 0x9b9284,
  masonryLight: 0xe0d8c9,
  shingle: 0x7a4b32,
  shingleDark: 0x553521,
  geranium: 0xe8344a,
  geraniumPink: 0xff6f9a,
  geraniumLeaf: 0x3f8f3f,
  panel: 0xf1e3c4,
  panelRed: 0xb03a2e,
  lampGlow: 0xffe9a0,
  hullWhite: 0xfbfbf7,
  hullRed: 0xc0392b,
  navy: 0x1f2f4a,
  teak: 0xa8703f,
  deck: 0xdcb88c,
  cream: 0xf4ead2,
  funnel: 0xf2c14e,
  soot: 0x1d1d1d,
  brass: 0xd9a93a,
  canvasRed: 0xd8443a,
  canvasWhite: 0xfaf6ee,
  rock0: 0x8a857e,
  rock1: 0x9d978e,
  rock2: 0xb1aca3,
  rope: 0xe8d6a8,
  crate: 0xd59b5b,
  crateDark: 0x9c6436,
  plankPale: 0xc89a66,
  nail: 0x4a4038,
  chaletPlaster: 0xf7f2e6,
  chaletWood: 0x9b5f32,
  chaletWoodRed: 0x8a4a2a,
  chaletWoodGold: 0xb07440,
  logLine: 0x4a2c18,
  slate: 0x5c6168,
  shutterGreen: 0x3f8f5a,
  shutterRed: 0xc0392b,
  shutterWhite: 0xf7f2e6,
  firewood: 0xb07a48,
  firewoodEnd: 0xe0b77e,
  inscription: 0xfaf3e0,
};

const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 24);
const OCT = new THREE.CylinderGeometry(1, 1, 1, 8).rotateY(Math.PI / 8);
const CONE = new THREE.ConeGeometry(1, 1, 24);
const OCT_SPIRE = new THREE.ConeGeometry(1, 1, 8).rotateY(Math.PI / 8);
const PYRAMID = new THREE.ConeGeometry(Math.SQRT2 / 2, 1, 4).rotateY(Math.PI / 4);
const BALL = new THREE.SphereGeometry(1, 14, 10);
const TORUS = new THREE.TorusGeometry(1, 0.3, 8, 18);
const ARCH = new THREE.CylinderGeometry(1, 1, 1, 14, 1, false, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2);
const HALF_DRUM = new THREE.CylinderGeometry(1, 1, 1, 32, 1, false, 0, Math.PI).rotateZ(Math.PI / 2);
const BATTER = new THREE.CylinderGeometry(1, 1.18, 1, 24);
const OCT_BATTER = new THREE.CylinderGeometry(1, 1.12, 1, 8).rotateY(Math.PI / 8);
const roofShape = new THREE.Shape([new THREE.Vector2(-1, 0), new THREE.Vector2(1, 0), new THREE.Vector2(0, 1)]);
const ROOF = new THREE.ExtrudeGeometry(roofShape, { depth: 1, bevelEnabled: false }).translate(0, 0, -0.5);

function archWindow(put, x, y, z, w, h, ry, glass = 'glass', frame = 'castleTrim') {
  const dx = Math.sin(ry) * 0.05;
  const dz = Math.cos(ry) * 0.05;
  put(frame, BOX, x - dx, y, z - dz, w + 0.3, h + 0.2, 0.2, 0, ry);
  put(frame, ARCH, x - dx, y + h / 2, z - dz, w / 2 + 0.15, w / 2 + 0.15, 0.2, 0, ry);
  put(glass, BOX, x, y, z, w, h, 0.2, 0, ry);
  put(glass, ARCH, x, y + h / 2, z, w / 2, w / 2, 0.2, 0, ry);
  put(frame, BOX, x + dx * 4, y - h / 2 - 0.12, z + dz * 4, w + 0.5, 0.18, 0.45, 0, ry);
}

function roundTower(put, x, z, r, h, rand, flags) {
  put('castleBase', BATTER, x, 1.6, z, r, 3.2, r);
  put('castleWall', CYL, x, h / 2 + 1, z, r, h, r);
  for (const y of [h * 0.42, h - 1.2]) put('castleTrim', CYL, x, y, z, r * 1.04, 0.3, r * 1.04);
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    put('castleTrim', BOX, x + Math.sin(a) * r * 1.03, h - 0.3, z + Math.cos(a) * r * 1.03, 0.45, 0.7, 0.45, 0, a);
  }
  put('castleWall', CYL, x, h + 0.6, z, r * 1.1, 1.2, r * 1.1);
  put('tileDark', CYL, x, h + 1.3, z, r * 1.32, 0.3, r * 1.32);
  const roofH = r * (2.6 + rand() * 0.8);
  put('tile', CONE, x, h + 1.4 + roofH / 2, z, r * 1.3, roofH, r * 1.3);
  const dormer = rand() * Math.PI * 2;
  put('castleWall', BOX, x + Math.sin(dormer) * r * 0.8, h + 2.6, z + Math.cos(dormer) * r * 0.8, 1, 1.1, 0.9, 0, dormer);
  put('tileDark', ROOF, x + Math.sin(dormer) * r * 0.8, h + 3.15, z + Math.cos(dormer) * r * 0.8, 0.7, 0.6, 1.1, 0, dormer);
  put('glass', BOX, x + Math.sin(dormer) * (r * 0.8 + 0.46), h + 2.6, z + Math.cos(dormer) * (r * 0.8 + 0.46), 0.45, 0.6, 0.05, 0, dormer);
  put('iron', CYL, x, h + 1.4 + roofH + 0.9, z, 0.06, 1.8, 0.06);
  put('gold', BALL, x, h + 1.4 + roofH + 0.2, z, 0.22, 0.22, 0.22);
  flags.push({ x, y: h + 1.4 + roofH + 1.6, z });
  const count = 3 + Math.floor(rand() * 3);
  for (let k = 0; k < count; k++) {
    const a = rand() * Math.PI * 2;
    const y = 4 + rand() * (h - 7);
    archWindow(put, x + Math.sin(a) * (r + 0.02), y, z + Math.cos(a) * (r + 0.02), 0.45, 1.3, a);
  }
}

function wall(put, a, b, h, center) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len = Math.hypot(dx, dz);
  const ang = Math.atan2(dx, dz);
  const mx = (a.x + b.x) / 2;
  const mz = (a.z + b.z) / 2;
  let nx = dz / len;
  let nz = -dx / len;
  if (nx * (mx - center.x) + nz * (mz - center.z) < 0) {
    nx = -nx;
    nz = -nz;
  }
  put('castleBase', BOX, mx, 1.6, mz, 2.4, 3.2, len, 0, ang);
  put('castleWall', BOX, mx, 1.6 + h / 2, mz, 1.5, h, len, 0, ang);
  put('castleTrim', BOX, mx, 1.6 + h * 0.6, mz, 1.68, 0.28, len, 0, ang);
  put('castleTrim', BOX, mx, 1.6 + h, mz, 1.8, 0.3, len, 0, ang);
  const merlons = Math.floor(len / 1.4);
  for (let i = 0; i < merlons; i += 2) {
    const u = (i + 0.5) / merlons;
    put('castleWall', BOX, a.x + dx * u, 2.35 + h, a.z + dz * u, 1.5, 1.2, 0.8, 0, ang);
  }
  for (let d = 2; d < len - 1.5; d += 3.4) {
    const u = d / len;
    put('glass', BOX, a.x + dx * u + nx * 0.76, 1.6 + h * 0.4, a.z + dz * u + nz * 0.76, 0.06, 1.3, 0.22, 0, ang);
  }
  put('tileDark', BOX, mx - nx * 1.4, 1.9 + h, mz - nz * 1.4, 1.6, 0.18, len, 0, ang, Math.atan2(1, 3) * (nx * Math.cos(ang) - nz * Math.sin(ang) > 0 ? 1 : -1));
  for (let d = 1; d < len; d += 2.4) {
    const u = d / len;
    put('timberDark', BOX, a.x + dx * u - nx * 2, 0.9 + h, a.z + dz * u - nz * 2, 0.18, 2, 0.18, 0, ang);
  }
}

function keep(put, x, z, w, h, rand) {
  put('castleBase', BOX, x, 1.6, z, w + 1.2, 3.2, w + 1.2);
  put('castleWall', BOX, x, h / 2 + 1, z, w, h, w);
  for (const y of [h * 0.35, h * 0.68]) put('castleTrim', BOX, x, y, z, w + 0.25, 0.3, w + 0.25);
  for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    for (let y = 3.6, k = 0; y < h; y += 1.3, k++) {
      const long = k % 2 === 0;
      put('castleTrim', BOX, x + cx * (w / 2 - (long ? 0.55 : 0.35)), y, z + cz * (w / 2 - (long ? 0.35 : 0.55)), long ? 1.2 : 0.8, 0.6, long ? 0.8 : 1.2);
    }
  }
  for (let face = 0; face < 4; face++) {
    const ry = (face * Math.PI) / 2;
    const fx = Math.sin(ry);
    const fz = Math.cos(ry);
    const side = (u) => [x + fx * (w / 2 + 0.02) + fz * u, z + fz * (w / 2 + 0.02) - fx * u];
    for (const [u, y, ww, hh] of [[-1.8, 8, 0.6, 1.6], [1.8, 8, 0.6, 1.6], [-1.6, h * 0.55, 0.9, 2.2], [1.6, h * 0.55, 0.9, 2.2], [-0.7, h * 0.82, 0.7, 1.8], [0.7, h * 0.82, 0.7, 1.8]]) {
      if (rand() < 0.15) continue;
      const [wx, wz] = side(u);
      archWindow(put, wx, y, wz, ww, hh, ry);
    }
  }
  const top = h + 1;
  put('timber', BOX, x, top + 1.5, z, w + 1.4, 3, w + 1.4);
  put('timberDark', BOX, x, top, z, w + 1.6, 0.3, w + 1.6);
  for (let face = 0; face < 4; face++) {
    const ry = (face * Math.PI) / 2;
    const fx = Math.sin(ry);
    const fz = Math.cos(ry);
    for (let u = -w / 2; u <= w / 2 + 0.01; u += 1.4) {
      put('timberDark', BOX, x + fx * (w / 2 + 0.72) + fz * u, top + 1.5, z + fz * (w / 2 + 0.72) - fx * u, 0.22, 3, 0.22, 0, ry);
    }
    for (const u of [-2.4, 0, 2.4]) put('glass', BOX, x + fx * (w / 2 + 0.73) + fz * u, top + 1.8, z + fz * (w / 2 + 0.73) - fx * u, 0.8, 0.9, 0.1, 0, ry);
  }
  put('tileDark', BOX, x, top + 3.15, z, w + 2.4, 0.3, w + 2.4);
  const roofH = 9 + rand() * 2;
  put('tile', PYRAMID, x, top + 3.3 + roofH / 2, z, w + 2.3, roofH, w + 2.3);
  for (const ry of [0, Math.PI]) {
    const fx = Math.sin(ry);
    const fz = Math.cos(ry);
    put('castleWall', BOX, x + fx * (w / 2 - 0.6), top + 4.8, z + fz * (w / 2 - 0.6), 1.6, 1.6, 1.2, 0, ry);
    put('tileDark', ROOF, x + fx * (w / 2 - 0.6), top + 5.6, z + fz * (w / 2 - 0.6), 1.1, 0.9, 1.6, 0, ry);
    put('glass', BOX, x + fx * (w / 2 + 0.02), top + 4.8, z + fz * (w / 2 + 0.02), 0.7, 0.9, 0.05, 0, ry);
  }
  put('iron', CYL, x, top + 3.3 + roofH + 0.8, z, 0.07, 1.6, 0.07);
  put('gold', BALL, x, top + 3.3 + roofH + 0.1, z, 0.3, 0.3, 0.3);
  return top + 3.3 + roofH;
}

function hall(put, x, z, w, d, h, ry, rand) {
  const fx = Math.sin(ry);
  const fz = Math.cos(ry);
  put('castleBase', BOX, x, 1.6, z, w + 0.6, 3.2, d + 0.6, 0, ry);
  put('castleWall', BOX, x, h / 2 + 1, z, w, h, d, 0, ry);
  put('castleTrim', BOX, x, h + 1, z, w + 0.4, 0.35, d + 0.4, 0, ry);
  put('tile', ROOF, x, h + 1.1, z, w / 2 + 0.9, w * 0.75, d + 1.2, 0, ry);
  put('tileDark', BOX, x, h + 1.1 + w * 0.75, z, 0.35, 0.3, d + 1.3, 0, ry);
  for (const side of [-1, 1]) {
    const ox = fz * side * (w / 2 + 0.02);
    const oz = -fx * side * (w / 2 + 0.02);
    for (let u = -d / 2 + 2; u <= d / 2 - 2; u += 2.6) {
      for (const y of [5, 9]) {
        if (y > h - 1) continue;
        const wx = x + ox + fx * u;
        const wz = z + oz + fz * u;
        const wry = ry + (side > 0 ? Math.PI / 2 : -Math.PI / 2);
        put('castleTrim', BOX, wx, y, wz, 1.4, 2, 0.2, 0, wry);
        put('glass', BOX, wx + Math.sin(wry) * 0.05, y, wz + Math.cos(wry) * 0.05, 1.1, 1.7, 0.2, 0, wry);
        put('castleTrim', BOX, wx + Math.sin(wry) * 0.1, y + 0.15, wz + Math.cos(wry) * 0.1, 1.1, 0.12, 0.1, 0, wry);
        put('castleTrim', BOX, wx + Math.sin(wry) * 0.1, y, wz + Math.cos(wry) * 0.1, 0.12, 1.7, 0.1, 0, wry);
      }
    }
    const dormerU = (rand() - 0.5) * d * 0.5;
    const dx = x + fz * side * (w / 4) + fx * dormerU;
    const dz = z - fx * side * (w / 4) + fz * dormerU;
    const dry = ry + (side > 0 ? Math.PI / 2 : -Math.PI / 2);
    put('castleWall', BOX, dx, h + 2.6, dz, 1.5, 1.6, 1.4, 0, dry);
    put('tileDark', ROOF, dx, h + 3.4, dz, 1, 0.9, 1.7, 0, dry);
    put('glass', BOX, dx + Math.sin(dry) * 0.72, h + 2.6, dz + Math.cos(dry) * 0.72, 0.7, 0.9, 0.05, 0, dry);
  }
  for (const u of [-d / 3, d / 4]) {
    put('castleTrim', BOX, x + fx * u, h + 1 + w * 0.6, z + fz * u, 0.9, 2.6, 0.9, 0, ry);
    put('castleDark', BOX, x + fx * u, h + 2.4 + w * 0.6, z + fz * u, 1.1, 0.25, 1.1, 0, ry);
  }
}

export function castle(batch, group, x, z, yaw, rand, shoreGap) {
  const put = frame(batch, x, 0, z, yaw, 0, 0, 1);
  const flags = [];
  put('castleDark', OCT, 0, 0.3, 0, 19, 3.6, 17);
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2 + rand() * 0.2;
    const r = 17.5 + rand() * 4;
    const s = 1.5 + rand() * 3;
    put(`rock${i % 3}`, pick(STONES, rand), Math.sin(a) * r * 1.05, -0.2 + rand() * 0.8, Math.cos(a) * r * 0.92, s, s * (0.5 + rand() * 0.4), s * (0.8 + rand() * 0.4), rand(), rand() * 6, rand());
  }
  put('castleTrim', OCT, 0, 1.4, 0, 15, 0.6, 13);
  const corners = [
    { x: -13, z: -12 },
    { x: 4, z: -15 },
    { x: 15, z: -9 },
    { x: 16, z: 4 },
    { x: 9, z: 13 },
    { x: -6, z: 14 },
    { x: -15, z: 6 },
  ];
  const center = { x: 0, z: 0 };
  for (let i = 0; i < corners.length; i++) wall(put, corners[i], corners[(i + 1) % corners.length], 8, center);
  const towers = [[0, 3, 16], [2, 3.3, 19], [3, 2.6, 14], [4, 3, 15.5], [5, 2.7, 13]];
  const shapes = [{ kind: 'cyl', x: 0, z: 0, r: 17.5, top: 10 }];
  for (const [i, r, h] of towers) {
    const height = h + rand() * 2;
    roundTower(put, corners[i].x, corners[i].z, r, height, rand, flags);
    shapes.push({ kind: 'cone', x: corners[i].x, z: corners[i].z, r: r * 1.05, wall: height + 1.4, top: height + 1.4 + r * 3.2 });
  }
  shapes.push({ kind: 'box', x: 1, z: -5, w: 5.6, d: 5.6, top: 26 }, { kind: 'cone', x: 1, z: -5, r: 6.6, wall: 26, top: 37 });
  shapes.push({ kind: 'box', x: 9.5, z: -1.5, w: 3.6, d: 7.4, top: 15 }, { kind: 'box', x: 1.5, z: 9.5, w: 7, d: 3.2, top: 13 });
  shapes.push({ kind: 'box', x: -15.2, z: -2.5, w: 3.4, d: 3.4, top: 20 });
  hall(put, 9.5, -1.5, 6.5, 14, 12, 0, rand);
  hall(put, 1.5, 9.5, 5.5, 13, 10, Math.PI / 2, rand);
  const keepTop = keep(put, 1, -5, 9, 25, rand);

  const gx = -15.2;
  const gz = -2.5;
  put('castleBase', BOX, gx, 1.6, gz, 7, 3.2, 7);
  put('castleWall', BOX, gx, 8.5, gz, 6.2, 15, 6.2);
  put('castleTrim', BOX, gx, 15.8, gz, 6.6, 0.4, 6.6);
  put('tile', PYRAMID, gx, 19.5, gz, 7.6, 7, 7.6);
  put('tileDark', BOX, gx, 16.1, gz, 7.8, 0.3, 7.8);
  put('gateWood', BOX, gx - 3.12, 4.2, gz, 0.2, 4.4, 3);
  put('gateWood', ARCH, gx - 3.12, 6.4, gz, 1.5, 1.5, 0.2, 0, -Math.PI / 2);
  put('castleTrim', ARCH, gx - 3.14, 6.4, gz, 1.85, 1.85, 0.2, 0, -Math.PI / 2);
  for (const u of [-1, -0.33, 0.33, 1]) put('iron', BOX, gx - 3.25, 4.6, gz + u, 0.1, 5, 0.12);
  for (const y of [3, 4.6, 6.2]) put('iron', BOX, gx - 3.25, y, gz, 0.1, 0.12, 2.9);
  put('shieldRed', BOX, gx - 3.15, 10.5, gz, 0.2, 2, 1.7);
  put('shieldWhite', BOX, gx - 3.27, 10.5, gz, 0.1, 1.3, 0.4);
  put('shieldWhite', BOX, gx - 3.27, 10.5, gz, 0.1, 0.4, 1.3);
  for (const u of [-1.6, 1.6]) archWindow(put, gx - 3.12, 13, gz + u, 0.5, 1.2, -Math.PI / 2);

  const length = Math.max(4, shoreGap);
  const bx = gx - 3.2 - length / 2;
  put('timber', BOX, bx, 3.2, gz, length, 0.4, 3.6);
  for (const side of [-1, 1]) {
    put('timberDark', BOX, bx, 3.5, gz + side * 1.85, length, 0.6, 0.25);
    for (let u = -length / 2 + 0.4; u <= length / 2; u += 2.2) {
      put('timberDark', CYL, bx + u, 1, gz + side * 1.7, 0.22, 4.5, 0.22);
      put('timberDark', BOX, bx + u, 4.4, gz + side * 1.85, 0.2, 2.4, 0.2);
    }
    put('timberDark', BOX, bx, 5.6, gz + side * 1.85, length, 0.2, 0.2);
  }
  put('tile', ROOF, bx, 5.7, gz, 2.6, 1.6, length + 0.4, 0, Math.PI / 2);

  swissFlag(batch, group, 1, keepTop + 0.6, -5, yaw + Math.PI / 2, 1.1);
  for (const f of flags) {
    const pennant = flagCloth(0.35);
    const p = new THREE.Vector3(f.x, f.y, f.z).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    pennant.position.set(x + p.x, f.y, z + p.z);
    pennant.rotation.y = yaw + rand() * 0.6;
    group.add(pennant);
  }
  return shapes;
}

function shutter(put, x, y, z, h, style, side) {
  if (style === 'chevron') {
    for (let k = 0; k < 4; k++) put(k % 2 ? 'shutterWhite' : 'shutterRed', BOX, x, y - h / 2 + (k + 0.5) * (h / 4), z, 0.55, h / 4, 0.12, 0, 0, side * 0.0);
  } else {
    put(style, BOX, x, y, z, 0.55, h, 0.12);
    for (const dy of [-h / 3, 0, h / 3]) put('logLine', BOX, x, y + dy, z + 0.07, 0.5, 0.05, 0.02);
  }
}

function chaletWindow(put, x, y, z, ry, style, rand, flowers) {
  const fx = Math.sin(ry);
  const fz = Math.cos(ry);
  const at = (u, v, out) => [x + fz * u + fx * out, y + v, z - fx * u + fz * out];
  put('chaletPlaster', BOX, ...at(0, 0, 0.02), 1.5, 1.6, 0.16, 0, ry);
  put('glass', BOX, ...at(0, 0, 0.06), 1.15, 1.25, 0.16, 0, ry);
  put('chaletPlaster', BOX, ...at(0, 0, 0.12), 0.08, 1.25, 0.06, 0, ry);
  put('chaletPlaster', BOX, ...at(0, 0.15, 0.12), 1.15, 0.08, 0.06, 0, ry);
  const s = (u) => {
    const p = at(u, 0, 0.1);
    shutter((key, g, px, py, pz, sx, sy, sz) => put(key, g, px, py, pz, sx, sy, sz, 0, ry), p[0], p[1], p[2], 1.5, style, 1);
  };
  s(-1.05);
  s(1.05);
  if (flowers) {
    put('timberDark', BOX, ...at(0, -0.95, 0.35), 1.5, 0.35, 0.45, 0, ry);
    for (let k = 0; k < 5; k++) {
      put(rand() < 0.7 ? 'geranium' : 'geraniumPink', BALL, ...at(-0.6 + k * 0.3, -0.68 + rand() * 0.08, 0.4 + rand() * 0.1), 0.17, 0.15, 0.17);
      put('geraniumLeaf', BALL, ...at(-0.55 + k * 0.3, -0.85, 0.58), 0.18, 0.12, 0.14);
    }
  }
}

export function chalet(batch, x, y, z, yaw, rand) {
  const put = frame(batch, x, y, z, yaw, 0, 0, 1);
  const w = 8 + rand() * 4;
  const d = 7 + rand() * 3;
  const floors = rand() < 0.35 ? 2 : 1;
  const ground = 3.2;
  const level = 2.8;
  const top = ground + floors * level;
  const wood = pick(['chaletWood', 'chaletWoodRed', 'chaletWoodGold'], rand);
  const roofKey = pick(['shingleDark', 'shingle', 'slate', 'tileDark'], rand);
  const style = pick(['shutterGreen', 'shutterRed', 'chevron', 'shutterGreen'], rand);
  const overhang = 1.8 + rand() * 0.8;
  const run = w / 2 + overhang;
  const rise = w * (0.22 + rand() * 0.08);
  const pitch = Math.atan2(rise, w / 2);
  const slope = run / Math.cos(pitch);

  put('stoneDark', BOX, 0, -3.2, 0, w + 0.5, 6.6, d + 0.5);
  put('chaletPlaster', BOX, 0, ground / 2, 0, w, ground, d);
  for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    for (let yy = 0.4; yy < ground; yy += 0.7) put('stone', BOX, cx * (w / 2 - 0.3), yy, cz * (d / 2 - 0.3), 0.7, 0.55, 0.7);
  }
  put(wood, BOX, 0, ground + (floors * level) / 2, 0, w, floors * level, d);
  for (let yy = ground + 0.45; yy < top; yy += 0.45) {
    put('logLine', BOX, 0, yy, d / 2 + 0.01, w, 0.06, 0.04);
    put('logLine', BOX, 0, yy, -d / 2 - 0.01, w, 0.06, 0.04);
    put('logLine', BOX, w / 2 + 0.01, yy, 0, 0.04, 0.06, d);
    put('logLine', BOX, -w / 2 - 0.01, yy, 0, 0.04, 0.06, d);
    for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const along = Math.round((yy - ground) / 0.45) % 2 === 0;
      put(wood, BOX, cx * (w / 2 + (along ? 0.25 : 0)), yy - 0.2, cz * (d / 2 + (along ? 0 : 0.25)), along ? 0.6 : 0.4, 0.38, along ? 0.4 : 0.6);
    }
  }
  const gable = new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(0, rise)]);
  const gableGeometry = new THREE.ExtrudeGeometry(gable, { depth: d, bevelEnabled: false }).translate(0, 0, -d / 2);
  put(wood, gableGeometry, 0, top, 0, 1, 1, 1);
  for (let yy = top + 0.45; yy < top + rise - 0.3; yy += 0.45) {
    const half = (w / 2) * (1 - (yy - top) / rise);
    for (const zz of [d / 2 + 0.01, -d / 2 - 0.01]) put('logLine', BOX, 0, yy, zz, half * 2, 0.06, 0.04);
  }
  for (const side of [-1, 1]) {
    put(roofKey, BOX, side * (run / 2 - overhang / 2 + 0.05) * 1, top + rise / 2 - (overhang * Math.tan(pitch)) / 2 + 0.25, 0, slope, 0.35, d + overhang * 2, 0, 0, -side * pitch);
    put('timberDark', BOX, side * (run / 2 - overhang / 2), top + rise / 2 - (overhang * Math.tan(pitch)) / 2 + 0.05, d / 2 + overhang + 0.05, slope, 0.45, 0.18, 0, 0, -side * pitch);
    put('timberDark', BOX, side * (run / 2 - overhang / 2), top + rise / 2 - (overhang * Math.tan(pitch)) / 2 + 0.05, -d / 2 - overhang - 0.05, slope, 0.45, 0.18, 0, 0, -side * pitch);
    for (let zz = -d / 2 - overhang + 0.6; zz <= d / 2 + overhang - 0.5; zz += 1.1) {
      put('timberDark', BOX, side * (w / 2 + overhang * 0.55), top - overhang * Math.tan(pitch) * 0.55 + 0.05, zz, overhang * 1.1, 0.2, 0.22, 0, 0, -side * pitch);
    }
  }
  for (const lx of [-w / 4, 0, w / 4]) put('timberDark', BOX, lx, top + rise * (1 - Math.abs(lx) / (w / 2)) - 0.35, 0, 0.35, 0.35, d + overhang * 2 + 0.3);
  put('inscription', BOX, 0, top - 0.25, d / 2 + 0.05, w * 0.7, 0.45, 0.06);
  for (let k = 0; k < 6; k++) put('logLine', BOX, -w * 0.3 + k * w * 0.12, top - 0.25, d / 2 + 0.09, w * 0.08, 0.06, 0.02);

  for (const lx of [-w / 4, w / 4]) chaletWindow(put, lx, 1.8, d / 2 + 0.02, 0, style, rand, rand() < 0.5);
  put('chaletWood', BOX, w / 2 - 1.4, 1.2, d / 2 + 0.06, 1.2, 2.3, 0.15);
  put('timberDark', BOX, w / 2 - 1.4, 2.5, d / 2 + 0.5, 1.8, 0.15, 1);
  for (let f = 0; f < floors; f++) {
    const fy = ground + level * f + 1.4;
    const cols = w > 10 ? 3 : 2;
    for (let c = 0; c < cols; c++) chaletWindow(put, (c - (cols - 1) / 2) * (w / cols), fy, d / 2 + 0.02, 0, style, rand, false);
    for (const side of [-1, 1]) chaletWindow(put, side * (w / 2 + 0.02), fy, 0, side * Math.PI / 2, style, rand, rand() < 0.4);
  }
  const by = ground + 0.1;
  put('timberDark', BOX, 0, by, d / 2 + 0.75, w + 0.8, 0.25, 1.5);
  for (let u = -w / 2 - 0.3; u <= w / 2 + 0.31; u += 0.32) put(wood, BOX, u, by + 0.6, d / 2 + 1.45, 0.22, 1, 0.08);
  put('timberDark', BOX, 0, by + 1.15, d / 2 + 1.45, w + 0.9, 0.14, 0.2);
  put('timberDark', BOX, 0, by + 1.05, d / 2 + 1.75, w + 0.6, 0.35, 0.45);
  for (let u = -w / 2; u <= w / 2; u += 0.32) {
    put(rand() < 0.75 ? 'geranium' : 'geraniumPink', BALL, u + (rand() - 0.5) * 0.15, by + 1.35 + rand() * 0.1, d / 2 + 1.75 + (rand() - 0.5) * 0.15, 0.18, 0.16, 0.18);
    put('geraniumLeaf', BALL, u, by + 1.05, d / 2 + 1.95, 0.2, 0.22, 0.12);
  }
  for (const side of [-1, 1]) put('timberDark', BOX, side * (w / 2 + 0.2), ground / 2, d / 2 + 1.35, 0.25, ground, 0.25);
  const fireSide = rand() < 0.5 ? -1 : 1;
  for (let row = 0; row < 4; row++) {
    for (let k = 0; k < 7; k++) {
      put('firewood', CYL, fireSide * (w / 2 + 0.45), 0.25 + row * 0.42, -d / 2 + 1 + k * 0.42 + (row % 2) * 0.2, 0.2, 0.8, 0.2, 0, 0, Math.PI / 2);
      put('firewoodEnd', CYL, fireSide * (w / 2 + 0.86), 0.25 + row * 0.42, -d / 2 + 1 + k * 0.42 + (row % 2) * 0.2, 0.17, 0.02, 0.17, 0, 0, Math.PI / 2);
    }
  }
  put('stone', BOX, -w / 4, top + rise * 0.55, -d / 4, 0.9, 2.6, 0.9);
  put('slate', BOX, -w / 4, top + rise * 0.55 + 1.45, -d / 4, 1.3, 0.2, 1.3);
}

export function lakeDock(batch, x, z, yaw, length, rand) {
  const put = frame(batch, x, 0, z, yaw, 0, 0, 1);
  const W = 4.6;
  const deck = 1.5;
  const L = length;
  const tones = ['timber', 'shingle', 'timber', 'plankPale'];
  for (let k = -L / 2 + 0.3; k < L / 2; k += 0.58) {
    const lift = (rand() - 0.5) * 0.05;
    const warp = (rand() - 0.5) * 0.02;
    const tone = tones[Math.floor(rand() * tones.length)];
    const shift = (rand() - 0.5) * 0.25;
    put(tone, BOX, shift, deck + lift, k, W + (rand() - 0.5) * 0.3, 0.2, 0.52, warp, (rand() - 0.5) * 0.012, warp * 0.5);
    for (const side of [-1, 1]) for (const dz of [-0.13, 0.13]) put('nail', CYL, side * (W / 2 - 0.35), deck + lift + 0.105, k + dz, 0.04, 0.02, 0.04);
    if (rand() < 0.15) put('timberDark', BOX, (rand() - 0.5) * W * 0.6, deck + lift + 0.1, k, 0.5 + rand() * 0.6, 0.012, 0.05);
  }
  for (const side of [-1, 1]) {
    put('timberDark', BOX, side * (W / 2 - 0.35), deck - 0.33, 0, 0.32, 0.4, L);
    put('timberDark', BOX, side * (W / 2 + 0.05), deck - 0.12, 0, 0.16, 0.45, L);
  }
  for (let k = -L / 2 + 0.6; k <= L / 2; k += 3) {
    for (const side of [-1, 1]) {
      put('timberDark', CYL, side * (W / 2 - 0.15), deck - 2.6, k, 0.24, 6, 0.24);
      put('rope', CYL, side * (W / 2 - 0.15), deck - 0.95, k, 0.26, 0.22, 0.26);
    }
    put('timberDark', BOX, 0, deck - 0.58, k, W, 0.28, 0.28);
  }
}

export function coveredBridge(batch, track, idx, height) {
  const i = track.wrap(idx);
  const p = track.point(i);
  const yaw = track.heading(i) + Math.PI / 2;
  const put = frame(batch, p.x, 0, p.z, yaw, 0, 0, 1);
  const hw = track.hw[i];
  const half = hw + 10;
  const deck = 11;
  const rand = mulberry(idx);
  put('timber', BOX, 0, deck, 0, 5.4, 0.5, half * 2);
  for (const side of [-1, 1]) {
    const sx = side * 2.65;
    put('timberDark', BOX, sx, deck - 0.2, 0, 0.45, 1, half * 2);
    put('timber', BOX, sx, deck + 0.95, 0, 0.18, 1.4, half * 2);
    put('timberDark', BOX, sx, deck + 1.7, 0, 0.3, 0.2, half * 2);
    put('timberDark', BOX, sx, deck + 4.2, 0, 0.4, 0.35, half * 2);
    const bay = 2.6;
    for (let u = -half; u <= half + 0.01; u += bay) {
      put('timberDark', BOX, sx, deck + 2.2, u, 0.3, 4.2, 0.3);
      if (u + bay <= half + 0.01) {
        const lean = Math.atan2(bay, 2.4);
        put('timberDark', BOX, sx, deck + 2.95, u + bay / 2, 0.16, Math.hypot(bay, 2.4), 0.16, (Math.round(u / bay) % 2 ? 1 : -1) * lean);
        const box = side * 3.1;
        put('timberDark', BOX, box, deck + 1.45, u + bay / 2, 0.55, 0.45, bay * 0.75);
        for (let f = 0; f < 5; f++) {
          const fz = u + bay / 2 + (f - 2) * 0.42;
          put(rand() < 0.75 ? 'geranium' : 'geraniumPink', BALL, box + (rand() - 0.5) * 0.25, deck + 1.85 + rand() * 0.15, fz, 0.2, 0.18, 0.2);
          put('geraniumLeaf', BALL, box + side * 0.2, deck + 1.65, fz + 0.2, 0.24, 0.16, 0.22);
        }
      }
    }
  }
  for (let u = -half + 0.6; u < half; u += 3.6) put('timberDark', BOX, 0, deck + 4.4, u, 5.4, 0.25, 0.25);
  put('shingle', ROOF, 0, deck + 4.45, 0, 3.7, 2.8, half * 2 + 1.2);
  put('shingleDark', BOX, 0, deck + 7.3, 0, 0.35, 0.3, half * 2 + 1.4);
  for (const side of [-1, 1]) put('shingleDark', BOX, side * 3.55, deck + 4.4, 0, 0.3, 0.25, half * 2 + 1.3);
  for (const end of [-1, 1]) {
    const ez = end * (half + 0.62);
    put('panel', ROOF, 0, deck + 4.45, ez, 3.4, 2.6, 0.12);
    put('panelRed', ROOF, 0, deck + 4.9, ez + end * 0.03, 2.2, 1.6, 0.12);
    for (const side of [-1, 1]) {
      put('iron', BOX, side * 2.9, deck + 3.4, ez, 0.12, 0.12, 0.7);
      put('iron', BOX, side * 2.9, deck + 3.05, ez + end * 0.35, 0.5, 0.7, 0.5);
      put('lampGlow', BOX, side * 2.9, deck + 3.05, ez + end * 0.35, 0.36, 0.5, 0.36);
    }
  }
  for (const end of [-1, 1]) {
    const ez = end * (hw + 4.5);
    put('masonryDark', BOX, 0, deck / 2 - 1.5, ez, 7, deck - 1, 6);
    for (let y = 0; y < deck - 1.5; y += 1.2) {
      for (let u = -3; u < 3; u += 1.6) put(rand() < 0.5 ? 'masonry' : 'masonryLight', BOX, u + (Math.round(y / 1.2) % 2) * 0.8 - 0.4, y - 1.4, ez - end * 3.02, 1.5, 1.1, 0.1);
    }
    put('masonryLight', BOX, 0, deck - 1.75, ez, 7.4, 0.4, 6.4);
    for (const u of [-1.6, 0, 1.6]) put('timberDark', CYL, u * 1.8, 1, end * (hw + 0.6), 0.3, 6, 0.3);
  }
  return { p, yaw, half };
}

export function waterTower(batch, x, y, z, rand) {
  const put = frame(batch, x, y, z, rand() * Math.PI, 0, 0, 1);
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    const s = 1.4 + rand() * 1.4;
    put(`rock${k % 3}`, pick(STONES, rand), Math.sin(a) * 6.4, -0.4, Math.cos(a) * 6.4, s, s * 0.6, s, rand(), rand() * 6, rand());
  }
  put('masonryDark', OCT_BATTER, 0, 1.5, 0, 5.6, 6, 5.6);
  put('masonry', OCT, 0, 12.5, 0, 5.2, 17, 5.2);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    for (let yy = 5; yy < 21; yy += 1.3) {
      const long = Math.round(yy / 1.3) % 2 === 0;
      put('masonryLight', BOX, Math.sin(a) * 5.05, yy, Math.cos(a) * 5.05, long ? 1.1 : 0.7, 0.6, 0.35, 0, a);
    }
  }
  for (const yy of [4.5, 12, 21]) put('masonryLight', OCT, 0, yy, 0, 5.45, 0.35, 5.45);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
    const r = 4.83;
    if (k % 2 === 0) archWindow(put, Math.sin(a) * r, 8 + (k % 4) * 0.8, Math.cos(a) * r, 0.6, 1.4, a, 'glass', 'masonryLight');
    archWindow(put, Math.sin(a) * r, 17, Math.cos(a) * r, 0.75, 1.6, a, 'glass', 'masonryLight');
  }
  archWindow(put, 0, 3.4, 5.15, 1.6, 2.8, 0, 'gateWood', 'masonryLight');
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2;
    put('masonryLight', BOX, Math.sin(a) * 5.3, 21.6, Math.cos(a) * 5.3, 0.5, 0.8, 0.5, 0, a);
  }
  put('masonry', OCT, 0, 22.4, 0, 5.6, 1, 5.6);
  put('shingleDark', OCT, 0, 23, 0, 6.6, 0.35, 6.6);
  put('shingle', OCT_SPIRE, 0, 29, 0, 6.5, 12, 6.5);
  for (const a of [0.4, 0.4 + Math.PI]) {
    put('shingle', BOX, Math.sin(a) * 4.2, 25.5, Math.cos(a) * 4.2, 1.3, 1.4, 1.3, 0, a);
    put('shingleDark', ROOF, Math.sin(a) * 4.2, 26.2, Math.cos(a) * 4.2, 0.9, 0.8, 1.6, 0, a);
    put('glass', BOX, Math.sin(a) * 4.88, 25.5, Math.cos(a) * 4.88, 0.6, 0.7, 0.05, 0, a);
  }
  put('iron', CYL, 0, 36, 0, 0.08, 2.4, 0.08);
  put('gold', BALL, 0, 35.2, 0, 0.35, 0.35, 0.35);
  put('iron', BOX, 0.5, 36.8, 0, 1.2, 0.5, 0.05);
}

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hullShape(length, width, inset = 0) {
  const l = length / 2 - inset;
  const w = width / 2 - inset;
  const s = new THREE.Shape();
  s.moveTo(0, -l);
  s.quadraticCurveTo(w * 0.95, -l + length * 0.12, w, -l + length * 0.32);
  s.lineTo(w, l - length * 0.12);
  s.quadraticCurveTo(w, l, 0, l);
  s.quadraticCurveTo(-w, l, -w, l - length * 0.12);
  s.lineTo(-w, -l + length * 0.32);
  s.quadraticCurveTo(-w * 0.95, -l + length * 0.12, 0, -l);
  return s;
}

function slab(shape, depth) {
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 16 }).rotateX(-Math.PI / 2);
}

function roundedRect(length, width, radius) {
  const s = new THREE.Shape();
  const l = length / 2;
  const w = width / 2;
  s.moveTo(-w + radius, -l);
  s.lineTo(w - radius, -l);
  s.quadraticCurveTo(w, -l, w, -l + radius);
  s.lineTo(w, l - radius);
  s.quadraticCurveTo(w, l, w - radius, l);
  s.lineTo(-w + radius, l);
  s.quadraticCurveTo(-w, l, -w, l - radius);
  s.lineTo(-w, -l + radius);
  s.quadraticCurveTo(-w, -l, -w + radius, -l);
  return s;
}

export function buildSteamer() {
  const group = new THREE.Group();
  const batch = new Batcher();
  const put = frame(batch, 0, 0, 0, 0, 0, 0, 1);
  const L = 30;
  const W = 6.6;
  batch.add('hullRed', slab(hullShape(L - 0.6, W - 0.3), 1.2), new THREE.Matrix4().makeTranslation(0, -0.9, 0));
  batch.add('hullWhite', slab(hullShape(L, W), 2.5), new THREE.Matrix4().makeTranslation(0, 0.3, 0));
  batch.add('navy', slab(hullShape(L + 0.08, W + 0.08), 0.3), new THREE.Matrix4().makeTranslation(0, 0.2, 0));
  batch.add('teak', slab(hullShape(L + 0.15, W + 0.15), 0.25), new THREE.Matrix4().makeTranslation(0, 2.8, 0));
  batch.add('deck', slab(hullShape(L - 0.3, W - 0.3), 0.1), new THREE.Matrix4().makeTranslation(0, 2.82, 0));
  for (const side of [-1, 1]) {
    for (let z = -11; z <= 11; z += 1.7) {
      if (Math.abs(z) < 3.4) continue;
      put('brass', CYL, side * (W / 2 + 0.01), 1.6, z, 0.3, 0.06, 0.3, 0, 0, Math.PI / 2);
      put('glass', CYL, side * (W / 2 + 0.03), 1.6, z, 0.22, 0.06, 0.22, 0, 0, Math.PI / 2);
    }
  }
  batch.add('cream', slab(roundedRect(17, 4.8, 1.2), 2.4), new THREE.Matrix4().makeTranslation(0, 2.9, -1));
  for (const side of [-1, 1]) {
    for (let z = -8.6; z <= 6.6; z += 1.25) {
      put('teak', BOX, side * 2.41, 4.15, z, 0.06, 1.25, 1.0);
      put('glass', BOX, side * 2.43, 4.15, z, 0.05, 1.0, 0.8);
    }
    put('teak', BOX, side * 2.42, 3.1, -1, 0.06, 0.18, 17);
  }
  batch.add('deck', slab(roundedRect(20, 6.2, 1.5), 0.22), new THREE.Matrix4().makeTranslation(0, 5.3, -1.2));
  batch.add('teak', slab(roundedRect(20.2, 6.4, 1.6), 0.08), new THREE.Matrix4().makeTranslation(0, 5.28, -1.2));
  const rail = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const ang = Math.atan2(x1 - x0, z1 - z0);
    put('hullWhite', BOX, (x0 + x1) / 2, 6.45, (z0 + z1) / 2, 0.1, 0.1, len, 0, ang);
    put('hullWhite', BOX, (x0 + x1) / 2, 5.95, (z0 + z1) / 2, 0.05, 0.05, len, 0, ang);
    const n = Math.max(1, Math.round(len / 0.8));
    for (let k = 0; k <= n; k++) put('hullWhite', BOX, x0 + ((x1 - x0) * k) / n, 5.95, z0 + ((z1 - z0) * k) / n, 0.07, 1, 0.07);
  };
  rail(-3, -10.6, -3, 8.2);
  rail(3, -10.6, 3, 8.2);
  rail(-2.2, -11.2, 2.2, -11.2);
  for (const side of [-1, 1]) {
    for (let z = -12.5; z <= 11.5; z += 0.9) {
      const w = z > 9 ? (W / 2) * Math.max(0.15, 1 - ((z - 9) / 6.5) ** 2) : z < -11 ? W / 2 * 0.8 : W / 2;
      put('hullWhite', BOX, side * (w - 0.1), 3.4, z, 0.06, 1.1, 0.06);
    }
    put('hullWhite', BOX, side * (W / 2 - 0.1), 3.95, -1.5, 0.1, 0.1, 20.5);
  }
  put('hullWhite', BOX, 0, 6.6, 6.4, 3.4, 2.4, 2.8);
  put('navy', BOX, 0, 7.95, 6.4, 3.9, 0.25, 3.3);
  for (const x of [-1.1, 0, 1.1]) put('glass', BOX, x, 6.9, 7.82, 0.85, 0.9, 0.05);
  for (const side of [-1, 1]) put('glass', BOX, side * 1.72, 6.9, 6.4, 0.05, 0.9, 1.8);
  put('brass', BALL, 0, 8.3, 6.4, 0.28, 0.28, 0.28);
  const stripes = 9;
  for (let k = 0; k < stripes; k++) {
    const x = -2.8 + (k + 0.5) * (5.6 / stripes);
    put(k % 2 ? 'canvasWhite' : 'canvasRed', BOX, x, 8.1, -6.6, 5.6 / stripes, 0.12, 8.4);
  }
  for (const side of [-1, 1]) {
    for (let k = 0; k < stripes; k++) put(k % 2 ? 'canvasWhite' : 'canvasRed', BOX, side * 2.85, 7.85, -10.6 + (k + 0.5) * (8.4 / stripes), 0.05, 0.5, 8.4 / stripes);
    for (const z of [-10.6, -6.6, -2.6]) put('teak', CYL, side * 2.7, 6.7, z, 0.07, 2.8, 0.07);
  }
  for (const z of [-9.5, -7.5, -5.5, -3.5]) {
    for (const side of [-1, 1]) {
      put('teak', BOX, side * 1.9, 5.85, z, 0.5, 0.12, 1.4);
      put('teak', BOX, side * 2.15, 6.15, z, 0.08, 0.5, 1.4);
    }
  }
  put('funnel', CYL, 0, 8.6, 1.6, 0.95, 6.2, 0.95, -0.08);
  put('soot', CYL, 0, 11.6, 1.36, 0.98, 0.9, 0.98, -0.08);
  put('hullRed', CYL, 0, 10.85, 1.42, 0.97, 0.3, 0.97, -0.08);
  put('brass', CYL, 0.6, 7.2, 2.3, 0.09, 1.2, 0.09);
  put('brass', CONE, 0.6, 7.95, 2.3, 0.18, 0.4, 0.18);
  for (const side of [-1, 1]) {
    put('hullWhite', HALF_DRUM, side * (W / 2 + 0.8), 0.8, 1.6, 1.8, 3.4, 3.4);
    put('teak', HALF_DRUM, side * (W / 2 + 1.72), 0.8, 1.6, 0.06, 3.5, 3.5);
    put('hullWhite', HALF_DRUM, side * (W / 2 + 1.76), 0.8, 1.6, 0.06, 3.15, 3.15);
    for (let k = 0; k < 9; k++) {
      const a = (k / 8) * Math.PI - Math.PI / 2;
      put(k % 2 ? 'brass' : 'hullRed', BOX, side * (W / 2 + 1.8), 0.8 + Math.cos(a) * 1.6, 1.6 + Math.sin(a) * 1.6, 0.05, 2.9, 0.16, a);
    }
    put('brass', CYL, side * (W / 2 + 1.82), 0.9, 1.6, 0.6, 0.06, 0.6, 0, 0, Math.PI / 2);
    put('navy', BOX, side * (W / 2 + 1.8), 2.75, 1.6, 0.05, 0.5, 2.6);
  }
  for (const side of [-1, 1]) {
    put('hullWhite', BALL, side * 2.6, 6.1, -8.6, 0.8, 0.45, 2.2);
    put('hullRed', BOX, side * 2.6, 6.2, -8.6, 1.3, 0.12, 3.6);
    for (const z of [-9.8, -7.4]) put('iron', BOX, side * 2.9, 6.8, z, 0.08, 1.4, 0.08);
  }
  put('teak', CYL, 0, 5.6, 14.6, 0.08, 4, 0.08);
  put('teak', CYL, 0, 9.4, 4, 0.1, 8, 0.1);
  put('lampGlow', BOX, 0, 11.6, 4.1, 0.3, 0.35, 0.3);
  put('teak', CYL, 0, 5.4, -14.2, 0.1, 4.6, 0.1);
  put('iron', BOX, 0.9, 2.2, 14.2, 0.1, 0.8, 0.5);
  const hull = new THREE.Group();
  batch.build(hull, 0.06, { ...COLORS, ...LANDMARK_COLORS });
  group.add(hull);

  const wheels = [];
  for (const side of [-1, 1]) {
    const wb = new Batcher();
    const wput = frame(wb, 0, 0, 0, 0, 0, 0, 1);
    for (const r of [1.2, 2.5]) {
      for (const sx of [-0.6, 0.6]) {
        for (let k = 0; k < 16; k++) {
          const a = (k / 16) * Math.PI * 2;
          wput('hullRed', BOX, sx, Math.cos(a) * r, Math.sin(a) * r, 0.1, 0.12, r * 0.42, a);
        }
      }
    }
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      wput('timberDark', BOX, 0, Math.cos(a) * 2.6, Math.sin(a) * 2.6, 1.3, 0.12, 0.7, a);
      for (const sx of [-0.6, 0.6]) wput('iron', BOX, sx, Math.cos(a) * 1.3, Math.sin(a) * 1.3, 0.08, 2.6, 0.08, a);
    }
    const wheel = new THREE.Group();
    wb.build(wheel, 0.04, { ...COLORS, ...LANDMARK_COLORS });
    wheel.position.set(side * (W / 2 + 0.8), 0.8, 1.6);
    group.add(wheel);
    wheels.push(wheel);
  }
  const stern = flagCloth(0.9);
  stern.position.set(0, 7, -14.2);
  stern.rotation.y = Math.PI / 2;
  group.add(stern);
  const bow = flagCloth(0.4);
  bow.position.set(0, 7.2, 14.6);
  bow.rotation.y = Math.PI / 2;
  group.add(bow);
  const mast = flagCloth(0.45);
  mast.position.set(0, 12.6, 4);
  mast.rotation.y = Math.PI / 2;
  group.add(mast);
  return { group, wheels, funnel: new THREE.Vector3(0, 12.4, 1.2), paddles: [new THREE.Vector3(-W / 2 - 0.8, 0, 1.6), new THREE.Vector3(W / 2 + 0.8, 0, 1.6)] };
}
