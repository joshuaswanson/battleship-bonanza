import * as THREE from 'three';
import { frame } from './alpine.js';
import { GOTHIC, ROUND } from './veniceDetail.js';

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
  willowDark: 0x8ab94c,
  planeBark: 0xece6d2,
  planePatch: 0xb9b88f,
  bark: 0x6e4a2e,
  puntWood: 0xa0683a,
  puntDark: 0x6b4226,
  puntSeat: 0xc98d55,
  skinA: 0xf2c7a5,
  skinB: 0xd9a07a,
  skinC: 0x9c6a4a,
  shirtA: 0xe84a5f,
  shirtB: 0x3d8bd9,
  shirtC: 0xffd23f,
  shirtD: 0x5cc26a,
  shirtE: 0xffffff,
  shirtF: 0xa86be0,
  trousers: 0x2f3c5a,
  hair: 0x4a3222,
  hairBlond: 0xe9c46a,
  straw: 0xf0d68a,
  hatBand: 0xc8443a,
  poleWood: 0xd1ad72,
  ironDark: 0x2a2f36,
  lampGlass: 0xfff1b0,
  hedge: 0x3f8f45,
  shed: 0x7fa86a,
  shedB: 0xd98b5f,
  shedC: 0x6f9ec9,
  fence: 0xf3eee2,
  bench: 0x7a5232,
};

const FACADES = ['cream', 'ochre', 'yellow', 'pink', 'salmon', 'mint', 'sky', 'lilac', 'apricot', 'plaster'];
const SHIRTS = ['shirtA', 'shirtB', 'shirtC', 'shirtD', 'shirtE', 'shirtF'];
const SKINS = ['skinA', 'skinA', 'skinB', 'skinC'];

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
const WILLOW_DOME = new THREE.SphereGeometry(1, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2);
const STRAND = new THREE.ConeGeometry(0.5, 1, 5).rotateX(Math.PI).translate(0, -0.5, 0);
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
  const R = 4.2;
  const H = 12.6;
  put('stoneDark', CYL, 0, -2.6, 0, R + 0.6, 6.4, R + 0.6);
  put('stone', CYL, 0, 0.6, 0, R + 0.35, 1.2, R + 0.35);
  put('hoelderlin', CYL, 0, H / 2 + 0.6, 0, R, H, R);
  put('stone', CYL, 0, H + 0.75, 0, R + 0.3, 0.35, R + 0.3);
  put('slate', TOWER_CAP, 0, H + 0.9, 0, R + 0.7, 10.5, R + 0.7);
  put('slate', CYL, 0, H + 11.3, 0, 0.16, 1.2, 0.16);
  put('gold', BALL, 0, H + 12.1, 0, 0.3, 0.3, 0.3);
  for (const [level, spread] of [[3.4, 1.2], [6.9, 1.5], [10.3, 1.5]]) {
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

export function willow(batch, foliage, x, y, z, rand, s = 1) {
  const yaw = rand() * 6.3;
  const tiltX = (rand() - 0.5) * 0.12;
  const tiltZ = (rand() - 0.5) * 0.12;
  const put = frame(batch, x, y, z, yaw, tiltX, tiltZ, s);
  const hang = frame(foliage, x, y, z, yaw, tiltX, tiltZ, s);
  put('bark', TRUNK, 0, -0.5, 0, 0.8, 6, 0.8);
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + rand();
    put('bark', TRUNK, 0, 5, 0, 0.32, 4.5, 0.32, Math.cos(a) * 0.6, 0, -Math.sin(a) * 0.6);
  }
  const R = 5.6 + rand() * 1.2;
  const top = 11.5 + rand() * 1.5;
  put('willow', LOW_BALL, 0, top - 2.4, 0, R * 0.8, 2.6, R * 0.8);
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + rand();
    put(pick(['willow', 'willowLight'], rand), LOW_BALL, Math.sin(a) * R * 0.45, top - 1.8 + rand() * 0.6, Math.cos(a) * R * 0.45, R * 0.42, 1.8, R * 0.42);
  }
  for (let ring = 0; ring < 3; ring++) {
    const count = [40, 32, 18][ring];
    for (let k = 0; k < count; k++) {
      const a = (k / count) * Math.PI * 2 + rand() * 0.25;
      const r = R * [0.86, 0.66, 0.4][ring] * (0.94 + rand() * 0.1);
      const len = (top - 2.8) * (0.72 + rand() * 0.28) - ring;
      hang(pick(['willow', 'willowDark', 'willowLight', 'willow'], rand), STRAND, Math.sin(a) * r, top - 2.4, Math.cos(a) * r, 1.3 + rand() * 0.5, len, 0.7, Math.cos(a) * 0.07, a, -Math.sin(a) * 0.07);
    }
  }
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

function person(put, x, y, z, ry, rand, { standing = false } = {}) {
  const shirt = pick(SHIRTS, rand);
  const skin = pick(SKINS, rand);
  if (standing) {
    for (const s of [-1, 1]) put('trousers', CYL, x + s * 0.17, y + 0.55, z, 0.15, 1.1, 0.15);
    put(shirt, CYL, x, y + 1.55, z, 0.34, 1, 0.26, 0, ry);
    put(skin, BALL, x, y + 2.35, z, 0.3, 0.32, 0.3);
    put(rand() < 0.5 ? 'hair' : 'hairBlond', BALL, x, y + 2.45, z - 0.04, 0.31, 0.24, 0.31);
    put('straw', CYL, x, y + 2.62, z, 0.5, 0.05, 0.5);
    put('straw', CYL, x, y + 2.72, z, 0.3, 0.2, 0.3);
    put('hatBand', CYL, x, y + 2.66, z, 0.31, 0.07, 0.31);
    return;
  }
  put(shirt, CYL, x, y + 0.55, z, 0.3, 0.8, 0.24, 0, ry);
  put(skin, BALL, x, y + 1.22, z, 0.28, 0.3, 0.28);
  if (rand() < 0.35) {
    put('straw', CYL, x, y + 1.42, z, 0.46, 0.05, 0.46);
    put('straw', CYL, x, y + 1.52, z, 0.28, 0.2, 0.28);
    put('hatBand', CYL, x, y + 1.46, z, 0.29, 0.07, 0.29);
  } else put(rand() < 0.5 ? 'hair' : 'hairBlond', BALL, x, y + 1.32, z, 0.29, 0.22, 0.29);
  for (const s of [-1, 1]) put(skin, BOX, x + Math.cos(ry) * s * 0.33, y + 0.75, z - Math.sin(ry) * s * 0.33, 0.12, 0.5, 0.12);
}

export const PUNT_LENGTH = 13;
export const PUNT_WIDTH = 2.6;

export function punt(batch, x, y, z, yaw, rand, { crew = 6, poler = true } = {}) {
  const put = frame(batch, x, y, z, yaw, 0, 0, 1);
  const L = PUNT_LENGTH;
  const W = PUNT_WIDTH;
  put('puntDark', BOX, 0, -0.1, 0, W - 0.2, 0.5, L - 0.4);
  for (const s of [-1, 1]) {
    put('puntWood', BOX, s * (W / 2 - 0.08), 0.35, 0, 0.16, 0.9, L);
    put('puntDark', BOX, s * (W / 2 - 0.02), 0.82, 0, 0.22, 0.12, L + 0.1);
    put('puntSeat', BOX, s * (W / 2 - 0.4), 0.45, 0.4, 0.5, 0.12, L - 4.2);
    put('puntWood', BOX, 0, 0.35, s * (L / 2 - 0.08), W, 0.9, 0.16);
    put('puntDark', BOX, 0, 0.82, s * (L / 2 - 0.02), W + 0.1, 0.12, 0.22);
  }
  put('puntSeat', BOX, 0, 0.42, -L / 2 + 1, W - 0.3, 0.12, 1.8);
  put('puntSeat', BOX, 0, 0.42, L / 2 - 0.9, W - 0.3, 0.12, 1.4);
  const seats = Math.min(crew, 10);
  for (let k = 0; k < seats; k++) {
    const s = k % 2 ? 1 : -1;
    const lz = -2.6 + Math.floor(k / 2) * 1.5;
    person(put, s * (W / 2 - 0.4), 0.45, lz, s > 0 ? -Math.PI / 2 : Math.PI / 2, rand);
  }
  if (poler) puntPoler(batch, rand, put);
}

export function puntPoler(batch, rand, put = frame(batch, 0, 0, 0, 0, 0, 0, 1)) {
  person(put, 0, 0.48, -PUNT_LENGTH / 2 + 1, 0, rand, { standing: true });
  put('poleWood', CYL, 0.5, 1.4, -PUNT_LENGTH / 2 - 0.6, 0.07, 8, 0.07, 0.42, 0, -0.08);
}

export function swimmer(batch, rand) {
  const put = frame(batch, 0, 0, 0, 0, 0, 0, 1);
  put(pick(SKINS, rand), BALL, 0, 0.15, 0, 0.32, 0.34, 0.32);
  put('straw', CYL, 0.5, 0.05, 0.3, 0.5, 0.05, 0.5, 0.2, 0, 0.1);
  put('hatBand', CYL, 0.5, 0.1, 0.3, 0.31, 0.07, 0.31, 0.2, 0, 0.1);
  for (const s of [-1, 1]) put(pick(SKINS, rand), BOX, s * 0.45, 0.55, 0, 0.12, 0.6, 0.12, 0, 0, -s * 0.4);
}

export function sitter(batch, x, y, z, yaw, rand) {
  const put = frame(batch, x, y, z, yaw, 0, 0, 1);
  person(put, 0, 0, 0, 0, rand);
  for (const s of [-1, 1]) put('trousers', BOX, s * 0.16, 0.02, 0.35, 0.18, 0.18, 0.7);
  for (const s of [-1, 1]) put('trousers', BOX, s * 0.16, -0.38, 0.68, 0.17, 0.8, 0.17);
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
