import * as THREE from 'three';
import { toon } from './toon.js';
import { HULL_L, HULL_W } from './boatModel.js';

export const LINE_HEIGHT = 10;
export const LINE_POST = 1.5;
const LINE_SAG = 0.9;
const SHEET_H = 2.8;
const GAP = 6.5;
const SHEET_RESPAWN = 18;
const BLIND_TIME = 4;
const BOAT_TOP = 2.6;
const DRAPE_Y = 2.3;
const CLOTHS = [0xff7ab8, 0x5ec8f2, 0xffd23f, 0x8ce06a, 0xffffff, 0xf08a6a];

function ginghamTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.13)';
  for (let k = 0; k < 4; k++) {
    ctx.fillRect(k * 16, 0, 8, 64);
    ctx.fillRect(0, k * 16, 64, 8);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.NearestFilter;
  return texture;
}

const GINGHAM = ginghamTexture();

function fluttering(uniforms, displace) {
  const material = toon(0xffffff, { side: THREE.DoubleSide, map: GINGHAM });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n${displace}`);
  };
  material.customProgramCacheKey = () => displace;
  return material;
}

function drapeGeometry() {
  const halfW = HULL_W + 0.8;
  const halfL = HULL_L * 0.75;
  const geometry = new THREE.PlaneGeometry(halfW * 2, halfL * 2, 8, 10).rotateX(-Math.PI / 2);
  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) / halfW;
    const z = pos.getZ(i) / halfL;
    pos.setY(i, DRAPE_Y - 1.5 * x * x - 0.6 * z * z);
  }
  geometry.attributes.uv.array.forEach((v, i, uv) => (uv[i] = v * (i % 2 ? 4 : 2.5)));
  geometry.computeVertexNormals();
  return geometry;
}

export class Laundry {
  constructor({ group, track, lines, rand }) {
    this.track = track;
    this.group = new THREE.Group();
    group.add(this.group);
    this.clock = null;
    this.frozen = false;
    this.obstacles = [];
    this.boats = [];
    this.uniforms = { uTime: { value: 0 } };
    this.lines = lines.map((idx) => this.buildLine(idx, rand));
    this.sheets = this.lines.flatMap((l) => l.sheets);
    this.buildSheets();
    this.buildDrapes();
  }

  buildLine(idx, rand) {
    const t = this.track;
    const hw = t.hw[idx];
    const half = hw + LINE_POST;
    const mid = t.point(idx, 0);
    const line = { idx, x: mid.x, z: mid.z, nx: t.nx[idx], nz: t.nz[idx], heading: t.heading(idx), half, sheets: [] };
    const add = (center, width) => line.sheets.push({ line, center, width, color: Math.floor(rand() * CLOTHS.length), on: true, timer: 0, grow: 1 });
    add(0, 3.4 + rand() * 0.6);
    for (const side of [-1, 1]) {
      let edge = 2.8 + GAP * (0.85 + rand() * 0.4);
      for (;;) {
        const width = 3.6 + rand() * 2.2;
        if (edge + width > hw - 1) break;
        add(side * (edge + width / 2), width);
        edge += width + GAP * (0.85 + rand() * 0.4);
      }
    }
    const a = t.point(idx, -half);
    const b = t.point(idx, half);
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(a.x, LINE_HEIGHT, a.z), new THREE.Vector3(mid.x, LINE_HEIGHT - LINE_SAG * 2, mid.z), new THREE.Vector3(b.x, LINE_HEIGHT, b.z));
    this.group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.07, 5), toon(0xf5f5f5)));
    return line;
  }

  lineY(line, lateral) {
    const u = lateral / line.half;
    return LINE_HEIGHT - LINE_SAG * (1 - u * u);
  }

  buildSheets() {
    const geometry = new THREE.PlaneGeometry(1, SHEET_H, 6, 4).translate(0, -SHEET_H / 2, 0);
    geometry.attributes.uv.array.forEach((v, i, uv) => (uv[i] = v * (i % 2 ? 1.4 : 2)));
    const material = fluttering(this.uniforms, `transformed.z += sin(uTime * 3.2 + instanceMatrix[3].x * 0.7 + position.x * 1.1) * 0.4 * (-position.y / ${SHEET_H.toFixed(1)});`);
    this.sheetMesh = new THREE.InstancedMesh(geometry, material, this.sheets.length);
    this.sheetMesh.frustumCulled = false;
    const pegs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.5, 0.2), toon(0x8a5a33), this.sheets.length * 2);
    const color = new THREE.Color();
    const m = new THREE.Matrix4();
    this.sheets.forEach((s, k) => {
      this.sheetMesh.setColorAt(k, color.setHex(CLOTHS[s.color]));
      for (const side of [-1, 1]) {
        const lateral = s.center + side * (s.width / 2 - 0.35);
        const { line } = s;
        pegs.setMatrixAt(k * 2 + (side + 1) / 2, m.makeTranslation(line.x + line.nx * lateral, this.lineY(line, lateral) - 0.05, line.z + line.nz * lateral));
      }
    });
    this.group.add(this.sheetMesh, pegs);
  }

  buildDrapes() {
    const material = fluttering(this.uniforms, 'transformed.y += sin(uTime * 14.0 + position.z * 1.5 + instanceMatrix[3].x) * 0.22 * (0.3 + clamp(-position.z / 3.0, 0.0, 1.0));');
    this.drapeMesh = new THREE.InstancedMesh(drapeGeometry(), material, 12);
    this.drapeMesh.frustumCulled = false;
    this.drapeMesh.count = 0;
    this.drapeMesh.setColorAt(0, new THREE.Color());
    this.drapeColor = new Uint8Array(12);
    this.group.add(this.drapeMesh);
  }

  reset(race) {
    this.boats = race.boats;
    for (const s of this.sheets) Object.assign(s, { on: true, timer: 0, grow: 1 });
    for (const b of race.boats) b.blind = 0;
  }

  play(race, dt) {
    this.clock = race.time;
    this.frozen = false;
    for (const s of this.sheets) {
      if (s.on) s.grow = Math.min(1, s.grow + dt * 2);
      else if ((s.timer -= dt) <= 0) Object.assign(s, { on: true, grow: 0 });
    }
    race.boats.forEach((b, k) => {
      b.blind = b.alive ? Math.max(0, b.blind - dt) : 0;
      if (!b.alive || b.yOffset < 1 || race.time < (b.laundryHit ?? 0)) return;
      for (const line of this.lines) {
        const rx = b.pos.x - line.x;
        const rz = b.pos.z - line.z;
        if (Math.abs(rx * Math.sin(line.heading) + rz * Math.cos(line.heading)) > HULL_L) continue;
        const lateral = rx * line.nx + rz * line.nz;
        const sheet = line.sheets.find((s) => s.on && Math.abs(lateral - s.center) < s.width / 2 + HULL_W * 0.6);
        if (!sheet) continue;
        const top = this.lineY(line, sheet.center);
        if (b.yOffset > top || b.yOffset + BOAT_TOP < top - SHEET_H * sheet.grow) continue;
        this.snag(race, b, k, sheet);
        break;
      }
    });
  }

  snag(race, b, k, sheet) {
    Object.assign(sheet, { on: false, timer: SHEET_RESPAWN, grow: 0 });
    b.blind = BLIND_TIME;
    b.laundryHit = race.time + 0.5;
    b.speed *= 0.85;
    this.drapeColor[k] = sheet.color;
    const p = b.center();
    race.fx.sparkBurst(p.x, p.y + 1.5, p.z, CLOTHS[sheet.color], 14);
    race.sfx.play('pop', b.pos);
    if (b.isPlayer) race.emit('laundry');
  }

  animate(worldTime) {
    const time = this.clock ?? worldTime;
    this.uniforms.uTime.value = time;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const s = new THREE.Vector3();
    this.sheets.forEach((sheet, k) => {
      const { line } = sheet;
      const grow = sheet.on ? sheet.grow : 0;
      q.setFromAxisAngle(up, Math.atan2(-line.nz, line.nx));
      const p = new THREE.Vector3(line.x + line.nx * sheet.center, this.lineY(line, sheet.center), line.z + line.nz * sheet.center);
      this.sheetMesh.setMatrixAt(k, m.compose(p, q, s.set(sheet.width, grow, 1)));
    });
    this.sheetMesh.instanceMatrix.needsUpdate = true;
    let count = 0;
    const color = new THREE.Color();
    this.boats.forEach((b, k) => {
      if (!(b.blind > 0) || count >= this.drapeMesh.instanceMatrix.count) return;
      const size = Math.max(0, Math.min(1, (BLIND_TIME - b.blind) / 0.15, b.blind / 0.3));
      const { root, body } = b.model;
      root.updateMatrix();
      body.updateMatrix();
      this.drapeMesh.setMatrixAt(count, m.makeScale(size, size, size).premultiply(body.matrix).premultiply(root.matrix));
      this.drapeMesh.setColorAt(count++, color.setHex(CLOTHS[this.drapeColor[k]]));
    });
    this.drapeMesh.count = count;
    this.drapeMesh.instanceMatrix.needsUpdate = true;
    if (this.drapeMesh.instanceColor) this.drapeMesh.instanceColor.needsUpdate = true;
  }

  snapshot() {
    const out = new Float32Array(this.sheets.length * 2 + this.boats.length * 2);
    let o = 0;
    for (const s of this.sheets) {
      out[o++] = s.on ? 1 : 0;
      out[o++] = s.grow;
    }
    this.boats.forEach((b, k) => {
      out[o++] = b.blind;
      out[o++] = this.drapeColor[k];
    });
    return out;
  }

  restore(data, clock) {
    let o = 0;
    for (const s of this.sheets) {
      s.on = data[o++] > 0.5;
      s.grow = data[o++];
    }
    this.boats.forEach((b, k) => {
      b.blind = data[o++];
      this.drapeColor[k] = data[o++];
    });
    this.clock = clock;
    this.frozen = true;
  }
}
