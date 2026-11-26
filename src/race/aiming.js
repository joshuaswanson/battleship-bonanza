import * as THREE from 'three';
import { buildMissile, spendMissile, missileDirection, ALWAYS_AIMS } from '../boatModel.js';
import { fast } from '../tuning.js';
import { FLAME_REACH, HALF_ARC, HIT_RADIUS, WATCH_RANGE, clamp, wrapAngle } from './shared.js';

export const SEEK_RANGE = 180;
const SEEK_KEEP = 210;
const SEEK_RATE = 1.6;
const SEEK_SWEEP = 0.6;
const SEEK_SLIP = 0.6;

export const methods = {
  canSeek(b, o) {
    return o !== b && o.alive && o.invuln <= 0 && !o.has('camo') && !(o.finished && !this.attract) && !this.allied(b, o) && this.missileSide(b, o) && this.willAttack(b, o);
  },

  updateSeek(b, dt) {
    const s = b.seek;
    const slot = b.items.indexOf('missiles');
    const ready = slot >= 0 && b.alive && !b.finished && b.blind <= 0 && b.disabled <= 0 && b.charges[slot].left > 0 && (this.state === 'racing' || this.attract);
    const kept = ready && s.target && this.canSeek(b, s.target) && Math.hypot(s.target.pos.x - b.pos.x, s.target.pos.z - b.pos.z) <= SEEK_KEEP;
    const target = kept ? s.target : ready ? this.findTarget(b, { range: SEEK_RANGE, filter: (o) => this.canSeek(b, o) }) : null;
    if (target !== s.target) Object.assign(s, { target, p: 0, locked: false, knack: 0.6 + Math.random() * 0.7, shift: 0 });
    if (!target || s.locked) return;
    s.shift -= dt;
    if (s.shift <= 0) {
      s.shift = 0.08 + Math.random() * 0.22;
      s.wobble = 0.35 + Math.random() * 1.15;
    }
    const dx = target.pos.x - b.pos.x;
    const dz = target.pos.z - b.pos.z;
    const d = Math.max(1, Math.hypot(dx, dz));
    const sweep = Math.abs((target.vel.x - b.vel.x) * dz - (target.vel.z - b.vel.z) * dx) / (d * d);
    const rate = SEEK_RATE * s.knack * s.wobble * (1 - sweep / SEEK_SWEEP);
    s.p = clamp(s.p + Math.max(-SEEK_SLIP, rate) * dt, 0, 1);
    if (s.p >= 1) s.locked = true;
  },

  findTarget(b, { range, minDot = -1, maxDot = 1, filter = null, minRange = 0 }) {
    if (b.blind > 0) return null;
    let best = null;
    let bestD = range;
    const fx = Math.sin(b.heading);
    const fz = Math.cos(b.heading);
    for (const o of this.boats) {
      if (o === b || !o.alive || o.invuln > 0 || (o.finished && !this.attract) || this.allied(b, o)) continue;
      const dx = o.pos.x - b.pos.x;
      const dz = o.pos.z - b.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > range || d < minRange || d === 0) continue;
      if (d > bestD) continue;
      const dot = (dx * fx + dz * fz) / d;
      if (dot < minDot || dot > maxDot) continue;
      if (filter && !filter(o)) continue;
      best = o;
      bestD = d;
    }
    return best;
  },

  raycastBoats(origin, dir, range, ignore) {
    const p = new THREE.Vector3();
    for (let t = 0; t <= range; t += 0.75) {
      p.copy(origin).addScaledVector(dir, t);
      for (const o of this.boats) {
        if (o === ignore || !o.alive) continue;
        if (o.distanceToAxis(p) < HIT_RADIUS + 0.3) return { boat: o, t };
      }
    }
    return null;
  },

  gunArc(b, id, range) {
    if (id === 'flamethrower') range = FLAME_REACH;
    if (b.items.indexOf(id) === 1) return { range: Math.min(range, WATCH_RANGE), maxDot: 0 };
    if (ALWAYS_AIMS.has(id)) return { range, minDot: 0 };
    return { range, minDot: { laser: 0.97, saw: 0 }[id] ?? 0.88 };
  },

  inArc(b, slot, x, z, from = b.pos) {
    const dot = (x - from.x) * Math.sin(b.heading) + (z - from.z) * Math.cos(b.heading);
    return slot === 0 ? dot >= 0 : dot <= 0;
  },

  turretTarget(b, t) {
    if (b.blind > 0) return null;
    const slot = b.items.indexOf(t.id);
    const wanted = b.aim[t.id];
    const usable = (o) => o && o !== b && o.alive && !this.allied(b, o) && this.sameLayer(b, o) && this.inArc(b, slot, o.pos.x, o.pos.z) && Math.hypot(o.pos.x - b.pos.x, o.pos.z - b.pos.z) < WATCH_RANGE;
    if (usable(wanted)) return wanted;
    let best = null;
    let bestD = WATCH_RANGE;
    for (const o of this.boats) {
      if (!usable(o)) continue;
      const d = Math.hypot(o.pos.x - b.pos.x, o.pos.z - b.pos.z);
      if (d < bestD) {
        bestD = d;
        best = o;
      }
    }
    return best;
  },

  missileSide(b, o) {
    const front = b.items.indexOf('missiles') === 0;
    return front ? o.dist > b.dist : o.dist < b.dist;
  },

  willAttack(b, o) {
    if (this.mode) return !this.allied(b, o);
    const player = this.player;
    if (b.isPlayer || this.attract || !player || player.finished) return true;
    const cached = b.attackRolls.get(o);
    if (cached && cached.until > this.time) return cached.value;
    let chance;
    if (o.isPlayer) {
      const pack = this.boats.filter((x) => !x.isPlayer).map((x) => x.dist).sort((m, n) => m - n);
      const lead = player.dist - pack[pack.length >> 1];
      chance = clamp(0.55 + lead / 500, 0.08, 1);
    } else {
      chance = clamp(0.5 + (o.dist - player.dist) / 300, 0.05, 1);
    }
    const value = Math.random() < chance;
    b.attackRolls.set(o, { until: this.time + 1.2, value });
    return value;
  },

  relativeAngle(b, o) {
    const dx = o.pos.x - b.pos.x;
    const dz = o.pos.z - b.pos.z;
    return Math.atan2(dx * Math.cos(b.heading) - dz * Math.sin(b.heading), dx * Math.sin(b.heading) + dz * Math.cos(b.heading));
  },

  updateTurrets(b, dt) {
    this.updateSeek(b, dt);
    const busy = b.model.busy;
    for (const t of b.turrets) {
      busy[t.id] = Math.max(0, (busy[t.id] ?? 0) - dt);
      const firing = !!b.heat[t.id]?.trigger;
      const watched = b.alive ? this.turretTarget(b, t) : null;
      const active = firing || busy[t.id] > 0;
      const straight = active && t.center === 0 && !ALWAYS_AIMS.has(t.id);
      let target = watched && !straight ? this.relativeAngle(b, watched) : t.center;
      if (t.id === 'missiles' && busy.missiles > 0) target = b.missileAim;
      const rate = active ? 16 : 5;
      const want = clamp(wrapAngle(target - t.center), -HALF_ARC, HALF_ARC);
      const now = wrapAngle(t.group.rotation.y - t.center);
      t.group.rotation.y = t.center + now + (want - now) * (1 - Math.exp(-rate * dt));
    }
    for (const q of [...b.missileQueue]) {
      q.wait -= dt;
      if (q.wait > 0) continue;
      b.missileQueue.splice(b.missileQueue.indexOf(q), 1);
      if (!b.alive) continue;
      const pos = spendMissile(b.model, new THREE.Vector3()) ?? b.model.missileMount.getWorldPosition(new THREE.Vector3());
      const dir = missileDirection(b.model, new THREE.Vector3());
      dir.x += (Math.random() - 0.5) * 0.25;
      dir.z += (Math.random() - 0.5) * 0.25;
      dir.normalize();
      const mesh = buildMissile();
      mesh.scale.setScalar(0.75);
      this.scene.add(mesh);
      this.missiles.push({ pos, dir, speed: Math.max(fast(30), b.speed + fast(8)), owner: b, target: q.target, life: 5, fizzle: 0, mesh, lockTime: Math.random() < 0.12 ? 0.5 + Math.random() : Infinity });
      this.sfx.play('missile', b.pos);
    }
  },
};
