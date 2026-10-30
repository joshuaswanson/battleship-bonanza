import * as THREE from 'three';
import { waveHeight } from './water.js';

const CELL = 6;
const CLEARANCE = 5;
const SIGHT = 14;

export class ArenaMode {
  constructor({ scene, track }) {
    this.track = track;
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.arena = track.map.arena;
    this.bases = this.arena.bases.map(([x, z], team) => ({ team, x, z, heading: Math.atan2(-x, -z) }));
    this.cols = Math.ceil((this.arena.rx * 2) / CELL) + 1;
    this.rows = Math.ceil((this.arena.rz * 2) / CELL) + 1;
    this.queue = new Int32Array(this.cols * this.rows);
  }

  spawnSpot(b) {
    const base = this.bases[b.team];
    const along = -(14 + (b.slot % 2) * 12);
    const lateral = ((b.slot % 3) - 1) * 12;
    const fx = Math.sin(base.heading);
    const fz = Math.cos(base.heading);
    return { x: base.x + fx * along + fz * lateral, z: base.z + fz * along - fx * lateral, heading: base.heading };
  }

  place(b, start) {
    const spot = this.spawnSpot(b);
    b.pos.set(spot.x, 0, spot.z);
    b.heading = spot.heading;
    b.dist = 0;
    if (start) b.waterY = waveHeight(spot.x, spot.z, 0);
  }

  confine(race, b) {
    const { rx, rz } = this.arena;
    const q = Math.hypot(b.pos.x / rx, b.pos.z / rz);
    if (q <= 1) return;
    b.pos.x /= q;
    b.pos.z /= q;
    const nx = b.pos.x / (rx * rx);
    const nz = b.pos.z / (rz * rz);
    const len = Math.hypot(nx, nz);
    const ux = nx / len;
    const uz = nz / len;
    const vn = b.vel.x * ux + b.vel.z * uz;
    if (vn <= 0) return;
    b.vel.x -= ux * vn * 1.5;
    b.vel.z -= uz * vn * 1.5;
    if (vn > 9) {
      b.speed *= 0.85;
      b.bump(3);
      race.fx.splash(b.pos.x, b.waterY, b.pos.z, 0.6);
      race.sfx.play('boing', b.pos);
    }
  }

  buildGrid(shores) {
    const { rx, rz } = this.arena;
    const blocked = new Uint8Array(this.cols * this.rows);
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const x = c * CELL - rx;
        const z = r * CELL - rz;
        const outside = Math.hypot(x / (rx - CLEARANCE), z / (rz - CLEARANCE)) > 1;
        blocked[r * this.cols + c] = outside || shores.some((blob) => {
          const dx = x - blob.x;
          const dz = z - blob.z;
          const cs = Math.cos(blob.rot);
          const sn = Math.sin(blob.rot);
          return Math.hypot((dx * cs - dz * sn) / (blob.rx + CLEARANCE), (dx * sn + dz * cs) / (blob.rz + CLEARANCE)) < 1;
        }) ? 1 : 0;
      }
    }
    return blocked;
  }

  cellOf(x, z) {
    const c = Math.max(0, Math.min(this.cols - 1, Math.round((x + this.arena.rx) / CELL)));
    const r = Math.max(0, Math.min(this.rows - 1, Math.round((z + this.arena.rz) / CELL)));
    return r * this.cols + c;
  }

  fillDistances(goal, distances) {
    const { queue, blocked, cols, rows } = this;
    distances.fill(-1);
    let head = 0;
    let tail = 0;
    queue[tail++] = goal;
    distances[goal] = 0;
    while (head < tail) {
      const i = queue[head++];
      const c = i % cols;
      const r = (i - c) / cols;
      const d = distances[i] + 1;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nc = c + dc;
          const nr = r + dr;
          if ((!dr && !dc) || nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
          const j = nr * cols + nc;
          if (distances[j] >= 0 || blocked[j]) continue;
          distances[j] = d;
          queue[tail++] = j;
        }
      }
    }
  }

  clearLine(a, b) {
    const ac = a % this.cols;
    const ar = (a - ac) / this.cols;
    const bc = b % this.cols;
    const br = (b - bc) / this.cols;
    const steps = Math.max(Math.abs(bc - ac), Math.abs(br - ar));
    for (let k = 1; k < steps; k++) {
      const c = Math.round(ac + ((bc - ac) * k) / steps);
      const r = Math.round(ar + ((br - ar) * k) / steps);
      if (this.blocked[r * this.cols + c]) return false;
    }
    return true;
  }

  navigate(race, b) {
    const ai = b.ai;
    ai.distances ??= new Int32Array(this.cols * this.rows);
    if (!(race.time < ai.navAt)) {
      ai.navAt = race.time + 0.2;
      const goal = this.goal(race, b);
      ai.goal = { x: goal.x, z: goal.z };
      this.fillDistances(this.cellOf(goal.x, goal.z), ai.distances);
    }
    const { distances } = ai;
    const { cols, rows } = this;
    const start = this.cellOf(b.pos.x, b.pos.z);
    if (this.clearLine(start, this.cellOf(ai.goal.x, ai.goal.z))) return ai.goal;
    let i = start;
    let seen = start;
    for (let k = 0; k < SIGHT; k++) {
      const c = i % cols;
      const r = (i - c) / cols;
      let best = i;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nc = c + dc;
          const nr = r + dr;
          if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
          const j = nr * cols + nc;
          if (distances[j] >= 0 && (distances[best] < 0 || distances[j] < distances[best])) best = j;
        }
      }
      if (best === i || distances[best] < 0) break;
      i = best;
      if (this.clearLine(start, i)) seen = i;
      if (distances[i] === 0) break;
    }
    if (seen === start) return ai.goal;
    const c = seen % cols;
    return { x: c * CELL - this.arena.rx, z: ((seen - c) / cols) * CELL - this.arena.rz };
  }

  dispose() {
    this.scene.remove(this.group);
  }
}
