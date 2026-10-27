import * as THREE from 'three';
import { HULL_L, HULL_W, halfWidth, sheer } from './boatModel.js';
import { waveHeight } from './water.js';

const COLS = 18;
const ROWS = 14;
const GROW = 1.25;
const GAP = 0.08;
const BUMPER = 0.22;
const SUBSTEPS = 3;
const TICK = 1 / (60 * SUBSTEPS);
const GRAVITY = -12;
const AIR_DRAG = 0.6;
const IMPACT = 0.7;
const WRAP = 14;
const AXIS_Y = 1.5;
const AXIS_END = HULL_L * 0.35;
const ABOVE = [0.6, 2];
const FLOAT_TIME = 0.9;
const SINK_SPEED = 0.7;
const LIFETIME = 4.5;

const DEFAULT_HIT = { across: { x: 1, z: 0 }, dir: { x: 0, y: 0, z: -1 }, speed: 45, top: 3.2, offset: 0, width: 4.4, height: 2.8 };

const blockers = new WeakMap();

function partBoxes(model) {
  let boxes = blockers.get(model);
  if (boxes) return boxes;
  const { root, body } = model;
  root.updateMatrixWorld(true);
  const toBody = body.matrixWorld.clone().invert();
  boxes = [];
  body.traverseVisible((o) => {
    if (!o.isMesh || o.material.isShaderMaterial || o.userData.drape) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const box = o.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(toBody, o.matrixWorld));
    if (box.max.z - box.min.z > HULL_L * 1.4 || box.max.y < sheer(Math.max(box.min.z, 0)) + 0.1) return;
    boxes.push(box.expandByScalar(GAP));
  });
  blockers.set(model, boxes);
  return boxes;
}

function grid() {
  const geometry = new THREE.BufferGeometry();
  const index = [];
  const uv = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      uv.push((c / (COLS - 1)) * 3, (r / (ROWS - 1)) * 2.2);
      if (r < ROWS - 1 && c < COLS - 1) {
        const i = r * COLS + c;
        index.push(i, i + COLS, i + 1, i + 1, i + COLS, i + COLS + 1);
      }
    }
  }
  geometry.setIndex(index);
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(COLS * ROWS * 3), 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return geometry;
}

function links(dx, dy) {
  const out = [];
  const at = (r, c) => r * COLS + c;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (c < COLS - 1) out.push([at(r, c), at(r, c + 1), dx, 1]);
      if (r < ROWS - 1) out.push([at(r, c), at(r + 1, c), dy, 1]);
      if (r < ROWS - 1 && c < COLS - 1) {
        out.push([at(r, c), at(r + 1, c + 1), Math.hypot(dx, dy), 0.6]);
        out.push([at(r, c + 1), at(r + 1, c), Math.hypot(dx, dy), 0.6]);
      }
      if (c < COLS - 2) out.push([at(r, c), at(r, c + 2), dx * 2, 0.25]);
      if (r < ROWS - 2) out.push([at(r, c), at(r + 2, c), dy * 2, 0.25]);
    }
  }
  return out;
}

export class Drape {
  constructor(model, material, hit = DEFAULT_HIT) {
    this.model = model;
    this.boxes = partBoxes(model);
    this.count = COLS * ROWS;
    this.p = new Float32Array(this.count * 3);
    this.q = new Float32Array(this.count * 3);
    this.touch = new Uint8Array(this.count);
    this.landed = 0;
    this.age = 0;
    this.flying = false;
    const crest = Math.max(sheer(HULL_L) + 0.3, ...this.boxes.filter((b) => b.max.z > 0).map((b) => b.max.y));
    const top = Math.max(crest + ABOVE[0], Math.min(crest + ABOVE[1], hit.top));
    const width = hit.width * GROW;
    const height = hit.height * GROW;
    this.links = links(width / (COLS - 1), height / (ROWS - 1));
    const flat = Math.hypot(hit.dir.x, hit.dir.z) || 1;
    const fx = hit.dir.x / flat;
    const fz = hit.dir.z / flat;
    const reach = 1 / Math.hypot(fx / (HULL_W + 1), fz / (HULL_L + 0.6)) + 0.4;
    const cx = -fx * reach + hit.across.x * hit.offset;
    const cz = -fz * reach + hit.across.z * hit.offset;
    const v = hit.speed * IMPACT * TICK;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const i = (r * COLS + c) * 3;
        const along = (c / (COLS - 1) - 0.5) * width;
        this.p[i] = cx + hit.across.x * along;
        this.p[i + 1] = top - (r / (ROWS - 1)) * height;
        this.p[i + 2] = cz + hit.across.z * along;
        this.q[i] = this.p[i] - hit.dir.x * v;
        this.q[i + 1] = this.p[i + 1] - hit.dir.y * v;
        this.q[i + 2] = this.p[i + 2] - hit.dir.z * v;
      }
    }
    this.mesh = new THREE.Mesh(grid(), material);
    this.mesh.userData.drape = true;
    this.mesh.frustumCulled = false;
    this.write();
    model.body.add(this.mesh);
  }

  step(dt, air, onBoat) {
    const { p, q, touch } = this;
    const pull = [0, 0, 0];
    for (let i = 0; i < p.length; i += 3) {
      if (onBoat) {
        const z = Math.max(-HULL_L, Math.min(AXIS_END, p[i + 2]));
        const dx = -p[i];
        const dy = AXIS_Y - p[i + 1];
        const dz = z - p[i + 2];
        const d = Math.hypot(dx, dy, dz) || 1;
        pull[0] = (dx / d) * WRAP;
        pull[1] = (dy / d) * WRAP;
        pull[2] = (dz / d) * WRAP;
      }
      for (let a = 0; a < 3; a++) {
        const v = p[i + a] - q[i + a];
        const drag = AIR_DRAG * (air[a] - v / dt);
        q[i + a] = p[i + a];
        p[i + a] += v * 0.99 + (drag + pull[a] + (a === 1 ? GRAVITY : 0)) * dt * dt;
      }
    }
    for (let pass = 0; pass < 4; pass++) {
      for (const [a, b, rest, stiff] of this.links) {
        const ia = a * 3;
        const ib = b * 3;
        const dx = p[ib] - p[ia];
        const dy = p[ib + 1] - p[ia + 1];
        const dz = p[ib + 2] - p[ia + 2];
        const len = Math.hypot(dx, dy, dz) || 1e-6;
        const k = ((len - rest) / len) * 0.5 * stiff;
        p[ia] += dx * k;
        p[ia + 1] += dy * k;
        p[ia + 2] += dz * k;
        p[ib] -= dx * k;
        p[ib + 1] -= dy * k;
        p[ib + 2] -= dz * k;
      }
      if (onBoat) for (let n = 0; n < this.count; n++) touch[n] = this.collide(n * 3) || (pass > 0 && touch[n]);
    }
    if (!onBoat) return;
    for (let n = 0; n < this.count; n++) {
      if (!touch[n]) continue;
      const i = n * 3;
      for (let a = 0; a < 3; a++) q[i + a] = p[i + a] - (p[i + a] - q[i + a]) * 0.1;
    }
  }

  collide(i) {
    const { p, q } = this;
    const x = p[i];
    const y = p[i + 1];
    const z = p[i + 2];
    let hit = false;
    if (z > -HULL_L && z < HULL_L) {
      const side = Math.sign(x || 1);
      const hw = halfWidth(z);
      const deck = sheer(z) + GAP;
      if (Math.abs(x) < hw && y < deck && y > -1) {
        if (deck - y < hw - Math.abs(x)) p[i + 1] = deck;
        else p[i] = side * hw;
        hit = true;
      }
      const ox = Math.abs(p[i]) - (hw + 0.02);
      const oy = p[i + 1] - (sheer(z) + 0.04);
      const d = Math.hypot(ox, oy);
      const reach = BUMPER + GAP;
      if (d < reach) {
        const k = d > 1e-4 ? reach / d : 0;
        p[i] = side * (hw + 0.02 + (k ? ox * k : reach));
        p[i + 1] = sheer(z) + 0.04 + oy * k;
        hit = true;
      }
    }
    for (const box of this.boxes) {
      if (x < box.min.x || x > box.max.x || y < box.min.y || y > box.max.y || z < box.min.z || z > box.max.z) continue;
      const pushes = [box.max.y - y, x - box.min.x, box.max.x - x, z - box.min.z, box.max.z - z];
      const least = pushes.indexOf(Math.min(...pushes));
      if (least === 0) p[i + 1] = box.max.y;
      else if (least === 1) p[i] = box.min.x;
      else if (least === 2) p[i] = box.max.x;
      else if (least === 3) p[i + 2] = box.min.z;
      else p[i + 2] = box.max.z;
      hit = true;
    }
    if (p[i + 1] < -0.2) p[i + 1] = -0.2;
    q[i] += p[i] - x;
    q[i + 1] += p[i + 1] - y;
    q[i + 2] += p[i + 2] - z;
    return hit;
  }

  flutter(dt, air, time) {
    const h = Math.min(dt, 1 / 30) / SUBSTEPS;
    const gust = Math.sin(time * 9) * 0.5 + Math.sin(time * 15.7) * 0.3;
    const wind = [air.x + gust * 4, gust * 3, air.z];
    for (let k = 0; k < SUBSTEPS; k++) this.step(h, wind, true);
    this.write();
  }

  release(group, velocity) {
    const { body } = this.model;
    body.updateMatrixWorld(true);
    const v = new THREE.Vector3();
    const spin = (Math.random() - 0.5) * 8;
    const fling = new THREE.Vector3(velocity.x * 0.55 + (Math.random() - 0.5) * 6, 6 + Math.random() * 3, velocity.z * 0.55 + (Math.random() - 0.5) * 6);
    for (let i = 0; i < this.p.length; i += 3) {
      v.set(this.p[i], this.p[i + 1], this.p[i + 2]).applyMatrix4(body.matrixWorld);
      const twist = spin * ((this.p[i] + this.p[i + 2]) / 6);
      this.p.set([v.x, v.y, v.z], i);
      this.q.set([v.x - fling.x * TICK, v.y - (fling.y + twist) * TICK, v.z - fling.z * TICK], i);
    }
    this.mesh.removeFromParent();
    group.add(this.mesh);
    this.flying = true;
    this.write();
  }

  fly(dt, time) {
    this.age += dt;
    if (this.landed) this.landed += dt;
    const h = Math.min(dt, 1 / 30) / SUBSTEPS;
    const still = [0, 0, 0];
    const sink = Math.max(0, this.landed - FLOAT_TIME) * SINK_SPEED;
    for (let k = 0; k < SUBSTEPS; k++) {
      this.step(h, still, false);
      const { p, q } = this;
      for (let i = 0; i < p.length; i += 3) {
        const surface = waveHeight(p[i], p[i + 2], time) - sink;
        if (p[i + 1] > surface) continue;
        p[i + 1] = surface;
        q[i] = p[i] - (p[i] - q[i]) * 0.6;
        q[i + 1] = p[i + 1];
        q[i + 2] = p[i + 2] - (p[i + 2] - q[i + 2]) * 0.6;
        if (!this.landed) this.landed = 1e-3;
      }
    }
    this.write();
    return this.age < LIFETIME && sink < 2.5;
  }

  write() {
    const attr = this.mesh.geometry.attributes.position;
    attr.array.set(this.p);
    attr.needsUpdate = true;
    this.mesh.geometry.computeVertexNormals();
    this.mesh.geometry.computeBoundingSphere();
  }

  dispose() {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
  }
}
