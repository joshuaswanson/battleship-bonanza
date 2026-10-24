import * as THREE from 'three';
import { frame } from './alpine.js';
import { loftHull, mainTurret, aa, rails } from './battleship.js';

const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 16);
const BALL = new THREE.SphereGeometry(1, 14, 10);
const DISH = new THREE.CylinderGeometry(1, 0.6, 1, 16);
const SPOKE = new THREE.CylinderGeometry(1, 1, 1, 6);

function shipFrame(batch, x, z, yaw) {
  const put = frame(batch, x, 0, z, yaw, 0, 0, 1);
  const at = (lx, lz) => new THREE.Vector3(x + lx * Math.cos(yaw) + lz * Math.sin(yaw), 0, z - lx * Math.sin(yaw) + lz * Math.cos(yaw));
  const place = new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(1, 1, 1));
  return { put, at, place };
}

function hullDressing(put, L, width, deckY, step) {
  for (let u = 0.08; u < 0.92; u += step) {
    const lz = (u - 0.5) * L;
    const w = width(u);
    for (const side of [-1, 1]) put('window', CYL, side * (w + 0.06), deckY(lz) - 1.4, lz, 0.24, 0.14, 0.24, 0, 0, Math.PI / 2);
  }
  for (let u = 0.04; u < 0.96; u += 0.02) {
    const lz = (u - 0.5) * L;
    put('deckDark', BOX, 0, deckY(lz) + 0.03, lz, width(u) * 1.9, 0.02, 0.1);
  }
  const edge = [];
  for (let u = 0.02; u <= 0.98; u += 0.04) edge.push([width(u) - 0.25, (u - 0.5) * L]);
  for (const side of [-1, 1]) {
    for (let i = 0; i < edge.length - 1; i++) {
      const [w0, z0] = edge[i];
      const [w1, z1] = edge[i + 1];
      rails(put, [[side * w0, z0], [side * w1, z1]], (deckY(z0) + deckY(z1)) / 2);
    }
  }
}

function torpedoTubes(put, x, y, z, ry) {
  put('steelDark', CYL, x, y + 0.3, z, 1.2, 0.6, 1.2);
  put('steel', BOX, x, y + 0.9, z, 1.8, 0.7, 1.4, 0, ry, 0);
  for (let k = -2; k <= 2; k++) {
    const ox = Math.cos(ry) * k * 0.42;
    const oz = -Math.sin(ry) * k * 0.42;
    put('gun', CYL, x + ox, y + 1.2, z + oz, 0.2, 6, 0.2, Math.PI / 2, ry, 0);
  }
}

export function destroyer(batch, dyn, x, z, yaw, rand, guns, turrets, stacks) {
  const L = 96;
  const B = 11;
  const { put, at, place } = shipFrame(batch, x, z, yaw);
  const { hull, deck, width, sheer } = loftHull(L, B, 4.2, rand, { rise: 2.6, fine: 0.58, transom: 0.8 });
  batch.add('hull', hull, place);
  batch.add('deck', deck, place);
  const deckY = (lz) => sheer(lz / L + 0.5);
  hullDressing(put, L, width, deckY, 0.03);

  mainTurret(put, dyn, 0, deckY(36), 36, 0, 0.55, 0.3, turrets, at, yaw, 2, 9);
  put('steelDark', CYL, 0, deckY(27) + 1.2, 27, 2.3, 2.4, 2.3);
  mainTurret(put, dyn, 0, deckY(27) + 2.4, 27, 0, 0.55, 0.38, turrets, at, yaw, 2, 9);
  mainTurret(put, dyn, 0, deckY(-38), -38, Math.PI, 0.55, 0.3, turrets, at, yaw, 2, 9);
  put('steelDark', CYL, 0, deckY(-29) + 1.2, -29, 2.3, 2.4, 2.3);
  mainTurret(put, dyn, 0, deckY(-29) + 2.4, -29, Math.PI, 0.55, 0.36, turrets, at, yaw, 2, 9);

  const by = deckY(16);
  put('hull', BOX, 0, by + 2, 16, 7, 4, 10);
  put('hullLight', BOX, 0, by + 4.15, 16, 7.4, 0.3, 10.4);
  for (const side of [-1, 1]) for (let k = 12; k <= 20; k += 2.2) put('window', BOX, side * 3.52, by + 2.6, k, 0.08, 0.6, 1.2);
  put('hull', BOX, 0, by + 5.6, 17.5, 5.6, 2.6, 6);
  put('window', BOX, 0, by + 6, 20.52, 5, 0.7, 0.08);
  for (const side of [-1, 1]) put('window', BOX, side * 2.82, by + 6, 17.5, 0.08, 0.7, 5);
  put('hullLight', BOX, 0, by + 7, 17.5, 8.4, 0.25, 6.6);
  rails(put, [[-4.2, 20.8], [4.2, 20.8]], by + 7.1);
  put('steelDark', CYL, 0, by + 7.9, 16.6, 0.9, 1.2, 0.9);
  put('steelDark', BOX, 0, by + 8.6, 16.6, 4.4, 0.4, 0.6);
  const mastBase = by + 7.1;
  put('steelDark', CYL, 0, mastBase + 6, 14.5, 0.24, 12, 0.24);
  for (const side of [-1, 1]) put('steelDark', CYL, side * 1.4, mastBase + 3, 15.2, 0.14, 6.4, 0.14, -0.1, 0, side * 0.24);
  put('steelDark', BOX, 0, mastBase + 9, 14.5, 4.6, 0.2, 0.2);
  put('steelLight', BOX, 0, mastBase + 11, 14.5, 2.4, 1.2, 0.15);
  put('flagRed', BOX, 0, mastBase + 12.7, 14.5, 0.08, 0.9, 1.6);

  const fy = deckY(0);
  for (const [fz, h] of [[4.5, 7.5], [-6, 7]]) {
    put('hullLight', BOX, 0, fy + 0.8, fz, 4.6, 1.6, 5.4);
    put('funnel', CYL, 0, fy + 1.6 + h / 2, fz - 0.4, 1.7, h, 2.3, 0.12, 0, 0);
    put('funnelTop', CYL, 0, fy + 1.7 + h, fz - 0.95, 1.75, 0.6, 2.35, 0.12, 0, 0);
    put('steelLight', CYL, 0, fy + 1.7 + h * 0.62, fz - 0.65, 1.78, 0.25, 2.38, 0.12, 0, 0);
    stacks?.stacks.push(at(0, fz - 1.1).setY(fy + 2 + h));
  }
  torpedoTubes(put, 0, deckY(-12), -12, Math.PI / 2 + 0.3);
  torpedoTubes(put, 0, deckY(-19), -19, -Math.PI / 2 - 0.3);
  for (const side of [-1, 1]) {
    aa(put, side * 3.2, by + 4.3, 12, guns);
    aa(put, side * 3.3, deckY(-2), -1, guns);
    put('boatWhite', BALL, side * 4.2, fy + 1.4, 0, 0.7, 0.5, 2.4);
    for (let k = 0; k < 4; k++) put('steelDark', CYL, side * 2.6, deckY(-44) + 0.55, -44 + k * 1.1, 0.42, 1.1, 0.42);
    put('steelDark', BALL, side * 1.8, deckY(43) + 0.3, 43, 0.4, 0.3, 0.4);
  }
  put('flagRed', BOX, 0, deckY(-47) + 2.8, -47.4, 0.08, 1.1, 1.8);
  put('steelLight', CYL, 0, deckY(-47) + 1.6, -47, 0.06, 3.2, 0.06);
  return { L, B, top: 24 };
}

export function carrier(batch, x, z, yaw, rand, fires, guns, burning, parked, stacks) {
  const L = 212;
  const B = 27;
  const { put, at, place } = shipFrame(batch, x, z, yaw);
  const { hull, width, sheer } = loftHull(L, B, 11, rand, { rise: 1.2, fine: 0.7, transom: 0.85 });
  batch.add('hull', hull, place);
  const hullTop = (lz) => sheer(lz / L + 0.5);
  for (let u = 0.1; u < 0.9; u += 0.02) {
    const lz = (u - 0.5) * L;
    for (const side of [-1, 1]) put('window', CYL, side * (width(u) + 0.06), 4.6, lz, 0.26, 0.14, 0.26, 0, 0, Math.PI / 2);
  }
  const deckY = 17.5;
  const W = 38;
  const DL = L + 2;
  const wall = (u) => Math.min((B - 1.5) / 2, width(u));
  const deckHalf = (lz) => {
    if (lz < -DL / 2 + 16) return W / 2 - 4 + 4 * ((lz + DL / 2) / 16);
    if (lz > DL / 2 - 24) {
      const t = (lz - (DL / 2 - 24)) / 24;
      return W / 2 - 10 * t * t;
    }
    return W / 2;
  };
  const hangar = [];
  const rows = 120;
  for (let r = 0; r <= rows; r++) {
    const u = 0.015 + (r / rows) * 0.97;
    hangar.push({ lz: (u - 0.5) * L, w: wall(u), y0: hullTop((u - 0.5) * L) - 0.3 });
  }
  const verts = [];
  const quad = (a, b, c, d) => verts.push(...a, ...b, ...c, ...a, ...c, ...d);
  for (let r = 0; r < rows; r++) {
    const p = hangar[r];
    const q = hangar[r + 1];
    for (const side of [-1, 1]) {
      const A = [side * p.w, p.y0, p.lz];
      const Bv = [side * q.w, q.y0, q.lz];
      const C = [side * q.w, deckY, q.lz];
      const D = [side * p.w, deckY, p.lz];
      if (side > 0) quad(A, D, C, Bv);
      else quad(A, Bv, C, D);
    }
  }
  for (const [end, dir] of [[hangar[0], -1], [hangar[rows], 1]]) {
    const A = [-end.w, end.y0, end.lz];
    const Bv = [end.w, end.y0, end.lz];
    const C = [end.w, deckY, end.lz];
    const D = [-end.w, deckY, end.lz];
    if (dir > 0) quad(A, D, C, Bv);
    else quad(A, Bv, C, D);
  }
  const hangarGeometry = new THREE.BufferGeometry();
  hangarGeometry.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  hangarGeometry.computeVertexNormals();
  batch.add('hullLight', hangarGeometry, place);
  const wallAt = (lz) => wall(lz / L + 0.5);
  for (const side of [-1, 1]) {
    for (let k = -84; k <= 84; k += 14) {
      put('window', BOX, side * (wallAt(k) + 0.03), hullTop(k) + 2.6, k, 0.08, 2.6, 8.5);
      put('steelDark', BOX, side * (wallAt(k) + 0.06), hullTop(k) + 4.2, k, 0.1, 0.2, 9);
    }
  }
  const strut = (ax, ay, az, bx, by, bz, r = 0.22) => {
    const a = new THREE.Vector3(ax, ay, az);
    const b = new THREE.Vector3(bx, by, bz);
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const dir = b.clone().sub(a);
    const e = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()));
    put('steelDark', BOX, mid.x, mid.y, mid.z, r * 2, dir.length(), r * 2, e.x, e.y, e.z);
  };
  for (let lz = -DL / 2 + 3; lz <= DL / 2 - 3; lz += 7) {
    const w = Math.max(0.5, wallAt(Math.max(-L / 2 + 2, Math.min(L / 2 - 2, lz))));
    const reach = deckHalf(lz) - 0.6;
    if (reach - w < 1.2) continue;
    for (const side of [-1, 1]) {
      const drop = Math.min(5.5, (reach - w) * 0.8 + 1);
      strut(side * w, deckY - drop, lz, side * reach, deckY - 0.05, lz);
      put('steelDark', BOX, side * (w + reach) / 2, deckY - 0.25, lz, reach - w, 0.4, 0.4);
    }
  }
  const deckShape = new THREE.Shape();
  deckShape.moveTo(-W / 2 + 4, -DL / 2);
  deckShape.lineTo(W / 2 - 4, -DL / 2);
  deckShape.lineTo(W / 2, -DL / 2 + 16);
  deckShape.lineTo(W / 2, DL / 2 - 24);
  deckShape.quadraticCurveTo(W / 2, DL / 2, W / 2 - 10, DL / 2);
  deckShape.lineTo(-W / 2 + 10, DL / 2);
  deckShape.quadraticCurveTo(-W / 2, DL / 2, -W / 2, DL / 2 - 24);
  deckShape.lineTo(-W / 2, -DL / 2 + 16);
  deckShape.closePath();
  const slab = new THREE.ExtrudeGeometry(deckShape, { depth: 1.2, bevelEnabled: false }).rotateX(Math.PI / 2);
  batch.add('steelDark', slab, new THREE.Matrix4().compose(new THREE.Vector3(x, deckY + 1.2, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(1, 1, 1)));
  const top = new THREE.ShapeGeometry(deckShape).rotateX(-Math.PI / 2);
  batch.add('deck', top, new THREE.Matrix4().compose(new THREE.Vector3(x, deckY + 1.22, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(1, 1, 1)));
  const dy = deckY + 1.25;
  for (let k = -DL / 2 + 6; k < DL / 2 - 6; k += 2.4) put('deckDark', BOX, 0, dy, k, W - 2, 0.02, 0.12);
  put('deckLine', BOX, 0, dy + 0.02, 0, 0.6, 0.03, DL - 20);
  for (const side of [-1, 1]) put('deckLine', BOX, side * (W / 2 - 1.2), dy + 0.02, 0, 0.35, 0.03, DL - 30);
  for (let k = -90; k < 96; k += 9) put('deckLine', BOX, -7, dy + 0.02, k, 0.45, 0.03, 4.4);
  for (const lz of [-70, -64, -58, -52]) put('steelLight', BOX, 0, dy + 0.06, lz, W - 8, 0.08, 0.15);
  for (const [lz, s] of [[60, 13], [-20, 13]]) {
    put('deckDark', BOX, 0, dy + 0.01, lz, s, 0.03, s);
    for (const [ex, ez, w, d] of [[0, s / 2, s, 0.25], [0, -s / 2, s, 0.25], [s / 2, 0, 0.25, s], [-s / 2, 0, 0.25, s]]) put('deckLine', BOX, ex, dy + 0.03, lz + ez, w, 0.03, d);
  }
  put('deckLine', BOX, 0, dy + 0.02, DL / 2 - 14, 10, 0.03, 0.6);
  put('deckLine', BOX, 0, dy + 0.02, -DL / 2 + 10, 10, 0.03, 0.6);

  const ix = W / 2 - 4.5;
  const sponson = (lx, ly, lz, w, d) => {
    put('steelDark', BOX, lx, ly, lz, w, 0.45, d);
    for (const s of [-1, 1]) put('steelDark', BOX, lx + s * (w / 2 - 0.3), ly - 1.2, lz, 0.3, 2, 0.3, 0, 0, -s * 0.5);
  };
  put('hullLight', BOX, ix, dy + 4, 15, 5.4, 8, 32);
  const sideWall = (B - 1.5) / 2;
  const islandOut = W / 2 + 1.2;
  const islandBase = hullTop(15) - 0.3;
  put('hullLight', BOX, (sideWall + islandOut) / 2, (islandBase + deckY) / 2, 15, islandOut - sideWall + 0.2, deckY - islandBase, 24);
  put('steelDark', BOX, (sideWall + islandOut) / 2, deckY + 0.2, 15, islandOut - sideWall + 0.6, 0.4, 24.4);
  for (let k = 1; k <= 29; k += 2.8) {
    put('window', BOX, ix - 2.72, dy + 2.4, k, 0.08, 0.9, 1.3);
    put('window', BOX, ix - 2.72, dy + 5.6, k, 0.08, 0.9, 1.3);
  }
  put('hullLight', BOX, ix, dy + 8.2, 15, 6, 0.4, 33);
  put('hull', BOX, ix, dy + 10.2, 12, 5, 3.6, 18);
  for (let k = 4; k <= 20; k += 2.2) put('window', BOX, ix - 2.52, dy + 10.6, k, 0.08, 0.8, 1.2);
  put('hullLight', BOX, ix, dy + 12.2, 12, 6.6, 0.35, 19);
  rails(put, [[ix - 3.3, 2.5], [ix - 3.3, 21.5], [ix + 3.3, 21.5]], dy + 12.4);
  put('hull', BOX, ix, dy + 14.3, 10, 4.4, 3.8, 10);
  put('window', BOX, ix, dy + 14.9, 15.02, 3.8, 1.1, 0.08);
  put('window', BOX, ix - 2.22, dy + 14.9, 10, 0.08, 1.1, 9);
  put('hullLight', BOX, ix, dy + 16.35, 10, 6, 0.3, 11.4);
  for (const side of [-1, 1]) {
    put('hull', BOX, ix - 0.4 + side * 3.3, dy + 14.6, 14.6, 2.2, 0.35, 2.2);
    put('steelDark', BOX, ix - 0.4 + side * 3.3, dy + 13.6, 14.6, 0.2, 2, 0.2);
  }
  rails(put, [[ix - 3, 4.4], [ix - 3, 15.6], [ix + 3, 15.6]], dy + 16.5);
  put('steel', CYL, ix, dy + 17.5, 8, 1.1, 2, 1.1);
  put('steelDark', BOX, ix, dy + 18.8, 8, 5.2, 0.6, 0.8);
  for (const side of [-1, 1]) put('steelDark', CYL, ix + side * 2.7, dy + 18.8, 8, 0.45, 0.7, 0.45, 0, 0, Math.PI / 2);
  sponson(ix - 3.6, dy + 8.6, 24, 3, 4);
  aa(put, ix - 3.6, dy + 8.8, 24, guns.local);
  sponson(ix - 3.6, dy + 8.6, 4, 3, 4);
  aa(put, ix - 3.6, dy + 8.8, 4, guns.local);
  const fz = 22;
  put('hullLight', BOX, ix + 0.8, dy + 10.5, fz, 5.4, 4, 9);
  put('funnel', BOX, ix + 1.2, dy + 17, fz + 1.5, 4.4, 11, 7, -0.16, 0, 0.06);
  put('funnelTop', BOX, ix + 1.55, dy + 22.6, fz + 2.5, 4.5, 0.9, 7.1, -0.16, 0, 0.06);
  for (let k = -1.5; k <= 1.5; k += 1) put('steelDark', BOX, ix + 1.6 + k, dy + 23.1, fz + 2.6, 0.12, 0.1, 6.6, -0.16, 0, 0);
  for (const side of [-1, 1]) put('steelLight', BOX, ix + 1.2 + side * 2.25, dy + 17, fz + 1.5, 0.12, 11, 0.25, -0.16, 0, 0.06);
  stacks?.stacks?.push(at(ix + 1.6, fz + 3).setY(dy + 23.4));
  const mx = ix;
  const mz = 11;
  const mastBase = dy + 16.5;
  put('steelDark', CYL, mx, mastBase + 9, mz, 0.32, 18, 0.32);
  for (const side of [-1, 1]) put('steelDark', CYL, mx + side * 1.8, mastBase + 4.5, mz + 1, 0.2, 9.6, 0.2, -0.1, 0, side * 0.2);
  put('steelDark', BOX, mx, mastBase + 7.5, mz, 8, 0.3, 0.3);
  put('steelDark', BOX, mx, mastBase + 12, mz, 5, 0.25, 0.25);
  put('steelLight', BOX, mx, mastBase + 15, mz, 4.6, 2.4, 0.2);
  for (let k = -2; k <= 2; k++) put('steelDark', BOX, mx + k, mastBase + 15, mz, 0.08, 2.4, 0.26);
  put('steelLight', DISH, mx, mastBase + 4, mz + 2.4, 1.3, 0.9, 1.3, Math.PI / 2.3, 0, 0);
  put('flagRed', BOX, mx, mastBase + 17.4, mz, 0.08, 1.4, 2.4);
  for (const side of [-1, 1]) {
    put('steelLight', CYL, mx + side * 1.4, mastBase + 1, mz + 1.6, 0.5, 0.6, 0.5, Math.PI / 2, 0, 0);
    put('lampGlass', CYL, mx + side * 1.4, mastBase + 1, mz + 1.92, 0.4, 0.05, 0.4, Math.PI / 2, 0, 0);
  }
  for (const [lz, side] of [[-102, -1], [-102, 1], [104, -1], [104, 1]]) {
    put('steelDark', CYL, side * (deckHalf(lz) - 2), dy + 0.3, lz, 0.5, 0.6, 0.5);
    put('steelDark', BOX, side * (deckHalf(lz) - 2), dy + 1.3, lz, 0.25, 2, 0.25);
  }
  for (let k = 0; k < 4; k++) {
    put('steelLight', BOX, -12 + k * 2.4, dy + 0.5, 52, 1.6, 1, 2.6);
    put('steelDark', CYL, -12 + k * 2.4 + 0.5, dy + 0.2, 53.6, 0.25, 0.4, 0.25, 0, 0, Math.PI / 2);
  }
  for (const [x0, z0] of [[12, -40], [12, -34], [-15, 10]]) {
    put('steelDark', BOX, x0, dy + 0.5, z0, 2.2, 1, 3.2);
    put('steelLight', BOX, x0, dy + 1.1, z0 - 0.4, 1.8, 0.4, 1.6);
  }
  for (const side of [-1, 1]) {
    for (const lz of [-94, -76, -40, 40, 76, 92]) {
      if (side > 0 && lz > -2 && lz < 34) continue;
      const edgeX = deckHalf(lz);
      const sx = side * (edgeX + 1.6);
      put('steelDark', BOX, sx, deckY - 0.2, lz, 3.6, 0.5, 7);
      rails(put, [[sx + side * 1.7, lz - 3.4], [sx + side * 1.7, lz + 3.4]], deckY);
      const inner = Math.max(0.5, wallAt(lz));
      for (const dz of [-3, 3]) strut(sx + side * 1.6, deckY - 0.4, lz + dz, side * inner, deckY - Math.min(7, edgeX - inner + 3), lz + dz);
      aa(put, sx, deckY, lz - 1.6, guns.local);
      aa(put, sx, deckY, lz + 1.8, guns.local);
    }
  }
  for (const side of [-1, 1]) {
    for (let k = -80; k <= 80; k += 40) {
      const bw = wallAt(k);
      put('boatWhite', BALL, side * (bw + 1.6), hullTop(k) + 5, k, 0.9, 0.7, 3);
      for (const dz of [-1.6, 1.6]) {
        put('steelDark', BOX, side * (bw + 0.9), hullTop(k) + 6.2, k + dz, 1.8, 0.18, 0.18);
        put('steelDark', BOX, side * (bw + 1.6), hullTop(k) + 5.7, k + dz, 0.12, 1.1, 0.12);
      }
    }
  }

  const slots = burning ? 9 : 18;
  for (let n = 0; n < slots; n++) {
    const row = Math.floor(n / 3);
    const col = n % 3;
    parked.push({ lx: -11 + col * 9.6 + (row % 2) * 2, y: dy, lz: -100 + row * 10.5, yaw: yaw + Math.PI + (rand() - 0.5) * 0.1, scorched: burning && n % 3 === 1 });
  }
  if (!burning) {
    for (const [lx, lz] of [[-6, 70], [6, 74]]) parked.push({ lx, y: dy, lz, yaw: yaw + (rand() - 0.5) * 0.1, scorched: false });
  }
  if (burning) {
    for (const [fx, fz, size] of [[-6, 40, 12], [8, -10, 10], [-10, -58, 9], [4, 82, 7], [ix, 14, 6]]) {
      put('scorch', BOX, fx, dy + 0.04, fz, size, 0.04, size * 1.3);
      for (let k = 0; k < 4; k++) put('scorch', BOX, fx + (rand() - 0.5) * size * 0.6, dy + 0.3, fz + (rand() - 0.5) * size * 0.6, 1.2 + rand() * 2, 0.5, 0.6 + rand(), rand(), rand() * 3, rand());
      fires.push(new THREE.Vector3(fx, dy + 0.4, fz));
    }
    put('window', BOX, 0, dy + 0.06, 60, 12, 0.05, 12);
    put('scorch', BOX, ix - 2.75, dy + 4, 18, 0.1, 5, 8);
  }
  return { L, B: W, top: 46 };
}
