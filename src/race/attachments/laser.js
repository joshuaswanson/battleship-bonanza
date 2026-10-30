import * as THREE from 'three';
import { laserWobble, aimLaserGun, stepLaser, laserDirection, pointLaserGun } from '../../boatModel.js';
import { waveHeight } from '../../water.js';
import { toon } from '../../toon.js';
import { LASER_REACH, SAW_LEAK } from '../shared.js';

const ICE_MELT = 0.5;
const ICE_SHARDS = 34;
const ICE_FLASH = 0.2;
const ICE_SHARD = new THREE.OctahedronGeometry(1, 0).toNonIndexed();
ICE_SHARD.computeVertexNormals();
const ICE_TONES = [0xeafcff, 0xbdeafa, 0x8fdcf2, 0x6cc7ec];
const iceMaterials = [];
const iceShardMaterial = (k) => (iceMaterials[k % 4] ??= toon(ICE_TONES[k % 4]));
const FLASH_BALL = new THREE.SphereGeometry(1, 16, 12);

function iceFlash(at) {
  const mesh = new THREE.Mesh(FLASH_BALL, new THREE.MeshBasicMaterial({ color: 0xe8fbff, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending }));
  mesh.position.copy(at);
  return mesh;
}

function meltMark() {
  const g = new THREE.Group();
  const hot = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide });
  g.add(new THREE.Mesh(new THREE.CircleGeometry(0.9, 18), hot(0xe8341c, 0.92)));
  const mid = new THREE.Mesh(new THREE.CircleGeometry(0.62, 16), hot(0xffa02a, 1));
  mid.position.z = 0.015;
  g.add(mid);
  const core = new THREE.Mesh(new THREE.CircleGeometry(0.34, 14), hot(0xfff8d8, 1));
  core.position.z = 0.03;
  g.add(core);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.36, 12, 8), hot(0xffd070, 1));
  g.add(ball);
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2 + (k % 2) * 0.3;
    const len = 1 + (k % 3) * 0.45;
    const crack = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.05).translate(len / 2 + 0.3, 0, 0), hot(0x1f6fa8, 0.9));
    crack.rotation.z = a;
    crack.position.z = 0.02;
    g.add(crack);
  }
  return g;
}

export const methods = {
  meltIce(tree, point, dir, dt) {
    tree.melt = (tree.melt ?? 0) + dt;
    tree.meltAt = this.time;
    const out = dir.clone().negate();
    const hot = point.clone().addScaledVector(dir, tree.radius * 0.1);
    let mark = this.iceMarks.get(tree);
    if (!mark) {
      mark = meltMark();
      this.iceMarks.set(tree, mark);
      this.scene.add(mark);
    }
    tree.meltHit = hot;
    const u = Math.min(1, tree.melt / ICE_MELT);
    mark.position.copy(hot);
    mark.lookAt(hot.clone().add(out));
    mark.scale.setScalar(tree.radius * (0.25 + u * 1.15));
    const r = Math.random;
    for (let k = 0; k < 2; k++) this.fx.puffs.emit(hot.x + (r() - 0.5), hot.y + (r() - 0.5), hot.z + (r() - 0.5), out.x * 3 + (r() - 0.5) * 2, 3 + r() * 3, out.z * 3 + (r() - 0.5) * 2, 0.2 + r() * 0.4 * (0.5 + u), 0.8, 0xd8f6ff, -5, 0.9, 1);
    if (r() < 0.4) this.fx.sparkBurst(hot.x, hot.y, hot.z, 0xfff0c0, 3);
    if (tree.melt >= ICE_MELT) this.chopper.chop(tree.id, hot.y, dir.clone());
  },

  shatterIce(tree, dir) {
    const mark = this.iceMarks.get(tree);
    if (mark) this.scene.remove(mark);
    this.iceMarks.delete(tree);
    const r = Math.random;
    const low = tree.base + tree.hang.low;
    const high = tree.base + tree.hang.high;
    const hit = tree.meltHit ?? new THREE.Vector3(tree.x, (low + high) / 2, tree.z);
    for (let k = 0; k < ICE_SHARDS; k++) {
      const a = r() * Math.PI * 2;
      const u = r();
      const spot = new THREE.Vector3(tree.x + Math.cos(a) * tree.radius * Math.sqrt(r()) * 0.75, low + u * (high - low), tree.z + Math.sin(a) * tree.radius * Math.sqrt(r()) * 0.75);
      const near = Math.max(0, 1 - spot.distanceTo(hit) / 9);
      const size = (0.6 + r() * r() * 2.2) * (1.4 - near * 0.6);
      const mesh = new THREE.Mesh(ICE_SHARD, iceShardMaterial(k));
      mesh.position.copy(spot);
      mesh.scale.set(size * (0.3 + r() * 0.35), size * (1 + r() * 1.3), size * (0.3 + r() * 0.35));
      mesh.rotation.set(r() * 6, r() * 6, r() * 6);
      this.scene.add(mesh);
      const away = spot.clone().sub(hit);
      away.y *= 0.45;
      away.normalize().multiplyScalar(4 + near * 20 + r() * 5).addScaledVector(dir, 2 + near * 9);
      this.iceChunks.push({ mesh, vel: away, spin: new THREE.Vector3((r() - 0.5) * 9, (r() - 0.5) * 9, (r() - 0.5) * 9), floor: tree.base + 0.5, sink: 1.2 + r() * 2.4, life: 2.2 + r() * 1.8 });
    }
    this.iceFlashes.push({ mesh: iceFlash(hit), t: 0 });
    this.scene.add(this.iceFlashes.at(-1).mesh);
    for (let k = 0; k < 26; k++) this.fx.puffs.emit(hit.x, hit.y, hit.z, (r() - 0.5) * 22, (r() - 0.5) * 16, (r() - 0.5) * 22, 0.08 + r() * 0.16, 0.5 + r() * 0.6, 0xffffff, 3, 1.4, 1);
    for (let k = 0; k < 10; k++) this.fx.bubbles(hit.x, hit.y + (r() - 0.5) * 7, hit.z);
    this.sfx.play('hit', hit);
    this.sfx.play('tink', hit);
  },

  updateIceChunks(dt) {
    for (const [tree, mark] of this.iceMarks) {
      if (this.time - tree.meltAt < 0.12) continue;
      tree.melt -= dt * 0.6;
      mark.scale.multiplyScalar(Math.exp(-2 * dt));
      if (tree.melt <= 0) {
        tree.melt = 0;
        this.scene.remove(mark);
        this.iceMarks.delete(tree);
      }
    }
    this.iceFlashes = this.iceFlashes.filter((f) => {
      f.t += dt / ICE_FLASH;
      f.mesh.scale.setScalar(1 + f.t * 9);
      f.mesh.material.opacity = Math.max(0, 0.32 * (1 - f.t) ** 2);
      if (f.t < 1) return true;
      this.scene.remove(f.mesh);
      return false;
    });
    this.iceChunks = this.iceChunks.filter((c) => {
      c.life -= dt;
      c.vel.multiplyScalar(Math.exp(-3.4 * dt));
      c.vel.y -= c.sink * dt;
      c.mesh.position.addScaledVector(c.vel, dt);
      c.spin.multiplyScalar(Math.exp(-0.9 * dt));
      if (c.mesh.position.y <= c.floor) {
        c.mesh.position.y = c.floor;
        c.vel.set(0, 0, 0);
        c.spin.set(0, 0, 0);
      }
      c.mesh.rotation.x += c.spin.x * dt;
      c.mesh.rotation.y += c.spin.y * dt;
      c.mesh.rotation.z += c.spin.z * dt;
      if (c.life < 0.8) c.mesh.scale.multiplyScalar(Math.exp(-5 * dt));
      if (c.life > 0) return true;
      this.scene.remove(c.mesh);
      return false;
    });
  },

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
      let origin = pointLaserGun(b.model, dir, new THREE.Vector3());
      const reach = LASER_REACH * Math.hypot(1, drop);
      const ice = this.chopper?.iceTarget(origin, dir, LASER_REACH, b.iceLock);
      b.iceLock = ice;
      if (ice && !this.raycastBoats(origin, dir, reach, b)) {
        dir.set(ice.x - origin.x, 0, ice.z - origin.z).normalize();
        origin = pointLaserGun(b.model, dir, origin);
      }
      const ahead = ice ? null : this.chopper?.trunkAhead(origin, dir, LASER_REACH);
      if (ahead && !this.raycastBoats(origin, dir, reach, b)) {
        for (const up of [1.2, 2.5, 4, 6, ahead.height * 0.45]) {
          const toward = new THREE.Vector3(ahead.x, ahead.base + Math.min(up, ahead.height * 0.45) + wobble.lift * 4, ahead.z).sub(origin);
          const length = toward.length();
          toward.divideScalar(length);
          if (this.marchSurface(origin, toward, length - ahead.radius - 0.6)) continue;
          dir.copy(toward);
          origin = pointLaserGun(b.model, dir, origin);
          break;
        }
      }
      if (b.isPlayer) this.lastLaserDir = dir;
      const wall = this.marchSurface(origin, dir, reach);
      const trunk = this.chopper?.march(origin, dir, wall ? wall.t + 3 : reach);
      let hit = this.raycastBoats(origin, dir, trunk ? trunk.t : wall ? wall.t : reach, b);
      if (trunk && !hit) {
        const { tree, point } = trunk;
        if (tree.hang) {
          this.fx.beam(origin, point, 0xff2a2a, 0.5, 0.05, 1, b.model.laserMount);
          this.meltIce(tree, point, dir, dt);
          continue;
        }
        const cutY = Math.min(Math.max(point.y, tree.base + 0.6), tree.base + tree.height * 0.45);
        this.chopper.chop(tree.id, cutY, dir.clone());
        this.fx.beam(origin, point, 0xff2a2a, 0.5, 0.05, 1, b.model.laserMount);
        this.fx.sparkBurst(point.x, cutY, point.z, 0xffb070, 14);
        for (let k = 0; k < 10; k++) this.fx.puffs.emit(point.x, cutY, point.z, (Math.random() - 0.5) * 8, 2 + Math.random() * 5, (Math.random() - 0.5) * 8, 0.18 + Math.random() * 0.12, 0.8, 0xc99a5c, 18, 0.6, 1);
        this.sfx.play('tink', point);
        continue;
      }
      if (wall && !hit) {
        const end = wall.point;
        this.fx.beam(origin, end, 0xff2a2a, 0.5, 0.05, 1, b.model.laserMount);
        const gap = b.lastBurn ? b.lastBurn.distanceTo(end) : Infinity;
        if (gap > 0.3) {
          const steps = gap < 5 ? Math.ceil(gap / 0.3) : 1;
          for (let k = 1; k <= steps; k++) {
            let at = end;
            let normal = wall.normal;
            let extent = wall.extent;
            if (k < steps) {
              at = b.lastBurn.clone().lerp(end, k / steps);
              if (this.raycast) {
                const toward = at.clone().sub(origin);
                const length = toward.length();
                const between = this.raycast(origin, toward.divideScalar(length), length + 1.5);
                if (!between || between.t < length - 1.5) continue;
                ({ point: at, normal, extent } = between);
              }
            }
            this.stampDecal('burn', at, normal, Math.min(0.8 + Math.random() * 0.3, (extent ?? Infinity) * 0.75));
          }
          b.lastBurn = end.clone();
        }
        if (Math.random() < 0.5) this.fx.sparkBurst(end.x, end.y, end.z, 0xffb070, 3);
        if (Math.random() < 0.25) this.fx.smoke(end.x + wall.normal.x * 0.4, end.y + 0.3, end.z + wall.normal.z * 0.4);
        continue;
      }
      const shielded = hit && hit.boat.model.sawYaw && this.inArc(hit.boat, hit.boat.items.indexOf('saw'), origin.x, origin.z);
      const end = shielded ? this.shieldAgainst(hit.boat, b) : origin.clone().addScaledVector(dir, hit ? hit.t : reach);
      this.fx.beam(origin, end, 0xff2a2a, 0.5, 0.05, 1, b.model.laserMount);
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
