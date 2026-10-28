import * as THREE from 'three';
import { updateMissileTips, updateMineHolder, stepFire, HULL_L } from '../boatModel.js';
import { waveHeight, isWater } from '../water.js';
import { BASE_SPEED, KO_TIME, clamp } from './shared.js';

export const methods = {
  updateVisual(b, dt) {
    const t = this.time;
    const w = waveHeight(b.pos.x, b.pos.z, t);
    b.waterY = w;
    const { root, body, flag, flames, spinners, materials } = b.model;
    const fx = Math.sin(b.heading);
    const fz = Math.cos(b.heading);

    root.position.set(b.pos.x, w + 0.35 + b.yOffset, b.pos.z);
    b.pos.y = root.position.y;
    let spin = 0;
    if (b.spinTime > 0) {
      const k = 1 - b.spinTime / b.spinDur;
      spin = Math.PI * 2 * (1 - (1 - k) * (1 - k));
    }
    root.rotation.y = b.heading + spin;

    const hF = waveHeight(b.pos.x + fx * 3.4, b.pos.z + fz * 3.4, t);
    const hB = waveHeight(b.pos.x - fx * 3.4, b.pos.z - fz * 3.4, t);
    const slope = clamp(hF - hB, -3, 3);
    const lx = Math.cos(b.heading);
    const lz = -Math.sin(b.heading);
    const hL = waveHeight(b.pos.x + lx * 1.8, b.pos.z + lz * 1.8, t);
    const hR = waveHeight(b.pos.x - lx * 1.8, b.pos.z - lz * 1.8, t);
    const onWater = b.air ? 0.2 : 1;
    const speedFrac = clamp(b.speed / BASE_SPEED, -0.3, 1.3);
    const accel = (b.speed - b.prevSpeed) / Math.max(dt, 1e-3);

    const ease = 1 - Math.exp(-8 * dt);
    if (b.alive) {
      let airPitch = 0;
      if (b.air?.fall) airPitch = clamp(-b.air.vy * 0.018, -0.1, 0.55);
      else if (b.air) airPitch = -0.25 * (1 - 2 * Math.min(1, b.air.t / b.air.dur));
      const targetPitch = -Math.atan2(slope, 6.8) * onWater - 0.08 * speedFrac - clamp(accel, -20, 20) * 0.003 + airPitch;
      const targetRoll = Math.atan2(hL - hR, 3.6) * onWater + b.steerVis * 0.2 * clamp(speedFrac, 0, 1);
      body.rotation.x += (targetPitch - body.rotation.x) * ease;
      body.rotation.z += (targetRoll - body.rotation.z) * ease;
    } else {
      const k = 1 - b.ko / KO_TIME;
      body.rotation.z += (Math.PI * 0.95 - body.rotation.z) * ease;
      root.position.y -= Math.max(0, k - 0.3) * 4;
    }

    b.squashVel += (-b.squash * 220 - b.squashVel * 11) * dt;
    b.squash += b.squashVel * dt;
    const sq = clamp(b.squash * 0.12, -0.35, 0.35);
    body.scale.set(1 - sq * 0.6, 1 + sq, 1 - sq * 0.6);
    body.position.y = Math.sin(t * 3 + b.index) * 0.05;

    const burning = !!(b.burn && b.alive);
    b.model.char.value = burning ? 1 : 0;
    stepFire(b.model, burning, t);
    if (b.flash > 0 || materials[0].emissiveIntensity > 0) {
      for (const m of materials) m.emissiveIntensity = b.flash * 0.7;
    }
    root.visible = b.exploded ? false : b.invuln > 0 && b.alive ? Math.floor(b.invuln * 12) % 2 === 0 : true;

    if (b.model.sawYaw) this.updateSaw(b, dt);
    if (b.model.empOrb && b.alive) this.crackle(b, dt);
    this.updateTurrets(b, dt);
    this.updateSulk(b, dt);
    this.updateRegen(b, dt);
    this.updateBurn(b, dt);
    updateMineHolder(b.model, dt);
    updateMissileTips(b.model, dt);

    const jetOn = !!b.air?.jet;
    for (const flame of flames) {
      flame.visible = jetOn;
      if (jetOn) flame.scale.set(0.32 + Math.random() * 0.1, 1.6 + Math.random() * 0.8, 0.32 + Math.random() * 0.1);
    }

    for (const sp of spinners) sp.mesh.rotation[sp.axis] += sp.speed * dt;
    flag.rotation.y = Math.sin(t * 9 + b.index) * 0.25 - b.steerVis * 0.3;
    this.boatTrail(b, dt);

    const h = b.yOffset;
    const shadowSize = (b.alive ? 10.5 : 0) / (1 + h * 0.1);
    b.shadow.position.set(b.pos.x, w + 0.12, b.pos.z);
    b.shadow.scale.set(shadowSize * 0.5, 1, shadowSize);
    b.shadow.rotation.y = b.heading;
    b.shadow.material.opacity = 1 / (1 + h * 0.15);
  },

  boatTrail(b, dt) {
    const fx = Math.sin(b.heading);
    const fz = Math.cos(b.heading);
    for (const flame of b.model.flames) {
      if (!flame.visible) continue;
      const p = flame.getWorldPosition(new THREE.Vector3());
      this.fx.flame(p.x - fx * 0.6, p.y, p.z - fz * 0.6, -fx * 10, -1, -fz * 10);
    }
    if (b.alive && !b.air && Math.abs(b.speed) > 5 && isWater(b.pos.x, b.pos.z)) {
      b.wakeTimer -= dt;
      if (b.wakeTimer <= 0) {
        b.wakeTimer = 0.07;
        const sx = -Math.cos(b.heading);
        const sz = Math.sin(b.heading);
        this.fx.wake(b.pos.x - fx * (HULL_L - 0.3), b.waterY + 0.1, b.pos.z - fz * (HULL_L - 0.3), sx, sz, Math.abs(b.speed));
        this.fx.spray(b.pos.x, b.waterY + 0.3, b.pos.z, fx, fz, sx, sz, Math.abs(b.speed), b.steerVis);
      }
    }
  },
};
