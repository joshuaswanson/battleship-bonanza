import * as THREE from 'three';
import { cachedGeometry } from './toon.js';
import { HullForm, back, box, merge, mix, morphTime, seg, smooth, tube } from './hullForm.js';

const SPEC = { key: 'ski', hatch: false, jaws: false };
export const SKI_RIDE = 1.5;
const RUNNER_X = 2.7;

function runner() {
  const points = [[0, -0.1, -5], [0, -0.2, -2], [0, -0.2, 2], [0, -0.1, 3.8], [0, 0.35, 5], [0, 1, 5.6]].map(([x, y, z]) => new THREE.Vector3(x, y, z));
  return merge([new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 44, 0.17, 8, false).scale(3, 0.55, 1)]);
}

function cowl(front) {
  const half = (start) => new THREE.SphereGeometry(1, 20, 12, start, Math.PI / 2, 0, Math.PI / 2).scale(2.05, 1.4, 4.6);
  const flip = front ? 1 : -1;
  return [half(Math.PI / 2), half(0)].map((g) => (front ? g : g.scale(1, 1, 0.74).rotateY(Math.PI)).translate(0, 0.25, 0.7 * flip));
}

function buildParts() {
  const [noseLeft, noseRight] = cowl(true);
  const [tailRight, tailLeft] = cowl(false);
  return {
    blade: runner(),
    strutRight: merge([-2.6, 2.4].map((z) => box(1.9, 0.22, 0.4, -0.8, 0.28, z))),
    strutLeft: merge([-2.6, 2.4].map((z) => box(1.9, 0.22, 0.4, 0.8, 0.28, z))),
    binding: merge([-2.6, 2.4].map((z) => box(0.9, 0.2, 0.7, 0, 0.02, z))),
    noseLeft,
    noseRight,
    tailLeft,
    tailRight,
    rim: merge([new THREE.TorusGeometry(1.5, 0.11, 6, 22, Math.PI).translate(0, 0.42, 0.7), new THREE.TorusGeometry(1.5, 0.11, 6, 22, Math.PI).translate(0, 0.42, -0.72)]),
    bar: merge([tube(0.09, 1.7, 0, 0.85, 0), tube(0.09, 1.1, 0, 1.7, 0.5).rotateX(Math.PI / 2).translate(0, 1.2, 1.2)]),
    fin: merge([box(0.16, 1.5, 1.6, 0, 0.75, 0)]),
    roundel: merge([new THREE.CircleGeometry(0.62, 18).rotateX(-1.08).translate(0, 1.42, 2.72)]),
  };
}

const skiParts = () => cachedGeometry('skiParts', buildParts);

export class SkiForm extends HullForm {
  constructor(refs, color) {
    super(refs, color, SPEC);
    const P = skiParts();
    const { add, S, paint, rig } = this;
    this.runners = [1, -1].map((side) => {
      const fold = new THREE.Group();
      fold.position.set(side * 1.1, -0.2, 0);
      const arm = new THREE.Group();
      arm.position.set(side * (RUNNER_X - 1.1), -0.86, 0);
      add(P.blade, paint, 0.04, arm);
      add(P.binding, S.chrome, 0.02, arm);
      add(side > 0 ? P.strutRight : P.strutLeft, S.dark, 0.02, arm);
      fold.add(arm);
      rig.add(fold);
      return { fold, side };
    });
    this.nose = [[P.noseLeft, 1], [P.noseRight, -1]].map(([geometry, side]) => this.shellPart(geometry, side, paint, 2));
    this.tail = [[P.tailLeft, 1], [P.tailRight, -1]].map(([geometry, side]) => this.shellPart(geometry, side, S.white, 2));
    this.rim = add(P.rim, S.dark, 0.02);
    this.roundel = add(P.roundel, S.white, 0);
    this.bars = [1, -1].map((side) => {
      const bar = new THREE.Group();
      bar.position.set(side * 1.25, 0.5, -3.2);
      add(P.bar, S.metal, 0.02, bar);
      rig.add(bar);
      return { bar, side };
    });
    this.fin = add(P.fin, paint, 0.03);
    this.fin.position.set(0, 0.9, -3.4);
  }

  shellPart(geometry, side, material, reach) {
    const pivot = new THREE.Group();
    pivot.position.set(side * reach, 0.25, 0);
    const mesh = this.add(geometry, material, 0.05, pivot);
    mesh.position.set(-side * reach, -0.25, 0);
    this.rig.add(pivot);
    return { pivot, side };
  }

  set(p, roll, steer, time) {
    if (!this.enter(p)) return;
    const m = morphTime(p);
    const done = p >= 1;
    this.ride = SKI_RIDE * back(seg(m, 1.5, 2), 1.3);
    this.poseDeck(m, done, 0.4);
    this.runners.forEach(({ fold, side }, k) => {
      const out = back(seg(m, 1.1 + k * 0.06, 1.75 + k * 0.06), 1.4);
      fold.visible = out > 0.001;
      fold.rotation.z = side * mix(1.9, 0, out);
      fold.scale.setScalar(Math.max(0.001, mix(0.5, 1, out)));
    });
    this.nose.forEach(({ pivot, side }, k) => {
      const shut = back(seg(m, 1.75 + k * 0.08, 2.35 + k * 0.08), 1.3);
      pivot.visible = m > 1.7;
      pivot.rotation.z = side * mix(-2.1, 0, shut);
    });
    this.tail.forEach(({ pivot, side }, k) => {
      const shut = back(seg(m, 2.05 + k * 0.08, 2.6 + k * 0.08), 1.3);
      pivot.visible = m > 2;
      pivot.rotation.z = side * mix(-2.1, 0, shut);
    });
    this.rim.visible = m > 2.3;
    this.roundel.scale.setScalar(Math.max(0.001, back(seg(m, 2.5, 2.8), 2)));
    for (const { bar, side } of this.bars) {
      bar.rotation.x = mix(-1.5, 0, back(seg(m, 2.3, 2.75), 1.6));
      bar.scale.setScalar(Math.max(0.001, back(seg(m, 2.2, 2.5), 1.6)));
      bar.visible = m > 2.2;
      bar.position.x = side * 1.25;
    }
    this.fin.scale.y = Math.max(0.001, back(seg(m, 2.6, 3), 2));
    this.motor.rotation.x = back(seg(m, 1.6, 2.2), 1.2) * 1.7;
    this.leg.scale.y = mix(1, 0.1, seg(m, 1.9, 2.3));
    this.motor.scale.setScalar(Math.max(0.001, 1 - seg(m, 2.3, 2.7)));
    this.mountPart.visible = m < 2.7;
    this.pole.scale.setScalar(Math.max(0.001, 1 - seg(m, 2.05, 2.35)));
    this.refs.flag.visible = m < 2.3;
    for (const t of this.turrets) {
      const front = t.slot === 0;
      const seat = smooth(seg(m, front ? 2.75 : 2.65, front ? 3.2 : 3.1));
      this.placeTurret(t, mix(this.riseOf(t, m), front ? 1.72 : 1.36, seat), mix(t.rest.z, front ? 1.3 : -2, seat), 0.85, 1, m, seat > 0.99);
    }
  }
}
