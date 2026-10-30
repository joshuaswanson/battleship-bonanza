import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createWater, waveHeight } from './water.js';
import { ellipseHit, courseBuoys } from './terrain.js';
import { toon, outlineMaterial, mulberry32 } from './toon.js';
import { createWaterfalls } from './waterfall.js';
import { leafBush, fern, leafCanopy } from './foliage.js';
import { whirlpoolSite, Whirlpool, flumeStream } from './whirlpool.js';
import { OUTER_LIMIT } from './race/shared.js';

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
  jungle: 0x2f8f3a,
  jungleLight: 0x63c24a,
  rockland: 0xffffff,
  caveRock: 0x262b33,
  stalactite: 0x3a414c,
  vineStem: 0x3b6e2a,
  vineLeaf: 0x4cb043,
  vineLeafDark: 0x2f8a37,
  stripeRed: 0xff4141,
  stripeWhite: 0xf6f8ff,
  roof: 0x0e2a47,
};

const IDENTITY = new THREE.Matrix4();

const ROCK_NOISE = /* glsl */ `
  float rockHash(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
  }
  float rockNoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = mix(mix(rockHash(i), rockHash(i + vec3(1, 0, 0)), f.x), mix(rockHash(i + vec3(0, 1, 0)), rockHash(i + vec3(1, 1, 0)), f.x), f.y);
    float b = mix(mix(rockHash(i + vec3(0, 0, 1)), rockHash(i + vec3(1, 0, 1)), f.x), mix(rockHash(i + vec3(0, 1, 1)), rockHash(i + vec3(1, 1, 1)), f.x), f.y);
    return mix(a, b, f.z);
  }
`;

function mossyRock() {
  const material = toon(0xffffff, { vertexColors: true });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader =
      'attribute float aGreen;\nattribute vec3 aMoss;\nvarying float vGreen;\nvarying vec3 vMoss;\nvarying vec3 vRock;\n' +
      shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvGreen = aGreen;\nvMoss = aMoss;\nvRock = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader =
      'varying float vGreen;\nvarying vec3 vMoss;\nvarying vec3 vRock;\n' + ROCK_NOISE +
      shader.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float mottle = rockNoise(vRock * 0.11);
        float fleck = rockNoise(vRock * 0.42 + 7.0);
        diffuseColor.rgb *= 0.88 + 0.16 * mottle + 0.07 * fleck;
        float seam = abs(fract((vRock.y + mottle * 3.5) * 0.16) - 0.5);
        diffuseColor.rgb *= 1.0 - (1.0 - smoothstep(0.0, 0.035, seam)) * 0.2;
        float edge = max(fwidth(vGreen), 1e-4);
        float covered = smoothstep(0.5 - edge, 0.5 + edge, vGreen);
        diffuseColor.rgb = mix(diffuseColor.rgb, vMoss, covered);`,
      );
  };
  return material;
}

const INSTANCE_MIN = 12;
const weldedCache = new WeakMap();
function welded(geometry, weld) {
  if (geometry.hasAttribute('normal') && (geometry.index || !weld)) return geometry;
  let g = weldedCache.get(geometry);
  if (g) return g;
  g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  if (!g.hasAttribute('normal')) g.computeVertexNormals();
  if (weld) {
    if (g.hasAttribute('uv')) g.deleteAttribute('uv');
    g = mergeVertices(g);
  }
  weldedCache.set(geometry, g);
  return g;
}
const TINT_ATTRIBUTES = ['position', 'normal', 'color'];
const CHOP_ATTRIBUTES = ['position', 'normal', 'color', 'aChop'];
const normalMatrix = new THREE.Matrix3();
const placed = new THREE.Vector3();
const flat = (attribute, size) => attribute.itemSize === size && !attribute.isInterleavedBufferAttribute && !attribute.normalized && attribute.array instanceof Float32Array;
function transformPoints(src, n, e, out, o) {
  for (let k = 0; k < n * 3; k += 3, o += 3) {
    const x = src[k];
    const y = src[k + 1];
    const z = src[k + 2];
    const w = 1 / (e[3] * x + e[7] * y + e[11] * z + e[15]);
    out[o] = (e[0] * x + e[4] * y + e[8] * z + e[12]) * w;
    out[o + 1] = (e[1] * x + e[5] * y + e[9] * z + e[13]) * w;
    out[o + 2] = (e[2] * x + e[6] * y + e[10] * z + e[14]) * w;
  }
}
function transformNormals(src, n, m, out, o) {
  for (let k = 0; k < n * 3; k += 3, o += 3) {
    const x = m[0] * src[k] + m[3] * src[k + 1] + m[6] * src[k + 2];
    const y = m[1] * src[k] + m[4] * src[k + 1] + m[7] * src[k + 2];
    const z = m[2] * src[k] + m[5] * src[k + 1] + m[8] * src[k + 2];
    const len = Math.sqrt(x * x + y * y + z * z) || 1;
    out[o] = x / len;
    out[o + 1] = y / len;
    out[o + 2] = z / len;
  }
}
function mergePlaced(items, names) {
  let verts = 0;
  let count = 0;
  for (const { g } of items) {
    verts += g.attributes.position.count;
    count += g.index ? g.index.count : g.attributes.position.count;
  }
  const geometry = new THREE.BufferGeometry();
  for (const name of names) {
    const size = name === 'aChop' ? 2 : items[0].g.attributes[name]?.itemSize ?? 3;
    geometry.setAttribute(name, new THREE.BufferAttribute(new Float32Array(verts * size), size));
  }
  const index = new (verts > 65535 ? Uint32Array : Uint16Array)(count);
  let v = 0;
  let c = 0;
  for (const { g, matrix, tint, chop } of items) {
    const n = g.attributes.position.count;
    normalMatrix.getNormalMatrix(matrix);
    for (const name of names) {
      const { array, itemSize } = geometry.attributes[name];
      const from = g.attributes[name];
      let o = v * itemSize;
      if (name === 'position' && flat(from, 3)) {
        transformPoints(from.array, n, matrix.elements, array, o);
      } else if (name === 'normal' && flat(from, 3)) {
        transformNormals(from.array, n, normalMatrix.elements, array, o);
      } else if (name === 'position' || name === 'normal') {
        for (let k = 0; k < n; k++, o += 3) {
          placed.fromBufferAttribute(from, k);
          if (name === 'position') placed.applyMatrix4(matrix);
          else placed.applyMatrix3(normalMatrix).normalize();
          array[o] = placed.x;
          array[o + 1] = placed.y;
          array[o + 2] = placed.z;
        }
      } else if (name === 'aChop' || (name === 'color' && tint)) {
        const fill = name === 'aChop' ? chop : tint;
        for (let k = 0; k < n; k++, o += itemSize) for (let j = 0; j < itemSize; j++) array[o + j] = fill[j];
      } else if (flat(from, itemSize)) {
        array.set(from.array.subarray(0, n * itemSize), o);
      } else {
        for (let k = 0; k < n; k++, o += itemSize) for (let j = 0; j < itemSize; j++) array[o + j] = from.getComponent(k, j);
      }
    }
    if (g.index) {
      const src = g.index.array;
      for (let k = 0; k < src.length; k++) index[c + k] = src[k] + v;
      c += src.length;
    } else {
      for (let k = 0; k < n; k++) index[c + k] = v + k;
      c += n;
    }
    v += n;
  }
  geometry.setIndex(new THREE.BufferAttribute(index, 1));
  return geometry;
}
function releaseArray() {
  if (import.meta.env.DEV && window.__bb?.keepArrays) return;
  this.array = null;
}

export class Batcher {
  constructor() {
    this.groups = new Map();
  }
  add(key, geometry, matrix = IDENTITY, tag = null) {
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
    this.groups.get(key).push({ geometry, matrix: matrix === IDENTITY ? IDENTITY : matrix.clone(), x, z, r, tag });
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
    const merged = { lined: [], plain: [], mossy: [], chop: [] };
    const tint = new THREE.Color();
    const rgb = (key) => tint.set(colors[key]).toArray();
    for (const [geometry, all] of shapes) {
      const tagged = this.chopper ? all.filter((e) => e.tag) : [];
      const list = tagged.length ? all.filter((e) => !e.tag) : all;
      const source = welded(geometry, all.length > 1);
      const painted = geometry.hasAttribute('color');
      for (const e of tagged) {
        merged.chop.push({ g: source, matrix: e.matrix, tint: painted ? null : rgb(e.key), chop: [e.tag.id, e.tag.trunk ? 1 : 0] });
      }
      if (!list.length) continue;
      const mossy = geometry.hasAttribute('aGreen');
      if (list.length < INSTANCE_MIN || painted || mossy) {
        for (const e of list) {
          const item = { g: source, matrix: e.matrix, tint: painted || mossy ? null : rgb(e.key) };
          (mossy ? merged.mossy : NO_OUTLINE.has(e.key) ? merged.plain : merged.lined).push(item);
        }
        continue;
      }
      const mesh = new THREE.InstancedMesh(source, WHITE_TOON(), list.length);
      list.forEach((e, k) => {
        mesh.setMatrixAt(k, e.matrix);
        mesh.setColorAt(k, tint.set(colors[e.key]));
      });
      mesh.computeBoundingSphere();
      parent.add(mesh);
      if (outline) {
        const line = new THREE.InstancedMesh(source, outlineMaterial(outline), list.length);
        line.instanceMatrix = mesh.instanceMatrix;
        line.boundingSphere = mesh.boundingSphere;
        line.userData.outline = true;
        parent.add(line);
      }
    }
    for (const [kind, list] of Object.entries(merged)) {
      if (!list.length) continue;
      const names = kind === 'mossy' ? Object.keys(list[0].g.attributes).filter((n) => n !== 'uv') : kind === 'chop' ? CHOP_ATTRIBUTES : TINT_ATTRIBUTES;
      const geometry = mergePlaced(list, names);
      geometry.computeBoundingSphere();
      for (const attribute of [...Object.values(geometry.attributes), geometry.index]) attribute.onUpload(releaseArray);
      if (kind === 'chop') {
        parent.add(new THREE.Mesh(geometry, this.chopper.material()));
        if (outline) parent.add(outlineMesh(geometry, this.chopper.outline(outline)));
        continue;
      }
      parent.add(new THREE.Mesh(geometry, kind === 'mossy' ? mossyRock() : VERTEX_TOON()));
      if (outline && kind !== 'plain') parent.add(outlineMesh(geometry, outlineMaterial(outline)));
    }
  }
}

const NO_OUTLINE = new Set(['foam', 'willowCore', 'puntHull', 'caveRock', 'vineStem', 'reed', 'reedDark', 'reedStem']);
let whiteToon = null;
const WHITE_TOON = () => (whiteToon ??= toon(0xffffff));
let vertexToon = null;
const VERTEX_TOON = () => (vertexToon ??= toon(0xffffff, { vertexColors: true }));

const CHUNK = 220;

export const buildBudget = { ms: 6 };

export function slicer() {
  let start = performance.now();
  return async () => {
    if (performance.now() - start < buildBudget.ms) return;
    await new Promise((r) => setTimeout(r, 0));
    start = performance.now();
  };
}

function outlineMesh(geometry, material) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData.outline = true;
  return mesh;
}

const OUTLINE_FAR = 250;

export function cullChunks(chunks, camera, far) {
  const { x, z } = camera.position;
  for (const c of chunks) {
    if (c.group.matrixWorldAutoUpdate) {
      c.group.updateWorldMatrix(true, true);
      c.group.matrixWorldAutoUpdate = false;
      c.lines = c.group.children.filter((o) => o.userData.outline);
    }
    const gap = Math.hypot(c.x - x, c.z - z) - c.radius;
    c.group.visible = gap < far;
    for (const line of c.lines) line.visible = gap < OUTLINE_FAR;
  }
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
  batch.add('crown', LOW_SPHERE, mat(top.x, top.y + 0.1, top.z, radius * 1.3, radius * 1.1, radius * 1.3));
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
        leafBush(batch, px, spot.y - 0.2, pz, rand, sz * 0.75);
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
      for (let k = 0; k < 3; k++) leafBush(batch, px + (k - 1) * s * 0.7, y - 0.1, pz + (rand() - 0.5) * s, rand, s * (0.7 + rand() * 0.3));
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

const ROCK_DARK = new THREE.Color(0x7b7873);
const ROCK_MID = new THREE.Color(0xaba59b);
const ROCK_LIGHT = new THREE.Color(0xdcd5c6);
const ROCK_WARM = new THREE.Color(0xc8b89c);
const ROCK_WET = new THREE.Color(0x47504b);
const ROCK_CRACK = new THREE.Color(0x56534e);

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
    const warp = Math.sin(x * 0.045 + z * 0.03) * 2.2 + Math.sin(z * 0.06 - x * 0.02) * 1.6;
    const layer = Math.sin((y + warp) * 0.42);
    const grain = Math.sin(x * 0.23 + y * 0.11) * Math.sin(z * 0.19 - y * 0.07);
    color.copy(ROCK_MID);
    if (layer > 0.35) color.lerp(ROCK_LIGHT, (layer - 0.35) * 1.2);
    else if (layer < -0.45) color.lerp(ROCK_DARK, (-layer - 0.45) * 1.4);
    color.lerp(ROCK_WARM, Math.max(0, Math.sin((y + warp) * 0.11 + 1.3)) * 0.35);
    color.multiplyScalar(0.95 + grain * 0.07);
    if (Math.abs(Math.sin((y + warp) * 0.21)) < 0.05) color.lerp(ROCK_CRACK, 0.6);
    if (y < 1.6) color.lerp(ROCK_WET, 1 - THREE.MathUtils.smoothstep(y, -1, 1.6));
    colors.push(color.r, color.g, color.b);
    const ny = nor.getY(i);
    const drape = 0.5 + 0.5 * Math.sin(Math.atan2(z, x) * 5 + x);
    const hang = THREE.MathUtils.smoothstep(y, top - 5 - 16 * drape * drape, top - 0.5) * drape * 0.85;
    greens.push(Math.max(THREE.MathUtils.smoothstep(ny, 0.55, 0.75) * THREE.MathUtils.smoothstep(y, 2.5, 4), hang));
    const tone = grain > 0.1 ? GRASS_EDGE : GRASS_TONE;
    moss.push(tone.r, tone.g, tone.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.setAttribute('aGreen', new THREE.Float32BufferAttribute(greens, 1));
  g.setAttribute('aMoss', new THREE.Float32BufferAttribute(moss, 3));
  return g;
}

function pillarGeometry(radius, height, rand) {
  const sides = 6 + Math.floor(rand() * 4);
  const stretch = 0.8 + rand() * 0.4;
  const turn = rand() * Math.PI;
  const angles = Array.from({ length: sides }, (_, k) => ((k + (rand() - 0.5) * 0.55) / sides) * Math.PI * 2);
  const radial = angles.map(() => 0.84 + rand() * 0.32);
  const tiered = rand() < 0.65;
  const ledge = 0.32 + rand() * 0.26;
  const shrink = 0.7 + rand() * 0.14;
  const taper = 0.8 + rand() * 0.1;
  const rows = tiered
    ? [[0, 1.14], [0.1, 1.06], [ledge * 0.55, 1.0], [ledge, 0.96], [ledge + 0.012, shrink], [ledge + (1 - ledge) * 0.55, shrink * 0.97], [1, shrink * 0.9]]
    : [[0, 1.14], [0.1, 1.06], [0.42, 0.98], [0.74, 0.92], [1, taper]];
  const span = height;
  const ring = rows.map(([t, r]) =>
    angles.map((a0, k) => {
      const a = a0 + (rand() - 0.5) * 0.08;
      const rr = radius * r * radial[k] * (1 + (rand() - 0.5) * 0.07);
      const lx = Math.cos(a) * rr * stretch;
      const lz = (Math.sin(a) * rr) / stretch;
      return [lx * Math.cos(turn) - lz * Math.sin(turn), t * span - 2, lx * Math.sin(turn) + lz * Math.cos(turn)];
    }),
  );
  const top = height - 2;
  const positions = [];
  const tri = (p, q, r) => positions.push(...p, ...q, ...r);
  for (let r = 0; r < rows.length - 1; r++) {
    for (let k = 0; k < sides; k++) {
      const a = ring[r][k];
      const b = ring[r][(k + 1) % sides];
      const c = ring[r + 1][(k + 1) % sides];
      const d = ring[r + 1][k];
      tri(a, c, b);
      tri(a, d, c);
    }
  }
  const cap = ring.at(-1);
  const center = [cap.reduce((sum, v) => sum + v[0], 0) / sides, top + 0.3, cap.reduce((sum, v) => sum + v[2], 0) / sides];
  for (let k = 0; k < sides; k++) tri(center, cap[(k + 1) % sides], cap[k]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const capRadius = radius * (tiered ? shrink * 0.9 : taper) * Math.min(...radial);
  return {
    geometry: paintPillar(g, top),
    top: new THREE.Vector3(center[0], top + 0.3, center[2]),
    topRadius: capRadius * 0.95,
    footprint: radius * 1.14 * Math.max(...radial) * Math.max(stretch, 1 / stretch),
    ledge: tiered ? { y: ledge * span - 2, inner: radius * shrink, outer: radius * 0.96 * Math.min(...radial) } : null,
  };
}

const CANOPY = ['moss', 'mossDark', 'jungle', 'jungleLight'];

function canopyTree(batch, x, y, z, rand, size) {
  const h = size * (1.1 + rand() * 0.5);
  batch.add('coconut', CYLINDER, mat(x, y + h * 0.4, z, size * 0.12, h * 0.8, size * 0.12));
  leafCanopy(batch, x, y + h * 0.75, z, rand, size);
}

function plantTop(batch, x, y, z, radius, rand, density = 1) {
  const area = Math.min(2.4, radius / 7);
  const palms = Math.max(1, Math.round((1 + rand() * 3) * density * area));
  for (let i = 0; i < palms; i++) {
    const a = rand() * Math.PI * 2;
    const d = radius * Math.sqrt(rand()) * 0.75;
    addPalm(batch, x + Math.cos(a) * d, y - 0.3, z + Math.sin(a) * d, rand, { height: 6 + rand() * 6, lean: 0.1 + rand() * 0.4, dir: a });
  }
  const trees = Math.round((2 + rand() * 4) * density * area * area);
  for (let i = 0; i < trees; i++) {
    const a = rand() * Math.PI * 2;
    const d = radius * Math.sqrt(rand()) * 0.8;
    canopyTree(batch, x + Math.cos(a) * d, y - 0.3, z + Math.sin(a) * d, rand, 2.6 + rand() * 2.4);
  }
  const rim = Math.round((2 + rand() * 3) * density * area);
  for (let i = 0; i < rim; i++) {
    const a = (i / rim) * Math.PI * 2 + rand() * 0.4;
    const d = radius * (0.85 + rand() * 0.2);
    const sz = 1.4 + rand() * 1.8;
    fern(batch, x + Math.cos(a) * d, y - 0.3, z + Math.sin(a) * d, rand, sz * 0.5, { yaw: Math.atan2(Math.cos(a), Math.sin(a)), spread: 1.8, droop: 1 });
  }
}

function addPillar(batch, x, z, rand, { radius, height, plants = 1 }) {
  const pillar = pillarGeometry(radius, height, rand);
  batch.add('rockland', pillar.geometry, mat(x, 0, z));
  batch.add('foam', RING, mat(x, 0.2, z, pillar.footprint * 1.05, 6, pillar.footprint * 1.05));
  const top = pillar.top.clone().add(new THREE.Vector3(x, 0, z));
  if (plants) plantTop(batch, top.x, top.y, top.z, pillar.topRadius, rand, plants);
  if (plants && pillar.ledge) {
    const { y, inner, outer } = pillar.ledge;
    for (let k = 0; k < 3; k++) {
      const a = rand() * Math.PI * 2;
      const d = (inner + outer) / 2;
      const sz = 1.3 + rand() * 1.4;
      fern(batch, x + Math.cos(a) * d, y - 0.1, z + Math.sin(a) * d, rand, sz * 0.5, { yaw: Math.atan2(Math.cos(a), Math.sin(a)), spread: 2.4, droop: 0.9 });
    }
  }
  const rubble = 5 + Math.floor(rand() * 6);
  for (let k = 0; k < rubble; k++) {
    const a = rand() * Math.PI * 2;
    const d = pillar.footprint * (0.88 + rand() * 0.16);
    const sz = 1.4 + rand() * 2.6;
    batch.add('rock', ROCK, mat(x + Math.cos(a) * d, 0.2 + rand() * 0.6, z + Math.sin(a) * d, sz, sz * (0.6 + rand() * 0.4), sz, rand(), rand() * 6, rand()));
  }
  return { blob: { x, z, rx: pillar.footprint, rz: pillar.footprint, rot: 0 }, top, topRadius: pillar.topRadius, footprint: pillar.footprint };
}

function waterfallSpec(batch, pillar, x, z, toward, rand) {
  const dx = Math.cos(toward);
  const dz = Math.sin(toward);
  const top = new THREE.Vector3(pillar.top.x + dx * pillar.topRadius * 0.92, pillar.top.y - 0.4, pillar.top.z + dz * pillar.topRadius * 0.92);
  const foot = new THREE.Vector3(x + dx * pillar.footprint * 1.12, 0.2, z + dz * pillar.footprint * 1.12);
  const width = 3.2 + rand() * 1.6;
  batch.add('foam', RING, mat(foot.x + dx * 3, 0.25, foot.z + dz * 3, width * 1.6, 6, width * 1.6));
  return { top, foot, dx, dz, width };
}

function createCumulus(rand) {
  const parts = [];
  const w = 40 + rand() * 50;
  for (let i = 0; i < 7; i++) {
    const u = i / 6 - 0.5;
    const s = 10 + rand() * 6;
    parts.push(SPHERE.clone().applyMatrix4(mat(u * w, rand() * 3, (rand() - 0.5) * 12, s * 1.4, s * 0.55, s)));
  }
  for (let i = 0; i < 5; i++) {
    const u = (i / 4 - 0.5) * 0.7;
    const s = 11 + rand() * 8;
    parts.push(SPHERE.clone().applyMatrix4(mat(u * w, 7 + rand() * 6, (rand() - 0.5) * 10, s, s * 0.85, s)));
  }
  for (let i = 0; i < 3; i++) {
    const s = 9 + rand() * 7;
    parts.push(SPHERE.clone().applyMatrix4(mat((rand() - 0.5) * w * 0.35, 17 + rand() * 7, (rand() - 0.5) * 8, s, s * 0.9, s)));
  }
  const cloud = new THREE.Mesh(mergeGeometries(parts), toon(0xffffff, { emissive: 0x9bd9ff, emissiveIntensity: 0.22, fog: false }));
  cloud.scale.setScalar(1.8 + rand() * 1.4);
  return cloud;
}

function addCumulus(scene, rand, count) {
  const clouds = [];
  for (let i = 0; i < count; i++) {
    const cloud = createCumulus(rand);
    const a = rand() * Math.PI * 2;
    const d = 520 + rand() * 520;
    cloud.position.set(Math.cos(a) * d, 90 + rand() * 120, Math.sin(a) * d);
    cloud.rotation.y = rand() * Math.PI;
    cloud.userData.speed = 2 + rand() * 3;
    clouds.push(cloud);
    scene.add(cloud);
  }
  return clouds;
}

const BOX_GEOMETRY = new THREE.BoxGeometry(1, 1, 1);

function createGull() {
  const group = new THREE.Group();
  const white = toon(0xffffff);
  const grey = toon(0xb9c3cc);
  const dark = toon(0x2f3640);
  const body = new THREE.Mesh(SPHERE, white);
  body.scale.set(0.35, 0.3, 0.9);
  const head = new THREE.Mesh(SPHERE, white);
  head.scale.setScalar(0.26);
  head.position.set(0, 0.12, 0.75);
  const beak = new THREE.Mesh(CONE, toon(0xffb02e));
  beak.scale.set(0.08, 0.3, 0.08);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.08, 1.1);
  group.add(body, head, beak);
  const wings = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.25, 0.1, 0.05);
    const inner = new THREE.Mesh(BOX_GEOMETRY, grey);
    inner.scale.set(1.1, 0.06, 0.55);
    inner.position.x = side * 0.55;
    const outer = new THREE.Mesh(BOX_GEOMETRY, white);
    outer.scale.set(1.0, 0.05, 0.4);
    outer.position.set(side * 1.55, 0, -0.05);
    const tip = new THREE.Mesh(BOX_GEOMETRY, dark);
    tip.scale.set(0.35, 0.055, 0.32);
    tip.position.set(side * 2.2, 0, -0.08);
    pivot.add(inner, outer, tip);
    group.add(pivot);
    wings.push(pivot);
  }
  group.userData.wings = wings;
  group.scale.setScalar(1.3);
  return group;
}

function addGulls(scene, rand, count) {
  const gulls = [];
  for (let i = 0; i < count; i++) {
    const gull = createGull();
    gull.userData.orbit = { x: (rand() - 0.5) * 600, z: (rand() - 0.5) * 500, r: 25 + rand() * 50, y: 28 + rand() * 30, speed: (0.25 + rand() * 0.2) * (rand() < 0.5 ? -1 : 1), phase: rand() * Math.PI * 2 };
    gulls.push(gull);
    scene.add(gull);
  }
  return gulls;
}

function flyGulls(gulls, t) {
  for (const gull of gulls) {
    const o = gull.userData.orbit;
    const a = o.phase + t * o.speed;
    gull.position.set(o.x + Math.cos(a) * o.r, o.y + Math.sin(t * 0.7 + o.phase) * 3, o.z + Math.sin(a) * o.r);
    gull.rotation.set(0, Math.atan2(-Math.sin(a) * Math.sign(o.speed), Math.cos(a) * Math.sign(o.speed)), -0.25 * Math.sign(o.speed));
    const flap = Math.sin(t * 0.9 + o.phase) > 0.3 ? Math.sin(t * 9 + o.phase) * 0.55 : 0.08;
    gull.userData.wings[0].rotation.z = -flap;
    gull.userData.wings[1].rotation.z = flap;
  }
}

function addFarIslands(batch, rand) {
  for (let k = 0; k < 18; k++) {
    const a = (k / 18) * Math.PI * 2 + rand() * 0.2;
    const d = 700 + rand() * 180;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d - 60;
    if (z > mainlandEdge(x) - 60) continue;
    addPillar(batch, x, z, rand, { radius: 22 + rand() * 22, height: 30 + rand() * 50, plants: 0.6 });
  }
}

function archGeometry(span, height, thick, rand) {
  const tilt = (rand() - 0.5) * 8;
  const sag = 2 + rand() * 4;
  const pts = [
    new THREE.Vector3(-span * 1.08, height - tilt + 2, (rand() - 0.5) * 4),
    new THREE.Vector3(-span * 0.55, height - tilt * 0.5 - sag * 0.5 + (rand() - 0.5) * 3, (rand() - 0.5) * 5),
    new THREE.Vector3(0, height - sag + (rand() - 0.5) * 2, (rand() - 0.5) * 6),
    new THREE.Vector3(span * 0.55, height + tilt * 0.5 - sag * 0.5 + (rand() - 0.5) * 3, (rand() - 0.5) * 5),
    new THREE.Vector3(span * 1.08, height + tilt + 2, (rand() - 0.5) * 4),
  ];
  const curve = new THREE.CatmullRomCurve3(pts);
  const segments = 60;
  const radial = 12;
  const tube = new THREE.TubeGeometry(curve, segments, 1, radial, false);
  const pos = tube.attributes.position;
  const lumps = Array.from({ length: 5 }, () => ({ f: 3 + rand() * 9, k: 1 + Math.floor(rand() * 4), p: rand() * 6, a: 0.08 + rand() * 0.14 }));
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const c = curve.getPointAt(t);
    const along = Math.abs(t - 0.5) * 2;
    const r = thick * (0.85 + 0.5 * along ** 2 + 0.25 * Math.sin(t * 9 + lumps[0].p));
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j;
      const a = (j / radial) * Math.PI * 2;
      let bump = 1;
      for (const l of lumps) bump += Math.sin(t * l.f + a * l.k + l.p) * l.a;
      const dx = pos.getX(k) - c.x;
      const dy = pos.getY(k) - c.y;
      const dz = pos.getZ(k) - c.z;
      const flat = dy > 0 ? 0.55 : 1.15;
      pos.setXYZ(k, c.x + dx * r * bump, c.y + dy * r * bump * flat, c.z + dz * r * bump * 1.6);
    }
  }
  const g = mergeVertices(tube.deleteAttribute('normal').deleteAttribute('uv'));
  return paintPillar(g, height + thick);
}

function addArch(batch, track, fraction, rand) {
  const idx = track.wrap(Math.round(fraction * track.N));
  const p = track.point(idx, 0);
  return addArchAt(batch, p.x, p.z, track.heading(idx), track.halfWidth + 11, rand);
}

function addArchAt(batch, x0, z0, heading, span, rand) {
  const height = 26 + rand() * 6;
  const thick = 5 + rand() * 1.5;
  const p = { x: x0, z: z0 };
  const slab = archGeometry(span, height, thick, rand).applyMatrix4(mat(p.x, 0, p.z, 1, 1, 1, 0, heading, 0));
  batch.add('rockland', slab);
  const nx = Math.cos(heading);
  const nz = -Math.sin(heading);
  const tx = Math.sin(heading);
  const tz = Math.cos(heading);
  const probe = new THREE.Mesh(slab, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  const ray = new THREE.Raycaster();
  for (let k = -3; k <= 3; k++) {
    const lat = (k / 3) * span * 0.75;
    for (const off of [-1.5, 1.5]) {
      const x = p.x + nx * lat + tx * off;
      const z = p.z + nz * lat + tz * off;
      ray.set(new THREE.Vector3(x, height + 40, z), new THREE.Vector3(0, -1, 0));
      const hit = ray.intersectObject(probe)[0];
      if (hit && hit.face.normal.y > 0.4) plantTop(batch, x, hit.point.y, z, 1.4, rand, 0.25);
    }
  }
  const blobs = [];
  for (const side of [-1, 1]) {
    const lx = p.x + nx * side * (span + 2);
    const lz = p.z + nz * side * (span + 2);
    const anchor = addPillar(batch, lx, lz, rand, { radius: 8 + rand() * 4, height: height + 8 + rand() * 22 });
    blobs.push(anchor.blob);
  }
  return blobs;
}

const mainlandEdge = (x) => 485 + 45 * Math.sin(x * 0.005 + 0.7) + 22 * Math.sin(x * 0.013 + 2) + 8 * Math.sin(x * 0.05);
const mainlandHeight = (x) => 74 + 16 * Math.sin(x * 0.009) + 9 * Math.sin(x * 0.031 + 1);
const STRATA = 5;
const FACE_KNOTS = [0.4, ...Array.from({ length: STRATA }, (_, j) => [0.4 + j * 3.2 + 0.3, 0.4 + j * 3.2 + 0.6, 0.4 + j * 3.2 + 0.9, 0.4 + (j + 1) * 3.2]).flat()];
const FACE_DEPTH = FACE_KNOTS[FACE_KNOTS.length - 1];
const MAINLAND_ROWS = [-14, -5, -1.5, ...FACE_KNOTS, 24, 32, 60, 120, 240, 520];
const CARVED_ROWS = [-14, -5, -1.5, ...FACE_KNOTS, ...Array.from({ length: 116 }, (_, k) => 20 + k * 4), 520];
const CARVE_FLOOR = -8;
const CRATER_FLOOR = -80;
const CRATER_WALL = 12;
const CAVE_WALL = 8;

const mainlandRise = (x, d) => mainlandHeight(x) + Math.min(1, d / 40) * (6 * Math.sin(x * 0.02 + d * 0.03) + 5 * Math.sin(d * 0.05 - x * 0.011));
const faceSway = (x, y) => Math.sin(y * 0.22 + x * 0.09) * 2.6 + Math.sin(y * 0.07 + x * 0.21) * 1.8;

function faceHeights(x) {
  const top = mainlandRise(x, FACE_DEPTH);
  const ys = [-4];
  for (let j = 0; j < STRATA; j++) {
    const lip = j === STRATA - 1 ? top - 1 : -4 + (top + 4) * ((j + 1) / STRATA + 0.05 * Math.sin(x * 0.031 + j * 1.7));
    const from = ys[ys.length - 1];
    ys.push(from + (lip - from) / 3, from + ((lip - from) * 2) / 3, lip, j === STRATA - 1 ? top : lip + 1.1);
  }
  return ys;
}

function faceRise(x, d) {
  const ys = faceHeights(x);
  for (let k = 1; k < FACE_KNOTS.length; k++) {
    if (d <= FACE_KNOTS[k]) return ys[k - 1] + ((ys[k] - ys[k - 1]) * (d - FACE_KNOTS[k - 1])) / (FACE_KNOTS[k] - FACE_KNOTS[k - 1]);
  }
  return ys[ys.length - 1];
}

function cliffFace(x, y) {
  let lo = 0.4;
  let hi = FACE_DEPTH;
  for (let k = 0; k < 24; k++) {
    const mid = (lo + hi) / 2;
    if (faceRise(x, mid) < y) lo = mid;
    else hi = mid;
  }
  return mainlandEdge(x) + lo + faceSway(x, y);
}

function mainlandGround(x, z) {
  const d = z - mainlandEdge(x);
  if (d < 0.4) return -4;
  return d < FACE_DEPTH ? faceRise(x, d) : mainlandRise(x, d);
}

const clifftop = (x, z) => mainlandRise(x, Math.max(FACE_DEPTH, z - mainlandEdge(x)));

function carveHeight(site, x, z) {
  if (!site) return Infinity;
  let h = Infinity;
  const a = Math.atan2(z - site.center.z, x - site.center.x);
  const r = Math.hypot(x - site.center.x, z - site.center.z) - (site.radius + 2) + Math.sin(a * 9) * 1.2 + Math.sin(a * 23 + 1) * 0.7;
  if (r < CRATER_WALL + 2) h = r < 0 ? CRATER_FLOOR : CARVE_FLOOR + (r / CRATER_WALL) * 90;
  const d = site.caveDistance(x, z);
  if (d < CAVE_WALL + 2) h = Math.min(h, CARVE_FLOOR + (Math.max(0, d) / CAVE_WALL) * 90);
  return h;
}

function inCave(site, x, z) {
  let best = Infinity;
  let roofed = false;
  for (const p of site.cave) {
    const d = Math.hypot(p.x - x, p.z - z) - p.half;
    if (d < best) {
      best = d;
      roofed = p.roofed;
    }
  }
  return roofed && best < CAVE_WALL + 1;
}

function nearHole(site, positions, a, b) {
  const { hole } = site;
  const x = (positions[a * 3] + positions[b * 3 + 3]) / 2;
  const y = (positions[a * 3 + 1] + positions[b * 3 + 4]) / 2;
  const z = (positions[a * 3 + 2] + positions[b * 3 + 5]) / 2;
  return Math.abs(x - hole.x) < 10 && Math.abs(y - hole.y) < 10 && Math.abs(z - hole.z) < 9;
}

function addBlowholeCollar(batch, site) {
  const { hole, flume } = site;
  const sides = 28;
  const inner = flume.radius + 0.4;
  const rim = [];
  for (let j = 0; j <= sides; j++) {
    const a = (j / sides) * Math.PI * 2;
    const outer = 17 + 2.2 * Math.sin(a * 5 + 1) + 1.4 * Math.sin(a * 11);
    rim.push([a, outer]);
  }
  const place = (lx, ly, lz) => [hole.x + lx * Math.cos(hole.heading) + lz * hole.dx, hole.y + ly, hole.z - lx * Math.sin(hole.heading) + lz * hole.dz];
  const tris = [];
  for (let j = 0; j < sides; j++) {
    const [a0, o0] = rim[j];
    const [a1, o1] = rim[j + 1];
    const v = (a, r, lz) => place(Math.cos(a) * r, Math.sin(a) * r, lz);
    const i0 = v(a0, inner, 1.2);
    const i1 = v(a1, inner, 1.2);
    const m0 = v(a0, (inner + o0) / 2, 1.6);
    const m1 = v(a1, (inner + o1) / 2, 1.6);
    const e0 = v(a0, o0, -2.5);
    const e1 = v(a1, o1, -2.5);
    tris.push(...i0, ...m0, ...i1, ...i1, ...m0, ...m1, ...m0, ...e0, ...m1, ...m1, ...e0, ...e1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(twoSided(tris), 3));
  batch.add('rockland', paintPillar(g, 1e9));
}

function addMainland(batch, rand, site = null) {
  const xs = [];
  for (let x = -1300; x <= 1300; x += site && x >= -140 && x < 220 ? 3 : 8) xs.push(x);
  const rowsAt = site ? CARVED_ROWS : MAINLAND_ROWS;
  const positions = [];
  for (const x of xs) {
    const edge = mainlandEdge(x);
    for (const d of rowsAt) {
      let y;
      let z = edge + d;
      let px = x;
      if (d < 0) y = -4;
      else if (d <= FACE_DEPTH) {
        y = faceRise(x, d);
        z += faceSway(x, y);
        px += Math.sin(y * 0.15 + x * 0.3) * 1.2;
      } else {
        y = mainlandRise(x, d);
      }
      positions.push(px, Math.min(y, carveHeight(site, px, z)), z);
    }
  }
  const rows = rowsAt.length;
  const indices = [];
  for (let c = 0; c < xs.length - 1; c++) {
    for (let r = 0; r < rows - 1; r++) {
      const a = c * rows + r;
      const b = (c + 1) * rows + r;
      if (site && nearHole(site, positions, a, b)) continue;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  const land = paintPillar(g.toNonIndexed(), 1e9);
  const nor = land.attributes.normal;
  const green = land.attributes.aGreen;
  for (let i = 0; i < green.count; i++) green.setX(i, THREE.MathUtils.smoothstep(nor.getY(i), 0.55, 0.75));
  if (site) {
    const pos = land.attributes.position;
    const color = land.attributes.color;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      if (!inCave(site, x, z)) continue;
      const shade = 1 - 0.65 * THREE.MathUtils.smoothstep(z - mainlandEdge(x), 4, 30);
      color.setXYZ(i, color.getX(i) * shade, color.getY(i) * shade, color.getZ(i) * shade);
      green.setX(i, green.getX(i) * shade);
    }
  }
  batch.add('rockland', land);
  for (let x = -1300; x <= 1300; x += 9 + rand() * 9) {
    const edge = mainlandEdge(x);
    const top = mainlandHeight(x);
    for (let k = 0; k < 3; k++) {
      const d = 8 + rand() * 70;
      const px = x + (rand() - 0.5) * 8;
      const pz = edge + d;
      const y = top + Math.min(1, d / 40) * (6 * Math.sin(px * 0.02 + d * 0.03) + 5 * Math.sin(d * 0.05 - px * 0.011));
      const palm = rand() < 0.35;
      const height = palm ? 8 + rand() * 7 : 0;
      const lean = palm ? rand() * 0.4 : 0;
      const dir = palm ? rand() * Math.PI * 2 : 0;
      const sz = palm ? 0 : 3 + rand() * 4;
      const key = palm ? null : rand() < 0.5 ? 'moss' : 'mossDark';
      if (carveHeight(site, px, pz) < y + 3) continue;
      if (palm) addPalm(batch, px, y - 0.4, pz, rand, { height, lean, dir });
      else if (key) leafBush(batch, px, y - 0.3, pz, rand, sz * 0.6);
    }
  }
}

function addCaveRoof(batch, site) {
  const top = [];
  const under = [];
  const pts = site.cave.filter((p) => p.roofed && p.z > mainlandEdge(p.x) + FACE_DEPTH + 2);
  for (let k = 0; k < pts.length - 2; k += 2) {
    const a = pts[k];
    const b = pts[Math.min(pts.length - 1, k + 2)];
    const strip = (p, q) => {
      const dx = q.x - p.x;
      const dz = q.z - p.z;
      const len = Math.hypot(dx, dz) || 1;
      const nx = dz / len;
      const nz = -dx / len;
      const span = p.half + CAVE_WALL + 4;
      return [-1, 1].map((side) => {
        const x = p.x + nx * side * span;
        const z = p.z + nz * side * span;
        return [x, clifftop(x, z) + 0.6, z];
      });
    };
    const [l0, r0] = strip(a, b);
    const [l1, r1] = strip(b, pts[Math.min(pts.length - 1, k + 4)]);
    top.push(...l0, ...l1, ...r0, ...r0, ...l1, ...r1);
    const drop = (v) => [v[0], v[1] - 6, v[2]];
    under.push(...drop(l0), ...drop(r0), ...drop(l1), ...drop(r0), ...drop(r1), ...drop(l1));
  }
  const roof = new THREE.BufferGeometry();
  roof.setAttribute('position', new THREE.Float32BufferAttribute(top, 3));
  const painted = paintPillar(roof, 1e9);
  const green = painted.attributes.aGreen;
  for (let i = 0; i < green.count; i++) green.setX(i, 1);
  batch.add('rockland', painted);
  const ceiling = new THREE.BufferGeometry();
  ceiling.setAttribute('position', new THREE.Float32BufferAttribute(under, 3));
  ceiling.computeVertexNormals();
  batch.add('caveRock', ceiling);
  addCaveArch(batch, site);
}

const ARCH_SPRING = 3;
const ARCH_RISE = 21;
const ARCH_SIDES = 14;

function twoSided(positions) {
  const out = [...positions];
  for (let i = 0; i < positions.length; i += 9) out.push(...positions.slice(i, i + 3), ...positions.slice(i + 6, i + 9), ...positions.slice(i + 3, i + 6));
  return out;
}

function addCaveArch(batch, site) {
  const rand = mulberry32(4242);
  const pts = site.cave.filter((p) => p.roofed && p.z > mainlandEdge(p.x) + 1);
  const frame = (k) => {
    const a = pts[Math.max(0, k - 1)];
    const b = pts[Math.min(pts.length - 1, k + 1)];
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    return { p: pts[k], fx: (b.x - a.x) / len, fz: (b.z - a.z) / len, nx: (b.z - a.z) / len, nz: -(b.x - a.x) / len };
  };
  const ring = (k) => {
    const { p, nx, nz } = frame(k);
    return Array.from({ length: ARCH_SIDES + 1 }, (_, j) => {
      const phi = (j / ARCH_SIDES) * Math.PI;
      const lateral = Math.cos(phi) * (p.half + 1.5) * (1 + 0.06 * Math.sin(k * 0.7 + j * 2.1));
      const lift = Math.sin(phi) * ARCH_RISE * (1 + 0.05 * Math.sin(k * 1.3 + j));
      return [p.x + nx * lateral, ARCH_SPRING + lift, p.z + nz * lateral];
    });
  };
  const vault = [];
  for (let k = 0; k < pts.length - 2; k += 2) {
    const r0 = ring(k);
    const r1 = ring(Math.min(pts.length - 1, k + 2));
    for (let j = 0; j < ARCH_SIDES; j++) vault.push(...r0[j], ...r1[j], ...r0[j + 1], ...r0[j + 1], ...r1[j], ...r1[j + 1]);
  }
  const arch = new THREE.BufferGeometry();
  arch.setAttribute('position', new THREE.Float32BufferAttribute(twoSided(vault), 3));
  arch.computeVertexNormals();
  batch.add('caveRock', arch);
  for (const k of [0, pts.length - 1]) {
    const { p, nx, nz } = frame(k);
    const inner = ring(k);
    const wide = p.half + CAVE_WALL + 5;
    const mouth = k === 0;
    const panel = [];
    for (let j = 0; j < ARCH_SIDES; j++) {
      const phi0 = (j / ARCH_SIDES) * Math.PI;
      const phi1 = ((j + 1) / ARCH_SIDES) * Math.PI;
      const outer = (phi) => {
        const lateral = Math.cos(phi) * wide;
        const x = p.x + nx * lateral;
        const z = p.z + nz * lateral;
        const y = clifftop(x, z) + 1;
        return [x, y, mouth ? Math.max(z, cliffFace(x, y - 2) - 0.6) : z];
      };
      const o0 = outer(phi0);
      const o1 = outer(phi1);
      panel.push(...inner[j], ...o0, ...inner[j + 1], ...inner[j + 1], ...o0, ...o1);
    }
    for (const side of [0, ARCH_SIDES]) {
      const foot = inner[side];
      const lateral = side === 0 ? wide : -wide;
      const x = p.x + nx * lateral;
      const z = p.z + nz * lateral;
      const y = clifftop(x, z) + 1;
      const high = [x, y, mouth ? Math.max(z, cliffFace(x, y - 2) - 0.6) : z];
      const low = [x, CARVE_FLOOR, z];
      const base = [foot[0], CARVE_FLOOR, foot[2]];
      panel.push(...foot, ...high, ...low, ...foot, ...low, ...base);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(twoSided(panel), 3));
    batch.add('rockland', paintPillar(g, 1e9));
    if (!mouth) continue;
    const { fx, fz } = frame(k);
    const lip = new THREE.CatmullRomCurve3(inner.map(([x, y, z]) => new THREE.Vector3(x - fx * 0.6, y + 0.4, z - fz * 0.6)));
    const rim = new THREE.TubeGeometry(lip, 48, LIP_RADIUS, 9, false).toNonIndexed();
    batch.add('rockland', paintPillar(rim, 1e9));
    for (let j = 1; j < ARCH_SIDES; j++) {
      const [x, y, z] = inner[j];
      fern(batch, x - fx * 0.8, y + 0.4 + LIP_RADIUS * 0.8, z - fz * 0.8, rand, 0.7 + rand() * 0.35, { yaw: Math.atan2(-fx, -fz), spread: 2.4, droop: 1.3 });
      if (j < 2 || j > ARCH_SIDES - 2) continue;
      for (let n = 0; n < 2; n++) {
        const along = (rand() - 0.5) * 1.6;
        hangVine(batch, x - fx * 0.9 + fz * along, y + 0.4, z - fz * 0.9 - fx * along, -fx, -fz, 3 + rand() * 7, rand);
      }
    }
  }
}

const LIP_RADIUS = 1.5;

function addCrater(batch, site, rand) {
  const { center, radius } = site;
  const rim = radius + 2 + CRATER_WALL;
  for (let k = 0; k < 46; k++) {
    const a = rand() * Math.PI * 2;
    const r = rim + 3 + rand() * 30;
    const x = center.x + Math.cos(a) * r;
    const z = center.z + Math.sin(a) * r;
    if (site.caveDistance(x, z) < CAVE_WALL + 3) continue;
    const y = mainlandGround(x, z);
    if (rand() < 0.4) addPalm(batch, x, y - 0.4, z, rand, { height: 9 + rand() * 8, lean: 0.2 + rand() * 0.4, dir: a + Math.PI });
    else canopyTree(batch, x, y - 0.3, z, rand, 3 + rand() * 2.5);
  }
  return [2.1, 3.5, 4.8].map((a) => {
    const dx = -Math.cos(a);
    const dz = -Math.sin(a);
    const tx = center.x - dx * (rim - 0.5);
    const tz = center.z - dz * (rim - 0.5);
    return {
      top: new THREE.Vector3(tx, mainlandGround(tx, tz) - 0.4, tz),
      foot: new THREE.Vector3(center.x - dx * (radius - 2), 0.2, center.z - dz * (radius - 2)),
      dx,
      dz,
      width: 4.5 + rand() * 2,
    };
  });
}

function bayWaters(site) {
  const out = { level: 0, amp: 1 };
  return { sample: (x, z) => site.sample(x, z, out) };
}

function courseReach(track, site) {
  const reach = [new Float32Array(track.total), new Float32Array(track.total)];
  for (let i = 0; i < track.total; i++) {
    for (const [k, side] of [[0, -1], [1, 1]]) {
      let lim = track.hw[i] + OUTER_LIMIT;
      if (i >= site.mouthIdx - 30 && i <= site.entryIdx) lim = track.hw[i] - 1.5;
      else if (i < site.holeIdx || i > site.holeIdx + 25) {
        for (let d = 0; d < lim; d += 1.5) {
          const x = track.px[i] + track.nx[i] * side * d;
          const z = track.pz[i] + track.nz[i] * side * d;
          if (z > mainlandEdge(x) - 4) {
            lim = Math.max(0, d - 1);
            break;
          }
        }
      }
      reach[k][i] = lim;
    }
  }
  return reach;
}

const VINE_LEAF = new THREE.SphereGeometry(1, 8, 4).scale(0.45, 0.07, 1).translate(0, 0, 0.9);
const leafTurn = new THREE.Euler(0, 0, 0, 'YXZ');
const leafQuat = new THREE.Quaternion();

function hangVine(batch, x, y, z, ox, oz, length, rand, drift = 0) {
  const pts = [];
  const phase = rand() * 6;
  const swing = 0.5 + rand() * 1.1;
  const lean = 0.25 + rand() * 0.4;
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    const side = Math.sin(t * 3.4 + phase) * swing * t;
    const out = lean * Math.min(1, t * 3) + 0.5 * t * t + drift * t;
    pts.push(new THREE.Vector3(x + ox * out - oz * side, y - length * t, z + oz * out + ox * side));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  batch.add('vineStem', new THREE.TubeGeometry(curve, 16, 0.08 + rand() * 0.05, 4));
  const count = Math.max(3, Math.floor(length / 0.75));
  const face = Math.atan2(ox, oz);
  for (let i = 1; i <= count; i++) {
    const t = i / (count + 1);
    const p = curve.getPointAt(t);
    const size = (0.5 + rand() * 0.35) * (1 - 0.3 * t);
    leafTurn.set(0.5 + rand() * 0.7, face + (i % 2 ? 1 : -1) * (0.6 + rand() * 0.9), 0);
    leafQuat.setFromEuler(leafTurn);
    batch.add(rand() < 0.55 ? 'vineLeaf' : 'vineLeafDark', VINE_LEAF, new THREE.Matrix4().compose(p, leafQuat, new THREE.Vector3(size, size, size)));
  }
}

function caveFrames(site, roofed) {
  const pts = site.cave.filter((p) => p.roofed === roofed && p.z > mainlandEdge(p.x) + 1);
  return pts.map((p, k) => {
    const a = pts[Math.max(0, k - 1)];
    const b = pts[Math.min(pts.length - 1, k + 1)];
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    return { ...p, nx: (b.z - a.z) / len, nz: -(b.x - a.x) / len };
  });
}

function addCaveInterior(batch, site, scene, rand) {
  const frames = caveFrames(site, true);
  const crystals = [];
  frames.forEach((f, k) => {
    if (k % 3) return;
    for (let n = 0; n < 2; n++) {
      const u = (rand() * 2 - 1) * 0.85;
      const lateral = u * (f.half + 1.5);
      const y = ARCH_SPRING + Math.sqrt(1 - u * u) * ARCH_RISE - 0.6;
      const len = 2.5 + rand() * 6;
      const r = 0.5 + rand() * 0.9;
      batch.add('stalactite', CONE, mat(f.x + f.nx * lateral, y - len / 2, f.z + f.nz * lateral, r, len, r, Math.PI, rand() * 6, 0));
    }
    if (rand() < 0.7) {
      const side = rand() < 0.5 ? -1 : 1;
      const lateral = side * (f.half - 0.3);
      const y = 0.4 + rand() * 3;
      const color = rand() < 0.6 ? 0x6ff3ff : 0xa8fbff;
      for (let n = 0; n < 3 + Math.floor(rand() * 3); n++) {
        crystals.push({ x: f.x + f.nx * lateral + (rand() - 0.5) * 2, y: y + rand() * 2, z: f.z + f.nz * lateral + (rand() - 0.5) * 2, s: 0.5 + rand() * 0.9, tilt: (rand() - 0.5) * 1.2, spin: rand() * 6, lean: -side * 0.5, color });
      }
    }
  });
  const gem = new THREE.OctahedronGeometry(1, 0).scale(0.55, 1.6, 0.55);
  const glow = new THREE.InstancedMesh(gem, new THREE.MeshBasicMaterial({ color: 0xffffff }), Math.max(1, crystals.length));
  const tint = new THREE.Color();
  crystals.forEach((c, k) => {
    glow.setMatrixAt(k, mat(c.x, c.y, c.z, c.s, c.s, c.s, c.tilt, c.spin, c.lean));
    glow.setColorAt(k, tint.set(c.color));
  });
  glow.count = crystals.length;
  glow.computeBoundingSphere();
  scene.add(glow);
  const water = [];
  for (let k = 0; k < frames.length - 1; k++) {
    const a = frames[k];
    const b = frames[k + 1];
    const across = 6;
    for (let j = 0; j < across; j++) {
      const u0 = (j / across) * 2 - 1;
      const u1 = ((j + 1) / across) * 2 - 1;
      const at = (f, u) => [f.x + f.nx * u * (f.half + 3), 0.12, f.z + f.nz * u * (f.half + 3)];
      water.push(...at(a, u0), ...at(b, u0), ...at(a, u1), ...at(a, u1), ...at(b, u0), ...at(b, u1));
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(water, 3));
  g.computeVertexNormals();
  const pool = createWater({ geometry: g, flat: true, deep: 0x093447, shallow: 0x146a7e, foam: 0x8fd3e6 });
  pool.mesh.material.polygonOffset = true;
  pool.mesh.material.polygonOffsetFactor = -2;
  pool.mesh.material.polygonOffsetUnits = -2;
  scene.add(pool.mesh);
  return pool;
}

function addGorge(batch, site, rand) {
  const frames = caveFrames(site, false).filter((f) => Math.hypot(f.x - site.center.x, f.z - site.center.z) > site.radius + CRATER_WALL + 6);
  const specs = [];
  frames.forEach((f, k) => {
    if (k % 2) return;
    for (const side of [-1, 1]) {
      const rim = f.half + CAVE_WALL + 2 + rand() * 8;
      const x = f.x + f.nx * side * rim;
      const z = f.z + f.nz * side * rim;
      const y = clifftop(x, z);
      if (carveHeight(site, x, z) < y - 0.5) continue;
      if (rand() < 0.35) addPalm(batch, x, y - 0.4, z, rand, { height: 9 + rand() * 7, lean: 0.4 + rand() * 0.4, dir: Math.atan2(-f.nx * side, -f.nz * side) });
      else if (rand() < 0.6) canopyTree(batch, x, y - 0.3, z, rand, 3 + rand() * 2);
      else leafBush(batch, x, y - 0.3, z, rand, 1.6 + rand() * 1.6);
      if (rand() < 0.6) {
        let lip = f.half + CAVE_WALL * 0.7;
        while (lip < f.half + CAVE_WALL + 4 && carveHeight(site, f.x + f.nx * side * lip, f.z + f.nz * side * lip) < clifftop(f.x + f.nx * side * lip, f.z + f.nz * side * lip) - 1) lip += 0.5;
        const vx = f.x + f.nx * side * lip;
        const vz = f.z + f.nz * side * lip;
        const y = Math.min(clifftop(vx, vz), carveHeight(site, vx, vz));
        const below = carveHeight(site, f.x + f.nx * side * (lip - 3), f.z + f.nz * side * (lip - 3));
        if (y - below > 45) continue;
        const sz = 2.2 + rand() * 1.6;
        fern(batch, vx, y - 0.4, vz, rand, sz * 0.55, { yaw: Math.atan2(-f.nx * side, -f.nz * side), spread: 2, droop: 1.4 });
        for (let n = 0; n < 2 + Math.floor(rand() * 3); n++) {
          const along = (rand() - 0.5) * 5;
          const length = 10 + rand() * 18;
          const ax = vx + f.nz * along - f.nx * side * 0.8;
          const az = vz - f.nx * along - f.nz * side * 0.8;
          hangVine(batch, ax, y - sz * 0.6, az, -f.nx * side, -f.nz * side, length, rand, length * 0.12);
        }
      }
    }
  });
  for (const k of [Math.floor(frames.length * 0.3), Math.floor(frames.length * 0.7)]) {
    const f = frames[k];
    if (!f) continue;
    const side = k % 2 ? 1 : -1;
    const rim = f.half + CAVE_WALL - 0.5;
    const tx = f.x + f.nx * side * rim;
    const tz = f.z + f.nz * side * rim;
    specs.push({
      top: new THREE.Vector3(tx, Math.min(clifftop(tx, tz), carveHeight(site, tx, tz)) - 0.4, tz),
      foot: new THREE.Vector3(f.x + f.nx * side * (f.half - 3), 0.2, f.z + f.nz * side * (f.half - 3)),
      dx: -f.nx * side,
      dz: -f.nz * side,
      width: 3.5 + rand() * 1.5,
    });
  }
  return specs;
}

function addCliffDressing(batch, site, rand) {
  const specs = [];
  const clear = (x) => Math.abs(x - site.hole.x) > 26 && !site.cave.some((p) => Math.abs(p.x - x) < p.half + 12 && p.z < mainlandEdge(p.x) + 30);
  for (let x = -460; x <= 460; x += 7 + rand() * 12) {
    if (!clear(x)) continue;
    const edge = mainlandEdge(x);
    const ys = faceHeights(x);
    const j = Math.floor(rand() * (STRATA - 1));
    const lip = ys[4 * j + 3];
    const ledge = 0.4 + j * 3.2 + 2;
    if (rand() < 0.7) {
      const sz = 1.6 + rand() * 2;
      const y = faceRise(x, ledge);
      if (rand() < 0.5) leafBush(batch, x, y - 0.2, edge + ledge + faceSway(x, y), rand, sz * 0.55);
      else fern(batch, x, y - 0.1, edge + ledge + faceSway(x, y), rand, sz * 0.45, { droop: 0.8 });
    }
    if (rand() < 0.65) {
      for (let n = 0; n < 2 + Math.floor(rand() * 3); n++) {
        const vx = x + (rand() - 0.5) * 5;
        hangVine(batch, vx, lip - 0.2, cliffFace(vx, lip) - 0.3, 0, -1, 5 + rand() * 13, rand);
      }
    }
    if (rand() < 0.3) {
      const ox = x + (rand() - 0.5) * 1.6;
      fern(batch, ox, lip + 0.2, cliffFace(ox, lip) - 0.4, rand, 0.9 + rand() * 0.5, { yaw: Math.PI, spread: 2.4, droop: 1.5 });
    }
    if (rand() < 0.45) {
      const sz = 1.8 + rand() * 3.5;
      const bz = edge - 1.5 - rand() * 5;
      batch.add('rock', ROCK, mat(x, 0.1, bz, sz, sz * (0.6 + rand() * 0.4), sz, rand(), rand() * 6, rand()));
      if (rand() < 0.5) batch.add('foam', RING, mat(x, 0.25, bz, sz * 1.4, 6, sz * 1.4));
    }
  }
  for (const x of [-360, -230, 270, 395]) {
    const top = faceHeights(x)[4 * STRATA] - 0.6;
    specs.push({
      top: new THREE.Vector3(x, top, cliffFace(x, top) - 0.4),
      foot: new THREE.Vector3(x, 0.2, mainlandEdge(x) - 3),
      dx: 0,
      dz: -1,
      width: 3 + rand() * 1.5,
    });
  }
  return specs;
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

export function createSky({ top = SKY_TOP, horizon = SKY_HORIZON } = {}) {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTop: { value: new THREE.Color(top) },
      uHorizon: { value: new THREE.Color(horizon) },
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

export function createCloud(rand, color = null) {
  const parts = [];
  const puffs = 4 + Math.floor(rand() * 4);
  for (let i = 0; i < puffs; i++) {
    const s = 9 + rand() * 9;
    parts.push(LOW_SPHERE.clone().applyMatrix4(mat((i - puffs / 2) * 9 + rand() * 4, rand() * 5, rand() * 10 - 5, s * 1.2, s * 0.8, s)));
  }
  return new THREE.Mesh(mergeGeometries(parts), color ? toon(color) : toon(0xffffff, { emissive: 0x9bd9ff, emissiveIntensity: 0.25 }));
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

const BAY_SKY = { top: 0x1a78e6, horizon: SKY_HORIZON };

export function createWorld(scene, track, fx) {
  if (track.map.arena) return createBayArena(scene, track.map.arena, fx);
  const site = track.map.whirlpool ? whirlpoolSite(track, mainlandEdge, cliffFace) : null;
  track.whirlpool = site;
  const fog = new THREE.Fog(SKY_HORIZON, 480, 950);

  const sky = createSky(BAY_SKY);
  scene.add(sky);

  scene.add(new THREE.HemisphereLight(0xe8f8ff, 0x3cc4d4, 1.4));
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.4);
  sun.position.copy(SUN_DIR).multiplyScalar(100);
  scene.add(sun);

  const water = createWater({ hole: site ? [site.center.x, site.center.z, site.radius + 2] : null });
  scene.add(water.mesh);

  const rand = mulberry32(20261023);
  const batch = new Batcher();
  const half = track.halfWidth;
  const shores = [];
  const pillars = [];
  const falls = [];
  const fits = (x, z, r) => !pillars.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + r + 6);
  for (const f of [0.131, 0.715, 0.817]) shores.push(...addArch(batch, track, f, rand));
  for (const f of [0.131, 0.689, 0.817]) {
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
      const near = track.project(x, z);
      const clearance = near.distance - track.hw[near.idx];
      const mesa = rand() < 0.18;
      const radius = mesa ? 13 + rand() * 12 : 6 + rand() * 9;
      if (clearance < radius + 6) continue;
      if (!fits(x, z, radius)) continue;
      if (z > mainlandEdge(x) - radius - 14) continue;
      const height = mesa ? 18 + rand() * 20 : 10 + radius * (1.7 + rand() * 1.5) + (clearance > 120 ? rand() * 20 : 0);
      const pillar = addPillar(batch, x, z, rand, { radius, height });
      pillars.push({ x, z, r: radius });
      shores.push(pillar.blob);
      if (height > 34 && radius > 9 && clearance < 90 && falls.length < 6 && rand() < 0.7) falls.push({ pillar, x, z, toward: Math.atan2(track.pz[near.idx] - z, track.px[near.idx] - x) });
    }
  }
  const specs = falls.map((f) => waterfallSpec(batch, f.pillar, f.x, f.z, f.toward, rand));
  let caveWater = null;
  if (site) {
    const dress = mulberry32(7101);
    addCaveRoof(batch, site);
    addBlowholeCollar(batch, site);
    caveWater = addCaveInterior(batch, site, scene, dress);
    specs.push(...addCrater(batch, site, rand), ...addGorge(batch, site, dress), ...addCliffDressing(batch, site, dress), flumeStream(site));
  }
  const waterfalls = createWaterfalls(specs, rand);
  scene.add(waterfalls.group);
  addFarIslands(batch, rand);
  addMainland(batch, rand, site);
  const whirlpool = site ? new Whirlpool({ track, site, group: scene }) : null;
  if (site) track.reach = courseReach(track, site);
  const islands = pillars.map((p) => ({ x: p.x, z: p.z, r: p.r }));
  const stacks = [];


  const scenery = new THREE.Group();
  const chunks = batch.build(scenery);
  scene.add(scenery);

  const buoys = courseBuoys(track, (idx) => !site || idx < site.mouthIdx - 10 || idx > site.holeIdx + 30);
  scene.add(buoys);

  const arch = createArch(track, half);
  scene.add(arch);

  const clouds = addCumulus(scene, rand, 20);
  const gulls = addGulls(scene, rand, 9);

  const markers = [];
  for (let tries = 0; markers.length < 22 && tries < 600; tries++) {
    const x = (rand() - 0.5) * 900;
    const z = (rand() - 0.5) * 900 + 60;
    const near = track.project(x, z);
    const clearance = near.distance - track.hw[near.idx];
    if (clearance < 8 || clearance > 120) continue;
    if (islands.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + 8)) continue;
    if (z > mainlandEdge(x) - 12) continue;
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
    solid(p) {
      if (p.z > mainlandEdge(p.x) - 2) {
        const natural = mainlandGround(p.x, p.z);
        if (p.y < Math.min(natural, carveHeight(site, p.x, p.z))) return new THREE.Vector3(0, 0, -1);
        if (site && p.y > natural - 6 && p.y < natural + 1 && inCave(site, p.x, p.z)) return new THREE.Vector3(0, -1, 0);
      }
      return ellipseHit(shores, p);
    },
    surface: site ? bayWaters(site) : null,
    hazards: whirlpool,
    stacks,
    update(t, dt, camera) {
      if (whirlpool) {
        whirlpool.animate(t);
        caveWater.update(t);
      }
      water.update(t);
      cullChunks(chunks, camera, fog.far);
      sky.position.copy(camera.position);
      buoys.userData.update(t, camera);
      for (const cloud of clouds) {
        cloud.position.x += cloud.userData.speed * dt;
        if (cloud.position.x > 1100) cloud.position.x = -1100;
      }
      flyGulls(gulls, t);
      waterfalls.update(t, dt, camera, fx);
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

function createBayArena(scene, arena, fx) {
  const fog = new THREE.Fog(SKY_HORIZON, 480, 950);
  const sky = createSky(BAY_SKY);
  scene.add(sky);
  scene.add(new THREE.HemisphereLight(0xe8f8ff, 0x3cc4d4, 1.4));
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.4);
  sun.position.copy(SUN_DIR).multiplyScalar(100);
  scene.add(sun);
  const water = createWater();
  scene.add(water.mesh);

  const rand = mulberry32(20261028);
  const batch = new Batcher();
  const shores = [];
  const reach = (x, z) => Math.sqrt((x / arena.rx) ** 2 + (z / arena.rz) ** 2);
  const tallest = Math.max(...arena.islands.map(([, , , height]) => height));
  const specs = [];
  for (const [x, z, radius, height] of arena.islands) {
    const pillar = addPillar(batch, x, z, rand, { radius, height });
    shores.push(pillar.blob);
    if (height === tallest && x !== 0) specs.push(waterfallSpec(batch, pillar, x, z, Math.atan2(-z, -x), rand));
  }
  for (const [x, z, heading, span] of arena.arches) shores.push(...addArchAt(batch, x, z, heading, span, rand));
  for (const [bx, bz] of arena.bases) {
    const out = Math.sign(bx) * (arena.rx + 34);
    const home = addPillar(batch, out, bz, rand, { radius: 10, height: 36, plants: 0.5 });
    addLighthouse(batch, home.top.x, home.top.z, home.top.y);
  }
  const wall = [];
  for (let a = 0; a < Math.PI * 2; ) {
    const radius = 9 + rand() * 9;
    const ex = Math.cos(a) * arena.rx;
    const ez = Math.sin(a) * arena.rz;
    const nx = ex / arena.rx ** 2;
    const nz = ez / arena.rz ** 2;
    const nl = Math.hypot(nx, nz);
    const x = ex + (nx / nl) * (radius + 1);
    const z = ez + (nz / nl) * (radius + 1);
    if (z < mainlandEdge(x) - radius - 14) {
      addPillar(batch, x, z, rand, { radius, height: 12 + radius * (1.6 + rand() * 1.4) });
      wall.push({ x, z, r: radius });
    }
    a += (radius * 1.5) / Math.hypot(arena.rx * Math.sin(a), arena.rz * Math.cos(a));
  }
  for (let gx = -560; gx <= 560; gx += 42) {
    for (let gz = -500; gz <= 580; gz += 42) {
      const x = gx + (rand() - 0.5) * 34;
      const z = gz + (rand() - 0.5) * 34;
      if (rand() < 0.55) continue;
      const radius = 5 + rand() * 12;
      if (reach(x, z) < 1 + (radius + 30) / arena.rz) continue;
      if (z > mainlandEdge(x) - radius - 14) continue;
      if (wall.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + radius + 4)) continue;
      addPillar(batch, x, z, rand, { radius, height: 14 + radius * (1.8 + rand() * 1.6) });
      wall.push({ x, z, r: radius });
    }
  }
  addFarIslands(batch, rand);
  addMainland(batch, rand);
  const waterfalls = createWaterfalls(specs, rand);
  scene.add(waterfalls.group);

  const scenery = new THREE.Group();
  const chunks = batch.build(scenery);
  scene.add(scenery);

  const clouds = addCumulus(scene, rand, 20);
  const gulls = addGulls(scene, rand, 9);

  return {
    fog,
    water,
    sun,
    islands: arena.islands.map(([x, z, r]) => ({ x, z, r })),
    shores,
    solid(p) {
      if (p.z > mainlandEdge(p.x) && p.y < 70) return new THREE.Vector3(0, 0, -1);
      return ellipseHit(shores, p);
    },
    stacks: [],
    update(t, dt, camera) {
      water.update(t);
      cullChunks(chunks, camera, fog.far);
      sky.position.copy(camera.position);
      for (const cloud of clouds) {
        cloud.position.x += cloud.userData.speed * dt;
        if (cloud.position.x > 1100) cloud.position.x = -1100;
      }
      flyGulls(gulls, t);
      waterfalls.update(t, dt, camera, fx);
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
