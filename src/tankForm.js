import * as THREE from 'three';
import { HULL_L } from './boatModel.js';
import { cachedGeometry, toon } from './toon.js';
import { HullForm, back, box, merge, mix, morphTime, seg, sideways, smooth, tube } from './hullForm.js';

const SPEC = { key: 'tank', hatch: false, jaws: false };
export const TANK_RIDE = 1.5;
const TRACK_X = 2.9;
const TRACK_Y = -0.75;
const TRACK_LENGTH = 8;
const TRACK_R = 0.86;
const LINKS = 44;
const WHEELS = 6;
const PERIMETER = 2 * TRACK_LENGTH + 2 * Math.PI * TRACK_R;

function loopPoint(u, out) {
  let d = ((u % PERIMETER) + PERIMETER) % PERIMETER;
  const half = TRACK_LENGTH / 2;
  if (d < TRACK_LENGTH) return out.set(half - d, TRACK_R, 0);
  d -= TRACK_LENGTH;
  if (d < Math.PI * TRACK_R) {
    const a = d / TRACK_R;
    return out.set(-half - Math.sin(a) * TRACK_R, Math.cos(a) * TRACK_R, a);
  }
  d -= Math.PI * TRACK_R;
  if (d < TRACK_LENGTH) return out.set(-half + d, -TRACK_R, Math.PI);
  d -= TRACK_LENGTH;
  const a = d / TRACK_R;
  return out.set(half + Math.sin(a) * TRACK_R, -Math.cos(a) * TRACK_R, Math.PI + a);
}

function buildParts() {
  return {
    link: new THREE.BoxGeometry(1.15, 0.2, 0.5),
    wheel: merge([sideways(tube(0.62, 0.5, 0, 0, 0))]),
    hub: merge([sideways(tube(0.26, 0.56, 0, 0, 0))]),
    fender: merge([box(1.5, 0.14, TRACK_LENGTH + 2.4, 0, TRACK_R + 0.34, 0)]),
    skirt: merge([box(0.12, 0.8, TRACK_LENGTH + 1, 0.74, 0.5, 0)]),
    turret: merge([box(3.1, 1.1, 3.4, 0, 0.55, 0), box(2.3, 0.5, 2.4, 0, 1.25, -0.1)]),
    mantlet: merge([box(1.5, 0.8, 0.6, 0, 0.6, 1.9)]),
    barrel: merge([tube(0.2, 5.4, 0, 2.7, 0, 0.17).rotateX(Math.PI / 2)]),
    brake: merge([tube(0.3, 0.7, 0, 0, 0).rotateX(Math.PI / 2).translate(0, 0, 5.4)]),
    hatch: merge([tube(0.5, 0.2, 0.7, 1.6, -0.5)]),
    exhaust: merge([box(1.6, 0.5, 1, -0.9, 0, 0), box(1.6, 0.5, 1, 0.9, 0, 0)]),
  };
}

const tankParts = () => cachedGeometry('tankParts', buildParts);
const linkMaterial = () => cachedGeometry('tankLink', () => toon(0x33373c));

export class TankForm extends HullForm {
  constructor(refs, color) {
    super(refs, color, SPEC);
    const P = tankParts();
    const { add, S, paint, rig } = this;
    this.tracks = [1, -1].map((side) => {
      const root = new THREE.Group();
      const links = new THREE.InstancedMesh(P.link, linkMaterial(), LINKS);
      links.frustumCulled = false;
      root.add(links);
      const wheels = Array.from({ length: WHEELS }, (_, k) => {
        const wheel = new THREE.Group();
        wheel.position.set(0, -0.08, -TRACK_LENGTH / 2 + (k * TRACK_LENGTH) / (WHEELS - 1));
        add(P.wheel, S.dark, 0.02, wheel);
        add(P.hub, S.metal, 0.02, wheel);
        root.add(wheel);
        return wheel;
      });
      const fender = add(P.fender, paint, 0.03, root);
      fender.scale.x = 1;
      const skirt = add(P.skirt, paint, 0.03, root);
      skirt.scale.x = side;
      rig.add(root);
      return { root, links, wheels, side };
    });
    this.turret = new THREE.Group();
    this.turret.position.set(0, 0.92, -0.2);
    add(P.turret, paint, 0.05, this.turret);
    add(P.mantlet, S.dark, 0.03, this.turret);
    add(P.hatch, S.dark, 0.02, this.turret);
    this.barrel = new THREE.Group();
    this.barrel.position.set(0, 0.62, 2.1);
    add(P.barrel, S.dark, 0.03, this.barrel);
    add(P.brake, S.metal, 0.03, this.barrel);
    this.turret.add(this.barrel);
    rig.add(this.turret);
    this.exhaust = add(P.exhaust, S.dark, 0.02);
    this.exhaust.position.set(0, 0.95, -HULL_L + 0.8);
    this.dummy = new THREE.Object3D();
    this.spot = new THREE.Vector3();
  }

  spinTracks(roll) {
    const { dummy, spot } = this;
    for (const { links, wheels } of this.tracks) {
      for (let k = 0; k < LINKS; k++) {
        loopPoint((k / LINKS) * PERIMETER + roll, spot);
        dummy.position.set(0, spot.y, spot.x);
        dummy.rotation.x = spot.z;
        dummy.updateMatrix();
        links.setMatrixAt(k, dummy.matrix);
      }
      links.instanceMatrix.needsUpdate = true;
      for (const wheel of wheels) wheel.rotation.x = roll / 0.62;
    }
  }

  set(p, roll, steer) {
    if (!this.enter(p)) return;
    const m = morphTime(p);
    const done = p >= 1;
    this.ride = TANK_RIDE * back(seg(m, 1.5, 2), 1.3);
    this.poseDeck(m, done, 0.4);
    this.tracks.forEach(({ root, side }, k) => {
      const out = back(seg(m, 1.1 + k * 0.06, 1.8 + k * 0.06), 1.3);
      root.visible = m > 1.05;
      root.position.set(side * mix(1.1, TRACK_X, out), mix(0.3, TRACK_Y, out), 0);
      root.scale.set(1, Math.max(0.001, mix(0.3, 1, out)), Math.max(0.001, mix(0.5, 1, out)));
    });
    this.spinTracks(-roll);
    const rise = back(seg(m, 1.9, 2.4), 1.4);
    this.turret.visible = m > 1.85;
    this.turret.scale.setScalar(Math.max(0.001, mix(0.4, 1, rise)));
    this.turret.rotation.y = steer * 0.25;
    this.barrel.scale.z = Math.max(0.001, back(seg(m, 2.35, 2.9), 1.5));
    this.motor.rotation.x = back(seg(m, 1.6, 2.2), 1.2) * 1.7;
    this.leg.scale.y = mix(1, 0.1, seg(m, 1.9, 2.3));
    this.motor.scale.setScalar(Math.max(0.001, 1 - seg(m, 2.3, 2.7)));
    this.mountPart.visible = m < 2.7;
    this.exhaust.scale.setScalar(Math.max(0.001, back(seg(m, 2.6, 2.95), 1.8)));
    this.pole.scale.setScalar(Math.max(0.001, 1 - seg(m, 2.05, 2.35)));
    this.refs.flag.visible = m < 2.3;
    for (const t of this.turrets) {
      const front = t.slot === 0;
      const seat = smooth(seg(m, front ? 2.75 : 2.65, front ? 3.2 : 3.1));
      this.placeTurret(t, mix(this.riseOf(t, m), front ? 2.75 : 1.55, seat), mix(t.rest.z, front ? -0.4 : -3.1, seat), 0.8, 1, m, seat > 0.99);
    }
  }

  stow() {
    super.stow();
    this.refs.flag.visible = true;
  }
}
