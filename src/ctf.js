import * as THREE from 'three';
import { toon, outlined } from './toon.js';
import { ArenaMode } from './arenaMode.js';
import { waveHeight } from './water.js';
import { t as tr } from './i18n.js';

export const TEAMS = [{ color: 0x2f86ff }, { color: 0xff4a3d }];
export const CAPTURES_TO_WIN = 3;
export const MATCH_TIME = 300;
const CARRIER_SPEED = 0.85;
const TIRED_SPEED = 0.6;
const TIRE_AFTER = 20;
const TIRE_TIME = 25;
const FLAG_REACH = 7;
const CAPTURE_REACH = 10;
const DROP_RETURN = 15;
const PATROL_SWAP = 7;
const LOITER = 22;
const RECOVER_RANGE = 150;
const WAIT_NOTICE = 4;
const STATES = ['home', 'carried', 'dropped'];

const POLE = 7.6;
const BANNER_W = 3.8;
const BANNER_H = 2.5;
const CARRY_SCALE = 0.6;

const COLS = 12;
const ROWS = 7;
const HOIST = 0.18;
const THICK = 0.06;
const WIND = new THREE.Vector3(1, 0, 0.45).normalize().multiplyScalar(9);
const GRAVITY = new THREE.Vector3(0, -9.8, 0);

export function carrierSpeed(flag, time) {
  const tired = Math.min(1, Math.max(0, time - flag.takenAt - TIRE_AFTER) / TIRE_TIME);
  return CARRIER_SPEED + (TIRED_SPEED - CARRIER_SPEED) * tired;
}

function bannerLinks() {
  const out = [];
  const at = (r, c) => r * COLS + c;
  const dx = BANNER_W / (COLS - 1);
  const dy = BANNER_H / (ROWS - 1);
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (c < COLS - 1) out.push([at(r, c), at(r, c + 1), dx, 1]);
      if (r < ROWS - 1) out.push([at(r, c), at(r + 1, c), dy, 1]);
      if (r < ROWS - 1 && c < COLS - 1) {
        out.push([at(r, c), at(r + 1, c + 1), Math.hypot(dx, dy), 0.7]);
        out.push([at(r, c + 1), at(r + 1, c), Math.hypot(dx, dy), 0.7]);
      }
      if (c < COLS - 2) out.push([at(r, c), at(r, c + 2), dx * 2, 0.3]);
      if (r < ROWS - 2) out.push([at(r, c), at(r + 2, c), dy * 2, 0.3]);
    }
  }
  return out;
}

const LINKS = bannerLinks();

function slabGeometry() {
  const n = COLS * ROWS;
  const index = [];
  const uv = [];
  for (let side = 0; side < 2; side++) {
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) uv.push(c / (COLS - 1), 1 - r / (ROWS - 1));
  }
  for (let r = 0; r < ROWS - 1; r++) {
    for (let c = 0; c < COLS - 1; c++) {
      const i = r * COLS + c;
      index.push(i, i + COLS, i + 1, i + 1, i + COLS, i + COLS + 1);
      index.push(n + i, n + i + 1, n + i + COLS, n + i + 1, n + i + COLS + 1, n + i + COLS);
    }
  }
  const ring = [];
  for (let c = 0; c < COLS; c++) ring.push(c);
  for (let r = 1; r < ROWS; r++) ring.push(r * COLS + COLS - 1);
  for (let c = COLS - 2; c >= 0; c--) ring.push((ROWS - 1) * COLS + c);
  for (let r = ROWS - 2; r > 0; r--) ring.push(r * COLS);
  ring.forEach((a, k) => {
    const b = ring[(k + 1) % ring.length];
    index.push(a, b, n + a, b, n + b, n + a);
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setIndex(index);
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 6), 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return geometry;
}

class Banner {
  constructor() {
    const n = COLS * ROWS;
    this.rest = new Float32Array(n * 3);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const i = (r * COLS + c) * 3;
        this.rest[i] = HOIST + (c / (COLS - 1)) * BANNER_W;
        this.rest[i + 1] = POLE - 0.25 - (r / (ROWS - 1)) * BANNER_H;
      }
    }
    this.p = this.rest.slice();
    this.q = this.rest.slice();
    this.geometry = slabGeometry();
    this.wind = new THREE.Vector3();
    this.gravity = new THREE.Vector3();
    this.write();
  }

  step(dt, time, phase) {
    const { p, q, rest, wind, gravity } = this;
    const strength = wind.length();
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const i = (r * COLS + c) * 3;
        if (c === 0) {
          for (let a = 0; a < 3; a++) p[i + a] = q[i + a] = rest[i + a];
          continue;
        }
        const gust = 1 + 0.35 * Math.sin(time * 7.3 + c * 0.9 + r * 0.6 + phase);
        const flap = Math.sin(time * 9.5 - c * 0.85 + phase) * strength * 0.45;
        const w = [wind.x * gust, wind.y * gust, wind.z * gust + flap];
        const g = [gravity.x, gravity.y, gravity.z];
        for (let a = 0; a < 3; a++) {
          const v = p[i + a] - q[i + a];
          const drag = 1.8 * (w[a] - v / dt);
          q[i + a] = p[i + a];
          p[i + a] += v * 0.99 + (g[a] + drag) * dt * dt;
        }
      }
    }
    for (let pass = 0; pass < 5; pass++) {
      for (const [a, b, len, stiff] of LINKS) {
        const ia = a * 3;
        const ib = b * 3;
        const dx = p[ib] - p[ia];
        const dy = p[ib + 1] - p[ia + 1];
        const dz = p[ib + 2] - p[ia + 2];
        const d = Math.hypot(dx, dy, dz) || 1e-6;
        const pinA = a % COLS === 0;
        const pinB = b % COLS === 0;
        const k = ((d - len) / d) * stiff * (pinA || pinB ? 1 : 0.5);
        if (!pinA) {
          p[ia] += dx * k;
          p[ia + 1] += dy * k;
          p[ia + 2] += dz * k;
        }
        if (!pinB) {
          p[ib] -= dx * k;
          p[ib + 1] -= dy * k;
          p[ib + 2] -= dz * k;
        }
      }
    }
  }

  write() {
    const { p } = this;
    const out = this.geometry.attributes.position.array;
    const n = COLS * ROWS;
    const at = (r, c) => (Math.max(0, Math.min(ROWS - 1, r)) * COLS + Math.max(0, Math.min(COLS - 1, c))) * 3;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const i = at(r, c);
        const a = at(r, c - 1);
        const b = at(r, c + 1);
        const u = at(r - 1, c);
        const d = at(r + 1, c);
        const ux = p[b] - p[a];
        const uy = p[b + 1] - p[a + 1];
        const uz = p[b + 2] - p[a + 2];
        const vx = p[d] - p[u];
        const vy = p[d + 1] - p[u + 1];
        const vz = p[d + 2] - p[u + 2];
        const nx = vy * uz - vz * uy;
        const ny = vz * ux - vx * uz;
        const nz = vx * uy - vy * ux;
        const len = (Math.hypot(nx, ny, nz) || 1) / THICK;
        out[i] = p[i] + nx / len;
        out[i + 1] = p[i + 1] + ny / len;
        out[i + 2] = p[i + 2] + nz / len;
        out[n * 3 + i] = p[i] - nx / len;
        out[n * 3 + i + 1] = p[i + 1] - ny / len;
        out[n * 3 + i + 2] = p[i + 2] - nz / len;
      }
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.computeVertexNormals();
    this.geometry.computeBoundingSphere();
  }
}

function flagMesh(color) {
  const group = new THREE.Group();
  group.add(outlined(new THREE.CylinderGeometry(0.2, 0.24, POLE, 12).translate(0, POLE / 2, 0), toon(0xf6f1e6), 0.06));
  for (const y of [0.5, 1.2]) group.add(outlined(new THREE.CylinderGeometry(0.27, 0.27, 0.3, 12).translate(0, y, 0), toon(color), 0.05));
  group.add(outlined(new THREE.SphereGeometry(0.46, 14, 10).translate(0, POLE + 0.3, 0), toon(0xffd23f), 0.06));
  const banner = new Banner();
  const cloth = outlined(banner.geometry, toon(color, { side: THREE.DoubleSide }), 0.05);
  cloth.frustumCulled = false;
  cloth.children[0].frustumCulled = false;
  group.add(cloth);
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.7, 0.7, 70, 12, 1, true).translate(0, POLE + 36, 0),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }),
  );
  group.add(beam);
  group.matrixAutoUpdate = false;
  group.userData.banner = banner;
  return group;
}

function baseMesh(base, color) {
  const group = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(CAPTURE_REACH - 1.2, CAPTURE_REACH, 48).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75, depthWrite: false }),
  );
  ring.position.y = 0.35;
  group.add(ring);
  const float = outlined(new THREE.CylinderGeometry(1.6, 1.9, 0.9, 16), toon(color), 0.05);
  float.position.y = 0.2;
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(1.65, 1.65, 0.25, 16), toon(0xffffff));
  stripe.position.y = 0.35;
  group.add(float, stripe);
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    const buoy = outlined(new THREE.SphereGeometry(0.7, 10, 8), toon(k % 2 ? 0xffffff : color), 0.05);
    buoy.position.set(Math.cos(a) * (CAPTURE_REACH + 1.5), 0.2, Math.sin(a) * (CAPTURE_REACH + 1.5));
    group.add(buoy);
  }
  group.position.set(base.x, 0, base.z);
  return group;
}

export class CaptureTheFlag extends ArenaMode {
  constructor({ scene, track }) {
    super({ scene, track });
    this.baseMeshes = this.bases.map((base) => baseMesh(base, TEAMS[base.team].color));
    this.group.add(...this.baseMeshes);
    this.flags = this.bases.map((base) => {
      const mesh = flagMesh(TEAMS[base.team].color);
      this.group.add(mesh);
      return { team: base.team, base, state: 'home', carrier: null, x: base.x, z: base.z, timer: 0, mesh };
    });
    this.matrix = new THREE.Matrix4();
    this.mount = new THREE.Matrix4();
  }

  reset(race) {
    this.race = race;
    this.blocked = this.buildGrid(race.shores);
    this.score = [0, 0];
    this.clock = MATCH_TIME;
    this.overtime = false;
    this.winner = null;
    this.frozen = false;
    for (const flag of this.flags) this.sendHome(flag);
    const members = [[], []];
    for (const b of race.boats) {
      members[b.team].push(b);
      b.flag = null;
      b.stats.captures = 0;
      b.stats.returns = 0;
      const pennant = b.model.flag.children[0];
      pennant.material = toon(TEAMS[b.team].color);
      b.model.flag.scale.setScalar(1.8);
    }
    for (const team of members) {
      const defender = team.find((b) => !b.isPlayer);
      team.forEach((b, k) => {
        if (b.ai) Object.assign(b.ai, { role: b === defender ? 'defend' : 'attack', patrol: 0, patrolTime: 0 });
        b.slot = k;
        this.place(b, true);
      });
    }
  }

  sendHome(flag) {
    if (flag.carrier) flag.carrier.flag = null;
    Object.assign(flag, { state: 'home', carrier: null, x: flag.base.x, z: flag.base.z, timer: 0 });
  }

  play(race, dt) {
    this.frozen = false;
    if (this.winner !== null || race.state !== 'racing') return;
    this.clock -= dt;
    if (this.clock <= 0 && !this.overtime) {
      this.clock = 0;
      if (this.score[0] !== this.score[1]) return this.end(race, this.score[0] > this.score[1] ? 0 : 1);
      this.overtime = true;
      race.emit('overtime');
      race.sfx.play('lap');
    }
    for (const flag of this.flags) {
      if (flag.state === 'carried') {
        const c = flag.carrier;
        if (!c.alive) this.drop(race, flag);
        else {
          flag.x = c.pos.x;
          flag.z = c.pos.z;
        }
      } else if (flag.state === 'dropped' && (flag.timer -= dt) <= 0) {
        this.sendHome(flag);
        race.emit('flagHome', { team: flag.team });
        race.emit('feed', { text: tr(`ctf_home_${flag.team}`), player: true });
      }
    }
    for (const b of race.boats) {
      if (!b.alive || b.yOffset > 4) continue;
      const theirs = this.flags[1 - b.team];
      const mine = this.flags[b.team];
      if (theirs.state !== 'carried' && Math.hypot(b.pos.x - theirs.x, b.pos.z - theirs.z) < FLAG_REACH) this.take(race, theirs, b);
      if (mine.state === 'dropped' && Math.hypot(b.pos.x - mine.x, b.pos.z - mine.z) < FLAG_REACH) {
        this.sendHome(mine);
        b.stats.returns++;
        race.emit('flagReturned', { team: mine.team, by: b });
        race.emit('feed', { text: tr('ctf_returned', { b: b.name }), player: true });
        race.sfx.play('boost', b.pos);
      }
      const home = this.bases[b.team];
      if (!b.flag || Math.hypot(b.pos.x - home.x, b.pos.z - home.z) >= CAPTURE_REACH) continue;
      if (mine.state === 'home') this.capture(race, b);
      else if (!(race.time < b.waitNotice)) {
        b.waitNotice = race.time + WAIT_NOTICE;
        race.emit('flagNeeded', { by: b });
      }
    }
  }

  take(race, flag, b) {
    Object.assign(flag, { state: 'carried', carrier: b, timer: 0, takenAt: race.time });
    b.flag = flag;
    race.emit('flagTaken', { team: flag.team, by: b });
    race.emit('feed', { text: tr('ctf_took', { b: b.name }), player: true });
    race.sfx.play('hookCatch', b.pos);
  }

  drop(race, flag) {
    const b = flag.carrier;
    b.flag = null;
    Object.assign(flag, { state: 'dropped', carrier: null, x: b.pos.x, z: b.pos.z, timer: DROP_RETURN });
    race.emit('flagDropped', { team: flag.team, by: b });
    race.emit('feed', { text: tr('ctf_dropped', { b: b.name }), player: true });
  }

  capture(race, b) {
    const flag = b.flag;
    this.sendHome(flag);
    this.score[b.team]++;
    b.stats.captures++;
    race.emit('flagCaptured', { team: b.team, by: b });
    race.emit('feed', { text: tr('ctf_captured', { b: b.name }), player: true });
    race.sfx.play('lap');
    const p = b.center();
    race.fx.sparkBurst(p.x, p.y + 3, p.z, TEAMS[b.team].color, 40);
    race.fx.ring(p.x, b.waterY + 0.3, p.z, TEAMS[b.team].color, 2, 14, 0.6);
    if (this.overtime || this.score[b.team] >= CAPTURES_TO_WIN) this.end(race, b.team);
  }

  end(race, team) {
    this.winner = team;
    for (const flag of this.flags) if (flag.carrier) flag.carrier.flag = null;
    for (const b of race.boats) {
      b.finished = true;
      b.finishTime = race.clock;
    }
    race.emit('matchEnd', { winner: team });
    race.sfx.play('finish');
  }

  goal(race, b) {
    const mine = this.flags[b.team];
    const theirs = this.flags[1 - b.team];
    const home = this.bases[b.team];
    const away = (p) => Math.hypot(p.x - b.pos.x, p.z - b.pos.z);
    const near = (p, range) => away(p) < range;
    if (b.flag) {
      if (mine.state === 'home') return home;
      if (mine.state === 'dropped' && near(mine, RECOVER_RANGE)) return mine;
      const a = race.time * 0.35 + b.slot * 2;
      return { x: home.x + Math.cos(a) * LOITER, z: home.z + Math.sin(a) * LOITER };
    }
    const defending = b.ai.role === 'defend';
    if (mine.state === 'carried' && (defending || theirs.state === 'carried' || away(mine) < away(theirs))) return mine.carrier.pos;
    if (mine.state === 'dropped' && (defending || near(mine, 300))) return mine;
    if (defending) {
      if (race.time > b.ai.patrolTime) {
        b.ai.patrolTime = race.time + PATROL_SWAP;
        b.ai.patrol = (b.ai.patrol + 1) % 4;
      }
      const [along, side] = [[35, 25], [35, -25], [10, -40], [10, 40]][b.ai.patrol];
      const fx = Math.sin(home.heading);
      const fz = Math.cos(home.heading);
      return { x: home.x + fx * along + fz * side, z: home.z + fz * along - fx * side };
    }
    if (theirs.state === 'carried') return theirs.carrier.pos;
    return theirs;
  }

  animate(time) {
    const dt = Math.min(1 / 30, Math.max(0, time - (this.lastTime ?? time)));
    this.lastTime = time;
    for (const mesh of this.baseMeshes) mesh.position.y = waveHeight(mesh.position.x, mesh.position.z, time) * 0.8;
    for (const b of this.race?.boats ?? []) b.model.flag.visible = !this.flags.some((flag) => flag.state === 'carried' && flag.carrier === b);
    for (const flag of this.flags) {
      const { mesh } = flag;
      if (flag.state === 'carried' && flag.carrier) {
        const { root, body, flag: staff } = flag.carrier.model;
        root.updateMatrix();
        body.updateMatrix();
        this.mount.compose(staff.position.clone().setY(staff.position.y - 1.4), new THREE.Quaternion(), new THREE.Vector3(CARRY_SCALE, CARRY_SCALE, CARRY_SCALE));
        mesh.matrix.multiplyMatrices(root.matrix, body.matrix).multiply(this.mount);
      } else {
        const y = waveHeight(flag.x, flag.z, time);
        const tilt = flag.state === 'dropped' ? 0.35 + Math.sin(time * 2 + flag.team) * 0.1 : 0;
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, flag.team * Math.PI, Math.cos(time * 1.7) * 0.05));
        mesh.matrix.compose(new THREE.Vector3(flag.x, y + (flag.state === 'home' ? 0.6 : -0.6), flag.z), q, new THREE.Vector3(1, 1, 1));
      }
      this.blow(flag, dt, time);
    }
  }

  blow(flag, dt, time) {
    const banner = flag.mesh.userData.banner;
    if (dt <= 0) return banner.write();
    const turn = new THREE.Quaternion();
    flag.mesh.matrix.decompose(new THREE.Vector3(), turn, new THREE.Vector3());
    turn.invert();
    banner.wind.copy(WIND).multiplyScalar(1 + 0.3 * Math.sin(time * 1.3 + flag.team));
    if (flag.state === 'carried' && flag.carrier) banner.wind.sub(flag.carrier.vel);
    banner.wind.applyQuaternion(turn);
    banner.gravity.copy(GRAVITY).applyQuaternion(turn);
    for (let k = 0; k < 2; k++) banner.step(dt / 2, time, flag.team * 1.7);
    banner.write();
  }

  snapshot() {
    const out = new Float32Array(this.flags.length * 4 + 5);
    let o = 0;
    for (const flag of this.flags) {
      out[o++] = STATES.indexOf(flag.state);
      out[o++] = flag.carrier ? this.race.boats.indexOf(flag.carrier) : -1;
      out[o++] = flag.x;
      out[o++] = flag.z;
    }
    out[o++] = this.score[0];
    out[o++] = this.score[1];
    out[o++] = this.clock;
    out[o++] = this.overtime ? 1 : 0;
    out[o++] = this.winner ?? -1;
    return out;
  }

  restore(data) {
    let o = 0;
    for (const flag of this.flags) {
      flag.state = STATES[data[o++]];
      const carrier = data[o++];
      flag.carrier = carrier >= 0 ? this.race.boats[carrier] : null;
      flag.x = data[o++];
      flag.z = data[o++];
    }
    this.score = [data[o++], data[o++]];
    this.clock = data[o++];
    this.overtime = data[o++] > 0;
    const winner = data[o++];
    this.winner = winner >= 0 ? winner : null;
    this.frozen = true;
  }
}
