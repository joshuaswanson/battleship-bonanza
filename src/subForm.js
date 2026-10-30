import * as THREE from 'three';
import { HULL_L } from './boatModel.js';
import { cachedGeometry, glow } from './toon.js';
import { BOW_CUT, HullForm, back, box, deckPoint, merge, mix, morphTime, seg, smooth, tube } from './hullForm.js';

const SPEC = { key: 'sub', hatch: true, jaws: true };

function buildParts() {
  const bands = [-2.4, 2.4].map((z) => new THREE.TorusGeometry(0.93, 0.07, 6, 22).translate(0, 0, z));
  const beam = new THREE.ConeGeometry(2.2, 22, 16, 1, true).rotateX(-Math.PI / 2).translate(0, 0, 11);
  return {
    tank: merge([new THREE.CapsuleGeometry(0.92, 5.6, 4, 14).rotateX(Math.PI / 2)]),
    tankBand: merge([...bands, tube(0.2, 0.12, 0, 0.9, -1.2), tube(0.2, 0.12, 0, 0.9, 1.2)]),
    tankStripe: merge([new THREE.TorusGeometry(0.93, 0.07, 6, 22)]),
    tower: merge([box(1.6, 2.1, 2.9, 0, 1.05, 0)]),
    towerTop: merge([box(1.72, 0.26, 3.02, 0, 2.02, 0)]),
    towerDark: merge([box(1.2, 0.3, 1.5, 0, 2.3, -0.2), box(1, 0.1, 0.8, 1.2, 1.55, 0.4), box(1, 0.1, 0.8, -1.2, 1.55, 0.4)]),
    ports: merge([-1, 1].flatMap((side) => [-0.8, 0, 0.8].map((z) => new THREE.CircleGeometry(0.16, 10).rotateY((side * Math.PI) / 2).translate(side * 0.83, 1.2, z)))),
    scope: merge([tube(0.09, 1.9, 0, 0.95, 0), box(0.24, 0.3, 0.5, 0, 1.95, 0.08)]),
    dome: new THREE.SphereGeometry(0.98, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2),
    domeRim: merge([new THREE.TorusGeometry(0.98, 0.11, 6, 24)]),
    panel: merge([box(1.3, 0.8, 0.3, 0, -0.1, 0.05)]),
    lamp: merge([tube(0.26, 0.4, 0, 0, 0).rotateX(Math.PI / 2)]),
    lens: merge([new THREE.CircleGeometry(0.21, 12).translate(0, 0, 0.21)]),
    beam,
    shroud: merge([new THREE.TorusGeometry(1.3, 0.17, 6, 28)]),
    shroudArms: merge([0, 1, 2, 3].map((k) => box(0.08, 1.3, 0.2, 0, 0.65, 0).rotateZ((k / 4) * Math.PI * 2 + Math.PI / 4))),
    hub: merge([tube(0.22, 0.5, 0, 0, 0, 0.14).rotateX(-Math.PI / 2)]),
    blades: merge(Array.from({ length: 6 }, (_, k) => box(0.42, 0.95, 0.05, 0, 0.62, 0).rotateY(0.6).rotateZ((k / 6) * Math.PI * 2))),
    rudders: merge([0, 1, 2, 3].map((k) => box(0.12, 1.25, 1, 0, 0.72, 0).rotateZ((k / 4) * Math.PI * 2))),
    rudderTips: merge([0, 1, 2, 3].map((k) => box(0.14, 0.2, 1.02, 0, 1.12, 0).rotateZ((k / 4) * Math.PI * 2))),
    taper: merge([tube(1, 2.1, 0, 0, 0, 0.28).rotateX(-Math.PI / 2)]),
    plane: merge([box(1.7, 0.14, 0.9, 0, 0, 0)]),
  };
}

const subParts = () => cachedGeometry('subParts', buildParts);
const glows = () =>
  cachedGeometry('subGlows', () => ({
    dome: new THREE.MeshBasicMaterial({ color: 0x6fe3ea, transparent: true, opacity: 0.42, side: THREE.DoubleSide, depthWrite: false }),
    beam: new THREE.MeshBasicMaterial({ color: 0xfff0b0, transparent: true, opacity: 0.05, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }),
    red: glow(0xff3a30),
  }));

export class SubForm extends HullForm {
  constructor(refs, color) {
    super(refs, color, SPEC);
    const P = subParts();
    const G = glows();
    const { add, S, paint, rig } = this;
    this.tanks = [1, -1].map((side) => {
      const g = new THREE.Group();
      add(P.tank, paint, 0.05, g);
      add(P.tankBand, S.dark, 0.02, g);
      add(P.tankStripe, S.white, 0.02, g);
      rig.add(g);
      return { g, side };
    });
    this.tower = new THREE.Group();
    add(P.tower, paint, 0.05, this.tower);
    add(P.towerTop, S.white, 0.03, this.tower);
    add(P.towerDark, S.dark, 0.03, this.tower);
    this.tower.add(new THREE.Mesh(P.ports, S.head));
    this.scope = add(P.scope, S.chrome, 0.02, this.tower);
    this.scope.position.set(0, 2.2, 0.35);
    rig.add(this.tower);
    this.tower.position.z = -0.3;
    this.dome = new THREE.Group();
    this.dome.add(new THREE.Mesh(P.dome, G.dome));
    add(P.domeRim, S.chrome, 0.03, this.dome);
    add(P.panel, S.dark, 0.02, this.dome);
    this.dome.position.set(0, 0.32, BOW_CUT);
    rig.add(this.dome);
    this.lamps = [1, -1].map((side) => {
      const lamp = new THREE.Group();
      lamp.position.set(side * 1.15, -0.45, 2.6);
      add(P.lamp, S.chrome, 0.03, lamp);
      lamp.add(new THREE.Mesh(P.lens, S.head));
      const beam = new THREE.Mesh(P.beam, G.beam);
      beam.position.z = 0.2;
      lamp.add(beam);
      rig.add(lamp);
      return { lamp, beam };
    });
    this.screw = new THREE.Group();
    this.screw.position.set(0, 0.1, -HULL_L - 2);
    add(P.shroud, paint, 0.04, this.screw);
    add(P.shroudArms, S.dark, 0.02, this.screw);
    add(P.hub, S.chrome, 0.02, this.screw);
    this.blades = add(P.blades, S.metal, 0.02, this.screw);
    rig.add(this.screw);
    this.rudders = new THREE.Group();
    this.rudders.position.set(0, 0.1, -HULL_L - 1.4);
    add(P.rudders, paint, 0.03, this.rudders);
    add(P.rudderTips, S.white, 0.02, this.rudders);
    rig.add(this.rudders);
    this.taper = add(P.taper, paint, 0.05);
    this.taper.position.set(0, 0.1, -HULL_L - 0.9);
    this.planes = [1, -1].map((side) => {
      const plane = add(P.plane, S.white, 0.03);
      plane.position.set(side * 2.5, 0.05, 2.3);
      return plane;
    });
  }

  set(p, roll, steer, time) {
    if (!this.enter(p)) return;
    const m = morphTime(p);
    const done = p >= 1;
    this.poseDeck(m, done, 0.6);
    const out = back(seg(m, 1.15, 1.7), 1.5);
    for (const t of this.tanks) {
      t.g.position.set(t.side * mix(0.4, 2.3, out), mix(-0.5, -0.05, out), -0.55);
      t.g.scale.z = mix(0.6, 1, out);
      t.g.visible = m > 1.05;
    }
    const up = back(seg(m, 1.5, 2.1), 1.3);
    this.tower.position.y = mix(-1.6, 0.86, up);
    this.tower.visible = up > 0.001;
    this.scope.scale.y = Math.max(0.001, back(seg(m, 2.15, 2.5), 2));
    for (const jaw of this.jaws) {
      const open = back(seg(m, 1.95, 2.45), 1.6);
      jaw.pivot.rotation.y = jaw.side * open * 0.94;
      jaw.pivot.position.z = jaw.hinge.z - open * 1.65;
      jaw.pivot.position.x = jaw.hinge.x + jaw.side * open * 0.62;
      jaw.pivot.position.y = jaw.hinge.y - open * 0.1;
    }
    this.dome.position.z = mix(BOW_CUT - 1, BOW_CUT - 0.05, back(seg(m, 2.05, 2.55), 1.4));
    this.dome.visible = m > 1.98;
    for (const l of this.lamps) l.lamp.visible = m > 2.2;
    for (const plane of this.planes) plane.scale.x = Math.max(0.001, back(seg(m, 2.45, 2.8), 1.8));
    this.motor.rotation.x = back(seg(m, 2.1, 2.7), 1.2) * 1.65;
    this.leg.scale.y = mix(1, 0.14, seg(m, 2.3, 2.7));
    this.motor.scale.setScalar(Math.max(0.001, 1 - seg(m, 2.55, 2.85)));
    this.mountPart.visible = m < 2.85;
    this.taper.scale.setScalar(Math.max(0.001, back(seg(m, 2.35, 2.75), 1.6)));
    this.screw.scale.setScalar(Math.max(0.001, back(seg(m, 2.55, 2.95), 2)));
    this.rudders.scale.setScalar(Math.max(0.001, back(seg(m, 2.6, 3), 2)));
    this.blades.rotation.z = (time ?? 0) * 16 * seg(m, 2.95, 3.4);
    this.pole.scale.setScalar(Math.max(0.001, 1 - seg(m, 1.9, 2.2)));
    this.refs.flag.visible = m < 2.1;
    for (const t of this.turrets) {
      const front = t.slot === 0;
      const seat = smooth(seg(m, front ? 2.7 : 2.6, front ? 3.05 : 2.95));
      const z = front ? 1.75 : -2.75;
      this.placeTurret(t, mix(this.riseOf(t, m), deckPoint(z, 0).y + 0.05, seat), mix(t.rest.z, z, seat), 0.92, 1, m, seat > 0.99);
    }
  }

  stow() {
    super.stow();
    this.refs.flag.visible = true;
  }
}
