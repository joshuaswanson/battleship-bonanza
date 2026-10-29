import * as THREE from 'three';
import { toon, INK } from './toon.js';
import { BASE_SPEED } from './race/shared.js';

export const HOLE_Y = 26;
export const CAVE_HALF = 15;
const DEPTH = 12;
const DRAIN = 7;
const DRAIN_TIME = 0.6;
const WALL_GAP = 3;
const LAUNCH_RISE = 8;

export function funnelLevel(r, radius) {
  if (r >= radius) return 0;
  if (r <= DRAIN) return -DEPTH;
  const u = (radius - r) / (radius - DRAIN);
  return -DEPTH * u * u * u;
}

export function funnelAmp(r, radius) {
  return 0.25 + 0.75 * THREE.MathUtils.smoothstep(r, radius - 10, radius + 2);
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
  let mouthIdx = entryIdx;
  while (track.pz[mouthIdx] > edgeAt(track.px[mouthIdx]) - 6) mouthIdx--;
  const cave = [];
  for (let i = mouthIdx - 12; i <= entryIdx; i++) cave.push({ x: track.px[i], z: track.pz[i] });
  const guess = nearest(spec.hole);
  const heading = track.heading(guess);
  const dx = Math.sin(heading);
  const dz = Math.cos(heading);
  const hx = track.px[guess];
  const hz = faceAt(hx, HOLE_Y) - 1;
  const holeIdx = nearest([hx + dx * 4, hz + dz * 4]);
  const center = { x: spec.center[0], z: spec.center[1] };
  const radius = spec.radius;
  return {
    center,
    radius,
    entryIdx,
    holeIdx,
    mouthIdx,
    cave,
    entryS: track.sAt[entryIdx],
    holeS: track.sAt[holeIdx],
    hole: { x: hx, z: hz, y: HOLE_Y, dx, dz, heading },
    hidden: (i) => i > entryIdx && i < holeIdx,
    caveDistance(x, z) {
      let best = Infinity;
      for (const p of cave) best = Math.min(best, (p.x - x) ** 2 + (p.z - z) ** 2);
      return Math.sqrt(best);
    },
    sample(x, z, out) {
      const r = Math.hypot(x - center.x, z - center.z);
      out.level = funnelLevel(r, radius + 2);
      out.amp = funnelAmp(r, radius);
      return out;
    },
  };
}

const FUNNEL_VERT = /* glsl */ `
  uniform float uTime;
  uniform vec2 uCenter;
  uniform float uRadius;
  attribute float aAmp;
  varying vec2 vLocal;
  varying float vDepth;
  #include <common>
  #include <fog_pars_vertex>
  void main() {
    vec3 p = position;
    float a = p.x * 0.06 + uTime * 1.3;
    float b = p.z * 0.08 - uTime * 1.1;
    float c = (p.x + p.z) * 0.13 + uTime * 2.0;
    p.y += (0.45 * sin(a) + 0.35 * sin(b) + 0.2 * sin(c)) * aAmp;
    vLocal = p.xz - uCenter;
    vDepth = position.y;
    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const FUNNEL_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uRadius;
  varying vec2 vLocal;
  varying float vDepth;
  #include <common>
  #include <fog_pars_fragment>
  void main() {
    float r = length(vLocal);
    float theta = atan(vLocal.y, vLocal.x);
    float k = clamp(1.0 - r / uRadius, 0.0, 1.0);
    vec3 shallow = vec3(0.21, 0.84, 0.88);
    vec3 deep = vec3(0.06, 0.56, 0.72);
    vec3 abyss = vec3(0.03, 0.24, 0.38);
    vec3 color = mix(shallow, deep, smoothstep(0.0, 0.5, k));
    color = mix(color, abyss, smoothstep(0.55, 1.0, k));
    float arms = fract(theta * 5.0 / 6.2831853 - log(max(r, 1.0)) * 2.2 - uTime * (0.35 + k * 0.9));
    float streak = smoothstep(0.0, 0.06, arms) * (1.0 - smoothstep(0.12, 0.3, arms));
    float wobble = sin(theta * 11.0 + r * 0.5 - uTime * 3.0) * 0.5 + 0.5;
    color = mix(color, vec3(0.96, 0.99, 1.0), streak * (0.45 + 0.4 * wobble) * smoothstep(0.02, 0.2, k));
    float rings = sin(r * 0.9 + uTime * 4.0 + theta * 2.0);
    color = mix(color, vec3(0.96, 0.99, 1.0), smoothstep(0.92, 0.98, rings) * 0.25 * (1.0 - k));
    color = mix(color, vec3(0.96, 0.99, 1.0), smoothstep(uRadius - 4.0, uRadius + 1.0, r) * 0.6);
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

function funnelGeometry(center, radius) {
  const rings = 44;
  const segs = 128;
  const positions = [];
  const amps = [];
  const indices = [];
  const outer = radius + 2;
  for (let i = 0; i <= rings; i++) {
    const u = i / rings;
    const r = DRAIN + (outer - DRAIN) * u * u * 0.4 + (outer - DRAIN) * u * 0.6;
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
  g.computeBoundingSphere();
  return g;
}

export class Whirlpool {
  constructor({ track, site, group }) {
    this.track = track;
    this.site = site;
    this.obstacles = [];
    this.group = new THREE.Group();
    group.add(this.group);
    const { center, radius } = site;
    this.material = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uCenter: { value: new THREE.Vector2(center.x, center.z) }, uRadius: { value: radius } }]),
      vertexShader: FUNNEL_VERT,
      fragmentShader: FUNNEL_FRAG,
      fog: true,
    });
    this.group.add(new THREE.Mesh(funnelGeometry(center, radius), this.material));
    const throat = funnelLevel(DRAIN, radius + 2);
    const dark = new THREE.MeshBasicMaterial({ color: 0x06121c, side: THREE.BackSide });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(DRAIN + 0.4, DRAIN + 0.4, 90, 32, 1, true), dark);
    shaft.position.set(center.x, throat - 44, center.z);
    this.group.add(shaft);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(DRAIN + 0.4, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x06121c }));
    floor.position.set(center.x, throat - 88, center.z);
    this.group.add(floor);
    this.lip = new THREE.Mesh(new THREE.TorusGeometry(DRAIN + 0.6, 0.7, 8, 48).rotateX(Math.PI / 2), toon(0xf4fbff));
    this.lip.position.set(center.x, throat + 0.4, center.z);
    this.group.add(this.lip);
    const hole = site.hole;
    const mouth = new THREE.Group();
    mouth.position.set(hole.x, hole.y, hole.z);
    mouth.rotation.y = hole.heading;
    const pit = new THREE.Mesh(new THREE.CircleGeometry(6.5, 32), new THREE.MeshBasicMaterial({ color: 0x06121c }));
    pit.position.z = 0.2;
    mouth.add(pit);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(7, 1.6, 10, 36), toon(0x8d939a));
    ring.position.z = 0.6;
    mouth.add(ring);
    const ink = new THREE.Mesh(new THREE.TorusGeometry(7, 1.75, 10, 36), new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide }));
    ink.position.z = 0.6;
    mouth.add(ink);
    this.group.add(mouth);
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
    this.lip.rotation.y = t * 2;
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
      if (b.isPlayer) race.emit('whirlpool', {}, b);
    }
    const { center, radius } = this.site;
    b.pos.x -= b.vel.x * dt;
    b.pos.z -= b.vel.z * dt;
    b.offCourse = 0;
    b.wrongWay = 0;
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
    const swirl = 14 + 30 * k;
    const pull = 3 + 6 * k * k;
    const vr = out * 0.16 - pull;
    const vt = along * 0.75 + swirl;
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
    if (now < DRAIN) {
      b.vortex.drain = dt;
      race.fx.splash(b.pos.x, b.waterY, b.pos.z, 0.8);
      race.sfx.play('splash', b.pos);
    }
    this.progress(b, Math.min(1, Math.max(0, (lim - now) / (lim - DRAIN))));
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
    this.progress(b, 1);
    if (v.drain >= DRAIN_TIME) this.launch(race, b);
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
    b.pos.set(hole.x + hole.dx * 14, b.pos.y, hole.z + hole.dz * 14);
    b.heading = hole.heading;
    b.speed = speed;
    b.vel.set(hole.dx * speed, 0, hole.dz * speed);
    b.surfaceLevel = 0;
    b.yOffset = hole.y;
    b.air = { fall: true, y: hole.y, vy: LAUNCH_RISE };
    b.vortex = null;
    let ds = t.sAt[holeIdx] - b.trackS;
    if (ds < -t.length / 2) ds += t.length;
    b.dist += ds;
    b.trackS = t.sAt[holeIdx];
    b.trackIdx = holeIdx;
    for (let i = 0; i < 16; i++) race.fx.droplet(hole.x + hole.dx * 4, hole.y, hole.z + hole.dz * 4, hole.dx * 14 + (Math.random() - 0.5) * 8, 4 + Math.random() * 6, hole.dz * 14 + (Math.random() - 0.5) * 8, 0.5);
    race.sfx.play('splash', b.pos);
    if (b.isPlayer) race.emit('teleport', {}, b);
  }

  pilot(race, b) {
    if (!b.vortex || b.vortex.drain > 0) return;
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
