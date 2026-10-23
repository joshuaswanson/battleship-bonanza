import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { toon, glow, outlined, cachedGeometry, INK } from './toon.js';

export const HULL_L = 4.2;
export const HULL_W = 1.9;

const METAL = 0xc3cdd8;
const DARK = 0x34465e;
const RED = 0xff4141;

const MOUNTED = new Set(['machinegun', 'laser', 'saw', 'missiles', 'mines', 'jetpack', 'grapple', 'emp']);
const FRONT_MOUNT = 1.5;
const REAR_MOUNT = -2.2;
const SOLO_MOUNT = -0.35;
const MOUNT_RANK = { saw: -1, mines: 0.5, jetpack: 1 };
const mountRank = (id) => MOUNT_RANK[id] ?? 0;
const MODULE_SCALE = 1.3;

export function halfWidth(z) {
  const u = z / HULL_L;
  if (u <= -0.15) {
    const t = (u + 0.15) / 0.85;
    return HULL_W * (1 - 0.12 * t * t);
  }
  const t = Math.min(1, (u + 0.15) / 1.15);
  return HULL_W * Math.pow(1 - Math.pow(t, 1.8), 0.7);
}

export function sheer(z) {
  const u = Math.max(0, z / HULL_L);
  return 0.8 + 0.55 * u * u;
}

function keel(z) {
  const u = z / HULL_L;
  return u > 0 ? -0.9 + 0.85 * Math.pow(u, 2.5) : -0.9 + 0.12 * u * u;
}

const deckTop = (z) => sheer(z) + 0.06;

const SECTION = new THREE.SplineCurve([
  new THREE.Vector2(1, 1),
  new THREE.Vector2(1, 0.72),
  new THREE.Vector2(0.95, 0.46),
  new THREE.Vector2(0.82, 0.26),
  new THREE.Vector2(0.58, 0.12),
  new THREE.Vector2(0.29, 0.04),
  new THREE.Vector2(0, 0),
]).getPoints(12);

const STATIONS = 44;
const stationZ = (i) => -HULL_L + (i / (STATIONS - 1)) * HULL_L * 2;

function buildHull() {
  const half = SECTION.length;
  const ring = half * 2 - 1;
  const pos = [];
  const uv = [];
  const index = [];
  for (let i = 0; i < STATIONS; i++) {
    const z = stationZ(i);
    const w = halfWidth(z);
    const s = sheer(z);
    const k = keel(z);
    for (let j = 0; j < ring; j++) {
      const p = j < half ? SECTION[j] : SECTION[ring - 1 - j];
      const side = j < half ? 1 : -1;
      pos.push(side * p.x * w, k + (s - k) * p.y, z);
      uv.push(i / (STATIONS - 1), j / (ring - 1));
    }
  }
  for (let i = 0; i < STATIONS - 1; i++) {
    for (let j = 0; j < ring - 1; j++) {
      const a = i * ring + j;
      const b = (i + 1) * ring + j;
      const c = b + 1;
      const d = a + 1;
      index.push(a, b, d, b, c, d);
    }
  }
  const z = -HULL_L;
  const center = pos.length / 3;
  pos.push(0, (sheer(z) + keel(z)) / 2, z);
  uv.push(0, 0.5);
  for (let j = 0; j < ring; j++) {
    pos.push(pos[j * 3], pos[j * 3 + 1], pos[j * 3 + 2]);
    uv.push(0, j / (ring - 1));
  }
  for (let j = 0; j < ring; j++) {
    const next = (j + 1) % ring;
    index.push(center, center + 1 + j, center + 1 + next);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

function buildDeck() {
  const across = 9;
  const pos = [];
  const uv = [];
  const index = [];
  for (let i = 0; i < STATIONS; i++) {
    const z = stationZ(i);
    const w = halfWidth(z) * 0.97;
    const s = sheer(z);
    for (let a = 0; a < across; a++) {
      const f = (a / (across - 1)) * 2 - 1;
      pos.push(f * w, s - 0.04 + 0.1 * (1 - f * f), z);
      uv.push(a / (across - 1), (i / (STATIONS - 1)) * 5);
    }
  }
  for (let i = 0; i < STATIONS - 1; i++) {
    for (let a = 0; a < across - 1; a++) {
      const p = i * across + a;
      const q = (i + 1) * across + a;
      index.push(p, q, p + 1, q, q + 1, p + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

function buildBumper() {
  const pts = [];
  const n = 30;
  for (let i = 0; i <= n; i++) {
    const z = -HULL_L + (i / n) * HULL_L * 1.985;
    pts.push(new THREE.Vector3(halfWidth(z) + 0.02, sheer(z) + 0.04, z));
  }
  for (let i = n - 1; i >= 0; i--) {
    const z = -HULL_L + (i / n) * HULL_L * 1.985;
    pts.push(new THREE.Vector3(-halfWidth(z) - 0.02, sheer(z) + 0.04, z));
  }
  const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
  return new THREE.TubeGeometry(curve, 180, 0.22, 10, true);
}

function sawGeometry() {
  const shape = new THREE.Shape();
  const teeth = 16;
  for (let i = 0; i < teeth * 2; i++) {
    const a = (i / (teeth * 2)) * Math.PI * 2 + (i % 2 ? 0 : 0.1);
    const r = i % 2 ? 0.74 : 1;
    if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const hole = new THREE.Path();
  hole.absarc(0, 0, 0.18, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: false });
  g.translate(0, 0, -0.05);
  g.rotateY(Math.PI / 2);
  return g;
}

const geo = {
  hull: () => cachedGeometry('hull', buildHull),
  deck: () => cachedGeometry('deck', buildDeck),
  bumper: () => cachedGeometry('bumper', buildBumper),
  sphere: () => cachedGeometry('sphere', () => new THREE.SphereGeometry(1, 20, 14)),
  smallSphere: () => cachedGeometry('smallSphere', () => new THREE.SphereGeometry(1, 12, 8)),
  capsule: () => cachedGeometry('capsule', () => new THREE.CapsuleGeometry(0.5, 1, 6, 16)),
  cylinder: () => cachedGeometry('cylinder', () => new THREE.CylinderGeometry(1, 1, 1, 18)),
  cone: () => cachedGeometry('cone', () => new THREE.ConeGeometry(1, 1, 12)),
  roundBox: () => cachedGeometry('roundBox', () => new RoundedBoxGeometry(1, 1, 1, 3, 0.2)),
  ring: () => cachedGeometry('ring', () => new THREE.TorusGeometry(1, 0.1, 8, 32)),
  claw: () => cachedGeometry('claw', () => new THREE.TorusGeometry(0.4, 0.09, 8, 16, Math.PI * 1.2)),
  saw: () => cachedGeometry('saw', sawGeometry),
  flame: () =>
    cachedGeometry('flame', () => {
      const g = new THREE.ConeGeometry(1, 1, 10);
      g.translate(0, -0.5, 0);
      g.rotateX(Math.PI);
      return g;
    }),
};

function part(parent, key, material, x, y, z, sx = 1, sy = sx, sz = sx, outline = 0.05) {
  const geometry = cachedGeometry(`${key}|${sx}|${sy}|${sz}`, () => geo[key]().clone().scale(sx, sy, sz));
  const mesh = outlined(geometry, material, outline);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

function canvasTexture(key, draw) {
  return cachedGeometry(`tex:${key}`, () => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    draw(canvas.getContext('2d'));
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 4;
    return texture;
  });
}

const camo = () =>
  canvasTexture('camo', (ctx) => {
    ctx.fillStyle = '#7d9a4a';
    ctx.fillRect(0, 0, 256, 256);
    const colors = ['#4f6b2c', '#a68b54', '#2f4a24', '#93ad5e'];
    let seed = 3;
    const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 70; i++) {
      ctx.fillStyle = colors[i % colors.length];
      ctx.beginPath();
      const x = r() * 256;
      const y = r() * 256;
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * Math.PI * 2;
        const d = 10 + r() * 18;
        ctx.lineTo(x + Math.cos(a) * d * 1.4, y + Math.sin(a) * d);
      }
      ctx.fill();
    }
  });

const planks = () =>
  canvasTexture('planks', (ctx) => {
    ctx.fillStyle = '#ffe9c4';
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#e6c493';
    for (let i = 0; i <= 8; i++) ctx.fillRect(i * 32 - 2, 0, 4, 256);
    for (let i = 0; i < 8; i++) ctx.fillRect(i * 32, ((i * 97) % 256), 32, 4);
  });

const iron = () =>
  canvasTexture('iron', (ctx) => {
    ctx.fillStyle = '#9aa6b4';
    ctx.fillRect(0, 0, 256, 256);
    for (let col = 0; col < 8; col++) {
      for (let row = 0; row < 4; row++) {
        const shade = 150 + ((col * 7 + row * 13) % 5) * 6;
        ctx.fillStyle = `rgb(${shade - 4}, ${shade + 6}, ${shade + 18})`;
        ctx.fillRect(col * 32 + 2, row * 64 + 2, 28, 60);
      }
    }
    ctx.fillStyle = '#56657a';
    for (let col = 0; col <= 8; col++) ctx.fillRect(col * 32 - 1, 0, 3, 256);
    for (let row = 0; row <= 4; row++) ctx.fillRect(0, row * 64 - 1, 256, 3);
    ctx.fillStyle = '#4a586c';
    for (let col = 0; col < 8; col++) {
      for (let row = 0; row < 4; row++) {
        for (const [dx, dy] of [[6, 6], [26, 6], [6, 58], [26, 58], [6, 32], [26, 32]]) {
          ctx.beginPath();
          ctx.arc(col * 32 + dx, row * 64 + dy, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  });

const treadPlate = () =>
  canvasTexture('tread', (ctx) => {
    ctx.fillStyle = '#b4bfcc';
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = '#8693a4';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const cx = x * 32 + (y % 2) * 16 + 8;
        const cy = y * 32 + 16;
        const flip = (x + y) % 2 ? 1 : -1;
        ctx.beginPath();
        ctx.moveTo(cx - 6, cy - 6 * flip);
        ctx.lineTo(cx + 6, cy + 6 * flip);
        ctx.stroke();
      }
    }
    ctx.fillStyle = '#6f7d90';
    for (let i = 0; i <= 4; i++) ctx.fillRect(i * 64 - 1, 0, 3, 256);
  });

export function buildBoat(color, items) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const hasCamo = items.includes('camo');
  const hasArmor = items.includes('armor');
  const mats = {
    paint: toon(color),
    metal: toon(METAL),
    dark: toon(DARK),
    ink: toon(INK),
    white: toon(0xffffff),
  };
  const hullMat = hasCamo ? toon(0xffffff, { map: camo() }) : hasArmor ? toon(0xffffff, { map: iron() }) : mats.paint;
  const bumperMat = hasArmor ? mats.paint : hasCamo ? toon(0x4f6b2c) : mats.white;
  const deckMat = hasArmor ? toon(0xffffff, { map: treadPlate() }) : toon(0xffffff, { map: planks() });

  part(body, 'hull', hullMat, 0, 0, 0, 1, 1, 1, 0.07);
  part(body, 'deck', deckMat, 0, 0, 0, 1, 1, 1, 0);
  part(body, 'bumper', bumperMat, 0, 0, 0, 1, 1, 1, 0.04);

  const sternTop = sheer(-HULL_L);
  part(body, 'roundBox', mats.dark, 0, sternTop - 0.05, -HULL_L - 0.15, 0.6, 0.5, 0.35, 0.03);
  part(body, 'cylinder', mats.dark, 0, sternTop - 0.75, -HULL_L - 0.55, 0.13, 1.3, 0.13, 0.03);
  part(body, 'roundBox', hasCamo ? toon(0x4f6b2c) : mats.paint, 0, sternTop + 0.35, -HULL_L - 0.55, 0.85, 0.95, 0.85, 0.04);
  part(body, 'roundBox', mats.white, 0, sternTop + 0.88, -HULL_L - 0.55, 0.7, 0.18, 0.7, 0.03);

  const flagZ = -HULL_L + 0.6;
  const flagX = halfWidth(flagZ) - 0.35;
  part(body, 'cylinder', mats.dark, flagX, sternTop + 0.8, flagZ, 0.05, 1.6, 0.05, 0.02);
  const flag = part(body, 'cone', hasCamo ? toon(0x4f6b2c) : mats.paint, flagX, sternTop + 1.4, flagZ - 0.45, 0.04, 0.9, 0.3, 0.02);
  flag.rotation.x = -Math.PI / 2;

  const refs = { root, body, flag, saw: null, flames: [], spinners: [], materials: [], parts: {} };

  for (const id of items) {
    if (MOUNTED.has(id)) continue;
    const group = new THREE.Group();
    body.add(group);
    HULL_MODS[id](group, mats, refs);
    refs.parts[id] = group;
  }

  const mounted = items.filter((id) => MOUNTED.has(id)).sort((a, b) => mountRank(a) - mountRank(b));
  const rank = mountRank(mounted[0]);
  const soloSpot = rank < 0 ? FRONT_MOUNT : rank > 0 ? REAR_MOUNT : SOLO_MOUNT;
  const spots = mounted.length === 2 ? [FRONT_MOUNT, REAR_MOUNT] : [soloSpot];
  mounted.forEach((id, i) => {
    const z = spots[i];
    const raised = mounted.length === 2 && i === 1;
    const baseH = raised ? 0.85 : 0.35;
    const turret = new THREE.Group();
    turret.position.set(0, deckTop(z), z);
    body.add(turret);
    refs.parts[id] = turret;
    part(turret, 'cylinder', mats.metal, 0, 0, 0, 1.15, 0.14, 1.15, 0.03);
    part(turret, 'cylinder', mats.dark, 0, baseH / 2, 0, 0.95, baseH, 0.95, 0.03);
    const module = new THREE.Group();
    module.position.y = baseH;
    module.scale.setScalar(MODULE_SCALE);
    turret.add(module);
    const mounts = MODULES[id](module, mats, refs);
    for (const [key, v] of Object.entries(mounts ?? {})) {
      refs[key] = v.multiplyScalar(MODULE_SCALE).add(new THREE.Vector3(0, deckTop(z) + baseH, z));
    }
  });

  body.traverse((o) => {
    if (o.isMesh && o.material.isMeshToonMaterial && !refs.materials.includes(o.material)) refs.materials.push(o.material);
  });
  for (const m of refs.materials) {
    m.emissive = new THREE.Color(0xffffff);
    m.emissiveIntensity = 0;
  }
  return refs;
}

const UP = new THREE.Vector3(0, 1, 0);

function sphereDirections(count) {
  const dirs = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - ((i + 0.5) / count) * 2;
    const r = Math.sqrt(1 - y * y);
    dirs.push(new THREE.Vector3(Math.cos(golden * i) * r, y, Math.sin(golden * i) * r));
  }
  return dirs;
}

function spikyBall(parent, mats, x, y, z, radius, count, spikeLength) {
  part(parent, 'sphere', mats.ink, x, y, z, radius, radius, radius, 0.04);
  for (const dir of sphereDirections(count)) {
    const base = radius * 0.85;
    part(parent, 'sphere', mats.dark, x + dir.x * base, y + dir.y * base, z + dir.z * base, radius * 0.16, radius * 0.16, radius * 0.16, 0.02);
    const mid = base + spikeLength * 0.5;
    const spike = part(parent, 'cone', mats.metal, x + dir.x * mid, y + dir.y * mid, z + dir.z * mid, radius * 0.13, spikeLength, radius * 0.13, 0.02);
    spike.quaternion.setFromUnitVectors(UP, dir);
  }
}

const HULL_MODS = {
  spikes(body, mats) {
    const spike = (base, dir, radius, length) => {
      part(body, 'sphere', mats.dark, base.x, base.y, base.z, radius * 1.25, radius * 1.25, radius * 1.25, 0.03);
      const mesh = part(body, 'cone', mats.metal, base.x + dir.x * length * 0.5, base.y + dir.y * length * 0.5, base.z + dir.z * length * 0.5, radius, length, radius, 0.035);
      mesh.quaternion.setFromUnitVectors(UP, dir);
    };
    for (const side of [-1, 1]) {
      for (const z of [-3.5, -2.4, -1.3, -0.2, 0.9, 2.0, 3.0]) {
        const w = halfWidth(z);
        const slope = (halfWidth(z + 0.1) - halfWidth(z - 0.1)) / 0.2;
        const dir = new THREE.Vector3(side * 0.85, 0.65, -side * slope * 0.85).normalize();
        spike(new THREE.Vector3(side * (w + 0.12), sheer(z) + 0.12, z), dir, 0.2, 1.75);
      }
      spike(new THREE.Vector3(side * (halfWidth(-HULL_L) - 0.1), sheer(-HULL_L) + 0.15, -HULL_L + 0.1), new THREE.Vector3(side * 0.5, 0.55, -0.7).normalize(), 0.2, 1.6);
    }
    spike(new THREE.Vector3(0, sheer(HULL_L) - 0.1, HULL_L - 0.05), new THREE.Vector3(0, 0.18, 1).normalize(), 0.36, 2.4);
  },

  armor(body, mats) {
    const rivet = toon(0x5d6b7e);
    for (const side of [-1, 1]) {
      for (let i = 0; i < 14; i++) {
        const z = -HULL_L + 0.35 + i * 0.58;
        part(body, 'smallSphere', rivet, side * (halfWidth(z) + 0.01), sheer(z) - 0.28, z, 0.075, 0.075, 0.075, 0);
      }
    }
    const nose = part(body, 'cone', mats.metal, 0, sheer(HULL_L) - 0.5, HULL_L + 0.05, 0.6, 1.3, 0.6, 0.04);
    nose.quaternion.setFromUnitVectors(UP, new THREE.Vector3(0, -0.15, 1).normalize());
    const transom = part(body, 'roundBox', mats.metal, 0, (sheer(-HULL_L) - 0.85) / 2 + 0.1, -HULL_L - 0.02, halfWidth(-HULL_L) * 1.7, 1.3, 0.14, 0.03);
    transom.position.z -= 0.05;
  },

  camo(body) {
    const leaf = toon(0x4f8a2e);
    const leafDark = toon(0x3a6b22);
    const tufts = [
      [0.7, 2.6, 0.45], [-0.6, 2.4, 0.38], [0.9, -3.4, 0.42], [-0.85, -3.2, 0.5], [0.05, 3.2, 0.32],
    ];
    tufts.forEach(([x, z, r], i) => {
      part(body, 'sphere', i % 2 ? leaf : leafDark, x, deckTop(z) + r * 0.4, z, r, r * 0.7, r, 0.04);
      part(body, 'sphere', i % 2 ? leafDark : leaf, x + r * 0.5, deckTop(z) + r * 0.3, z - r * 0.3, r * 0.7, r * 0.5, r * 0.7, 0.04);
    });
  },
};

const MODULES = {
  machinegun(m, mats, refs) {
    const gold = toon(0xffd23f);
    part(m, 'roundBox', mats.dark, 0, 0.55, -0.15, 1.0, 0.85, 1.1, 0.04);
    part(m, 'roundBox', mats.paint, 0, 1.02, -0.15, 0.78, 0.2, 0.9, 0.03);
    for (const x of [-0.32, 0.32]) {
      part(m, 'cylinder', mats.metal, x, 0.75, -0.95, 0.07, 0.6, 0.07, 0.02).rotation.x = Math.PI / 2;
    }
    part(m, 'cylinder', mats.metal, 0, 0.75, -1.25, 0.07, 0.72, 0.07, 0.02).rotation.z = Math.PI / 2;

    const barrels = new THREE.Group();
    barrels.position.set(0, 0.55, 0.4);
    m.add(barrels);
    part(barrels, 'cylinder', mats.dark, 0, 0, 0.75, 0.13, 1.6, 0.13, 0.02).rotation.x = Math.PI / 2;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      part(barrels, 'cylinder', mats.metal, Math.cos(a) * 0.24, Math.sin(a) * 0.24, 0.8, 0.085, 1.6, 0.085, 0.02).rotation.x = Math.PI / 2;
    }
    for (const z of [0.25, 1.15]) part(barrels, 'ring', mats.dark, 0, 0, z, 0.36, 0.36, 1.4, 0.02);
    part(barrels, 'cylinder', mats.paint, 0, 0, 1.6, 0.38, 0.14, 0.38, 0.02).rotation.x = Math.PI / 2;
    refs.minigun = barrels;

    const drum = part(m, 'cylinder', mats.paint, 0.78, 0.45, -0.1, 0.48, 0.42, 0.48, 0.03);
    drum.rotation.z = Math.PI / 2;
    part(m, 'cylinder', mats.white, 1.0, 0.45, -0.1, 0.3, 0.06, 0.3, 0.02).rotation.z = Math.PI / 2;
    for (let i = 0; i < 4; i++) {
      part(m, 'capsule', gold, 0.62 - i * 0.12, 0.85 + Math.sin(i * 0.9) * 0.05, 0.25 + i * 0.03, 0.12, 0.22, 0.12, 0.02).rotation.z = Math.PI / 2;
    }
    return { gunMount: new THREE.Vector3(0, 0.55, 2.1) };
  },

  laser(m, mats) {
    const pink = glow(0xff4fd8);
    part(m, 'sphere', mats.white, 0, 0.45, 0, 0.68, 0.6, 0.72, 0.04);
    part(m, 'cylinder', mats.white, 0, 0.6, 1.2, 0.27, 2.0, 0.27, 0.04).rotation.x = Math.PI / 2;
    part(m, 'ring', pink, 0, 0.6, 1.5, 0.34, 0.34, 0.6, 0.02);
    part(m, 'ring', pink, 0, 0.6, 2.05, 0.34, 0.34, 0.6, 0.02);
    part(m, 'sphere', glow(0xff9ef0), 0, 0.6, 2.25, 0.22, 0.22, 0.22, 0);
    part(m, 'roundBox', mats.paint, 0, 1.0, -0.15, 0.5, 0.25, 0.6, 0.03);
    return { laserMount: new THREE.Vector3(0, 0.6, 2.45) };
  },

  saw(m, mats, refs) {
    part(m, 'cylinder', mats.dark, 0, 0.55, 0, 0.18, 1.1, 0.18, 0.03);
    part(m, 'cylinder', mats.paint, 0, 1.15, 0.55, 0.15, 1.3, 0.15, 0.03).rotation.x = Math.PI / 2;
    const saw = part(m, 'saw', mats.metal, 0, 1.15, 1.3, 1.25, 1.25, 1.25, 0.03);
    part(saw, 'sphere', toon(RED), 0, 0, 0, 0.26, 0.26, 0.26, 0.03);
    refs.saw = saw;
  },

  missiles(m, mats) {
    const launcher = new THREE.Group();
    launcher.position.set(0, 0.75, 0);
    launcher.rotation.x = -0.3;
    m.add(launcher);
    part(m, 'cylinder', mats.dark, 0, 0.35, 0, 0.2, 0.7, 0.2, 0.03);
    part(launcher, 'roundBox', mats.dark, 0, 0, 0, 1.5, 1.05, 1.6, 0.04);
    part(launcher, 'roundBox', mats.paint, 0, 0.56, 0, 1.2, 0.12, 1.3, 0.03);
    const red = toon(RED);
    for (const x of [-0.35, 0.35]) {
      for (const y of [-0.22, 0.22]) {
        part(launcher, 'cylinder', mats.ink, x, y, 0.8, 0.22, 0.06, 0.22, 0).rotation.x = Math.PI / 2;
        part(launcher, 'cone', red, x, y, 0.98, 0.17, 0.4, 0.17, 0.03).rotation.x = Math.PI / 2;
      }
    }
    return { missileMount: new THREE.Vector3(0, 1.2, 1.0) };
  },

  mines(m, mats) {
    part(m, 'roundBox', mats.metal, 0, 0.12, 0, 1.2, 0.25, 2.0, 0.03);
    for (const x of [-0.5, 0.5]) part(m, 'cylinder', mats.dark, x, 0.45, 0, 0.07, 0.6, 0.07, 0.02);
    for (const z of [-0.62, 0, 0.62]) {
      spikyBall(m, mats, 0, 0.62, z, 0.3, 14, 0.28);
      part(m, 'smallSphere', glow(RED), 0, 0.95, z, 0.07, 0.07, 0.07, 0);
    }
  },

  jetpack(m, mats, refs) {
    const red = toon(RED);
    part(m, 'roundBox', mats.metal, 0, 0.75, -0.1, 1.5, 0.3, 0.45, 0.03);
    for (const x of [-0.55, 0.55]) {
      const tank = part(m, 'capsule', red, x, 0.95, -0.25, 0.85, 0.85, 0.85, 0.04);
      tank.rotation.x = -0.35;
      const nozzle = part(m, 'cone', mats.dark, x, 0.15, 0.05, 0.3, 0.45, 0.3, 0.03);
      nozzle.rotation.x = Math.PI - 0.35;
      part(m, 'sphere', mats.white, x, 1.65, -0.5, 0.2, 0.2, 0.2, 0.03);
      const flame = new THREE.Mesh(geo.flame(), glow(0xffa62b, { transparent: true, opacity: 0.9 }));
      flame.position.set(x, -0.05, 0.12);
      flame.rotation.x = -0.35;
      flame.visible = false;
      m.add(flame);
      refs.flames.push(flame);
    }
  },

  grapple(m, mats) {
    part(m, 'sphere', mats.dark, 0, 0.35, 0, 0.6, 0.45, 0.6, 0.04);
    const barrel = part(m, 'cylinder', mats.metal, 0, 0.75, 0.75, 0.24, 1.7, 0.24, 0.04);
    barrel.rotation.x = Math.PI / 2 - 0.25;
    const hook = new THREE.Group();
    hook.position.set(0, 0.97, 1.65);
    hook.scale.setScalar(1.4);
    m.add(hook);
    for (let i = 0; i < 3; i++) {
      part(hook, 'claw', mats.metal, 0, 0, 0, 1, 1, 1, 0.03).rotation.set(0, (i * Math.PI * 2) / 3, Math.PI * 0.9);
    }
    part(hook, 'sphere', mats.dark, 0, 0, 0, 0.2, 0.2, 0.2, 0.03);
    part(m, 'ring', toon(0xc0874f), 0.75, 0.25, -0.2, 0.4, 0.4, 1.4, 0.03).rotation.x = Math.PI / 2;
    return { hookMount: new THREE.Vector3(0, 0.97, 1.7) };
  },

  emp(m, mats, refs) {
    part(m, 'cylinder', mats.metal, 0, 0.25, 0, 0.5, 0.5, 0.5, 0.03);
    part(m, 'cylinder', mats.paint, 0, 0.25, 0, 0.53, 0.14, 0.53, 0.02);
    part(m, 'cylinder', mats.dark, 0, 1.0, 0, 0.1, 1.4, 0.1, 0.02);
    part(m, 'sphere', glow(0x5ff4ff), 0, 1.9, 0, 0.45, 0.45, 0.45, 0.04);
    const a = part(m, 'ring', mats.metal, 0, 1.9, 0, 0.75, 0.75, 0.75, 0.03);
    const b = part(m, 'ring', mats.metal, 0, 1.9, 0, 0.68, 0.68, 0.68, 0.03);
    b.rotation.x = Math.PI / 2;
    refs.spinners.push({ mesh: a, axis: 'y', speed: 2.4 }, { mesh: b, axis: 'z', speed: -3 });
  },
};

export function buildMine() {
  const group = new THREE.Group();
  const mats = { ink: toon(INK), dark: toon(DARK), metal: toon(METAL) };
  spikyBall(group, mats, 0, 0.3, 0, 0.8, 22, 0.75);
  const light = new THREE.Mesh(geo.smallSphere(), glow(RED));
  light.scale.setScalar(0.22);
  light.position.set(0, 1.12, 0);
  group.add(light);
  group.userData.light = light;
  return group;
}

export function buildMissile() {
  const group = new THREE.Group();
  part(group, 'capsule', toon(0xffffff), 0, 0, 0, 0.6, 0.6, 0.6, 0.04).rotation.x = Math.PI / 2;
  part(group, 'cone', toon(RED), 0, 0, 1.05, 0.26, 0.45, 0.26, 0.03).rotation.x = Math.PI / 2;
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    const fin = part(group, 'roundBox', toon(RED), Math.cos(a) * 0.38, Math.sin(a) * 0.38, -0.7, 0.08, 0.45, 0.5, 0.02);
    fin.rotation.z = a + Math.PI / 2;
  }
  return group;
}

export function buildHook() {
  const group = new THREE.Group();
  group.scale.setScalar(1.4);
  const mat = toon(METAL);
  for (let i = 0; i < 3; i++) {
    part(group, 'claw', mat, 0, 0, 0, 1, 1, 1, 0.03).rotation.set(0, (i * Math.PI * 2) / 3, Math.PI * 0.9);
  }
  part(group, 'sphere', toon(DARK), 0, 0, 0, 0.22, 0.22, 0.22, 0.04);
  return group;
}

export function buildItemModel(id, color) {
  const refs = buildBoat(color, [id]);
  if (!MOUNTED.has(id)) return refs.root;
  const turret = refs.parts[id];
  turret.removeFromParent();
  turret.position.set(0, 0, 0);
  return turret;
}
