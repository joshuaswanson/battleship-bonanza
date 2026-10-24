import * as THREE from 'three';
import { laserWobble, aimLaserGun, stepLaser, laserDirection, pointLaserGun } from '../../boatModel.js';
import { waveHeight } from '../../water.js';
import { LASER_REACH, SAW_LEAK } from '../shared.js';

export const methods = {
  updateLasers(dt) {
    for (const b of this.boats) {
      if (!b.has('laser')) continue;
      const { beaming } = this.stepHold(b, 'laser', stepLaser, b.model.laserMount, dt);
      b.laserHum -= dt;
      if (!beaming) {
        b.laserHum = 0;
        aimLaserGun(b.model, null, dt);
        continue;
      }
      const wobble = laserWobble(this.time, b.index * 3.7);
      aimLaserGun(b.model, wobble, dt);
      b.lastFired = this.time;
      if (b.laserHum <= 0) {
        b.laserHum = 1.25;
        this.sfx.play('laser', b.pos);
      }
      const dir = laserDirection(b.model, new THREE.Vector3());
      dir.y = 0;
      dir.normalize();
      const drop = (b.model.laserMount.getWorldPosition(new THREE.Vector3()).y - b.waterY) / LASER_REACH;
      dir.y = wobble.lift - drop;
      dir.normalize();
      const origin = pointLaserGun(b.model, dir, new THREE.Vector3());
      if (b.isPlayer) this.lastLaserDir = dir;
      const reach = LASER_REACH * Math.hypot(1, drop);
      const wall = this.marchSurface(origin, dir, reach);
      let hit = this.raycastBoats(origin, dir, wall ? wall.t : reach, b);
      if (wall && !hit) {
        const end = wall.point;
        this.fx.beam(origin, end, 0xff2a2a, 0.5, 0.05, 1);
        const gap = b.lastBurn ? b.lastBurn.distanceTo(end) : Infinity;
        if (gap > 0.3) {
          const steps = gap < 5 ? Math.ceil(gap / 0.3) : 1;
          for (let k = 1; k <= steps; k++) {
            const at = steps > 1 ? b.lastBurn.clone().lerp(end, k / steps) : end;
            this.fx.impact('burn', at, wall.normal, 0.8 + Math.random() * 0.3);
          }
          b.lastBurn = end.clone();
        }
        if (Math.random() < 0.5) this.fx.sparkBurst(end.x, end.y, end.z, 0xffb070, 3);
        if (Math.random() < 0.25) this.fx.smoke(end.x + wall.normal.x * 0.4, end.y + 0.3, end.z + wall.normal.z * 0.4);
        continue;
      }
      const shielded = hit && hit.boat.model.sawYaw && this.inArc(hit.boat, hit.boat.items.indexOf('saw'), origin.x, origin.z);
      const end = shielded ? this.shieldAgainst(hit.boat, b) : origin.clone().addScaledVector(dir, hit ? hit.t : reach);
      this.fx.beam(origin, end, 0xff2a2a, 0.5, 0.05, 1);
      let bounce = null;
      if (shielded) {
        b.bounceDrift = (b.bounceDrift ?? Math.random() * 6) + dt * 1.3;
        const swing = Math.sin(b.bounceDrift) * 1.4 + Math.sin(b.bounceDrift * 2.7) * 0.5;
        const back = Math.atan2(-dir.x, -dir.z) + swing;
        const bounceDir = new THREE.Vector3(Math.sin(back), 0, Math.cos(back));
        const bounceHit = this.raycastBoats(end, bounceDir, 60, hit.boat);
        const bounceEnd = end.clone().addScaledVector(bounceDir, bounceHit ? bounceHit.t : 60);
        this.fx.beam(end, bounceEnd, 0xff2a2a, 0.45, 0.05, bounceHit ? 6 : 1);
        bounce = { boat: bounceHit?.boat ?? null, dir: bounceDir };
      }
      if (!hit) {
        if (end.y < waveHeight(end.x, end.z, this.time) + 2) this.fx.scorch(end.x, waveHeight(end.x, end.z, this.time) + 0.15, end.z);
        continue;
      }
      const last = b.laserTicks.get(hit.boat) ?? -Infinity;
      if (this.time - last < 0.35) continue;
      b.laserTicks.set(hit.boat, this.time);
      this.laserHit(b, hit.boat, end, dir, this.time - last > 1 ? 14 : 7, bounce);
    }
  },

  laserHit(b, victim, end, dir, amount, bounce) {
    if (bounce) {
      this.sfx.play('tink', victim.pos);
      this.fx.sparkBurst(end.x, end.y, end.z, 0xffffff, 16);
      this.damage(victim, amount * SAW_LEAK, b, 'laser');
      const stray = bounce?.boat;
      if (stray && !(stray.has('saw') && stray !== b)) {
        this.damage(stray, amount * SAW_LEAK, victim, 'reflect', { knockX: bounce.dir.x, knockZ: bounce.dir.z });
      }
      return;
    }
    this.fx.sparkBurst(end.x, end.y, end.z, 0xff2a2a, 12);
    this.damage(victim, amount, b, 'laser', { knockX: dir.x * 1.5, knockZ: dir.z * 1.5 });
  },
};
