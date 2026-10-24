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

export function carrier(batch, x, z, yaw, rand, fires, guns, burning, parked) {
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
  const DL = 226;
  put('hullLight', BOX, 0, (hullTop(0) + deckY) / 2 - 0.4, -2, B - 1.5, deckY - hullTop(0) - 0.8, DL - 40);
  for (const side of [-1, 1]) {
    for (let k = -84; k <= 84; k += 14) {
      put('window', BOX, side * ((B - 1.5) / 2 + 0.03), hullTop(0) + 2.6, k, 0.08, 2.6, 8.5);
      put('steelDark', BOX, side * ((B - 1.5) / 2 + 0.06), hullTop(0) + 4.2, k, 0.1, 0.2, 9);
    }
    for (let k = -100; k <= 100; k += 12) {
      put('steelDark', BOX, side * (W / 2 - 3.4), deckY - 2.6, k, 0.4, 4.6, 0.4, 0, 0, side * -0.55);
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
  put('hullLight', BOX, ix, dy + 5, 14, 6.4, 10, 30);
  put('hullLight', BOX, ix + 4, deckY - 3, 14, 6, 6, 26);
  put('steelDark', BOX, ix + 4, deckY - 6, 14, 6, 0.4, 26);
  for (let k = 2; k <= 28; k += 3.2) for (const yy of [dy + 3, dy + 7]) put('window', BOX, ix - 3.22, yy, k, 0.08, 0.8, 1.5);
  put('hull', BOX, ix, dy + 12, 10, 5.4, 4, 14);
  put('window', BOX, ix, dy + 12.6, 17.02, 4.6, 1, 0.08);
  for (const side of [-1, 1]) put('window', BOX, ix + side * 2.72, dy + 12.6, 10, 0.08, 1, 12);
  put('hullLight', BOX, ix, dy + 14.25, 10, 7.4, 0.3, 15.4);
  rails(put, [[ix - 3.6, 17.6], [ix + 3.6, 17.6]], dy + 14.3);
  for (const side of [-1, 1]) put('hull', BOX, ix + side * 4.4, dy + 12.6, 15.5, 3.4, 0.6, 2.6);
  put('hull', BOX, ix, dy + 16.2, 9, 4.4, 3.6, 8);
  put('window', BOX, ix, dy + 16.6, 13.02, 3.6, 0.8, 0.08);
  put('funnel', BOX, ix + 0.6, dy + 15, 24, 5.4, 18, 8, -0.14, 0, 0.05);
  put('funnelTop', BOX, ix + 0.9, dy + 24, 25.2, 5.5, 1, 8.1, -0.14, 0, 0.05);
  for (let k = -2; k <= 2; k++) put('steelDark', BOX, ix + 0.9 + k * 1, dy + 24.6, 25.3, 0.12, 0.1, 7.6, -0.14, 0, 0);
  const mx = ix;
  const mz = 6;
  put('steelDark', CYL, mx, dy + 25, mz, 0.3, 18, 0.3);
  for (const side of [-1, 1]) put('steelDark', CYL, mx + side * 1.6, dy + 21, mz + 1.4, 0.18, 10, 0.18, -0.12, 0, side * 0.16);
  put('steelDark', BOX, mx, dy + 27, mz, 9, 0.3, 0.3);
  put('steelDark', BOX, mx, dy + 30, mz, 5.5, 0.25, 0.25);
  put('steelLight', BOX, mx, dy + 32.6, mz, 4.6, 2.2, 0.2);
  for (let k = -2; k <= 2; k++) put('steelDark', BOX, mx + k, dy + 32.6, mz, 0.08, 2.2, 0.26);
  put('steelLight', DISH, mx, dy + 22.5, mz + 3.6, 1.4, 0.9, 1.4, Math.PI / 2.3, 0, 0);
  put('flagRed', BOX, mx, dy + 34.7, mz, 0.08, 1.4, 2.4);

  for (const side of [-1, 1]) {
    for (const lz of [-94, -76, -40, 40, 76, 92]) {
      if (side > 0 && lz > -2 && lz < 34) continue;
      const sx = side * (W / 2 + 1.6);
      put('steelDark', BOX, sx, deckY - 0.2, lz, 3.6, 0.5, 7);
      rails(put, [[sx + side * 1.7, lz - 3.4], [sx + side * 1.7, lz + 3.4]], deckY);
      aa(put, sx, deckY, lz - 1.6, guns.local);
      aa(put, sx, deckY, lz + 1.8, guns.local);
    }
  }
  for (const side of [-1, 1]) {
    for (let k = -80; k <= 80; k += 40) {
      put('boatWhite', BALL, side * ((B - 1.5) / 2 + 1.2), hullTop(0) + 5, k, 0.9, 0.7, 3);
      put('steelDark', BOX, side * ((B - 1.5) / 2 + 0.6), hullTop(0) + 5.8, k, 1.2, 0.15, 4);
    }
  }

  const slots = burning ? 7 : 14;
  for (let n = 0; n < slots; n++) {
    const row = Math.floor(n / 3);
    const col = n % 3;
    parked.push({ lx: -10 + col * 9.5, y: dy, lz: -98 + row * 11, yaw: yaw + Math.PI + (rand() - 0.5) * 0.12, scorched: burning && n % 3 === 1 });
  }
  if (burning) {
    for (const [fx, fz, size] of [[-6, 40, 12], [8, -10, 10], [-10, -58, 9], [4, 82, 7], [ix, 14, 6]]) {
      put('scorch', BOX, fx, dy + 0.04, fz, size, 0.04, size * 1.3);
      for (let k = 0; k < 4; k++) put('scorch', BOX, fx + (rand() - 0.5) * size * 0.6, dy + 0.3, fz + (rand() - 0.5) * size * 0.6, 1.2 + rand() * 2, 0.5, 0.6 + rand(), rand(), rand() * 3, rand());
      fires.push(new THREE.Vector3(fx, dy + 0.4, fz));
    }
    put('window', BOX, 0, dy + 0.06, 60, 12, 0.05, 12);
    put('scorch', BOX, ix, dy + 8, 14, 6.5, 6, 8);
  }
  return { L, B: W, top: 46 };
}
