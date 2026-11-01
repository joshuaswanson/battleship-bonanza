import * as THREE from 'three';
import { cachedGeometry, glow } from './toon.js';
import { HullForm, back, box, merge, mix, morphTime, seg, sideways, smooth, tube } from './hullForm.js';

const SPEC = { key: 'car', hatch: false, jaws: false };
export const CAR_RIDE = 0.5;
const WHEEL_X = 2.16;
const WHEEL_R = 0.74;
const WHEEL_Y = -0.1;
const WHEEL_Z = [3.05, -3.05];
const FLOOR = -0.42;
const NOSE_FROM = 1.3;
const TAIL_FROM = -1.9;

const spline = (points) => {
  const curve = new THREE.SplineCurve(points.map(([z, v]) => new THREE.Vector2(z, v)));
  const lo = points[0][0];
  const hi = points.at(-1)[0];
  const samples = Array.from({ length: 200 }, (_, k) => curve.getPoint(k / 199));
  return (z) => {
    const u = Math.min(1, Math.max(0, (z - lo) / (hi - lo)));
    const near = samples.reduce((best, p) => (Math.abs(p.x - z) < Math.abs(best.x - z) ? p : best), samples[0]);
    return u >= 1 ? samples.at(-1).y : near.y;
  };
};

const beltAt = spline([[-5, 0.8], [-4, 0.94], [-2.4, 1], [-0.6, 0.94], [1.3, 0.84], [3.2, 0.6], [4.6, 0.32], [5.5, 0.14]]);
const widthAt = spline([[-5, 1.9], [-4.2, 2.2], [-3, 2.42], [-0.8, 2.26], [1.4, 2.3], [3.2, 2.22], [4.6, 1.86], [5.5, 1.34]]);
const roofAt = spline([[-3, 1.02], [-2.2, 1.34], [-0.6, 1.66], [0.4, 1.58], [1.5, 0.92]]);
const cabinWidth = spline([[-3, 1.2], [-1, 1.66], [0.6, 1.62], [1.6, 1.5]]);

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

const span = (a, b, n) => Array.from({ length: n + 1 }, (_, k) => a + ((b - a) * k) / n);

function bodySection(z) {
  const w = widthAt(z);
  const belt = beltAt(z);
  const points = [];
  for (let k = 0; k <= 18; k++) {
    const a = Math.PI * (k / 18);
    const c = Math.cos(a);
    const s = Math.sin(a);
    points.push([Math.sign(c) * w * Math.abs(c) ** 0.42, FLOOR + (belt - FLOOR) * s ** 0.62]);
  }
  return points;
}

function cabinSection(z) {
  const w = cabinWidth(z);
  const low = beltAt(z) - 0.08;
  const top = roofAt(z);
  const points = [];
  for (let k = 0; k <= 12; k++) {
    const a = Math.PI * (k / 12);
    points.push([Math.sign(Math.cos(a)) * w * Math.abs(Math.cos(a)) ** 0.6, low + (top - low) * Math.sin(a) ** 0.72]);
  }
  return points;
}

function stripe(from, to, x) {
  const half = 0.2;
  return loft(span(from, to, 28), (z) => [[x + half, beltAt(z) + 0.03], [x - half, beltAt(z) + 0.03]].map(([px, py]) => [px, py + 0.01 - 0.1 * (px / widthAt(z)) ** 2]));
}

function buildParts() {
  const lamp = merge([box(0.86, 0.14, 0.62, 0, 0.07, -0.31)]);
  const lens = merge([box(0.72, 0.42, 0.06, 0, 0.3, 0.02)]);
  const pod = merge([box(0.86, 0.5, 0.56, 0, 0.26, -0.3)]);
  return {
    nose: loft(span(NOSE_FROM, 5.5, 26), bodySection),
    waist: loft(span(TAIL_FROM, NOSE_FROM, 12), bodySection),
    tail: loft(span(-5, TAIL_FROM, 18), bodySection),
    noseCap: new THREE.CircleGeometry(1, 16).scale(1.34, 0.28, 1).translate(0, -0.14, 5.5),
    tailCap: new THREE.CircleGeometry(1, 20).scale(1.9, 0.6, 1).rotateY(Math.PI).translate(0, 0.2, -5),
    cabin: loft(span(-3, 1.5, 18), cabinSection),
    roof: loft(span(-1.9, 0.5, 10), (z) => cabinSection(z).filter((_, k) => k >= 3 && k <= 9).map(([x, y]) => [x * 0.96, y + 0.03])),
    stripes: merge([stripe(1.4, 5.3, 0.42), stripe(1.4, 5.3, -0.42), stripe(-4.9, -2.9, 0.42), stripe(-4.9, -2.9, -0.42)]),
    skirt: merge([1, -1].map((s) => box(0.14, 0.22, 3.6, s * 2.26, -0.4, 0))),
    splitter: merge([box(3.2, 0.1, 0.8, 0, -0.42, 5.2), box(3, 0.32, 0.16, 0, -0.16, 5.2)]),
    diffuser: merge([box(3.6, 0.4, 0.3, 0, -0.2, -4.98)]),
    arch: merge([new THREE.TorusGeometry(0.88, 0.1, 6, 20, Math.PI).rotateY(Math.PI / 2)]),
    wing: merge([box(4.5, 0.12, 0.8, 0, 0, 0)]),
    wingEnds: merge([1, -1].map((s) => box(0.1, 0.5, 1, s * 2.28, -0.06, 0))),
    wingPosts: merge([1, -1].map((s) => box(0.14, 0.72, 0.3, s * 1.2, -0.36, 0))),
    taillight: merge([box(3.5, 0.16, 0.08, 0, 0.5, -5.02)]),
    exhaust: merge([1, -1].map((s) => tube(0.17, 0.6, s * 0.95, 0, 0, 0.2).rotateX(Math.PI / 2).translate(0, -0.16, -5.2))),
    lamp,
    lens,
    pod,
    tire: merge([sideways(tube(WHEEL_R, 0.66, 0, 0, 0))]),
    rim: merge([sideways(tube(0.5, 0.7, 0, 0, 0))]),
    spokes: merge(Array.from({ length: 5 }, (_, k) => box(0.72, 0.1, 0.16, 0, 0.26, 0).rotateX((k / 5) * Math.PI * 2))),
    underglow: new THREE.PlaneGeometry(6.4, 12.5).rotateX(-Math.PI / 2),
  };
}

function glowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const c = canvas.getContext('2d');
  const g = c.createRadialGradient(64, 64, 18, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

const carParts = () => cachedGeometry('carParts', buildParts);
const glowMap = () => cachedGeometry('carGlowMap', glowTexture);
const brake = () => cachedGeometry('carBrake', () => glow(0xff2a2a));

export class CarForm extends HullForm {
  constructor(refs, color) {
    const parts = carParts();
    super(refs, color, SPEC);
    const P = parts;
    const { add, S, paint, rig } = this;
    const columns = new Set(this.turrets.map((t) => t.column));
    this.boatBits = rig.children.filter((o) => !columns.has(o));
    this.nose = new THREE.Group();
    add(P.nose, paint, 0.05, this.nose);
    add(P.stripes, S.white, 0, this.nose);
    add(P.splitter, S.dark, 0.03, this.nose);
    this.nose.add(new THREE.Mesh(P.noseCap, S.dark));
    rig.add(this.nose);
    this.waist = [1, -1].map((side) => {
      const piece = new THREE.Group();
      add(P.waist, paint, 0.05, piece);
      add(P.skirt, S.dark, 0.02, piece);
      rig.add(piece);
      return { piece, side };
    });
    this.waist[1].piece.visible = false;
    this.tailEnd = new THREE.Group();
    add(P.tail, paint, 0.05, this.tailEnd);
    add(P.diffuser, S.dark, 0.03, this.tailEnd);
    add(P.exhaust, S.chrome, 0.02, this.tailEnd);
    this.tailEnd.add(new THREE.Mesh(P.tailCap, S.dark));
    this.tailEnd.add(new THREE.Mesh(P.taillight, brake()));
    rig.add(this.tailEnd);
    this.cabin = new THREE.Group();
    add(P.cabin, S.glass, 0.05, this.cabin);
    add(P.roof, paint, 0.02, this.cabin);
    rig.add(this.cabin);
    this.arches = [];
    for (const z of WHEEL_Z) for (const side of [1, -1]) {
      const arch = add(P.arch, S.dark, 0, rig);
      arch.position.set(side * (WHEEL_X + 0.26), WHEEL_Y, z);
      this.arches.push(arch);
    }
    this.lamps = [1, -1].map((side) => {
      const pivot = new THREE.Group();
      pivot.position.set(side * 1.28, beltAt(3.3) - 0.02, 3.6);
      add(P.pod, S.dark, 0.02, pivot);
      add(P.lamp, paint, 0.02, pivot);
      pivot.add(new THREE.Mesh(P.lens, S.head));
      rig.add(pivot);
      return pivot;
    });
    this.spoiler = new THREE.Group();
    this.spoiler.position.set(0, 1.62, -4.4);
    add(P.wing, paint, 0.03, this.spoiler);
    add(P.wingEnds, S.dark, 0.02, this.spoiler);
    add(P.wingPosts, S.dark, 0.02, this.spoiler);
    rig.add(this.spoiler);
    this.wheels = [];
    for (const z of WHEEL_Z) for (const side of [1, -1]) {
      const root = new THREE.Group();
      const spin = new THREE.Group();
      root.add(spin);
      add(P.tire, S.dark, 0.04, spin);
      add(P.rim, S.chrome, 0.02, spin);
      add(P.spokes, S.dark, 0.01, spin).position.x = side * 0.37;
      rig.add(root);
      this.wheels.push({ root, spin, z, side, front: z > 0 });
    }
    this.glowLight = new THREE.Mesh(P.underglow, new THREE.MeshBasicMaterial({ color, map: glowMap(), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.glowLight.position.y = FLOOR - 0.34;
    this.glowLight.renderOrder = 4;
    rig.add(this.glowLight);
  }

  set(p, roll, steer, time) {
    if (!this.enter(p)) return;
    const m = morphTime(p);
    const done = p >= 1;
    this.ride = CAR_RIDE * back(seg(m, 1.5, 2.1), 1.3);
    this.poseDeck(m, done, 0.4);
    const squash = seg(m, 1.2, 2);
    for (const bit of this.boatBits) {
      bit.visible = m < 2.6;
      bit.scale.y = mix(1, 0.42, smooth(squash));
    }
    this.motor.rotation.x = back(seg(m, 1.1, 1.7), 1.2) * 1.7;
    this.pole.scale.setScalar(Math.max(0.001, 1 - seg(m, 1.4, 1.8)));
    this.mountPart.visible = m < 2.2;
    this.refs.flag.visible = m < 1.8;
    for (const w of this.wheels) {
      const out = back(seg(m, 1 + (w.front ? 0 : 0.08) + (w.side > 0 ? 0 : 0.04), 1.6 + (w.front ? 0 : 0.08) + (w.side > 0 ? 0 : 0.04)), 1.5);
      w.root.visible = out > 0.001;
      w.root.position.set(w.side * mix(0.7, WHEEL_X, out), mix(0.5, WHEEL_Y, out), w.z);
      w.root.scale.setScalar(Math.max(0.001, mix(0.25, 1, out)));
      w.root.rotation.y = w.front ? steer * 0.9 : 0;
      w.spin.rotation.x = roll / WHEEL_R;
    }
    const noseIn = back(seg(m, 1.5, 2.15), 1.2);
    this.nose.visible = m > 1.45;
    this.nose.position.z = mix(-2.4, 0, noseIn);
    this.nose.scale.set(Math.max(0.001, mix(0.7, 1, noseIn)), Math.max(0.001, mix(0.5, 1, noseIn)), Math.max(0.05, noseIn));
    const tailIn = back(seg(m, 1.7, 2.35), 1.2);
    this.tailEnd.visible = m > 1.65;
    this.tailEnd.position.z = mix(2.2, 0, tailIn);
    this.tailEnd.scale.set(Math.max(0.001, mix(0.7, 1, tailIn)), Math.max(0.001, mix(0.5, 1, tailIn)), Math.max(0.05, tailIn));
    const waistIn = back(seg(m, 1.9, 2.45), 1.3);
    this.waist[0].piece.visible = m > 1.85;
    this.waist[0].piece.scale.set(Math.max(0.001, waistIn), 1, 1);
    const cabinUp = back(seg(m, 2.25, 2.8), 1.4);
    this.cabin.visible = m > 2.2;
    this.cabin.position.y = mix(-1.1, 0, cabinUp);
    this.cabin.scale.set(Math.max(0.001, mix(0.6, 1, cabinUp)), Math.max(0.001, cabinUp), 1);
    for (const arch of this.arches) arch.scale.setScalar(Math.max(0.001, seg(m, 2.3, 2.6)));
    const rise = back(seg(m, 2.55, 3), 1.8);
    this.spoiler.visible = m > 2.5;
    this.spoiler.position.y = mix(0.8, 1.62, rise);
    this.spoiler.scale.set(Math.max(0.001, rise), 1, 1);
    const popped = back(seg(m, 2.75, 3.1), 2);
    for (const pivot of this.lamps) {
      pivot.visible = m > 2.7;
      pivot.rotation.x = mix(1.5, 0, popped);
    }
    const neon = seg(m, 2.95, 3.25);
    this.glowLight.visible = neon > 0.01;
    this.glowLight.material.opacity = neon * (0.62 + 0.08 * Math.sin((time ?? 0) * 7));
    for (const t of this.turrets) {
      const front = t.slot === 0;
      const seat = smooth(seg(m, front ? 2.7 : 2.6, front ? 3.15 : 3.05));
      this.placeTurret(t, mix(this.riseOf(t, m), front ? 1.74 : 0.86, seat), mix(t.rest.z, front ? -0.7 : -3.2, seat), mix(1, 0.6, seat), 1 - seg(m, 2.8, 3.1), m, seat > 0.99);
    }
  }

  drift() {}

  stow() {
    super.stow();
    this.refs.flag.visible = true;
    for (const bit of this.boatBits) bit.scale.y = 1;
  }
}
