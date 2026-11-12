import * as THREE from 'three';
import { cachedGeometry, toon } from './toon.js';
import { HullForm, back, box, merge, mix, morphTime, seg, sideways, smooth, tube } from './hullForm.js';

const SPEC = { key: 'scooter', hatch: false, jaws: false };
export const SCOOTER_RIDE = 0.5;
const WHEEL_R = 0.86;
const WHEEL_Y = 0.02;
const GROUND = WHEEL_Y - WHEEL_R;
const FRONT_Z = 3.5;
const REAR_Z = -2.7;
const FLOOR = 0.05;
const LEAN = 0.95;
const STEER = 1.1;
const SHIELD_H = 2.15;
const SEAT_Y = 2.75;
const SADDLE_H = 1.25;

const span = (a, b, n) => Array.from({ length: n + 1 }, (_, k) => a + ((b - a) * k) / n);
const bell = (u) => Math.sin(Math.PI * Math.min(1, Math.max(0, u)));

function loft(zs, section) {
  const pos = [];
  const index = [];
  const across = section(zs[0]).length;
  for (const z of zs) for (const [x, y] of section(z)) pos.push(x, y, z);
  for (let r = 0; r < zs.length - 1; r++) {
    for (let c = 0; c < across - 1; c++) {
      const a = r * across + c;
      index.push(a, a + 1, a + across, a + 1, a + across + 1, a + across);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(index);
  const flat = g.toNonIndexed();
  flat.computeVertexNormals();
  return flat;
}

const COWL_FROM = -4.5;
const COWL_TO = -0.3;

function cowlSection(z) {
  const u = (z - COWL_FROM) / (COWL_TO - COWL_FROM);
  const swell = 0.25 + 0.75 * bell(0.08 + u * 0.8) ** 0.55;
  const w = 1.42 * swell;
  const top = FLOOR + 1.72 * (0.3 + 0.7 * bell(0.1 + u * 0.72) ** 0.5);
  const points = [];
  for (let k = 0; k <= 16; k++) {
    const a = Math.PI * (k / 16);
    const c = Math.cos(a);
    points.push([Math.sign(c) * w * Math.abs(c) ** 0.5, FLOOR + (top - FLOOR) * Math.sin(a) ** 0.6]);
  }
  return points;
}

function shieldSection(y) {
  const u = (y - FLOOR) / SHIELD_H;
  const w = 1.36 * (1 - 0.34 * u * u);
  const lean = 2.25 - 0.42 * u;
  const points = [];
  for (let k = 0; k <= 12; k++) {
    const f = -1 + (2 * k) / 12;
    points.push([f * w, lean - 0.38 * f * f]);
  }
  return points;
}

function shield() {
  const ys = span(FLOOR, FLOOR + SHIELD_H, 14);
  const pos = [];
  const index = [];
  const across = 13;
  for (const y of ys) for (const [x, z] of shieldSection(y)) pos.push(x, y, z);
  for (let r = 0; r < ys.length - 1; r++) {
    for (let c = 0; c < across - 1; c++) {
      const a = r * across + c;
      index.push(a, a + across, a + 1, a + 1, a + across, a + across + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(index);
  const flat = g.toNonIndexed();
  flat.computeVertexNormals();
  return flat;
}

function buildParts() {
  return {
    cowl: loft([COWL_FROM - 0.02, ...span(COWL_FROM, COWL_TO, 26), COWL_TO + 0.02], (z) => (z < COWL_FROM || z > COWL_TO ? cowlSection(Math.min(COWL_TO, Math.max(COWL_FROM, z))).map(() => [0, FLOOR + 0.4]) : cowlSection(z))),
    cowlTrim: merge([1, -1].map((s) => box(0.08, 0.14, 2.6, s * 1.36, 0.62, -2.5))),
    vents: merge([1, -1].flatMap((s) => [0, 1, 2].map((k) => box(0.06, 0.1, 0.7, s * 1.4, 0.95 + k * 0.2, -2.6)))),
    floor: merge([box(1.9, 0.16, 2.9, 0, FLOOR, 0.95), box(1.5, 0.05, 2.5, 0, FLOOR + 0.1, 0.95)]),
    shield: shield(),
    shieldRim: merge([box(1.9, 0.12, 0.2, 0, FLOOR + SHIELD_H + 0.02, 1.83)]),
    badge: merge([box(0.5, 0.5, 0.06, 0, 1.6, 2.3)]),
    column: merge([tube(0.2, 1.5, 0, 0.75, 0)]),
    bars: merge([sideways(tube(0.09, 2.5, 0, 0, 0)).translate(0, 1.5, -0.12), box(0.9, 0.42, 0.6, 0, 1.52, 0.02)]),
    grips: merge([1, -1].map((s) => sideways(tube(0.14, 0.5, 0, 0, 0)).translate(s * 1.2, 1.5, -0.12))),
    lampShell: merge([tube(0.42, 0.5, 0, 0, 0).rotateX(Math.PI / 2).translate(0, 1.56, 0.42)]),
    lens: new THREE.CircleGeometry(0.34, 18).translate(0, 1.56, 0.68),
    fender: merge([new THREE.TorusGeometry(WHEEL_R + 0.14, 0.2, 8, 20, Math.PI * 0.95).rotateY(Math.PI / 2).rotateX(-0.2).scale(2.1, 1, 1)]),
    fork: merge([1, -1].map((s) => box(0.12, 1.2, 0.16, s * 0.42, 0.52, 0))),
    tire: merge([sideways(tube(WHEEL_R, 0.5, 0, 0, 0))]),
    whitewall: merge([sideways(tube(0.62, 0.54, 0, 0, 0))]),
    hub: merge([sideways(tube(0.34, 0.6, 0, 0, 0))]),
    spare: merge([tube(WHEEL_R * 0.92, 0.42, 0, 0, 0).rotateX(Math.PI / 2)]),
    spareHub: merge([tube(0.5, 0.48, 0, 0, 0).rotateX(Math.PI / 2)]),
    saddle: merge([box(1.3, SADDLE_H, 3.5, 0, -SADDLE_H / 2 - 0.02, 0), box(1.4, 0.2, 3.6, 0, -0.14, 0)]),
    rack: merge([box(1.5, 0.1, 3.7, 0, 0, 0), ...[1, -1].map((s) => box(0.1, 0.1, 3.9, s * 0.8, 0.08, 0)), ...[-1.6, 0, 1.6].map((z) => box(1.7, 0.1, 0.1, 0, 0.08, z))]),
    taillight: merge([box(0.5, 0.26, 0.1, 0, 1.0, COWL_FROM + 0.12)]),
    pipe: merge([tube(0.13, 1.5, 0, 0, 0).rotateX(Math.PI / 2).translate(1.05, 0.02, -3.3)]),
    stand: merge([box(0.9, 0.08, 0.1, 0, -0.5, 0.2)]),
  };
}

const scooterParts = () => cachedGeometry('scooterParts', buildParts);
const leather = () => cachedGeometry('scooterLeather', () => toon(0xb9773f));

export class ScooterForm extends HullForm {
  constructor(refs, color) {
    const P = scooterParts();
    super(refs, color, SPEC);
    const { add, S, paint, rig } = this;
    const columns = new Set(this.turrets.map((t) => t.column));
    this.boatBits = rig.children.filter((o) => !columns.has(o));
    this.frame = new THREE.Group();
    rig.add(this.frame);
    const frame = this.frame;

    this.cowl = new THREE.Group();
    add(P.cowl, paint, 0.05, this.cowl);
    add(P.cowlTrim, S.chrome, 0.02, this.cowl);
    add(P.vents, S.dark, 0, this.cowl);
    add(P.taillight, S.head, 0.02, this.cowl);
    add(P.pipe, S.chrome, 0.02, this.cowl);
    frame.add(this.cowl);

    this.floor = add(P.floor, S.dark, 0.04, frame);

    this.shield = new THREE.Group();
    this.shield.position.set(0, FLOOR, 1.85);
    const face = new THREE.Group();
    face.position.set(0, -FLOOR, -1.85);
    add(P.shield, paint, 0.05, face).material.side = THREE.DoubleSide;
    add(P.shieldRim, S.chrome, 0.02, face);
    add(P.badge, S.white, 0.02, face);
    this.shield.add(face);
    frame.add(this.shield);

    this.steering = new THREE.Group();
    this.steering.position.set(0, FLOOR + 0.45, 2.3);
    add(P.column, S.dark, 0.03, this.steering);
    this.bars = new THREE.Group();
    add(P.bars, paint, 0.03, this.bars);
    add(P.grips, S.dark, 0.02, this.bars);
    add(P.lampShell, S.chrome, 0.03, this.bars);
    this.bars.add(new THREE.Mesh(P.lens, S.head));
    this.steering.add(this.bars);
    frame.add(this.steering);

    this.front = new THREE.Group();
    this.front.position.set(0, WHEEL_Y, FRONT_Z);
    add(P.fork, S.chrome, 0.02, this.front);
    this.fender = add(P.fender, paint, 0.04, this.front);
    frame.add(this.front);

    this.wheels = [FRONT_Z, REAR_Z].map((z, k) => {
      const root = new THREE.Group();
      const spin = new THREE.Group();
      root.add(spin);
      add(P.tire, S.dark, 0.04, spin);
      add(P.whitewall, S.white, 0, spin);
      add(P.hub, S.chrome, 0.02, spin);
      (k === 0 ? this.front : frame).add(root);
      if (k === 1) root.position.set(0, WHEEL_Y, z);
      return { root, spin, front: k === 0 };
    });

    this.spare = new THREE.Group();
    this.spare.position.set(0, 0.85, COWL_FROM - 0.12);
    add(P.spare, S.dark, 0.04, this.spare);
    add(P.spareHub, paint, 0.02, this.spare);
    frame.add(this.spare);

    this.rack = add(P.rack, S.chrome, 0.02, frame);
    add(P.saddle, leather(), 0.04, this.rack);
    this.rack.position.set(0, SEAT_Y - 0.12, -2.2);
  }

  set(p, roll, steer, time) {
    if (!this.enter(p)) return;
    const m = morphTime(p);
    const done = p >= 1;
    this.ride = SCOOTER_RIDE * back(seg(m, 1.5, 2.1), 1.3);
    this.poseDeck(m, done, 0.4);
    const squash = smooth(seg(m, 1.1, 1.9));
    for (const bit of this.boatBits) {
      bit.visible = m < 2.3;
      bit.scale.set(mix(1, 0.5, squash), mix(1, 0.5, squash), 1);
    }
    this.motor.rotation.x = back(seg(m, 1.1, 1.7), 1.2) * 1.7;
    this.pole.scale.setScalar(Math.max(0.001, 1 - seg(m, 1.4, 1.8)));
    this.mountPart.visible = m < 2.2;
    this.refs.flag.visible = m < 1.8;

    const lean = done ? steer * LEAN : 0;
    this.lean = lean;
    this.frame.rotation.z = lean;
    this.frame.position.set(GROUND * Math.sin(lean), GROUND * (1 - Math.cos(lean)), 0);

    for (const w of this.wheels) {
      const out = back(seg(m, w.front ? 1 : 1.12, w.front ? 1.6 : 1.72), 1.5);
      w.root.visible = out > 0.001;
      w.root.scale.setScalar(Math.max(0.001, mix(0.25, 1, out)));
      w.spin.rotation.x = roll / WHEEL_R;
    }
    this.front.visible = m > 1;
    this.front.rotation.y = done ? steer * STEER : 0;
    this.fender.scale.setScalar(Math.max(0.001, back(seg(m, 1.5, 1.95), 1.4)));

    const cowlIn = back(seg(m, 1.6, 2.3), 1.2);
    this.cowl.visible = m > 1.55;
    this.cowl.position.z = mix(2.6, 0, cowlIn);
    this.cowl.scale.set(Math.max(0.001, mix(0.5, 1, cowlIn)), Math.max(0.001, mix(0.3, 1, cowlIn)), Math.max(0.05, cowlIn));
    this.floor.visible = m > 1.7;
    this.floor.scale.set(1, 1, Math.max(0.001, back(seg(m, 1.7, 2.2), 1.2)));

    const up = back(seg(m, 2.05, 2.65), 1.5);
    this.shield.visible = m > 2;
    this.shield.rotation.x = mix(1.5, 0, up);
    this.shield.scale.setScalar(Math.max(0.001, mix(0.5, 1, up)));

    const rise = back(seg(m, 2.4, 2.9), 1.6);
    this.steering.visible = m > 2.35;
    this.steering.scale.set(1, Math.max(0.001, rise), 1);
    this.bars.position.y = 0;
    this.bars.rotation.y = done ? steer * STEER : mix(1.4, 0, back(seg(m, 2.7, 3.15), 1.8));
    this.bars.scale.setScalar(Math.max(0.001, back(seg(m, 2.6, 3.05), 1.8)));

    const pop = back(seg(m, 2.75, 3.15), 2);
    this.spare.visible = m > 2.7;
    this.spare.scale.setScalar(Math.max(0.001, pop));
    this.rack.visible = m > 2.3;
    this.rack.scale.set(1, 1, Math.max(0.001, back(seg(m, 2.3, 2.8), 1.3)));

    for (const t of this.turrets) {
      const front = t.slot === 0;
      const seat = smooth(seg(m, front ? 2.7 : 2.6, front ? 3.15 : 3.05));
      const y = mix(this.riseOf(t, m), SEAT_Y, seat);
      this.placeTurret(t, y, mix(t.rest.z, front ? -0.9 : -3.4, seat), 1, 1 - seg(m, 2.8, 3.1), m, seat > 0.99);
      t.group.rotation.z = lean;
      t.group.position.x = -(y - GROUND) * Math.sin(lean);
      t.group.position.y = GROUND + (y - GROUND) * Math.cos(lean);
    }
  }

  drift() {}

  stow() {
    super.stow();
    this.refs.flag.visible = true;
    for (const bit of this.boatBits) bit.scale.set(1, 1, 1);
    for (const t of this.turrets) t.group.rotation.z = 0;
  }
}
