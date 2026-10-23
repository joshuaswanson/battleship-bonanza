import * as THREE from 'three';
import { ITEMS } from '../../items.js';

export const methods = {
  updatePulses(dt) {
    const c = new THREE.Vector3();
    this.pulses = this.pulses.filter((p) => {
      p.age += dt;
      const r = p.radius * Math.sqrt(Math.min(1, p.age / p.life));
      const center = p.owner.center(c);
      for (const m of this.missiles) {
        if (m.owner === p.owner || m.fizzle > 0) continue;
        if (m.pos.distanceTo(center) > r + 1.5) continue;
        m.target = null;
        m.dir.copy(m.pos).sub(center).setY(0).normalize().setY(0.7).normalize();
        m.fizzle = 0.9;
        this.fx.arcTo(() => this.empOrigin(p.owner), () => (this.missiles.includes(m) ? m.pos.clone() : null), 0.3);
      }
      for (const o of this.boats) {
        if (o === p.owner || !o.alive || p.jolted.has(o)) continue;
        if (o.center(new THREE.Vector3()).distanceTo(center) > r + 1.5) continue;
        p.jolted.add(o);
        for (const id of o.items) {
          if (ITEMS[id].group !== 'weapons') continue;
          const module = o.model.modules[id];
          if (!module) continue;
          this.fx.arcTo(() => this.empOrigin(p.owner), () => (o.alive ? module.localToWorld(new THREE.Vector3(0, 0.9, 0)) : null));
        }
        this.sfx.play('zap', o.pos);
        o.stun = Math.max(o.stun, 1.1);
        o.disabled = Math.max(o.disabled, 1.6);
        o.flash = 0.6;
        const oc = o.center();
        this.fx.sparkBurst(oc.x, oc.y, oc.z, 0x5ff4ff, 12);
      }
      return p.age < p.life;
    });
  },

  empOrigin(b) {
    return b.alive ? b.model.empOrb.getWorldPosition(new THREE.Vector3()) : null;
  },

  crackle(b, dt) {
    const intensity = b.cooldowns[b.items.indexOf('emp')] > 0 ? 0.35 : 1;
    if (this.fx.empIdle(b.model, dt, intensity, this.time) && Math.random() < 0.04 * intensity) this.sfx.play('crackle', b.pos);
  },

  updateSulk(b, dt) {
    b.disabled = Math.max(0, b.disabled - dt);
    const off = b.disabled > 0;
    const k = 1 - Math.exp(-(off ? 7 : 5) * dt);
    b.model.sags.forEach((sag, i) => {
      if (ITEMS[sag.userData.id].group !== 'weapons') return;
      const droop = off ? 0.6 + Math.sin(this.time * 3 + i) * 0.06 : 0;
      const slump = off ? Math.sin(this.time * 2.2 + i * 2) * 0.12 : 0;
      sag.rotation.x += (droop - sag.rotation.x) * k;
      sag.rotation.z += (slump - sag.rotation.z) * k;
      if (off && Math.random() < 0.12) {
        const p = sag.getWorldPosition(new THREE.Vector3());
        this.fx.sparkBurst(p.x, p.y + 1, p.z, 0x5ff4ff, 3);
      }
      if (off && Math.random() < dt * 24) {
        const p = sag.getWorldPosition(new THREE.Vector3());
        const jolt = () => new THREE.Vector3(p.x + (Math.random() - 0.5) * 2.6, p.y + 0.4 + Math.random() * 1.8, p.z + (Math.random() - 0.5) * 2.6);
        this.fx.bolt(jolt(), jolt(), 0x2f7dff, 0.16, 0.1, false);
        if (Math.random() < 0.3) this.sfx.play('crackle', p);
      }
    });
  },
};

export const actions = {
  emp(b) {
    this.pulses.push({ owner: b, age: 0, life: 0.5, radius: 26, jolted: new Set() });
    this.fx.followRing(b.pos, 0x5ff4ff, 26, 0.7);
    this.fx.followRing(b.pos, 0xffffff, 18, 0.55);
    this.fx.shell(b.pos, 0x5ff4ff, 26, 0.7);
    const c = b.center();
    for (let i = 0; i < 3; i++) this.fx.sparkBurst(c.x, c.y, c.z, 0x5ff4ff, 8);
    this.sfx.play('emp', b.pos);
  },
};
