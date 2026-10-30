import * as THREE from 'three';
import { mat } from './world.js';

const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 14);
const HEX = new THREE.CylinderGeometry(1, 1, 1, 6);
const HEX_FLARE = new THREE.CylinderGeometry(1, 0.74, 1, 6);
const HEX_TAPER = new THREE.CylinderGeometry(0.74, 1, 1, 6);
const CONE = new THREE.ConeGeometry(1, 1, 14);
const BALL = new THREE.SphereGeometry(1, 14, 10);
const DOME = new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
const VAULT = new THREE.CylinderGeometry(1, 1, 1, 18, 1, false, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2);
const RIB = new THREE.TorusGeometry(1, 0.03, 6, 18, Math.PI);
const SLOPE = new THREE.CylinderGeometry(0.72, 1, 1, 4).rotateY(Math.PI / 4);
const WEDGE = new THREE.CylinderGeometry(1, 1, 1, 3).rotateY(Math.PI / 6);
const DISH = new THREE.LatheGeometry([[0.001, -0.08], [0.3, -0.03], [0.6, 0.12], [0.86, 0.34], [1.03, 0.54], [1, 0.56], [0.85, 0.42], [0.6, 0.24], [0.3, 0.1], [0.001, 0.06]].map(([r, y]) => new THREE.Vector2(r, y)), 22);

export const BASE_COLORS = {
  panel: 0x8f9aa6,
  panelLight: 0xc9ced3,
  panelDark: 0x5f6a76,
  concreteDark: 0x85878a,
  glass: 0x1f3f5c,
  lit: 0xffe9a0,
  litHot: 0xff7a2a,
  beacon: 0xff3a30,
  emblem: 0xffb02e,
};

function kit(batch, trim, x, y, z, yaw) {
  const root = new THREE.Matrix4().makeRotationY(yaw).setPosition(x, y, z);
  const place = (target) => (key, geometry, lx, ly, lz, sx = 1, sy = sx, sz = sx, rx = 0, ry = 0, rz = 0) => target.add(key, geometry, root.clone().multiply(mat(lx, ly, lz, sx, sy, sz, rx, ry, rz)));
  const put = place(batch);
  const up = new THREE.Vector3(0, 1, 0);
  const span = new THREE.Vector3();
  const beam = (key, a, b, r) => {
    span.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const length = span.length();
    const q = new THREE.Quaternion().setFromUnitVectors(up, span.clone().normalize());
    const local = new THREE.Matrix4().compose(new THREE.Vector3((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), q, new THREE.Vector3(r, length, r));
    batch.add(key, BOX, root.clone().multiply(local));
  };
  return { put, glow: place(trim), beam };
}

function hazardBand(k, lx, ly, lz, width, axisZ = false) {
  const count = Math.max(3, Math.round(width / 3));
  const step = width / count;
  for (let n = 0; n < count; n++) {
    const at = -width / 2 + (n + 0.5) * step;
    k.glow(n % 2 ? 'hazard' : 'hazardDark', BOX, lx + (axisZ ? 0 : at), ly, lz + (axisZ ? at : 0), axisZ ? 0.3 : step, 0.9, axisZ ? step : 0.3);
  }
}

function emblem(k, lx, ly, lz, size) {
  k.put('villain', BOX, lx, ly, lz, size * 1.1, size * 2, 0.3);
  k.put('villainDark', BOX, lx, ly + size * 1.08, lz, size * 1.3, 0.4, 0.5);
  k.glow('hazardDark', WEDGE, lx, ly + size * 0.2, lz + 0.17, size * 0.46, 0.1, size * 0.46, Math.PI / 2);
  k.glow('emblem', WEDGE, lx, ly + size * 0.06, lz + 0.2, size * 0.2, 0.1, size * 0.2, Math.PI / 2);
  k.glow('emblem', BOX, lx, ly - size * 0.5, lz + 0.18, size * 0.7, size * 0.09, 0.1);
}

function lampPost(k, lx, ly, lz, h = 13, lean = 1) {
  k.put('steelDark', CYL, lx, ly + h / 2, lz, 0.28, h, 0.28);
  k.put('steelDark', BOX, lx, ly + h, lz + lean * 0.9, 0.4, 0.3, 2.2);
  k.glow('lit', BOX, lx, ly + h - 0.24, lz + lean * 1.5, 1, 0.2, 0.9);
}

function commandTower(k, pad) {
  const base = pad;
  k.put('concrete', HEX_TAPER, 0, base + 7, 0, 15, 14, 15);
  k.put('villain', HEX, 0, base + 14.6, 0, 11.6, 1.4, 11.6);
  k.put('panelLight', HEX, 0, base + 24, 0, 8, 18, 8);
  for (let f = 0; f < 5; f++) {
    const y = base + 17 + f * 3.3;
    k.glow('glass', HEX, 0, y, 0, 8.14, 1.5, 8.14);
    for (let a = 0; a < 6; a++) {
      const t = (a / 6) * Math.PI * 2 + Math.PI / 6;
      if ((a + f) % 2) k.glow('lit', BOX, Math.sin(t) * 7.1, y, Math.cos(t) * 7.1, 2.8, 1.1, 0.3, 0, t, 0);
    }
  }
  k.put('steelDark', HEX, 0, base + 34, 0, 9, 2, 9);
  k.put('panelDark', HEX_FLARE, 0, base + 37.4, 0, 15, 4.8, 15);
  k.glow('glass', HEX_FLARE, 0, base + 37.5, 0, 15.2, 3.3, 15.2);
  for (let a = 0; a < 6; a++) {
    const t = (a / 6) * Math.PI * 2 + Math.PI / 6;
    k.glow('litHot', BOX, Math.sin(t) * 12.8, base + 37.6, Math.cos(t) * 12.8, 7, 0.5, 0.3, 0.32, t, 0);
  }
  k.put('villain', HEX, 0, base + 40.3, 0, 15.4, 1, 15.4);
  k.put('steelDark', HEX, 0, base + 41.6, 0, 7, 1.6, 7);
  k.put('steelDark', CYL, 0, base + 49, 0, 0.5, 14, 0.5);
  k.put('steelDark', BOX, 0, base + 47, 0, 7, 0.3, 0.3);
  k.put('steelDark', BOX, 0, base + 51, 0, 4.4, 0.3, 0.3);
  k.glow('beacon', BALL, 0, base + 56.4, 0, 0.8);
  for (const side of [-1, 1]) k.put('panelLight', BALL, side * 12, base + 42, 3, 2.2);
  k.put('concrete', BOX, 15, base + 12, 0, 12, 1, 12);
  k.put('hazard', CYL, 15, base + 12.6, 0, 5, 0.2, 5);
  k.put('steelDark', CYL, 15, base + 12.72, 0, 4.2, 0.2, 4.2);
  k.put('hazard', BOX, 15, base + 12.86, 0, 0.8, 0.12, 4);
  k.put('hazard', BOX, 15 - 1.2, base + 12.86, 0, 0.8, 0.12, 4);
  k.put('hazard', BOX, 15 + 1.2, base + 12.86, 0, 0.8, 0.12, 4);
  k.put('hazard', BOX, 15, base + 12.86, 0, 2.6, 0.12, 0.8);
  k.beam('steelDark', [20, base + 11.5, 0], [12, base, 0], 0.9);
  emblem(k, 0, base + 6.5, 13.4, 4);
}

function hangar(k, pad) {
  const w = 19;
  const len = 42;
  k.put('panel', VAULT, 0, pad, 0, w, w * 0.92, len);
  for (let n = -3; n <= 3; n++) k.put('panelDark', RIB, 0, pad, n * 6.6, w * 1.01, w * 0.93, 22);
  k.put('steelDark', BOX, 0, pad + 8.4, len / 2 + 0.3, w * 1.28, 16.8, 1.4);
  k.glow('glass', BOX, 0, pad + 5.4, len / 2 + 1.1, w * 1.08, 10.8, 0.3);
  k.glow('lit', BOX, 0, pad + 11, len / 2 + 1.25, w * 1.08, 0.5, 0.1);
  for (let n = -4; n <= 4; n++) k.put('panelDark', BOX, n * 4.6, pad + 5.4, len / 2 + 1.35, 0.4, 10.8, 0.3);
  hazardBand(k, 0, pad + 16.8, len / 2 + 1.1, w * 2);
  k.put('villain', BOX, 0, pad + 19.6, len / 2 - 0.4, w * 0.9, 3.4, 1.4);
  k.glow('lit', BOX, 0, pad + 19.6, len / 2 + 0.34, w * 0.72, 1.2, 0.1);
  for (const x of [-9, 0, 9]) {
    k.put('steel', CYL, x, pad + w * 0.92 + 0.8, -6, 1.2, 2, 1.2);
    k.put('steelDark', CONE, x, pad + w * 0.92 + 2.4, -6, 1.9, 1.3, 1.9);
  }
  for (const side of [-1, 1]) {
    k.put('concrete', BOX, side * (w + 5), pad + 4, 8, 10, 8, 18);
    k.put('villain', BOX, side * (w + 5), pad + 8.3, 8, 10.6, 0.7, 18.6);
    for (let n = 0; n < 3; n++) k.glow('lit', BOX, side * (w + 5) + (n - 1) * 2.8, pad + 4.6, 17.2, 1.7, 2, 0.2);
    lampPost(k, side * (w + 12), pad, 25, 15);
  }
  for (const [x, z, s] of [[-14, 26, 2.6], [-11, 28, 2], [13, 27, 2.8], [16, 25, 2]]) {
    k.put('concreteDark', BOX, x, pad + s / 2, z, s, s, s, 0, x, 0);
    k.put('hazard', BOX, x, pad + s + 0.1, z, s * 0.5, 0.2, s * 1.02, 0, x, 0);
  }
}

function casemate(k, pad) {
  k.put('concrete', SLOPE, 0, pad + 5, 0, 22, 10, 16);
  k.put('concreteDark', BOX, 0, pad + 10.3, 0, 16, 0.8, 11.4);
  k.put('steelDark', BOX, 0, pad + 5.6, 11, 24, 1.8, 0.7, -0.28);
  k.glow('lit', BOX, 0, pad + 5.6, 11.4, 22, 0.7, 0.1, -0.28);
  hazardBand(k, 0, pad + 1.2, 16.2, 40);
  for (const x of [-11, 11]) {
    k.put('steelDark', CYL, x, pad + 11.8, 0, 3, 2.4, 3);
    k.put('villain', DOME, x, pad + 13, 0, 3, 2.3, 3);
    k.put('steel', CYL, x - 0.8, pad + 13.2, 4.8, 0.32, 6, 0.32, Math.PI / 2 - 0.2);
    k.put('steel', CYL, x + 0.8, pad + 13.2, 4.8, 0.32, 6, 0.32, Math.PI / 2 - 0.2);
  }
  k.put('villain', BOX, 0, pad + 12.8, 0, 8, 4.2, 6);
  k.glow('glass', BOX, 0, pad + 13.2, 3.06, 6.6, 1.6, 0.2);
  k.put('steelDark', CYL, 2.4, pad + 18, 0, 0.2, 7, 0.2);
  k.put('panelLight', BALL, -2.4, pad + 15.8, 0, 1.3);
}

function fuelFarm(k, pad) {
  for (const x of [-17, 17]) {
    for (let a = 0; a < 6; a++) {
      const t = (a / 6) * Math.PI * 2;
      k.put('steelDark', CYL, x + Math.cos(t) * 8.4, pad + 4.5, Math.sin(t) * 8.4, 0.5, 9, 0.5);
    }
    k.put('panelLight', BALL, x, pad + 14, 0, 10.4);
    k.put('villain', CYL, x, pad + 14, 0, 10.5, 1.5, 10.5);
    k.glow('hazardDark', BOX, x, pad + 19.6, 8.4, 3, 0.5, 0.1, 0.5);
    k.put('steelDark', CYL, x, pad + 24.8, 0, 2, 0.8, 2);
    k.put('steel', CYL, x, pad + 26, 0, 0.5, 2, 0.5);
    for (let n = 0; n < 8; n++) {
      const t = (n / 8) * Math.PI * 0.8;
      k.put('steelDark', BOX, x + Math.sin(t) * 10.8, pad + 14 + Math.cos(t) * 10.8, 0, 2.4, 0.2, 0.2);
    }
  }
  k.put('concrete', CYL, 0, pad + 6, -12, 7, 12, 7);
  k.put('villain', CYL, 0, pad + 8, -12, 7.08, 1.4, 7.08);
  k.put('steelDark', DOME, 0, pad + 12, -12, 7, 1.8, 7);
  for (const z of [3, 6]) {
    k.put('hazard', CYL, 0, pad + 4 + z * 0.4, z - 3, 0.7, 42, 0.7, 0, 0, Math.PI / 2);
    k.put('steelDark', CYL, 0, pad + 8.5 + z * 0.4, z - 3, 0.5, 26, 0.5, 0, 0, Math.PI / 2);
  }
  for (const x of [-9, 0, 9]) {
    k.put('steelDark', CYL, x, pad + 3, 3, 0.4, 6, 0.4);
    k.put('steelDark', CYL, x, pad + 3, 0, 0.4, 6, 0.4);
  }
  k.put('steel', BOX, 0, pad + 13, 8, 30, 0.4, 2.4);
  for (const x of [-14, -7, 0, 7, 14]) k.put('steelDark', BOX, x, pad + 14, 9.1, 0.2, 2, 0.2);
  k.put('steelDark', BOX, 0, pad + 15, 9.1, 30, 0.2, 0.2);
  k.put('steelDark', CYL, 0, pad + 6.5, 8, 0.3, 13, 0.3);
  lampPost(k, -31, pad, 10, 14);
  lampPost(k, 31, pad, 10, 14);
}

function radar(k, pad) {
  const h = 34;
  const foot = 8;
  const top = 2.4;
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    k.beam('steel', [sx * foot, pad, sz * foot], [sx * top, pad + h, sz * top], 0.5);
  }
  for (let n = 0; n < 6; n++) {
    const u0 = n / 6;
    const u1 = (n + 1) / 6;
    const w0 = foot + (top - foot) * u0;
    const w1 = foot + (top - foot) * u1;
    const y0 = pad + u0 * h;
    const y1 = pad + u1 * h;
    for (const [ax, az, bx, bz] of [[-1, 1, 1, 1], [1, 1, 1, -1], [1, -1, -1, -1], [-1, -1, -1, 1]]) {
      k.beam('steelDark', [ax * w0, y0, az * w0], [bx * w1, y1, bz * w1], 0.26);
      k.beam('steelDark', [bx * w0, y0, bz * w0], [ax * w1, y1, az * w1], 0.26);
      k.beam('steel', [ax * w1, y1, az * w1], [bx * w1, y1, bz * w1], 0.3);
    }
  }
  k.put('steelDark', CYL, 0, pad + h + 1, 0, 3.4, 2.4, 3.4);
  k.put('concrete', BOX, 0, pad + h + 4, 0, 5, 3.6, 5);
  k.put('panelLight', DISH, 0, pad + h + 11.5, 3, 15, 15, 15, 1.05);
  k.put('steelDark', CYL, 0, pad + h + 15.2, 9.6, 0.28, 12, 0.28, 1.05);
  k.put('villain', BALL, 0, pad + h + 18, 14.4, 1.1);
  for (const x of [-6.2, 6.2]) k.beam('steelDark', [x, pad + h + 8.6, 8], [0, pad + h + 18, 14.2], 0.16);
  k.glow('beacon', BALL, 0, pad + h + 6.4, 0, 0.6);
  k.put('concrete', BOX, 0, pad + 3, 0, 10, 6, 10);
  k.glow('lit', BOX, 0, pad + 3.4, 5.1, 3, 2, 0.2);
}

function rocketPad(k, pad) {
  const r = 5;
  k.put('concreteDark', CYL, 0, pad + 2, 0, 14, 4, 14);
  k.put('steelDark', CYL, 0, pad + 4.4, 0, 8, 1, 8);
  for (let a = 0; a < 4; a++) {
    const t = (a / 4) * Math.PI * 2;
    k.put('steelDark', BOX, Math.sin(t) * 5.8, pad + 8, Math.cos(t) * 5.8, 0.5, 7.4, 3.2, 0, t + Math.PI / 2, 0);
  }
  k.put('panelLight', CYL, 0, pad + 26, 0, r, 42, r);
  k.put('steelDark', CONE, 0, pad + 3.4, 0, r * 0.8, 3, r * 0.8);
  for (const y of [14, 24, 34]) k.put('hazardDark', CYL, 0, pad + y, 0, r + 0.06, 1, r + 0.06);
  k.put('villain', CYL, 0, pad + 43, 0, r + 0.06, 8, r + 0.06);
  k.put('panelLight', CONE, 0, pad + 53.5, 0, r, 13, r);
  k.put('villain', CONE, 0, pad + 57.5, 0, 2.3, 5, 2.3);
  k.glow('glass', CYL, 0, pad + 38.4, 0, r + 0.08, 1, r + 0.08);
  k.glow('emblem', BOX, 0, pad + 29, r + 0.1, 1.4, 12, 0.1);
  const gx = -14;
  for (const [x, z] of [[gx - 3, -3], [gx + 3, -3], [gx + 3, 3], [gx - 3, 3]]) k.put('hazard', BOX, x, pad + 29, z, 0.9, 58, 0.9);
  for (let n = 0; n < 9; n++) {
    const y = pad + 4 + n * 6.2;
    k.put('hazardDark', BOX, gx, y, 3, 6.4, 0.4, 0.4);
    k.put('hazardDark', BOX, gx, y, -3, 6.4, 0.4, 0.4);
    k.put('hazardDark', BOX, gx - 3, y, 0, 0.4, 0.4, 6.4);
    k.put('hazardDark', BOX, gx + 3, y, 0, 0.4, 0.4, 6.4);
    k.beam('steelDark', [gx - 3, y, 3], [gx + 3, y + 6.2, 3], 0.22);
    k.beam('steelDark', [gx - 3, y, -3], [gx + 3, y + 6.2, -3], 0.22);
  }
  for (const y of [18, 34, 46]) k.put('steelDark', BOX, gx + 6, pad + y, 0, 7, 0.9, 1.6);
  k.put('steelDark', BOX, gx, pad + 59, 0, 8, 1, 8);
  k.glow('beacon', BALL, gx, pad + 60.2, 0, 0.6);
  lampPost(k, 16, pad + 4, 8, 15);
  lampPost(k, 16, pad + 4, -8, 15, -1);
}

function reactor(k, pad) {
  k.put('concrete', CYL, 0, pad + 4, 0, 19, 8, 19);
  k.put('villain', CYL, 0, pad + 8.4, 0, 19.3, 1, 19.3);
  k.put('panelLight', DOME, 0, pad + 8.8, 0, 17, 15, 17);
  for (let a = 0; a < 8; a++) {
    const t = (a / 8) * Math.PI * 2;
    k.put('panelDark', RIB, 0, pad + 8.8, 0, 17.1, 15.1, 18, 0, t, 0);
    k.glow('litHot', BOX, Math.sin(t + 0.39) * 19.1, pad + 4, Math.cos(t + 0.39) * 19.1, 4.4, 3.2, 0.3, 0, t + 0.39, 0);
  }
  k.glow('litHot', CYL, 0, pad + 24, 0, 3.6, 0.6, 3.6);
  k.put('steelDark', CYL, 0, pad + 23.4, 0, 4.4, 1.2, 4.4);
  for (const side of [-1, 1]) {
    k.put('concreteDark', HEX_TAPER, side * 25, pad + 11, -6, 6, 22, 6);
    k.put('villain', HEX, side * 25, pad + 20.4, -6, 4.6, 1.2, 4.6);
    k.glow('hazardDark', HEX, side * 25, pad + 22.2, -6, 3.4, 0.2, 3.4);
  }
  k.put('hazard', BOX, 0, pad + 2.6, 20, 9, 5.2, 1.2);
  k.put('steelDark', BOX, 0, pad + 2.6, 20.2, 7, 4, 1.2);
}

const STATIONS = [
  [0.12, -1, 'tower'],
  [0.2, 1, 'casemate'],
  [0.27, -1, 'fuel'],
  [0.34, 1, 'hangar'],
  [0.42, -1, 'rocket'],
  [0.5, 1, 'radar'],
  [0.56, -1, 'reactor'],
  [0.63, 1, 'casemate'],
  [0.7, -1, 'hangar'],
  [0.77, 1, 'fuel'],
  [0.84, -1, 'radar'],
  [0.92, 1, 'tower'],
];

const TYPES = {
  tower: { build: commandTower, depth: 30, width: 44 },
  casemate: { build: casemate, depth: 34, width: 46 },
  fuel: { build: fuelFarm, depth: 34, width: 66 },
  hangar: { build: hangar, depth: 62, width: 66 },
  rocket: { build: rocketPad, depth: 34, width: 46 },
  radar: { build: radar, depth: 24, width: 24 },
  reactor: { build: reactor, depth: 46, width: 62 },
};

export function stationSpots(track, riverEnd) {
  return STATIONS.map(([u, side, type]) => {
    const { depth, width } = TYPES[type];
    const s = u * riverEnd;
    const i = track.wrap(Math.round(s / track.spacing));
    const hw = track.hw[i];
    const lat = side * (hw + 11 + depth / 2);
    const p = track.point(i, lat);
    return { ...p, s, i, side, type, depth, width, yaw: Math.atan2(-side * track.nx[i], -side * track.nz[i]) };
  });
}

function foundation(k, spot, pad) {
  const { depth, width } = spot;
  k.put('concrete', BOX, 0, pad - 14, 0, width, 28, depth);
  k.put('concreteDark', BOX, 0, pad - 0.5, depth / 2 + 0.2, width + 0.6, 1.2, 0.9);
  hazardBand(k, 0, pad - 1.8, depth / 2 + 0.4, width);
  for (let x = -width / 2 + 5; x < width / 2; x += 10) k.put('concreteDark', BOX, x, pad - 7, depth / 2 + 0.1, 1.4, 10, 0.5);
  k.put('steelDark', BOX, 0, pad + 0.05, 0, width - 2, 0.1, depth - 2);
}

function bridge(batch, trim, track, s, level) {
  const i = track.wrap(Math.round(s / track.spacing));
  const p = track.point(i, 0);
  const k = kit(batch, trim, p.x, level, p.z, track.heading(i));
  const half = track.hw[i] + 16;
  const deck = 15;
  k.put('steelDark', BOX, 0, deck, 0, half * 2, 1.4, 9);
  k.put('villain', BOX, 0, deck + 0.9, 0, half * 2, 0.4, 7.4);
  for (const z of [-4.2, 4.2]) {
    k.put('steel', BOX, 0, deck + 7.6, z, half * 2, 0.8, 0.8);
    k.put('steel', BOX, 0, deck + 0.4, z, half * 2, 0.8, 0.8);
    for (let x = -half; x < half; x += 7) {
      k.put('steel', BOX, x, deck + 4, z, 0.5, 7.4, 0.5);
      k.beam('steelDark', [x, deck + 0.6, z], [x + 7, deck + 7.4, z], 0.36);
    }
  }
  for (const x of [-half, half]) {
    k.put('concrete', BOX, x, deck / 2 - 4, 0, 8, deck + 12, 12);
    k.put('villain', BOX, x, deck - 0.4, 0, 8.6, 1, 12.6);
    k.glow('beacon', BALL, x, deck + 9, 4.2, 0.5);
    k.glow('beacon', BALL, x, deck + 9, -4.2, 0.5);
  }
  for (const x of [-15, 15]) {
    for (const z of [4.8, -4.8]) {
      k.put('villain', BOX, x, deck - 2.4, z, 6, 4.6, 0.25);
      k.glow('hazardDark', BOX, x, deck - 4.8, z, 6, 0.5, 0.3);
      k.glow('emblem', WEDGE, x, deck - 2.2, z + Math.sign(z) * 0.14, 1.5, 0.1, 1.5, Math.PI / 2);
    }
  }
}

function perimeter(batch, trim, track, height, level, from, to, spots) {
  const blocked = (s) => spots.some((o) => Math.abs(o.s - s) < o.width / 2 + 14);
  for (let s = from, n = 0; s < to; s += 26, n++) {
    if (blocked(s)) continue;
    const i = track.wrap(Math.round(s / track.spacing));
    for (const side of [-1, 1]) {
      const p = track.point(i, side * (track.hw[i] + 7));
      const y = Math.max(height(p.x, p.z), level(s) + 2.5);
      const k = kit(batch, trim, p.x, y, p.z, track.heading(i));
      k.put('concrete', BOX, 0, 0, 0, 1.8, 7, 25);
      k.put('concreteDark', BOX, 0, 3.7, 0, 2.4, 0.6, 25.4);
      k.put('hazard', BOX, side * -1, 2, 0, 0.1, 0.6, 25);
      if (n % 3 === 0) {
        k.put('steelDark', CYL, 0, 7, 12.5, 0.26, 8, 0.26);
        k.put('steelDark', BOX, side * -1, 11, 12.5, 2.2, 0.26, 0.4);
        k.glow('lit', BOX, side * -1.6, 10.8, 12.5, 0.9, 0.16, 0.9);
      }
      if (n % 5 === 2) {
        k.put('villain', BOX, side * -1.05, 1, 0, 0.2, 7, 4.5);
        k.glow('emblem', WEDGE, side * -1.2, 1.4, 0, 1.5, 0.1, 1.5, 0, side * Math.PI / 2, Math.PI / 2);
      }
    }
  }
}

export function buildBase(batch, trim, track, height, riverEnd) {
  const spots = stationSpots(track, riverEnd);
  const level = (s) => track.level(s);
  for (const spot of spots) {
    const pad = Math.max(height(spot.x, spot.z), level(spot.s) + 4);
    spot.pad = pad;
    const k = kit(batch, trim, spot.x, pad, spot.z, spot.yaw);
    foundation(k, spot, 0.3);
    TYPES[spot.type].build(k, 0.3);
  }
  for (const u of [0.31, 0.66]) bridge(batch, trim, track, u * riverEnd, track.level(u * riverEnd));
  perimeter(batch, trim, track, height, level, riverEnd * 0.08, riverEnd * 0.96, spots);
  return (x, z) => spots.some((o) => Math.hypot(x - o.x, z - o.z) < Math.max(o.depth, o.width) * 0.75);
}
