import * as THREE from 'three';
import { stepGun, gunDirection } from '../../boatModel.js';
import { waveHeight } from '../../water.js';
import { BULLET_SPEED, HIT_RADIUS } from '../shared.js';

export const methods = {
  updateGun(b, dt) {
    const { shots } = this.stepHold(b, 'machinegun', stepGun, b.model.gunMount, dt);
    for (let i = 0; i < shots; i++) this.fireBullet(b);
    if (shots) b.lastFired = this.time;
  },

  fireBullet(b) {
    const origin = b.model.gunMount.getWorldPosition(new THREE.Vector3());
    const dir = gunDirection(b.model, new THREE.Vector3());
    dir.y = 0;
    dir.normalize();
    const target = this.findTarget(b, { ...this.gunArc(b, 'machinegun', 80), filter: (o) => !o.has('camo') });
    if (target) {
      const c = target.center();
      const lead = c.distanceTo(origin) / BULLET_SPEED;
      c.addScaledVector(target.vel, lead).sub(origin).normalize();
      dir.lerp(c, 0.15).normalize();
    }
    dir.x += (Math.random() - 0.5) * 0.34;
    dir.y += (Math.random() - 0.35) * 0.1;
    dir.z += (Math.random() - 0.5) * 0.34;
    dir.normalize();
    const vel = dir.clone().multiplyScalar(BULLET_SPEED).add(b.vel);
    this.bullets.push({ pos: origin, prev: origin.clone(), start: origin.clone(), vel, owner: b, life: 0.48 });
    this.ejectCasing(b.model, b.vel);
    this.fx.sparkBurst(origin.x, origin.y, origin.z, 0xffffff, 2);
    this.sfx.play('shoot', b.pos);
  },

  ejectCasing(refs, carry) {
    const swivel = refs.gunSwivel;
    const port = swivel.localToWorld(new THREE.Vector3(-0.55, 0.7, 0.1));
    const side = new THREE.Vector3(-1, 0, 0).applyQuaternion(swivel.getWorldQuaternion(new THREE.Quaternion()));
    this.fx.casing(port, side, carry);
  },

  updateBullets(dt) {
    const c = new THREE.Vector3();
    const seg = new THREE.Vector3();
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3(0.12, 0.12, 9);
    const core = new THREE.Vector3(0.05, 0.05, 9);
    const z = new THREE.Vector3(0, 0, 1);
    const dir = new THREE.Vector3();
    let n = 0;
    this.bullets = this.bullets.filter((bullet) => {
      bullet.life -= dt;
      bullet.prev.copy(bullet.pos);
      bullet.pos.addScaledVector(bullet.vel, dt);
      seg.subVectors(bullet.pos, bullet.prev);
      const len = seg.length();
      seg.divideScalar(len || 1);
      for (const o of this.boats) {
        if (o === bullet.owner || !o.alive) continue;
        let hit = false;
        for (let k = 0; k <= len + 0.01 && !hit; k += 1) {
          c.copy(bullet.prev).addScaledVector(seg, Math.min(k, len));
          hit = o.distanceToAxis(c) < HIT_RADIUS;
        }
        if (hit) {
          this.fx.sparkBurst(bullet.pos.x, bullet.pos.y, bullet.pos.z, 0xfff6c8, 5);
          this.damage(o, 2, bullet.owner, 'bullet', { knockX: seg.x * 1.2, knockZ: seg.z * 1.2 });
          return false;
        }
      }
      if (bullet.life <= 0) return false;
      if (bullet.pos.y < waveHeight(bullet.pos.x, bullet.pos.z, this.time)) {
        this.fx.splash(bullet.pos.x, bullet.pos.y, bullet.pos.z, 0.3);
        this.fx.droplet(bullet.pos.x, bullet.pos.y, bullet.pos.z, 0, 9 + Math.random() * 4, 0, 0.3);
        return false;
      }
      if (n < 400) {
        dir.copy(bullet.vel).normalize();
        q.setFromUnitVectors(z, dir);
        s.z = core.z = Math.min(9, bullet.pos.distanceTo(bullet.start));
        m.compose(bullet.pos, q, s);
        this.bulletMesh.setMatrixAt(n, m);
        m.compose(bullet.pos, q, core);
        this.bulletOutline.setMatrixAt(n++, m);
      }
      return true;
    });
    this.bulletMesh.count = Math.min(n, 400);
    this.bulletOutline.count = this.bulletMesh.count;
    this.bulletOutline.instanceMatrix.needsUpdate = true;
    this.bulletMesh.instanceMatrix.needsUpdate = true;
  },
};
