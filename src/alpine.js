import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry32 } from './toon.js';
import { mat } from './world.js';

export const FLORA_COLORS = {};
function tones(prefix, from, to, n) {
  const a = new THREE.Color(from);
  const b = new THREE.Color(to);
  const keys = [];
  for (let i = 0; i < n; i++) {
    const key = `${prefix}${i}`;
    FLORA_COLORS[key] = a.clone().lerp(b, n > 1 ? i / (n - 1) : 0).getHex();
    keys.push(key);
  }
  return keys;
}
const SPRUCE = tones('spruce', 0x1b5236, 0x2f7a47, 6);
const FIR = tones('fir', 0x2a6b3c, 0x3f8f4f, 4);
const LARCH = tones('larch', 0x6d9e43, 0xa7c25a, 4);
const STONE = tones('stonePine', 0x1f5a3a, 0x356f45, 3);
const LEAF = tones('leaf', 0x3f9a45, 0x8bcf52, 7);
const BIRCH = tones('birchLeaf', 0x86c95a, 0xb2dc6a, 3);
const AUTUMN = tones('autumn', 0xd9a53a, 0xe0703a, 3);
const BARK = tones('bark', 0x5a3a22, 0x83593a, 3);
const ROCKS = tones('boulder', 0x8a857e, 0xb1aca3, 4);
Object.assign(FLORA_COLORS, {
  birchBark: 0xf2efe6,
  birchMark: 0x2b2b2b,
  snag: 0x9a8f84,
  moss: 0x6aa84f,
  flowerWhite: 0xffffff,
  flowerYellow: 0xffd84a,
  flowerPurple: 0xb07ad9,
  flowerBlue: 0x6a8fe8,
  flowerPink: 0xff8fb8,
  cowWhite: 0xf8f5ee,
  cowBlack: 0x2a2a2a,
  cowBrown: 0x8a5a3c,
  cowDark: 0x4a3226,
  cowRed: 0xa8552f,
  cowCream: 0xe9d9bb,
  cowNose: 0xf2a7a0,
  udder: 0xf4b6ae,
  horn: 0xf3e6c4,
  hoof: 0x3a2e28,
  eye: 0x161616,
  bell: 0xffd23f,
  strap: 0xc0392b,
  strapLeather: 0x6e4224,
});
const FLOWERS = ['flowerWhite', 'flowerYellow', 'flowerPurple', 'flowerBlue', 'flowerPink'];

function lumpy(base, seed, amount, keep = () => true) {
  const rand = mulberry32(seed);
  const g = mergeVertices(base.clone().deleteAttribute('normal').deleteAttribute('uv'));
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    if (!keep(v)) continue;
    const k = 1 + (rand() - 0.5) * 2 * amount;
    pos.setXYZ(i, v.x * k, v.y + (rand() - 0.5) * amount * 0.6, v.z * k);
  }
  g.computeVertexNormals();
  return g;
}

function droopyTier(seed) {
  const rand = mulberry32(seed);
  const g = mergeVertices(new THREE.ConeGeometry(1, 1, 9, 2).deleteAttribute('normal').deleteAttribute('uv'));
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y > 0.45) continue;
    const r = y < -0.45 ? 0.8 + rand() * 0.4 : 0.92 + rand() * 0.16;
    pos.setX(i, pos.getX(i) * r);
    pos.setZ(i, pos.getZ(i) * r);
    if (y < -0.45) pos.setY(i, y - rand() * 0.22);
  }
  g.computeVertexNormals();
  return g;
}

const TIERS = [1, 2, 3, 4, 5].map((s) => droopyTier(s * 101));
const BLOBS = [1, 2, 3, 4, 5].map((s) => lumpy(new THREE.IcosahedronGeometry(1, 1), s * 37, 0.28));
const STONES = [1, 2, 3, 4].map((s) => lumpy(new THREE.DodecahedronGeometry(1, 0), s * 53, 0.35));
const TRUNK = new THREE.CylinderGeometry(0.7, 1, 1, 6).translate(0, 0.5, 0);
const BRANCH = new THREE.CylinderGeometry(0.6, 1, 1, 5).translate(0, 0.5, 0);
const SPIKE = new THREE.ConeGeometry(1, 1, 6);
const PETAL = new THREE.IcosahedronGeometry(1, 0);
const STEM = new THREE.CylinderGeometry(0.3, 0.3, 1, 4).translate(0, 0.5, 0);
const BALL = new THREE.SphereGeometry(1, 12, 9);
const BODY = new THREE.CapsuleGeometry(1, 1.4, 4, 12).rotateX(Math.PI / 2);
const LEG = new THREE.CylinderGeometry(0.85, 1, 1, 7).translate(0, -0.5, 0);
const HORN = new THREE.ConeGeometry(1, 1, 6).translate(0, 0.5, 0);
const EAR = new THREE.SphereGeometry(1, 8, 6);
const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYLINDER = new THREE.CylinderGeometry(1, 1, 1, 8);

const pick = (list, rand) => list[Math.floor(rand() * list.length)];

function frame(batch, x, y, z, yaw, tiltX, tiltZ, scale) {
  const base = new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(tiltX, yaw, tiltZ, 'YXZ')),
    new THREE.Vector3(scale, scale, scale),
  );
  return (key, geometry, lx, ly, lz, sx, sy, sz, rx = 0, ry = 0, rz = 0) => batch.add(key, geometry, base.clone().multiply(mat(lx, ly, lz, sx, sy, sz, rx, ry, rz)));
}

function conifer(put, rand, { tiers, palette, girth, height, top = true, sparse = 0 }) {
  const tone = Math.floor(rand() * palette.length);
  put(pick(BARK, rand), TRUNK, 0, -0.3, 0, 0.09 * girth, height * 0.35, 0.09 * girth);
  for (let k = 0; k < tiers; k++) {
    const t = k / (tiers - 1);
    if (sparse && k > 0 && rand() < sparse) continue;
    const r = girth * (0.95 - t * 0.78) * (0.9 + rand() * 0.2);
    const h = height * (0.3 - t * 0.1);
    const key = palette[Math.min(palette.length - 1, Math.max(0, tone + (k % 2 ? 1 : 0) - (rand() < 0.3 ? 1 : 0)))];
    put(key, pick(TIERS, rand), (rand() - 0.5) * 0.25 * r, height * (0.22 + t * 0.66), (rand() - 0.5) * 0.25 * r, r, h, r, 0, rand() * 6, 0);
  }
  if (top) put(palette[tone], SPIKE, 0, height * 1.0, 0, girth * 0.12, height * 0.16, girth * 0.12);
}

function broadleaf(put, rand, height, palette, birch) {
  const lean = (rand() - 0.5) * 0.2;
  if (birch) {
    put('birchBark', TRUNK, 0, 0, 0, 0.16, height * 0.75, 0.16, 0, 0, lean);
    for (let k = 0; k < 3; k++) put('birchMark', BOX, 0, height * (0.15 + k * 0.18), 0, 0.33, 0.12, 0.33, 0, rand() * 3, lean);
  } else {
    put(pick(BARK, rand), TRUNK, 0, 0, 0, 0.32, height * 0.55, 0.32, 0, 0, lean);
    for (let k = 0; k < 2; k++) {
      const a = rand() * Math.PI * 2;
      put(pick(BARK, rand), BRANCH, 0, height * 0.4, 0, 0.14, height * 0.28, 0.14, Math.cos(a) * 0.7, 0, Math.sin(a) * 0.7);
    }
  }
  const blobs = birch ? 3 + Math.floor(rand() * 2) : 4 + Math.floor(rand() * 4);
  const crown = height * (birch ? 0.2 : 0.3);
  const base = Math.floor(rand() * palette.length);
  for (let k = 0; k < blobs; k++) {
    const a = (k / blobs) * Math.PI * 2 + rand();
    const d = k === 0 ? 0 : crown * (0.45 + rand() * 0.35);
    const r = crown * (k === 0 ? 0.95 : 0.6 + rand() * 0.3);
    const key = palette[Math.min(palette.length - 1, Math.max(0, base + Math.floor(rand() * 3) - 1))];
    put(key, pick(BLOBS, rand), Math.cos(a) * d + lean * height * 0.5, height * (birch ? 0.72 : 0.68) + (rand() - 0.3) * crown * 0.6, Math.sin(a) * d, r, r * (birch ? 1.3 : 0.85), r, rand(), rand() * 6, rand());
  }
}

function stonePine(put, rand, height) {
  const bend = (rand() - 0.5) * 0.5;
  put(pick(BARK, rand), TRUNK, 0, 0, 0, 0.35, height * 0.45, 0.35, 0, 0, bend * 0.4);
  put(pick(BARK, rand), TRUNK, bend * height * 0.18, height * 0.42, 0, 0.26, height * 0.4, 0.26, 0, 0, -bend * 0.6);
  const blobs = 3 + Math.floor(rand() * 3);
  for (let k = 0; k < blobs; k++) {
    const y = height * (0.45 + (k / blobs) * 0.5);
    const r = height * (0.24 - (k / blobs) * 0.1) * (0.8 + rand() * 0.4);
    put(pick(STONE, rand), pick(BLOBS, rand), (rand() - 0.5) * height * 0.25, y, (rand() - 0.5) * height * 0.25, r, r * 0.7, r * 1.1, rand(), rand() * 6, rand());
  }
}

function snag(put, rand, height) {
  put('snag', TRUNK, 0, 0, 0, 0.25, height, 0.25, 0, 0, (rand() - 0.5) * 0.15);
  for (let k = 0; k < 3; k++) {
    const a = rand() * Math.PI * 2;
    put('snag', BRANCH, 0, height * (0.4 + k * 0.18), 0, 0.08, height * 0.18, 0.08, Math.cos(a) * 1.1, 0, Math.sin(a) * 1.1);
  }
}

export function tree(batch, x, y, z, altitude, rand, scale = 1) {
  const roll = rand();
  let kind;
  if (altitude < 12) kind = roll < 0.45 ? 'leaf' : roll < 0.62 ? 'birch' : roll < 0.9 ? 'spruce' : 'fir';
  else if (altitude < 40) kind = roll < 0.5 ? 'spruce' : roll < 0.72 ? 'fir' : roll < 0.86 ? 'leaf' : roll < 0.95 ? 'larch' : 'snag';
  else if (altitude < 80) kind = roll < 0.45 ? 'spruce' : roll < 0.7 ? 'larch' : roll < 0.95 ? 'stone' : 'snag';
  else kind = roll < 0.55 ? 'stone' : roll < 0.92 ? 'larch' : 'snag';
  const tilt = 0.07;
  const put = frame(batch, x, y - 0.3, z, rand() * Math.PI * 2, (rand() - 0.5) * tilt, (rand() - 0.5) * tilt, scale);
  const vigor = 0.75 + rand() * 0.5;
  if (kind === 'spruce') conifer(put, rand, { tiers: 5 + Math.floor(rand() * 3), palette: SPRUCE, girth: 3.2 * vigor, height: 15 * vigor });
  else if (kind === 'fir') conifer(put, rand, { tiers: 4 + Math.floor(rand() * 2), palette: FIR, girth: 4 * vigor, height: 12 * vigor });
  else if (kind === 'larch') conifer(put, rand, { tiers: 5, palette: rand() < 0.15 ? AUTUMN : LARCH, girth: 2.8 * vigor, height: 13 * vigor, sparse: 0.25 });
  else if (kind === 'stone') stonePine(put, rand, 9 * vigor);
  else if (kind === 'leaf') broadleaf(put, rand, 10 * vigor, rand() < 0.08 ? AUTUMN : LEAF, false);
  else if (kind === 'birch') broadleaf(put, rand, 10 * vigor, BIRCH, true);
  else snag(put, rand, 8 * vigor);
}

export function shrub(batch, x, y, z, rand) {
  const put = frame(batch, x, y, z, rand() * 6, 0, 0, 0.8 + rand() * 0.9);
  const n = 2 + Math.floor(rand() * 3);
  const base = Math.floor(rand() * LEAF.length);
  for (let k = 0; k < n; k++) {
    const a = rand() * Math.PI * 2;
    put(LEAF[Math.min(LEAF.length - 1, base + (k % 2))], pick(BLOBS, rand), Math.cos(a) * 0.9, 0.5, Math.sin(a) * 0.9, 1.1 + rand() * 0.5, 0.8 + rand() * 0.4, 1.1 + rand() * 0.5, rand(), rand() * 6, 0);
  }
}

export function boulder(batch, x, y, z, rand, size) {
  const put = frame(batch, x, y, z, rand() * 6, 0, 0, size);
  put(pick(ROCKS, rand), pick(STONES, rand), 0, 0.2, 0, 1, 0.65 + rand() * 0.3, 1.1, rand() * 0.4, rand() * 6, rand() * 0.4);
  if (rand() < 0.5) put('moss', pick(BLOBS, rand), 0, 0.68, 0, 0.7, 0.18, 0.75, 0, rand() * 6, 0);
  if (rand() < 0.5) put(pick(ROCKS, rand), pick(STONES, rand), 1.1, 0, 0.3, 0.45, 0.35, 0.5, rand(), rand() * 6, rand());
}

export function flowers(batch, x, y, z, rand, at) {
  const main = pick(FLOWERS, rand);
  const count = 10 + Math.floor(rand() * 18);
  for (let k = 0; k < count; k++) {
    const a = rand() * Math.PI * 2;
    const d = Math.sqrt(rand()) * 5;
    const fx = x + Math.cos(a) * d;
    const fz = z + Math.sin(a) * d;
    const fy = at(fx, fz);
    batch.add(rand() < 0.75 ? main : pick(FLOWERS, rand), PETAL, mat(fx, fy + 0.4, fz, 0.18, 0.12, 0.18, 0, rand() * 3, 0));
  }
}

const BREEDS = [
  { weight: 0.35, body: 'cowBrown', spots: null, head: 'cowBrown', muzzle: 'cowCream', legs: 'cowDark', horns: true },
  { weight: 0.25, body: 'cowWhite', spots: 'cowRed', head: 'cowWhite', muzzle: 'cowNose', legs: 'cowWhite', horns: true },
  { weight: 0.25, body: 'cowWhite', spots: 'cowBlack', head: 'cowBlack', muzzle: 'cowNose', legs: 'cowWhite', horns: false },
  { weight: 0.15, body: 'cowDark', spots: null, head: 'cowDark', muzzle: 'cowBrown', legs: 'cowDark', horns: true },
];

export function cow(batch, x, y, z, yaw, rand, { calf = false, breed = null } = {}) {
  let roll = rand();
  const kind = breed ?? BREEDS.find((b) => (roll -= b.weight) < 0) ?? BREEDS[0];
  const scale = calf ? 0.55 + rand() * 0.1 : 0.85 + rand() * 0.3;
  const pose = calf ? (rand() < 0.7 ? 'stand' : 'lie') : rand() < 0.42 ? 'stand' : rand() < 0.7 ? 'graze' : 'lie';
  const put = frame(batch, x, y, z, yaw, 0, 0, scale);
  const lying = pose === 'lie';
  const bodyY = lying ? 0.95 : 1.95;
  put(kind.body, BODY, 0, bodyY, 0, 0.95, 0.85, 1);
  if (kind.spots) {
    const spots = 3 + Math.floor(rand() * 5);
    for (let k = 0; k < spots; k++) {
      const theta = -Math.PI * 0.75 + rand() * Math.PI * 1.5;
      const along = (rand() - 0.5) * 2.4;
      const r = Math.abs(along) < 0.7 ? 1 : Math.sqrt(Math.max(0, 1 - (Math.abs(along) - 0.7) ** 2));
      const s = (0.45 + rand() * 0.45) * r;
      put(kind.spots, BALL, Math.sin(theta) * 0.95 * r, bodyY + Math.cos(theta) * 0.85 * r, along, s, 0.16, s * (1 + rand() * 0.6), 0, 0, -theta);
    }
  }
  if (lying) {
    for (const side of [-1, 1]) put(kind.legs, BOX, side * 0.75, 0.3, 1.1, 0.4, 0.35, 0.9);
  } else {
    const spread = 0.05;
    for (const [lx, lz] of [[0.55, 1.05], [-0.55, 1.05], [0.55, -1.05], [-0.55, -1.05]]) {
      put(kind.legs, LEG, lx, 1.35, lz, 0.22, 1.25, 0.22, (rand() - 0.5) * spread, 0, (rand() - 0.5) * spread);
      put('hoof', CYLINDER, lx, 0.08, lz, 0.24, 0.16, 0.24);
    }
    if (!calf) put('udder', BALL, 0, 1.05, -0.8, 0.38, 0.3, 0.42);
  }
  const graze = pose === 'graze';
  const turn = (rand() - 0.5) * 0.9;
  const neckY = bodyY + (graze ? -0.6 : 0.5);
  const headZ = 2.1 + (graze ? 0.25 : 0);
  const headY = graze ? 0.75 + (lying ? 0.3 : 0) : bodyY + 0.75;
  const pitch = graze ? 0.9 : -0.15;
  put(kind.body, BALL, 0, (bodyY + headY) / 2 + 0.1, 1.65, 0.6, 0.7, 0.75, graze ? 0.6 : -0.3, turn * 0.5, 0);
  const hx = Math.sin(turn) * 0.5;
  put(kind.head, BALL, hx, headY, headZ, 0.55, 0.6, 0.8, pitch, turn, 0);
  const fwd = new THREE.Vector3(0, -Math.sin(pitch) * 0.7, Math.cos(pitch) * 0.7).applyAxisAngle(new THREE.Vector3(0, 1, 0), turn);
  put(kind.muzzle, BALL, hx + fwd.x, headY + fwd.y - 0.1, headZ + fwd.z, 0.45, 0.38, 0.32, pitch, turn, 0);
  for (const side of [-1, 1]) {
    const sx = hx + Math.cos(turn) * side * 0.62;
    const sz = headZ - Math.sin(turn) * side * 0.62;
    put(kind.head, EAR, sx, headY + 0.15, sz - 0.1, 0.32, 0.14, 0.2, 0, turn, side * 0.5);
    put('eye', BALL, hx + Math.cos(turn) * side * 0.45 + fwd.x * 0.42, headY + 0.3 + fwd.y * 0.42, headZ - Math.sin(turn) * side * 0.45 + fwd.z * 0.42, 0.1, 0.1, 0.1);
    if (kind.horns && !calf) put('horn', HORN, hx + Math.cos(turn) * side * 0.38, headY + 0.45, headZ - Math.sin(turn) * side * 0.38 - 0.1, 0.11, 0.45, 0.11, -0.3, turn, -side * 0.7);
  }
  if (!calf && rand() < 0.75) {
    put(rand() < 0.5 ? 'strap' : 'strapLeather', BOX, 0, (bodyY + headY) / 2 - 0.25, 1.75, 0.95, 0.16, 0.5, 0.4, turn * 0.5, 0);
    put('bell', BALL, 0, (bodyY + headY) / 2 - 0.6, 1.95, 0.24, 0.3, 0.24);
  }
  const swing = (rand() - 0.5) * 0.6;
  if (lying) {
    put(kind.body, BRANCH, 0, 0.35, -1.7, 0.07, 1.3, 0.07, -Math.PI / 2 + 0.08, swing, 0);
    put(kind.spots ?? kind.legs, BALL, Math.sin(swing) * -1.3, 0.3, -1.7 - Math.cos(swing) * 1.3, 0.14, 0.14, 0.24);
  } else {
    put(kind.body, BRANCH, 0, bodyY + 0.4, -1.85, 0.07, 1.3, 0.07, Math.PI - 0.15, 0, swing);
    put(kind.spots ?? kind.legs, BALL, Math.sin(swing) * 1.25, bodyY + 0.4 - Math.cos(swing) * 1.25, -1.95, 0.14, 0.24, 0.14);
  }
}

