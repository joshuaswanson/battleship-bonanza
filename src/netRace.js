import * as THREE from 'three';
import { boatNodes, boatMaterials, writeNode, readNode, readMat, writeMat, STRIDE } from './replay.js';
import { buildMissile, buildMine, buildHook } from './boatModel.js';
import { ROPE_GEOMETRY, ROPE_MATERIAL } from './race/attachments/grapple.js';
import { HOLD_IDS } from './race/shared.js';

export const NET_RATE = 1 / 20;
const DELAY = 0.12;
const FX_METHODS = ['splash', 'explosion', 'sparkBurst', 'grind', 'mist', 'smoke', 'flame', 'blaze', 'ember', 'column', 'blackSmoke', 'bubbles', 'ring', 'followRing', 'shell', 'flameSpray', 'impact', 'scorch', 'droplet', 'spray', 'casing', 'bolt', 'arcTo', 'beam', 'orbArc', 'wake'];
const FX_POOLS = ['puffs', 'sparks', 'soot', 'fire', 'fireMid', 'fireCore'];
const MUTED = ['whitecaps', 'boatTrail'];
const REST = 9;
const STATUS = 30 + HOLD_IDS.length * 4;
const LOOSE = { missile: 0, mine: 1, hook: 2 };

const SCALE = 100;
const pack = (v) => Math.round(v * SCALE);
const unpack = (v) => v / SCALE;

function packArg(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return pack(v);
  if (typeof v === 'function') {
    const p = v();
    return p ? [pack(p.x), pack(p.y), pack(p.z)] : null;
  }
  if (typeof v !== 'object') return v;
  if (v.isObject3D) return null;
  return typeof v.x === 'number' ? [pack(v.x), pack(v.y ?? 0), pack(v.z ?? 0)] : null;
}

function unpackArgs(name, args) {
  const out = args.map((a) => (Array.isArray(a) ? new THREE.Vector3(unpack(a[0]), unpack(a[1]), unpack(a[2])) : typeof a === 'number' ? unpack(a) : a ?? undefined));
  if (name === 'arcTo') {
    for (const i of [0, 1]) {
      const p = out[i];
      out[i] = () => p;
    }
  }
  return out;
}

const netNodes = (b) => {
  const spinning = new Set(b.model.spinners.map((sp) => sp.mesh));
  return boatNodes(b).filter((node) => !spinning.has(node));
};

function diff(prev, next, first) {
  const at = [];
  for (let i = 0; i < next.length; i++) if (first || prev[i] !== next[i]) at.push(i);
  const values = new Float32Array(at.length);
  at.forEach((i, k) => {
    values[k] = next[i];
    prev[i] = next[i];
  });
  return { at: new Uint16Array(at), values };
}

const packEvent = (race, e) => {
  const out = {};
  for (const [k, v] of Object.entries(e)) {
    if (v && typeof v === 'object' && race.boats.includes(v)) out[k] = { boat: v.index };
    else if (v && typeof v === 'object' && v.isVector3) out[k] = { vec: [v.x, v.y, v.z] };
    else out[k] = v;
  }
  return out;
};

const unpackEvent = (race, e) => {
  const out = {};
  for (const [k, v] of Object.entries(e)) {
    if (v && typeof v === 'object' && 'boat' in v) out[k] = race.boats[v.boat];
    else if (v && typeof v === 'object' && 'vec' in v) out[k] = new THREE.Vector3(...v.vec);
    else out[k] = v;
  }
  return out;
};

function writeStatus(out, o, b) {
  const charge = (i) => b.charges[i] ?? { left: 0, refill: 0 };
  const fields = [
    b.hp, b.ko, b.lap, b.place, b.finished ? 1 : 0, b.finishTime, b.finishOrder, b.dist, b.invuln, b.disabled,
    b.offCourse, b.wrongWay, b.regenerating ? 1 : 0, b.regenRate, b.burn ? 1 : 0, b.cooldowns[0], b.cooldowns[1],
    charge(0).left, charge(0).refill, charge(1).left, charge(1).refill, b.sawState.spin, b.sawState.chop,
    b.blind, b.stun, b.boost, b.spinTime, b.steerVis, b.flash, b.exploded ? 1 : 0,
  ];
  out.set(fields, o);
  let k = o + fields.length;
  for (const id of HOLD_IDS) {
    const h = b.heat[id];
    out[k++] = h.heat;
    out[k++] = h.overheated ? 1 : 0;
    out[k++] = h.firing ? 1 : 0;
    out[k++] = h.delay;
  }
}

function readStatus(b, d, o) {
  let k = o;
  b.hp = d[k++];
  b.ko = d[k++];
  b.lap = d[k++];
  b.place = d[k++];
  b.finished = d[k++] > 0;
  b.finishTime = d[k++];
  b.finishOrder = d[k++];
  b.dist = d[k++];
  b.invuln = d[k++];
  b.disabled = d[k++];
  b.offCourse = d[k++];
  b.wrongWay = d[k++];
  b.regenerating = d[k++] > 0;
  b.regenRate = d[k++];
  b.burn = d[k++] > 0 ? b.burn ?? {} : null;
  b.cooldowns[0] = d[k++];
  b.cooldowns[1] = d[k++];
  for (const i of [0, 1]) {
    const left = d[k++];
    const refill = d[k++];
    if (b.charges[i]) Object.assign(b.charges[i], { left, refill });
  }
  b.sawState.spin = d[k++];
  b.sawState.chop = d[k++];
  b.blind = d[k++];
  b.stun = d[k++];
  b.boost = d[k++];
  b.spinTime = d[k++];
  b.steerVis = d[k++];
  b.flash = d[k++];
  b.exploded = d[k++] > 0;
  for (const id of HOLD_IDS) {
    const h = b.heat[id];
    h.heat = d[k++];
    h.overheated = d[k++] > 0;
    h.firing = d[k++] > 0;
    h.delay = d[k++];
  }
}

export class Streamer {
  constructor(race, fx, world) {
    this.race = race;
    this.fx = fx;
    this.world = world;
    this.nodes = race.boats.flatMap((b) => netNodes(b));
    this.mats = race.boats.flatMap((b) => boatMaterials(b));
    this.state = new Float32Array(this.nodes.length * STRIDE);
    this.status = new Float32Array(race.boats.length * STATUS);
    this.scratch = new Float32Array(STRIDE);
    this.sent = false;
    this.next = 0;
    this.depth = 0;
    this.mute = 0;
    this.calls = [];
    this.emits = [];
    this.sounds = [];
    this.events = [];
    this.ids = new WeakMap();
    this.nextId = 1;
    this.frames = 0;
    this.undo = [];

    const wrap = (owner, name, log) => {
      const prev = owner[name];
      const own = Object.prototype.hasOwnProperty.call(owner, name);
      const wrapper = (...args) => {
        if (!this.mute && !this.depth) log(args);
        this.depth++;
        try {
          return prev.apply(owner, args);
        } finally {
          this.depth--;
        }
      };
      owner[name] = wrapper;
      this.undo.push(() => {
        if (owner[name] !== wrapper) return;
        if (own) owner[name] = prev;
        else delete owner[name];
      });
    };
    FX_METHODS.forEach((name, id) => wrap(fx, name, (args) => this.calls.push([id, ...args.map(packArg)])));
    FX_POOLS.forEach((name, id) => wrap(fx[name], 'emit', (args) => this.emits.push([id, ...args.map(pack)])));
    if (race.chopper) wrap(race.chopper, 'chop', (args) => this.calls.push([-1, ...args.map(packArg)]));
    for (const name of MUTED) {
      const prev = race[name];
      race[name] = (...args) => {
        this.mute++;
        try {
          return prev.apply(race, args);
        } finally {
          this.mute--;
        }
      };
      this.undo.push(() => delete race[name]);
    }
    const sfx = race.sfx;
    const tap = {
      play: (name, pos) => {
        if (!this.mute) this.sounds.push(pos ? [name, pack(pos.x), pack(pos.y ?? 0), pack(pos.z)] : [name]);
        sfx.play(name, pos);
      },
    };
    race.sfx = tap;
    race.features.sfx = tap;
    this.undo.push(() => {
      if (race.sfx === tap) race.sfx = sfx;
      if (race.features.sfx === tap) race.features.sfx = sfx;
    });
  }

  detach() {
    for (const undo of this.undo.reverse()) undo();
    this.undo = [];
  }

  idOf(obj) {
    let id = this.ids.get(obj);
    if (!id) {
      id = this.nextId++;
      this.ids.set(obj, id);
    }
    return id;
  }

  collect() {
    const race = this.race;
    for (const e of race.events) this.events.push(packEvent(race, e));
    for (const e of this.world.events ?? []) this.events.push({ type: 'worldEvent', kind: e.type, power: e.power, pos: { vec: [e.pos.x, e.pos.y, e.pos.z] } });
  }

  frame() {
    const race = this.race;
    if (race.time < this.next) return null;
    this.next = race.time + NET_RATE;
    const { state, scratch } = this;
    const nodes = [];
    const masks = [];
    const values = [];
    this.nodes.forEach((node, n) => {
      writeNode(scratch, 0, node);
      const o = n * STRIDE;
      let mask = 0;
      for (let i = 0; i < STRIDE; i++) {
        if (this.sent && scratch[i] === state[o + i]) continue;
        mask |= 1 << i;
        state[o + i] = scratch[i];
        values.push(scratch[i]);
      }
      if (!mask) return;
      nodes.push(n);
      masks.push(mask);
    });
    const status = new Float32Array(race.boats.length * STATUS);
    race.boats.forEach((b, i) => writeStatus(status, i * STATUS, b));
    const statusDiff = diff(this.status, status, !this.sent);
    this.sent = true;
    const rest = new Float32Array(this.mats.length + race.boats.length * REST);
    let o = 0;
    for (const m of this.mats) rest[o++] = readMat(m);
    for (const b of race.boats) {
      rest.set([b.pos.x, b.pos.y, b.pos.z, b.waterY, b.heading, b.speed, (b.alive ? 1 : 0) + (b.air ? 2 : 0), b.yOffset, b.trackIdx], o);
      o += REST;
    }
    const loose = [];
    const pose = (node) => {
      const d = new Float32Array(STRIDE);
      writeNode(d, 0, node);
      return d;
    };
    for (const m of race.missiles) loose.push({ id: this.idOf(m), kind: LOOSE.missile, d: pose(m.mesh), target: m.target ? m.target.index : -1, speed: m.speed, lock: Math.min(m.lockTime ?? 0, 99), fizzle: Math.min(m.fizzle ?? 0, 99) });
    for (const m of race.mines) loose.push({ id: this.idOf(m), kind: LOOSE.mine, d: pose(m.mesh), light: m.mesh.userData.light?.visible ? 1 : 0 });
    for (const h of race.hooks) {
      const item = { id: this.idOf(h), kind: LOOSE.hook, d: pose(h.mesh) };
      if (h.loose) item.rope = new Float32Array(h.loose.points.flatMap((p) => [p.x, p.y, p.z]));
      else item.line = pose(h.rope);
      loose.push(item);
    }
    const count = race.bulletMesh.count;
    const bullets = new Float32Array(count * 16);
    bullets.set(race.bulletMesh.instanceMatrix.array.subarray(0, count * 16));
    const out = {
      t: 'frame',
      time: race.time,
      state: race.state,
      countdown: race.countdown,
      clock: race.clock,
      finishCount: race.finishCount,
      order: race.order.map((b) => b.index),
      nodes: new Uint16Array(nodes),
      masks: new Uint16Array(masks),
      values: new Float32Array(values),
      rest,
      statusAt: statusDiff.at,
      status: statusDiff.values,
      loose,
      bullets,
      calls: this.calls,
      emits: this.emits,
      sounds: this.sounds,
      events: this.events,
      hazards: race.hazards?.snapshot() ?? null,
      mode: race.mode?.snapshot() ?? null,
    };
    if (this.frames++ % 10 === 0) out.stats = race.boats.map((b) => b.stats);
    this.calls = [];
    this.emits = [];
    this.sounds = [];
    this.events = [];
    return out;
  }

  final() {
    return { t: 'stats', stats: this.race.boats.map((b) => b.stats) };
  }
}

export class Mirror {
  constructor(race, fx, sfx) {
    this.race = race;
    this.fx = fx;
    this.sfx = sfx;
    this.nodes = race.boats.flatMap((b) => netNodes(b));
    this.mats = race.boats.flatMap((b) => boatMaterials(b));
    this.frames = [];
    this.cur = new Float32Array(this.nodes.length * STRIDE);
    this.status = new Float32Array(race.boats.length * STATUS);
    this.view = null;
    this.applied = 0;
    this.loose = new Map();
    this.ropes = new Map();
    this.matrix = new THREE.Matrix4();
    this.core = new THREE.Vector3();
    race.bulletMesh.count = 0;
    race.bulletOutline.count = 0;
  }

  push(f) {
    for (const key of ['nodes', 'masks', 'statusAt']) f[key] = new Uint16Array(f[key].buffer ?? f[key]);
    for (const key of ['values', 'rest', 'status', 'bullets', 'hazards', 'mode']) if (f[key]) f[key] = new Float32Array(f[key].buffer ?? f[key]);
    for (const item of f.loose) {
      for (const key of ['d', 'line', 'rope']) if (item[key]) item[key] = new Float32Array(item[key].buffer ?? item[key]);
    }
    const pose = new Float32Array(this.frames.at(-1)?.pose ?? this.cur);
    let v = 0;
    f.nodes.forEach((n, i) => {
      const mask = f.masks[i];
      for (let c = 0; c < STRIDE; c++) if (mask & (1 << c)) pose[n * STRIDE + c] = f.values[v++];
    });
    f.pose = pose;
    f.statusAt.forEach((at, i) => (this.status[at] = f.status[i]));
    f.statusFull = new Float32Array(this.status);
    f.played = false;
    this.frames.push(f);
    if (this.view === null) this.view = f.time - DELAY;
  }

  stats(list) {
    list.forEach((stats, i) => Object.assign(this.race.boats[i].stats, stats));
  }

  step(dt, onEvent) {
    const race = this.race;
    if (!this.frames.length) return;
    const latest = this.frames.at(-1).time;
    this.view += dt;
    const target = latest - DELAY;
    if (Math.abs(this.view - target) > 0.6) this.view = target;
    else this.view += (target - this.view) * Math.min(1, dt * 2);
    while (this.frames.length > 2 && this.frames[1].time <= this.view) {
      const f = this.frames.shift();
      if (!f.played) this.play(f, onEvent);
    }
    const a = this.frames[0];
    if (!a.played) this.play(a, onEvent);
    const b = this.frames[1] ?? a;
    const k = b.time > a.time ? Math.min(1, Math.max(0, (this.view - a.time) / (b.time - a.time))) : 0;
    race.time = a.time + (b.time - a.time) * k;

    let o = 0;
    for (const node of this.nodes) {
      readNode(node, a.pose, b.pose, o, k);
      o += STRIDE;
    }
    o = 0;
    for (const m of this.mats) writeMat(m, a.rest[o++]);
    for (const boat of race.boats) {
      const lerp = (i) => a.rest[o + i] + (b.rest[o + i] - a.rest[o + i]) * k;
      const jump = Math.hypot(b.rest[o] - a.rest[o], b.rest[o + 2] - a.rest[o + 2]) > 30;
      boat.pos.set(jump ? a.rest[o] : lerp(0), jump ? a.rest[o + 1] : lerp(1), jump ? a.rest[o + 2] : lerp(2));
      boat.waterY = jump ? a.rest[o + 3] : lerp(3);
      let dh = b.rest[o + 4] - a.rest[o + 4];
      dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      boat.heading = a.rest[o + 4] + dh * k;
      boat.speed = lerp(5);
      const flags = a.rest[o + 6];
      boat.air = flags >= 2 ? boat.air ?? {} : null;
      boat.yOffset = lerp(7);
      boat.trackIdx = a.rest[o + 8];
      o += REST;
    }
    this.poseLoose(a, b, k);
    this.poseBullets(a);
    if (a.hazards) race.hazards?.restore(a.hazards, race.time);
    if (a.mode) race.mode?.restore(a.mode);
    race.whitecaps(dt);
    for (const boat of race.boats) {
      for (const sp of boat.model.spinners) sp.mesh.rotation[sp.axis] += sp.speed * dt;
      race.boatTrail(boat, dt);
    }
    race.wakes.update(race.boats, race.time);
  }

  play(f, onEvent) {
    const race = this.race;
    f.played = true;
    race.state = f.state;
    race.countdown = f.countdown;
    race.clock = f.clock;
    race.finishCount = f.finishCount;
    race.order = f.order.map((i) => race.boats[i]);
    race.boats.forEach((b, i) => readStatus(b, f.statusFull, i * STATUS));
    if (f.stats) this.stats(f.stats);
    for (const [id, ...args] of f.calls) {
      if (id === -1) race.chopper?.chop(...unpackArgs('chop', args));
      else if (FX_METHODS[id]) this.fx[FX_METHODS[id]](...unpackArgs(FX_METHODS[id], args));
    }
    for (const [id, ...args] of f.emits) this.fx[FX_POOLS[id]]?.emit(...args.map(unpack));
    for (const [name, x, y, z] of f.sounds) this.sfx.play(name, x === undefined ? undefined : new THREE.Vector3(unpack(x), unpack(y), unpack(z)));
    for (const e of f.events) onEvent(unpackEvent(race, e));
  }

  poseLoose(a, b, k) {
    const race = this.race;
    const live = new Set();
    race.missiles = [];
    for (const item of a.loose) {
      live.add(item.id);
      let entry = this.loose.get(item.id);
      if (!entry) {
        const mesh = item.kind === LOOSE.missile ? buildMissile() : item.kind === LOOSE.mine ? buildMine() : buildHook();
        race.scene.add(mesh);
        entry = { mesh, line: null, rope: null };
        this.loose.set(item.id, entry);
      }
      const next = b.loose.find((x) => x.id === item.id);
      readNode(entry.mesh, item.d, next ? next.d : item.d, 0, next ? k : 0);
      if (item.kind === LOOSE.mine && entry.mesh.userData.light) entry.mesh.userData.light.visible = item.light > 0;
      if (item.kind === LOOSE.missile) race.missiles.push({ mesh: entry.mesh, pos: entry.mesh.position, target: race.boats[item.target] ?? null, speed: item.speed, lockTime: item.lock, fizzle: item.fizzle });
      if (item.line) {
        if (!entry.line) {
          entry.line = new THREE.Mesh(ROPE_GEOMETRY, ROPE_MATERIAL);
          entry.line.frustumCulled = false;
          race.scene.add(entry.line);
        }
        readNode(entry.line, item.line, next?.line ?? item.line, 0, next?.line ? k : 0);
      } else if (entry.line) {
        race.scene.remove(entry.line);
        entry.line = null;
      }
      if (item.rope && item.rope !== entry.ropeData) {
        entry.ropeData = item.rope;
        const points = [];
        for (let i = 0; i < item.rope.length; i += 3) points.push(new THREE.Vector3(item.rope[i], item.rope[i + 1], item.rope[i + 2]));
        if (!entry.rope) {
          entry.rope = new THREE.Mesh(new THREE.BufferGeometry(), ROPE_MATERIAL);
          entry.rope.frustumCulled = false;
          race.scene.add(entry.rope);
        }
        entry.rope.geometry.dispose();
        entry.rope.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 32, 0.07, 5);
      }
    }
    for (const [id, entry] of this.loose) {
      if (live.has(id)) continue;
      race.scene.remove(entry.mesh);
      if (entry.line) race.scene.remove(entry.line);
      if (entry.rope) {
        race.scene.remove(entry.rope);
        entry.rope.geometry.dispose();
      }
      this.loose.delete(id);
    }
  }

  poseBullets(a) {
    const race = this.race;
    const count = a.bullets.length / 16;
    race.bulletMesh.instanceMatrix.array.set(a.bullets);
    const m = this.matrix;
    const pos = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      m.fromArray(a.bullets, i * 16).decompose(pos, q, s);
      m.compose(pos, q, this.core.set(0.05, 0.05, s.z));
      race.bulletOutline.setMatrixAt(i, m);
    }
    race.bulletMesh.count = count;
    race.bulletOutline.count = count;
    race.bulletMesh.instanceMatrix.needsUpdate = true;
    race.bulletOutline.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    for (const entry of this.loose.values()) {
      this.race.scene.remove(entry.mesh);
      if (entry.line) this.race.scene.remove(entry.line);
      if (entry.rope) this.race.scene.remove(entry.rope);
    }
    this.loose.clear();
  }
}
