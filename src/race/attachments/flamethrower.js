import * as THREE from 'three';
import { stepFlame, flameDirection, HULL_L } from '../../boatModel.js';
import { fast } from '../../tuning.js';
import { BLAST_RADIUS, BURN_DPS, BURN_TIME, FLAME_REACH } from '../shared.js';

export const methods = {
  updateFlames(dt) {
    for (const b of this.boats) {
      if (!b.has('flamethrower')) continue;
      const { spraying } = this.stepHold(b, 'flamethrower', stepFlame, b.model.flameMount, dt);
      if (!spraying) continue;
      b.lastFired = this.time;
      const origin = b.model.flameMount.getWorldPosition(new THREE.Vector3());
      const dir = flameDirection(b.model, new THREE.Vector3());
      dir.y = 0;
      dir.normalize();
      this.fx.flameSpray(origin, dir, b.vel);
      const c = new THREE.Vector3();
      for (const o of this.boats) {
        if (o === b || !o.alive) continue;
        o.center(c).sub(origin);
        const along = c.x * dir.x + c.z * dir.z;
        if (along < -1 || along > FLAME_REACH) continue;
        const side = Math.abs(c.x * dir.z - c.z * dir.x);
        if (side > 2.4 + along * 0.32 || Math.abs(c.y) > 4) continue;
        const last = b.flameTicks.get(o) ?? -Infinity;
        if (this.time - last < 0.2) continue;
        b.flameTicks.set(o, this.time);
        if (this.damage(o, 3, b, 'flame')) this.ignite(o, b);
      }
    }
  },

  ignite(o, source) {
    const duration = o.has('camo') ? BURN_TIME * 1.5 : BURN_TIME;
    if (!o.burn) this.sfx.play('ignite', o.pos);
    o.burn = { time: Math.max(o.burn?.time ?? 0, duration), source, tick: o.burn?.tick ?? 0 };
  },

  updateBurn(b, dt) {
    if (!b.burn) return;
    if (!b.alive) {
      b.burn = null;
      return;
    }
    b.burn.time -= dt;
    b.burn.tick -= dt;
    const c = b.center();
    for (let i = 0; i < 6; i++) {
      const along = (Math.random() - 0.5) * HULL_L * 1.6;
      const side = (Math.random() - 0.5) * 2.4;
      this.fx.blaze(
        c.x + Math.sin(b.heading) * along + Math.cos(b.heading) * side,
        c.y + 0.4 + Math.random(),
        c.z + Math.cos(b.heading) * along - Math.sin(b.heading) * side,
        b.vel,
      );
    }
    if (Math.random() < (b.isPlayer ? 0.3 : 0.7)) this.fx.blackSmoke(c.x, c.y + 3 + Math.random() * 1.5, c.z, b.vel);
    if (Math.random() < 0.25) this.fx.sparkBurst(c.x, c.y + 1.5, c.z, 0xffa62b, 2);
    if (b.burn.tick <= 0) {
      b.burn.tick = 0.25;
      this.damage(b, BURN_DPS * 0.25, b.burn.source, 'fire');
    }
    if (b.burn?.time <= 0) b.burn = null;
  },

  propaneBlast(b) {
    const c = b.center();
    this.fx.explosion(c.x, c.y, c.z, 2.6);
    this.fx.ring(c.x, c.y, c.z, 0xff8a1f, 2, BLAST_RADIUS, 0.6);
    this.fx.ring(c.x, b.waterY + 0.3, c.z, 0xffffff, 2, BLAST_RADIUS * 0.8, 0.8);
    for (let i = 0; i < 4; i++) this.fx.sparkBurst(c.x, c.y + 1, c.z, i % 2 ? 0xffd23f : 0xff5a3a, 20);
    this.sfx.play('boom', b.pos);
    this.sfx.play('boom', b.pos);
    if (this.player && Math.hypot(this.player.pos.x - c.x, this.player.pos.z - c.z) < 120) this.emit('blast');
    for (const o of this.boats) {
      if (o === b || !o.alive) continue;
      const dx = o.pos.x - b.pos.x;
      const dz = o.pos.z - b.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > BLAST_RADIUS) continue;
      const f = 1 - d / BLAST_RADIUS;
      const nx = d > 0.01 ? dx / d : Math.random() - 0.5;
      const nz = d > 0.01 ? dz / d : Math.random() - 0.5;
      o.vel.x += nx * fast(55) * f;
      o.vel.z += nz * fast(55) * f;
      this.damage(o, 4 + 12 * f, b, 'propane', { launch: 0.3 + 0.6 * f, spin: f > 0.4 ? 0.8 : 0 });
    }
  },
};
