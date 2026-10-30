import * as THREE from 'three';
import { HULL_L, sheer } from './boatModel.js';
import { cachedGeometry } from './toon.js';
import { BOW_CUT, HullForm, back, box, deckPoint, link, merge, mix, morphTime, seg, sectionShape, sideways, smooth, tube } from './hullForm.js';

const AXLE_F = 2.25;
const AXLE_R = -3.05;
const WHEEL_R = 1.45;
const ARM = 1.6;
const ARM_FINAL = 1.35;
const SPEC = { key: 'truck', doors: [{ z0: -4, z1: -1.72 }, { z0: 1.1, z1: BOW_CUT - 0.02 }], hatch: true, jaws: true, teeth: true, bedRepeat: 2 };
export const TRUCK_RIDE = 1.51;

function buildParts() {
  const parts = {};
  parts.grilleBack = new THREE.ExtrudeGeometry(sectionShape(BOW_CUT), { depth: 0.12, bevelEnabled: false }).translate(0, 0, BOW_CUT);
  const lights = [1, -1].map((side) => tube(0.27, 0.14, 0, 0, 0).rotateX(Math.PI / 2).translate(side * 0.62, 0.72, BOW_CUT + 0.16));
  parts.grille = merge([...[0.1, 0.32, 0.54].map((y) => box(1.2, 0.1, 0.1, 0, y, BOW_CUT + 0.16)), ...lights]);
  parts.lenses = merge([1, -1].map((side) => {
    const g = new THREE.CircleGeometry(0.2, 18).toNonIndexed();
    g.deleteAttribute('uv');
    return g.translate(side * 0.62, 0.72, BOW_CUT + 0.24);
  }));

  const profile = [[0.62, -0.55], [1.2, -0.55], [1.4, -0.46], [1.45, -0.2], [1.45, 0.2], [1.4, 0.46], [1.2, 0.55], [0.62, 0.55]].map(([r, x]) => new THREE.Vector2(r, x));
  const lathe = new THREE.LatheGeometry(profile, 24).rotateZ(Math.PI / 2);
  lathe.deleteAttribute('uv');
  const knobs = Array.from({ length: 16 }, (_, k) => {
    const a = (k / 16) * Math.PI * 2;
    return box(0.5, 0.3, 0.42, 0, 0, 0).rotateX(a).translate(k % 2 ? -0.28 : 0.28, Math.cos(a) * 1.42, Math.sin(a) * 1.42);
  });
  parts.tire = merge([lathe, ...knobs]);
  parts.rim = merge([-1, 1].flatMap((side) => [sideways(tube(0.72, 0.1, 0, 0, 0)).translate(side * 0.55, 0, 0), sideways(tube(0.16, 0.14, 0, 0, 0)).translate(side * 0.72, 0, 0)]));
  parts.cap = merge([-1, 1].map((side) => sideways(tube(0.42, 0.14, 0, 0, 0)).translate(side * 0.62, 0, 0)));

  const side = new THREE.Shape();
  side.moveTo(-1.55, 0);
  side.lineTo(-1.5, 1.65);
  side.lineTo(0.25, 1.65);
  side.lineTo(0.85, 0.42);
  side.lineTo(0.88, 0);
  side.closePath();
  parts.cab = new THREE.ExtrudeGeometry(side, { depth: 2.7, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 2 }).translate(0, 0, -1.35).rotateY(-Math.PI / 2);
  const pane = new THREE.Shape();
  pane.moveTo(-1.25, 0.9);
  pane.lineTo(-1.25, 1.45);
  pane.lineTo(0.08, 1.45);
  pane.lineTo(0.4, 0.9);
  pane.closePath();
  const windshield = box(2.34, 0.06, 1.14, 0, 0, 0).rotateX(1.117).translate(0, 1.08, 0.64);
  const windows = [-1, 1].map((s) => {
    const g = new THREE.ExtrudeGeometry(pane, { depth: 0.05, bevelEnabled: false }).translate(0, 0, -0.025).rotateY(-Math.PI / 2).translate(s * 1.44, 0, 0);
    g.deleteAttribute('uv');
    return g;
  });
  parts.glass = merge([windshield, ...windows]);
  parts.roof = box(2.6, 0.16, 1.7, 0, 1.76, -0.62);
  parts.roofMount = merge([tube(0.72, 0.12, 0, 1.88, -0.62), box(1.9, 0.18, 0.24, 0, 1.95, 0.22)]);

  parts.stack = merge([tube(0.16, 2.3, 0, 1.15, 0), tube(0.16, 0.32, 0, 2.42, 0, 0.26)]);
  parts.blowerBase = box(1.2, 0.34, 1.4, 0, 0.17, 0);
  parts.blowerPipes = merge([-0.36, 0.36].map((z) => tube(0.3, 0.46, 0, 0.56, z)));
  parts.scoop = box(0.86, 0.14, 1.5, 0, 0.42, 0.02);
  parts.rail = box(0.2, 0.62, 2.4, 0, 0, 0);
  parts.railCap = box(0.26, 0.09, 2.46, 0, 0.34, 0);
  parts.tail = box(0.5, 0.26, 0.12, 0, 0, 0);
  parts.link = new THREE.CylinderGeometry(1, 1, 1, 8);
  return parts;
}

export const truckParts = () => cachedGeometry('truckParts', buildParts);

export class TruckForm extends HullForm {
  constructor(refs, color) {
    super(refs, color, SPEC);
    const P = truckParts();
    const { add, S, paint, rig } = this;
    add(P.grilleBack, S.dark, 0.03);
    add(P.grille, S.chrome, 0.02);
    rig.add(new THREE.Mesh(P.lenses, S.head));

    this.cab = new THREE.Group();
    add(P.cab, paint, 0.05, this.cab);
    add(P.glass, S.glass, 0.02, this.cab);
    add(P.roof, S.white, 0.03, this.cab);
    add(P.roofMount, S.dark, 0.03, this.cab);
    rig.add(this.cab);

    this.stacks = [1, -1].map((side) => {
      const stack = new THREE.Group();
      stack.position.set(side * 1.68, 0.2, -1.42);
      add(P.stack, S.chrome, 0.03, stack);
      rig.add(stack);
      return stack;
    });
    this.blower = new THREE.Group();
    this.blower.position.set(0, deckPoint(1.95, 0).y, 1.95);
    add(P.blowerBase, S.dark, 0.03, this.blower);
    add(P.blowerPipes, S.chrome, 0.03, this.blower);
    add(P.scoop, paint, 0.03, this.blower);
    rig.add(this.blower);

    this.rails = [1, -1].map((side) => {
      const rail = new THREE.Group();
      rail.position.set(side * 1.62, 0.7, -2.85);
      add(P.rail, paint, 0.03, rail);
      add(P.railCap, S.white, 0.02, rail);
      rig.add(rail);
      return rail;
    });
    this.tails = [1, -1].map((side) => {
      const lamp = new THREE.Mesh(P.tail, S.tail);
      lamp.position.set(side * 1.15, 0.5, -HULL_L);
      rig.add(lamp);
      return lamp;
    });

    this.wheels = [];
    for (const z of [AXLE_F, AXLE_R]) {
      for (const side of [1, -1]) {
        const knuckle = new THREE.Group();
        const steer = new THREE.Group();
        const scale = new THREE.Group();
        const spin = new THREE.Group();
        knuckle.add(steer);
        steer.add(scale);
        scale.add(spin);
        add(P.tire, S.rubber, 0.05, spin);
        add(P.rim, S.metal, 0.03, spin);
        add(P.cap, paint, 0.03, spin);
        rig.add(knuckle);
        const strut = (r, mat) => {
          const mesh = new THREE.Mesh(P.link.clone().scale(r, 1, r), mat);
          rig.add(mesh);
          return mesh;
        };
        this.wheels.push({ z, side, knuckle, steer, scale, spin, pivot: new THREE.Vector3(side * 0.75, -0.05, z), upper: strut(0.08, S.metal), lower: strut(0.1, S.dark), shock: strut(0.13, paint) });
      }
    }

    this.foot = new THREE.Vector3();
  }

  set(p, roll, steer) {
    if (!this.enter(p)) return;
    const m = morphTime(p);
    const done = p >= 1;
    this.ride = TRUCK_RIDE * back(seg(m, 1.75, 2.3), 1.1);

    for (const door of this.doors) {
      const front = door.index === 1;
      const delay = (front ? 0 : 0.08) + (door.side > 0 ? 0 : 0.05);
      const open = back(seg(m, 0.55 + delay, 0.92 + delay), 2.4);
      const settle = back(seg(m, 2.35 + delay, 2.8 + delay), 2.2);
      door.pivot.quaternion.setFromAxisAngle(door.axis, (mix(0, 2.55, open) - 0.45 * settle) * door.side);
    }
    this.poseDeck(m, done);

    const cabUp = back(seg(m, 1.95, 2.55), 1.2);
    this.cab.visible = cabUp > 0.001;
    this.cab.position.y = mix(-1.5, 0.9, cabUp);
    this.cab.scale.x = mix(0.82, 1, seg(m, 2.25, 2.5));

    for (const jaw of this.jaws) jaw.pivot.rotation.y = jaw.side * back(seg(m, 2.15, 2.62), 2.4) * 0.86;

    this.motor.rotation.x = back(seg(m, 2.35, 2.95), 1.2) * 1.68;
    this.leg.scale.y = mix(1, 0.32, seg(m, 2.7, 3.05));

    this.stacks.forEach((stack, k) => {
      const up = back(seg(m, 2.5 + k * 0.08, 2.95 + k * 0.08), 1.6);
      stack.position.y = mix(-2.2, 0.32, up);
      stack.visible = up > 0.001;
    });
    this.blower.scale.setScalar(Math.max(0.001, back(seg(m, 3.15, 3.4), 2.8)));
    for (const rail of this.rails) rail.position.y = mix(0.32, 1.12, back(seg(m, 1.9, 2.3), 1.3));
    for (const lamp of this.tails) lamp.position.z = mix(-HULL_L + 0.05, -HULL_L - 0.1, back(seg(m, 2.9, 3.15)));

    const { a, b, foot } = this;
    const wheelTurn = roll / WHEEL_R;
    for (const w of this.wheels) {
      const delay = (w.z > 0 ? 0 : 0.1) + (w.side > 0 ? 0 : 0.05);
      const swing = back(seg(m, 1.02 + delay, 1.5 + delay), 1.3);
      const shown = swing > 0.001;
      w.knuckle.visible = shown;
      w.upper.visible = w.lower.visible = w.shock.visible = shown;
      if (!shown) continue;
      const phi = mix(-0.9, ARM_FINAL, swing);
      const pop = seg(m, 1.48 + delay, 1.86 + delay);
      const s = mix(0.48, 1, back(pop, 2.6));
      foot.set(w.pivot.x + w.side * ARM * Math.sin(phi), w.pivot.y - ARM * Math.cos(phi), w.z);
      w.knuckle.position.copy(foot);
      w.knuckle.rotation.z = w.side * (phi - ARM_FINAL);
      w.steer.rotation.y = w.z > 0 ? steer : 0;
      w.scale.scale.set(mix(0.7, 1, pop), s, s);
      w.spin.rotation.x = wheelTurn;
      a.set(w.side * 0.95, 0.35, w.z + 0.3);
      b.copy(foot);
      b.x -= w.side * 0.2;
      b.y += 0.28;
      link(w.upper, a, b);
      a.set(w.side * 0.7, -0.4, w.z - 0.3);
      b.y -= 0.56;
      link(w.lower, a, b);
      a.set(w.side * 0.9, 0.82, w.z);
      b.y += 0.5;
      link(w.shock, a, b);
    }

    for (const t of this.turrets) {
      const front = t.slot === 0;
      const go = smooth(seg(m, front ? 2.75 : 2.85, front ? 3.42 : 3.32));
      const yEnd = front ? 2.86 : deckPoint(-2.8, 0).y + 0.12;
      const y = mix(this.riseOf(t, m), yEnd, go) + (front ? Math.sin(go * Math.PI) * 0.6 : 0);
      this.placeTurret(t, y, mix(t.rest.z, front ? -0.62 : -2.8, go), front ? mix(1, 0.86, go) : 1, front ? 1 - seg(m, 2.9, 3.2) : 1, m, done);
    }
  }
}
