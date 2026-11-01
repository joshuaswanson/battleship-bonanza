import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mat } from './world.js';
import { toon } from './toon.js';

export const CITY_COLORS = {
  kerb: 0x5a5c66,
  pavement: 0x34363f,
  streetPole: 0x2a2d36,
  bridgeSteel: 0x3d4250,
  hazardBar: 0xd8b13a,
  parkedA: 0x7a1f2e,
  parkedB: 0x1f4a7a,
  parkedC: 0xc9c9d2,
  parkedD: 0x20222a,
  neonPink: 0xff3fa4,
  neonCyan: 0x39e6ff,
  neonAmber: 0xffc24d,
  neonGreen: 0x39ff9c,
  neonViolet: 0xb56bff,
  neonOrange: 0xff6a3d,
  lampWarm: 0xffe2ad,
  brakeGlow: 0xff2a2a,
};

const BOX = new THREE.BoxGeometry(1, 1, 1);
const BALL = new THREE.SphereGeometry(1, 8, 6);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 8);
const SIDEWALK = 9;
const TUNNEL = [0.68, 0.81];
const TUNNEL_ROOF = 13;
const NEON = [['neonPink', '#ff3fa4'], ['neonCyan', '#39e6ff'], ['neonAmber', '#ffc24d'], ['neonGreen', '#39ff9c'], ['neonViolet', '#b56bff'], ['neonOrange', '#ff6a3d']];
const WORDS = ['NOODLES', 'HOTEL', 'ARCADE', 'RAMEN', 'KARAOKE', 'GARAGE', 'DINER', 'TATTOO', 'CAFE', 'MOTEL', 'BAR', 'PAWN', 'SUSHI', 'OPEN'];

function canvasOf(w, h, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext('2d'));
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}

const asphalt = () =>
  canvasOf(512, 512, (c) => {
    c.fillStyle = '#20222c';
    c.fillRect(0, 0, 512, 512);
    for (let k = 0; k < 2600; k++) {
      c.fillStyle = `rgba(${110 + Math.random() * 70},${110 + Math.random() * 70},${140 + Math.random() * 70},0.1)`;
      c.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }
    for (let k = 0; k < 14; k++) {
      c.fillStyle = 'rgba(120,140,190,0.07)';
      c.beginPath();
      c.ellipse(Math.random() * 512, Math.random() * 512, 30 + Math.random() * 60, 12 + Math.random() * 26, Math.random() * 3, 0, 6.3);
      c.fill();
    }
    c.fillStyle = 'rgba(232,232,240,0.85)';
    c.fillRect(0, 0, 6, 512);
    c.fillRect(506, 0, 6, 512);
    for (const x of [168, 340]) c.fillRect(x - 2, 0, 5, 220);
    c.fillStyle = '#e0bd4a';
    c.fillRect(246, 0, 7, 512);
    c.fillRect(259, 0, 7, 512);
  });

const facade = () =>
  canvasOf(256, 256, (c) => {
    c.fillStyle = '#23263a';
    c.fillRect(0, 0, 256, 256);
    c.fillStyle = '#2e3248';
    for (let y = 0; y < 4; y++) c.fillRect(0, y * 64, 256, 6);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const lit = Math.random();
      c.fillStyle = lit < 0.14 ? '#ffd28e' : lit < 0.19 ? '#8fd4ff' : lit < 0.22 ? '#ff8fc8' : '#0d0f1a';
      c.fillRect(x * 64 + 14, y * 64 + 14, 36, 40);
    }
  });

const softGlow = () =>
  canvasOf(128, 128, (c) => {
    const g = c.createRadialGradient(64, 64, 4, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 128, 128);
  });

function bladeSign(word, color) {
  const tall = 60 + word.length * 74;
  const texture = canvasOf(128, tall, (c) => {
    c.fillStyle = '#0c0a14';
    c.fillRect(0, 0, 128, tall);
    c.strokeStyle = color;
    c.lineWidth = 5;
    c.shadowColor = color;
    c.shadowBlur = 18;
    c.strokeRect(8, 8, 112, tall - 16);
    c.fillStyle = '#ffffff';
    c.font = '700 62px sans-serif';
    c.textAlign = 'center';
    [...word].forEach((l, k) => c.fillText(l, 64, 88 + k * 74));
  });
  return { material: new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }), aspect: tall / 128 };
}

function ribbon(track, from, to, step, across, y) {
  const pos = [];
  const uv = [];
  const index = [];
  let rows = 0;
  for (let s = from; s <= to; s += step) {
    const i = track.wrap(Math.round(s / track.spacing));
    across.forEach((lat, k) => {
      const value = typeof lat === 'function' ? lat(i) : lat;
      const p = track.point(i, value);
      pos.push(p.x, y(s), p.z);
      uv.push(k / (across.length - 1), (s - from) / 26);
    });
    rows++;
  }
  const cols = across.length;
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const a = r * cols + c;
      index.push(a, a + 1, a + cols, a + 1, a + cols + 1, a + cols);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

function tower(x, y, z, yaw, w, d, h, tint) {
  const g = new THREE.BoxGeometry(w, h, d).toNonIndexed();
  const uv = g.attributes.uv;
  const rows = Math.max(1, Math.round(h / 11));
  for (let k = 0; k < uv.count; k++) {
    const face = Math.floor(k / 6);
    const wide = face < 2 ? d : w;
    if (face === 2 || face === 3) uv.setXY(k, 0.002, 0.002);
    else uv.setXY(k, uv.getX(k) * Math.max(1, Math.round(wide / 11)), uv.getY(k) * rows);
  }
  g.rotateY(yaw).translate(x, y + h / 2, z);
  const color = new THREE.Color(tint);
  const colors = new Float32Array(g.attributes.position.count * 3);
  for (let k = 0; k < colors.length; k += 3) {
    colors[k] = color.r;
    colors[k + 1] = color.g;
    colors[k + 2] = color.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}

function parkedCar(batch, glow, x, y, z, yaw, key) {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  batch.add(key, BOX, mat(x, y + 0.6, z, 2.1, 0.8, 4.8, 0, yaw, 0));
  batch.add(key, BOX, mat(x - s * 0.3, y + 1.25, z - c * 0.3, 1.8, 0.62, 2.3, 0, yaw, 0));
  for (const side of [1, -1]) glow.add('brakeGlow', BOX, mat(x - s * 2.42 + c * side * 0.7, y + 0.72, z - c * 2.42 - s * side * 0.7, 0.4, 0.16, 0.06, 0, yaw, 0));
}

export async function buildCity({ group, batch, glow, lights, warm, track, rand, tick, top }) {
  const { launch, span } = track.river.land;
  const soft = [];
  const level = (s) => track.level(s);
  const hw = (i) => track.hw[i];
  const road = new THREE.Mesh(ribbon(track, launch + 6, launch + span, 3, [(i) => -hw(i), (i) => hw(i)], (s) => level(s) + 0.03), new THREE.MeshBasicMaterial({ map: asphalt(), color: 0xaab0c8, side: THREE.DoubleSide }));
  group.add(road);
  await tick();
  const walk = toon(CITY_COLORS.pavement, { side: THREE.DoubleSide });
  for (const side of [-1, 1]) {
    group.add(new THREE.Mesh(ribbon(track, launch + 30, launch + span - 134, 6, [(i) => side * hw(i), (i) => side * (hw(i) + SIDEWALK)], (s) => level(s) + 0.3), walk));
  }
  const slipColor = toon(0x77787c, { side: THREE.DoubleSide });
  group.add(new THREE.Mesh(ribbon(track, launch - 24, launch + 40, 4, [(i) => -(hw(i) + 2), (i) => hw(i) + 2], (s) => Math.max(-1.4, (s - launch) * 0.075 - 0.3)), slipColor));
  for (const side of [-1, 1]) {
    for (let d = -20; d < 34; d += 12) {
      const s = launch + d;
      const i = track.wrap(Math.round(s / track.spacing));
      const p = track.point(i, side * (hw(i) + 3));
      batch.add('hazardBar', BOX, mat(p.x, level(s) + 0.5, p.z, 1.2, 1.4, 6, 0, track.heading(i), 0));
    }
  }
  await tick();

  const inTunnel = (d) => d > span * TUNNEL[0] - 16 && d < span * TUNNEL[1] + 16;
  const towers = [];
  const signs = WORDS.map((w, k) => ({ ...bladeSign(w, NEON[k % NEON.length][1]), key: NEON[k % NEON.length][0] }));
  const reflect = new Map();
  const faceTint = [0xffffff, 0xd6dcff, 0xf0d8ff, 0xc8d8f0, 0xffe6d0];
  const glowMap = softGlow();
  let sign = 0;
  const roomFor = (x, z, r) => {
    const near = track.project(x, z);
    return near.distance > track.hw[near.idx] + SIDEWALK + r - 3;
  };
  for (const side of [-1, 1]) {
    for (let d = 26; d < span - 150;) {
      const wide = 18 + rand() * 18;
      const s = launch + d + wide / 2;
      d += wide + 2;
      if (inTunnel(d)) continue;
      const i = track.wrap(Math.round(s / track.spacing));
      const yaw = track.heading(i);
      const deep = 22 + rand() * 12;
      const lat = hw(i) + SIDEWALK + deep / 2 + 1;
      const c = track.point(i, side * lat);
      if (!roomFor(c.x, c.z, deep / 2)) continue;
      const tall = 24 + rand() * rand() * 90;
      towers.push(tower(c.x, top, c.z, yaw, wide, deep, tall, faceTint[Math.floor(rand() * faceTint.length)]));
      const front = hw(i) + SIDEWALK + 0.7;
      const [shop] = NEON[Math.floor(rand() * NEON.length)];
      const f = track.point(i, side * front);
      glow.add(shop, BOX, mat(f.x, top + 2.7, f.z, wide - 3, 3.2, 0.3, 0, yaw + Math.PI / 2, 0));
      const awn = track.point(i, side * (front - 1.6));
      batch.add('streetPole', BOX, mat(awn.x, top + 4.9, awn.z, wide - 2, 0.3, 3.4, 0, yaw + Math.PI / 2, 0));
      const onRoad = track.point(i, side * (hw(i) - 7));
      if (!reflect.has(shop)) reflect.set(shop, []);
      reflect.get(shop).push(new THREE.PlaneGeometry(wide + 10, 30).rotateX(-Math.PI / 2).rotateY(yaw + Math.PI / 2).translate(onRoad.x, level(s) + 0.07, onRoad.z));
      if (rand() < 0.72) {
        const b = signs[sign++ % signs.length];
        const width = 3.6;
        const blade = new THREE.Mesh(new THREE.PlaneGeometry(width, width * b.aspect), b.material);
        const at = track.point(track.wrap(i + Math.round((side * wide * 0.4) / track.spacing)), side * (front - 2.2));
        blade.position.set(at.x, top + 7 + (width * b.aspect) / 2 + rand() * 5, at.z);
        blade.rotation.y = yaw;
        group.add(blade);
        soft.push(blade);
      }
    }
    await tick();
  }
  for (let k = 0; k < 90; k++) {
    const d = 100 + rand() * (span - 300);
    const i = track.wrap(Math.round((launch + d) / track.spacing));
    const c = track.point(i, (rand() < 0.5 ? -1 : 1) * (hw(i) + 80 + rand() * 90));
    if (!roomFor(c.x, c.z, 40) || !outOfWater(track, c)) continue;
    towers.push(tower(c.x, top, c.z, track.heading(i), 26 + rand() * 20, 26 + rand() * 20, 40 + rand() * 90, faceTint[k % faceTint.length]));
  }
  await tick();
  const skyline = new THREE.Mesh(mergeGeometries(towers), new THREE.MeshBasicMaterial({ map: facade(), vertexColors: true }));
  group.add(skyline);
  for (const [key, plates] of reflect) {
    const pool = new THREE.Mesh(mergeGeometries(plates), new THREE.MeshBasicMaterial({ color: CITY_COLORS[key], map: glowMap, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending }));
    pool.renderOrder = 3;
    group.add(pool);
    soft.push(pool);
  }
  await tick();

  for (const side of [-1, 1]) {
    for (let d = 40, k = 0; d < span - 150; d += 34, k++) {
      if (inTunnel(d)) continue;
      const s = launch + d;
      const i = track.wrap(Math.round(s / track.spacing));
      const base = track.point(i, side * (hw(i) + 1.6));
      const lamp = track.point(i, side * (hw(i) - 3));
      const y = level(s);
      batch.add('streetPole', CYL, mat(base.x, y + 5.2, base.z, 0.2, 10.4, 0.2));
      batch.add('streetPole', BOX, mat((base.x + lamp.x) / 2, y + 10.3, (base.z + lamp.z) / 2, 0.16, 0.16, 4.8, 0, Math.atan2(lamp.x - base.x, lamp.z - base.z), 0));
      glow.add('lampWarm', BALL, mat(lamp.x, y + 10.1, lamp.z, 0.5, 0.3, 0.5));
      if (k % 2 === 0) lights.pool(lamp.x, y + 0.1, lamp.z, 13, warm, 0.5);
      if (k % 5 === 2) {
        const p = track.point(i, side * (hw(i) + 4.6));
        parkedCar(batch, glow, p.x, y + 0.3, p.z, track.heading(i), ['parkedA', 'parkedB', 'parkedC', 'parkedD'][Math.floor(rand() * 4)]);
      }
    }
  }
  for (let d = 70; d < span - 160; d += 104) {
    if (inTunnel(d)) continue;
    const s = launch + d;
    const i = track.wrap(Math.round(s / track.spacing));
    const y = level(s);
    for (let u = -1; u <= 1; u += 1 / 11) {
      const p = track.point(i, u * (hw(i) + 2));
      const sag = 15 - 2.6 * (1 - u * u);
      glow.add(NEON[Math.floor((u + 1) * 5.5) % NEON.length][0], BALL, mat(p.x, y + sag, p.z, 0.3, 0.3, 0.3));
    }
  }
  await tick();

  const from = launch + span * TUNNEL[0];
  const to = launch + span * TUNNEL[1];
  const shell = toon(0x2c2f3a, { side: THREE.DoubleSide });
  for (const side of [-1, 1]) {
    const pos = [];
    const index = [];
    let rows = 0;
    for (let s = from; s <= to; s += 6) {
      const i = track.wrap(Math.round(s / track.spacing));
      const p = track.point(i, side * (hw(i) + 0.6));
      pos.push(p.x, level(s), p.z, p.x, level(s) + TUNNEL_ROOF, p.z);
      rows++;
    }
    for (let r = 0; r < rows - 1; r++) index.push(r * 2, r * 2 + 2, r * 2 + 1, r * 2 + 1, r * 2 + 2, r * 2 + 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(index);
    g.computeVertexNormals();
    group.add(new THREE.Mesh(g, shell));
  }
  group.add(new THREE.Mesh(ribbon(track, from, to, 6, [(i) => -(hw(i) + 0.6), (i) => hw(i) + 0.6], (s) => level(s) + TUNNEL_ROOF), shell));
  for (const end of [from, to]) {
    const i = track.wrap(Math.round(end / track.spacing));
    const c = track.point(i, 0);
    batch.add('kerb', BOX, mat(c.x, level(end) + TUNNEL_ROOF + 2.6, c.z, hw(i) * 2 + 14, 5.4, 2.4, 0, track.heading(i) + Math.PI / 2, 0));
    glow.add('neonCyan', BOX, mat(c.x, level(end) + TUNNEL_ROOF + 0.3, c.z, hw(i) * 2, 0.5, 2.6, 0, track.heading(i) + Math.PI / 2, 0));
  }
  for (let s = from + 4, k = 0; s < to; s += 9, k++) {
    const i = track.wrap(Math.round(s / track.spacing));
    for (const lat of [-11, 11]) {
      const p = track.point(i, lat);
      glow.add(k % 2 ? 'lampWarm' : 'neonOrange', BOX, mat(p.x, level(s) + TUNNEL_ROOF - 0.3, p.z, 1.4, 0.2, 5, 0, track.heading(i), 0));
    }
    if (k % 3 === 0) {
      const p = track.point(i, 0);
      lights.pool(p.x, level(s) + 0.1, p.z, 18, warm, 0.45);
    }
  }
  await tick();

  const deckFrom = launch + span - 134;
  for (const side of [-1, 1]) {
    for (let s = deckFrom; s < launch + span - 2; s += 11) {
      const i = track.wrap(Math.round(s / track.spacing));
      const p = track.point(i, side * (hw(i) + 1));
      const j = track.wrap(Math.round((s + 11) / track.spacing));
      const q = track.point(j, side * (hw(j) + 1));
      const y = level(s);
      const next = level(s + 11);
      const run = Math.hypot(q.x - p.x, q.z - p.z);
      const pitch = -Math.atan2(next - y, run);
      batch.add('bridgeSteel', BOX, mat((p.x + q.x) / 2, (y + next) / 2 + 3.4, (p.z + q.z) / 2, 0.5, 0.5, run, pitch, track.heading(i), 0));
      batch.add('bridgeSteel', BOX, mat(p.x, y + 1.7, p.z, 0.4, 3.4, 0.4));
      batch.add('hazardBar', BOX, mat((p.x + q.x) / 2, (y + next) / 2 + 0.4, (p.z + q.z) / 2, 0.6, 0.8, run * 0.5, pitch, track.heading(i), 0));
    }
    const i = track.wrap(Math.round(deckFrom / track.spacing));
    const p = track.point(i, side * (hw(i) + 6));
    batch.add('bridgeSteel', BOX, mat(p.x, level(deckFrom) + 16, p.z, 7, 32, 7));
    batch.add('kerb', BOX, mat(p.x, level(deckFrom) + 33, p.z, 9, 2, 9));
    glow.add('brakeGlow', BALL, mat(p.x, level(deckFrom) + 34.6, p.z, 0.7, 0.7, 0.7));
  }
  return { soft };
}

function outOfWater(track, c) {
  const near = track.project(c.x, c.z);
  return near.distance > track.hw[near.idx] + 40;
}
