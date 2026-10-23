import * as THREE from 'three';
import { createWater } from './water.js';
import { toon, glow, outlined, mulberry32 } from './toon.js';
import { Batcher, COLORS, mat, LOW_SPHERE, CYLINDER, CONE, ROCK, addPalm, createSky, createCloud, createArch, SUN_DIR } from './world.js';

const CELL = 3;
const MARGIN = 340;
const RIVER_AMP = 0.4;
const SKY_GREEN = 0xd2f2dc;

const JUNGLE_COLORS = {
  ...COLORS,
  bark: 0x7a5230,
  barkLight: 0x9c7046,
  leaf: 0x2f9a45,
  leafLight: 0x56c04f,
  leafDark: 0x1d7a3e,
  fern: 0x4cbf5a,
  vine: 0x3f7a2c,
  banana: 0x62d04c,
  bananaDark: 0x3aa843,
  rock: 0x9a958c,
  pillar: 0x5b4636,
  railYellow: 0xffd23f,
  railDark: 0x2b3440,
};

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function noise(x, z) {
  return (
    0.5 +
    0.25 * Math.sin(x * 0.021 + Math.sin(z * 0.013) * 2) +
    0.15 * Math.sin(z * 0.034 + x * 0.011) +
    0.1 * Math.sin((x - z) * 0.057)
  );
}

export function riverSurface(track) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < track.N; i++) {
    minX = Math.min(minX, track.px[i]);
    maxX = Math.max(maxX, track.px[i]);
    minZ = Math.min(minZ, track.pz[i]);
    maxZ = Math.max(maxZ, track.pz[i]);
  }
  minX -= MARGIN;
  minZ -= MARGIN;
  maxX += MARGIN;
  maxZ += MARGIN;
  const cols = Math.ceil((maxX - minX) / CELL) + 1;
  const rows = Math.ceil((maxZ - minZ) / CELL) + 1;
  const nearest = new Int16Array(cols * rows);
  const { N, px, pz, tx, tz, wrap, spacing } = track;
  const step = 4;
  for (let r = 0; r < rows; r++) {
    const z = minZ + r * CELL;
    for (let c = 0; c < cols; c++) {
      const x = minX + c * CELL;
      let best = 0;
      let bestD = Infinity;
      for (let i = 0; i < N; i += step) {
        const d = (x - px[i]) ** 2 + (z - pz[i]) ** 2;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      for (let k = best - step; k <= best + step; k++) {
        const i = wrap(k);
        const d = (x - px[i]) ** 2 + (z - pz[i]) ** 2;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      nearest[r * cols + c] = best;
    }
  }

  const out = { level: 0, amp: 0, s: 0, dist: 0 };
  return {
    bounds: { minX, maxX, minZ, maxZ },
    sample(x, z) {
      const c = Math.min(cols - 1, Math.max(0, Math.round((x - minX) / CELL)));
      const r = Math.min(rows - 1, Math.max(0, Math.round((z - minZ) / CELL)));
      const i = nearest[r * cols + c];
      const along = (x - px[i]) * tx[i] + (z - pz[i]) * tz[i];
      const s = i * spacing + along;
      out.s = s;
      out.level = track.level(s);
      out.amp = track.inTunnel(s) ? 0.2 : RIVER_AMP;
      out.dist = Math.hypot(x - px[i], z - pz[i]);
      return out;
    },
  };
}

const ARCH_TOP = 16;
const ARCH_FLOOR = -5;
const LID = 18;

function highLevel(track, s) {
  let d = track.ahead(track.river.seam, s);
  if (d > track.length / 2) d -= track.length;
  return track.river.top - track.river.slope * d;
}

function tunnelMask(track, s) {
  if (track.inTunnel(s)) return 1;
  const r = track.river;
  const toEntrance = track.ahead(s, r.tunnelIn);
  const fromExit = track.ahead(r.tunnelOut, s);
  return Math.max(0, 1 - smooth(0, 60, toEntrance), 1 - smooth(0, 60, fromExit));
}

function isHole(surface, track, x, z) {
  const { s, dist } = surface.sample(x, z);
  return track.inTunnel(s) && dist < track.halfWidth + 10;
}

function terrainHeight(surface, track, x, z) {
  const { level, dist, s } = surface.sample(x, z);
  const hw = track.halfWidth;
  const bank = smooth(hw - 4, hw + 7, dist);
  const hills = smooth(hw + 7, hw + 70, dist) * (2 + 7 * noise(x, z));
  const mountains = smooth(140, 330, dist) * 70 * (0.5 + 0.6 * noise(x * 1.7 + 300, z * 1.7));
  const normal = level - 4 + bank * 8.5 + hills + mountains;
  const mask = tunnelMask(track, s);
  if (mask <= 0) return normal;
  const ridge = highLevel(track, s) + LID + 4 + 14 * noise(x * 2.3, z * 2.3) * smooth(hw + 10, hw + 40, dist);
  const weight = mask * smooth(hw + 6, hw + 11, dist);
  return normal + (Math.max(normal, ridge) - normal) * weight;
}

function buildTerrain(surface, track) {
  const { minX, maxX, minZ, maxZ } = surface.bounds;
  const step = 4;
  const cols = Math.ceil((maxX - minX) / step) + 1;
  const rows = Math.ceil((maxZ - minZ) / step) + 1;
  const heights = new Float32Array(cols * rows);
  const levels = new Float32Array(cols * rows);
  const holes = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = minX + c * step;
      const z = minZ + r * step;
      heights[r * cols + c] = terrainHeight(surface, track, x, z);
      levels[r * cols + c] = surface.sample(x, z).level;
      holes[r * cols + c] = isHole(surface, track, x, z) ? 1 : 0;
    }
  }
  const positions = [];
  const colors = [];
  const grass = new THREE.Color(0x6fc94f);
  const grassDark = new THREE.Color(0x4fae45);
  const mud = new THREE.Color(0xc9a46b);
  const rock = new THREE.Color(0xa69b8f);
  const rockDark = new THREE.Color(0x8b8076);
  const tint = new THREE.Color();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c3 = new THREE.Vector3();
  const n = new THREE.Vector3();
  const tri = (i0, i1, i2, cIdx) => {
    if (holes[i0] || holes[i1] || holes[i2]) return;
    for (const [v, idx] of [[a, i0], [b, i1], [c3, i2]]) {
      const rr = Math.floor(idx / cols);
      const cc = idx % cols;
      v.set(minX + cc * step, heights[idx], minZ + rr * step);
    }
    n.subVectors(b, a).cross(c3.clone().sub(a)).normalize();
    const lvl = levels[cIdx];
    const steep = 1 - Math.abs(n.y);
    const lush = noise(a.x * 3, a.z * 3) > 0.55 ? grassDark : grass;
    for (const v of [a, b, c3]) {
      if (steep > 0.45) tint.copy(steep > 0.7 ? rockDark : rock);
      else tint.copy(mud).lerp(lush, smooth(lvl + 0.4, lvl + 2.4, v.y));
      positions.push(v.x, v.y, v.z);
      colors.push(tint.r, tint.g, tint.b);
    }
  };
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const i = r * cols + c;
      tri(i, i + cols, i + 1, i);
      tri(i + 1, i + cols, i + cols + 1, i);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, toon(0xffffff, { vertexColors: true }));
}

function ribbon(track, from, to, levelAt, positions) {
  const hw = track.halfWidth + 8;
  const lanes = 10;
  const at = (k, lane) => {
    const i = track.wrap(k);
    const lat = -hw + (2 * hw * lane) / lanes;
    return [track.px[i] + track.nx[i] * lat, track.pz[i] + track.nz[i] * lat];
  };
  for (let k = from; k < to; k++) {
    const s0 = k * track.spacing;
    const s1 = (k + 1) * track.spacing;
    if (track.river.drops.some((d) => track.ahead(s0, d.s) < track.spacing)) continue;
    const y0 = levelAt(s0);
    const y1 = levelAt(s1);
    for (let lane = 0; lane < lanes; lane++) {
      const [ax, az] = at(k, lane);
      const [bx, bz] = at(k, lane + 1);
      const [cx, cz] = at(k + 1, lane);
      const [dx, dz] = at(k + 1, lane + 1);
      positions.push(ax, y0, az, cx, y1, cz, bx, y0, bz);
      positions.push(bx, y0, bz, cx, y1, cz, dx, y1, dz);
    }
  }
}

const lowLevel = (track) => (s) => track.level(s, track.inTunnel(s) && track.pastSeam(s) ? 1 : 0);
const copyLevel = (track) => (s) => highLevel(track, s);

function buildRiver(track) {
  const { river, spacing, N } = track;
  const kIn = Math.round(river.tunnelIn / spacing);
  const kOut = Math.round(river.tunnelOut / spacing);
  const kSeam = Math.round(river.seam / spacing);
  const positions = [];
  ribbon(track, kOut, kIn + N, (s) => track.level(s), positions);
  ribbon(track, kIn, kOut, lowLevel(track), positions);
  ribbon(track, kSeam - GHOST, kOut, copyLevel(track), positions);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return createWater({ geometry, flat: true, amp: RIVER_AMP, deep: 0x1c8f86, shallow: 0x4fd6b4 });
}

const GHOST = 45;

function archPoint(track, k, theta, levelAt, extra = 0) {
  const i = track.wrap(k);
  const w = track.halfWidth + 7 + extra;
  const lat = Math.cos(theta) * w;
  const y = levelAt(k * track.spacing) + ARCH_FLOOR + (ARCH_TOP - ARCH_FLOOR) * Math.sin(theta);
  return new THREE.Vector3(track.px[i] + track.nx[i] * lat, y, track.pz[i] + track.nz[i] * lat);
}

function buildTube(track, from, to, levelAt) {
  const steps = 16;
  const positions = [];
  const colors = [];
  const dark = new THREE.Color(0x4a4038);
  const light = new THREE.Color(0x7d6d5c);
  const moss = new THREE.Color(0x3f6f3a);
  const c = new THREE.Color();
  for (let k = from; k < to; k++) {
    for (let j = 0; j < steps; j++) {
      const t0 = (j / steps) * Math.PI;
      const t1 = ((j + 1) / steps) * Math.PI;
      const quad = [archPoint(track, k, t0, levelAt), archPoint(track, k + 1, t0, levelAt), archPoint(track, k, t1, levelAt), archPoint(track, k + 1, t1, levelAt)];
      for (const idx of [0, 1, 2, 2, 1, 3]) {
        const p = quad[idx];
        const up = Math.sin(idx < 2 ? t0 : t1);
        c.copy(dark).lerp(light, up);
        if (noise(p.x * 4, p.z * 4 + p.y * 3) > 0.72) c.lerp(moss, 0.6);
        positions.push(p.x, p.y, p.z);
        colors.push(c.r, c.g, c.b);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, toon(0xffffff, { vertexColors: true, side: THREE.DoubleSide }));
}

function buildShell(track, from, to) {
  const positions = [];
  const hw = track.halfWidth + 10;
  const corner = (k, lat, y) => {
    const i = track.wrap(k);
    return [track.px[i] + track.nx[i] * lat, y, track.pz[i] + track.nz[i] * lat];
  };
  const lowAt = lowLevel(track);
  for (let k = from; k < to; k++) {
    const lid0 = highLevel(track, k * track.spacing) + LID;
    const lid1 = highLevel(track, (k + 1) * track.spacing) + LID;
    const base0 = lowAt(k * track.spacing) + ARCH_FLOOR - 2;
    const base1 = lowAt((k + 1) * track.spacing) + ARCH_FLOOR - 2;
    for (const side of [-1, 1]) {
      const a = corner(k, side * hw, base0);
      const b = corner(k + 1, side * hw, base1);
      const c = corner(k, side * hw, lid0);
      const d = corner(k + 1, side * hw, lid1);
      positions.push(...a, ...b, ...c, ...c, ...b, ...d);
    }
    const a = corner(k, -hw, lid0);
    const b = corner(k + 1, -hw, lid1);
    const c = corner(k, hw, lid0);
    const d = corner(k + 1, hw, lid1);
    positions.push(...a, ...b, ...c, ...c, ...b, ...d);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, toon(0x8b7d6e, { side: THREE.DoubleSide }));
}

function buildMouth(track, k, levelAt, top) {
  const hw = track.halfWidth + 10;
  const i = track.wrap(k);
  const base = levelAt(k * track.spacing);
  const shape = new THREE.Shape();
  shape.moveTo(-hw, base + ARCH_FLOOR - 2);
  shape.lineTo(hw, base + ARCH_FLOOR - 2);
  shape.lineTo(hw, top);
  shape.lineTo(-hw, top);
  shape.closePath();
  const hole = new THREE.Path();
  for (let j = 0; j <= 24; j++) {
    const theta = (j / 24) * Math.PI;
    const w = track.halfWidth + 7;
    const x = Math.cos(theta) * w;
    const y = base + ARCH_FLOOR + (ARCH_TOP - ARCH_FLOOR) * Math.sin(theta);
    if (j === 0) hole.moveTo(x, y);
    else hole.lineTo(x, y);
  }
  shape.holes.push(hole);
  const geometry = new THREE.ShapeGeometry(shape);
  const mesh = outlined(geometry, toon(0x8b7d6e, { side: THREE.DoubleSide }), 0);
  const basis = new THREE.Matrix4().makeBasis(
    new THREE.Vector3(track.nx[i], 0, track.nz[i]),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(track.tx[i], 0, track.tz[i]),
  );
  mesh.applyMatrix4(basis);
  mesh.position.set(track.px[i], 0, track.pz[i]);
  return mesh;
}

function buildCap(track, k, levelAt, color) {
  const i = track.wrap(k);
  const w = track.halfWidth + 8;
  const geometry = new THREE.PlaneGeometry(w * 2, ARCH_TOP - ARCH_FLOOR + 2);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, fog: false }));
  mesh.position.set(track.px[i], levelAt(k * track.spacing) + (ARCH_TOP + ARCH_FLOOR) / 2, track.pz[i]);
  mesh.rotation.y = track.heading(i);
  return mesh;
}

function buildCrystals(track, from, to, levelAt) {
  const group = new THREE.Group();
  const materials = [glow(0x6cf2ff), glow(0xff7ad9), glow(0xb6ff6c)];
  for (let k = from; k < to; k++) {
    if (k % 11 !== 0) continue;
    for (const side of [-1, 1]) {
      const theta = side < 0 ? Math.PI - 0.5 : 0.5;
      const p = archPoint(track, k, theta, levelAt, -0.6);
      for (let n = 0; n < 3; n++) {
        const seed = Math.sin((k * 7 + n * 13 + side * 5) * 12.9898) * 43758.5453;
        const r = seed - Math.floor(seed);
        const mesh = new THREE.Mesh(CRYSTAL, materials[(k + n + (side > 0 ? 1 : 0)) % 3]);
        mesh.position.set(p.x + (r - 0.5) * 1.6, p.y - 0.4 + n * 0.3, p.z + (r - 0.5) * 1.6);
        mesh.scale.set(0.35 + r * 0.25, 0.9 + r * 0.9, 0.35 + r * 0.25);
        mesh.rotation.set((r - 0.5) * 0.8, r * 3, (n - 1) * 0.5 * side);
        group.add(mesh);
      }
    }
  }
  return group;
}

const CRYSTAL = new THREE.OctahedronGeometry(1, 0);

function buildTunnel(track) {
  const { river, spacing, N } = track;
  const kIn = Math.round(river.tunnelIn / spacing);
  const kOut = Math.round(river.tunnelOut / spacing);
  const kSeam = Math.round(river.seam / spacing);
  const low = lowLevel(track);
  const high = copyLevel(track);
  const group = new THREE.Group();
  group.add(buildTube(track, kIn, kOut, low));
  group.add(buildTube(track, kSeam - GHOST, kOut, high));
  group.add(buildCrystals(track, kIn, kOut, low));
  group.add(buildCrystals(track, kSeam - GHOST, kOut, high));
  group.add(buildShell(track, kIn, kOut));
  group.add(buildMouth(track, kIn, low, highLevel(track, river.tunnelIn) + LID));
  group.add(buildMouth(track, kOut, high, highLevel(track, river.tunnelOut) + LID));
  group.add(buildCap(track, kOut, low, SKY_GREEN));
  group.add(buildCap(track, kSeam - GHOST, high, 0x15110d));
  return group;
}

const FALL_VERT = /* glsl */ `
  varying vec2 vUv;
  #include <common>
  #include <fog_pars_vertex>
  void main() {
    vUv = uv;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const FALL_FRAG = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  #include <common>
  #include <fog_pars_fragment>
  void main() {
    float col = floor(vUv.x * 46.0);
    float r = fract(sin(col * 12.9898) * 43758.5453);
    float flow = fract(vUv.y * 2.5 - uTime * (1.2 + r * 0.8) + r);
    float streak = smoothstep(0.5, 0.56, flow) * (1.0 - smoothstep(0.8, 0.9, flow));
    vec3 base = mix(vec3(0.42, 0.86, 0.84), vec3(0.75, 0.96, 0.95), vUv.y);
    vec3 color = mix(base, vec3(1.0), streak * 0.75 + smoothstep(0.82, 1.0, vUv.y) * 0.7 + smoothstep(0.08, 0.0, vUv.y) * 0.5);
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

function buildFalls(track, drop) {
  const s = drop.s;
  const i = Math.floor(s / track.spacing);
  const px = track.px[i], pz = track.pz[i], tx = track.tx[i], tz = track.tz[i], nx = track.nx[i], nz = track.nz[i];
  const height = drop.height;
  const bottom = track.level(s + 1);
  const hw = track.halfWidth + 8;
  const cols = 24;
  const rows = 14;
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let r = 0; r <= rows; r++) {
    const u = r / rows;
    const along = 1 + (height > 8 ? 9 : 3) * Math.sqrt(u);
    const y = bottom + height * (1 - u) + 0.3 * (1 - u);
    for (let c = 0; c <= cols; c++) {
      const lat = -hw + (2 * hw * c) / cols;
      positions.push(px + tx * along + nx * lat, y, pz + tz * along + nz * lat);
      uvs.push(c / cols, u);
    }
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = r * (cols + 1) + c;
      indices.push(a, a + cols + 1, a + 1, a + 1, a + cols + 1, a + cols + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  const material = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 } }]),
    vertexShader: FALL_VERT,
    fragmentShader: FALL_FRAG,
    side: THREE.DoubleSide,
    fog: true,
  });
  const mesh = new THREE.Mesh(geometry, material);
  return { mesh, material, base: { x: px + tx * 10, y: bottom, z: pz + tz * 10, nx, nz, hw: track.halfWidth }, big: height > 8, lip: { i, top: bottom + height } };
}

const CANOPY = new THREE.SphereGeometry(1, 9, 6);
const TRUNK = new THREE.CylinderGeometry(0.62, 1, 1, 10);
const LEAF = new THREE.SphereGeometry(1, 8, 4).scale(0.5, 0.07, 1.25).translate(0, 0, 1.2);
const STEM = new THREE.CylinderGeometry(0.06, 0.09, 1, 5).translate(0, 0.5, 0);

const tilted = (x, y, z, sx, sy, sz, pitch, yaw) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ')), new THREE.Vector3(sx, sy, sz));

const canopyKey = (rand) => ['leaf', 'leafLight', 'leafDark'][Math.floor(rand() * 3)];

function addVines(batch, x, y, z, spread, count, rand) {
  for (let i = 0; i < count; i++) {
    const a = rand() * Math.PI * 2;
    const d = spread * (0.4 + rand() * 0.6);
    const len = 3 + rand() * 9;
    batch.add('vine', CYLINDER, mat(x + Math.cos(a) * d, y - len / 2, z + Math.sin(a) * d, 0.09, len, 0.09));
    if (rand() < 0.6) batch.add(canopyKey(rand), CANOPY, mat(x + Math.cos(a) * d, y - len, z + Math.sin(a) * d, 0.35, 0.45, 0.35));
  }
}

function addGiant(batch, x, y, z, rand, scale = 1) {
  const h = (20 + rand() * 12) * scale;
  const girth = 1.1 + rand() * 0.4;
  batch.add(rand() < 0.5 ? 'bark' : 'barkLight', TRUNK, mat(x, y + h / 2 - 1, z, girth, h, girth));
  const fins = 3 + Math.floor(rand() * 2);
  const spin = rand() * Math.PI;
  for (let i = 0; i < fins; i++) {
    const a = spin + (i / fins) * Math.PI * 2;
    batch.add('bark', CONE, mat(x + Math.cos(a) * girth * 0.9, y + 1.2, z + Math.sin(a) * girth * 0.9, 0.22, 3.6, 1.7, 0, -a, 0));
  }
  const spread = 6 + rand() * 4;
  const layers = [[h, spread], [h - 3.5, spread * 0.8]];
  for (const [top, r] of layers) {
    const blobs = 4 + Math.floor(rand() * 3);
    for (let i = 0; i < blobs; i++) {
      const a = (i / blobs) * Math.PI * 2 + rand();
      const off = i === 0 ? 0 : r * (0.45 + rand() * 0.3);
      const size = r * (0.5 + rand() * 0.25);
      batch.add(canopyKey(rand), CANOPY, mat(x + Math.cos(a) * off, y + top + rand() * 1.2, z + Math.sin(a) * off, size, size * 0.36, size));
    }
  }
  addVines(batch, x, y + h - 4, z, spread * 0.8, 4 + Math.floor(rand() * 4), rand);
}

function addBroadleaf(batch, x, y, z, rand, tall = 1) {
  const h = (9 + rand() * 8) * tall;
  batch.add('bark', TRUNK, mat(x, y + h / 2 - 1, z, 0.55 + h * 0.025, h, 0.55 + h * 0.025));
  const blobs = 3 + Math.floor(rand() * 3);
  const r = 3.6 + rand() * 2.4;
  for (let i = 0; i < blobs; i++) {
    const a = rand() * Math.PI * 2;
    const off = i === 0 ? 0 : r * 0.65;
    const s = r * (i === 0 ? 1 : 0.7 + rand() * 0.25);
    batch.add(canopyKey(rand), CANOPY, mat(x + Math.cos(a) * off, y + h + (i === 0 ? 0.5 : -0.8 + rand() * 1.5), z + Math.sin(a) * off, s, s * 0.5, s));
  }
  if (rand() < 0.5) addVines(batch, x, y + h - 1, z, r * 0.8, 1 + Math.floor(rand() * 3), rand);
}

function addBanana(batch, x, y, z, rand) {
  const leaves = 5 + Math.floor(rand() * 4);
  const size = 1.1 + rand() * 1.2;
  const stem = 1 + rand() * 1.6;
  for (let i = 0; i < leaves; i++) {
    const yaw = (i / leaves) * Math.PI * 2 + rand() * 0.5;
    const pitch = -0.2 - rand() * 0.6;
    const h = stem * (0.6 + rand() * 0.6);
    batch.add('vine', STEM, tilted(x, y, z, 1, h, 1, Math.sin(yaw) * 0.25, 0));
    batch.add(rand() < 0.5 ? 'banana' : 'bananaDark', LEAF, tilted(x, y + h, z, size, size, size * (1 + rand() * 0.6), -pitch, yaw));
  }
}

function addBush(batch, x, y, z, rand) {
  const lumps = 2 + Math.floor(rand() * 2);
  for (let i = 0; i < lumps; i++) {
    const a = rand() * Math.PI * 2;
    const s = 1.8 + rand() * 1.8;
    const key = ['leaf', 'leafLight', 'leafDark', 'fern'][Math.floor(rand() * 4)];
    batch.add(key, CANOPY, mat(x + Math.cos(a) * s * 0.5, y + s * 0.35, z + Math.sin(a) * s * 0.5, s, s * 0.7, s));
  }
}

function addFern(batch, x, y, z, rand) {
  const leaves = 5 + Math.floor(rand() * 3);
  const size = 1.2 + rand() * 1.4;
  for (let i = 0; i < leaves; i++) {
    const a = (i / leaves) * Math.PI * 2 + rand() * 0.4;
    batch.add('fern', CONE, mat(x + Math.cos(a) * size * 0.6, y + size * 0.35, z + Math.sin(a) * size * 0.6, 0.35 * size, size * 1.4, 0.18 * size, Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9));
  }
}

export function createJungle(group, track, fx) {
  const fog = new THREE.Fog(SKY_GREEN, 130, 560);
  const sky = createSky();
  group.add(sky);
  group.add(new THREE.HemisphereLight(0xeaffea, 0x3c8f6a, 1.4));
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.4);
  sun.position.copy(SUN_DIR).multiplyScalar(100);
  group.add(sun);

  const surface = riverSurface(track);
  group.add(buildTerrain(surface, track));
  const water = buildRiver(track);
  group.add(water.mesh);
  const falls = track.river.drops.map((drop) => buildFalls(track, drop));
  for (const f of falls) group.add(f.mesh);
  group.add(buildTunnel(track));

  const batch = new Batcher();

  const rand = mulberry32(7203);
  const hw = track.halfWidth;
  const { minX, maxX, minZ, maxZ } = surface.bounds;
  const steep = (x, z) => {
    const h = terrainHeight(surface, track, x, z);
    return Math.max(
      Math.abs(terrainHeight(surface, track, x + 3, z) - h),
      Math.abs(terrainHeight(surface, track, x, z + 3) - h),
    ) > 2.4;
  };
  const bankSpot = (from, to) => {
    const idx = Math.floor(rand() * track.N);
    const side = rand() < 0.5 ? -1 : 1;
    const p = track.point(idx, side * (hw + from + rand() * (to - from)));
    const { dist, s } = surface.sample(p.x, p.z);
    return dist < hw + from - 0.5 || tunnelMask(track, s) > 0 || steep(p.x, p.z) ? null : p;
  };
  const place = (count, from, to, plant) => {
    for (let n = 0, tries = 0; n < count && tries < count * 6; tries++) {
      const p = bankSpot(from, to);
      if (!p) continue;
      plant(p.x, terrainHeight(surface, track, p.x, p.z), p.z);
      n++;
    }
  };
  place(320, 9, 50, (x, y, z) => addGiant(batch, x, y, z, rand));
  place(1000, 6, 40, (x, y, z) => addBroadleaf(batch, x, y, z, rand, 0.9 + rand() * 0.5));
  place(180, 5, 30, (x, y, z) => addPalm(batch, x, y - 0.5, z, rand, { height: 4 + rand() * 4, lean: rand() * 0.2, dir: rand() * Math.PI * 2 }));
  place(160, 6, 30, (x, y, z) => addPalm(batch, x, y - 0.5, z, rand, { height: 11 + rand() * 8, lean: rand() * 0.5, dir: rand() * Math.PI * 2 }));
  place(800, 3, 22, (x, y, z) => addBanana(batch, x, y, z, rand));
  place(700, 3.5, 16, (x, y, z) => addBush(batch, x, y, z, rand));
  place(400, 5, 30, (x, y, z) => addFern(batch, x, y, z, rand));
  for (let n = 0, tries = 0; n < 420 && tries < 9000; tries++) {
    const x = minX + rand() * (maxX - minX);
    const z = minZ + rand() * (maxZ - minZ);
    const { dist } = surface.sample(x, z);
    if (dist < hw + 42 || dist > 260 || steep(x, z)) continue;
    addGiant(batch, x, terrainHeight(surface, track, x, z), z, rand, 1 + rand() * 0.3);
    n++;
  }
  const big = falls.find((f) => f.big);
  const li = big.lip.i;
  for (const side of [-1, 1]) {
    for (let k = 0; k < 4; k++) {
      const lat = side * (hw + 2 + k * 3);
      const along = -4 + k * 4;
      const x = track.px[li] + track.nx[li] * lat + track.tx[li] * along;
      const z = track.pz[li] + track.nz[li] * lat + track.tz[li] * along;
      const s = 3 + rand() * 3;
      batch.add('rock', ROCK, mat(x, big.lip.top + s * 0.3 - (along > 2 ? 4 : 0), z, s, s * 0.8, s, rand(), rand(), rand()));
    }
  }
  const scenery = new THREE.Group();
  batch.build(scenery, 0.1, JUNGLE_COLORS);
  group.add(scenery);

  group.add(createArch(track, hw));

  const clouds = [];
  for (let i = 0; i < 12; i++) {
    const cloud = createCloud(rand);
    const a = rand() * Math.PI * 2;
    const d = 150 + rand() * 600;
    cloud.position.set(Math.cos(a) * d, 140 + rand() * 70, Math.sin(a) * d);
    cloud.userData.speed = 2 + rand() * 3;
    clouds.push(cloud);
    group.add(cloud);
  }

  const base = big.base;
  return {
    fog,
    water,
    sun,
    surface,
    shores: [],
    update(t, dt, camera) {
      water.update(t);
      for (const f of falls) f.material.uniforms.uTime.value = t;
      sky.position.copy(camera.position);
      for (const cloud of clouds) {
        cloud.position.x += cloud.userData.speed * dt;
        if (cloud.position.x > 800) cloud.position.x = -800;
      }
      for (let i = 0; i < 3; i++) {
        if (Math.random() > dt * 30) continue;
        const lat = (Math.random() - 0.5) * 2 * (base.hw + 4);
        fx.mist(base.x + base.nx * lat, base.y + 0.5, base.z + base.nz * lat);
      }
    },
  };
}
