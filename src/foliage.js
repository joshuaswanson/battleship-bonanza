import * as THREE from 'three';

const OUTLINE_POINTS = [[0, 0, 0], [0.42, 0.08, 0.55], [0.36, 0.07, 1.25], [0, 0.02, 2], [-0.36, 0.07, 1.25], [-0.42, 0.08, 0.55]];
const MID = [0, 0.11, 0.9];

function leafGeometry() {
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
    face(MID, b, a, -0.07, true);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.computeVertexNormals();
  return g;
}

export const LEAF = leafGeometry();

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

export function leafBush(batch, x, y, z, rand, size = 1, { droop = 0, palette = tones(rand) } = {}) {
  const count = Math.round(6 + size * 3);
  for (let k = 0; k < count; k++) {
    const yaw = rand() * Math.PI * 2;
    const ring = Math.sqrt(rand());
    const pitch = -1.1 + ring * (1.35 + droop) + (rand() - 0.5) * 0.3;
    const reach = ring * size * 0.45;
    const lift = size * (0.2 + (1 - ring) * 0.55) * (0.75 + rand() * 0.25);
    const key = palette[Math.floor(rand() * palette.length)];
    leaf(batch, key, x + Math.sin(yaw) * reach, y + lift, z + Math.cos(yaw) * reach, yaw, pitch, size * (0.75 + rand() * 0.4), (rand() - 0.5) * 0.6);
  }
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
  const palette = tones(rand);
  const count = Math.round(9 + size * 2.2);
  for (let k = 0; k < count; k++) {
    const yaw = rand() * Math.PI * 2;
    const ring = Math.sqrt(rand());
    const reach = ring * size * 0.55;
    const lift = size * (0.1 + (1 - ring) * 0.45);
    leaf(batch, palette[k % palette.length], x + Math.sin(yaw) * reach, y + lift, z + Math.cos(yaw) * reach, yaw, -0.6 + ring * 1.6, size * (0.7 + rand() * 0.35), (rand() - 0.5) * 0.6);
  }
}
