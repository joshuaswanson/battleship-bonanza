import * as THREE from 'three';
import { toon, outlined, INK, mulberry32 } from './toon.js';
import { Batcher } from './world.js';

const DECK = 1.1;
const C = {
  plank: 0xc98d55,
  plankDark: 0xa8703f,
  plankLight: 0xdca46a,
  post: 0x7a4e2c,
  tire: 0x2b2f36,
  rope: 0xf3e2b8,
  crane: 0xffc93c,
  craneDark: 0x2b3440,
  hook: 0x8c98a6,
  crate: 0xd59b5b,
  crateDark: 0x9c6436,
  barrelRed: 0xff5a5f,
  barrelBlue: 0x4d9de0,
  barrelBand: 0x2b3440,
  shed: 0x8fd3f4,
  shedTrim: 0xffffff,
  roof: 0xff5a5f,
  sign: 0xffd23f,
  cone: 0xff8a2b,
  ring: 0xff4141,
  toolbox: 0xff4141,
};

function part(parent, geometry, color, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0, line = 0.05) {
  const mesh = outlined(geometry, typeof color === 'number' ? toon(color) : color, line);
  mesh.position.set(x, y, z);
  mesh.scale.set(sx, sy, sz);
  mesh.rotation.set(rx, ry, rz);
  parent.add(mesh);
  return mesh;
}

const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 18);
const BARREL = new THREE.CylinderGeometry(1, 1, 1, 18);
const TORUS = new THREE.TorusGeometry(1, 0.38, 12, 28);
const CONE = new THREE.ConeGeometry(1, 1, 16);
const BALL = new THREE.SphereGeometry(1, 16, 12);

function deck(group, inner, outer) {
  const batch = new Batcher();
  const rand = mulberry32(31);
  const board = new THREE.BoxGeometry(1, 1, 1);
  const nail = new THREE.CylinderGeometry(1, 1, 1, 8);
  for (let r = inner + 0.55, row = 0; r < outer; r += 1.02, row++) {
    const around = Math.PI * 2 * r;
    const count = Math.max(8, Math.round(around / (2.6 + rand() * 0.8)));
    const step = (Math.PI * 2) / count;
    const offset = row % 2 ? step / 2 : rand() * step;
    for (let k = 0; k < count; k++) {
      const a = offset + k * step;
      const len = 2 * r * Math.sin(step / 2) - 0.12;
      const lift = (rand() - 0.5) * 0.06;
      const tilt = (rand() - 0.5) * 0.03;
      const key = PLANKS[Math.floor(rand() * PLANKS.length)];
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(Math.cos(a) * r, DECK - 0.13 + lift, Math.sin(a) * r),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, -a + Math.PI / 2, (rand() - 0.5) * 0.02, 'YXZ')),
        new THREE.Vector3(len, 0.26, 0.9),
      );
      batch.add(key, board, m);
      for (const end of [-1, 1]) {
        for (const side of [-0.25, 0.25]) {
          const along = (len / 2 - 0.22) * end;
          const nx = Math.cos(a) * r + Math.cos(a + Math.PI / 2) * along + Math.cos(a) * side;
          const nz = Math.sin(a) * r + Math.sin(a + Math.PI / 2) * along + Math.sin(a) * side;
          batch.add('nail', nail, new THREE.Matrix4().compose(new THREE.Vector3(nx, DECK + lift + 0.005, nz), new THREE.Quaternion(), new THREE.Vector3(0.05, 0.02, 0.05)));
        }
      }
    }
  }
  for (let k = 0; k < 40; k++) {
    const a = (k / 40) * Math.PI * 2;
    batch.add('beam', board, new THREE.Matrix4().compose(
      new THREE.Vector3(Math.cos(a) * (inner + (outer - inner) / 2), DECK - 0.45, Math.sin(a) * (inner + (outer - inner) / 2)),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -a, 0)),
      new THREE.Vector3(outer - inner, 0.4, 0.5),
    ));
  }
  for (let k = 0; k < 28; k++) {
    const a = (k / 28) * Math.PI * 2;
    const r = inner + 0.15;
    batch.add(PLANKS[k % 3], PILING, new THREE.Matrix4().compose(new THREE.Vector3(Math.cos(a) * r, DECK - 1.2, Math.sin(a) * r), new THREE.Quaternion(), new THREE.Vector3(0.32, 3, 0.32)));
    batch.add('rope', PILING, new THREE.Matrix4().compose(new THREE.Vector3(Math.cos(a) * r, DECK + 0.12, Math.sin(a) * r), new THREE.Quaternion(), new THREE.Vector3(0.34, 0.08, 0.34)));
  }
  batch.build(group, 0.035, DECK_COLORS);
  const rim = outlined(new THREE.CylinderGeometry(inner, inner, 2.2, 64, 1, true), toon(C.post, { side: THREE.DoubleSide }), 0.04);
  rim.position.y = DECK - 1.4;
  group.add(rim);
}

const PLANKS = ['plank0', 'plank1', 'plank2', 'plank3'];
const DECK_COLORS = { plank0: 0xc98d55, plank1: 0xb87c46, plank2: 0xd9a36b, plank3: 0xa8703f, nail: 0x5c4a3a, beam: 0x6e4528, rope: 0xf3e2b8 };
const PILING = new THREE.CylinderGeometry(1, 1, 1, 10);

function fenders(group, radius) {
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + 0.11;
    const x = Math.cos(a) * (radius - 0.35);
    const z = Math.sin(a) * (radius - 0.35);
    part(group, TORUS, C.tire, x, DECK - 0.9, z, 0.62, 0.62, 0.62, 0, -a + Math.PI / 2, 0, 0.04);
    part(group, CYL, C.rope, x, DECK - 0.15, z, 0.05, 0.9, 0.05);
  }
}

function bollard(group, x, z) {
  part(group, CYL, C.craneDark, x, DECK + 0.45, z, 0.32, 0.9, 0.32);
  part(group, CYL, C.craneDark, x, DECK + 0.95, z, 0.45, 0.16, 0.45);
  part(group, TORUS, C.rope, x, DECK + 0.4, z, 0.38, 0.38, 0.5, Math.PI / 2, 0, 0, 0.03);
  part(group, TORUS, C.rope, x, DECK + 0.62, z, 0.36, 0.36, 0.5, Math.PI / 2, 0, 0, 0.03);
}

function crate(group, x, z, size, spin, y = DECK) {
  const g = new THREE.Group();
  g.position.set(x, y + size / 2, z);
  g.rotation.y = spin;
  part(g, BOX, C.crate, 0, 0, 0, size, size, size);
  for (const side of [-1, 1]) {
    part(g, BOX, C.crateDark, 0, 0, side * (size / 2 + 0.02), size * 1.02, size * 0.16, 0.06, 0, 0, 0, 0.02);
    part(g, BOX, C.crateDark, side * (size / 2 + 0.02), 0, 0, 0.06, size * 0.16, size * 1.02, 0, 0, 0, 0.02);
    part(g, BOX, C.crateDark, 0, 0, side * (size / 2 + 0.03), size * 1.25, size * 0.12, 0.06, 0, 0, Math.PI / 4, 0.02);
  }
  group.add(g);
  return g;
}

function barrel(group, x, z, color, y = DECK) {
  part(group, BARREL, color, x, y + 0.75, z, 0.6, 1.5, 0.6);
  for (const h of [0.35, 1.15]) part(group, CYL, C.barrelBand, x, y + h, z, 0.63, 0.1, 0.63, 0, 0, 0, 0.02);
  part(group, CYL, 0xffffff, x, y + 1.51, z, 0.45, 0.02, 0.45, 0, 0, 0, 0);
}

function lifebuoyPost(group, x, z, face) {
  part(group, BOX, C.post, x, DECK + 1.6, z, 0.3, 3.2, 0.3);
  const ring = new THREE.Group();
  ring.position.set(x + Math.cos(face) * 0.3, DECK + 2.1, z + Math.sin(face) * 0.3);
  ring.rotation.y = -face + Math.PI / 2;
  const arc = new THREE.TorusGeometry(0.75, 0.24, 12, 8, Math.PI / 2);
  for (let i = 0; i < 4; i++) {
    const m = outlined(arc, toon(i % 2 ? 0xffffff : C.ring), 0.04);
    m.rotation.z = (i * Math.PI) / 2;
    ring.add(m);
  }
  group.add(ring);
}

const CONE_BODY = new THREE.LatheGeometry(
  [[0.0, 0.1], [0.44, 0.1], [0.42, 0.18], [0.1, 1.4], [0.07, 1.45], [0.0, 1.45]].map(([r, y]) => new THREE.Vector2(r, y)),
  28,
);
const CONE_BASE = new THREE.BoxGeometry(1, 1, 1);

function band(y0, y1) {
  const r = (y) => 0.1 + ((1.4 - y) / 1.22) * 0.32;
  return new THREE.CylinderGeometry(r(y1) + 0.012, r(y0) + 0.012, y1 - y0, 28, 1, true).translate(0, (y0 + y1) / 2, 0);
}
const BAND_LOW = band(0.48, 0.68);
const BAND_HIGH = band(0.86, 1.02);

function cone(group, x, z, spin = 0, tip = 0) {
  const g = new THREE.Group();
  g.position.set(x, DECK, z);
  g.rotation.set(0, spin, tip);
  part(g, CONE_BASE, C.cone, 0, 0.05, 0, 1, 0.1, 1, 0, 0, 0, 0.03);
  for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) part(g, CYL, C.cone, cx * 0.45, 0.05, cz * 0.45, 0.08, 0.1, 0.08, 0, 0, 0, 0);
  part(g, CONE_BODY, C.cone, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0.035);
  for (const geometry of [BAND_LOW, BAND_HIGH]) {
    const m = new THREE.Mesh(geometry, toon(0xffffff, { side: THREE.DoubleSide }));
    g.add(m);
  }
  group.add(g);
}

function toolbox(group, x, z, spin) {
  const g = new THREE.Group();
  g.position.set(x, DECK, z);
  g.rotation.y = spin;
  part(g, BOX, C.toolbox, 0, 0.4, 0, 1.6, 0.8, 0.8);
  part(g, BOX, C.craneDark, 0, 0.82, 0, 1.62, 0.08, 0.82, 0, 0, 0, 0.02);
  part(g, TORUS, C.craneDark, 0, 0.95, 0, 0.35, 0.25, 0.3, 0, 0, 0, 0.02);
  part(g, BOX, 0xc9d3dd, 0.9, 0.08, 0.3, 1.0, 0.1, 0.18, 0, 0.6, 0, 0.02);
  part(g, TORUS, 0xc9d3dd, 1.4, 0.1, 0.62, 0.18, 0.18, 0.4, Math.PI / 2, 0, 0, 0.02);
  group.add(g);
}

function crane(group, x, z, face) {
  const g = new THREE.Group();
  g.position.set(x, DECK, z);
  g.rotation.y = face;
  part(g, BOX, 0xb9c2cc, 0, 0.4, 0, 3.2, 0.8, 3.2);
  for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) part(g, CYL, C.craneDark, px * 1.3, 0.85, pz * 1.3, 0.12, 0.12, 0.12, 0, 0, 0, 0.02);
  for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) part(g, BOX, C.crane, px * 0.9, 6, pz * 0.9, 0.3, 11, 0.3);
  for (let y = 1.5; y < 11; y += 1.8) {
    for (const s of [-1, 1]) {
      part(g, BOX, C.crane, s * 0.9, y + 0.9, 0, 0.16, 2.5, 0.16, Math.PI / 4.8 * (s > 0 ? 1 : -1), 0, 0, 0.02);
      part(g, BOX, C.crane, 0, y + 0.9, s * 0.9, 0.16, 2.5, 0.16, 0, 0, Math.PI / 4.8 * (s > 0 ? 1 : -1), 0.02);
    }
  }
  part(g, BOX, 0xff5a5f, 0, 12.2, 0.5, 2.6, 2.2, 3, 0, 0, 0, 0.05);
  part(g, BOX, 0xffffff, 0, 13.4, 0.5, 2.9, 0.25, 3.3, 0, 0, 0, 0.04);
  part(g, BOX, 0x8fd3f4, 1.31, 12.4, 0.9, 0.05, 1.1, 1.8, 0, 0, 0, 0.02);
  part(g, BOX, 0x8fd3f4, 0, 12.4, 2.01, 1.8, 1.1, 0.05, 0, 0, 0, 0.02);
  part(g, BOX, C.crane, 0, 13.6, 4.5, 0.9, 0.9, 13, 0, 0, 0, 0.05);
  part(g, BOX, C.crane, 0, 13.6, -3, 0.9, 0.9, 4, 0, 0, 0, 0.05);
  part(g, BOX, 0x8c98a6, 0, 13.2, -4.6, 1.8, 1.8, 1.4);
  for (let k = -0.6; k <= 0.6; k += 0.6) part(g, BOX, k === 0 ? C.crane : C.craneDark, 0.91, 13.2 + k, -4.6, 0.04, 0.3, 1.42, 0, 0, 0, 0);
  part(g, BOX, C.crane, 0, 15.6, 0.5, 0.4, 3.6, 0.4);
  for (let k = -2; k <= 10; k += 1.6) part(g, BOX, C.craneDark, 0, 14.12, k, 0.92, 0.1, 0.1, 0, 0, 0, 0);
  const trolley = 9;
  part(g, BOX, C.craneDark, 0, 12.9, trolley, 1.1, 0.5, 1);
  part(g, CYL, C.rope, -0.15, 10.4, trolley, 0.05, 4.6, 0.05, 0, 0, 0, 0);
  part(g, CYL, C.rope, 0.15, 10.4, trolley, 0.05, 4.6, 0.05, 0, 0, 0, 0);
  part(g, BOX, C.craneDark, 0, 8, trolley, 0.8, 0.5, 0.5);
  part(g, TORUS, C.hook, 0, 7.2, trolley, 0.45, 0.45, 0.6, 0, 0, Math.PI, 0.03);
  part(g, BALL, C.ring, 0, 13.6, 11.1, 0.3, 0.3, 0.3);
  group.add(g);
  return g;
}

function shed(group, x, z, face) {
  const g = new THREE.Group();
  g.position.set(x, DECK, z);
  g.rotation.y = face;
  part(g, BOX, C.shed, 0, 2.2, 0, 7, 4.4, 5);
  for (let k = -3.2; k <= 3.2; k += 0.8) part(g, BOX, 0x6fbfe6, k, 2.2, 2.52, 0.08, 4.3, 0.05, 0, 0, 0, 0);
  const roofShape = new THREE.Shape([new THREE.Vector2(-4, 0), new THREE.Vector2(4, 0), new THREE.Vector2(0, 2.3)]);
  const roof = new THREE.ExtrudeGeometry(roofShape, { depth: 6, bevelEnabled: false }).translate(0, 0, -3);
  part(g, roof, C.roof, 0, 4.4, 0);
  part(g, BOX, C.shedTrim, 0, 1.6, 2.55, 2.4, 3.2, 0.1);
  part(g, BOX, 0x2b3440, 0, 1.55, 2.6, 2, 3, 0.1);
  for (let k = 0.3; k < 3; k += 0.45) part(g, BOX, 0x47566a, 0, k, 2.66, 2, 0.06, 0.04, 0, 0, 0, 0);
  part(g, BOX, C.shedTrim, 2.6, 2.6, 2.53, 1.3, 1.3, 0.1);
  part(g, BOX, 0x8fd3f4, 2.6, 2.6, 2.58, 1.05, 1.05, 0.05, 0, 0, 0, 0);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.5), new THREE.MeshBasicMaterial({ map: signTexture(), transparent: true }));
  sign.position.set(0, 5.4, 2.62);
  g.add(sign);
  part(g, BOX, C.post, -2.2, 5.4, 2.55, 0.12, 1.7, 0.12, 0, 0, 0, 0.02);
  part(g, BOX, C.post, 2.2, 5.4, 2.55, 0.12, 1.7, 0.12, 0, 0, 0, 0.02);
  group.add(g);
}

let signMap = null;
function signTexture() {
  if (signMap) return signMap;
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#0e2a47';
  g.beginPath();
  g.roundRect(4, 4, 504, 120, 28);
  g.fill();
  g.fillStyle = '#ffd23f';
  g.beginPath();
  g.roundRect(14, 14, 484, 100, 20);
  g.fill();
  g.font = '900 72px "Saira Condensed", "Arial Black", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 10;
  g.strokeStyle = '#0e2a47';
  g.save();
  g.translate(256, 68);
  g.transform(1, 0, -0.18, 1, 0, 0);
  g.strokeText('SHIPYARD', 0, 0);
  g.fillStyle = '#ffffff';
  g.fillText('SHIPYARD', 0, 0);
  g.restore();
  signMap = new THREE.CanvasTexture(c);
  signMap.colorSpace = THREE.SRGBColorSpace;
  return signMap;
}

function bunting(group, a, b, sag) {
  const pts = [];
  for (let k = 0; k <= 20; k++) {
    const u = k / 20;
    const p = a.clone().lerp(b, u);
    p.y -= Math.sin(u * Math.PI) * sag;
    pts.push(p);
  }
  const line = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.04, 5), toon(INK));
  group.add(line);
  const colors = [0xff5a5f, 0xffd23f, 0x3ddc97, 0x4d9de0, 0xb57edc, 0xff8fc7];
  const flag = new THREE.ConeGeometry(0.42, 0.9, 3).rotateZ(Math.PI).rotateY(Math.PI / 6);
  const flags = [];
  for (let k = 1; k < 20; k++) {
    const p = pts[k];
    const m = outlined(flag, toon(colors[k % colors.length], { side: THREE.DoubleSide }), 0.03);
    m.position.copy(p).add(new THREE.Vector3(0, -0.5, 0));
    m.scale.set(1, 1, 0.12);
    m.lookAt(p.clone().add(b.clone().sub(a).normalize().cross(new THREE.Vector3(0, 1, 0))));
    m.userData.phase = k * 0.7;
    group.add(m);
    flags.push(m);
  }
  return flags;
}

export function buildYard(scene, poolRadius) {
  const group = new THREE.Group();
  const inner = poolRadius + 0.4;
  deck(group, inner, inner + 15);
  fenders(group, inner);
  const at = (deg, r) => {
    const a = THREE.MathUtils.degToRad(deg);
    return [Math.cos(a) * r, Math.sin(a) * r, a];
  };
  for (const deg of [-150, -105, -15, 40, 140, 185]) {
    const [x, z] = at(deg, inner + 1.2);
    bollard(group, x, z);
  }
  {
    const [x, z, a] = at(-120, inner + 7);
    crane(group, x, z, -a - Math.PI / 2 + 0.9);
  }
  {
    const [x, z, a] = at(-170, inner + 8.5);
    shed(group, x, z, -a - Math.PI / 2);
  }
  {
    const [x, z] = at(-62, inner + 5);
    crate(group, x, z, 2.2, 0.3);
    crate(group, x + 2.3, z + 0.6, 1.8, -0.2);
    crate(group, x + 0.9, z + 0.2, 1.5, 0.6, DECK + 2.2);
  }
  {
    const [x, z] = at(-35, inner + 3.5);
    barrel(group, x, z, C.barrelRed);
    barrel(group, x + 1.4, z + 0.6, C.barrelBlue);
    barrel(group, x + 0.5, z + 1.6, C.barrelRed);
  }
  {
    const [x, z, a] = at(-85, inner + 1.6);
    lifebuoyPost(group, x, z, a + Math.PI);
  }
  {
    const [x, z, a] = at(160, inner + 1.6);
    lifebuoyPost(group, x, z, a + Math.PI);
  }
  [[-130, 0.2, 0], [-136, 1.1, 0], [-133, 0.6, 1.25], [20, 0.4, 0]].forEach(([deg, spin, tip], n) => {
    const [x, z] = at(deg, inner + 2.4 + (n === 2 ? 1.2 : 0));
    cone(group, x, z, spin, tip);
  });
  {
    const [x, z] = at(-150, inner + 3.2);
    toolbox(group, x, z, 0.8);
  }
  const poleA = at(-95, inner + 2.5);
  const poleB = at(-175, inner + 2.5);
  for (const [x, z] of [poleA, poleB]) {
    part(group, CYL, 0xffffff, x, DECK + 4.5, z, 0.14, 9, 0.14);
    part(group, BALL, C.ring, x, DECK + 9.1, z, 0.28, 0.28, 0.28);
  }
  const flags = bunting(group, new THREE.Vector3(poleA[0], DECK + 8.6, poleA[1]), new THREE.Vector3(poleB[0], DECK + 8.6, poleB[1]), 2);
  scene.add(group);
  return {
    group,
    update(t) {
      for (const f of flags) f.rotation.z = Math.sin(t * 2.4 + f.userData.phase) * 0.25;
    },
  };
}
