import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { HULL_L, charrable, halfWidth, sheer } from './boatModel.js';
import { toon, glow, outlined, cachedGeometry } from './toon.js';

export const METAL = 0xc3cdd8;
export const DARK = 0x34465e;
export const BOW_CUT = 3;
export const HATCH_Z0 = -1.6;
export const HATCH_Z1 = 0.8;
const DOOR_S = 0.56;
const MORPH_START = 0.3;
const MORPH_SPAN = 3.45;

export const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const seg = (t, a, b) => clamp01((t - a) / (b - a));
export const mix = (a, b, x) => a + (b - a) * x;
export const smooth = (x) => x * x * (3 - 2 * x);
export const back = (x, s = 1.7) => 1 + (s + 1) * (x - 1) ** 3 + s * (x - 1) ** 2;
export const steps = (a, b, n) => Array.from({ length: n + 1 }, (_, k) => a + ((b - a) * k) / n);

const SECTION = new THREE.SplineCurve([
  new THREE.Vector2(1, 1),
  new THREE.Vector2(1, 0.72),
  new THREE.Vector2(0.95, 0.46),
  new THREE.Vector2(0.82, 0.26),
  new THREE.Vector2(0.58, 0.12),
  new THREE.Vector2(0.29, 0.04),
  new THREE.Vector2(0, 0),
]).getPoints(12);

export function keel(z) {
  const u = z / HULL_L;
  return u > 0 ? -0.9 + 0.85 * Math.pow(u, 2.5) : -0.9 + 0.12 * u * u;
}

export function hullPoint(z, s, side) {
  const f = clamp01(s) * (SECTION.length - 1);
  const i = Math.min(Math.floor(f), SECTION.length - 2);
  const p = SECTION[i].clone().lerp(SECTION[i + 1], f - i);
  const w = halfWidth(Math.min(z, HULL_L));
  const top = sheer(z);
  const k = keel(z);
  return new THREE.Vector3(side * p.x * w, k + (top - k) * p.y, z);
}

export const hullAt = (z, t) => hullPoint(z, 1 - Math.abs(t), t < 0 ? -1 : 1);
export const deckPoint = (z, f) => new THREE.Vector3(f * halfWidth(Math.min(z, HULL_L)) * 0.97, sheer(z) - 0.04 + 0.1 * (1 - f * f), z);

export function shell(us, vs, fn, { depth = 0.08, flip = false, uv = (u, v) => [u, v], uvBack = uv, single = false, skip = null, offset = 0 } = {}) {
  const nu = us.length;
  const nv = vs.length;
  const e = 1e-3;
  const point = [];
  const normal = [];
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv; j++) {
      const u = us[i];
      const v = vs[j];
      const n = fn(u + e, v).sub(fn(u - e, v)).cross(fn(u, v + e).sub(fn(u, v - e)));
      if (n.lengthSq() < 1e-16) n.set(0, 1, 0);
      n.normalize();
      if (flip) n.negate();
      point.push(fn(u, v).addScaledVector(n, offset));
      normal.push(n);
    }
  }
  const at = (i, j) => i * nv + j;
  const inner = point.map((p, k) => p.clone().addScaledVector(normal[k], -depth));
  const lists = [{ pos: [], nor: [], tex: [] }, { pos: [], nor: [], tex: [] }, { pos: [], nor: [], tex: [] }];
  const emit = (list, p, n, t) => {
    list.pos.push(p.x, p.y, p.z);
    list.nor.push(n.x, n.y, n.z);
    list.tex.push(t[0], t[1]);
  };
  for (let i = 0; i < nu - 1; i++) {
    for (let j = 0; j < nv - 1; j++) {
      if (skip?.((us[i] + us[i + 1]) / 2, (vs[j] + vs[j + 1]) / 2)) continue;
      const q = [at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)];
      const order = flip ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3];
      const reverse = flip ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
      const grid = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]];
      for (const c of order) emit(lists[0], point[q[c]], normal[q[c]], uv(us[grid[c][0]], vs[grid[c][1]]));
      if (single) continue;
      for (const c of reverse) emit(lists[1], inner[q[c]], normal[q[c]].clone().negate(), uvBack(us[grid[c][0]], vs[grid[c][1]]));
    }
  }
  if (!single) {
    const rim = (a, b) => {
      const pa = point[a];
      const pb = point[b];
      const qa = inner[a];
      const qb = inner[b];
      const n = pb.clone().sub(pa).cross(qa.clone().sub(pa)).normalize();
      if (flip) n.negate();
      const face = flip ? [pa, qa, pb, pb, qa, qb] : [pa, pb, qa, pb, qb, qa];
      for (const p of face) emit(lists[2], p, n, [0, 0]);
    };
    for (let i = 0; i < nu - 1; i++) {
      rim(at(i + 1, 0), at(i, 0));
      rim(at(i, nv - 1), at(i + 1, nv - 1));
    }
    for (let j = 0; j < nv - 1; j++) {
      rim(at(0, j), at(0, j + 1));
      rim(at(nu - 1, j + 1), at(nu - 1, j));
    }
  }
  const pos = [];
  const nor = [];
  const tex = [];
  const g = new THREE.BufferGeometry();
  lists.forEach((list, k) => {
    g.addGroup(pos.length / 3, list.pos.length / 3, k);
    pos.push(...list.pos);
    nor.push(...list.nor);
    tex.push(...list.tex);
  });
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(tex, 2));
  return g;
}

export function texture(key, draw) {
  return cachedGeometry(`truckTex:${key}`, () => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    draw(canvas.getContext('2d'));
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
    return t;
  });
}

export const planks = () =>
  texture('planks', (ctx) => {
    ctx.fillStyle = '#ffe9c4';
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#e6c493';
    for (let i = 0; i <= 8; i++) ctx.fillRect(i * 32 - 2, 0, 4, 256);
    for (let i = 0; i < 8; i++) ctx.fillRect(i * 32, (i * 97) % 256, 32, 4);
  });

export const tread = () =>
  texture('tread', (ctx) => {
    ctx.fillStyle = '#4a5c74';
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = '#2f3f55';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const cx = x * 32 + (y % 2) * 16 + 8;
        const cy = y * 32 + 16;
        const flip = (x + y) % 2 ? 1 : -1;
        ctx.beginPath();
        ctx.moveTo(cx - 6, cy - 6 * flip);
        ctx.lineTo(cx + 6, cy + 6 * flip);
        ctx.stroke();
      }
    }
  });

export const striped = (color, bands) =>
  texture(`stripe:${color}:${bands}`, (ctx) => {
    ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#ffffff';
    for (const [a, b] of bands) ctx.fillRect(a * 256, 0, (b - a) * 256, 256);
  });

export function sectionShape(z) {
  const shape = new THREE.Shape();
  for (let k = 0; k <= 24; k++) {
    const p = hullAt(z, 1 - k / 12);
    if (k === 0) shape.moveTo(p.x, p.y);
    else shape.lineTo(p.x, p.y);
  }
  shape.closePath();
  return shape;
}

export function bumperPiece(a, b, side, tip = false) {
  const pts = steps(a, b, 14).map((z) => new THREE.Vector3(side * (halfWidth(z) + 0.02), sheer(z) + 0.04, z));
  if (tip) pts.push(new THREE.Vector3(0, sheer(HULL_L * 0.9925) + 0.04, HULL_L * 0.9925 + 0.01));
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'centripetal'), 40, 0.22, 10, false);
}

export const box = (w, h, d, x, y, z) => {
  const g = new RoundedBoxGeometry(w, h, d, 2, Math.min(w, h, d) * 0.2);
  g.deleteAttribute('uv');
  return g.translate(x, y, z);
};
export const tube = (r, h, x, y, z, top = r) => {
  const g = new THREE.CylinderGeometry(top, r, h, 14).toNonIndexed();
  g.deleteAttribute('uv');
  return g.translate(x, y, z);
};
export const sideways = (g) => g.rotateZ(Math.PI / 2);
export const plain = (g) => {
  const out = g.index ? g.toNonIndexed() : g;
  out.deleteAttribute('uv');
  return out;
};
export const merge = (parts) => mergeGeometries(parts.map(plain));

function hullParts({ key, doors = [], hatch = false, jaws = false, bedRepeat = 1 }) {
  const end = jaws ? BOW_CUT : HULL_L;
  const zs = [...new Set([...steps(-HULL_L, end, 44), ...doors.flatMap((d) => [d.z0, d.z1])])].sort((a, b) => a - b);
  const ts = [...new Set([...steps(-1, 1, 40), -1 + DOOR_S, 1 - DOOR_S])].sort((a, b) => a - b);
  const inDoor = (z, t) => Math.abs(t) > 1 - DOOR_S && doors.some((d) => z > d.z0 && z < d.z1);
  const parts = {
    key,
    hull: shell(zs, ts, hullAt, { single: true, flip: true, skip: inDoor }),
    hullInner: shell(zs, ts, hullAt, { single: true, flip: true, offset: -0.06 }),
    transom: new THREE.ShapeGeometry(sectionShape(-HULL_L)).rotateY(Math.PI).translate(0, 0, -HULL_L),
    bumper: merge([
      jaws ? bumperPiece(-HULL_L, BOW_CUT, 1) : bumperPiece(-HULL_L, HULL_L * 0.985, 1, true),
      jaws ? bumperPiece(-HULL_L, BOW_CUT, -1) : bumperPiece(-HULL_L, HULL_L * 0.985, -1, true),
      new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(-1.72, sheer(-HULL_L) + 0.04, -HULL_L), new THREE.Vector3(1.72, sheer(-HULL_L) + 0.04, -HULL_L)), 4, 0.22, 10, false),
    ]),
    doors: [],
    slats: [],
    leaves: [],
    jaws: [],
  };
  for (const [k, d] of doors.entries()) {
    for (const side of [1, -1]) {
      const geo = shell(steps(d.z0, d.z1, 12), steps(0, DOOR_S, 10), (z, s) => hullPoint(z, s, side), { flip: side < 0 });
      const a = hullPoint(d.z0, 0, side);
      const b = hullPoint(d.z1, 0, side);
      const mid = a.clone().add(b).multiplyScalar(0.5);
      geo.translate(-mid.x, -mid.y, -mid.z);
      parts.doors.push({ geo, mid, axis: b.clone().sub(a).normalize(), side, index: k });
    }
  }
  const deckUv = (z, f) => [(f + 1) / 2, ((z + HULL_L) / (2 * HULL_L)) * 5];
  const backUv = (repeat) => (z, f) => [((f + 1) / 2) * repeat, z * 0.35 * repeat];
  const addSlats = (a, b, n, hood, repeat) => {
    const edges = steps(a, b, n);
    for (let k = 0; k < n; k++) {
      const z0 = edges[k] + 0.006;
      const z1 = edges[k + 1] - 0.006;
      const zc = (z0 + z1) / 2;
      const geo = shell(steps(z0, z1, 3), steps(-1, 1, 8), deckPoint, { depth: 0.1, uv: deckUv, uvBack: backUv(repeat) });
      const y = deckPoint(zc, 0).y - 0.05;
      geo.translate(0, -y, -zc);
      parts.slats.push({ geo, y, zc, hood });
    }
  };
  const plate = (a, b, repeat) => shell(steps(a, b, 12), steps(-1, 1, 8), deckPoint, { single: true, uv: backUv(repeat) });
  if (hatch) {
    addSlats(-HULL_L, HATCH_Z0, 4, bedRepeat === 1, bedRepeat);
    addSlats(HATCH_Z1, BOW_CUT, 3, true, 1);
    parts.plates = [{ geo: plate(-HULL_L, HATCH_Z0, bedRepeat), hood: bedRepeat === 1 }, { geo: plate(HATCH_Z1, BOW_CUT, 1), hood: true }];
  } else {
    addSlats(-HULL_L, BOW_CUT, 7, true, 1);
    parts.plates = [{ geo: plate(-HULL_L, BOW_CUT, 1), hood: true }];
  }
  if (!jaws) parts.bow = shell(steps(BOW_CUT, HULL_L, 12), steps(-1, 1, 8), deckPoint, { depth: 0.06, uv: deckUv });
  for (const side of [1, -1]) {
    if (hatch) {
      const uv = (z, f) => [(side * f + 1) / 2, ((z + HULL_L) / (2 * HULL_L)) * 5];
      const geo = shell(steps(HATCH_Z0, HATCH_Z1, 8), steps(0.005, 1, 6), (z, f) => deckPoint(z, side * f), { depth: 0.09, flip: side < 0, uv, uvBack: (z, f) => [f, z] });
      const hinge = new THREE.Vector3(side * 2, 1.12, (HATCH_Z0 + HATCH_Z1) / 2);
      geo.translate(-hinge.x, -hinge.y, -hinge.z);
      parts.leaves.push({ geo, hinge, side });
    }
    if (jaws) {
      const jaw = new THREE.Vector3(side * halfWidth(BOW_CUT), 0.3, BOW_CUT);
      const shift = (g) => g.translate(-jaw.x, -jaw.y, -jaw.z);
      const teeth = [3.3, 3.62, 3.92].map((z) => {
        const tooth = new THREE.ConeGeometry(0.13, 0.42, 6).toNonIndexed();
        tooth.deleteAttribute('uv');
        tooth.rotateZ((side * Math.PI) / 2);
        return tooth.translate(hullPoint(z, 0, side).x * 0.08, 0.65, z);
      });
      parts.jaws.push({
        side,
        hinge: jaw,
        skin: shift(shell(steps(BOW_CUT, HULL_L, 16), steps(0, 1, 12), (z, s) => hullPoint(z, s, side), { flip: side < 0 })),
        top: shift(shell(steps(BOW_CUT, HULL_L, 12), steps(0, 1, 5), (z, f) => deckPoint(z, side * f), { depth: 0.06, flip: side < 0, uv: deckUv })),
        rail: shift(bumperPiece(BOW_CUT, HULL_L * 0.985, side, true)),
        teeth: shift(merge(teeth)),
      });
    }
  }
  parts.cowl = box(0.85, 0.95, 0.85, 0, 0, 0);
  parts.cowlCap = box(0.7, 0.18, 0.7, 0, 0.53, 0);
  parts.mount = box(0.6, 0.5, 0.35, 0, sheer(-HULL_L) - 0.05, -HULL_L - 0.15);
  parts.leg = merge([tube(0.065, 1.3, 0, -0.65, 0), box(0.32, 0.32, 0.5, 0, -1.3, -0.05), box(0.06, 0.3, 0.5, 0, -1.55, 0.1)]);
  parts.pole = tube(0.05, 1.6, 0, 0, 0);
  parts.link = new THREE.CylinderGeometry(1, 1, 1, 8);
  return parts;
}

export const shared = () =>
  cachedGeometry('truckMaterials', () => ({
    metal: toon(METAL),
    dark: toon(DARK),
    white: toon(0xffffff),
    rubber: toon(0x2a2f38),
    glass: toon(0x1c3550),
    chrome: toon(0xeef4fa),
    head: glow(0xfff6c8),
    tail: glow(0xff3a30),
    inner: new THREE.MeshBasicMaterial({ color: 0x18222f, side: THREE.BackSide }),
    deck: toon(0xffffff, { map: planks() }),
    tread: toon(0xffffff, { map: tread() }),
  }));

const SOOT = new THREE.Color(0x1f1c1b);
const UP = new THREE.Vector3(0, 1, 0);
const span = new THREE.Vector3();
const dir = new THREE.Vector3();

export function link(mesh, a, b) {
  span.subVectors(b, a);
  mesh.position.copy(a).addScaledVector(span, 0.5);
  mesh.quaternion.setFromUnitVectors(UP, dir.copy(span).normalize());
  mesh.scale.y = Math.max(0.001, span.length());
}

export const morphTime = (p) => MORPH_START + p * MORPH_SPAN;

export class HullForm {
  constructor(refs, color, spec) {
    const P = cachedGeometry(`hullParts:${spec.key}`, () => hullParts(spec));
    const S = { ...shared() };
    for (const key of ['metal', 'dark', 'white', 'rubber', 'glass', 'chrome', 'deck', 'tread']) S[key] = S[key].clone();
    const paint = toon(color);
    const hoodMat = toon(0xffffff, { map: striped(color, [[0.4, 0.47], [0.53, 0.6]]) });
    const skirtMat = toon(0xffffff, { map: striped(color, [[0.42, 0.56]]) });
    for (const m of [paint, hoodMat, skirtMat, S.metal, S.dark, S.white, S.rubber, S.glass, S.chrome, S.deck, S.tread]) {
      m.emissive = new THREE.Color(0xffffff);
      m.emissiveIntensity = 0;
      charrable(m, refs.char);
      refs.materials.push(m);
    }
    this.refs = refs;
    this.paint = paint;
    this.P = P;
    this.S = S;
    this.color = new THREE.Color(color);
    this.scorched = 0;
    this.ride = 0;
    this.active = false;
    this.hull = refs.body.children.filter((o) => o.isMesh);
    for (const s of refs.spinners) if (s.propeller) this.hull.push(s.mesh);
    const turretGroups = new Set(refs.swivels.map((s) => s.group.parent));
    this.mods = Object.values(refs.parts).filter((o) => !turretGroups.has(o));
    const rig = new THREE.Group();
    rig.visible = false;
    refs.body.add(rig);
    this.rig = rig;
    this.add = (geo, mat, outline = 0.03, parent = rig) => {
      const mesh = outlined(geo, mat, outline);
      parent.add(mesh);
      return mesh;
    };
    const { add } = this;
    add(P.hull, [paint, S.dark, S.dark], 0.07);
    rig.add(new THREE.Mesh(P.hullInner, [S.inner, S.inner, S.inner]));
    add(P.transom, paint, 0);
    add(P.bumper, S.white, 0.04);
    if (P.bow) add(P.bow, [S.deck, S.dark, S.dark], 0.02);
    this.doors = P.doors.map((d) => {
      const pivot = new THREE.Group();
      pivot.position.copy(d.mid);
      add(d.geo, [paint, S.dark, paint], 0.05, pivot);
      rig.add(pivot);
      return { pivot, axis: d.axis, side: d.side, index: d.index };
    });
    this.slats = P.slats.map((s) => {
      const pivot = new THREE.Group();
      pivot.position.set(0, s.y, s.zc);
      add(s.geo, [S.deck, s.hood ? hoodMat : S.tread, S.dark], 0.02, pivot);
      rig.add(pivot);
      return { pivot, zc: s.zc };
    });
    this.plates = P.plates.map((p) => add(p.geo, [p.hood ? hoodMat : S.tread, S.dark, S.dark], 0));
    this.leaves = P.leaves.map((l) => {
      const pivot = new THREE.Group();
      pivot.position.copy(l.hinge);
      add(l.geo, [S.deck, skirtMat, S.dark], 0.03, pivot);
      rig.add(pivot);
      return { pivot, side: l.side };
    });
    this.jaws = P.jaws.map((j) => {
      const pivot = new THREE.Group();
      pivot.position.copy(j.hinge);
      add(j.skin, [paint, S.dark, S.dark], 0.07, pivot);
      add(j.top, [S.deck, S.dark, S.dark], 0.02, pivot);
      add(j.rail, S.white, 0.04, pivot);
      if (spec.teeth) add(j.teeth, S.chrome, 0.02, pivot);
      rig.add(pivot);
      return { pivot, side: j.side, hinge: j.hinge };
    });
    const sternTop = sheer(-HULL_L);
    this.motor = new THREE.Group();
    this.motor.position.set(0, sternTop + 0.35, -HULL_L - 0.55);
    add(P.cowl, paint, 0.04, this.motor);
    add(P.cowlCap, S.white, 0.03, this.motor);
    this.leg = new THREE.Group();
    this.leg.position.y = -0.4;
    add(P.leg, S.dark, 0.03, this.leg);
    this.motor.add(this.leg);
    rig.add(this.motor);
    this.mountPart = add(P.mount, S.dark, 0.03);
    const flagZ = -HULL_L + 0.6;
    this.pole = add(P.pole, S.dark, 0.02);
    this.pole.position.set(halfWidth(flagZ) - 0.35, sternTop + 0.8, flagZ);
    this.turrets = refs.swivels.map((s) => {
      const group = s.group.parent;
      const column = new THREE.Mesh(P.link.clone().scale(0.26, 1, 0.26), S.metal);
      rig.add(column);
      return { group, slot: s.slot, rest: group.position.clone(), column };
    });
    this.a = new THREE.Vector3();
    this.b = new THREE.Vector3();
  }

  scorch(amount) {
    if (amount === this.scorched) return;
    this.scorched = amount;
    this.paint.color.copy(this.color).lerp(SOOT, amount * 0.72);
  }

  stow() {
    this.active = false;
    this.ride = 0;
    this.rig.visible = false;
    for (const o of this.hull) o.visible = true;
    for (const o of this.mods) o.visible = true;
    for (const t of this.turrets) {
      t.group.position.copy(t.rest);
      t.group.scale.setScalar(1);
    }
  }

  enter(p) {
    if (p <= 0) {
      if (this.active) this.stow();
      return false;
    }
    if (!this.active) {
      this.active = true;
      this.rig.visible = true;
      for (const o of this.hull) o.visible = false;
      for (const o of this.mods) o.visible = false;
    }
    return true;
  }

  poseDeck(m, done, start = 0.72) {
    for (const slat of this.slats) {
      slat.pivot.visible = !done;
      const at = start + ((BOW_CUT - slat.zc) / 7.2) * 0.62;
      slat.pivot.rotation.x = Math.PI * back(seg(m, at, at + 0.34), 1.2);
    }
    for (const plate of this.plates) plate.visible = done;
    for (const leaf of this.leaves) leaf.pivot.rotation.z = -leaf.side * back(seg(m, 0.95, 1.55), 1.1) * 4.42;
  }

  placeTurret(t, y, z, scale, reach, m, done) {
    const front = t.slot === 0;
    const rise = back(seg(m, front ? 0.36 : 0.28, front ? 0.82 : 0.72), 1.5);
    t.group.position.set(0, y, z);
    t.group.scale.setScalar(scale);
    const { a, b } = this;
    a.set(0, t.rest.y - 0.3, t.rest.z);
    b.copy(a).lerp(t.group.position, reach);
    link(t.column, a, b);
    t.column.visible = rise > 0.01 && reach > 0.01 && !done;
  }

  riseOf(t, m) {
    const front = t.slot === 0;
    return t.rest.y + back(seg(m, front ? 0.36 : 0.28, front ? 0.82 : 0.72), 1.5) * (front ? 2.15 : 1.75);
  }
}
