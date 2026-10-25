import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { toon, outlined } from './toon.js';
import { waveHeight } from './water.js';
import { fast } from './tuning.js';

const PAD_W = 6;
const PAD_L = 9;
const RAMP_W = 7;
const RAMP_L = 8;
const RAMP_H = 2.4;

function chevronTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.lineJoin = 'round';
  for (let i = 0; i < 2; i++) {
    const y = i * 128;
    ctx.beginPath();
    ctx.moveTo(14, y + 104);
    ctx.lineTo(64, y + 44);
    ctx.lineTo(114, y + 104);
    ctx.lineTo(114, y + 70);
    ctx.lineTo(64, y + 10);
    ctx.lineTo(14, y + 70);
    ctx.closePath();
    ctx.fillStyle = '#FFD23F';
    ctx.strokeStyle = '#FF8A1F';
    ctx.lineWidth = 6;
    ctx.fill();
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 1.5);
  return texture;
}

let parts = null;
function shared() {
  parts ??= {
    padBase: new RoundedBoxGeometry(PAD_W, 0.5, PAD_L, 3, 0.22),
    arrows: new THREE.PlaneGeometry(PAD_W - 1, PAD_L - 1).rotateX(-Math.PI / 2).rotateY(Math.PI),
    rail: new RoundedBoxGeometry(0.45, 0.6, PAD_L, 2, 0.18),
    ramp: rampGeometry(),
    bar: new RoundedBoxGeometry(RAMP_W - 0.6, 0.12, 0.5, 2, 0.05),
    float: new THREE.CapsuleGeometry(0.55, RAMP_L - 1, 6, 12).rotateX(Math.PI / 2),
    lip: new RoundedBoxGeometry(RAMP_W + 0.2, 0.35, 0.4, 2, 0.12),
    navy: toon(0x1b4f7a),
    yellow: toon(0xffd23f),
    orange: toon(0xff8a1f),
    white: toon(0xffffff),
    red: toon(0xff4141),
  };
  return parts;
}

function buildPad(arrowMaterial) {
  const p = shared();
  const group = new THREE.Group();
  group.add(outlined(p.padBase, p.navy, 0.05));
  const arrows = new THREE.Mesh(p.arrows, arrowMaterial);
  arrows.position.y = 0.27;
  group.add(arrows);
  for (const side of [-1, 1]) {
    const rail = outlined(p.rail, p.yellow, 0.04);
    rail.position.set(side * (PAD_W / 2 - 0.1), 0.1, 0);
    group.add(rail);
  }
  return group;
}

function rampGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(RAMP_L, 0);
  shape.lineTo(RAMP_L, RAMP_H);
  shape.quadraticCurveTo(RAMP_L * 0.55, RAMP_H * 0.25, 0, 0);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: RAMP_W,
    bevelEnabled: true,
    bevelThickness: 0.15,
    bevelSize: 0.15,
    bevelSegments: 2,
    curveSegments: 12,
  });
  g.translate(-RAMP_L / 2, 0, -RAMP_W / 2);
  g.rotateY(-Math.PI / 2);
  return g;
}

function buildRamp() {
  const p = shared();
  const group = new THREE.Group();
  group.add(outlined(p.ramp, p.orange, 0.06));
  for (let i = 0; i < 4; i++) {
    const t = (i + 0.6) / 4.6;
    const z = -RAMP_L / 2 + t * RAMP_L;
    const y = RAMP_H * Math.pow(t, 1.6) + 0.18;
    const bar = outlined(p.bar, p.white, 0.03);
    bar.position.set(0, y, z);
    bar.rotation.x = -Math.atan(RAMP_H * 1.6 * Math.pow(t, 0.6) / RAMP_L);
    group.add(bar);
  }
  for (const side of [-1, 1]) {
    const float = outlined(p.float, p.white, 0.05);
    float.position.set(side * (RAMP_W / 2 + 0.3), 0.1, 0);
    group.add(float);
  }
  const lip = outlined(p.lip, p.red, 0.04);
  lip.position.set(0, RAMP_H + 0.05, RAMP_L / 2 - 0.1);
  group.add(lip);
  return group;
}

export class TrackFeatures {
  constructor(scene, track, fx, sfx) {
    this.scene = scene;
    this.track = track;
    this.fx = fx;
    this.sfx = sfx;
    this.texture = chevronTexture();
    this.arrows = new THREE.MeshBasicMaterial({ map: this.texture, transparent: true });
    const place = ([fraction, lateral, routeId], mesh, kind) => {
      const route = track.routes[routeId];
      const idx = route ? route.first + Math.min(route.count - 1, Math.round(fraction * route.count)) : track.wrap(Math.round(fraction * track.N));
      const p = track.point(idx, lateral);
      const heading = track.heading(idx);
      mesh.position.set(p.x, 0, p.z);
      mesh.rotation.y = heading;
      scene.add(mesh);
      return { kind, idx, lateral, x: p.x, z: p.z, heading, mesh, used: new Map() };
    };
    this.pads = track.map.pads.map((spot) => place(spot, buildPad(this.arrows), 'pad'));
    this.ramps = track.map.ramps.map((spot) => place(spot, buildRamp(), 'ramp'));
    this.all = [...this.pads, ...this.ramps];
  }

  nearestAhead(boat, range, choose = null) {
    const t = this.track;
    const byIdx = (this.byIdx ??= new Map(this.all.map((f) => [f.idx, f])));
    let i = boat.trackIdx;
    const steps = Math.round(range / t.spacing);
    for (let k = 1; k <= steps; k++) {
      i = t.step(i, 1, choose);
      const f = byIdx.get(i);
      if (f && k * t.spacing > 8) return f;
    }
    return null;
  }

  local(f, boat) {
    const dx = boat.pos.x - f.x;
    const dz = boat.pos.z - f.z;
    const fx = Math.sin(f.heading);
    const fz = Math.cos(f.heading);
    return { along: dx * fx + dz * fz, side: dx * fz - dz * fx, speed: boat.vel.x * fx + boat.vel.z * fz };
  }

  update(race, dt, t) {
    this.texture.offset.y -= dt * 1.6;
    for (const f of this.all) {
      f.mesh.position.y = waveHeight(f.x, f.z, t) + (f.kind === 'pad' ? -0.05 : -0.2);
      f.mesh.rotation.z = Math.sin(t * 1.3 + f.idx) * 0.03;
    }
    for (const b of race.boats) {
      if (!b.alive || b.yOffset > 1) continue;
      for (const f of this.all) {
        if (race.time < (f.used.get(b) ?? 0)) continue;
        const { along, side, speed } = this.local(f, b);
        if (f.kind === 'pad') {
          if (Math.abs(along) > PAD_L / 2 + 1 || Math.abs(side) > PAD_W / 2 + 0.8) continue;
          f.used.set(b, race.time + 1.5);
          b.boost = Math.max(b.boost, 1.6);
          b.speed = Math.max(b.speed, 0) + fast(14);
          b.bump(2);
          const c = b.center();
          this.fx.ring(c.x, b.waterY + 0.3, c.z, 0xffd23f, 2, 8, 0.4);
          this.fx.sparkBurst(c.x, c.y, c.z, 0xffd23f, 14);
          this.sfx.play('boost', b.pos);
          if (b.isPlayer) race.emit('boost');
        } else {
          if (along < 0 || along > RAMP_L / 2 + 1 || Math.abs(side) > RAMP_W / 2 + 0.6 || speed < fast(8)) continue;
          f.used.set(b, race.time + 2);
          const power = Math.min(1.4, speed / fast(40));
          b.air = { t: 0, dur: 0.9 + power * 0.5, peak: 4 + power * 4, jet: false };
          b.stats.jumps++;
          b.boost = Math.max(b.boost, 1.2);
          b.speed += fast(6);
          this.fx.splash(b.pos.x, b.waterY, b.pos.z, 0.8);
          this.sfx.play('whoosh', b.pos);
          if (b.isPlayer) race.emit('ramp');
        }
      }
    }
  }

  dispose() {
    for (const f of this.all) this.scene.remove(f.mesh);
    this.texture.dispose();
    this.arrows.dispose();
  }
}
