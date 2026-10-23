import * as THREE from 'three';
import { buildHook, aimTurret } from '../../boatModel.js';
import { waveHeight } from '../../water.js';
import { fast } from '../../tuning.js';
import { t as tr } from '../../i18n.js';
import { toon } from '../../toon.js';
import { HOOK_SPEED } from '../shared.js';

const ROPE_GEOMETRY = new THREE.CylinderGeometry(0.07, 0.07, 1, 6, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.5);
const ROPE_MATERIAL = toon(0x34465e);
const ROPE_POINTS = 16;
const GRAVITY = new THREE.Vector3(0, -30, 0);

export const methods = {
  isTethered(b) {
    return this.hooks.some((h) => h.phase === 'attached' && h.target === b);
  },

  slacken(h, from, dt) {
    h.phase = 'retract';
    const points = [];
    const prev = [];
    const fling = h.dir.clone().multiplyScalar(HOOK_SPEED * dt);
    for (let i = 0; i < ROPE_POINTS; i++) {
      const u = i / (ROPE_POINTS - 1);
      const p = from.clone().lerp(h.pos, u);
      points.push(p);
      prev.push(p.clone().addScaledVector(fling, -u * 0.6));
    }
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), ROPE_MATERIAL);
    mesh.frustumCulled = false;
    this.scene.remove(h.rope);
    this.scene.add(mesh);
    h.loose = { points, prev, length: from.distanceTo(h.pos), wait: 0.35, mesh };
  },

  reelSlack(h, from, dt) {
    const rope = h.loose;
    const { points, prev } = rope;
    rope.wait -= dt;
    if (rope.wait <= 0) {
      rope.length = Math.max(0, rope.length - fast(55) * dt);
      rope.click = (rope.click ?? 0) - dt;
      if (rope.click <= 0) {
        rope.click = 0.7;
        this.sfx.play('reel', h.owner.pos);
      }
    }
    if (rope.length < 2.5) return true;
    const step = new THREE.Vector3();
    for (let i = 1; i < ROPE_POINTS; i++) {
      const p = points[i];
      step.subVectors(p, prev[i]).multiplyScalar(0.985);
      prev[i].copy(p);
      p.add(step).addScaledVector(GRAVITY, dt * dt);
      const water = waveHeight(p.x, p.z, this.time) + (i === ROPE_POINTS - 1 ? 0.15 : -0.05);
      if (p.y < water) {
        p.y = water;
        prev[i].x += (p.x - prev[i].x) * 0.12;
        prev[i].z += (p.z - prev[i].z) * 0.12;
        prev[i].y = p.y;
      }
    }
    points[0].copy(from);
    prev[0].copy(from);
    const rest = rope.length / (ROPE_POINTS - 1);
    const delta = new THREE.Vector3();
    for (let pass = 0; pass < 10; pass++) {
      points[0].copy(from);
      for (let i = 0; i < ROPE_POINTS - 1; i++) {
        const a = points[i];
        const b = points[i + 1];
        delta.subVectors(b, a);
        const d = delta.length() || 1e-4;
        const fix = (d - rest) / d;
        if (i === 0) b.addScaledVector(delta, -fix);
        else {
          a.addScaledVector(delta, fix * 0.5);
          b.addScaledVector(delta, -fix * 0.5);
        }
      }
    }
    const end = points[ROPE_POINTS - 1];
    h.pos.copy(end);
    h.mesh.position.copy(end);
    h.mesh.lookAt(delta.subVectors(end, points[ROPE_POINTS - 2]).add(end));
    rope.mesh.geometry.dispose();
    rope.mesh.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 32, 0.07, 5);
    if (Math.random() < 0.15 && end.y < waveHeight(end.x, end.z, this.time) + 0.4) this.fx.droplet(end.x, end.y, end.z, 0, 2 + Math.random() * 2, 0, 0.25);
    return false;
  },

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
          if (gap < 4 && this.sawCuts(h.target, o)) {
            const cut = h.pos.clone();
            this.shieldAgainst(h.target, o);
            this.fx.sparkBurst(cut.x, cut.y, cut.z, 0xffe066, 18);
            this.sfx.play('tink', cut);
            this.sfx.play('saw', cut);
            if (o.isPlayer) this.emit('warning', { text: tr('hookCut') });
            this.slacken(h, from, dt);
            return true;
          }
          if (gap < 1.2) {
            h.phase = 'attached';
            h.time = 3;
            this.sfx.play('hookCatch', h.target.pos);
            if (o.isPlayer) this.emit('feed', { text: tr('youHooked', { name: h.target.name }), player: true });
          }
        } else {
          h.pos.addScaledVector(h.dir, HOOK_SPEED * dt);
          h.travelled += HOOK_SPEED * dt;
          if (h.travelled > 70) this.slacken(h, from, dt);
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
          o.speed += fast(7);
        }
      } else if (h.loose) {
        if (this.reelSlack(h, from, dt)) {
          this.scene.remove(h.mesh, h.loose.mesh);
          h.loose.mesh.geometry.dispose();
          o.model.hookHead.visible = !this.hooks.some((other) => other !== h && other.owner === o);
          return false;
        }
        return true;
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
  },

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
  },

  hookPoint(h, out) {
    return h.anchor ? h.anchor.getWorldPosition(out) : h.target.center(out);
  },

  hookSpec(b) {
    return {
      range: 70,
      minDot: 0.55,
    };
  },
};

export const actions = {
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
};
