import * as THREE from 'three';
import { updateMissileTips, updateMineHolder, stepFire, HULL_L } from '../boatModel.js';
import { waveHeight, isWater } from '../water.js';
import { LIFT_HANG } from '../track.js';
import { BASE_SPEED, KO_TIME, approach, clamp, wrapAngle } from './shared.js';

const FORM_IN = 2.6;
const JET_BANK = 1.1;
const JET_BANK_EASE = 4;
const WRECK_ROLL = 1.48;
const WRECK_PITCH = 0.16;
const WRECK_LIFT = 1.5;
const FORM_OUT = 1.1;
const SKI_BANK = 0.3;
const SKI_SLIDE = 0.2;
const SKI_MAX_LEAN = 0.2;
const SKI_LIFT = 1.2;
const SKI_EASE = 6;
const SCREW_BUBBLE_RATE = 170;
const SCREW_BUBBLE_RANGE = 220;
const POLE_OUT = 0.3;
const POLE_IN = 0.4;
const POLE_SWAY = 0.035;
const POLE_LEAN = 0.8;
const POLE_MAX_LEAN = 0.36;

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
      else if (b.air && !b.air.lift) airPitch = -0.25 * (1 - 2 * Math.min(1, b.air.t / b.air.dur));
      const targetPitch = -Math.atan2(slope, 6.8) * onWater - 0.08 * speedFrac - clamp(accel, -20, 20) * 0.003 + airPitch;
      const targetRoll = Math.atan2(hL - hR, 3.6) * onWater + b.steerVis * 0.2 * clamp(speedFrac, 0, 1);
      body.rotation.x += (targetPitch - body.rotation.x) * ease;
      body.rotation.z += (targetRoll - body.rotation.z) * ease;
    } else {
      const k = Math.min(1.6, ((b.koTime ?? KO_TIME) - b.ko) / KO_TIME);
      const wrecked = this.track.grounded(b.trackS);
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

    const burning = !!(b.burn && b.alive) || (!b.alive && this.track.grounded(b.trackS));
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
    if (b.form.screw && b.alive && this.submerged(b)) this.screwBubbles(b, dt);
    if (track.grounded(s)) {
      b.form.scorch(b.alive ? 0 : 1);
      body.position.y += b.form.ride * (1 + b.squash * 0.02) + (b.alive ? 0 : WRECK_LIFT * Math.abs(Math.sin(body.rotation.z)));
    } else {
      b.form.scorch(0);
      body.position.y += b.form.ride;
      if (track.formKind(s) === 'jet' && b.formP >= 1) this.bankJet(b, dt);
    }
    if (b.form.hang) {
      const lift = b.air?.lift;
      b.liftHook = approach(b.liftHook ?? 0, lift ? 1 : 0, dt / (lift ? POLE_OUT : POLE_IN));
      if (lift) {
        const i = track.norm(b.trackIdx);
        b.liftOffset = b.air.lane - ((b.pos.x - track.px[i]) * track.nx[i] + (b.pos.z - track.pz[i]) * track.nz[i]);
        const reach = clamp(Math.atan2(b.liftOffset, LIFT_HANG) * POLE_LEAN, -POLE_MAX_LEAN, POLE_MAX_LEAN);
        if (b.alive) body.rotation.z = -reach + POLE_SWAY * Math.sin(this.time * 2.1 + b.index);
      }
      b.form.hang(b.liftHook, b.liftOffset ?? 0, body.rotation.z);
    }
    if (track.onSnow(s) && b.formP >= 1 && !b.air) this.carve(b, dt);
    else if (b.skiSlide) {
      b.skiSlide *= Math.exp(-SKI_EASE * dt);
      if (Math.abs(b.skiSlide) < 0.002) b.skiSlide = 0;
      body.rotation.y = b.skiSlide;
    }
    if (b.rail !== null && b.alive) {
      body.position.y += Math.sin(this.time * 62) * 0.016 + Math.sin(this.time * 27 + b.index) * 0.02;
      this.railSparks(b);
    }
  },

  carve(b, dt) {
    const turn = wrapAngle(b.heading - (b.lastHeading ?? b.heading)) / Math.max(dt, 1e-3);
    b.lastHeading = b.heading;
    b.skiTurn = (b.skiTurn ?? 0) + (turn - (b.skiTurn ?? 0)) * (1 - Math.exp(-SKI_EASE * dt));
    const pace = clamp(Math.abs(b.speed) / BASE_SPEED, 0, 1);
    const lean = clamp(-b.skiTurn * SKI_BANK * pace, -SKI_MAX_LEAN, SKI_MAX_LEAN);
    b.skiSlide = clamp(b.skiTurn * SKI_SLIDE * pace, -0.2, 0.2);
    const body = b.model.body;
    if (b.alive) {
      body.rotation.z = lean;
      body.rotation.y = b.skiSlide;
      body.position.y += Math.abs(lean) * SKI_LIFT;
    }
    b.form.carve(lean, b.skiSlide);
    const r = Math.random;
    const bite = Math.abs(lean) / SKI_MAX_LEAN;
    if (Math.abs(b.speed) < 15) return;
    const outer = lean > 0 ? 1 : -1;
    const fx = Math.sin(b.heading);
    const fz = Math.cos(b.heading);
    for (let k = 0; k < 1 + bite * 3; k++) {
      const u = r() * 5 - 3;
      const x = b.pos.x - fz * outer * 2.7 + fx * u;
      const z = b.pos.z + fx * outer * 2.7 + fz * u;
      const throwOut = 3 + bite * 15 * r();
      this.fx.puffs.emit(x, b.waterY + 0.3, z, -b.vel.x * 0.1 - fz * outer * throwOut, 2 + r() * (3 + bite * 7), -b.vel.z * 0.1 + fx * outer * throwOut, 0.3 + r() * (0.4 + bite * 0.6), 0.55, r() < 0.5 ? 0xffffff : 0xe6f2ff, 8, 1, 0);
    }
  },

  railSparks(b) {
    const r = Math.random;
    if (r() > 0.45 || Math.abs(b.speed) < 15) return;
    const side = r() < 0.5 ? 1 : -1;
    const along = r() < 0.5 ? 2.1 : -2.6;
    const fx = Math.sin(b.heading);
    const fz = Math.cos(b.heading);
    const x = b.pos.x + fz * side * 2.2 + fx * along;
    const z = b.pos.z - fx * side * 2.2 + fz * along;
    this.fx.puffs.emit(x, b.waterY + 0.2, z, -b.vel.x * 0.14 + (r() - 0.5) * 4, 2 + r() * 4, -b.vel.z * 0.14 + (r() - 0.5) * 4, 0.1 + r() * 0.1, 0.32, r() < 0.6 ? 0xffd23f : 0xff8a2a, 20, 0.2, 1);
  },

  bankJet(b, dt) {
    const turn = wrapAngle(b.heading - (b.lastHeading ?? b.heading)) / Math.max(dt, 1e-3);
    b.lastHeading = b.heading;
    b.jetTurn = (b.jetTurn ?? 0) + (turn - (b.jetTurn ?? 0)) * (1 - Math.exp(-JET_BANK_EASE * dt));
    b.model.body.rotation.z = clamp(-b.jetTurn * JET_BANK, -0.5, 0.5) + b.steerVis * 0.14;
    const climb = (b.waterY - (b.lastLevel ?? b.waterY)) / Math.max(dt, 1e-3) / Math.max(30, Math.abs(b.speed));
    b.lastLevel = b.waterY;
    b.jetPitch = (b.jetPitch ?? 0) + (-Math.atan(climb) - (b.jetPitch ?? 0)) * (1 - Math.exp(-JET_BANK_EASE * dt));
    b.model.body.rotation.x = clamp(b.jetPitch, -0.6, 0.6) + (b.form.pitch ?? 0);
  },

  screwBubbles(b, dt) {
    const focus = this.player ?? this.boats[0];
    if (Math.hypot(b.pos.x - focus.pos.x, b.pos.z - focus.pos.z) > SCREW_BUBBLE_RANGE) return;
    const pace = Math.min(1, Math.abs(b.speed) / BASE_SPEED);
    const r = Math.random;
    const p = b.form.screw.getWorldPosition(this.jetPoint);
    for (let k = Math.floor(dt * SCREW_BUBBLE_RATE * (0.25 + 0.75 * pace) + r()); k > 0; k--) {
      const a = this.time * 26 + r() * 1.2;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const lx = Math.cos(b.heading);
      const lz = -Math.sin(b.heading);
      const x = p.x + lx * c * 1.1 - b.vel.x * 0.06;
      const z = p.z + lz * c * 1.1 - b.vel.z * 0.06;
      this.fx.puffs.emit(x, p.y + s * 1.1, z, -b.vel.x * 0.28 + lx * c * 3 + (r() - 0.5) * 3, 1.6 + s * 3 + r() * 2, -b.vel.z * 0.28 + lz * c * 3 + (r() - 0.5) * 3, 0.14 + r() * 0.3, 0.9 + r() * 0.8, 0xdff6ff, -2.5, 1.4, 1);
    }
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
          if (t.river.land.form === 'tank') {
            this.fx.soot.emit(x, b.waterY + 0.5, z, -b.vel.x * 0.12 + (r() - 0.5) * 4, 1.5 + r() * 3, -b.vel.z * 0.12 + (r() - 0.5) * 4, 0.4 + r() * 0.5, 0.6, r() < 0.5 ? 0xd2bd8a : 0xb6a26f, 2, 1.4, 0);
          } else if (mud > 0.6) {
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
