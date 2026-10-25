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
  return new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false, curveSegments: 10 }).translate(0, 0, -0.5);
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
  win('stone', geometry, x, base - (style === 'square' ? 0 : 0.12), z, w + 0.36, sy * (style === 'square' ? 1 : 1.08) + (style === 'square' ? 0.3 : 0), 0.16, 0, ry);
  win('window', geometry, x + Math.sin(ry) * 0.05, base, z + Math.cos(ry) * 0.05, w, sy, 0.16, 0, ry);
  win('stone', BOX, x + Math.sin(ry) * 0.12, y - 0.1, z + Math.cos(ry) * 0.12, w + 0.5, 0.16, 0.3, 0, ry);
}

function balustrade(put, x0, x1, y, z, height = 1) {
  const n = Math.max(2, Math.round((x1 - x0) / 0.38));
  for (let k = 0; k <= n; k++) put('balcony', BALUSTER, x0 + ((x1 - x0) * k) / n, y, z, 0.16, height * 0.85, 0.16);
  put('balcony', BOX, (x0 + x1) / 2, y + height * 0.9, z, x1 - x0 + 0.3, 0.16, 0.34);
}

export function building(batch, windows, x, z, yaw, w, d, h, rand, { canal = false, onWater = false, color, base = 1.25 } = {}) {
  const put = frame(batch, x, base, z, yaw, 0, 0, 1);
  const win = frame(windows, x, base, z, yaw, 0, 0, 1);
  const front = d / 2;
  put('stone', BOX, 0, 1.6, 0, w + 0.2, 3.2, d + 0.2);
  put(color, BOX, 0, 3.2 + (h - 3.2) / 2, 0, w, h - 3.2, d);
  for (let g = 0.8; g < 3.1; g += 0.8) for (const face of [1, -1]) put('groove', BOX, 0, g, face * (front + 0.11), w + 0.22, 0.07, 0.04);
  const style = pick(['gothic', 'gothic', 'round', 'square'], rand);
  const shutters = style === 'square' || rand() < 0.3 ? pick(['shutter', 'shutterBrown'], rand) : null;
  const floors = Math.max(1, Math.floor((h - 3.4) / 3.4));
  const cols = Math.max(2, Math.floor(w / 2.6));
  for (const face of [1, -1]) {
    const fz = face * (front + 0.02);
    const ry = face > 0 ? 0 : Math.PI;
    const canalFace = canal && face > 0;
    for (let f = 0; f < floors; f++) {
      const y = 3.4 + f * 3.4 + 0.75;
      if (canalFace) put('stone', BOX, 0, 3.4 + f * 3.4, fz + face * 0.06, w + 0.12, 0.2, 0.14);
      const nobile = canalFace && f === 0 && w >= 10 && rand() < 0.6;
      if (nobile) {
        const n = 3 + Math.floor(rand() * 2);
        const span = Math.min(w - 2, n * 1.3);
        for (let k = 0; k < n; k++) {
          const lx = -span / 2 + (k + 0.5) * (span / n);
          windowAt(win, style === 'square' ? 'round' : style, lx, y - 0.2, fz, 0.95, 2.6, ry);
          if (k < n - 1) win('stone', CYL, lx + span / n / 2, y + 0.9, fz + face * 0.1, 0.1, 2.6, 0.1);
        }
        put('balcony', BOX, 0, y - 0.55, fz + face * 0.6, span + 0.8, 0.22, 1.2);
        balustrade((k, g, bx, by, bz, sx, sy, sz) => put(k, g, bx, by, bz, sx, sy, sz), -span / 2 - 0.3, span / 2 + 0.3, y - 0.45, fz + face * 1.1, 1);
        for (const side of [-1, 1]) {
          const sideCols = Math.floor((w / 2 - span / 2 - 0.8) / 2.4);
          for (let c = 0; c < sideCols; c++) windowAt(win, style, side * (span / 2 + 1.6 + c * 2.4), y, fz, 1.05, 2.2, ry);
        }
        continue;
      }
      for (let c = 0; c < cols; c++) {
        const lx = (c - (cols - 1) / 2) * (w / cols);
        windowAt(win, style, lx, y, fz, 1.05, 2.2, ry);
        if (shutters) {
          for (const s of [-1, 1]) {
            const open = rand() < 0.6;
            win(shutters, BOX, lx + s * (open ? 0.95 : 0.3), y + 1.05, fz + face * (open ? 0.08 : 0.14), open ? 0.6 : 0.52, 2.2, 0.08, 0, ry);
          }
        }
        if (rand() < 0.18) {
          win('flowerBox', BOX, lx, y - 0.25, fz + face * 0.3, 1.3, 0.35, 0.45, 0, ry);
          for (let k = 0; k < 4; k++) win(rand() < 0.7 ? 'flower' : 'leafy', BALL, lx - 0.45 + k * 0.3, y + 0.02 + rand() * 0.08, fz + face * 0.32, 0.17, 0.15, 0.17);
        }
      }
    }
    if (canalFace) {
      const n = Math.floor(w / 0.7);
      for (let k = 0; k < n; k++) win('stone', BOX, -w / 2 + (k + 0.5) * (w / n), h - 0.35, fz + face * 0.12, 0.3, 0.3, 0.24);
      put('stone', BOX, 0, h - 0.05, fz + face * 0.2, w + 0.5, 0.3, 0.4);
    }
  }
  for (const side of [-1, 1]) {
    const sx = side * (w / 2 + 0.02);
    const ry = (side * Math.PI) / 2;
    const sideCols = Math.max(1, Math.floor(d / 3.4));
    for (let g = 0.8; g < 3.1; g += 0.8) put('groove', BOX, side * (w / 2 + 0.11), g, 0, 0.04, 0.07, d + 0.22);
    for (let f = 0; f < floors; f++) {
      const y = 3.4 + f * 3.4 + 0.75;
      put('stone', BOX, side * (w / 2 + 0.06), 3.4 + f * 3.4, 0, 0.14, 0.18, d + 0.1);
      for (let c = 0; c < sideCols; c++) {
        if (rand() < 0.22) continue;
        const lz = (c - (sideCols - 1) / 2) * (d / sideCols);
        windowAt(win, style, sx, y, lz, 0.95, 2.1, ry);
        if (shutters) {
          for (const s2 of [-1, 1]) win(shutters, BOX, sx + side * 0.08, y + 1.05, lz + s2 * 0.9, 0.08, 2.1, 0.58, 0, 0);
        }
        if (rand() < 0.14) {
          win('flowerBox', BOX, sx + side * 0.3, y - 0.25, lz, 0.45, 0.35, 1.2);
          for (let k = 0; k < 4; k++) win(rand() < 0.7 ? 'flower' : 'leafy', BALL, sx + side * 0.32, y + 0.02 + rand() * 0.08, lz - 0.45 + k * 0.3, 0.15, 0.15, 0.17);
        }
      }
    }
    put('roofDark', CYL, side * (w / 2 + 0.16), (h + 1) / 2, d / 2 - 0.5, 0.11, h - 1, 0.11);
    put('stone', BOX, side * (w / 2 + 0.2), h - 0.05, 0, 0.4, 0.3, d + 0.5);
  }
  put('stone', BOX, 0, h - 0.05, -(front + 0.2), w + 0.5, 0.3, 0.4);
  put('stone', BOX, 0, h + 0.15, 0, w + 0.7, 0.35, d + 0.7);
  put(rand() < 0.5 ? 'roof' : 'roofDark', HIP, 0, h + 0.3, 0, w * 1.04, 2.2 + rand() * 1.2, d * 1.04);
  const chimneys = 1 + Math.floor(rand() * 3);
  for (let k = 0; k < chimneys; k++) {
    const cx = (rand() - 0.5) * w * 0.6;
    const cz = (rand() - 0.5) * d * 0.6;
    const kind = rand();
    put('chimney', BOX, cx, h + 2.2, cz, 0.6, 3, 0.6);
    if (kind < 0.45) put('chimney', FUNNEL, cx, h + 4.2, cz, 0.85, 1.3, 0.85);
    else if (kind < 0.75) {
      put('chimney', BELL, cx, h + 3.6, cz, 0.8, 1.2, 0.8);
      put('chimney', BALL, cx, h + 4.9, cz, 0.25, 0.25, 0.25);
    } else put('roofDark', HIP, cx, h + 3.7, cz, 1, 0.6, 1);
  }
  if (rand() < 0.18) {
    const ax = (rand() - 0.5) * w * 0.3;
    const az = (rand() - 0.5) * d * 0.3;
    for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) put('woodDark', BOX, ax + px * 1.6, h + 2.5, az + pz * 1.6, 0.18, 2.8, 0.18);
    put('wood', BOX, ax, h + 3.9, az, 3.6, 0.2, 3.6);
    for (const s of [-1, 1]) {
      put('woodDark', BOX, ax, h + 4.7, az + s * 1.75, 3.6, 0.12, 0.12);
      put('woodDark', BOX, ax + s * 1.75, h + 4.7, az, 0.12, 0.12, 3.6);
      for (let k = -1.6; k <= 1.6; k += 0.4) {
        put('woodDark', BOX, ax + k, h + 4.35, az + s * 1.75, 0.06, 0.7, 0.06);
        put('woodDark', BOX, ax + s * 1.75, h + 4.35, az + k, 0.06, 0.7, 0.06);
      }
    }
  }
  if (rand() < 0.3) {
    for (let k = 0; k < 2; k++) {
      const px = (rand() - 0.5) * (w - 3);
      const py = 4 + rand() * (h - 7);
      put('brickPatch', BOX, px, py, front + 0.02, 1.2 + rand() * 1.4, 0.8 + rand() * 0.8, 0.06);
    }
  }
  if (canal) {
    if (onWater) {
      win('stone', ROUND, 0, -0.2, front + 0.03, 3.2, 2.4, 0.2);
      win('door', ROUND, 0, -0.2, front + 0.06, 2.5, 2.1, 0.2);
      win('stone', BOX, 0, 3.0, front + 0.14, 0.5, 0.6, 0.2);
      for (let s = 0; s < 3; s++) put('stone', BOX, 0, -0.35 - s * 0.45, front + 0.35 + s * 0.45, 3, 0.45, 0.9);
    } else {
      win('stone', ROUND, 0, 0, front + 0.03, 2.2, 2.2, 0.2);
      win('door', ROUND, 0, 0, front + 0.06, 1.6, 1.9, 0.2);
      if (rand() < 0.45) {
        const a = pick(['awningA', 'awningB'], rand);
        const stripes = 7;
        for (let k = 0; k < stripes; k++) put(k % 2 ? 'awningWhite' : a, BOX, -w * 0.35 + (k + 0.5) * ((w * 0.7) / stripes), 3, front + 1, (w * 0.7) / stripes, 0.08, 2, -0.35);
        for (let k = 0; k < stripes; k++) put(k % 2 ? 'awningWhite' : a, BOX, -w * 0.35 + (k + 0.5) * ((w * 0.7) / stripes), 2.55, front + 1.95, (w * 0.7) / stripes, 0.5, 0.06);
      }
      if (rand() < 0.3) {
        put('ironDark', BOX, w / 2 - 1, 3.3, front + 0.5, 0.08, 0.08, 1);
        put('ironDark', HEX, w / 2 - 1, 2.9, front + 0.95, 0.28, 0.6, 0.28);
        put('lampGlass', HEX, w / 2 - 1, 2.9, front + 0.95, 0.22, 0.5, 0.22);
      }
    }
  }
}

export function archBridge(batch, track, idx, { rise, peak, width, color, rim = 'stone', shops = false }) {
  const i = track.norm(idx);
  const half = track.hw[i] + 7;
  const open = track.hw[i] + 2;
  const deck = (x) => 2 + (peak - 2) * (1 - (x / half) ** 2);
  const pts = [new THREE.Vector2(-half, -1)];
  for (let k = 0; k <= 32; k++) {
    const x = -half + (2 * half * k) / 32;
    pts.push(new THREE.Vector2(x, deck(x)));
  }
  pts.push(new THREE.Vector2(half, -1));
  for (let k = 0; k <= 32; k++) {
    const a = (k / 32) * Math.PI;
    pts.push(new THREE.Vector2(Math.cos(a) * open, Math.sin(a) * rise - 1));
  }
  const body = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: width, bevelEnabled: false }).translate(0, 0, -width / 2);
  const p = track.point(i);
  const yaw = track.heading(i);
  const put = frame(batch, p.x, 0, p.z, yaw, 0, 0, 1);
  put(color, body, 0, 0, 0, 1, 1, 1);
  const ringPts = [];
  for (let k = 0; k <= 32; k++) {
    const a = (k / 32) * Math.PI;
    ringPts.push(new THREE.Vector2(Math.cos(a) * (open + 0.8), Math.sin(a) * (rise + 0.8) - 1));
  }
  for (let k = 32; k >= 0; k--) {
    const a = (k / 32) * Math.PI;
    ringPts.push(new THREE.Vector2(Math.cos(a) * open, Math.sin(a) * rise - 1));
  }
  const rimGeometry = new THREE.ExtrudeGeometry(new THREE.Shape(ringPts), { depth: 0.3, bevelEnabled: false });
  for (const s of [-1, 1]) {
    put(rim, rimGeometry, 0, 0, s * (width / 2) - (s < 0 ? 0.3 : 0) + s * 0.01, 1, 1, 1);
    put(rim, BOX, 0, rise - 0.6, s * (width / 2 + 0.16), 0.9, 1.4, 0.3);
  }
  for (let k = 0; k < 32; k++) {
    const x0 = -half + (2 * half * k) / 32;
    const x1 = -half + (2 * half * (k + 1)) / 32;
    const len = Math.hypot(x1 - x0, deck(x1) - deck(x0));
    const ang = Math.atan2(deck(x1) - deck(x0), x1 - x0);
    for (const s of [-1, 1]) put(rim, BOX, (x0 + x1) / 2, (deck(x0) + deck(x1)) / 2 - 0.25, s * (width / 2 + 0.05), len + 0.05, 0.5, 0.25, 0, 0, ang);
    if (!shops) put(rim, BOX, (x0 + x1) / 2, (deck(x0) + deck(x1)) / 2 + 0.95, width / 2 - 0.3, len + 0.05, 0.16, 0.34, 0, 0, ang);
    if (!shops) put(rim, BOX, (x0 + x1) / 2, (deck(x0) + deck(x1)) / 2 + 0.95, -width / 2 + 0.3, len + 0.05, 0.16, 0.34, 0, 0, ang);
  }
  for (let x = -half + 0.8; x < half - 0.5; x += 0.85) put(rim, BOX, x, deck(x) + 0.03, 0, 0.14, 0.1, width - 0.8);
  if (!shops) {
    for (let x = -half + 0.6; x <= half - 0.6; x += 0.5) {
      for (const s of [-1, 1]) put('balcony', BALUSTER, x, deck(x), s * (width / 2 - 0.3), 0.14, 0.85, 0.14);
    }
    for (const s of [-1, 1]) {
      put('ironDark', CYL, 2.2 * s, deck(2.2) + 1.9, s * (width / 2 - 0.3), 0.08, 2.4, 0.08);
      put('ironDark', HEX, 2.2 * s, deck(2.2) + 3.3, s * (width / 2 - 0.3), 0.36, 0.7, 0.36);
      put('lampGlass', HEX, 2.2 * s, deck(2.2) + 3.3, s * (width / 2 - 0.3), 0.28, 0.6, 0.28);
      put('ironDark', CONE, 2.2 * s, deck(2.2) + 3.85, s * (width / 2 - 0.3), 0.42, 0.4, 0.42);
    }
  } else {
    for (let k = -half + 5; k <= half - 5; k += 5) {
      if (Math.abs(k) < 5) continue;
      for (const s of [-1, 1]) {
        const z = s * (width / 2 - 2.2);
        put('cream', BOX, k, deck(k) + 2.2, z, 4.6, 4, 3.6);
        put('roof', HIP, k, deck(k) + 4.2, z, 4.9, 1.5, 4);
        put('stone', ROUND, k, deck(k) + 0.3, s * (width / 2 - 0.35), 2.6, 1.7, 0.2);
        put('door', ROUND, k, deck(k) + 0.3, s * (width / 2 - 0.3), 2, 1.5, 0.2);
        put('door', ROUND, k, deck(k) + 0.3, s * (width / 2 - 4.05), 2, 1.5, 0.2);
      }
    }
    put('stone', BOX, 0, deck(0) + 3.5, 0, 6, 6, width - 1);
    put('roof', HIP, 0, deck(0) + 6.5, 0, 6.6, 2.6, width);
    for (const s of [-1, 1]) {
      put('door', ROUND, 0, deck(0) + 0.3, s * (width / 2 - 0.45), 3, 2.6, 0.2);
      for (const c of [-2.2, 2.2]) put('stone', CYL, c, deck(0) + 2.8, s * (width / 2 - 0.4), 0.3, 5.2, 0.3);
    }
  }
  return { x: p.x, z: p.z, r: half };
}

let hullGeometry = null;
function gondolaHull() {
  if (hullGeometry) return hullGeometry;
  const L = 11;
  const segs = 28;
  const positions = [];
  const sections = [];
  for (let i = 0; i <= segs; i++) {
    const u = i / segs;
    const e = Math.abs(2 * u - 1);
    const w = 0.85 * Math.pow(Math.sin(Math.PI * u), 0.55) + 0.02;
    const keel = 0.5 * e ** 3;
    const top = keel + 0.55 + 1.1 * e ** 5;
    const z = (u - 0.5) * L;
    sections.push([[-w, top, z], [-w * 0.9, keel + 0.18, z], [0, keel, z], [w * 0.9, keel + 0.18, z], [w, top, z]]);
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
  const put = frame(batch, x, -0.15, z, yaw, 0, 0, 1);
  put('hull', gondolaHull(), 0, 0, 0, 1, 1, 1);
  put('woodDark', BOX, 0, 0.45, 0, 1.25, 0.08, 6.4);
  put('hullTrim', BOX, 0, 0.62, 0, 1.75, 0.06, 6);
  put('ferro', BOX, 0, 2.55, 5.45, 0.08, 1.0, 0.45);
  for (let k = 0; k < 6; k++) put('ferro', BOX, 0, 2.15 + k * 0.13, 5.75, 0.07, 0.07, 0.4);
  put('ferro', BOX, 0, 3.08, 5.5, 0.08, 0.28, 0.8);
  put('ferro', TORUS, 0, 2.3, -5.6, 0.2, 0.2, 0.2, 0, Math.PI / 2, 0);
  if (covered) {
    put('tarp', BOX, 0, 0.85, 0.2, 1.5, 0.4, 5.6);
    for (let k = -2.4; k <= 2.4; k += 1.2) put('rope', BOX, 0, 1.06, 0.2 + k, 1.55, 0.04, 0.06);
  } else {
    put('seat', BOX, 0, 0.75, 0.6, 1.0, 0.35, 1.2);
    put('seat', BOX, 0, 1.15, 0.05, 1.0, 0.8, 0.18, -0.2);
    put('hullTrim', BOX, 0, 1.58, 0.0, 1.05, 0.08, 0.2, -0.2);
    put('seat', BOX, 0, 0.7, 2.3, 0.7, 0.28, 0.6);
    put('forcola', BOX, 0.55, 1.0, -3.3, 0.14, 0.9, 0.22, 0, 0, -0.15);
  }
}

export function pole(batch, x, z, colorKey, rand) {
  const height = 5.5 + rand() * 2;
  const lean = (rand() - 0.5) * 0.08;
  const put = frame(batch, x, -1.5, z, rand() * 6, lean, (rand() - 0.5) * 0.08, 1);
  const bands = 8;
  for (let k = 0; k < bands; k++) put(k % 2 ? 'poleWhite' : colorKey, CYL, 0, (k + 0.5) * (height / bands), 0, 0.24, height / bands, 0.24);
  put(rand() < 0.5 ? 'gold' : colorKey, rand() < 0.5 ? BALL : CONE, 0, height + 0.3, 0, 0.3, 0.4, 0.3);
  put('rope', TORUS, 0, 2.4, 0, 0.3, 0.3, 0.3, Math.PI / 2, 0, 0);
}

export function streetLamp(batch, x, y, z) {
  batch.add('ironDark', CYL, new THREE.Matrix4().compose(new THREE.Vector3(x, y + 0.3, z), new THREE.Quaternion(), new THREE.Vector3(0.28, 0.6, 0.28)));
  batch.add('ironDark', CYL, new THREE.Matrix4().compose(new THREE.Vector3(x, y + 2.3, z), new THREE.Quaternion(), new THREE.Vector3(0.1, 4, 0.1)));
  batch.add('ironDark', HEX, new THREE.Matrix4().compose(new THREE.Vector3(x, y + 4.55, z), new THREE.Quaternion(), new THREE.Vector3(0.45, 0.9, 0.45)));
  batch.add('lampGlass', HEX, new THREE.Matrix4().compose(new THREE.Vector3(x, y + 4.55, z), new THREE.Quaternion(), new THREE.Vector3(0.36, 0.8, 0.36)));
  batch.add('ironDark', CONE, new THREE.Matrix4().compose(new THREE.Vector3(x, y + 5.25, z), new THREE.Quaternion(), new THREE.Vector3(0.55, 0.5, 0.55)));
  batch.add('ironDark', BALL, new THREE.Matrix4().compose(new THREE.Vector3(x, y + 5.6, z), new THREE.Quaternion(), new THREE.Vector3(0.1, 0.1, 0.1)));
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
  const put = frame(batch, x, 1.25, z, yaw, 0, 0, 1);
  const W = 44;
  const D = 18;
  const texture = diamondTexture();
  texture.repeat.set(W / 3, 3);
  const upper = new THREE.Mesh(new THREE.BoxGeometry(W, 9, D), toon(0xffffff, { map: texture }));
  upper.position.set(x, 1.25 + 15.5, z);
  upper.rotation.y = yaw;
  group.add(upper);
  put('stone', BOX, 0, 5.5, 0, W, 11, D);
  for (let k = -W / 2 + 2; k <= W / 2 - 2; k += 4) {
    put('door', GOTHIC, k, 0, D / 2 + 0.05, 3, 2.5, 0.3);
    put('stone', CYL, k + 2, 2.2, D / 2 + 0.6, 0.55, 4.4, 0.55);
  }
  for (let k = -W / 2 + 1; k <= W / 2 - 1; k += 2) {
    put('door', GOTHIC, k, 6.2, D / 2 + 0.05, 1.4, 1.9, 0.3);
    put('stone', CYL, k + 1, 7.4, D / 2 + 0.4, 0.25, 2.6, 0.25);
    put('stone', TORUS, k + 1, 9.9, D / 2 + 0.1, 0.45, 0.45, 0.3);
  }
  put('stone', BOX, 0, 5.6, D / 2 + 0.9, W, 0.35, 1.6);
  for (const [k, big] of [[-14, 0], [-7, 0], [0, 1], [7, 0], [14, 0]]) {
    put('stone', GOTHIC, k, 14 - big, D / 2 + 0.1, big ? 3 : 2.2, big ? 3.6 : 2.6, 0.3);
    put('window', GOTHIC, k, 14.1 - big, D / 2 + 0.14, big ? 2.4 : 1.7, big ? 3.2 : 2.3, 0.3);
  }
  for (let k = -W / 2; k <= W / 2; k += 1.6) put('pinnacle', CONE, k, 21.2, D / 2 - 0.2, 0.35, 1.1, 0.35);
  put('stone', BOX, 0, 20.4, 0, W + 0.4, 0.4, D + 0.4);
}

export function campanile(batch, x, z) {
  const put = frame(batch, x, 1.25, z, 0, 0, 0, 1);
  put('stone', BOX, 0, 1, 0, 9, 2, 9);
  put('brick', BOX, 0, 22, 0, 8, 44, 8);
  for (let f = 0; f < 4; f++) {
    const ry = (f * Math.PI) / 2;
    const fx = Math.sin(ry);
    const fz = Math.cos(ry);
    for (const u of [-3.6, -1.2, 1.2, 3.6]) put('brickPatch', BOX, fx * 4.05 + fz * u, 22, fz * 4.05 - fx * u, Math.abs(fz) > 0.5 ? 0.7 : 0.2, 40, Math.abs(fz) > 0.5 ? 0.2 : 0.7);
    put('door', ROUND, fx * 4.05, 2.4, fz * 4.05, 1.6, 2.6, 0.2, 0, ry);
    for (const u of [-2.4, 0, 2.4]) {
      put('door', ROUND, fx * 4.35 + fz * u, 45.5, fz * 4.35 - fx * u, 1.4, 2.6, 0.3, 0, ry);
      put('stone', CYL, fx * 4.4 + fz * (u + 1.2), 46.7, fz * 4.4 - fx * (u + 1.2), 0.2, 4.2, 0.2);
    }
  }
  put('stone', BOX, 0, 44.4, 0, 8.8, 0.6, 8.8);
  put('belfry', BOX, 0, 47, 0, 8.6, 5, 8.6);
  put('stone', BOX, 0, 49.7, 0, 9, 0.5, 9);
  put('brick', BOX, 0, 52, 0, 7.2, 4, 7.2);
  for (let f = 0; f < 4; f++) {
    const ry = (f * Math.PI) / 2;
    put('stone', BOX, Math.sin(ry) * 3.62, 52, Math.cos(ry) * 3.62, Math.abs(Math.cos(ry)) > 0.5 ? 3.2 : 0.1, 2.4, Math.abs(Math.cos(ry)) > 0.5 ? 0.1 : 3.2);
  }
  put('spire', HIP, 0, 54, 0, 7.4, 11, 7.4);
  put('angel', CONE, 0, 66, 0, 0.4, 1.4, 0.4);
  put('angel', BALL, 0, 67, 0, 0.3, 0.3, 0.3);
  put('angel', BOX, 0, 66.4, -0.3, 1.6, 0.6, 0.08, 0.3);
}
