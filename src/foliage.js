import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const OUTLINE_POINTS = [[0, 0, 0], [0.42, 0.08, 0.55], [0.36, 0.07, 1.25], [0, 0.02, 2], [-0.36, 0.07, 1.25], [-0.42, 0.08, 0.55]];
const MID = [0, 0.11, 0.9];

function leafGeometry(underside = true) {
  const positions = [];
  const face = (a, b, c, dy, flip) => {
    const pts = [a, b, c].map(([x, y, z]) => [x, y + dy, z]);
    if (flip) pts.reverse();
    positions.push(...pts.flat());
  };
  for (let k = 0; k < OUTLINE_POINTS.length; k++) {
    const a = OUTLINE_POINTS[k];
    const b = OUTLINE_POINTS[(k + 1) % OUTLINE_POINTS.length];
    face(MID, b, a, 0, false);
    if (underside) face(MID, b, a, -0.07, true);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.computeVertexNormals();
  return g;
}

export const LEAF = leafGeometry();
const LEAF_TOP = leafGeometry(false);

const TONES = [
  ['jungle', 'jungleLight', 'moss'],
  ['mossDark', 'jungle', 'vineLeafDark'],
  ['vineLeaf', 'jungleLight', 'moss'],
  ['moss', 'vineLeafDark', 'jungle'],
];

const euler = new THREE.Euler(0, 0, 0, 'YXZ');
const quat = new THREE.Quaternion();

export function leaf(batch, key, x, y, z, yaw, pitch, size, roll = 0) {
  euler.set(pitch, yaw, roll, 'YXZ');
  quat.setFromEuler(euler);
  batch.add(key, LEAF, new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), quat, new THREE.Vector3(size, size, size)));
}

const tones = (rand) => TONES[Math.floor(rand() * TONES.length)];

function lobeGeometry(seed) {
  const base = new THREE.IcosahedronGeometry(0.8, 0);
  base.deleteAttribute('normal');
  base.deleteAttribute('uv');
  const core = mergeVertices(base);
  const pos = core.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const n = 1 + 0.12 * Math.sin(x * 3.3 + seed) * Math.cos(z * 2.9 - seed);
    pos.setXYZ(i, x * n, y * n * (y < 0 ? 0.7 : 1), z * n);
  }
  core.computeVertexNormals();
  const parts = [core.toNonIndexed()];
  const count = 12;
  const dir = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const xAxis = new THREE.Vector3();
  const yAxis = new THREE.Vector3();
  const zAxis = new THREE.Vector3();
  const basis = new THREE.Matrix4();
  for (let k = 0; k < count; k++) {
    const y = 1 - ((k + 0.5) / count) * 1.45;
    const ring = Math.sqrt(Math.max(0, 1 - y * y));
    const a = k * 2.39996 + seed;
    dir.set(Math.cos(a) * ring, y, Math.sin(a) * ring).normalize();
    tangent.set(0, -1, 0).addScaledVector(dir, dir.y);
    if (tangent.lengthSq() < 0.01) tangent.set(Math.cos(a + 1), 0, Math.sin(a + 1));
    tangent.normalize();
    zAxis.copy(tangent).multiplyScalar(0.88).addScaledVector(dir, 0.48).normalize();
    yAxis.copy(dir).addScaledVector(zAxis, -dir.dot(zAxis)).normalize();
    xAxis.crossVectors(yAxis, zAxis);
    const size = 0.66 + 0.07 * Math.sin(k * 1.7 + seed);
    basis.makeBasis(xAxis.clone().multiplyScalar(size * 1.25), yAxis.clone().multiplyScalar(size), zAxis.clone().multiplyScalar(size));
    basis.setPosition(dir.x * 0.62 - zAxis.x * 0.35, dir.y * 0.62 * (dir.y < 0 ? 0.7 : 1) - zAxis.y * 0.35, dir.z * 0.62 - zAxis.z * 0.35);
    parts.push(LEAF_TOP.clone().applyMatrix4(basis));
  }
  return mergeGeometries(parts);
}

const LOBES = [0, 1.9, 4.2].map(lobeGeometry);
const CLUMP_TONES = ['clumpDark', 'clumpMid', 'clumpLight'];
const lobeQuat = new THREE.Quaternion();
const lobeAxis = new THREE.Vector3(0, 1, 0);

export function jungleClump(batch, x, y, z, rand, size = 1, { lobes = Math.round(5 + size * 1.4) } = {}) {
  const count = lobes;
  const grow = Math.sqrt(Math.round(5 + size * 1.4) / lobes);
  for (let k = 0; k < count; k++) {
    const t = k / (count - 1);
    const yaw = rand() * Math.PI * 2;
    const ring = size * ((1 - t) * 0.62 + rand() * 0.12);
    const r = size * grow * (0.46 - t * 0.12 + rand() * 0.1);
    const lift = size * (0.3 + t * 0.62) + (rand() - 0.5) * size * 0.1;
    const tone = t > 0.62 ? 2 : t > 0.28 ? 1 : 0;
    lobeQuat.setFromAxisAngle(lobeAxis, rand() * Math.PI * 2);
    batch.add(CLUMP_TONES[tone], LOBES[k % LOBES.length], new THREE.Matrix4().compose(new THREE.Vector3(x + Math.sin(yaw) * ring, y + lift, z + Math.cos(yaw) * ring), lobeQuat, new THREE.Vector3(r, r * 0.86, r)));
  }
  const fringe = Math.round(4 + size * 1.5);
  for (let k = 0; k < fringe; k++) {
    const yaw = (k / fringe) * Math.PI * 2 + rand() * 0.5;
    const reach = size * 0.55;
    leaf(batch, rand() < 0.5 ? 'clumpDark' : 'clumpMid', x + Math.sin(yaw) * reach, y + size * 0.22, z + Math.cos(yaw) * reach, yaw, 0.15 + rand() * 0.35, size * (0.42 + rand() * 0.18), (rand() - 0.5) * 0.5);
  }
}

export function leafBush(batch, x, y, z, rand, size = 1) {
  jungleClump(batch, x, y, z, rand, size * 1.25);
}

export function fern(batch, x, y, z, rand, size = 1, { yaw = null, spread = Math.PI * 2, droop = 0.5, palette = tones(rand) } = {}) {
  const fronds = 4 + Math.floor(rand() * 3);
  for (let f = 0; f < fronds; f++) {
    const heading = yaw === null ? (f / fronds) * Math.PI * 2 + rand() * 0.6 : yaw + (rand() - 0.5) * spread;
    const dx = Math.sin(heading);
    const dz = Math.cos(heading);
    const length = size * (2.2 + rand() * 1.2);
    const lift = 0.35 + rand() * 0.35;
    const bend = droop * (0.7 + rand() * 0.6);
    const key = palette[f % palette.length];
    const steps = 3;
    let prev = [x, y, z];
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const px = x + dx * length * t;
      const pz = z + dz * length * t;
      const py = y + length * (lift * Math.sin(t * Math.PI * 0.85) - bend * t * t);
      const pitch = Math.atan2(prev[1] - py, length / steps);
      const s = size * 0.62 * (1.05 - 0.5 * t);
      leaf(batch, key, px, py, pz, heading + 1.25, pitch + 0.35, s, 0.2);
      leaf(batch, key, px, py, pz, heading - 1.25, pitch + 0.35, s, -0.2);
      if (i === steps) leaf(batch, key, px, py, pz, heading, pitch, s * 0.9);
      prev = [px, py, pz];
    }
  }
}

export function leafCanopy(batch, x, y, z, rand, size) {
  jungleClump(batch, x, y - size * 0.55, z, rand, size * 1.45, { lobes: Math.round(4 + size * 0.9) });
}
