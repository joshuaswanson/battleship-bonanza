import * as THREE from 'three';
import { HULL_L } from './boatModel.js';
import { cachedGeometry } from './toon.js';
import { HullForm, back, box, merge, mix, morphTime, seg, sideways, smooth, tube } from './hullForm.js';

const SPEC = { key: 'heli', doors: [{ z0: -2.9, z1: 1.1 }] };
const ROTOR_BLADES = 4;
const ROTOR_RADIUS = 7;
const BOOM_LENGTH = 7.4;
const MAST = 3.7;
const STRUT_LENGTH = 2;
const STRUT_LEAN = 0.73;
const STUB_Y = 1.4;
const STUB_X = 2.4;
const WEAPON_SCALE = 0.62;

function skid() {
  const points = [[0, -0.1, -3.8], [0, -0.1, 2.6], [0, 0.1, 3.6], [0, 0.55, 4.2]].map(([x, y, z]) => new THREE.Vector3(x, y, z));
  return merge([new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 28, 0.13, 8, false), box(0.16, 0.2, 1, 0, -0.14, 0)]);
}

function strut(side) {
  return merge([-2.2, 1.8].map((z) => box(0.18, STRUT_LENGTH, 0.22, 0, 0, 0).rotateZ(side * STRUT_LEAN).translate(-side * 0.6, 0.66, z)));
}

function buildParts() {
  const tailBlade = (k) => box(0.1, 2.5, 0.26, 0, 0, 0).rotateX((k * Math.PI) / 2);
  return {
    skid: skid(),
    strutLeft: strut(1),
    strutRight: strut(-1),
    hump: merge([box(1.5, 0.8, 2.8, 0, 0.4, 0)]),
    intake: merge([box(1.16, 0.34, 0.1, 0, 0.42, 1.42), box(1.2, 0.1, 1.5, 0, 0.84, -0.5)]),
    mast: merge([tube(0.2, MAST, 0, MAST / 2, 0)]),
    mastCowl: merge([tube(0.6, 1.5, 0, 0.75, 0, 0.24)]),
    stub: merge([box(1.9, 0.16, 1, 0, 0, 0), box(0.28, 0.5, 0.5, 0.75, 0.24, 0)]),
    hub: merge([tube(0.46, 0.36, 0, 0, 0), tube(0.2, 0.3, 0, 0.3, 0)]),
    blade: merge([box(0.56, 0.07, ROTOR_RADIUS - 0.4, 0, 0, ROTOR_RADIUS / 2 + 0.2)]),
    bladeTip: merge([box(0.58, 0.09, 0.9, 0, 0, ROTOR_RADIUS - 0.35)]),
    disc: new THREE.CircleGeometry(ROTOR_RADIUS, 40).rotateX(-Math.PI / 2),
    boom: merge([tube(0.62, BOOM_LENGTH, 0, 0, 0, 0.24).rotateX(-Math.PI / 2).translate(0, 0, -BOOM_LENGTH / 2)]),
    boomBand: merge([new THREE.TorusGeometry(0.52, 0.07, 6, 18).translate(0, 0, -2.6), new THREE.TorusGeometry(0.42, 0.07, 6, 18).translate(0, 0, -4.4)]),
    fin: merge([box(0.16, 2.3, 1.1, 0, 1, 0).rotateX(-0.32), box(0.18, 0.5, 1.1, 0, 1.92, -0.56).rotateX(-0.32)]),
    stab: merge([box(3.2, 0.12, 0.8, 0, 0, 0)]),
    tailHub: merge([sideways(tube(0.17, 0.5, 0, 0, 0))]),
    tailBlades: merge([0, 1].map(tailBlade)),
    canopy: merge([new THREE.SphereGeometry(1, 18, 12).scale(1.3, 1.1, 1.85)]),
    canopyFrame: merge([new THREE.TorusGeometry(1.2, 0.09, 6, 22, Math.PI).scale(1, 0.92, 1), box(0.14, 0.14, 3.3, 0, 1.05, 0)]),
  };
}

const heliParts = () => cachedGeometry('heliParts', buildParts);
const blur = () => cachedGeometry('heliBlur', () => new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }));

export class HeliForm extends HullForm {
  constructor(refs, color) {
    super(refs, color, SPEC);
    const P = heliParts();
    const { add, S, paint, rig } = this;
    this.pitch = 0.14;
    this.skids = [1, -1].map((side) => {
      const fold = new THREE.Group();
      fold.position.set(side * 1.4, -0.5, 0);
      const arm = new THREE.Group();
      arm.position.set(side * 1, -1.2, 0);
      add(P.skid, S.dark, 0.03, arm);
      add(side > 0 ? P.strutLeft : P.strutRight, S.metal, 0.02, arm);
      fold.add(arm);
      rig.add(fold);
      return { fold, side };
    });
    this.hump = new THREE.Group();
    this.hump.position.set(0, 0.62, -0.9);
    add(P.hump, paint, 0.04, this.hump);
    add(P.intake, S.dark, 0.02, this.hump);
    rig.add(this.hump);
    this.mast = new THREE.Group();
    this.mast.position.set(0, 0.9, -0.4);
    add(P.mast, S.dark, 0.02, this.mast);
    add(P.mastCowl, paint, 0.03, this.mast);
    this.rotor = new THREE.Group();
    this.rotor.position.y = MAST + 0.02;
    add(P.hub, S.metal, 0.03, this.rotor);
    this.blades = Array.from({ length: ROTOR_BLADES }, (_, k) => {
      const blade = new THREE.Group();
      blade.position.y = 0.16;
      add(P.blade, S.dark, 0.03, blade);
      add(P.bladeTip, S.white, 0, blade);
      this.rotor.add(blade);
      return { blade, k };
    });
    this.disc = new THREE.Mesh(P.disc, blur());
    this.disc.position.y = 0.16;
    this.rotor.add(this.disc);
    this.mast.add(this.rotor);
    rig.add(this.mast);
    this.boom = new THREE.Group();
    this.boom.position.set(0, 0.5, -HULL_L + 1.2);
    add(P.boom, paint, 0.04, this.boom);
    add(P.boomBand, S.white, 0.02, this.boom);
    this.tail = new THREE.Group();
    this.tail.position.z = -BOOM_LENGTH + 0.3;
    add(P.fin, paint, 0.03, this.tail);
    add(P.stab, S.white, 0.03, this.tail);
    add(P.tailHub, S.metal, 0.02, this.tail).position.set(0.34, 1.05, -0.3);
    this.tailRotor = add(P.tailBlades, S.dark, 0.02, this.tail);
    this.tailRotor.position.set(0.56, 1.05, -0.3);
    this.boom.add(this.tail);
    rig.add(this.boom);
    this.stubs = [1, -1].map((side) => {
      const stub = new THREE.Group();
      stub.scale.x = side;
      stub.position.set(side * (STUB_X - 0.75), STUB_Y - 0.5, -0.2);
      add(P.stub, S.dark, 0.03, stub);
      rig.add(stub);
      return stub;
    });
    this.canopy = new THREE.Group();
    this.canopy.position.set(0, 0.82, 2.5);
    add(P.canopy, S.glass, 0.04, this.canopy);
    add(P.canopyFrame, S.dark, 0.02, this.canopy);
    rig.add(this.canopy);
  }

  set(p, roll, steer, time) {
    if (!this.enter(p)) return;
    const m = morphTime(p);
    const done = p >= 1;
    const t = time ?? 0;
    for (const door of this.doors) {
      const delay = door.side > 0 ? 0 : 0.05;
      door.pivot.quaternion.setFromAxisAngle(door.axis, 2.4 * (back(seg(m, 0.55 + delay, 0.9 + delay), 2.4) - back(seg(m, 2.75 + delay, 3.1 + delay), 1.4)));
    }
    this.poseDeck(m, done);
    const stretch = back(seg(m, 1, 1.75), 1.2);
    this.boom.visible = m > 0.95;
    this.boom.scale.set(mix(0.6, 1, stretch), mix(0.6, 1, stretch), Math.max(0.03, stretch));
    this.tail.scale.setScalar(Math.max(0.001, back(seg(m, 1.7, 2.15), 1.8)));
    this.skids.forEach(({ fold, side }, k) => {
      const out = back(seg(m, 1.3 + k * 0.06, 1.85 + k * 0.06), 1.5);
      fold.visible = out > 0.001;
      fold.rotation.z = side * mix(1.8, 0, out);
    });
    const rise = back(seg(m, 1.6, 2.2), 1.5);
    this.mast.visible = m > 1.55;
    this.mast.scale.y = Math.max(0.001, rise);
    this.hump.scale.setScalar(Math.max(0.001, back(seg(m, 1.9, 2.3), 1.6)));
    const open = back(seg(m, 2.1, 2.7), 1.3);
    for (const { blade, k } of this.blades) blade.rotation.y = (k * Math.PI * 2 * open) / ROTOR_BLADES;
    const spin = seg(m, 2.5, 3.2);
    this.spin = (this.spin ?? 0) + spin * spin * 0.62;
    this.rotor.rotation.y = this.spin;
    this.tailRotor.rotation.x = this.spin * 1.6;
    this.disc.visible = spin > 0.7;
    for (const stub of this.stubs) stub.scale.set(stub.scale.x < 0 ? -Math.max(0.001, back(seg(m, 2.4, 2.75), 1.6)) : Math.max(0.001, back(seg(m, 2.4, 2.75), 1.6)), 1, 1);
    this.canopy.visible = m > 2.15;
    this.canopy.scale.setScalar(Math.max(0.001, back(seg(m, 2.2, 2.7), 1.7)));
    this.refs.flag.visible = m < 2.3;
    this.pole.scale.setScalar(Math.max(0.001, 1 - seg(m, 2.05, 2.35)));
    this.motor.rotation.x = back(seg(m, 1.5, 2.1), 1.2) * 1.65;
    this.leg.scale.y = mix(1, 0.2, seg(m, 1.7, 2.1));
    this.motor.scale.setScalar(Math.max(0.001, 1 - seg(m, 2, 2.4)));
    this.motor.visible = m < 2.4;
    this.mountPart.visible = m < 2.4;
    for (const turret of this.turrets) {
      const front = turret.slot === 0;
      const go = smooth(seg(m, front ? 2.7 : 2.8, front ? 3.3 : 3.2));
      this.placeTurret(turret, mix(this.riseOf(turret, m), STUB_Y, go), mix(turret.rest.z, -0.2, go), mix(1, WEAPON_SCALE, go), 1 - seg(m, 2.85, 3.15), m, done);
      turret.group.position.x = (front ? 1 : -1) * STUB_X * go;
    }
  }

  stow() {
    super.stow();
    this.refs.flag.visible = true;
  }
}
