import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createWater, waveHeight } from './water.js';
import { toon, outlineMaterial, mulberry32 } from './toon.js';

const SKY_TOP = 0x3fa9f5;
const SKY_HORIZON = 0xc4f1ff;
export const SUN_DIR = new THREE.Vector3(0.45, 0.85, 0.3).normalize();

export const COLORS = {
  sand: 0xffe1a1,
  grass: 0x7fd957,
  foam: 0xf4fbff,
  grassDeep: 0x5fc24a,
  crown: 0x6f8a32,
  bush: 0x2e9e52,
  coconut: 0x7a4a2a,
  rock: 0x9aa7b8,
  cliff: 0xb3a59a,
  cliffDark: 0x8f8178,
  moss: 0x4fae4a,
  mossDark: 0x3a8f3e,
  rockland: 0xffffff,
  stripeRed: 0xff4141,
  stripeWhite: 0xf6f8ff,
  roof: 0x0e2a47,
};

const IDENTITY = new THREE.Matrix4();

function mossyRock() {
  const material = toon(0xffffff, { vertexColors: true });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader =
      'attribute float aGreen;\nattribute vec3 aMoss;\nvarying float vGreen;\nvarying vec3 vMoss;\n' +
      shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvGreen = aGreen;\nvMoss = aMoss;');
    shader.fragmentShader =
      'varying float vGreen;\nvarying vec3 vMoss;\n' +
      shader.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float edge = max(fwidth(vGreen), 1e-4);
        float covered = smoothstep(0.5 - edge, 0.5 + edge, vGreen);
        diffuseColor.rgb = mix(diffuseColor.rgb, vMoss, covered);`,
      );
  };
  return material;
}

const INSTANCE_MIN = 12;
function releaseArray() {
  this.array = null;
}

export class Batcher {
  constructor() {
    this.groups = new Map();
  }
  add(key, geometry, matrix = IDENTITY) {
    if (!this.groups.has(key)) this.groups.set(key, []);
    let x;
    let z;
    let r;
    if (matrix === IDENTITY) {
      if (!geometry.boundingSphere) geometry.computeBoundingSphere();
      ({ x, z } = geometry.boundingSphere.center);
      r = geometry.boundingSphere.radius;
    } else {
      x = matrix.elements[12];
      z = matrix.elements[14];
      if (!geometry.boundingSphere) geometry.computeBoundingSphere();
      r = geometry.boundingSphere.radius * matrix.getMaxScaleOnAxis() + geometry.boundingSphere.center.length();
    }
    this.groups.get(key).push({ geometry, matrix: matrix === IDENTITY ? IDENTITY : matrix.clone(), x, z, r });
  }
  build(parent, outline = 0.12, colors = COLORS, size = CHUNK) {
    const steps = this.steps(parent, outline, colors, size);
    let step = steps.next();
    while (!step.done) step = steps.next();
    return step.value;
  }
  async buildAsync(parent, outline, colors, size = CHUNK, tick) {
    const steps = this.steps(parent, outline, colors, size);
    let step = steps.next();
    while (!step.done) {
      await tick();
      step = steps.next();
    }
    return step.value;
  }
  *steps(parent, outline, colors, size) {
    const cells = new Map();
    for (const [key, list] of this.groups) {
      for (const entry of list) {
        const id = `${Math.floor(entry.x / size)},${Math.floor(entry.z / size)}`;
        if (!cells.has(id)) cells.set(id, []);
        cells.get(id).push({ ...entry, key });
      }
    }
    const chunks = [];
    for (const [id, entries] of cells) {
      const [cx, cz] = id.split(',').map((n) => (Number(n) + 0.5) * size);
      const group = new THREE.Group();
      let radius = 0;
      for (const e of entries) radius = Math.max(radius, Math.hypot(e.x - cx, e.z - cz) + e.r);
      this.buildChunk(group, entries, outline, colors);
      parent.add(group);
      chunks.push({ group, x: cx, z: cz, radius });
      yield;
    }
    return chunks;
  }
  buildChunk(parent, entries, outline, colors) {
    const shapes = new Map();
    for (const e of entries) {
      if (!shapes.has(e.geometry)) shapes.set(e.geometry, []);
      shapes.get(e.geometry).push(e);
    }
    const merged = { lined: [], plain: [], mossy: [] };
    const tint = new THREE.Color();
    for (const [geometry, list] of shapes) {
      const mossy = geometry.hasAttribute('aGreen');
      const painted = geometry.hasAttribute('color');
      if (list.length < INSTANCE_MIN || painted || mossy) {
        for (const e of list) {
          const g = (geometry.index ? geometry.toNonIndexed() : geometry.clone()).applyMatrix4(e.matrix);
          g.deleteAttribute('uv');
          if (!g.hasAttribute('normal')) g.computeVertexNormals();
          if (mossy) {
            merged.mossy.push(g);
            continue;
          }
          if (!painted) {
            tint.set(colors[e.key]);
            const n = g.attributes.position.count;
            const rgb = new Float32Array(n * 3);
            for (let k = 0; k < n; k++) rgb.set([tint.r, tint.g, tint.b], k * 3);
            g.setAttribute('color', new THREE.BufferAttribute(rgb, 3));
          }
          (NO_OUTLINE.has(e.key) ? merged.plain : merged.lined).push(g);
        }
        continue;
      }
      const mesh = new THREE.InstancedMesh(geometry, WHITE_TOON(), list.length);
      list.forEach((e, k) => {
        mesh.setMatrixAt(k, e.matrix);
        mesh.setColorAt(k, tint.set(colors[e.key]));
      });
      mesh.computeBoundingSphere();
      parent.add(mesh);
      if (outline) {
        const line = new THREE.InstancedMesh(geometry, outlineMaterial(outline), list.length);
        line.instanceMatrix = mesh.instanceMatrix;
        line.boundingSphere = mesh.boundingSphere;
        parent.add(line);
      }
    }
    for (const [kind, list] of Object.entries(merged)) {
      if (!list.length) continue;
      const geometry = mergeGeometries(list);
      for (const g of list) g.dispose();
      geometry.computeBoundingSphere();
      for (const attribute of Object.values(geometry.attributes)) attribute.onUpload(releaseArray);
      parent.add(new THREE.Mesh(geometry, kind === 'mossy' ? mossyRock() : VERTEX_TOON()));
      if (outline && kind !== 'plain') parent.add(new THREE.Mesh(geometry, outlineMaterial(outline)));
    }
  }
}

const NO_OUTLINE = new Set(['foam']);
let whiteToon = null;
const WHITE_TOON = () => (whiteToon ??= toon(0xffffff));
let vertexToon = null;
const VERTEX_TOON = () => (vertexToon ??= toon(0xffffff, { vertexColors: true }));

const CHUNK = 220;

export function slicer(budget = 6) {
  let start = performance.now();
  return async () => {
    if (performance.now() - start < budget) return;
    await new Promise((r) => setTimeout(r, 0));
    start = performance.now();
  };
}

export function cullChunks(chunks, camera, far) {
  const { x, z } = camera.position;
  for (const c of chunks) c.group.visible = Math.hypot(c.x - x, c.z - z) - c.radius < far;
}

const m4 = new THREE.Matrix4();
const q = new THREE.Quaternion();
const e = new THREE.Euler();
export function mat(x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) {
  e.set(rx, ry, rz);
  q.setFromEuler(e);
  return m4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx, sy, sz)).clone();
}

export const SPHERE = new THREE.SphereGeometry(1, 20, 14);
export const LOW_SPHERE = new THREE.SphereGeometry(1, 12, 8);
export const CYLINDER = new THREE.CylinderGeometry(1, 1, 1, 12);
export const CONE = new THREE.ConeGeometry(1, 1, 14);
export const ROCK = new THREE.DodecahedronGeometry(1, 0);
ROCK.computeVertexNormals();
const RING = new THREE.TorusGeometry(1, 0.06, 6, 40).rotateX(Math.PI / 2);

const UP = new THREE.Vector3(0, 1, 0);
const LEAF_PALETTES = [
  [0x86de6c, 0x2c9a4c],
  [0xa3e46a, 0x3fa845],
  [0x6ad67f, 0x1f8548],
];
const BARK = [new THREE.Color(0xd39a5c), new THREE.Color(0x9c6a3a)];

function trunkGeometry(points, baseRadius) {
  const curve = new THREE.CatmullRomCurve3(points);
  const segments = 48;
  const radial = 9;
  const g = new THREE.TubeGeometry(curve, segments, 1, radial, false);
  const pos = g.attributes.position;
  const colors = [];
  const center = new THREE.Vector3();
  const v = new THREE.Vector3();
  const bands = 9 + Math.round(points[points.length - 1].distanceTo(points[0]) * 0.6);
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    curve.getPointAt(t, center);
    const band = (t * bands) % 1;
    const r = baseRadius * (1 - 0.42 * t) * (1 + 0.6 * Math.pow(1 - t, 8)) * (1 + 0.08 * band);
    const c = band > 0.6 ? BARK[1] : BARK[0];
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j;
      v.fromBufferAttribute(pos, k).sub(center).multiplyScalar(r).add(center);
      pos.setXYZ(k, v.x, v.y, v.z);
      colors.push(c.r, c.g, c.b);
    }
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g;
}

function frondGeometry(start, heading, elevation, length, width, droop, palette) {
  const steps = 16;
  const horiz = new THREE.Vector3(Math.cos(heading), 0, Math.sin(heading));
  const side = new THREE.Vector3(-horiz.z, 0, horiz.x);
  const light = new THREE.Color(palette[0]);
  const dark = new THREE.Color(palette[1]);
  const under = dark.clone().multiplyScalar(0.8);
  const spine = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    spine.push(
      start
        .clone()
        .addScaledVector(horiz, length * t * (0.8 + 0.2 * Math.cos(elevation)))
        .addScaledVector(UP, length * (Math.sin(elevation) * t - droop * t * t)),
    );
  }
  const pos = [];
  const col = [];
  const vertex = (p, c) => {
    pos.push(p.x, p.y, p.z);
    col.push(c.r, c.g, c.b);
    return pos.length / 3 - 1;
  };
  const tangent = new THREE.Vector3();
  const rows = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    tangent.subVectors(spine[Math.min(steps, i + 1)], spine[Math.max(0, i - 1)]).normalize();
    const w = width * Math.sin(Math.PI * Math.pow(t, 0.7)) * (1 - 0.3 * t) * (i % 2 ? 0.55 : 1);
    const thick = 0.16 * Math.sin(Math.PI * t);
    const edge = (s) =>
      spine[i].clone().addScaledVector(side, s * w).addScaledVector(tangent, -0.45 * w).addScaledVector(UP, -0.45 * w);
    rows.push({
      top: vertex(spine[i], light),
      bottom: vertex(spine[i].clone().addScaledVector(UP, -thick), under),
      left: vertex(edge(-1), dark),
      right: vertex(edge(1), dark),
    });
  }
  const index = [];
  for (let i = 0; i < steps; i++) {
    const a = rows[i];
    const b = rows[i + 1];
    index.push(a.top, a.right, b.top, a.right, b.right, b.top);
    index.push(a.top, b.top, a.left, a.left, b.top, b.left);
    index.push(a.bottom, b.bottom, a.right, a.right, b.bottom, b.right);
    index.push(a.bottom, a.left, b.bottom, a.left, b.left, b.bottom);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

export function addPalm(batch, x, baseY, z, rand, { height, lean, dir }) {
  const reach = Math.min(height * lean, 8);
  const sway = (rand() - 0.5) * 0.6;
  const points = [];
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    const out = reach * (1 - (1 - t) * (1 - t));
    const sideways = sway * reach * t * t;
    points.push(new THREE.Vector3(
      x + Math.cos(dir) * out - Math.sin(dir) * sideways,
      baseY + height * t - reach * 0.15 * t * t,
      z + Math.sin(dir) * out + Math.cos(dir) * sideways,
    ));
  }
  const radius = 0.4 + height * 0.03;
  batch.add('trunk', trunkGeometry(points, radius));

  const top = points[points.length - 1];
  batch.add('crown', SPHERE, mat(top.x, top.y + 0.1, top.z, radius * 1.3, radius * 1.1, radius * 1.3));
  const palette = LEAF_PALETTES[Math.floor(rand() * LEAF_PALETTES.length)];
  const spin = rand() * Math.PI * 2;
  const size = 3.8 + height * 0.22;
  const fronds = 10 + Math.floor(rand() * 4);
  for (let i = 0; i < fronds; i++) {
    const heading = spin + (i / fronds) * Math.PI * 2 + (rand() - 0.5) * 0.35;
    const upper = i % 3 === 0;
    batch.add(
      'fronds',
      frondGeometry(
        top,
        heading,
        upper ? 0.75 + rand() * 0.3 : 0.25 + rand() * 0.3,
        size * (upper ? 0.7 : 1) * (0.85 + rand() * 0.3),
        1.0 + rand() * 0.3,
        upper ? 0.55 : 0.75 + rand() * 0.35,
        palette,
      ),
    );
  }
  const nuts = Math.floor(rand() * 5);
  for (let i = 0; i < nuts; i++) {
    const a = spin + (i / Math.max(1, nuts)) * Math.PI * 2;
    batch.add('coconut', LOW_SPHERE, mat(top.x + Math.cos(a) * radius * 1.2, top.y - 0.45, top.z + Math.sin(a) * radius * 1.2, 0.42, 0.42, 0.42));
  }
}

const domeRadius = (radius, steep, k) =>
  radius * Math.pow(Math.max(0, 1 - Math.pow(k, steep)), 0.55) * (1 + 0.05 * Math.sin(k * 19)) * (1 + 0.45 * Math.pow(1 - k, 7));

function lump(g) {
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = pos.getY(i);
    const k = 1 + 0.07 * Math.sin(Math.atan2(z, x) * 5 + y * 0.15) + 0.05 * Math.sin(y * 0.4 + Math.atan2(z, x) * 3);
    pos.setXYZ(i, x * k, y, z * k);
  }
  return g;
}

function domeGeometry(radius, height, steep) {
  const points = [];
  for (let i = 0; i <= 40; i++) {
    const k = i / 40;
    points.push(new THREE.Vector2(Math.max(0.01, domeRadius(radius, steep, k)), height * k - 2));
  }
  return paintRock(lump(new THREE.LatheGeometry(points, 56)));
}

function paintRock(g) {
  g.computeVertexNormals();
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const colors = [];
  const greens = [];
  const moss = [];
  const color = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const ny = Math.abs(nor.getY(i));
    const speckle = Math.sin(x * 0.7 + z * 0.5) + Math.sin(z * 0.9 - y * 0.3);
    color.copy(ROCK_TONES[0]).lerp(TOWER_ROCK, 0.5 + 0.5 * Math.sin(y / 5 + speckle * 0.8));
    if (y < 0.8) color.copy(ROCK_TONES[1]);
    colors.push(color.r, color.g, color.b);
    greens.push(y < 0.8 ? 0 : THREE.MathUtils.smoothstep(ny, 0.4 + speckle * 0.05, 0.64 + speckle * 0.05));
    const tone = speckle > 0.3 ? GRASS_EDGE : GRASS_TONE;
    moss.push(tone.r, tone.g, tone.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.setAttribute('aGreen', new THREE.Float32BufferAttribute(greens, 1));
  g.setAttribute('aMoss', new THREE.Float32BufferAttribute(moss, 3));
  return g;
}

const TOWER_ROCK = new THREE.Color(0x9f9182);

const ROCK_TONES = [new THREE.Color(0xa89a8c), new THREE.Color(0x938577), new THREE.Color(0xb7aa9b)];
const GRASS_TONE = new THREE.Color(0x6cc84f);
const GRASS_EDGE = new THREE.Color(0x4fae4a);
const SAND_TONE = new THREE.Color(0xf2d48f);

function rockland(r, height, stretch, rot, rand) {
  const waves = Array.from({ length: 6 }, () => ({
    dir: new THREE.Vector3(rand() - 0.5, (rand() - 0.5) * 0.6, rand() - 0.5).normalize(),
    freq: 1.5 + rand() * 4,
    phase: rand() * 10,
    amp: 0.05 + rand() * 0.07,
  }));
  const noise = (v) => waves.reduce((sum, w) => sum + Math.sin(v.dot(w.dir) * w.freq + w.phase) * w.amp, 0);
  const plateau = height * (0.78 + rand() * 0.12);
  const g = mergeVertices(new THREE.IcosahedronGeometry(1, 6).deleteAttribute('normal').deleteAttribute('uv'));
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  const c = Math.cos(rot);
  const sn = Math.sin(rot);
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const unit = v.clone();
    const n = 1 + noise(unit);
    let px = unit.x * r * stretch * n;
    let pz = unit.z * (r / stretch) * n;
    let py = unit.y * height * 1.25 * (1 + noise(unit.clone().multiplyScalar(2)) * 0.6) - 2;
    const cliff = Math.max(0, unit.y) ** 0.35;
    px *= 1 - 0.18 * cliff;
    pz *= 1 - 0.18 * cliff;
    py = Math.min(py, plateau + noise(unit.clone().multiplyScalar(3)) * 3);
    pos.setXYZ(i, px * c + pz * sn, py, -px * sn + pz * c);
  }
  g.computeVertexNormals();
  const nor = g.attributes.normal;
  const colors = [];
  const greens = [];
  const moss = [];
  const tops = [];
  const color = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const ny = nor.getY(i);
    const speckle = Math.sin(x * 0.6 + z * 0.45) + Math.sin(z * 0.8 - y * 0.35);
    color.copy(ROCK_TONES[0]).lerp(ROCK_TONES[1], 0.5 + 0.5 * Math.sin(y / 3.5 + speckle * 0.6));
    const sand = 1 - THREE.MathUtils.smoothstep(y, 0.4, 2.2);
    if (sand > 0) color.lerp(SAND_TONE, sand);
    colors.push(color.r, color.g, color.b);
    const grass = THREE.MathUtils.smoothstep(ny, 0.5, 0.8) * THREE.MathUtils.smoothstep(y, height * 0.22, height * 0.42);
    greens.push(grass);
    const tone = y > plateau - 2.5 ? GRASS_TONE : GRASS_EDGE;
    moss.push(tone.r, tone.g, tone.b);
    if (grass > 0.95 && y > plateau - 3 && rand() < 0.01 && tops.length < 9) tops.push({ x, y, z });
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.setAttribute('aGreen', new THREE.Float32BufferAttribute(greens, 1));
  g.setAttribute('aMoss', new THREE.Float32BufferAttribute(moss, 3));
  return { geometry: g, tops };
}

function addSeaStack(batch, x, z, rand) {
  const roll = rand();
  const shape = roll < 0.3 ? 'dome' : roll < 0.55 ? 'spire' : roll < 0.7 ? 'twin' : 'crag';
  const footprint = [];
  const peak = (px, pz, radius, height, steep, lean, kind) => {
    const tilt = mat(px, 0, pz, 1, 1, 1, lean * Math.cos(rand() * 6), rand() * Math.PI * 2, lean * Math.sin(rand() * 6));
    batch.add('rockland', domeGeometry(radius, height, steep), tilt);
    const top = new THREE.Vector3(0, height - 2.2, 0).applyMatrix4(tilt);
    const palms = kind === 'dome' ? 1 + Math.floor(rand() * 3) : rand() < 0.7 ? 1 : 0;
    for (let i = 0; i < palms; i++) {
      const a = rand() * Math.PI * 2;
      const d = radius * (kind === 'dome' ? 0.2 : 0.12) * rand();
      addPalm(batch, top.x + Math.cos(a) * d, top.y - 0.3, top.z + Math.sin(a) * d, rand, { height: 5 + rand() * 4, lean: 0.15 + rand() * 0.3, dir: a });
    }
    batch.add('foam', RING, mat(px, 0.2, pz, radius * 1.06, 6, radius * 1.06));
    footprint.push({ x: px, z: pz, rx: radius, rz: radius, rot: 0 });
  };
  if (shape === 'dome') {
    peak(x, z, 16 + rand() * 12, 60 + rand() * 45, 2.6, 0.08, 'dome');
  } else if (shape === 'spire') {
    peak(x, z, 7 + rand() * 5, 45 + rand() * 40, 4, 0.12, 'spire');
  } else if (shape === 'twin') {
    const a = rand() * Math.PI * 2;
    const r1 = 14 + rand() * 8;
    const r2 = 9 + rand() * 6;
    peak(x, z, r1, 55 + rand() * 30, 2.6, 0.06, 'dome');
    peak(x + Math.cos(a) * (r1 + r2 * 0.6), z + Math.sin(a) * (r1 + r2 * 0.6), r2, 32 + rand() * 20, 2.4, 0.1, 'spire');
  } else {
    const r = 22 + rand() * 18;
    const height = r * (0.45 + rand() * 0.55);
    const rot = rand() * Math.PI;
    const stretch = 0.7 + rand() * 0.6;
    const land = rockland(r, height, stretch, rot, rand);
    batch.add('rockland', land.geometry, mat(x, 0, z));
    batch.add('foam', RING, mat(x, 0.2, z, r * stretch * 1.12, 6, (r / stretch) * 1.12, 0, rot, 0));
    for (const spot of land.tops) {
      const px = x + spot.x;
      const pz = z + spot.z;
      if (rand() < 0.45) {
        addPalm(batch, px, spot.y - 0.3, pz, rand, { height: 7 + rand() * 6, lean: 0.1 + rand() * 0.35, dir: rand() * Math.PI * 2 });
      } else {
        const sz = 1.6 + rand() * 1.8;
        batch.add(rand() < 0.5 ? 'moss' : 'mossDark', LOW_SPHERE, mat(px, spot.y + sz * 0.3, pz, sz * 1.2, sz * 0.8, sz));
      }
    }
    footprint.push({ x, z, rx: r * stretch * 0.95, rz: (r / stretch) * 0.95, rot });
  }
  const base = footprint[0];
  for (let i = 0; i < 2 + Math.floor(rand() * 3); i++) {
    const a = rand() * Math.PI * 2;
    const s = 2 + rand() * 4;
    batch.add('rock', ROCK, mat(base.x + Math.cos(a) * (base.rx + s * 0.6), 0.2, base.z + Math.sin(a) * (base.rx + s * 0.6), s, s * 0.8, s, rand(), rand() * 3, rand()));
  }
  footprint.crag = shape === 'crag';
  return footprint;
}

function islandSurface(blobs) {
  return (px, pz) => {
    let best = -Infinity;
    for (const b of blobs) {
      const dx = px - b.x;
      const dz = pz - b.z;
      const lx = (dx * Math.cos(b.rot) - dz * Math.sin(b.rot)) / b.rx;
      const lz = (dx * Math.sin(b.rot) + dz * Math.cos(b.rot)) / b.rz;
      const d2 = lx * lx + lz * lz;
      if (d2 < 1) best = Math.max(best, b.y + b.h * Math.sqrt(1 - d2));
    }
    return best;
  };
}

function addBlob(batch, key, blob) {
  batch.add(key, SPHERE, mat(blob.x, blob.y, blob.z, blob.rx, blob.h, blob.rz, 0, blob.rot, 0));
}

function addIsland(batch, x, z, r, rand, { clearCenter = 0 } = {}) {
  const roll = rand();
  const kind = r < 14 && roll < 0.45 ? 'sandbar' : roll > 0.65 ? 'lush' : 'normal';

  const sand = [];
  const blobCount = Math.min(9, 1 + Math.floor(r / 7) + Math.floor(rand() * 3));
  let heading = rand() * Math.PI * 2;
  const bend = (rand() - 0.5) * 1.6;
  for (let i = 0; i < blobCount; i++) {
    const size = r * (i === 0 ? 0.5 + rand() * 0.2 : 0.22 + rand() * 0.38);
    let bx = x;
    let bz = z;
    if (i > 0) {
      const parent = sand[rand() < 0.7 ? i - 1 : Math.floor(rand() * i)];
      heading += bend + (rand() - 0.5) * 1.4;
      const reach = (Math.max(parent.rx, parent.rz) + size) * (0.65 + rand() * 0.3);
      bx = parent.x + Math.cos(heading) * reach;
      bz = parent.z + Math.sin(heading) * reach;
      const out = Math.hypot(bx - x, bz - z) + size;
      if (out > r) {
        const k = Math.max(0, (r - size) / Math.hypot(bx - x, bz - z));
        bx = x + (bx - x) * k;
        bz = z + (bz - z) * k;
      }
    }
    const stretch = 0.6 + rand() * 0.8;
    sand.push({
      x: bx,
      z: bz,
      rx: size * stretch,
      rz: size / stretch,
      rot: rand() * Math.PI,
      y: -1,
      h: kind === 'sandbar' ? 1.8 + rand() * 0.8 : Math.min(7, size * 0.3) + 1 + rand() * 1.5,
    });
  }
  for (const blob of sand) {
    addBlob(batch, 'sand', blob);
    batch.add('foam', RING, mat(blob.x, 0.25, blob.z, blob.rx * 1.03, 6, blob.rz * 1.03, 0, blob.rot, 0));
    batch.add('foam', RING, mat(blob.x, 0.1, blob.z, blob.rx * 1.13, 4, blob.rz * 1.13, 0, blob.rot, 0));
  }
  const sandAt = islandSurface(sand);

  const green = [];
  if (kind !== 'sandbar') {
    const grassKey = rand() < 0.5 ? 'grass' : 'grassDeep';
    for (const blob of sand) {
      if (kind === 'normal' && rand() < 0.35) continue;
      const g = {
        x: blob.x + (rand() - 0.5) * blob.rx * 0.2,
        z: blob.z + (rand() - 0.5) * blob.rz * 0.2,
        rx: blob.rx * (0.55 + rand() * 0.2),
        rz: blob.rz * (0.55 + rand() * 0.2),
        rot: blob.rot,
        y: blob.h - 3.2,
        h: 3.5,
      };
      green.push(g);
      addBlob(batch, grassKey, g);
    }
    if (kind === 'lush' && r > 22) {
      const hill = { x: x + (rand() - 0.5) * r * 0.3, z: z + (rand() - 0.5) * r * 0.3, rx: r * 0.35, rz: r * 0.3, rot: rand() * Math.PI, y: 0, h: 7 + rand() * 7 };
      green.push(hill);
      addBlob(batch, grassKey, hill);
    }
  }
  const groundAt = (px, pz) => Math.max(sandAt(px, pz), islandSurface(green)(px, pz));

  const plant = (px, pz, opts) => {
    if (Math.hypot(px - x, pz - z) < clearCenter) return;
    const y = groundAt(px, pz);
    if (y < 0.6) return;
    addPalm(batch, px, y - 0.4, pz, rand, opts);
  };
  const outward = (px, pz) => Math.atan2(pz - z, px - x) + (rand() - 0.5) * 1.2;

  const clusters = kind === 'sandbar' ? (rand() < 0.6 ? 1 : 0) : kind === 'lush' ? 2 + Math.floor(rand() * 4) : 1 + Math.floor(rand() * 3);
  for (let c = 0; c < clusters; c++) {
    const a = rand() * Math.PI * 2;
    const d = rand() * r * (kind === 'sandbar' ? 0.3 : 0.55);
    const cx = x + Math.cos(a) * d;
    const cz = z + Math.sin(a) * d;
    const count = kind === 'sandbar' ? 1 + Math.floor(rand() * 2) : 1 + Math.floor(rand() * 5);
    const tallest = 9 + rand() * 9;
    for (let i = 0; i < count; i++) {
      const pa = rand() * Math.PI * 2;
      const pd = i === 0 ? 0 : 1.5 + rand() * 3;
      const px = cx + Math.cos(pa) * pd;
      const pz = cz + Math.sin(pa) * pd;
      const edge = Math.min(1, Math.hypot(px - x, pz - z) / r);
      plant(px, pz, {
        height: i === 0 ? tallest : tallest * (0.35 + rand() * 0.55),
        lean: 0.05 + rand() * 0.25 + edge * edge * 0.45,
        dir: i === 0 ? outward(px, pz) : pa + (rand() - 0.5) * 0.8,
      });
    }
  }

  if (kind !== 'sandbar' && rand() < 0.55) {
    const a = rand() * Math.PI * 2;
    const px = x + Math.cos(a) * r * 0.6;
    const pz = z + Math.sin(a) * r * 0.6;
    plant(px, pz, { height: 8 + rand() * 6, lean: 0.55 + rand() * 0.3, dir: a + (rand() - 0.5) * 0.4 });
  }

  if (kind !== 'sandbar') {
    const bushes = Math.floor(rand() * (kind === 'lush' ? 7 : 4));
    for (let i = 0; i < bushes; i++) {
      const a = rand() * Math.PI * 2;
      const px = x + Math.cos(a) * r * (0.3 + rand() * 0.35);
      const pz = z + Math.sin(a) * r * (0.3 + rand() * 0.35);
      const y = groundAt(px, pz);
      if (y < 0.6) continue;
      const s = 1.2 + rand() * 1.6;
      for (let k = 0; k < 3; k++) {
        batch.add('bush', LOW_SPHERE, mat(px + (k - 1) * s * 0.7, y + s * 0.3, pz + (rand() - 0.5) * s, s * (0.8 + rand() * 0.4), s * 0.75, s));
      }
    }
  }

  const rocks = Math.floor(rand() * 5);
  const rockA = rand() * Math.PI * 2;
  for (let i = 0; i < rocks; i++) {
    const a = rockA + (rand() - 0.5) * 1.2;
    const s = 0.8 + rand() * 2.6;
    batch.add('rock', ROCK, mat(x + Math.cos(a) * r * (0.75 + rand() * 0.3), 0.3, z + Math.sin(a) * r * (0.75 + rand() * 0.3), s, s * 0.75, s, rand(), rand() * 3, rand()));
  }
  return sand;
}

const PILLAR_DARK = new THREE.Color(0x6f6457);
const PILLAR_STREAK = new THREE.Color(0x857868);
const PILLAR_LIGHT = new THREE.Color(0xa49582);
const PILLAR_WET = new THREE.Color(0x4f4a43);

function paintPillar(g, top) {
  g.computeVertexNormals();
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const colors = [];
  const greens = [];
  const moss = [];
  const color = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const streak = Math.sin(Math.atan2(z, x) * 9 + y * 0.05) * 0.5 + Math.sin(x * 0.4 - z * 0.3 + y * 0.02) * 0.5;
    color.copy(PILLAR_STREAK).lerp(streak > 0 ? PILLAR_LIGHT : PILLAR_DARK, Math.abs(streak) * 0.8);
    color.multiplyScalar(0.92 + 0.12 * Math.sin(y * 0.35 + streak));
    if (y < 1.6) color.lerp(PILLAR_WET, 1 - THREE.MathUtils.smoothstep(y, -1, 1.6));
    colors.push(color.r, color.g, color.b);
    const ny = nor.getY(i);
    const hang = THREE.MathUtils.smoothstep(y, top - 4, top - 0.5) * (0.5 + 0.5 * Math.sin(Math.atan2(z, x) * 5 + x)) * 0.62;
    greens.push(Math.max(THREE.MathUtils.smoothstep(ny, 0.55, 0.75) * THREE.MathUtils.smoothstep(y, top - 3, top - 1), hang));
    const tone = streak > 0.2 ? GRASS_EDGE : GRASS_TONE;
    moss.push(tone.r, tone.g, tone.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.setAttribute('aGreen', new THREE.Float32BufferAttribute(greens, 1));
  g.setAttribute('aMoss', new THREE.Float32BufferAttribute(moss, 3));
  return g;
}

function pillarGeometry(radius, height, rand) {
  const waist = 0.45 + rand() * 0.45;
  const waistAt = 0.3 + rand() * 0.3;
  const flare = 1 + rand() * 0.6;
  const lean = new THREE.Vector2((rand() - 0.5) * radius * 0.5, (rand() - 0.5) * radius * 0.5);
  const stretch = 0.75 + rand() * 0.5;
  const turn = rand() * Math.PI;
  const lumps = Array.from({ length: 5 }, () => ({ k: 1 + Math.floor(rand() * 5), p: rand() * 6, a: 0.04 + rand() * 0.1, v: rand() * 0.2 }));
  const g = mergeVertices(new THREE.CylinderGeometry(1, 1, 1, 16, 22).translate(0, 0.5, 0).deleteAttribute('normal').deleteAttribute('uv'));
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const t = pos.getY(i);
    const z = pos.getZ(i);
    const r0 = Math.hypot(x, z);
    const a = Math.atan2(z, x);
    let profile = 1 - (1 - waist) * Math.exp(-(((t - waistAt) / 0.28) ** 2));
    profile *= 1 + (flare - 1) * THREE.MathUtils.smoothstep(t, 0.72, 0.97);
    profile *= 1 + 0.25 * (1 - THREE.MathUtils.smoothstep(t, 0, 0.12));
    let bump = 1;
    for (const l of lumps) bump += Math.sin(a * l.k + l.p + t * height * l.v) * l.a;
    bump += Math.sin(a * 11 + t * 3) * 0.03;
    const rr = r0 * radius * profile * bump;
    const lx = Math.cos(a) * rr * stretch;
    const lz = Math.sin(a) * rr / stretch;
    const shift = t * t;
    let y = t * height - 2;
    if (t > 0.999 && r0 < 0.999) y += Math.sin(x * 3 + z * 2) * 0.6;
    pos.setXYZ(i, lx * Math.cos(turn) - lz * Math.sin(turn) + lean.x * shift, y, lx * Math.sin(turn) + lz * Math.cos(turn) + lean.y * shift);
  }
  return { geometry: paintPillar(g, height - 2), top: new THREE.Vector3(lean.x, height - 2, lean.y), topRadius: radius * flare * 0.8, footprint: radius * 1.1 * Math.max(stretch, 1 / stretch) };
}

function plantTop(batch, x, y, z, radius, rand, density = 1) {
  const palms = Math.max(1, Math.round((1 + rand() * 3) * density * Math.min(1.6, radius / 8)));
  for (let i = 0; i < palms; i++) {
    const a = rand() * Math.PI * 2;
    const d = radius * Math.sqrt(rand()) * 0.75;
    addPalm(batch, x + Math.cos(a) * d, y - 0.3, z + Math.sin(a) * d, rand, { height: 5 + rand() * 5, lean: 0.1 + rand() * 0.4, dir: a });
  }
  const bushes = Math.round((3 + rand() * 5) * density * Math.min(1.8, radius / 8));
  for (let i = 0; i < bushes; i++) {
    const a = rand() * Math.PI * 2;
    const d = radius * Math.sqrt(rand()) * 0.9;
    const sz = 1.2 + rand() * 1.6;
    batch.add(rand() < 0.5 ? 'moss' : 'mossDark', LOW_SPHERE, mat(x + Math.cos(a) * d, y + sz * 0.3, z + Math.sin(a) * d, sz * 1.2, sz * 0.75, sz));
  }
}

function addPillar(batch, x, z, rand, { radius, height, plants = 1 }) {
  const pillar = pillarGeometry(radius, height, rand);
  batch.add('rockland', pillar.geometry, mat(x, 0, z));
  batch.add('foam', RING, mat(x, 0.2, z, pillar.footprint * 1.05, 6, pillar.footprint * 1.05));
  const top = pillar.top.clone().add(new THREE.Vector3(x, 0, z));
  if (plants) plantTop(batch, top.x, top.y, top.z, pillar.topRadius, rand, plants);
  return { blob: { x, z, rx: pillar.footprint, rz: pillar.footprint, rot: 0 }, top };
}

function archGeometry(span, height, thick, rand) {
  const pts = [
    new THREE.Vector3(-span, -3, 0),
    new THREE.Vector3(-span * 1.02, height * 0.45, 0),
    new THREE.Vector3(-span * 0.85, height * 0.85, 0),
    new THREE.Vector3(-span * 0.4, height, 0),
    new THREE.Vector3(span * 0.4, height * (0.97 + rand() * 0.06), 0),
    new THREE.Vector3(span * 0.85, height * 0.85, 0),
    new THREE.Vector3(span * 1.02, height * 0.45, 0),
    new THREE.Vector3(span, -3, 0),
  ];
  const curve = new THREE.CatmullRomCurve3(pts);
  const segments = 60;
  const radial = 12;
  const tube = new THREE.TubeGeometry(curve, segments, 1, radial, false);
  const pos = tube.attributes.position;
  const lumps = Array.from({ length: 3 }, () => ({ f: 3 + rand() * 6, k: 2 + Math.floor(rand() * 3), p: rand() * 6, a: 0.08 + rand() * 0.1 }));
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const c = curve.getPointAt(t);
    const along = Math.abs(t - 0.5) * 2;
    const r = thick * (1.2 - 0.4 * along + 0.7 * along ** 8);
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j;
      const a = (j / radial) * Math.PI * 2;
      let bump = 1;
      for (const l of lumps) bump += Math.sin(t * l.f + a * l.k + l.p) * l.a;
      const dx = pos.getX(k) - c.x;
      const dy = pos.getY(k) - c.y;
      const dz = pos.getZ(k) - c.z;
      const flat = dy > 0 && along < 0.6 ? 0.7 : 1;
      pos.setXYZ(k, c.x + dx * r * bump, c.y + dy * r * bump * flat, c.z + dz * r * bump * 1.35);
    }
  }
  const g = mergeVertices(tube.deleteAttribute('normal').deleteAttribute('uv'));
  return paintPillar(g, height + thick);
}

function addArch(batch, track, fraction, rand) {
  const idx = track.wrap(Math.round(fraction * track.N));
  const half = track.halfWidth;
  const span = half + 9;
  const height = 26 + rand() * 6;
  const thick = 5 + rand() * 1.5;
  const p = track.point(idx, 0);
  const heading = track.heading(idx);
  batch.add('rockland', archGeometry(span, height, thick, rand), mat(p.x, 0, p.z, 1, 1, 1, 0, heading, 0));
  const nx = track.nx[idx];
  const nz = track.nz[idx];
  for (let k = -3; k <= 3; k++) {
    const lat = (k / 3) * span * 0.75;
    plantTop(batch, p.x + nx * lat, height + thick * 0.55, p.z + nz * lat, 2.2, rand, 0.4);
  }
  const blobs = [];
  for (const side of [-1, 1]) {
    const lx = p.x + nx * side * span;
    const lz = p.z + nz * side * span;
    batch.add('foam', RING, mat(lx, 0.2, lz, thick * 1.6, 6, thick * 1.6));
    blobs.push({ x: lx, z: lz, rx: thick * 1.4, rz: thick * 1.4, rot: 0 });
  }
  return blobs;
}

function addLighthouse(batch, x, z, baseY) {
  const stripes = 6;
  for (let i = 0; i < stripes; i++) {
    const r = 3 - i * 0.22;
    batch.add(i % 2 ? 'stripeWhite' : 'stripeRed', CYLINDER, mat(x, baseY + i * 3 + 1.5, z, r, 3, r));
  }
  const top = baseY + stripes * 3;
  batch.add('stripeWhite', CYLINDER, mat(x, top + 0.2, z, 2.6, 0.4, 2.6));
  batch.add('roof', SPHERE, mat(x, top + 2.6, z, 2, 2.4, 2));
  batch.add('stripeRed', SPHERE, mat(x, top + 5, z, 0.5, 0.5, 0.5));
}

export function createSky() {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTop: { value: new THREE.Color(SKY_TOP) },
      uHorizon: { value: new THREE.Color(SKY_HORIZON) },
      uSunDir: { value: SUN_DIR.clone() },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop;
      uniform vec3 uHorizon;
      uniform vec3 uSunDir;
      varying vec3 vDir;
      void main() {
        vec3 dir = normalize(vDir);
        vec3 color = mix(uHorizon, uTop, smoothstep(0.0, 0.55, dir.y));
        float sun = dot(dir, normalize(uSunDir));
        color += vec3(1.0, 0.92, 0.7) * pow(max(sun, 0.0), 24.0) * 0.35;
        color = mix(color, vec3(1.0, 0.98, 0.88), smoothstep(0.9965, 0.9975, sun));
        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1400, 32, 16), material);
  mesh.renderOrder = -1;
  return mesh;
}

export function createCloud(rand) {
  const parts = [];
  const puffs = 4 + Math.floor(rand() * 4);
  for (let i = 0; i < puffs; i++) {
    const s = 9 + rand() * 9;
    parts.push(LOW_SPHERE.clone().applyMatrix4(mat((i - puffs / 2) * 9 + rand() * 4, rand() * 5, rand() * 10 - 5, s * 1.2, s * 0.8, s)));
  }
  return new THREE.Mesh(mergeGeometries(parts), toon(0xffffff, { emissive: 0x9bd9ff, emissiveIntensity: 0.25 }));
}

function createMarkerBuoy(kind) {
  const group = new THREE.Group();
  const add = (geometry, color, x, y, z, sx, sy, sz, outline = 0.06) => {
    const mesh = new THREE.Mesh(geometry, typeof color === 'number' ? toon(color) : color);
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    if (outline) mesh.add(new THREE.Mesh(geometry, outlineMaterial(outline / Math.min(sx, sy, sz))));
    group.add(mesh);
    return mesh;
  };
  const dark = 0x34465e;
  if (kind === 0) {
    add(SPHERE, 0xffffff, 0, 0.4, 0, 1.6, 0.7, 1.6);
    add(CYLINDER, 0xff4141, 0, 2.2, 0, 1.0, 2.8, 1.0);
    add(CYLINDER, 0xffffff, 0, 2.2, 0, 1.03, 0.5, 1.03, 0.04);
    add(CYLINDER, dark, 0, 3.75, 0, 1.05, 0.3, 1.05);
  } else if (kind === 1) {
    add(SPHERE, 0xffffff, 0, 0.4, 0, 1.6, 0.7, 1.6);
    add(CYLINDER, 0x3ddc6f, 0, 1.4, 0, 1.1, 1.4, 1.1);
    add(CONE, 0x3ddc6f, 0, 3.0, 0, 1.1, 1.8, 1.1);
    add(CYLINDER, 0xffffff, 0, 1.6, 0, 1.13, 0.4, 1.13, 0.04);
  } else {
    add(SPHERE, 0xffd23f, 0, 0.9, 0, 1.5, 1.4, 1.5);
    add(CYLINDER, dark, 0, 0.9, 0, 1.52, 0.45, 1.52, 0.04);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const leg = add(CYLINDER, dark, Math.cos(a) * 0.45, 3.0, Math.sin(a) * 0.45, 0.1, 2.4, 0.1, 0.03);
      leg.rotation.set(Math.sin(a) * 0.15, 0, -Math.cos(a) * 0.15);
    }
    add(CYLINDER, 0xffd23f, 0, 4.25, 0, 0.75, 0.2, 0.75, 0.04);
    add(CONE, dark, 0, 4.9, 0, 0.55, 0.8, 0.55, 0.04);
    group.userData.light = add(SPHERE, new THREE.MeshBasicMaterial({ color: 0xfff27a }), 0, 4.55, 0, 0.32, 0.32, 0.32, 0);
  }
  return group;
}

export function createWorld(scene, track) {
  const fog = new THREE.Fog(SKY_HORIZON, 260, 950);

  const sky = createSky();
  scene.add(sky);

  scene.add(new THREE.HemisphereLight(0xe8f8ff, 0x3cc4d4, 1.4));
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.4);
  sun.position.copy(SUN_DIR).multiplyScalar(100);
  scene.add(sun);

  const water = createWater();
  scene.add(water.mesh);

  const rand = mulberry32(20261023);
  const batch = new Batcher();
  const half = track.halfWidth;
  const shores = [];
  const pillars = [];
  const fits = (x, z, r) => !pillars.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + r + 6);
  for (const f of [0.2, 0.47, 0.72]) shores.push(...addArch(batch, track, f, rand));
  for (const f of [0.2, 0.47, 0.72]) {
    const idx = track.wrap(Math.round(f * track.N));
    for (const side of [-1, 1]) {
      const p = track.point(idx, side * (half + 9));
      pillars.push({ x: p.x, z: p.z, r: 8 });
    }
  }
  const start = track.point(0, -(half + 26));
  const home = addPillar(batch, start.x, start.z, rand, { radius: 9, height: 34, plants: 0.5 });
  shores.push(home.blob);
  pillars.push({ x: start.x, z: start.z, r: 10 });
  addLighthouse(batch, home.top.x, home.top.z, home.top.y);
  for (let gx = -560; gx <= 560; gx += 42) {
    for (let gz = -500; gz <= 580; gz += 42) {
      const x = gx + (rand() - 0.5) * 34;
      const z = gz + (rand() - 0.5) * 34;
      if (rand() < 0.6) continue;
      const clearance = track.project(x, z).distance - half;
      const mesa = rand() < 0.18;
      const radius = mesa ? 13 + rand() * 12 : 4 + rand() * 9;
      if (clearance < radius + 6) continue;
      if (!fits(x, z, radius)) continue;
      const height = mesa ? 26 + rand() * 30 : 30 + rand() * 65 + (clearance > 120 ? rand() * 35 : 0);
      const pillar = addPillar(batch, x, z, rand, { radius, height });
      pillars.push({ x, z, r: radius });
      shores.push(pillar.blob);
    }
  }
  const islands = pillars.map((p) => ({ x: p.x, z: p.z, r: p.r }));
  const stacks = [];


  const scenery = new THREE.Group();
  const chunks = batch.build(scenery);
  scene.add(scenery);

  const buoySpacing = 15;
  const buoyCount = Math.floor(track.length / buoySpacing);
  const buoyGeometry = new THREE.SphereGeometry(1, 14, 10);
  buoyGeometry.scale(0.95, 0.8, 0.95);
  const buoys = new THREE.InstancedMesh(buoyGeometry, toon(0xffffff), buoyCount * 2);
  const buoyOutline = new THREE.InstancedMesh(buoyGeometry, outlineMaterial(0.14), buoyCount * 2);
  const buoyPositions = [];
  const red = new THREE.Color(COLORS.stripeRed);
  const white = new THREE.Color(0xffffff);
  for (let i = 0; i < buoyCount; i++) {
    const idx = Math.round((i * buoySpacing) / track.spacing);
    for (const side of [-1, 1]) {
      const p = track.point(idx, side * (half + 1.5));
      const n = buoyPositions.length;
      buoyPositions.push(p);
      buoys.setColorAt(n, (i + (side > 0 ? 1 : 0)) % 2 ? red : white);
    }
  }
  buoys.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  buoyOutline.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  buoys.frustumCulled = false;
  buoyOutline.frustumCulled = false;
  scene.add(buoys, buoyOutline);

  const arch = createArch(track, half);
  scene.add(arch);

  const clouds = [];
  for (let i = 0; i < 16; i++) {
    const cloud = createCloud(rand);
    const a = rand() * Math.PI * 2;
    const d = 150 + rand() * 600;
    cloud.position.set(Math.cos(a) * d, 110 + rand() * 70, Math.sin(a) * d);
    cloud.userData.speed = 2 + rand() * 3;
    clouds.push(cloud);
    scene.add(cloud);
  }

  const markers = [];
  for (let tries = 0; markers.length < 22 && tries < 600; tries++) {
    const x = (rand() - 0.5) * 900;
    const z = (rand() - 0.5) * 900 + 60;
    const clearance = track.project(x, z).distance - half;
    if (clearance < 8 || clearance > 120) continue;
    if (islands.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + 8)) continue;
    if (markers.some((m) => Math.hypot(m.position.x - x, m.position.z - z) < 30)) continue;
    const marker = createMarkerBuoy(markers.length % 3);
    marker.position.set(x, 0, z);
    marker.rotation.y = rand() * Math.PI * 2;
    marker.userData.phase = rand() * 10;
    markers.push(marker);
    scene.add(marker);
  }


  const dummy = new THREE.Object3D();
  return {
    fog,
    water,
    sun,
    islands,
    shores,
    stacks,
    update(t, dt, camera) {
      water.update(t);
      cullChunks(chunks, camera, fog.far);
      sky.position.copy(camera.position);
      for (let i = 0; i < buoyPositions.length; i++) {
        const p = buoyPositions[i];
        dummy.position.set(p.x, waveHeight(p.x, p.z, t) + 0.15, p.z);
        dummy.rotation.set(Math.sin(t * 1.7 + i) * 0.15, 0, Math.cos(t * 1.3 + i * 0.7) * 0.15);
        dummy.updateMatrix();
        buoys.setMatrixAt(i, dummy.matrix);
        buoyOutline.setMatrixAt(i, dummy.matrix);
      }
      buoys.instanceMatrix.needsUpdate = true;
      buoyOutline.instanceMatrix.needsUpdate = true;
      for (const cloud of clouds) {
        cloud.position.x += cloud.userData.speed * dt;
        if (cloud.position.x > 800) cloud.position.x = -800;
      }
      for (const m of markers) {
        const ph = m.userData.phase;
        m.position.y = waveHeight(m.position.x, m.position.z, t) - 0.4;
        m.rotation.x = Math.sin(t * 1.4 + ph) * 0.12;
        m.rotation.z = Math.cos(t * 1.1 + ph) * 0.12;
        if (m.userData.light) m.userData.light.visible = (t + ph) % 2 < 0.35;
      }
    },
  };
}

function checkerTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const cell = 16;
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 32; x++) {
      ctx.fillStyle = (x + y) % 2 ? '#0E2A47' : '#FFFFFF';
      ctx.fillRect(x * cell, y * cell, cell, cell);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export function createArch(track, half) {
  const group = new THREE.Group();
  const p = track.point(0);
  group.position.set(p.x, track.level(0), p.z);
  group.rotation.y = track.heading(0);
  const span = half + 4;
  const red = toon(COLORS.stripeRed);
  const white = toon(0xffffff);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const mesh = new THREE.Mesh(CYLINDER, i % 2 ? white : red);
      mesh.scale.set(1.6, 3.2, 1.6);
      mesh.position.set(side * span, i * 3.2 + 1.6, 0);
      mesh.add(new THREE.Mesh(CYLINDER, outlineMaterial(0.08)));
      group.add(mesh);
    }
    const ball = new THREE.Mesh(SPHERE, toon(0xffd23f));
    ball.scale.setScalar(2.2);
    ball.position.set(side * span, 17.5, 0);
    ball.add(new THREE.Mesh(SPHERE, outlineMaterial(0.08)));
    group.add(ball);
  }
  const bannerGeometry = new THREE.BoxGeometry(span * 2, 3.4, 0.8);
  const banner = new THREE.Mesh(bannerGeometry, toon(0xffffff, { map: checkerTexture() }));
  banner.position.set(0, 14.5, 0);
  banner.add(new THREE.Mesh(bannerGeometry, outlineMaterial(0.12)));
  group.add(banner);
  return group;
}
