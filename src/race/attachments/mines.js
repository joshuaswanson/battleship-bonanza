import * as THREE from 'three';
import { buildMine, launchMine } from '../../boatModel.js';
import { waveHeight } from '../../water.js';

export const methods = {
  removeMine(mine, puff = false) {
    this.scene.remove(mine.mesh);
    this.mines = this.mines.filter((m) => m !== mine);
    if (puff) this.fx.smoke(mine.pos.x, mine.pos.y + 0.5, mine.pos.z);
  },

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
    this.mines.push({ pos, vel, owner: b, age: 0, settled: false, mesh });
    const own = this.mines.filter((m) => m.owner === b);
    if (own.length > 4) this.removeMine(own[0], true);
    this.sfx.play('plop', b.pos);
  },
};
