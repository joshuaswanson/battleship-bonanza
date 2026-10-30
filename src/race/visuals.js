import * as THREE from 'three';
import { updateMissileTips, updateMineHolder, stepFire, HULL_L } from '../boatModel.js';
import { waveHeight, isWater } from '../water.js';
import { BASE_SPEED, KO_TIME, approach, clamp, wrapAngle } from './shared.js';

const FORM_IN = 2.6;
const JET_BANK = 1.1;
const JET_BANK_EASE = 4;
const WRECK_ROLL = 1.48;
const WRECK_PITCH = 0.16;
const WRECK_LIFT = 1.5;
const FORM_OUT = 1.1;

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
      const k = Math.min(1.6, ((b.koTime ?? KO_TIME) - b.ko) / KO_TIME);
      const wrecked = this.track.onLand(b.trackS);
      body.rotation.z += ((wrecked ? WRECK_ROLL : Math.PI * 0.95) - body.rotation.z) * ease;
      if (wrecked) body.rotation.x += (WRECK_PITCH - body.rotation.x) * ease;
      else root.position.y -= Math.max(0, k - 0.3) * 4;
    }

    b.squashVel += (-b.squash * 220 - b.squashVel * 11) * dt;
    b.squash += b.squashVel * dt;
    const sq = clamp(b.squash * 0.12, -0.35, 0.35);
    body.scale.set(1 - sq * 0.6, 1 + sq, 1 - sq * 0.6);
    body.position.y = Math.sin(t * 3 + b.index) * 0.05;
    if (b.form) this.updateForm(b, dt);

    const burning = !!(b.burn && b.alive) || (!b.alive && this.track.onLand(b.trackS));
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
    const wetJet = jetOn && this.submerged(b);
    for (const flame of flames) {
      flame.visible = jetOn && !wetJet;
      if (jetOn) flame.scale.set(0.32 + Math.random() * 0.1, 1.6 + Math.random() * 0.8, 0.32 + Math.random() * 0.1);
      if (wetJet) this.jetBubbles(flame);
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

  updateForm(b, dt) {
    const track = this.track;
    const s = track.sAt[track.norm(b.trackIdx)];
    const want = track.formAt(s) ? 1 : 0;
    b.formP = approach(b.formP, want, dt / (want ? FORM_IN : FORM_OUT));
    b.roll += b.speed * dt;
    b.form.set(b.formP, b.roll, -b.steerVis * 0.4, this.time);
    b.model.fire.position.y = b.form.ride;
    const body = b.model.body;
    if (track.onLand(s)) {
      b.form.scorch(b.alive ? 0 : 1);
      body.position.y += b.form.ride * (1 + b.squash * 0.02) + (b.alive ? 0 : WRECK_LIFT * Math.abs(Math.sin(body.rotation.z)));
    } else {
      b.form.scorch(0);
      body.position.y += b.form.ride;
      if (track.formKind(s) === 'jet' && b.formP >= 1) this.bankJet(b, dt);
    }
  },

  bankJet(b, dt) {
    const turn = wrapAngle(b.heading - (b.lastHeading ?? b.heading)) / Math.max(dt, 1e-3);
    b.lastHeading = b.heading;
    b.jetTurn = (b.jetTurn ?? 0) + (turn - (b.jetTurn ?? 0)) * (1 - Math.exp(-JET_BANK_EASE * dt));
    b.model.body.rotation.z = clamp(-b.jetTurn * JET_BANK, -0.5, 0.5) + b.steerVis * 0.14;
    const climb = (b.waterY - (b.lastLevel ?? b.waterY)) / Math.max(dt, 1e-3) / Math.max(30, Math.abs(b.speed));
    b.lastLevel = b.waterY;
    b.jetPitch = (b.jetPitch ?? 0) + (-Math.atan(climb) - (b.jetPitch ?? 0)) * (1 - Math.exp(-JET_BANK_EASE * dt));
    b.model.body.rotation.x = clamp(b.jetPitch, -0.6, 0.6);
  },

  jetBubbles(flame) {
    const r = Math.random;
    const p = flame.getWorldPosition(this.jetPoint);
    for (let k = 0; k < 4; k++) this.fx.puffs.emit(p.x + (r() - 0.5), p.y, p.z + (r() - 0.5), (r() - 0.5) * 7, -3 + r() * 5, (r() - 0.5) * 7, 0.2 + r() * 0.4, 0.8 + r() * 0.6, 0xcff6ff, -9, 0.8, 1);
  },

  boatTrail(b, dt) {
    const fx = Math.sin(b.heading);
    const fz = Math.cos(b.heading);
    for (const flame of b.model.flames) {
      if (!flame.visible) continue;
      const p = flame.getWorldPosition(new THREE.Vector3());
      this.fx.flame(p.x - fx * 0.6, p.y, p.z - fz * 0.6, -fx * 10, -1, -fz * 10);
    }
    if (b.alive && !b.air && Math.abs(b.speed) > 8 && this.track.onLand(b.trackS)) {
      b.wakeTimer -= dt;
      if (b.wakeTimer <= 0) {
        b.wakeTimer = 0.05;
        const t = this.track;
        const i = t.norm(b.trackIdx);
        const mud = t.mudAt(t.sAt[i], (b.pos.x - t.px[i]) * t.nx[i] + (b.pos.z - t.pz[i]) * t.nz[i]);
        const r = Math.random;
        for (const side of [1, -1]) {
          const x = b.pos.x - fx * 3 + fz * side * 2.3;
          const z = b.pos.z - fz * 3 - fx * side * 2.3;
          if (mud > 0.6) {
            for (let k = 0; k < 3; k++) this.fx.puffs.emit(x, b.waterY + 0.4, z, -b.vel.x * 0.1 + (r() - 0.5) * 7 + fz * side * 4, 4 + r() * 7, -b.vel.z * 0.1 + (r() - 0.5) * 7 - fx * side * 4, 0.28 + r() * 0.38, 0.6, mud > 0.685 ? 0x8d9a78 : 0x4a3220, 24, 0.5, 1);
          } else {
            this.fx.puffs.emit(x, b.waterY + 0.5, z, -b.vel.x * 0.12 + (r() - 0.5) * 3, 1.5 + r() * 2.5, -b.vel.z * 0.12 + (r() - 0.5) * 3, 0.8 + r() * 0.8, 0.6, 0xc9a46b, 3, 1.5, 0);
            if (r() < 0.5) this.fx.puffs.emit(x, b.waterY + 0.3, z, -b.vel.x * 0.16 + (r() - 0.5) * 5, 3 + r() * 5, -b.vel.z * 0.16 + (r() - 0.5) * 5, 0.14 + r() * 0.16, 0.5, 0x5e4128, 24, 0.5, 1);
          }
        }
      }
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
