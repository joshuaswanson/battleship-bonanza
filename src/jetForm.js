import * as THREE from 'three';
import { HULL_L, sheer } from './boatModel.js';
import { cachedGeometry, glow } from './toon.js';
import { HullForm, back, box, merge, mix, morphTime, seg, smooth, tube } from './hullForm.js';

const SPEC = { key: 'jet', doors: [{ z0: -2.9, z1: 1.1 }] };
const NOZZLE_Y = sheer(-HULL_L) - 0.6;

function plate(points, thick = 0.24, lift = 0) {
  const shape = new THREE.Shape();
  points.forEach(([x, z], k) => (k ? shape.lineTo(x, -z) : shape.moveTo(x, -z)));
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 1 }).rotateX(-Math.PI / 2).translate(0, lift - thick / 2, 0);
}

function fin(points, thick = 0.18) {
  const shape = new THREE.Shape();
  points.forEach(([z, y], k) => (k ? shape.lineTo(z, y) : shape.moveTo(z, y)));
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 1 }).translate(0, 0, -thick / 2).rotateY(-Math.PI / 2);
}

const additive = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });

function buildParts() {
  const profile = [[0.42, -1.2], [0.66, -0.6], [0.7, 0.5], [0.66, 1.2], [0.5, 1.4]].map(([r, y]) => new THREE.Vector2(r, y));
  const fanBlades = Array.from({ length: 9 }, (_, k) => box(0.12, 0.46, 0.03, 0, 0.26, 0).rotateY(0.5).rotateZ((k / 9) * Math.PI * 2));
  const tipFin = fin([[-2.3, 0], [-3, 0], [-3.5, 1.4], [-3.1, 1.4]]).translate(3.3, 0, 0);
  return {
    wingPaint: merge([plate([[0, 1.6], [3.5, -0.4], [3.5, -2.3], [0, -2.5]])]),
    wingStripe: merge([plate([[0.9, 0.62], [3.5, -0.9], [3.5, -1.3], [0.9, -0.1]], 0.05, 0.17)]),
    wingFlap: merge([plate([[0, -1.9], [3.5, -1.8], [3.5, -2.3], [0, -2.5]], 0.1, 0.1)]),
    outerPaint: merge([plate([[0, -0.4], [3.3, -2.3], [3.3, -3], [0, -2.3]])]),
    outerStripe: merge([plate([[0, -0.9], [3.3, -2.55], [3.3, -2.75], [0, -1.35]], 0.05, 0.17), tipFin]),
    pod: merge([new THREE.LatheGeometry(profile, 16).rotateX(Math.PI / 2)]),
    podLip: merge([new THREE.TorusGeometry(0.58, 0.1, 6, 18).translate(0, 0, 1.4)]),
    podBand: merge([new THREE.TorusGeometry(0.71, 0.06, 6, 18).translate(0, 0, 0.1)]),
    podDark: merge([tube(0.5, 0.05, 0, 0, 0).rotateX(Math.PI / 2).translate(0, 0, 1.15), box(0.24, 0.5, 1.4, 0, 0.5, 0)]),
    fan: merge(fanBlades),
    spinner: merge([tube(0.17, 0.3, 0, 0, 0.1, 0.02).rotateX(Math.PI / 2)]),
    flame: new THREE.ConeGeometry(0.4, 3.4, 10, 1, true).rotateX(-Math.PI / 2).translate(0, 0, -2.9),
    spine: merge([box(1.5, 0.5, 5.4, 0, 0, 0)]),
    spineTop: merge([box(0.46, 0.08, 5.4, 0, 0.26, 0)]),
    canopy: merge([new THREE.SphereGeometry(1, 16, 10).scale(0.92, 0.72, 1.5)]),
    tail: merge([fin([[0.5, 0], [-1, 0], [-1.7, 2.2], [-0.9, 2.2]])]),
    tailMark: merge([fin([[-0.73, 1.2], [-1.3, 1.2], [-1.44, 1.65], [-0.92, 1.65]], 0.22)]),
    stab: merge([plate([[0, 0.3], [2, -0.9], [2, -1.3], [0, -0.9]], 0.16)]),
    nozzle: merge([tube(0.72, 1.2, 0, 0, 0, 0.6).rotateX(-Math.PI / 2).translate(0, 0, -0.5)]),
    nozzleHole: merge([new THREE.CircleGeometry(0.6, 18).rotateY(Math.PI).translate(0, 0, -1.12)]),
    burner: new THREE.ConeGeometry(0.55, 5, 12, 1, true).rotateX(-Math.PI / 2).translate(0, 0, -3.6),
    pitot: merge([tube(0.035, 1.2, 0, 0, 0).rotateX(Math.PI / 2)]),
  };
}

const jetParts = () => cachedGeometry('jetParts', buildParts);
const glows = () => cachedGeometry('jetGlows', () => ({ thrust: additive(0x7fd6ff, 0.75), burn: additive(0xff9a3c, 0.8), green: glow(0x3cff7a) }));

export class JetForm extends HullForm {
  constructor(refs, color) {
    super(refs, color, SPEC);
    const P = jetParts();
    const G = glows();
    const { add, S, paint, rig } = this;
    this.wings = [1, -1].map((side) => {
      const mirror = new THREE.Group();
      mirror.scale.x = side;
      rig.add(mirror);
      const root = new THREE.Group();
      root.position.set(1.6, 0.94, 0);
      mirror.add(root);
      add(P.wingPaint, paint, 0.04, root);
      add(P.wingStripe, S.white, 0, root);
      add(P.wingFlap, S.dark, 0, root);
      const hinge = new THREE.Group();
      hinge.position.x = 3.5;
      root.add(hinge);
      add(P.outerPaint, paint, 0.04, hinge);
      add(P.outerStripe, S.white, 0.02, hinge);
      const pod = new THREE.Group();
      pod.position.set(2.2, -0.86, -0.7);
      add(P.pod, paint, 0.04, pod);
      add(P.podLip, S.chrome, 0.02, pod);
      add(P.podBand, S.white, 0.02, pod);
      add(P.podDark, S.dark, 0.02, pod);
      const fan = new THREE.Group();
      fan.position.z = 1.22;
      add(P.fan, S.metal, 0, fan);
      add(P.spinner, paint, 0.02, fan);
      pod.add(fan);
      const flame = new THREE.Mesh(P.flame, G.thrust);
      pod.add(flame);
      root.add(pod);
      return { root, hinge, pod, fan, flame };
    });
    this.spine = new THREE.Group();
    this.spine.position.set(0, 0.5, -1.5);
    add(P.spine, paint, 0.04, this.spine);
    add(P.spineTop, S.white, 0.02, this.spine);
    rig.add(this.spine);
    this.canopy = add(P.canopy, S.glass, 0.04);
    this.canopy.position.set(0, 0.8, 2.15);
    this.tails = [1, -1].map((side) => {
      const mirror = new THREE.Group();
      mirror.scale.x = side;
      rig.add(mirror);
      const tail = new THREE.Group();
      tail.position.set(0.86, 1.02, -3.25);
      add(P.tail, paint, 0.04, tail);
      add(P.tailMark, S.white, 0, tail);
      mirror.add(tail);
      const stab = add(P.stab, paint, 0.03, mirror);
      stab.position.set(1.5, 0.6, -3.6);
      return { tail, stab };
    });
    this.nozzle = new THREE.Group();
    this.nozzle.position.set(0, NOZZLE_Y, -HULL_L);
    add(P.nozzle, S.chrome, 0.04, this.nozzle);
    add(P.nozzleHole, S.dark, 0, this.nozzle);
    this.burner = new THREE.Mesh(P.burner, G.burn);
    this.nozzle.add(this.burner);
    rig.add(this.nozzle);
    this.pitot = add(P.pitot, S.chrome, 0.015);
    this.pitot.position.set(0, sheer(HULL_L) + 0.03, HULL_L + 0.4);
    this.motorHome = this.motor.position.clone();
  }

  set(p, roll, steer, time) {
    if (!this.enter(p)) return;
    const m = morphTime(p);
    const done = p >= 1;
    for (const door of this.doors) {
      const delay = door.side > 0 ? 0 : 0.05;
      door.pivot.quaternion.setFromAxisAngle(door.axis, 2.4 * (back(seg(m, 0.55 + delay, 0.9 + delay), 2.4) - back(seg(m, 1.75, 2.15), 1.6)) * door.side);
    }
    this.poseDeck(m, done);
    this.wings.forEach((w, k) => {
      const delay = k * 0.05;
      w.root.visible = m > 0.82;
      w.root.rotation.z = mix(-Math.PI / 2 - 0.3, 0.06, back(seg(m, 0.95 + delay, 1.5 + delay), 1.5));
      w.hinge.rotation.z = mix(-3, 0, back(seg(m, 1.42 + delay, 1.95 + delay), 1.7));
      w.pod.scale.setScalar(Math.max(0.001, back(seg(m, 1.38 + delay, 1.72 + delay), 2)));
      const spin = seg(m, 1.65, 2.05);
      w.fan.rotation.z = (time ?? 0) * 44 * spin;
      w.flame.visible = spin > 0.02;
      w.flame.scale.set(1, 1, spin * (0.8 + 0.14 * Math.sin((time ?? 0) * 40)));
    });
    this.spine.position.y = mix(0.45, 1.16, back(seg(m, 1.9, 2.4), 1.4));
    this.canopy.position.y = mix(0.5, 1.3, back(seg(m, 2.15, 2.65), 1.5));
    this.canopy.visible = m > 2.1;
    this.tails.forEach((f, k) => {
      f.tail.rotation.z = mix(-1.7, -0.28, back(seg(m, 2.3 + k * 0.06, 2.8 + k * 0.06), 1.8));
      f.tail.visible = m > 2.25;
      f.stab.scale.set(Math.max(0.001, back(seg(m, 2.55, 2.95), 1.8)), 1, 1);
    });
    this.pole.scale.setScalar(Math.max(0.001, 1 - seg(m, 2.05, 2.35)));
    this.refs.flag.visible = m < 2.3;
    this.motor.rotation.x = back(seg(m, 2.05, 2.6), 1.2) * 1.65;
    this.leg.scale.y = mix(1, 0.2, seg(m, 2.3, 2.7));
    this.motor.position.z = this.motorHome.z + seg(m, 2.5, 2.9) * 1.1;
    this.motor.position.y = this.motorHome.y - seg(m, 2.5, 2.9) * 0.9;
    this.motor.visible = m < 2.95;
    this.mountPart.visible = m < 2.95;
    this.nozzle.scale.setScalar(Math.max(0.001, back(seg(m, 2.7, 3.05), 2)));
    this.burner.visible = done;
    this.burner.scale.z = 0.85 + 0.15 * Math.sin((time ?? 0) * 55);
    this.pitot.scale.set(1, 1, Math.max(0.001, seg(m, 2.9, 3.2)));
    for (const t of this.turrets) {
      const front = t.slot === 0;
      const go = smooth(seg(m, front ? 2.7 : 2.8, front ? 3.44 : 3.32));
      const y = mix(this.riseOf(t, m), 1.5, go) + (front ? Math.sin(go * Math.PI) * 0.5 : 0);
      this.placeTurret(t, y, mix(t.rest.z, front ? -0.25 : -2.75, go), 1, 1 - seg(m, 2.85, 3.15), m, done);
    }
  }

  stow() {
    super.stow();
    this.refs.flag.visible = true;
  }
}
