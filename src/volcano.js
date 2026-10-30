import * as THREE from 'three';
import { toon, mulberry32 } from './toon.js';
import { groundHit } from './terrain.js';
import { jungleClump } from './foliage.js';
import { Batcher, cullChunks, slicer, COLORS, mat, ROCK, SPHERE, addPalm, trunkGeometry, createSky, createCloud, createArch, SUN_DIR } from './world.js';
import { riverSurface, buildFalls } from './jungle.js';
import { createWater } from './water.js';
import { BASE_COLORS, buildBase } from './volcanoBase.js';
import { groundMesh, noise, seaStrip, smooth } from './mapKit.js';

const SKY = 0xbfe6f0;
const RIM = 92;
const PEAK = 236;
const LAVA_Y = 208;
const PLATEAU = 34;
const ISLAND = { x: 420, z: -20, rx: 830, rz: 1170 };
const CANYON_HALF = 60;
const CANYON_IN = 40;
const CANYON_OUT = 720;
const FIELD_CELL = 14;
const WATER = { deep: 0x0f7fa8, shallow: 0x35d0d4 };
const LAVA_START = 40;
const LAVA_REACH = 46;
const OVERRUN = 330;
const LAVA_CARVE = 400;
const LAVA_ENTRY = 9;
const LAVA_FLOOR = 0.8;
const BURN_CELL = 14;
const DAY = { top: 0x2f86d8, horizon: SKY, hemiSky: 0xfff0e0, hemiGround: 0x5a6a50, hemi: 1.4, sun: 0xfff0dc, sunPower: 2.6 };
const ASH = { top: 0x2b1c22, horizon: 0xa84e2c, hemiSky: 0xffd9c4, hemiGround: 0x4c2a26, hemi: 1.5, sun: 0xffb98c, sunPower: 2.4 };
const BURNT_BARK = [new THREE.Color(0x151214), new THREE.Color(0x241d1e)];
const PALETTE = {
  ...COLORS,
  ...BASE_COLORS,
  basalt: 0x25232a,
  basaltLight: 0x3a373e,
  ashCloud: 0x3c383c,
  ash: 0x7f7670,
  concrete: 0xb6b8ba,
  steel: 0x6d7a88,
  steelDark: 0x2e3744,
  hazard: 0xffd23f,
  hazardDark: 0x20262e,
  villain: 0xc62838,
  villainDark: 0x7a1524,
  lamp: 0xfff0a0,
  screen: 0x46e0c0,
  moss: 0x5e9e26,
  mossDark: 0x3c7a1c,
  bark: 0x7a5230,
  fronds: 0x5e9e26,
  coconut: 0x7a5230,
};
const SPIRE = new THREE.ConeGeometry(1, 1, 6, 4).translate(0, 0.5, 0).toNonIndexed();
const spirePoints = SPIRE.attributes.position;
for (let k = 0; k < spirePoints.count; k++) {
  const x = spirePoints.getX(k);
  const y = spirePoints.getY(k);
  const z = spirePoints.getZ(k);
  const shove = 0.8 * (1 - y) * (noise(x * 40 + y * 60, z * 40) - 0.5);
  spirePoints.setXYZ(k, x + shove, y, z - shove);
}
SPIRE.computeVertexNormals();

function islandHeight(x, z) {
  const r = Math.hypot(x, z);
  const lump = 8 * noise(x * 1.3, z * 1.3) + 4 * noise(x * 3.1 + 50, z * 3.1);
  const cone = PEAK * Math.max(0, 1 - (r - RIM) / 400) ** 1.12 + lump;
  const crater = smooth(62, RIM, r);
  const volcano = LAVA_Y - 6 + (cone - (LAVA_Y - 6)) * crater;
  const sea = -16;
  const flank = volcano + (sea - volcano) * smooth(500, 570, r);
  const angle = Math.atan2(z - ISLAND.z, x - ISLAND.x);
  const reach = Math.hypot((x - ISLAND.x) / ISLAND.rx, (z - ISLAND.z) / ISLAND.rz) + 0.025 * Math.sin(angle * 7) + 0.012 * Math.sin(angle * 17);
  const beach = 1.6 + 0.4 * lump * 0.1;
  const table = PLATEAU + 0.5 * lump;
  const inland = beach + (table - beach) * (1 - smooth(0.86, 0.97, reach));
  return Math.max(flank, inland + (sea - inland) * smooth(1, 1.05, reach));
}

function groundHeight(surface, track, x, z) {
  const base = openHeight(surface, track, x, z);
  const field = track.river.flight;
  if (!field) return base;
  const { edge, s } = surface.sample(x, z);
  const weight = field.weight(x, z) * (track.formAt(s) ? 1 : smooth(22, 75, edge));
  if (weight <= 0) return base;
  const d = field.dist(x, z);
  const rim = (28 + 36 * noise(x * 1.1, z * 1.1) + 14 * noise(x * 3, z * 3)) * (1 - smooth(200, 310, d));
  const top = base + rim * weight * smooth(CANYON_HALF + 20, CANYON_HALF + 60, d);
  return top + (-16 - top) * weight * (1 - smooth(CANYON_HALF + 40, CANYON_HALF + 88, d));
}

function openHeight(surface, track, x, z) {
  const { edge, s, level } = surface.sample(x, z);
  return shapedHeight(track, edge, s, level, x, z);
}

const canyonFade = (s, start, end) => smooth(0, 260, s - start) * smooth(0, 300, end - s);

async function flightField(surface, track, tick) {
  const { launch, lip } = track.river.land;
  const start = launch + CANYON_IN;
  const end = lip - CANYON_OUT;
  const points = [];
  for (let s = start; s < end; s += 12) {
    const i = track.wrap(Math.round(s / track.spacing));
    points.push({ x: track.px[i], z: track.pz[i], w: canyonFade(s, start, end) });
  }
  const { minX, maxX, minZ, maxZ } = surface.bounds;
  const cols = Math.ceil((maxX - minX) / FIELD_CELL) + 2;
  const rows = Math.ceil((maxZ - minZ) / FIELD_CELL) + 2;
  const dist = new Float32Array(cols * rows);
  const weight = new Float32Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    await tick();
    const z = minZ + r * FIELD_CELL;
    for (let c = 0; c < cols; c++) {
      const x = minX + c * FIELD_CELL;
      let best = Infinity;
      let w = 0;
      for (const p of points) {
        const d = (x - p.x) ** 2 + (z - p.z) ** 2;
        if (d < best) {
          best = d;
          w = p.w;
        }
      }
      dist[r * cols + c] = Math.sqrt(best);
      weight[r * cols + c] = w;
    }
  }
  const at = (grid, x, z) => {
    const fx = Math.min(cols - 1.001, Math.max(0, (x - minX) / FIELD_CELL));
    const fz = Math.min(rows - 1.001, Math.max(0, (z - minZ) / FIELD_CELL));
    const c = Math.floor(fx);
    const r = Math.floor(fz);
    const u = fx - c;
    const v = fz - r;
    const a = grid[r * cols + c];
    const b = grid[r * cols + c + 1];
    const e = grid[(r + 1) * cols + c];
    const f = grid[(r + 1) * cols + c + 1];
    return a + (b - a) * u + (e + (f - e) * u - a - (b - a) * u) * v;
  };
  return { dist: (x, z) => at(dist, x, z), weight: (x, z) => at(weight, x, z), start, end };
}

function shapedHeight(track, edge, s, level, x, z) {
  const land = islandHeight(x, z);
  const free = track.formAt(s) ? track.landAmount(s) : 0;
  const floor = track.ahead(track.river.land.launch, s) < LAVA_CARVE ? -2 : level - 10;
  const open = land + (Math.min(land, floor) - land) * (1 - smooth(4, 30, edge));
  if (free >= 1) return open;
  const hw = track.halfWidth;
  const dist = edge + hw;
  const bank = smooth(hw - 6, hw + 8, dist);
  const levee = Math.max(land, level + 4 + 3 * noise(x, z));
  const shoulder = levee + (land - levee) * smooth(hw + 14, hw + 170, dist);
  const carved = level - 5 + (shoulder - level + 5) * bank;
  return carved + (open - carved) * free;
}

const LAVA_VERT = /* glsl */ `
  attribute vec3 aFlow;
  varying vec3 vWorld;
  varying vec3 vFlow;
  void main() {
    vFlow = aFlow;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const LAVA_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uStream;
  varying vec3 vWorld;
  varying vec3 vFlow;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) { return noise(p) * 0.5 + noise(p * 2.1 + 3.0) * 0.3 + noise(p * 4.3 + 7.0) * 0.2; }
  vec3 cells(vec2 p, float t) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float first = 8.0;
    float second = 8.0;
    float id = 0.0;
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 g = vec2(float(x), float(y));
        vec2 o = vec2(hash(i + g), hash(i + g + 19.0));
        o = 0.5 + 0.42 * sin(t + 6.28 * o);
        float d = length(g + o - f);
        if (d < first) {
          second = first;
          first = d;
          id = hash(i + g + 41.0);
        } else if (d < second) second = d;
      }
    }
    return vec3(first, second - first, id);
  }
  vec3 ramp(float heat) {
    vec3 c = mix(vec3(0.13, 0.03, 0.04), vec3(0.72, 0.08, 0.03), smoothstep(0.1, 0.45, heat));
    c = mix(c, vec3(1.0, 0.42, 0.05), smoothstep(0.4, 0.7, heat));
    c = mix(c, vec3(1.0, 0.84, 0.25), smoothstep(0.68, 0.9, heat));
    return mix(c, vec3(1.0, 0.98, 0.78), smoothstep(0.9, 1.0, heat));
  }
  void main() {
    vec2 p = uStream > 0.5 ? vec2(vFlow.x * 2.2, vFlow.y * 0.05 - uTime * 0.55) : vWorld.xz * 0.05;
    vec2 warp = vec2(fbm(p * 0.8 + uTime * 0.05), fbm(p * 0.8 + 11.0 - uTime * 0.04)) - 0.5;
    vec2 q = p + warp * 1.4;
    vec3 crust = cells(q, uTime * 0.3);
    vec3 fine = cells(q * 2.6 + 4.0, uTime * 0.45);
    float seam = 1.0 - smoothstep(0.0, 0.2, crust.y);
    float thin = 1.0 - smoothstep(0.0, 0.1, fine.y);
    float plate = crust.z * 0.2 + fbm(q * 3.0) * 0.18;
    float pulse = 0.5 + 0.5 * sin(uTime * 1.4 + crust.z * 18.0);
    float heat = plate + seam * 0.95 + thin * 0.22 + pulse * 0.08;
    if (uStream > 0.5) heat += 0.4 * (1.0 - smoothstep(0.1, 0.95, abs(vFlow.x)));
    if (uStream < 0.5) heat += 0.3 * (1.0 - smoothstep(10.0, 76.0, length(vWorld.xz)));
    gl_FragColor = vec4(ramp(heat * (1.0 - vFlow.z * 0.85)), 1.0 - smoothstep(0.7, 1.0, vFlow.z));
    #include <colorspace_fragment>
  }
`;

function lavaRibbon(points, height) {
  const pos = [];
  const flow = [];
  const index = [];
  points.forEach(({ x, z, width, along, cool = 0 }, k) => {
    const prev = points[Math.max(0, k - 1)];
    const next = points[Math.min(points.length - 1, k + 1)];
    const length = Math.hypot(next.x - prev.x, next.z - prev.z);
    const nx = -(next.z - prev.z) / length;
    const nz = (next.x - prev.x) / length;
    for (const side of [-1, -0.45, 0, 0.45, 1]) {
      const px = x + nx * width * side;
      const pz = z + nz * width * side;
      pos.push(px, height(px, pz) + 0.7 - Math.abs(side) * 0.4, pz);
      flow.push(side, along, cool);
    }
  });
  for (let k = 0; k < points.length - 1; k++) {
    for (let l = 0; l < 4; l++) {
      const a = k * 5 + l;
      index.push(a, a + 5, a + 1, a + 1, a + 5, a + 6);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aFlow', new THREE.Float32BufferAttribute(flow, 3));
  g.setIndex(index);
  return g;
}

function streamPoints(angle, blocked) {
  const points = [];
  for (let k = 0; k <= 130; k++) {
    const t = k / 54;
    const r = 84 + t * 150;
    const a = angle + 0.16 * Math.sin(t * 7 + angle * 3) * Math.min(t, 1) + 0.05 * Math.sin(t * 19);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (blocked(x, z)) break;
    points.push({ x, z, width: 3 + 4 * Math.min(t, 1.3) + 1.2 * Math.sin(t * 11 + angle), along: t * 150 });
  }
  points.slice(-9).forEach((p, k) => {
    p.cool = (k + 1) / 9;
  });
  return points;
}

function bankPoints(track, s, side, phase, blocked) {
  const points = [];
  const i = track.wrap(Math.round(s / track.spacing));
  const hw = track.hw[i];
  for (let k = 0; k <= 34; k++) {
    const t = k / 34;
    const along = s + (1 - t) * 34 * Math.sin(phase) + 7 * Math.sin(t * 6 + phase);
    const p = track.point(track.wrap(Math.round(along / track.spacing)), side * (hw + 88 - t * 91));
    if (blocked(p.x, p.z)) return null;
    points.push({ x: p.x, z: p.z, width: 2.6 + 3.4 * t + 0.9 * Math.sin(t * 13 + phase), along: t * 100, cool: 1 - smooth(0, 0.16, t) });
  }
  return points;
}

function disc(x, z, radius, y, material) {
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(radius, 48).rotateX(-Math.PI / 2), material);
  mesh.position.set(x, y, z);
  return mesh;
}

const ROCK_BANDS = [0x141216, 0x1e1b20, 0x100f13, 0x26222a, 0x18161a, 0x211e24].map((c) => new THREE.Color(c));
const LEDGE_ASH = new THREE.Color(0x35323a);
const LEDGE_CINDER = new THREE.Color(0x26232a);
const LIT_ROCK = new THREE.Color(0x6e1e0c);
const HOT_ROCK = new THREE.Color(0xff7a22);
const STRATUM = 11;
const VEIN_COOL = 0.42;
const FLOOR_COOL = 0.2;

function strata(s, side, y) {
  return (y + 5 * Math.sin(s * 0.017 + side) + 3 * Math.sin(s * 0.043 - side * 2)) / STRATUM;
}

function cliffOut(s, side, y) {
  const band = strata(s, side, y);
  const bottom = Math.floor(band);
  const terrace = bottom + smooth(0.6, 0.92, band - bottom);
  const lean = 0.75 + 0.9 * noise(s * 1.2, side * 90);
  const bulge = (noise(s * 1.7, side * 300) - 0.5) * 26;
  const chip = 3 * (noise(s * 6.3, y * 6 + side * 40) - 0.5) + 1.4 * Math.sin(s * 0.37 + y * 0.29) + 0.8 * Math.sin(s * 0.91 - y * 0.53);
  return Math.max(CANYON_HALF + 1.5, CANYON_HALF + 8 + bulge + Math.max(0, terrace) * 3.4 * lean + chip);
}

function cliffBack(surface, track, i, side) {
  for (let out = CANYON_HALF + 96; out > CANYON_HALF + 44; out -= 6) {
    const p = track.point(i, side * out);
    const { edge, s } = surface.sample(p.x, p.z);
    if (track.formAt(s) || edge > 16) return p;
  }
  return track.point(i, side * (CANYON_HALF + 44));
}

function cliffGrid(surface, track, height, side, from, to) {
  const rows = 24;
  const step = 8;
  const grid = [];
  for (let s = from; s <= to + 0.1; s += step) {
    const i = track.wrap(Math.round(s / track.spacing));
    const back = cliffBack(surface, track, i, side);
    const top = Math.max(-6, height(back.x, back.z) + 0.8);
    const column = [];
    for (let k = 0; k <= rows; k++) {
      const y = -8 + ((top + 8) * k) / rows;
      const p = track.point(i, side * cliffOut(s, side, y));
      column.push([p.x, y, p.z, s]);
    }
    const shelf = track.point(i, side * (Math.max(cliffOut(s, side, top), CANYON_HALF + 40) + 14));
    column.push([shelf.x, top + 0.4, shelf.z, s]);
    column.push([back.x, top - 3, back.z, s]);
    grid.push(column);
  }
  return grid;
}

function cliffMesh(grid, side) {
  const pos = [];
  const col = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const n = new THREE.Vector3();
  const tint = new THREE.Color();
  const face = (p, q, r) => {
    a.set(p[0], p[1], p[2]);
    b.set(q[0], q[1], q[2]);
    c.set(r[0], r[1], r[2]);
    n.subVectors(b, a).cross(c.clone().sub(a)).normalize();
    if (n.y < -0.98) n.negate();
    const y = (p[1] + q[1] + r[1]) / 3;
    const mid = (p[3] + q[3] + r[3]) / 3;
    const band = Math.floor(strata(mid, side, y));
    tint.copy(ROCK_BANDS[((band % 6) + 6) % 6]);
    tint.multiplyScalar(0.92 + 0.18 * noise(mid * 7, y * 7));
    if (n.y > 0.8 && y > 4) tint.copy(noise(a.x * 4, a.z * 4) > 0.5 ? LEDGE_ASH : LEDGE_CINDER);
    tint.lerp(LIT_ROCK, 0.75 * (1 - smooth(1, 20, y)) ** 2);
    if (y < 4) tint.lerp(HOT_ROCK, 1 - smooth(0.5, 4, y));
    for (const v of [a, b, c]) {
      pos.push(v.x, v.y, v.z);
      col.push(tint.r, tint.g, tint.b);
    }
  };
  for (let i = 0; i < grid.length - 1; i++) {
    for (let k = 0; k < grid[i].length - 1; k++) {
      const p = grid[i][k];
      const q = grid[i + 1][k];
      const r = grid[i + 1][k + 1];
      const t = grid[i][k + 1];
      if (side > 0) {
        face(p, q, r);
        face(p, r, t);
      } else {
        face(p, r, q);
        face(p, t, r);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return new THREE.Mesh(g, toon(0xffffff, { vertexColors: true, side: THREE.DoubleSide }));
}

function cliffVeins(grid, track, side, rand, material) {
  const pos = [];
  const flow = [];
  const index = [];
  const rows = 24;
  const onCliff = (u, k) => {
    const i = Math.min(grid.length - 2, Math.max(0, Math.floor(u)));
    const f = u - i;
    const p = grid[i][k];
    const q = grid[i + 1][k];
    const inward = track.wrap(Math.round(p[3] / track.spacing));
    return {
      x: p[0] + (q[0] - p[0]) * f - side * track.nx[inward] * 0.9,
      y: p[1] + (q[1] - p[1]) * f,
      z: p[2] + (q[2] - p[2]) * f - side * track.nz[inward] * 0.9,
      ax: track.tx[inward],
      az: track.tz[inward],
    };
  };
  const strand = (cells) => {
    const first = pos.length / 3;
    cells.forEach(({ x, y, z, ax, az, width, flat }, k) => {
      pos.push(x - (flat ? 0 : ax * width), y - (flat ? width : 0), z - (flat ? 0 : az * width));
      pos.push(x + (flat ? 0 : ax * width), y + (flat ? width : 0), z + (flat ? 0 : az * width));
      flow.push(-1, k * 4, VEIN_COOL, 1, k * 4, VEIN_COOL);
      if (k > 0) {
        const a = first + (k - 1) * 2;
        index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    });
  };
  for (let u = 4 + rand() * 12; u < grid.length - 4; u += 14 + rand() * 22) {
    let drift = u;
    const cells = [];
    const peak = Math.floor(14 + rand() * (rows - 15));
    for (let k = peak; k >= 0; k--) {
      drift += (rand() - 0.5) * 0.9;
      cells.push({ ...onCliff(drift + 0.3 * Math.sin(k * 1.9), k), width: 0.9 + 1.5 * (1 - k / peak) + rand() * 0.7, flat: false });
    }
    strand(cells);
  }
  for (let u = 6 + rand() * 18; u < grid.length - 14; u += 22 + rand() * 26) {
    let row = 3 + rand() * (rows - 8);
    const cells = [];
    const reach = 7 + Math.floor(rand() * 8);
    for (let k = 0; k <= reach; k++) {
      row += (rand() - 0.5) * 0.9;
      cells.push({ ...onCliff(u + k, Math.max(0, Math.min(rows, Math.round(row)))), width: 0.6 + 1.1 * Math.sin((k / reach) * Math.PI), flat: true });
    }
    strand(cells);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aFlow', new THREE.Float32BufferAttribute(flow, 3));
  g.setIndex(index);
  return new THREE.Mesh(g, material);
}

function cliffFall(track, side, s, width, top, material) {
  const pos = [];
  const flow = [];
  const index = [];
  const rows = 14;
  const cols = 4;
  for (let r = 0; r <= rows; r++) {
    const u = r / rows;
    const y = top + (0.2 - top) * u;
    for (let c = 0; c <= cols; c++) {
      const across = c / cols - 0.5;
      const along = s + across * width;
      const i = track.wrap(Math.round(along / track.spacing));
      const p = track.point(i, side * (cliffOut(along, side, y) - 5));
      pos.push(p.x, y, p.z);
      flow.push(across * 2, u * top * 0.6, 0);
    }
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = r * (cols + 1) + c;
      index.push(a, a + cols + 1, a + 1, a + 1, a + cols + 1, a + cols + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aFlow', new THREE.Float32BufferAttribute(flow, 3));
  g.setIndex(index);
  return new THREE.Mesh(g, material);
}

function fallSource(track, side, s, width, top, phase) {
  const points = [];
  const start = cliffOut(s, side, top) - 6;
  for (let k = 0; k <= 30; k++) {
    const t = k / 30;
    const along = s + 26 * t * Math.sin(phase + t * 3);
    const p = track.point(track.wrap(Math.round(along / track.spacing)), side * (start + t * 96));
    points.unshift({ x: p.x, z: p.z, width: width * (0.5 - 0.3 * t), along: (1 - t) * 90, cool: smooth(0.8, 1, t) });
  }
  return points;
}

function ashPlume(batch, rand) {
  for (let k = 0; k < 54; k++) {
    const t = k / 53;
    const r = 15 + 62 * t * t + rand() * 11;
    const a = rand() * 6.3;
    const spread = r * 0.6;
    batch.add('ashCloud', SPHERE, mat(-150 * t * t + Math.cos(a) * spread, LAVA_Y + 84 + t * 380, 90 * t * t + Math.sin(a) * spread, r, r * (0.72 + rand() * 0.3), r));
  }
}

function burnField(flows, bounds) {
  const cols = Math.ceil((bounds.maxX - bounds.minX) / BURN_CELL) + 2;
  const rows = Math.ceil((bounds.maxZ - bounds.minZ) / BURN_CELL) + 2;
  const heat = new Float32Array(cols * rows);
  for (const flow of flows) {
    for (const { x, z, width } of flow) {
      const reach = width + 34;
      const span = Math.ceil(reach / BURN_CELL);
      const c0 = Math.round((x - bounds.minX) / BURN_CELL);
      const r0 = Math.round((z - bounds.minZ) / BURN_CELL);
      for (let r = Math.max(0, r0 - span); r <= Math.min(rows - 1, r0 + span); r++) {
        for (let c = Math.max(0, c0 - span); c <= Math.min(cols - 1, c0 + span); c++) {
          const d = Math.hypot(bounds.minX + c * BURN_CELL - x, bounds.minZ + r * BURN_CELL - z);
          heat[r * cols + c] = Math.max(heat[r * cols + c], 1 - smooth(width + 4, reach, d));
        }
      }
    }
  }
  return (x, z) => {
    const c = Math.round((x - bounds.minX) / BURN_CELL);
    const r = Math.round((z - bounds.minZ) / BURN_CELL);
    return c < 0 || r < 0 || c >= cols || r >= rows ? 0 : heat[r * cols + c];
  };
}

function headStream(track) {
  const { lip } = track.river.land;
  const { end } = track.river.flight;
  const points = [];
  const top = lip - 232;
  const bottom = end - 200;
  for (let s = top; s >= bottom; s -= 3) {
    const t = (top - s) / (top - bottom);
    const p = track.point(track.wrap(Math.round(s / track.spacing)), 7 * Math.sin(t * 19));
    points.push({ x: p.x, z: p.z, width: 8 + 34 * t + 2 * Math.sin(t * 27), along: t * 680 });
  }
  return points;
}

function fountain(material) {
  const g = new THREE.CylinderGeometry(2, 15, 1, 14, 8, true).translate(0, 0.5, 0);
  const uv = g.attributes.uv;
  const flow = [];
  for (let k = 0; k < uv.count; k++) flow.push(Math.sin(uv.getX(k) * 12.6), (1 - uv.getY(k)) * 90, smooth(0.45, 1, uv.getY(k)));
  g.setAttribute('aFlow', new THREE.Float32BufferAttribute(flow, 3));
  const mesh = new THREE.Mesh(g, material);
  mesh.position.set(0, LAVA_Y - 2, 0);
  return mesh;
}

function charredTree(batch, x, y, z, rand) {
  const height = 6 + rand() * 9;
  const dir = rand() * 6.3;
  const lean = 0.08 + rand() * 0.2;
  const trunk = [];
  for (let k = 0; k <= 4; k++) {
    const t = k / 4;
    trunk.push(new THREE.Vector3(x + Math.cos(dir) * lean * height * t * t, y + height * t, z + Math.sin(dir) * lean * height * t * t));
  }
  const radius = 0.32 + height * 0.025;
  batch.add('trunk', trunkGeometry(trunk, radius, BURNT_BARK));
  const limbs = 2 + Math.floor(rand() * 3);
  for (let k = 0; k < limbs; k++) {
    const from = trunk[2 + (k % 2)];
    const heading = rand() * 6.3;
    const reach = 1.8 + rand() * 2.6;
    const bend = 0.8 + rand() * 1.2;
    const limb = [0, 0.5, 1].map((t) => new THREE.Vector3(from.x + Math.cos(heading) * reach * t, from.y + reach * bend * t * t, from.z + Math.sin(heading) * reach * t));
    batch.add('trunk', trunkGeometry(limb, radius * 0.42, BURNT_BARK));
  }
}

function spires(batch, x, y, z, rand, scale) {
  const count = 2 + Math.floor(rand() * 3);
  for (let k = 0; k < count; k++) {
    const h = scale * (11 + rand() * 24);
    const r = h * (0.13 + rand() * 0.09);
    const a = rand() * 6.3;
    const off = k * scale * (2.4 + rand() * 3);
    batch.add(k % 2 ? 'basaltLight' : 'basalt', SPIRE, mat(x + Math.cos(a) * off, y - 1.5, z + Math.sin(a) * off, r, h, r, (rand() - 0.5) * 0.26, rand() * 6, (rand() - 0.5) * 0.26));
  }
}

async function buildCanyon(surface, batch, canyon, group, track, height, rand, tick, lavaFlow) {
  const { start, end } = track.river.flight;
  const dry = (p) => {
    const { edge, s } = surface.sample(p.x, p.z);
    return track.formAt(s) ? p : edge > 16 ? p : null;
  };
  const length = 420;
  for (const side of [-1, 1]) {
    for (let s = start; s < end; s += length) {
      const grid = cliffGrid(surface, track, height, side, s, Math.min(end, s + length));
      group.add(cliffMesh(grid, side));
      group.add(cliffVeins(grid, track, side, rand, lavaFlow));
      await tick();
    }
  }
  for (let s = start + 340, k = 0; s < end - 340; s += 200 + rand() * 130, k++) {
    const side = k % 2 ? 1 : -1;
    const i = track.wrap(Math.round(s / track.spacing));
    const back = cliffBack(surface, track, i, side);
    const top = height(back.x, back.z);
    if (top < 40) continue;
    const width = 15 + rand() * 12;
    group.add(cliffFall(track, side, s, width, top, lavaFlow));
    group.add(new THREE.Mesh(lavaRibbon(fallSource(track, side, s, width, top, rand() * 6.3), height), lavaFlow));
  }
  for (let s = start + 120, n = 0; s < end - 120; s += 7) {
    if (++n % 30 === 0) await tick();
    const i = track.wrap(Math.round(s / track.spacing));
    const fade = canyonFade(s, start, end);
    for (const side of [-1, 1]) {
      if (fade > 0.2 && rand() < 0.5) {
        const r = 1.5 + rand() * 4.5;
        const p = track.point(i, side * (cliffOut(s, side, 1) - 1 + rand() * 4));
        canyon.add(rand() < 0.5 ? 'basalt' : 'basaltLight', ROCK, mat(p.x, r * 0.25, p.z, r, r * 0.8, r, rand() * 3, rand() * 6, rand() * 3));
      }
      if (fade > 0.4 && rand() < 0.1) {
        const y = 12 + rand() * 60;
        const band = Math.floor(strata(s, side, y));
        const ledge = (band + 1) * STRATUM - 5 * Math.sin(s * 0.017 + side) - 3 * Math.sin(s * 0.043 - side * 2);
        const p = track.point(i, side * (cliffOut(s, side, ledge) + 1.5));
        const back = cliffBack(surface, track, i, side);
        const top = height(back.x, back.z);
        if (dry(p) && ledge < top - 6 && ledge > 6) charredTree(batch, p.x, ledge - 0.4, p.z, rand);
      }
      if (fade > 0.5 && rand() < 0.16) {
        const p = track.point(i, side * (CANYON_HALF + 74 + rand() * 18));
        const y = height(p.x, p.z);
        if (y > 30 && dry(p)) {
          if (rand() < 0.4) charredTree(batch, p.x, y - 0.4, p.z, rand);
          else spires(batch, p.x, y, p.z, rand, 1.1);
        }
      }
    }
  }
}

function canyonLava(track, material) {
  const { end } = track.river.flight;
  const { launch } = track.river.land;
  const side = uphillSide(track, track.wrap(Math.round(launch / track.spacing)));
  const across = 12;
  const pos = [];
  const flow = [];
  const index = [];
  let rows = 0;
  for (let row = launch + LAVA_START; row <= end; row += 8) {
    const y = LAVA_ENTRY + (LAVA_FLOOR - LAVA_ENTRY) * smooth(40, 320, row - launch);
    const sway = 1 - smooth(0, 44, row - launch - LAVA_START);
    for (let c = 0; c <= across; c++) {
      const u = (c / across) * 2 - 1;
      const s = frontRow(row, u, side, sway);
      const i = track.wrap(Math.round(s / track.spacing));
      const lat = u * (cliffOut(s, Math.sign(u) || 1, 1) + 14);
      const p = track.point(i, lat);
      pos.push(p.x, y, p.z);
      flow.push(lat / 24, s - launch, FLOOR_COOL);
    }
    rows++;
  }
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < across; c++) {
      const a = r * (across + 1) + c;
      index.push(a, a + across + 1, a + 1, a + 1, a + across + 1, a + across + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aFlow', new THREE.Float32BufferAttribute(flow, 3));
  g.setIndex(index);
  return new THREE.Mesh(g, material);
}

const uphillSide = (track, i) => (track.px[i] * track.nx[i] + track.pz[i] * track.nz[i] < 0 ? 1 : -1);

function frontRow(s, u, side, sway) {
  return s - sway * (LAVA_REACH * (0.5 + 0.5 * u * side) + 5 * Math.sin(u * 7));
}

function lavaFront(track, steam) {
  const { launch } = track.river.land;
  const i = track.wrap(Math.round(launch / track.spacing));
  const side = uphillSide(track, i);
  for (let u = -1; u <= 1; u += 0.14) {
    const s = frontRow(launch + LAVA_START, u, side, 1);
    const j = track.wrap(Math.round(s / track.spacing));
    steam.push({ ...track.point(j, u * track.hw[j]), y: track.baseLevel(s) + 0.4, blast: true });
  }
}

function overrun(track) {
  const { launch } = track.river.land;
  const i = track.wrap(Math.round((launch + 30) / track.spacing));
  const side = uphillSide(track, i);
  const reach = Math.hypot(track.px[i], track.pz[i]);
  const mouth = track.point(i, -side * track.hw[i] * 0.55);
  const dirX = -track.px[i] / reach;
  const dirZ = -track.pz[i] / reach;
  const points = [];
  for (let k = 0; k <= 110; k++) {
    const t = k / 110;
    const out = OVERRUN * (1 - t);
    const wander = 26 * Math.sin(t * 7) * (1 - t);
    points.push({ x: mouth.x + dirX * out - dirZ * wander, z: mouth.z + dirZ * out + dirX * wander, width: 9 + 34 * t * t + 2 * Math.sin(t * 19), along: t * OVERRUN, cool: 1 - smooth(0, 0.05, t) });
  }
  return points;
}

function buildSource(batch, group, track, rand) {
  const lakeIdx = track.wrap(Math.round((track.river.land.lip + 26) / track.spacing));
  const lake = track.point(lakeIdx, 0);
  const top = track.river.top;
  const back = new THREE.Vector3(track.nx[lakeIdx], 0, track.nz[lakeIdx]);
  const cave = new THREE.Vector3(lake.x + back.x * 92, 0, lake.z + back.z * 92);
  for (let k = 0; k < 34; k++) {
    const a = (k / 34) * Math.PI;
    const r = 10 + rand() * 7;
    const lat = Math.cos(a) * 30;
    const up = Math.sin(a) * 34;
    batch.add(k % 2 ? 'basalt' : 'basaltLight', ROCK, mat(cave.x - back.z * lat, top + up + 4, cave.z + back.x * lat, r, r, r, rand(), rand() * 6, rand()));
  }
  const sheet = new THREE.Mesh(new THREE.CylinderGeometry(26, 34, 44, 28, 1, true, 0, Math.PI), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }));
  sheet.position.set(cave.x, top + 20, cave.z);
  sheet.rotation.y = Math.atan2(back.x, back.z) + Math.PI / 2;
  group.add(sheet);
  return { x: lake.x, y: top, z: lake.z, cave, back };
}

export async function createVolcano(group, track, fx) {
  const tick = slicer();
  const fog = new THREE.Fog(SKY, 300, 1500);
  const sky = createSky({ top: DAY.top, horizon: DAY.horizon });
  group.add(sky);
  const hemi = new THREE.HemisphereLight(DAY.hemiSky, DAY.hemiGround, DAY.hemi);
  group.add(hemi);
  const sun = new THREE.DirectionalLight(DAY.sun, DAY.sunPower);
  sun.position.copy(SUN_DIR).multiplyScalar(100);
  group.add(sun);
  const paintLight = (g) => {
    const blend = (key, target) => target.set(DAY[key]).lerp(colorOf[key], g);
    blend('top', sky.material.uniforms.uTop.value);
    blend('horizon', sky.material.uniforms.uHorizon.value);
    fog.color.copy(sky.material.uniforms.uHorizon.value);
    blend('hemiSky', hemi.color);
    blend('hemiGround', hemi.groundColor);
    blend('sun', sun.color);
    hemi.intensity = DAY.hemi + (ASH.hemi - DAY.hemi) * g;
    sun.intensity = DAY.sunPower + (ASH.sunPower - DAY.sunPower) * g;
  };
  const colorOf = Object.fromEntries(['top', 'horizon', 'hemiSky', 'hemiGround', 'sun'].map((key) => [key, new THREE.Color(ASH[key])]));

  const surface = await riverSurface(track, tick);
  track.river.flight = await flightField(surface, track, tick);
  const height = (x, z) => groundHeight(surface, track, x, z);
  const { launch, lip } = track.river.land;
  const bounds = {
    minX: Math.min(surface.bounds.minX, -640),
    maxX: Math.max(surface.bounds.maxX, ISLAND.x + ISLAND.rx * 1.08),
    minZ: Math.min(surface.bounds.minZ, ISLAND.z - ISLAND.rz * 1.08),
    maxZ: Math.max(surface.bounds.maxZ, ISLAND.z + ISLAND.rz * 1.08),
  };

  const batch = new Batcher();
  const rand = mulberry32(6660);
  const blobs = [];
  const steam = [];
  lavaFront(track, steam);
  const source = buildSource(batch, group, track, rand);
  const trim = new Batcher();
  const canyon = new Batcher();
  const occupied = buildBase(batch, trim, track, height, launch);
  const reachesRiver = (x, z, margin) => {
    const { edge, s } = surface.sample(x, z);
    return edge < margin && !track.formAt(s);
  };
  const flows = [headStream(track), overrun(track)];
  for (const a of [0.5, 1.15, 1.9, 2.5, 3.2, 5.7, 6.05]) flows.push(streamPoints(a, (x, z) => reachesRiver(x, z, 2) || occupied(x, z)));
  for (let s = 160; s < launch - 200; s += 190 + rand() * 170) {
    const clearOfDrops = track.river.drops.every((d) => Math.abs(d.s - s) > 70);
    const clearOfBridges = [0.31, 0.66].every((u) => Math.abs(u * launch - s) > 60);
    if (!clearOfDrops || !clearOfBridges) continue;
    const points = bankPoints(track, s, rand() < 0.5 ? -1 : 1, rand() * 6.3, occupied);
    if (points) flows.push(points);
  }
  await tick();
  const burnt = burnField(flows, bounds);
  const scorched = (x, z) => Math.max(burnt(x, z), 1 - smooth(CANYON_HALF + 110, CANYON_HALF + 190, track.river.flight.dist(x, z) + (1 - track.river.flight.weight(x, z)) * 200));

  const sand = new THREE.Color(0x2c2a2e);
  const mossy = new THREE.Color(0x3c7a1c);
  const grass = new THREE.Color(0x5e9e26);
  const dark = new THREE.Color(PALETTE.basalt);
  const pale = new THREE.Color(PALETTE.basaltLight);
  const ember = new THREE.Color(0xb8340f);
  group.add(await groundMesh({ bounds }, height, (x, y, z, n, out) => {
    const r = Math.hypot(x, z);
    const steep = 1 - n.y;
    if (y < 3.6) out.copy(sand);
    else if (y < 100 && r > 240) out.copy(grass).lerp(mossy, noise(x * 3, z * 3) > 0.55 ? 0.6 : 0);
    else if (steep > 0.62) out.copy(noise(x * 2, z * 2) > 0.5 ? dark : pale);
    else out.copy(noise(x * 2, z * 2) > 0.52 ? dark : pale);
    if (y >= 3.6) out.lerp(noise(x * 2, z * 2) > 0.5 ? dark : pale, smooth(0.15, 0.6, scorched(x, z) + 0.3 * (noise(x * 4, z * 4) - 0.5)));
    if (r > 66 && r < 108) out.lerp(ember, (1 - smooth(80, 108, r)) * 0.6);
  }, tick, 6));
  await tick();

  const water = seaStrip(track, Math.round((lip - 2) / track.spacing), Math.round((launch + LAVA_START + 8) / track.spacing) + track.N, WATER);
  group.add(water.mesh);
  const ocean = createWater({ size: 2600, segments: 180, amp: 0.45, ...WATER });
  ocean.mesh.position.y = 0;
  group.add(ocean.mesh);

  const rapids = track.river.drops.map((drop) => buildFalls(track, drop));
  for (const f of rapids) group.add(f.mesh);

  const lavaMat = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uStream: { value: 0 } }, vertexShader: LAVA_VERT, fragmentShader: LAVA_FRAG });
  const streamMat = lavaMat.clone();
  streamMat.side = THREE.DoubleSide;
  streamMat.transparent = true;
  streamMat.uniforms.uStream.value = 1;
  group.add(disc(0, 0, 90, LAVA_Y - 1, lavaMat));
  const spout = fountain(streamMat);
  group.add(spout);
  const aboveRiver = (x, z) => {
    const { level, s } = surface.sample(x, z);
    return Math.max(height(x, z) + 0.9, (track.formAt(s) ? LAVA_ENTRY : level) - 0.3);
  };
  for (const points of flows) {
    group.add(new THREE.Mesh(lavaRibbon(points, aboveRiver), streamMat));
    const { x, z } = points[points.length - 1];
    if (reachesRiver(x, z, 8)) steam.push({ x, y: surface.sample(x, z).level + 0.4, z });
    await tick();
  }
  ashPlume(batch, rand);

  const lush = (x, z, y) => surface.sample(x, z).edge >= 18 && !occupied(x, z) && scorched(x, z) < 0.12 && y > 2.2 && y < 110;
  for (let k = 0; k < 900; k++) {
    const nearRiver = k % 2 === 0;
    const a = rand() * 6.3;
    const u = Math.sqrt(rand());
    const spot = nearRiver
      ? track.point(track.wrap(Math.round((rand() * launch) / track.spacing)), (rand() < 0.5 ? -1 : 1) * (50 + rand() * 170))
      : { x: ISLAND.x + Math.cos(a) * u * ISLAND.rx, z: ISLAND.z + Math.sin(a) * u * ISLAND.rz };
    const y = height(spot.x, spot.z);
    if (lush(spot.x, spot.z, y)) {
      if (k % 4 === 3) jungleClump(batch, spot.x, y - 0.3, spot.z, rand, 3.5 + rand() * 3);
      else addPalm(batch, spot.x, y - 0.4, spot.z, rand, { height: 7 + rand() * 7, lean: rand() * 0.4, dir: rand() * 6.3 });
    } else if (k % 3 === 0 && burnt(spot.x, spot.z) > 0.12 && y > 4 && surface.sample(spot.x, spot.z).edge >= 34 && !occupied(spot.x, spot.z)) {
      charredTree(batch, spot.x, y - 0.4, spot.z, rand);
    }
    if (k % 30 === 0) await tick();
  }
  for (let k = 0; k < 120; k++) {
    const a = rand() * 6.3;
    const r = 110 + rand() * 360;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (surface.sample(x, z).edge < 14 || occupied(x, z)) continue;
    const s = 3 + rand() * 7;
    batch.add(k % 2 ? 'basalt' : 'basaltLight', ROCK, mat(x, height(x, z) + s * 0.2, z, s, s * 0.8, s, rand(), rand() * 6, rand()));
  }
  for (let k = 0; k < 30; k++) {
    const s = 120 + rand() * (launch - 240);
    const i = track.wrap(Math.round(s / track.spacing));
    const lat = (rand() < 0.5 ? -1 : 1) * (track.hw[i] * 0.3 + rand() * track.hw[i] * 0.5);
    const p = track.point(i, lat);
    const level = track.level(s);
    const r = 2.8 + rand() * 2.2;
    batch.add('basalt', ROCK, mat(p.x, level + 0.5, p.z, r, r * 0.9, r, rand(), rand() * 6, rand()));
    blobs.push({ x: p.x, z: p.z, rx: r * 0.9, rz: r * 0.9, rot: 0, top: level + r * 0.6, launch: true });
  }
  await buildCanyon(surface, batch, canyon, group, track, height, rand, tick, streamMat);
  group.add(canyonLava(track, streamMat));
  const scenery = new THREE.Group();
  const chunks = await batch.buildAsync(scenery, 0.1, PALETTE, 120, tick);
  chunks.push(...(await trim.buildAsync(scenery, 0, PALETTE, 120, tick)));
  chunks.push(...(await canyon.buildAsync(scenery, 0.12, PALETTE, 280, tick)));
  group.add(scenery);
  group.add(createArch(track, track.halfWidth));

  const clouds = [];
  for (let i = 0; i < 10; i++) {
    const cloud = createCloud(rand);
    const a = rand() * Math.PI * 2;
    const d = 300 + rand() * 700;
    cloud.position.set(ISLAND.x + Math.cos(a) * d, 330 + rand() * 90, ISLAND.z + Math.sin(a) * d);
    clouds.push(cloud);
    group.add(cloud);
  }

  let gloom = 0;
  let lava = 0;
  return {
    fog,
    water,
    sun,
    surface,
    shores: blobs,
    spray: { foam: 0xffffff, tint: 0xbff6ff, wake: 0xe7f9ff, glow: 0x1c1a1c },
    solid(p) {
      return groundHit(height, p);
    },
    update(t, dt, camera) {
      water.update(t);
      ocean.update(t);
      ocean.mesh.position.x = Math.round(camera.position.x / 30) * 30;
      ocean.mesh.position.z = Math.round(camera.position.z / 30) * 30;
      for (const f of rapids) f.material.uniforms.uTime.value = t;
      lavaMat.uniforms.uTime.value = t;
      for (const v of steam) {
        if (Math.random() > dt * 9 || Math.hypot(v.x - camera.position.x, v.z - camera.position.z) > 320) continue;
        const power = v.blast ? 1.3 : 1;
        fx.puffs.emit(v.x + (Math.random() - 0.5) * 8, v.y, v.z + (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 3, (5 + Math.random() * 7) * power, (Math.random() - 0.5) * 3, (1.4 + Math.random() * 2) * Math.sqrt(power), 1.6, 0xffffff, -0.6, 0.4, 0);
      }
      for (let k = Math.floor(dt * 34 * gloom + Math.random()); k > 0; k--) {
        const a = Math.random() * 6.3;
        const r = 14 + Math.random() * 70;
        const up = -12 + Math.random() * 44;
        const hot = Math.random() < 0.6;
        fx.puffs.emit(camera.position.x + Math.cos(a) * r, Math.max(1, camera.position.y + up), camera.position.z + Math.sin(a) * r, 3 * (Math.random() - 0.5), hot ? 2 + Math.random() * 5 : -2, 3 * (Math.random() - 0.5), hot ? 0.07 + Math.random() * 0.09 : 0.1 + Math.random() * 0.1, 2.6, hot ? 0xff8a2a : 0x241f22, 0, 0, 1);
      }
      streamMat.uniforms.uTime.value = t;
      cullChunks(chunks, camera, fog.far);
      sky.position.copy(camera.position);
      const here = surface.sample(camera.position.x, camera.position.z);
      const { start, end } = track.river.flight;
      const inCanyon = canyonFade(here.s, start, end) * (1 - smooth(70, 220, here.edge));
      gloom += (inCanyon - gloom) * (1 - Math.exp(-1.6 * dt));
      if (Math.abs(inCanyon - lava) > 0.002 || Math.abs(gloom - lava) > 0.002) {
        lava = gloom;
        paintLight(gloom);
      }
      spout.scale.set(1 + 0.12 * Math.sin(t * 7), 62 + 26 * Math.sin(t * 1.7) + 12 * Math.sin(t * 4.3), 1 + 0.12 * Math.cos(t * 6));
      if (Math.random() < dt * 60) {
        const a = Math.random() * 6.3;
        const r = 12 + Math.random() * 22;
        fx.puffs.emit(source.cave.x + Math.cos(a) * r, source.y + 2, source.cave.z + Math.sin(a) * r, (Math.random() - 0.5) * 6, 24 + Math.random() * 30, (Math.random() - 0.5) * 6, 2 + Math.random() * 3, 3, 0xffffff, 8, 0.2, 0);
      }
      if (Math.random() < dt * 24) {
        const a = Math.random() * 6.3;
        const r = Math.random() * 46;
        fx.puffs.emit(Math.cos(a) * r, LAVA_Y + 4, Math.sin(a) * r, (Math.random() - 0.5) * 3, 30 + Math.random() * 16, (Math.random() - 0.5) * 3, 2.5 + Math.random() * 3, 4, Math.random() < 0.2 ? 0xff7a1f : 0x3a3538, -1, 0.3, 0);
      }
      for (let k = Math.floor(dt * 70 + Math.random()); k > 0; k--) {
        const a = Math.random() * 6.3;
        const spread = 10 + Math.random() * 34;
        fx.puffs.emit(Math.cos(a) * 12, LAVA_Y + 8, Math.sin(a) * 12, Math.cos(a) * spread, 60 + Math.random() * 62, Math.sin(a) * spread, 1 + Math.random() * 2.4, 4.6, Math.random() < 0.5 ? 0xffb02e : 0xff5a1f, 34, 0, 0);
      }
    },
  };
}
