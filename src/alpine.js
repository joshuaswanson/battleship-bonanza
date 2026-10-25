import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
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
const SPRUCE = tones('spruce', 0x163f2b, 0x3a8650, 9);
const BARK = tones('bark', 0x4e3220, 0x7d5636, 4);
const ROCKS = tones('boulder', 0x8a857e, 0xb1aca3, 4);
Object.assign(FLORA_COLORS, {
  moss: 0x6aa84f,
  cowWhite: 0xf8f5ee,
  bell: 0xffd23f,
  strap: 0xc0392b,
  strapLeather: 0x6e4224,
});

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
  const spokes = 14;
  const g = mergeVertices(new THREE.ConeGeometry(1, 1, spokes, 3).deleteAttribute('normal').deleteAttribute('uv'));
  const pos = g.attributes.position;
  const droop = 0.1 + rand() * 0.25;
  const curl = rand() * 0.3;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    if (y > 0.45) continue;
    const a = Math.atan2(z, x);
    const spoke = Math.round(((a + Math.PI) / (Math.PI * 2)) * spokes);
    const tip = spoke % 2 === 0;
    let r = 1;
    if (y < -0.45) r = tip ? 1.05 + rand() * 0.2 : 0.62 + rand() * 0.12;
    else if (y < -0.1) r = 0.9 + rand() * 0.15;
    else r = 0.95 + rand() * 0.1;
    pos.setX(i, x * r);
    pos.setZ(i, z * r);
    if (y < -0.45) pos.setY(i, y - (tip ? droop + rand() * 0.12 : -curl * 0.3));
  }
  g.computeVertexNormals();
  return g;
}

const TIERS = Array.from({ length: 5 }, (_, s) => droopyTier(s * 101 + 7));
export const BLOBS = [1, 2, 3, 4, 5].map((s) => lumpy(new THREE.IcosahedronGeometry(1, 1), s * 37, 0.28));
export const STONES = [1, 2, 3, 4].map((s) => lumpy(new THREE.DodecahedronGeometry(1, 0), s * 53, 0.35));
const TRUNK = new THREE.CylinderGeometry(0.7, 1, 1, 9).translate(0, 0.5, 0);
const SPIKE = new THREE.ConeGeometry(1, 1, 10);
const BALL = new THREE.SphereGeometry(1, 12, 9);
const BOX = new THREE.BoxGeometry(1, 1, 1);

export const pick = (list, rand) => list[Math.floor(rand() * list.length)];

export function frame(batch, x, y, z, yaw, tiltX, tiltZ, scale) {
  const base = new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(tiltX, yaw, tiltZ, 'YXZ')),
    new THREE.Vector3(scale, scale, scale),
  );
  return (key, geometry, lx, ly, lz, sx, sy, sz, rx = 0, ry = 0, rz = 0) => batch.add(key, geometry, base.clone().multiply(mat(lx, ly, lz, sx, sy, sz, rx, ry, rz)));
}

export function tree(batch, x, y, z, rand, scale = 1) {
  const height = (6 + rand() * 14) * scale;
  const slender = 0.17 + rand() * 0.13;
  const girth = height * slender * (0.9 + rand() * 0.2);
  const lean = rand() < 0.2 ? 0.06 + rand() * 0.06 : rand() * 0.04;
  const leanDir = rand() * Math.PI * 2;
  const put = frame(batch, x, y - 0.3, z, rand() * Math.PI * 2, Math.cos(leanDir) * lean, Math.sin(leanDir) * lean, 1);
  const tiers = Math.max(4, Math.min(11, Math.round(height / (2 + rand() * 1.2))));
  const bare = 0.06 + rand() * (height > 14 ? 0.24 : 0.1);
  const shade = Math.floor(rand() * (SPRUCE.length - 3));
  const sweep = rand() < 0.25 ? 0.15 + rand() * 0.25 : 0;
  const sweepDir = rand() * Math.PI * 2;
  const gap = rand() < 0.12 ? 1 + Math.floor(rand() * (tiers - 2)) : -1;
  put(pick(BARK, rand), TRUNK, 0, 0, 0, girth * 0.07, height * (bare + 0.3), girth * 0.07);
  for (let k = 0; k < tiers; k++) {
    if (k === gap) continue;
    const t = k / (tiers - 1);
    const r = girth * (1 - t * 0.82) * (0.85 + rand() * 0.3);
    const h = (height * (1 - bare) / tiers) * (1.7 + rand() * 0.5);
    const ly = height * bare + t * height * (0.86 - bare) + h * 0.35;
    const off = sweep * r * t;
    const key = SPRUCE[Math.min(SPRUCE.length - 1, shade + Math.round(t * 2) + (rand() < 0.25 ? 1 : 0))];
    put(key, pick(TIERS, rand), Math.cos(sweepDir) * off + (rand() - 0.5) * 0.12 * r, ly, Math.sin(sweepDir) * off + (rand() - 0.5) * 0.12 * r, r, h, r * (0.9 + rand() * 0.2), 0, rand() * 6, 0);
  }
  const topKey = SPRUCE[Math.min(SPRUCE.length - 1, shade + 2)];
  const bend = rand() < 0.15 ? (rand() - 0.5) * 0.6 : (rand() - 0.5) * 0.1;
  put(topKey, SPIKE, Math.cos(sweepDir) * sweep * girth * 0.15, height * 0.97, Math.sin(sweepDir) * sweep * girth * 0.15, girth * 0.11, height * (0.1 + rand() * 0.08), girth * 0.11, bend, 0, bend * 0.5);
  if (rand() < 0.06) put(topKey, SPIKE, girth * 0.08, height * 0.9, 0, girth * 0.07, height * 0.08, girth * 0.07, 0, 0, 0.5);
  return { height, girth };
}

export function sapling(batch, x, y, z, rand) {
  return tree(batch, x, y, z, rand, 0.2 + rand() * 0.15);
}

export function boulder(batch, x, y, z, rand, size) {
  const put = frame(batch, x, y, z, rand() * 6, 0, 0, size);
  put(pick(ROCKS, rand), pick(STONES, rand), 0, 0.2, 0, 1, 0.65 + rand() * 0.3, 1.1, rand() * 0.4, rand() * 6, rand() * 0.4);
  if (rand() < 0.5) put('moss', pick(BLOBS, rand), 0, 0.68, 0, 0.7, 0.18, 0.75, 0, rand() * 6, 0);
  if (rand() < 0.5) put(pick(ROCKS, rand), pick(STONES, rand), 1.1, 0, 0.3, 0.45, 0.35, 0.5, rand(), rand() * 6, rand());
}

const POSES = [
  ['Eating', 0.15],
  ['Eating', 0.45],
  ['Eating', 0.75],
  ['Idle', 0.3],
  ['Idle_2', 0.55],
  ['Idle_Headlow', 0.5],
  ['Idle_Headlow', 0.85],
];
const SHADES = [0.84, 0.95, 1.06];
const COW_LENGTH = 0.52;

function bake(mesh, scale) {
  const source = mesh.geometry;
  const count = source.attributes.position.count;
  const position = new Float32Array(count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    v.fromBufferAttribute(source.attributes.position, i);
    mesh.applyBoneTransform(i, v);
    v.applyMatrix4(mesh.matrixWorld).multiplyScalar(scale);
    position.set([v.x, v.y, v.z], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(position, 3));
  if (source.index) g.setIndex(source.index.clone());
  const welded = mergeVertices(g);
  const color = mesh.material.color;
  const rgb = new Float32Array(welded.attributes.position.count * 3);
  for (let i = 0; i < rgb.length; i += 3) rgb.set([color.r, color.g, color.b], i);
  welded.setAttribute('color', new THREE.BufferAttribute(rgb, 3));
  welded.computeVertexNormals();
  return welded;
}

function shaded(geometry, k) {
  const g = geometry.clone();
  const c = g.attributes.color.array;
  for (let i = 0; i < c.length; i++) c[i] = Math.min(1, c[i] * k);
  return g;
}

export async function loadCowKit(url) {
  const gltf = await new GLTFLoader().loadAsync(url);
  const root = gltf.scene;
  const mixer = new THREE.AnimationMixer(root);
  const clip = (name) => gltf.animations.find((a) => a.name === name) ?? gltf.animations.find((a) => a.name.endsWith(name));
  const kit = [];
  let floor = 0;
  for (const [name, at] of POSES) {
    mixer.stopAllAction();
    const c = clip(name);
    mixer.clipAction(c).reset().play();
    mixer.setTime(at * c.duration);
    root.updateMatrixWorld(true);
    const adult = [];
    const calf = [];
    root.traverse((o) => {
      if (!o.isSkinnedMesh) return;
      const g = bake(o, COW_LENGTH);
      adult.push(g);
      if (o.material.name !== 'Horns') calf.push(g);
    });
    const body = mergeGeometries(adult);
    body.computeBoundingBox();
    floor = Math.min(floor, body.boundingBox.min.y);
    const neck = root.getObjectByName('Neck2').getWorldPosition(new THREE.Vector3()).multiplyScalar(COW_LENGTH);
    const head = root.getObjectByName('Head').getWorldPosition(new THREE.Vector3()).multiplyScalar(COW_LENGTH);
    kit.push({ adult: SHADES.map((k) => shaded(body, k)), calf: SHADES.map((k) => shaded(mergeGeometries(calf), k)), neck, head });
  }
  for (const pose of kit) {
    for (const g of [...pose.adult, ...pose.calf]) g.translate(0, -floor, 0);
    pose.neck.y -= floor;
    pose.head.y -= floor;
  }
  return kit;
}

const STRAP = new THREE.TorusGeometry(1, 0.16, 6, 18);
const BELL = new THREE.CylinderGeometry(0.55, 1, 1.3, 12);

export function cow(batch, x, y, z, yaw, rand, kit, { calf = false } = {}) {
  const pose = kit[Math.floor(rand() * kit.length)];
  const shade = Math.floor(rand() * SHADES.length);
  const size = calf ? 0.5 + rand() * 0.12 : 0.88 + rand() * 0.24;
  const turn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  const place = new THREE.Matrix4().compose(new THREE.Vector3(x, y - 0.1, z), turn, new THREE.Vector3(size, size * (0.95 + rand() * 0.1), size * (0.95 + rand() * 0.1)));
  batch.add('cowWhite', calf ? pose.calf[shade] : pose.adult[shade], place);
  if (calf || rand() < 0.2) return;
  const collar = pose.neck.clone().lerp(pose.head, 0.15);
  const dir = pose.head.clone().sub(pose.neck).normalize();
  const ring = new THREE.Matrix4().compose(collar, new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir), new THREE.Vector3(0.5, 0.5, 0.5));
  batch.add(rand() < 0.5 ? 'strap' : 'strapLeather', STRAP, place.clone().multiply(ring));
  const bellAt = collar.clone().add(new THREE.Vector3(0, -0.7, 0));
  batch.add('bell', BELL, place.clone().multiply(new THREE.Matrix4().compose(bellAt, new THREE.Quaternion(), new THREE.Vector3(0.22, 0.26, 0.22))));
}
