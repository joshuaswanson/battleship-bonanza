import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createWater } from './water.js';
import { toon, glow, outlineMaterial, mulberry32 } from './toon.js';
import { Batcher, cullChunks, COLORS, createSky, createCloud, createArch, SUN_DIR } from './world.js';
import { courseBuoys, ellipseHit } from './terrain.js';
import { frame } from './alpine.js';
import { bigBattleship } from './battleship.js';
import { destroyer as newDestroyer, carrier as newCarrier } from './warships.js';

const NAVY = {
  ...COLORS,
  hull: 0x6b7785,
  hullDark: 0x4d5763,
  hullLight: 0x8a95a2,
  boot: 0x2a2d33,
  keelRed: 0x8a2b26,
  deck: 0x7a6e5c,
  deckDark: 0x5e5446,
  deckLine: 0xf2efe6,
  steel: 0x5a636e,
  steelDark: 0x3a4048,
  window: 0x1e242c,
  funnel: 0x4a525c,
  funnelTop: 0x1a1c20,
  gun: 0x3a4048,
  scorch: 0x1c1b1a,
  wreck: 0x4a4f55,
  oil: 0x15161a,
  raft: 0xe8a33a,
  planeBlue: 0x3b5d8c,
  planeGreen: 0x5f6b45,
  steelLight: 0x9aa4ae,
  boatWhite: 0xe9ecef,
  flagRed: 0xc0392b,
  lampGlass: 0xfff1b0,
};

const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 14);
const CONE = new THREE.ConeGeometry(1, 1, 14);
const BALL = new THREE.SphereGeometry(1, 14, 10);
const DISH = new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2);

function planeGeometry(kind) {
  const parts = [];
  const add = (geometry, color, m) => {
    const g = geometry.clone().applyMatrix4(m);
    const flat = g.index ? g.toNonIndexed() : g;
    flat.deleteAttribute('uv');
    const c = new THREE.Color(color);
    const n = flat.attributes.position.count;
    const rgb = new Float32Array(n * 3);
    for (let k = 0; k < n; k++) rgb.set([c.r, c.g, c.b], k * 3);
    flat.setAttribute('color', new THREE.BufferAttribute(rgb, 3));
    parts.push(flat);
  };
  const M = (x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
  const capsule = new THREE.CapsuleGeometry(1, 1, 6, 12).rotateX(Math.PI / 2);
  if (kind === 'bomber') {
    const body = 0x4a5d73;
    add(capsule, body, M(0, 0, 0, 1.4, 1.5, 6.5));
    add(BALL, 0x9fd3f0, M(0, 0.3, 6.4, 1.05, 1.0, 1.2));
    add(BOX, body, M(0, 0, 0.6, 20, 0.35, 3.2));
    add(BOX, body, M(0, 0.4, -7.4, 7, 0.25, 1.8));
    for (const s of [-1, 1]) {
      add(BOX, body, M(s * 3.4, 1.6, -7.6, 0.25, 3, 2));
      add(CYL, 0x3a4048, M(s * 5, -0.2, 2.2, 0.7, 3.4, 0.7, Math.PI / 2));
      add(CYL, 0x23262b, M(s * 5, -0.2, 4, 0.45, 0.4, 0.45, Math.PI / 2));
      add(CYL, 0xf2efe6, M(s * 7.5, 0.2, 0.6, 1.0, 0.05, 1.0));
      add(CYL, 0x2f4f7a, M(s * 7.5, 0.23, 0.6, 0.55, 0.05, 0.55));
    }
    add(BALL, 0x9fd3f0, M(0, 1.3, 1.5, 0.7, 0.6, 1.4));
  } else {
    const body = kind === 'blue' ? 0x3b5d8c : 0x5f6b45;
    const belly = kind === 'blue' ? 0xc9d3dd : 0xa9ad92;
    add(capsule, body, M(0, 0, 0, 0.75, 0.8, 3.1));
    add(capsule, belly, M(0, -0.32, -0.2, 0.55, 0.45, 2.7));
    add(CYL, 0x2a2d33, M(0, 0, 3.3, 0.82, 0.6, 0.82, Math.PI / 2));
    add(CYL, 0x23262b, M(0, 0, 3.7, 0.22, 0.4, 0.22, Math.PI / 2));
    add(BOX, body, M(0, -0.3, 0.6, 10.5, 0.22, 1.9));
    add(BOX, body, M(0, 0.1, -3.4, 3.8, 0.16, 1.1));
    add(BOX, body, M(0, 0.85, -3.5, 0.16, 1.5, 1.2));
    add(BALL, 0x9fd3f0, M(0, 0.65, 0.5, 0.48, 0.42, 0.95));
    const roundel = kind === 'blue' ? [0xf2efe6, 0x2f4f7a] : [0xf2efe6, 0xd0343a];
    for (const s of [-1, 1]) {
      add(CYL, roundel[0], M(s * 3.6, -0.17, 0.6, 0.62, 0.04, 0.62));
      add(CYL, roundel[1], M(s * 3.6, -0.15, 0.6, 0.38, 0.04, 0.38));
    }
    if (kind === 'blue') add(BOX, 0xf2efe6, M(0, 0.85, -3.75, 0.18, 0.3, 0.5));
    else add(BOX, 0xd0343a, M(0, 0.85, -3.75, 0.18, 0.4, 0.4));
  }
  const geometry = mergeGeometries(parts);
  geometry.computeVertexNormals();
  return geometry;
}

function propGeometry(size) {
  return new THREE.CylinderGeometry(size, size, 0.05, 20).rotateX(Math.PI / 2);
}

function parachuteGeometry() {
  const parts = [];
  const add = (geometry, color, m) => {
    const g = (geometry.index ? geometry.toNonIndexed() : geometry.clone()).applyMatrix4(m);
    g.deleteAttribute('uv');
    const c = new THREE.Color(color);
    const rgb = new Float32Array(g.attributes.position.count * 3);
    for (let k = 0; k < g.attributes.position.count; k++) rgb.set([c.r, c.g, c.b], k * 3);
    g.setAttribute('color', new THREE.BufferAttribute(rgb, 3));
    parts.push(g);
  };
  const M = (x, y, z, sx, sy, sz, rx = 0, rz = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, 0, rz)), new THREE.Vector3(sx, sy, sz));
  add(DISH, 0xf2efe6, M(0, 4, 0, 3, 1.6, 3));
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    add(CYL, 0x8a8f96, M(Math.cos(a) * 1.4, 2, Math.sin(a) * 1.4, 0.04, 4.2, 0.04, Math.sin(a) * 0.6, -Math.cos(a) * 0.6));
  }
  add(CYL, 0x5f6b45, M(0, 0, 0, 0.35, 1.1, 0.35));
  add(BALL, 0xffd2b0, M(0, 0.8, 0, 0.3, 0.3, 0.3));
  const g = mergeGeometries(parts);
  g.computeVertexNormals();
  return g;
}

async function loadFighter(url) {
  const gltf = await new GLTFLoader().loadAsync(url);
  gltf.scene.updateMatrixWorld(true);
  let mesh = null;
  gltf.scene.traverse((o) => {
    if (o.isMesh && !mesh) mesh = o;
  });
  const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
  geometry.computeBoundingBox();
  const c = geometry.boundingBox.getCenter(new THREE.Vector3());
  geometry.translate(-c.x, -c.y, -c.z).scale(1.35, 1.35, 1.35);
  geometry.computeVertexNormals();
  const map = mesh.material.map;
  const green = toon(0xffffff, { map });
  const blue = toon(0xffffff, { map });
  blue.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `#include <map_fragment>
      vec3 hsvIn = diffuseColor.rgb;
      float grey = dot(hsvIn, vec3(0.299, 0.587, 0.114));
      vec3 tinted = hsvIn.g > hsvIn.r && hsvIn.g > hsvIn.b ? vec3(grey * 0.55, grey * 0.8, grey * 1.55) : hsvIn.r > hsvIn.b && hsvIn.g > hsvIn.b ? vec3(grey * 1.6, grey * 1.6, grey * 1.6) : hsvIn;
      diffuseColor.rgb = tinted;`,
    );
  };
  blue.customProgramCacheKey = () => 'fighter-blue';
  return { geometry, green, blue, nose: geometry.boundingBox.max.z * 1.35 - c.z * 1.35 };
}

function deckProfiles(hulls, targets) {
  const ray = new THREE.Raycaster();
  const down = new THREE.Vector3(0, -1, 0);
  const from = new THREE.Vector3();
  return hulls.map((h) => {
    const tops = [];
    for (let k = 0; k < 40; k++) {
      const lz = ((k + 0.5) / 40 - 0.5) * 2 * h.rz;
      ray.set(from.set(h.x + Math.sin(h.rot) * lz, 300, h.z + Math.cos(h.rot) * lz), down);
      tops.push(ray.intersectObjects(targets, true)[0]?.point.y ?? 0);
    }
    return { ...h, tops };
  });
}

class Squadron {
  constructor(group, geometry, prop, count, outline, material = toon(0xffffff, { vertexColors: true })) {
    this.mesh = new THREE.InstancedMesh(geometry, material, count);
    this.line = new THREE.InstancedMesh(geometry, outlineMaterial(outline), count);
    this.line.instanceMatrix = this.mesh.instanceMatrix;
    this.props = prop ? new THREE.InstancedMesh(prop.geometry, new THREE.MeshBasicMaterial({ color: 0xd9dee8, transparent: true, opacity: 0.45, depthWrite: false }), count * prop.offsets.length) : null;
    this.propOffsets = prop?.offsets ?? [];
    for (const m of [this.mesh, this.line, this.props]) {
      if (!m) continue;
      m.frustumCulled = false;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      group.add(m);
    }
    this.count = count;
    this.m = new THREE.Matrix4();
    this.p = new THREE.Matrix4();
  }

  set(i, matrix, visible = true) {
    if (!visible) matrix = this.m.makeScale(0, 0, 0);
    this.mesh.setMatrixAt(i, matrix);
    if (this.props) {
      this.propOffsets.forEach((o, k) => this.props.setMatrixAt(i * this.propOffsets.length + k, visible ? this.p.copy(matrix).multiply(o) : matrix));
    }
  }

  flush() {
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.props) this.props.instanceMatrix.needsUpdate = true;
  }
}

class Tracers {
  constructor(group, max = 1400) {
    const geometry = new THREE.BoxGeometry(0.28, 0.28, 2.6).translate(0, 0, -1.3);
    this.mesh = new THREE.InstancedMesh(geometry, glow(0xffd36b), max);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    group.add(this.mesh);
    this.list = [];
    this.max = max;
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.z = new THREE.Vector3(0, 0, 1);
    this.d = new THREE.Vector3();
    this.one = new THREE.Vector3(1, 1, 1);
  }

  fire(from, to, speed, spread = 0.02, count = 1, gap = 0.07) {
    const dir = to.clone().sub(from).normalize();
    dir.x += (Math.random() - 0.5) * spread;
    dir.y += (Math.random() - 0.5) * spread;
    dir.z += (Math.random() - 0.5) * spread;
    dir.normalize();
    const life = Math.min(2.2, from.distanceTo(to) / speed + 0.35);
    for (let k = 0; k < count; k++) {
      if (this.list.length >= this.max) return;
      this.list.push({ pos: from.clone(), vel: dir.clone().multiplyScalar(speed), life: life + k * gap, wait: k * gap });
    }
  }

  update(dt) {
    let n = 0;
    this.list = this.list.filter((t) => {
      t.life -= dt;
      if (t.life <= 0) return false;
      if (t.wait > 0) {
        t.wait -= dt;
        return true;
      }
      t.pos.addScaledVector(t.vel, dt);
      this.q.setFromUnitVectors(this.z, this.d.copy(t.vel).normalize());
      this.mesh.setMatrixAt(n++, this.m.compose(t.pos, this.q, this.one));
      return true;
    });
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

function oilSlick(batch, x, z, size, rand) {
  for (let k = 0; k < 5; k++) {
    const a = rand() * Math.PI * 2;
    const r = rand() * size * 0.5;
    const s = size * (0.4 + rand() * 0.5);
    batch.add('oil', CYL, new THREE.Matrix4().compose(new THREE.Vector3(x + Math.cos(a) * r, 0.25, z + Math.sin(a) * r), new THREE.Quaternion(), new THREE.Vector3(s, 0.05, s * (0.6 + rand() * 0.4))));
  }
}

function sunkPlane(batch, x, z, yaw, rand, color) {
  const put = frame(batch, x, -1.2, z, yaw, -0.5 - rand() * 0.4, (rand() - 0.5) * 0.6, 1);
  put(color, CYL, 0, 0.8, -1.5, 0.55, 5, 0.55, Math.PI / 2, 0, 0);
  put(color, BOX, 0, 1.2, -3.6, 3.6, 0.15, 1, 0, 0, 0);
  put(color, BOX, 0, 2, -3.7, 0.15, 1.6, 1.2, 0, 0, 0);
  put('scorch', BOX, rand() < 0.5 ? 2 : -2, 0.4, -0.5, 4, 0.2, 1.6, 0, 0, (rand() - 0.5) * 0.8);
}

export async function createMidway(group, track, fx) {
  const fog = new THREE.Fog(0x8a8580, 260, 950);
  const sky = createSky({ top: 0x3f4752, horizon: 0xb0998a });
  const wind = new THREE.Vector3(2.5, 0, 0.8);
  group.add(sky);
  group.add(new THREE.HemisphereLight(0xc9d1d9, 0x2b4656, 1.15));
  const sun = new THREE.DirectionalLight(0xffd6a8, 2.1);
  sun.position.copy(SUN_DIR).multiplyScalar(100);
  group.add(sun);
  const water = createWater({ deep: 0x0f3f5c, shallow: 0x2f7590 });
  group.add(water.mesh);

  const rand = mulberry32(19420604);
  const batch = new Batcher();
  const shores = [];
  const fires = [];
  const guns = [];
  const ships = [];
  const half = track.halfWidth;

  const fits = (x, z, yaw, L, B) => {
    for (let u = -0.5; u <= 0.5; u += 0.1) {
      const px = x + Math.sin(yaw) * L * u;
      const pz = z + Math.cos(yaw) * L * u;
      if (track.project(px, pz).distance < half + B / 2 + 12) return false;
    }
    return ships.every((s) => Math.hypot(s.x - x, s.z - z) > (s.L + L) / 2 + 10);
  };
  const place = (f, side, gap, L, B, angle, build) => {
    const idx = track.wrap(Math.round(f * track.N));
    const yaw = track.heading(idx) + angle;
    for (let lat = half + B / 2 + gap; lat < half + 400; lat += 6) {
      const p = track.point(idx, side * lat);
      if (!fits(p.x, p.z, yaw, L, B)) continue;
      const local = { local: [] };
      const size = build(p.x, p.z, yaw, local);
      for (const g of local.local) {
        const w = g.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw).add(new THREE.Vector3(p.x, 0, p.z));
        guns.push(w);
      }
      ships.push({ x: p.x, z: p.z, L: size.L });
      shores.push({ x: p.x, z: p.z, rx: size.B / 2 + 0.5, rz: size.L / 2, rot: yaw });
      return { x: p.x, z: p.z, yaw };
    }
    return null;
  };

  const stacks = { stacks: [] };
  const battleships = [];
  group.userData.battleships = battleships;
  const dyn = new THREE.Group();
  group.add(dyn);
  const turrets = [];
  group.userData.turrets = turrets;
  const parked = [];
  let shipCount = 0;
  const tagTurrets = (before) => {
    for (const tu of turrets.slice(before)) tu.ship = shipCount;
    shipCount++;
  };
  const toWorld = (x, z, yaw, v) => v.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw).add(new THREE.Vector3(x, 0, z));
  const carriers = [];
  group.userData.carriers = carriers;
  const flatTop = (x, z, yaw, g, burning) => {
    const local = [];
    const spots = [];
    const size = newCarrier(batch, x, z, yaw, rand, local, g, burning, spots, stacks);
    carriers.push({ x, z, yaw, burning });
    for (const f of local) fires.push(toWorld(x, z, yaw, f));
    for (const p of spots) {
      const w = toWorld(x, z, yaw, new THREE.Vector3(p.lx, 0, p.lz));
      parked.push({ pos: w.setY(p.y + 1.1), yaw: p.yaw, scorched: p.scorched });
    }
    return size;
  };
  const burningCarrier = place(0.62, -1, 34, 226, 46, 0.35, (x, z, yaw, g) => flatTop(x, z, yaw, g, true));
  place(0.14, 1, 44, 226, 46, -0.25, (x, z, yaw, g) => flatTop(x, z, yaw, g, false));
  const bigShip = (x, z, yaw, g) => {
    const before = turrets.length;
    const size = bigBattleship(batch, dyn, x, z, yaw, rand, g.local, turrets, stacks);
    tagTurrets(before);
    battleships.push({ x, z, yaw });
    return size;
  };
  const tinCan = (x, z, yaw, g) => {
    const before = turrets.length;
    const size = newDestroyer(batch, dyn, x, z, yaw, rand, g.local, turrets, stacks);
    tagTurrets(before);
    return size;
  };
  place(0.33, -1, 16, 172, 30, 0.12, bigShip);
  place(0.86, 1, 20, 172, 30, -0.18, bigShip);
  for (const [f, side, angle] of [[0.04, -1, 0.5], [0.48, 1, -0.4], [0.74, -1, 0.2], [0.24, 1, 0.9]]) {
    place(f, side, 10, 96, 11, angle, tinCan);
  }
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2 + rand();
    const d = 520 + rand() * 180;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d + 100;
    const yaw = rand() * Math.PI;
    const local = { local: [] };
    if (k % 3 === 0) bigShip(x, z, yaw, local);
    else tinCan(x, z, yaw, local);
    if (k % 2 === 0) fires.push(new THREE.Vector3(x, 8, z));
  }

  for (let k = 0; k < 16; k++) {
    for (let tries = 0; tries < 40; tries++) {
      const x = (rand() - 0.5) * 900;
      const z = (rand() - 0.5) * 800 + 100;
      const clearance = track.project(x, z).distance - half;
      if (clearance < 6 || ships.some((s) => Math.hypot(s.x - x, s.z - z) < s.L / 2 + 15)) continue;
      if (k < 9) oilSlick(batch, x, z, 8 + rand() * 14, rand);
      if (k % 2 === 0) sunkPlane(batch, x + 3, z + 2, rand() * 6, rand, k % 4 === 0 ? 'planeBlue' : 'planeGreen');
      if (k % 3 === 0) fires.push(new THREE.Vector3(x, 0.4, z));
      break;
    }
  }

  group.userData.burningCarrier = burningCarrier;
  const scenery = new THREE.Group();
  const chunks = batch.build(scenery, 0.1, NAVY);
  scenery.updateMatrixWorld(true);
  const decks = deckProfiles(shores, chunks.map((c) => c.group));
  group.userData.decks = decks;
  const shipTop = (p) => {
    for (const d of decks) {
      const dx = p.x - d.x;
      const dz = p.z - d.z;
      const c = Math.cos(d.rot);
      const s = Math.sin(d.rot);
      const lx = dx * c - dz * s;
      const lz = dx * s + dz * c;
      if ((lx / d.rx) ** 2 + (lz / d.rz) ** 2 >= 1) continue;
      const top = d.tops[Math.min(d.tops.length - 1, Math.max(0, Math.floor((lz / (2 * d.rz) + 0.5) * d.tops.length)))];
      if (p.y < top) return top;
    }
    return null;
  };
  group.add(scenery);

  const buoys = courseBuoys(track, () => true);
  group.add(buoys);
  group.add(createArch(track, half));

  const clouds = [];
  for (let i = 0; i < 18; i++) {
    const cloud = createCloud(rand, i % 3 ? 0x8d959e : 0x5c636b);
    const a = rand() * Math.PI * 2;
    const d = 100 + rand() * 650;
    cloud.position.set(Math.cos(a) * d, 170 + rand() * 90, Math.sin(a) * d);
    cloud.scale.setScalar(1 + rand() * 0.8);
    cloud.userData.speed = 3 + rand() * 4;
    clouds.push(cloud);
    group.add(cloud);
  }

  const air = new THREE.Group();
  group.add(air);
  const fighter = await loadFighter(`${import.meta.env.BASE_URL}models/fighter.glb`);
  const propAt = [new THREE.Matrix4().makeTranslation(0, 0.3, 4.45)];
  const parkedMesh = new THREE.InstancedMesh(fighter.geometry, fighter.blue, Math.max(1, parked.length));
  const parkedLine = new THREE.InstancedMesh(fighter.geometry, outlineMaterial(0.05), Math.max(1, parked.length));
  parked.forEach((p, i) => {
    const pm = new THREE.Matrix4().compose(p.pos, new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.08, p.yaw, 0)), new THREE.Vector3(1, 1, 1));
    parkedMesh.setMatrixAt(i, pm);
    parkedLine.setMatrixAt(i, pm);
  });
  parkedMesh.count = parkedLine.count = parked.length;
  parkedMesh.frustumCulled = parkedLine.frustumCulled = false;
  group.add(parkedMesh, parkedLine);
  const blue = new Squadron(air, fighter.geometry, { geometry: propGeometry(1.5), offsets: propAt }, 14, 0.05, fighter.blue);
  const green = new Squadron(air, fighter.geometry, { geometry: propGeometry(1.5), offsets: propAt }, 14, 0.05, fighter.green);
  const bombers = new Squadron(air, planeGeometry('bomber'), { geometry: propGeometry(1.9), offsets: [new THREE.Matrix4().makeTranslation(-5, -0.2, 4.3), new THREE.Matrix4().makeTranslation(5, -0.2, 4.3)] }, 6, 0.1);
  const chutes = new Squadron(air, parachuteGeometry(), null, 10, 0.06);
  const tracers = new Tracers(air);
  group.userData.squads = { blue, green, bombers, chutes };

  const planes = [];
  for (let pair = 0; pair < 14; pair++) {
    const near = track.point(Math.floor(rand() * track.N), (rand() - 0.5) * 80);
    const center = pair % 2 ? new THREE.Vector3(near.x, 0, near.z) : new THREE.Vector3((rand() - 0.5) * 700, 0, (rand() - 0.5) * 600 + 100);
    const radius = 110 + rand() * 110;
    const path = { center, radius, height: pair % 2 ? 30 + rand() * 30 : 60 + rand() * 70, speed: ((120 + rand() * 50) / radius) * (rand() < 0.5 ? -1 : 1), phase: rand() * Math.PI * 2, wobble: rand() * 6 };
    const blueLeads = pair % 2 === 0;
    planes.push({ squad: blueLeads ? blue : green, index: pair, path, lag: 0, role: 'lead' });
    planes.push({ squad: blueLeads ? green : blue, index: pair, path, lag: 38 / radius, role: 'chase' });
  }
  for (let k = 0; k < 6; k++) {
    const lane = k < 3 ? 0 : 1;
    planes.push({ squad: bombers, index: k, bomber: { lane, slot: k % 3, offset: lane ? 900 : 0 } });
  }
  const chuteState = Array.from({ length: 10 }, () => null);

  const pos = new THREE.Vector3();
  const ahead = new THREE.Vector3();
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const roll = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const one = new THREE.Vector3(1, 1, 1);
  const zAxis = new THREE.Vector3(0, 0, 1);

  const pathAt = (p, t, out) => {
    if (p.bomber) {
      const dir = p.bomber.lane ? new THREE.Vector3(-0.8, 0, 0.6).normalize() : new THREE.Vector3(1, 0, 0.25).normalize();
      const side = new THREE.Vector3(-dir.z, 0, dir.x);
      const travel = (((t * 95 + p.bomber.offset) % 1800) + 1800) % 1800 - 900;
      const slot = [0, -1, 1][p.bomber.slot];
      return out.copy(dir).multiplyScalar(travel - Math.abs(slot) * 14).addScaledVector(side, slot * 16).add(new THREE.Vector3(0, 150 + p.bomber.lane * 20, 100));
    }
    const a = p.path.phase + p.path.speed * t - p.lag * Math.sign(p.path.speed);
    const r = p.path.radius * (p.role === 'chase' ? 0.94 : 1);
    return out.set(
      p.path.center.x + Math.cos(a) * r,
      p.path.height + Math.sin(a * 2 + p.path.wobble) * 14 + (p.role === 'chase' ? -3 : 0),
      p.path.center.z + Math.sin(a) * r,
    );
  };

  const shootDown = (p, t) => {
    pathAt(p, t, pos);
    pathAt(p, t + 0.05, ahead);
    const vel = ahead.clone().sub(pos).multiplyScalar(20);
    p.fall = { pos: pos.clone(), vel, spin: (Math.random() < 0.5 ? -1 : 1) * (2 + Math.random() * 3), angle: 0, q: new THREE.Quaternion() };
    const free = chuteState.findIndex((c) => !c);
    if (free >= 0 && Math.random() < 0.55 && !p.bomber) chuteState[free] = { pos: pos.clone().add(new THREE.Vector3(0, -2, 0)), drift: new THREE.Vector3((Math.random() - 0.5) * 3, -4, (Math.random() - 0.5) * 3), sway: Math.random() * 6 };
    fx.fireCore.emit(pos.x, pos.y, pos.z, 0, 0, 0, 3, 0.3, 0xfff1b0, 0, 0, 1);
    fx.fire.emit(pos.x, pos.y, pos.z, 0, 0, 0, 5, 0.45, 0xff4a1a, 0, 0, 1);
  };

  for (const tu of turrets) {
    tu.cool = 1 + Math.random() * 7;
    tu.targetYaw = 0;
    tu.targetPitch = tu.pitch;
    tu.kick = 0;
    tu.far = Math.hypot(tu.yawGroup.position.x, tu.yawGroup.position.z) > 480;
  }
  const flashes = [0, 1, 2, 3].map(() => {
    const l = new THREE.PointLight(0xffb060, 0, 160, 1.6);
    group.add(l);
    return l;
  });
  let flashIndex = 0;
  const shellMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.7, 10, 8), glow(0xffe6a0), 60);
  shellMesh.frustumCulled = false;
  shellMesh.count = 0;
  group.add(shellMesh);
  const shells = [];
  const events = [];
  const GRAVITY = 26;
  const SHELL_SPEED = 125;
  const muzzle = new THREE.Vector3();
  const barrelDir = new THREE.Vector3();
  const pickTarget = (tu) => {
    const origin = tu.yawGroup.position;
    let goal;
    if (!tu.far && Math.random() < 0.45) {
      const p = track.point(Math.floor(Math.random() * track.N), (Math.random() - 0.5) * 70);
      goal = new THREE.Vector3(p.x, 0, p.z);
    } else {
      const a = tu.base + (Math.random() - 0.5) * 2.6;
      const r = 150 + Math.random() * 400;
      goal = new THREE.Vector3(origin.x + Math.sin(a) * r, 0, origin.z + Math.cos(a) * r);
    }
    const dx = goal.x - origin.x;
    const dz = goal.z - origin.z;
    let rel = Math.atan2(dx, dz) - tu.base;
    rel = Math.atan2(Math.sin(rel), Math.cos(rel));
    if (Math.abs(rel) > 2.3) return pickTarget(tu);
    const range = Math.min(Math.hypot(dx, dz), (SHELL_SPEED * SHELL_SPEED) / GRAVITY * 0.98);
    tu.targetYaw = rel;
    tu.targetPitch = Math.min(0.75, Math.max(0.08, 0.5 * Math.asin((range * GRAVITY) / (SHELL_SPEED * SHELL_SPEED))));
  };
  turrets.forEach(pickTarget);

  const fireTurret = (tu) => {
    tu.yawGroup.updateMatrixWorld(true);
    barrelDir.set(0, 0, 1).transformDirection(tu.recoil.matrixWorld);
    const s = tu.size;
    for (const m of tu.muzzles) {
      muzzle.copy(m).applyMatrix4(tu.recoil.matrixWorld);
      const d = barrelDir;
      for (let k = 0; k < 3; k++) {
        const ahead = 3 + k * 4;
        const at = muzzle.clone().addScaledVector(d, ahead);
        fx.fire.emit(at.x, at.y, at.z, d.x * 10, d.y * 10, d.z * 10, (10 - k * 2) * s, 0.42, 0xff4a1a, 0, 3, 2);
        fx.fireMid.emit(at.x, at.y, at.z, d.x * 12, d.y * 12, d.z * 12, (7.5 - k * 1.5) * s, 0.34, 0xff9a2a, 0, 3, 2);
        fx.fireCore.emit(at.x, at.y, at.z, d.x * 14, d.y * 14, d.z * 14, (5 - k) * s, 0.26, 0xfff6d0, 0, 3, 2);
      }
      for (let k = 0; k < 18; k++) {
        const sp = 20 + Math.random() * 45;
        fx.fire.emit(muzzle.x, muzzle.y, muzzle.z, d.x * sp + (Math.random() - 0.5) * 18, d.y * sp + (Math.random() - 0.5) * 18, d.z * sp + (Math.random() - 0.5) * 18, 1.6 + Math.random() * 2.2, 0.35, 0xff6a1a, 0, 2.5, 2);
      }
      for (let k = 0; k < 22; k++) {
        const sp = 4 + Math.random() * 34;
        fx.puffs.emit(muzzle.x + d.x * 6, muzzle.y + d.y * 6, muzzle.z + d.z * 6, d.x * sp + (Math.random() - 0.5) * 10, d.y * sp + (Math.random() - 0.3) * 6, d.z * sp + (Math.random() - 0.5) * 10, 5 + Math.random() * 5, 4 + Math.random() * 2, Math.random() < 0.5 ? 0xe2dacb : 0xb3ab9c, -0.5, 0.7, 0);
      }
      const v = d.clone().multiplyScalar(SHELL_SPEED);
      if (shells.length < 60) shells.push({ pos: muzzle.clone(), vel: v.add(new THREE.Vector3((Math.random() - 0.5) * 4, 0, (Math.random() - 0.5) * 4)) });
    }
    const flat = new THREE.Vector3(barrelDir.x, 0, barrelDir.z).normalize();
    const blast = tu.yawGroup.position.clone().addScaledVector(flat, 18 * s);
    if (Math.abs(blast.x) < 2000) {
      fx.ring(blast.x, 0.4, blast.z, 0xffffff, 6 * s, 70 * s, 1.1, 1);
      fx.ring(blast.x, 0.5, blast.z, 0xfff1b0, 3 * s, 38 * s, 0.6, 0.9);
      for (let k = 0; k < 44 * s; k++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 10 + Math.random() * 18;
        fx.puffs.emit(blast.x, 0.5, blast.z, Math.cos(a) * sp + flat.x * 10, 2 + Math.random() * 5, Math.sin(a) * sp + flat.z * 10, 1 + Math.random() * 1.2, 0.9, 0xffffff, 12, 1, 1);
      }
    }
    tu.kick = 1;
    const light = flashes[flashIndex++ % flashes.length];
    light.position.copy(muzzle).addScaledVector(barrelDir, 6);
    light.intensity = 900;
    events.push({ type: 'boom', pos: muzzle.clone(), power: 2.6 * s });
  };

  const splashShell = (p) => {
    fx.splash(p.x, 0.4, p.z, 2.6);
    fx.ring(p.x, 0.4, p.z, 0xffffff, 3, 30, 1.2, 0.8);
    for (let k = 0; k < 40; k++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 2.5;
      fx.puffs.emit(p.x + Math.cos(a) * r, 0.5, p.z + Math.sin(a) * r, Math.cos(a) * 2.5, 22 + Math.random() * 30, Math.sin(a) * 2.5, 1.4 + Math.random() * 1.8, 1.6 + Math.random() * 0.8, Math.random() < 0.3 ? 0xd8f4ff : 0xffffff, 22, 0.3, 1);
    }
    events.push({ type: 'splash', pos: p.clone(), power: 1.2 });
  };

  const hitFires = [];
  const hitShip = (p, power) => {
    fx.explosion(p.x, p.y, p.z, power);
    for (let k = 0; k < 16; k++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 4 + Math.random() * 10;
      fx.fire.emit(p.x, p.y + 0.5, p.z, Math.cos(a) * sp, 4 + Math.random() * 8, Math.sin(a) * sp, 1.6 + Math.random() * 1.6, 0.6, 0xff4a1a, -6, 1, 2);
    }
    events.push({ type: 'boom', pos: p.clone(), power: power * 1.4 });
    fx.impact('crater', p, up, 5 + power * 2);
    if (hitFires.length >= 12) hitFires.shift();
    hitFires.push({ x: p.x, y: p.y, z: p.z, life: 8 + Math.random() * 6 });
  };

  group.userData.hitShip = hitShip;

  let nextKill = 2;
  let flak = 0;
  let aa = 0;

  const update = (t, dt) => {
    nextKill -= dt;
    if (nextKill <= 0) {
      nextKill = 2.5 + Math.random() * 3.5;
      const alive = planes.filter((p) => !p.fall && !p.respawn);
      const victim = alive[Math.floor(Math.random() * alive.length)];
      if (victim) shootDown(victim, t);
    }
    for (const p of planes) {
      if (p.respawn) {
        p.respawn -= dt;
        if (p.respawn <= 0) {
          p.respawn = 0;
          if (p.path && Math.random() < 0.5) {
            const near = track.point(Math.floor(Math.random() * track.N), (Math.random() - 0.5) * 80);
            p.path.center.set(near.x, 0, near.z);
          }
        }
        p.squad.set(p.index, m, false);
        continue;
      }
      if (p.fall) {
        const f = p.fall;
        f.vel.y -= 22 * dt;
        f.vel.multiplyScalar(Math.exp(-0.7 * dt));
        f.pos.addScaledVector(f.vel, dt);
        f.angle += f.spin * dt;
        ahead.copy(f.pos).add(f.vel);
        m.lookAt(ahead, f.pos, up);
        q.setFromRotationMatrix(m).multiply(roll.setFromAxisAngle(zAxis, f.angle));
        p.squad.set(p.index, m.compose(f.pos, q, one));
        if (Math.random() < dt * 30) fx.blackSmoke(f.pos.x, f.pos.y, f.pos.z, new THREE.Vector3());
        if (Math.random() < dt * 40) fx.fire.emit(f.pos.x, f.pos.y, f.pos.z, (Math.random() - 0.5) * 3, 2, (Math.random() - 0.5) * 3, 1.2 + Math.random(), 0.35, 0xff4a1a, -4, 1, 2);
        if (Math.random() < dt * 30) fx.fireCore.emit(f.pos.x, f.pos.y, f.pos.z, 0, 1, 0, 0.7, 0.25, 0xffe680, 0, 1, 2);
        const deck = shipTop(f.pos);
        if (deck !== null || f.pos.y <= 0.3) {
          if (deck !== null) hitShip(f.pos.setY(Math.min(f.pos.y, deck)), p.bomber ? 2.4 : 1.6);
          else {
            fx.explosion(f.pos.x, 0.5, f.pos.z, p.bomber ? 2.2 : 1.4);
            fx.splash(f.pos.x, 0.3, f.pos.z, p.bomber ? 2.2 : 1.6);
          }
          p.fall = null;
          p.respawn = 4 + Math.random() * 5;
          p.squad.set(p.index, m, false);
        }
        continue;
      }
      pathAt(p, t, pos);
      pathAt(p, t + 0.05, ahead);
      m.lookAt(ahead, pos, up);
      const bank = p.bomber ? 0 : -0.75 * Math.sign(p.path.speed);
      q.setFromRotationMatrix(m).multiply(roll.setFromAxisAngle(zAxis, bank));
      p.squad.set(p.index, m.compose(pos, q, one));
      p.now = (p.now ?? new THREE.Vector3()).copy(pos);
      if (p.role === 'chase') {
        p.burst = (p.burst ?? Math.random() * 2) - dt;
        if (p.burst < 0.4 && Math.random() < dt * 14) {
          const lead = planes.find((o) => o.path === p.path && o.role === 'lead');
          if (lead && !lead.fall && !lead.respawn && lead.now) {
            const nose = new THREE.Vector3(0, 0, 4).applyQuaternion(q).add(pos);
            const aim = pathAt(lead, t + nose.distanceTo(lead.now) / 420, new THREE.Vector3());
            tracers.fire(nose, aim, 420, 0.02, 3, 0.04);
          }
        }
        if (p.burst <= 0) p.burst = 1.2 + Math.random() * 2;
      }
    }
    for (const s of [blue, green, bombers]) s.flush();
    chuteState.forEach((c, i) => {
      if (!c) {
        chutes.set(i, m, false);
        return;
      }
      c.sway += dt;
      c.pos.addScaledVector(c.drift, dt);
      if (c.pos.y < 0.5) {
        fx.splash(c.pos.x, 0.3, c.pos.z, 0.4);
        chuteState[i] = null;
        chutes.set(i, m, false);
        return;
      }
      q.setFromAxisAngle(zAxis, Math.sin(c.sway * 1.6) * 0.2);
      chutes.set(i, m.compose(c.pos, q, one));
    });
    chutes.flush();

    aa -= dt;
    if (aa <= 0 && guns.length) {
      aa = 0.018;
      const gun = guns[Math.floor(Math.random() * guns.length)];
      const targets = planes.filter((p) => p.now && !p.fall && !p.respawn);
      const target = targets[Math.floor(Math.random() * targets.length)];
      if (target) {
        const aim = target.now.clone().add(new THREE.Vector3((Math.random() - 0.5) * 30, (Math.random() - 0.3) * 20, (Math.random() - 0.5) * 30));
        tracers.fire(gun, aim, 150, 0.03, 6, 0.06);
      }
    }
    flak -= dt;
    if (flak <= 0) {
      flak = 0.12 + Math.random() * 0.2;
      const targets = planes.filter((p) => p.now && !p.fall && !p.respawn);
      const target = targets[Math.floor(Math.random() * targets.length)];
      if (target) {
        const b = target.now.clone().add(new THREE.Vector3((Math.random() - 0.5) * 50, (Math.random() - 0.4) * 30, (Math.random() - 0.5) * 50));
        fx.fireCore.emit(b.x, b.y, b.z, 0, 0, 0, 2.2, 0.15, 0xfff1b0, 0, 0, 1);
        fx.fire.emit(b.x, b.y, b.z, 0, 0, 0, 3, 0.25, 0xff7a2a, 0, 0, 1);
        for (let k = 0; k < 4; k++) fx.soot.emit(b.x + (Math.random() - 0.5) * 3, b.y + (Math.random() - 0.5) * 3, b.z + (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, 2.6 + Math.random() * 1.8, 3 + Math.random() * 1.5, k % 2 ? 0x1f2024 : 0x3a3c41, 0, 0.6, 0);
      }
    }
    for (const tu of turrets) {
      tu.cool -= dt;
      if (tu.retarget > 0) {
        tu.retarget -= dt;
        if (tu.retarget <= 0) pickTarget(tu);
      }
      const dy = tu.targetYaw - tu.yaw;
      const dp = tu.targetPitch - tu.pitch;
      tu.yaw += Math.sign(dy) * Math.min(Math.abs(dy), 0.32 * dt);
      tu.pitch += Math.sign(dp) * Math.min(Math.abs(dp), 0.28 * dt);
      tu.yawGroup.rotation.y = tu.base + tu.yaw;
      tu.pitchGroup.rotation.x = -tu.pitch;
      tu.kick = Math.max(0, tu.kick - dt * 1.1);
      tu.recoil.position.z = -2.4 * tu.kick * tu.kick;
      if (tu.cool <= 0 && Math.abs(dy) < 0.01 && Math.abs(dp) < 0.01) {
        fireTurret(tu);
        tu.cool = 6 + Math.random() * 8;
        tu.retarget = 1.5;
        if (Math.random() < 0.4) {
          for (const mate of turrets) {
            if (mate !== tu && mate.ship === tu.ship && mate.cool < 4 && Math.abs(mate.targetYaw - mate.yaw) < 0.05) mate.cool = 0.12 + Math.random() * 0.25;
          }
        }
      }
    }
    for (const l of flashes) l.intensity *= Math.exp(-14 * dt);
    let ns = 0;
    for (let i = shells.length - 1; i >= 0; i--) {
      const sh = shells[i];
      sh.vel.y -= GRAVITY * dt;
      sh.pos.addScaledVector(sh.vel, dt);
      if (Math.random() < dt * 25) fx.puffs.emit(sh.pos.x, sh.pos.y, sh.pos.z, 0, 0.5, 0, 0.5, 0.6, 0xd9d1c3, 0, 1, 1);
      const deck = shipTop(sh.pos);
      if (deck !== null) {
        hitShip(sh.pos.setY(Math.min(sh.pos.y, deck)), 1.8);
        shells.splice(i, 1);
      } else if (sh.pos.y <= 0.3) {
        splashShell(sh.pos);
        shells.splice(i, 1);
      }
    }
    for (const sh of shells) shellMesh.setMatrixAt(ns++, m.makeTranslation(sh.pos.x, sh.pos.y, sh.pos.z));
    shellMesh.count = ns;
    shellMesh.instanceMatrix.needsUpdate = true;
    for (const st of stacks.stacks) {
      if (Math.random() < dt * 5) fx.soot.emit(st.x + (Math.random() - 0.5) * 2, st.y, st.z + (Math.random() - 0.5) * 2, wind.x + (Math.random() - 0.5), 3 + Math.random() * 2, wind.z + (Math.random() - 0.5), 1.6 + Math.random() * 1.2, 3.5 + Math.random() * 1.5, Math.random() < 0.5 ? 0x5a5d63 : 0x74777d, -0.8, 0.2, 0);
    }
    for (const f of fires) {
      if (Math.random() < dt * 7) fx.column(f.x, f.y + 2, f.z, wind, f.y > 5 ? 1.4 : 0.8);
      if (Math.random() < dt * 22) fx.fire.emit(f.x + (Math.random() - 0.5) * 5, f.y + 0.5, f.z + (Math.random() - 0.5) * 5, (Math.random() - 0.5), 3 + Math.random() * 3, (Math.random() - 0.5), 1.4 + Math.random() * 1.2, 0.5, 0xff4a1a, -3, 1, 2);
      if (Math.random() < dt * 14) fx.fireMid.emit(f.x + (Math.random() - 0.5) * 3, f.y + 0.6, f.z + (Math.random() - 0.5) * 3, 0, 3 + Math.random() * 2, 0, 0.9 + Math.random() * 0.6, 0.4, 0xff9a2a, -3, 1, 2);
    }
    for (let i = hitFires.length - 1; i >= 0; i--) {
      const f = hitFires[i];
      f.life -= dt;
      if (f.life <= 0) {
        hitFires.splice(i, 1);
        continue;
      }
      const heat = Math.min(1, f.life / 4);
      if (Math.random() < dt * 6 * heat) fx.column(f.x, f.y + 1, f.z, wind, 0.8 + heat * 0.6);
      if (Math.random() < dt * 30 * heat) fx.fire.emit(f.x + (Math.random() - 0.5) * 3, f.y + 0.4, f.z + (Math.random() - 0.5) * 3, Math.random() - 0.5, 2.5 + Math.random() * 2.5, Math.random() - 0.5, (1.6 + Math.random() * 1.4) * heat + 0.5, 0.55, 0xff4a1a, -3, 1, 2);
      if (Math.random() < dt * 10 * heat) fx.fireMid.emit(f.x + (Math.random() - 0.5) * 2, f.y + 0.5, f.z + (Math.random() - 0.5) * 2, 0, 2.5 + Math.random() * 2, 0, (0.7 + Math.random() * 0.5) * heat + 0.3, 0.35, 0xff9a2a, -3, 1, 2);
    }
    tracers.update(dt);
  };

  return {
    fog,
    water,
    sun,
    shores,
    events,
    solid(p) {
      return ellipseHit(shores, p, 45);
    },
    update(t, dt, camera) {
      water.update(t);
      cullChunks(chunks, camera, fog.far);
      sky.position.copy(camera.position);
      buoys.userData.update(t);
      for (const cloud of clouds) {
        cloud.position.x += cloud.userData.speed * dt;
        if (cloud.position.x > 800) cloud.position.x = -800;
      }
      update(t, dt);
    },
  };
}
