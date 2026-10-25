import * as THREE from 'three';
import { toon, outlineMaterial } from './toon.js';
import { waveHeight } from './water.js';

export const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function noise(x, z) {
  return (
    0.5 +
    0.25 * Math.sin(x * 0.021 + Math.sin(z * 0.013) * 2) +
    0.15 * Math.sin(z * 0.034 + x * 0.011) +
    0.1 * Math.sin((x - z) * 0.057)
  );
}

export async function courseSurface(track, tick, { margin = 340, cell = 3, amp = () => 0.4 } = {}) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < track.N; i++) {
    minX = Math.min(minX, track.px[i]);
    maxX = Math.max(maxX, track.px[i]);
    minZ = Math.min(minZ, track.pz[i]);
    maxZ = Math.max(maxZ, track.pz[i]);
  }
  minX -= margin;
  minZ -= margin;
  maxX += margin;
  maxZ += margin;
  const cols = Math.ceil((maxX - minX) / cell) + 1;
  const rows = Math.ceil((maxZ - minZ) / cell) + 1;
  const nearest = new Int32Array(cols * rows);
  const { px, pz, tx, tz, wrap, sAt, sScale } = track;
  const step = 4;
  const segOf = (i) => track.segments.find((seg) => i >= seg.start && i <= seg.end);
  for (let r = 0; r < rows; r++) {
    await tick();
    const z = minZ + r * cell;
    for (let c = 0; c < cols; c++) {
      const x = minX + c * cell;
      let best = 0;
      let bestD = Infinity;
      for (const seg of track.segments) {
        for (let i = seg.start; i <= seg.end; i += step) {
          const d = (x - px[i]) ** 2 + (z - pz[i]) ** 2;
          if (d < bestD) {
            bestD = d;
            best = i;
          }
        }
      }
      const seg = segOf(best);
      for (let k = best - step; k <= best + step; k++) {
        const i = seg.ring ? wrap(k) : Math.min(seg.end, Math.max(seg.start, k));
        const d = (x - px[i]) ** 2 + (z - pz[i]) ** 2;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      nearest[r * cols + c] = best;
    }
  }
  const out = { level: 0, amp: 0, s: 0, dist: 0, idx: 0, edge: 0 };
  return {
    bounds: { minX, maxX, minZ, maxZ },
    sample(x, z) {
      const c = Math.min(cols - 1, Math.max(0, Math.round((x - minX) / cell)));
      const r = Math.min(rows - 1, Math.max(0, Math.round((z - minZ) / cell)));
      const i = nearest[r * cols + c];
      out.idx = i;
      out.s = sAt[i] + ((x - px[i]) * tx[i] + (z - pz[i]) * tz[i]) * sScale[i];
      out.dist = Math.hypot(x - px[i], z - pz[i]);
      out.edge = out.dist - track.hw[i];
      out.amp = amp(track.mainIndex(i));
      return out;
    },
  };
}

export async function buildHeightfield({ bounds, step, height, paint, tick, hidden = -2.5, smooth = false }) {
  const { minX, maxX, minZ, maxZ } = bounds;
  const cols = Math.ceil((maxX - minX) / step) + 1;
  const rows = Math.ceil((maxZ - minZ) / step) + 1;
  const heights = new Float32Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    await tick();
    for (let c = 0; c < cols; c++) heights[r * cols + c] = height(minX + c * step, minZ + r * step);
  }
  if (smooth) return smoothField({ minX, minZ, cols, rows, step, heights, paint, tick, hidden });
  const positions = [];
  const colors = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const d = new THREE.Vector3();
  const n = new THREE.Vector3();
  const color = new THREE.Color();
  const vertex = (v, idx) => v.set(minX + (idx % cols) * step, heights[idx], minZ + Math.floor(idx / cols) * step);
  const tri = (i0, i1, i2) => {
    vertex(a, i0);
    vertex(b, i1);
    vertex(d, i2);
    if (a.y < hidden && b.y < hidden && d.y < hidden) return;
    n.subVectors(b, a).cross(d.clone().sub(a)).normalize();
    if (n.y < 0) n.negate();
    paint((a.x + b.x + d.x) / 3, (a.y + b.y + d.y) / 3, (a.z + b.z + d.z) / 3, n.y, color);
    for (const v of [a, b, d]) {
      positions.push(v.x, v.y, v.z);
      colors.push(color.r, color.g, color.b);
    }
  };
  for (let r = 0; r < rows - 1; r++) {
    if (r % 20 === 0) await tick();
    for (let c = 0; c < cols - 1; c++) {
      const i = r * cols + c;
      if ((r + c) % 2) {
        tri(i, i + cols, i + 1);
        tri(i + 1, i + cols, i + cols + 1);
      } else {
        tri(i, i + cols, i + cols + 1);
        tri(i, i + cols + 1, i + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, toon(0xffffff, { vertexColors: true }));
}

async function smoothField({ minX, minZ, cols, rows, step, heights, paint, tick, hidden }) {
  const count = cols * rows;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const color = new THREE.Color();
  const at = (c, r) => heights[Math.min(rows - 1, Math.max(0, r)) * cols + Math.min(cols - 1, Math.max(0, c))];
  for (let r = 0; r < rows; r++) {
    if (r % 20 === 0) await tick();
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const x = minX + c * step;
      const z = minZ + r * step;
      const y = heights[i];
      positions.set([x, y, z], i * 3);
      const gx = (at(c + 1, r) - at(c - 1, r)) / (2 * step);
      const gz = (at(c, r + 1) - at(c, r - 1)) / (2 * step);
      paint(x, y, z, 1 / Math.hypot(gx, gz, 1), color);
      colors.set([color.r, color.g, color.b], i * 3);
    }
  }
  const index = [];
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const i = r * cols + c;
      if (heights[i] < hidden && heights[i + 1] < hidden && heights[i + cols] < hidden && heights[i + cols + 1] < hidden) continue;
      index.push(i, i + cols, i + 1, i + 1, i + cols, i + cols + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, toon(0xffffff, { vertexColors: true }));
}

export function courseBuoys(track, keep, spacing = 15) {
  const geometry = new THREE.SphereGeometry(1, 14, 10).scale(0.95, 0.8, 0.95);
  const spots = [];
  const count = Math.floor(track.length / spacing);
  const within = (seg, p) => {
    for (let i = seg.start; i <= seg.end; i += 2) {
      if (Math.hypot(p.x - track.px[i], p.z - track.pz[i]) < track.hw[i] + 0.5) return true;
    }
    return false;
  };
  for (const seg of track.segments) {
    const n = seg.ring ? count : Math.max(1, Math.floor(((seg.end - seg.start + 1) * track.spacing) / spacing));
    for (let i = 0; i < n; i++) {
      const idx = seg.ring ? track.wrap(Math.round((i * spacing) / track.spacing)) : seg.start + Math.round((i * (seg.end - seg.start)) / Math.max(1, n - 1));
      for (const side of [-1, 1]) {
        if (!keep(idx, side)) continue;
        const p = track.point(idx, side * (track.hw[idx] + 1.5));
        if (track.segments.some((other) => other !== seg && within(other, p))) continue;
        spots.push({ p, red: (i + (side > 0 ? 1 : 0)) % 2 === 1, side, i, seg, n });
      }
    }
  }
  const buoys = new THREE.InstancedMesh(geometry, toon(0xffffff), Math.max(1, spots.length));
  const lines = new THREE.InstancedMesh(geometry, outlineMaterial(0.14), Math.max(1, spots.length));
  buoys.count = lines.count = spots.length;
  const red = new THREE.Color(0xff4141);
  const white = new THREE.Color(0xffffff);
  spots.forEach((s, i) => buoys.setColorAt(i, s.red ? red : white));
  buoys.frustumCulled = lines.frustumCulled = false;
  const links = [];
  for (const seg of track.segments) {
    for (const side of [-1, 1]) {
      const row = spots.filter((s) => s.side === side && s.seg === seg);
      for (let k = 0; k < row.length; k++) {
        const a = row[k];
        const b = row[(k + 1) % row.length];
        const step = seg.ring ? (b.i - a.i + count) % count : b.i - a.i;
        if (step === 1) links.push([a.p, b.p]);
      }
    }
  }
  const PARTS = 4;
  const BOB_RANGE = 250;
  const rope = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 5).rotateX(Math.PI / 2).translate(0, 0, 0.5), toon(0xf3e2b8), Math.max(1, links.length * PARTS));
  const floats = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 10).rotateZ(Math.PI / 2), toon(0xffffff), Math.max(1, links.length * (PARTS - 1)));
  rope.count = links.length * PARTS;
  floats.count = links.length * (PARTS - 1);
  for (let k = 0; k < floats.count; k++) floats.setColorAt(k, k % 2 ? red : white);
  rope.frustumCulled = floats.frustumCulled = false;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const z = new THREE.Vector3(0, 0, 1);
  const dir = new THREE.Vector3();
  const sc = new THREE.Vector3();
  const pointAt = (p0, p1, u, t, out) => {
    out.lerpVectors(p0, p1, u);
    out.y = waveHeight(out.x, out.z, t) + (u === 0 || u === 1 ? 0.45 : 0.06);
    return out;
  };
  const dummy = new THREE.Object3D();
  const group = new THREE.Group();
  group.add(buoys, lines, rope, floats);
  const points = Array.from({ length: PARTS + 1 }, () => new THREE.Vector3());
  let placed = false;
  group.userData.update = (t, camera) => {
    const near = (x, z) => !placed || !camera || Math.hypot(x - camera.position.x, z - camera.position.z) < BOB_RANGE;
    links.forEach(([p0, p1], li) => {
      if (!near((p0.x + p1.x) / 2, (p0.z + p1.z) / 2)) return;
      for (let k = 0; k <= PARTS; k++) pointAt(p0, p1, k / PARTS, t, points[k]);
      for (let k = 0; k < PARTS; k++) {
        const a = points[k];
        dir.subVectors(points[k + 1], a);
        const len = dir.length();
        q.setFromUnitVectors(z, dir.divideScalar(len || 1));
        rope.setMatrixAt(li * PARTS + k, m.compose(a, q, sc.set(0.07, 0.07, len)));
        if (k > 0) {
          floats.setMatrixAt(li * (PARTS - 1) + k - 1, m.compose(a, q, sc.set(0.32, 0.22, 0.22)));
        }
      }
    });
    rope.instanceMatrix.needsUpdate = true;
    floats.instanceMatrix.needsUpdate = true;
    spots.forEach(({ p }, i) => {
      if (!near(p.x, p.z)) return;
      dummy.position.set(p.x, waveHeight(p.x, p.z, t) + 0.15, p.z);
      dummy.rotation.set(Math.sin(t * 1.7 + i) * 0.15, 0, Math.cos(t * 1.3 + i * 0.7) * 0.15);
      dummy.updateMatrix();
      buoys.setMatrixAt(i, dummy.matrix);
      lines.setMatrixAt(i, dummy.matrix);
    });
    placed = true;
    buoys.instanceMatrix.needsUpdate = true;
    lines.instanceMatrix.needsUpdate = true;
  };
  return group;
}

export const flagClock = { value: 0 };
let flagMaterial = null;
function clothMaterial() {
  if (flagMaterial) return flagMaterial;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const g = canvas.getContext('2d');
  g.fillStyle = '#e5332a';
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#ffffff';
  g.fillRect(12, 26, 40, 12);
  g.fillRect(26, 12, 12, 40);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  flagMaterial = toon(0xffffff, { map, side: THREE.DoubleSide });
  flagMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = flagClock;
    shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      float phase = modelMatrix[3].x * 0.37 + modelMatrix[3].z * 0.23;
      float reach = position.x / 1.5;
      transformed.z += (sin(position.x * 3.1 - uTime * 7.0 + phase) * 0.16 + sin(position.x * 5.3 - uTime * 11.0 + position.y * 2.0 + phase) * 0.05) * reach;
      transformed.y -= reach * reach * 0.12 * (0.6 + 0.4 * sin(uTime * 1.3 + phase));`,
    );
  };
  return flagMaterial;
}
const CLOTH = new THREE.PlaneGeometry(1.5, 1.5, 14, 8).translate(0.75, 0, 0);

export function flagCloth(size = 1) {
  const mesh = new THREE.Mesh(CLOTH, clothMaterial());
  mesh.scale.setScalar(size * 2);
  return mesh;
}

export function swissFlag(batch, group, x, y, z, yaw, size = 1) {
  batch.add('flagPole', POLE, new THREE.Matrix4().compose(new THREE.Vector3(x, y + 5 * size, z), new THREE.Quaternion(), new THREE.Vector3(size, 10 * size, size)));
  batch.add('bell', KNOB, new THREE.Matrix4().compose(new THREE.Vector3(x, y + 10.1 * size, z), new THREE.Quaternion(), new THREE.Vector3(size * 0.3, size * 0.3, size * 0.3)));
  const cloth = flagCloth(size);
  cloth.position.set(x, y + 8.4 * size, z);
  cloth.rotation.y = yaw;
  group.add(cloth);
}

const POLE = new THREE.CylinderGeometry(0.12, 0.12, 1, 8);
const KNOB = new THREE.SphereGeometry(1, 10, 8);
const BOX = new THREE.BoxGeometry(1, 1, 1);

export function ellipseHit(blobs, p, top = 120) {
  if (p.y > top) return null;
  for (const b of blobs) {
    const dx = p.x - b.x;
    const dz = p.z - b.z;
    if (Math.abs(dx) > b.rx + b.rz || Math.abs(dz) > b.rx + b.rz) continue;
    const c = Math.cos(b.rot);
    const s = Math.sin(b.rot);
    const lx = dx * c - dz * s;
    const lz = dx * s + dz * c;
    if ((lx / b.rx) ** 2 + (lz / b.rz) ** 2 >= 1) continue;
    const gx = lx / (b.rx * b.rx);
    const gz = lz / (b.rz * b.rz);
    return new THREE.Vector3(gx * c + gz * s, 0, -gx * s + gz * c).normalize();
  }
  return null;
}

export function groundHit(height, p) {
  if (p.y >= height(p.x, p.z)) return null;
  const e = 0.8;
  const gx = (height(p.x + e, p.z) - height(p.x - e, p.z)) / (2 * e);
  const gz = (height(p.x, p.z + e) - height(p.x, p.z - e)) / (2 * e);
  return new THREE.Vector3(-gx, 1, -gz).normalize();
}
