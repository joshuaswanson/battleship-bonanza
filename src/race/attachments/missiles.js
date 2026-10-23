import * as THREE from 'three';
import { waveHeight } from '../../water.js';
import { fast } from '../../tuning.js';
import { HIT_RADIUS, approach } from '../shared.js';

export const methods = {
  updateMissiles(dt) {
    const desired = new THREE.Vector3();
    const c = new THREE.Vector3();
    this.missiles = this.missiles.filter((m) => {
      m.life -= dt;
      m.speed = Math.min(fast(85), m.speed + fast(60) * dt);
      if (m.fizzle > 0) {
        m.fizzle -= dt;
        if (m.fizzle <= 0) return this.explodeMissile(m, null, 0.5);
      } else if (m.target && m.target.alive && (m.lockTime -= dt) > 0) {
        desired.copy(m.target.center()).sub(m.pos).normalize();
        const angle = m.dir.angleTo(desired);
        const maxTurn = 2.5 * dt;
        m.dir.lerp(desired, angle > maxTurn ? maxTurn / angle : 1).normalize();
      } else {
        m.target = null;
        m.dir.y = approach(m.dir.y, -0.04, dt);
        m.dir.normalize();
      }
      m.pos.addScaledVector(m.dir, m.speed * dt);
      this.fx.smoke(m.pos.x - m.dir.x, m.pos.y - m.dir.y, m.pos.z - m.dir.z);
      m.mesh.position.copy(m.pos);
      m.mesh.lookAt(c.copy(m.pos).add(m.dir));

      if (m.fizzle <= 0) {
        for (const o of this.boats) {
          if (o === m.owner || o === m.dodgedBy || !o.alive) continue;
          if (o.distanceToAxis(m.pos) < HIT_RADIUS + 0.4) return this.explodeMissile(m, o, 1);
        }
      }
      if (m.pos.y < waveHeight(m.pos.x, m.pos.z, this.time) - 0.2) return this.explodeMissile(m, null, 0.8);
      if (m.life <= 0) return this.explodeMissile(m, null, 0.8);
      return true;
    });
  },

  explodeMissile(m, victim, power) {
    this.fx.explosion(m.pos.x, m.pos.y, m.pos.z, power * 0.7);
    this.sfx.play('boom', m.pos);
    this.scene.remove(m.mesh);
    if (victim) {
      this.damage(victim, 11, m.owner, 'missile', { knockX: m.dir.x * 6, knockZ: m.dir.z * 6, stun: 0.2 });
    }
    return false;
  },
};

export const actions = {
  missiles(b) {
    const chased = new Set(this.missiles.filter((m) => m.owner === b && m.target).map((m) => m.target));
    for (const q of b.missileQueue) if (q.target) chased.add(q.target);
    const targets = this.boats
      .filter((o) => o !== b && o.alive && o.invuln <= 0 && !o.has('camo') && !(o.finished && !this.attract) && this.willAttack(b, o))
      .map((o) => ({ o, d: Math.hypot(o.pos.x - b.pos.x, o.pos.z - b.pos.z) + (chased.has(o) ? 60 : 0) }))
      .filter((t) => t.d <= 240)
      .sort((x, y) => x.d - y.d)
      .map((t) => t.o);
    const target = targets[0] ?? null;
    b.model.busy.missiles = 1;
    b.missileAim = target ? this.relativeAngle(b, target) : 0;
    b.missileQueue.push({ target, wait: 0.12 });
  },
};
