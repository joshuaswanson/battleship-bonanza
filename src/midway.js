import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createWater } from './water.js';
import { toon, glow, outlineMaterial, mulberry32 } from './toon.js';
import { Batcher, cullChunks, COLORS, createSky, createCloud, createArch, SUN_DIR } from './world.js';
import { courseBuoys, ellipseHit } from './terrain.js';
import { frame } from './alpine.js';

const NAVY = {
  ...COLORS,
  hull: 0x6b7785,
  hullDark: 0x4d5763,
  hullLight: 0x8a95a2,
  boot: 0x2a2d33,
  keelRed: 0x8a2b26,
  deck: 0x7a6e5c,
  deckDark: 0x5e5446,
  deckLine: 0xf2efe6,
  steel: 0x5a636e,
  steelDark: 0x3a4048,
  window: 0x1e242c,
  funnel: 0x4a525c,
  funnelTop: 0x1a1c20,
  gun: 0x3a4048,
  scorch: 0x1c1b1a,
  wreck: 0x4a4f55,
  oil: 0x15161a,
  raft: 0xe8a33a,
  planeBlue: 0x3b5d8c,
  planeGreen: 0x5f6b45,
};

const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 14);
const CONE = new THREE.ConeGeometry(1, 1, 14);
const BALL = new THREE.SphereGeometry(1, 14, 10);
const DISH = new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2);

function hullGeometry(length, beam, height, stern = 0.85) {
  const s = new THREE.Shape();
  const l = length / 2;
  const w = beam / 2;
  s.moveTo(0, -l);
  s.quadraticCurveTo(w * 0.9, -l + length * 0.18, w, -l + length * 0.36);
  s.lineTo(w, l - length * 0.12);
  s.quadraticCurveTo(w, l, w * stern, l);
  s.lineTo(-w * stern, l);
  s.quadraticCurveTo(-w, l, -w, l - length * 0.12);
  s.lineTo(-w, -l + length * 0.36);
  s.quadraticCurveTo(-w * 0.9, -l + length * 0.18, 0, -l);
  return new THREE.ExtrudeGeometry(s, { depth: height, bevelEnabled: false, curveSegments: 10 }).rotateX(-Math.PI / 2).rotateY(Math.PI);
}

function aaMount(put, x, y, z, guns) {
  put('steelDark', CYL, x, y, z, 1.1, 0.8, 1.1);
  put('steel', CYL, x, y + 0.6, z, 0.6, 0.6, 0.6);
  for (let k = 0; k < 2; k++) put('gun', CYL, x + (k - 0.5) * 0.5, y + 1.6, z, 0.1, 2.2, 0.1, -0.35, 0, 0);
  guns.push(new THREE.Vector3(x, y + 2.6, z));
}

function turret(put, x, y, z, ry, size, elevation = 0.45) {
  put('steel', CYL, x, y + 0.6 * size, z, 2.4 * size, 1.2 * size, 2.4 * size);
  put('steelDark', BOX, x, y + 1.3 * size, z - 0.4 * size, 3.6 * size, 1.4 * size, 3.4 * size, 0, ry);
  for (const k of [-0.7, 0.7]) {
    const bx = x + Math.cos(ry) * k * size;
    const bz = z - Math.sin(ry) * k * size;
    put('gun', CYL, bx + Math.sin(ry) * 3 * size, y + 1.5 * size + Math.sin(elevation) * 3 * size, bz + Math.cos(ry) * 3 * size, 0.28 * size, 6 * size, 0.28 * size, Math.PI / 2 - elevation, ry, 0);
  }
}

function plane(put, x, y, z, ry, color) {
  put(color, CYL, x, y + 0.8, z, 0.55, 5, 0.55, Math.PI / 2, ry, 0);
  put(color, BOX, x, y + 0.6, z, 9, 0.2, 1.6, 0, ry, 0);
  put(color, BOX, x - Math.sin(ry) * 2.3, y + 0.9, z - Math.cos(ry) * 2.3, 3.4, 0.15, 0.9, 0, ry, 0);
  put('window', BALL, x + Math.sin(ry) * 0.4, y + 1.3, z + Math.cos(ry) * 0.4, 0.4, 0.35, 0.8, 0, ry, 0);
}

function carrier(batch, x, z, yaw, rand, fires, guns, burning) {
  const put = frame(batch, x, 0, z, yaw, 0, 0, 1);
  const L = 150;
  const B = 24;
  batch.add('keelRed', hullGeometry(L - 4, B - 1, 3), new THREE.Matrix4().compose(new THREE.Vector3(x, -2.6, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(1, 1, 1)));
  batch.add('hull', hullGeometry(L, B, 9.5), new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(1, 1, 1)));
  put('boot', BOX, 0, 0.4, 0, B + 0.15, 0.6, L * 0.82);
  for (let k = -60; k <= 60; k += 6) {
    for (const side of [-1, 1]) put('window', BOX, side * (B / 2 + 0.02), 6.4, k, 0.1, 0.6, 1.2);
  }
  put('steelDark', BOX, 0, 10.3, 0, 30, 1.6, L + 8);
  put('deck', BOX, 0, 11.2, 0, 30, 0.3, L + 8);
  for (let k = -(L + 8) / 2 + 2; k < (L + 8) / 2 - 2; k += 3.2) put(Math.round(k / 3.2) % 2 ? 'deck' : 'deckDark', BOX, 0, 11.37, k, 29.6, 0.04, 1.4);
  put('deckLine', BOX, 0, 11.42, 0, 0.5, 0.05, L + 2);
  for (const side of [-1, 1]) put('deckLine', BOX, side * 14.2, 11.42, 0, 0.35, 0.05, L + 6);
  for (let k = -70; k < 70; k += 10) put('deckLine', BOX, -6, 11.42, k, 0.4, 0.05, 4);
  put('deckLine', BOX, 0, 11.42, -60, 8, 0.05, 0.5);
  put('deckLine', BOX, 0, 11.42, 60, 8, 0.05, 0.5);
  const ix = 11;
  put('hullLight', BOX, ix, 15, 10, 6, 7.6, 22);
  put('hull', BOX, ix, 20, 8, 5, 3, 14);
  put('window', BOX, ix, 20.5, 8, 5.1, 0.9, 14.1);
  put('hull', BOX, ix, 23, 9, 4, 3, 9);
  put('window', BOX, ix, 23.3, 9, 4.1, 0.7, 9.1);
  put('funnel', BOX, ix + 0.5, 22.5, 20, 4, 9, 6, -0.12, 0, 0);
  put('funnelTop', BOX, ix + 0.5, 27, 20.6, 4.1, 0.6, 6.1, -0.12, 0, 0);
  put('steelDark', CYL, ix, 30, 6, 0.3, 14, 0.3);
  put('steelDark', BOX, ix, 33, 6, 5, 0.25, 0.25);
  put('steelDark', BOX, ix, 30, 6, 3.4, 0.25, 0.25);
  put('steel', DISH, ix, 26.2, 2, 1.6, 1, 1.6, Math.PI / 2.4, 0, 0);
  for (let k = -64; k <= 64; k += 16) {
    for (const side of [-1, 1]) {
      if (side > 0 && k > -8 && k < 30) continue;
      aaMount(put, side * 15.8, 10.4, k, guns.local);
    }
  }
  const parked = burning ? 4 : 9;
  for (let n = 0; n < parked; n++) {
    const pz = -66 + (n % 3) * 7 + Math.floor(n / 3) * 8;
    const px = -8 + (n % 3) * 7;
    plane(put, px, 11.4, pz, Math.PI + (rand() - 0.5) * 0.2, n % 4 === 3 ? 'scorch' : 'planeBlue');
  }
  if (burning) {
    for (const [fx, fz, size] of [[-4, 30, 9], [6, -12, 7], [-9, -40, 6], [3, 55, 5]]) {
      put('scorch', BOX, fx, 11.44, fz, size, 0.05, size * 1.3);
      put('scorch', BOX, fx + 1, 11.6, fz, size * 0.6, 0.4, size * 0.4, 0.2, 0.4, 0.1);
      fires.push(new THREE.Vector3(fx, 11.6, fz));
    }
    put('scorch', BOX, ix, 19, 10, 6.05, 3, 6);
  }
  return { L, B, top: 34 };
}

function battleship(batch, x, z, yaw, guns, cannons) {
  const put = frame(batch, x, 0, z, yaw, 0, 0, 1);
  const L = 100;
  const B = 18;
  batch.add('keelRed', hullGeometry(L - 4, B - 1, 3), new THREE.Matrix4().compose(new THREE.Vector3(x, -2.6, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(1, 1, 1)));
  batch.add('hullDark', hullGeometry(L, B, 6), new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(1, 1, 1)));
  put('boot', BOX, 0, 0.4, 0, B + 0.15, 0.6, L * 0.8);
  put('deck', BOX, 0, 6.1, -2, B - 2, 0.2, L * 0.8);
  put('hull', BOX, 0, 9, 0, 10, 6, 30);
  put('hull', BOX, 0, 13.5, 4, 8, 3.5, 16);
  put('window', BOX, 0, 13.8, 12.05, 6, 0.8, 0.1);
  put('hullLight', BOX, 0, 18, 8, 5, 6, 7);
  put('window', BOX, 0, 19.5, 11.6, 4, 0.8, 0.1);
  put('hull', BOX, 0, 22.5, 8, 3.5, 3, 5);
  put('steelDark', CYL, 0, 28, 8, 0.25, 10, 0.25);
  put('steelDark', BOX, 0, 30, 8, 7, 0.25, 0.25);
  put('funnel', CYL, 0, 15, -4, 2.4, 9, 3, 0.15, 0, 0);
  put('funnelTop', CYL, 0, 19.6, -4.7, 2.45, 0.6, 3.05, 0.15, 0, 0);
  const at = (lz) => new THREE.Vector3(Math.sin(yaw) * lz + x, 0, Math.cos(yaw) * lz + z);
  for (const [tz, ry] of [[32, 0], [21, 0], [-28, Math.PI]]) {
    turret(put, 0, tz === 21 ? 8 : 6.2, tz, ry, 1.1);
    cannons.push({ at: at(tz + (ry ? -7 : 7)), y: 10, yaw: yaw + ry, timer: 2 + Math.random() * 5 });
  }
  for (const side of [-1, 1]) {
    for (const lz of [-12, 0, 14]) aaMount(put, side * 7, 6.2, lz, guns.local);
    turret(put, side * 6.5, 6.2, -6, Math.PI / 2 * side, 0.55, 0.9);
  }
  return { L, B, top: 30 };
}

function destroyer(batch, x, z, yaw, guns, cannons) {
  const put = frame(batch, x, 0, z, yaw, 0, 0, 1);
  const L = 48;
  const B = 8;
  batch.add('hull', hullGeometry(L, B, 4.5, 0.8), new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(1, 1, 1)));
  put('boot', BOX, 0, 0.4, 0, B + 0.1, 0.5, L * 0.75);
  put('deck', BOX, 0, 4.6, -1, B - 1.4, 0.15, L * 0.8);
  put('hullLight', BOX, 0, 7, 8, 5, 4.5, 7);
  put('window', BOX, 0, 8.4, 11.55, 4, 0.7, 0.1);
  put('steelDark', CYL, 0, 13, 7, 0.18, 8, 0.18);
  for (const fz of [-2, -7]) {
    put('funnel', CYL, 0, 7.5, fz, 1.1, 5, 1.4, 0.15, 0, 0);
    put('funnelTop', CYL, 0, 10, fz - 0.4, 1.12, 0.4, 1.42, 0.15, 0, 0);
  }
  turret(put, 0, 4.6, 16, 0, 0.55, 0.6);
  turret(put, 0, 4.6, -16, Math.PI, 0.55, 0.6);
  cannons.push({ at: new THREE.Vector3(Math.sin(yaw) * 19 + x, 0, Math.cos(yaw) * 19 + z), y: 7, yaw, timer: 1 + Math.random() * 4 });
  for (const lz of [-11, 2]) aaMount(put, 0, 4.6 + (lz > 0 ? 4.6 : 0), lz, guns.local);
  return { L, B, top: 14 };
}

function planeGeometry(kind) {
  const parts = [];
  const add = (geometry, color, m) => {
    const g = geometry.clone().applyMatrix4(m);
    const flat = g.index ? g.toNonIndexed() : g;
    flat.deleteAttribute('uv');
    const c = new THREE.Color(color);
    const n = flat.attributes.position.count;
    const rgb = new Float32Array(n * 3);
    for (let k = 0; k < n; k++) rgb.set([c.r, c.g, c.b], k * 3);
    flat.setAttribute('color', new THREE.BufferAttribute(rgb, 3));
    parts.push(flat);
  };
  const M = (x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
  const capsule = new THREE.CapsuleGeometry(1, 1, 6, 12).rotateX(Math.PI / 2);
  if (kind === 'bomber') {
    const body = 0x4a5d73;
    add(capsule, body, M(0, 0, 0, 1.4, 1.5, 6.5));
    add(BALL, 0x9fd3f0, M(0, 0.3, 6.4, 1.05, 1.0, 1.2));
    add(BOX, body, M(0, 0, 0.6, 20, 0.35, 3.2));
    add(BOX, body, M(0, 0.4, -7.4, 7, 0.25, 1.8));
    for (const s of [-1, 1]) {
      add(BOX, body, M(s * 3.4, 1.6, -7.6, 0.25, 3, 2));
      add(CYL, 0x3a4048, M(s * 5, -0.2, 2.2, 0.7, 3.4, 0.7, Math.PI / 2));
      add(CYL, 0x23262b, M(s * 5, -0.2, 4, 0.45, 0.4, 0.45, Math.PI / 2));
      add(CYL, 0xf2efe6, M(s * 7.5, 0.2, 0.6, 1.0, 0.05, 1.0));
      add(CYL, 0x2f4f7a, M(s * 7.5, 0.23, 0.6, 0.55, 0.05, 0.55));
    }
    add(BALL, 0x9fd3f0, M(0, 1.3, 1.5, 0.7, 0.6, 1.4));
  } else {
    const body = kind === 'blue' ? 0x3b5d8c : 0x5f6b45;
    const belly = kind === 'blue' ? 0xc9d3dd : 0xa9ad92;
    add(capsule, body, M(0, 0, 0, 0.75, 0.8, 3.1));
    add(capsule, belly, M(0, -0.32, -0.2, 0.55, 0.45, 2.7));
    add(CYL, 0x2a2d33, M(0, 0, 3.3, 0.82, 0.6, 0.82, Math.PI / 2));
    add(CYL, 0x23262b, M(0, 0, 3.7, 0.22, 0.4, 0.22, Math.PI / 2));
    add(BOX, body, M(0, -0.3, 0.6, 10.5, 0.22, 1.9));
    add(BOX, body, M(0, 0.1, -3.4, 3.8, 0.16, 1.1));
    add(BOX, body, M(0, 0.85, -3.5, 0.16, 1.5, 1.2));
    add(BALL, 0x9fd3f0, M(0, 0.65, 0.5, 0.48, 0.42, 0.95));
    const roundel = kind === 'blue' ? [0xf2efe6, 0x2f4f7a] : [0xf2efe6, 0xd0343a];
    for (const s of [-1, 1]) {
      add(CYL, roundel[0], M(s * 3.6, -0.17, 0.6, 0.62, 0.04, 0.62));
      add(CYL, roundel[1], M(s * 3.6, -0.15, 0.6, 0.38, 0.04, 0.38));
    }
    if (kind === 'blue') add(BOX, 0xf2efe6, M(0, 0.85, -3.75, 0.18, 0.3, 0.5));
    else add(BOX, 0xd0343a, M(0, 0.85, -3.75, 0.18, 0.4, 0.4));
  }
  const geometry = mergeGeometries(parts);
  geometry.computeVertexNormals();
  return geometry;
}

function propGeometry(size) {
  return new THREE.CylinderGeometry(size, size, 0.05, 20).rotateX(Math.PI / 2);
}

function parachuteGeometry() {
  const parts = [];
  const add = (geometry, color, m) => {
    const g = (geometry.index ? geometry.toNonIndexed() : geometry.clone()).applyMatrix4(m);
    g.deleteAttribute('uv');
    const c = new THREE.Color(color);
    const rgb = new Float32Array(g.attributes.position.count * 3);
    for (let k = 0; k < g.attributes.position.count; k++) rgb.set([c.r, c.g, c.b], k * 3);
    g.setAttribute('color', new THREE.BufferAttribute(rgb, 3));
    parts.push(g);
  };
  const M = (x, y, z, sx, sy, sz, rx = 0, rz = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, 0, rz)), new THREE.Vector3(sx, sy, sz));
  add(DISH, 0xf2efe6, M(0, 4, 0, 3, 1.6, 3));
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    add(CYL, 0x8a8f96, M(Math.cos(a) * 1.4, 2, Math.sin(a) * 1.4, 0.04, 4.2, 0.04, Math.sin(a) * 0.6, -Math.cos(a) * 0.6));
  }
  add(CYL, 0x5f6b45, M(0, 0, 0, 0.35, 1.1, 0.35));
  add(BALL, 0xffd2b0, M(0, 0.8, 0, 0.3, 0.3, 0.3));
  const g = mergeGeometries(parts);
  g.computeVertexNormals();
  return g;
}

class Squadron {
  constructor(group, geometry, prop, count, outline) {
    const material = toon(0xffffff, { vertexColors: true });
    this.mesh = new THREE.InstancedMesh(geometry, material, count);
    this.line = new THREE.InstancedMesh(geometry, outlineMaterial(outline), count);
    this.line.instanceMatrix = this.mesh.instanceMatrix;
    this.props = prop ? new THREE.InstancedMesh(prop.geometry, new THREE.MeshBasicMaterial({ color: 0xd9dee8, transparent: true, opacity: 0.45, depthWrite: false }), count * prop.offsets.length) : null;
    this.propOffsets = prop?.offsets ?? [];
    for (const m of [this.mesh, this.line, this.props]) {
      if (!m) continue;
      m.frustumCulled = false;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      group.add(m);
    }
    this.count = count;
    this.m = new THREE.Matrix4();
    this.p = new THREE.Matrix4();
  }

  set(i, matrix, visible = true) {
    if (!visible) matrix = this.m.makeScale(0, 0, 0);
    this.mesh.setMatrixAt(i, matrix);
    if (this.props) {
      this.propOffsets.forEach((o, k) => this.props.setMatrixAt(i * this.propOffsets.length + k, visible ? this.p.copy(matrix).multiply(o) : matrix));
    }
  }

  flush() {
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.props) this.props.instanceMatrix.needsUpdate = true;
  }
}

class Tracers {
  constructor(group, max = 500) {
    const geometry = new THREE.BoxGeometry(0.22, 0.22, 7).translate(0, 0, -3.5);
    this.mesh = new THREE.InstancedMesh(geometry, glow(0xffd36b), max);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    group.add(this.mesh);
    this.list = [];
    this.max = max;
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.z = new THREE.Vector3(0, 0, 1);
    this.d = new THREE.Vector3();
    this.one = new THREE.Vector3(1, 1, 1);
  }

  fire(from, to, speed, spread = 0.02) {
    if (this.list.length >= this.max) return;
    const dir = to.clone().sub(from).normalize();
    dir.x += (Math.random() - 0.5) * spread;
    dir.y += (Math.random() - 0.5) * spread;
    dir.z += (Math.random() - 0.5) * spread;
    dir.normalize();
    this.list.push({ pos: from.clone(), vel: dir.multiplyScalar(speed), life: Math.min(2, from.distanceTo(to) / speed + 0.3) });
  }

  update(dt) {
    let n = 0;
    this.list = this.list.filter((t) => {
      t.life -= dt;
      if (t.life <= 0) return false;
      t.pos.addScaledVector(t.vel, dt);
      this.q.setFromUnitVectors(this.z, this.d.copy(t.vel).normalize());
      this.mesh.setMatrixAt(n++, this.m.compose(t.pos, this.q, this.one));
      return true;
    });
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

function oilSlick(batch, x, z, size, rand) {
  for (let k = 0; k < 5; k++) {
    const a = rand() * Math.PI * 2;
    const r = rand() * size * 0.5;
    const s = size * (0.4 + rand() * 0.5);
    batch.add('oil', CYL, new THREE.Matrix4().compose(new THREE.Vector3(x + Math.cos(a) * r, 0.25, z + Math.sin(a) * r), new THREE.Quaternion(), new THREE.Vector3(s, 0.05, s * (0.6 + rand() * 0.4))));
  }
}

function sunkPlane(batch, x, z, yaw, rand, color) {
  const put = frame(batch, x, -1.2, z, yaw, -0.5 - rand() * 0.4, (rand() - 0.5) * 0.6, 1);
  put(color, CYL, 0, 0.8, -1.5, 0.55, 5, 0.55, Math.PI / 2, 0, 0);
  put(color, BOX, 0, 1.2, -3.6, 3.6, 0.15, 1, 0, 0, 0);
  put(color, BOX, 0, 2, -3.7, 0.15, 1.6, 1.2, 0, 0, 0);
  put('scorch', BOX, rand() < 0.5 ? 2 : -2, 0.4, -0.5, 4, 0.2, 1.6, 0, 0, (rand() - 0.5) * 0.8);
}

export async function createMidway(group, track, fx) {
  const fog = new THREE.Fog(0x8a8580, 260, 950);
  const sky = createSky({ top: 0x3f4752, horizon: 0xb0998a });
  const wind = new THREE.Vector3(2.5, 0, 0.8);
  group.add(sky);
  group.add(new THREE.HemisphereLight(0xc9d1d9, 0x2b4656, 1.15));
  const sun = new THREE.DirectionalLight(0xffd6a8, 2.1);
  sun.position.copy(SUN_DIR).multiplyScalar(100);
  group.add(sun);
  const water = createWater({ deep: 0x0f3f5c, shallow: 0x2f7590 });
  group.add(water.mesh);

  const rand = mulberry32(19420604);
  const batch = new Batcher();
  const shores = [];
  const fires = [];
  const guns = [];
  const cannons = [];
  const ships = [];
  const half = track.halfWidth;

  const fits = (x, z, yaw, L, B) => {
    for (let u = -0.5; u <= 0.5; u += 0.1) {
      const px = x + Math.sin(yaw) * L * u;
      const pz = z + Math.cos(yaw) * L * u;
      if (track.project(px, pz).distance < half + B / 2 + 12) return false;
    }
    return ships.every((s) => Math.hypot(s.x - x, s.z - z) > (s.L + L) / 2 + 10);
  };
  const place = (f, side, gap, L, B, angle, build) => {
    const idx = track.wrap(Math.round(f * track.N));
    const yaw = track.heading(idx) + angle;
    for (let lat = half + B / 2 + gap; lat < half + 400; lat += 6) {
      const p = track.point(idx, side * lat);
      if (!fits(p.x, p.z, yaw, L, B)) continue;
      const local = { local: [] };
      const size = build(p.x, p.z, yaw, local);
      for (const g of local.local) {
        const w = g.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw).add(new THREE.Vector3(p.x, 0, p.z));
        guns.push(w);
      }
      ships.push({ x: p.x, z: p.z, L: size.L });
      shores.push({ x: p.x, z: p.z, rx: size.B / 2 + 0.5, rz: size.L / 2, rot: yaw });
      return { x: p.x, z: p.z, yaw };
    }
    return null;
  };

  const burningCarrier = place(0.62, -1, 30, 150, 30, 0.35, (x, z, yaw, g) => {
    const local = [];
    const size = carrier(batch, x, z, yaw, rand, local, g, true);
    for (const f of local) fires.push(f.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw).add(new THREE.Vector3(x, 0, z)));
    return size;
  });
  place(0.14, 1, 40, 150, 30, -0.25, (x, z, yaw, g) => carrier(batch, x, z, yaw, rand, [], g, false));
  place(0.33, -1, 18, 100, 18, 0.15, (x, z, yaw, g) => battleship(batch, x, z, yaw, g, cannons));
  place(0.86, 1, 22, 100, 18, -0.2, (x, z, yaw, g) => battleship(batch, x, z, yaw, g, cannons));
  for (const [f, side, angle] of [[0.04, -1, 0.5], [0.48, 1, -0.4], [0.74, -1, 0.2], [0.24, 1, 0.9]]) {
    place(f, side, 10, 48, 8, angle, (x, z, yaw, g) => destroyer(batch, x, z, yaw, g, cannons));
  }
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2 + rand();
    const d = 520 + rand() * 180;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d + 100;
    const yaw = rand() * Math.PI;
    const local = { local: [] };
    if (k % 3 === 0) battleship(batch, x, z, yaw, local, cannons);
    else destroyer(batch, x, z, yaw, local, cannons);
    if (k % 2 === 0) fires.push(new THREE.Vector3(x, 8, z));
  }

  for (let k = 0; k < 16; k++) {
    for (let tries = 0; tries < 40; tries++) {
      const x = (rand() - 0.5) * 900;
      const z = (rand() - 0.5) * 800 + 100;
      const clearance = track.project(x, z).distance - half;
      if (clearance < 6 || ships.some((s) => Math.hypot(s.x - x, s.z - z) < s.L / 2 + 15)) continue;
      if (k < 9) oilSlick(batch, x, z, 8 + rand() * 14, rand);
      if (k % 2 === 0) sunkPlane(batch, x + 3, z + 2, rand() * 6, rand, k % 4 === 0 ? 'planeBlue' : 'planeGreen');
      if (k % 3 === 0) fires.push(new THREE.Vector3(x, 0.4, z));
      break;
    }
  }

  group.userData.burningCarrier = burningCarrier;
  const scenery = new THREE.Group();
  const chunks = batch.build(scenery, 0.1, NAVY);
  group.add(scenery);

  const buoys = courseBuoys(track, () => true);
  group.add(buoys);
  group.add(createArch(track, half));

  const clouds = [];
  for (let i = 0; i < 18; i++) {
    const cloud = createCloud(rand, i % 3 ? 0x8d959e : 0x5c636b);
    const a = rand() * Math.PI * 2;
    const d = 100 + rand() * 650;
    cloud.position.set(Math.cos(a) * d, 170 + rand() * 90, Math.sin(a) * d);
    cloud.scale.setScalar(1 + rand() * 0.8);
    cloud.userData.speed = 3 + rand() * 4;
    clouds.push(cloud);
    group.add(cloud);
  }

  const air = new THREE.Group();
  group.add(air);
  const blue = new Squadron(air, planeGeometry('blue'), { geometry: propGeometry(1.5), offsets: [new THREE.Matrix4().makeTranslation(0, 0, 3.75)] }, 14, 0.06);
  const green = new Squadron(air, planeGeometry('green'), { geometry: propGeometry(1.5), offsets: [new THREE.Matrix4().makeTranslation(0, 0, 3.75)] }, 14, 0.06);
  const bombers = new Squadron(air, planeGeometry('bomber'), { geometry: propGeometry(1.9), offsets: [new THREE.Matrix4().makeTranslation(-5, -0.2, 4.3), new THREE.Matrix4().makeTranslation(5, -0.2, 4.3)] }, 6, 0.1);
  const chutes = new Squadron(air, parachuteGeometry(), null, 10, 0.06);
  const tracers = new Tracers(air);
  group.userData.squads = { blue, green, bombers, chutes };

  const planes = [];
  for (let pair = 0; pair < 14; pair++) {
    const near = track.point(Math.floor(rand() * track.N), (rand() - 0.5) * 80);
    const center = pair % 2 ? new THREE.Vector3(near.x, 0, near.z) : new THREE.Vector3((rand() - 0.5) * 700, 0, (rand() - 0.5) * 600 + 100);
    const path = { center, radius: 40 + rand() * 50, height: pair % 2 ? 28 + rand() * 30 : 55 + rand() * 70, speed: (0.35 + rand() * 0.2) * (rand() < 0.5 ? -1 : 1), phase: rand() * Math.PI * 2, wobble: rand() * 6 };
    const blueLeads = pair % 2 === 0;
    planes.push({ squad: blueLeads ? blue : green, index: pair, path, lag: 0, role: 'lead' });
    planes.push({ squad: blueLeads ? green : blue, index: pair, path, lag: 0.32, role: 'chase' });
  }
  for (let k = 0; k < 6; k++) {
    const lane = k < 3 ? 0 : 1;
    planes.push({ squad: bombers, index: k, bomber: { lane, slot: k % 3, offset: lane ? 900 : 0 } });
  }
  const chuteState = Array.from({ length: 10 }, () => null);

  const pos = new THREE.Vector3();
  const ahead = new THREE.Vector3();
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const roll = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const one = new THREE.Vector3(1, 1, 1);
  const zAxis = new THREE.Vector3(0, 0, 1);

  const pathAt = (p, t, out) => {
    if (p.bomber) {
      const dir = p.bomber.lane ? new THREE.Vector3(-0.8, 0, 0.6).normalize() : new THREE.Vector3(1, 0, 0.25).normalize();
      const side = new THREE.Vector3(-dir.z, 0, dir.x);
      const travel = (((t * 38 + p.bomber.offset) % 1800) + 1800) % 1800 - 900;
      const slot = [0, -1, 1][p.bomber.slot];
      return out.copy(dir).multiplyScalar(travel - Math.abs(slot) * 14).addScaledVector(side, slot * 16).add(new THREE.Vector3(0, 150 + p.bomber.lane * 20, 100));
    }
    const a = p.path.phase + p.path.speed * t - p.lag * Math.sign(p.path.speed);
    const r = p.path.radius * (p.role === 'chase' ? 0.94 : 1);
    return out.set(
      p.path.center.x + Math.cos(a) * r,
      p.path.height + Math.sin(a * 2 + p.path.wobble) * 14 + (p.role === 'chase' ? -3 : 0),
      p.path.center.z + Math.sin(a) * r,
    );
  };

  const shootDown = (p, t) => {
    pathAt(p, t, pos);
    pathAt(p, t + 0.05, ahead);
    const vel = ahead.clone().sub(pos).multiplyScalar(20);
    p.fall = { pos: pos.clone(), vel, spin: (Math.random() < 0.5 ? -1 : 1) * (2 + Math.random() * 3), angle: 0, q: new THREE.Quaternion() };
    const free = chuteState.findIndex((c) => !c);
    if (free >= 0 && Math.random() < 0.55 && !p.bomber) chuteState[free] = { pos: pos.clone().add(new THREE.Vector3(0, -2, 0)), drift: new THREE.Vector3((Math.random() - 0.5) * 3, -4, (Math.random() - 0.5) * 3), sway: Math.random() * 6 };
    fx.fireCore.emit(pos.x, pos.y, pos.z, 0, 0, 0, 3, 0.3, 0xfff1b0, 0, 0, 1);
    fx.fire.emit(pos.x, pos.y, pos.z, 0, 0, 0, 5, 0.45, 0xff4a1a, 0, 0, 1);
  };

  let nextKill = 2;
  let flak = 0;
  let aa = 0;

  const update = (t, dt) => {
    nextKill -= dt;
    if (nextKill <= 0) {
      nextKill = 2.5 + Math.random() * 3.5;
      const alive = planes.filter((p) => !p.fall && !p.respawn);
      const victim = alive[Math.floor(Math.random() * alive.length)];
      if (victim) shootDown(victim, t);
    }
    for (const p of planes) {
      if (p.respawn) {
        p.respawn -= dt;
        if (p.respawn <= 0) {
          p.respawn = 0;
          if (p.path && Math.random() < 0.5) {
            const near = track.point(Math.floor(Math.random() * track.N), (Math.random() - 0.5) * 80);
            p.path.center.set(near.x, 0, near.z);
          }
        }
        p.squad.set(p.index, m, false);
        continue;
      }
      if (p.fall) {
        const f = p.fall;
        f.vel.y -= 22 * dt;
        f.vel.multiplyScalar(Math.exp(-0.2 * dt));
        f.pos.addScaledVector(f.vel, dt);
        f.angle += f.spin * dt;
        ahead.copy(f.pos).add(f.vel);
        m.lookAt(ahead, f.pos, up);
        q.setFromRotationMatrix(m).multiply(roll.setFromAxisAngle(zAxis, f.angle));
        p.squad.set(p.index, m.compose(f.pos, q, one));
        if (Math.random() < dt * 30) fx.blackSmoke(f.pos.x, f.pos.y, f.pos.z, new THREE.Vector3());
        if (Math.random() < dt * 40) fx.fire.emit(f.pos.x, f.pos.y, f.pos.z, (Math.random() - 0.5) * 3, 2, (Math.random() - 0.5) * 3, 1.2 + Math.random(), 0.35, 0xff4a1a, -4, 1, 2);
        if (Math.random() < dt * 30) fx.fireCore.emit(f.pos.x, f.pos.y, f.pos.z, 0, 1, 0, 0.7, 0.25, 0xffe680, 0, 1, 2);
        if (f.pos.y <= 0.3) {
          fx.explosion(f.pos.x, 0.5, f.pos.z, p.bomber ? 2.2 : 1.4);
          fx.splash(f.pos.x, 0.3, f.pos.z, p.bomber ? 2.2 : 1.6);
          p.fall = null;
          p.respawn = 4 + Math.random() * 5;
          p.squad.set(p.index, m, false);
        }
        continue;
      }
      pathAt(p, t, pos);
      pathAt(p, t + 0.05, ahead);
      m.lookAt(ahead, pos, up);
      const bank = p.bomber ? 0 : -0.42 * Math.sign(p.path.speed);
      q.setFromRotationMatrix(m).multiply(roll.setFromAxisAngle(zAxis, bank));
      p.squad.set(p.index, m.compose(pos, q, one));
      p.now = (p.now ?? new THREE.Vector3()).copy(pos);
      if (p.role === 'chase') {
        p.burst = (p.burst ?? Math.random() * 2) - dt;
        if (p.burst < 0.4 && Math.random() < dt * 14) {
          const lead = planes.find((o) => o.path === p.path && o.role === 'lead');
          if (lead && !lead.fall && !lead.respawn && lead.now) {
            const nose = new THREE.Vector3(0, 0, 4).applyQuaternion(q).add(pos);
            tracers.fire(nose, lead.now, 200, 0.05);
          }
        }
        if (p.burst <= 0) p.burst = 1.2 + Math.random() * 2;
      }
    }
    for (const s of [blue, green, bombers]) s.flush();
    chuteState.forEach((c, i) => {
      if (!c) {
        chutes.set(i, m, false);
        return;
      }
      c.sway += dt;
      c.pos.addScaledVector(c.drift, dt);
      if (c.pos.y < 0.5) {
        fx.splash(c.pos.x, 0.3, c.pos.z, 0.4);
        chuteState[i] = null;
        chutes.set(i, m, false);
        return;
      }
      q.setFromAxisAngle(zAxis, Math.sin(c.sway * 1.6) * 0.2);
      chutes.set(i, m.compose(c.pos, q, one));
    });
    chutes.flush();

    aa -= dt;
    if (aa <= 0 && guns.length) {
      aa = 0.03;
      const gun = guns[Math.floor(Math.random() * guns.length)];
      const targets = planes.filter((p) => p.now && !p.fall && !p.respawn);
      const target = targets[Math.floor(Math.random() * targets.length)];
      if (target) {
        const aim = target.now.clone().add(new THREE.Vector3((Math.random() - 0.5) * 30, (Math.random() - 0.3) * 20, (Math.random() - 0.5) * 30));
        for (let k = 0; k < 3; k++) tracers.fire(gun, aim, 170, 0.04);
      }
    }
    flak -= dt;
    if (flak <= 0) {
      flak = 0.12 + Math.random() * 0.2;
      const targets = planes.filter((p) => p.now && !p.fall && !p.respawn);
      const target = targets[Math.floor(Math.random() * targets.length)];
      if (target) {
        const b = target.now.clone().add(new THREE.Vector3((Math.random() - 0.5) * 50, (Math.random() - 0.4) * 30, (Math.random() - 0.5) * 50));
        fx.fireCore.emit(b.x, b.y, b.z, 0, 0, 0, 2.2, 0.15, 0xfff1b0, 0, 0, 1);
        fx.fire.emit(b.x, b.y, b.z, 0, 0, 0, 3, 0.25, 0xff7a2a, 0, 0, 1);
        for (let k = 0; k < 4; k++) fx.soot.emit(b.x + (Math.random() - 0.5) * 3, b.y + (Math.random() - 0.5) * 3, b.z + (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, 2.6 + Math.random() * 1.8, 3 + Math.random() * 1.5, k % 2 ? 0x1f2024 : 0x3a3c41, 0, 0.6, 0);
      }
    }
    for (const c of cannons) {
      c.timer -= dt;
      if (c.timer > 0) continue;
      c.timer = 3 + Math.random() * 5;
      const dir = new THREE.Vector3(Math.sin(c.yaw), 0.6, Math.cos(c.yaw)).normalize();
      const at = c.at.clone().setY(c.y);
      for (let k = 0; k < 10; k++) fx.fire.emit(at.x, at.y, at.z, dir.x * (10 + k * 3), dir.y * (10 + k * 3), dir.z * (10 + k * 3), 2 + Math.random(), 0.22, 0xff6a1a, 0, 3, 2);
      fx.fireCore.emit(at.x, at.y, at.z, dir.x * 12, dir.y * 12, dir.z * 12, 2.4, 0.15, 0xfff1b0, 0, 3, 2);
      for (let k = 0; k < 8; k++) fx.puffs.emit(at.x + dir.x * 6, at.y + dir.y * 6, at.z + dir.z * 6, dir.x * 8 + (Math.random() - 0.5) * 4, dir.y * 8 + Math.random() * 2, dir.z * 8 + (Math.random() - 0.5) * 4, 2 + Math.random() * 1.5, 1.8, 0xb9bec4, -1, 1, 0);
    }
    for (const f of fires) {
      if (Math.random() < dt * 7) fx.column(f.x, f.y + 2, f.z, wind, f.y > 5 ? 1.4 : 0.8);
      if (Math.random() < dt * 22) fx.fire.emit(f.x + (Math.random() - 0.5) * 5, f.y + 0.5, f.z + (Math.random() - 0.5) * 5, (Math.random() - 0.5), 3 + Math.random() * 3, (Math.random() - 0.5), 1.4 + Math.random() * 1.2, 0.5, 0xff4a1a, -3, 1, 2);
      if (Math.random() < dt * 14) fx.fireMid.emit(f.x + (Math.random() - 0.5) * 3, f.y + 0.6, f.z + (Math.random() - 0.5) * 3, 0, 3 + Math.random() * 2, 0, 0.9 + Math.random() * 0.6, 0.4, 0xff9a2a, -3, 1, 2);
    }
    tracers.update(dt);
  };

  return {
    fog,
    water,
    sun,
    shores,
    solid(p) {
      return ellipseHit(shores, p, 30);
    },
    update(t, dt, camera) {
      water.update(t);
      cullChunks(chunks, camera, fog.far);
      sky.position.copy(camera.position);
      buoys.userData.update(t);
      for (const cloud of clouds) {
        cloud.position.x += cloud.userData.speed * dt;
        if (cloud.position.x > 800) cloud.position.x = -800;
      }
      update(t, dt);
    },
  };
}
