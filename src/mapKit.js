import * as THREE from 'three';
import { toon } from './toon.js';
import { createWater } from './water.js';
import { ribbon } from './jungle.js';

export const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function noise(x, z) {
  return 0.5 + 0.25 * Math.sin(x * 0.021 + Math.sin(z * 0.013) * 2) + 0.15 * Math.sin(z * 0.034 + x * 0.011) + 0.1 * Math.sin((x - z) * 0.057);
}

export const BOX = new THREE.BoxGeometry(1, 1, 1);

export async function groundMesh(surface, height, paint, tick, step = 5) {
  const { minX, maxX, minZ, maxZ } = surface.bounds;
  const cols = Math.ceil((maxX - minX) / step) + 1;
  const rows = Math.ceil((maxZ - minZ) / step) + 1;
  const heights = new Float32Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    await tick();
    for (let c = 0; c < cols; c++) heights[r * cols + c] = height(minX + c * step, minZ + r * step);
  }
  const positions = [];
  const colors = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const d = new THREE.Vector3();
  const n = new THREE.Vector3();
  const tint = new THREE.Color();
  const tri = (i0, i1, i2) => {
    const put = (v, idx) => v.set(minX + (idx % cols) * step, heights[idx], minZ + Math.floor(idx / cols) * step);
    put(a, i0);
    put(b, i1);
    put(d, i2);
    n.subVectors(b, a).cross(d.clone().sub(a)).normalize();
    for (const v of [a, b, d]) {
      paint(v.x, v.y, v.z, n, tint);
      positions.push(v.x, v.y, v.z);
      colors.push(tint.r, tint.g, tint.b);
    }
  };
  for (let r = 0; r < rows - 1; r++) {
    await tick();
    for (let c = 0; c < cols - 1; c++) {
      const i = r * cols + c;
      tri(i, i + cols, i + 1);
      tri(i + 1, i + cols, i + cols + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, toon(0xffffff, { vertexColors: true }));
}

export function seaStrip(track, from, to, options) {
  const positions = [];
  const shades = [];
  const flow = [];
  ribbon(track, from, to, (s) => track.baseLevel(s), positions, shades, undefined, flow);
  const foam = flow.filter((_, k) => k % 2 === 0).map(() => 0);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('aShade', new THREE.Float32BufferAttribute(shades, 3));
  geometry.setAttribute('aFlow', new THREE.Float32BufferAttribute(flow, 2));
  geometry.setAttribute('aFoam', new THREE.Float32BufferAttribute(foam, 1));
  return createWater({ geometry, flat: true, amp: 0.4, flowSpeed: 0.2, ...options });
}

export function trackBand(track, fromS, toS, half, y, extra = null) {
  const k0 = Math.round(fromS / track.spacing);
  const k1 = Math.round(toS / track.spacing);
  const lanes = 10;
  const positions = [];
  const index = [];
  const attr = [];
  for (let k = k0; k <= k1; k++) {
    const i = track.wrap(k);
    const s = k * track.spacing;
    const w = track.hw[i] + half;
    for (let lane = 0; lane <= lanes; lane++) {
      const lat = -w + (2 * w * lane) / lanes;
      positions.push(track.px[i] + track.nx[i] * lat, y, track.pz[i] + track.nz[i] * lat);
      attr.push(extra ? extra(s, lat) : 0);
    }
  }
  const row = lanes + 1;
  for (let k = 0; k < k1 - k0; k++) {
    for (let lane = 0; lane < lanes; lane++) {
      const a = k * row + lane;
      index.push(a, a + 1, a + row, a + 1, a + row + 1, a + row);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('aInfo', new THREE.Float32BufferAttribute(attr, 1));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}
