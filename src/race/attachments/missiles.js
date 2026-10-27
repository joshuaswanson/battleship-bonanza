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
        if (this.solid || this.raycast) {
          let blocked;
          if (this.raycast) blocked = this.raycast(m.pos, m.dir, 18);
          else {
            const probe = c.copy(m.pos).addScaledVector(m.dir, 10);
            blocked = this.solid(probe) || this.solid(probe.addScaledVector(m.dir, 8));
          }
          if (blocked) {
            m.dir.y = Math.max(m.dir.y, 0.75);
            m.dir.normalize();
          }
        }
      } else {
        m.target = null;
        m.dir.y = approach(m.dir.y, -0.04, dt);
        m.dir.normalize();
      }
      const before = m.pos.clone();
      m.pos.addScaledVector(m.dir, m.speed * dt);
      const wall = m.fizzle > 0 || m.target ? null : this.surfaceHit(before, m.pos);
      if (wall) {
        m.pos.copy(wall.point);
        this.stampDecal('crater', wall.point, wall.normal, 3.2 + Math.random() * 1.2);
        for (let i = 0; i < 10; i++) {
          const v = wall.normal.clone().multiplyScalar(6 + Math.random() * 6).add(new THREE.Vector3((Math.random() - 0.5) * 8, Math.random() * 6, (Math.random() - 0.5) * 8));
          this.fx.puffs.emit(wall.point.x, wall.point.y, wall.point.z, v.x, v.y, v.z, 0.25 + Math.random() * 0.25, 0.9, 0x8f877b, 18, 0.5, 1);
        }
        return this.explodeMissile(m, null, 0.9);
      }
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
    this.blasts.push({ x: m.pos.x, z: m.pos.z, owner: m.owner });
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
    const target = b.blind > 0 ? null : targets[0] ?? null;
    b.model.busy.missiles = 1;
    b.missileAim = target ? this.relativeAngle(b, target) : 0;
    b.missileQueue.push({ target, wait: 0.12 });
  },
};
