import * as THREE from 'three';
import { toon, INK } from './toon.js';
import { BASE_SPEED } from './race/shared.js';

export const HOLE_Y = 26;
const DEPTH = 44;
const DRAIN = 9;
const STEEP = 2.4;
const DRAIN_TIME = 0.7;
const WALL_GAP = 3;
const LAUNCH_RISE = 8;
const FLUME_SPEED = 72;
const FLUME_RADIUS = 7.5;
const DARK = 0.92;
const DAWN = 18;

export function funnelLevel(r, outer) {
  if (r >= outer) return 0;
  if (r <= DRAIN) return -DEPTH;
  return -DEPTH * Math.pow((outer - r) / (outer - DRAIN), STEEP);
}

export function funnelAmp(r, radius) {
  return 0.15 + 0.85 * THREE.MathUtils.smoothstep(r, radius - 14, radius + 2);
}

function swirlAt(k) {
  return 22 + 42 * k;
}

export function whirlpoolSite(track, edgeAt, faceAt) {
  const spec = track.map.whirlpool;
  const nearest = ([x, z]) => {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < track.N; i++) {
      const d = (track.px[i] - x) ** 2 + (track.pz[i] - z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  };
  const entryIdx = nearest(spec.entry);
  const caveEndIdx = nearest(spec.caveEnd);
  let mouthIdx = entryIdx;
  while (track.pz[mouthIdx] > edgeAt(track.px[mouthIdx]) - 6) mouthIdx--;
  const cave = [];
  for (let i = mouthIdx - 12; i <= entryIdx; i++) cave.push({ x: track.px[i], z: track.pz[i], half: track.hw[i] + 2, roofed: i <= caveEndIdx });
  const guess = nearest(spec.hole);
  const heading = track.heading(guess);
  const dx = Math.sin(heading);
  const dz = Math.cos(heading);
  const hx = track.px[guess];
  const hz = faceAt(hx, HOLE_Y) - 1;
  const holeIdx = nearest([hx + dx * 14, hz + dz * 14]);
  const center = { x: spec.center[0], z: spec.center[1] };
  const radius = spec.radius;
  const route = [...spec.flume.map(([x, z, y]) => new THREE.Vector3(x, y, z)), new THREE.Vector3(hx, HOLE_Y, hz)];
  const curve = new THREE.CatmullRomCurve3(route, false, 'centripetal');
  const length = curve.getLength();
  const samples = curve.getSpacedPoints(240);
  const last = spec.flume[spec.flume.length - 1];
  const lightFrom = length - Math.hypot(hx - last[0], hz - last[1]);
  const box = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
  for (const p of samples) {
    box.minX = Math.min(box.minX, p.x - FLUME_RADIUS);
    box.maxX = Math.max(box.maxX, p.x + FLUME_RADIUS);
    box.minZ = Math.min(box.minZ, p.z - FLUME_RADIUS);
    box.maxZ = Math.max(box.maxZ, p.z + FLUME_RADIUS);
  }
  return {
    center,
    radius,
    entryIdx,
    caveEndIdx,
    holeIdx,
    mouthIdx,
    cave,
    entryS: track.sAt[entryIdx],
    holeS: track.sAt[holeIdx],
    hole: { x: hx, z: hz, y: HOLE_Y, dx, dz, heading },
    flume: { curve, samples, length, lightFrom, radius: FLUME_RADIUS },
    hidden: (i) => i > entryIdx && i < holeIdx,
    caveDistance(x, z) {
      let best = Infinity;
      for (const p of cave) best = Math.min(best, Math.hypot(p.x - x, p.z - z) - p.half);
      return best;
    },
    sample(x, z, out) {
      const r = Math.hypot(x - center.x, z - center.z);
      if (r < radius + 3) {
        out.level = funnelLevel(r, radius + 2);
        out.amp = funnelAmp(r, radius);
        return out;
      }
      out.level = 0;
      out.amp = 1;
      if (x < box.minX || x > box.maxX || z < box.minZ || z > box.maxZ) return out;
      if ((x - hx) * dx + (z - hz) * dz > -0.5) return out;
      let best = Infinity;
      let y = 0;
      for (const p of samples) {
        const d = (p.x - x) ** 2 + (p.z - z) ** 2;
        if (d < best) {
          best = d;
          y = p.y;
        }
      }
      if (best < FLUME_RADIUS * FLUME_RADIUS) {
        out.level = y - FLUME_RADIUS * 0.55;
        out.amp = 0.1;
      }
      return out;
    },
  };
}

const FUNNEL_VERT = /* glsl */ `
  uniform float uTime;
  uniform vec2 uCenter;
  attribute float aAmp;
  varying vec2 vLocal;
  varying float vDepth;
  varying float vWave;
  varying vec3 vNormalW;
  #include <common>
  #include <fog_pars_vertex>
  void main() {
    vec3 p = position;
    float a = p.x * 0.06 + uTime * 1.3;
    float b = p.z * 0.08 - uTime * 1.1;
    float c = (p.x + p.z) * 0.13 + uTime * 2.0;
    vWave = 0.45 * sin(a) + 0.35 * sin(b) + 0.2 * sin(c);
    p.y += vWave * aAmp;
    vLocal = p.xz - uCenter;
    vDepth = position.y;
    vNormalW = normalize(normal);
    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const FUNNEL_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uRadius;
  uniform float uDepth;
  uniform vec3 uSunDir;
  uniform vec2 uCenterW;
  varying vec2 vLocal;
  varying float vDepth;
  varying float vWave;
  varying vec3 vNormalW;
  #include <common>
  #include <fog_pars_fragment>
  float ripple(vec2 q, float t) {
    vec2 p = q * 0.11;
    float warpA = sin(p.y * 1.7 + t * 0.9) * 1.4;
    float warpB = sin(p.x * 1.9 - t * 0.7) * 1.4;
    return sin(p.x * 2.6 + warpA + t * 0.6) * sin(p.y * 2.6 + warpB - t * 0.5);
  }
  vec2 spin(vec2 v, float a) {
    float c = cos(a);
    float s = sin(a);
    return vec2(c * v.x - s * v.y, s * v.x + c * v.y);
  }
  void main() {
    float r = max(length(vLocal), 1.0);
    float k = clamp(1.0 - r / uRadius, 0.0, 1.0);
    float omega = (22.0 + 42.0 * k) / r * smoothstep(uRadius + 2.0, uRadius - 15.0, r);
    float flowA = fract(uTime * 0.4);
    float flowB = fract(uTime * 0.4 + 0.5);
    vec2 qa = spin(vLocal, -omega * flowA * 2.5);
    vec2 qb = spin(vLocal, -omega * flowB * 2.5);
    float wa = 1.0 - abs(2.0 * flowA - 1.0);
    float wb = 1.0 - wa;
    float rip = ripple(qa + uCenterW, uTime) * wa + ripple(qb + uCenterW, uTime) * wb;
    float theta = atan(vLocal.y, vLocal.x);
    float lanes = sin(theta * 9.0 - log(r) * 11.0 - uTime * (1.5 + 6.0 * k) + rip * 1.5) * 0.5 + 0.5;

    float h = clamp(vWave * 0.5 + 0.5, 0.0, 1.0);
    vec3 deep = vec3(0.059, 0.561, 0.722);
    vec3 shallow = vec3(0.208, 0.839, 0.878);
    vec3 abyss = vec3(0.02, 0.2, 0.34);
    vec3 foam = vec3(0.957, 0.984, 1.0);
    vec3 color = mix(deep, shallow, smoothstep(0.25, 0.85, h) * (1.0 - k));
    color = mix(color, abyss, smoothstep(-6.0, -uDepth, vDepth) * 0.85);
    float light = dot(vNormalW, normalize(uSunDir));
    color *= mix(0.9, 1.06, step(0.62, light));
    color = mix(color, foam, smoothstep(0.8, 0.86, rip) * 0.45);
    color = mix(color, foam, smoothstep(0.9, 0.98, lanes) * smoothstep(0.1, 0.7, k) * (0.25 + 0.3 * k) * (0.6 + 0.4 * rip));
    color = mix(color, foam, smoothstep(0.9, 0.96, h) * 0.6 * (1.0 - k));
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

function funnelGeometry(center, radius) {
  const rings = 72;
  const segs = 180;
  const positions = [];
  const amps = [];
  const indices = [];
  const outer = radius + 2;
  for (let i = 0; i <= rings; i++) {
    const u = i / rings;
    const r = DRAIN + (outer - DRAIN) * (u * u * 0.55 + u * 0.45);
    for (let j = 0; j <= segs; j++) {
      const a = (j / segs) * Math.PI * 2;
      positions.push(center.x + Math.cos(a) * r, funnelLevel(r, outer), center.z + Math.sin(a) * r);
      amps.push(funnelAmp(r, radius));
    }
  }
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < segs; j++) {
      const a = i * (segs + 1) + j;
      const b = a + segs + 1;
      indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('aAmp', new THREE.Float32BufferAttribute(amps, 1));
  g.setIndex(indices);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

export function flumeStream(site) {
  const { flume, hole } = site;
  const speed = 11;
  const rise = 3;
  const gravity = 20;
  const fly = (rise + Math.sqrt(rise * rise + 2 * gravity * hole.y)) / gravity;
  const arc = speed * fly * 1.3;
  const total = flume.length + arc;
  const inside = flume.length / total;
  const water = FLUME_RADIUS * 0.55;
  const path = (spec, t) => {
    if (t <= inside) {
      const p = flume.curve.getPointAt(t / inside);
      return [p.x, p.y - water + 0.05, p.z];
    }
    const time = ((t - inside) / (1 - inside)) * fly;
    const d = speed * time;
    return [hole.x + hole.dx * d, hole.y - water + rise * time - 0.5 * gravity * time * time, hole.z + hole.dz * d];
  };
  const [fx, , fz] = path(null, 1);
  return {
    top: new THREE.Vector3(hole.x, hole.y, hole.z),
    foot: new THREE.Vector3(fx, 0.2, fz),
    dx: hole.dx,
    dz: hole.dz,
    width: 5,
    rows: 110,
    shade: (t) => (t < inside * 0.97 ? 0.3 : 1),
    path,
  };
}

export class Whirlpool {
  constructor({ track, site, group }) {
    this.track = track;
    this.site = site;
    this.obstacles = [];
    this.group = new THREE.Group();
    group.add(this.group);
    const { center, radius, flume, hole } = site;
    this.material = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        { uTime: { value: 0 }, uCenter: { value: new THREE.Vector2(center.x, center.z) }, uRadius: { value: radius }, uDepth: { value: DEPTH }, uCenterW: { value: new THREE.Vector2(center.x, center.z) }, uSunDir: { value: new THREE.Vector3(0.4, 1, 0.3) } },
      ]),
      vertexShader: FUNNEL_VERT,
      fragmentShader: FUNNEL_FRAG,
      fog: true,
    });
    this.group.add(new THREE.Mesh(funnelGeometry(center, radius), this.material));
    const dark = new THREE.MeshBasicMaterial({ color: 0x050d14, side: THREE.BackSide });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(DRAIN + 0.3, DRAIN + 0.3, 90, 32, 1, true), dark);
    shaft.position.set(center.x, -DEPTH - 44, center.z);
    this.group.add(shaft);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(DRAIN + 0.4, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x050d14 }));
    floor.position.set(center.x, -DEPTH - 1.5, center.z);
    this.group.add(floor);
    this.throat = new THREE.Group();
    this.throat.position.set(center.x, -DEPTH + 0.3, center.z);
    for (let k = 0; k < 3; k++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(DRAIN + 0.4 + k * 1.6, 0.55 - k * 0.12, 6, 64).rotateX(Math.PI / 2), toon(k ? 0xd8f4fb : 0xf4fbff));
      ring.position.y = k * 0.9;
      ring.scale.y = 0.6;
      this.throat.add(ring);
    }
    this.group.add(this.throat);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(flume.curve, 120, flume.radius, 14, false), new THREE.MeshBasicMaterial({ color: 0x0b141c, side: THREE.BackSide }));
    this.group.add(tube);
    const mouth = new THREE.Group();
    mouth.position.set(hole.x, hole.y, hole.z);
    mouth.rotation.y = hole.heading;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(flume.radius + 0.6, 1.8, 10, 36), toon(0x8d939a));
    ring.position.z = 0.6;
    mouth.add(ring);
    const ink = new THREE.Mesh(new THREE.TorusGeometry(flume.radius + 0.6, 1.95, 10, 36), new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide }));
    ink.position.z = 0.6;
    mouth.add(ink);
    this.group.add(mouth);
    this.point = new THREE.Vector3();
    this.tangent = new THREE.Vector3();
  }

  reset(race) {
    for (const b of race.boats) b.vortex = null;
  }

  play() {}

  snapshot() {
    return null;
  }

  restore() {}

  animate(t) {
    this.material.uniforms.uTime.value = t;
    this.throat.rotation.y = t * 3;
  }

  darkness(b) {
    const v = b?.vortex;
    if (!v) return 0;
    if (v.flume !== undefined) {
      const { length, lightFrom } = this.site.flume;
      return DARK * THREE.MathUtils.clamp(1 - (v.flume - lightFrom) / DAWN, 0, 1) * (v.flume < length ? 1 : 0);
    }
    if (v.drain > 0) return DARK * Math.min(1, v.drain / DRAIN_TIME);
    return 0;
  }

  entering(b) {
    const { site } = this;
    const i = this.track.mainIndex(b.trackIdx);
    if (i < site.entryIdx - 40 || i > site.entryIdx + 20) return false;
    return Math.hypot(b.pos.x - site.center.x, b.pos.z - site.center.z) < site.radius - WALL_GAP;
  }

  carry(race, b, dt) {
    if (!b.vortex) {
      if (!this.entering(b)) return false;
      b.vortex = { drain: 0 };
    }
    const { center, radius } = this.site;
    b.pos.x -= b.vel.x * dt;
    b.pos.z -= b.vel.z * dt;
    b.offCourse = 0;
    b.wrongWay = 0;
    if (b.vortex.flume !== undefined) return this.ride(race, b, dt);
    if (b.vortex.drain > 0) return this.drain(race, b, dt);
    let dx = b.pos.x - center.x;
    let dz = b.pos.z - center.z;
    const r = Math.hypot(dx, dz) || 0.001;
    const ux = dx / r;
    const uz = dz / r;
    const tx = -uz;
    const tz = ux;
    const k = Math.max(0, 1 - r / radius);
    const out = b.vel.x * ux + b.vel.z * uz;
    const along = b.vel.x * tx + b.vel.z * tz;
    const pull = 4 + 9 * k * k;
    const vr = out * 0.16 - pull;
    const vt = along * 0.75 + swirlAt(k);
    b.pos.x += (ux * vr + tx * vt) * dt;
    b.pos.z += (uz * vr + tz * vt) * dt;
    const turn = (vt / Math.max(r, DRAIN)) * dt;
    const cos = Math.cos(turn);
    const sin = Math.sin(turn);
    b.heading -= turn;
    b.vel.set(b.vel.x * cos - b.vel.z * sin, b.vel.y, b.vel.z * cos + b.vel.x * sin);
    dx = b.pos.x - center.x;
    dz = b.pos.z - center.z;
    const now = Math.hypot(dx, dz);
    const lim = radius - WALL_GAP;
    if (now > lim) {
      b.pos.x = center.x + (dx / now) * lim;
      b.pos.z = center.z + (dz / now) * lim;
      if (out > 0) {
        b.vel.x -= ux * out * 1.5;
        b.vel.z -= uz * out * 1.5;
        if (out > 9) {
          b.speed *= 0.85;
          b.bump(3);
          race.fx.splash(b.pos.x, b.waterY, b.pos.z, 0.6);
          race.sfx.play('boing', b.pos);
        }
      }
    }
    if (now < DRAIN + 1) {
      b.vortex.drain = dt;
      race.sfx.play('splash', b.pos);
    }
    this.progress(b, 0.8 * Math.min(1, Math.max(0, (lim - now) / (lim - DRAIN))));
    return true;
  }

  drain(race, b, dt) {
    const { center } = this.site;
    const v = b.vortex;
    v.drain += dt;
    const k = 1 - Math.exp(-6 * dt);
    b.pos.x += (center.x - b.pos.x) * k;
    b.pos.z += (center.z - b.pos.z) * k;
    b.heading -= 9 * dt;
    b.yOffset = -40 * v.drain * v.drain;
    this.progress(b, 0.8);
    if (v.drain >= DRAIN_TIME) this.plunge(race, b);
    return true;
  }

  plunge(race, b) {
    b.vortex.flume = 0;
    b.yOffset = 0;
    b.air = null;
    this.place(b, 0);
    if (b.isPlayer) race.emit('teleport', {}, b);
  }

  place(b, along) {
    const { curve, length } = this.site.flume;
    const u = Math.min(1, along / length);
    curve.getPointAt(u, this.point);
    curve.getTangentAt(u, this.tangent);
    b.pos.set(this.point.x, b.pos.y, this.point.z);
    b.heading = Math.atan2(this.tangent.x, this.tangent.z);
    b.speed = FLUME_SPEED;
    const flat = Math.hypot(this.tangent.x, this.tangent.z) || 1;
    b.vel.set((this.tangent.x / flat) * FLUME_SPEED, 0, (this.tangent.z / flat) * FLUME_SPEED);
  }

  ride(race, b, dt) {
    const v = b.vortex;
    v.flume += FLUME_SPEED * dt;
    b.yOffset = 0;
    b.spinTime = 0;
    b.air = null;
    if (v.flume >= this.site.flume.length) {
      this.launch(race, b);
      return true;
    }
    this.place(b, v.flume);
    this.progress(b, 0.8 + 0.2 * (v.flume / this.site.flume.length));
    return true;
  }

  progress(b, p) {
    const t = this.track;
    const { entryS, holeS } = this.site;
    const s = entryS + p * (holeS - entryS - t.spacing * 2);
    let ds = s - b.trackS;
    if (ds < -t.length / 2) ds += t.length;
    else if (ds > t.length / 2) ds -= t.length;
    b.dist += ds;
    b.trackS = s;
    b.trackIdx = t.wrap(Math.round(s / t.spacing));
  }

  launch(race, b) {
    const t = this.track;
    const { hole, holeIdx } = this.site;
    const speed = Math.max(b.speed, BASE_SPEED * 0.85);
    b.pos.set(hole.x + hole.dx * 6, b.pos.y, hole.z + hole.dz * 6);
    b.heading = hole.heading;
    b.speed = speed;
    b.vel.set(hole.dx * speed, 0, hole.dz * speed);
    b.surfaceLevel = 0;
    const lip = hole.y - FLUME_RADIUS * 0.55;
    b.yOffset = lip;
    b.air = { fall: true, y: lip, vy: LAUNCH_RISE };
    b.vortex = null;
    let ds = t.sAt[holeIdx] - b.trackS;
    if (ds < -t.length / 2) ds += t.length;
    b.dist += ds;
    b.trackS = t.sAt[holeIdx];
    b.trackIdx = holeIdx;
    for (let i = 0; i < 16; i++) race.fx.droplet(hole.x + hole.dx * 4, hole.y, hole.z + hole.dz * 4, hole.dx * 14 + (Math.random() - 0.5) * 8, 4 + Math.random() * 6, hole.dz * 14 + (Math.random() - 0.5) * 8, 0.5);
    race.sfx.play('splash', b.pos);
    if (b.isPlayer) race.emit('launch', {}, b);
  }

  pilot(race, b) {
    if (!b.vortex || b.vortex.drain > 0 || b.vortex.flume !== undefined) return;
    const { center } = this.site;
    const dx = b.pos.x - center.x;
    const dz = b.pos.z - center.z;
    const r = Math.hypot(dx, dz) || 1;
    const lean = (b.ai.vortexLean ??= 0.5 + Math.random() * 0.5);
    const wx = (-dz / r) * Math.cos(lean) - (dx / r) * Math.sin(lean);
    const wz = (dx / r) * Math.cos(lean) - (dz / r) * Math.sin(lean);
    let diff = Math.atan2(wx, wz) - b.heading;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    b.control.steer = Math.max(-1, Math.min(1, -diff * 2.6));
    b.control.throttle = 1;
  }

  respawnSpot(race, b) {
    const t = this.track;
    const { site } = this;
    const i = t.mainIndex(b.trackIdx);
    if (b.vortex || (i > site.entryIdx - 2 && i < site.holeIdx)) {
      b.vortex = { drain: 0 };
      const a = Math.random() * Math.PI * 2;
      const r = site.radius - 10;
      return { x: site.center.x + Math.cos(a) * r, z: site.center.z + Math.sin(a) * r, heading: -a };
    }
    const back = t.mainIndex(t.step(b.trackIdx, -10));
    if (back >= site.entryIdx - 2 && back < site.holeIdx + 30) {
      const idx = t.wrap(site.holeIdx + 40);
      return { ...t.point(idx, 0), heading: t.heading(idx), idx };
    }
    return null;
  }
}
