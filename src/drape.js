import * as THREE from 'three';
import { HULL_L, HULL_W, halfWidth, sheer } from './boatModel.js';

const COLS = 14;
const ROWS = 16;
const WIDTH = 2 * (HULL_W + 1.6);
const LENGTH = 6.4;
const CENTER_Z = HULL_L * 0.42;
const GAP = 0.08;
const BUMPER = 0.22;
const SETTLE_STEPS = 140;
const STEP = 1 / 60;
const FLY_TIME = 1.8;

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
      uv.push((c / (COLS - 1)) * 3, (r / (ROWS - 1)) * 3.4);
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

function links() {
  const out = [];
  const at = (r, c) => r * COLS + c;
  const dx = WIDTH / (COLS - 1);
  const dz = LENGTH / (ROWS - 1);
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (c < COLS - 1) out.push([at(r, c), at(r, c + 1), dx, 1]);
      if (r < ROWS - 1) out.push([at(r, c), at(r + 1, c), dz, 1]);
      if (r < ROWS - 1 && c < COLS - 1) {
        out.push([at(r, c), at(r + 1, c + 1), Math.hypot(dx, dz), 0.6]);
        out.push([at(r, c + 1), at(r + 1, c), Math.hypot(dx, dz), 0.6]);
      }
      if (c < COLS - 2) out.push([at(r, c), at(r, c + 2), dx * 2, 0.25]);
      if (r < ROWS - 2) out.push([at(r, c), at(r + 2, c), dz * 2, 0.25]);
    }
  }
  return out;
}

const LINKS = links();

export class Drape {
  constructor(model, material) {
    this.model = model;
    this.boxes = partBoxes(model);
    this.count = COLS * ROWS;
    this.p = new Float32Array(this.count * 3);
    this.q = new Float32Array(this.count * 3);
    this.touch = new Uint8Array(this.count);
    const top = Math.max(sheer(HULL_L) + 0.6, ...this.boxes.map((b) => b.max.y)) + 0.5;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const i = (r * COLS + c) * 3;
        this.p[i] = (c / (COLS - 1) - 0.5) * WIDTH;
        this.p[i + 1] = top;
        this.p[i + 2] = CENTER_Z + (0.5 - r / (ROWS - 1)) * LENGTH;
      }
    }
    this.q.set(this.p);
    this.mesh = new THREE.Mesh(grid(), material);
    this.mesh.userData.drape = true;
    this.mesh.frustumCulled = false;
    this.age = 0;
    this.flying = false;
    for (let k = 0; k < SETTLE_STEPS; k++) this.step(STEP, 0, -16, 0, true);
    this.write();
    model.body.add(this.mesh);
  }

  step(dt, ax, ay, az, onBoat) {
    const { p, q, touch } = this;
    const damp = onBoat ? 0.985 : 0.995;
    for (let i = 0; i < p.length; i += 3) {
      for (let a = 0; a < 3; a++) {
        const v = (p[i + a] - q[i + a]) * damp;
        q[i + a] = p[i + a];
        p[i + a] += v + [ax, ay, az][a] * dt * dt;
      }
    }
    for (let pass = 0; pass < 4; pass++) {
      for (const [a, b, rest, stiff] of LINKS) {
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
      for (let a = 0; a < 3; a++) q[i + a] = p[i + a] - (p[i + a] - q[i + a]) * 0.15;
    }
  }

  collide(i) {
    const { p } = this;
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
    if (p[i + 1] < -0.2) {
      p[i + 1] = -0.2;
      hit = true;
    }
    return hit;
  }

  flutter(dt, speed, time) {
    const wind = Math.min(Math.abs(speed), 70);
    const gust = Math.sin(time * 9) * 0.5 + Math.sin(time * 15.7) * 0.3;
    this.step(Math.min(dt, 1 / 30), gust * wind * 0.12, -16 + Math.abs(gust) * wind * 0.1, -wind * 0.18, true);
    this.write();
  }

  release(group, velocity) {
    const { body } = this.model;
    body.updateMatrixWorld(true);
    const v = new THREE.Vector3();
    const w = new THREE.Vector3();
    const spin = (Math.random() - 0.5) * 6;
    for (let i = 0; i < this.p.length; i += 3) {
      v.set(this.p[i], this.p[i + 1], this.p[i + 2]).applyMatrix4(body.matrixWorld);
      const lift = 7 + Math.random() * 2 + spin * (this.p[i] / WIDTH);
      w.copy(velocity).multiplyScalar(0.85).setY(lift);
      this.p.set([v.x, v.y, v.z], i);
      this.q.set([v.x - w.x * STEP, v.y - w.y * STEP, v.z - w.z * STEP], i);
    }
    this.mesh.removeFromParent();
    this.mesh.material = this.mesh.material.clone();
    this.mesh.material.transparent = true;
    group.add(this.mesh);
    this.flying = true;
    this.write();
  }

  fly(dt) {
    this.age += dt;
    const drag = Math.exp(-2.4 * dt);
    for (let i = 0; i < this.p.length; i += 3) {
      for (let a = 0; a < 3; a++) this.q[i + a] = this.p[i + a] - (this.p[i + a] - this.q[i + a]) * drag;
    }
    this.step(Math.min(dt, 1 / 30), 0, -7, 0, false);
    for (let i = 1; i < this.p.length; i += 3) if (this.p[i] < 0) this.p[i] = 0;
    this.mesh.material.opacity = Math.min(1, (FLY_TIME - this.age) / 0.6);
    this.write();
    return this.age < FLY_TIME;
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
    if (this.flying) this.mesh.material.dispose();
  }
}
