import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { toon, outlined, INK } from './toon.js';
import { waveHeight } from './water.js';

const PADS = [
  [0.03, 6], [0.15, -10], [0.27, 10], [0.4, -4], [0.52, -12], [0.64, 8], [0.77, -8], [0.89, 12],
];
const RAMPS = [
  [0.11, 0], [0.35, 9], [0.6, -9], [0.84, 3],
];
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

function buildPad(texture) {
  const group = new THREE.Group();
  const base = new RoundedBoxGeometry(PAD_W, 0.5, PAD_L, 3, 0.22);
  group.add(outlined(base, toon(0x1b4f7a), 0.05));
  const arrows = new THREE.Mesh(
    new THREE.PlaneGeometry(PAD_W - 1, PAD_L - 1).rotateX(-Math.PI / 2).rotateY(Math.PI),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true }),
  );
  arrows.position.y = 0.27;
  group.add(arrows);
  for (const side of [-1, 1]) {
    const rail = outlined(new RoundedBoxGeometry(0.45, 0.6, PAD_L, 2, 0.18), toon(0xffd23f), 0.04);
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
  const group = new THREE.Group();
  group.add(outlined(rampGeometry(), toon(0xff8a1f), 0.06));
  const stripe = toon(0xffffff);
  for (let i = 0; i < 4; i++) {
    const t = (i + 0.6) / 4.6;
    const z = -RAMP_L / 2 + t * RAMP_L;
    const y = RAMP_H * Math.pow(t, 1.6) + 0.18;
    const bar = outlined(new RoundedBoxGeometry(RAMP_W - 0.6, 0.12, 0.5, 2, 0.05), stripe, 0.03);
    bar.position.set(0, y, z);
    bar.rotation.x = -Math.atan(RAMP_H * 1.6 * Math.pow(t, 0.6) / RAMP_L);
    group.add(bar);
  }
  for (const side of [-1, 1]) {
    const float = outlined(new THREE.CapsuleGeometry(0.55, RAMP_L - 1, 6, 12).rotateX(Math.PI / 2), toon(0xffffff), 0.05);
    float.position.set(side * (RAMP_W / 2 + 0.3), 0.1, 0);
    group.add(float);
  }
  const lip = outlined(new RoundedBoxGeometry(RAMP_W + 0.2, 0.35, 0.4, 2, 0.12), toon(0xff4141), 0.04);
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
    const place = ([fraction, lateral], mesh, kind) => {
      const idx = track.wrap(Math.round(fraction * track.N));
      const p = track.point(idx, lateral);
      const heading = track.heading(idx);
      mesh.position.set(p.x, 0, p.z);
      mesh.rotation.y = heading;
      scene.add(mesh);
      return { kind, idx, lateral, x: p.x, z: p.z, heading, mesh, used: new Map() };
    };
    this.pads = PADS.map((spot) => place(spot, buildPad(this.texture), 'pad'));
    this.ramps = RAMPS.map((spot) => place(spot, buildRamp(), 'ramp'));
    this.all = [...this.pads, ...this.ramps];
  }

  nearestAhead(boat, range) {
    let best = null;
    let bestGap = Infinity;
    for (const f of this.all) {
      const gap = this.track.wrap(f.idx - boat.trackIdx) * this.track.spacing;
      if (gap > 8 && gap < range && gap < bestGap) {
        best = f;
        bestGap = gap;
      }
    }
    return best;
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
          b.speed = Math.max(b.speed, 0) + 14;
          b.bump(2);
          const c = b.center();
          this.fx.ring(c.x, b.waterY + 0.3, c.z, 0xffd23f, 2, 8, 0.4);
          this.fx.sparkBurst(c.x, c.y, c.z, 0xffd23f, 14);
          this.sfx.play('boost', b.pos);
          if (b.isPlayer) race.emit('boost');
        } else {
          if (along < 0 || along > RAMP_L / 2 + 1 || Math.abs(side) > RAMP_W / 2 + 0.6 || speed < 8) continue;
          f.used.set(b, race.time + 2);
          const power = Math.min(1.4, speed / 40);
          b.air = { t: 0, dur: 0.9 + power * 0.5, peak: 4 + power * 4, jet: false };
          b.boost = Math.max(b.boost, 1.2);
          b.speed += 6;
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
  }
}
