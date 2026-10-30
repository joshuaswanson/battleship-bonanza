import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mat, ROCK } from './world.js';
import { toon } from './toon.js';
import { groundMesh, noise, smooth } from './mapKit.js';
import { sandGround } from './groundShader.js';
import { casemate } from './bunker.js';

export const BEACH_COLORS = {
  hedgehog: 0x4a4542,
  hedgehogLight: 0x6a5240,
  sandbag: 0xb3a071,
  sandbagDark: 0x978657,
  craftGrey: 0x5d6b6e,
  craftDark: 0x3a4447,
  craftRust: 0x7a4a2e,
  stake: 0x6e5236,
  tape: 0xf4f0e4,
  pennant: 0xc62828,
  wire: 0x4a4744,
  gate: 0x4c4640,
  duneGrass: 0x8c9a4e,
  duneGrassDark: 0x66793a,
  mound: 0x5f7038,
  moundDark: 0x4c5a2e,
  shingle: 0x8f8a80,
  shingleDark: 0x6d6a63,
  crater: 0x7f6a44,
  craterDark: 0x4f4029,
};

const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 12);
function iBeam(length) {
  const flange = 0.14;
  const web = 0.34;
  return mergeGeometries([
    new THREE.BoxGeometry(0.12, length, web * 2).toNonIndexed(),
    new THREE.BoxGeometry(web * 1.5, length, flange).translate(0, 0, web).toNonIndexed(),
    new THREE.BoxGeometry(web * 1.5, length, flange).translate(0, 0, -web).toNonIndexed(),
  ]);
}

const HEDGEHOG = mergeGeometries([
  iBeam(5.4).rotateZ(0.96).rotateY(0).translate(0, 1.6, 0),
  iBeam(5.4).rotateZ(0.96).rotateY((Math.PI * 2) / 3).translate(0, 1.6, 0),
  iBeam(5.4).rotateZ(0.96).rotateY((Math.PI * 4) / 3).translate(0, 1.6, 0),
  new THREE.BoxGeometry(1, 0.9, 1).translate(0, 1.6, 0).toNonIndexed(),
]);
const GATE = mergeGeometries([
  ...[-3.2, -1.1, 1.1, 3.2].map((x) => new THREE.BoxGeometry(0.22, 5.6, 0.22).translate(x, 2.8, 0).toNonIndexed()),
  ...[0.5, 2.8, 5.4].map((y) => new THREE.BoxGeometry(7, 0.22, 0.22).translate(0, y, 0).toNonIndexed()),
  ...[-1, 1].map((s) => new THREE.BoxGeometry(0.2, 7.4, 0.2).rotateZ(s * 0.62).translate(0, 2.9, 0).toNonIndexed()),
  ...[-3.2, 3.2].map((x) => new THREE.BoxGeometry(0.2, 0.2, 5).translate(x, 0.2, -1.8).toNonIndexed()),
]);
const WIRE = (() => {
  const pts = [];
  for (let k = 0; k <= 90; k++) {
    const t = k / 90;
    pts.push(new THREE.Vector3(Math.cos(t * 44) * 0.72, 0.72 + Math.sin(t * 44) * 0.72, (t - 0.5) * 11));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 150, 0.06, 4, false).toNonIndexed();
})();
const TUFT = mergeGeometries(Array.from({ length: 7 }, (_, k) => new THREE.ConeGeometry(0.2, 1.4 + (k % 3) * 0.4, 4).translate(0, 0.7, 0).rotateZ(0.2 * Math.sin(k * 2.4)).rotateX(0.2 * Math.cos(k * 1.7)).translate(Math.cos(k * 2.4) * 0.45, 0, Math.sin(k * 2.4) * 0.45).toNonIndexed()));
const BAGS = mergeGeometries(Array.from({ length: 20 }, (_, k) => {
  const row = k < 7 ? 0 : k < 13 ? 1 : k < 18 ? 2 : 3;
  const index = k - [0, 7, 13, 18][row];
  return new THREE.SphereGeometry(1, 7, 5).scale(0.82, 0.3, 0.46).translate(-2.5 + index * 1.52 + row * 0.5, 0.26 + row * 0.5, 0).toNonIndexed();
}));

const COAST = -424;
const WET = 36;
const BEACH_TOP = 6;
const BLUFF_FROM = 300;
const BLUFF_TO = 372;
const BLUFF_RISE = 46;
const SHINGLE = 178;
const LANE_TAPE = 2;
const STAKE_EVERY = 16;
const PAD = 46;
const BUNKER_INLAND = 352;
const BUNKER_Y = 26;
const WEST = -340;
const EAST = 980;
const HEDGEHOG_GAP = 30;
const MG_GAP = 0.07;
const MG_SPEED = 330;
const DRIFT = new THREE.Vector3(1.6, 0, 0.5);
const CLEAR_ENDS = 110;
const SHOT_EVERY = 0.55;
const BUNKERS = [150, 320, 490];

const coastAt = (x) => COAST + 16 * Math.sin(x * 0.011) + 9 * Math.sin(x * 0.031 + 1);

export function onIsland(x, z, margin = 0) {
  return x > WEST - margin && x < EAST + margin && z < coastAt(x) + margin;
}

function shoreHeight(x, z) {
  const inland = coastAt(x) - z;
  const ends = smooth(WEST, WEST + 130, x) * (1 - smooth(EAST - 130, EAST, x));
  const flat = inland <= 0 ? inland * 0.12 : Math.min(BEACH_TOP, (inland * BEACH_TOP) / WET);
  const shingle = 2.6 * Math.exp(-(((inland - SHINGLE - 12 * noise(x * 0.7, 3)) / 15) ** 2));
  const dunes = 3.4 * noise(x * 2.2, z * 2.2) * smooth(205, 250, inland);
  const draw = 0.5 + 0.5 * Math.sin(x * 0.019 + 3 * noise(x * 0.4, 8));
  const bluff = smooth(BLUFF_FROM, BLUFF_TO, inland + 30 * draw) * (BLUFF_RISE * (0.55 + 0.45 * (1 - draw * draw)) + 20 * noise(x * 1.2, z * 1.2));
  return Math.max(-8, flat + shingle + dunes + bluff + 0.5 * noise(x * 3.4, z * 3.4)) * ends + -8 * (1 - ends);
}

function crater(batch, x, y, z, r, rand) {
  batch.add('crater', CYL, mat(x, y - 0.06, z, r, 0.16, r * (0.8 + rand() * 0.3)));
  batch.add('craterDark', CYL, mat(x, y - 0.02, z, r * 0.6, 0.16, r * 0.5));
}

function landingCraft(batch, x, y, z, yaw, rand) {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const tilt = 0.08 + rand() * 0.14;
  const at = (lx, lz) => [x + c * lx + s * lz, z - s * lx + c * lz];
  const put = (key, geometry, lx, ly, lz, w, h, d, rx = 0) => {
    const [px, pz] = at(lx, lz);
    batch.add(key, geometry, mat(px, y + ly, pz, w, h, d, rx, yaw, tilt));
  };
  put('craftGrey', BOX, -3.2, 1.7, 0, 0.5, 3.2, 15);
  put('craftGrey', BOX, 3.2, 1.7, 0, 0.5, 3.2, 15);
  put('craftDark', BOX, 0, 0.5, 0, 6.8, 0.6, 15);
  put('craftRust', BOX, 0, 2, -7.2, 7, 3.6, 0.6);
  put('craftDark', BOX, 2.1, 4.1, -6.3, 2.2, 1.5, 1.6);
  put('craftGrey', BOX, 0, 0.9, 10.1, 6.2, 0.4, 6, 0.32);
  put('craftRust', BOX, -2.7, 0.8, 10.1, 0.3, 0.7, 6, 0.32);
  put('craftRust', BOX, 2.7, 0.8, 10.1, 0.3, 0.7, 6, 0.32);
}

function surfLine() {
  const pos = [];
  const shore = [];
  const index = [];
  const across = 8;
  const rows = 280;
  for (let r = 0; r <= rows; r++) {
    const x = WEST + ((EAST - WEST) * r) / rows;
    for (let k = 0; k <= across; k++) {
      const u = k / across;
      pos.push(x, 0.24, coastAt(x) - 10 + u * 74);
      shore.push(u);
    }
  }
  for (let r = 0; r < rows; r++) {
    for (let k = 0; k < across; k++) {
      const a = r * (across + 1) + k;
      index.push(a, a + 1, a + across + 1, a + 1, a + across + 2, a + across + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aShore', new THREE.Float32BufferAttribute(shore, 1));
  g.setIndex(index);
  const material = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      attribute float aShore;
      varying float vShore;
      varying vec2 vPlace;
      void main() {
        vShore = aShore;
        vPlace = position.xz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying float vShore;
      varying vec2 vPlace;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
      }
      void main() {
        float wobble = noise(vPlace * vec2(0.03, 0.05)) * 0.3 + noise(vPlace * 0.13) * 0.08;
        float wash = fract(vShore * 2.2 + wobble - uTime * 0.11);
        float crest = smoothstep(0.82, 0.9, wash) * (1.0 - smoothstep(0.95, 1.0, wash));
        float lace = smoothstep(0.5, 0.68, noise(vPlace * 0.5 + uTime * 0.2)) * smoothstep(0.35, 0.86, wash);
        float strength = max(crest, lace * 0.55) * (1.0 - smoothstep(0.7, 1.0, vShore)) * smoothstep(0.0, 0.08, vShore);
        gl_FragColor = vec4(vec3(0.92, 0.95, 0.94), strength * 0.9);
        #include <colorspace_fragment>
      }`,
  });
  return new THREE.Mesh(g, material);
}

function laneRuts() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const c = canvas.getContext('2d');
  c.clearRect(0, 0, 256, 256);
  const fill = c.createLinearGradient(0, 0, 256, 0);
  fill.addColorStop(0, 'rgba(176,150,104,0)');
  fill.addColorStop(0.06, 'rgba(176,150,104,0.5)');
  fill.addColorStop(0.94, 'rgba(176,150,104,0.5)');
  fill.addColorStop(1, 'rgba(176,150,104,0)');
  c.fillStyle = fill;
  c.fillRect(0, 0, 256, 256);
  c.strokeStyle = 'rgba(112,90,58,0.38)';
  c.lineWidth = 1.4;
  for (const x of [52, 68, 120, 136, 190, 206]) {
    for (let y = 0; y < 256; y += 6) {
      c.beginPath();
      c.moveTo(x - 6, y);
      c.lineTo(x, y + 3);
      c.lineTo(x + 6, y);
      c.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function laneMesh(track) {
  const { launch, lip } = track.river.land;
  const pos = [];
  const uv = [];
  const index = [];
  let rows = 0;
  for (let s = launch + 44; s < lip - 20; s += 4) {
    const i = track.wrap(Math.round(s / track.spacing));
    const hw = track.hw[i] * 0.92;
    for (const u of [0, 1]) {
      const p = track.point(i, (u * 2 - 1) * hw);
      pos.push(p.x, track.level(s) + 0.06, p.z);
      uv.push(u, (s - launch) / 40);
    }
    rows++;
  }
  for (let r = 0; r < rows - 1; r++) index.push(r * 2, r * 2 + 1, r * 2 + 2, r * 2 + 1, r * 2 + 3, r * 2 + 2);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(index);
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, toon(0xffffff, { map: laneRuts(), transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 }));
  mesh.frustumCulled = false;
  return mesh;
}

export async function buildBeach({ group, batch, fine, track, surface, tick, rand, shores }) {
  const pads = BUNKERS.map((x) => {
    const z = coastAt(x) - BUNKER_INLAND;
    return { x, z, y: BUNKER_Y };
  });
  const height = (x, z) => {
    let natural = shoreHeight(x, z);
    for (const pad of pads) natural += (pad.y - natural) * (1 - smooth(PAD, PAD * 2, Math.hypot(x - pad.x, (z - pad.z) * 1.2)));
    const { s, edge, level } = surface.sample(x, z);
    if (track.landDepth(s) < 0) return natural;
    return level - 0.15 + (natural - level + 0.15) * smooth(2, 34, edge);
  };
  const sand = new THREE.Color(0xd8c394);
  const damp = new THREE.Color(0x8d7c58);
  const dune = new THREE.Color(0xc2ad78);
  const shingle = new THREE.Color(0x9a9488);
  const grass = new THREE.Color(0x6f8a3c);
  const scrub = new THREE.Color(0x536b30);
  const rock = new THREE.Color(0x8d8578);
  const bounds = { minX: WEST - 10, maxX: EAST + 10, minZ: -960, maxZ: COAST + 60 };
  const ground = await groundMesh({ bounds }, height, (x, y, z, n, out) => {
    const inland = coastAt(x) - z;
    out.copy(sand).lerp(dune, smooth(0.34, 0.66, noise(x * 2.3, z * 2.3)));
    if (y < 2.4) out.lerp(damp, 1 - smooth(0.2, 2.4, y));
    out.lerp(shingle, Math.exp(-(((inland - SHINGLE) / 20) ** 2)) * 0.9);
    const face = smooth(BLUFF_FROM - 40, BLUFF_FROM - 10, inland) * smooth(0.28, 0.42, noise(x * 1.1 + 20, z * 0.7));
    const green = Math.max(face, smooth(8, 12, y + 7 * noise(x * 1.6, z * 1.6)));
    if (green > 0) out.lerp(scrub, green).lerp(grass, green * smooth(0.35, 0.65, noise(x * 3, z * 3)));
    if (n.y < 0.66) out.lerp(rock, smooth(0.66, 0.5, n.y) * smooth(0.3, 0.6, noise(x * 2.4 + 5, z * 2.4)));
  }, tick, 4);
  sandGround(ground.material);
  group.add(ground);
  const surf = surfLine();
  group.add(surf);
  group.add(laneMesh(track));
  await tick();

  const { launch, lip } = track.river.land;
  for (const side of [-1, 1]) {
    let last = null;
    for (let s = launch + 40, k = 0; s < lip - 24; s += STAKE_EVERY, k++) {
      const i = track.wrap(Math.round(s / track.spacing));
      const p = track.point(i, side * (track.hw[i] + LANE_TAPE));
      const y = track.level(s);
      batch.add('stake', BOX, mat(p.x, y + 1.1, p.z, 0.26, 2.4, 0.26, 0, rand() * 3, (rand() - 0.5) * 0.12));
      if (k % 3 === 0) batch.add('pennant', BOX, mat(p.x, y + 2.05, p.z, 1.1, 0.5, 0.05, 0, track.heading(i) + Math.PI / 2, 0));
      if (last) {
        const dx = p.x - last.x;
        const dz = p.z - last.z;
        batch.add('tape', BOX, mat((p.x + last.x) / 2, y + 1.5, (p.z + last.z) / 2, 0.08, 0.2, Math.hypot(dx, dz), 0, Math.atan2(dx, dz), 0));
      }
      last = p;
    }
  }
  const stoppers = [];
  const taken = (x, z, gap = HEDGEHOG_GAP) => stoppers.some((o) => Math.hypot(o.x - x, o.z - z) < gap);
  for (let s = launch + 60; s < lip - 40; s += 13) {
    const i = track.wrap(Math.round(s / track.spacing));
    for (const side of [-1, 1]) {
      if (rand() < 0.3) continue;
      const p = track.point(i, side * (track.hw[i] + 8 + rand() * 18));
      if (taken(p.x, p.z, 8)) continue;
      stoppers.push({ x: p.x, z: p.z });
      const y = height(p.x, p.z);
      batch.add(rand() < 0.5 ? 'hedgehog' : 'hedgehogLight', HEDGEHOG, mat(p.x, y - 0.3, p.z, 1, 1, 1, 0, rand() * 6, 0));
      shores.push({ x: p.x, z: p.z, rx: 2.2, rz: 2.2, rot: 0, top: y + 4 });
    }
  }
  await tick();
  for (let k = 0; k < 520; k++) {
    const x = WEST + 180 + rand() * (EAST - WEST - 300);
    const z = coastAt(x) - 22 - rand() * 280;
    const near = track.project(x, z);
    const depth = track.landDepth(near.s);
    const onRun = depth >= 0 && near.distance < track.hw[near.idx] + 3;
    if (onRun && (depth < CLEAR_ENDS || depth > lip - launch - CLEAR_ENDS)) continue;
    if (taken(x, z, onRun ? HEDGEHOG_GAP : 18) || stoppers.length > 260) continue;
    stoppers.push({ x, z });
    const y = height(x, z);
    const gate = !onRun && k % 6 === 0;
    if (gate) batch.add('gate', GATE, mat(x, y - 0.2, z, 1, 1, 1, 0, rand() * 0.6 - 0.3, 0));
    else batch.add(k % 2 ? 'hedgehog' : 'hedgehogLight', HEDGEHOG, mat(x, y - 0.3, z, 1, 1, 1, 0, rand() * 6, 0));
    shores.push({ x, z, rx: gate ? 3.6 : 2.2, rz: gate ? 2.6 : 2.2, rot: 0, top: y + (gate ? 6 : 4) });
  }
  await tick();
  const clear = (x, z, room) => track.project(x, z).distance > track.hw[track.project(x, z).idx] + room;
  for (let k = 0; k < 80; k++) {
    const x = WEST + 220 + rand() * (EAST - WEST - 420);
    const z = coastAt(x) - 40 - rand() * 230;
    if (!clear(x, z, 4)) continue;
    crater(batch, x, height(x, z) + 0.05, z, 3 + rand() * 6, rand);
  }
  for (let k = 0; k < 420; k++) {
    const x = WEST + 160 + rand() * (EAST - WEST - 320);
    const z = coastAt(x) - SHINGLE + (rand() - 0.5) * 34;
    if (!clear(x, z, 2)) continue;
    const r = 0.4 + rand() * 1.1;
    batch.add(k % 2 ? 'shingle' : 'shingleDark', ROCK, mat(x, height(x, z) + r * 0.2, z, r, r * 0.6, r, rand(), rand() * 6, rand()));
  }
  await tick();
  for (let k = 0; k < 640; k++) {
    const x = WEST + 160 + rand() * (EAST - WEST - 320);
    const z = coastAt(x) - 205 - rand() * 230;
    if (!clear(x, z, 3)) continue;
    const y = height(x, z);
    if (y < 5) continue;
    const size = 0.5 + rand() * 0.6;
    fine.add(k % 2 ? 'duneGrass' : 'duneGrassDark', TUFT, mat(x, y - 0.1, z, size, size, size, 0, rand() * 6, 0));
  }
  await tick();
  for (let k = 0; k < 46; k++) {
    const x = WEST + 240 + rand() * (EAST - WEST - 460);
    const z = coastAt(x) - 226 - (k % 3) * 14 - rand() * 10;
    if (!clear(x, z, 8)) continue;
    const y = height(x, z);
    const yaw = (rand() - 0.5) * 0.3 + Math.PI / 2 * 0;
    fine.add('wire', WIRE, mat(x, y, z, 1, 1, 1, 0, Math.PI / 2 + yaw, 0));
    batch.add('stake', BOX, mat(x, y + 0.9, z, 0.2, 2, 0.2));
  }
  const wrecks = [];
  for (let k = 0; k < 8; k++) {
    const x = WEST + 300 + (k / 7) * (EAST - WEST - 600) + rand() * 40;
    const z = coastAt(x) + 4 - rand() * 20;
    if (!clear(x, z, 16)) continue;
    landingCraft(batch, x, Math.max(height(x, z), -0.5), z, 0.3 + rand() * 2.6, rand);
    if (k % 2 === 0) wrecks.push(new THREE.Vector3(x, 2, z));
  }
  const guns = [];
  const mgs = [];
  pads.forEach((pad) => {
    const { group: post, muzzles } = casemate();
    post.position.set(pad.x, pad.y - 0.4, pad.z);
    group.add(post);
    guns.push(muzzles.gun.clone().add(post.position));
    for (const m of muzzles.guns) mgs.push(m.clone().add(post.position));
    for (let k = 0; k < 44; k++) {
      const a = Math.PI + (k / 43) * Math.PI;
      const r = 40 + rand() * 8;
      const px = pad.x + Math.cos(a) * r * 1.2;
      const pz = pad.z + Math.sin(a) * r * 0.9;
      const s = 6 + rand() * 7;
      batch.add(k % 2 ? 'mound' : 'moundDark', ROCK, mat(px, height(px, pz) + s * 0.1, pz, s * 1.5, s * 0.8, s * 1.2, 0, rand() * 6, 0));
    }
    for (const side of [-1, 1]) {
      for (let k = 0; k < 4; k++) {
        const px = pad.x + side * (10 + k * 6.2);
        const pz = pad.z + 32 - k * 1.5;
        batch.add(k % 2 ? 'sandbag' : 'sandbagDark', BAGS, mat(px, height(px, pz) - 0.1, pz, 1, 1, 1, 0, side * 0.2, 0));
      }
    }
  });
  return {
    height,
    guns,
    mgs,
    update(t, dt, fx, camera) {
      surf.material.uniforms.uTime.value = t;
      for (const w of wrecks) {
        if (Math.random() < dt * 8 && Math.hypot(w.x - camera.position.x, w.z - camera.position.z) < 500) fx.blackSmoke(w.x, w.y, w.z, DRIFT);
      }
    },
  };
}

export function bunkerFire({ guns, mgs, track, fx, surface, events, tracers, height }) {
  let wait = 0;
  const from = new THREE.Vector3();
  const to = new THREE.Vector3();
  const spurts = [];
  const bursts = mgs.map(() => ({ wait: Math.random() * 2, left: 0, cool: 0, s: 0, lat: 0, walk: 0 }));
  return (dt, camera) => {
    for (let k = spurts.length - 1; k >= 0; k--) {
      const hit = spurts[k];
      hit.at -= dt;
      if (hit.at > 0) continue;
      fx.soot.emit(hit.x, hit.y, hit.z, (Math.random() - 0.5) * 3, 5 + Math.random() * 6, (Math.random() - 0.5) * 3, 0.3 + Math.random() * 0.4, 0.4, Math.random() < 0.5 ? 0xd2bd8a : 0x8f7d58, 16, 0.6, 0);
      spurts.splice(k, 1);
    }
    const { s } = surface.sample(camera.position.x, camera.position.z);
    if (track.landDepth(s) < 0) return;
    const near = track.project(camera.position.x, camera.position.z);
    bursts.forEach((burst, k) => {
      if (burst.left <= 0) {
        burst.wait -= dt;
        if (burst.wait > 0) return;
        burst.left = 14 + Math.floor(Math.random() * 18);
        burst.wait = 0.5 + Math.random() * 1.1;
        burst.cool = 0;
        burst.s = 16 + Math.random() * 80;
        burst.lat = (Math.random() < 0.5 ? -1 : 1) * (15 + Math.random() * 24);
        burst.walk = (Math.random() < 0.5 ? -1 : 1) * (0.9 + Math.random() * 0.9);
      }
      burst.cool -= dt;
      while (burst.cool <= 0 && burst.left > 0) {
        burst.cool += MG_GAP;
        burst.left--;
        burst.s += 2.4;
        burst.lat += burst.walk * 0.16;
        const lane = near.lateral + Math.sign(burst.lat) * Math.max(13, Math.abs(burst.lat));
        const p = track.point(track.wrap(near.idx + Math.round(burst.s / track.spacing)), lane);
        const y = height(p.x, p.z);
        to.set(p.x + (Math.random() - 0.5) * 1.6, y + 0.3, p.z + (Math.random() - 0.5) * 1.6);
        tracers(mgs[k], to, MG_SPEED);
        spurts.push({ x: to.x, y: to.y, z: to.z, at: mgs[k].distanceTo(to) / MG_SPEED });
        if (Math.random() < 0.35) fx.sparkBurst(mgs[k].x, mgs[k].y, mgs[k].z, 0xffd27a, 3);
      }
    });
    wait -= dt;
    if (wait > 0) return;
    wait = SHOT_EVERY * (0.5 + Math.random());
    const ahead = track.wrap(near.idx + Math.round((20 + Math.random() * 90) / track.spacing));
    const miss = (Math.random() < 0.5 ? -1 : 1) * (20 + Math.random() * 34);
    const p = track.point(ahead, near.lateral + miss);
    const y = height(p.x, p.z);
    from.copy(guns[Math.floor(Math.random() * guns.length)]);
    to.set(p.x, y + 0.5, p.z);
    fx.sparkBurst(from.x, from.y, from.z, 0xffd27a, 14);
    tracers(from, to, 260);
    fx.groundBlast(to.x, to.y, to.z, 1.3, 0xd2bd8a, 0x7a6846);
    events.push({ type: 'boom', pos: to.clone(), power: 1.4 });
  };
}
