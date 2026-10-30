import * as THREE from 'three';
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

function plate(points, thick, x) {
  const shape = new THREE.Shape();
  points.forEach(([z, y], k) => (k ? shape.lineTo(z, y) : shape.moveTo(z, y)));
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 1 }).rotateY(-Math.PI / 2).translate(x + thick / 2, 0, 0);
}

function sprocket() {
  const teeth = Array.from({ length: 10 }, (_, k) => box(0.3, 0.3, 0.3, 0, 0.86, 0).rotateX((k / 10) * Math.PI * 2));
  return merge([sideways(tube(0.74, 0.46, 0, 0, 0)), ...teeth]);
}

function buildParts() {
  const turretBody = new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.95, 1.05, 2.5);
  const bustle = box(2.4, 0.66, 0.8, 0, 0.33, -2.15);
  return {
    link: new THREE.BoxGeometry(1.15, 0.2, 0.5),
    wheel: merge([sideways(tube(0.62, 0.5, 0, 0, 0))]),
    hub: merge([sideways(tube(0.26, 0.56, 0, 0, 0))]),
    sprocket: sprocket(),
    roller: merge([sideways(tube(0.24, 0.42, 0, 0, 0))]),
    fender: merge([box(1.42, 0.1, TRACK_LENGTH + 2.2, 0, TRACK_R + 0.3, 0)]),
    glacis: merge([plate([[1.2, 0.2], [5.3, -0.75], [5.3, -0.5], [1.2, 1.2]], 3.9, 0)]),
    bowTrim: merge([box(3.9, 0.22, 0.2, 0, -0.45, 5.34), box(0.5, 0.4, 0.5, 1.4, 0.05, 3.9), box(0.5, 0.4, 0.5, -1.4, 0.05, 3.9)]),
    upperHull: merge([box(3.9, 0.82, 6.3, 0, 0.8, -1.75)]),
    engineDeck: merge([box(3.1, 0.1, 1.7, 0, 1.26, -3.8), ...[-1, -0.5, 0, 0.5, 1].map((x) => box(0.16, 0.14, 1.5, x, 1.32, -3.8))]),
    rearPlate: merge([box(3.9, 1.3, 0.2, 0, 0.5, -4.92)]),
    mufflers: merge([-1, 1].map((x) => sideways(tube(0.24, 1.1, 0, 0, 0)).translate(x, 0.3, -5.16))),
    turret: merge([turretBody, bustle]),
    ring: merge([tube(1.75, 0.22, 0, 0.1, 0)]),
    cupola: merge([tube(0.62, 0.42, 0.72, 1.24, -0.7), tube(0.66, 0.1, 0.72, 1.5, -0.7)]),
    aerial: merge([tube(0.035, 3.6, -1.1, 2.6, -1.9)]),
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
      add(P.fender, paint, 0.03, root);
      for (const end of [1, -1]) {
        const drive = new THREE.Group();
        drive.position.set(0, 0.02, (end * TRACK_LENGTH) / 2);
        add(P.sprocket, S.metal, 0.03, drive);
        add(P.hub, S.dark, 0.02, drive);
        root.add(drive);
        wheels.push(drive);
      }
      for (const z of [-2.2, 0, 2.2]) {
        const roller = add(P.roller, S.dark, 0.02, root);
        roller.position.set(0, TRACK_R - 0.3, z);
      }
      rig.add(root);
      return { root, links, wheels, side };
    });
    this.armor = new THREE.Group();
    add(P.glacis, paint, 0.05, this.armor);
    add(P.bowTrim, S.dark, 0.03, this.armor);
    add(P.upperHull, paint, 0.05, this.armor);
    add(P.engineDeck, S.dark, 0.02, this.armor);
    add(P.rearPlate, paint, 0.03, this.armor);
    add(P.mufflers, S.metal, 0.02, this.armor);
    rig.add(this.armor);
    this.turret = new THREE.Group();
    this.turret.position.set(0, 1.28, 0.2);
    add(P.ring, S.dark, 0.03, this.turret);
    add(P.turret, paint, 0.06, this.turret);
    add(P.cupola, S.dark, 0.03, this.turret);
    add(P.aerial, S.dark, 0, this.turret);
    rig.add(this.turret);
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
    this.motor.rotation.x = back(seg(m, 1.6, 2.2), 1.2) * 1.7;
    this.leg.scale.y = mix(1, 0.1, seg(m, 1.9, 2.3));
    this.motor.scale.setScalar(Math.max(0.001, 1 - seg(m, 2.3, 2.7)));
    this.mountPart.visible = m < 2.7;
    const plated = back(seg(m, 1.7, 2.3), 1.4);
    this.armor.visible = m > 1.65;
    this.armor.position.y = mix(-1.1, 0, plated);
    this.armor.scale.set(Math.max(0.001, mix(0.5, 1, plated)), 1, Math.max(0.001, plated));
    this.pole.scale.setScalar(Math.max(0.001, 1 - seg(m, 2.05, 2.35)));
    this.refs.flag.visible = m < 2.3;
    for (const t of this.turrets) {
      const front = t.slot === 0;
      const seat = smooth(seg(m, front ? 2.75 : 2.65, front ? 3.2 : 3.1));
      this.placeTurret(t, mix(this.riseOf(t, m), front ? 2.62 : 1.62, seat), mix(t.rest.z, front ? 0 : -3.5, seat), 0.72, 1, m, seat > 0.99);
    }
  }

  stow() {
    super.stow();
    this.refs.flag.visible = true;
  }
}
