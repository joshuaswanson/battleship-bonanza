import * as THREE from 'three';

const RATE = 1 / 30;
const STRIDE = 11;

function boatNodes(b) {
  const m = b.model;
  const nodes = [
    m.root,
    m.body,
    m.flag,
    ...m.swivels.map((s) => s.group),
    ...m.sags,
    ...Object.values(m.modules),
    m.saw,
    m.sawYaw,
    m.minigun,
    m.gunSwivel,
    m.muzzleFlash,
    ...m.spinners.map((s) => s.mesh),
    ...m.flames,
    ...m.missileTips,
    m.mineLoaded,
    m.hookHead,
    m.sawShield,
    m.pilotLight,
    m.empCore,
    m.empHalo,
    b.shadow,
    m.fire,
    ...(m.fire?.userData.tongues ?? []),
  ];
  return [...new Set(nodes.filter(Boolean))];
}

function boatMaterials(b) {
  const m = b.model;
  const list = [
    { mat: m.materials, key: 'emissiveIntensity' },
    ...Object.values(m.heatMats).flat().map((mat) => ({ mat, key: 'emissiveIntensity' })),
    { mat: b.shadow.material, key: 'opacity' },
    { mat: m.char, key: 'value' },
  ];
  if (m.sawShield) list.push({ mat: m.sawShield.material, key: 'opacity' });
  if (m.empHalo) list.push({ mat: m.empHalo.material, key: 'opacity' });
  return list;
}

const readMat = ({ mat, key }) => (Array.isArray(mat) ? mat[0]?.[key] ?? 0 : mat[key]);
const writeMat = ({ mat, key }, v) => {
  if (Array.isArray(mat)) for (const x of mat) x[key] = v;
  else mat[key] = v;
};

function writeNode(out, o, node) {
  out[o] = node.position.x;
  out[o + 1] = node.position.y;
  out[o + 2] = node.position.z;
  out[o + 3] = node.quaternion.x;
  out[o + 4] = node.quaternion.y;
  out[o + 5] = node.quaternion.z;
  out[o + 6] = node.quaternion.w;
  out[o + 7] = node.scale.x;
  out[o + 8] = node.scale.y;
  out[o + 9] = node.scale.z;
  out[o + 10] = node.visible ? 1 : 0;
}

const qa = new THREE.Quaternion();
const qb = new THREE.Quaternion();
function readNode(node, a, b, o, k) {
  const lerp = (i) => a[o + i] + (b[o + i] - a[o + i]) * k;
  node.position.set(lerp(0), lerp(1), lerp(2));
  qa.set(a[o + 3], a[o + 4], a[o + 5], a[o + 6]);
  qb.set(b[o + 3], b[o + 4], b[o + 5], b[o + 6]);
  node.quaternion.slerpQuaternions(qa, qb, k);
  node.scale.set(lerp(7), lerp(8), lerp(9));
  node.visible = a[o + 10] > 0.5;
}

const cloneArg = (v) => (v?.isVector3 ? v.clone() : v);

export class Recorder {
  constructor(race, fx) {
    this.race = race;
    this.fx = fx;
    this.frames = [];
    this.events = [];
    this.next = 0;
    this.start = null;
    this.nodes = race.boats.flatMap((b) => boatNodes(b));
    this.mats = race.boats.flatMap((b) => boatMaterials(b));
    this.size = this.nodes.length * STRIDE + this.mats.length + race.boats.length * 7;
    this.pools = [fx.puffs, fx.sparks, fx.soot, fx.fire, fx.fireMid, fx.fireCore, fx.casings].map((pool) => [pool, 'emit']);
    this.pools.push([fx.rings, 'take'], [fx.beams, 'take'], [fx.shells, 'take'], [fx.lightning, 'add'], [fx.decals, 'stamp']);
    if (race.chopper) this.pools.push([race.chopper, 'chop']);
    for (const [pool, name] of this.pools) {
      const original = pool[name].bind(pool);
      pool[name] = (...args) => {
        this.events.push({ t: this.race.time, pool, name, args: args.map(cloneArg) });
        return original(...args);
      };
    }
    const sfx = race.sfx;
    race.sfx = {
      play: (name, pos) => {
        this.events.push({ t: this.race.time, sound: name, pos: pos ? new THREE.Vector3(pos.x, pos.y ?? 0, pos.z) : null });
        sfx.play(name, pos);
      },
    };
    race.features.sfx = race.sfx;
    this.sfx = sfx;
  }

  detach() {
    for (const [pool, name] of this.pools) delete pool[name];
    this.race.sfx = this.sfx;
    this.race.features.sfx = this.sfx;
  }

  capture() {
    const race = this.race;
    if (this.start === null && race.state === 'racing') this.start = race.time - 1;
    if (race.time < this.next) return;
    this.next = race.time + RATE;
    const data = new Float32Array(this.size);
    let o = 0;
    for (const node of this.nodes) {
      writeNode(data, o, node);
      o += STRIDE;
    }
    for (const m of this.mats) data[o++] = readMat(m);
    for (const b of race.boats) {
      data[o++] = b.pos.x;
      data[o++] = b.pos.y;
      data[o++] = b.pos.z;
      data[o++] = b.waterY;
      data[o++] = b.heading;
      data[o++] = b.speed;
      data[o++] = (b.alive ? 1 : 0) + (b.air ? 2 : 0);
    }
    const loose = [];
    const add = (node) => {
      const d = new Float32Array(STRIDE);
      writeNode(d, 0, node);
      loose.push({ node, parent: node.parent, d });
    };
    for (const m of race.missiles) add(m.mesh);
    for (const m of race.mines) {
      add(m.mesh);
      if (m.mesh.userData.light) add(m.mesh.userData.light);
    }
    for (const h of race.hooks) {
      add(h.mesh);
      if (h.loose) loose.push({ node: h.loose.mesh, parent: race.scene, geometry: h.loose.mesh.geometry.clone() });
      else add(h.rope);
    }
    const count = race.bulletMesh.count;
    const bullets = [race.bulletMesh, race.bulletOutline].map((mesh) => mesh.instanceMatrix.array.slice(0, count * 16));
    this.frames.push({ t: race.time, data, loose, bullets, count });
  }
}

export class Replay {
  constructor(recorder, scene, sfx) {
    this.rec = recorder;
    this.race = recorder.race;
    this.scene = scene;
    this.sfx = sfx;
    this.time = recorder.start ?? recorder.frames[0]?.t ?? 0;
    this.songAt = (recorder.start ?? this.time) + 1;
    this.end = Math.min(recorder.frames.at(-1)?.t ?? this.time, this.songAt + sfx.musicLength('race') + 1);
    this.frame = 0;
    this.event = 0;
    while (this.event < recorder.events.length && recorder.events[this.event].t < this.time) this.event++;
    recorder.fx.decals.clear();
    this.race.chopper?.reset();
    this.shown = new Set();
    this.ropes = new Map();
    this.race.bulletMesh.count = 0;
    this.race.bulletOutline.count = 0;
  }

  get done() {
    return this.time >= this.end;
  }

  step(dt) {
    const { frames, events, nodes, mats } = this.rec;
    this.time = Math.min(this.end, this.time + dt);
    if (this.songAt !== null && this.time >= this.songAt) {
      this.sfx.playMusic('race', { at: this.time - this.songAt, loop: false });
      this.songAt = null;
    }
    while (this.frame < frames.length - 2 && frames[this.frame + 1].t <= this.time) this.frame++;
    const a = frames[this.frame];
    const b = frames[Math.min(frames.length - 1, this.frame + 1)];
    const k = b.t > a.t ? Math.min(1, Math.max(0, (this.time - a.t) / (b.t - a.t))) : 0;

    let o = 0;
    for (const node of nodes) {
      readNode(node, a.data, b.data, o, k);
      o += STRIDE;
    }
    for (const m of mats) writeMat(m, a.data[o++]);
    for (const boat of this.race.boats) {
      const lerp = (i) => a.data[o + i] + (b.data[o + i] - a.data[o + i]) * k;
      const jump = Math.abs(b.data[o + 3] - a.data[o + 3]) > 30;
      boat.pos.set(lerp(0), jump ? a.data[o + 1] : lerp(1), lerp(2));
      boat.waterY = jump ? a.data[o + 3] : lerp(3);
      boat.heading = a.data[o + 4];
      boat.speed = a.data[o + 5];
      const flags = a.data[o + 6];
      boat.ko = flags % 2 === 1 ? 0 : 1;
      boat.air = flags >= 2 ? {} : null;
      o += 7;
    }

    const live = new Set();
    for (const item of a.loose) {
      live.add(item.node);
      if (item.node.parent !== item.parent) item.parent.add(item.node);
      if (item.geometry) item.node.geometry = item.geometry;
      else {
        const next = b.loose.find((x) => x.node === item.node);
        readNode(item.node, item.d, next ? next.d : item.d, 0, next ? k : 0);
      }
    }
    for (const node of this.shown) if (!live.has(node)) node.parent?.remove(node);
    this.shown = live;

    for (const [i, mesh] of [this.race.bulletMesh, this.race.bulletOutline].entries()) {
      mesh.instanceMatrix.array.set(a.bullets[i]);
      mesh.count = a.count;
      mesh.instanceMatrix.needsUpdate = true;
    }

    while (this.event < events.length && events[this.event].t <= this.time) {
      const e = events[this.event++];
      if (e.sound) this.sfx.play(e.sound, e.pos);
      else Object.getPrototypeOf(e.pool)[e.name].apply(e.pool, e.args);
    }
    this.race.wakes.update(this.race.boats, this.time);
  }
}
