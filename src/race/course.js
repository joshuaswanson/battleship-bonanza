import { waveHeight, isWater } from '../water.js';
import { BASE_SPEED, SHORE_MARGIN } from './shared.js';

const ROCK_LAUNCH = BASE_SPEED * 0.45;

export const methods = {
  followRiver(b, s) {
    const t = this.track;
    const level = t.level(s);
    const before = b.surfaceLevel ?? level;
    if (level - before > 10 && b.isPlayer) this.emit('warp', { dy: level - before });
    if (before - level > 2) {
      let vy = 3;
      if (b.air?.fall) vy = b.air.vy;
      else if (b.air) vy = (b.air.peak * 4 * (1 - (2 * b.air.t) / b.air.dur)) / b.air.dur;
      b.air = { fall: true, y: before + b.yOffset, vy };
      if (b.isPlayer && before - level > 8) this.emit('falls');
    }
    b.surfaceLevel = level;
    const sinceExit = b.riverS == null ? Infinity : t.ahead(t.river.tunnelOut, s);
    const step = b.riverS == null ? Infinity : t.ahead(b.riverS, s);
    if (sinceExit < step && step < 30) this.drench(b);
    b.riverS = s;
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
        this.launchOffRock(b, blob);
        continue;
      }
      if (vn < 0) {
        b.vel.x -= ux * vn * 1.6;
        b.vel.z -= uz * vn * 1.6;
        if (vn < -6) {
          b.speed *= 0.6;
          b.bump(4);
          this.fx.splash(b.pos.x, b.waterY, b.pos.z, 0.7);
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
