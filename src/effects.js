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
    update(item.mesh, 0);
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

class CasingPool {
  constructor(scene, max) {
    const geometry = new THREE.CylinderGeometry(0.07, 0.07, 0.3, 8);
    this.mesh = new THREE.InstancedMesh(geometry, toon(0xe0b040, { emissive: 0x6b4a10 }), max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < max; i++) this.mesh.setMatrixAt(i, this.zero);
    scene.add(this.mesh);
    this.items = Array.from({ length: max }, () => ({ pos: new THREE.Vector3(), vel: new THREE.Vector3(), spin: new THREE.Vector3(), rot: new THREE.Euler(), life: 0 }));
    this.next = 0;
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.one = new THREE.Vector3(1, 1, 1);
  }

  emit(pos, vel) {
    const c = this.items[this.next];
    this.next = (this.next + 1) % this.items.length;
    c.pos.copy(pos);
    c.vel.copy(vel);
    c.spin.set((Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30);
    c.rot.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    c.life = 1.4;
  }

  update(dt, onWater) {
    this.items.forEach((c, i) => {
      if (c.life <= 0) return;
      c.life -= dt;
      c.vel.y -= 30 * dt;
      c.pos.addScaledVector(c.vel, dt);
      c.rot.x += c.spin.x * dt;
      c.rot.y += c.spin.y * dt;
      c.rot.z += c.spin.z * dt;
      if (c.pos.y < 0.1 && c.vel.y < 0) {
        onWater(c.pos);
        c.life = 0;
      }
      this.mesh.setMatrixAt(i, c.life > 0 ? this.m.compose(c.pos, this.q.setFromEuler(c.rot), this.one) : this.zero);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

const BOLT_VERT = /* glsl */ `
  attribute float aAcross;
  attribute float aAlpha;
  attribute vec3 aColor;
  varying float vAcross;
  varying float vAlpha;
  varying vec3 vColor;
  #include <common>
  #include <fog_pars_vertex>
  void main() {
    vAcross = aAcross;
    vAlpha = aAlpha;
    vColor = aColor;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const BOLT_FRAG = /* glsl */ `
  varying float vAcross;
  varying float vAlpha;
  varying vec3 vColor;
  #include <common>
  #include <fog_pars_fragment>
  void main() {
    float d = abs(vAcross);
    float core = 1.0 - smoothstep(0.18, 0.32, d);
    float glow = 1.0 - smoothstep(0.3, 1.0, d);
    vec3 color = mix(vColor, vec3(1.0), core);
    float a = max(core, glow * glow * 0.75) * vAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(color, a);
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

function arcPoints(a, b) {
  const r = Math.random;
  const span = a.distanceTo(b);
  const control = a.clone().lerp(b, 0.5);
  control.y += 1.5 + span * 0.35;
  const steps = Math.max(10, Math.min(28, Math.round(span / 1.2)));
  const jitter = Math.min(0.6, 0.15 + span * 0.02);
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    const p = new THREE.Vector3(
      u * u * a.x + 2 * u * t * control.x + t * t * b.x,
      u * u * a.y + 2 * u * t * control.y + t * t * b.y,
      u * u * a.z + 2 * u * t * control.z + t * t * b.z,
    );
    if (i > 0 && i < steps) {
      const k = Math.sin(t * Math.PI) * jitter;
      p.x += (r() - 0.5) * k;
      p.y += (r() - 0.5) * k;
      p.z += (r() - 0.5) * k;
    }
    points.push(p);
  }
  return points;
}

class Lightning {
  constructor(scene, max = 30000) {
    this.max = max;
    this.positions = new Float32Array(max * 3);
    this.across = new Float32Array(max);
    this.alphas = new Float32Array(max);
    this.colors = new Float32Array(max * 3);
    const geometry = new THREE.BufferGeometry();
    const attr = (name, array, size) => geometry.setAttribute(name, new THREE.BufferAttribute(array, size).setUsage(THREE.DynamicDrawUsage));
    attr('position', this.positions, 3);
    attr('aAcross', this.across, 1);
    attr('aAlpha', this.alphas, 1);
    attr('aColor', this.colors, 3);
    this.geometry = geometry;
    const material = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog]),
      vertexShader: BOLT_VERT,
      fragmentShader: BOLT_FRAG,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: true,
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
    scene.add(this.mesh);
    this.bolts = [];
  }

  add(points, color, width, life) {
    this.bolts.push({ points, color: new THREE.Color(color), width, life, max: life });
  }

  update(dt, camera) {
    this.bolts = this.bolts.filter((b) => (b.life -= dt) > 0);
    const tangent = new THREE.Vector3();
    const toCam = new THREE.Vector3();
    const side = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    let v = 0;
    const put = (p, across, alpha, color) => {
      this.positions[v * 3] = p.x;
      this.positions[v * 3 + 1] = p.y;
      this.positions[v * 3 + 2] = p.z;
      this.across[v] = across;
      this.alphas[v] = alpha;
      this.colors[v * 3] = color.r;
      this.colors[v * 3 + 1] = color.g;
      this.colors[v * 3 + 2] = color.b;
      v++;
    };
    for (const bolt of this.bolts) {
      const pts = bolt.points;
      const n = pts.length;
      if (v + (n - 1) * 6 > this.max) break;
      const alpha = (bolt.life / bolt.max) * (0.75 + Math.random() * 0.25);
      const left = [];
      const right = [];
      for (let i = 0; i < n; i++) {
        tangent.subVectors(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)]).normalize();
        if (camera) toCam.subVectors(camera.position, pts[i]);
        else toCam.copy(up);
        side.crossVectors(tangent, toCam).normalize();
        const taper = i === 0 || i === n - 1 ? 0.45 : 1;
        side.multiplyScalar(bolt.width * taper);
        left.push(pts[i].clone().add(side));
        right.push(pts[i].clone().sub(side));
      }
      for (let i = 0; i < n - 1; i++) {
        put(left[i], -1, alpha, bolt.color);
        put(right[i], 1, alpha, bolt.color);
        put(left[i + 1], -1, alpha, bolt.color);
        put(left[i + 1], -1, alpha, bolt.color);
        put(right[i], 1, alpha, bolt.color);
        put(right[i + 1], 1, alpha, bolt.color);
      }
    }
    this.geometry.setDrawRange(0, v);
    for (const name of ['position', 'aAcross', 'aAlpha', 'aColor']) this.geometry.attributes[name].needsUpdate = true;
  }
}

export class Effects {
  constructor(scene) {
    this.puffs = new ParticlePool(scene, toon(0xffffff, { emissive: 0x6f93ad }), 4200);
    this.sparks = new ParticlePool(scene, glow(0xffffff), 900);
    this.rings = new Transient(scene, new THREE.TorusGeometry(1, 0.12, 8, 48).rotateX(Math.PI / 2), 16, false);
    const beam = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.5);
    this.beams = new Transient(scene, beam, 900, false);
    this.lightning = new Lightning(scene);
    this.camera = null;
    this.timers = [];
    this.clock = 0;
    this.shells = new Transient(scene, new THREE.SphereGeometry(1, 32, 20), 6, true);
    this.casings = new CasingPool(scene, 240);
  }

  casing(pos, side, carry) {
    const r = Math.random;
    const vel = side.clone().multiplyScalar(7 + r() * 4).add(carry);
    vel.y += 6 + r() * 4;
    this.casings.emit(pos, vel);
  }

  update(dt) {
    this.puffs.update(dt);
    this.sparks.update(dt);
    this.rings.update(dt);
    this.beams.update(dt);
    this.lightning.update(dt, this.camera);
    this.clock += dt;
    if (this.timers.length) {
      const due = this.timers.filter((t) => t.at <= this.clock);
      this.timers = this.timers.filter((t) => t.at > this.clock);
      for (const t of due) t.fn();
    }
    this.shells.update(dt);
    this.casings.update(dt, (p) => this.puffs.emit(p.x, 0.2, p.z, 0, 1.5, 0, 0.14, 0.35, 0xffffff, 6, 1, 1));
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
    const count = Math.round(24 * power) + 3;
    for (let i = 0; i < count; i++) {
      const a = r() * Math.PI * 2;
      const sp = (4 + r() * 7) * power;
      this.puffs.emit(x, y, z, Math.cos(a) * sp, (7 + r() * 9) * power, Math.sin(a) * sp, 0.4 + r() * 0.55 * power, 0.7 + r() * 0.5, r() < 0.3 ? 0xbff6ff : 0xffffff, 22, 0.5, 1);
    }
    if (power >= 0.5) {
      for (let i = 0; i < 8 * power; i++) {
        this.puffs.emit(x + (r() - 0.5) * power, y, z + (r() - 0.5) * power, (r() - 0.5) * 2, (12 + r() * 8) * Math.sqrt(power), (r() - 0.5) * 2, (0.5 + r() * 0.4) * power, 0.9 + r() * 0.3, 0xffffff, 24, 0.3, 1);
      }
    }
    this.ring(x, y + 0.2, z, 0xffffff, 1 * power, 7 * power, 0.7);
  }

  droplet(x, y, z, vx, vy, vz, size = 0.3) {
    const r = Math.random;
    this.puffs.emit(x, y, z, vx, vy, vz, size * (0.7 + r() * 0.6), 0.5 + r() * 0.4, r() < 0.35 ? 0xbff6ff : 0xffffff, 22, 0.8, 1);
  }

  spray(x, y, z, fx, fz, sx, sz, speed, steer) {
    const r = Math.random;
    const s = Math.min(1, speed / 40);
    for (const side of [-1, 1]) {
      const out = 3 + s * 6 + Math.max(0, side * steer) * 7;
      const bx = x + fx * 2.2 + sx * side * 1.3;
      const bz = z + fz * 2.2 + sz * side * 1.3;
      this.droplet(bx, y, bz, sx * side * out + fx * speed * 0.5, 3 + s * 5 + r() * 2, sz * side * out + fz * speed * 0.5, 0.22 + s * 0.2);
    }
    if (s > 0.4) {
      const sx0 = x - fx * 2.6;
      const sz0 = z - fz * 2.6;
      this.droplet(sx0 + (r() - 0.5), y, sz0 + (r() - 0.5), fx * speed * 0.2 + (r() - 0.5) * 3, 4 + s * 8 + r() * 3, fz * speed * 0.2 + (r() - 0.5) * 3, 0.3 + s * 0.25);
    }
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

  mist(x, y, z) {
    const r = Math.random;
    this.puffs.emit(x, y, z, (r() - 0.5) * 4, 2 + r() * 4, (r() - 0.5) * 4, 1.6 + r() * 1.6, 1.3 + r() * 0.8, r() < 0.5 ? 0xffffff : 0xe6fbff, -1.5, 1.2, 0);
  }

  smoke(x, y, z) {
    const r = Math.random;
    this.puffs.emit(x, y, z, (r() - 0.5) * 1.5, 0.5 + r(), (r() - 0.5) * 1.5, 0.5 + r() * 0.4, 0.8 + r() * 0.4, r() < 0.5 ? 0xffffff : 0xdfe6ee, -0.5, 1, 0);
  }

  flame(x, y, z, vx = 0, vy = -8, vz = 0) {
    const r = Math.random;
    this.sparks.emit(x, y, z, vx + (r() - 0.5) * 2, vy + (r() - 0.5) * 2, vz + (r() - 0.5) * 2, 0.35 + r() * 0.3, 0.25, r() < 0.5 ? 0xffd23f : 0xff8a1f, 0, 2, 1);
  }

  blaze(x, y, z, carry) {
    const r = Math.random;
    const color = r() < 0.12 ? 0xffffff : r() < 0.5 ? 0xffd23f : r() < 0.85 ? 0xff8a1f : 0xff4a2a;
    this.sparks.emit(x, y, z, carry.x * 0.8 + (r() - 0.5) * 2, 3 + r() * 4, carry.z * 0.8 + (r() - 0.5) * 2, 0.8 + r() * 0.8, 0.4 + r() * 0.3, color, -9, 2, 2);
  }

  blackSmoke(x, y, z, carry) {
    const r = Math.random;
    this.puffs.emit(x, y, z, carry.x * 0.5 + (r() - 0.5) * 1.5, 3 + r() * 2, carry.z * 0.5 + (r() - 0.5) * 1.5, 0.9 + r() * 0.7, 1.4 + r() * 0.6, r() < 0.5 ? 0x3d3f46 : 0x5c5f68, -2, 1, 0);
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

  flameSpray(origin, dir, carry) {
    const r = Math.random;
    for (let i = 0; i < 7; i++) {
      const speed = 22 + r() * 14;
      const spread = 0.22;
      const vx = dir.x * speed + (r() - 0.5) * speed * spread + carry.x * 0.8;
      const vz = dir.z * speed + (r() - 0.5) * speed * spread + carry.z * 0.8;
      const vy = (r() - 0.3) * 4;
      const color = r() < 0.15 ? 0xffffff : r() < 0.55 ? 0xffd23f : r() < 0.85 ? 0xff8a1f : 0xff4a2a;
      this.sparks.emit(origin.x, origin.y, origin.z, vx, vy, vz, 0.5 + r() * 0.6, 0.35 + r() * 0.15, color, -6, 1.5, 2);
    }
    if (r() < 0.5) {
      const t = 0.3 + r() * 0.2;
      this.puffs.emit(origin.x + dir.x * 10, origin.y + 0.5, origin.z + dir.z * 10, dir.x * 6, 2 + r() * 2, dir.z * 6, 0.9 + r() * 0.6, 0.7 + t, r() < 0.5 ? 0x6b6f78 : 0x8c9099, -2, 1, 0);
    }
  }

  scorch(x, y, z) {
    const r = Math.random;
    this.sparks.emit(x, y, z, 0, 0, 0, 0.55 + r() * 0.2, 1.1, r() < 0.5 ? 0xff2a2a : 0xffffff, 0, 0, 1, 0.25);
    if (r() < 0.35) this.puffs.emit(x, y + 0.3, z, (r() - 0.5), 2 + r() * 2, (r() - 0.5), 0.5 + r() * 0.4, 0.9, 0xffffff, -1, 1, 0);
  }

  empIdle(refs, dt, intensity, time) {
    const flicker = 0.85 + Math.random() * 0.3 * intensity;
    refs.empCore.scale.setScalar(0.96 + 0.08 * flicker * intensity);
    refs.empHalo.scale.setScalar(0.6 * (0.95 + 0.15 * Math.sin(time * 23) * intensity + 0.05 * flicker));
    refs.empHalo.material.opacity = 0.12 + 0.18 * intensity * flicker;
    if (Math.random() > dt * 32 * intensity) return false;
    const orb = refs.empOrb.getWorldPosition(new THREE.Vector3());
    this.orbArc(orb, 0.6, Math.random() < 0.25 ? 0.55 : 0.15 + Math.random() * 0.3);
    return true;
  }

  orbArc(center, radius, reach) {
    const r = Math.random;
    const unit = () => new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize();
    const from = unit();
    const axis = unit().cross(from).normalize();
    const sweep = 0.8 + r() * 1.8;
    const steps = 8;
    const points = [];
    for (let k = 0; k <= steps; k++) {
      const d = from.clone().applyAxisAngle(axis, (sweep * k) / steps);
      const lift = 1.02 + Math.sin((Math.PI * k) / steps) * reach;
      const p = center.clone().addScaledVector(d, radius * lift);
      if (k > 0 && k < steps) p.add(unit().multiplyScalar(0.06));
      points.push(p);
    }
    this.lightning.add(points, 0x3fa0ff, 0.12, 0.06);
  }

  bolt(from, to, color = 0x2f7dff, width = 0.18, life = 0.12, fork = true) {
    const strikes = life >= 0.2 ? 3 : 1;
    for (let k = 0; k < strikes; k++) {
      this.later((k * life) / strikes, () => this.strike(from, to, color, width, life / strikes + 0.03, fork));
    }
  }

  strike(from, to, color, width, life, fork) {
    const r = Math.random;
    const length = from.distanceTo(to);
    let points = [from.clone(), to.clone()];
    let offset = length * 0.2;
    while (points.length < 17 && length / (points.length - 1) > 1.1) {
      const next = [points[0]];
      for (let i = 1; i < points.length; i++) {
        const mid = points[i - 1].clone().lerp(points[i], 0.5);
        mid.x += (r() - 0.5) * offset;
        mid.y += (r() - 0.5) * offset * 0.6;
        mid.z += (r() - 0.5) * offset;
        next.push(mid, points[i]);
      }
      points = next;
      offset *= 0.55;
    }
    this.lightning.add(points, color, width * 2, life);
    if (!fork) return;
    for (let f = 0; f < 2; f++) {
      const at = points[1 + Math.floor(r() * (points.length - 2))];
      const dir = to.clone().sub(from).normalize();
      dir.x += (r() - 0.5) * 1.6;
      dir.z += (r() - 0.5) * 1.6;
      dir.y += (r() - 0.3) * 0.6;
      const end = at.clone().addScaledVector(dir.normalize(), length * (0.2 + r() * 0.25));
      this.strike(at, end, color, width * 0.6, life, false);
    }
  }

  arcTo(from, to, duration = 0.45, color = 0x1f5bff, width = 0.42) {
    for (let k = 0; k * 0.05 < duration; k++) {
      this.later(k * 0.05, () => {
        const a = from();
        const b = to();
        if (!a || !b) return;
        this.lightning.add(arcPoints(a, b), color, width * (k === 0 ? 1.3 : 1), 0.07);
        if (k === 0) this.sparkBurst(b.x, b.y, b.z, 0x9ff8ff, 10);
      });
    }
  }

  later(delay, fn) {
    if (delay <= 0) fn();
    else this.timers.push({ at: this.clock + delay, fn });
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

