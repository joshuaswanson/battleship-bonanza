import * as THREE from 'three';
import { ITEMS } from './items.js';
import { reloadMissile, reloadMine, disposeBoat } from './boatModel.js';
import { waveHeight } from './water.js';
import { driveAI } from './ai.js';
import { TrackFeatures } from './features.js';
import { Wakes } from './wake.js';
import { TireMarks } from './tireMarks.js';
import { t as tr } from './i18n.js';
import { ACCEL, ARMOR_SPEED, BANK_MARGIN, BASE_SPEED, BRAKE, CIRCLE_OFFSET, COAST, FALL_GRAVITY, GRIP, HOLD_IDS, JET_ASSIST, JET_ASSIST_EASE, JET_SPEED, JET_STEER, JET_THRUST, KO_TIME, LAND_GRIP, LAPS, MAX_HP, MORPH_CLEAR, MORPH_PUSH, MORPH_SHOVE, MUD_POOL, MUD_SPEED, OFF_COURSE_SPEED, OUTER_LIMIT, RADIUS, REGEN_DELAY, REGEN_MAX, REGEN_RAMP, REGEN_START, REVERSE_SPEED, TURN_RATE, approach, clamp } from './race/shared.js';
import { Boat } from './race/boat.js';
import { carrierSpeed } from './ctf.js';
import * as machinegun from './race/attachments/machinegun.js';
import * as missiles from './race/attachments/missiles.js';
import * as mines from './race/attachments/mines.js';
import * as grapple from './race/attachments/grapple.js';
import * as emp from './race/attachments/emp.js';
import * as jetpack from './race/attachments/jetpack.js';
import * as laser from './race/attachments/laser.js';
import * as flamethrower from './race/attachments/flamethrower.js';
import * as saw from './race/attachments/saw.js';
import * as spikes from './race/attachments/spikes.js';
import * as aiming from './race/aiming.js';
import * as course from './race/course.js';
import * as visuals from './race/visuals.js';

export { LAPS, MAX_HP, BASE_SPEED } from './race/shared.js';
export const COUNTDOWN = 3.7;
const FALL_OVER_BANK = 40;
const DIVIDER = 24;
const KIND_ITEM = { bullet: 'machinegun', saw: 'saw', laser: 'laser', reflect: 'saw', flame: 'flamethrower', fire: 'flamethrower', propane: 'flamethrower', missile: 'missiles', mine: 'mines', spikes: 'spikes' };

const MODULES = [machinegun, missiles, mines, grapple, emp, jetpack, laser, flamethrower, saw, spikes, aiming, course, visuals];

export class Race {
  actions = Object.assign({}, ...MODULES.map((m) => m.actions ?? {}));

  constructor({ scene, track, fx, sfx, defs, shores = [], solid = null, raycast = null, chopper = null, hazards = null, mode = null, attract = false, laps = LAPS }) {
    this.shores = shores;
    this.solid = solid;
    this.bankProbe = new THREE.Vector3();
    this.raycast = raycast;
    this.chopper = chopper;
    this.iceMarks = new Map();
    this.iceChunks = [];
    this.iceFlashes = [];
    if (chopper) chopper.onShatter = (tree, dir) => this.shatterIce(tree, dir);
    this.hazards = hazards;
    this.mode = mode;
    this.blasts = [];
    this.scene = scene;
    this.track = track;
    this.fx = fx;
    this.sfx = sfx;
    this.attract = attract;
    this.laps = attract || mode ? Infinity : laps;
    this.boats = defs.map((def, i) => new Boat(def, i, scene, track.river?.land?.kind));
    this.tireMarks = track.river?.land?.kind === 'truck' ? new TireMarks(scene) : null;
    this.jetPoint = new THREE.Vector3();
    this.ceasefire = false;
    this.player = this.boats.find((b) => b.isLocal) ?? this.boats.find((b) => b.isPlayer) ?? null;
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
    this.countdown = COUNTDOWN;
    this.lastCount = 5;
    this.order = [...this.boats];

    const streak = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true).rotateX(Math.PI / 2).translate(0, 0, -0.5);
    const tracer = (color) => new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    this.bulletMesh = new THREE.InstancedMesh(streak, tracer(0xffffff), 400);
    this.bulletMesh.setColorAt(0, new THREE.Color(0xffe066));
    this.bulletOutline = new THREE.InstancedMesh(streak, tracer(0xffffff), 400);
    for (const mesh of [this.bulletMesh, this.bulletOutline]) {
      mesh.frustumCulled = false;
      mesh.count = 0;
      scene.add(mesh);
    }

    this.features = new TrackFeatures(scene, track, fx, sfx);
    this.wakes = new Wakes(scene, fx.water);
    if (mode) mode.reset(this);
    else this.placeGrid();
    hazards?.reset(this);
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
      b.trackS = t.sAt[idx];
      b.dist = b.trackS - t.length;
      b.waterY = waveHeight(p.x, p.z, 0);
    });
  }

  emit(type, data = {}, to = null) {
    this.events.push({ type, ...data, to });
  }

  update(dt, time, input, remote = null) {
    this.time = time;
    this.ceasefire = !remote && this.boats.some((b) => b.isPlayer && b.morphing);

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
      const control = b === this.player ? input : remote?.get(b.index);
      if (b.isPlayer && !b.finished && control) {
        b.control.throttle = control.throttle;
        b.control.steer = control.steer;
        if (control.use0) this.useItem(b, 0);
        if (control.use1) this.useItem(b, 1);
        for (const id of HOLD_IDS) b.heat[id].trigger = (control.hold0 && b.items[0] === id) || (control.hold1 && b.items[1] === id);
      } else if (b.alive) {
        driveAI(this, b, dt);
        this.hazards?.pilot?.(this, b);
      }
    }

    for (const b of this.boats) this.updateBoat(b, dt);
    this.whitecaps(dt);
    this.clearMorphers(dt);
    this.collideBoats();
    this.updateBullets(dt);
    this.updateMissiles(dt);
    this.updateMines(dt);
    this.updateHooks(dt);
    this.updatePulses(dt);
    this.updateLasers(dt);
    this.updateIceChunks(dt);
    this.updateFlames(dt);
    this.features.update(this, dt, this.time);
    this.tireMarks?.update(this.boats, this.time);
    this.hazards?.play(this, dt);
    this.mode?.play(this, dt);
    this.blasts.length = 0;
    for (const b of this.boats) this.updateVisual(b, dt);
    this.wakes.update(this.boats, this.time);
    if (!this.mode) this.updateStandings();
  }

  updateBoat(b, dt) {
    const t = this.track;
    for (let i = 0; i < 2; i++) {
      const was = b.cooldowns[i];
      b.cooldowns[i] = Math.max(0, was - dt);
      if (was > 0 && b.cooldowns[i] === 0 && b.items[i] === 'mines') reloadMine(b.model);
      const charge = b.charges[i];
      if (charge && charge.left < ITEMS[b.items[i]].charges) {
        charge.refill += dt / ITEMS[b.items[i]].recharge;
        if (charge.refill >= 1) {
          charge.refill = 0;
          charge.left++;
          if (b.items[i] === 'missiles') reloadMissile(b.model);
        }
      }
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
      if (t.onLand(b.trackS) || t.formKind(b.trackS) === 'jet') this.wreckSmoke(b);
      else if (Math.random() < 0.6) this.fx.bubbles(b.pos.x, b.waterY + 0.2, b.pos.z);
      if (b.ko <= 0) this.respawn(b);
      return;
    }

    if (this.state === 'countdown') {
      b.speed = 0;
      b.vel.set(0, 0, 0);
      return;
    }

    const controllable = b.spinTime <= 0;
    let max = BASE_SPEED * b.skill * (t.river?.speed ?? 1);
    if (b.has('armor')) max *= ARMOR_SPEED;
    if (b.boost > 0) max *= 1.3;
    if (b.air?.jet) max *= 1.15;
    if (b.stun > 0) max *= 0.5;
    if (b.flag) max *= carrierSpeed(b.flag, this.time);
    if (this.isTethered(b)) max *= 0.8;
    if (b.offCourse > 0) max *= OFF_COURSE_SPEED;
    const onLand = t.onLand(b.trackS);
    const jetting = !!b.form && b.formP >= 1 && t.jetCruise(b.trackS);
    if (jetting) max *= JET_SPEED;
    if (onLand) {
      const i = t.norm(b.trackIdx);
      if (t.mudAt(b.trackS, (b.pos.x - t.px[i]) * t.nx[i] + (b.pos.z - t.pz[i]) * t.nz[i]) > MUD_POOL) max *= MUD_SPEED;
    }

    const throttle = controllable ? b.control.throttle : 0;
    const target = throttle >= 0 ? throttle * max : throttle * REVERSE_SPEED;
    let rate = target > b.speed ? ACCEL : BRAKE;
    if (throttle === 0) rate = COAST;
    if (b.boost > 0 && target > b.speed) rate *= 2;
    if (jetting && target > b.speed) rate *= JET_THRUST;
    b.speed = approach(b.speed, target, rate * dt);

    const morphing = !!b.orbit || (!!b.form && b.formP > 0 && b.formP < 1);
    b.morphing = morphing;
    const flying = !morphing && !!b.form && b.formP >= 1 && t.jetCruise(b.trackS);
    const steer = controllable && !morphing ? b.control.steer : 0;
    b.steerVis += (steer - b.steerVis) * (1 - Math.exp(-8 * dt));
    const speedFrac = clamp(b.speed / BASE_SPEED, 0, 1);
    const turn = clamp(Math.abs(b.speed) / 14, 0.25, 1) * (b.air ? 0.6 : onLand ? 1.25 : 1) * (1 - 0.2 * speedFrac) * (flying ? JET_STEER : 1);
    b.heading -= steer * TURN_RATE * turn * dt * (b.speed < -0.5 ? -1 : 1);
    if (morphing) this.holdCourse(b, dt);
    else if (flying) this.holdCourse(b, dt, JET_ASSIST * (1 - Math.abs(b.steerVis) * JET_ASSIST_EASE));

    const fx = Math.sin(b.heading);
    const fz = Math.cos(b.heading);
    const k = 1 - Math.exp(-(b.air && !morphing ? 1 : GRIP * b.grip * (onLand ? LAND_GRIP : 1)) * dt);
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
        if (b.isPlayer) this.emit('lockShake', { amount: 1.2 }, b);
      }
    } else if (b.air) {
      b.air.t += dt;
      const u = b.air.t / b.air.dur;
      b.yOffset = b.air.peak * 4 * u * (1 - u);
      if (b.air.plunge && b.waterY + b.yOffset < 0.2) {
        b.air.plunge = false;
        b.bump(6);
        this.fx.splash(b.pos.x, 0.2, b.pos.z, 2.6);
        this.sfx.play('splash', b.pos);
        if (b.isPlayer) this.emit('lockShake', { amount: 1.2 }, b);
      }
      if (u >= 1) {
        b.yOffset = 0;
        b.air = null;
        b.bump(5);
        this.groundHit(b, b.pos.x, b.pos.z, 1.5);
        this.groundHit(b, b.pos.x + Math.sin(b.heading) * 3, b.pos.z + Math.cos(b.heading) * 3, 0.8);
        this.sfx.play(onLand ? 'truckLand' : 'splash', b.pos);
      }
    }
    if (b.spinTime > 0) b.spinTime -= dt;
    if (b.orbit) {
      b.orbit.t += dt;
      if (b.orbit.t >= b.orbit.dur) b.orbit = null;
    }

    if (this.mode) {
      this.collideShores(b);
      this.mode.confine(this, b);
    } else if (!this.hazards?.carry?.(this, b, dt)) this.followCourse(b, dt, fx, fz);
  }

  followCourse(b, dt, fx, fz) {
    const t = this.track;
    const fork = t.forkNear(b.trackIdx);
    const choice = fork ? b.ai?.routes?.[fork.id] : undefined;
    let pr = t.project(b.pos.x, b.pos.z, b.trackIdx, 60, choice === undefined ? undefined : choice ? fork.id : -1);
    if (t.routes.length && Math.abs(pr.lateral) > Math.min(t.hw[pr.idx], this.edgeLimit(pr)) - 1) {
      const free = t.project(b.pos.x, b.pos.z);
      if (free.route !== pr.route && Math.abs(free.lateral) < Math.abs(pr.lateral) - (t.hw[pr.idx] - t.hw[free.idx])) pr = free;
    }
    let ds = pr.s - b.trackS;
    if (ds < -t.length / 2) ds += t.length;
    else if (ds > t.length / 2) ds -= t.length;
    b.dist += ds;
    b.trackS = pr.s;
    b.trackIdx = pr.idx;
    if (t.river) this.followRiver(b, pr.s);

    b.offCourse = !b.air && Math.abs(pr.lateral) > t.hw[pr.idx] + 1.5 ? b.offCourse + dt : 0;
    if (b.offCourse > 0 && b.speed > OFF_COURSE_SPEED * BASE_SPEED) b.speed *= Math.exp(-1.5 * dt);
    this.collideShores(b);

    const lim = this.edgeLimit(pr);
    const overBank = b.air && this.solid && Math.abs(pr.lateral) > lim && Math.abs(pr.lateral) < lim + FALL_OVER_BANK && (b.air.fall || this.overDivider(b, pr));
    if (overBank) this.tumbleOnBank(b, pr);
    else if (Math.abs(pr.lateral) > lim) {
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
          this.groundHit(b, b.pos.x, b.pos.z, 0.6);
          this.sfx.play('boing', b.pos);
        }
      }
    }

    if (b.isPlayer) {
      const facing = fx * t.tx[pr.idx] + fz * t.tz[pr.idx];
      b.wrongWay = facing < -0.3 && b.speed > 4 ? b.wrongWay + dt : 0;
    }
  }

  edgeLimit(pr) {
    const t = this.track;
    return t.reach ? t.reach[pr.lateral > 0 ? 1 : 0][pr.idx] : t.hw[pr.idx] + (t.banked ? -(t.map.bankMargin ?? BANK_MARGIN) : OUTER_LIMIT);
  }

  overDivider(b, pr) {
    const t = this.track;
    for (const seg of t.segments) {
      if (seg.route === pr.route) continue;
      for (let i = seg.start; i <= seg.end; i += 2) {
        if (Math.hypot(b.pos.x - t.px[i], b.pos.z - t.pz[i]) < t.hw[i] + DIVIDER) return true;
      }
    }
    return false;
  }

  tumbleOnBank(b, pr) {
    const y = b.air.fall ? b.air.y : (b.surfaceLevel ?? 0) + b.yOffset;
    const p = this.bankProbe.set(b.pos.x, y, b.pos.z);
    if (!this.solid(p)) return;
    if (!b.air.fall) b.air = { fall: true, y, vy: (b.air.peak * 4 * (1 - (2 * b.air.t) / b.air.dur)) / b.air.dur };
    for (let k = 0; k < 80 && this.solid(p); k++) p.y += 0.5;
    b.air.y = p.y;
    b.air.vy = Math.max(b.air.vy, b.air.tumbled ? 0 : 7);
    if (b.air.tumbled) return;
    b.air.tumbled = true;
    const t = this.track;
    const sgn = Math.sign(pr.lateral);
    let dx = t.tx[pr.idx] - sgn * t.nx[pr.idx] * 0.7;
    let dz = t.tz[pr.idx] - sgn * t.nz[pr.idx] * 0.7;
    const len = Math.hypot(dx, dz);
    dx /= len;
    dz /= len;
    const speed = Math.hypot(b.vel.x, b.vel.z);
    b.vel.x = dx * speed;
    b.vel.z = dz * speed;
    b.heading = Math.atan2(dx, dz);
    if (b.spinTime <= 0 && !this.rigidForm(b)) {
      b.spinTime = 0.9;
      b.spinDur = 0.9;
    }
    b.bump(6);
    for (let k = 0; k < 8; k++) this.fx.puffs.emit(b.pos.x + (Math.random() - 0.5) * 4, p.y + 0.5, b.pos.z + (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 6, 2 + Math.random() * 3, (Math.random() - 0.5) * 6, 1 + Math.random(), 0.9, 0xc9a27a, 2, 1.5, 0);
    this.sfx.play('boing', b.pos);
    if (b.isPlayer) this.emit('lockShake', { amount: 0.8 }, b);
  }

  respawnSpot(b) {
    if (this.mode) return this.mode.spawnSpot(b);
    const custom = this.hazards?.respawnSpot?.(this, b);
    if (custom) return custom;
    const t = this.track;
    const idx = t.step(b.trackIdx, -10);
    const spot = (lateral) => ({ ...t.point(idx, lateral), heading: t.heading(idx), idx });
    for (const lateral of [0, -10, 10, -18, 18]) {
      const p = t.point(idx, lateral);
      if (this.boats.every((o) => o === b || Math.hypot(o.pos.x - p.x, o.pos.z - p.z) > 9)) return spot(lateral);
    }
    return spot(0);
  }

  respawn(b) {
    const t = this.track;
    const spot = this.respawnSpot(b);
    b.pos.set(spot.x, 0, spot.z);
    b.heading = spot.heading;
    b.vel.set(0, 0, 0);
    b.speed = 12;
    b.hp = MAX_HP;
    b.invuln = 2;
    b.air = null;
    b.surfaceLevel = null;
    b.riverS = null;
    b.yOffset = 0;
    b.spinTime = 0;
    b.stun = 0;
    for (const heat of Object.values(b.heat)) heat.trigger = false;
    b.exploded = false;
    if (spot.idx !== undefined) {
      const s = t.sAt[spot.idx];
      let ds = s - b.trackS;
      if (ds < -t.length / 2) ds += t.length;
      else if (ds > t.length / 2) ds -= t.length;
      b.dist += ds;
      b.trackS = s;
      b.trackIdx = spot.idx;
    }
    b.model.body.rotation.set(0, 0, 0);
    b.formP = t.formAt(b.trackS) ? 1 : 0;
    b.bump(6);
    this.groundHit(b, spot.x, spot.z, 1);
  }

  clearMorphers(dt) {
    const ease = 1 - Math.exp(-MORPH_PUSH * dt);
    for (const me of this.boats) {
      if (!me.isPlayer || !me.morphing || !me.alive) continue;
      for (const o of this.boats) {
        if (o === me || !o.alive) continue;
        let dx = o.pos.x - me.pos.x;
        let dz = o.pos.z - me.pos.z;
        let d = Math.hypot(dx, dz);
        if (d >= MORPH_CLEAR) continue;
        if (d < 0.01) {
          dx = Math.cos(me.heading);
          dz = -Math.sin(me.heading);
          d = 1;
        }
        const gap = MORPH_CLEAR - d;
        o.pos.x += (dx / d) * gap * ease;
        o.pos.z += (dz / d) * gap * ease;
        o.vel.x += (dx / d) * gap * MORPH_SHOVE * dt;
        o.vel.z += (dz / d) * gap * MORPH_SHOVE * dt;
      }
    }
  }

  collideBoats() {
    const boats = this.boats;
    for (let i = 0; i < boats.length; i++) {
      const a = boats[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < boats.length; j++) {
        const b = boats[j];
        if (!b.alive) continue;
        if (a.morphing || b.morphing) continue;
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

  allied(a, o) {
    return !!this.mode && a !== o && a.team === o.team;
  }

  damage(target, amount, source, kind, { knockX = 0, knockZ = 0, spin = 0, stun = 0, launch = 0 } = {}) {
    if (this.allied(source, target)) return false;
    if (!target.alive || target.invuln > 0 || (target.finished && !this.attract) || target.morphing || this.ceasefire) return false;
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
    target.stats.taken += amount;
    if (source !== target) {
      source.stats.dealt += amount;
      const item = KIND_ITEM[kind] ?? kind;
      source.stats.byItem[item] = (source.stats.byItem[item] ?? 0) + amount;
      source.stats.top = Math.max(source.stats.top, source.stats.dealt);
    }
    if (source.isPlayer && source !== target) this.emit('dmg', { target, amount }, source);
    if (kind !== 'fire') target.flash = 1;
    const light = kind === 'bullet' || kind === 'flame' || kind === 'fire';
    target.bump(light ? 1.5 : 5);
    if (!light && !target.air) this.fx.splash(target.pos.x, target.waterY, target.pos.z, 0.6);
    target.vel.x += knockX;
    target.vel.z += knockZ;
    const SLOWDOWN = { bullet: 0.97, saw: 0.94, laser: 0.97, reflect: 0.97, flame: 0.97, fire: 1 };
    target.speed *= SLOWDOWN[kind] ?? 0.7;
    if (this.rigidForm(target)) {
      spin = 0;
      launch = 0;
    }
    if (spin && target.spinTime <= 0) {
      target.spinTime = spin;
      target.spinDur = spin;
    }
    if (stun) target.stun = Math.max(target.stun, stun);
    if (launch && !target.air) target.air = { t: 0, dur: launch, peak: launch * 6, jet: false };
    if (kind !== 'flame' && kind !== 'fire') this.sfx.play('hit', target.pos);
    if (target.isPlayer) this.emit('hurt', { amount, kind, source: source.name }, target);
    if (target.hp <= 0) this.knockOut(target, source, kind);
    return true;
  }

  surfaceHit(from, to) {
    if (this.raycast) {
      const dir = to.clone().sub(from);
      const length = dir.length();
      return length > 0 ? this.raycast(from, dir.divideScalar(length), length) : null;
    }
    if (!this.solid) return null;
    const normal = this.solid(to);
    if (!normal) return null;
    const a = from.clone();
    const b = to.clone();
    const mid = new THREE.Vector3();
    for (let i = 0; i < 6; i++) {
      mid.addVectors(a, b).multiplyScalar(0.5);
      if (this.solid(mid)) b.copy(mid);
      else a.copy(mid);
    }
    return { point: a, normal: this.solid(b) ?? normal };
  }

  stampDecal(kind, point, normal, size) {
    if (this.raycast) {
      const u = new THREE.Vector3(normal.z, 0, -normal.x);
      if (u.lengthSq() < 1e-6) u.set(1, 0, 0);
      u.normalize();
      const v = new THREE.Vector3().crossVectors(normal, u);
      const back = normal.clone().negate();
      const from = new THREE.Vector3();
      const fits = (r) => {
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2;
          from.copy(point).addScaledVector(u, Math.cos(a) * r).addScaledVector(v, Math.sin(a) * r).addScaledVector(normal, 0.35);
          const hit = this.raycast(from, back, 0.7);
          if (!hit || hit.normal.dot(normal) < 0.8) return false;
        }
        return true;
      };
      let tries = 0;
      while (!fits(size * 0.42)) {
        if (tries++ === 4) return;
        size *= 0.68;
      }
    }
    this.fx.impact(kind, point, normal, size);
  }

  marchSurface(origin, dir, reach, step = 1.2) {
    if (this.raycast) return this.raycast(origin, dir, reach);
    if (!this.solid) return null;
    const prev = origin.clone();
    const p = new THREE.Vector3();
    for (let t = step; t <= reach; t += step) {
      p.copy(origin).addScaledVector(dir, t);
      const hit = this.surfaceHit(prev, p);
      if (hit) return { ...hit, t: hit.point.distanceTo(origin) };
      prev.copy(p);
    }
    return null;
  }

  knockOut(b, source, kind) {
    b.hp = 0;
    b.ko = KO_TIME + (this.mode?.respawnDelay ?? 0);
    b.koTime = b.ko;
    b.stats.sunk++;
    if (source !== b) source.stats.kills++;
    b.air = null;
    b.yOffset = 0;
    for (const heat of Object.values(b.heat)) heat.trigger = false;
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
    this.emit('feed', { kind, item: KIND_ITEM[kind], killer: source, victim: b });
    if (b.isPlayer) this.emit('ko', { source: source.name, land: this.track.onLand(b.trackS) || this.track.formKind(b.trackS) === 'jet' }, b);
  }

  useItem(b, slot) {
    const id = b.items[slot];
    const item = ITEMS[id];
    if (!item || item.passive || item.hold || this.state !== 'racing' || !b.alive) return false;
    if (b.morphing || (this.ceasefire && id !== 'jetpack')) return false;
    if (b.disabled > 0 && item.group === 'weapons') {
      if (b.isPlayer) this.emit('nope', {}, b);
      return false;
    }
    const charge = b.charges[slot];
    if (b.cooldowns[slot] > 0 || (charge && charge.left <= 0)) {
      if (b.isPlayer && !(charge && b.cooldowns[slot] > 0)) this.emit('nope', {}, b);
      return false;
    }
    if (this.actions[id].call(this, b) === false) return false;
    b.cooldowns[slot] = item.cooldown;
    if (charge) charge.left--;
    b.lastFired = this.time;
    return true;
  }

  holdFire(b) {
    return b.morphing || this.ceasefire;
  }

  stepHold(b, id, step, mount, dt) {
    const heat = b.heat[id];
    if (this.state !== 'racing' || !b.alive || b.disabled > 0 || this.holdFire(b)) heat.trigger = false;
    const result = step(heat, b.model, dt, this.time);
    if (result.overheatedNow) {
      this.sfx.play('overheat', b.pos);
      if (b.isPlayer) this.emit('warning', { text: tr('overheatedWarn') }, b);
    }
    if (heat.overheated && Math.random() < 0.4) {
      const p = mount.getWorldPosition(new THREE.Vector3());
      this.fx.smoke(p.x, p.y + 0.35, p.z);
    }
    return result;
  }

  updateRegen(b, dt) {
    const waited = this.time - b.lastFired - REGEN_DELAY;
    b.regenerating = b.alive && this.state === 'racing' && b.hp < MAX_HP && waited > 0;
    b.regenRate = b.regenerating ? Math.min(REGEN_MAX, REGEN_START + REGEN_RAMP * waited) : 0;
    if (b.regenerating) b.hp = Math.min(MAX_HP, b.hp + b.regenRate * dt);
  }

  updateStandings() {
    const L = this.track.length;
    for (const b of this.boats) {
      if (!b.finished && b.dist >= this.laps * L) {
        b.finished = true;
        b.finishTime = this.clock;
        b.finishOrder = ++this.finishCount;
        if (b.isPlayer) this.emit('finish', { place: this.finishCount }, b);
      }
      const lap = clamp(Math.floor(b.dist / L) + 1, 1, this.laps);
      if (b.isPlayer && lap > b.lap && !b.finished) this.emit(lap === this.laps ? 'finalLap' : 'lap', { lap }, b);
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
    for (const b of this.boats) {
      this.scene.remove(b.model.root, b.shadow);
      disposeBoat(b.model);
    }
    for (const m of this.missiles) this.scene.remove(m.mesh);
    for (const m of this.mines) this.scene.remove(m.mesh);
    for (const c of this.iceChunks) this.scene.remove(c.mesh);
    for (const f of this.iceFlashes) this.scene.remove(f.mesh);
    for (const mark of this.iceMarks.values()) this.scene.remove(mark);
    for (const h of this.hooks) this.scene.remove(h.mesh, h.rope, h.loose?.mesh ?? h.rope);
    this.scene.remove(this.bulletMesh, this.bulletOutline);
    this.features.dispose();
    this.wakes.dispose();
    this.tireMarks?.dispose();
    this.mode?.dispose();
  }
}

for (const module of MODULES) Object.assign(Race.prototype, module.methods);
