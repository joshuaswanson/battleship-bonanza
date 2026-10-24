import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { frame } from './alpine.js';
import { toon, outlineMaterial } from './toon.js';

const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 16);
const OCT = new THREE.CylinderGeometry(1, 1, 1, 8);
const CONE = new THREE.ConeGeometry(1, 1, 16);
const BALL = new THREE.SphereGeometry(1, 14, 10);
const DISH = new THREE.CylinderGeometry(1, 0.6, 1, 16);

export function loftHull(L, B, depth, rand, { rise = 3.2, fine = 0.62, transom = 0.72 } = {}) {
  const rows = 40;
  const ring = 12;
  const positions = [];
  const width = (u) => {
    const bow = u > fine ? Math.sqrt(Math.max(0, 1 - ((u - fine) / (1 - fine)) ** 1.6)) : 1;
    const stern = u < 0.12 ? transom + (1 - transom) * Math.sin((u / 0.12) * Math.PI / 2) : 1;
    return (B / 2) * Math.min(bow, stern);
  };
  const sheer = (u) => depth + rise * Math.max(0, (u - 0.55) / 0.45) ** 2 + 0.6 * Math.max(0, (0.15 - u) / 0.15);
  const keel = -3;
  const section = (u) => {
    const z = (u - 0.5) * L;
    const w = Math.max(0.05, width(u));
    const top = sheer(u);
    const pts = [];
    for (let k = 0; k <= ring; k++) {
      const a = (k / ring) * Math.PI;
      const flare = 1 + 0.06 * Math.max(0, u - 0.6) / 0.4;
      const sx = Math.cos(a);
      const depthT = Math.sin(a);
      const y = top - (top - keel) * Math.pow(depthT, 0.6);
      const x = sx * w * (depthT > 0.85 ? 1 - (depthT - 0.85) * 1.6 : 1) * (y > 0 ? flare : 1);
      pts.push(new THREE.Vector3(x, y, z));
    }
    return pts;
  };
  const sections = [];
  for (let r = 0; r <= rows; r++) sections.push(section(r / rows));
  for (let r = 0; r < rows; r++) {
    for (let k = 0; k < ring; k++) {
      const a = sections[r][k];
      const b = sections[r][k + 1];
      const c = sections[r + 1][k];
      const d = sections[r + 1][k + 1];
      positions.push(...a.toArray(), ...c.toArray(), ...b.toArray(), ...b.toArray(), ...c.toArray(), ...d.toArray());
    }
  }
  const stern = sections[0];
  const mid = stern.reduce((acc, v) => acc.add(v), new THREE.Vector3()).divideScalar(stern.length);
  for (let k = 0; k < ring; k++) positions.push(...mid.toArray(), ...stern[k].toArray(), ...stern[k + 1].toArray());
  const deck = [];
  for (let r = 0; r <= rows; r++) deck.push([sections[r][0], sections[r][ring]]);
  const deckPositions = [];
  for (let r = 0; r < rows; r++) {
    const [a, b] = deck[r];
    const [c, d] = deck[r + 1];
    deckPositions.push(...a.toArray(), ...b.toArray(), ...c.toArray(), ...b.toArray(), ...d.toArray(), ...c.toArray());
  }
  const hull = new THREE.BufferGeometry();
  hull.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  hull.computeVertexNormals();
  const colors = [];
  const grey = new THREE.Color(0x4d5763);
  const band = new THREE.Color(0x2a2d33);
  const red = new THREE.Color(0x8a2b26);
  for (let i = 0; i < positions.length; i += 3) {
    const y = positions[i + 1];
    const c = y < -0.4 ? red : y < 1.1 ? band : grey;
    colors.push(c.r, c.g, c.b);
  }
  hull.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const deckGeometry = new THREE.BufferGeometry();
  deckGeometry.setAttribute('position', new THREE.Float32BufferAttribute(deckPositions.map((v, i) => (i % 3 === 1 ? v + 0.02 : v)), 3));
  deckGeometry.computeVertexNormals();
  return { hull, deck: deckGeometry, width, sheer };
}

const KIT_COLORS = { steel: 0x5a636e, steelDark: 0x3a4048, steelLight: 0x9aa4ae, gun: 0x3a4048, window: 0x1e242c };

export function kit() {
  const parts = [];
  const put = (key, geometry, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
    const g = (geometry.index ? geometry.toNonIndexed() : geometry.clone()).applyMatrix4(m);
    if (g.hasAttribute('uv')) g.deleteAttribute('uv');
    if (!g.hasAttribute('normal')) g.computeVertexNormals();
    const c = new THREE.Color(KIT_COLORS[key]);
    const rgb = new Float32Array(g.attributes.position.count * 3);
    for (let k = 0; k < g.attributes.position.count; k++) rgb.set([c.r, c.g, c.b], k * 3);
    g.setAttribute('color', new THREE.BufferAttribute(rgb, 3));
    parts.push(g);
  };
  const build = () => {
    const geometry = mergeGeometries(parts);
    const mesh = new THREE.Mesh(geometry, KIT_MATERIAL());
    mesh.add(new THREE.Mesh(geometry, outlineMaterial(0.07)));
    return mesh;
  };
  return { put, build };
}
let kitMaterial = null;
const KIT_MATERIAL = () => (kitMaterial ??= toon(0xffffff, { vertexColors: true }));

const TURRET_SHAPE = new THREE.Shape([new THREE.Vector2(-3, -3.4), new THREE.Vector2(3, -3.4), new THREE.Vector2(3.2, 1.6), new THREE.Vector2(2.2, 3.6), new THREE.Vector2(-2.2, 3.6), new THREE.Vector2(-3.2, 1.6)]);
const TURRET_BODY = new THREE.ExtrudeGeometry(TURRET_SHAPE, { depth: 2.4, bevelEnabled: false }).rotateX(-Math.PI / 2);

export function mainTurret(put, dyn, x, y, z, ry, s, elevation, turrets, at, shipYaw, barrelCount = 3, length = 11) {
  put('steelDark', CYL, x, y + 0.5 * s, z, 3.4 * s, 1 * s, 3.4 * s);
  const body = kit();
  body.put('steel', TURRET_BODY, 0, 1, 0);
  body.put('steelLight', BOX, 0, 3.45, -0.6, 5.6, 0.12, 5.4);
  for (const side of [-1, 1]) body.put('steelDark', CYL, side * 2.9, 3.1, -1.6, 0.5, 1.6, 0.5, 0, 0, (Math.PI / 2) * side);
  body.put('window', BOX, 0, 2.6, 3.62, 4, 0.25, 0.1);
  const spots = barrelCount === 3 ? [-1.4, 0, 1.4] : barrelCount === 2 ? [-0.9, 0.9] : [0];
  for (const k of spots) body.put('steelDark', BOX, k, 2, 3.5, 0.9, 1.3, 0.6);
  const yawGroup = body.build();
  const p = at(x, z);
  yawGroup.position.set(p.x, y, p.z);
  yawGroup.scale.setScalar(s);
  const base = shipYaw + ry;
  yawGroup.rotation.y = base;
  const pitchGroup = new THREE.Group();
  pitchGroup.position.set(0, 2, 3);
  yawGroup.add(pitchGroup);
  const barrels = kit();
  const muzzles = [];
  for (const k of spots) {
    barrels.put('steelDark', CYL, k, 0, 0.3, 0.75, 1.4, 0.75, Math.PI / 2, 0, 0);
    barrels.put('gun', CYL, k, 0, 0.8 + length / 2, 0.36, length, 0.36, Math.PI / 2, 0, 0);
    barrels.put('gun', CYL, k, 0, length + 0.2, 0.46, 0.6, 0.46, Math.PI / 2, 0, 0);
    muzzles.push(new THREE.Vector3(k, 0, length + 0.6));
  }
  const recoil = barrels.build();
  pitchGroup.add(recoil);
  pitchGroup.rotation.x = -elevation;
  dyn.add(yawGroup);
  turrets.push({ yawGroup, pitchGroup, recoil, base, yaw: 0, pitch: elevation, muzzles, size: s });
}

export function secondary(put, x, y, z, ry, s) {
  put('steelDark', CYL, x, y + 0.3, z, 1.6 * s, 0.6, 1.6 * s);
  put('steel', BOX, x, y + 1.2 * s, z, 2.6 * s, 1.6 * s, 2.8 * s, 0, ry, 0);
  for (const k of [-0.5, 0.5]) {
    put('gun', CYL, x + Math.sin(ry) * 2.6 * s + Math.cos(ry) * k * s, y + 1.5 * s + 0.6, z + Math.cos(ry) * 2.6 * s - Math.sin(ry) * k * s, 0.16 * s, 4 * s, 0.16 * s, Math.PI / 2 - 0.35, ry, 0);
  }
}

export function aa(put, x, y, z, guns) {
  put('steelDark', CYL, x, y + 0.4, z, 1.3, 0.8, 1.3);
  put('steelLight', CYL, x, y + 0.85, z, 1.45, 0.12, 1.45);
  put('steel', BOX, x, y + 1.2, z, 0.9, 0.8, 1.1);
  for (const k of [-0.32, 0.32]) put('gun', CYL, x + k, y + 2.2, z + 0.4, 0.09, 2.4, 0.09, -0.5, 0, 0);
  guns.push(new THREE.Vector3(x, y + 3.2, z + 0.9));
}

export function rails(put, points, y) {
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, az] = points[i];
    const [bx, bz] = points[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    const ang = Math.atan2(bx - ax, bz - az);
    put('steelLight', BOX, (ax + bx) / 2, y + 1, (az + bz) / 2, 0.08, 0.08, len, 0, ang, 0);
    put('steelLight', BOX, (ax + bx) / 2, y + 0.55, (az + bz) / 2, 0.06, 0.06, len, 0, ang, 0);
    const n = Math.max(1, Math.round(len / 2));
    for (let k = 0; k < n; k++) put('steelLight', BOX, ax + ((bx - ax) * k) / n, y + 0.5, az + ((bz - az) * k) / n, 0.07, 1, 0.07);
  }
}

export function floatplane(put, x, y, z, ry) {
  put('planeBlue', CYL, x, y + 1.3, z, 0.5, 4.6, 0.5, Math.PI / 2, ry, 0);
  put('planeBlue', BOX, x, y + 1.8, z, 8.5, 0.18, 1.5, 0, ry, 0);
  put('planeBlue', BOX, x - Math.sin(ry) * 2.2, y + 1.5, z - Math.cos(ry) * 2.2, 3, 0.14, 0.8, 0, ry, 0);
  put('planeBlue', BOX, x - Math.sin(ry) * 2.3, y + 2.1, z - Math.cos(ry) * 2.3, 0.14, 1.2, 0.9, 0, ry, 0);
  put('steelLight', CYL, x, y + 0.2, z, 0.45, 4, 0.45, Math.PI / 2, ry, 0);
  put('window', BALL, x + Math.sin(ry) * 0.5, y + 1.75, z + Math.cos(ry) * 0.5, 0.35, 0.3, 0.7, 0, ry, 0);
}

function launch(put, x, y, z, ry, s) {
  const fx = Math.sin(ry);
  const fz = Math.cos(ry);
  put('steelLight', BOX, x, y + 0.6 * s, z, 2.2 * s, 1 * s, 6 * s, 0, ry, 0);
  put('hullLight', BOX, x + fx * 0.5, y + 1.6 * s, z + fz * 0.5, 1.6 * s, 0.9 * s, 4.4 * s, 0, ry, 0);
  for (const k of [-0.4, 0.4]) put('steelDark', BOX, x + Math.cos(ry) * k * s, y + 1.2 * s, z - Math.sin(ry) * k * s, 0.15, 0.3 * s, 6 * s, 0, ry, 0);
}

export function bigBattleship(batch, dyn, x, z, yaw, rand, guns, turrets, fires) {
  const L = 172;
  const B = 30;
  const D = 7;
  const put = frame(batch, x, 0, z, yaw, 0, 0, 1);
  const at = (lx, lz) => new THREE.Vector3(x + lx * Math.cos(yaw) + lz * Math.sin(yaw), 0, z - lx * Math.sin(yaw) + lz * Math.cos(yaw));
  const { hull, deck, width, sheer } = loftHull(L, B, D, rand);
  const place = new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(1, 1, 1));
  batch.add('hullDark', hull, place);
  batch.add('deck', deck, place);
  const deckY = (lz) => sheer(lz / L + 0.5);
  for (let u = 0.08; u < 0.92; u += 0.025) {
    const lz = (u - 0.5) * L;
    const w = width(u);
    for (const side of [-1, 1]) {
      put('window', CYL, side * (w + 0.06), deckY(lz) - 1.6, lz, 0.28, 0.14, 0.28, 0, 0, Math.PI / 2);
    }
  }
  for (let u = 0.04; u < 0.96; u += 0.022) {
    const lz = (u - 0.5) * L;
    put('deckDark', BOX, 0, deckY(lz) + 0.03, lz, width(u) * 1.9, 0.02, 0.12);
  }
  const edge = [];
  for (let u = 0.02; u <= 0.98; u += 0.04) edge.push([width(u) - 0.3, (u - 0.5) * L]);
  for (const side of [-1, 1]) {
    for (let i = 0; i < edge.length - 1; i++) {
      const [w0, z0] = edge[i];
      const [w1, z1] = edge[i + 1];
      rails(put, [[side * w0, z0], [side * w1, z1]], (deckY(z0) + deckY(z1)) / 2);
    }
  }
  const bowZ = L / 2 - 6;
  for (const side of [-1, 1]) {
    put('steelDark', BALL, side * 2.6, deckY(bowZ) + 0.4, bowZ - 3, 0.6, 0.4, 0.6);
    for (let k = 0; k < 10; k++) put('steelDark', BOX, side * 2.6, deckY(bowZ - 4 - k * 0.8) + 0.15, bowZ - 4 - k * 0.8, 0.35, 0.18, 0.5, 0, 0, k % 2 ? 0 : Math.PI / 2);
    put('steelDark', BOX, side * (width(0.92) - 0.2), deckY(bowZ - 2) - 3.5, bowZ - 2, 0.3, 2.4, 1.6, 0, side * 0.2, 0);
  }
  put('flagRed', BOX, 0, deckY(-L / 2 + 2) + 4.5, -L / 2 + 2.5, 0.1, 1.6, 2.6);
  put('steelLight', CYL, 0, deckY(-L / 2 + 2) + 2.5, -L / 2 + 2, 0.08, 5, 0.08);

  const yA = deckY(52);
  mainTurret(put, dyn, 0, yA, 52, 0, 1.15, 0.32, turrets, at, yaw);
  mainTurret(put, dyn, 0, yA + 3.8, 36, 0, 1.15, 0.42, turrets, at, yaw);
  put('steelDark', CYL, 0, yA + 1.9, 36, 4.2, 3.8, 4.2);
  mainTurret(put, dyn, 0, deckY(-40) + 3.8, -40, Math.PI, 1.15, 0.38, turrets, at, yaw);
  put('steelDark', CYL, 0, deckY(-40) + 1.9, -40, 4.2, 3.8, 4.2);
  mainTurret(put, dyn, 0, deckY(-56), -56, Math.PI, 1.15, 0.3, turrets, at, yaw);

  const y0 = deckY(5);
  put('hull', BOX, 0, y0 + 2.5, 2, 16, 5, 50);
  put('hullLight', BOX, 0, y0 + 5.25, 2, 16.6, 0.5, 50.6);
  for (const side of [-1, 1]) {
    for (let k = -20; k <= 24; k += 4) put('window', BOX, side * 8.03, y0 + 3.4, k, 0.08, 0.7, 1.6);
    for (const lz of [-14, 0, 14]) secondary(put, side * 10.5, y0, lz, side * Math.PI / 2, 1);
    for (const lz of [-22, -8, 8, 22]) aa(put, side * 8.2, y0 + 5.5, lz, guns);
  }
  put('hull', BOX, 0, y0 + 7.5, 10, 12, 4, 22);
  put('hullLight', BOX, 0, y0 + 9.7, 10, 12.6, 0.4, 22.6);
  for (const side of [-1, 1]) for (let k = 1; k <= 19; k += 3) put('window', BOX, side * 6.03, y0 + 8, k, 0.08, 0.6, 1.2);
  const tower = [[12.5, 9, 9, 4], [16.5, 7.4, 7.8, 4], [20.5, 6, 6.6, 3.4], [24, 4.6, 5, 3]];
  let ty = y0 + 9.9;
  for (const [, w, d, h] of tower) {
    put('hull', BOX, 0, ty + h / 2, 17, w, h, d);
    put('window', BOX, 0, ty + h * 0.62, 17 + d / 2 + 0.02, w * 0.85, h * 0.25, 0.08);
    for (const side of [-1, 1]) put('window', BOX, side * (w / 2 + 0.02), ty + h * 0.62, 17, 0.08, h * 0.25, d * 0.8);
    put('hullLight', BOX, 0, ty + h + 0.12, 17, w + 0.8, 0.25, d + 0.8);
    rails(put, [[-w / 2 - 0.3, 17 + d / 2 + 0.3], [w / 2 + 0.3, 17 + d / 2 + 0.3]], ty + h + 0.2);
    ty += h + 0.25;
  }
  for (const side of [-1, 1]) {
    put('steelDark', BOX, side * 5.6, y0 + 22.4, 17, 4.4, 0.6, 0.6);
    put('steelDark', CYL, side * 7.8, y0 + 22.4, 17, 0.55, 0.9, 0.55, 0, 0, Math.PI / 2);
    const lightY = y0 + 9.9 + 4 + 0.25 + 4 + 0.25;
    put('steelDark', CYL, side * 3, lightY + 0.4, 19.6, 0.12, 0.8, 0.12);
    put('steelLight', DISH, side * 3, lightY + 1.1, 19.9, 0.55, 0.5, 0.55, Math.PI / 2, 0, 0);
    put('lampGlass', CYL, side * 3, lightY + 1.1, 20.18, 0.42, 0.05, 0.42, Math.PI / 2, 0, 0);
  }
  put('steel', OCT, 0, ty + 1.2, 17, 2.2, 2.4, 2.2);
  put('steelDark', BOX, 0, ty + 2.8, 17, 9, 0.8, 1.2);
  for (const side of [-1, 1]) put('steelDark', CYL, side * 4.6, ty + 2.8, 17, 0.6, 0.8, 0.6, 0, 0, Math.PI / 2);
  put('steelDark', CYL, 0, ty + 8, 15, 0.35, 12, 0.35);
  put('steelDark', BOX, 0, ty + 11, 15, 8, 0.3, 0.3);
  put('steelDark', BOX, 0, ty + 8.5, 15, 5, 0.25, 0.25);
  for (const side of [-1, 1]) put('steelDark', CYL, side * 2.2, ty + 4, 15.5, 0.12, 8.5, 0.12, 0, 0, side * 0.24);
  put('flagRed', BOX, 0, ty + 13.4, 15, 0.08, 1.3, 2.4);

  for (const [fz, fs] of [[-2, 1], [-12, 0.9]]) {
    const fy = y0 + 5.5;
    put('hullLight', OCT, 0, fy + 1, fz, 4.6 * fs, 2, 5.4 * fs);
    put('funnel', CYL, 0, fy + 6.5 * fs, fz - 0.6, 3.2 * fs, 11 * fs, 4.2 * fs, 0.06, 0, 0);
    put('funnelTop', CYL, 0, fy + 12.2 * fs, fz - 0.9, 3.25 * fs, 1 * fs, 4.25 * fs, 0.06, 0, 0);
    for (let k = -2; k <= 2; k++) put('steelDark', BOX, k * 1.1 * fs, fy + 12.75 * fs, fz - 0.95, 0.12, 0.08, 7.6 * fs, 0.06, 0, 0);
    for (const side of [-1, 1]) put('steelLight', CYL, side * 3.6 * fs, fy + 6 * fs, fz - 0.4, 0.15, 10 * fs, 0.15, 0.06, 0, 0);
    fires && fires.stacks.push(at(0, fz - 1.2).setY(fy + 12.8 * fs));
  }
  put('hull', BOX, 0, y0 + 7.5, -14, 10, 4, 10);
  put('steelDark', CYL, 0, y0 + 14, -22, 0.3, 14, 0.3);
  put('steelDark', BOX, 0, y0 + 19, -22, 6, 0.25, 0.25);
  for (const side of [-1, 1]) {
    put('boatWhite', BALL, side * 6.3, y0 + 6.3, -6, 1.1, 0.8, 3.2);
    put('boot', BOX, side * 6.3, y0 + 6.5, -6, 2, 0.15, 6);
    for (const lz of [-29, -24.5]) aa(put, side * 5.2, deckY(lz), lz, guns);
  }
  const catY = deckY(-68);
  launch(put, 0, catY, -66, Math.PI, 1);
  floatplane(put, 0, catY + 2.1, -66, Math.PI);
  put('steelDark', CYL, 6, catY + 4, -64, 0.3, 8, 0.3);
  put('steelDark', BOX, 3.2, catY + 7.6, -64, 6, 0.3, 0.3, 0, 0, 0.3);
  put('steelDark', CYL, 1, catY + 4.8, -64, 0.05, 5, 0.05);
  for (const lz of [64, 46, -48, -62]) for (const side of [-1, 1]) aa(put, side * (width(lz / L + 0.5) - 3), deckY(lz), lz, guns);
  return { L, B, top: 50 };
}
