import * as THREE from 'three';
import { toon, outlined } from './toon.js';
import { waveHeight } from './water.js';
import { t as tr } from './i18n.js';
import { ArenaMode } from './arenaMode.js';
import { TEAMS } from './ctf.js';

export const POINTS = 5;
export const MATCH_TIME_CP = 360;
export const ZONE = 24;
const CAP_TIME = 6;
const RESPAWN_DELAY = 4;
const LETTERS = ['A', 'B', 'C', 'D', 'E'];
const NEUTRAL = 0xe9edf2;
const SPREAD = [-0.66, -0.33, 0, 0.33, 0.66];
const SEGMENTS = 64;
const DEFEND_SPOTS = [[0.4, 0.5], [0.4, -0.5], [-0.3, 0.7], [-0.3, -0.7]];

export const pointLetter = (i) => LETTERS[i];

function letterSprite(letter) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#0E2A47';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(64, 64, 52, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#0E2A47';
  ctx.font = '900 76px "Saira Condensed", "Arial Narrow", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(letter, 64, 70);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), depthWrite: false }));
  sprite.scale.setScalar(5);
  return sprite;
}

function pointMesh(letter) {
  const group = new THREE.Group();
  const paint = toon(NEUTRAL);
  const glow = new THREE.MeshBasicMaterial({ color: NEUTRAL, transparent: true, opacity: 0.18, depthWrite: false });
  const pool = new THREE.Mesh(new THREE.CircleGeometry(ZONE, 48).rotateX(-Math.PI / 2), glow);
  pool.position.y = 0.3;
  pool.renderOrder = 2;
  group.add(pool);
  const edge = new THREE.Mesh(new THREE.RingGeometry(ZONE - 0.9, ZONE, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: NEUTRAL, transparent: true, opacity: 0.85, depthWrite: false }));
  edge.position.y = 0.35;
  group.add(edge);
  const progress = new THREE.Mesh(new THREE.RingGeometry(ZONE - 3, ZONE - 1.2, SEGMENTS, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthWrite: false }));
  progress.position.y = 0.4;
  progress.geometry.setDrawRange(0, 0);
  group.add(progress);
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    const buoy = outlined(new THREE.SphereGeometry(0.75, 10, 8), k % 2 ? toon(0xffffff) : paint, 0.05);
    buoy.position.set(Math.cos(a) * (ZONE + 1.4), 0.2, Math.sin(a) * (ZONE + 1.4));
    group.add(buoy);
  }
  const float = outlined(new THREE.CylinderGeometry(2.6, 3, 1.2, 18), toon(0xf6f1e6), 0.06);
  float.position.y = 0.3;
  const band = outlined(new THREE.CylinderGeometry(2.7, 2.7, 0.4, 18), paint, 0.04);
  band.position.y = 0.55;
  const mast = outlined(new THREE.CylinderGeometry(0.35, 0.5, 7, 10).translate(0, 4.4, 0), toon(0x8d939a), 0.05);
  const lamp = outlined(new THREE.SphereGeometry(1.25, 16, 12).translate(0, 8.6, 0), paint, 0.06);
  group.add(float, band, mast, lamp);
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.9, 0.9, 70, 12, 1, true).translate(0, 44, 0),
    new THREE.MeshBasicMaterial({ color: NEUTRAL, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }),
  );
  group.add(beam);
  const label = letterSprite(letter);
  label.position.y = 13;
  group.add(label);
  return { group, paint, glow, edge: edge.material, progress, beam: beam.material };
}

export class ControlPoints extends ArenaMode {
  constructor({ scene, track }) {
    super({ scene, track });
    this.kind = 'cp';
    this.respawnDelay = RESPAWN_DELAY;
    this.flags = [];
    this.points = null;
  }

  layout() {
    const { rx } = this.arena;
    const side = Math.sign(this.bases[0].x) || -1;
    return SPREAD.map((f, i) => {
      const spot = this.openSpot(-f * side * rx, 0);
      const mesh = pointMesh(LETTERS[i]);
      mesh.group.position.set(spot.x, 0, spot.z);
      this.group.add(mesh.group);
      return { index: i, x: spot.x, z: spot.z, owner: null, progress: 0, capper: null, contested: false, mesh };
    });
  }

  openSpot(x, z) {
    const room = Math.ceil((ZONE + 4) / 6);
    const clear = (cell) => {
      const c = cell % this.cols;
      const r = (cell - c) / this.cols;
      for (let dr = -room; dr <= room; dr++) {
        for (let dc = -room; dc <= room; dc++) {
          if (dr * dr + dc * dc > room * room) continue;
          const nc = c + dc;
          const nr = r + dr;
          if (nc < 0 || nr < 0 || nc >= this.cols || nr >= this.rows || this.blocked[nr * this.cols + nc]) return false;
        }
      }
      return true;
    };
    let best = null;
    let bestD = Infinity;
    for (let cell = 0; cell < this.cols * this.rows; cell++) {
      const c = cell % this.cols;
      const px = c * 6 - this.arena.rx;
      const pz = ((cell - c) / this.cols) * 6 - this.arena.rz;
      const d = (px - x) ** 2 + (pz - z) ** 2 * 1.6;
      if (d < bestD && clear(cell)) {
        bestD = d;
        best = { x: px, z: pz };
      }
    }
    return best ?? { x, z };
  }

  reset(race) {
    this.race = race;
    this.blocked = this.buildGrid(race.shores);
    this.points ??= this.layout();
    this.points.forEach((p, i) => Object.assign(p, { owner: i < 2 ? 0 : i > 2 ? 1 : null, progress: 0, capper: null, contested: false }));
    this.clock = MATCH_TIME_CP;
    this.overtime = false;
    this.winner = null;
    this.frozen = false;
    this.tally();
    const members = [[], []];
    for (const b of race.boats) {
      members[b.team].push(b);
      b.flag = null;
      b.stats.captures = 0;
      b.stats.returns = 0;
      b.model.flag.children[0].material = toon(TEAMS[b.team].color);
      b.model.flag.scale.setScalar(1.8);
    }
    for (const team of members) {
      const defender = team.find((x) => !x.isPlayer);
      team.forEach((b, k) => {
        if (b.ai) Object.assign(b.ai, { role: b === defender ? 'defend' : 'attack', patrol: 0, patrolTime: 0 });
        b.slot = k;
        this.place(b, true);
      });
    }
  }

  tally() {
    this.score = [0, 1].map((team) => this.points.filter((p) => p.owner === team).length);
  }

  target(team) {
    if (team === 0) {
      for (let i = 0; i < POINTS; i++) if (this.points[i].owner !== 0) return i;
    } else {
      for (let i = POINTS - 1; i >= 0; i--) if (this.points[i].owner !== 1) return i;
    }
    return -1;
  }

  frontline(team) {
    let last = -1;
    if (team === 0) for (let i = 0; i < POINTS && this.points[i].owner === 0; i++) last = i;
    else for (let i = POINTS - 1; i >= 0 && this.points[i].owner === 1; i--) last = i;
    return last;
  }

  spawnSpot(b) {
    const front = this.frontline(b.team);
    const base = super.spawnSpot(b);
    if (front < 0) return base;
    const p = this.points[front];
    const home = this.bases[b.team];
    const back = Math.hypot(home.x - p.x, home.z - p.z) || 1;
    const ux = (home.x - p.x) / back;
    const uz = (home.z - p.z) / back;
    const lateral = ((b.slot % 3) - 1) * 10;
    const x = p.x + ux * (ZONE + 40 + (b.slot % 2) * 10) - uz * lateral;
    const z = p.z + uz * (ZONE + 40 + (b.slot % 2) * 10) + ux * lateral;
    if (this.blocked[this.cellOf(x, z)]) return base;
    return { x, z, heading: Math.atan2(-ux, -uz) };
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
    const aims = [this.target(0), this.target(1)];
    for (const p of this.points) {
      const inside = [[], []];
      for (const b of race.boats) {
        if (b.alive && b.yOffset < 4 && Math.hypot(b.pos.x - p.x, b.pos.z - p.z) < ZONE) inside[b.team].push(b);
      }
      p.contested = inside[0].length > 0 && inside[1].length > 0;
      const lead = inside[0].length - inside[1].length;
      if (p.contested && lead === 0) continue;
      const team = lead > 0 ? 0 : lead < 0 ? 1 : null;
      const crowd = Math.abs(lead) * (p.contested ? 0.5 : 1);
      if (team !== null && aims[team] === p.index && p.owner !== team) {
        if (p.capper !== null && p.capper !== team) {
          p.progress -= (dt / CAP_TIME) * 2;
          if (p.progress <= 0) {
            p.progress = 0;
            p.capper = null;
          }
          continue;
        }
        p.capper = team;
        p.progress += (dt / CAP_TIME) * Math.min(2, 0.5 + 0.5 * crowd) * (p.owner === null ? 2 : 1);
        if (p.progress >= 1) this.capture(race, p, team, inside[team]);
        continue;
      }
      if (p.progress > 0) {
        p.progress -= (dt / CAP_TIME) * (team !== null && team === p.owner ? 1.5 : 0.35);
        if (p.progress <= 0) {
          p.progress = 0;
          p.capper = null;
        }
      }
    }
  }

  capture(race, p, team, crew) {
    const before = this.score[team] - this.score[1 - team];
    p.owner = team;
    p.progress = 0;
    p.capper = null;
    this.tally();
    for (const b of crew) b.stats.captures++;
    const letter = LETTERS[p.index];
    race.emit('pointCaptured', { team, letter });
    race.emit('feed', { text: tr(`cp_took_${team}`, { p: letter }), player: true });
    race.sfx.play('lap');
    race.fx.sparkBurst(p.x, 9, p.z, TEAMS[team].color, 40);
    race.fx.ring(p.x, 0.5, p.z, TEAMS[team].color, 2, ZONE + 4, 0.6);
    if (this.score[team] === POINTS) return this.end(race, team);
    if (this.overtime && this.score[team] - this.score[1 - team] > 0 && before <= 0) this.end(race, team);
  }

  end(race, team) {
    this.winner = team;
    for (const b of race.boats) {
      b.finished = true;
      b.finishTime = race.clock;
    }
    race.emit('matchEnd', { winner: team });
    race.sfx.play('finish');
  }

  goal(race, b) {
    const attack = this.target(b.team);
    const threat = this.target(1 - b.team);
    const guard = threat >= 0 && this.points[threat].owner === b.team ? this.points[threat] : null;
    if (b.ai.role === 'defend' && guard) {
      if (race.time > b.ai.patrolTime) {
        b.ai.patrolTime = race.time + 6;
        b.ai.patrol = (b.ai.patrol + 1) % DEFEND_SPOTS.length;
      }
      const [r, a] = DEFEND_SPOTS[b.ai.patrol];
      return { x: guard.x + Math.cos(a * Math.PI) * ZONE * r, z: guard.z + Math.sin(a * Math.PI) * ZONE * r };
    }
    const p = this.points[attack >= 0 ? attack : 2];
    if (Math.hypot(b.pos.x - p.x, b.pos.z - p.z) < ZONE * 1.4) {
      const a = race.time * 0.7 + b.slot * 2.1;
      return { x: p.x + Math.cos(a) * ZONE * 0.45, z: p.z + Math.sin(a) * ZONE * 0.45 };
    }
    return p;
  }

  animate(time) {
    if (!this.points) return;
    for (const p of this.points) {
      const { mesh } = p;
      mesh.group.position.y = waveHeight(p.x, p.z, time) * 0.8;
      const color = p.owner === null ? NEUTRAL : TEAMS[p.owner].color;
      mesh.paint.color.setHex(color);
      mesh.glow.color.setHex(color);
      mesh.edge.color.setHex(p.contested ? (Math.floor(time * 6) % 2 ? 0xffffff : 0xffd23f) : color);
      mesh.beam.color.setHex(color);
      mesh.glow.opacity = p.contested ? 0.3 : 0.18;
      mesh.progress.material.color.setHex(p.capper === null ? 0xffffff : TEAMS[p.capper].color);
      mesh.progress.geometry.setDrawRange(0, Math.floor(p.progress * SEGMENTS) * 6);
    }
  }

  snapshot() {
    const out = new Float32Array(POINTS * 3 + 4);
    let o = 0;
    for (const p of this.points) {
      out[o++] = p.owner ?? -1;
      out[o++] = p.progress;
      out[o++] = p.capper ?? -1;
    }
    out[o++] = this.clock;
    out[o++] = this.overtime ? 1 : 0;
    out[o++] = this.winner ?? -1;
    out[o++] = this.points.reduce((m, p, i) => m | (p.contested ? 1 << i : 0), 0);
    return out;
  }

  restore(data) {
    let o = 0;
    for (const p of this.points) {
      const owner = data[o++];
      p.owner = owner >= 0 ? owner : null;
      p.progress = data[o++];
      const capper = data[o++];
      p.capper = capper >= 0 ? capper : null;
    }
    this.clock = data[o++];
    this.overtime = data[o++] > 0;
    const winner = data[o++];
    this.winner = winner >= 0 ? winner : null;
    const contested = data[o++];
    this.points.forEach((p, i) => (p.contested = !!(contested & (1 << i))));
    this.tally();
    this.frozen = true;
  }
}
