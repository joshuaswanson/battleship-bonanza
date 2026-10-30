import * as THREE from 'three';
import { stepGun, gunDirection, flashGun } from '../../boatModel.js';
import { waveHeight } from '../../water.js';
import { BULLET_SPEED, HIT_RADIUS } from '../shared.js';

const BULLET_DROP = 40;
const WET_SPEED = 0.42;
const WET_LIFE = 1;
const WET_BUBBLES = 40;
const WET_TRACER = new THREE.Color(0x7ff4ff);
const DRY_TRACER = new THREE.Color(0xffe066);

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
    const wet = this.submerged(b);
    if (wet) dir.y = 0;
    const vel = dir.clone().multiplyScalar(BULLET_SPEED * (wet ? WET_SPEED : 1)).add(b.vel);
    this.bullets.push({ pos: origin, prev: origin.clone(), start: origin.clone(), vel, owner: b, life: wet ? WET_LIFE : 0.48, wet });
    if (!wet) this.ejectCasing(b.model, b.vel);
    flashGun(b.model);
    if (wet) this.fx.bubbles(origin.x, origin.y, origin.z);
    else this.fx.sparkBurst(origin.x, origin.y, origin.z, Math.random() < 0.5 ? 0xffe066 : 0xffffff, 4);
    if (Math.random() < 0.15) this.fx.puffs.emit(origin.x + dir.x * 1.5, origin.y + 0.2, origin.z + dir.z * 1.5, b.vel.x * 0.6 + dir.x * 3, 1.2, b.vel.z * 0.6 + dir.z * 3, 0.28, 0.45, 0xdfe6ee, -0.5, 2, 0);
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
      if (!bullet.wet) bullet.vel.y -= BULLET_DROP * dt;
      else if (Math.random() < dt * WET_BUBBLES) this.fx.bubbles(bullet.pos.x, bullet.pos.y, bullet.pos.z);
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
      const wall = this.surfaceHit(bullet.prev, bullet.pos);
      if (wall) {
        const { point, normal } = wall;
        this.stampDecal('hole', point, normal, 0.45 + Math.random() * 0.35);
        this.fx.sparkBurst(point.x, point.y, point.z, 0xfff1b0, 4);
        this.fx.puffs.emit(point.x, point.y, point.z, normal.x * 2, 1 + normal.y * 2, normal.z * 2, 0.35, 0.5, 0xcfc6b8, -0.5, 2, 0);
        return false;
      }
      if (bullet.life <= 0) return false;
      if (!bullet.wet && bullet.pos.y < waveHeight(bullet.pos.x, bullet.pos.z, this.time)) {
        const y = waveHeight(bullet.pos.x, bullet.pos.z, this.time);
        this.fx.splash(bullet.pos.x, y, bullet.pos.z, 0.35);
        for (let i = 0; i < 2; i++) this.fx.droplet(bullet.pos.x, y, bullet.pos.z, (Math.random() - 0.5) * 2, 7 + Math.random() * 5, (Math.random() - 0.5) * 2, 0.32);
        return false;
      }
      if (n < 400) {
        dir.copy(bullet.vel).normalize();
        q.setFromUnitVectors(z, dir);
        const reach = bullet.pos.distanceTo(bullet.start);
        s.set(bullet.wet ? 0.34 : 0.12, bullet.wet ? 0.34 : 0.12, Math.min(bullet.wet ? 3 : 9, reach));
        core.set(bullet.wet ? 0.16 : 0.05, bullet.wet ? 0.16 : 0.05, s.z);
        m.compose(bullet.pos, q, s);
        this.bulletMesh.setMatrixAt(n, m);
        this.bulletMesh.setColorAt(n, bullet.wet ? WET_TRACER : DRY_TRACER);
        m.compose(bullet.pos, q, core);
        this.bulletOutline.setMatrixAt(n++, m);
      }
      return true;
    });
    this.bulletMesh.count = Math.min(n, 400);
    this.bulletOutline.count = this.bulletMesh.count;
    this.bulletOutline.instanceMatrix.needsUpdate = true;
    this.bulletMesh.instanceMatrix.needsUpdate = true;
    if (this.bulletMesh.instanceColor) this.bulletMesh.instanceColor.needsUpdate = true;
  },
};
