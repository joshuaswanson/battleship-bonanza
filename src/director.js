import * as THREE from 'three';
import { waveHeight } from './water.js';
import { BASE_SPEED, COUNTDOWN } from './race.js';

const RIVER_SHOTS = ['chase', 'lead', 'bank', 'chase', 'lead'];
const CANAL_SHOTS = ['chase', 'lead', 'bank', 'high', 'chase', 'lead'];
const lerpAngle = (a, b, k) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export class Director {
  constructor(camera) {
    this.camera = camera;
    this.pos = new THREE.Vector3(0, 30, -40);
    this.look = new THREE.Vector3();
    this.heading = 0;
    this.snap = true;
    this.focus = 0;
    this.focusTime = 0;
    this.orbit = 0;
    this.shake = 0;
  }

  bump(amount) {
    this.shake = Math.max(this.shake, amount);
  }

  lift(dy) {
    this.pos.y += dy;
    this.look.y += dy;
  }

  update(dt, race, replaying) {
    const watched = race.player && !race.attract && !replaying ? race.player : race.boats[this.focus];
    if (watched) {
      if (this.watchedAt && watched.pos.distanceToSquared(this.watchedAt) > 3600) this.snap = true;
      (this.watchedAt ??= new THREE.Vector3()).copy(watched.pos);
    }
    const k = (rate) => (this.snap ? 1 : 1 - Math.exp(-rate * dt));
    let fov = 66;

    if (replaying && race.track.river) {
      const b = race.boats[this.focus];
      if (b && this.lastY !== undefined && Math.abs(b.waterY - this.lastY) > 30) {
        const dy = b.waterY - this.lastY;
        this.pos.y += dy;
        this.look.y += dy;
        if (this.anchor) this.anchor.y += dy;
      }
      this.riverShot(race, dt, k);
      this.lastY = race.boats[this.focus].waterY;
    } else if (replaying && race.track.banked) {
      this.canalShot(race, dt, k);
    } else if (race.attract || !race.player || replaying) {
      this.focusTime -= dt;
      if (this.focusTime <= 0) {
        const pickPlayer = replaying && Math.random() < 0.6;
        this.focus = pickPlayer ? race.boats.indexOf(race.player) : Math.floor(Math.random() * race.boats.length);
        this.focusTime = 7;
        this.orbit = Math.random() * Math.PI * 2;
        this.snap = true;
      }
      const b = race.boats[this.focus];
      if (this.lastY !== undefined && Math.abs(b.waterY - this.lastY) > 30) {
        this.pos.y += b.waterY - this.lastY;
        this.look.y += b.waterY - this.lastY;
      }
      this.lastY = b.waterY;
      this.orbit += dt * 0.18;
      const desired = new THREE.Vector3(b.pos.x + Math.cos(this.orbit) * 34, b.waterY + 12, b.pos.z + Math.sin(this.orbit) * 30);
      this.pos.lerp(desired, k(3));
      this.look.lerp(new THREE.Vector3(b.pos.x, b.pos.y + 1, b.pos.z), k(6));
    } else {
      const b = race.player;
      this.heading = this.snap ? b.heading : lerpAngle(this.heading, b.heading, k(4.5));
      const fx = Math.sin(this.heading);
      const fz = Math.cos(this.heading);
      const speedFrac = Math.max(0, Math.min(1.4, b.speed / BASE_SPEED));
      const back = 11 + speedFrac * 2;
      const chase = new THREE.Vector3(b.pos.x - fx * back, b.waterY + 6 + Math.max(0, b.yOffset) * (b.air?.fall ? 0.95 : 0.6), b.pos.z - fz * back);
      let desired = chase;
      if (race.state === 'countdown') {
        const u = Math.min(1, Math.max(0, (COUNTDOWN - race.countdown) / (COUNTDOWN - 1)));
        const e = u * u * (3 - 2 * u);
        const a = 0.25 * Math.PI + e * 0.75 * Math.PI;
        const radius = 15 + e * (back - 15);
        desired = new THREE.Vector3(
          b.pos.x + (fx * Math.cos(a) + fz * Math.sin(a)) * radius,
          b.waterY + 4 + e * 3,
          b.pos.z + (fz * Math.cos(a) - fx * Math.sin(a)) * radius,
        );
      }
      this.pos.lerp(desired, k(race.state === 'countdown' ? 20 : 12));
      this.look.lerp(new THREE.Vector3(b.pos.x + fx * 9, b.pos.y + 2, b.pos.z + fz * 9), k(10));
      fov = 60 + speedFrac * 10;
    }
    this.snap = false;

    this.camera.position.copy(this.pos);
    if (this.shake > 0) {
      this.camera.position.x += (Math.random() - 0.5) * this.shake;
      this.camera.position.y += (Math.random() - 0.5) * this.shake;
      this.shake = Math.max(0, this.shake - dt * 4);
    }
    this.camera.lookAt(this.look);
    if (Math.abs(this.camera.fov - fov) > 0.05) {
      this.camera.fov += (fov - this.camera.fov) * (1 - Math.exp(-3 * dt));
      this.camera.updateProjectionMatrix();
    }
  }

  riverShot(race, dt, k) {
    const t = race.track;
    this.focusTime -= dt;
    const b = race.boats[this.focus] ?? race.player;
    const hit = t.project(b.pos.x, b.pos.z, this.focusTime > 0 ? this.idx ?? -1 : -1);
    this.idx = hit.idx;
    const big = t.river.drops.find((d) => d.height > 8);
    const toFalls = t.ahead(hit.s, big.s);
    if (this.focusTime <= 0 || (this.shot !== 'falls' && toFalls < 45 && toFalls > 25)) {
      this.focus = Math.random() < 0.6 ? race.boats.indexOf(race.player) : Math.floor(Math.random() * race.boats.length);
      const focus = race.boats[this.focus];
      const at = t.project(focus.pos.x, focus.pos.z);
      this.idx = at.idx;
      const nearFalls = t.ahead(at.s, big.s) < 45;
      this.shot = nearFalls ? 'falls' : RIVER_SHOTS[Math.floor(Math.random() * RIVER_SHOTS.length)];
      this.focusTime = nearFalls ? 3.5 : 5 + Math.random() * 3;
      this.side = Math.random() < 0.5 ? -1 : 1;
      this.anchor = null;
      this.snap = true;
    }
    const f = race.boats[this.focus];
    const level = f.waterY;
    const hw = t.halfWidth;
    let desired;
    const nearExit = t.ahead(hit.s, t.river.tunnelOut) < 40 || t.ahead(t.river.tunnelOut, hit.s) < 15;
    if (this.shot === 'chase' && nearExit) this.shot = 'lead';
    if (this.shot === 'chase' || this.shot === 'lead') {
      const ahead = this.shot === 'chase' ? -14 : 16;
      const at = t.step(this.idx, ahead / t.spacing);
      const p = t.point(at, clamp(t.project(f.pos.x, f.pos.z, this.idx).lateral * 0.6 + this.side * 4, -hw + 4, hw - 4));
      desired = new THREE.Vector3(p.x, level + (this.shot === 'chase' ? 6 : 5), p.z);
    } else if (this.shot === 'bank') {
      if (!this.anchor) {
        const p = t.point(t.step(this.idx, 45 / t.spacing), this.side * (hw - 3));
        this.anchor = new THREE.Vector3(p.x, waveHeight(p.x, p.z, 0) + 3, p.z);
      }
      desired = this.anchor.clone();
    } else {
      if (!this.anchor) {
        const p = t.point(Math.round(big.s / t.spacing) + Math.round(34 / t.spacing), this.side * 8);
        this.anchor = new THREE.Vector3(p.x, waveHeight(p.x, p.z, 0) + 5, p.z);
      }
      desired = this.anchor.clone();
    }
    this.pos.lerp(desired, k(this.shot === 'chase' || this.shot === 'lead' ? 6 : 20));
    this.look.lerp(new THREE.Vector3(f.pos.x, f.pos.y + 1, f.pos.z), k(8));
  }

  canalShot(race, dt, k) {
    const t = race.track;
    this.focusTime -= dt;
    const b = race.boats[this.focus] ?? race.player;
    const hit = t.project(b.pos.x, b.pos.z, this.focusTime > 0 ? this.idx ?? -1 : -1);
    this.idx = hit.idx;
    if (this.focusTime <= 0) {
      this.focus = Math.random() < 0.6 ? race.boats.indexOf(race.player) : Math.floor(Math.random() * race.boats.length);
      const focus = race.boats[this.focus];
      this.idx = t.project(focus.pos.x, focus.pos.z).idx;
      this.shot = CANAL_SHOTS[Math.floor(Math.random() * CANAL_SHOTS.length)];
      this.focusTime = 4 + Math.random() * 3;
      this.side = Math.random() < 0.5 ? -1 : 1;
      this.anchor = null;
      this.snap = true;
    }
    const f = race.boats[this.focus];
    const level = f.waterY;
    const room = (idx) => Math.max(2, t.widthAt(idx) - 4);
    let desired;
    if (this.shot === 'chase' || this.shot === 'lead' || this.shot === 'high') {
      const ahead = this.shot === 'lead' ? 14 : this.shot === 'high' ? -18 : -12;
      const idx = t.step(this.idx, ahead / t.spacing);
      const lateral = t.project(f.pos.x, f.pos.z, this.idx).lateral * 0.7 + this.side * 2.5;
      const p = t.point(idx, clamp(lateral, -room(idx), room(idx)));
      desired = new THREE.Vector3(p.x, level + (this.shot === 'high' ? 15 : this.shot === 'chase' ? 5.5 : 4.5), p.z);
    } else {
      if (!this.anchor) {
        const idx = t.step(this.idx, 36 / t.spacing);
        const p = t.point(idx, this.side * room(idx));
        this.anchor = new THREE.Vector3(p.x, waveHeight(p.x, p.z, 0) + 2.5, p.z);
      }
      desired = this.anchor.clone();
      if (t.ahead(hit.s, t.project(desired.x, desired.z).s) > t.length / 2) this.focusTime = Math.min(this.focusTime, 0.6);
    }
    for (const o of race.boats) {
      const gap = Math.hypot(o.pos.x - desired.x, o.pos.z - desired.z);
      if (gap < 7) desired.y = Math.max(desired.y, o.pos.y + 4 + (7 - gap) * 0.9);
    }
    this.pos.lerp(desired, k(this.shot === 'bank' ? 20 : 6));
    this.look.lerp(new THREE.Vector3(f.pos.x, f.pos.y + 1, f.pos.z), k(8));
  }
}
