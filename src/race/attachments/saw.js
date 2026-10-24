import * as THREE from 'three';
import { stepSaw, slotCenter } from '../../boatModel.js';
import { HALF_ARC, HIT_RADIUS, WATCH_RANGE, clamp, wrapAngle } from '../shared.js';

const SPIN_UP_RANGE = 35;

export const methods = {
  updateSaw(b, dt) {
    const refs = b.model;
    const s = b.sawState;
    const pivot = refs.sawYaw.getWorldPosition(new THREE.Vector3());
    const fx = Math.sin(b.heading);
    const fz = Math.cos(b.heading);
    const lx = Math.cos(b.heading);
    const lz = -Math.sin(b.heading);
    const { cutting: armed } = this.stepHold(b, 'saw', stepSaw, refs.saw, dt);
    if (armed) b.lastFired = this.time;
    const slot = b.items.indexOf('saw');
    const center = slotCenter(slot);
    let target = null;
    let best = WATCH_RANGE;
    if (b.alive && this.state === 'racing' && b.disabled <= 0) {
      for (const o of this.boats) {
        if (o === b || !o.alive || (o.finished && !this.attract) || !this.willAttack(b, o)) continue;
        if (Math.abs(o.yOffset - b.yOffset) > 3 || !this.inArc(b, slot, o.pos.x, o.pos.z, pivot)) continue;
        const d = o.distanceToAxis2D(pivot.x, pivot.z);
        if (d < best) {
          best = d;
          target = o;
        }
      }
    }
    let desired = center;
    if (s.shield > 0) desired = s.shieldYaw;
    else if (target) {
      const dx = target.pos.x - pivot.x;
      const dz = target.pos.z - pivot.z;
      desired = Math.atan2(dx * lx + dz * lz, dx * fx + dz * fz);
    }
    const want = clamp(wrapAngle(desired - center), -HALF_ARC, HALF_ARC);
    const now = clamp(wrapAngle(s.yaw - center), -HALF_ARC, HALF_ARC);
    s.yaw = center + now + (want - now) * (1 - Math.exp(-(s.shield > 0 ? 20 : 9) * dt));
    refs.sawYaw.rotation.y = s.yaw;

    const blade = refs.saw.getWorldPosition(new THREE.Vector3());
    const inReach = target && s.shield <= 0 && target.distanceToAxis2D(blade.x, blade.z) < HIT_RADIUS + 1.4;
    const cutting = armed && inReach;
    s.chop = cutting ? (s.chop ?? 0) + dt : 0;
    const arm = refs.modules.saw;
    const pitch = cutting ? Math.sin(s.chop * 16) * 0.2 + 0.08 : 0;
    arm.rotation.x += (pitch - arm.rotation.x) * (1 - Math.exp(-25 * dt));
    if (cutting) {
      const toward = target.center().sub(blade).setY(0).normalize();
      const contact = blade.clone().addScaledVector(toward, 1.5);
      contact.y -= 0.5;
      if (Math.random() < 0.7) this.fx.sparkBurst(contact.x, contact.y, contact.z, Math.random() < 0.5 ? 0xffe066 : 0xffffff, 3);
      s.tick -= dt;
      if (s.tick <= 0) {
        s.tick = 0.22;
        this.damage(target, 4, b, 'saw', { stun: 0.15 });
        this.fx.sparkBurst(contact.x, contact.y, contact.z, 0xffa62b, 12);
      }
    }
    const spinning = armed || s.shield > 0 || (target && best < SPIN_UP_RANGE);
    s.spin += ((spinning ? 42 : 0) - s.spin) * (1 - Math.exp(-(spinning ? 6 : 2) * dt));
    refs.saw.rotation.x += s.spin * dt;

    s.shield = Math.max(0, s.shield - dt);
    const shield = refs.sawShield;
    const glowAmount = s.shield > 0 ? 0.6 + 0.25 * Math.sin(this.time * 45) : 0;
    shield.material.opacity += (glowAmount - shield.material.opacity) * (1 - Math.exp(-18 * dt));
    shield.scale.setScalar(1 + 0.08 * Math.sin(this.time * 30));
  },

  shieldAgainst(victim, shooter) {
    const s = victim.sawState;
    const pivot = victim.model.sawYaw.getWorldPosition(new THREE.Vector3());
    const dx = shooter.pos.x - pivot.x;
    const dz = shooter.pos.z - pivot.z;
    const fx = Math.sin(victim.heading);
    const fz = Math.cos(victim.heading);
    s.shieldYaw = Math.atan2(dx * Math.cos(victim.heading) - dz * Math.sin(victim.heading), dx * fx + dz * fz);
    s.shield = 0.2;
    return victim.model.sawShield.getWorldPosition(new THREE.Vector3());
  },

  sawCuts(victim, hooker) {
    if (!victim.model.sawYaw || victim.disabled > 0 || !victim.alive) return false;
    return this.inArc(victim, victim.items.indexOf('saw'), hooker.pos.x, hooker.pos.z);
  },
};
