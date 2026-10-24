import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { toon, glow, outlined, cachedGeometry, INK } from './toon.js';

export const HULL_L = 4.2;
export const HULL_W = 1.9;

const METAL = 0xc3cdd8;
const DARK = 0x34465e;
const RED = 0xff4141;

const MOUNTED = new Set(['machinegun', 'laser', 'saw', 'missiles', 'mines', 'jetpack', 'grapple', 'emp', 'flamethrower']);
const FRONT_MOUNT = 1.5;
const REAR_MOUNT = -2.2;
const SLOT_LOCK = { grapple: 0, jetpack: 1 };
export const slotLock = (id) => SLOT_LOCK[id];

export function arrange([a, b]) {
  return SLOT_LOCK[a] === 1 || SLOT_LOCK[b] === 0 ? [b, a] : [a, b];
}

export const slotCenter = (slot) => (slot === 0 ? 0 : Math.PI);
export const ALWAYS_AIMS = new Set(['flamethrower', 'saw']);
const BACK_HEIGHT = { machinegun: 1.45, laser: 1.45, flamethrower: 1.45, missiles: 1.2, saw: 0.95 };
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
  handle: () => cachedGeometry('handle', () => new THREE.TorusGeometry(0.34, 0.07, 8, 16, Math.PI)),
  shield: () => cachedGeometry('shield', () => new THREE.RingGeometry(0.2, 1.75, 40, 2).rotateY(Math.PI / 2)),
  octa: () => cachedGeometry('octa', () => new THREE.OctahedronGeometry(1, 0)),
  prong: () =>
    cachedGeometry('prong', () => {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0.08),
        new THREE.Vector3(0.28, 0, 0.14),
        new THREE.Vector3(0.52, 0, -0.04),
        new THREE.Vector3(0.58, 0, -0.32),
      ]);
      return new THREE.TubeGeometry(curve, 14, 0.075, 8);
    }),
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

function seeded(seed) {
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
}

function blob(ctx, r, x, y, size) {
  for (let k = 0; k < 5; k++) {
    ctx.beginPath();
    ctx.ellipse(x + (r() - 0.5) * size, y + (r() - 0.5) * size * 0.6, size * (0.4 + r() * 0.4), size * (0.25 + r() * 0.25), r() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
}

const camo = () =>
  canvasTexture('camo', (ctx) => {
    ctx.fillStyle = '#7a8f45';
    ctx.fillRect(0, 0, 256, 256);
    const r = seeded(11);
    const layers = [['#a08a55', 16, 34], ['#4d6a2b', 18, 30], ['#2d3f1d', 14, 22]];
    for (const [color, count, size] of layers) {
      ctx.fillStyle = color;
      for (let i = 0; i < count; i++) {
        const x = r() * 256;
        const y = r() * 256;
        for (const dx of [-256, 0, 256]) for (const dy of [-256, 0, 256]) blob(ctx, seeded(i * 97 + count), x + dx, y + dy, size);
      }
    }
  });

const camoNet = () =>
  canvasTexture('camoNet', (ctx) => {
    ctx.fillStyle = '#5d7131';
    ctx.fillRect(0, 0, 256, 256);
    const r = seeded(5);
    const leafColors = ['#7f9a3e', '#46602a', '#9b8a52', '#36502a'];
    for (let i = 0; i < 140; i++) {
      ctx.fillStyle = leafColors[i % leafColors.length];
      ctx.beginPath();
      ctx.ellipse(r() * 256, r() * 256, 5 + r() * 6, 2.5 + r() * 2.5, r() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(30, 40, 18, 0.85)';
    ctx.lineWidth = 2.5;
    for (let i = -256; i <= 512; i += 22) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 256, 256);
      ctx.moveTo(i, 256);
      ctx.lineTo(i + 256, 0);
      ctx.stroke();
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

const CAMO_SCALE = 0.22;

function applyCamoMapping(root, material) {
  root.updateMatrixWorld(true);
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  const normalMatrix = new THREE.Matrix3();
  root.traverse((mesh) => {
    if (!mesh.isMesh || mesh.material !== material) return;
    const g = mesh.geometry.clone();
    const pos = g.attributes.position;
    const nor = g.attributes.normal;
    const uv = new Float32Array(pos.count * 2);
    normalMatrix.getNormalMatrix(mesh.matrixWorld);
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
      n.fromBufferAttribute(nor, i).applyMatrix3(normalMatrix);
      const ax = Math.abs(n.x);
      const ay = Math.abs(n.y);
      const az = Math.abs(n.z);
      const [u, v] = ax >= ay && ax >= az ? [p.z, p.y] : ay >= az ? [p.x, p.z] : [p.x, p.y];
      uv[i * 2] = u * CAMO_SCALE;
      uv[i * 2 + 1] = v * CAMO_SCALE;
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    mesh.geometry = g;
  });
}

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
  const camoMat = hasCamo ? toon(0xffffff, { map: camo() }) : null;
  const hullMat = camoMat ?? (hasArmor ? toon(0xffffff, { map: iron() }) : mats.paint);
  const bumperMat = hasArmor || hasCamo ? mats.paint : mats.white;
  const deckMat = hasCamo
    ? toon(0xffffff, { map: camoNet() })
    : hasArmor
      ? toon(0xffffff, { map: treadPlate() })
      : toon(0xffffff, { map: planks() });

  part(body, 'hull', hullMat, 0, 0, 0, 1, 1, 1, 0.07);
  part(body, 'deck', deckMat, 0, 0, 0, 1, 1, 1, 0);
  part(body, 'bumper', bumperMat, 0, 0, 0, 1, 1, 1, 0.04);

  const sternTop = sheer(-HULL_L);
  part(body, 'roundBox', mats.dark, 0, sternTop - 0.05, -HULL_L - 0.15, 0.6, 0.5, 0.35, 0.03);
  part(body, 'cylinder', mats.dark, 0, sternTop - 0.75, -HULL_L - 0.55, 0.13, 1.3, 0.13, 0.03);
  part(body, 'capsule', mats.dark, 0, sternTop - 1.35, -HULL_L - 0.6, 0.32, 0.32, 0.32, 0.03).rotation.x = Math.PI / 2;
  part(body, 'roundBox', mats.dark, 0, sternTop - 1.6, -HULL_L - 0.45, 0.06, 0.3, 0.5, 0.02);
  const propeller = new THREE.Group();
  propeller.position.set(0, sternTop - 1.35, -HULL_L - 0.95);
  body.add(propeller);
  part(propeller, 'cone', mats.metal, 0, 0, -0.08, 0.1, 0.2, 0.1, 0.02).rotation.x = -Math.PI / 2;
  for (let i = 0; i < 3; i++) {
    const blade = new THREE.Group();
    blade.rotation.z = (i / 3) * Math.PI * 2;
    propeller.add(blade);
    part(blade, 'roundBox', mats.metal, 0, 0.22, 0, 0.2, 0.34, 0.05, 0.02).rotation.y = 0.55;
  }
  part(body, 'roundBox', camoMat ?? mats.paint, 0, sternTop + 0.35, -HULL_L - 0.55, 0.85, 0.95, 0.85, 0.04);
  part(body, 'roundBox', mats.white, 0, sternTop + 0.88, -HULL_L - 0.55, 0.7, 0.18, 0.7, 0.03);

  const towRing = (x, y, z, turn) => {
    const post = part(body, 'cylinder', mats.dark, x, y + 0.2, z, 0.09, 0.4, 0.09, 0.02);
    const ring = part(body, 'ring', mats.metal, x, y + 0.62, z, 0.3, 0.3, 0.3, 0.02);
    ring.rotation.y = turn;
    const anchor = new THREE.Object3D();
    anchor.position.set(x, y + 0.62, z);
    anchor.userData.parts = [post, ring];
    body.add(anchor);
    return anchor;
  };
  const towRings = [
    towRing(0, sternTop + 0.97, -HULL_L - 0.55, 0),
  ];

  const flagZ = -HULL_L + 0.6;
  const flagX = halfWidth(flagZ) - 0.35;
  part(body, 'cylinder', mats.dark, flagX, sternTop + 0.8, flagZ, 0.05, 1.6, 0.05, 0.02);
  const flag = new THREE.Group();
  flag.position.set(flagX, sternTop + 1.4, flagZ);
  body.add(flag);
  part(flag, 'cone', mats.paint, 0, 0, -0.45, 0.04, 0.9, 0.3, 0.02).rotation.x = -Math.PI / 2;

  const refs = { root, body, flag, towRings, saw: null, flames: [], spinners: [], materials: [], parts: {}, hookMarkers: [], heatMats: {}, swivels: [], busy: {}, missileTips: [], sags: [], modules: {} };
  refs.spinners.push({ mesh: propeller, axis: 'z', speed: 30 });

  if (camoMat) {
    mats.paint = camoMat;
    mats.white = toon(0xd8d0a8);
  }
  for (const id of items) {
    if (!id || MOUNTED.has(id)) continue;
    const group = new THREE.Group();
    body.add(group);
    HULL_MODS[id](group, mats, refs);
    refs.parts[id] = group;
  }

  items.forEach((id, slot) => {
    if (!MOUNTED.has(id)) return;
    const z = slot === 0 ? FRONT_MOUNT : REAR_MOUNT;
    const baseH = slot === 0 ? 0.35 : BACK_HEIGHT[id] ?? (MOUNTED.has(items[0]) ? 0.85 : 0.35);
    const turret = new THREE.Group();
    turret.position.set(0, deckTop(z), z);
    body.add(turret);
    refs.parts[id] = turret;
    part(turret, 'cylinder', mats.metal, 0, 0, 0, 1.15, 0.14, 1.15, 0.03);
    part(turret, 'cylinder', mats.dark, 0, baseH / 2, 0, 0.95, baseH, 0.95, 0.03);
    const yaw = new THREE.Group();
    yaw.position.y = baseH;
    turret.add(yaw);
    if (id !== 'jetpack') yaw.rotation.y = slotCenter(slot);
    refs.swivels.push({ id, group: yaw, slot, center: id === 'jetpack' ? 0 : slotCenter(slot) });
    const sag = new THREE.Group();
    yaw.add(sag);
    sag.userData.id = id;
    refs.sags.push(sag);
    const module = new THREE.Group();
    module.scale.setScalar(MODULE_SCALE);
    sag.add(module);
    refs.modules[id] = module;
    const mounts = MODULES[id](module, mats, refs);
    for (const [key, v] of Object.entries(mounts ?? {})) {
      const marker = new THREE.Object3D();
      marker.position.copy(v);
      module.add(marker);
      refs[key] = marker;
    }
  });

  refs.sawYaw = refs.swivels.find((s) => s.id === 'saw')?.group ?? null;
  if (camoMat) applyCamoMapping(root, camoMat);

  body.traverse((o) => {
    if (o.isMesh && o.material.isMeshToonMaterial && !refs.materials.includes(o.material)) refs.materials.push(o.material);
  });
  const heated = Object.values(refs.heatMats).flat();
  refs.materials = refs.materials.filter((m) => !heated.includes(m));
  for (const m of refs.materials) {
    m.emissive = new THREE.Color(0xffffff);
    m.emissiveIntensity = 0;
  }
  for (const m of heated) {
    m.emissive = new THREE.Color(0xff5a1f);
    m.emissiveIntensity = 0;
  }
  refs.char = { value: 0 };
  for (const m of [...refs.materials, ...heated]) charrable(m, refs.char);
  flattenStatic(root, refs);
  return refs;
}

export const charClock = { value: 0 };

function charrable(material, char) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uChar = char;
    shader.uniforms.uCharTime = charClock;
    shader.vertexShader = 'varying vec3 vCharPos;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      vCharPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
    );
    shader.fragmentShader = 'uniform float uChar;\nuniform float uCharTime;\nvarying vec3 vCharPos;\n' + shader.fragmentShader
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float charGlow = 0.0;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.035, 0.03, 0.028), uChar * 0.97);`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        if (uChar > 0.001) {
          vec3 q = vCharPos * 2.4;
          float t = uCharTime;
          float a = sin(q.x * 1.3 + sin(q.z * 1.7 + t * 0.6) * 1.8);
          float b = sin(q.z * 1.6 + sin(q.y * 2.1 - t * 0.5) * 1.6);
          float c = sin(q.y * 1.9 + q.x * 0.7 + t * 0.4);
          float vein = 1.0 - smoothstep(0.0, 0.13, abs(a * b + c * 0.25));
          float pulse = 0.6 + 0.4 * sin(t * 5.0 + q.x * 0.8 + q.z * 1.1);
          float ember = vein * pulse;
          charGlow = ember;
          totalEmissiveRadiance += uChar * (vec3(1.0, 0.38, 0.06) * ember * 2.2 + vec3(0.16, 0.025, 0.0) * (0.3 + 0.3 * sin(t * 3.0 + q.y)));
        }`,
      )
      .replace(
        '#include <opaque_fragment>',
        `outgoingLight = mix(outgoingLight, outgoingLight * 0.3, uChar * (1.0 - charGlow));
        #include <opaque_fragment>`,
      );
  };
  material.customProgramCacheKey = () => 'char';
}

function referenced(refs) {
  const keep = new Set();
  const visit = (v, depth) => {
    if (!v || depth > 3) return;
    if (v.isObject3D) keep.add(v);
    else if (Array.isArray(v)) for (const x of v) visit(x, depth + 1);
    else if (typeof v === 'object' && !v.isMaterial && !v.isBufferGeometry) for (const x of Object.values(v)) visit(x, depth + 1);
  };
  for (const v of Object.values(refs)) visit(v, 0);
  for (const ring of refs.towRings) for (const mesh of ring.userData.parts ?? []) keep.add(mesh);
  return keep;
}

const isOutline = (o) => o.isMesh && o.material?.uniforms?.uThickness;

function flattenStatic(root, refs) {
  const keep = referenced(refs);
  const parents = [];
  root.traverse((o) => parents.push(o));
  for (const parent of parents) {
    const groups = new Map();
    for (const child of parent.children) {
      if (!child.isMesh || keep.has(child) || isOutline(child) || !child.visible) continue;
      if (!child.children.every(isOutline)) continue;
      const line = child.children[0];
      const uv = child.geometry.hasAttribute('uv') && !!child.material.map;
      const id = `${child.material.uuid}|${line ? line.material.uniforms.uThickness.value : 'none'}|${uv}`;
      if (!groups.has(id)) groups.set(id, { material: child.material, line: line?.material, uv, list: [] });
      groups.get(id).list.push(child);
    }
    for (const { material, line, uv, list } of groups.values()) {
      if (list.length < 2) continue;
      const parts = list.map((child) => {
        child.updateMatrix();
        const g = (child.geometry.index ? child.geometry.toNonIndexed() : child.geometry.clone()).applyMatrix4(child.matrix);
        for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal' && !(uv && name === 'uv')) g.deleteAttribute(name);
        return g;
      });
      const geometry = mergeGeometries(parts);
      for (const g of parts) g.dispose();
      if (!geometry) continue;
      const mesh = new THREE.Mesh(geometry, material);
      if (line) mesh.add(new THREE.Mesh(geometry, line));
      for (const child of list) parent.remove(child);
      parent.add(mesh);
    }
  }
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

const CLAW_ANGLES = [114, 234, 354];
const HOSE_RUBBER = toon(0x2e3a2f);
const HOSE_RIB_MAT = toon(0x1c241d);
const HOSE_CLAMP = toon(0xd8dde4);
const HOSE_RIB = new THREE.TorusGeometry(0.08, 0.022, 6, 14);
const MINE_BODY = toon(0x8e9aa8);
const MINE_BAND = toon(0x5d6b7e);
const MINE_HORN = toon(0xb8c3cf);

function spikyBall(parent, x, y, z, radius, count) {
  part(parent, 'sphere', MINE_BODY, x, y, z, radius, radius, radius, 0.04);
  part(parent, 'ring', MINE_BAND, x, y, z, radius * 0.98, radius * 0.98, radius * 0.9, 0.02).rotation.x = Math.PI / 2;
  const length = radius * 0.32;
  for (const dir of sphereDirections(count)) {
    if (Math.abs(dir.y) < 0.12) continue;
    const mid = radius * 0.9 + length * 0.5;
    const horn = part(parent, 'cone', MINE_HORN, x + dir.x * mid, y + dir.y * mid, z + dir.z * mid, radius * 0.13, length, radius * 0.13, 0.02);
    horn.quaternion.setFromUnitVectors(UP, dir);
    const tip = radius * 0.9 + length * 0.95;
    part(parent, 'smallSphere', MINE_HORN, x + dir.x * tip, y + dir.y * tip, z + dir.z * tip, radius * 0.07, radius * 0.07, radius * 0.07, 0.015);
  }
}

const HULL_MODS = {
  spikes(body, mats, refs) {
    const spike = (base, dir, radius, length) => {
      const anchor = new THREE.Object3D();
      anchor.position.copy(base).addScaledVector(dir, length * 0.4);
      body.add(anchor);
      refs.hookMarkers.push(anchor);
      part(body, 'sphere', mats.dark, base.x, base.y, base.z, radius * 1.25, radius * 1.25, radius * 1.25, 0.03);
      const mesh = part(body, 'cone', mats.metal, base.x + dir.x * length * 0.5, base.y + dir.y * length * 0.5, base.z + dir.z * length * 0.5, radius, length, radius, 0.035);
      mesh.quaternion.setFromUnitVectors(UP, dir);
    };
    for (const side of [-1, 1]) {
      for (const z of [-3.5, -2.4, -1.3, -0.2, 0.9, 2.0, 3.0]) {
        const w = halfWidth(z);
        const slope = (halfWidth(z + 0.1) - halfWidth(z - 0.1)) / 0.2;
        const dir = new THREE.Vector3(side * 0.85, 0.65, -side * slope * 0.85).normalize();
        spike(new THREE.Vector3(side * (w + 0.12), sheer(z) + 0.12, z), dir, 0.17, 1.35);
      }
      spike(new THREE.Vector3(side * (halfWidth(-HULL_L) - 0.1), sheer(-HULL_L) + 0.15, -HULL_L + 0.1), new THREE.Vector3(side * 0.5, 0.55, -0.7).normalize(), 0.17, 1.25);
    }
    spike(new THREE.Vector3(0, sheer(HULL_L) - 0.1, HULL_L - 0.05), new THREE.Vector3(0, 0.18, 1).normalize(), 0.3, 1.9);
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

  camo() {},
};

const MODULES = {
  machinegun(module, mats, refs) {
    const gold = toon(0xffd23f);
    const m = new THREE.Group();
    module.add(m);
    refs.gunSwivel = m;
    const barrelMat = toon(METAL);
    refs.heatMats.machinegun = [barrelMat];
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
      part(barrels, 'cylinder', barrelMat, Math.cos(a) * 0.24, Math.sin(a) * 0.24, 0.92, 0.085, 1.84, 0.085, 0.02).rotation.x = Math.PI / 2;
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
    const muzzle = new THREE.Object3D();
    muzzle.position.set(0, 0.55, 2.3);
    m.add(muzzle);
    refs.gunMount = muzzle;
    refs.muzzleFlash = buildMuzzleFlash();
    muzzle.add(refs.muzzleFlash);
  },

  laser(m, mats, refs) {
    const core = glow(0xff2a2a);
    const hot = glow(0xffd0c8);
    const shell = mats.white;
    part(m, 'cylinder', mats.dark, 0, 0.32, -0.2, 0.42, 0.5, 0.42, 0.03);
    part(m, 'roundBox', shell, 0, 0.75, -0.35, 0.95, 0.72, 1.15, 0.04);
    part(m, 'roundBox', mats.paint, 0, 1.13, -0.35, 0.6, 0.1, 0.95, 0.03);
    const ventMat = toon(DARK);
    refs.heatMats.laser = [ventMat];
    for (const x of [-0.5, 0.5]) {
      for (const z of [-0.7, -0.45, -0.2]) part(m, 'roundBox', ventMat, x, 0.78, z, 0.08, 0.5, 0.14, 0.02);
    }
    const cell = part(m, 'capsule', core, 0, 0.75, -0.95, 0.34, 0.34, 0.34, 0);
    cell.rotation.x = Math.PI / 2;
    part(m, 'ring', mats.dark, 0, 0.75, -0.95, 0.3, 0.3, 0.8, 0.02);
    refs.spinners.push({ mesh: cell, axis: 'y', speed: 4 });
    part(m, 'cylinder', mats.dark, 0, 0.75, 0.6, 0.15, 1.6, 0.15, 0.03).rotation.x = Math.PI / 2;
    for (const [x, y] of [[0.24, 0], [-0.24, 0], [0, 0.24]]) {
      const rail = part(m, 'roundBox', shell, x, 0.75 + y, 0.55, x ? 0.08 : 0.32, x ? 0.32 : 0.08, 1.45, 0.02);
      rail.userData.rail = true;
    }
    const rings = [];
    for (const z of [0.15, 0.45, 0.75, 1.05]) {
      const r = part(m, 'ring', core, 0, 0.75, z, 0.2, 0.2, 0.8, 0.02);
      rings.push(r);
    }
    refs.laserRings = rings;
    part(m, 'cylinder', mats.metal, 0, 0.75, 1.42, 0.26, 0.14, 0.26, 0.03).rotation.x = Math.PI / 2;
    for (let k = 0; k < 3; k++) {
      const prong = new THREE.Group();
      prong.position.set(0, 0.75, 1.48);
      prong.rotation.z = (k / 3) * Math.PI * 2 + Math.PI / 2;
      m.add(prong);
      part(prong, 'roundBox', mats.dark, 0.24, 0, 0.22, 0.07, 0.07, 0.5, 0.02).rotation.y = -0.35;
    }
    part(m, 'cylinder', hot, 0, 0.75, 1.5, 0.12, 0.03, 0.12, 0).rotation.x = Math.PI / 2;
    return { laserMount: new THREE.Vector3(0, 0.75, 1.62) };
  },

  flamethrower(m, mats, refs) {
    const tankMat = mats.paint.clone();
    refs.heatMats.flamethrower = [tankMat];
    part(m, 'cylinder', mats.dark, 0, 0.3, -0.1, 0.55, 0.6, 0.55, 0.03);
    part(m, 'cylinder', mats.paint, 0, 0.32, -0.1, 0.58, 0.16, 0.58, 0.02);
    for (const x of [-0.36, 0.36]) {
      part(m, 'capsule', tankMat, x, 1.15, -0.6, 0.6, 0.62, 0.6, 0.04);
      part(m, 'cylinder', mats.white, x, 1.15, -0.6, 0.32, 0.14, 0.32, 0.02);
      part(m, 'cylinder', mats.metal, x, 1.92, -0.6, 0.1, 0.16, 0.1, 0.02);
    }
    for (const x of [-0.36, 0.36]) {
      const hose = new THREE.CatmullRomCurve3([
        new THREE.Vector3(x, 0.6, -0.42),
        new THREE.Vector3(x * 1.8, 0.52, -0.2),
        new THREE.Vector3(x * 1.6, 0.62, 0.15),
        new THREE.Vector3(x * 0.75, 0.78, 0.27),
      ]);
      m.add(outlined(new THREE.TubeGeometry(hose, 16, 0.075, 8), HOSE_RUBBER, 0.02));
      for (let k = 1; k < 9; k++) {
        const u = k / 9;
        const rib = new THREE.Mesh(HOSE_RIB, k === 1 || k === 8 ? HOSE_CLAMP : HOSE_RIB_MAT);
        rib.position.copy(hose.getPointAt(u));
        rib.lookAt(rib.position.clone().add(hose.getTangentAt(u)));
        m.add(rib);
      }
      part(m, 'cylinder', mats.metal, x, 0.6, -0.42, 0.11, 0.12, 0.11, 0.02);
    }
    part(m, 'sphere', mats.dark, 0, 0.8, 0.25, 0.32, 0.32, 0.32, 0.03);
    const pipe = part(m, 'cylinder', mats.metal, 0, 0.8, 0.95, 0.13, 1.4, 0.13, 0.03);
    pipe.rotation.x = Math.PI / 2;
    for (const z of [0.45, 0.85, 1.25]) part(m, 'cylinder', mats.paint, 0, 0.8, z, 0.18, 0.12, 0.18, 0.02).rotation.x = Math.PI / 2;
    const nozzle = part(m, 'cone', mats.dark, 0, 0.8, 1.75, 0.24, 0.35, 0.24, 0.03);
    nozzle.rotation.x = -Math.PI / 2;
    const pilot = new THREE.Mesh(geo.smallSphere(), glow(0x6ac8ff));
    pilot.scale.setScalar(0.09);
    pilot.position.set(0, 0.65, 1.88);
    m.add(pilot);
    refs.pilotLight = pilot;
    return { flameMount: new THREE.Vector3(0, 0.8, 1.95) };
  },

  saw(m, mats, refs) {
    part(m, 'cylinder', mats.dark, 0, 0.75, 0, 0.22, 1.5, 0.22, 0.03);
    part(m, 'sphere', mats.dark, 0, 1.55, 0, 0.32, 0.32, 0.32, 0.03);
    part(m, 'cylinder', mats.paint, 0, 1.55, 1.3, 0.15, 2.6, 0.15, 0.03).rotation.x = Math.PI / 2;
    part(m, 'roundBox', mats.dark, 0, 1.55, 2.6, 0.34, 0.5, 0.34, 0.02);
    const bladeMat = toon(METAL);
    refs.heatMats.saw = [bladeMat];
    const saw = part(m, 'saw', bladeMat, 0, 1.55, 2.85, 1.25, 1.25, 1.25, 0.03);
    part(saw, 'sphere', toon(RED), 0, 0, 0, 0.26, 0.26, 0.26, 0.03);
    refs.saw = saw;
    const shield = new THREE.Mesh(
      geo.shield(),
      new THREE.MeshBasicMaterial({ color: 0xff8a7a, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }),
    );
    shield.position.set(0, 1.55, 2.85);
    m.add(shield);
    refs.sawShield = shield;
  },

  missiles(m, mats, refs) {
    const launcher = new THREE.Group();
    launcher.position.set(0, 0.75, 0);
    launcher.rotation.x = -0.3;
    m.add(launcher);
    part(m, 'cylinder', mats.dark, 0, 0.3, 0, 0.2, 0.6, 0.2, 0.03);
    part(m, 'roundBox', mats.dark, 0, 0.5, 0, 1.45, 0.14, 0.5, 0.03);
    for (const x of [-0.66, 0.66]) part(m, 'roundBox', mats.dark, x, 0.68, 0, 0.12, 0.5, 0.42, 0.02);
    part(launcher, 'cylinder', mats.metal, 0, 0, 0, 0.1, 1.42, 0.1, 0.02).rotation.z = Math.PI / 2;
    const red = toon(RED);
    for (const [x, y] of [[-0.27, -0.17], [0.27, -0.17], [0, 0.29]]) {
      {
        part(launcher, 'cylinder', mats.white, x, y, 0, 0.23, 1.7, 0.23, 0.03).rotation.x = Math.PI / 2;
        part(launcher, 'cylinder', mats.ink, x, y, 0.84, 0.17, 0.04, 0.17, 0).rotation.x = Math.PI / 2;
        part(launcher, 'cylinder', mats.metal, x, y, -0.86, 0.15, 0.06, 0.15, 0.02).rotation.x = Math.PI / 2;
        const tip = part(launcher, 'cone', red, x, y, 0.98, 0.15, 0.36, 0.15, 0.03);
        tip.rotation.x = Math.PI / 2;
        tip.userData.restZ = 0.98;
        refs.missileTips.push(tip);
      }
    }
    for (const z of [-0.45, 0.4]) part(launcher, 'roundBox', mats.paint, 0, 0, z, 1.08, 1.08, 0.2, 0.03);
    const mount = new THREE.Object3D();
    mount.position.set(0, 0, 1.3);
    launcher.add(mount);
    refs.missileMount = mount;
  },

  mines(m, mats, refs) {
    part(m, 'cylinder', mats.dark, 0, 0.25, 0, 0.5, 0.5, 0.5, 0.03);
    const cup = part(m, 'ring', mats.paint, 0, 0.55, 0, 0.6, 0.6, 1.8, 0.03);
    cup.rotation.x = Math.PI / 2;
    for (const degrees of CLAW_ANGLES) {
      const a = THREE.MathUtils.degToRad(degrees);
      const claw = part(m, 'roundBox', mats.metal, Math.cos(a) * 0.615, 0.74, Math.sin(a) * 0.615, 0.14, 0.48, 0.14, 0.02);
      claw.rotation.y = -a;
    }
    const loaded = new THREE.Group();
    loaded.position.set(0, MINE_REST_Y, 0);
    m.add(loaded);
    spikyBall(loaded, 0, 0, 0, 0.55, 14);
    part(loaded, 'smallSphere', glow(RED), 0, 0.53, 0, 0.11, 0.11, 0.11, 0);
    refs.mineLoaded = loaded;
    return { mineMount: new THREE.Vector3(0, MINE_REST_Y, 0) };
  },

  jetpack(m, mats, refs) {
    const red = toon(RED);
    const glowCore = glow(0xffb02e);
    part(m, 'roundBox', mats.metal, 0, 0.2, -0.1, 1.7, 0.25, 1.1, 0.03);
    for (const x of [-0.6, 0.6]) part(m, 'roundBox', mats.dark, x, 0.4, -0.1, 0.3, 0.4, 0.5, 0.02);
    part(m, 'cylinder', mats.metal, 0, 0.75, -0.1, 0.24, 1.3, 0.24, 0.03).rotation.x = Math.PI / 2;
    part(m, 'sphere', mats.white, 0, 1.0, 0.15, 0.14, 0.1, 0.14, 0.02);
    part(m, 'smallSphere', red, 0.03, 1.08, 0.18, 0.04, 0.03, 0.04, 0);
    part(m, 'handle', mats.metal, 0, 0.95, -0.4, 1, 1, 1, 0.02);
    const grip = new THREE.Object3D();
    grip.position.set(0, 1.29, -0.4);
    m.add(grip);
    refs.hookMarkers.push(grip);
    for (const x of [-0.6, 0.6]) {
      const rocket = new THREE.Group();
      rocket.position.set(x, 0.9, -0.1);
      rocket.rotation.x = Math.PI / 2 - 0.12;
      m.add(rocket);
      part(rocket, 'capsule', mats.white, 0, 0.1, 0, 0.8, 0.95, 0.8, 0.04);
      part(rocket, 'cone', red, 0, 1.05, 0, 0.32, 0.55, 0.32, 0.03);
      part(rocket, 'cylinder', mats.paint, 0, 0.15, 0, 0.43, 0.22, 0.43, 0.02);
      part(rocket, 'cylinder', mats.paint, 0, -0.25, 0, 0.42, 0.08, 0.42, 0.02);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + Math.PI / 2;
        const fin = part(rocket, 'roundBox', red, Math.cos(a) * 0.42, -0.5, Math.sin(a) * 0.42, 0.08, 0.6, 0.38, 0.02);
        fin.rotation.y = -a;
      }
      part(rocket, 'cone', mats.dark, 0, -0.85, 0, 0.32, 0.4, 0.32, 0.03);
      part(rocket, 'cylinder', glowCore, 0, -1.04, 0, 0.24, 0.04, 0.24, 0);
      const flame = new THREE.Mesh(geo.flame(), glow(0xffa62b, { transparent: true, opacity: 0.9 }));
      flame.position.set(0, -1.05, 0);
      flame.visible = false;
      rocket.add(flame);
      refs.flames.push(flame);
    }
  },

  grapple(m, mats, refs) {
    part(m, 'sphere', mats.dark, 0, 0.35, 0, 0.6, 0.45, 0.6, 0.04);
    part(m, 'cylinder', mats.paint, 0, 0.3, 0, 0.62, 0.16, 0.62, 0.02);
    const barrel = new THREE.Group();
    barrel.position.set(0, 0.75, 0.75);
    barrel.rotation.x = Math.PI / 2 - 0.25;
    m.add(barrel);
    part(barrel, 'cylinder', mats.metal, 0, 0, 0, 0.24, 1.7, 0.24, 0.04);
    for (const y of [-0.5, 0.25]) part(barrel, 'cylinder', mats.paint, 0, y, 0, 0.28, 0.18, 0.28, 0.02);
    part(barrel, 'cylinder', mats.paint, 0, 0.82, 0, 0.3, 0.12, 0.3, 0.02);
    const hook = new THREE.Group();
    hook.position.set(0, 0.97, 1.65);
    hook.rotation.x = -0.25;
    hook.scale.setScalar(1.3);
    m.add(hook);
    hookHead(hook, mats.metal, mats.dark);
    refs.hookHead = hook;
    part(m, 'cylinder', mats.paint, 0.75, 0.25, -0.2, 0.3, 0.32, 0.3, 0.02);
    part(m, 'ring', toon(0xc0874f), 0.75, 0.25, -0.2, 0.4, 0.4, 1.4, 0.03).rotation.x = Math.PI / 2;
    return { hookMount: new THREE.Vector3(0, 0.97, 1.7) };
  },

  emp(m, mats, refs) {
    part(m, 'cylinder', mats.metal, 0, 0.25, 0, 0.5, 0.5, 0.5, 0.03);
    part(m, 'cylinder', mats.paint, 0, 0.25, 0, 0.53, 0.14, 0.53, 0.02);
    part(m, 'cylinder', mats.dark, 0, 1.0, 0, 0.1, 1.4, 0.1, 0.02);
    refs.empCore = part(m, 'sphere', glow(0x8ff6ff), 0, 1.9, 0, 0.45, 0.45, 0.45, 0.04);
    const halo = new THREE.Mesh(geo.sphere(), new THREE.MeshBasicMaterial({ color: 0x5ff4ff, transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.position.set(0, 1.9, 0);
    halo.scale.setScalar(0.6);
    m.add(halo);
    refs.empHalo = halo;
    const a = part(m, 'ring', mats.metal, 0, 1.9, 0, 0.75, 0.75, 0.75, 0.03);
    const b = part(m, 'ring', mats.metal, 0, 1.9, 0, 0.68, 0.68, 0.68, 0.03);
    b.rotation.x = Math.PI / 2;
    refs.spinners.push({ mesh: a, axis: 'y', speed: 2.4 }, { mesh: b, axis: 'z', speed: -3 });
    return { empOrb: new THREE.Vector3(0, 1.9, 0) };
  },
};

export function buildMine() {
  const group = new THREE.Group();
  spikyBall(group, 0, 0.3, 0, 0.85, 16);
  const light = new THREE.Mesh(geo.smallSphere(), glow(RED));
  light.scale.setScalar(0.2);
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

function hookHead(group, metal, dark) {
  part(group, 'cylinder', metal, 0, 0, -0.4, 0.08, 0.9, 0.08, 0.02).rotation.x = Math.PI / 2;
  part(group, 'ring', dark, 0, 0, -0.92, 0.14, 0.14, 0.8, 0.02).rotation.y = Math.PI / 2;
  part(group, 'sphere', dark, 0, 0, 0.06, 0.16, 0.16, 0.16, 0.03);
  for (let i = 0; i < 4; i++) {
    const prong = new THREE.Group();
    prong.rotation.z = (i / 4) * Math.PI * 2 + Math.PI / 4;
    group.add(prong);
    part(prong, 'prong', metal, 0, 0, 0, 1, 1, 1, 0.025);
    const tip = part(prong, 'cone', metal, 0.59, 0, -0.42, 0.1, 0.24, 0.1, 0.02);
    tip.quaternion.setFromUnitVectors(UP, new THREE.Vector3(0.15, 0, -1).normalize());
  }
}

export function buildHook() {
  const group = new THREE.Group();
  group.scale.setScalar(1.5);
  hookHead(group, toon(METAL), toon(DARK));
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

export function spendMissile(refs, out) {
  const tip = refs.missileTips.find((t) => t.visible);
  if (!tip) return null;
  tip.getWorldPosition(out);
  tip.visible = false;
  return out;
}

export function reloadMissile(refs) {
  const tip = refs.missileTips.find((t) => !t.visible);
  if (!tip) return;
  tip.visible = true;
  tip.userData.rise = 0;
  tip.position.z = tip.userData.restZ - 0.7;
}

export function updateMissileTips(refs, dt) {
  for (const tip of refs.missileTips) {
    if (tip.userData.rise == null) continue;
    tip.userData.rise = Math.min(1, tip.userData.rise + dt / 0.55);
    const k = tip.userData.rise;
    const ease = 1 + 2.4 * Math.pow(k - 1, 3) + 1.4 * Math.pow(k - 1, 2);
    tip.position.z = tip.userData.restZ - 0.7 * (1 - ease);
    if (k >= 1) tip.userData.rise = null;
  }
}

export function missileDirection(refs, out) {
  return out.set(0, 0, 1).applyQuaternion(refs.missileMount.parent.getWorldQuaternion(new THREE.Quaternion()));
}
const MINE_REST_Y = 1.05;

export function launchMine(refs) {
  if (!refs.mineLoaded) return;
  refs.mineLoaded.visible = false;
  refs.mineReload = null;
}

export function reloadMine(refs) {
  if (refs.mineLoaded && !refs.mineLoaded.visible) refs.mineReload = 0.45;
}

export function updateMineHolder(refs, dt) {
  const mine = refs.mineLoaded;
  if (!mine || refs.mineReload == null) return;
  refs.mineReload += dt;
  const t = refs.mineReload;
  mine.visible = t > 0.45;
  const k = Math.min(1, Math.max(0, (t - 0.45) / 0.55));
  const rise = 1 + 2.4 * Math.pow(k - 1, 3) + 1.4 * Math.pow(k - 1, 2);
  mine.position.y = MINE_REST_Y - 2.4 * (1 - rise);
  mine.rotation.y = (1 - k) * 4;
  const grow = Math.min(1, Math.max(0, (k - 0.5) / 0.5));
  const pop = 1 + 2.7 * Math.pow(grow - 1, 3) + 1.7 * Math.pow(grow - 1, 2);
  mine.scale.setScalar(0.4 + 0.6 * pop);
  if (k >= 1) {
    mine.scale.setScalar(1);
    refs.mineReload = null;
  }
}

const AIM_DELAY = 0.3;

export function aimTurret(refs, id) {
  refs.busy[id] = 1.9;
  const swivel = refs.swivels.find((s) => s.id === id);
  if (!swivel || swivel.slot === 1 || ALWAYS_AIMS.has(id)) return 0;
  const yaw = swivel.group.rotation.y;
  return Math.abs(Math.atan2(Math.sin(yaw), Math.cos(yaw))) > 0.25 ? AIM_DELAY : 0;
}

export const GUN_RATE = 0.062;
const HEAT_TIME = 2.5;

export function newHeat() {
  return { trigger: false, firing: false, heat: 0, overheated: false, timer: 0, delay: 0 };
}

function stepHeat(h, refs, id, dt, time) {
  let overheatedNow = false;
  if (h.trigger && !h.overheated) {
    const delay = aimTurret(refs, id);
    if (!h.firing) h.delay = delay;
    h.firing = true;
    h.delay = Math.max(0, h.delay - dt);
    if (h.delay <= 0) h.heat += dt / HEAT_TIME;
    if (h.heat >= 1) {
      h.heat = 1;
      h.overheated = true;
      h.firing = false;
      overheatedNow = true;
    }
  } else {
    h.firing = false;
    h.heat = Math.max(0, h.heat - dt * (h.overheated ? 0.45 : 0.7));
    if (h.overheated && h.heat <= 0) h.overheated = false;
  }
  const glowAmount = h.heat * h.heat * 0.9 * (h.overheated ? 0.75 + Math.sin(time * 30) * 0.25 : 1);
  for (const m of refs.heatMats[id] ?? []) m.emissiveIntensity = glowAmount;
  return overheatedNow;
}

let flashTextures = null;
function flashArt() {
  if (flashTextures) return flashTextures;
  const paint = (w, h, draw) => {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    draw(canvas.getContext('2d'), w, h);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  };
  const star = paint(128, 128, (g, w) => {
    const c = w / 2;
    const glowFill = g.createRadialGradient(c, c, 0, c, c, c);
    glowFill.addColorStop(0, 'rgba(255,255,240,1)');
    glowFill.addColorStop(0.18, 'rgba(255,236,140,1)');
    glowFill.addColorStop(0.45, 'rgba(255,160,40,0.55)');
    glowFill.addColorStop(1, 'rgba(255,90,0,0)');
    g.fillStyle = glowFill;
    g.fillRect(0, 0, w, w);
    g.translate(c, c);
    for (let k = 0; k < 7; k++) {
      g.rotate((Math.PI * 2) / 7);
      const reach = c * (0.75 + (k % 2) * 0.22);
      const spike = g.createLinearGradient(0, 0, reach, 0);
      spike.addColorStop(0, 'rgba(255,255,230,1)');
      spike.addColorStop(0.5, 'rgba(255,214,90,0.9)');
      spike.addColorStop(1, 'rgba(255,140,30,0)');
      g.fillStyle = spike;
      g.beginPath();
      g.moveTo(0, -c * 0.1);
      g.lineTo(reach, 0);
      g.lineTo(0, c * 0.1);
      g.fill();
    }
  });
  const tongue = paint(128, 64, (g, w, h) => {
    const fill = g.createLinearGradient(0, 0, w, 0);
    fill.addColorStop(0, 'rgba(255,255,235,1)');
    fill.addColorStop(0.35, 'rgba(255,220,100,0.95)');
    fill.addColorStop(0.75, 'rgba(255,140,30,0.6)');
    fill.addColorStop(1, 'rgba(255,90,0,0)');
    g.fillStyle = fill;
    g.beginPath();
    g.moveTo(0, h * 0.3);
    g.quadraticCurveTo(w * 0.35, 0, w * 0.55, h * 0.18);
    g.lineTo(w * 0.7, h * 0.05);
    g.lineTo(w * 0.72, h * 0.32);
    g.lineTo(w, h * 0.5);
    g.lineTo(w * 0.72, h * 0.68);
    g.lineTo(w * 0.7, h * 0.95);
    g.lineTo(w * 0.55, h * 0.82);
    g.quadraticCurveTo(w * 0.35, h, 0, h * 0.7);
    g.fill();
  });
  flashTextures = { star, tongue };
  return flashTextures;
}

function buildMuzzleFlash() {
  const { star, tongue } = flashArt();
  const additive = (map) => new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const flash = new THREE.Group();
  const flame = additive(tongue);
  const length = new THREE.PlaneGeometry(1, 0.55).translate(0.5, 0, 0).rotateY(-Math.PI / 2);
  for (const roll of [0, Math.PI / 2]) {
    const plane = new THREE.Mesh(length, flame);
    plane.scale.setScalar(2.6);
    plane.rotation.z = roll;
    flash.add(plane);
  }
  const front = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), additive(star));
  front.position.z = 0.25;
  front.scale.setScalar(1.8);
  flash.add(front);
  const burst = new THREE.Sprite(new THREE.SpriteMaterial({ map: star, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  burst.position.z = 0.35;
  burst.scale.setScalar(2.4);
  flash.add(burst);
  flash.userData.burst = burst;
  flash.visible = false;
  return flash;
}

export function flashGun(refs) {
  const flash = refs.muzzleFlash;
  if (!flash) return;
  refs.flashTime = 0.05;
  flash.visible = true;
  flash.rotation.z = Math.random() * Math.PI * 2;
  flash.scale.setScalar(0.8 + Math.random() * 0.5);
  flash.userData.burst.material.rotation = Math.random() * Math.PI * 2;
}

export function stepGun(gun, refs, dt, time) {
  const overheatedNow = stepHeat(gun, refs, 'machinegun', dt, time);
  let shots = 0;
  if (gun.firing && gun.delay <= 0) {
    gun.timer -= dt;
    while (gun.timer <= 0) {
      shots++;
      gun.timer += GUN_RATE;
    }
  } else {
    gun.timer = 0;
  }
  if (refs.minigun) refs.minigun.rotation.z += dt * (gun.firing ? 32 : 1.5);
  if (refs.muzzleFlash) {
    refs.flashTime = (refs.flashTime ?? 0) - dt;
    refs.muzzleFlash.visible = refs.flashTime > 0;
  }
  if (refs.gunSwivel) {
    const sway = gun.firing ? Math.sin(time * 11) * 0.22 + Math.sin(time * 23) * 0.09 : 0;
    refs.gunSwivel.rotation.y += (sway - refs.gunSwivel.rotation.y) * (1 - Math.exp(-20 * dt));
  }
  return { shots, overheatedNow };
}

export function stepSaw(saw, refs, dt, time) {
  const overheatedNow = stepHeat(saw, refs, 'saw', dt, time);
  return { cutting: saw.firing, overheatedNow };
}

export function stepFlame(flame, refs, dt, time) {
  const overheatedNow = stepHeat(flame, refs, 'flamethrower', dt, time);
  const spraying = flame.firing && flame.delay <= 0;
  const gun = refs.modules.flamethrower;
  if (gun) {
    const sway = spraying ? Math.sin(time * 7) * 0.12 + Math.sin(time * 17) * 0.04 : 0;
    gun.rotation.y += (sway - gun.rotation.y) * (1 - Math.exp(-14 * dt));
  }
  if (refs.pilotLight) refs.pilotLight.scale.setScalar(0.09 * (spraying ? 1.6 : 0.8 + Math.sin(time * 20) * 0.15));
  return { spraying, overheatedNow };
}

export function flameDirection(refs, out) {
  return out.set(0, 0, 1).applyQuaternion(refs.flameMount.parent.getWorldQuaternion(new THREE.Quaternion()));
}

export function stepLaser(laser, refs, dt, time) {
  const overheatedNow = stepHeat(laser, refs, 'laser', dt, time);
  const beaming = laser.firing && laser.delay <= 0;
  refs.laserRings?.forEach((ring, i) => {
    const wave = beaming ? Math.sin(time * 26 - i * 1.4) : Math.sin(time * 3 - i * 0.6);
    ring.scale.setScalar(1 + (beaming ? 0.35 : 0.08) * Math.max(0, wave));
  });
  return { beaming, overheatedNow };
}

export function aimLaserGun(refs, wobble, dt) {
  const gun = refs.modules.laser;
  if (!gun) return;
  const k = wobble ? 1 : 1 - Math.exp(-10 * dt);
  gun.rotation.y += ((wobble?.yaw ?? 0) - gun.rotation.y) * k;
  gun.rotation.x += (-Math.atan(wobble?.lift ?? 0) - gun.rotation.x) * k;
  gun.updateMatrixWorld(true);
}

const parentQuat = new THREE.Quaternion();
export function pointLaserGun(refs, dir, out) {
  const gun = refs.modules.laser;
  gun.parent.getWorldQuaternion(parentQuat);
  const local = dir.clone().applyQuaternion(parentQuat.invert()).normalize();
  gun.rotation.order = 'YXZ';
  gun.rotation.set(-Math.asin(local.y), Math.atan2(local.x, local.z), 0);
  gun.updateMatrixWorld(true);
  return refs.laserMount.getWorldPosition(out);
}

export function laserWobble(time, seed) {
  const t = time + seed;
  const yaw = Math.sin(t * 6.3) * 0.13 + Math.sin(t * 15.7) * 0.05;
  const lift = Math.max(0, Math.sin(t * 2.9)) ** 3 * 0.16 + Math.max(0, Math.sin(t * 9.1)) * 0.03;
  return { yaw, lift };
}

export function laserDirection(refs, out) {
  refs.laserMount.parent.getWorldQuaternion(muzzleQuat);
  return out.set(0, 0, 1).applyQuaternion(muzzleQuat);
}

const muzzleQuat = new THREE.Quaternion();
export function gunDirection(refs, out) {
  refs.gunSwivel.getWorldQuaternion(muzzleQuat);
  return out.set(0, 0, 1).applyQuaternion(muzzleQuat);
}

