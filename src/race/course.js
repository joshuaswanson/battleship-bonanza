import { waveHeight, isWater } from '../water.js';
import { LIFT_LANES, SKI_CLIMB } from '../track.js';
import { BASE_SPEED, LIFT_SPEED, RAIL_GAP, RAIL_SETTLE, RAIL_SWITCH_LENGTH, RAIL_WISH, RAM_MIN, RAM_REACH, SHORE_MARGIN, clamp, wrapAngle } from './shared.js';

const ROCK_LAUNCH = BASE_SPEED * 0.45;
const LAND_FLIGHT = 3.2;
const LAND_PEAK = 32;
const SURFACE_FLIGHT = 2;
const SURFACE_PEAK = 17;
const LIP_POP = 20;
const LIP_SPEED = 0.75;
const TANK_PEAK = 15;
const LIFT_DRIFT = 1.6;
const JET_PEAK = 16;
const HOLD_LOOK = 34;
const HOLD_CENTER = 0.85;
const HOLD_RATE = 5;
const HOLD_EASE = 7;
const JET_LOOK = 1.1;

export const methods = {
  followRiver(b, s) {
    const t = this.track;
    const level = t.level(s);
    const before = b.surfaceLevel ?? level;
    if (level - before > 10 && b.isPlayer) this.emit('warp', { dy: level - before }, b);
    this.crossLand(b, s);
    if (before - level > 2 && t.formKind(s) !== 'jet') {
      const offLip = t.formAt(b.riverS ?? s);
      let vy = offLip ? LIP_POP : 3;
      if (offLip) this.sfx.play('untransform', b.pos);
      if (offLip) b.speed = Math.max(b.speed, BASE_SPEED * LIP_SPEED);
      if (b.air?.fall) vy = b.air.vy;
      else if (b.air) vy = (b.air.peak * 4 * (1 - (2 * b.air.t) / b.air.dur)) / b.air.dur;
      b.air = { fall: true, y: before + b.yOffset, vy };
      if (b.isPlayer && before - level > 8) this.emit('falls', {}, b);
    }
    b.surfaceLevel = level;
    const sinceExit = b.riverS == null || !t.river.tunnelOut ? Infinity : t.ahead(t.river.tunnelOut, s);
    const step = b.riverS == null ? Infinity : t.ahead(b.riverS, s);
    if (sinceExit < step && step < 30) this.drench(b);
    b.riverS = s;
  },

  crossLand(b, s) {
    const t = this.track;
    const land = t.river.land;
    if (!land || b.riverS == null) return;
    const step = t.ahead(b.riverS, s);
    if (step >= 30 || step <= 0) return;
    if (land.kind === 'sub' && t.ahead(b.riverS, land.lip) < step) {
      b.air = { t: 0, dur: SURFACE_FLIGHT, peak: SURFACE_PEAK, jet: false };
      this.fx.splash(b.pos.x, b.waterY, b.pos.z, 2.2);
      this.sfx.play('whoosh', b.pos);
      this.sfx.play('untransform', b.pos);
      return;
    }
    if (t.ahead(b.riverS, land.launch) >= step) return;
    if (land.kind === 'ski') {
      this.hookLift(b);
      return;
    }
    b.orbit = { t: 0, dur: LAND_FLIGHT };
    b.speed = Math.max(b.speed, BASE_SPEED * b.skill * 0.8);
    b.boost = Math.max(b.boost, 1);
    this.fx.splash(b.pos.x, b.waterY, b.pos.z, 1.4);
    this.sfx.play('transform', b.pos);
    b.air = { t: 0, dur: LAND_FLIGHT, peak: land.form === 'tank' ? TANK_PEAK : land.kind === 'jet' ? JET_PEAK : LAND_PEAK, jet: false, plunge: land.kind === 'sub' };
    if (land.form === 'tank') this.fx.explosion(b.pos.x, b.waterY + 0.5, b.pos.z, 1.8);
    b.stats.jumps++;
    this.sfx.play('whoosh', b.pos);
    if (b.isPlayer) this.emit('ramp', {}, b);
  },

  hookLift(b) {
    const t = this.track;
    const i = t.norm(b.trackIdx);
    const lateral = (b.pos.x - t.px[i]) * t.nx[i] + (b.pos.z - t.pz[i]) * t.nz[i];
    const lane = LIFT_LANES.reduce((best, x) => (Math.abs(x - lateral) < Math.abs(best - lateral) ? x : best));
    const dur = SKI_CLIMB / LIFT_SPEED;
    b.orbit = { t: 0, dur };
    b.air = { t: 0, dur, peak: 0, jet: false, lift: true, lane };
    this.sfx.play('clank', b.pos);
    this.sfx.play('transform', b.pos);
    if (b.isPlayer) this.emit('ramp', {}, b);
  },

  driftToCable(b, dt) {
    const t = this.track;
    const i = t.norm(b.trackIdx);
    const lateral = (b.pos.x - t.px[i]) * t.nx[i] + (b.pos.z - t.pz[i]) * t.nz[i];
    const shift = (b.air.lane - lateral) * (1 - Math.exp(-LIFT_DRIFT * dt));
    b.pos.x += t.nx[i] * shift;
    b.pos.z += t.nz[i] * shift;
  },

  submerged(b) {
    return this.track.formKind(b.trackS) === 'sub' && b.formP >= 1 && b.waterY < -1;
  },

  holdCourse(b, dt, rate = HOLD_RATE, line = null) {
    const t = this.track;
    const here = t.norm(b.trackIdx);
    const lateral = (b.pos.x - t.px[here]) * t.nx[here] + (b.pos.z - t.pz[here]) * t.nz[here];
    const look = Math.max(HOLD_LOOK, Math.abs(b.speed) * JET_LOOK);
    const at = (b.trackS + look) / t.spacing;
    const i = Math.floor(at);
    const u = at - i;
    const aim = line ?? lateral * HOLD_CENTER;
    const a = t.point(t.wrap(i), aim);
    const c = t.point(t.wrap(i + 1), aim);
    const diff = wrapAngle(Math.atan2(a.x + (c.x - a.x) * u - b.pos.x, a.z + (c.z - a.z) * u - b.pos.z) - b.heading);
    b.holdTurn = (b.holdTurn ?? 0) + (diff * rate - (b.holdTurn ?? 0)) * (1 - Math.exp(-HOLD_EASE * dt));
    b.heading += b.holdTurn * dt;
  },

  rideRail(b, dt, steer) {
    const t = this.track;
    const i = t.norm(b.trackIdx);
    const lateral = (b.pos.x - t.px[i]) * t.nx[i] + (b.pos.z - t.pz[i]) * t.nz[i];
    const depth = t.ahead(t.river.land.launch, b.trackS);
    const passed = b.railDepth ?? depth;
    b.railDepth = depth;
    if (b.rail === null) {
      b.rail = clamp(Math.round(lateral / RAIL_GAP), -1, 1);
      b.railMove = Math.abs(lateral - b.rail * RAIL_GAP) > 0.6 ? { from: lateral, to: b.rail * RAIL_GAP, u: 0, length: RAIL_SETTLE } : null;
      b.railTurn = 0;
    }
    if (steer) {
      b.railWish = -Math.sign(steer);
      b.railWishTime = RAIL_WISH;
    }
    b.railWishTime -= dt;
    if (!b.railMove && b.railWishTime > 0) {
      const taken = t.river.land.crossings.find((c) => c.at > passed && c.at <= depth && c.from === b.rail && c.to - c.from === b.railWish);
      if (taken) {
        b.railMove = { from: taken.from * RAIL_GAP, to: taken.to * RAIL_GAP, u: 0, length: RAIL_SWITCH_LENGTH };
        b.rail = taken.to;
        this.sfx.play('clank', b.pos);
      }
    }
    let lat = b.rail * RAIL_GAP;
    let slip = 0;
    if (b.railMove) {
      const move = b.railMove;
      move.u = Math.min(1, move.u + (Math.abs(b.speed) * dt) / move.length);
      const u = move.u;
      lat = move.from + (move.to - move.from) * u * u * u * (u * (u * 6 - 15) + 10);
      slip = Math.atan2(((move.to - move.from) * 30 * u * u * (1 - u) * (1 - u)) / move.length, 1);
      if (u >= 1) b.railMove = null;
    }
    const shift = lat - lateral;
    b.pos.x += t.nx[i] * shift;
    b.pos.z += t.nz[i] * shift;
    const at = b.trackS / t.spacing;
    const k = Math.floor(at);
    const next = t.heading(t.wrap(k + 1));
    const here = t.heading(t.wrap(k));
    const along = here + wrapAngle(next - here) * (at - k);
    b.railTurn += (slip - b.railTurn) * (1 - Math.exp(-14 * dt));
    b.heading += wrapAngle(along + b.railTurn - b.heading) * (1 - Math.exp(-16 * dt));
    b.vel.set(Math.sin(b.heading) * b.speed, 0, Math.cos(b.heading) * b.speed);
  },

  ramOnRails(a, b) {
    const fx = Math.sin(a.heading);
    const fz = Math.cos(a.heading);
    const dx = b.pos.x - a.pos.x;
    const dz = b.pos.z - a.pos.z;
    const along = dx * fx + dz * fz;
    if (Math.abs(dx * fz - dz * fx) > 5.2 || Math.abs(along) > RAM_REACH) return;
    const [rear, ahead] = along >= 0 ? [a, b] : [b, a];
    const gap = RAM_REACH - Math.abs(along);
    rear.pos.x -= fx * gap * 0.5;
    rear.pos.z -= fz * gap * 0.5;
    ahead.pos.x += fx * gap * 0.5;
    ahead.pos.z += fz * gap * 0.5;
    const closing = rear.speed - ahead.speed;
    if (closing <= 0) return;
    const hitter = Math.abs(rear.speed) >= Math.abs(ahead.speed) ? rear : ahead;
    const victim = hitter === rear ? ahead : rear;
    rear.speed -= closing * 0.72;
    ahead.speed += closing * 0.62;
    if (closing < RAM_MIN) return;
    const blow = clamp(closing * 0.55, 6, 24);
    this.damage(victim, blow, hitter, 'ram');
    this.damage(hitter, blow * 0.2, victim, 'ram');
    rear.bump(5);
    ahead.bump(5);
    this.fx.sparkBurst((rear.pos.x + ahead.pos.x) / 2, rear.waterY + 2, (rear.pos.z + ahead.pos.z) / 2, 0xffd23f, 26);
    this.sfx.play('clank', rear.pos);
    this.sfx.play('hit', rear.pos);
    for (const o of [rear, ahead]) if (o.isPlayer) this.emit('lockShake', { amount: 1.1 }, o);
  },

  rigidForm(b) {
    return !!b.form && b.formP > 0.5 && this.track.formKind(b.trackS) !== 'truck' && this.track.formAt(b.trackS);
  },

  groundHit(b, x, z, size) {
    const kind = this.track.formKind?.(b.trackS);
    if (isWater(x, z)) {
      this.fx.splash(x, b.waterY, z, size);
      return;
    }
    if (kind === 'sub') {
      for (let k = 0; k < 8 * size; k++) this.fx.bubbles(x + (Math.random() - 0.5) * 3, b.waterY, z + (Math.random() - 0.5) * 3);
      return;
    }
    if (kind === 'jet') return;
    const dust = kind === 'ski' ? [0xffffff, 0xe6f2ff] : [0xc9a46b, 0xa98852];
    const pool = this.track.river.land.form === 'tank' ? this.fx.soot : this.fx.puffs;
    for (let k = 0; k < 12 * size; k++) {
      pool.emit(x, b.waterY + 0.4, z, (Math.random() - 0.5) * 10, 2 + Math.random() * 4, (Math.random() - 0.5) * 10, 0.7 + Math.random() * 0.7, 0.7, dust[k % 2], 3, 1.5, 0);
    }
  },

  wreckSmoke(b) {
    if (Math.random() > 0.7) return;
    const c = b.center();
    this.fx.puffs.emit(c.x + (Math.random() - 0.5) * 3, c.y + 1, c.z + (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 1.5, 5 + Math.random() * 3, (Math.random() - 0.5) * 1.5, 1 + Math.random() * 1.2, 1.1, Math.random() < 0.25 ? 0xff7a1f : 0x2c2a2a, -1, 1.2, 0);
  },

  drench(b) {
    const c = b.center();
    this.fx.splash(c.x, b.waterY + 0.3, c.z, 1.1);
    for (let i = 0; i < 14; i++) {
      this.fx.droplet(c.x + (Math.random() - 0.5) * 5, c.y + 4 + Math.random() * 4, c.z + (Math.random() - 0.5) * 5, b.vel.x * 0.6, -6 - Math.random() * 6, b.vel.z * 0.6, 0.45);
    }
    this.sfx.play('splash', b.pos);
    if (b.burn) b.burn = null;
  },

  collideShores(b) {
    for (const blob of this.shores) {
      if (blob.tree?.cut) continue;
      if (blob.top !== undefined && b.waterY + b.yOffset > blob.top) continue;
      if (b.air?.over === blob) continue;
      const dx = b.pos.x - blob.x;
      const dz = b.pos.z - blob.z;
      if (Math.abs(dx) > blob.rx + blob.rz + 4 || Math.abs(dz) > blob.rx + blob.rz + 4) continue;
      const c = Math.cos(blob.rot);
      const s = Math.sin(blob.rot);
      const lx = dx * c - dz * s;
      const lz = dx * s + dz * c;
      const ax = blob.rx + SHORE_MARGIN;
      const az = blob.rz + SHORE_MARGIN;
      const q = Math.hypot(lx / ax, lz / az);
      if (q >= 1 || q === 0) continue;
      const px = lx / q;
      const pz = lz / q;
      b.pos.x = blob.x + px * c + pz * s;
      b.pos.z = blob.z - px * s + pz * c;
      let gx = px / (ax * ax);
      let gz = pz / (az * az);
      const nx = gx * c + gz * s;
      const nz = -gx * s + gz * c;
      const len = Math.hypot(nx, nz);
      const ux = nx / len;
      const uz = nz / len;
      const vn = b.vel.x * ux + b.vel.z * uz;
      if (blob.launch && -vn > ROCK_LAUNCH) {
        if (this.rigidForm(b)) {
          b.vel.x -= ux * vn * 1.3;
          b.vel.z -= uz * vn * 1.3;
          b.speed *= 0.94;
          b.bump(3);
          this.groundHit(b, b.pos.x, b.pos.z, 0.7);
          this.sfx.play('hit', b.pos);
          continue;
        }
        this.launchOffRock(b, blob);
        continue;
      }
      if (vn < 0) {
        b.vel.x -= ux * vn * 1.6;
        b.vel.z -= uz * vn * 1.6;
        if (vn < -6) {
          b.speed *= 0.6;
          b.bump(4);
          this.groundHit(b, b.pos.x, b.pos.z, 0.7);
          this.sfx.play('boing', b.pos);
        }
      }
    }
  },

  launchOffRock(b, rock) {
    b.air = { t: 0, dur: 0.9, peak: 5.4, jet: false, over: rock };
    if (b.spinTime <= 0) {
      b.spinTime = 1;
      b.spinDur = 1;
    }
    b.speed *= 0.7;
    b.bump(5);
    this.fx.splash(b.pos.x, b.waterY, b.pos.z, 1.1);
    this.sfx.play('boing', b.pos);
  },

  courseReturnPoint(b) {
    const t = this.track;
    const idx = t.step(b.trackIdx, 12 / t.spacing, (fork) => b.ai?.routes?.[fork.id]);
    const pr = t.project(b.pos.x, b.pos.z, b.trackIdx);
    return t.point(idx, Math.sign(pr.lateral) * (t.hw[idx] - 6));
  },

  whitecaps(dt) {
    const focus = this.player ?? this.boats[0];
    if (!focus || Math.random() > dt * 5) return;
    let x, z;
    if (this.track.banked) {
      const idx = this.track.step(focus.trackIdx, (Math.random() - 0.3) * 60);
      const p = this.track.point(idx, (Math.random() - 0.5) * 2 * this.track.widthAt(idx));
      x = p.x;
      z = p.z;
      if (!isWater(x, z)) return;
    } else {
      const a = Math.random() * Math.PI * 2;
      const d = 15 + Math.random() * 60;
      x = focus.pos.x + Math.cos(a) * d;
      z = focus.pos.z + Math.sin(a) * d;
    }
    this.fx.splash(x, waveHeight(x, z, this.time), z, 0.2 + Math.random() * 0.2);
  },
};
