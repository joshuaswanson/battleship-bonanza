import * as THREE from 'three';
import { HULL_L, halfWidth } from './boatModel.js';
import { cachedGeometry, toon, glow } from './toon.js';
import { BOW_CUT, HullForm, back, box, deckPoint, hullAt, merge, mix, morphTime, sectionShape, seg, sideways, smooth, tube } from './hullForm.js';

const SPEC = { key: 'cart', hatch: false, jaws: true, teeth: false };
export const CART_RIDE = 1.27;
const WHEEL_X = 2.2;
const WHEEL_Z = [2.1, -2.6];
const BANDS = [-3.5, -1.5, 0.5, 2.4];

function seeded(seed) {
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
}

function buildParts() {
  const bands = BANDS.map((z) => {
    const pts = [];
    for (let k = 0; k <= 26; k++) pts.push(hullAt(z, -1 + k / 13));
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 36, 0.1, 6, false);
  });
  const rivets = [];
  for (const z of BANDS) for (let k = 3; k < 26; k += 4) {
    const p = hullAt(z, -1 + k / 13);
    rivets.push(new THREE.SphereGeometry(0.1, 6, 4).translate(p.x * 1.03, p.y - 0.02, z + 0.02));
  }
  const r = seeded(77);
  const lumps = [[], [], []];
  for (let k = 0; k < 54; k++) {
    const z = -3.5 + r() * 5.9;
    const w = halfWidth(Math.max(z, 0)) * 0.84;
    const x = (r() * 2 - 1) * w;
    const crest = 1 - (x / w) ** 2;
    const size = 0.22 + r() * 0.34;
    lumps[k % 3].push(new THREE.IcosahedronGeometry(size, 0).rotateX(r() * 3).rotateY(r() * 3).translate(x, 0.06 + crest * 0.42 * r() + size * 0.3, z));
  }
  const spokes = Array.from({ length: 6 }, (_, k) => box(0.46, 0.8, 0.14, 0, 0.5, 0).rotateX((k / 6) * Math.PI * 2));
  return {
    bands: merge(bands),
    rivets: merge(rivets),
    ore: lumps.map((list) => merge(list)),
    frontPlate: new THREE.ExtrudeGeometry(sectionShape(BOW_CUT), { depth: 0.16, bevelEnabled: false }),
    frontIron: merge([box(3, 0.14, 0.12, 0, -0.2, 0.2), box(3, 0.14, 0.12, 0, 0.5, 0.2), box(0.14, 1.9, 0.12, -1.1, 0.1, 0.2), box(0.14, 1.9, 0.12, 1.1, 0.1, 0.2)]),
    hook: merge([tube(0.13, 0.9, 0, 0, 0).rotateX(Math.PI / 2).translate(0, 0, 0.45), new THREE.TorusGeometry(0.24, 0.07, 6, 12).translate(0, 0, 1)]),
    mast: merge([tube(0.07, 1.4, 0, 0.7, 0), box(0.56, 0.7, 0.56, 0, 1.6, 0), tube(0.34, 0.12, 0, 2, 0, 0.1)]),
    lamp: new THREE.BoxGeometry(0.62, 0.5, 0.62).translate(0, 1.6, 0),
    tire: merge([sideways(tube(1, 0.36, 0, 0, 0))]),
    flange: merge([sideways(tube(1.18, 0.1, 0, 0, 0)), sideways(tube(0.72, 0.4, 0, 0, 0))]),
    hub: merge([sideways(tube(0.26, 0.5, 0, 0, 0))]),
    spokes: merge(spokes),
    axle: merge([sideways(tube(0.13, 4.4, 0, 0, 0))]),
    tail: box(0.5, 0.3, 0.14, 0, 0.9, -0.08),
    rearHook: merge([tube(0.13, 0.9, 0, 0, 0).rotateX(Math.PI / 2).translate(0, 0, -0.45), new THREE.TorusGeometry(0.24, 0.07, 6, 12).translate(0, 0, -1)]),
  };
}

const cartParts = () => cachedGeometry('cartParts', buildParts);
const lanternBeam = () => cachedGeometry('cartBeam', () => new THREE.ConeGeometry(2.6, 20, 16, 1, true).rotateX(-Math.PI / 2).translate(0, 1.6, 10));
const beamMaterial = () => cachedGeometry('cartBeamMat', () => new THREE.MeshBasicMaterial({ color: 0xfff0b0, transparent: true, opacity: 0.07, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));

export class CartForm extends HullForm {
  constructor(refs, color) {
    super(refs, color, SPEC);
    const P = cartParts();
    const { add, S, paint, rig } = this;
    this.bands = add(P.bands, S.dark, 0.03);
    this.rivets = add(P.rivets, S.metal, 0);
    this.front = new THREE.Group();
    this.front.position.z = BOW_CUT - 1.2;
    add(P.frontPlate, paint, 0.05, this.front);
    add(P.frontIron, S.dark, 0.02, this.front);
    this.hook = add(P.hook, S.metal, 0.02, this.front);
    this.hook.position.y = -0.1;
    this.mast = new THREE.Group();
    this.mast.position.set(0, 0.9, 0.1);
    add(P.mast, S.dark, 0.02, this.mast);
    this.mast.add(new THREE.Mesh(P.lamp, S.head));
    this.beam = new THREE.Mesh(lanternBeam(), beamMaterial());
    this.mast.add(this.beam);
    this.front.add(this.mast);
    rig.add(this.front);
    this.rear = new THREE.Group();
    this.rear.position.set(0, 0.2, -HULL_L - 0.05);
    add(P.rearHook, S.metal, 0.02, this.rear);
    this.rear.add(new THREE.Mesh(P.tail, S.tail));
    rig.add(this.rear);
    this.ore = new THREE.Group();
    this.ore.position.y = 0.92;
    const tones = [toon(0xffc62e), toon(0xffe48a), toon(0x8a7a66)];
    P.ore.forEach((g, k) => this.ore.add(new THREE.Mesh(g, tones[k])));
    rig.add(this.ore);
    this.wheels = [];
    for (const z of WHEEL_Z) {
      for (const side of [1, -1]) {
        const root = new THREE.Group();
        const spin = new THREE.Group();
        root.add(spin);
        add(P.tire, S.dark, 0.05, spin);
        add(P.flange, S.metal, 0.03, spin);
        add(P.hub, paint, 0.03, spin);
        add(P.spokes, S.dark, 0.02, spin);
        rig.add(root);
        this.wheels.push({ root, spin, z, side, delay: (z > 0 ? 0 : 0.1) + (side > 0 ? 0 : 0.05) });
      }
      const axle = add(P.axle, S.metal, 0.02);
      axle.position.set(0, -0.62, z);
      this.wheels.at(-1).axle = axle;
    }
  }

  set(p, roll, steer, time) {
    if (!this.enter(p)) return;
    const m = morphTime(p);
    const done = p >= 1;
    this.ride = CART_RIDE * back(seg(m, 1.5, 2), 1.3);
    this.poseDeck(m, done, 0.4);
    for (const jaw of this.jaws) jaw.pivot.rotation.y = jaw.side * back(seg(m, 0.7, 1.35), 1.1) * 2.95;
    this.front.position.z = mix(BOW_CUT - 1.2, BOW_CUT - 0.02, back(seg(m, 0.95, 1.4), 1.8));
    this.front.visible = m > 0.8;
    this.mast.scale.setScalar(Math.max(0.001, back(seg(m, 2.5, 2.9), 2.2)));
    this.hook.scale.setScalar(Math.max(0.001, back(seg(m, 2.3, 2.6), 2)));
    this.motor.rotation.x = back(seg(m, 1.6, 2.2), 1.2) * 1.7;
    this.leg.scale.y = mix(1, 0.1, seg(m, 1.9, 2.3));
    this.motor.scale.setScalar(Math.max(0.001, 1 - seg(m, 2.4, 2.75)));
    this.mountPart.visible = m < 2.75;
    this.rear.scale.setScalar(Math.max(0.001, back(seg(m, 2.6, 2.95), 2)));
    const grow = mix(0.8, 1, back(seg(m, 1.3, 1.9), 1.6));
    for (const part of [this.bands, this.rivets]) {
      part.scale.set(grow, grow, 1);
      part.visible = m > 1.25;
    }
    for (const w of this.wheels) {
      const out = back(seg(m, 1.15 + w.delay, 1.7 + w.delay), 1.5);
      w.root.visible = out > 0.001;
      w.root.position.set(w.side * mix(0.5, WHEEL_X, out), mix(0.2, -0.62, out), w.z);
      w.root.scale.setScalar(Math.max(0.001, mix(0.3, 1, out)));
      w.spin.rotation.x = roll + seg(m, 1.6, 2.6) * (time ?? 0) * 16 * (done ? 0 : 1);
      if (w.axle) w.axle.visible = out > 0.4;
    }
    const pile = back(seg(m, 2.25, 2.95), 1.8);
    this.ore.scale.set(Math.max(0.001, pile), Math.max(0.001, pile), Math.max(0.001, pile));
    for (const t of this.turrets) {
      const front = t.slot === 0;
      const seat = smooth(seg(m, front ? 2.75 : 2.65, front ? 3.2 : 3.1));
      this.placeTurret(t, mix(this.riseOf(t, m), 1.75, seat), mix(t.rest.z, front ? 1.1 : -2.5, seat), 0.9, 1, m, seat > 0.99);
    }
    this.refs.flag.visible = true;
  }

  light(amount) {
    this.beam.visible = amount > 0.05;
  }
}
