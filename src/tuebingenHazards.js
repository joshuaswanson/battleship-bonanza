import * as THREE from 'three';
import { Batcher } from './world.js';
import { waveHeight } from './water.js';
import { TOWN_COLORS, PUNT_LENGTH, PUNT_WIDTH, punt } from './tuebingenDetail.js';

const SPEED = 3.2;
const TOP = 2.8;
const REACH = 2.2;
const SHOVE = 0.22;
const SPRING = 0.5;
const DAMP = 1.1;
const DRIFT = 9;
const COOLDOWN = 0.6;

export class Punts {
  constructor({ group, lanes, rand, shores }) {
    this.group = new THREE.Group();
    group.add(this.group);
    this.clock = null;
    this.frozen = false;
    this.obstacles = [];
    this.punts = lanes.map((lane, k) => {
      const mesh = new THREE.Group();
      const hull = new Batcher();
      punt(hull, 0, 0, 0, 0, rand);
      hull.build(mesh, 0.05, TOWN_COLORS);
      this.group.add(mesh);
      const shore = { x: 0, z: -9999, rx: PUNT_WIDTH / 2 + 0.1, rz: PUNT_LENGTH / 2, rot: 0, top: TOP };
      shores.push(shore);
      const curve = new THREE.CatmullRomCurve3(lane.points.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, 'centripetal');
      return { curve, length: curve.getLength(), phase: lane.phase ?? k / lanes.length, mesh, shore, ox: 0, oz: 0, vx: 0, vz: 0, spin: 0, turn: 0, roll: 0, x: 0, z: 0, yaw: 0, hits: new Map() };
    });
  }

  pose(p, time) {
    const u = (((time * SPEED) / p.length + p.phase) % 1 + 1) % 1;
    const at = p.curve.getPointAt(u);
    const dir = p.curve.getTangentAt(u);
    p.x = at.x + p.ox;
    p.z = at.z + p.oz;
    p.yaw = Math.atan2(dir.x, dir.z) + p.spin;
    Object.assign(p.shore, { x: p.x, z: p.z, rot: p.yaw });
  }

  reset() {
    for (const p of this.punts) Object.assign(p, { ox: 0, oz: 0, vx: 0, vz: 0, spin: 0, turn: 0, roll: 0 }).hits.clear();
  }

  play(race, dt) {
    this.clock = race.time;
    this.frozen = false;
    for (const p of this.punts) {
      p.vx += (-SPRING * p.ox - DAMP * p.vx) * dt;
      p.vz += (-SPRING * p.oz - DAMP * p.vz) * dt;
      p.ox += p.vx * dt;
      p.oz += p.vz * dt;
      const drift = Math.hypot(p.ox, p.oz);
      if (drift > DRIFT) {
        p.ox *= DRIFT / drift;
        p.oz *= DRIFT / drift;
      }
      p.turn += (-SPRING * 2 * p.spin - DAMP * p.turn) * dt;
      p.spin += p.turn * dt;
      this.pose(p, race.time);
      const c = Math.cos(p.yaw);
      const s = Math.sin(p.yaw);
      for (const b of race.boats) {
        if (!b.alive || b.yOffset > 1 || race.time < (p.hits.get(b) ?? 0)) continue;
        const dx = b.pos.x - p.x;
        const dz = b.pos.z - p.z;
        const lx = dx * c - dz * s;
        const lz = dx * s + dz * c;
        if (Math.hypot(lx / (p.shore.rx + REACH), lz / (p.shore.rz + REACH)) > 1) continue;
        const speed = Math.abs(b.speed);
        if (speed < 4) continue;
        p.hits.set(b, race.time + COOLDOWN);
        const fx = Math.sin(b.heading);
        const fz = Math.cos(b.heading);
        p.vx += fx * speed * SHOVE;
        p.vz += fz * speed * SHOVE;
        p.turn += Math.sign(lx || 1) * Math.sign(lz || 1) * speed * 0.012;
        p.roll = Math.min(0.35, speed * 0.012) * Math.sign(lx || 1);
        race.fx.splash(b.pos.x - dx * 0.5, 0.2, b.pos.z - dz * 0.5, 0.5);
      }
    }
  }

  animate(worldTime, dt) {
    const time = this.clock ?? worldTime;
    for (const p of this.punts) {
      if (this.clock === null) this.pose(p, time);
      p.roll *= Math.exp(-2.5 * dt);
      const y = waveHeight(p.x, p.z, time) + 0.04;
      p.mesh.position.set(p.x, y, p.z);
      p.mesh.rotation.set(Math.sin(time * 1.3 + p.phase * 9) * 0.02, p.yaw, p.roll * Math.cos(time * 7) + Math.sin(time * 1.7 + p.phase * 5) * 0.02, 'YXZ');
    }
  }

  snapshot() {
    const out = new Float32Array(this.punts.length * 4);
    let o = 0;
    for (const p of this.punts) {
      out[o++] = p.ox;
      out[o++] = p.oz;
      out[o++] = p.spin;
      out[o++] = p.roll;
    }
    return out;
  }

  restore(data, clock) {
    let o = 0;
    for (const p of this.punts) {
      p.ox = data[o++];
      p.oz = data[o++];
      p.spin = data[o++];
      p.roll = data[o++];
      this.pose(p, clock);
    }
    this.clock = clock;
    this.frozen = true;
  }
}
