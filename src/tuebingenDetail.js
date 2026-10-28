import * as THREE from 'three';
import { frame } from './alpine.js';
import { GOTHIC, ROUND } from './veniceDetail.js';
import { mulberry32 } from './toon.js';

export const TOWN_COLORS = {
  plaster: 0xf7f3ea,
  cream: 0xf3e2c0,
  ochre: 0xe8b04b,
  yellow: 0xf4d264,
  pink: 0xf2b0a8,
  salmon: 0xf09a7a,
  mint: 0xbfe0c4,
  sky: 0xb4d4ea,
  lilac: 0xd6c0e2,
  apricot: 0xf5c08a,
  beam: 0x5a3a26,
  beamRed: 0x9a3f2c,
  roof: 0xb9553c,
  roofDark: 0x8f3f2e,
  roofBrown: 0x7a4030,
  stone: 0xe6dcc6,
  stoneDark: 0xb9ad94,
  sandstone: 0xdac89e,
  sandstoneDark: 0xb9a57a,
  slate: 0x5d5862,
  copper: 0x6fb39d,
  window: 0x2f3a4a,
  frameWhite: 0xfdfbf6,
  shutterGreen: 0x3f8f5a,
  shutterRed: 0xb8443a,
  shutterBlue: 0x3f6fa8,
  flower: 0xff4f6d,
  flowerB: 0xffc93c,
  flowerC: 0xa855c7,
  flowerD: 0xff8a2a,
  trail: 0x8fcf4a,
  trailDark: 0x5fae3a,
  planter: 0x4a3524,
  concrete: 0xc9c4b8,
  concreteDark: 0xa9a397,
  asphalt: 0x5d5f63,
  roofOrange: 0xd8643f,
  clockBlue: 0x5aa0d8,
  shutterGrey: 0x8f9a8c,
  plane: 0x5f9e3c,
  planeLight: 0x7cb44c,
  planeDark: 0xa39c7a,
  willowLight: 0xbfdc72,
  leafy: 0x4fae4a,
  flowerBox: 0x6e4a2c,
  door: 0x5a3a26,
  gold: 0xffd23f,
  clockFace: 0xfdfbf6,
  hoelderlin: 0xf4cf52,
  castle: 0xf4efe4,
  aula: 0xf1dfaa,
  chapel: 0xfaf8f2,
  leafA: 0x4f9a3a,
  leafB: 0x69b347,
  leafC: 0x3e8a40,
  leafD: 0x84c25a,
  willow: 0xa6cc5c,
  willowStrand: 0xa6cc5c,
  willowDark: 0x8ab94c,
  planeBark: 0xece6d2,
  planePatch: 0xb9b88f,
  bark: 0x6e4a2e,
  puntWood: 0xa0683a,
  puntDark: 0x6b4226,
  puntSeat: 0xc98d55,
  puntFloor: 0xd9a96e,
  tarp: 0x2f5f8f,
  shirtA: 0xe84a5f,
  shirtB: 0x3d8bd9,
  straw: 0xf0d68a,
  poleWood: 0xd1ad72,
  ironDark: 0x2a2f36,
  lampGlass: 0xfff1b0,
  hedge: 0x3f8f45,
  shed: 0x7fa86a,
  shedB: 0xd98b5f,
  shedC: 0x6f9ec9,
  fence: 0xf3eee2,
  bench: 0x7a5232,
  gravelBed: 0x9a9184,
  trainRed: 0xd8343a,
  barnWood: 0x9a5a36,
  rapeseed: 0xf2d43a,
};

const FACADES = ['cream', 'ochre', 'yellow', 'pink', 'salmon', 'mint', 'sky', 'lilac', 'apricot', 'plaster'];

const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 12);
const OCT = new THREE.CylinderGeometry(1, 1, 1, 8);
const CONE = new THREE.ConeGeometry(1, 1, 12);
const OCT_CONE = new THREE.ConeGeometry(1, 1, 8);
const BALL = new THREE.SphereGeometry(1, 12, 9);
const LOW_BALL = new THREE.SphereGeometry(1, 9, 7);
const BUD = new THREE.SphereGeometry(1, 6, 4);
const TRUNK = new THREE.CylinderGeometry(0.7, 1, 1, 9).translate(0, 0.5, 0);
const HIP = new THREE.ConeGeometry(Math.SQRT2 / 2, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0);
const prism = new THREE.Shape([new THREE.Vector2(-1, 0), new THREE.Vector2(1, 0), new THREE.Vector2(0, 1)]);
const GABLE = new THREE.ExtrudeGeometry(prism, { depth: 1, bevelEnabled: false }).translate(0, 0, -0.5);
const SPIRE = new THREE.LatheGeometry([[1, 0], [0.82, 0.08], [0.55, 0.3], [0.3, 0.62], [0.12, 0.92], [0, 1]].map(([r, y]) => new THREE.Vector2(r, y)), 8);
const TOWER_CAP = new THREE.LatheGeometry([[1, 0], [0.9, 0.05], [0.72, 0.18], [0.45, 0.48], [0.2, 0.78], [0, 1]].map(([r, y]) => new THREE.Vector2(r, y)), 16);
const mansardShape = new THREE.Shape([new THREE.Vector2(-0.5, 0), new THREE.Vector2(0.5, 0), new THREE.Vector2(0.42, 0.55), new THREE.Vector2(0.2, 1), new THREE.Vector2(-0.2, 1), new THREE.Vector2(-0.42, 0.55)]);
const MANSARD = new THREE.ExtrudeGeometry(mansardShape, { depth: 1, bevelEnabled: false }).translate(0, 0, -0.5).rotateY(Math.PI / 2);
const FLOWERS = ['flower', 'flowerB', 'flowerC', 'flowerD', 'flower'];

export const pick = (list, rand) => list[Math.floor(rand() * list.length)];

function windowPane(win, key, x, y, z, w, h, ry, depth = 0.12) {
  win('frameWhite', BOX, x, y, z, w + 0.3, h + 0.3, depth, 0, ry);
  win(key, BOX, x + Math.sin(ry) * 0.05, y, z + Math.cos(ry) * 0.05, w, h, depth, 0, ry);
}

function timberFace(put, beam, w, y0, h, z, face) {
  const zf = z + face * 0.06;
  put(beam, BOX, 0, y0 + 0.12, zf, w + 0.05, 0.24, 0.1);
  put(beam, BOX, 0, y0 + h - 0.12, zf, w + 0.05, 0.24, 0.1);
  const bays = Math.max(2, Math.round(w / 1.7));
  for (let k = 0; k <= bays; k++) put(beam, BOX, -w / 2 + (k * w) / bays, y0 + h / 2, zf, 0.22, h, 0.1);
  const bay = w / bays;
  const brace = Math.atan2(h - 0.4, bay);
  const len = Math.hypot(bay, h - 0.4);
  for (const s of [-1, 1]) put(beam, BOX, s * (w / 2 - bay / 2), y0 + h / 2, zf, len, 0.18, 0.1, 0, 0, s * brace);
  put(beam, BOX, 0, y0 + h * 0.62, zf, w, 0.14, 0.1);
}

function timberSide(put, beam, d, y0, h, x, side) {
  const xf = x + side * 0.06;
  put(beam, BOX, xf, y0 + 0.12, 0, 0.1, 0.24, d + 0.05);
  put(beam, BOX, xf, y0 + h - 0.12, 0, 0.1, 0.24, d + 0.05);
  const bays = Math.max(2, Math.round(d / 1.9));
  for (let k = 0; k <= bays; k++) put(beam, BOX, xf, y0 + h / 2, -d / 2 + (k * d) / bays, 0.1, h, 0.22);
  const bay = d / bays;
  const len = Math.hypot(bay, h - 0.4);
  for (const s of [-1, 1]) put(beam, BOX, xf, y0 + h / 2, s * (d / 2 - bay / 2), 0.1, 0.18, len, -s * Math.atan2(h - 0.4, bay), 0, 0);
}

export function gabledHouse(batch, windows, x, y, z, yaw, w, d, floors, rand, { color = pick(FACADES, rand), timbered = false, roof = pick(['roof', 'roof', 'roofDark', 'roofBrown'], rand), plinth = 5, door = true, shutters } = {}) {
  const put = frame(batch, x, y, z, yaw, 0, 0, 1);
  const win = frame(windows, x, y, z, yaw, 0, 0, 1);
  const FH = 3.1;
  const jet = timbered ? 0.32 : 0;
  const beam = rand() < 0.3 ? 'beamRed' : 'beam';
  const infill = timbered ? pick(['plaster', 'plaster', 'cream', color], rand) : color;
  const shutter = shutters !== undefined ? shutters : !timbered && rand() < 0.55 ? pick(['shutterGreen', 'shutterRed', 'shutterBlue', 'shutterGreen'], rand) : null;
  put('stoneDark', BOX, 0, -plinth / 2 + 0.3, 0, w + 0.3, plinth + 0.6, d + 0.3);
  put(timbered ? 'stone' : color, BOX, 0, FH / 2, 0, w, FH, d);
  if (!timbered) put('stone', BOX, 0, 0.35, 0, w + 0.12, 0.7, d + 0.12);
  for (let f = 1; f < floors; f++) {
    const o = jet * f;
    put(infill, BOX, 0, f * FH + FH / 2, 0, w + 2 * o, FH, d + 2 * o);
    if (timbered) {
      for (const face of [1, -1]) timberFace(put, beam, w + 2 * o, f * FH, FH, face * (d / 2 + o), face);
      for (const side of [1, -1]) timberSide(put, beam, d + 2 * o, f * FH, FH, side * (w / 2 + o), side);
    } else if (rand() < 0.35) {
      put('stone', BOX, 0, f * FH, 0, w + 0.14, 0.18, d + 0.14);
    }
  }
  const top = floors * FH;
  const o = jet * Math.max(0, floors - 1);
  const half = w / 2 + o;
  const pitch = 1.05 + rand() * 0.35;
  const gh = half * pitch;
  put(infill, GABLE, 0, top, 0, half, gh, d + 2 * o);
  if (timbered) {
    for (const face of [1, -1]) {
      const zf = face * (d / 2 + o + 0.06);
      put(beam, BOX, 0, top + 0.12, zf, w + 2 * o, 0.24, 0.1);
      put(beam, BOX, 0, top + gh * 0.45, zf, half * 1.1, 0.2, 0.1);
      put(beam, BOX, 0, top + gh * 0.36, zf, 0.2, gh * 0.72, 0.1);
      for (const s of [-1, 1]) put(beam, BOX, s * half * 0.5, top + gh * 0.24, zf, 0.18, gh * 0.48, 0.1);
    }
  }
  const eave = half + 0.5;
  const rise = gh * (eave / half);
  const slope = Math.atan2(rise, eave);
  const len = Math.hypot(eave, rise);
  for (const s of [-1, 1]) {
    put(roof, BOX, (-s * eave) / 2, top + gh - rise / 2 + Math.cos(slope) * 0.18, 0, len, 0.32, d + 2 * o + 0.9, 0, 0, s * slope);
  }
  put(roof, BOX, 0, top + gh + 0.2, 0, 0.5, 0.4, d + 2 * o + 0.9);
  for (const face of [1, -1]) {
    const fz = face * (d / 2 + 0.02);
    const rot = face > 0 ? 0 : Math.PI;
    const cols = Math.max(1, Math.floor(w / 2.3));
    for (let f = 0; f < floors; f++) {
      const of = jet * f;
      const wy = f * FH + 1.65;
      for (let c = 0; c < cols; c++) {
        const lx = (c - (cols - 1) / 2) * ((w + 2 * of) / cols);
        if (f === 0 && door && face > 0 && c === Math.floor(cols / 2)) {
          win('door', ROUND, lx, 0.05, fz + face * 0.04, 1.3, 1.6, 0.14, 0, rot);
          continue;
        }
        windowPane(win, 'window', lx, wy, face * (d / 2 + of + 0.03), 0.95, 1.45, rot);
        if (shutter) for (const s of [-1, 1]) win(shutter, BOX, lx + s * 0.95, wy, face * (d / 2 + of + 0.06), 0.55, 1.6, 0.08, 0, rot);
        if (f > 0 && rand() < 0.25) {
          win('flowerBox', BOX, lx, wy - 0.95, face * (d / 2 + of + 0.3), 1.3, 0.35, 0.45, 0, rot);
          for (let k = 0; k < 4; k++) win(rand() < 0.65 ? pick(['flower', 'flowerB'], rand) : 'leafy', BUD, lx - 0.45 + k * 0.3, wy - 0.7, face * (d / 2 + of + 0.32), 0.2, 0.18, 0.2, 0, rot);
        }
      }
    }
    const gz = face * (d / 2 + o + 0.03);
    if (half > 2.6) {
      for (const s of [-1, 1]) windowPane(win, 'window', s * half * 0.32, top + gh * 0.24, gz, 0.8, 1.2, rot);
    }
    windowPane(win, 'window', 0, top + gh * 0.55, gz, 0.7, 0.9, rot);
  }
  const sideCols = Math.max(1, Math.floor(d / 3.2));
  for (const side of [1, -1]) {
    for (let f = 1; f < floors; f++) {
      const of = jet * f;
      for (let c = 0; c < sideCols; c++) {
        if (rand() < 0.4) continue;
        const lz = (c - (sideCols - 1) / 2) * (d / sideCols);
        windowPane(win, 'window', side * (w / 2 + of + 0.03), f * FH + 1.65, lz, 0.9, 1.35, (side * Math.PI) / 2);
      }
    }
  }
  const cx = (rand() - 0.5) * half;
  put('stoneDark', BOX, cx, top + gh * (1 - Math.abs(cx) / half) + 0.6, (rand() - 0.5) * d * 0.5, 0.75, 2.2, 0.75);
  return { x, z, r: Math.max(w, d) / 2 + 1 };
}

export function hoelderlinTower(batch, windows, x, y, z, yaw) {
  const put = frame(batch, x, y, z, yaw, 0, 0, 1);
  const win = frame(windows, x, y, z, yaw, 0, 0, 1);
  const R = 4.4;
  const H = 16.5;
  put('stoneDark', CYL, 0, -2.6, 0, R + 0.6, 6.4, R + 0.6);
  put('stone', CYL, 0, 0.6, 0, R + 0.35, 1.2, R + 0.35);
  put('hoelderlin', CYL, 0, H / 2 + 0.6, 0, R, H, R);
  put('stone', CYL, 0, H + 0.75, 0, R + 0.3, 0.35, R + 0.3);
  put('slate', TOWER_CAP, 0, H + 0.9, 0, R + 0.7, 12, R + 0.7);
  put('slate', CYL, 0, H + 12.8, 0, 0.16, 1.2, 0.16);
  put('gold', BALL, 0, H + 13.6, 0, 0.32, 0.32, 0.32);
  for (const [level, spread] of [[3.4, 1.2], [7.2, 1.5], [10.9, 1.5], [14.5, 1.5]]) {
    for (let k = -1; k <= 1; k++) {
      const a = k * spread * 0.62;
      windowPane(win, 'window', Math.sin(a) * (R + 0.02), level, Math.cos(a) * (R + 0.02), 0.85, 1.45, a);
    }
  }
  const hx = -8.5;
  const hz = -3.5;
  put('hoelderlin', BOX, hx, 6.4, hz, 12, 12.8, 10);
  put('stoneDark', BOX, hx, -2.4, hz, 12.4, 6, 10.4);
  put('roofBrown', GABLE, hx, 12.8, hz, 5.6, 4.6, 12.8, 0, Math.PI / 2);
  for (let k = -4.5; k <= 4.5; k += 2.25) {
    for (const level of [3.4, 6.9, 10.3]) {
      windowPane(win, 'window', hx + k, level, hz + 5.03, 0.85, 1.35, 0);
      for (const s of [-1, 1]) win('shutterGrey', BOX, hx + k + s * 0.8, level, hz + 5.08, 0.5, 1.5, 0.08);
    }
  }
  put('roofBrown', GABLE, hx, 14.6, hz + 3, 1, 1, 1.6);
}

export function burse(batch, windows, x, y, z, yaw) {
  const put = frame(batch, x, y, z, yaw, 0, 0, 1);
  const win = frame(windows, x, y, z, yaw, 0, 0, 1);
  const W = 44;
  const D = 16;
  const H = 12.4;
  put('stoneDark', BOX, 0, -3, 0, W + 0.4, 6.6, D + 0.4);
  put('ochre', BOX, 0, H / 2, 0, W, H, D);
  put('stone', BOX, 0, H + 0.2, 0, W + 0.6, 0.4, D + 0.6);
  put('roof', MANSARD, 0, H + 0.4, 0, W + 0.4, 6.4, D + 0.4);
  for (let k = -W / 2 + 2.2; k <= W / 2 - 2.2; k += 2.75) {
    for (const level of [2.4, 6, 9.6]) windowPane(win, 'window', k, level, D / 2 + 0.03, 1, 1.6, 0);
  }
  for (let k = -W / 2 + 4; k <= W / 2 - 4; k += 4.4) {
    put('ochre', BOX, k, H + 3.3, D / 2 - 1.2, 1.8, 2, 1.4);
    put('roof', GABLE, k, H + 4.3, D / 2 - 1.2, 1.2, 1.1, 1.8);
    windowPane(win, 'window', k, H + 3.2, D / 2 - 0.47, 0.8, 1.1, 0);
  }
}

export function collegiateChurch(batch, windows, x, y, z, yaw) {
  const put = frame(batch, x, y, z, yaw, 0, 0, 1);
  const win = frame(windows, x, y, z, yaw, 0, 0, 1);
  put('sandstoneDark', BOX, 0, -3, 0, 46, 7, 20);
  put('sandstone', BOX, 2, 8, 0, 36, 16, 18);
  put('roofOrange', GABLE, 2, 16, 0, 9.6, 15, 36.6, 0, Math.PI / 2);
  put('sandstone', OCT, 21, 7.4, 0, 7.6, 14.8, 7.6);
  put('roofOrange', OCT_CONE, 21, 19.6, 0, 8.2, 10, 8.2);
  for (let k = -13; k <= 17; k += 5) {
    for (const s of [-1, 1]) {
      put('sandstoneDark', BOX, k, 6, s * 9.4, 1.2, 12, 1.4);
      if (k < 16) win('window', GOTHIC, k + 2.5, 4.4, s * 9.04, 2, 5.2, 0.2, 0, s > 0 ? 0 : Math.PI);
    }
  }
  const tx = -21;
  const top = 32;
  put('sandstone', BOX, tx, top / 2 - 1, 0, 10, top + 2, 10);
  for (const [sx, sz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
    put('sandstoneDark', BOX, tx + sx * 5.2, 7, sz * 5.2, 2, 14, 2, 0, Math.PI / 4);
    put('sandstoneDark', HIP, tx + sx * 5.2, 14, sz * 5.2, 2.2, 3, 2.2);
  }
  for (let f = 0; f < 4; f++) {
    const ry = (f * Math.PI) / 2;
    const fx = Math.sin(ry);
    const fz = Math.cos(ry);
    for (const u of [-1.6, 1.6]) win('window', GOTHIC, tx + fx * 5.04 + fz * u, 18, fz * 5.04 - fx * u, 1.8, 4.6, 0.2, 0, ry);
    win('clockBlue', CYL, tx + fx * 5.08, top - 3.4, fz * 5.08, 1.7, 0.16, 1.7, Math.PI / 2, ry);
    win('gold', CYL, tx + fx * 5.12, top - 3.4, fz * 5.12, 0.5, 0.14, 0.5, Math.PI / 2, ry);
    win('gold', BOX, tx + fx * 5.2, top - 3.0, fz * 5.2, 0.14, 1.2, 0.06, 0, ry);
    for (let k = -4.6; k <= 4.6; k += 0.92) put('sandstone', BOX, tx + fx * 5.3 + fz * k, top + 0.75, fz * 5.3 - fx * k, 0.28, 1, 0.28);
  }
  put('sandstoneDark', BOX, tx, top - 0.1, 0, 11.2, 0.5, 11.2);
  put('sandstoneDark', BOX, tx, top + 1.35, 0, 11, 0.25, 11);
  put('sandstone', OCT, tx, top + 3.4, 0, 3.9, 6.8, 3.9);
  for (let k = 0; k < 8; k += 2) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
    win('shutterRed', BOX, tx + Math.sin(a) * 3.62, top + 3.6, Math.cos(a) * 3.62, 1, 1.5, 0.12, 0, a);
  }
  for (const [sx, sz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) put('slate', OCT_CONE, tx + sx * 4.4, top + 3.6, sz * 4.4, 0.45, 4, 0.45);
  put('slate', SPIRE, tx, top + 6.8, 0, 4.4, 20, 4.4);
  put('slate', OCT, tx, top + 27.4, 0, 0.75, 1.8, 0.75);
  put('slate', OCT_CONE, tx, top + 29.6, 0, 0.8, 2.8, 0.8);
  put('gold', BALL, tx, top + 31.3, 0, 0.32, 0.32, 0.32);
  put('ironDark', CYL, tx, top + 32.3, 0, 0.07, 1.8, 0.07);
  put('door', GOTHIC, tx, 0, 5.05, 2.4, 3, 0.2);
}

export function castle(batch, windows, x, y, z, yaw) {
  const put = frame(batch, x, y, z, yaw, 0, 0, 1);
  const win = frame(windows, x, y, z, yaw, 0, 0, 1);
  const W = 56;
  const D = 42;
  const T = 11;
  const H = 14;
  put('stoneDark', BOX, 0, -4, 0, W + 8, 8.6, D + 8);
  put('stone', BOX, 0, 0.25, 0, W + 8.4, 0.5, D + 8.4);
  const wings = [
    [0, D / 2 - T / 2, W, T, 0],
    [0, -D / 2 + T / 2, W, T, 0],
    [W / 2 - T / 2, 0, T, D - 2 * T, 1],
    [-W / 2 + T / 2, 0, T, D - 2 * T, 1],
  ];
  for (const [cx, cz, w, d, turned] of wings) {
    put('castle', BOX, cx, H / 2, cz, w, H, d);
    const span = turned ? w : d;
    const along = turned ? d + 2 * T : w;
    put('roof', GABLE, cx, H, cz, span / 2 + 0.4, span * 0.75, along + (turned ? -T * 2 + 0.2 : 0.8), 0, turned ? 0 : Math.PI / 2);
    put('stone', BOX, cx, H, cz, w + 0.3, 0.35, d + 0.3);
  }
  for (const face of [1, -1]) {
    for (let k = -W / 2 + 3.5; k <= W / 2 - 3.5; k += 3.5) {
      for (const level of [4, 8.4, 12]) windowPane(win, 'window', k, level, face * (D / 2 + 0.03), 1, 1.8, face > 0 ? 0 : Math.PI);
    }
    for (let k = -D / 2 + 3.5; k <= D / 2 - 3.5; k += 3.5) {
      for (const level of [4, 8.4, 12]) windowPane(win, 'window', face * (W / 2 + 0.03), level, k, 1, 1.8, (face * Math.PI) / 2);
    }
    for (let k = -W / 2 + 6; k <= W / 2 - 6; k += 10) {
      put('castle', BOX, k, H + 3, face * (D / 2 - 0.6), 2.4, 3, 2.2);
      put('roof', GABLE, k, H + 4.5, face * (D / 2 - 0.6), 1.5, 1.6, 2.6);
      windowPane(win, 'window', k, H + 3, face * (D / 2 + 0.53), 0.8, 1.2, face > 0 ? 0 : Math.PI);
    }
  }
  for (const [cx, cz, r, h, cap] of [[W / 2, D / 2, 7, 22, 'cone'], [-W / 2, D / 2, 6.4, 20, 'bell'], [-W / 2, -D / 2, 6, 18, 'cone']]) {
    put('castle', CYL, cx, h / 2, cz, r, h, r);
    put('stone', CYL, cx, h, cz, r + 0.3, 0.5, r + 0.3);
    if (cap === 'cone') put('roof', CONE, cx, h + 4.4, cz, r + 0.6, 8.8, r + 0.6);
    else {
      put('copper', BALL, cx, h + 1, cz, r * 0.85, r * 0.75, r * 0.85);
      put('copper', CYL, cx, h + 5.6, cz, 1.3, 2.6, 1.3);
      put('copper', CONE, cx, h + 8.4, cz, 1.6, 3, 1.6);
    }
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 3) {
      for (const level of [6, 12, h - 3]) windowPane(win, 'window', cx + Math.sin(a) * (r + 0.02), level, cz + Math.cos(a) * (r + 0.02), 0.9, 1.6, a);
    }
  }
  const gx = W / 2 + 3;
  put('castle', BOX, gx, 9, -4, 8, 18, 9);
  put('roof', HIP, gx, 18, -4, 8.4, 6, 9.4);
  put('sandstone', BOX, gx + 4.05, 5.5, -4, 0.4, 9, 6.2);
  put('door', ROUND, gx + 4.3, 0, -4, 3.4, 3.4, 0.3, 0, Math.PI / 2);
  for (const s of [-1, 1]) {
    put('sandstoneDark', CYL, gx + 4.5, 4.5, -4 + s * 2.6, 0.4, 9, 0.4);
    put('sandstone', BOX, gx + 4.5, 9.6, -4 + s * 2.4, 0.9, 1.2, 0.9);
  }
  put('gold', BOX, gx + 4.35, 7.6, -4, 0.2, 1.6, 2.8);
  put('ironDark', CYL, 0, H + 16, -D / 2 + T / 2, 0.08, 8, 0.08);
  put('gold', BOX, 0, H + 18.6, -D / 2 + T / 2 + 1.1, 0.06, 1, 2.2);
  put('shutterRed', BOX, 0, H + 17.6, -D / 2 + T / 2 + 1.1, 0.06, 1, 2.2);
}

export function planeTree(batch, x, y, z, rand, s = 1) {
  const put = frame(batch, x, y, z, rand() * 6.3, (rand() - 0.5) * 0.08, (rand() - 0.5) * 0.08, s);
  const h = 13 + rand() * 3;
  put('planeBark', TRUNK, 0, -0.5, 0, 0.62, h + 0.5, 0.62);
  for (let k = 0; k < 9; k++) {
    const a = rand() * Math.PI * 2;
    const py = 0.6 + rand() * (h - 1);
    const r = 0.6 * (1 - (py / h) * 0.3);
    put(pick(['planePatch', 'planePatch', 'planeDark'], rand), BUD, Math.sin(a) * r * 0.92, py, Math.cos(a) * r * 0.92, 0.2, 0.32 + rand() * 0.3, 0.2, 0, a);
  }
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + rand();
    put('planeBark', TRUNK, Math.sin(a) * 0.2, h - 0.8, Math.cos(a) * 0.2, 0.26, 5.2, 0.26, Math.cos(a) * 0.45, 0, -Math.sin(a) * 0.45);
  }
  const leaves = ['plane', 'planeLight', 'plane', 'leafA'];
  put(pick(leaves, rand), LOW_BALL, 0, h + 5.4, 0, 4.8, 3.4, 4.8);
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + rand() * 0.8;
    const d = 2.6 + rand() * 1.2;
    put(pick(leaves, rand), LOW_BALL, Math.sin(a) * d, h + 3.6 + rand() * 2, Math.cos(a) * d, 2.8 + rand(), 2.4 + rand() * 0.6, 2.8 + rand());
  }
  return { height: (h + 9) * s };
}

const CROWN_TOP = 0.66;
const CROWN_RISE = 0.3;
const CROWN_REACH = 0.8;

function lumpGeometry(seed, [light, mid, dark]) {
  const rand = mulberry32(seed);
  const geometry = new THREE.SphereGeometry(1, 20, 12);
  const pos = geometry.attributes.position;
  const phase = Array.from({ length: 4 }, () => rand() * 6);
  const top = new THREE.Color(light);
  const body = new THREE.Color(mid);
  const under = new THREE.Color(dark);
  const c = new THREE.Color();
  const colors = [];
  for (let k = 0; k < pos.count; k++) {
    const x = pos.getX(k);
    const y = pos.getY(k);
    const z = pos.getZ(k);
    const lump = 1 + 0.09 * Math.sin(x * 4.5 + phase[0]) * Math.sin(z * 4.5 + phase[1]) + 0.06 * Math.sin(y * 6 + x * 3 + phase[2]) + 0.04 * Math.sin(z * 11 + phase[3]);
    pos.setXYZ(k, x * lump, y * lump, z * lump);
    const t = (y + 1) / 2;
    c.copy(under).lerp(body, Math.min(1, t * 1.6)).lerp(top, Math.max(0, (t - 0.55) / 0.45) * 0.85);
    colors.push(c.r, c.g, c.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function strandsGeometry(seed, [light, mid, dark]) {
  const rand = mulberry32(seed);
  const positions = [];
  const colors = [];
  const index = [];
  const tipColor = new THREE.Color(light);
  const body = new THREE.Color(mid);
  const shade = new THREE.Color(dark);
  const base = new THREE.Color();
  const c = new THREE.Color();
  const EDGE = 1.42;
  const strand = (a, phi, inset, tip, bow, width, tone) => {
    const path = [phi, (phi + EDGE) / 2].map((p) => [CROWN_REACH * Math.sin(p) * inset * 1.03, CROWN_TOP + CROWN_RISE * Math.cos(p), 0]);
    const re = CROWN_REACH * Math.sin(EDGE) * inset * 1.03;
    const ye = CROWN_TOP + CROWN_RISE * Math.cos(EDGE);
    for (let r = 0; r < 4; r++) {
      const t = r / 3;
      path.push([re + bow * (1 - (1 - t) ** 3), ye - (ye - tip) * t ** 1.1, t]);
    }
    const sa = Math.sin(a);
    const ca = Math.cos(a);
    const first = positions.length / 3;
    base.copy(body).lerp(tipColor, tone);
    path.forEach(([rad, y, t], r) => {
      const w = width * (1 - 0.7 * (r / (path.length - 1)));
      const sway = 0.012 * Math.sin(t * 5 + a * 7);
      const cx = sa * rad + ca * sway;
      const cz = ca * rad - sa * sway;
      for (let s = 0; s < 3; s++) {
        const q = a + (s / 3) * Math.PI * 2;
        positions.push(cx + Math.sin(q) * w, y, cz + Math.cos(q) * w);
      }
      if (r < 2) c.copy(base).lerp(tipColor, 0.4);
      else c.copy(shade).lerp(base, Math.min(1, 0.45 + t * 1.2)).lerp(tipColor, t * t * 0.3 * inset);
      for (let s = 0; s < 3; s++) colors.push(c.r, c.g, c.b);
    });
    for (let r = 0; r < path.length - 1; r++) {
      for (let s = 0; s < 3; s++) {
        const a0 = first + r * 3 + s;
        const a1 = first + r * 3 + ((s + 1) % 3);
        index.push(a0, a0 + 3, a1 + 3, a0, a1 + 3, a1);
      }
    }
    const end = first + (path.length - 1) * 3;
    index.push(end, end + 2, end + 1);
  };
  const clumps = 64;
  for (let q = 0; q < clumps; q++) {
    const a = (q / clumps) * Math.PI * 2 + (rand() - 0.5) * 0.08;
    const phi = 0.45 + rand() * 0.75;
    const reach = 0.02 + rand() * 0.26;
    const tone = rand();
    const count = 3 + Math.floor(rand() * 2);
    for (let k = 0; k < count; k++) {
      strand(a + (rand() - 0.5) * 0.09, phi + (rand() - 0.5) * 0.2, 1, reach + rand() * 0.1, 0.05 + rand() * 0.08, 0.03 + rand() * 0.012, tone * 0.7 + rand() * 0.3);
    }
  }
  for (let q = 0; q < 30; q++) {
    strand(rand() * Math.PI * 2, 0.5 + rand() * 0.5, 0.8, 0.12 + rand() * 0.25, 0.04, 0.034, rand() * 0.3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}

const WILLOW_GREENS = [
  [0xd4ea84, 0x9cc955, 0x4b7a2a],
  [0xc8e275, 0x8fbd4b, 0x46732a],
  [0xdcec8c, 0xa6cf5c, 0x55852f],
];
const LUMPS = WILLOW_GREENS.map((greens, k) => lumpGeometry(11 + k * 13, greens));
const STRANDS = WILLOW_GREENS.map((greens, k) => strandsGeometry(17 + k * 19, greens));

export function willow(batch, x, y, z, rand, s = 1) {
  const put = frame(batch, x, y, z, rand() * 6.3, (rand() - 0.5) * 0.1, (rand() - 0.5) * 0.1, s);
  const R = 5.6 + rand() * 1.2;
  const top = 12 + rand() * 1.5;
  const crownY = top * CROWN_TOP;
  put('bark', TRUNK, 0, -0.5, 0, 0.95, crownY * 0.42, 0.95);
  const limbs = 4 + Math.floor(rand() * 2);
  for (let k = 0; k < limbs; k++) {
    const a = (k / limbs) * Math.PI * 2 + rand() * 0.6;
    const lean = 0.55 + rand() * 0.35;
    put('bark', TRUNK, 0, crownY * 0.36, 0, 0.38, crownY * 0.75, 0.38, Math.cos(a) * lean, 0, -Math.sin(a) * lean);
  }
  const shade = pick(LUMPS, rand);
  put('willow', shade, 0, crownY * 0.82, 0, R * 0.62, top * 0.28, R * 0.62);
  put('willow', pick(LUMPS, rand), 0, crownY + top * 0.08, 0, R * CROWN_REACH * 0.92, top * CROWN_RISE * 0.95, R * CROWN_REACH * 0.92, 0, rand() * 6);
  const lumps = 5 + Math.floor(rand() * 3);
  for (let k = 0; k < lumps; k++) {
    const a = (k / lumps) * Math.PI * 2 + rand() * 0.5;
    const d = R * (0.36 + rand() * 0.2);
    const r = R * (0.3 + rand() * 0.12);
    put('willow', pick(LUMPS, rand), Math.sin(a) * d, crownY + top * (0.12 + rand() * 0.1), Math.cos(a) * d, r, r * 0.75, r, 0, rand() * 6);
  }
  put('willowStrand', pick(STRANDS, rand), 0, 0, 0, R, top, R, 0, rand() * 6);
  return { height: (top + 0.5) * s };
}

export function leafyTree(batch, x, y, z, rand, s = 1) {
  const put = frame(batch, x, y, z, rand() * 6.3, (rand() - 0.5) * 0.1, (rand() - 0.5) * 0.1, s);
  const h = 3.2 + rand() * 1.5;
  put('bark', TRUNK, 0, -0.5, 0, 0.45, h + 1.5, 0.45);
  const leaves = ['leafA', 'leafB', 'leafC', 'leafD'];
  put(pick(leaves, rand), LOW_BALL, 0, h + 2.4, 0, 3, 2.7, 3);
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + rand();
    put(pick(leaves, rand), LOW_BALL, Math.sin(a) * 1.8, h + 1.6 + rand() * 1.4, Math.cos(a) * 1.8, 1.9 + rand() * 0.6, 1.7, 1.9 + rand() * 0.6);
  }
  return { height: (h + 5) * s };
}

export function fruitTree(batch, x, y, z, rand) {
  const put = frame(batch, x, y, z, rand() * 6.3, 0, 0, 0.8 + rand() * 0.3);
  put('bark', TRUNK, 0, -0.4, 0, 0.32, 2.4, 0.32);
  put(pick(['leafB', 'leafD'], rand), LOW_BALL, 0, 3.2, 0, 2.4, 1.8, 2.4);
  for (let k = 0; k < 5; k++) {
    const a = rand() * Math.PI * 2;
    put(rand() < 0.5 ? 'shirtA' : 'flowerB', BUD, Math.sin(a) * 2.1, 2.6 + rand() * 1.2, Math.cos(a) * 2.1, 0.22, 0.22, 0.22);
  }
}

export function chapel(batch, windows, x, y, z, yaw) {
  const put = frame(batch, x, y, z, yaw, 0, 0, 1);
  const win = frame(windows, x, y, z, yaw, 0, 0, 1);
  put('stoneDark', BOX, 0, -2, 0, 9, 4.4, 17);
  put('chapel', BOX, 0, 3.4, 1.5, 8, 6.8, 13);
  put('roof', GABLE, 0, 6.8, 1.5, 4.5, 5, 13.6);
  put('chapel', OCT, 0, 3.4, 8, 4, 6.8, 4);
  put('roof', OCT_CONE, 0, 8.6, 8, 4.4, 3.6, 4.4);
  put('chapel', BOX, 0, 6.5, -6, 4.4, 13, 4.4);
  put('roof', HIP, 0, 13, -6, 5.6, 5.6, 5.6);
  put('gold', BALL, 0, 18.8, -6, 0.3, 0.3, 0.3);
  for (const s of [-1, 1]) for (const k of [-2, 2.5, 7]) win('window', ROUND, s * 4.02, 2.2, k, 1, 1.6, 0.16, 0, s * Math.PI / 2);
  win('door', ROUND, 0, 0, -8.25, 1.4, 1.8, 0.2, 0, Math.PI);
  win('window', ROUND, 0, 9.6, -8.25, 0.8, 1.2, 0.2, 0, Math.PI);
}

export function aula(batch, windows, x, y, z, yaw) {
  const put = frame(batch, x, y, z, yaw, 0, 0, 1);
  const win = frame(windows, x, y, z, yaw, 0, 0, 1);
  const W = 62;
  const D = 18;
  const H = 15;
  put('stoneDark', BOX, 0, -2.5, 0, W + 1, 5.6, D + 1);
  put('aula', BOX, 0, H / 2, 0, W, H, D);
  put('stone', BOX, 0, H + 0.3, 0, W + 0.8, 0.6, D + 0.8);
  put('roofDark', HIP, 0, H + 0.6, 0, W * 0.98, 5, D + 0.6);
  put('stone', BOX, 0, 4.9, D / 2 + 0.05, W, 0.3, 0.2);
  for (let k = -W / 2 + 3; k <= W / 2 - 3; k += 3.4) {
    if (Math.abs(k) < 9) continue;
    windowPane(win, 'window', k, 2.4, D / 2 + 0.03, 1.4, 2.6, 0);
    windowPane(win, 'window', k, 8.4, D / 2 + 0.03, 1.4, 3, 0);
    windowPane(win, 'window', k, 12.6, D / 2 + 0.03, 1.2, 1.6, 0);
  }
  const front = D / 2;
  put('aula', BOX, 0, H / 2 + 0.6, front + 0.8, 18, H + 1.2, 1.6);
  for (let k = 0; k < 4; k++) put('stone', BOX, 0, 0.2 + k * 0.3, front + 4.6 + (3 - k) * 0.7, 20, 0.3, 0.7 + (3 - k) * 1.4);
  put('stone', BOX, 0, 1.3, front + 4.4, 17, 0.4, 7);
  for (let k = -3; k <= 3; k += 1.2) {
    const cx = (k / 3) * 7.2;
    put('stone', CYL, cx, 1.5 + 5.5, front + 6.6, 0.55, 11, 0.55);
    put('stone', BOX, cx, 12.7, front + 6.6, 1.5, 0.5, 1.5);
  }
  put('stone', BOX, 0, 13.3, front + 4.6, 17.4, 0.9, 5.2);
  put('aula', GABLE, 0, 13.75, front + 4.6, 8.9, 3.6, 5.4);
  put('roofDark', GABLE, 0, 13.9, front + 4.4, 9.4, 3.9, 5.6);
  for (const s of [-1, 1]) win('door', ROUND, s * 2.6, 1.5, front + 1.65, 1.6, 2.4, 0.16);
  win('door', ROUND, 0, 1.5, front + 1.65, 2.2, 3, 0.16);
}

export function townHall(batch, windows, x, y, z, yaw) {
  const put = frame(batch, x, y, z, yaw, 0, 0, 1);
  const win = frame(windows, x, y, z, yaw, 0, 0, 1);
  const W = 18;
  const D = 16;
  const H = 13;
  put('stoneDark', BOX, 0, -2.5, 0, W + 0.4, 5.6, D + 0.4);
  put('apricot', BOX, 0, H / 2, 0, W, H, D);
  put('apricot', GABLE, 0, H, 0, W / 2, 11, D);
  put('roofDark', BOX, -W / 4 - 0.3, H + 5.6, 0, Math.hypot(W / 2 + 0.6, 12) - 0.4, 0.34, D + 0.8, 0, 0, Math.atan2(12, W / 2 + 0.6));
  put('roofDark', BOX, W / 4 + 0.3, H + 5.6, 0, Math.hypot(W / 2 + 0.6, 12) - 0.4, 0.34, D + 0.8, 0, 0, -Math.atan2(12, W / 2 + 0.6));
  for (let k = 0; k < 3; k++) put(['shutterRed', 'shutterGreen', 'gold'][k], BOX, 0, 3.6 + k * 3.6, D / 2 + 0.04, W, 0.4, 0.08);
  for (let k = -3; k <= 3; k++) {
    windowPane(win, 'window', k * 2.4, 5.5, D / 2 + 0.05, 1.2, 2, 0);
    windowPane(win, 'window', k * 2.4, 9.3, D / 2 + 0.05, 1.2, 2, 0);
  }
  for (let k = 0; k < 5; k++) win('door', ROUND, (k - 2) * 3.4, 0, D / 2 + 0.06, 2.4, 2.4, 0.16);
  put('stoneDark', BOX, 0, 7.4, D / 2 + 1.2, W - 2, 0.3, 2.4);
  for (let k = -W / 2 + 1.5; k <= W / 2 - 1.5; k += 0.7) put('ironDark', BOX, k, 8, D / 2 + 2.3, 0.06, 1, 0.06);
  put('gold', CYL, 0, H + 3.4, D / 2 + 0.1, 2.3, 0.2, 2.3, Math.PI / 2);
  put('clockFace', CYL, 0, H + 3.4, D / 2 + 0.2, 1.9, 0.2, 1.9, Math.PI / 2);
  put('ironDark', BOX, 0, H + 3.8, D / 2 + 0.34, 0.16, 1.4, 0.08);
  put('ironDark', BOX, 0.4, H + 3.4, D / 2 + 0.34, 1, 0.14, 0.08);
  for (const [k, c] of [[-1, 'shirtB'], [1, 'shirtA']]) put(c, CYL, k * 3.4, H + 1.4, D / 2 + 0.1, 1.2, 0.2, 1.2, Math.PI / 2);
  put('stone', BOX, 0, H + 11.4, 0, 1.6, 2.6, 1.6);
  put('slate', OCT_CONE, 0, H + 14, 0, 1.4, 2.6, 1.4);
  put('gold', BALL, 0, H + 15.5, 0, 0.3, 0.3, 0.3);
}

export function bench(batch, x, y, z, yaw) {
  const put = frame(batch, x, y, z, yaw, 0, 0, 1);
  put('bench', BOX, 0, 0.75, 0, 2.6, 0.12, 0.7);
  put('bench', BOX, 0, 1.2, -0.32, 2.6, 0.6, 0.1);
  for (const s of [-1, 1]) put('ironDark', BOX, s * 1.1, 0.4, 0, 0.12, 0.8, 0.7);
}

export function lamp(batch, x, y, z) {
  const put = frame(batch, x, y, z, 0, 0, 0, 1);
  put('ironDark', CYL, 0, 0.3, 0, 0.22, 0.6, 0.22);
  put('ironDark', CYL, 0, 2.2, 0, 0.09, 3.8, 0.09);
  put('ironDark', CYL, 0, 4.15, 0, 0.18, 0.2, 0.18);
  put('lampGlass', BALL, 0, 4.75, 0, 0.6, 0.6, 0.6);
}

export function shed(batch, x, y, z, yaw, rand) {
  const put = frame(batch, x, y, z, yaw, 0, 0, 1);
  const c = pick(['shed', 'shedB', 'shedC'], rand);
  put('stoneDark', BOX, 0, -0.8, 0, 3.4, 2, 2.8);
  put(c, BOX, 0, 1.2, 0, 3.2, 2.4, 2.6);
  put('roofDark', GABLE, 0, 2.4, 0, 1.9, 1.2, 3.2, 0, Math.PI / 2);
  put('door', BOX, 0.6, 0.9, 1.32, 0.9, 1.8, 0.06);
  put('window', BOX, -0.8, 1.4, 1.32, 0.8, 0.7, 0.06);
  put('frameWhite', BOX, -0.8, 1.4, 1.31, 1, 0.9, 0.04);
}

export const PUNT_LENGTH = 13;
export const PUNT_WIDTH = 2.6;
const PUNT_RAKE = 1.4;
const PUNT_KEEL = -0.3;
const PUNT_RIM = 0.78;
const PUNT_DECK = 1.5;
const PUNT_STRIPES = ['shutterGreen', 'shutterRed', 'shutterBlue', 'ochre', 'frameWhite', 'clockBlue'];
const CUSHIONS = ['shutterRed', 'shutterGreen', 'shutterBlue', 'ochre', 'frameWhite', 'flowerC'];
const HULL_SIDE = new THREE.ExtrudeGeometry(
  new THREE.Shape([[-PUNT_LENGTH / 2 + PUNT_RAKE, PUNT_KEEL], [PUNT_LENGTH / 2 - PUNT_RAKE, PUNT_KEEL], [PUNT_LENGTH / 2, PUNT_RIM], [-PUNT_LENGTH / 2, PUNT_RIM]].map(([u, v]) => new THREE.Vector2(u, v))),
  { depth: 1, bevelEnabled: false },
).translate(0, 0, -0.5).rotateY(Math.PI / 2);
const PENNANT = new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(0, 1), new THREE.Vector2(1, 0.5)]), { depth: 1, bevelEnabled: false }).translate(0, 0, -0.5).rotateY(Math.PI / 2);

export function punt(batch, x, y, z, yaw, rand, { cover = false } = {}) {
  const put = frame(batch, x, y, z, yaw, 0, 0, 1);
  const L = PUNT_LENGTH;
  const W = PUNT_WIDTH;
  const flat = L - PUNT_RAKE * 2;
  const rake = Math.atan2(PUNT_RIM - PUNT_KEEL, PUNT_RAKE);
  const slope = Math.hypot(PUNT_RIM - PUNT_KEEL, PUNT_RAKE);
  const stripe = pick(PUNT_STRIPES, rand);
  put('puntDark', BOX, 0, PUNT_KEEL + 0.07, 0, W - 0.2, 0.14, flat);
  put('puntFloor', BOX, 0, PUNT_KEEL + 0.16, 0, W - 0.5, 0.06, flat - 0.4);
  for (const s of [-1, 1]) {
    put('puntWood', HULL_SIDE, s * (W / 2 - 0.07), 0, 0, 0.14, 1, 1);
    put(stripe, BOX, s * (W / 2 + 0.005), 0.46, 0, 0.03, 0.2, L - 0.55);
    put('puntDark', BOX, s * (W / 2 + 0.005), 0.22, 0, 0.03, 0.06, L - 0.95);
    put('puntDark', BOX, s * (W / 2 - 0.05), PUNT_RIM + 0.05, 0, 0.26, 0.1, L + 0.06);
    put('puntWood', BOX, 0, (PUNT_KEEL + PUNT_RIM) / 2, s * (L / 2 - PUNT_RAKE / 2), W - 0.12, 0.12, slope, -s * rake);
    put('puntSeat', BOX, 0, PUNT_RIM - 0.02, s * (L / 2 - PUNT_DECK / 2), W - 0.14, 0.1, PUNT_DECK);
    put('puntDark', BOX, 0, PUNT_RIM + 0.04, s * (L / 2 - PUNT_DECK), W - 0.14, 0.08, 0.12);
    put('puntDark', BOX, 0, PUNT_RIM - 0.02, s * (L / 2 + 0.02), W + 0.04, 0.14, 0.12);
    for (let r = -flat / 2 + 0.6; r < flat / 2 - 0.3; r += 1.1) put('puntDark', BOX, s * (W / 2 - 0.17), 0.2, r, 0.06, 0.95, 0.1);
    const seat = L - PUNT_DECK * 2 - 0.5;
    put('puntSeat', BOX, s * (W / 2 - 0.45), 0.3, 0, 0.5, 0.1, seat);
    put('puntDark', BOX, s * (W / 2 - 0.45), 0.08, 0, 0.42, 0.36, 0.1);
    put('puntSeat', BOX, s * (W / 2 - 0.22), 0.62, 0, 0.07, 0.42, seat, 0, 0, s * 0.18);
    if (!cover) {
      for (let c = -seat / 2 + 0.75; c < seat / 2 - 0.6; c += 1.3) {
        if (rand() < 0.35) continue;
        put(pick(CUSHIONS, rand), BOX, s * (W / 2 - 0.47), 0.4, c, 0.42, 0.1, 1.05);
      }
    }
  }
  if (cover) {
    const span = L - PUNT_DECK * 2 + 0.2;
    put('tarp', BOX, 0, PUNT_RIM + 0.12, 0, W + 0.08, 0.1, span);
    put('tarp', CYL, 0, PUNT_RIM + 0.16, 0, 0.5, span, 0.12, Math.PI / 2);
    for (let c = -span / 2 + 1; c < span / 2; c += 2) put('ironDark', BOX, 0, PUNT_RIM + 0.12, c, W + 0.14, 0.04, 0.06);
  } else {
    put('puntDark', BOX, 0, 0.62, 0.3, 0.6, 0.06, 2.6);
    for (const c of [-0.8, 1.4]) put('puntDark', BOX, 0, 0.22, c, 0.1, 0.8, 0.1);
    for (let k = 0; k < 3; k++) put(pick(['shutterGreen', 'ochre', 'frameWhite'], rand), CYL, (rand() - 0.5) * 0.3, 0.8, -0.4 + k * 0.7 + rand() * 0.2, 0.07, 0.32, 0.07);
    put('straw', BOX, 0.05, 0.76, 1.3, 0.42, 0.28, 0.5);
  }
  put('ironDark', CYL, 0, PUNT_RIM + 0.85, L / 2 - 0.45, 0.04, 1.6, 0.04);
  put(stripe === 'frameWhite' ? 'shutterRed' : stripe, PENNANT, 0, PUNT_RIM + 1.15, L / 2 - 0.45, 0.02, 0.45, 0.8);
}

function flowerBox(put, x0, x1, y, z, face, rand) {
  const len = x1 - x0;
  put('flowerBox', BOX, (x0 + x1) / 2, y, z, len, 0.7, 0.8);
  put('planter', BOX, (x0 + x1) / 2, y + 0.42, z + face * 0.05, len, 0.3, 0.9);
  for (let k = x0 + 0.3; k < x1 - 0.2; k += 0.4) {
    const c = pick(FLOWERS, rand);
    put('trail', BUD, k, y + 0.5, z, 0.42, 0.3, 0.5);
    put(c, BUD, k + (rand() - 0.5) * 0.3, y + 0.75 + rand() * 0.2, z + (rand() - 0.5) * 0.5, 0.24, 0.2, 0.24);
    if (rand() < 0.6) put(pick(FLOWERS, rand), BUD, k + 0.25, y + 0.68, z + face * 0.3, 0.2, 0.18, 0.2);
    if (rand() < 0.75) put(pick(['trail', 'trail', 'trailDark', c], rand), BUD, k + 0.2, y - 0.2 - rand() * 0.8, z + face * 0.5, 0.18, 0.5 + rand() * 0.7, 0.16);
  }
}

function lampBasket(put, lx, y, lz, rand) {
  put('ironDark', CYL, lx, y + 2.7, lz, 0.13, 5.4, 0.13);
  put('ironDark', BOX, lx, y + 5.3, lz, 0.1, 0.1, 1.8);
  for (const s of [-1, 1]) {
    put('lampGlass', BALL, lx, y + 5, lz + s * 0.9, 0.42, 0.42, 0.42);
    put('ironDark', CYL, lx, y + 5.45, lz + s * 0.9, 0.3, 0.1, 0.3);
  }
  put('trail', LOW_BALL, lx, y + 3.3, lz, 0.85, 0.7, 0.85);
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    const r = 0.75 + rand() * 0.15;
    put(pick(FLOWERS, rand), BUD, lx + Math.sin(a) * r, y + 3.2 + (rand() - 0.4) * 0.8, lz + Math.cos(a) * r, 0.2, 0.2, 0.2);
  }
  for (let k = 0; k < 6; k++) {
    const a = rand() * Math.PI * 2;
    put('trailDark', BUD, lx + Math.sin(a) * 0.7, y + 2.4 - rand() * 0.6, lz + Math.cos(a) * 0.7, 0.14, 0.6, 0.14);
  }
}

export function archBridge(batch, track, idx, spans, { deck = 9.5, width = 17, from, to, rand, body = 'concrete', trim = 'concreteDark', flowers = true }) {
  const i = track.norm(idx);
  const pts = [new THREE.Vector2(from, -4.5), new THREE.Vector2(from, deck)];
  pts.push(new THREE.Vector2(to, deck), new THREE.Vector2(to, -4.5));
  const arch = (s, u) => s.spring + (s.crown - s.spring) * (1 - (u / s.half) ** 2);
  for (const s of [...spans].sort((a, b) => b.center - a.center)) {
    pts.push(new THREE.Vector2(s.center + s.half, -4.5));
    for (let k = 0; k <= 24; k++) {
      const u = s.half - (2 * s.half * k) / 24;
      pts.push(new THREE.Vector2(s.center + u, arch(s, u)));
    }
    pts.push(new THREE.Vector2(s.center - s.half, -4.5));
  }
  const shape = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: width, bevelEnabled: false }).translate(0, 0, -width / 2);
  const p = track.point(i);
  const yaw = track.heading(i);
  const put = frame(batch, p.x, 0, p.z, yaw, 0, 0, 1);
  put(body, shape, 0, 0, 0, 1, 1, 1);
  for (const s of spans) {
    for (const side of [-1, 1]) {
      for (let k = 0; k < 24; k++) {
        const u0 = s.half - (2 * s.half * k) / 24;
        const u1 = s.half - (2 * s.half * (k + 1)) / 24;
        const y0 = arch(s, u0);
        const y1 = arch(s, u1);
        put(trim, BOX, s.center + (u0 + u1) / 2, (y0 + y1) / 2 + 0.35, side * (width / 2 + 0.06), Math.hypot(u1 - u0, y1 - y0) + 0.05, 0.7, 0.14, 0, 0, Math.atan2(y1 - y0, u1 - u0));
      }
    }
  }
  const span = to - from;
  for (const side of [-1, 1]) {
    const edge = side * (width / 2);
    put(trim, BOX, (from + to) / 2, deck - 0.45, edge + side * 0.1, span, 0.9, 0.3);
    for (let k = from + 0.4; k < to; k += 1.6) put('ironDark', BOX, k, deck + 0.6, edge - side * 0.2, 0.08, 1.2, 0.08);
    put('ironDark', BOX, (from + to) / 2, deck + 1.2, edge - side * 0.2, span, 0.1, 0.12);
    if (!flowers) continue;
    for (let k = from + 2; k < to - 4; k += 5.5) flowerBox(put, k, k + 5, deck + 0.75, edge + side * 0.45, side, rand);
    for (let k = from + 6; k < to - 3; k += 14) lampBasket(put, k, deck, edge - side * 0.6, rand);
  }
  if (flowers) {
    put('asphalt', BOX, (from + to) / 2, deck + 0.02, 0, span, 0.06, width - 6);
    for (const side of [-1, 1]) put('stone', BOX, (from + to) / 2, deck + 0.12, side * (width / 2 - 1.5), span, 0.22, 3);
    for (let k = from + 3; k < to - 3; k += 6) put('frameWhite', BOX, k, deck + 0.06, 0, 3, 0.04, 0.2);
  }
  return { x: p.x, z: p.z, yaw };
}

export function station(batch, windows, x, y, z, yaw) {
  const put = frame(batch, x, y, z, yaw, 0, 0, 1);
  const win = frame(windows, x, y, z, yaw, 0, 0, 1);
  put('stoneDark', BOX, 0, -2, 0, 74, 4.6, 15);
  put('cream', BOX, 0, 4.5, 0, 72, 9, 14);
  put('roof', HIP, 0, 9, 0, 72.5, 4.5, 14.6);
  put('cream', BOX, 0, 7, 0, 18, 14, 16);
  put('roofDark', HIP, 0, 14, 0, 18.6, 5, 16.6);
  for (let k = -32; k <= 32; k += 3.2) {
    if (Math.abs(k) < 9) continue;
    for (const level of [2.6, 6.4]) windowPane(win, 'window', k, level, 7.03, 1.2, 1.9, 0);
  }
  for (const k of [-5.4, 0, 5.4]) windowPane(win, 'window', k, 7.5, 8.03, 3.4, 7, 0);
  put('stone', BOX, 0, 12.2, 8.06, 17.4, 0.6, 0.2);
  put('clockFace', CYL, 0, 15.2, 7.4, 1.5, 0.2, 1.5, Math.PI / 2);
  put('ironDark', BOX, 0, 15.5, 7.55, 0.14, 1.1, 0.06);
  put('ironDark', BOX, 0.35, 15.2, 7.55, 0.8, 0.12, 0.06);
  put('shirtB', BOX, 0, 10.6, 8.2, 9, 1.2, 0.2);
  put('frameWhite', BOX, 0, 10.6, 8.32, 8, 0.4, 0.06);
  for (const side of [-1, 1]) {
    put('stone', BOX, 0, 0.4, side * 14 - 7, 80, 0.8, 5);
    for (let k = -36; k <= 36; k += 8) put('ironDark', CYL, k, 2.4, side * 14 - 7, 0.12, 3.6, 0.12);
    put('roofDark', BOX, 0, 4.4, side * 14 - 7, 80, 0.3, 5.4);
  }
}

export function railway(batch, x0, z0, x1, z1) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const yaw = Math.atan2(x1 - x0, z1 - z0);
  const put = frame(batch, (x0 + x1) / 2, 0, (z0 + z1) / 2, yaw, 0, 0, 1);
  put('gravelBed', BOX, 0, -0.3, 0, 9, 1.2, len);
  for (const lane of [-2, 2]) {
    for (const r of [-0.75, 0.75]) put('ironDark', BOX, lane + r, 0.42, 0, 0.12, 0.18, len);
    for (let k = -len / 2; k < len / 2; k += 1.6) put('bench', BOX, lane, 0.3, k, 2.2, 0.12, 0.4);
  }
}

export function train(batch, windows, x, y, z, yaw, cars = 3) {
  const put = frame(batch, x, y, z, yaw, 0, 0, 1);
  const win = frame(windows, x, y, z, yaw, 0, 0, 1);
  const L = 17;
  for (let c = 0; c < cars; c++) {
    const cz = (c - (cars - 1) / 2) * (L + 0.6);
    put('trainRed', BOX, 0, 2.4, cz, 3, 3.4, L);
    put('frameWhite', BOX, 0, 1.4, cz, 3.04, 0.4, L);
    put('ironDark', BOX, 0, 0.6, cz, 2.6, 0.8, L - 2);
    put('stoneDark', BOX, 0, 4.25, cz, 2.6, 0.3, L - 0.6);
    for (const side of [-1, 1]) win('window', BOX, side * 1.52, 2.9, cz, 0.06, 1.1, L - 2.4);
    for (const end of [-1, 1]) {
      if ((c === 0 && end < 0) || (c === cars - 1 && end > 0)) {
        put('trainRed', BOX, 0, 2.2, cz + end * (L / 2 + 0.6), 3, 3, 1.2);
        win('window', BOX, 0, 3, cz + end * (L / 2 + 1.22), 2.4, 1, 0.06);
        for (const s of [-1, 1]) put('lampGlass', BALL, s * 0.9, 1.6, cz + end * (L / 2 + 1.22), 0.2, 0.2, 0.1);
      }
    }
  }
}

export function barn(batch, windows, x, y, z, yaw, rand) {
  const put = frame(batch, x, y, z, yaw, 0, 0, 1);
  const win = frame(windows, x, y, z, yaw, 0, 0, 1);
  put('stoneDark', BOX, 0, -1.5, 0, 12.4, 3.4, 22.4);
  put('barnWood', BOX, 0, 3.2, 0, 12, 6.4, 22);
  put('roofDark', GABLE, 0, 6.4, 0, 7, 6, 23);
  put('door', BOX, 0, 2.4, 11.03, 4.6, 4.8, 0.1);
  put('plaster', BOX, -16, 3.2, 2, 11, 6.4, 13);
  put('stoneDark', BOX, -16, -1.5, 2, 11.4, 3.4, 13.4);
  put(pick(['roof', 'roofBrown'], rand), GABLE, -16, 6.4, 2, 6.2, 6.4, 13.6, 0, Math.PI / 2);
  for (const k of [-19, -13]) for (const level of [1.8, 4.6]) windowPane(win, 'window', k, level, 8.53, 0.9, 1.2, 0);
  for (let k = 0; k < 4; k++) put('straw', CYL, 9 + k * 2.6, 0.9, -6 + (k % 2) * 2.8, 1.2, 1.8, 1.2, Math.PI / 2, 0, 0);
}

export function institute(batch, windows, x, y, z, yaw, rand) {
  const put = frame(batch, x, y, z, yaw, 0, 0, 1);
  const win = frame(windows, x, y, z, yaw, 0, 0, 1);
  const W = 34 + rand() * 16;
  const D = 14;
  const floors = 3 + Math.floor(rand() * 2);
  const H = floors * 3.6;
  const color = pick(['cream', 'aula', 'plaster', 'apricot'], rand);
  put('stoneDark', BOX, 0, -2.5, 0, W + 0.6, 6, D + 0.6);
  put(color, BOX, 0, H / 2, 0, W, H, D);
  put('stone', BOX, 0, H + 0.2, 0, W + 0.6, 0.4, D + 0.6);
  put(pick(['roof', 'roofDark'], rand), HIP, 0, H + 0.4, 0, W, 5, D + 0.4);
  for (const face of [1, -1]) {
    for (let k = -W / 2 + 2.4; k <= W / 2 - 2.4; k += 2.8) {
      for (let f = 0; f < floors; f++) windowPane(win, 'window', k, 1.9 + f * 3.6, face * (D / 2 + 0.03), 1.1, 1.8, face > 0 ? 0 : Math.PI);
    }
  }
  put('stone', BOX, 0, 1.6, D / 2 + 0.3, 4, 3.2, 0.6);
  win('door', ROUND, 0, 0, D / 2 + 0.62, 2, 2.4, 0.12);
  return { r: W / 2 };
}

const CANOES = ['shutterRed', 'ochre', 'shutterGreen', 'clockBlue', 'frameWhite', 'flowerD'];
const UMBRELLAS = ['shutterRed', 'frameWhite', 'shutterGreen', 'ochre', 'clockBlue'];

export function canoeRack(batch, x, y, z, yaw, rand) {
  const put = frame(batch, x, y, z, yaw, 0, 0, 1);
  for (const s of [-1.8, 1.8]) {
    for (const k of [-0.6, 0.6]) put('puntDark', BOX, k, 0.9, s, 0.12, 1.8, 0.12);
    for (const level of [0.8, 1.5]) put('puntDark', BOX, 0, level, s, 1.5, 0.1, 0.12);
  }
  for (const level of [0.8, 1.5]) {
    for (const k of [-0.35, 0.35]) if (rand() < 0.85) put(pick(CANOES, rand), BALL, k, level + 0.18, 0, 0.34, 0.2, 3, Math.PI);
  }
  for (let k = 0; k < 2; k++) if (rand() < 0.7) put(pick(CANOES, rand), BALL, 2.2 + k * 1.1, 0.2, (rand() - 0.5) * 1.5, 0.42, 0.24, 2.6, 0, (rand() - 0.5) * 0.4);
}

export function boathouse(batch, windows, x, y, z, yaw, rand) {
  const put = frame(batch, x, y, z, yaw, 0, 0, 1);
  const win = frame(windows, x, y, z, yaw, 0, 0, 1);
  const W = 9 + rand() * 3;
  const D = 11;
  const wood = pick(['barnWood', 'shed', 'shedC', 'puntWood'], rand);
  put('stoneDark', BOX, 0, -1.2, 0, W + 0.4, 2.8, D + 0.4);
  put(wood, BOX, 0, 2.1, 0, W, 4.2, D);
  for (let k = -W / 2 + 0.6; k < W / 2; k += 1.2) put('puntDark', BOX, k, 2.1, D / 2 + 0.03, 0.08, 4.2, 0.06);
  put(pick(['roofDark', 'roof', 'slate'], rand), GABLE, 0, 4.2, 0, W / 2 + 0.6, 2.8, D + 0.8);
  for (const k of [-W / 4, W / 4]) put('door', BOX, k, 1.4, D / 2 + 0.06, W / 2 - 1, 2.8, 0.08);
  put('frameWhite', BOX, 0, 5.1, D / 2 + 0.4, 2.4, 0.7, 0.1);
  put(pick(CANOES, rand), BOX, 0, 5.1, D / 2 + 0.46, 2.2, 0.16, 0.06);
  for (const s of [-1, 1]) windowPane(win, 'window', s * (W / 2 + 0.02), 2.4, 2, 0.9, 1.1, s * Math.PI / 2);
  put('puntSeat', BOX, 0, 0.12, D / 2 + 1.6, W + 2, 0.18, 3);
  const side = (rand() < 0.5 ? -1 : 1) * (W / 2 + 3);
  canoeRack(batch, x + Math.cos(yaw) * side, y, z - Math.sin(yaw) * side, yaw, rand);
  return { r: W / 2 + 4 };
}

export function cafe(batch, x, y, z, yaw, rand) {
  const put = frame(batch, x, y, z, yaw, 0, 0, 1);
  const stripe = pick(['shutterRed', 'shutterGreen', 'shutterBlue'], rand);
  put('stoneDark', BOX, 0, -0.6, -3, 4.6, 1.4, 3.6);
  put(pick(['plaster', 'cream', 'mint', 'sky'], rand), BOX, 0, 1.3, -3, 4.2, 2.6, 3.2);
  put('roofDark', BOX, 0, 2.75, -3, 4.8, 0.3, 3.8);
  put('window', BOX, 0, 1.5, -1.38, 2.8, 1.1, 0.06);
  put('frameWhite', BOX, 0, 0.9, -1.2, 3.2, 0.12, 0.5);
  for (let k = 0; k < 5; k++) put(k % 2 ? 'frameWhite' : stripe, BOX, -1.9 + k * 0.95, 2.45, -0.9, 0.95, 0.08, 1.4, -0.35, 0, 0);
  put('puntSeat', BOX, 0, 0.06, 2.4, 9, 0.12, 6);
  for (let k = 0; k < 4; k++) {
    const tx = -3 + (k % 2) * 6 + (rand() - 0.5);
    const tz = 1 + Math.floor(k / 2) * 3 + (rand() - 0.5) * 0.6;
    put('frameWhite', CYL, tx, 0.85, tz, 0.55, 0.06, 0.55);
    put('ironDark', CYL, tx, 0.45, tz, 0.06, 0.8, 0.06);
    put('ironDark', CYL, tx, 1.6, tz, 0.04, 2.6, 0.04);
    put(pick(UMBRELLAS, rand), OCT_CONE, tx, 3.1, tz, 1.5, 0.6, 1.5);
    for (const s of [-1, 1]) put('ironDark', BOX, tx + s * 0.8, 0.45, tz, 0.4, 0.06, 0.4);
  }
  for (let k = 0; k < 3; k++) put(pick(FLOWERS, rand), BUD, -4 + k * 4, 0.45, 5.2, 0.6, 0.4, 0.6);
  return { r: 6 };
}

export function hayBales(batch, x, y, z, rand) {
  const put = frame(batch, x, y, z, rand() * 6.3, 0, 0, 1);
  const count = 2 + Math.floor(rand() * 4);
  for (let k = 0; k < count; k++) {
    const a = rand() * Math.PI * 2;
    put('straw', CYL, Math.cos(a) * k * 1.4, 0.8, Math.sin(a) * k * 1.4, 0.85, 1.3, 0.85, Math.PI / 2, 0, rand() * 3);
  }
  if (count > 3) put('straw', CYL, 0.6, 2.25, 0.4, 0.85, 1.3, 0.85, Math.PI / 2, 0, 0.4);
}

export function reeds(batch, x, y, z, rand) {
  const put = frame(batch, x, y, z, rand() * 6.3, 0, 0, 1);
  for (let k = 0; k < 9; k++) {
    const a = rand() * Math.PI * 2;
    const d = rand() * 1.8;
    const h = 2 + rand() * 1.4;
    const lean = (rand() - 0.5) * 0.25;
    put(pick(['leafB', 'trail', 'leafD'], rand), CONE, Math.cos(a) * d, h / 2 - 0.2, Math.sin(a) * d, 0.32, h, 0.32, lean, rand() * 3, lean);
    if (rand() < 0.4) put('bark', CYL, Math.cos(a) * d, h * 0.8, Math.sin(a) * d, 0.13, 0.55, 0.13, lean, 0, lean);
  }
}

export function tents(batch, x, y, z, yaw, rand) {
  const put = frame(batch, x, y, z, yaw, 0, 0, 1);
  const count = 2 + Math.floor(rand() * 3);
  for (let k = 0; k < count; k++) {
    const tx = (k - (count - 1) / 2) * 4.6 + (rand() - 0.5);
    const tz = (rand() - 0.5) * 3;
    put(pick(['flowerD', 'shutterGreen', 'clockBlue', 'ochre', 'shutterRed'], rand), GABLE, tx, 0, tz, 1.6, 2.1, 3.2, 0, rand() * 0.6);
  }
  put('stoneDark', CYL, 0, 0.1, 3, 0.7, 0.2, 0.7);
  put('bark', BOX, 0, 0.3, 3, 0.9, 0.16, 0.16, 0, 0.6);
  put('bark', BOX, 0, 0.3, 3, 0.9, 0.16, 0.16, 0, -0.6);
  return { r: count * 2 + 2 };
}

export function playground(batch, x, y, z, yaw, rand) {
  const put = frame(batch, x, y, z, yaw, 0, 0, 1);
  put('gravelBed', BOX, 0, 0.02, 0, 10, 0.1, 7);
  for (const s of [-1.6, 1.6]) {
    for (const k of [-0.9, 0.9]) put('shutterBlue', CYL, s, 1.4, k, 0.09, 3, 0.09, k > 0 ? -0.3 : 0.3);
  }
  put('shutterBlue', CYL, 0, 2.8, 0, 0.09, 3.4, 0.09, 0, 0, Math.PI / 2);
  for (const s of [-0.8, 0.8]) {
    put('ironDark', CYL, s, 1.9, 0, 0.02, 1.8, 0.02);
    put(pick(CANOES, rand), BOX, s, 1, 0, 0.6, 0.08, 0.3);
  }
  put('shutterRed', BOX, 3.2, 1.2, -1, 1.2, 0.1, 1.2);
  for (const sx of [2.7, 3.7]) for (const sz of [-1.5, -0.5]) put('puntDark', BOX, sx, 0.6, sz, 0.1, 1.2, 0.1);
  put('ochre', BOX, 3.2, 0.62, 0.4, 0.8, 0.08, 2.6, 0.5);
  put('flowerB', BOX, -3.4, 0.25, 2, 2.2, 0.4, 2.2);
  put('straw', BOX, -3.4, 0.4, 2, 1.8, 0.1, 1.8);
  return { r: 6 };
}
