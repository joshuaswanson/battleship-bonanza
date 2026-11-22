import * as THREE from 'three';
import { buildMine, launchMine } from '../../boatModel.js';
import { waveHeight } from '../../water.js';

const MINE_RISE = 7;
const MINE_POP = -1;

const MINE_REACH = 8;
const MINE_ROLL = 0.75;
const MINE_FRICTION = 2.6;
const MINE_LANDING = 0.2;
const MINE_SINK = 0.9;
const MINE_SINK_TIME = 1.6;
const MINE_DUST = 0xc9a46b;

export const methods = {
  mineFloor(mine) {
    const t = this.track;
    if (mine.onCourse) {
      const at = t.project(mine.pos.x, mine.pos.z, mine.idx);
      mine.idx = at.idx;
      return { y: t.level(at.s), dry: t.grounded(at.s) };
    }
    if (mine.aerial && this.ground) return this.ground(mine.pos.x, mine.pos.z);
    return { y: waveHeight(mine.pos.x, mine.pos.z, this.time), dry: false };
  },

  removeMine(mine, puff = false) {
    this.scene.remove(mine.mesh);
    this.mines = this.mines.filter((m) => m !== mine);
    if (puff) this.fx.smoke(mine.pos.x, mine.pos.y + 0.5, mine.pos.z);
  },

  updateMines(dt) {
    for (const mine of [...this.mines]) {
      mine.age += dt;
      if (mine.floating) {
        mine.vel.multiplyScalar(Math.exp(-2.4 * dt));
        mine.pos.addScaledVector(mine.vel, dt);
        mine.pos.y += MINE_RISE * dt;
        mine.mesh.position.copy(mine.pos);
        mine.mesh.rotation.x += dt * 0.8;
        mine.mesh.rotation.z += dt * 0.5;
        if (Math.random() < dt * 8) this.fx.bubbles(mine.pos.x, mine.pos.y, mine.pos.z);
        if (mine.pos.y > MINE_POP) this.removeMine(mine);
        continue;
      }
      const floor = this.mineFloor(mine);
      const water = floor.y;
      if (mine.sinking !== undefined) {
        mine.sinking += dt;
        mine.pos.y = water - mine.sinking * MINE_SINK;
        mine.mesh.position.copy(mine.pos);
        if (Math.random() < dt * 20) this.fx.ember?.(mine.pos.x, water, mine.pos.z);
        if (mine.sinking > MINE_SINK_TIME) this.removeMine(mine, true);
        continue;
      }
      if (!mine.settled) {
        mine.vel.y -= 25 * dt;
        mine.pos.addScaledVector(mine.vel, dt);
        mine.mesh.rotation.x += dt * 7;
        mine.mesh.rotation.z += dt * 4.5;
        const below = this.mineFloor(mine);
        if (mine.pos.y <= below.y + (below.dry ? MINE_ROLL : 0)) {
          Object.assign(floor, below);
          mine.settled = true;
          mine.dry = floor.dry;
          mine.pos.y = floor.y + (floor.dry ? MINE_ROLL : 0);
          if (floor.dry) mine.vel.multiplyScalar(MINE_LANDING);
          if (floor.molten) mine.sinking = 0;
          else if (floor.dry) this.fx.puffs.emit(mine.pos.x, floor.y + 0.3, mine.pos.z, 0, 1.5, 0, 0.8, 0.5, MINE_DUST, 3, 1.5, 0);
          else this.fx.splash(mine.pos.x, floor.y, mine.pos.z, 0.4);
        }
      } else if (mine.dry) {
        mine.vel.y = 0;
        mine.vel.multiplyScalar(Math.exp(-MINE_FRICTION * dt));
        mine.pos.addScaledVector(mine.vel, dt);
        mine.pos.y = water + MINE_ROLL;
        mine.mesh.rotation.x += Math.hypot(mine.vel.x, mine.vel.z) * dt / MINE_ROLL;
      } else {
        mine.pos.y = water - 0.35;
      }
      mine.mesh.position.copy(mine.pos);
      mine.mesh.rotation.y += dt * 0.6;
      if (mine.settled && !mine.dry) {
        const settle = 1 - Math.exp(-4 * dt);
        mine.mesh.rotation.x += (0 - mine.mesh.rotation.x % (Math.PI * 2)) * settle;
        mine.mesh.rotation.z += (Math.sin(this.time * 2 + mine.age) * 0.12 - mine.mesh.rotation.z % (Math.PI * 2)) * settle;
      }
      const armed = mine.age > 0.8;
      mine.mesh.userData.light.visible = armed ? (mine.age * 3) % 1 < 0.5 : true;

      if (armed && mine.settled) {
        for (const o of this.boats) {
          if (!o.alive || o.yOffset > 1.6 || o.morphing || this.ceasefire || (o.aloft && o.pos.y - water > MINE_REACH)) continue;
          if (o === mine.owner && mine.age < 2.5) continue;
          if (o.distanceToAxis2D(mine.pos.x, mine.pos.z) < 4) {
            this.fx.explosion(mine.pos.x, water + 0.5, mine.pos.z, 1.2);
            this.sfx.play('mineBoom', mine.pos);
            this.blasts.push({ x: mine.pos.x, z: mine.pos.z, owner: mine.owner });
            this.damage(o, 40, mine.owner, 'mine', { spin: 1, launch: 0.9 });
            this.removeMine(mine);
            break;
          }
        }
      }
      if (mine.age > 45 && this.mines.includes(mine)) this.removeMine(mine, true);
    }
  },
};

export const actions = {
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
    const onCourse = this.track.grounded?.(b.trackS) ?? false;
    const aerial = !onCourse && !!b.form && b.formP > 0.5 && this.track.formKind?.(b.trackS) === 'jet';
    this.mines.push({ pos, vel, owner: b, age: 0, settled: false, mesh, floating: this.submerged(b), onCourse, aerial, idx: b.trackIdx });
    const own = this.mines.filter((m) => m.owner === b);
    if (own.length > 4) this.removeMine(own[0], true);
    this.sfx.play('plop', b.pos);
  },
};
