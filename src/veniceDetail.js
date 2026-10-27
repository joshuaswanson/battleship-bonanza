import * as THREE from 'three';
import { frame } from './alpine.js';
import { toon } from './toon.js';

export const DETAIL_COLORS = {
  stone: 0xf3eee2,
  stoneShade: 0xd9d0bd,
  groove: 0xb9ae98,
  brickPatch: 0xb5543d,
  balcony: 0xf6f1e4,
  shutterBrown: 0x7a5232,
  awningA: 0xc8443a,
  awningB: 0x2f7d5a,
  awningWhite: 0xfaf6ee,
  ironDark: 0x24282e,
  lampGlass: 0xfff1b0,
  hull: 0x15151a,
  hullTrim: 0xb8962e,
  tarp: 0x2a4f8a,
  seat: 0xb3242c,
  forcola: 0x6b4426,
  pinnacle: 0xefe7d6,
  mosaic: 0xe6b93a,
  angel: 0xffd23f,
  flowerBox: 0x6e4a2c,
};

function shapeGeometry(shape) {
  return new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false, curveSegments: 6 }).translate(0, 0, -0.5);
}
const gothicShape = new THREE.Shape();
gothicShape.moveTo(-0.5, 0);
gothicShape.lineTo(0.5, 0);
gothicShape.lineTo(0.5, 1);
gothicShape.quadraticCurveTo(0.5, 1.35, 0, 1.62);
gothicShape.quadraticCurveTo(-0.5, 1.35, -0.5, 1);
gothicShape.closePath();
const roundShape = new THREE.Shape();
roundShape.moveTo(-0.5, 0);
roundShape.lineTo(0.5, 0);
roundShape.lineTo(0.5, 1);
roundShape.absarc(0, 1, 0.5, 0, Math.PI, false);
roundShape.closePath();
export const GOTHIC = shapeGeometry(gothicShape);
export const ROUND = shapeGeometry(roundShape);
const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 12);
const HEX = new THREE.CylinderGeometry(1, 1, 1, 6);
const CONE = new THREE.ConeGeometry(1, 1, 12);
const BALL = new THREE.SphereGeometry(1, 12, 9);
const BUD = new THREE.SphereGeometry(1, 6, 4);
const HIP = new THREE.ConeGeometry(Math.SQRT2 / 2, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0);
const FUNNEL = new THREE.CylinderGeometry(1, 0.35, 1, 10);
const BELL = new THREE.LatheGeometry([0.15, 0.5, 0.75, 0.9, 1].map((r, k) => new THREE.Vector2(r, k * 0.25)), 10);
const BALUSTER = new THREE.LatheGeometry(
  [[0.55, 0], [0.55, 0.08], [0.3, 0.14], [0.42, 0.32], [0.62, 0.52], [0.3, 0.78], [0.28, 0.86], [0.55, 0.9], [0.55, 1]].map(([r, y]) => new THREE.Vector2(r, y)),
  8,
);
const TORUS = new THREE.TorusGeometry(1, 0.14, 6, 16);

function pick(list, rand) {
  return list[Math.floor(rand() * list.length)];
}

function windowAt(win, style, x, y, z, w, h, ry = 0) {
  const geometry = style === 'gothic' ? GOTHIC : style === 'round' ? ROUND : BOX;
  const sy = style === 'square' ? h : h / (style === 'gothic' ? 1.62 : 1.5);
  const base = style === 'square' ? y + h / 2 : y;
  win('stone', geometry, x, base - (style === 'square' ? 0 : 0.13), z, w + 0.4, sy * (style === 'square' ? 1 : 1.08) + (style === 'square' ? 0.34 : 0), 0.18, 0, ry);
  win('window', geometry, x + Math.sin(ry) * 0.06, base, z + Math.cos(ry) * 0.06, w, sy, 0.18, 0, ry);
  win('stone', BOX, x + Math.sin(ry) * 0.13, y - 0.11, z + Math.cos(ry) * 0.13, w + 0.56, 0.18, 0.34, 0, ry);
}

function balustrade(put, x0, x1, y, z, height = 1.12) {
  const n = Math.max(2, Math.round((x1 - x0) / 0.43));
  for (let k = 0; k <= n; k++) put('balcony', BALUSTER, x0 + ((x1 - x0) * k) / n, y, z, 0.18, height * 0.85, 0.18);
  put('balcony', BOX, (x0 + x1) / 2, y + height * 0.9, z, x1 - x0 + 0.34, 0.18, 0.38);
}

export function building(batch, windows, x, z, yaw, w, d, h, rand, { canal = false, onWater = false, color, base = 1.4 } = {}) {
  const put = frame(batch, x, base, z, yaw, 0, 0, 1);
  const win = frame(windows, x, base, z, yaw, 0, 0, 1);
  const front = d / 2;
  put('stone', BOX, 0, 1.79, 0, w + 0.22, 3.58, d + 0.22);
  put(color, BOX, 0, 3.58 + (h - 3.58) / 2, 0, w, h - 3.58, d);
  for (let g = 0.9; g < 3.47; g += 0.9) for (const face of [1, -1]) put('groove', BOX, 0, g, face * (front + 0.12), w + 0.25, 0.08, 0.04);
  const style = pick(['gothic', 'gothic', 'round', 'square'], rand);
  const shutters = style === 'square' || rand() < 0.3 ? pick(['shutter', 'shutterBrown'], rand) : null;
  const floors = Math.max(1, Math.floor((h - 3.81) / 3.81));
  const cols = Math.max(2, Math.floor(w / 2.91));
  for (const face of [1, -1]) {
    const fz = face * (front + 0.02);
    const ry = face > 0 ? 0 : Math.PI;
    const canalFace = canal && face > 0;
    for (let f = 0; f < floors; f++) {
      const y = 3.81 + f * 3.81 + 0.84;
      if (canalFace) put('stone', BOX, 0, 3.81 + f * 3.81, fz + face * 0.07, w + 0.13, 0.22, 0.16);
      const nobile = canalFace && f === 0 && w >= 11.2 && rand() < 0.6;
      if (nobile) {
        const n = 3 + Math.floor(rand() * 2);
        const span = Math.min(w - 2.24, n * 1.46);
        for (let k = 0; k < n; k++) {
          const lx = -span / 2 + (k + 0.5) * (span / n);
          windowAt(win, style === 'square' ? 'round' : style, lx, y - 0.22, fz, 1.06, 2.91, ry);
          if (k < n - 1) win('stone', CYL, lx + span / n / 2, y + 1.01, fz + face * 0.11, 0.11, 2.91, 0.11);
        }
        put('balcony', BOX, 0, y - 0.62, fz + face * 0.67, span + 0.9, 0.25, 1.34);
        balustrade((k, g, bx, by, bz, sx, sy, sz) => put(k, g, bx, by, bz, sx, sy, sz), -span / 2 - 0.34, span / 2 + 0.34, y - 0.5, fz + face * 1.23, 1.12);
        for (const side of [-1, 1]) {
          const sideCols = Math.floor((w / 2 - span / 2 - 0.9) / 2.69);
          for (let c = 0; c < sideCols; c++) windowAt(win, style, side * (span / 2 + 1.79 + c * 2.69), y, fz, 1.18, 2.46, ry);
        }
        continue;
      }
      for (let c = 0; c < cols; c++) {
        const lx = (c - (cols - 1) / 2) * (w / cols);
        windowAt(win, style, lx, y, fz, 1.18, 2.46, ry);
        if (shutters) {
          for (const s of [-1, 1]) {
            const open = rand() < 0.6;
            win(shutters, BOX, lx + s * (open ? 1.06 : 0.34), y + 1.18, fz + face * (open ? 0.09 : 0.16), open ? 0.67 : 0.58, 2.46, 0.09, 0, ry);
          }
        }
        if (rand() < 0.18) {
          win('flowerBox', BOX, lx, y - 0.28, fz + face * 0.34, 1.46, 0.39, 0.5, 0, ry);
          for (let k = 0; k < 4; k++) win(rand() < 0.7 ? 'flower' : 'leafy', BUD, lx - 0.5 + k * 0.34, y + 0.02 + rand() * 0.09, fz + face * 0.36, 0.19, 0.17, 0.19);
        }
      }
    }
    if (canalFace) {
      const n = Math.floor(w / 0.78);
      for (let k = 0; k < n; k++) win('stone', BOX, -w / 2 + (k + 0.5) * (w / n), h - 0.39, fz + face * 0.13, 0.34, 0.34, 0.27);
      put('stone', BOX, 0, h - 0.06, fz + face * 0.22, w + 0.56, 0.34, 0.45);
    }
  }
  for (const side of [-1, 1]) {
    const sx = side * (w / 2 + 0.02);
    const ry = (side * Math.PI) / 2;
    const sideCols = Math.max(1, Math.floor(d / 3.81));
    for (let g = 0.9; g < 3.47; g += 0.9) put('groove', BOX, side * (w / 2 + 0.12), g, 0, 0.04, 0.08, d + 0.25);
    for (let f = 0; f < floors; f++) {
      const y = 3.81 + f * 3.81 + 0.84;
      put('stone', BOX, side * (w / 2 + 0.07), 3.81 + f * 3.81, 0, 0.16, 0.2, d + 0.11);
      for (let c = 0; c < sideCols; c++) {
        if (rand() < 0.22) continue;
        const lz = (c - (sideCols - 1) / 2) * (d / sideCols);
        windowAt(win, style, sx, y, lz, 1.06, 2.35, ry);
        if (shutters) {
          for (const s2 of [-1, 1]) win(shutters, BOX, sx + side * 0.09, y + 1.18, lz + s2 * 1.01, 0.09, 2.35, 0.65, 0, 0);
        }
        if (rand() < 0.14) {
          win('flowerBox', BOX, sx + side * 0.34, y - 0.28, lz, 0.5, 0.39, 1.34);
          for (let k = 0; k < 4; k++) win(rand() < 0.7 ? 'flower' : 'leafy', BUD, sx + side * 0.36, y + 0.02 + rand() * 0.09, lz - 0.5 + k * 0.34, 0.17, 0.17, 0.19);
        }
      }
    }
    put('roofDark', CYL, side * (w / 2 + 0.18), (h + 1.12) / 2, d / 2 - 0.56, 0.12, h - 1.12, 0.12);
    put('stone', BOX, side * (w / 2 + 0.22), h - 0.06, 0, 0.45, 0.34, d + 0.56);
  }
  put('stone', BOX, 0, h - 0.06, -(front + 0.22), w + 0.56, 0.34, 0.45);
  put('stone', BOX, 0, h + 0.17, 0, w + 0.78, 0.39, d + 0.78);
  put(rand() < 0.5 ? 'roof' : 'roofDark', HIP, 0, h + 0.34, 0, w * 1.04, 2.46 + rand() * 1.34, d * 1.04);
  const chimneys = 1 + Math.floor(rand() * 3);
  for (let k = 0; k < chimneys; k++) {
    const cx = (rand() - 0.5) * w * 0.6;
    const cz = (rand() - 0.5) * d * 0.6;
    const kind = rand();
    put('chimney', BOX, cx, h + 2.46, cz, 0.67, 3.36, 0.67);
    if (kind < 0.45) put('chimney', FUNNEL, cx, h + 4.7, cz, 0.95, 1.46, 0.95);
    else if (kind < 0.75) {
      put('chimney', BELL, cx, h + 4.03, cz, 0.9, 1.34, 0.9);
      put('chimney', BALL, cx, h + 5.49, cz, 0.28, 0.28, 0.28);
    } else put('roofDark', HIP, cx, h + 4.14, cz, 1.12, 0.67, 1.12);
  }
  if (rand() < 0.18) {
    const ax = (rand() - 0.5) * w * 0.3;
    const az = (rand() - 0.5) * d * 0.3;
    for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) put('woodDark', BOX, ax + px * 1.79, h + 2.8, az + pz * 1.79, 0.2, 3.14, 0.2);
    put('wood', BOX, ax, h + 4.37, az, 4.03, 0.22, 4.03);
    for (const s of [-1, 1]) {
      put('woodDark', BOX, ax, h + 5.26, az + s * 1.96, 4.03, 0.13, 0.13);
      put('woodDark', BOX, ax + s * 1.96, h + 5.26, az, 0.13, 0.13, 4.03);
      for (let k = -1.79; k <= 1.79; k += 0.45) {
        put('woodDark', BOX, ax + k, h + 4.87, az + s * 1.96, 0.07, 0.78, 0.07);
        put('woodDark', BOX, ax + s * 1.96, h + 4.87, az + k, 0.07, 0.78, 0.07);
      }
    }
  }
  if (rand() < 0.3) {
    for (let k = 0; k < 2; k++) {
      const px = (rand() - 0.5) * (w - 3.36);
      const py = 4.48 + rand() * (h - 7.84);
      put('brickPatch', BOX, px, py, front + 0.02, 1.34 + rand() * 1.57, 0.9 + rand() * 0.9, 0.07);
    }
  }
  if (canal) {
    if (onWater) {
      win('stone', ROUND, 0, -0.22, front + 0.03, 3.58, 2.69, 0.22);
      win('door', ROUND, 0, -0.22, front + 0.07, 2.8, 2.35, 0.22);
      win('stone', BOX, 0, 3.36, front + 0.16, 0.56, 0.67, 0.22);
      for (let s = 0; s < 3; s++) put('stone', BOX, 0, -0.39 - s * 0.5, front + 0.39 + s * 0.5, 3.36, 0.5, 1.01);
    } else {
      win('stone', ROUND, 0, 0, front + 0.03, 2.46, 2.46, 0.22);
      win('door', ROUND, 0, 0, front + 0.07, 1.79, 2.13, 0.22);
      if (rand() < 0.45) {
        const a = pick(['awningA', 'awningB'], rand);
        const stripes = 7;
        for (let k = 0; k < stripes; k++) put(k % 2 ? 'awningWhite' : a, BOX, -w * 0.35 + (k + 0.5) * ((w * 0.7) / stripes), 3.36, front + 1.12, (w * 0.7) / stripes, 0.09, 2.24, -0.35);
        for (let k = 0; k < stripes; k++) put(k % 2 ? 'awningWhite' : a, BOX, -w * 0.35 + (k + 0.5) * ((w * 0.7) / stripes), 2.86, front + 2.18, (w * 0.7) / stripes, 0.56, 0.07);
      }
      if (rand() < 0.3) {
        put('ironDark', BOX, w / 2 - 1.12, 3.7, front + 0.56, 0.09, 0.09, 1.12);
        put('ironDark', HEX, w / 2 - 1.12, 3.25, front + 1.06, 0.31, 0.67, 0.31);
        put('lampGlass', HEX, w / 2 - 1.12, 3.25, front + 1.06, 0.25, 0.56, 0.25);
      }
    }
  }
}

export function archBridge(batch, track, idx, { rise, peak, width, color, rim = 'stone', shops = false }) {
  const i = track.norm(idx);
  const half = track.hw[i] + 7.84;
  const open = track.hw[i] + 2.24;
  const deck = (x) => 2.24 + (peak - 2.24) * (1 - (x / half) ** 2);
  const pts = [new THREE.Vector2(-half, -1.12)];
  for (let k = 0; k <= 32; k++) {
    const x = -half + (2 * half * k) / 32;
    pts.push(new THREE.Vector2(x, deck(x)));
  }
  pts.push(new THREE.Vector2(half, -1.12));
  for (let k = 0; k <= 32; k++) {
    const a = (k / 32) * Math.PI;
    pts.push(new THREE.Vector2(Math.cos(a) * open, Math.sin(a) * rise - 1.12));
  }
  const body = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: width, bevelEnabled: false }).translate(0, 0, -width / 2);
  const p = track.point(i);
  const yaw = track.heading(i);
  const put = frame(batch, p.x, 0, p.z, yaw, 0, 0, 1);
  put(color, body, 0, 0, 0, 1, 1, 1);
  const ringPts = [];
  for (let k = 0; k <= 32; k++) {
    const a = (k / 32) * Math.PI;
    ringPts.push(new THREE.Vector2(Math.cos(a) * (open + 0.9), Math.sin(a) * (rise + 0.9) - 1.12));
  }
  for (let k = 32; k >= 0; k--) {
    const a = (k / 32) * Math.PI;
    ringPts.push(new THREE.Vector2(Math.cos(a) * open, Math.sin(a) * rise - 1.12));
  }
  const rimGeometry = new THREE.ExtrudeGeometry(new THREE.Shape(ringPts), { depth: 0.34, bevelEnabled: false });
  for (const s of [-1, 1]) {
    put(rim, rimGeometry, 0, 0, s * (width / 2) - (s < 0 ? 0.34 : 0) + s * 0.01, 1, 1, 1);
    put(rim, BOX, 0, rise - 0.67, s * (width / 2 + 0.18), 1.01, 1.57, 0.34);
  }
  for (let k = 0; k < 32; k++) {
    const x0 = -half + (2 * half * k) / 32;
    const x1 = -half + (2 * half * (k + 1)) / 32;
    const len = Math.hypot(x1 - x0, deck(x1) - deck(x0));
    const ang = Math.atan2(deck(x1) - deck(x0), x1 - x0);
    for (const s of [-1, 1]) put(rim, BOX, (x0 + x1) / 2, (deck(x0) + deck(x1)) / 2 - 0.28, s * (width / 2 + 0.06), len + 0.06, 0.56, 0.28, 0, 0, ang);
    if (!shops) put(rim, BOX, (x0 + x1) / 2, (deck(x0) + deck(x1)) / 2 + 1.06, width / 2 - 0.34, len + 0.06, 0.18, 0.38, 0, 0, ang);
    if (!shops) put(rim, BOX, (x0 + x1) / 2, (deck(x0) + deck(x1)) / 2 + 1.06, -width / 2 + 0.34, len + 0.06, 0.18, 0.38, 0, 0, ang);
  }
  for (let x = -half + 0.9; x < half - 0.56; x += 0.95) put(rim, BOX, x, deck(x) + 0.03, 0, 0.16, 0.11, width - 0.9);
  if (!shops) {
    for (let x = -half + 0.67; x <= half - 0.67; x += 0.56) {
      for (const s of [-1, 1]) put('balcony', BALUSTER, x, deck(x), s * (width / 2 - 0.34), 0.16, 0.95, 0.16);
    }
    for (const s of [-1, 1]) {
      put('ironDark', CYL, 2.46 * s, deck(2.46) + 2.13, s * (width / 2 - 0.34), 0.09, 2.69, 0.09);
      put('ironDark', HEX, 2.46 * s, deck(2.46) + 3.7, s * (width / 2 - 0.34), 0.4, 0.78, 0.4);
      put('lampGlass', HEX, 2.46 * s, deck(2.46) + 3.7, s * (width / 2 - 0.34), 0.31, 0.67, 0.31);
      put('ironDark', CONE, 2.46 * s, deck(2.46) + 4.31, s * (width / 2 - 0.34), 0.47, 0.45, 0.47);
    }
  } else {
    for (let k = -half + 5.6; k <= half - 5.6; k += 5.6) {
      if (Math.abs(k) < 5.6) continue;
      for (const s of [-1, 1]) {
        const z = s * (width / 2 - 2.46);
        put('cream', BOX, k, deck(k) + 2.46, z, 5.15, 4.48, 4.03);
        put('roof', HIP, k, deck(k) + 4.7, z, 5.49, 1.68, 4.48);
        put('stone', ROUND, k, deck(k) + 0.34, s * (width / 2 - 0.39), 2.91, 1.9, 0.22);
        put('door', ROUND, k, deck(k) + 0.34, s * (width / 2 - 0.34), 2.24, 1.68, 0.22);
        put('door', ROUND, k, deck(k) + 0.34, s * (width / 2 - 4.54), 2.24, 1.68, 0.22);
      }
    }
    put('stone', BOX, 0, deck(0) + 3.92, 0, 6.72, 6.72, width - 1.12);
    put('roof', HIP, 0, deck(0) + 7.28, 0, 7.39, 2.91, width);
    for (const s of [-1, 1]) {
      put('door', ROUND, 0, deck(0) + 0.34, s * (width / 2 - 0.5), 3.36, 2.91, 0.22);
      for (const c of [-2.46, 2.46]) put('stone', CYL, c, deck(0) + 3.14, s * (width / 2 - 0.45), 0.34, 5.82, 0.34);
    }
  }
  return { x: p.x, z: p.z, r: half };
}

let hullGeometry = null;
function gondolaHull() {
  if (hullGeometry) return hullGeometry;
  const L = 12.32;
  const segs = 28;
  const positions = [];
  const sections = [];
  for (let i = 0; i <= segs; i++) {
    const u = i / segs;
    const e = Math.abs(2 * u - 1);
    const w = 0.95 * Math.pow(Math.sin(Math.PI * u), 0.55) + 0.02;
    const keel = 0.56 * e ** 3;
    const top = keel + 0.62 + 1.23 * e ** 5;
    const z = (u - 0.5) * L;
    sections.push([[-w, top, z], [-w * 0.9, keel + 0.2, z], [0, keel, z], [w * 0.9, keel + 0.2, z], [w, top, z]]);
  }
  for (let i = 0; i < segs; i++) {
    const a = sections[i];
    const b = sections[i + 1];
    for (let k = 0; k < 4; k++) positions.push(...a[k], ...b[k], ...a[k + 1], ...a[k + 1], ...b[k], ...b[k + 1]);
  }
  hullGeometry = new THREE.BufferGeometry();
  hullGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  hullGeometry.computeVertexNormals();
  return hullGeometry;
}

export function gondola(batch, x, z, yaw, rand, { covered = false } = {}) {
  const put = frame(batch, x, -0.17, z, yaw, 0, 0, 1);
  put('hull', gondolaHull(), 0, 0, 0, 1, 1, 1);
  put('woodDark', BOX, 0, 0.5, 0, 1.4, 0.09, 7.17);
  put('hullTrim', BOX, 0, 0.69, 0, 1.96, 0.07, 6.72);
  put('ferro', BOX, 0, 2.86, 6.1, 0.09, 1.12, 0.5);
  for (let k = 0; k < 6; k++) put('ferro', BOX, 0, 2.41 + k * 0.15, 6.44, 0.08, 0.08, 0.45);
  put('ferro', BOX, 0, 3.45, 6.16, 0.09, 0.31, 0.9);
  put('ferro', TORUS, 0, 2.58, -6.27, 0.22, 0.22, 0.22, 0, Math.PI / 2, 0);
  if (covered) {
    put('tarp', BOX, 0, 0.95, 0.22, 1.68, 0.45, 6.27);
    for (let k = -2.69; k <= 2.69; k += 1.34) put('rope', BOX, 0, 1.19, 0.22 + k, 1.74, 0.04, 0.07);
  } else {
    put('seat', BOX, 0, 0.84, 0.67, 1.12, 0.39, 1.34);
    put('seat', BOX, 0, 1.29, 0.06, 1.12, 0.9, 0.2, -0.2);
    put('hullTrim', BOX, 0, 1.77, 0, 1.18, 0.09, 0.22, -0.2);
    put('seat', BOX, 0, 0.78, 2.58, 0.78, 0.31, 0.67);
    put('forcola', BOX, 0.62, 1.12, -3.7, 0.16, 1.01, 0.25, 0, 0, -0.15);
  }
}

export function pole(batch, x, z, colorKey, rand) {
  const height = 6.16 + rand() * 2.24;
  const lean = (rand() - 0.5) * 0.08;
  const put = frame(batch, x, -1.68, z, rand() * 6, lean, (rand() - 0.5) * 0.08, 1);
  const bands = 8;
  for (let k = 0; k < bands; k++) put(k % 2 ? 'poleWhite' : colorKey, CYL, 0, (k + 0.5) * (height / bands), 0, 0.27, height / bands, 0.27);
  put(rand() < 0.5 ? 'gold' : colorKey, rand() < 0.5 ? BALL : CONE, 0, height + 0.34, 0, 0.34, 0.45, 0.34);
  put('rope', TORUS, 0, 2.69, 0, 0.34, 0.34, 0.34, Math.PI / 2, 0, 0);
}

export function streetLamp(batch, x, y, z) {
  batch.add('ironDark', CYL, new THREE.Matrix4().compose(new THREE.Vector3(x, y + 0.34, z), new THREE.Quaternion(), new THREE.Vector3(0.31, 0.67, 0.31)));
  batch.add('ironDark', CYL, new THREE.Matrix4().compose(new THREE.Vector3(x, y + 2.58, z), new THREE.Quaternion(), new THREE.Vector3(0.11, 4.48, 0.11)));
  batch.add('ironDark', HEX, new THREE.Matrix4().compose(new THREE.Vector3(x, y + 5.1, z), new THREE.Quaternion(), new THREE.Vector3(0.5, 1.01, 0.5)));
  batch.add('lampGlass', HEX, new THREE.Matrix4().compose(new THREE.Vector3(x, y + 5.1, z), new THREE.Quaternion(), new THREE.Vector3(0.4, 0.9, 0.4)));
  batch.add('ironDark', CONE, new THREE.Matrix4().compose(new THREE.Vector3(x, y + 5.88, z), new THREE.Quaternion(), new THREE.Vector3(0.62, 0.56, 0.62)));
  batch.add('ironDark', BALL, new THREE.Matrix4().compose(new THREE.Vector3(x, y + 6.27, z), new THREE.Quaternion(), new THREE.Vector3(0.11, 0.11, 0.11)));
}

function diamondTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#f6d2c6';
  g.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 32) {
    for (let x = 0; x < 128; x += 32) {
      g.fillStyle = (x + y) % 64 ? '#fbf4ea' : '#e9a99a';
      g.beginPath();
      g.moveTo(x + 16, y + 2);
      g.lineTo(x + 30, y + 16);
      g.lineTo(x + 16, y + 30);
      g.lineTo(x + 2, y + 16);
      g.closePath();
      g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function dogesPalace(batch, group, x, z, yaw) {
  const put = frame(batch, x, 1.4, z, yaw, 0, 0, 1);
  const W = 49.28;
  const D = 20.16;
  const texture = diamondTexture();
  texture.repeat.set(W / 3.36, 3);
  const upper = new THREE.Mesh(new THREE.BoxGeometry(W, 10.08, D), toon(0xffffff, { map: texture }));
  upper.position.set(x, 1.4 + 17.36, z);
  upper.rotation.y = yaw;
  group.add(upper);
  put('stone', BOX, 0, 6.16, 0, W, 12.32, D);
  for (let k = -W / 2 + 2.24; k <= W / 2 - 2.24; k += 4.48) {
    put('door', GOTHIC, k, 0, D / 2 + 0.06, 3.36, 2.8, 0.34);
    put('stone', CYL, k + 2.24, 2.46, D / 2 + 0.67, 0.62, 4.93, 0.62);
  }
  for (let k = -W / 2 + 1.12; k <= W / 2 - 1.12; k += 2.24) {
    put('door', GOTHIC, k, 6.94, D / 2 + 0.06, 1.57, 2.13, 0.34);
    put('stone', CYL, k + 1.12, 8.29, D / 2 + 0.45, 0.28, 2.91, 0.28);
    put('stone', TORUS, k + 1.12, 11.09, D / 2 + 0.11, 0.5, 0.5, 0.34);
  }
  put('stone', BOX, 0, 6.27, D / 2 + 1.01, W, 0.39, 1.79);
  for (const [k, big] of [[-15.68, 0], [-7.84, 0], [0, 1.12], [7.84, 0], [15.68, 0]]) {
    put('stone', GOTHIC, k, 15.68 - big, D / 2 + 0.11, big ? 3.36 : 2.46, big ? 4.03 : 2.91, 0.34);
    put('window', GOTHIC, k, 15.79 - big, D / 2 + 0.16, big ? 2.69 : 1.9, big ? 3.58 : 2.58, 0.34);
  }
  for (let k = -W / 2; k <= W / 2; k += 1.79) put('pinnacle', CONE, k, 23.74, D / 2 - 0.22, 0.39, 1.23, 0.39);
  put('stone', BOX, 0, 22.85, 0, W + 0.45, 0.45, D + 0.45);
}

export function campanile(batch, x, z) {
  const put = frame(batch, x, 1.4, z, 0, 0, 0, 1);
  put('stone', BOX, 0, 1.12, 0, 10.08, 2.24, 10.08);
  put('brick', BOX, 0, 24.64, 0, 8.96, 49.28, 8.96);
  for (let f = 0; f < 4; f++) {
    const ry = (f * Math.PI) / 2;
    const fx = Math.sin(ry);
    const fz = Math.cos(ry);
    for (const u of [-4.03, -1.34, 1.34, 4.03]) put('brickPatch', BOX, fx * 4.54 + fz * u, 24.64, fz * 4.54 - fx * u, Math.abs(fz) > 0.5 ? 0.78 : 0.22, 44.8, Math.abs(fz) > 0.5 ? 0.22 : 0.78);
    put('door', ROUND, fx * 4.54, 2.69, fz * 4.54, 1.79, 2.91, 0.22, 0, ry);
    for (const u of [-2.69, 0, 2.69]) {
      put('door', ROUND, fx * 4.87 + fz * u, 50.96, fz * 4.87 - fx * u, 1.57, 2.91, 0.34, 0, ry);
      put('stone', CYL, fx * 4.93 + fz * (u + 1.34), 52.3, fz * 4.93 - fx * (u + 1.34), 0.22, 4.7, 0.22);
    }
  }
  put('stone', BOX, 0, 49.73, 0, 9.86, 0.67, 9.86);
  put('belfry', BOX, 0, 52.64, 0, 9.63, 5.6, 9.63);
  put('stone', BOX, 0, 55.66, 0, 10.08, 0.56, 10.08);
  put('brick', BOX, 0, 58.24, 0, 8.06, 4.48, 8.06);
  for (let f = 0; f < 4; f++) {
    const ry = (f * Math.PI) / 2;
    put('stone', BOX, Math.sin(ry) * 4.05, 58.24, Math.cos(ry) * 4.05, Math.abs(Math.cos(ry)) > 0.5 ? 3.58 : 0.11, 2.69, Math.abs(Math.cos(ry)) > 0.5 ? 0.11 : 3.58);
  }
  put('spire', HIP, 0, 60.48, 0, 8.29, 12.32, 8.29);
  put('angel', CONE, 0, 73.92, 0, 0.45, 1.57, 0.45);
  put('angel', BALL, 0, 75.04, 0, 0.34, 0.34, 0.34);
  put('angel', BOX, 0, 74.37, -0.34, 1.79, 0.67, 0.09, 0.3);
}
