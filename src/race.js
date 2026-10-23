import * as THREE from 'three';
import { ITEMS } from './items.js';
import { buildBoat, buildMine, buildMissile, buildHook, laserWobble, aimLaserGun, aimTurret, SALVO, spendMissile, reloadMissiles, updateMissileTips, missileDirection, stepGun, stepLaser, stepFlame, stepSaw, slotCenter, ALWAYS_AIMS, flameDirection, newHeat, gunDirection, laserDirection, launchMine, reloadMine, updateMineHolder, HULL_L } from './boatModel.js';
import { waveHeight, isWater } from './water.js';
import { createAI, driveAI } from './ai.js';
import { toon, glow } from './toon.js';
import { fast } from './tuning.js';
import { t as tr } from './i18n.js';
import { TrackFeatures } from './features.js';
import { Wakes } from './wake.js';

export const LAPS = 3;
export const MAX_HP = 100;
export const BASE_SPEED = fast(44);
const ARMOR_SPEED = 0.95;
const FLAME_REACH = 15;
const BURN_TIME = 3;
const BURN_DPS = 5;
const BLAST_RADIUS = 24;
const REGEN_DELAY = 3;
const REGEN_START = 2;
const REGEN_RAMP = 4;
const REGEN_MAX = 22;
const OFF_COURSE_SPEED = 0.35;
const OUTER_LIMIT = 45;
const BANK_MARGIN = 2.5;
const FALL_GRAVITY = 42;
const SHORE_MARGIN = 2.2;
const SAW_LEAK = 0.4;
const EASY_HOOK = (o) => o.has('spikes') || o.has('jetpack');
const REVERSE_SPEED = fast(14);
const ACCEL = fast(22);
const BRAKE = fast(40);
const COAST = fast(9);
const TURN_RATE = 2.1;
const BULLET_SPEED = fast(150);
const HOOK_SPEED = fast(150);
const GRIP = 3.6;
const RADIUS = 2.05;
const CIRCLE_OFFSET = 1.9;
const HIT_RADIUS = 2.1;
const AXIS_HALF = 3.4;
const KO_TIME = 2.2;
const LASER_REACH = 75;
const DODGE_WINDOW = 0.45;
const SAW_RANGE = 9;
const WATCH_RANGE = 80;
const HALF_ARC = Math.PI / 2;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const approach = (v, target, step) => (v < target ? Math.min(target, v + step) : Math.max(target, v - step));
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));


const ROPE_GEOMETRY = new THREE.CylinderGeometry(0.07, 0.07, 1, 6, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.5);
const ROPE_MATERIAL = toon(0x34465e);

let shadowTexture;
function shadowMaterial() {
  if (!shadowTexture) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(8,40,70,0.45)');
    g.addColorStop(0.6, 'rgba(8,40,70,0.25)');
    g.addColorStop(1, 'rgba(8,40,70,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    shadowTexture = new THREE.CanvasTexture(canvas);
  }
  return new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false });
}
const SHADOW_GEOMETRY = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);

class Boat {
  constructor(def, index, scene) {
    this.index = index;
    this.name = def.name;
    this.color = def.color;
    this.items = def.items;
    this.isPlayer = !!def.isPlayer;
    this.model = buildBoat(def.color, def.items);
    scene.add(this.model.root);
    this.turrets = this.model.swivels
      .filter((s) => s.id !== 'saw' && s.id !== 'jetpack')
      .map((s) => ({ id: s.id, group: s.group, center: s.center }));
    this.aim = {};
    this.missileQueue = [];
    this.attackRolls = new Map();
    this.lastFired = -Infinity;
    this.regenerating = false;
    this.disabled = 0;
    this.stats = { dealt: 0, sunk: 0, kills: 0 };
    this.shadow = new THREE.Mesh(SHADOW_GEOMETRY, shadowMaterial());
    this.shadow.renderOrder = 1;
    scene.add(this.shadow);

    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.heading = 0;
    this.speed = 0;
    this.prevSpeed = 0;
    this.yOffset = 0;
    this.waterY = 0;
    this.hp = MAX_HP;
    this.cooldowns = [0, 0];
    this.control = { throttle: 0, steer: 0 };
    this.steerVis = 0;
    this.skill = 1;
    this.ai = createAI();

    this.air = null;
    this.spinTime = 0;
    this.spinDur = 1;
    this.stun = 0;
    this.boost = 0;
    this.sawState = { spin: 0, yaw: 0, tick: 0, shield: 0, shieldYaw: 0, sound: 0 };
    this.sawHeat = newHeat();
    this.gun = newHeat();
    this.laser = newHeat();
    this.flame = newHeat();
    this.flameTicks = new Map();
    this.flameHum = 0;
    this.burn = null;
    this.exploded = false;
    this.laserTicks = new Map();
    this.laserHum = 0;
    this.ko = 0;
    this.invuln = 0;
    this.flash = 0;
    this.squash = 0;
    this.squashVel = 0;
    this.wakeTimer = 0;
    this.bumpCooldown = new Map();

    this.trackIdx = 0;
    this.trackS = 0;
    this.dist = 0;
    this.lap = 1;
    this.finished = false;
    this.finishTime = 0;
    this.finishOrder = 0;
    this.place = index + 1;
    this.wrongWay = 0;
    this.offCourse = 0;
  }

  has(id) {
    return this.items.includes(id);
  }

  get alive() {
    return this.ko <= 0;
  }

  local(x, y, z, out = new THREE.Vector3()) {
    const c = Math.cos(this.heading);
    const s = Math.sin(this.heading);
    return out.set(this.pos.x + c * x + s * z, this.waterY + 0.35 + this.yOffset + y, this.pos.z - s * x + c * z);
  }

  center(out = new THREE.Vector3()) {
    return this.local(0, 0.9, 0, out);
  }

  distanceToAxis(point) {
    const fx = Math.sin(this.heading);
    const fz = Math.cos(this.heading);
    const cy = this.waterY + 0.35 + this.yOffset + 0.9;
    const dx = point.x - this.pos.x;
    const dy = point.y - cy;
    const dz = point.z - this.pos.z;
    const along = clamp(dx * fx + dz * fz, -AXIS_HALF, AXIS_HALF);
    return Math.hypot(dx - fx * along, dy, dz - fz * along);
  }

  distanceToAxis2D(x, z) {
    const fx = Math.sin(this.heading);
    const fz = Math.cos(this.heading);
    const dx = x - this.pos.x;
    const dz = z - this.pos.z;
    const along = clamp(dx * fx + dz * fz, -AXIS_HALF, AXIS_HALF);
    return Math.hypot(dx - fx * along, dz - fz * along);
  }

  bump(amount) {
    this.squashVel -= amount;
  }
}

export class Race {
  constructor({ scene, track, fx, sfx, defs, shores = [], attract = false, laps = LAPS }) {
    this.shores = shores;
    this.scene = scene;
    this.track = track;
    this.fx = fx;
    this.sfx = sfx;
    this.attract = attract;
    this.laps = attract ? Infinity : laps;
    this.boats = defs.map((def, i) => new Boat(def, i, scene));
    this.player = this.boats.find((b) => b.isPlayer) ?? null;
    this.bullets = [];
    this.missiles = [];
    this.mines = [];
    this.hooks = [];
    this.pulses = [];
    this.events = [];
    this.time = 0;
    this.clock = 0;
    this.finishCount = 0;
    this.state = attract ? 'racing' : 'countdown';
    this.countdown = 4.2;
    this.lastCount = 5;
    this.order = [...this.boats];

    const streak = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true).rotateX(Math.PI / 2).translate(0, 0, -0.5);
    const tracer = (color) => new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    this.bulletMesh = new THREE.InstancedMesh(streak, tracer(0xffe066), 400);
    this.bulletOutline = new THREE.InstancedMesh(streak, tracer(0xffffff), 400);
    for (const mesh of [this.bulletMesh, this.bulletOutline]) {
      mesh.frustumCulled = false;
      mesh.count = 0;
      scene.add(mesh);
    }

    this.features = new TrackFeatures(scene, track, fx, sfx);
    this.wakes = new Wakes(scene);
    this.placeGrid();
  }

  placeGrid() {
    const t = this.track;
    this.boats.forEach((b, i) => {
      const row = Math.floor(i / 2);
      const col = i % 2;
      const s = t.length - 20 - row * 17;
      const idx = t.wrap(Math.round(s / t.spacing));
      const p = t.point(idx, (col ? 1 : -1) * 10);
      b.pos.set(p.x, 0, p.z);
      b.heading = t.heading(idx);
      b.trackIdx = idx;
      b.trackS = idx * t.spacing;
      b.dist = b.trackS - t.length;
      b.waterY = waveHeight(p.x, p.z, 0);
    });
  }

  emit(type, data = {}) {
    this.events.push({ type, ...data });
  }

  update(dt, time, input) {
    this.time = time;

    if (this.state === 'countdown') {
      this.countdown -= dt;
      const n = Math.ceil(this.countdown);
      if (n !== this.lastCount && n <= 3 && n >= 1) {
        this.lastCount = n;
        this.emit('count', { n });
        this.sfx.play('beep');
      }
      if (this.countdown <= 0) {
        this.state = 'racing';
        this.emit('go');
        this.sfx.play('go');
      }
    } else {
      this.clock += dt;
    }

    for (const b of this.boats) {
      if (b.isPlayer && !b.finished && input) {
        b.control.throttle = input.throttle;
        b.control.steer = input.steer;
        if (input.use0) this.useItem(b, 0);
        if (input.use1) this.useItem(b, 1);
        b.gun.trigger = (input.hold0 && b.items[0] === 'machinegun') || (input.hold1 && b.items[1] === 'machinegun');
        b.laser.trigger = (input.hold0 && b.items[0] === 'laser') || (input.hold1 && b.items[1] === 'laser');
        b.flame.trigger = (input.hold0 && b.items[0] === 'flamethrower') || (input.hold1 && b.items[1] === 'flamethrower');
        b.sawHeat.trigger = (input.hold0 && b.items[0] === 'saw') || (input.hold1 && b.items[1] === 'saw');
      } else if (b.alive) {
        driveAI(this, b, dt);
      }
    }

    for (const b of this.boats) this.updateBoat(b, dt);
    this.whitecaps(dt);
    this.collideBoats();
    this.updateBullets(dt);
    this.updateMissiles(dt);
    this.updateMines(dt);
    this.updateHooks(dt);
    this.updatePulses(dt);
    this.updateLasers(dt);
    this.updateFlames(dt);
    this.features.update(this, dt, this.time);
    for (const b of this.boats) this.updateVisual(b, dt);
    this.wakes.update(this.boats, this.time);
    this.updateStandings();
  }

  updateBoat(b, dt) {
    const t = this.track;
    for (let i = 0; i < 2; i++) {
      const was = b.cooldowns[i];
      b.cooldowns[i] = Math.max(0, was - dt);
      if (was > 0 && b.cooldowns[i] === 0 && b.items[i] === 'mines') reloadMine(b.model);
      if (was > 0 && b.cooldowns[i] === 0 && b.items[i] === 'missiles') reloadMissiles(b.model);
    }
    b.invuln = Math.max(0, b.invuln - dt);
    b.flash = Math.max(0, b.flash - dt * 5);
    b.stun -= dt;
    b.boost -= dt;
    b.prevSpeed = b.speed;

    if (!b.alive) {
      b.ko -= dt;
      const damp = Math.exp(-3 * dt);
      b.vel.multiplyScalar(damp);
      b.speed *= damp;
      b.pos.addScaledVector(b.vel, dt);
      if (Math.random() < 0.6) this.fx.bubbles(b.pos.x, b.waterY + 0.2, b.pos.z);
      if (b.ko <= 0) this.respawn(b);
      return;
    }

    if (this.state === 'countdown') {
      b.speed = 0;
      b.vel.set(0, 0, 0);
      return;
    }

    const controllable = b.spinTime <= 0;
    let max = BASE_SPEED * b.skill;
    if (b.has('armor')) max *= ARMOR_SPEED;
    if (b.boost > 0) max *= 1.3;
    if (b.air?.jet) max *= 1.15;
    if (b.stun > 0) max *= 0.5;
    if (this.isTethered(b)) max *= 0.8;
    if (b.offCourse > 0) max *= OFF_COURSE_SPEED;

    const throttle = controllable ? b.control.throttle : 0;
    const target = throttle >= 0 ? throttle * max : throttle * REVERSE_SPEED;
    let rate = target > b.speed ? ACCEL : BRAKE;
    if (throttle === 0) rate = COAST;
    if (b.boost > 0 && target > b.speed) rate *= 2;
    b.speed = approach(b.speed, target, rate * dt);

    const steer = controllable ? b.control.steer : 0;
    b.steerVis += (steer - b.steerVis) * (1 - Math.exp(-8 * dt));
    const speedFrac = clamp(b.speed / BASE_SPEED, 0, 1);
    const turn = clamp(Math.abs(b.speed) / 14, 0.25, 1) * (b.air ? 0.6 : 1) * (1 - 0.2 * speedFrac);
    b.heading -= steer * TURN_RATE * turn * dt * (b.speed < -0.5 ? -1 : 1);

    const fx = Math.sin(b.heading);
    const fz = Math.cos(b.heading);
    const k = 1 - Math.exp(-(b.air ? 1 : GRIP) * dt);
    b.vel.x += (fx * b.speed - b.vel.x) * k;
    b.vel.z += (fz * b.speed - b.vel.z) * k;

    if (b.has('machinegun')) this.updateGun(b, dt);


    b.pos.x += b.vel.x * dt;
    b.pos.z += b.vel.z * dt;

    if (b.air?.fall) {
      b.air.vy -= FALL_GRAVITY * dt;
      b.air.y += b.air.vy * dt;
      b.yOffset = b.air.y - (b.surfaceLevel ?? 0);
      if (b.yOffset <= 0) {
        b.yOffset = 0;
        b.air = null;
        b.bump(8);
        this.fx.splash(b.pos.x, b.waterY, b.pos.z, 2.2);
        this.fx.splash(b.pos.x + Math.sin(b.heading) * 4, b.waterY, b.pos.z + Math.cos(b.heading) * 4, 1.2);
        this.sfx.play('splash', b.pos);
        if (b.isPlayer) this.emit('lockShake', { amount: 1.2 });
      }
    } else if (b.air) {
      b.air.t += dt;
      const u = b.air.t / b.air.dur;
      b.yOffset = b.air.peak * 4 * u * (1 - u);
      if (u >= 1) {
        b.yOffset = 0;
        b.air = null;
        b.bump(5);
        this.fx.splash(b.pos.x, b.waterY, b.pos.z, 1.5);
        this.fx.splash(b.pos.x + Math.sin(b.heading) * 3, b.waterY, b.pos.z + Math.cos(b.heading) * 3, 0.8);
        this.sfx.play('splash', b.pos);
      }
    }
    if (b.spinTime > 0) b.spinTime -= dt;

    const pr = t.project(b.pos.x, b.pos.z, b.trackIdx);
    let ds = pr.s - b.trackS;
    if (ds < -t.length / 2) ds += t.length;
    else if (ds > t.length / 2) ds -= t.length;
    b.dist += ds;
    b.trackS = pr.s;
    b.trackIdx = pr.idx;
    if (t.river) this.followRiver(b, pr.s);

    b.offCourse = Math.abs(pr.lateral) > t.halfWidth + 1.5 ? b.offCourse + dt : 0;
    if (b.offCourse > 0 && b.speed > OFF_COURSE_SPEED * BASE_SPEED) b.speed *= Math.exp(-1.5 * dt);
    this.collideShores(b);

    const lim = t.halfWidth + (t.river ? -BANK_MARGIN : OUTER_LIMIT);
    if (Math.abs(pr.lateral) > lim) {
      const sgn = Math.sign(pr.lateral);
      const nx = t.nx[pr.idx];
      const nz = t.nz[pr.idx];
      const over = pr.lateral - sgn * lim;
      b.pos.x -= nx * over;
      b.pos.z -= nz * over;
      const vn = (b.vel.x * nx + b.vel.z * nz) * sgn;
      if (vn > 0) {
        b.vel.x -= nx * sgn * vn * 1.5;
        b.vel.z -= nz * sgn * vn * 1.5;
        if (vn > 9) {
          b.speed *= 0.85;
          b.bump(3);
          this.fx.splash(b.pos.x, b.waterY, b.pos.z, 0.6);
          this.sfx.play('boing', b.pos);
        }
      }
    }

    if (b.isPlayer) {
      const facing = fx * t.tx[pr.idx] + fz * t.tz[pr.idx];
      b.wrongWay = facing < -0.3 && b.speed > 4 ? b.wrongWay + dt : 0;
    }
  }

  followRiver(b, s) {
    const t = this.track;
    const level = t.level(s);
    const before = b.surfaceLevel ?? level;
    if (before - level > 2) {
      let vy = 3;
      if (b.air?.fall) vy = b.air.vy;
      else if (b.air) vy = (b.air.peak * 4 * (1 - (2 * b.air.t) / b.air.dur)) / b.air.dur;
      b.air = { fall: true, y: before + b.yOffset, vy };
      if (b.isPlayer) this.emit('falls');
    }
    b.surfaceLevel = level;
    if (t.onLift(s) && !b.air) {
      b.speed = Math.max(b.speed, BASE_SPEED * 1.05);
      b.boost = Math.max(b.boost, 0.15);
    }
  }

  collideShores(b) {
    for (const blob of this.shores) {
      const dx = b.pos.x - blob.x;
      const dz = b.pos.z - blob.z;
      if (Math.abs(dx) > blob.rx + blob.rz + 4 || Math.abs(dz) > blob.rx + blob.rz + 4) continue;
      const c = Math.cos(blob.rot);
      const s = Math.sin(blob.rot);
      const lx = dx * c - dz * s;
      const lz = dx * s + dz * c;
      const ax = blob.rx + SHORE_MARGIN;
      const az = blob.rz + SHORE_MARGIN;
      const q = Math.hypot(lx / ax, lz / az);
      if (q >= 1 || q === 0) continue;
      const px = lx / q;
      const pz = lz / q;
      b.pos.x = blob.x + px * c + pz * s;
      b.pos.z = blob.z - px * s + pz * c;
      let gx = px / (ax * ax);
      let gz = pz / (az * az);
      const nx = gx * c + gz * s;
      const nz = -gx * s + gz * c;
      const len = Math.hypot(nx, nz);
      const ux = nx / len;
      const uz = nz / len;
      const vn = b.vel.x * ux + b.vel.z * uz;
      if (vn < 0) {
        b.vel.x -= ux * vn * 1.6;
        b.vel.z -= uz * vn * 1.6;
        if (vn < -6) {
          b.speed *= 0.6;
          b.bump(4);
          this.fx.splash(b.pos.x, b.waterY, b.pos.z, 0.7);
          this.sfx.play('boing', b.pos);
        }
      }
    }
  }

  courseReturnPoint(b) {
    const t = this.track;
    const idx = t.wrap(b.trackIdx + Math.round(12 / t.spacing));
    const pr = t.project(b.pos.x, b.pos.z, b.trackIdx);
    return t.point(idx, Math.sign(pr.lateral) * (t.halfWidth - 6));
  }

  respawn(b) {
    const t = this.track;
    const idx = t.wrap(b.trackIdx - 10);
    let lateral = 0;
    for (const candidate of [0, -10, 10, -18, 18]) {
      const p = t.point(idx, candidate);
      if (this.boats.every((o) => o === b || Math.hypot(o.pos.x - p.x, o.pos.z - p.z) > 9)) {
        lateral = candidate;
        break;
      }
    }
    const p = t.point(idx, lateral);
    b.pos.set(p.x, 0, p.z);
    b.heading = t.heading(idx);
    b.vel.set(0, 0, 0);
    b.speed = 12;
    b.hp = MAX_HP;
    b.invuln = 2;
    b.air = null;
    b.surfaceLevel = null;
    b.yOffset = 0;
    b.spinTime = 0;
    b.stun = 0;
    b.gun.trigger = false;
    b.laser.trigger = false;
    b.flame.trigger = false;
    b.sawHeat.trigger = false;
    b.exploded = false;
    const s = idx * t.spacing;
    let ds = s - b.trackS;
    if (ds < -t.length / 2) ds += t.length;
    else if (ds > t.length / 2) ds -= t.length;
    b.dist += ds;
    b.trackS = s;
    b.trackIdx = idx;
    b.model.body.rotation.set(0, 0, 0);
    b.bump(6);
    this.fx.splash(p.x, b.waterY, p.z, 1);
  }

  collideBoats() {
    const boats = this.boats;
    for (let i = 0; i < boats.length; i++) {
      const a = boats[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < boats.length; j++) {
        const b = boats[j];
        if (!b.alive) continue;
        if (Math.abs(a.yOffset - b.yOffset) > 2.5) continue;
        let best = null;
        for (const oa of [-CIRCLE_OFFSET, CIRCLE_OFFSET]) {
          for (const ob of [-CIRCLE_OFFSET, CIRCLE_OFFSET]) {
            const dx = b.pos.x + Math.sin(b.heading) * ob - (a.pos.x + Math.sin(a.heading) * oa);
            const dz = b.pos.z + Math.cos(b.heading) * ob - (a.pos.z + Math.cos(a.heading) * oa);
            const d2 = dx * dx + dz * dz;
            if (d2 > 0 && (!best || d2 < best.d2)) best = { dx, dz, d2 };
          }
        }
        const min = RADIUS * 2;
        if (!best || best.d2 >= min * min) continue;
        const d = Math.sqrt(best.d2);
        const nx = best.dx / d;
        const nz = best.dz / d;
        const ma = a.has('armor') ? 2 : 1;
        const mb = b.has('armor') ? 2 : 1;
        const overlap = min - d;
        a.pos.x -= nx * overlap * (mb / (ma + mb));
        a.pos.z -= nz * overlap * (mb / (ma + mb));
        b.pos.x += nx * overlap * (ma / (ma + mb));
        b.pos.z += nz * overlap * (ma / (ma + mb));
        const rel = (b.vel.x - a.vel.x) * nx + (b.vel.z - a.vel.z) * nz;
        if (rel < 0) {
          const impulse = (-(1.5 * rel) / (1 / ma + 1 / mb)) + 5;
          a.vel.x -= (nx * impulse) / ma;
          a.vel.z -= (nz * impulse) / ma;
          b.vel.x += (nx * impulse) / mb;
          b.vel.z += (nz * impulse) / mb;
          if (-rel > 5) {
            a.bump(3);
            b.bump(3);
            this.sfx.play('boing', a.pos);
            this.fx.splash((a.pos.x + b.pos.x) / 2, a.waterY, (a.pos.z + b.pos.z) / 2, 0.8);
          }
        }
        if (a.has('spikes')) this.spikeHit(a, b, nx, nz);
        if (b.has('spikes')) this.spikeHit(b, a, -nx, -nz);
      }
    }
  }

  spikeHit(owner, victim, nx, nz) {
    const ready = victim.bumpCooldown.get(owner) ?? 0;
    if (this.time < ready) return;
    victim.bumpCooldown.set(owner, this.time + 0.8);
    this.damage(victim, 14, owner, 'spikes', { knockX: nx * 12, knockZ: nz * 12, spin: 0.6 });
  }

  damage(target, amount, source, kind, { knockX = 0, knockZ = 0, spin = 0, stun = 0, launch = 0 } = {}) {
    if (!target.alive || target.invuln > 0 || (target.finished && !this.attract)) return false;
    const c = target.center();
    const blocked = (target.has('armor') && (kind === 'bullet' || kind === 'spikes' || kind === 'saw')) || (target.has('spikes') && kind === 'saw');
    if (blocked) {
      this.fx.sparkBurst(c.x, c.y, c.z, 0xffffff, kind === 'bullet' ? 4 : 14);
      this.sfx.play(kind === 'bullet' ? 'tink' : 'clank', target.pos);
      return false;
    }
    if (kind === 'missile' && target.has('armor')) {
      amount *= 0.5;
      launch *= 0.5;
      spin = 0;
      this.fx.sparkBurst(c.x, c.y, c.z, 0xffffff, 10);
      this.sfx.play('clank', target.pos);
    }
    target.hp -= amount;
    if (source !== target) source.stats.dealt += amount;
    if (source.isPlayer && source !== target) this.emit('dmg', { target, amount });
    target.flash = 1;
    const light = kind === 'bullet' || kind === 'flame' || kind === 'fire';
    target.bump(light ? 1.5 : 5);
    if (!light && !target.air) this.fx.splash(target.pos.x, target.waterY, target.pos.z, 0.6);
    target.vel.x += knockX;
    target.vel.z += knockZ;
    const SLOWDOWN = { bullet: 0.97, saw: 0.94, laser: 0.97, reflect: 0.97, flame: 0.97, fire: 1 };
    target.speed *= SLOWDOWN[kind] ?? 0.7;
    if (spin && target.spinTime <= 0) {
      target.spinTime = spin;
      target.spinDur = spin;
    }
    if (stun) target.stun = Math.max(target.stun, stun);
    if (launch && !target.air) target.air = { t: 0, dur: launch, peak: launch * 6, jet: false };
    if (kind !== 'flame' && kind !== 'fire') this.sfx.play('hit', target.pos);
    if (target.isPlayer) this.emit('hurt', { amount, kind, source: source.name });
    if (target.hp <= 0) this.knockOut(target, source, kind);
    return true;
  }

  knockOut(b, source, kind) {
    b.hp = 0;
    b.ko = KO_TIME;
    b.stats.sunk++;
    if (source !== b) source.stats.kills++;
    b.air = null;
    b.yOffset = 0;
    b.gun.trigger = false;
    b.laser.trigger = false;
    b.flame.trigger = false;
    b.sawHeat.trigger = false;
    b.burn = null;
    for (const h of this.hooks) if (h.target === b || h.owner === b) h.phase = 'retract';
    const c = b.center();
    if (b.has('flamethrower')) {
      b.exploded = true;
      this.propaneBlast(b);
    } else {
      this.fx.explosion(c.x, c.y, c.z, 0.8);
      this.sfx.play('pop', b.pos);
    }
    this.emit('feed', { text: tr(`feed_${kind}`, { a: source.name, b: b.name }), player: b.isPlayer || source.isPlayer });
    if (b.isPlayer) this.emit('ko', { source: source.name });
  }

  isTethered(b) {
    return this.hooks.some((h) => h.phase === 'attached' && h.target === b);
  }

  findTarget(b, { range, minDot = -1, maxDot = 1, filter = null, minRange = 0 }) {
    let best = null;
    let bestD = range;
    const fx = Math.sin(b.heading);
    const fz = Math.cos(b.heading);
    for (const o of this.boats) {
      if (o === b || !o.alive || o.invuln > 0 || (o.finished && !this.attract)) continue;
      const dx = o.pos.x - b.pos.x;
      const dz = o.pos.z - b.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > bestD || d < minRange || d === 0) continue;
      const dot = (dx * fx + dz * fz) / d;
      if (dot < minDot || dot > maxDot) continue;
      if (filter && !filter(o)) continue;
      best = o;
      bestD = d;
    }
    return best;
  }

  useItem(b, slot) {
    const id = b.items[slot];
    const item = ITEMS[id];
    if (!item || item.passive || item.hold || this.state !== 'racing' || !b.alive) return false;
    if (b.disabled > 0 && item.group === 'weapons') {
      if (b.isPlayer) this.sfx.play('nope');
      return false;
    }
    if (b.cooldowns[slot] > 0) {
      if (b.isPlayer) this.sfx.play('nope');
      return false;
    }
    if (this.actions[id].call(this, b) === false) return false;
    b.cooldowns[slot] = item.cooldown;
    b.lastFired = this.time;
    return true;
  }

  actions = {
    missiles(b) {
      const targets = this.boats
        .filter((o) => o !== b && o.alive && o.invuln <= 0 && !o.has('camo') && !(o.finished && !this.attract) && this.willAttack(b, o))
        .map((o) => ({ o, d: Math.hypot(o.pos.x - b.pos.x, o.pos.z - b.pos.z) }))
        .filter((t) => t.d <= 180)
        .sort((x, y) => x.d - y.d)
        .slice(0, SALVO)
        .map((t) => t.o);
      b.model.busy.missiles = 1.4;
      b.missileAim = targets.length ? this.relativeAngle(b, targets[0]) : 0;
      for (let i = 0; i < SALVO; i++) b.missileQueue.push({ target: targets.length ? targets[i % targets.length] : null, wait: 0.28 + i * 0.13 });
    },

    mines(b) {
      const pos = b.model.mineMount.getWorldPosition(new THREE.Vector3());
      const mesh = buildMine();
      this.scene.add(mesh);
      const front = b.items.indexOf('mines') === 0;
      const yaw = b.heading + (front ? 0 : b.model.swivels.find((s) => s.id === 'mines').group.rotation.y);
      const push = front ? 12 : 8;
      const carry = front ? 1 : 0.4;
      const vel = new THREE.Vector3(Math.sin(yaw) * push + b.vel.x * carry, 10, Math.cos(yaw) * push + b.vel.z * carry);
      launchMine(b.model);
      this.mines.push({ pos, vel, owner: b, age: 0, settled: false, mesh });
      const own = this.mines.filter((m) => m.owner === b);
      if (own.length > 4) this.removeMine(own[0], true);
      this.sfx.play('plop', b.pos);
    },

    grapple(b) {
      aimTurret(b.model, 'grapple');
      const target = this.findTarget(b, this.hookSpec(b));
      const anchor = target ? this.nearestHookMarker(target, b.pos) : null;
      const mesh = buildHook();
      b.model.hookHead.visible = false;
      const rope = new THREE.Mesh(ROPE_GEOMETRY, ROPE_MATERIAL);
      rope.frustumCulled = false;
      this.scene.add(mesh, rope);
      this.hooks.push({
        owner: b,
        target,
        anchor,
        pos: b.model.hookMount.getWorldPosition(new THREE.Vector3()),
        dir: new THREE.Vector3(Math.sin(b.heading), 0.05, Math.cos(b.heading)),
        phase: 'fly',
        travelled: 0,
        time: 0,
        mesh,
        rope,
      });
      this.sfx.play('hook', b.pos);
      if (target?.isPlayer) this.emit('warning', { text: tr('hookIncoming') });
    },

    emp(b) {
      this.pulses.push({ owner: b, age: 0, life: 0.5, radius: 26, jolted: new Set() });
      this.fx.followRing(b.pos, 0x5ff4ff, 26, 0.7);
      this.fx.followRing(b.pos, 0xffffff, 18, 0.55);
      this.fx.shell(b.pos, 0x5ff4ff, 26, 0.7);
      const c = b.center();
      for (let i = 0; i < 3; i++) this.fx.sparkBurst(c.x, c.y, c.z, 0x5ff4ff, 8);
      this.sfx.play('emp', b.pos);
    },

    jetpack(b) {
      if (b.air) return false;
      this.tryDodge(b);
      b.air = { t: 0, dur: 1.5, peak: 7, jet: true };
      b.speed += fast(12);
      b.boost = Math.max(b.boost, 1.5);
      this.fx.splash(b.pos.x, b.waterY, b.pos.z, 1.2);
      this.sfx.play('whoosh', b.pos);
    },
  };

  raycastBoats(origin, dir, range, ignore) {
    const p = new THREE.Vector3();
    for (let t = 0; t <= range; t += 0.75) {
      p.copy(origin).addScaledVector(dir, t);
      for (const o of this.boats) {
        if (o === ignore || !o.alive) continue;
        if (o.distanceToAxis(p) < HIT_RADIUS + 0.3) return { boat: o, t };
      }
    }
    return null;
  }

  updateGun(b, dt) {
    if (this.state !== 'racing' || !b.alive || b.disabled > 0) b.gun.trigger = false;
    const { shots, overheatedNow } = stepGun(b.gun, b.model, dt, this.time);
    for (let i = 0; i < shots; i++) this.fireBullet(b);
    if (shots) b.lastFired = this.time;
    if (overheatedNow) {
      this.sfx.play('overheat', b.pos);
      if (b.isPlayer) this.emit('warning', { text: tr('overheatedWarn') });
    }
    if (b.gun.overheated && Math.random() < 0.4) {
      const p = b.model.gunMount.getWorldPosition(new THREE.Vector3());
      this.fx.smoke(p.x, p.y + 0.3, p.z);
    }
  }

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
  }

  ejectCasing(refs, carry) {
    const swivel = refs.gunSwivel;
    const port = swivel.localToWorld(new THREE.Vector3(-0.55, 0.7, 0.1));
    const side = new THREE.Vector3(-1, 0, 0).applyQuaternion(swivel.getWorldQuaternion(new THREE.Quaternion()));
    this.fx.casing(port, side, carry);
  }

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
  }

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
      } else {
        m.target = null;
        m.dir.y = approach(m.dir.y, -0.04, dt);
        m.dir.normalize();
      }
      m.pos.addScaledVector(m.dir, m.speed * dt);
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
  }

  explodeMissile(m, victim, power) {
    this.fx.explosion(m.pos.x, m.pos.y, m.pos.z, power * 0.7);
    this.sfx.play('boom', m.pos);
    this.scene.remove(m.mesh);
    if (victim) {
      this.damage(victim, 11, m.owner, 'missile', { knockX: m.dir.x * 6, knockZ: m.dir.z * 6, stun: 0.2 });
    }
    return false;
  }

  removeMine(mine, puff = false) {
    this.scene.remove(mine.mesh);
    this.mines = this.mines.filter((m) => m !== mine);
    if (puff) this.fx.smoke(mine.pos.x, mine.pos.y + 0.5, mine.pos.z);
  }

  updateMines(dt) {
    for (const mine of [...this.mines]) {
      mine.age += dt;
      const water = waveHeight(mine.pos.x, mine.pos.z, this.time);
      if (!mine.settled) {
        mine.vel.y -= 25 * dt;
        mine.pos.addScaledVector(mine.vel, dt);
        mine.mesh.rotation.x += dt * 7;
        mine.mesh.rotation.z += dt * 4.5;
        if (mine.pos.y <= water) {
          mine.settled = true;
          this.fx.splash(mine.pos.x, water, mine.pos.z, 0.4);
        }
      } else {
        mine.pos.y = water - 0.35;
      }
      mine.mesh.position.copy(mine.pos);
      mine.mesh.rotation.y += dt * 0.6;
      if (mine.settled) {
        const settle = 1 - Math.exp(-4 * dt);
        mine.mesh.rotation.x += (0 - mine.mesh.rotation.x % (Math.PI * 2)) * settle;
        mine.mesh.rotation.z += (Math.sin(this.time * 2 + mine.age) * 0.12 - mine.mesh.rotation.z % (Math.PI * 2)) * settle;
      }
      const armed = mine.age > 0.8;
      mine.mesh.userData.light.visible = armed ? (mine.age * 3) % 1 < 0.5 : true;

      if (armed && mine.settled) {
        for (const o of this.boats) {
          if (!o.alive || o.yOffset > 1.6) continue;
          if (o === mine.owner && mine.age < 2.5) continue;
          if (o.distanceToAxis2D(mine.pos.x, mine.pos.z) < 3.4) {
            this.fx.explosion(mine.pos.x, water + 0.5, mine.pos.z, 1.2);
            this.sfx.play('boom', mine.pos);
            this.damage(o, 40, mine.owner, 'mine', { spin: 1, launch: 0.9 });
            this.removeMine(mine);
            break;
          }
        }
      }
      if (mine.age > 45 && this.mines.includes(mine)) this.removeMine(mine, true);
    }
  }

  updateHooks(dt) {
    const from = new THREE.Vector3();
    const c = new THREE.Vector3();
    this.hooks = this.hooks.filter((h) => {
      const o = h.owner;
      o.model.hookMount.getWorldPosition(from);
      if (!o.alive && h.phase !== 'retract') h.phase = 'retract';

      if (h.phase === 'fly') {
        if (h.target && h.target.alive) {
          this.hookPoint(h, c);
          h.dir.copy(c).sub(h.pos);
          const gap = h.dir.length();
          h.pos.addScaledVector(h.dir.divideScalar(gap || 1), Math.min(gap, HOOK_SPEED * dt));
          if (gap < 1.2) {
            h.phase = 'attached';
            h.time = 3;
            this.sfx.play('clank', h.target.pos);
            if (o.isPlayer) this.emit('feed', { text: tr('youHooked', { name: h.target.name }), player: true });
          }
        } else {
          h.pos.addScaledVector(h.dir, HOOK_SPEED * dt);
          h.travelled += HOOK_SPEED * dt;
          if (h.travelled > 70) h.phase = 'retract';
        }
      } else if (h.phase === 'attached') {
        const t = h.target;
        h.time -= dt;
        this.hookPoint(h, h.pos);
        const dx = t.pos.x - o.pos.x;
        const dz = t.pos.z - o.pos.z;
        const d = Math.hypot(dx, dz);
        if (d > 10) {
          o.vel.x += (dx / d) * fast(75) * dt;
          o.vel.z += (dz / d) * fast(75) * dt;
        }
        t.vel.multiplyScalar(Math.exp(-0.6 * dt));
        if (h.time <= 0 || d < 10 || !t.alive) {
          h.phase = 'retract';
          o.boost = Math.max(o.boost, 1.2);
          o.speed += fast(10);
        }
      } else {
        h.dir.copy(from).sub(h.pos);
        const d = h.dir.length();
        if (d < 2.5) {
          this.scene.remove(h.mesh, h.rope);
          o.model.hookHead.visible = !this.hooks.some((other) => other !== h && other.owner === o);
          return false;
        }
        h.pos.addScaledVector(h.dir.divideScalar(d), Math.min(d, fast(170) * dt));
      }

      h.mesh.position.copy(h.pos);
      h.mesh.lookAt(c.copy(h.pos).sub(from).add(h.pos));
      h.rope.position.copy(from);
      h.rope.lookAt(h.pos);
      h.rope.scale.set(1, 1, Math.max(0.01, from.distanceTo(h.pos)));
      return true;
    });
  }

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
  }

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
      if (b.isPlayer) this.emit('feed', { text: tr(missile ? 'youDodgedMissile' : 'youDodgedHook', { name: attacker.name }), player: true });
      else if (attacker.isPlayer) this.emit('feed', { text: tr(missile ? 'theyDodgedMissile' : 'theyDodgedHook', { name: b.name }), player: true });
    }
    const c = b.center();
    this.fx.ring(c.x, c.y, c.z, 0xffffff, 2, 9, 0.45);
    this.fx.sparkBurst(c.x, c.y + 1, c.z, 0xffe066, 20);
    this.sfx.play('dodge', b.pos);
    if (b.isPlayer) this.emit('dodge');
  }

  nearestHookMarker(target, from) {
    let best = null;
    let bestD = Infinity;
    const p = new THREE.Vector3();
    for (const marker of [...target.model.hookMarkers, ...target.model.towRings]) {
      const d = marker.getWorldPosition(p).distanceToSquared(from);
      if (d < bestD) {
        bestD = d;
        best = marker;
      }
    }
    return best;
  }

  hookPoint(h, out) {
    return h.anchor ? h.anchor.getWorldPosition(out) : h.target.center(out);
  }

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
  }

  empOrigin(b) {
    return b.alive ? b.model.empOrb.getWorldPosition(new THREE.Vector3()) : null;
  }

  updateLasers(dt) {
    for (const b of this.boats) {
      if (!b.has('laser')) continue;
      if (this.state !== 'racing' || !b.alive || b.disabled > 0) b.laser.trigger = false;
      const { beaming, overheatedNow } = stepLaser(b.laser, b.model, dt, this.time);
      if (overheatedNow) {
        this.sfx.play('overheat', b.pos);
        if (b.isPlayer) this.emit('warning', { text: tr('overheatedWarn') });
      }
      if (b.laser.overheated && Math.random() < 0.4) {
        const p = b.model.laserMount.getWorldPosition(new THREE.Vector3());
        this.fx.smoke(p.x, p.y + 0.4, p.z);
      }
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
      const origin = b.model.laserMount.getWorldPosition(new THREE.Vector3());
      const dir = laserDirection(b.model, new THREE.Vector3());
      dir.y = 0;
      dir.normalize();
      const drop = (origin.y - b.waterY) / LASER_REACH;
      dir.y = wobble.lift - drop;
      dir.normalize();
      const reach = LASER_REACH * Math.hypot(1, drop);
      const hit = this.raycastBoats(origin, dir, reach, b);
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
  }

  updateFlames(dt) {
    for (const b of this.boats) {
      if (!b.has('flamethrower')) continue;
      if (this.state !== 'racing' || !b.alive || b.disabled > 0) b.flame.trigger = false;
      const { spraying, overheatedNow } = stepFlame(b.flame, b.model, dt, this.time);
      if (overheatedNow) {
        this.sfx.play('overheat', b.pos);
        if (b.isPlayer) this.emit('warning', { text: tr('overheatedWarn') });
      }
      if (b.flame.overheated && Math.random() < 0.4) {
        const p = b.model.flameMount.getWorldPosition(new THREE.Vector3());
        this.fx.smoke(p.x, p.y + 0.3, p.z);
      }
      b.flameHum -= dt;
      if (!spraying) continue;
      b.lastFired = this.time;
      if (b.flameHum <= 0) {
        b.flameHum = 0.32;
        this.sfx.play('flame', b.pos);
      }
      const origin = b.model.flameMount.getWorldPosition(new THREE.Vector3());
      const dir = flameDirection(b.model, new THREE.Vector3());
      dir.y = 0;
      dir.normalize();
      this.fx.flameSpray(origin, dir, b.vel);
      const c = new THREE.Vector3();
      for (const o of this.boats) {
        if (o === b || !o.alive) continue;
        o.center(c).sub(origin);
        const along = c.x * dir.x + c.z * dir.z;
        if (along < -1 || along > FLAME_REACH) continue;
        const side = Math.abs(c.x * dir.z - c.z * dir.x);
        if (side > 2.4 + along * 0.32 || Math.abs(c.y) > 4) continue;
        const last = b.flameTicks.get(o) ?? -Infinity;
        if (this.time - last < 0.2) continue;
        b.flameTicks.set(o, this.time);
        if (this.damage(o, 3, b, 'flame')) this.ignite(o, b);
      }
    }
  }

  ignite(o, source) {
    const duration = o.has('camo') ? BURN_TIME * 1.5 : BURN_TIME;
    if (!o.burn) this.sfx.play('ignite', o.pos);
    o.burn = { time: Math.max(o.burn?.time ?? 0, duration), source, tick: o.burn?.tick ?? 0 };
  }

  updateBurn(b, dt) {
    if (!b.burn) return;
    if (!b.alive) {
      b.burn = null;
      return;
    }
    b.burn.time -= dt;
    b.burn.tick -= dt;
    const c = b.center();
    for (let i = 0; i < 6; i++) {
      const along = (Math.random() - 0.5) * HULL_L * 1.6;
      const side = (Math.random() - 0.5) * 2.4;
      this.fx.blaze(
        c.x + Math.sin(b.heading) * along + Math.cos(b.heading) * side,
        c.y + 0.4 + Math.random(),
        c.z + Math.cos(b.heading) * along - Math.sin(b.heading) * side,
        b.vel,
      );
    }
    if (Math.random() < 0.7) this.fx.blackSmoke(c.x, c.y + 3 + Math.random() * 1.5, c.z, b.vel);
    if (Math.random() < 0.25) this.fx.sparkBurst(c.x, c.y + 1.5, c.z, 0xffa62b, 2);
    if (b.burn.tick <= 0) {
      b.burn.tick = 0.25;
      this.damage(b, BURN_DPS * 0.25, b.burn.source, 'fire');
    }
    if (b.burn?.time <= 0) b.burn = null;
  }

  propaneBlast(b) {
    const c = b.center();
    this.fx.explosion(c.x, c.y, c.z, 2.6);
    this.fx.ring(c.x, c.y, c.z, 0xff8a1f, 2, BLAST_RADIUS, 0.6);
    this.fx.ring(c.x, b.waterY + 0.3, c.z, 0xffffff, 2, BLAST_RADIUS * 0.8, 0.8);
    for (let i = 0; i < 4; i++) this.fx.sparkBurst(c.x, c.y + 1, c.z, i % 2 ? 0xffd23f : 0xff5a3a, 20);
    this.sfx.play('boom', b.pos);
    this.sfx.play('boom', b.pos);
    if (this.player) {
      const near = 1 - Math.hypot(this.player.pos.x - c.x, this.player.pos.z - c.z) / 200;
      if (near > 0) this.emit('quake', { amount: 1 + 4 * near * near });
    }
    for (const o of this.boats) {
      if (o === b || !o.alive) continue;
      const dx = o.pos.x - b.pos.x;
      const dz = o.pos.z - b.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > BLAST_RADIUS) continue;
      const f = 1 - d / BLAST_RADIUS;
      const nx = d > 0.01 ? dx / d : Math.random() - 0.5;
      const nz = d > 0.01 ? dz / d : Math.random() - 0.5;
      o.vel.x += nx * fast(55) * f;
      o.vel.z += nz * fast(55) * f;
      this.damage(o, 4 + 12 * f, b, 'propane', { launch: 0.3 + 0.6 * f, spin: f > 0.4 ? 0.8 : 0 });
    }
  }

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
  }

  gunArc(b, id, range) {
    if (id === 'flamethrower') range = FLAME_REACH;
    if (b.items.indexOf(id) === 1) return { range: Math.min(range, WATCH_RANGE), maxDot: 0 };
    if (ALWAYS_AIMS.has(id)) return { range, minDot: 0 };
    return { range, minDot: { laser: 0.97, saw: 0 }[id] ?? 0.88 };
  }

  inArc(b, slot, x, z, from = b.pos) {
    const dot = (x - from.x) * Math.sin(b.heading) + (z - from.z) * Math.cos(b.heading);
    return slot === 0 ? dot >= 0 : dot <= 0;
  }

  turretTarget(b, t) {
    const slot = b.items.indexOf(t.id);
    const wanted = b.aim[t.id];
    const usable = (o) => o && o !== b && o.alive && this.inArc(b, slot, o.pos.x, o.pos.z) && Math.hypot(o.pos.x - b.pos.x, o.pos.z - b.pos.z) < WATCH_RANGE;
    if (usable(wanted)) return wanted;
    let best = null;
    let bestD = WATCH_RANGE;
    for (const o of this.boats) {
      if (!usable(o)) continue;
      const d = Math.hypot(o.pos.x - b.pos.x, o.pos.z - b.pos.z);
      if (d < bestD) {
        bestD = d;
        best = o;
      }
    }
    return best;
  }

  hookSpec(b) {
    return {
      range: 120,
      minDot: 0.55,
      filter: (o) => EASY_HOOK(o) || Math.hypot(o.pos.x - b.pos.x, o.pos.z - b.pos.z) < 70,
    };
  }

  updateRegen(b, dt) {
    const waited = this.time - b.lastFired - REGEN_DELAY;
    b.regenerating = b.alive && this.state === 'racing' && b.hp < MAX_HP && waited > 0;
    b.regenRate = b.regenerating ? Math.min(REGEN_MAX, REGEN_START + REGEN_RAMP * waited) : 0;
    if (b.regenerating) b.hp = Math.min(MAX_HP, b.hp + b.regenRate * dt);
  }

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
  }

  willAttack(b, o) {
    const player = this.player;
    if (b.isPlayer || this.attract || !player || player.finished) return true;
    const cached = b.attackRolls.get(o);
    if (cached && cached.until > this.time) return cached.value;
    let chance;
    if (o.isPlayer) {
      const pack = this.boats.filter((x) => !x.isPlayer).map((x) => x.dist).sort((m, n) => m - n);
      const lead = player.dist - pack[pack.length >> 1];
      chance = clamp(0.55 + lead / 500, 0.08, 1);
    } else {
      chance = clamp(0.5 + (o.dist - player.dist) / 300, 0.05, 1);
    }
    const value = Math.random() < chance;
    b.attackRolls.set(o, { until: this.time + 1.2, value });
    return value;
  }

  relativeAngle(b, o) {
    const dx = o.pos.x - b.pos.x;
    const dz = o.pos.z - b.pos.z;
    return Math.atan2(dx * Math.cos(b.heading) - dz * Math.sin(b.heading), dx * Math.sin(b.heading) + dz * Math.cos(b.heading));
  }

  updateTurrets(b, dt) {
    const busy = b.model.busy;
    for (const t of b.turrets) {
      busy[t.id] = Math.max(0, (busy[t.id] ?? 0) - dt);
      const firing = (t.id === 'machinegun' && b.gun.trigger) || (t.id === 'laser' && b.laser.trigger) || (t.id === 'flamethrower' && b.flame.trigger);
      const watched = b.alive ? this.turretTarget(b, t) : null;
      const active = firing || busy[t.id] > 0;
      const straight = active && t.center === 0 && !ALWAYS_AIMS.has(t.id);
      let target = watched && !straight ? this.relativeAngle(b, watched) : t.center;
      if (t.id === 'missiles' && busy.missiles > 0) target = b.missileAim;
      const rate = active ? 16 : 5;
      const want = clamp(wrapAngle(target - t.center), -HALF_ARC, HALF_ARC);
      const now = wrapAngle(t.group.rotation.y - t.center);
      t.group.rotation.y = t.center + now + (want - now) * (1 - Math.exp(-rate * dt));
    }
    for (const q of [...b.missileQueue]) {
      q.wait -= dt;
      if (q.wait > 0) continue;
      b.missileQueue.splice(b.missileQueue.indexOf(q), 1);
      if (!b.alive) continue;
      const pos = spendMissile(b.model, new THREE.Vector3()) ?? b.model.missileMount.getWorldPosition(new THREE.Vector3());
      const dir = missileDirection(b.model, new THREE.Vector3());
      dir.x += (Math.random() - 0.5) * 0.25;
      dir.z += (Math.random() - 0.5) * 0.25;
      dir.normalize();
      const mesh = buildMissile();
      mesh.scale.setScalar(0.75);
      this.scene.add(mesh);
      this.missiles.push({ pos, dir, speed: Math.max(fast(30), b.speed + fast(8)), owner: b, target: q.target, life: 5, fizzle: 0, mesh, lockTime: Math.random() < 0.35 ? 0.5 + Math.random() : Infinity });
      this.sfx.play('missile', b.pos);
    }
  }

  updateSaw(b, dt) {
    const refs = b.model;
    const s = b.sawState;
    const pivot = refs.sawYaw.getWorldPosition(new THREE.Vector3());
    const fx = Math.sin(b.heading);
    const fz = Math.cos(b.heading);
    const lx = Math.cos(b.heading);
    const lz = -Math.sin(b.heading);
    if (this.state !== 'racing' || !b.alive || b.disabled > 0) b.sawHeat.trigger = false;
    const { cutting: armed, overheatedNow } = stepSaw(b.sawHeat, refs, dt, this.time);
    if (overheatedNow) {
      this.sfx.play('overheat', b.pos);
      if (b.isPlayer) this.emit('warning', { text: tr('overheatedWarn') });
    }
    if (armed) b.lastFired = this.time;
    const slot = b.items.indexOf('saw');
    const center = slotCenter(slot);
    let target = null;
    let best = SAW_RANGE;
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

    s.sound -= dt;
    const blade = refs.saw.getWorldPosition(new THREE.Vector3());
    if (b.sawHeat.overheated && Math.random() < 0.4) this.fx.smoke(blade.x, blade.y + 0.4, blade.z);
    const inReach = target && s.shield <= 0 && target.distanceToAxis2D(blade.x, blade.z) < HIT_RADIUS + 0.7;
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
        if (s.sound <= 0) {
          s.sound = 0.45;
          this.sfx.play('saw', b.pos);
        }
      }
    }
    const spinning = armed || s.shield > 0;
    s.spin += ((spinning ? 42 : 0) - s.spin) * (1 - Math.exp(-(spinning ? 6 : 2) * dt));
    refs.saw.rotation.x += s.spin * dt;

    s.shield = Math.max(0, s.shield - dt);
    const shield = refs.sawShield;
    const glowAmount = s.shield > 0 ? 0.6 + 0.25 * Math.sin(this.time * 45) : 0;
    shield.material.opacity += (glowAmount - shield.material.opacity) * (1 - Math.exp(-18 * dt));
    shield.scale.setScalar(1 + 0.08 * Math.sin(this.time * 30));
  }

  crackle(b, dt) {
    const intensity = b.cooldowns[b.items.indexOf('emp')] > 0 ? 0.35 : 1;
    if (this.fx.empIdle(b.model, dt, intensity, this.time) && Math.random() < 0.04 * intensity) this.sfx.play('crackle', b.pos);
  }

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
  }

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
      if (jetOn) {
        flame.scale.set(0.32 + Math.random() * 0.1, 1.6 + Math.random() * 0.8, 0.32 + Math.random() * 0.1);
        const p = flame.getWorldPosition(new THREE.Vector3());
        this.fx.flame(p.x - fx * 0.6, p.y, p.z - fz * 0.6, -fx * 10, -1, -fz * 10);
      }
    }

    for (const sp of spinners) sp.mesh.rotation[sp.axis] += sp.speed * dt;
    flag.rotation.y = Math.sin(t * 9 + b.index) * 0.25 - b.steerVis * 0.3;

    if (b.alive && !b.air && Math.abs(b.speed) > 5 && isWater(b.pos.x, b.pos.z)) {
      b.wakeTimer -= dt;
      if (b.wakeTimer <= 0) {
        b.wakeTimer = 0.07;
        const sx = -lx;
        const sz = -lz;
        this.fx.wake(b.pos.x - fx * (HULL_L - 0.3), w + 0.1, b.pos.z - fz * (HULL_L - 0.3), sx, sz, Math.abs(b.speed));
        this.fx.spray(b.pos.x, w + 0.3, b.pos.z, fx, fz, sx, sz, Math.abs(b.speed), b.steerVis);
      }
    }

    const h = b.yOffset;
    const shadowSize = (b.alive ? 10.5 : 0) / (1 + h * 0.1);
    b.shadow.position.set(b.pos.x, w + 0.12, b.pos.z);
    b.shadow.scale.set(shadowSize * 0.5, 1, shadowSize);
    b.shadow.rotation.y = b.heading;
    b.shadow.material.opacity = 1 / (1 + h * 0.15);
  }

  whitecaps(dt) {
    const focus = this.player ?? this.boats[0];
    if (!focus || Math.random() > dt * 5) return;
    let x, z;
    if (this.track.river) {
      const p = this.track.point(focus.trackIdx + Math.round((Math.random() - 0.3) * 60), (Math.random() - 0.5) * 2 * this.track.halfWidth);
      x = p.x;
      z = p.z;
      if (!isWater(x, z)) return;
    } else {
      const a = Math.random() * Math.PI * 2;
      const d = 15 + Math.random() * 60;
      x = focus.pos.x + Math.cos(a) * d;
      z = focus.pos.z + Math.sin(a) * d;
    }
    this.fx.splash(x, waveHeight(x, z, this.time), z, 0.2 + Math.random() * 0.2);
  }

  updateStandings() {
    const L = this.track.length;
    for (const b of this.boats) {
      if (!b.finished && b.dist >= this.laps * L) {
        b.finished = true;
        b.finishTime = this.clock;
        b.finishOrder = ++this.finishCount;
        if (b.isPlayer) {
          this.emit('finish', { place: this.finishCount });
          this.sfx.play('finish');
        }
      }
      const lap = clamp(Math.floor(b.dist / L) + 1, 1, this.laps);
      if (b.isPlayer && lap > b.lap && !b.finished) {
        this.emit(lap === this.laps ? 'finalLap' : 'lap', { lap });
        this.sfx.play('lap');
      }
      b.lap = lap;
    }
    this.order = [...this.boats].sort((a, b) => {
      if (a.finished && b.finished) return a.finishOrder - b.finishOrder;
      if (a.finished !== b.finished) return a.finished ? -1 : 1;
      return b.dist - a.dist;
    });
    this.order.forEach((b, i) => (b.place = i + 1));
  }

  dispose() {
    for (const b of this.boats) this.scene.remove(b.model.root, b.shadow);
    for (const m of this.missiles) this.scene.remove(m.mesh);
    for (const m of this.mines) this.scene.remove(m.mesh);
    for (const h of this.hooks) this.scene.remove(h.mesh, h.rope);
    this.scene.remove(this.bulletMesh, this.bulletOutline);
    this.features.dispose();
    this.wakes.dispose();
  }
}
