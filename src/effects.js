import * as THREE from 'three';
import { toon, glow } from './toon.js';

class ParticlePool {
  constructor(scene, material, max) {
    this.max = max;
    this.mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), material, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    const white = new THREE.Color(1, 1, 1);
    for (let i = 0; i < max; i++) this.mesh.setColorAt(i, white);
    this.zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < max; i++) this.mesh.setMatrixAt(i, this.zero);
    scene.add(this.mesh);
    this.p = new Float32Array(max * 3);
    this.v = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.size = new Float32Array(max);
    this.gravity = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.shape = new Uint8Array(max);
    this.flat = new Float32Array(max);
    this.next = 0;
    this.m = new THREE.Matrix4();
    this.c = new THREE.Color();
  }

  emit(x, y, z, vx, vy, vz, size, life, color, gravity = 0, drag = 0, shape = 0, flat = 1) {
    const i = this.next;
    this.next = (this.next + 1) % this.max;
    this.p[i * 3] = x;
    this.p[i * 3 + 1] = y;
    this.p[i * 3 + 2] = z;
    this.v[i * 3] = vx;
    this.v[i * 3 + 1] = vy;
    this.v[i * 3 + 2] = vz;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.size[i] = size;
    this.gravity[i] = gravity;
    this.drag[i] = drag;
    this.shape[i] = shape;
    this.flat[i] = flat;
    this.mesh.setColorAt(i, this.c.set(color));
    this.mesh.instanceColor.needsUpdate = true;
  }

  update(dt) {
    const { p, v, m } = this;
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.mesh.setMatrixAt(i, this.zero);
        continue;
      }
      const k = 1 - this.life[i] / this.maxLife[i];
      const damp = Math.exp(-this.drag[i] * dt);
      v[i * 3] *= damp;
      v[i * 3 + 1] = v[i * 3 + 1] * damp - this.gravity[i] * dt;
      v[i * 3 + 2] *= damp;
      p[i * 3] += v[i * 3] * dt;
      p[i * 3 + 1] += v[i * 3 + 1] * dt;
      p[i * 3 + 2] += v[i * 3 + 2] * dt;
      let s;
      if (this.shape[i] === 0) s = k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85;
      else if (this.shape[i] === 1) s = 1 - k;
      else s = (0.35 + k * 0.65) * (1 - k * k * k);
      s *= this.size[i];
      m.makeScale(s, s * this.flat[i], s);
      m.setPosition(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]);
      this.mesh.setMatrixAt(i, m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

class Transient {
  constructor(scene, geometry, max, additive = false) {
    this.items = [];
    for (let i = 0; i < max; i++) {
      const material = new THREE.MeshBasicMaterial({
        transparent: true,
        depthWrite: false,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.visible = false;
      mesh.frustumCulled = false;
      scene.add(mesh);
      this.items.push({ mesh, life: 0, maxLife: 1, update: null });
    }
    this.next = 0;
  }
  take(color, life, update) {
    const item = this.items[this.next];
    this.next = (this.next + 1) % this.items.length;
    item.mesh.material.color.set(color);
    item.mesh.visible = true;
    item.life = life;
    item.maxLife = life;
    item.update = update;
    return item;
  }
  update(dt) {
    for (const item of this.items) {
      if (item.life <= 0) continue;
      item.life -= dt;
      if (item.life <= 0) {
        item.mesh.visible = false;
        continue;
      }
      item.update(item.mesh, 1 - item.life / item.maxLife);
    }
  }
}

export class Effects {
  constructor(scene) {
    this.puffs = new ParticlePool(scene, toon(0xffffff, { emissive: 0x6f93ad }), 2400);
    this.sparks = new ParticlePool(scene, glow(0xffffff), 900);
    this.rings = new Transient(scene, new THREE.TorusGeometry(1, 0.12, 8, 48).rotateX(Math.PI / 2), 16, false);
    const beam = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.5);
    this.beams = new Transient(scene, beam, 48, false);
    this.shells = new Transient(scene, new THREE.SphereGeometry(1, 32, 20), 6, true);
  }

  update(dt) {
    this.puffs.update(dt);
    this.sparks.update(dt);
    this.rings.update(dt);
    this.beams.update(dt);
    this.shells.update(dt);
  }

  wake(x, y, z, sideX, sideZ, speed) {
    const r = Math.random;
    const s = 0.22 + Math.min(1, speed / 40) * 0.22;
    for (const side of [-1, 1]) {
      const spread = 1.6 + r() * 0.4;
      this.puffs.emit(
        x + sideX * side * spread, y, z + sideZ * side * spread,
        sideX * side * 2.5 + (r() - 0.5), 0.3 + r() * 0.3, sideZ * side * 2.5 + (r() - 0.5),
        s * (0.8 + r() * 0.5), 0.8 + r() * 0.4, 0xffffff, 0.6, 1.5, 2, 0.45,
      );
    }
  }

  splash(x, y, z, power = 1) {
    const r = Math.random;
    const count = Math.round(14 * power);
    for (let i = 0; i < count; i++) {
      const a = r() * Math.PI * 2;
      const sp = (4 + r() * 6) * power;
      this.puffs.emit(x, y, z, Math.cos(a) * sp, (6 + r() * 8) * power, Math.sin(a) * sp, 0.4 + r() * 0.5 * power, 0.7 + r() * 0.4, r() < 0.3 ? 0xbff6ff : 0xffffff, 22, 0.5, 1);
    }
    this.ring(x, y + 0.2, z, 0xffffff, 1 * power, 6 * power, 0.6);
  }

  explosion(x, y, z, power = 1) {
    const r = Math.random;
    for (let i = 0; i < 26 * power; i++) {
      const dir = new THREE.Vector3(r() - 0.5, r() * 0.8 + 0.1, r() - 0.5).normalize();
      const sp = (6 + r() * 10) * power;
      const color = [0xffe066, 0xffa62b, 0xff5e3a][i % 3];
      this.sparks.emit(x, y, z, dir.x * sp, dir.y * sp, dir.z * sp, (0.7 + r() * 0.9) * power, 0.35 + r() * 0.35, color, 4, 3, 0);
    }
    for (let i = 0; i < 12 * power; i++) {
      const a = r() * Math.PI * 2;
      this.puffs.emit(x + Math.cos(a) * 1.5, y + r() * 2, z + Math.sin(a) * 1.5, Math.cos(a) * 3, 3 + r() * 3, Math.sin(a) * 3, 1.4 + r() * 1.2, 1.1 + r() * 0.6, i % 2 ? 0x9aa4b4 : 0xd9dee8, -1, 1.5, 0);
    }
    this.splash(x, Math.min(y, 0.5), z, power);
    this.ring(x, y, z, 0xffd23f, 1, 9 * power, 0.35);
  }

  sparkBurst(x, y, z, color = 0xffe066, count = 8) {
    const r = Math.random;
    for (let i = 0; i < count; i++) {
      const sp = 6 + r() * 8;
      this.sparks.emit(x, y, z, (r() - 0.5) * sp, r() * sp * 0.8, (r() - 0.5) * sp, 0.18 + r() * 0.15, 0.3 + r() * 0.2, color, 18, 1, 1);
    }
  }

  smoke(x, y, z) {
    const r = Math.random;
    this.puffs.emit(x, y, z, (r() - 0.5) * 1.5, 0.5 + r(), (r() - 0.5) * 1.5, 0.5 + r() * 0.4, 0.8 + r() * 0.4, r() < 0.5 ? 0xffffff : 0xdfe6ee, -0.5, 1, 0);
  }

  flame(x, y, z, vx = 0, vy = -8, vz = 0) {
    const r = Math.random;
    this.sparks.emit(x, y, z, vx + (r() - 0.5) * 2, vy + (r() - 0.5) * 2, vz + (r() - 0.5) * 2, 0.35 + r() * 0.3, 0.25, r() < 0.5 ? 0xffd23f : 0xff8a1f, 0, 2, 1);
  }

  bubbles(x, y, z) {
    const r = Math.random;
    this.puffs.emit(x + (r() - 0.5) * 3, y, z + (r() - 0.5) * 3, (r() - 0.5), 2 + r() * 2, (r() - 0.5), 0.25 + r() * 0.35, 0.8 + r() * 0.6, r() < 0.5 ? 0xbff6ff : 0xffffff, -2, 1, 0);
  }

  ring(x, y, z, color, from, to, life, opacity = 0.9) {
    this.rings.take(color, life, (mesh, k) => {
      const s = from + (to - from) * (1 - (1 - k) * (1 - k));
      mesh.position.set(x, y, z);
      mesh.scale.set(s, 1 + s * 0.15, s);
      mesh.material.opacity = opacity * (1 - k);
    });
  }

  followRing(target, color, radius, life) {
    this.rings.take(color, life, (mesh, k) => {
      const s = radius * (1 - (1 - k) * (1 - k) * (1 - k));
      mesh.position.set(target.x, target.y + 1, target.z);
      mesh.scale.set(s, 3, s);
      mesh.material.opacity = 0.9 * (1 - k);
    });
  }

  shell(target, color, radius, life) {
    this.shells.take(color, life, (mesh, k) => {
      const s = radius * (1 - (1 - k) * (1 - k) * (1 - k));
      mesh.position.set(target.x, target.y, target.z);
      mesh.scale.set(s, s * 0.45, s);
      mesh.material.opacity = 0.45 * (1 - k);
    });
  }

  scorch(x, y, z) {
    const r = Math.random;
    this.sparks.emit(x, y, z, 0, 0, 0, 0.55 + r() * 0.2, 1.1, r() < 0.5 ? 0xff2a2a : 0xffffff, 0, 0, 1, 0.25);
    if (r() < 0.35) this.puffs.emit(x, y + 0.3, z, (r() - 0.5), 2 + r() * 2, (r() - 0.5), 0.5 + r() * 0.4, 0.9, 0xffffff, -1, 1, 0);
  }

  beam(from, to, color, width = 0.35, life = 0.4, sparks = 6) {
    const a = from.clone();
    const b = to.clone();
    const length = a.distanceTo(b);
    for (const [w, c] of [[width, color], [width * 0.3, 0xfff0e8]]) {
      this.beams.take(c, life, (mesh, k) => {
        mesh.position.copy(a);
        mesh.lookAt(b);
        const s = w * (1 - k);
        mesh.scale.set(s, s, length);
        mesh.material.opacity = 1 - k * k;
      });
    }
    if (sparks) this.sparkBurst(b.x, b.y, b.z, color, sparks);
  }
}

