import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mat } from './world.js';
import { toon } from './toon.js';

export const DOCK_COLORS = {
  boxRed: 0xb3412f,
  boxBlue: 0x2f5e9e,
  boxGreen: 0x3f7d4f,
  boxOrange: 0xd9772b,
  boxGrey: 0x8b9096,
  boxWhite: 0xd8d6cf,
  boxYellow: 0xd8b13a,
  boxTeal: 0x2f8a87,
  boxMaroon: 0x7a2f3a,
  craneRed: 0xc7432f,
  craneBlue: 0x2f6fb3,
  craneWhite: 0xe3ded3,
  craneYellow: 0xe0b53a,
  steel: 0x5a6068,
  steelDark: 0x34383e,
  concrete: 0x7c7d80,
  concreteDark: 0x56575b,
  hullRed: 0x8a2e2a,
  hullBlack: 0x24262b,
  deck: 0x4f6b4a,
  cabin: 0xe9e6dd,
  tank: 0xc9cdd0,
  tankRust: 0x9a5a3a,
  shed: 0x6f8597,
  shedTrim: 0x56697a,
  shedRoof: 0x4f5963,
  shedDoor: 0x3d4650,
  skylight: 0x8fa3b8,
  rubber: 0x1c1c1f,
  hazard: 0xe2b62f,
  rope: 0xcfc6ae,
  pallet: 0xa98457,
  drumBlue: 0x2c5d8f,
  drumRed: 0xa33a2c,
  drumYellow: 0xc9a23a,
  brick: 0x8c4a3a,
  stripeWhite: 0xe8e4dc,
  pipeGreen: 0x4f7a5a,
  pipeSilver: 0xa9afb5,
};

export const GLOW_COLORS = {
  lampWarm: 0xffd59a,
  lampCool: 0xe6efff,
  windowLit: 0xffc96f,
  signal: 0xff3b30,
};

export const CONTAINER_PAINTS = ['boxRed', 'boxBlue', 'boxGreen', 'boxOrange', 'boxGrey', 'boxWhite', 'boxYellow', 'boxTeal', 'boxMaroon', 'boxBlue', 'boxRed'];

const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 12);
const POST = new THREE.CylinderGeometry(1, 1, 1, 6);
const DOME = new THREE.SphereGeometry(1, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2);
const BULB = new THREE.SphereGeometry(1, 8, 6);
const roofShape = new THREE.Shape([new THREE.Vector2(-1, 0), new THREE.Vector2(1, 0), new THREE.Vector2(0, 1)]);
const ROOF = new THREE.ExtrudeGeometry(roofShape, { depth: 1, bevelEnabled: false }).translate(0, 0, -0.5);
const UP = new THREE.Vector3(0, 1, 0);

function corrugated(length, width, height, ribs) {
  const depth = 0.07;
  const shape = new THREE.Shape();
  shape.moveTo(-length / 2, -width / 2);
  for (let i = 1; i <= ribs * 2; i++) shape.lineTo(-length / 2 + (i / (ribs * 2)) * length, -width / 2 - (i % 2 ? depth : 0));
  shape.lineTo(length / 2, width / 2);
  for (let i = 1; i <= ribs * 2; i++) shape.lineTo(length / 2 - (i / (ribs * 2)) * length, width / 2 + (i % 2 ? depth : 0));
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false }).rotateX(-Math.PI / 2);
}

function solid(parts) {
  return mergeGeometries(parts.map((g) => {
    const flat = g.index ? g.toNonIndexed() : g;
    flat.deleteAttribute('uv');
    return flat;
  }));
}

const block = (x, y, z, sx, sy, sz) => BOX.clone().scale(sx, sy, sz).translate(x, y, z);

function ribbedWalls(loop, height) {
  let area = 0;
  for (let k = 0; k < loop.length; k++) {
    const [ax, az] = loop[k];
    const [bx, bz] = loop[(k + 1) % loop.length];
    area += ax * bz - bx * az;
  }
  const pts = area > 0 ? [...loop].reverse() : loop;
  const pos = [];
  for (let k = 0; k < pts.length; k++) {
    const [ax, az] = pts[k];
    const [bx, bz] = pts[(k + 1) % pts.length];
    pos.push(ax, 0, az, bx, 0, bz, bx, height, bz, ax, 0, az, bx, height, bz, ax, height, az);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

function ribRun(from, to, ribs, out, depth, edge) {
  const [fx, fz] = from;
  const [tx, tz] = to;
  const len = Math.hypot(tx - fx, tz - fz);
  const ux = (tx - fx) / len;
  const uz = (tz - fz) / len;
  const pitch = (len - 2 * edge) / ribs;
  const pts = [];
  const at = (s, d) => pts.push([fx + ux * s + out[0] * d, fz + uz * s + out[1] * d]);
  at(0, 0);
  for (let r = 0; r < ribs; r++) {
    const s = edge + r * pitch;
    at(s + pitch * 0.15, 0);
    at(s + pitch * 0.35, depth);
    at(s + pitch * 0.65, depth);
    at(s + pitch * 0.85, 0);
  }
  return pts;
}

export const CONTAINER = { long: 12.2, short: 6.1, width: 2.44, height: 2.6 };

function containerGeometry(length, ribs, endRibs, doors) {
  const { width: W, height: H } = CONTAINER;
  const L = length;
  const d = 0.1;
  const loop = [
    ...ribRun([-L / 2, -W / 2], [L / 2, -W / 2], ribs, [0, -1], d, 0.2),
    [L / 2, -W / 2],
    ...ribRun([L / 2, W / 2], [-L / 2, W / 2], ribs, [0, 1], d, 0.2),
    ...(endRibs ? ribRun([-L / 2, W / 2], [-L / 2, -W / 2], endRibs, [-1, 0], d, 0.2) : [[-L / 2, W / 2]]),
  ];
  const rail = W + 2 * d + 0.06;
  const parts = [
    ribbedWalls(loop, H),
    block(-0.04, H - 0.11, 0, L + 0.3, 0.22, rail),
    block(-0.04, 0.11, 0, L + 0.3, 0.22, rail),
  ];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push(block(sx * (L / 2 - 0.02), H / 2, sz * (W / 2 + 0.02), 0.32, H, 0.32));
  if (doors) {
    const x = L / 2 + 0.05;
    for (const sz of [-1, 1]) parts.push(block(x, H / 2, sz * (W / 4 + 0.02), 0.05, H - 0.44, W / 2 - 0.2));
    for (const z of [-0.95, -0.35, 0.35, 0.95]) {
      parts.push(block(x + 0.06, H / 2, z, 0.06, H - 0.36, 0.07));
      parts.push(block(x + 0.08, H * 0.42, z + Math.sign(z) * 0.12, 0.05, 0.07, 0.28));
    }
  }
  return solid(parts);
}

const LONG_BOX = containerGeometry(CONTAINER.long, 14, 5, true);
const SHORT_BOX = containerGeometry(CONTAINER.short, 7, 5, true);
export const CONTAINER_GEOMETRY = LONG_BOX;
const LONG_PLAIN = containerGeometry(CONTAINER.long, 5, 0, false);
const SHORT_PLAIN = containerGeometry(CONTAINER.short, 3, 0, false);

const BRANDS = [
  ['BONANZA', '#ffd23f', 'star'],
  ['KRAKEN LINE', '#ffffff', 'wave'],
  ['BARNACLE & CO', '#f4efe2', 'ring'],
  ['GULLWAY', '#ffffff', 'tri'],
  ['SALTY', '#ffe7a3', 'diamond'],
  ['RUSTBUCKET', '#ffffff', 'fish'],
  ['OCTO FREIGHT', '#ffd6e6', 'ring'],
  ['SEA BISCUIT', '#fff3c4', 'star'],
  ['PUFFIN CARGO', '#ffffff', 'tri'],
  ['HARBOR KING', '#ffe08a', 'diamond'],
  ['TUGTEC', '#ffffff', 'wave'],
  ['MERMAID MOVERS', '#c9f2ff', 'fish'],
  ['DEEP BLUE', '#ffffff', 'wave'],
  ['ANCHOVY', '#ffffff', 'fish'],
  ['NAUTICO', '#ffd23f', 'star'],
  ['WAVEFORM', '#ffffff', 'ring'],
];

function drawLogo(ctx, kind, cx, cy, r, color) {
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = r * 0.28;
  ctx.beginPath();
  if (kind === 'star') {
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2 - Math.PI / 2;
      const rr = k % 2 ? r * 0.45 : r;
      ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    ctx.fill();
  } else if (kind === 'wave') {
    for (const dy of [-0.35, 0.35]) {
      ctx.beginPath();
      for (let k = 0; k <= 20; k++) {
        const t = k / 20;
        ctx.lineTo(cx - r + t * 2 * r, cy + dy * r + Math.sin(t * Math.PI * 3) * r * 0.25);
      }
      ctx.stroke();
    }
  } else if (kind === 'ring') {
    ctx.arc(cx, cy, r * 0.8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.3, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'tri') {
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r, cy + r * 0.8);
    ctx.lineTo(cx - r, cy + r * 0.8);
    ctx.fill();
  } else if (kind === 'diamond') {
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r * 0.75, cy);
    ctx.lineTo(cx, cy + r);
    ctx.lineTo(cx - r * 0.75, cy);
    ctx.fill();
  } else {
    ctx.ellipse(cx + r * 0.15, cy, r * 0.75, r * 0.45, 0, 0, Math.PI * 2);
    ctx.moveTo(cx - r * 0.5, cy);
    ctx.lineTo(cx - r, cy - r * 0.45);
    ctx.lineTo(cx - r, cy + r * 0.45);
    ctx.fill();
  }
}

function brandAtlas() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  BRANDS.forEach(([name, color, logo], k) => {
    const x0 = (k % 2) * 512;
    const y0 = Math.floor(k / 2) * 128;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y0, 512, 128);
    ctx.clip();
    drawLogo(ctx, logo, x0 + 64, y0 + 64, 40, color);
    let size = 70;
    ctx.font = `900 ${size}px Impact, "Arial Black", sans-serif`;
    const width = ctx.measureText(name).width || 300;
    if (width > 400) {
      size *= 400 / width;
      ctx.font = `900 ${size}px Impact, "Arial Black", sans-serif`;
    }
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText(name, x0 + 116, y0 + 66);
    ctx.restore();
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export class Decals {
  constructor() {
    this.items = [];
  }
  add(matrix, cell) {
    this.items.push({ matrix, cell });
  }
  build(parent) {
    if (!this.items.length) return null;
    const geometry = new THREE.PlaneGeometry(1, 1);
    const cells = new Float32Array(this.items.length * 2);
    this.items.forEach(({ cell }, k) => {
      cells[k * 2] = (cell % 2) * 0.5;
      cells[k * 2 + 1] = 1 - (Math.floor(cell / 2) + 1) * 0.125;
    });
    geometry.setAttribute('aCell', new THREE.InstancedBufferAttribute(cells, 2));
    const material = toon(0xffffff, { map: brandAtlas(), alphaTest: 0.45 });
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = 'attribute vec2 aCell;\n' + shader.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\nvMapUv = vMapUv * vec2(0.5, 0.125) + aCell;');
    };
    const mesh = new THREE.InstancedMesh(geometry, material, this.items.length);
    this.items.forEach(({ matrix }, k) => mesh.setMatrixAt(k, matrix));
    mesh.computeBoundingSphere();
    parent.add(mesh);
    return mesh;
  }
}

export const brandCount = BRANDS.length;

function frame(batch, x, y, z, yaw) {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const world = (lx, ly, lz) => new THREE.Vector3(x + lx * c + lz * s, y + ly, z - lx * s + lz * c);
  const put = (key, geometry, lx, ly, lz, sx, sy, sz, rx = 0, ry = 0, rz = 0) =>
    batch.add(key, geometry, mat(x + lx * c + lz * s, y + ly, z - lx * s + lz * c, sx, sy, sz, rx, yaw + ry, rz));
  put.strut = (key, a, b, t, tz = t) => {
    const from = world(...a);
    const to = world(...b);
    const dir = to.clone().sub(from);
    const len = dir.length();
    const q = new THREE.Quaternion().setFromUnitVectors(UP, dir.divideScalar(len));
    const twist = new THREE.Quaternion().setFromAxisAngle(UP, yaw);
    q.multiply(twist);
    batch.add(key, BOX, new THREE.Matrix4().compose(from.add(to).multiplyScalar(0.5), q, new THREE.Vector3(t, len, tz)));
  };
  put.decal = (decals, cell, lx, ly, lz, w, h, ry = 0) => {
    if (!decals) return;
    const p = world(lx, ly, lz);
    decals.add(mat(p.x, p.y, p.z, w, h, 1, 0, yaw + ry, 0), cell);
  };
  put.world = world;
  return put;
}

const pick = (list, rand) => list[Math.floor(rand() * list.length)];

function labelBox(put, decals, cell, lx, ly, lz, long) {
  const W = CONTAINER.width / 2 + 0.13;
  const w = long ? 6.4 : 3.6;
  const h = w / 4;
  for (const side of [-1, 1]) put.decal(decals, cell, lx, ly + CONTAINER.height * 0.55, lz + side * W, w, h, side > 0 ? 0 : Math.PI);
}

export function containerStack(batch, x, y, z, yaw, rand, { rows = 3, bays = 2, tiers = 3, short = 0.2, detail = false, decals = null } = {}) {
  const put = frame(batch, x, y, z, yaw);
  const pitchX = CONTAINER.long + 0.5;
  const pitchZ = CONTAINER.width + 0.25;
  const line = Math.floor(rand() * BRANDS.length);
  const brand = () => (rand() < 0.55 ? line : Math.floor(rand() * BRANDS.length));
  for (let b = 0; b < bays; b++) {
    for (let r = 0; r < rows; r++) {
      const lx = (b - (bays - 1) / 2) * pitchX;
      const lz = (r - (rows - 1) / 2) * pitchZ;
      const outer = r === 0 || r === rows - 1;
      const levels = 1 + Math.floor(rand() * tiers);
      for (let t = 0; t < levels; t++) {
        const ly = t * (CONTAINER.height + 0.04);
        const jitter = (rand() - 0.5) * 0.25;
        const flip = rand() < 0.5 ? Math.PI : 0;
        const labelled = detail && outer && rand() < 0.7;
        if (rand() < short) {
          for (const half of [-1, 1]) {
            const hx = lx + half * (CONTAINER.short / 2 + 0.05);
            put(pick(CONTAINER_PAINTS, rand), detail ? SHORT_BOX : SHORT_PLAIN, hx, ly, lz, 1, 1, 1, 0, flip + jitter * 0.04);
            if (labelled) labelBox(put, decals, brand(), hx, ly, lz, false);
          }
        } else {
          put(pick(CONTAINER_PAINTS, rand), detail ? LONG_BOX : LONG_PLAIN, lx + jitter, ly, lz, 1, 1, 1, 0, flip + jitter * 0.03);
          if (labelled) labelBox(put, decals, brand(), lx + jitter, ly, lz, true);
        }
      }
    }
  }
  return { x, z, r: Math.hypot(bays * pitchX, rows * pitchZ) / 2 };
}

export function quayCrane(batch, glow, x, y, z, yaw, rand, { reach = 34, color = 'craneRed', decals = null } = {}) {
  const put = frame(batch, x, y, z, yaw);
  const lit = frame(glow, x, y, z, yaw);
  const H = 24 + rand() * 4;
  const top = H + 2.2;
  const back = -30;
  const span = reach - back;
  const gauge = 16;
  for (const lx of [-7, 7]) {
    for (const lz of [0, -gauge]) {
      put(color, BOX, lx, H / 2, lz, 1.4, H, 1.4);
      put('steelDark', BOX, lx, 0.7, lz, 2.4, 1.4, 3.4);
      for (const w of [-0.9, 0.9]) put('rubber', CYL, lx, 0.45, lz + w, 0.45, 0.5, 0.45, 0, 0, Math.PI / 2);
    }
    put(color, BOX, lx, 1.6, -gauge / 2, 1.2, 1.2, gauge);
    put(color, BOX, lx, H - 0.6, -gauge / 2, 1.2, 1.2, gauge);
    put.strut(color, [lx, 1.8, 0], [lx, H - 1.2, -gauge], 0.7);
  }
  for (const lz of [0, -gauge]) {
    put(color, BOX, 0, H - 0.7, lz, 15.4, 1.4, 1.6);
    put(color, BOX, 0, H * 0.45, lz, 14, 0.9, 0.9);
  }
  for (const lx of [-2.6, 2.6]) {
    put(color, BOX, lx, H + 1.1, back + span / 2, 1.3, 2.2, span);
    put('steel', BOX, lx, top + 0.15, back + span / 2, 0.3, 0.3, span);
  }
  for (let lz = back + 2; lz < reach; lz += 4) put(color, BOX, 0, H + 0.25, lz, 5.2, 0.35, 0.35);
  const apex = [top + 15, -7];
  for (const lx of [-2.6, 2.6]) {
    put.strut(color, [lx, top, -1], [lx, apex[0], apex[1]], 1);
    put.strut(color, [lx, top, -gauge + 1], [lx, apex[0], apex[1]], 1);
    put.strut('steel', [lx, apex[0], apex[1]], [lx, top, reach - 1], 0.22);
    put.strut('steel', [lx, apex[0], apex[1]], [lx, top, back + 1], 0.22);
  }
  put(color, BOX, 0, apex[0] + 0.3, apex[1], 6.4, 1, 1);
  put('craneWhite', BOX, 0, top + 2.5, back + 6, 7, 5, 10);
  put('steelDark', BOX, 0, top + 5.2, back + 6, 7.4, 0.5, 10.4);
  put.decal(decals, Math.floor(rand() * BRANDS.length), 3.52, top + 2.6, back + 6, 8, 2, Math.PI / 2);
  const trolley = 6 + rand() * (reach - 14);
  put('steelDark', BOX, 0, H + 0.6, trolley, 3.8, 1.6, 4);
  put('craneWhite', BOX, 1.4, H - 1.1, trolley + 1.4, 2, 1.8, 2);
  lit('windowLit', BOX, 1.4, H - 1, trolley + 2.42, 1.6, 1, 0.05);
  const drop = 6 + rand() * 12;
  const hook = H - 0.2 - drop;
  for (const lx of [-1.2, 1.2]) put('steel', BOX, lx, H - 0.2 - drop / 2, trolley, 0.08, drop, 0.08);
  const carrying = rand() < 0.5;
  put('hazard', BOX, 0, hook - 0.3, trolley, carrying ? 12.4 : 5.5, 0.6, 2.4);
  if (carrying) {
    put(pick(CONTAINER_PAINTS, rand), LONG_BOX, 0, hook - 0.6 - CONTAINER.height, trolley, 1, 1, 1);
    labelBox(put, decals, Math.floor(rand() * BRANDS.length), 0, hook - 0.6 - CONTAINER.height, trolley, true);
  }
  lit('signal', BULB, 0, top + 0.6, reach - 0.5, 0.45, 0.45, 0.45);
  lit('signal', BULB, 0, apex[0] + 1.1, apex[1], 0.5, 0.5, 0.5);
  for (const lz of [6, 18, 30]) if (lz < reach - 2) lit('lampWarm', BOX, 0, H - 0.05, lz, 1.6, 0.25, 0.9);
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const local = (lx, lz) => ({ x: x + lx * c + lz * s, z: z - lx * s + lz * c });
  return {
    footprint: [local(0, -gauge / 2)].map((p) => ({ ...p, r: 12 })),
    blinks: [{ ...local(0, reach - 0.5), y: y + top + 0.6 }, { ...local(0, apex[1]), y: y + apex[0] + 1.1 }],
    pools: [6, 18, 30].filter((lz) => lz < reach - 2).map((lz) => ({ ...local(0, lz), y: y + H - 0.3, r: 7 })),
  };
}

export function goliathCrane(batch, glow, x, y, z, yaw, half, height, { decals = null, moving = false } = {}) {
  const put = frame(batch, x, y, z, yaw);
  const lit = frame(glow, x, y, z, yaw);
  const span = half + 4;
  for (const side of [-1, 1]) {
    const lx = side * half;
    put('steelDark', BOX, lx, 0.9, 0, 2.6, 1.8, 19);
    for (const lz of [-8, 8]) for (const w of [-1.2, 1.2]) put('rubber', CYL, lx, 0.6, lz + w, 0.6, 0.7, 0.6, 0, 0, Math.PI / 2);
    for (const lz of [-7.5, 7.5]) put.strut('craneYellow', [lx, 1.8, lz], [lx, height, lz * 0.4], 2.2);
    put.strut('craneYellow', [lx, height * 0.42, -6], [lx, height * 0.42, 6], 1.2);
    put.strut('craneYellow', [lx, 2.4, -6.9], [lx, height * 0.42, 5.4], 0.8);
    put.strut('craneYellow', [lx, 2.4, 6.9], [lx, height * 0.42, -5.4], 0.8);
    put('craneYellow', BOX, side * (span - 1.3), height + 2.2, 0, 2.6, 4.4, 9.2);
  }
  for (const lz of [-3, 3]) {
    put('craneYellow', BOX, 0, height + 2.2, lz, span * 2, 4.4, 2);
    put('steelDark', BOX, 0, height + 4.5, lz, span * 2, 0.2, 2.2);
    put('steel', BOX, 0, height + 5.4, lz * 1.35, span * 2, 0.12, 0.12);
    put.decal(decals, 0, 0, height + 2.2, lz * 1.34, 14, 3.5, lz > 0 ? 0 : Math.PI);
  }
  for (let lx = -span + 2; lx <= span - 2; lx += 4) for (const lz of [-4.05, 4.05]) put('steel', BOX, lx, height + 5, lz, 0.1, 1, 0.1);
  if (!moving) {
    const tx = half * 0.25;
    put('steelDark', BOX, tx, height + 6, 0, 8, 3, 8.4);
    put('craneWhite', BOX, tx - 1, height + 8.4, 0, 4, 1.8, 4);
    const drop = height * 0.45;
    for (const lz of [-1.4, 1.4]) put('steel', BOX, tx, height + 4.5 - drop / 2, lz, 0.1, drop, 0.1);
    put('hazard', BOX, tx, height + 4.2 - drop, 0, 3, 1.2, 3.6);
    put('steelDark', BOX, tx, height + 3.3 - drop, 0, 1.2, 0.8, 1.2);
  }
  put('craneWhite', BOX, -span + 5, height - 1.6, -4.4, 3, 3.2, 3);
  lit('windowLit', BOX, -span + 5, height - 1.4, -5.92, 2.4, 1.6, 0.05);
  for (let lx = -half + 6; lx <= half - 6; lx += 12) for (const lz of [-3, 3]) lit('lampCool', BOX, lx, height - 0.15, lz, 2.2, 0.3, 1);
  for (const side of [-1, 1]) lit('signal', BULB, side * (span - 1.3), height + 5, 0, 0.55, 0.55, 0.55);
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const local = (lx, lz) => ({ x: x + lx * c + lz * s, z: z - lx * s + lz * c });
  const pools = [];
  for (let lx = -half + 6; lx <= half - 6; lx += 12) pools.push({ ...local(lx, 0), y: y + height, r: 9 });
  return {
    footprint: [-1, 1].map((side) => ({ ...local(side * half, 0), r: 10 })),
    blinks: [-1, 1].map((side) => ({ ...local(side * (span - 1.3), 0), y: y + height + 5 })),
    pools,
  };
}

function hullGeometry(length, beam, height) {
  const shape = new THREE.Shape();
  shape.moveTo(-length / 2, -beam / 2);
  shape.lineTo(length / 2 - beam * 1.4, -beam / 2);
  shape.quadraticCurveTo(length / 2 - beam * 0.2, -beam / 2, length / 2, 0);
  shape.quadraticCurveTo(length / 2 - beam * 0.2, beam / 2, length / 2 - beam * 1.4, beam / 2);
  shape.lineTo(-length / 2, beam / 2);
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, curveSegments: 6 }).rotateX(-Math.PI / 2);
}

export function cargoShip(batch, glow, x, z, yaw, rand, { length = 110, beam = 16, decals = null } = {}) {
  const put = frame(batch, x, 0, z, yaw + Math.PI / 2);
  const lit = frame(glow, x, 0, z, yaw + Math.PI / 2);
  put('hullRed', hullGeometry(length, beam, 4), 0, -3, 0, 1, 1, 1);
  put('hullBlack', hullGeometry(length, beam, 5), 0, 1, 0, 1.01, 1, 1.01);
  put('deck', BOX, -2, 6.05, 0, length - 10, 0.2, beam - 1.2);
  put('stripeWhite', BOX, length / 2 - 8, 4.2, beam / 2 + 0.06, 6, 0.6, 0.1);
  for (const side of [-1, 1]) put.decal(decals, 0, 0, 3.5, side * (beam / 2 + 0.12), 20, 5, side > 0 ? 0 : Math.PI);
  const stern = -length / 2 + 8;
  put('cabin', BOX, stern, 13, 0, 10, 14, beam - 2);
  put('cabin', BOX, stern - 1, 21, 0, 8, 2.4, beam + 3);
  put('steelDark', BOX, stern - 3, 25, 0, 3.5, 7, 4);
  put('hullRed', BOX, stern - 3, 28.6, 0, 3.6, 1.2, 4.1);
  for (let ly = 9; ly < 20; ly += 3) for (let lz = -beam / 2 + 2.5; lz <= beam / 2 - 2.5; lz += 2.4) lit('windowLit', BOX, stern + 5.05, ly, lz, 0.1, 0.9, 1.2);
  lit('windowLit', BOX, stern + 3.05, 21, 0, 0.1, 1.2, beam + 2);
  lit('signal', BULB, stern - 3, 31, 0, 0.5, 0.5, 0.5);
  for (let lx = stern + 9; lx < length / 2 - 14; lx += CONTAINER.long + 1.5) {
    const tiers = 2 + Math.floor(rand() * 3);
    for (let lz = -beam / 2 + 1.6; lz <= beam / 2 - 1.6; lz += CONTAINER.width + 0.2) {
      const levels = Math.max(1, tiers - (Math.abs(lz) > beam / 2 - 3 ? 1 : 0) - Math.floor(rand() * 1.5));
      const outer = Math.abs(lz) > beam / 2 - 2.8;
      for (let t = 0; t < levels; t++) {
        put(pick(CONTAINER_PAINTS, rand), outer ? LONG_BOX : LONG_PLAIN, lx + CONTAINER.long / 2, 6.2 + t * 2.64, lz, 1, 1, 1);
        if (outer && rand() < 0.6) put.decal(decals, Math.floor(rand() * BRANDS.length), lx + CONTAINER.long / 2, 6.2 + t * 2.64 + CONTAINER.height * 0.55, lz + Math.sign(lz) * (CONTAINER.width / 2 + 0.13), 6.4, 1.6, lz > 0 ? 0 : Math.PI);
      }
    }
  }
  put('craneWhite', BOX, length / 2 - 10, 9, 0, 1, 6, 1);
  return { x, z, rx: beam / 2 + 0.5, rz: length / 2, rot: yaw };
}

export function warehouse(batch, glow, x, y, z, yaw, w, d, h, rand, { decals = null } = {}) {
  const put = frame(batch, x, y, z, yaw);
  const lit = frame(glow, x, y, z, yaw);
  put('concrete', BOX, 0, 0.5, 0, w + 0.8, 1, d + 0.8);
  put('shed', corrugated(w, d, h - 1, Math.round(w / 1.1)), 0, 1, 0, 1, 1, 1);
  put('shedRoof', ROOF, 0, h, 0, d / 2 + 0.5, 2.8, w + 0.8, 0, Math.PI / 2, 0);
  put('shedTrim', BOX, 0, h + 2.85, 0, w + 1, 0.5, 1.4);
  const pitch = Math.atan2(2.8, d / 2 + 0.5);
  const sky = h + 2.8 * (1 - (d * 0.24) / (d / 2 + 0.5)) + 0.08;
  for (let lx = -w / 2 + 4; lx < w / 2 - 3; lx += 8) {
    for (const side of [-1, 1]) put('skylight', BOX, lx, sky, side * d * 0.24, 3, 0.15, (d * 0.22) / Math.cos(pitch), side * pitch, 0, 0);
  }
  for (const side of [-1, 1]) {
    put('shedTrim', BOX, 0, h + 0.05, side * (d / 2 + 0.3), w + 0.8, 0.35, 0.5);
    for (const sx of [-1, 1]) put('shedTrim', BOX, sx * (w / 2 - 0.3), h / 2, side * (d / 2 + 0.25), 0.18, h, 0.18);
  }
  for (let lx = -w / 2; lx <= w / 2 + 0.01; lx += w / Math.max(2, Math.round(w / 7))) {
    for (const side of [-1, 1]) put('steelDark', BOX, lx, (h + 1) / 2, side * (d / 2 + 0.12), 0.45, h - 1, 0.3);
  }
  for (let lz = -d / 2; lz <= d / 2 + 0.01; lz += d / Math.max(2, Math.round(d / 7))) {
    for (const side of [-1, 1]) put('steelDark', BOX, side * (w / 2 + 0.12), (h + 1) / 2, lz, 0.3, h - 1, 0.45);
  }
  const doors = Math.max(1, Math.floor(w / 9));
  for (let k = 0; k < doors; k++) {
    const lx = (k - (doors - 1) / 2) * (w / doors);
    put('steelDark', BOX, lx, 3.9, d / 2 + 0.2, 5.4, 0.5, 0.35);
    for (const sx of [-1, 1]) put('steelDark', BOX, lx + sx * 2.5, 2.5, d / 2 + 0.2, 0.4, 3, 0.35);
    put('shedDoor', BOX, lx, 2.45, d / 2 + 0.1, 4.6, 2.9, 0.2);
    for (let ly = 1.4; ly < 3.8; ly += 0.55) put('shedTrim', BOX, lx, ly, d / 2 + 0.22, 4.5, 0.08, 0.06);
    put('steelDark', BOX, lx, 4.35, d / 2 + 0.45, 5, 0.6, 0.7);
    for (const sx of [-1, 1]) {
      put('hazard', CYL, lx + sx * 3.2, 1.6, d / 2 + 0.8, 0.18, 1.2, 0.18);
      put('rubber', BOX, lx + sx * 1.6, 1.35, d / 2 + 0.85, 0.5, 0.5, 0.3);
    }
    put('concreteDark', BOX, lx, 0.55, d / 2 + 1.8, 6, 1.1, 2.6);
    put('hazard', BOX, lx, 1.12, d / 2 + 3.05, 6, 0.06, 0.12);
    if (rand() < 0.7) lit('lampWarm', BOX, lx, 4.9, d / 2 + 0.5, 1, 0.3, 0.6);
  }
  const pd = (doors > 1 ? w / doors / 2 : w / 4) * (rand() < 0.5 ? -1 : 1);
  put('shedDoor', BOX, pd, 2.1, d / 2 + 0.1, 1.1, 2.2, 0.15);
  lit('lampWarm', BOX, pd, 3.5, d / 2 + 0.3, 0.5, 0.25, 0.4);
  put('concreteDark', BOX, pd, 0.5, d / 2 + 0.9, 1.8, 1, 1.4);
  for (const sx of [-1, 1]) put('steel', BOX, sx * (w / 2 + 0.15), (h + 1) / 2, d / 2 + 0.3, 0.22, h - 1, 0.22);
  put('steelDark', BOX, 0, h - 1.5, d / 2 + 0.22, Math.min(w * 0.7, 22), 2.4, 0.25);
  put.decal(decals, Math.floor(rand() * BRANDS.length), 0, h - 1.5, d / 2 + 0.36, Math.min(w * 0.68, 21), Math.min(w * 0.68, 21) / 4.6, 0);
  for (let lx = -w / 2 + 2; lx < w / 2 - 1; lx += 3.2) {
    if (Math.abs(lx) < Math.min(w * 0.35, 11) + 1) continue;
    if (rand() < 0.45) lit('windowLit', BOX, lx, h - 1.6, d / 2 + 0.1, 2, 0.8, 0.1);
  }
  for (let lz = -d / 2 + 2.5; lz < d / 2 - 1.5; lz += 3.2) {
    for (const side of [-1, 1]) if (rand() < 0.35) lit('windowLit', BOX, side * (w / 2 + 0.1), h - 1.6, lz, 0.1, 0.8, 2);
  }
  const vents = 1 + Math.floor(rand() * 3);
  for (let k = 0; k < vents; k++) {
    const lx = (rand() - 0.5) * (w - 6);
    put('steel', CYL, lx, h + 2.95, 0, 0.55, 1.2, 0.55);
    put('steelDark', CYL, lx, h + 3.6, 0, 0.8, 0.15, 0.8);
  }
  if (rand() < 0.6) {
    const lx = (rand() - 0.5) * (w - 8);
    put('pipeSilver', BOX, lx, h + 2.8 * (1 - (d * 0.3) / (d / 2 + 0.5)) + 0.5, -d * 0.3, 2.6, 1.4, 1.8);
  }
  if (rand() < 0.5) forklift(put, -w / 2 + 3 + rand() * (w - 6), d / 2 + 5 + rand() * 3, rand() * Math.PI * 2);
  return { x, z, r: Math.max(w, d) / 2 + 1 };
}

function forklift(put, lx, lz, turn) {
  const c = Math.cos(turn);
  const s = Math.sin(turn);
  const at = (ax, ay, az, sx, sy, sz, key, geometry = BOX) => put(key, geometry, lx + ax * c + az * s, ay, lz - ax * s + az * c, sx, sy, sz, 0, turn, 0);
  at(0, 0.9, 0, 1.3, 1, 2.2, 'hazard');
  at(0, 1.55, -0.95, 1.3, 0.5, 0.5, 'steelDark');
  for (const sx of [-0.55, 0.55]) at(sx, 2, 0.15, 0.08, 1.4, 0.08, 'steelDark');
  at(0, 2.75, 0.15, 1.2, 0.08, 1.2, 'steelDark');
  for (const sx of [-0.4, 0.4]) at(sx, 2, 1.35, 0.12, 3, 0.12, 'steelDark');
  for (const sx of [-0.3, 0.3]) at(sx, 0.25, 1.95, 0.14, 0.08, 1.1, 'steel');
  for (const [sx, sz] of [[-0.65, 0.65], [0.65, 0.65], [-0.65, -0.7], [0.65, -0.7]]) at(sx, 0.35, sz, 0.35, 0.7, 0.7, 'rubber');
}

export function oilTank(batch, x, y, z, r, h, rand) {
  const rusty = rand() < 0.4;
  batch.add(rusty ? 'tankRust' : 'tank', CYL, mat(x, y + h / 2, z, r, h, r));
  batch.add('tank', DOME, mat(x, y + h, z, r, 1.6, r));
  batch.add('steelDark', CYL, mat(x, y + h * 0.33, z, r + 0.08, 0.3, r + 0.08));
  batch.add('steelDark', CYL, mat(x, y + h * 0.66, z, r + 0.08, 0.3, r + 0.08));
  const a = rand() * Math.PI * 2;
  for (let k = 0; k < 10; k++) {
    const t = k / 10;
    const ang = a + t * 1.4;
    batch.add('steel', BOX, mat(x + Math.cos(ang) * (r + 0.6), y + t * h, z + Math.sin(ang) * (r + 0.6), 1, 0.15, 1.2, 0, -ang, 0));
  }
  return { x, z, r: r + 1.5 };
}

export function floodMast(batch, glow, x, y, z, height, rand) {
  batch.add('steelDark', POST, mat(x, y + height / 2, z, 0.35, height, 0.35));
  batch.add('steelDark', BOX, mat(x, y + height, z, 4.4, 0.4, 1.2));
  const yaw = rand() * Math.PI * 2;
  const heads = [];
  for (const lx of [-1.6, -0.55, 0.55, 1.6]) {
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    const hx = x + lx * c;
    const hz = z - lx * s;
    batch.add('steel', BOX, mat(hx, y + height + 0.7, hz, 0.9, 1, 0.7, -0.5, yaw, 0));
    glow.add('lampWarm', BOX, mat(hx + s * 0.38, y + height + 0.6, hz + c * 0.38, 0.75, 0.75, 0.12, -0.5, yaw, 0));
    heads.push({ x: hx, z: hz });
  }
  return { yaw, y: y + height + 0.6, heads };
}

export function bollard(batch, x, y, z) {
  batch.add('steelDark', CYL, mat(x, y + 0.35, z, 0.35, 0.7, 0.35));
  batch.add('steelDark', CYL, mat(x, y + 0.75, z, 0.5, 0.15, 0.5));
}

export function drums(batch, x, y, z, rand) {
  const n = 2 + Math.floor(rand() * 5);
  for (let k = 0; k < n; k++) {
    const a = rand() * Math.PI * 2;
    const d = rand() * 1.6;
    batch.add(pick(['drumBlue', 'drumRed', 'drumYellow'], rand), CYL, mat(x + Math.cos(a) * d, y + 0.55, z + Math.sin(a) * d, 0.45, 1.1, 0.45));
  }
}

export function pallets(batch, x, y, z, yaw, rand) {
  const put = frame(batch, x, y, z, yaw);
  const n = 1 + Math.floor(rand() * 3);
  for (let k = 0; k < n; k++) {
    put('pallet', BOX, k * 1.5, 0.08, 0, 1.2, 0.16, 1.2);
    put(pick(['shed', 'boxWhite', 'pallet', 'boxOrange'], rand), BOX, k * 1.5, 0.16 + 0.5, 0, 1.1, 1, 1.1);
  }
}

export function chimney(batch, x, y, z, height) {
  batch.add('brick', CYL, mat(x, y + height / 2, z, 2.2, height, 2.2));
  for (const t of [0.72, 0.86]) batch.add('stripeWhite', CYL, mat(x, y + height * t, z, 2.25, 2.2, 2.25));
  batch.add('steelDark', CYL, mat(x, y + height + 0.3, z, 2.35, 0.6, 2.35));
  return { x, y: y + height + 1, z };
}

export function pipeBridge(batch, glow, x, y, z, yaw, half, height) {
  const put = frame(batch, x, y, z, yaw);
  const lit = frame(glow, x, y, z, yaw);
  for (const side of [-1, 1]) {
    for (const lz of [-2, 2]) put('steelDark', BOX, side * half, height / 2, lz, 0.8, height, 0.8);
    put('steelDark', BOX, side * half, height * 0.5, 0, 0.5, 0.5, 4);
  }
  put('steel', BOX, 0, height + 0.3, -2, half * 2 + 1, 0.6, 0.6);
  put('steel', BOX, 0, height + 0.3, 2, half * 2 + 1, 0.6, 0.6);
  for (let lx = -half; lx <= half; lx += 3) put('steel', BOX, lx, height + 0.3, 0, 0.3, 0.3, 4);
  for (const [lz, r, key] of [[-1.2, 0.55, 'pipeGreen'], [0, 0.4, 'pipeSilver'], [1.2, 0.65, 'tankRust']]) {
    put(key, CYL, 0, height + 0.6 + r, lz, r, half * 2 + 2, r, 0, 0, Math.PI / 2);
  }
  lit('lampWarm', BOX, 0, height - 0.1, 0, 1.6, 0.2, 0.8);
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return [-1, 1].map((side) => ({ x: x + side * half * c, z: z - side * half * s, r: 3 }));
}
