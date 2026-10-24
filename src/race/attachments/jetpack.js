import * as THREE from 'three';
import { fast } from '../../tuning.js';
import { t as tr } from '../../i18n.js';
import { DODGE_WINDOW } from '../shared.js';

export const methods = {
  incomingThreats(b) {
    const threats = [];
    const c = b.center();
    for (const m of this.missiles) {
      if (m.target !== b || m.fizzle > 0) continue;
      threats.push({ kind: 'missile', m, eta: m.pos.distanceTo(c) / Math.max(m.speed, 1) });
    }
    const p = new THREE.Vector3();
    for (const h of this.hooks) {
      if (h.target !== b || h.phase !== 'fly') continue;
      threats.push({ kind: 'hook', h, eta: this.hookPoint(h, p).distanceTo(h.pos) / 150 });
    }
    return threats;
  },

  tryDodge(b) {
    const dodged = this.incomingThreats(b).filter((t) => t.eta < DODGE_WINDOW);
    if (!dodged.length) return;
    for (const threat of dodged) {
      if (threat.kind === 'missile') {
        threat.m.target = null;
        threat.m.dodgedBy = b;
        threat.m.dir.y = Math.min(threat.m.dir.y, -0.08);
        threat.m.dir.normalize();
      } else {
        threat.h.target = null;
        threat.h.anchor = null;
        threat.h.travelled = 45;
      }
      const attacker = threat.kind === 'missile' ? threat.m.owner : threat.h.owner;
      const missile = threat.kind === 'missile';
      if (b.isPlayer) this.emit('feed', { text: tr(missile ? 'youDodgedMissile' : 'youDodgedHook', { name: attacker.name }), item: 'jetpack', player: true });
      else if (attacker.isPlayer) this.emit('feed', { text: tr(missile ? 'theyDodgedMissile' : 'theyDodgedHook', { name: b.name }), item: 'jetpack', player: true });
    }
    const c = b.center();
    this.fx.ring(c.x, c.y, c.z, 0xffffff, 2, 9, 0.45);
    this.fx.sparkBurst(c.x, c.y + 1, c.z, 0xffe066, 20);
    this.sfx.play('dodge', b.pos);
    if (b.isPlayer) this.emit('dodge');
  },
};

export const actions = {
  jetpack(b) {
    if (b.air) return false;
    this.tryDodge(b);
    b.air = { t: 0, dur: 1.5, peak: 7, jet: true };
    b.speed += fast(12);
    b.boost = Math.max(b.boost, 1.5);
    this.fx.splash(b.pos.x, b.waterY, b.pos.z, 1.2);
    this.sfx.play('jetpack', b.pos);
  },
};
